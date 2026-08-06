# Plan de Implementación: Vista e Indicador de Usuarios sin Ubicación Asignada

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un indicador en `DirectorioContent.astro` (visible solo para administradores cuando existen usuarios sin sucursal) que dirija a una nueva vista restringida `/admin/usuarios-sin-ubicacion` donde se pueda copiar el usuario para su asignación en InvGate.

**Architecture:** Se crea un módulo de consultas `employeeQueries.ts` para obtener conteo y listado de usuarios sin sucursal (`sucursal IS NULL` o `sucursal = ''`). Se actualiza `rbac.ts` para restringir la ruta. Se agrega el componente indicador en `DirectorioContent.astro`. Se crea la página administrativa de solo lectura con componente `CopyButton`.

**Tech Stack:** Astro SSR, TypeScript, Drizzle ORM, DaisyUI, astro-icon.

---

## File map

| Action | File | Purpose |
|---|---|---|
| Create | `src/lib/employeeQueries.ts` | Funciones para consultar conteo y lista de empleados sin ubicación |
| Modify | `src/lib/rbac.ts` | Registro de permiso para `/admin/usuarios-sin-ubicacion` |
| Create | `src/pages/admin/usuarios-sin-ubicacion.astro` | Vista administrativa de solo lectura para listar usuarios sin sucursal |
| Modify | `src/components/offices/DirectorioContent.astro` | Indicador dinámico visible únicamente si existen usuarios sin ubicación y el usuario es admin |

---

### Task 1: Módulo de Consultas `src/lib/employeeQueries.ts`

**Files:**
- Create: `src/lib/employeeQueries.ts`

- [ ] **Step 1: Crear archivo `src/lib/employeeQueries.ts`**

```typescript
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
  return await db
    .select({
      dni: employees.dni,
      username: employees.username,
      fullname: employees.fullname,
      position: employees.position,
      telefono: employees.telefono,
      interno: employees.interno,
      invgateExists: employees.invgateExists,
    })
    .from(employees)
    .where(or(isNull(employees.sucursal), eq(employees.sucursal, "")))
    .orderBy(employees.fullname);
}
```

- [ ] **Step 2: Verificar compilación TypeScript**

Run: `npx tsc --noEmit`
Expected output: Sin errores en `employeeQueries.ts`.

---

### Task 2: Configuración RBAC en `src/lib/rbac.ts`

**Files:**
- Modify: `src/lib/rbac.ts`

- [ ] **Step 1: Agregar la ruta en `routePermissions`**

En `src/lib/rbac.ts`, añadir la regla para la nueva vista dentro de `routePermissions`:

```typescript
  { path: "/admin/usuarios-sin-ubicacion", roles: ["admin"] },
```

---

### Task 3: Vista de Usuarios sin Ubicación `/admin/usuarios-sin-ubicacion.astro`

**Files:**
- Create: `src/pages/admin/usuarios-sin-ubicacion.astro`

- [ ] **Step 1: Crear el archivo de página `/admin/usuarios-sin-ubicacion.astro`**

