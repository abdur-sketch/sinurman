import { DatabaseSync } from "node:sqlite";

type Bound = import("node:sqlite").SQLInputValue[];
type Row = Record<string, unknown>;

const filePath = process.env.RBAC_QA_DB_PATH || ".wrangler/rbac-qa.sqlite";
let sqlite: DatabaseSync | undefined;
function getSqlite() {
  sqlite ??= new DatabaseSync(filePath);
  return sqlite;
}

class QAStatement {
  private values: Bound = [];
  constructor(private readonly sql: string) {}
  bind(...values: Bound) { this.values = values; return this; }
  async all<T = Row>() { return { success: true, results: getSqlite().prepare(this.sql).all(...this.values) as T[] }; }
  async first<T = Row>() { const rows = await this.all<T>(); return rows.results[0] ?? null; }
  async run() {
    const statement = getSqlite().prepare(this.sql);
    const result = statement.run(...this.values);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid || 0) } };
  }
  query() { return this.sql; }
}

export class QASqliteD1Database {
  prepare(sql: string) { return new QAStatement(sql); }
  async batch(statements: QAStatement[]) {
    getSqlite().exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      getSqlite().exec("COMMIT");
      return results;
    } catch (error) {
      getSqlite().exec("ROLLBACK");
      throw error;
    }
  }
}

let database: QASqliteD1Database | undefined;
export function qaSqliteD1Database() { database ??= new QASqliteD1Database(); return database; }
