import { planGrouping, ghostNode } from "../src/lib/workflow/timeline-plan";

/**
 * Verificación unitaria del plan de render de la timeline.
 * Ejecución: node --import tsx tests/workflow-timeline-plan.test.mjs
 * (o npx tsx tests/workflow-timeline-plan.test.mjs)
 */

const failures = [];

function check(name, condition) {
  if (!condition) {
    failures.push(`FAIL: ${name}`);
  } else {
    console.log(`ok - ${name}`);
  }
}

function node(partial) {
  return {
    kind: "request",
    refId: 1,
    prettyId: "#1",
    stepLabel: "Paso",
    title: "Paso",
    description: "",
    lifecycle: "pending",
    rawStatusId: 1,
    createdAt: 100,
    invgateUrl: "",
    activity: [],
    solution: null,
    solutionAuthorName: null,
    tasks: [],
    ...partial,
  };
}

function item(partial) {
  return {
    template: { id: 1, matchLabel: "x", displayName: null, blocking: false },
    kind: "ticket",
    label: "Ticket",
    blocking: false,
    nodes: [],
    missing: false,
    completed: false,
    ...partial,
  };
}

function group(partial) {
  return {
    template: { id: 1, name: "Etapa", description: null, position: 1 },
    status: "in_progress",
    gateLabel: null,
    gateSatisfied: true,
    items: [],
    completedBlocking: 0,
    totalBlocking: 0,
    ...partial,
  };
}

function grouping(partial) {
  return {
    groups: [],
    stagelessNodes: [],
    missingBlockingCount: 0,
    ...partial,
  };
}

// 1. Numeración: nodos reales + fantasma bloqueante al final del item.
{
  const planned = planGrouping(
    grouping({
      groups: [
        group({
          items: [
            item({
              label: "Configuración",
              nodes: [node({ refId: 10 }), node({ refId: 11 })],
            }),
            item({ label: "Instalación", missing: true, blocking: true }),
          ],
        }),
      ],
    }),
  );

  const cards = planned.sections[0].items.flat();
  check(
    "numera los nodos reales 1 y 2",
    cards[0].stepNumber === 1 && cards[1].stepNumber === 2,
  );
  check("el fantasma sigue la numeración real", cards[2].stepNumber === 3);
  check("fantasma bloqueante es kind=missing", cards[2].kind === "missing");
  check(
    "ghostNode usa el label del item",
    cards[2].node.stepLabel === "Instalación",
  );
  check("isLast marca la última card del item final", cards[2].isLast === true);
  check(
    "las cards previas no son isLast",
    cards[0].isLast === false && cards[1].isLast === false,
  );
  check(
    "las cards reales llevan el displayLabel del item",
    cards[0].displayLabel === "Configuración",
  );
}

// 2. showMissing=false: no se emiten fantasmas y la numeración continúa.
{
  const planned = planGrouping(
    grouping({
      groups: [
        group({
          items: [
            item({
              nodes: [node({ refId: 20 })],
              missing: true,
              blocking: true,
            }),
            item({ label: "Siguiente", missing: true, blocking: true }),
          ],
        }),
      ],
    }),
    false,
  );

  const cards = planned.sections[0].items.flat();
  check("sin fantasmas solo quedan nodos reales", cards.length === 1);
  check("no se renumera por fantasmas ocultos", cards[0].stepNumber === 1);
  check("isLast cae en el último nodo real", cards[0].isLast === true);
}

// 3. Fantasma no bloqueante => kind=registration.
{
  const planned = planGrouping(
    grouping({
      groups: [group({ items: [item({ missing: true, blocking: false })] })],
    }),
  );
  const card = planned.sections[0].items[0][0];
  check(
    "fantasma no bloqueante es kind=registration",
    card.kind === "registration",
  );
}

// 4. gateLabel solo cuando el gate no está satisfecho.
{
  const pending = planGrouping(
    grouping({
      groups: [
        group({
          gateSatisfied: false,
          gateLabel: "Configuración previa",
          items: [item({ nodes: [node({})] })],
        }),
      ],
    }),
  );
  const satisfied = planGrouping(
    grouping({
      groups: [
        group({
          gateSatisfied: true,
          gateLabel: "Configuración previa",
          items: [item({ nodes: [node({})] })],
        }),
      ],
    }),
  );
  check(
    "gate insatisfecho expone gateLabel",
    pending.sections[0].gateLabel === "Configuración previa",
  );
  check(
    "gate satisfecho oculta gateLabel",
    satisfied.sections[0].gateLabel === null,
  );
}

