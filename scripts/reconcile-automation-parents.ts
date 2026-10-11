import "dotenv/config";
import { resolveAutomationCategoryId } from "@lib/workflow/category-resolver";
import {
  reconcileTrackedParentsFromStatuses,
  reconcileTrackedParentsFromView,
} from "@lib/workflow/tracked-parents";
import { getAutomationViewId } from "@lib/invgate/automation/by-view";

/**
 * Reconciliación completa del tracking de padres de automatización: busca
 * todos los incidentes activos de la categoría (sin importar la mesa) y
 * actualiza `automation_tracked_parents`. Recupera padres que el workflow
 * reasignó a otra mesa antes de que el discovery los trackeara.
 *
 * Se corre en el deploy (warm) y como worker PM2 diario.
 */
async function main(): Promise<void> {
  const startedAt = Date.now();

  const categoryId = await resolveAutomationCategoryId();
  const viewId = getAutomationViewId();
  const result = viewId
    ? await reconcileTrackedParentsFromView(viewId, categoryId)
    : await reconcileTrackedParentsFromStatuses(categoryId);

  console.log(
    `[reconcile-automation-parents] categoría ${categoryId}${viewId ? ` · vista ${viewId}` : ""} · padres activos ${result.activeParents} · trackeados ${result.tracked} en ${Date.now() - startedAt} ms`,
  );
}

main().catch((error) => {
  console.error("[reconcile-automation-parents] error", error);
  process.exitCode = 1;
});