```astro
---
import BaseLayout from "@layouts/BaseLayout.astro";
import PageContainer from "@components/ui/PageContainer.astro";
import PageHeader from "@components/ui/PageHeader.astro";
import CopyButton from "@components/ui/CopyButton.astro";
import DataTableHeaderCell from "@components/ui/DataTableHeaderCell.astro";
import { Icon } from "astro-icon/components";
import { isAllowed } from "@lib/rolesMatrix";
import { getUnassignedEmployees, getUnassignedEmployeesCount } from "@lib/employeeQueries";

const user = Astro.locals.user;
const isAllowedAdmin = user ? isAllowed("Administrar Contenido", user.role) : false;

// Control de acceso: Solo administradores
if (!isAllowedAdmin) {
  return Astro.redirect(`${import.meta.env.BASE_URL}oficinas`);
}

const unassignedCount = await getUnassignedEmployeesCount();

// Inaccesible si no existen usuarios sin ubicación
if (unassignedCount === 0) {
  return Astro.redirect(`${import.meta.env.BASE_URL}oficinas`);
}

const unassignedUsers = await getUnassignedEmployees();
---

<BaseLayout title="Usuarios sin Ubicación Asignada">
  <PageContainer>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <PageHeader
        title="Usuarios sin Ubicación Asignada"
        description="Listado de personal registrado que no posee sucursal asignada en el sistema."
      />
      <a href={`${import.meta.env.BASE_URL}oficinas`} class="btn btn-ghost btn-sm gap-2">
        <Icon name="boxicons:arrow-back" size={18} />
        Volver a Oficinas
      </a>
    </div>

    <div class="alert alert-warning shadow-sm mb-6">
      <Icon name="boxicons:info-circle" size={20} />
      <span class="text-sm font-medium">
        Se detectaron {unassignedCount} usuario{unassignedCount !== 1 ? "s" : ""} sin ubicación. Copia el usuario para asignarle la ubicación correspondiente en InvGate.
      </span>
    </div>

    <div class="overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-sm">
      <table class="table table-zebra w-full">
        <thead>
          <tr class="bg-base-200/50">
            <DataTableHeaderCell>Usuario (Username)</DataTableHeaderCell>
            <DataTableHeaderCell>Nombre completo</DataTableHeaderCell>
            <DataTableHeaderCell>DNI</DataTableHeaderCell>
            <DataTableHeaderCell>Cargo / Función</DataTableHeaderCell>
            <DataTableHeaderCell>Contacto</DataTableHeaderCell>
            <DataTableHeaderCell>Estado InvGate</DataTableHeaderCell>
          </tr>
        </thead>
        <tbody>
          {
            unassignedUsers.map((emp) => (
              <tr class="hover">
                <td>
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs font-semibold text-base-content">{emp.username}</span>
                    <CopyButton
                      value={emp.username}
                      variant="icon"
                      feedbackOnly={true}
                      copiedLabel="Usuario copiado"
                      size="xs"
                      appearance="ghost"
                    />
                  </div>
                </td>
                <td class="font-medium text-sm">{emp.fullname}</td>
                <td class="font-mono text-xs text-base-content/70">{emp.dni}</td>
                <td class="text-xs text-base-content/80">{emp.position || "—"}</td>
                <td class="text-xs text-base-content/70">
                  {emp.telefono || emp.interno ? (
                    <div class="space-y-0.5">
                      {emp.telefono && <div>Tel: <span class="font-mono">{emp.telefono}</span></div>}
                      {emp.interno && <div>Int: <span class="font-mono">{emp.interno}</span></div>}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {emp.invgateExists ? (
                    <span class="badge badge-success badge-sm">En InvGate</span>
                  ) : (
                    <span class="badge badge-ghost badge-sm text-base-content/50">No en InvGate</span>
                  )}
                </td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  </PageContainer>
</BaseLayout>
```

---

### Task 4: Indicador en `src/components/offices/DirectorioContent.astro`

**Files:**
- Modify: `src/components/offices/DirectorioContent.astro`

- [ ] **Step 1: Importar helper y consultar el conteo en el frontmatter**

En `DirectorioContent.astro`:
```typescript
import { getUnassignedEmployeesCount } from "@lib/employeeQueries";

const unassignedUsersCount = isAllowedAdmin ? await getUnassignedEmployeesCount() : 0;
```

- [ ] **Step 2: Renderizar el banner indicador si `unassignedUsersCount > 0`**

Justo después del indicador de sincronización InvGate existente en `DirectorioContent.astro`:

```astro
  {
    isAllowedAdmin && unassignedUsersCount > 0 && (
      <div class="alert alert-warning shadow-sm mt-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Icon name="boxicons:user-x" size={20} class="text-warning-content shrink-0" />
          <div>
            <p class="text-sm font-bold text-warning-content">
              {unassignedUsersCount} usuario{unassignedUsersCount !== 1 ? "s" : ""} sin ubicación asignada
            </p>
            <p class="text-xs text-warning-content/80">
              Hay personal sin sucursal configurada. Asigna su ubicación en InvGate para regularizarlos.
            </p>
          </div>
        </div>
        <a
          href={`${import.meta.env.BASE_URL}admin/usuarios-sin-ubicacion`}
          class="btn btn-sm btn-warning shrink-0 gap-1.5"
        >
          <Icon name="boxicons:show" size={16} />
          Ver usuarios
        </a>
      </div>
    )
  }
```

---

### Task 5: Verificación

- [ ] **Step 1: Verificar sin usuarios sin ubicación (0 usuarios)**
  - El indicador NO debe mostrarse en `/oficinas`.
  - Intentar acceder directamente a `/admin/usuarios-sin-ubicacion` debe redirigir a `/oficinas`.

- [ ] **Step 2: Verificar con usuarios sin ubicación (> 0 usuarios)**
  - El indicador debe figurar en `/oficinas` para administradores.
  - Al hacer clic en "Ver usuarios", navega a `/admin/usuarios-sin-ubicacion`.
  - Cada fila debe permitir copiar el username mediante `CopyButton`.
  - La vista es de solo lectura y no posee botones de edición.

- [ ] **Step 3: Verificar RBAC (usuarios no-admin)**
  - Un usuario no-admin no debe ver el indicador ni poder ingresar a la URL.
