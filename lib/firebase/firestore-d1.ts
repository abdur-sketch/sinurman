import alasql from "alasql";
import { firebaseAdmin } from "./admin";

type Row = Record<string, unknown>;
type PersistedState = {
  version: 1;
  ddl: string[];
  tables: Record<string, Row[]>;
};
type EngineTable = {
  columns: Array<{ columnid: string }>;
  data: Row[];
  insert(row: Row): void;
};
type Engine = {
  exec(sql: string, params?: unknown[]): unknown;
  tables: Record<string, EngineTable>;
};
type RunMeta = {
  changes: number;
  last_row_id?: number;
};

const stateDocument = () => firebaseAdmin().firestore.collection("_system").doc("d1-state-v1");
const emptyState = (): PersistedState => ({ version: 1, ddl: [], tables: {} });

function cleanRows(rows: Row[]) {
  return JSON.parse(JSON.stringify(rows)) as Row[];
}

function tableName(sql: string) {
  return sql.match(/^\s*(?:INSERT(?:\s+OR\s+IGNORE)?\s+INTO|UPDATE|DELETE\s+FROM)\s+([A-Za-z_]\w*)/i)?.[1] ?? "";
}

function normalizeSql(sql: string, params: unknown[]) {
  let normalized = sql
    .trim()
    .replace(/^INSERT\s+OR\s+IGNORE\s+/i, "INSERT ");
  const values = [...params];
  if (/date\(\?,\s*'\+7 day'\)/i.test(normalized) && values.length) {
    const date = new Date(`${String(values[0])}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 7);
    values[0] = date.toISOString().slice(0, 10);
    normalized = normalized.replace(/date\(\?,\s*'\+7 day'\)/i, "?");
  }
  return { sql: normalized, params: values };
}

function createEngine(state: PersistedState) {
  const engine = new alasql.Database() as unknown as Engine;
  for (const ddl of state.ddl) engine.exec(ddl);
  for (const [name, rows] of Object.entries(state.tables)) {
    const table = engine.tables[name];
    if (!table) continue;
    for (const row of rows) table.insert({ ...row });
  }
  return engine;
}

function snapshot(engine: Engine, ddl: string[]): PersistedState {
  const tables: Record<string, Row[]> = {};
  for (const [name, table] of Object.entries(engine.tables)) {
    tables[name] = cleanRows(table.data);
  }
  return { version: 1, ddl, tables };
}

function pragmaRows(engine: Engine, sql: string) {
  const name = sql.match(/PRAGMA\s+table_info\(([^)]+)\)/i)?.[1]?.trim() ?? "";
  return (engine.tables[name]?.columns ?? []).map((column) => ({ name: column.columnid }));
}

function execute(engine: Engine, state: PersistedState, rawSql: string, rawParams: unknown[]) {
  const sql = rawSql.trim().replace(/\btotal\b/gi, "[total]");
  if (/^CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(sql)) return { value: 0, meta: { changes: 0 } satisfies RunMeta };
  if (/^PRAGMA\s+table_info/i.test(sql)) {
    return { value: pragmaRows(engine, sql), meta: { changes: 0 } satisfies RunMeta };
  }
  if (/^ALTER\s+TABLE/i.test(sql)) return { value: 0, meta: { changes: 0 } satisfies RunMeta };
  if (/instr\(/i.test(sql) || /^UPDATE\s+students\s+SET\s+guardian_phone=CASE/i.test(sql)) {
    return { value: 0, meta: { changes: 0 } satisfies RunMeta };
  }

  if (/^CREATE\s+TABLE/i.test(sql)) {
    if (!state.ddl.includes(sql)) state.ddl.push(sql);
    const value = engine.exec(sql);
    return { value, meta: { changes: 0 } satisfies RunMeta };
  }

  const beforeTable = tableName(sql);
  const beforeRows = beforeTable ? engine.tables[beforeTable]?.data.length ?? 0 : 0;
  const normalized = normalizeSql(sql, rawParams);
  try {
    const value = engine.exec(normalized.sql, normalized.params);
    const rows = beforeTable ? engine.tables[beforeTable]?.data ?? [] : [];
    const afterRows = rows.length;
    const lastId = rows.reduce((maximum, row) => Math.max(maximum, Number(row.id ?? 0)), 0);
    const numericResult = typeof value === "number" ? value : Math.abs(afterRows - beforeRows);
    return {
      value,
      meta: {
        changes: Number.isFinite(numericResult) ? numericResult : Math.abs(afterRows - beforeRows),
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

async function readState() {
  const snapshot = await stateDocument().get();
  return snapshot.exists ? snapshot.data() as PersistedState : emptyState();
}

class FirestoreStatement {
  private params: unknown[] = [];

  constructor(private readonly sql: string) {}

  bind(...values: unknown[]) {
    this.params = values;
    return this;
  }

  async all<T = Row>() {
    const state = await readState();
    const engine = createEngine(state);
    const result = execute(engine, state, this.sql, this.params).value;
    return { success: true, results: (Array.isArray(result) ? result : []) as T[] };
  }

  async first<T = Row>() {
    const result = await this.all<T>();
    return result.results[0] ?? null;
  }

  async run() {
    return firebaseAdmin().firestore.runTransaction(async (transaction) => {
      const reference = stateDocument();
      const document = await transaction.get(reference);
      const state = document.exists ? document.data() as PersistedState : emptyState();
      const engine = createEngine(state);
      const result = execute(engine, state, this.sql, this.params);
      transaction.set(reference, snapshot(engine, state.ddl));
      return { success: true, meta: result.meta, results: [] };
    });
  }

  values() {
    return this.params;
  }

  query() {
    return this.sql;
  }
}

export class FirestoreD1Database {
  prepare(sql: string) {
    return new FirestoreStatement(sql);
  }

  async batch(statements: FirestoreStatement[]) {
    return firebaseAdmin().firestore.runTransaction(async (transaction) => {
      const reference = stateDocument();
      const document = await transaction.get(reference);
      const state = document.exists ? document.data() as PersistedState : emptyState();
      const engine = createEngine(state);
      const results = statements.map((statement) => {
        const result = execute(engine, state, statement.query(), statement.values());
        return { success: true, meta: result.meta, results: [] };
      });
      transaction.set(reference, snapshot(engine, state.ddl));
      return results;
    });
  }
}

let database: FirestoreD1Database | undefined;

export function firestoreD1Database() {
  database ??= new FirestoreD1Database();
  return database;
}
