import { describe, expect, it } from "vitest";
import { requireReadAccess, requireWriteAccess } from "../../../src/lib/rbac-middleware";

const anon = {
  user: { id: 0, username: "Usuario", role: "agent", helpdeskId: null, helpdeskName: null },
  sessionId: null,
} as unknown as App.Locals;

const agent = {
  user: { id: 5, username: "agent", role: "agent", helpdeskId: 1, helpdeskName: "Mesa" },
  sessionId: "s",
} as unknown as App.Locals;

describe("helpers RBAC: Cache-Control no-store", () => {
  it("el 401 de requireReadAccess es no-store", async () => {
    const res = await requireReadAccess(anon, "usuarios");
    expect(res?.status).toBe(401);
    expect(res?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("el 401 de requireWriteAccess es no-store", async () => {
    const res = await requireWriteAccess(anon, "usuarios");
    expect(res?.status).toBe(401);
    expect(res?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("el 403 de requireWriteAccess es no-store", async () => {
    const res = await requireWriteAccess(agent, "usuarios");
    expect(res?.status).toBe(403);
    expect(res?.headers.get("Cache-Control")).toBe("no-store");
  });
});
