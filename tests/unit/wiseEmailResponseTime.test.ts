import { describe, it, expect } from "vitest";
import {
  calculateWiseEmailResponseTime,
  parseWiseEmailMetadata,
} from "../../src/lib/qualityMetadataFetcher";

describe("Wise Email Response Time Calculation (TDD)", () => {
  it("calculates exact response time in MM:SS for user example 1 (533785: ~19 minutos)", () => {
    // 533785: created_at 12:16:16, solved_at 12:35:30 (19m 14s)
    const createdAt = "2026-09-02 12:16:16";
    const solvedAt = "2026-09-02 12:35:30";
    expect(calculateWiseEmailResponseTime(createdAt, solvedAt)).toBe("19:14");
  });

  it("calculates exact response time in MM:SS for user example 2 (535257: ~8 minutos)", () => {
    // 535257: created_at 13:45:46, solved_at 13:53:12 (7m 26s)
    const createdAt = "2026-09-08 13:45:46";
    const solvedAt = "2026-09-08 13:53:12";
    expect(calculateWiseEmailResponseTime(createdAt, solvedAt)).toBe("07:26");
  });

  it("calculates exact response time in MM:SS for user example 3 (538644: ~17 minutos)", () => {
    // 538644: created_at 11:41:45, solved_at 11:58:23 (16m 38s)
    const createdAt = "2026-09-22 11:41:45";
    const solvedAt = "2026-09-22 11:58:23";
    expect(calculateWiseEmailResponseTime(createdAt, solvedAt)).toBe("16:38");
  });

  it("formats response times >= 1 hour as HH:MM:SS", () => {
    const createdAt = "2026-09-01 10:00:00";
    const solvedAt = "2026-09-01 11:15:30"; // 1 hour, 15 minutes, 30 seconds
    expect(calculateWiseEmailResponseTime(createdAt, solvedAt)).toBe("01:15:30");
  });

  it("falls back to closed_at if solved_at is not provided", () => {
    const createdAt = "2026-09-01 10:00:00";
    const closedAt = "2026-09-01 10:10:05";
    expect(calculateWiseEmailResponseTime(createdAt, null, closedAt)).toBe("10:05");
  });

  it("returns '00:00' for invalid dates, missing end date, or negative durations", () => {
    expect(calculateWiseEmailResponseTime("", "")).toBe("00:00");
    expect(calculateWiseEmailResponseTime("2026-09-01 10:00:00", null, null)).toBe("00:00");
    expect(calculateWiseEmailResponseTime("invalid-date", "invalid-date")).toBe("00:00");
    // End before start
    expect(calculateWiseEmailResponseTime("2026-09-01 10:00:00", "2026-09-01 09:00:00")).toBe("00:00");
  });

  it("integrates response time calculation into parseWiseEmailMetadata and populates duration", () => {
    const mockCase = {
      id: 429120171,
      number: 533785,
      created_at: "2026-09-02 12:16:16",
      solved_at: "2026-09-02 12:35:30",
      closed_at: "2026-09-02 12:35:33",
      first_read: "2026-09-02 12:17:06",
      source_channel: "email",
      subject: "Test correo",
    };

    const metadata = parseWiseEmailMetadata(mockCase, "Operador Juan");

    expect(metadata.caseNumber).toBe("533785");
    expect(metadata.operator).toBe("Operador Juan");
    expect(metadata.duration).toBe("19:14");
    expect(metadata.creationTime).toBe("2026-09-02 12:16:16");
    expect(metadata.takeTime).toBe("2026-09-02 12:17:06");
  });
});