// 5. Sección sin cards: no hay isLast (items vacíos no rompen).
{
  const planned = planGrouping(
    grouping({ groups: [group({ items: [item({})] })] }),
  );
  check(
    "item sin cards no rompe el plan",
    planned.sections[0].items[0].length === 0,
  );
}

// 6. Stageless: numeración 1-based, isLast en el último, label derivado.
{
  const planned = planGrouping(
    grouping({
      stagelessNodes: [
        node({
          refId: 30,
          title: "AUTSUC #79867 - 1.1-Equipamiento - Server",
          stepLabel: "AUTSUC #79867",
        }),
        node({ refId: 31, title: "Suelto", stepLabel: "Suelto" }),
      ],
    }),
  );

  check("stageless numera desde 1", planned.stageless[0].stepNumber === 1);
  check(
    "stageless isLast en el último",
    planned.stageless[1].isLast === true &&
      planned.stageless[0].isLast === false,
  );
  check(
    "stageless deriva label sin la referencia de sucursal",
    typeof planned.stageless[0].displayLabel === "string" &&
      planned.stageless[0].displayLabel.includes("Equipamiento"),
  );
}

// 7. ghostNode tiene la forma mínima esperada por la card.
{
  const ghost = ghostNode("Faltante");
  check(
    "ghostNode es lifecycle pending sin fecha",
    ghost.lifecycle === "pending" && ghost.createdAt === null,
  );
}

// 8. Equipamiento: el 1-Equipamiento es padre y 1.1/1.2 quedan anidados.
{
  const planned = planGrouping(
    grouping({
      groups: [
        group({
          items: [
            item({
              kind: "ticket",
              label: "Equipamiento (Prep y Despacho)",
              nodes: [
                node({
                  refId: 10,
                  title: "AUTSUC #79867 - 1-Equipamiento (Prep y Despacho)",
                  stepLabel: "AUTSUC #79867",
                }),
                node({
                  refId: 11,
                  title: "AUTSUC #79867 - 1.1-Equipamiento - Server",
                  stepLabel: "AUTSUC #79867",
                }),
                node({
                  refId: 12,
                  title: "AUTSUC #79867 - 1.2-Equipamiento - HH",
                  stepLabel: "AUTSUC #79867",
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  );
  const cards = planned.sections[0].items[0];
  check(
    "equipamiento: una sola card padre",
    cards.length === 1 && cards[0].node.refId === 10,
  );
  check(
    "equipamiento: 2 sub-nodos anidados",
    (cards[0].children ?? []).length === 2,
  );
  check(
    "equipamiento: labels de sub-nodos amigables",
    (cards[0].children ?? []).map((c) => c.displayLabel).join(",") ===
      "Server,HH",
  );
}

// 9. Ítems de formulario/manual: no generan fantasma "Faltante".
{
  const planned = planGrouping(
    grouping({
      groups: [
        group({
          items: [
            item({
              kind: "form",
              label: "Solicitud de hostnames",
              blocking: true,
              missing: true,
            }),
            item({
              kind: "manual",
              label: "Alta de usuarios Mosaic",
              blocking: true,
              missing: true,
            }),
          ],
        }),
      ],
    }),
  );
  const cards = planned.sections[0].items.flat();
  check("form: card informativa", cards[0]?.kind === "form");
  check("manual: card informativa", cards[1]?.kind === "manual");
}

// 10. Subproceso: se matchea el nodo y queda marcado.
{
  const planned = planGrouping(
    grouping({
      groups: [
        group({
          items: [
            item({
              kind: "subprocess",
              label: "Alta NIS en OnBase",
              nodes: [
                node({
                  refId: 20,
                  title:
                    "Alta NIS - AUTSUC Luis Guillón (B0106) 2026-09-25 #79867",
                  stepLabel: "Alta NIS",
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  );
  const card = planned.sections[0].items[0][0];
  check(
    "subproceso: card de ticket marcada",
    card.kind === "ticket" && card.subprocess === true,
  );
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-timeline-plan: all checks passed");
