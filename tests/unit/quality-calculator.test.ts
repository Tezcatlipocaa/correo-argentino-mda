import { describe, it, expect } from "vitest";
import {
  calculateMultiChannelAuditScores,
  calculateOperatorChannelStats,
} from "../../src/lib/qualityCalculator";
import {
  WISE_CALL_PARAMETERS,
  WISE_EMAIL_PARAMETERS,
} from "../../src/config/qualityParams";

describe("Multi-Channel Quality Calculator", () => {
  describe("Individual Audit Scoring (Deduction Method)", () => {
    it("gives 100% when all parameters are compliant", () => {
      const allCompliant = new Set(WISE_CALL_PARAMETERS.map((p) => p.code));
      const res = calculateMultiChannelAuditScores(
        "wise_call",
        WISE_CALL_PARAMETERS,
        allCompliant,
        true, // hasSection2 (ticket applies)
      );

      expect(res.section1Score).toBe(100);
      expect(res.section2Score).toBe(100);
      expect(res.totalScore).toBe(100);
    });

    it("deducts percentages when parameters do not comply", () => {
      // In Wise Call:
      // call_cordialidad = 3 points
      // call_sondeo = 6 points
      // Both fail in Section 1 (base 45): (45 - 9) / 45 = 80%
      // Section 2 has 55 points (100%)
      // Total score: 36 + 55 = 91% (direct deduction from 100)
      const params = WISE_CALL_PARAMETERS;
      const compliantCodes = new Set(
        params
          .filter((p) => p.code !== "call_cordialidad" && p.code !== "call_sondeo")
          .map((p) => p.code),
      );

      const res = calculateMultiChannelAuditScores(
        "wise_call",
        params,
        compliantCodes,
        true,
      );

      expect(res.section1Score).toBe(80);
      expect(res.section2Score).toBe(100);
      expect(res.totalScore).toBe(91);
    });

    it("gives 55% when all Section 1 fails and Section 2 passes in wise_call", () => {
      const params = WISE_CALL_PARAMETERS;
      // All section 2 compliant, all section 1 failing
      const compliantCodes = new Set(
        params.filter((p) => p.section === "ticket").map((p) => p.code),
      );

      const res = calculateMultiChannelAuditScores(
        "wise_call",
        params,
        compliantCodes,
        true,
      );

      expect(res.section1Score).toBe(0);
      expect(res.section2Score).toBe(100);
      expect(res.totalScore).toBe(55);
    });

    it("evaluates only Section 1 when Section 2 does not apply (e.g. Wise Email with appliesMda = false)", () => {
      const params = WISE_EMAIL_PARAMETERS;
      // Fail email_interpretacion (10%) in Section 1
      const compliantCodes = new Set(
        params
          .filter((p) => p.code !== "email_interpretacion")
          .map((p) => p.code),
      );

      const res = calculateMultiChannelAuditScores(
        "wise_email",
        params,
        compliantCodes,
        false, // appliesMda = false
      );

      expect(res.section1Score).toBe(90);
      expect(res.section2Score).toBe(0);
      expect(res.totalScore).toBe(90); // 100% governed by Section 1
    });

    it("clamps scores to 0 when deductions exceed 100", () => {
      const emptySet = new Set<string>();
      const res = calculateMultiChannelAuditScores(
        "wise_call",
        WISE_CALL_PARAMETERS,
        emptySet,
        true,
      );

      expect(res.section1Score).toBeGreaterThanOrEqual(0);
      expect(res.section2Score).toBe(0); // In Section 2, Reclamo/Novedad alone is 55% + others = >100%
      expect(res.totalScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Operator Monthly Channel Aggregations", () => {
    it("computes averages for the 3 channels and overall score", () => {
      const audits = [
        // 4 Wise Calls: 100, 90, 80, 90 -> avg = 90
        { channelType: "wise_call", totalScore: 100 },
        { channelType: "wise_call", totalScore: 90 },
        { channelType: "wise_call", totalScore: 80 },
        { channelType: "wise_call", totalScore: 90 },
        // 4 Wise Emails: 80, 80, 80, 80 -> avg = 80
        { channelType: "wise_email", totalScore: 80 },
        { channelType: "wise_email", totalScore: 80 },
        { channelType: "wise_email", totalScore: 80 },
        { channelType: "wise_email", totalScore: 80 },
        // 4 InvGate AGs: 100, 100, 100, 100 -> avg = 100
        { channelType: "invgate_ticket", totalScore: 100 },
        { channelType: "invgate_ticket", totalScore: 100 },
        { channelType: "invgate_ticket", totalScore: 100 },
        { channelType: "invgate_ticket", totalScore: 100 },
      ] as any[];

      const stats = calculateOperatorChannelStats(audits);

      expect(stats.wiseCallsAvg).toBe(90);
      expect(stats.wiseCallsCount).toBe(4);
      expect(stats.wiseEmailsAvg).toBe(80);
      expect(stats.wiseEmailsCount).toBe(4);
      expect(stats.invgateAgAvg).toBe(100);
      expect(stats.invgateAgCount).toBe(4);
      expect(stats.totalAuditsCount).toBe(12);
      expect(stats.quotaFulfilled).toBe(true);
      // Overall avg of 3 channels: (90 + 80 + 100) / 3 = 90
      expect(stats.globalAverage).toBe(90);
    });

    it("marks quotaFulfilled = false when any channel has less than 4 audits", () => {
      const partialAudits = [
        { channelType: "wise_call", totalScore: 90 },
        { channelType: "wise_call", totalScore: 90 },
        { channelType: "wise_email", totalScore: 80 },
      ] as any[];

      const stats = calculateOperatorChannelStats(partialAudits);
      expect(stats.quotaFulfilled).toBe(false);
      expect(stats.wiseCallsCount).toBe(2);
      expect(stats.wiseEmailsCount).toBe(1);
      expect(stats.invgateAgCount).toBe(0);
    });
  });
});
