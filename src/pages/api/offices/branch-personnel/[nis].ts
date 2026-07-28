import type { APIRoute } from "astro";
import { db } from "@db/index";
import { employees, employeeOffices } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { jsonResponse, jsonError } from "@lib/apiResponse";

const SENIOR_KEYWORDS = [
  "jefe", "supervisor", "gerente", "director", "coordinador",
  "subgerente", "responsable", "lider", "líder",
];

function isSenior(position: string | null): boolean {
  if (!position) return false;
  const lower = position.toLowerCase();
  return SENIOR_KEYWORDS.some((kw) => lower.includes(kw));
}

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return jsonError("No autorizado", 401);

  try {
    const nis = params.nis;
    if (!nis) return jsonError("NIS requerido", 400);

    const rows = await db
      .select({
        username: employeeOffices.username,
        fullname: employees.fullname,
        dni: employees.dni,
        interno: employees.interno,
        telefono: employees.telefono,
        position: employees.position,
        sucursal: employeeOffices.sucursal,
      })
      .from(employeeOffices)
      .innerJoin(
        employees,
        eq(employeeOffices.username, sql`lower(${employees.username})`),
      )
      .where(eq(employeeOffices.sucursal, nis));

    let results = rows.map((r) => ({
      dni: r.dni,
      fullname: r.fullname,
      username: r.username,
      interno: r.interno,
      telefono: r.telefono,
      position: r.position,
    }));

    if (results.length === 0) {
      const fallback = await db
        .select({
          dni: employees.dni,
          fullname: employees.fullname,
          username: employees.username,
          interno: employees.interno,
          telefono: employees.telefono,
          position: employees.position,
        })
        .from(employees)
        .where(eq(employees.sucursal, nis))
        .limit(10);

      results = fallback;
    }

    const senior = results
      .filter((r) => isSenior(r.position))
      .sort((a, b) => (a.position ?? "").localeCompare(b.position ?? "") || (a.fullname ?? "").localeCompare(b.fullname ?? ""));
    const others = results
      .filter((r) => !isSenior(r.position))
      .sort((a, b) => (a.position ?? "").localeCompare(b.position ?? "") || (a.fullname ?? "").localeCompare(b.fullname ?? ""));

    const sorted = [...senior, ...others];

    const display = sorted.slice(0, 10);

    return jsonResponse({
      ok: true,
      nis,
      total: display.length,
      personnel: display,
    });
  } catch (error) {
    console.error("[BranchPersonnel] Error:", error);
    return jsonError("Error al obtener personal", 500);
  }
};
