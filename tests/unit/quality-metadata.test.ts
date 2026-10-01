import { describe, it, expect, vi } from "vitest";
import {
  parseWiseCallMetadata,
  parseWiseEmailMetadata,
  parseInvgateAgMetadata,
  formatSecondsToMinutes,
} from "../../src/lib/qualityMetadataFetcher";

describe("Quality Metadata Extractors", () => {
  it("formats seconds into mm:ss string properly", () => {
    expect(formatSecondsToMinutes(135)).toBe("02:15");
    expect(formatSecondsToMinutes(60)).toBe("01:00");
    expect(formatSecondsToMinutes(9)).toBe("00:09");
    expect(formatSecondsToMinutes(0)).toBe("00:00");
  });

  it("extracts Wise Call metadata from case and activity payloads", () => {
    const mockCase = {
      id: 430357543,
      number: 534787,
      created_at: "2026-09-06 03:09:59",
      source_channel: "incoming_call",
      status: "closed",
    };

    const mockActivities = [
      {
        id: 4321648175,
        type: "contact_message",
        call_data: {
          started_at: "2026-09-06 03:09:59",
          ended_at: "2026-09-06 03:12:14",
          assigned_at: "2026-09-06 03:10:43",
          duration: 135,
          logs: [
            { time: "00:09:58.663", message: "[call_start]" },
            { time: "00:10:42.510", message: "[call_available_agents]Franco Nahuel Gonzalez" },
            { time: "00:10:51.893", message: "[call_attended]Franco Nahuel Gonzalez" },
            { time: "00:12:13.860", message: "[call_end]" },
          ],
        },
      },
    ];

    const metadata = parseWiseCallMetadata(mockCase, mockActivities);

    expect(metadata.caseNumber).toBe("534787");
    expect(metadata.duration).toBe("02:15");
    expect(metadata.operator).toBe("Franco Nahuel Gonzalez");
    expect(metadata.date).toBe("2026-09-06");
    expect(metadata.ringTime).toBe("00:44"); // 03:09:59 to 03:10:43 is 44s
  });

  it("extracts Wise Email metadata from case and activity payloads", () => {
    const mockCase = {
      id: 438571449,
      number: 540968,
      created_at: "2026-09-30 16:45:32",
      first_read: "2026-09-30 16:56:55",
      source_channel: "email",
      user_id: 46684,
      subject: "Oficinas alarmadas",
    };

    const metadata = parseWiseEmailMetadata(mockCase, "Operador Prueba");

    expect(metadata.caseNumber).toBe("540968");
    expect(metadata.date).toBe("2026-09-30");
    expect(metadata.creationTime).toBe("2026-09-30 16:45:32");
    expect(metadata.takeTime).toBe("2026-09-30 16:56:55");
    expect(metadata.operator).toBe("Operador Prueba");
  });

  it("extracts InvGate Autogestión metadata and detects PAS condition", () => {
    const mockIncidentPas = {
      id: 99123,
      title: "Problema en puesto de trabajo",
      priority: { id: 3, name: "Media" },
      created_at: "2026-09-28 10:00:00",
      updated_at: "2026-09-28 10:15:00",
      assigned_to: { id: 101, name: "Juan Perez" },
      location: { id: 405, name: "PAS Central" },
      helpdesk: { id: 12, name: "Mesa PAS" },
    };

    const metadataPas = parseInvgateAgMetadata(mockIncidentPas);
    expect(metadataPas.caseNumber).toBe("99123");
    expect(metadataPas.priority).toBe("Media");
    expect(metadataPas.operator).toBe("Juan Perez");
    expect(metadataPas.isPas).toBe(true);
    expect(metadataPas.date).toBe("2026-09-28");

    const mockIncidentNonPas = {
      id: 99124,
      title: "Reinicio de password",
      priority: { id: 2, name: "Baja" },
      created_at: "2026-09-29 09:00:00",
      assigned_to: { id: 102, name: "Maria Lopez" },
      location: { id: 100, name: "Sucursal 12" },
      helpdesk: { id: 5, name: "MDA TI" },
    };

    const metadataNonPas = parseInvgateAgMetadata(mockIncidentNonPas);
    expect(metadataNonPas.isPas).toBe(false);
  });
});
