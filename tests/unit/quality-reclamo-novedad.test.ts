import { describe, it, expect } from "vitest";
import { calculateMultiChannelAuditScores } from "../../src/lib/qualityCalculator";
import {
  WISE_CALL_PARAMETERS,
  WISE_EMAIL_PARAMETERS,
} from "../../src/config/qualityParams";

describe("Quality Calculator - Reclamo / Novedad Logic", () => {
  describe("Wise Call Channel", () => {
    it("gives 100% to section 2 and full 55 points when isReclamoNovedad is true, even if no ticket parameters are checked", () => {
      // Only Section 1 parameters compliant, NO ticket parameters compliant
      const compliantCodes = new Set(
        WISE_CALL_PARAMETERS.filter((p) => p.section === "items").map((p) => p.code),
      );

      const res = calculateMultiChannelAuditScores(
        "wise_call",
        WISE_CALL_PARAMETERS,
        compliantCodes,
        true, // hasSection2
        true, // isReclamoNovedad = true!
      );

      expect(res.section1Score).toBe(100);
      expect(res.section2Score).toBe(100);
      expect(res.totalScore).toBe(100);
    });

    it("correctly preserves Section 1 deductions and awards 55 ticket points on Reclamo / Novedad", () => {
      // Deduct call_procedimiento (-10) in Section 1
      // s1Raw = 45 - 10 = 35. s1Score = Math.round((35 / 45) * 100) = 78%
      // Total with Reclamo / Novedad: 35 + 55 = 90%
      const compliantCodes = new Set(
        WISE_CALL_PARAMETERS.filter(
          (p) => p.section === "items" && p.code !== "call_procedimiento",
        ).map((p) => p.code),
      );

      const res = calculateMultiChannelAuditScores(
        "wise_call",
        WISE_CALL_PARAMETERS,
        compliantCodes,
        true,
        true, // isReclamoNovedad = true
      );

      expect(res.section1Score).toBe(78);
      expect(res.section2Score).toBe(100);
      expect(res.totalScore).toBe(90);
    });

    it("evaluates ticket parameters individually when isReclamoNovedad is false", () => {
      // Section 1 all compliant. Section 2 has deduction: call_ticket_categorizacion (-10)
      // s1Raw = 45. s2Raw = 55 - 10 = 45. s2Score = Math.round((45 / 55) * 100) = 82%
      // Total: 45 + 45 = 90%
      const compliantCodes = new Set(
        WISE_CALL_PARAMETERS.filter((p) => p.code !== "call_ticket_categorizacion").map(
          (p) => p.code,
        ),
      );

      const res = calculateMultiChannelAuditScores(
        "wise_call",
        WISE_CALL_PARAMETERS,
        compliantCodes,
        true,
        false, // isReclamoNovedad = false
      );

      expect(res.section1Score).toBe(100);
      expect(res.section2Score).toBe(82);
      expect(res.totalScore).toBe(90);
    });
  });

  describe("Wise Email Channel", () => {
    it("gives 100% to section 2 (MDA) when isReclamoNovedad is true", () => {
      // Only Section 1 parameters compliant
      const compliantCodes = new Set(
        WISE_EMAIL_PARAMETERS.filter((p) => p.section === "items").map((p) => p.code),
      );

      const res = calculateMultiChannelAuditScores(
        "wise_email",
        WISE_EMAIL_PARAMETERS,
        compliantCodes,
        true, // hasSection2
        true, // isReclamoNovedad = true
      );

      expect(res.section1Score).toBe(100);
      expect(res.section2Score).toBe(100);
      expect(res.totalScore).toBe(100);
    });

    it("correctly preserves Section 1 deductions and awards 100% to Section 2 on Reclamo / Novedad in email", () => {
      // Deduct email_interpretacion (-10) in Section 1
      // s1Score = 100 - 10 = 90%.
      // Total with Reclamo / Novedad: Math.round((90 + 100) / 2) = 95%
      const compliantCodes = new Set(
        WISE_EMAIL_PARAMETERS.filter(
          (p) => p.section === "items" && p.code !== "email_interpretacion",
        ).map((p) => p.code),
      );

      const res = calculateMultiChannelAuditScores(
        "wise_email",
        WISE_EMAIL_PARAMETERS,
        compliantCodes,
        true,
        true, // isReclamoNovedad = true
      );

      expect(res.section1Score).toBe(90);
      expect(res.section2Score).toBe(100);
      expect(res.totalScore).toBe(95);
    });

    it("evaluates MDA ticket parameters individually when isReclamoNovedad is false in email", () => {
      // Section 1 all compliant (100%).
      // Section 2 has deduction: email_mda_categorizacion (-10%)
      // s2Score = 100 - 10 = 90%. Total = Math.round((100 + 90) / 2) = 95%
      const compliantCodes = new Set(
        WISE_EMAIL_PARAMETERS.filter((p) => p.code !== "email_mda_categorizacion").map(
          (p) => p.code,
        ),
      );

      const res = calculateMultiChannelAuditScores(
        "wise_email",
        WISE_EMAIL_PARAMETERS,
        compliantCodes,
        true,
        false, // isReclamoNovedad = false
      );

      expect(res.section1Score).toBe(100);
      expect(res.section2Score).toBe(90);
      expect(res.totalScore).toBe(95);
    });
  });
});
