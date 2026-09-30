// tests/unit/backfill-kb-categories.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runBackfillKbCategories } from "../../scripts/backfill-kb-categories.mts";

const DDL = `
CREATE TABLE mesas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invgate_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE kb_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  helpdesk_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_by_user_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX kb_categories_helpdesk_name_unique
  ON kb_categories (helpdesk_id, name);
CREATE TABLE kb_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  helpdesk_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT
);
`;

let dir: string;
let dbPath: string;

function exec(sql: string, path: string = dbPath): void {
  const db = new Database(path);
  db.exec(sql);
  db.close();
}

function categoryNames(path: string = dbPath): string[] {
  const db = new Database(path, { readonly: true });
  const out = (
    db.prepare("SELECT name FROM kb_categories ORDER BY id").all() as Array<{
      name: string;
    }>
  ).map((row) => row.name);
  db.close();
  return out;
}

function article(helpdeskId: number, title: string, category: string | null) {
  exec(
    `INSERT INTO kb_articles (helpdesk_id, title, content, category)
     VALUES (${helpdeskId}, '${title}', 'contenido', ${
       category === null ? "NULL" : `'${category.replace(/'/g, "''")}'`
     })`,
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "backfill-kb-categories-"));
  dbPath = join(dir, "test.db");
  exec(DDL);
  exec(`INSERT INTO mesas (invgate_id, name) VALUES (2509, 'TI_GSM_MDA TI')`);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("runBackfillKbCategories", () => {
  it("dry-run: reporta el faltante, no escribe ni crea backup", async () => {
    article(2509, "A", "Prueba");

    const report = await runBackfillKbCategories({ dbPath, apply: false });

    expect(report.missing).toEqual([
      { helpdeskId: 2509, name: "Prueba", articles: 1 },
    ]);
    expect(report.created).toEqual([]);
    expect(report.backupPath).toBeNull();
    expect(categoryNames()).toEqual([]);
  });

  it("apply: crea la fila faltante y un backup WAL-safe", async () => {
    article(2509, "A", "Prueba");
    article(2509, "B", "Prueba");

    const report = await runBackfillKbCategories({ dbPath, apply: true });

    expect(report.created).toEqual([
      { helpdeskId: 2509, name: "Prueba", articles: 2 },
    ]);
    expect(report.backupPath).toBeTruthy();
    expect(existsSync(report.backupPath!)).toBe(true);
    expect(categoryNames()).toEqual(["Prueba"]);
  });

  it("idempotente: el segundo apply no crea nada ni otro backup", async () => {
    article(2509, "A", "Prueba");
    await runBackfillKbCategories({ dbPath, apply: true });

    const second = await runBackfillKbCategories({ dbPath, apply: true });

    expect(second.missing).toEqual([]);
    expect(second.created).toEqual([]);
    expect(second.backupPath).toBeNull();
    expect(
      readdirSync(dir).filter((f) =>
        f.includes(".bak-backfill-kb-categories-"),
      ),
    ).toHaveLength(1);
  });

  it("ignora categorías ya catalogadas sin importar la capitalización", async () => {
    exec(
      `INSERT INTO kb_categories (helpdesk_id, name, created_at) VALUES (2509, 'Prueba', 0)`,
    );
    article(2509, "A", "prueba");

    const report = await runBackfillKbCategories({ dbPath, apply: true });

    expect(report.missing).toEqual([]);
    expect(categoryNames()).toEqual(["Prueba"]);
  });

  it("ignora artículos sin categoría y con categoría vacía", async () => {
    article(2509, "A", null);
    article(2509, "B", "   ");

    const report = await runBackfillKbCategories({ dbPath, apply: true });

    expect(report.missing).toEqual([]);
    expect(categoryNames()).toEqual([]);
  });

  it("error si la DB no existe", async () => {
    await expect(
      runBackfillKbCategories({
        dbPath: join(dir, "no-existe.db"),
        apply: true,
      }),
    ).rejects.toThrow(/No existe la DB/);
  });

  it("error si la tabla kb_categories no existe", async () => {
    const sinTabla = join(dir, "sin-tabla.db");
    exec(
      `CREATE TABLE kb_articles (id INTEGER PRIMARY KEY, helpdesk_id INTEGER, title TEXT, content TEXT, category TEXT)`,
      sinTabla,
    );

    await expect(
      runBackfillKbCategories({ dbPath: sinTabla, apply: true }),
    ).rejects.toThrow(/no tiene la tabla "kb_categories"/);
  });
});
