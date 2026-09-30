import type { APIRoute } from "astro";
import { Resvg } from "@resvg/resvg-js";
import { getInternalOrigin } from "@lib/internalOrigin";
import { requireReadAccess } from "@lib/rbac-middleware";
import { buildCronogramaSvg } from "@components/cronograma/lib/exportSvg";
import type { CronogramaPayload } from "@components/cronograma/lib/api";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, m - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthDates(month: string): string[] {
  const [year, m] = month.split("-").map(Number);
  const totalDays = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from({ length: totalDays }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

async function fetchUpstream(month: string, cookie: string): Promise<Response> {
  const path = `/api/cronograma?month=${month}`;
  const init = { headers: { cookie } };
  try {
    return await fetch(new URL(path, getInternalOrigin()), init);
  } catch {
    return await fetch(new URL(path, `http://localhost:${process.env.PORT || 4321}`), init);
  }
}

export const GET: APIRoute = async ({ url, locals, request }) => {
  const denied = await requireReadAccess(locals, "cronograma");
  if (denied) return denied;

  const month = url.searchParams.get("month") ?? "";
  if (!MONTH_RE.test(month)) {
    return new Response(JSON.stringify({ error: "Parámetro month inválido (formato esperado YYYY-MM)." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const upstream = await fetchUpstream(month, request.headers.get("cookie") ?? "");
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: "No se pudieron cargar los datos del cronograma." }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const payload = (await upstream.json()) as CronogramaPayload;
  const built = buildCronogramaSvg({
    monthLabel: monthLabel(month),
    dates: monthDates(month),
    operators: payload.operators ?? [],
  });

  const resvg = new Resvg(built.svg, {
    fitTo: { mode: "width", value: built.width * 2 },
    background: "#ffffff",
    font: { loadSystemFonts: true, defaultFontFamily: "Arial" },
  });
  const png = resvg.render().asPng();

  return new Response(png, {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
      "content-disposition": `inline; filename="cronograma_${month}.png"`,
    },
  });
};
