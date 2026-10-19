import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePrePushStdin, runPrePushGate } from "./prePushCheck";

describe("prePushCheck", () => {
  it("parsea lineas de stdin de git pre-push e identifica pushes a master", () => {
    const stdin = [
      "refs/heads/feature 1111111111111111111111111111111111111111 refs/heads/feature 2222222222222222222222222222222222222222",
      "refs/heads/master aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ].join("\n");

    const refs = parsePrePushStdin(stdin);
    assert.equal(refs.length, 2);
    assert.equal(refs[1].remoteRef, "refs/heads/master");
  });

  it("permite el push sin ejecutar comandos cuando no se pushea a refs/heads/master", async () => {
    const calls: string[] = [];
    const res = await runPrePushGate({
      stdin:
        "refs/heads/feat aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/feat bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n",
      dbExists: true,
      skipFlag: false,
      runCmd: (cmd) => {
        calls.push(cmd);
        return { status: 0, stdout: "", stderr: "" };
      },
      simulateSchemaAlign: async () => ({ ok: true }),
    });

    assert.equal(res.ok, true);
    assert.equal(calls.length, 0);
  });

  it("permite bypass de emergencia con flag o MDA_SKIP_PRE_PUSH", async () => {
    const calls: string[] = [];
    const res = await runPrePushGate({
      stdin:
        "refs/heads/master aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n",
      dbExists: true,
      skipFlag: true,
      runCmd: (cmd) => {
        calls.push(cmd);
        return { status: 0, stdout: "", stderr: "" };
      },
      simulateSchemaAlign: async () => ({ ok: true }),
    });

    assert.equal(res.ok, true);
    assert.equal(res.bypassed, true);
    assert.equal(calls.length, 0);
  });

  it("bloquea el push a master si falla npm run test:domain", async () => {
    const res = await runPrePushGate({
      stdin:
        "refs/heads/master aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n",
      dbExists: true,
      skipFlag: false,
      runCmd: (cmd) => {
        if (cmd === "npm run test:domain") {
          return { status: 1, stdout: "", stderr: "1 test failed" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
      simulateSchemaAlign: async () => ({ ok: true }),
    });

    assert.equal(res.ok, false);
    assert.match(res.reason ?? "", /test:domain/);
  });

  it("bloquea el push a master si cambio src/db/schema.ts y falla la simulacion estricta de DB", async () => {
    const res = await runPrePushGate({
      stdin:
        "refs/heads/master aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n",
      dbExists: true,
      skipFlag: false,
      runCmd: (cmd) => {
        if (cmd.startsWith("git diff --name-only")) {
          return { status: 0, stdout: "src/db/schema.ts\n", stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
      simulateSchemaAlign: async () => ({
        ok: false,
        error: "dropped_column en schedules.agent_name",
      }),
    });

    assert.equal(res.ok, false);
    assert.match(res.reason ?? "", /dropped_column/);
  });

  it("permite el push a master cuando test:domain y la simulacion de schema pasan", async () => {
    let schemaChecked = false;
    const res = await runPrePushGate({
      stdin:
        "refs/heads/master aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/master bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n",
      dbExists: true,
      skipFlag: false,
      runCmd: (cmd) => {
        if (cmd.startsWith("git diff --name-only")) {
          return { status: 0, stdout: "src/db/schema.ts\n", stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
      simulateSchemaAlign: async () => {
        schemaChecked = true;
        return { ok: true };
      },
    });

    assert.equal(res.ok, true);
    assert.equal(schemaChecked, true);
  });
});
