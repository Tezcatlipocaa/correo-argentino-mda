import { db } from "@db/index";
import { employees } from "@db/schema";
import { isNull, or, eq, sql } from "drizzle-orm";

export async function getUnassignedEmployeesCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(employees)
    .where(or(isNull(employees.sucursal), eq(employees.sucursal, "")));
  return result[0]?.count ?? 0;
}

export async function getUnassignedEmployees() {
  return db
    .select({
      dni: employees.dni,
      username: employees.username,
      fullname: employees.fullname,
      interno: employees.interno,
      telefono: employees.telefono,
      sucursal: employees.sucursal,
      invgateExists: employees.invgateExists,
      position: employees.position,
      updatedAt: employees.updatedAt,
    })
    .from(employees)
    .where(or(isNull(employees.sucursal), eq(employees.sucursal, "")));
}
