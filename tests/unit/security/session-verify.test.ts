import { describe, it, expect } from "vitest";
import { signSessionId, verifySessionId } from "../../../src/lib/session";

describe("verifySessionId timing-safe verification", () => {
  it("retorna el sessionId si la firma es válida", () => {
    const sessionId = "valid-session-123456";
    const signed = signSessionId(sessionId);
    expect(verifySessionId(signed)).toBe(sessionId);
  });

  it("retorna null si el formato no tiene exactamente 2 partes separadas por punto", () => {
    expect(verifySessionId("")).toBeNull();
    expect(verifySessionId("no-dot-string")).toBeNull();
    expect(verifySessionId("part1.part2.part3")).toBeNull();
  });

  it("retorna null si la firma fue alterada", () => {
    const sessionId = "session-test";
    const signed = signSessionId(sessionId);
    const [id, sig] = signed.split(".");
    const tamperedSig = sig.slice(0, -1) + (sig.endsWith("a") ? "b" : "a");
    expect(verifySessionId(`${id}.${tamperedSig}`)).toBeNull();
  });

  it("retorna null si la firma tiene longitud distinta a la esperada", () => {
    const sessionId = "session-test";
    expect(verifySessionId(`${sessionId}.short`)).toBeNull();
    expect(verifySessionId(`${sessionId}.${"a".repeat(100)}`)).toBeNull();
  });
});
