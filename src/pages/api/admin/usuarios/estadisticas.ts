import type { APIRoute } from "astro";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@db/index";
import { users, agents, mesas } from "@db/schema";
import { jsonError, jsonResponse, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { CANONICAL_ROLES, isValidRole, normalizeRole } from "@lib/rbac";
import { MDA_TI_HELPDESK } from "@lib/helpdeskAccess";

interface Serie {
  label: string;
  data: number[];
}

interface ChartData {
  labels: string[];
  series: Serie[];
}

function parseBool(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("booleano inválido");
}

export const GET: APIRoute = async ({ url, locals }) => {
  const denied = await requireReadAccess(locals, "usuarios");
  if (denied) return denied;

  const rolParam = url.searchParams.get("rol");
  const mesaParam = url.searchParams.get("mesa");
  let activo: boolean | undefined;
  try {
    activo = parseBool(url.searchParams.get("activo"));
  } catch {
    return jsonError(
      "El parámetro 'activo' debe ser 'true' o 'false'",
      400,
      "no-store",
    );
  }

  if (rolParam !== null) {
    const canonical = rolParam.toLowerCase().replace(/[-_\s]/g, "_");
    if (!isValidRole(canonical)) {
      return jsonError("El parámetro 'rol' no es un rol válido", 400, "no-store");
    }
  }

  if (mesaParam !== null) {
    if (!/^\d+$/.test(mesaParam)) {
      return jsonError(
        "El parámetro 'mesa' debe ser un entero positivo",
        400,
        "no-store",
      );
    }
    const mesaId = Number.parseInt(mesaParam, 10);
    if (mesaId <= 0) {
      return jsonError(
        "El parámetro 'mesa' debe ser un entero positivo",
        400,
        "no-store",
      );
    }
  }

  try {
    const conditions = [];
    if (rolParam !== null) {
      const rol = normalizeRole(rolParam);
      conditions.push(sql`lower(${users.role}) = ${rol}`);
    }
    if (mesaParam !== null) {
      conditions.push(eq(users.helpdeskId, Number.parseInt(mesaParam, 10)));
    }
    if (activo !== undefined) {
      conditions.push(eq(users.active, activo));
    }

    const rows = await db
      .select({
        role: users.role,
        active: users.active,
        mesaName: mesas.name,
        mesaActive: mesas.active,
        mesaAssignable: mesas.assignable,
        enAsistencia: agents.enAsistencia,
      })
      .from(users)
      .leftJoin(agents, eq(agents.userId, users.id))
      .leftJoin(mesas, eq(users.helpdeskId, mesas.invgateId))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = rows.length;
    const activos = rows.filter((r) => r.active).length;
    const enAsistencia = rows.filter((r) => r.enAsistencia).length;

    const countBy = (
      pick: (row: (typeof rows)[number]) => string | null,
    ): ChartData => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const key = pick(row);
        if (key === null) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return {
        labels: [...counts.keys()],
        series: [{ label: "Usuarios", data: [...counts.values()] }],
      };
    };

    const mesasDisponibles = await db
      .select({ id: mesas.invgateId, name: mesas.name })
      .from(mesas)
      .where(eq(mesas.active, true))
      .orderBy(mesas.name);

    const payload = {
      kpis: { total, activos, inactivos: total - activos, enAsistencia },
      charts: {
        estado: {
          labels: ["Activos", "Inactivos"],
          series: [{ label: "Usuarios", data: [activos, total - activos] }],
        },
        porRol: countBy((row) => normalizeRole(row.role)),
        porMesa: countBy((row) =>
          row.mesaActive &&
          (row.mesaAssignable || row.mesaName === MDA_TI_HELPDESK)
            ? row.mesaName
            : null,
        ),
      },
      filtros: {
        roles: [...CANONICAL_ROLES],
        mesas: mesasDisponibles,
      },
    };

    return jsonResponse(payload, 200, "no-store");
  } catch (error) {
    console.error("[API usuarios/estadisticas] Error:", error);
    return jsonError(sanitizeError(error), 500, "no-store");
  }
};
