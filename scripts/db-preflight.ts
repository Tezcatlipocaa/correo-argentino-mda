import fs from "node:fs";
import path from "node:path";

/**
 * Guarda de arranque para scripts que abren la base al importar.
 *
 * DEBE importarse ANTES de `../src/db/index`: ese modulo hace
 * `new Database("./database/mda.db")` en tiempo de import, con las opciones
 * por defecto de better-sqlite3, que CREAN el archivo si falta. Sin este
 * guard, una base ausente dejaba un `mda.db` de 0 bytes y el script moria
 * despues con `SqliteError: no such table: offices` en ingles (#162).
 *
 * Con `--help` no hay validacion (la ayuda no debe requerir una base), pero
 * hay que asegurar que el directorio exista: better-sqlite3 lanza
 * `TypeError: Cannot open database because the directory does not exist` si
 * falta, y romperia `--help` igual.
 */
const dbPath = path.resolve(process.cwd(), "database", "mda.db");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
} else {
  let dbStat: fs.Stats;
  try {
    dbStat = fs.statSync(dbPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(
        `La base de datos en ${dbPath} no existe. Copiala desde producción antes de correr este script.`,
      );
      process.exit(1);
    }
    throw error;
  }
  if (!dbStat.isFile() || dbStat.size === 0) {
    console.error(
      `La base de datos en ${dbPath} no es un archivo con contenido.`,
    );
    process.exit(1);
  }
}
