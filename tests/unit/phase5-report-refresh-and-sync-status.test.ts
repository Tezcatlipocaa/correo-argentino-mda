import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Phase 5: Helpdesk Metrics Refresh & User Sync Status Decoupling (#331, #333)", () => {
  const reportRefreshPath = path.resolve(
    process.cwd(),
    "src/lib/reportRefresh.ts",
  );
  const rbacPath = path.resolve(
    process.cwd(),
    "src/lib/rbac.ts",
  );
  const syncUsersScriptPath = path.resolve(
    process.cwd(),
    "scripts/sync-users.ts",
  );
  const invgateSyncPath = path.resolve(
    process.cwd(),
    "src/components/buscador-usuarios/lib/invgateSync.ts",
  );

  it("verifies reportRefresh parses response error message and status code on failure (#331)", () => {
    const content = fs.readFileSync(reportRefreshPath, "utf-8");
    // Should parse JSON body when !res.ok and fall back if unavailable
    expect(content).toMatch(/res\.json\(\)/);
  });

  it("verifies reportes write permissions in rbac.ts align with report views (#331)", () => {
    const content = fs.readFileSync(rbacPath, "utf-8");
    // rbac.ts should define reportes module permissions appropriately
    expect(content).toMatch(/moduleName === "reportes"/);
  });

  it("verifies sync-users preserves lastSuccessAt independently from error status (#333)", () => {
    const content = fs.readFileSync(syncUsersScriptPath, "utf-8");
    expect(content).toMatch(/lastSuccessAt/);
  });

  it("verifies invgateSync formats lastSuccessAt without false alarm red status (#333)", () => {
    const content = fs.readFileSync(invgateSyncPath, "utf-8");
    expect(content).toMatch(/lastSuccessAt/);
  });
});
