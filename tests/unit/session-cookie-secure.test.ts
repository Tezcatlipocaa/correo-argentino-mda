import { afterEach, describe, expect, it, vi } from "vitest";
import { isSessionCookieSecure } from "../../src/lib/session";

describe("isSessionCookieSecure", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when SESSION_COOKIE_SECURE=true", () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    expect(isSessionCookieSecure()).toBe(true);
  });

  it("returns false when unset", () => {
    expect(isSessionCookieSecure()).toBe(false);
  });

  it("returns false for any value other than 'true'", () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "1");
    expect(isSessionCookieSecure()).toBe(false);
  });
});
