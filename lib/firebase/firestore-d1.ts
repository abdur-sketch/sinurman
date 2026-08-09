import alasql from "alasql";
import { createHash } from "node:crypto";
import type { QuerySnapshot, Transaction } from "firebase-admin/firestore";
import { firebaseAdmin } from "./admin";

type Row = Record<string, unknown>;
type LegacyState = { version: 1; ddl: string[]; tables: Record<string, Row[]> };
type V2SchemaState = { version: 2; ddl: string[]; migratedAt: string; updatedAt: string };
type V2TableState = { version: 2; rows: Row[]; updatedAt: string };
type SchemaState = { version: 3; ddl: string[]; migratedAt: string; updatedAt: string };
type TableState = { version: 3; rowCount: number; migratedAt: string; updatedAt: string };
type StoredRow = { data: Row; updatedAt: string };
type EngineTable = {
  columns: Array<{ columnid: string }>;
  data: Row[];
  insert(row: Row): void;
};
type Engine = {
  exec(sql: string, params?: unknown[]): unknown;
  tables: Record<string, EngineTable>;
};
type RuntimeState = { ddl: string[]; tables: Record<string, Row[]> };
type RunMeta = { changes: number; last_row_id?: number };

const systemCollection = () => firebaseAdmin().firestore.collection("_system");
const schemaDocument = () => systemCollection().doc("d1-schema-v3");
const v2SchemaDocument = () => systemCollection().doc("d1-schema-v2");
const legacyDocument = () => systemCollection().doc("d1-state-v1");
const tableDocument = (name: string) => firebaseAdmin().firestore.collection("_d1_tables").doc(name);
const tableRows = (name: string) => tableDocument(name).collection("rows");

function cleanRows(rows: Row[]) {
  return JSON.parse(JSON.stringify(rows)) as Row[];
}

function rowDocumentId(row: Row) {
  const id=row.id;
  if(id!==undefined&&id!==null&&String(id)!=="") return `id-${String(id).replace(/[^A-Za-z0-9_-]/g,"_")}`;
  return `row-${createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0,40)}`;
}

function mutationTable(sql: string) {
  return sql.match(/^\s*(?:INSERT(?:\s+OR\s+IGNORE)?\s+INTO|UPDATE|DELETE\s+FROM)\s+([A-Za-z_]\w*)/i)?.[1] ?? "";
}

function referencedTables(sql: string) {
  const names = new Set<string>();
  const pattern = /\b(?:FROM|JOIN|UPDATE|INTO)\s+([A-Za-z_]\w*)/gi;
  for (const match of sql.matchAll(pattern)) names.add(match[1]);
  const mutation = mutationTable(sql);
  if (mutation) names.add(mutation);
  return [...names];
}

function createTableName(sql: string) {
  return sql.match(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_]\w*)/i)?.[1] ?? "";
}

function clearTableName(sql:string) {
  return sql.match(/^\s*DELETE\s+FROM\s+([A-Za-z_]\w*)\s*;?\s*$/i)?.[1]??"";
}

