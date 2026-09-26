import type { SQLInputValue } from "node:sqlite";

import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import type { Db } from "./requests.server";

const migrationsDir = new URL("../../migrations/", import.meta.url);

// In-memory SQLite with the real D1 migrations applied, exposed through the
// same prepare/bind/batch surface the store uses on D1.
export function createTestDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("pragma foreign_keys = on");

  for (const file of readdirSync(migrationsDir).sort())
    sqlite.exec(readFileSync(new URL(file, migrationsDir), "utf8"));

  // SAFETY: the store only binds SQL scalars (undefined becomes null), and callers name
  // the row type of their own query, as they do against D1.
  const statement = (query: string, values: SQLInputValue[] = []) => ({
    bind: (...next: unknown[]) =>
      statement(query, next.map((v) => (v === undefined ? null : v)) as SQLInputValue[]),
    all: async <T>() => ({ results: sqlite.prepare(query).all(...values) as T[] }),
    first: async <T>() => (sqlite.prepare(query).get(...values) as T | undefined) ?? null,
    run: async () => ({ meta: { changes: Number(sqlite.prepare(query).run(...values).changes) } }),
  });

  const db: Db = {
    prepare: (query) => statement(query),
    // Like D1's batch: sequential statements in one transaction.
    batch: async (statements) => {
      sqlite.exec("begin");

      try {
        const results = [];

        for (const s of statements) results.push(await s.run());
        sqlite.exec("commit");

        return results;
      } catch (error) {
        sqlite.exec("rollback");
        throw error;
      }
    },
  };

  const addUser = (id: string, name: string, role = "member") => {
    const now = new Date().toISOString();
    sqlite
      .prepare(
        'insert into "user" (id, name, email, emailVerified, createdAt, updatedAt, role) values (?, ?, ?, 0, ?, ?, ?)',
      )
      .run(id, name, `${id}@example.test`, now, now, role);
  };

  return { db, addUser };
}
