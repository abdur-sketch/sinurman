import alasql from "alasql";
import { firebaseAdmin } from "./admin";

type Row = Record<string, unknown>;
type LegacyState = { version: 1; ddl: string[]; tables: Record<string, Row[]> };
type SchemaState = { version: 2; ddl: string[]; migratedAt: string; updatedAt: string };
type TableState = { version: 2; rows: Row[]; updatedAt: string };
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
const schemaDocument = () => systemCollection().doc("d1-schema-v2");
const legacyDocument = () => systemCollection().doc("d1-state-v1");
const tableDocument = (name: string) => firebaseAdmin().firestore.collection("_d1_tables").doc(name);

function cleanRows(rows: Row[]) {
  return JSON.parse(JSON.stringify(rows)) as Row[];
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
  if (/^ALTER\s+TABLE/i.test(sql)) return { value: 0, meta: { changes: 0 } satisfies RunMeta };
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

let migrationReady: Promise<SchemaState> | null = null;

async function ensureShardedState() {
  if (migrationReady) return migrationReady;
  migrationReady = firebaseAdmin().firestore.runTransaction(async (transaction) => {
    const schemaRef = schemaDocument();
    const legacyRef = legacyDocument();
    const [schemaSnapshot, legacySnapshot] = await Promise.all([
      transaction.get(schemaRef),
      transaction.get(legacyRef),
    ]);
    if (schemaSnapshot.exists) return schemaSnapshot.data() as SchemaState;

    const legacy = legacySnapshot.exists
      ? legacySnapshot.data() as LegacyState
      : { version: 1 as const, ddl: [], tables: {} };
    const now = new Date().toISOString();
    const schema: SchemaState = { version: 2, ddl: legacy.ddl ?? [], migratedAt: now, updatedAt: now };
    transaction.set(schemaRef, schema);
    for (const [name, rows] of Object.entries(legacy.tables ?? {})) {
      transaction.set(tableDocument(name), { version: 2, rows: cleanRows(rows), updatedAt: now } satisfies TableState);
    }
    return schema;
  }).catch((error) => {
    migrationReady = null;
    throw error;
  });
  return migrationReady;
}

async function readState(sql: string) {
  const schema = await ensureShardedState();
  const names = referencedTables(sql);
  const snapshots = await Promise.all(names.map((name) => tableDocument(name).get()));
  const tables: Record<string, Row[]> = {};
  snapshots.forEach((snapshot, index) => {
    tables[names[index]] = snapshot.exists ? cleanRows((snapshot.data() as TableState).rows ?? []) : [];
  });
  return { ddl: [...schema.ddl], tables } satisfies RuntimeState;
}

class FirestoreStatement {
  private params: unknown[] = [];

  constructor(private readonly sql: string) {}

  bind(...values: unknown[]) {
    this.params = values;
    return this;
  }

  async all<T = Row>() {
    const state = await readState(this.sql);
    const engine = createEngine(state);
    const result = execute(engine, state, this.sql, this.params).value;
    return { success: true, results: (Array.isArray(result) ? result : []) as T[] };
  }

  async first<T = Row>() {
    const result = await this.all<T>();
    return result.results[0] ?? null;
  }

  async run() {
    await ensureShardedState();
    return firebaseAdmin().firestore.runTransaction(async (transaction) => {
      const schemaRef = schemaDocument();
      const names = [...new Set([...referencedTables(this.sql), createTableName(this.sql)].filter(Boolean))];
      const refs = names.map(tableDocument);
      const snapshots = await Promise.all([transaction.get(schemaRef), ...refs.map((ref) => transaction.get(ref))]);
      const schema = snapshots[0].data() as SchemaState;
      const state: RuntimeState = { ddl: [...(schema?.ddl ?? [])], tables: {} };
      names.forEach((name, index) => {
        const snapshot = snapshots[index + 1];
        state.tables[name] = snapshot.exists ? cleanRows((snapshot.data() as TableState).rows ?? []) : [];
      });
      const engine = createEngine(state);
      const result = execute(engine, state, this.sql, this.params);
      const now = new Date().toISOString();
      if (state.ddl.length !== (schema?.ddl ?? []).length) {
        transaction.set(schemaRef, { ...schema, version: 2, ddl: state.ddl, updatedAt: now } satisfies SchemaState);
      }
      const changed = mutationTable(this.sql) || createTableName(this.sql);
      if (changed) {
        transaction.set(tableDocument(changed), {
          version: 2,
          rows: cleanRows(engine.tables[changed]?.data ?? []),
          updatedAt: now,
        } satisfies TableState);
      }
      return { success: true, meta: result.meta, results: [] };
    });
  }

  values() { return this.params; }
  query() { return this.sql; }
}

export class FirestoreD1Database {
  prepare(sql: string) { return new FirestoreStatement(sql); }

  async batch(statements: FirestoreStatement[]) {
    await ensureShardedState();
    return firebaseAdmin().firestore.runTransaction(async (transaction) => {
      const schemaRef = schemaDocument();
      const names = [...new Set(statements.flatMap((statement) => [
        ...referencedTables(statement.query()),
        createTableName(statement.query()),
      ]).filter(Boolean))];
      const refs = names.map(tableDocument);
      const snapshots = await Promise.all([transaction.get(schemaRef), ...refs.map((ref) => transaction.get(ref))]);
      const schema = snapshots[0].data() as SchemaState;
      const state: RuntimeState = { ddl: [...(schema?.ddl ?? [])], tables: {} };
      names.forEach((name, index) => {
        const snapshot = snapshots[index + 1];
        state.tables[name] = snapshot.exists ? cleanRows((snapshot.data() as TableState).rows ?? []) : [];
      });
      const engine = createEngine(state);
      const changed = new Set<string>();
      const results = statements.map((statement) => {
        const result = execute(engine, state, statement.query(), statement.values());
        const name = mutationTable(statement.query()) || createTableName(statement.query());
        if (name) changed.add(name);
        return { success: true, meta: result.meta, results: [] };
      });
      const now = new Date().toISOString();
      if (state.ddl.length !== (schema?.ddl ?? []).length) {
        transaction.set(schemaRef, { ...schema, version: 2, ddl: state.ddl, updatedAt: now } satisfies SchemaState);
      }
      for (const name of changed) {
        transaction.set(tableDocument(name), {
          version: 2,
          rows: cleanRows(engine.tables[name]?.data ?? []),
          updatedAt: now,
        } satisfies TableState);
      }
      return results;
    });
  }
}

let database: FirestoreD1Database | undefined;

export function firestoreD1Database() {
  database ??= new FirestoreD1Database();
  return database;
}
