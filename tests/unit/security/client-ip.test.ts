import { describe, expect, it } from "vitest";
import { resolveClientIp } from "../../../src/lib/clientIp";

describe("resolveClientIp", () => {
  it("confía en el último hop de X-Forwarded-For (el que agrega el proxy) desde loopback", () => {
    expect(resolveClientIp("127.0.0.1", "9.9.9.9, 203.0.113.7")).toBe("203.0.113.7");
    expect(resolveClientIp("127.0.0.1", "203.0.113.7, 10.0.0.1")).toBe("10.0.0.1");
    expect(resolveClientIp("::1", "203.0.113.8")).toBe("203.0.113.8");
    expect(resolveClientIp("::ffff:127.0.0.1", "203.0.113.8")).toBe("203.0.113.8");
  });

  it("trata todo 127.0.0.0/8 como loopback", () => {
    expect(resolveClientIp("127.0.0.2", "203.0.113.7, 198.51.100.4")).toBe("198.51.100.4");
    expect(resolveClientIp("127.1.2.3", null)).toBe("127.1.2.3");
  });

  it("ignora X-Forwarded-For de un socket remoto (anti-spoof)", () => {
    expect(resolveClientIp("10.1.2.3", "203.0.113.7")).toBe("10.1.2.3");
    expect(resolveClientIp("10.1.2.3", "9.9.9.9, 203.0.113.7")).toBe("10.1.2.3");
  });

  it("sin XFF cae al socket", () => {
    expect(resolveClientIp("127.0.0.1", null)).toBe("127.0.0.1");
    expect(resolveClientIp("127.0.0.1", "")).toBe("127.0.0.1");
  });

  it("sin socket usa unknown", () => {
    expect(resolveClientIp(undefined, null)).toBe("unknown");
  });
});
