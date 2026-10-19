import type { APIRoute } from "astro";
import { requireReadAccess } from "@lib/rbac-middleware";
import { jsonError, sanitizeError } from "@lib/apiResponse";
import { getWorkflowReport } from "@lib/workflows/service";

function csvField(value: unknown): string {
  const text = (value ?? "").toString();
  return `"${text.replace(/"/g, '""')}"`;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const denied = await requireReadAccess(locals, "reportes");
  if (denied) return denied;

  const slug = params.slug || "implementacion";

  try {
    const report = await getWorkflowReport(slug);
    const lines = [
      [
        "ID",
        "Título",
        "Estado",
        "Grupo Asignado",
        "Creador",
        "Lead Time (h)",
        "SLA Cumplido",
        "Progreso %",
      ]
        .map(csvField)
        .join(","),
    ];

    for (const instance of report.instances) {
      lines.push(
        [
          csvField(instance.prettyId),
          csvField(instance.title),
          csvField(instance.statusLabel || instance.status),
          csvField(instance.assignedGroup),
          csvField(instance.creatorName),
          csvField(
            instance.leadTimeHours !== undefined ? instance.leadTimeHours : "",
          ),
          csvField(instance.slaBreached ? "No" : "Sí"),
          csvField(`${instance.progressPercent}%`),
        ].join(","),
      );
    }

    const date = new Date().toISOString().split("T")[0];
    const body = "\uFEFF" + lines.join("\r\n");

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="workflow-${slug}-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(sanitizeError(error), 500);
  }
};
