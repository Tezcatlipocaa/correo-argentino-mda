import { test } from "node:test";
import assert from "node:assert/strict";
import { jsonError } from "./apiResponse";

test("jsonError agrega no-store en 401/403", async () => {
  for (const status of [401, 403]) {
    const res = jsonError("x", status);
    assert.equal(res.headers.get("Cache-Control"), "no-store", `status ${status}`);
  }
});

test("jsonError no agrega no-store fuera de 401/403", async () => {
  assert.equal(jsonError("x", 400).headers.get("Cache-Control"), null);
  assert.equal(jsonError("x", 500).headers.get("Cache-Control"), null);
});

test("jsonError respeta un cacheControl explícito", async () => {
  assert.equal(
    jsonError("x", 401, "private").headers.get("Cache-Control"),
    "private",
  );
});