function normalizeSql(sql: string, params: unknown[]) {
  let normalized = sql.trim().replace(/^INSERT\s+OR\s+IGNORE\s+/i, "INSERT ");
  const values = [...params];
  if (/date\(\?,\s*'\+7 day'\)/i.test(normalized) && values.length) {
    const date = new Date(`${String(values[0])}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 7);
    values[0] = date.toISOString().slice(0, 10);
    normalized = normalized.replace(/date\(\?,\s*'\+7 day'\)/i, "?");
  }
  return { sql: normalized, params: values };
}

function createEngine(state: RuntimeState) {
  const engine = new alasql.Database() as unknown as Engine;
  for (const ddl of state.ddl) engine.exec(ddl);
  for (const [name, rows] of Object.entries(state.tables)) {
    const table = engine.tables[name];
    if (!table) continue;
    for (const row of rows) table.insert({ ...row });
  }
  return engine;
}

function pragmaRows(engine: Engine, sql: string) {
  const name = sql.match(/PRAGMA\s+table_info\(([^)]+)\)/i)?.[1]?.trim() ?? "";
  return (engine.tables[name]?.columns ?? []).map((column) => ({ name: column.columnid }));
}

function execute(engine: Engine, state: RuntimeState, rawSql: string, rawParams: unknown[]) {
  const sql = rawSql.trim().replace(/\btotal\b/gi, "[total]");
  if (/^CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(sql)) return { value: 0, meta: { changes: 0 } satisfies RunMeta };
  if (/^PRAGMA\s+table_info/i.test(sql)) return { value: pragmaRows(engine, sql), meta: { changes: 0 } satisfies RunMeta };
  if (/^ALTER\s+TABLE/i.test(sql)) {
    const normalized=sql.replace(/\s+ADD\s+(?!COLUMN\b)/i," ADD COLUMN ");
    if (!state.ddl.includes(normalized)) state.ddl.push(normalized);
    const value=engine.exec(normalized);
    return { value, meta: { changes: 0 } satisfies RunMeta };
  }
  if (/instr\(/i.test(sql) || /^UPDATE\s+students\s+SET\s+guardian_phone=CASE/i.test(sql)) {
    return { value: 0, meta: { changes: 0 } satisfies RunMeta };
  }
  if (/^CREATE\s+TABLE/i.test(sql)) {
    if (!state.ddl.includes(sql)) state.ddl.push(sql);
    const value = engine.exec(sql);
    return { value, meta: { changes: 0 } satisfies RunMeta };
  }

  const table = mutationTable(sql);
  const beforeRows = table ? engine.tables[table]?.data.length ?? 0 : 0;
  const normalized = normalizeSql(sql, rawParams);
  try {
    const value = engine.exec(normalized.sql, normalized.params);
    const rows = table ? engine.tables[table]?.data ?? [] : [];
    const lastId = rows.reduce((maximum, row) => Math.max(maximum, Number(row.id ?? 0)), 0);
    const numericResult = typeof value === "number" ? value : Math.abs(rows.length - beforeRows);
    return {
      value,
      meta: {
        changes: Number.isFinite(numericResult) ? numericResult : Math.abs(rows.length - beforeRows),
        ...(lastId ? { last_row_id: lastId } : {}),
      } satisfies RunMeta,
    };
  } catch (error) {
    if (/^INSERT\s+OR\s+IGNORE/i.test(sql) && error instanceof Error && /unique index|already exists/i.test(error.message)) {
      return { value: 0, meta: { changes: 0 } satisfies RunMeta };
    }
    throw error;
  }
}

let schemaReady: Promise<SchemaState> | null = null;
const tableMigrations = new Map<string,Promise<void>>();

async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = firebaseAdmin().firestore.runTransaction(async (transaction) => {
    const [current,v2,legacy]=await Promise.all([
      transaction.get(schemaDocument()),
      transaction.get(v2SchemaDocument()),
      transaction.get(legacyDocument()),
    ]);
    if(current.exists) return current.data() as SchemaState;
    const v2State=v2.exists?v2.data() as V2SchemaState:null;
    const legacyState=legacy.exists?legacy.data() as LegacyState:null;
    const now=new Date().toISOString();
    const schema:SchemaState={version:3,ddl:v2State?.ddl??legacyState?.ddl??[],migratedAt:now,updatedAt:now};
    transaction.set(schemaDocument(),schema);
    return schema;
  }).catch((error)=>{schemaReady=null;throw error;});
  return schemaReady;
}

async function ensureTableMigrated(name:string) {
  const pending=tableMigrations.get(name);
  if(pending)return pending;
  const migration=(async()=>{
    await ensureSchema();
    const metadataRef=tableDocument(name);
    const metadata=await metadataRef.get();
    if(metadata.exists&&Number(metadata.data()?.version)===3)return;
    let sourceRows:Row[]=[];
    if(metadata.exists&&Number(metadata.data()?.version)===2) sourceRows=cleanRows((metadata.data() as V2TableState).rows??[]);
    else {
      const legacy=await legacyDocument().get();
      sourceRows=legacy.exists?cleanRows(((legacy.data() as LegacyState).tables??{})[name]??[]):[];
    }
    const now=new Date().toISOString();
    for(let start=0;start<sourceRows.length;start+=400) {
      const batch=firebaseAdmin().firestore.batch();
      sourceRows.slice(start,start+400).forEach(row=>batch.set(tableRows(name).doc(rowDocumentId(row)),{data:row,updatedAt:now} satisfies StoredRow));
      await batch.commit();
    }
    await metadataRef.set({version:3,rowCount:sourceRows.length,migratedAt:now,updatedAt:now} satisfies TableState);
  })().catch(error=>{tableMigrations.delete(name);throw error;});
  tableMigrations.set(name,migration);
  return migration;
}

async function readTable(name:string) {
  await ensureTableMigrated(name);
  const snapshot=await tableRows(name).get();
  return cleanRows(snapshot.docs.map(document=>(document.data() as StoredRow).data??{}));
}

async function readState(sql: string) {
  const schema = await ensureSchema();
  const names = referencedTables(sql);
  const rows=await Promise.all(names.map(readTable));
  return { ddl: [...schema.ddl], tables: Object.fromEntries(names.map((name,index)=>[name,rows[index]])) } satisfies RuntimeState;
}

async function clearTable(name:string) {
  await ensureTableMigrated(name);
  let removed=0;
  for(;;) {
    const snapshot=await tableRows(name).limit(400).get();
    if(snapshot.empty)break;
    const batch=firebaseAdmin().firestore.batch();
    snapshot.docs.forEach(document=>batch.delete(document.ref));
    await batch.commit();removed+=snapshot.size;
  }
  await tableDocument(name).set({version:3,rowCount:0,updatedAt:new Date().toISOString()},{merge:true});
  return {success:true,meta:{changes:removed} satisfies RunMeta,results:[]};
}

function writeChangedTable(transaction:Transaction,name:string,before:Row[],after:Row[],now:string) {
  const previous=new Map(before.map(row=>[rowDocumentId(row),row]));
  // AlaSQL represents SQL NULL literals as undefined in some INSERT results.
  // Firestore rejects undefined fields, so normalize every mutated row before
  // comparing and persisting it. JSON sanitization preserves null values while
  // removing only fields Firestore cannot store.
  const sanitizedAfter=cleanRows(after);
  const next=new Map(sanitizedAfter.map(row=>[rowDocumentId(row),row]));
  for(const [id,row] of next) {
    if(JSON.stringify(previous.get(id))!==JSON.stringify(row)) transaction.set(tableRows(name).doc(id),{data:row,updatedAt:now} satisfies StoredRow);
  }
  for(const id of previous.keys()) if(!next.has(id)) transaction.delete(tableRows(name).doc(id));
  transaction.set(tableDocument(name),{version:3,rowCount:after.length,updatedAt:now},{merge:true});
}

class FirestoreStatement {
  private params: unknown[] = [];
  constructor(private readonly sql: string) {}
  bind(...values: unknown[]) { this.params = values; return this; }

  async all<T = Row>() {
    const state = await readState(this.sql);
    const engine = createEngine(state);
    const result = execute(engine, state, this.sql, this.params).value;
    return { success: true, results: (Array.isArray(result) ? result : []) as T[] };
  }

  async first<T = Row>() { const result = await this.all<T>(); return result.results[0] ?? null; }

  async run() {
    const cleared=clearTableName(this.sql);
    if(cleared)return clearTable(cleared);
    const names=[...new Set([...referencedTables(this.sql),createTableName(this.sql)].filter(Boolean))];
    await ensureSchema();await Promise.all(names.map(ensureTableMigrated));
    return firebaseAdmin().firestore.runTransaction(async transaction=>{
      const schemaSnapshot=await transaction.get(schemaDocument());
      const snapshots:QuerySnapshot[]=[];for(const name of names)snapshots.push(await transaction.get(tableRows(name)));
      const schema=schemaSnapshot.data() as SchemaState;
      const state:RuntimeState={ddl:[...(schema?.ddl??[])],tables:Object.fromEntries(names.map((name,index)=>[name,cleanRows(snapshots[index].docs.map(document=>(document.data() as StoredRow).data??{}))]))};
      const before=Object.fromEntries(Object.entries(state.tables).map(([name,rows])=>[name,cleanRows(rows)]));
      const engine=createEngine(state);const result=execute(engine,state,this.sql,this.params);const now=new Date().toISOString();
      if(state.ddl.length!==(schema?.ddl??[]).length)transaction.set(schemaDocument(),{...schema,version:3,ddl:state.ddl,updatedAt:now} satisfies SchemaState);
      const changed=mutationTable(this.sql)||createTableName(this.sql);
      if(changed)writeChangedTable(transaction,changed,before[changed]??[],engine.tables[changed]?.data??[],now);
      return {success:true,meta:result.meta,results:[]};
    });
  }

  values() { return this.params; }
  query() { return this.sql; }
}

export class FirestoreD1Database {
  prepare(sql: string) { return new FirestoreStatement(sql); }

  async batch(statements: FirestoreStatement[]) {
    if(statements.length>400) throw new Error("Maksimal 400 perubahan database dalam satu transaksi.");
    const names=[...new Set(statements.flatMap(statement=>[...referencedTables(statement.query()),createTableName(statement.query())]).filter(Boolean))];
    await ensureSchema();await Promise.all(names.map(ensureTableMigrated));
    return firebaseAdmin().firestore.runTransaction(async transaction=>{
      const schemaSnapshot=await transaction.get(schemaDocument());
      const snapshots:QuerySnapshot[]=[];for(const name of names)snapshots.push(await transaction.get(tableRows(name)));
      const schema=schemaSnapshot.data() as SchemaState;
      const state:RuntimeState={ddl:[...(schema?.ddl??[])],tables:Object.fromEntries(names.map((name,index)=>[name,cleanRows(snapshots[index].docs.map(document=>(document.data() as StoredRow).data??{}))]))};
      const before=Object.fromEntries(Object.entries(state.tables).map(([name,rows])=>[name,cleanRows(rows)]));
      const engine=createEngine(state);const changed=new Set<string>();
      const results=statements.map(statement=>{const result=execute(engine,state,statement.query(),statement.values());const name=mutationTable(statement.query())||createTableName(statement.query());if(name)changed.add(name);return {success:true,meta:result.meta,results:[]};});
      const now=new Date().toISOString();
      if(state.ddl.length!==(schema?.ddl??[]).length)transaction.set(schemaDocument(),{...schema,version:3,ddl:state.ddl,updatedAt:now} satisfies SchemaState);
      for(const name of changed)writeChangedTable(transaction,name,before[name]??[],engine.tables[name]?.data??[],now);
      return results;
    });
  }
}

let database: FirestoreD1Database | undefined;
export function firestoreD1Database() { database ??= new FirestoreD1Database(); return database; }
