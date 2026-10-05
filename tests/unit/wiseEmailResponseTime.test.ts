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
    expect(calculateWiseEmailResponseTime(createdAt, null, solvedAt)).toBe("19:14");
  });

  it("calculates exact response time in MM:SS for user example 2 (535257: ~8 minutos)", () => {
    // 535257: created_at 13:45:46, solved_at 13:53:12 (7m 26s)
    const createdAt = "2026-09-08 13:45:46";
    const solvedAt = "2026-09-08 13:53:12";
    expect(calculateWiseEmailResponseTime(createdAt, null, solvedAt)).toBe("07:26");
  });

  it("calculates exact response time in MM:SS for user example 3 (538644: ~17 minutos)", () => {
    // 538644: created_at 11:41:45, solved_at 11:58:23 (16m 38s)
    const createdAt = "2026-09-22 11:41:45";
    const solvedAt = "2026-09-22 11:58:23";
    expect(calculateWiseEmailResponseTime(createdAt, null, solvedAt)).toBe("16:38");
  });

  it("prioritizes operator first user_reply over late solved_at in reopened/bounced cases (bug 533959)", () => {
    // 533959: created_at 15:49:47, operator replied at 16:39:12 (49m 25s), bounced and closed at 18:33:04 (2h 43m 17s)
    const createdAt = "2026-09-02 15:49:47";
    const replyAt = "2026-09-02 16:39:12";
    const solvedAt = "2026-09-02 18:33:04";
    const closedAt = "2026-09-02 18:33:04";

    // Con replyAt prioritario debe dar 49:25 y NO 02:43:17
    expect(calculateWiseEmailResponseTime(createdAt, replyAt, solvedAt, closedAt)).toBe("49:25");
  });

  it("formats response times >= 1 hour as HH:MM:SS", () => {
    const createdAt = "2026-09-01 10:00:00";
    const solvedAt = "2026-09-01 11:15:30"; // 1 hour, 15 minutes, 30 seconds
    expect(calculateWiseEmailResponseTime(createdAt, null, solvedAt)).toBe("01:15:30");
  });

  it("falls back to closed_at if replyAt and solved_at are not provided", () => {
    const createdAt = "2026-09-01 10:00:00";
    const closedAt = "2026-09-01 10:10:05";
    expect(calculateWiseEmailResponseTime(createdAt, null, null, closedAt)).toBe("10:05");
  });

  it("returns '00:00' for invalid dates, missing end date, or negative durations", () => {
    expect(calculateWiseEmailResponseTime("", "")).toBe("00:00");
    expect(calculateWiseEmailResponseTime("2026-09-01 10:00:00", null, null)).toBe("00:00");
    expect(calculateWiseEmailResponseTime("invalid-date", "invalid-date")).toBe("00:00");
    // End before start
    expect(calculateWiseEmailResponseTime("2026-09-01 10:00:00", "2026-09-01 09:00:00")).toBe("00:00");
  });

  it("integrates response time calculation into parseWiseEmailMetadata and populates duration using firstReplyAt", () => {
    const mockCase = {
      id: 429241277,
      number: 533959,
      created_at: "2026-09-02 15:49:47",
      solved_at: "2026-09-02 18:33:04",
      closed_at: "2026-09-02 18:33:04",
      first_read: "2026-09-02 16:02:02",
      source_channel: "email",
      subject: "Falla de envío con rebote",
    };
    const firstReplyAt = "2026-09-02 16:39:12";

    const metadata = parseWiseEmailMetadata(mockCase, "Agustín Aguirre", firstReplyAt);

    expect(metadata.caseNumber).toBe("533959");
    expect(metadata.operator).toBe("Agustín Aguirre");
    expect(metadata.duration).toBe("49:25");
    expect(metadata.creationTime).toBe("2026-09-02 15:49:47");
    expect(metadata.rawDetails?.firstReplyAt).toBe("2026-09-02 16:39:12");
  });
});
