import { describe, it, expect } from "vitest";
import { calculateMultiChannelAuditScores } from "../../src/lib/qualityCalculator";
import {
  WISE_CALL_PARAMETERS,
  WISE_EMAIL_PARAMETERS,
  INVGATE_AG_PARAMETERS,
} from "../../src/config/qualityParams";

describe("Quality Checklist - Mass Selection (Check All / Uncheck All)", () => {
  describe("Wise Call", () => {
    it("yields 100% total score when all parameters across S1 and S2 are checked", () => {
      const allCodes = new Set(WISE_CALL_PARAMETERS.map((p) => p.code));
      const res = calculateMultiChannelAuditScores(
        "wise_call",
        WISE_CALL_PARAMETERS,
        allCodes,
        true,
      );
      expect(res.section1Score).toBe(100);
      expect(res.section2Score).toBe(100);
      expect(res.totalScore).toBe(100);
    });

    it("yields 0% in Section 1 when uncheck-all is applied to S1 while S2 is checked", () => {
      const s2Codes = new Set(
        WISE_CALL_PARAMETERS.filter((p) => p.section === "ticket").map((p) => p.code),
      );
      const res = calculateMultiChannelAuditScores(
        "wise_call",
        WISE_CALL_PARAMETERS,
        s2Codes,
        true,
      );
      expect(res.section1Score).toBe(0);
      expect(res.section2Score).toBe(100);
      expect(res.totalScore).toBe(55); // 0 + 55 = 55
    });

    it("yields 0% total score when all parameters in S1 and S2 are unchecked", () => {
      const emptySet = new Set<string>();
      const res = calculateMultiChannelAuditScores(
        "wise_call",
        WISE_CALL_PARAMETERS,
        emptySet,
        true,
      );
      expect(res.section1Score).toBe(0);
      expect(res.section2Score).toBe(0);
      expect(res.totalScore).toBe(0);
    });
  });

  describe("Wise Email", () => {
    it("yields 100% total score when all parameters are checked", () => {
      const allCodes = new Set(WISE_EMAIL_PARAMETERS.map((p) => p.code));
      const res = calculateMultiChannelAuditScores(
        "wise_email",
        WISE_EMAIL_PARAMETERS,
        allCodes,
        true,
      );
      expect(res.section1Score).toBe(100);
      expect(res.section2Score).toBe(100);
      expect(res.totalScore).toBe(100);
    });

    it("yields 0% total score when all parameters are unchecked", () => {
      const emptySet = new Set<string>();
      const res = calculateMultiChannelAuditScores(
        "wise_email",
        WISE_EMAIL_PARAMETERS,
        emptySet,
        true,
      );
      expect(res.section1Score).toBe(0);
      expect(res.section2Score).toBe(0);
      expect(res.totalScore).toBe(0);
    });
  });

  describe("InvGate Autogestiones", () => {
    it("yields 100% total score when all parameters are checked", () => {
      const allCodes = new Set(INVGATE_AG_PARAMETERS.map((p) => p.code));
      const res = calculateMultiChannelAuditScores(
        "invgate_ticket",
        INVGATE_AG_PARAMETERS,
        allCodes,
        true,
      );
      expect(res.section1Score).toBe(100);
      expect(res.section2Score).toBe(100);
      expect(res.totalScore).toBe(100);
    });
  });
});
