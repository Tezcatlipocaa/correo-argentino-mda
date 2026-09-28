import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock invgateClient
vi.mock("@lib/invgateClient", () => ({
  invgatePost: vi.fn(),
  invgateGet: vi.fn(),
}));

import { addTicketComment, getTicketComments } from "@/lib/invgate/agsTickets";
import { invgatePost, invgateGet } from "@lib/invgateClient";

describe("addTicketComment & public assignment comment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe enviar customer_visible = 1 para comentarios públicos", async () => {
    (invgatePost as any).mockResolvedValueOnce({
      ok: true,
      data: { status: "OK" },
    });

    const result = await addTicketComment(12345, "Se asigna para su verificación.", 99, 1);

    expect(result.ok).toBe(true);
    expect(invgatePost).toHaveBeenCalledWith("incident.comment", {
      request_id: 12345,
      author_id: 99,
      comment: "Se asigna para su verificación.",
      customer_visible: 1,
    });
  });

  it("debe manejar fallos de InvGate al agregar comentario sin crashear", async () => {
    (invgatePost as any).mockResolvedValueOnce({
      ok: false,
      message: "API Timeout",
    });

    const result = await addTicketComment(12345, "Se asigna para su verificación.", 99, 1);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("API Timeout");
  });

  it("debe invalidar el caché de comentarios del ticket tras agregar comentario", async () => {
    // 1. Simular primera carga de comentarios para cachear
    (invgateGet as any).mockResolvedValueOnce({
      ok: true,
      data: [{ id: 1, incident_id: 12345, author_id: 99, message: "Comentario previo", created_at: 1000 }],
    });

    const initial = await getTicketComments(12345);
    expect(initial.comments.length).toBe(1);

    // 2. Agregar nuevo comentario
    (invgatePost as any).mockResolvedValueOnce({
      ok: true,
      data: { status: "OK" },
    });
    await addTicketComment(12345, "Se asigna para su verificación.", 99, 1);

    // 3. Segunda llamada a getTicketComments debe llamar de nuevo a la API (no caché stale)
    (invgateGet as any).mockResolvedValueOnce({
      ok: true,
      data: [
        { id: 2, incident_id: 12345, author_id: 99, message: "Se asigna para su verificación.", created_at: 2000 },
        { id: 1, incident_id: 12345, author_id: 99, message: "Comentario previo", created_at: 1000 },
      ],
    });

    const refreshed = await getTicketComments(12345);
    expect(refreshed.comments.length).toBe(2);
  });
});
