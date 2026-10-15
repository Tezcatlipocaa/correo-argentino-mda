import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GET as getWorkflowsIndex } from "../../pages/reportes/workflows/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "../..");

describe("Contratos Visuales y Páginas de Workflows (Tasks 6, 7, 8, 9)", () => {
  it("Task 6: WorkflowBentoGrid.astro define los 6 KPIs y 2 ChartCards según especificación", () => {
    const file = path.join(
      srcDir,
      "components/reportes/workflows/WorkflowBentoGrid.astro",
    );
    assert.ok(fs.existsSync(file), "WorkflowBentoGrid.astro debe existir");
    const content = fs.readFileSync(file, "utf8");

    assert.ok(content.includes("WorkflowReportData"));
    assert.ok(content.includes('icon="git-repo-forked"'));
    assert.ok(content.includes('icon="time"'));
    assert.ok(content.includes('icon="check-circle"'));
    assert.ok(content.includes('icon="user-check"'));
    assert.ok(content.includes('icon="timer"'));
    assert.ok(content.includes('icon="shield-quarter"'));

    assert.ok(content.includes('type="doughnut"'));
    assert.ok(content.includes("Distribución por Estado"));
    assert.ok(content.includes('type="bar"'));
    assert.ok(content.includes("Distribución de Carga por Grupo"));
    assert.ok(content.includes("lg:col-span-2"));
  });

  it("Task 7: WorkflowTimelineDrawer.astro contiene todos los IDs y contenedores requeridos", () => {
    const file = path.join(
      srcDir,
      "components/reportes/workflows/WorkflowTimelineDrawer.astro",
    );
    assert.ok(fs.existsSync(file), "WorkflowTimelineDrawer.astro debe existir");
    const content = fs.readFileSync(file, "utf8");

    assert.ok(content.includes('id="workflow-timeline-drawer"'));
    assert.ok(content.includes("translate-x-full"));
    assert.ok(content.includes('id="drawer-close"'));
    assert.ok(content.includes('id="drawer-pretty-id"'));
    assert.ok(content.includes('id="drawer-title"'));
    assert.ok(content.includes('id="drawer-progress-bar"'));
    assert.ok(content.includes("progress-primary"));
    assert.ok(content.includes('id="drawer-progress-text"'));
    assert.ok(
      content.includes(
        'id="drawer-steps-list" class="steps steps-vertical',
      ) ||
        (content.includes('id="drawer-steps-list"') &&
          content.includes("steps steps-vertical")),
    );
    assert.ok(
      content.includes(
        'id="drawer-approvals-timeline" class="timeline timeline-vertical timeline-compact',
      ) ||
        (content.includes('id="drawer-approvals-timeline"') &&
          content.includes("timeline-vertical timeline-compact")),
    );
    assert.ok(content.includes('id="drawer-child-tickets"'));
  });

  it("Task 8: WorkflowInstancesTable.astro define la tabla, columnas y data attributes", () => {
    const file = path.join(
      srcDir,
      "components/reportes/workflows/WorkflowInstancesTable.astro",
    );
    assert.ok(
      fs.existsSync(file),
      "WorkflowInstancesTable.astro debe existir",
    );
    const content = fs.readFileSync(file, "utf8");

    assert.ok(content.includes('id="table-workflows"'));
    assert.ok(content.includes("DataTable"));
    assert.ok(content.includes('headerVariant="subtle"'));
    assert.ok(content.includes("DataTableHeaderCell"));
    assert.ok(content.includes('sortKey="ticket"'));
    assert.ok(content.includes('sortKey="titulo"'));
    assert.ok(content.includes('sortKey="estado"'));
    assert.ok(content.includes('sortKey="grupo"'));
    assert.ok(content.includes('sortKey="creador"'));
    assert.ok(content.includes('sortKey="progreso"'));
    assert.ok(content.includes('sortKey="sla"'));
    assert.ok(content.includes("Acción"));
    assert.ok(content.includes("data-workflow-row="));
    assert.ok(content.includes("btn-inspect-workflow"));
  });

  it("Task 9: GET /reportes/workflows redirige 302 a /reportes/workflows/implementacion", async () => {
    const file = path.join(srcDir, "pages/reportes/workflows/index.ts");
    assert.ok(fs.existsSync(file), "index.ts debe existir");

    const mockRedirect = (url: string, status?: number) =>
      new Response(null, {
        status: status ?? 302,
        headers: { Location: url },
      });

    const res = await (getWorkflowsIndex as any)({
      redirect: mockRedirect,
    });

    assert.equal(res.status, 302);
    assert.equal(
      res.headers.get("Location"),
      "/reportes/workflows/implementacion",
    );
  });

  it("Task 9: /reportes/workflows/[slug].astro renderiza layout, export, refresh y drawer client script", () => {
    const file = path.join(srcDir, "pages/reportes/workflows/[slug].astro");
    assert.ok(fs.existsSync(file), "[slug].astro debe existir");
    const content = fs.readFileSync(file, "utf8");

    assert.ok(content.includes("BaseLayout"));
    assert.ok(content.includes("PageContainer"));
    assert.ok(content.includes("PageHeader"));
    assert.ok(content.includes("WorkflowBentoGrid"));
    assert.ok(content.includes("WorkflowInstancesTable"));
    assert.ok(content.includes("WorkflowTimelineDrawer"));
    assert.ok(content.includes("/export"));
    assert.ok(content.includes('id="btn-refresh-workflows"'));
    assert.ok(content.includes("/refresh"));
    assert.ok(content.includes(".btn-inspect-workflow"));
    assert.ok(content.includes("data-workflow-row"));
    assert.ok(content.includes("translate-x-full"));
  });
});
