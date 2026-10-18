import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { analyzeSchemaGuard, parseAlignCliArgs } from "./schemaGuard";

describe("analyzeSchemaGuard", () => {
  it("permite cambios puramente aditivos (tabla nueva, columna nullable, columna NOT NULL con default)", () => {
    const target = new Database(":memory:");
    const canonical = new Database(":memory:");

    target.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL
      );
      INSERT INTO users (username) VALUES ('jdoe');
    `);

    canonical.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL
      );
    `);

    const res = analyzeSchemaGuard(canonical, target);
    assert.equal(res.ok, true);
    assert.deepEqual(res.violations, []);

    target.close();
    canonical.close();
  });

  it("bloquea cuando se elimina una columna existente en la DB objetivo", () => {
    const target = new Database(":memory:");
    const canonical = new Database(":memory:");

    target.exec(`
      CREATE TABLE schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        agent_id INTEGER
      );
      INSERT INTO schedules (agent_name, agent_id) VALUES ('Ana', 1);
    `);

    canonical.exec(`
      CREATE TABLE schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER
      );
    `);

    const res = analyzeSchemaGuard(canonical, target);
    assert.equal(res.ok, false);
    assert.equal(res.violations.length, 1);
    assert.equal(res.violations[0].kind, "dropped_column");
    assert.equal(res.violations[0].table, "schedules");
    assert.equal(res.violations[0].column, "agent_name");
    assert.equal(res.violations[0].nonNullRows, 1);

    target.close();
    canonical.close();
  });

  it("bloquea cuando se agrega una columna NOT NULL sin DEFAULT en una tabla con filas", () => {
    const target = new Database(":memory:");
    const canonical = new Database(":memory:");

    target.exec(`
      CREATE TABLE offices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
      INSERT INTO offices (name) VALUES ('Centro');
    `);

    canonical.exec(`
      CREATE TABLE offices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL
      );
    `);

    const res = analyzeSchemaGuard(canonical, target);
    assert.equal(res.ok, false);
    assert.equal(
      res.violations.some((v) => v.kind === "not_null_without_default" && v.column === "code"),
      true,
    );

    target.close();
    canonical.close();
  });

  it("bloquea filas huerfanas en FK aunque la FK declare ON DELETE CASCADE o SET NULL", () => {
    const target = new Database(":memory:");
    const canonical = new Database(":memory:");

    target.exec(`
      CREATE TABLE mesas (
        invgate_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE hidden_helpdesks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invgate_id INTEGER NOT NULL
      );
      INSERT INTO hidden_helpdesks (invgate_id) VALUES (999);
    `);

    canonical.exec(`
      CREATE TABLE mesas (
        invgate_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE hidden_helpdesks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invgate_id INTEGER NOT NULL REFERENCES mesas(invgate_id) ON DELETE CASCADE
      );
    `);

    const res = analyzeSchemaGuard(canonical, target);
    assert.equal(res.ok, false);
    assert.equal(res.violations.length, 1);
    assert.equal(res.violations[0].kind, "orphan_foreign_key");
    assert.equal(res.violations[0].table, "hidden_helpdesks");
    assert.equal(res.violations[0].orphanCount, 1);

    target.close();
    canonical.close();
  });

  it("bloquea cambios de tipo en una columna existente", () => {
    const target = new Database(":memory:");
    const canonical = new Database(":memory:");

    target.exec(`
      CREATE TABLE metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        score TEXT
      );
    `);

    canonical.exec(`
      CREATE TABLE metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        score INTEGER
      );
    `);

    const res = analyzeSchemaGuard(canonical, target);
    assert.equal(res.ok, false);
    assert.equal(
      res.violations.some((v) => v.kind === "type_change" && v.column === "score"),
      true,
    );

    target.close();
    canonical.close();
  });

  it("parsea argumentos CLI de align-db-to-schema (--db, posicional, --strict, --allow-destructive)", () => {
    assert.deepEqual(parseAlignCliArgs([]), {
      dbPath: "./database/mda.db",
      strict: false,
      allowDestructive: false,
    });
    assert.deepEqual(parseAlignCliArgs(["./custom.db", "--strict"]), {
      dbPath: "./custom.db",
      strict: true,
      allowDestructive: false,
    });
    assert.deepEqual(parseAlignCliArgs(["--db", "./other.db", "--strict", "--allow-destructive"]), {
      dbPath: "./other.db",
      strict: false,
      allowDestructive: true,
    });
  });
});
