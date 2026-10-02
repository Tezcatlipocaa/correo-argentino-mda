/**
 * Dump READ-ONLY de los labels reales de los tickets hijos del workflow de
 * automatizaciones (producción). Sirve para ajustar aliases/plantilla de etapas
 * y validar el matcher contra títulos reales.
 *
 * No escribe en InvGate ni en la DB. Ejecución:
 *   npx tsx src/scripts/dump-workflow-labels.ts
 */
import "dotenv/config";
import { resolveAutomationCategoryId } from "../lib/workflow/category-resolver";
import { resolveAutomationQueueIds } from "../lib/workflow/queue-resolver";
import { getIncidentIdsByHelpdesk } from "../lib/invgate/automation/by-helpdesk";
import { getIncidents } from "../lib/invgate/automation/incidents";
import {
  detectWorkflowKind,
  resolveAutomationDetail,
} from "../lib/workflow/resolver";

async function main() {
  const categoryId = await resolveAutomationCategoryId();
  const queueIds = await resolveAutomationQueueIds(categoryId);
  console.log(`Categoría: ${categoryId} | Colas: ${queueIds.join(", ")}`);

  const idLists = await Promise.all(
    queueIds.map((queueId) => getIncidentIdsByHelpdesk(queueId)),
  );
  const allIds = [...new Set(idLists.flatMap((r) => (r.ok ? r.data : [])))];
  console.log(`Tickets en cola: ${allIds.length}`);

  const bulk = await getIncidents(allIds);
  if (!bulk.ok) {
    throw new Error(`No se pudieron obtener incidentes: ${bulk.message}`);
  }

  const parents = Object.values(bulk.data)
    .filter((incident) => incident.category_id === categoryId)
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

  console.log(`Padres de automatización: ${parents.length}\n`);

  const allStepLabels = new Set<string>();

  for (const parent of parents) {
    const result = await resolveAutomationDetail(parent.id);
    if (!result.ok) {
      console.log(`#${parent.id} ERROR: ${result.message}`);
      continue;
    }
    const { detail } = result;
    const kind = detectWorkflowKind(detail.title, detail.nodes);
    console.log(
      `── #${parent.id} [${kind}] ${detail.title} (${detail.nodes.length} nodos)`,
    );
    for (const node of detail.nodes) {
      if (node.kind !== "request") continue;
      allStepLabels.add(node.stepLabel.trim());
      console.log(`   • step="${node.stepLabel}" | title="${node.title}"`);
    }
    console.log("");
  }

  console.log("\n=== STEP LABELS ÚNICOS ===");
  for (const label of [...allStepLabels].sort()) {
    console.log(label);
  }
}

main().catch((error) => {
  console.error("Dump falló:", error);
  process.exit(1);
});
