/**
 * dump-quality-parameters — exporta los parámetros de calidad configurados
 * en la base de datos local a un archivo JSON versionado (src/data/quality-parameters.json).
 *
 * Uso:
 *   npx tsx scripts/dump-quality-parameters.mts [--db <ruta>] [--out <ruta>]
 */
import { resolve } from "path";
import { dumpParameters } from "./migrate-quality-parameters.mts";

const args = process.argv.slice(2);
const dbFlag = args.indexOf("--db");
const dbPath = resolve(
  dbFlag >= 0 && args[dbFlag + 1] ? args[dbFlag + 1] : "./database/mda.db"
);
const outFlag = args.indexOf("--out");
const outPath = resolve(
  outFlag >= 0 && args[outFlag + 1]
    ? args[outFlag + 1]
    : "./src/data/quality-parameters.json"
);

dumpParameters(dbPath, outPath);
