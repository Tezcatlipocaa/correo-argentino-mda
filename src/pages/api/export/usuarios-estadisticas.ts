import type { APIRoute } from "astro";
import { generateCsv } from "@lib/csv";
import { jsonError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { loadUsuariosEstadisticas } from "@lib/usuariosEstadisticas";

const HEADERS = ["seccion", "dimension", "valor"];

export const GET: APIRoute = async ({ url, locals }) => {
  const denied = await requireReadAccess(locals, "usuarios");
  if (denied) return denied;

  const result = await loadUsuariosEstadisticas(
    url.searchParams.get("rol"),
    url.searchParams.get("mesa"),
    url.searchParams.get("activo"),
  );

  if (!result.ok) {
    return jsonError(result.error, result.internal ? 500 : 400, "no-store");
  }

  const { kpis, charts } = result.data;

  const rows: string[][] = [
    ["kpis", "total", String(kpis.total)],
    ["kpis", "activos", String(kpis.activos)],
    ["kpis", "inactivos", String(kpis.inactivos)],
    ["kpis", "enAsistencia", String(kpis.enAsistencia)],
  ];

  const secciones: [string, typeof charts.estado][] = [
    ["estado", charts.estado],
    ["porRol", charts.porRol],
    ["porMesa", charts.porMesa],
  ];

  for (const [seccion, chart] of secciones) {
    chart.labels.forEach((label, i) => {
      rows.push([seccion, label, String(chart.series[0]?.data[i] ?? 0)]);
    });
  }

  const csv = generateCsv(HEADERS, rows);
  const dateStr = new Date().toISOString().split("T")[0];

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="usuarios-estadisticas_${dateStr}.csv"`,
      "Cache-Control": "no-store",
    },
  });
};
