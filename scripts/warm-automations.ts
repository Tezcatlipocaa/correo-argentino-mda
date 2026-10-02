import "dotenv/config";
import { discoverAutomations } from "@lib/workflow/discovery";
import { getIncidentStatuses } from "@lib/invgate/automation/statuses";
import { resolveAutomationCategoryId } from "@lib/workflow/category-resolver";
import {
  reconcileTrackedParentsFromStatuses,
  reconcileTrackedParentsFromView,
} from "@lib/workflow/tracked-parents";
import { getAutomationViewId } from "@lib/invgate/automation/by-view";

/**
 * Pre-warm del módulo de automatizaciones: ejecuta el scan frío (categoría,
 * colas, tickets y estados) para dejar resueltos los caches en memoria y el
 * snapshot persistido en SQLite. Además reconcilia el tracking de padres para
 * recuperar los reasignados a otras mesas. Se corre desde auto-deploy.bat
 * después de `pm2 start` para que el primer usuario no pague el scan.
 */
async function main(): Promise<void> {
  const startedAt = Date.now();

  const [discovery, statuses] = await Promise.all([
    discoverAutomations(),
    getIncidentStatuses(),
  ]);

  const categoryId = await resolveAutomationCategoryId();
  const viewId = getAutomationViewId();
  const reconciled = viewId
    ? await reconcileTrackedParentsFromView(viewId, categoryId)
    : await reconcileTrackedParentsFromStatuses(categoryId);

  const discoveryDetail = discovery.ok
    ? `current=${discovery.current?.prettyId ?? "-"} active=${discovery.otherActive.length}`
    : `error=${discovery.message}`;

  console.log(
    `[warm-automations] listo en ${Date.now() - startedAt} ms · discovery(${discoveryDetail}) · statuses ok=${statuses.ok} · trackeados(${reconciled.activeParents})`,
  );
}

main().catch((error) => {
  console.error("[warm-automations] error", error);
  process.exitCode = 1;
});
