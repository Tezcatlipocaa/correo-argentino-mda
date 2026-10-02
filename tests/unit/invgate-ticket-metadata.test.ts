import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseInvgateAgMetadata,
  fetchInvgateTicketMetadata,
  INVGATE_STATUS_NAMES,
  INVGATE_PRIORITY_NAMES,
} from "../../src/lib/qualityMetadataFetcher";
import * as invgateClient from "../../src/lib/invgateClient";

describe("InvGate Ticket Metadata Resolution", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps status_id and priority_id to friendly names", () => {
    const rawIncident = {
      id: 98765,
      title: "Problema de red",
      description: "Descripci&#xF3;n con error de conexi&#xF3;n.",
      status_id: 2,
      priority_id: 3,
      created_at: 1727784000,
    };

    const metadata = parseInvgateAgMetadata(rawIncident);

    expect(metadata.caseNumber).toBe("98765");
    expect(metadata.title).toBe("Problema de red");
    expect(metadata.description).toBe("Descripción con error de conexión.");
    expect(metadata.status).toBe(INVGATE_STATUS_NAMES[2] || "Abierto");
    expect(metadata.priority).toBe(INVGATE_PRIORITY_NAMES[3] || "Alta");
  });

  it("resolves customer, category, and operator via API calls in fetchInvgateTicketMetadata", async () => {
    const mockIncident = {
      id: 12345,
      title: "Impresora no funciona",
      description: "No Caracter&#xED;sticas de Punto de Inter&#xE9;s - Distribuci&#xF3;n.",
      status_id: 1, // Nuevo
      priority_id: 2, // Media
      user_id: 501,
      assigned_id: 202,
      category_id: 303,
      created_at: 1727784000,
    };

    vi.spyOn(invgateClient, "invgateGet").mockImplementation(async (endpoint: string): Promise<any> => {
      if (endpoint === "incident?id=12345") {
        return { ok: true, data: mockIncident, status: 200 };
      }
      if (endpoint === "user?id=501") {
        return {
          ok: true,
          data: { id: 501, name: "Carlos", lastname: "Gomez", email: "cgomez@correo.com" },
          status: 200,
        };
      }
      if (endpoint === "user?id=202") {
        return {
          ok: true,
          data: { id: 202, name: "Maria", lastname: "Lopez", email: "mlopez@correo.com" },
          status: 200,
        };
      }
      if (endpoint.includes("categories") || endpoint === "category?id=303") {
        return {
          ok: true,
          data: [
            { id: 303, name: "Hardware > Impresoras" },
          ],
          status: 200,
        };
      }
      return { ok: false, error: "Not found", status: 404 };
    });

    const result = await fetchInvgateTicketMetadata(12345);

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.title).toBe("Impresora no funciona");
    expect(result.data?.description).toBe("No Características de Punto de Interés - Distribución.");
    expect(result.data?.status).toBe("Nuevo");
    expect(result.data?.priority).toBe("Media");
    expect(result.data?.creator).toBe("Carlos Gomez");
    expect(result.data?.operator).toBe("Maria Lopez");
    expect(result.data?.category).toBe("Hardware > Impresoras");
  });

  it("handles missing or null user/category gracefully without throwing", async () => {
    const mockIncident = {
      id: 99999,
      title: "Consulta general",
      description: "Texto simple",
      status_id: 999, // unknown status
      priority_id: 999, // unknown priority
      user_id: null,
      category_id: null,
    };

    vi.spyOn(invgateClient, "invgateGet").mockResolvedValue({
      ok: true,
      data: mockIncident,
      status: 200,
    } as any);

    const result = await fetchInvgateTicketMetadata(99999);
    expect(result.ok).toBe(true);
    expect(result.data?.caseNumber).toBe("99999");
    expect(result.data?.creator).toBe("Desconocido");
    expect(result.data?.category).toBe("Sin categoría");
  });
});
