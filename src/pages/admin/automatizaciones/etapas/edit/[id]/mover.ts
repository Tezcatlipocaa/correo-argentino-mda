import { db } from "@db/index";
import { workflowStages } from "@db/schema";
import { asc, eq } from "drizzle-orm";
import { redirectWithToast } from "@lib/api/redirectWithToast";
import { logAdminFromAstro } from "@lib/auditLogger";
import { resolveUrl } from "@lib/url";
import type { APIRoute } from "astro";

const listPath = "admin/automatizaciones/etapas";

export const POST: APIRoute = async ({ params, locals, request }) => {
  const stageId = Number.parseInt(params.id ?? "", 10);
  const dir = new URL(request.url).searchParams.get("dir");
  const fail = (message: string, type: "error" | "warning" = "error") =>
    redirectWithToast(resolveUrl(`/${listPath}`), message, type);

  if (Number.isNaN(stageId) || (dir !== "up" && dir !== "down")) {
    return fail("Solicitud inválida.");
  }

  try {
    const [current] = await db
      .select({
        id: workflowStages.id,
        name: workflowStages.name,
        position: workflowStages.position,
        scope: workflowStages.scope,
      })
      .from(workflowStages)
      .where(eq(workflowStages.id, stageId))
      .limit(1);

    if (!current) {
      return fail("Etapa inexistente.");
    }

    const stages = await db
      .select({
        id: workflowStages.id,
        name: workflowStages.name,
        position: workflowStages.position,
      })
      .from(workflowStages)
      .where(eq(workflowStages.scope, current.scope))
      .orderBy(asc(workflowStages.position), asc(workflowStages.id));

    const index = stages.findIndex((stage) => stage.id === stageId);
    if (index === -1) {
      return fail("Etapa inexistente.");
    }

    const swapIndex = dir === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= stages.length) {
      return fail(
        dir === "up"
          ? "La etapa ya es la primera del orden."
          : "La etapa ya es la última del orden.",
        "warning",
      );
    }

    const neighbor = stages[swapIndex];

    await db
      .update(workflowStages)
      .set({ position: neighbor.position })
      .where(eq(workflowStages.id, current.id));
    await db
      .update(workflowStages)
      .set({ position: current.position })
      .where(eq(workflowStages.id, neighbor.id));

    await logAdminFromAstro(
      locals,
      `Reordenó las etapas del workflow: movió "${current.name}" hacia ${dir === "up" ? "arriba" : "abajo"} (intercambio con "${neighbor.name}")`,
    );

    return redirectWithToast(
      resolveUrl(`/${listPath}`),
      `Etapa "${current.name}" reordenada.`,
    );
  } catch {
    return fail("No se pudo reordenar la etapa.");
  }
};
