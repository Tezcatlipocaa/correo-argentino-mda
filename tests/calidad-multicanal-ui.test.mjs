import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const fileUrl = (path) => new URL(path, root);
const read = (path) => readFile(fileUrl(path), "utf8");
const exists = (path) => existsSync(fileUrl(path));

// 1. Check file existence
const modalPath = "src/components/supervision/calidad/AuditModal.astro";
assert.ok(exists(modalPath), `Expected ${modalPath} to exist`);

// 2. Check modal contents
const modalCode = await read(modalPath);
assert.match(modalCode, /wise_call/, "Must support wise_call channel");
assert.match(modalCode, /wise_email/, "Must support wise_email channel");
assert.match(modalCode, /invgate_ticket/, "Must support invgate_ticket channel");
assert.match(modalCode, /api\/calidad\/fetch-metadata/, "Must connect to fetch-metadata API");
assert.match(modalCode, /appliesMda/, "Must include appliesMda toggle");
assert.match(modalCode, /staysInMda/, "Must include staysInMda toggle");

// 3. Check CalidadContent page contains multi-channel tabs
const contentCode = await read("src/components/supervision/calidad/CalidadContent.astro");
assert.match(contentCode, /AuditModal/, "CalidadContent must use AuditModal component");
assert.match(contentCode, /Llamadas Wise/, "Must display Llamadas Wise tab");
assert.match(contentCode, /Mails Wise/, "Must display Mails Wise tab");
assert.match(contentCode, /Autogestiones/, "Must display Autogestiones tab");

console.log("All multi-channel UI contract tests passed successfully!");
