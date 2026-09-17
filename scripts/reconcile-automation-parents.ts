import "dotenv/config";
import { resolveAutomationCategoryId } from "@lib/workflow/category-resolver";
import { reconcileTrackedParentsFromStatuses } from "@lib/workflow/tracked-parents";

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
  const result = await reconcileTrackedParentsFromStatuses(categoryId);

  console.log(
    `[reconcile-automation-parents] categoría ${categoryId} · padres activos ${result.activeParents} · trackeados ${result.tracked} en ${Date.now() - startedAt} ms`,
  );
}

main().catch((error) => {
  console.error("[reconcile-automation-parents] error", error);
  process.exitCode = 1;
});
