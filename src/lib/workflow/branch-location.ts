import { db } from "@db/index";
import { offices } from "@db/schema";
import { eq } from "drizzle-orm";

export interface BranchLocation {
  region: string | null;
  locality: string | null;
  county: string | null;
}

/**
 * Ubicación de una sucursal por código de oficina (p.ej. "B0174").
 *
 * Los formularios de producción no traen la jerarquía de ubicaciones
 * ("Metro » BA » Merlo » SITIO"), así que región/localidad salen de la DB
 * de oficinas. SQLite local: sin cache, la consulta es despreciable.
 */
export async function getBranchLocation(
  branchCode: string | null,
): Promise<BranchLocation | null> {
  if (!branchCode) {
    return null;
  }

  try {
    const [office] = await db
      .select({
        regionId: offices.regionId,
        locality: offices.locality,
        county: offices.county,
      })
      .from(offices)
      .where(eq(offices.code, branchCode))
      .limit(1);

    if (!office) {
      return null;
    }

    return {
      region: office.regionId ?? null,
      locality: office.locality ?? null,
      county: office.county ?? null,
    };
  } catch {
    return null;
  }
}
