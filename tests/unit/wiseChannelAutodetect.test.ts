import { describe, it, expect } from "vitest";
import {
  discernWiseChannel,
  parseWiseCallMetadata,
  parseWiseEmailMetadata,
} from "../../src/lib/qualityMetadataFetcher";

describe("Wise CX Channel Auto-detection (TDD)", () => {
  it("discerns 'wise_email' when source_channel is 'email'", () => {
    expect(discernWiseChannel("email")).toBe("wise_email");
  });

  it("discerns 'wise_call' when source_channel is 'incoming_call' or contains 'call'", () => {
    expect(discernWiseChannel("incoming_call")).toBe("wise_call");
    expect(discernWiseChannel("outgoing_call")).toBe("wise_call");
    expect(discernWiseChannel("telephony_call")).toBe("wise_call");
    expect(discernWiseChannel("call")).toBe("wise_call");
  });

  it("defaults to wise_call for unknown or empty source_channel", () => {
    expect(discernWiseChannel("")).toBe("wise_call");
    expect(discernWiseChannel(undefined)).toBe("wise_call");
    expect(discernWiseChannel(null as any)).toBe("wise_call");
  });

  it("sets detectedChannel in parseWiseEmailMetadata", () => {
    const mockCase = {
      id: 533785,
      number: 533785,
      created_at: "2026-09-02 12:16:16",
      source_channel: "email",
    };
    const metadata = parseWiseEmailMetadata(mockCase, "Operador Juan");
    expect(metadata.detectedChannel).toBe("wise_email");
  });

  it("sets detectedChannel in parseWiseCallMetadata", () => {
    const mockCase = {
      id: 534787,
      number: 534787,
      created_at: "2026-09-06 03:09:59",
      source_channel: "incoming_call",
    };
    const metadata = parseWiseCallMetadata(mockCase, []);
    expect(metadata.detectedChannel).toBe("wise_call");
  });
});
