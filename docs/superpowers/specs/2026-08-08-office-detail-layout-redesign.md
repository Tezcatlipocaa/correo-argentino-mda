# Office Detail Dropdown — Reorden Dinámico de Secciones (Design)

**Fecha:** 2026-08-08
**Rama:** `feat/office-same-building-siblings`
**Archivo afectado:** `src/components/offices/OfficeRow.astro`

## Objetivo

Reorganizar el desplegable de detalle de cada oficina en el directorio `/oficinas` para que las secciones se reordenen dinámicamente según la cantidad de registros de cada una. El layout pasa a 3 columnas (izquierda = info principal, centro = secundaria, derecha = Equipos compactos) sin que ninguna columna sea interminable.

## Layout objetivo

`flex flex-col lg:flex-row gap-6` con tres columnas condicionales:

```
┌──────────────────────┬───────────────┬──────────────────────┐
│  Información (si hay) │ Oficinas en   │ Equipos (grid)       │
│  Datos InvGate        │ mismo edificio│ ┌────────┬────────┐  │
│  Personal             │ + Contactos   │ │ card   │ card   │  │
│  Contactos (si ≤5)    │ (si >5)       │ └────────┴────────┘  │
└──────────────────────┴───────────────┴──────────────────────┘
```

### Anchos (flex, calculados en frontmatter según columnas presentes)

| Columnas presentes           | Proporciones              |
|------------------------------|---------------------------|
| Izquierda + Centro + Derecha | `1.75fr / 2fr / 2.25fr`   |
| Izquierda + Derecha          | `2fr / 3fr` (comportamiento actual) |
| Izquierda + Centro           | `3fr / 2fr`               |
| Centro + Derecha             | `2fr / 3fr`               |
| Solo una columna             | `full width`              |

En el layout de 3 columnas, la columna izquierda (Información, Datos InvGate, Referentes del sitio) recibe **menos espacio** (`flex-[1.75]`), la columna central (oficinas en el mismo edificio) recibe **más espacio** (`flex-[2]`) y la columna de equipos el mayor ancho (`flex-[2.25]`).

Implementación: un helper en frontmatter que devuelve las clases de cada columna (p.ej. `lg:flex-[2]`, `lg:flex-[1]`, `lg:flex-[3]`, `w-full`) según los flags de presencia.

### Presencia de columnas

- **Izquierda** se renderiza si: `hasInvgateDetail` O `hasInfo` O contactos que quedan en izquierda (`leftContacts`). El placeholder de **Personal** vive en la izquierda y solo se muestra cuando la izquierda se renderiza (si la oficina solo tiene siblings, la izquierda no se renderiza y Personal no se muestra — trade-off aceptado).
- **Centro** se renderiza si: `hasSiblings` O contactos movidos al centro (`contactsToCenter`).
- **Derecha** se renderiza si: `hasAssetsSection`.

## Reglas de reorden dinámico

- `const contactsCount = office.contacts.length;`
- `const contactsToCenter = contactsCount > 5;` — si Contactos supera 5 registros, la sección Contactos se mueve a la columna central. Con 5 o menos queda en izquierda (`>5`, no `>=5`).
- `const hasCenter = hasSiblings || contactsToCenter;`
- **Personal** siempre en izquierda (es lazy vía fetch, count desconocido al renderizar; no se mueve).
- **Información** (email/notes) se coloca **arriba de Datos InvGate** cuando la oficina tiene ese valor establecido. Orden en columna izquierda: `Información → Datos InvGate → Personal → Contactos (si ≤5)`.

## Rediseño de card de Equipos

El rediseño es **condicional**: aplica únicamente cuando existe la columna central (layout de 3 columnas, es decir `hasCenter === true`). Si solo hay 2 columnas (sin centro), se mantiene **el diseño actual** sin cambios.

### Layout de 3 columnas (`hasCenter === true`)

Cada equipo (terminal o activo manual) pasa de card horizontal a card vertical compacta:

```
┌──────────────────────────┐
│ [icono]  Terminal          │
│          S0000W101         │
│          [10.171.66.101]   │  ← IP copiable debajo del hostname
└──────────────────────────┘
```

- Icono se mantiene (arriba, mismo color/estilo actual por tipo).
- Línea 1: label de tipo (`text-xxs`, truncate) — `getTerminalTypeLabel` para terminales, `assetLabelByType` para activos.
- Línea 2: hostname (`font-mono text-xs font-semibold`, truncate).
- Línea 3: componente IP (`CopyButton`) — **debajo del hostname**, manteniendo dimensiones actuales (`size="xs"`, `appearance="surface"`, `monospace`).
- **Impresoras** (activos con `type === "printer"`): NO se muestra ni se reserva fila de hostname; el IP va directo debajo del label de tipo.
- Cards más angostas → grid de la derecha usa `grid-cols-1 xl:grid-cols-2`.

### Layout de 2 columnas o 1 (`hasCenter === false`)

Diseño **actual sin cambios**:
- Card horizontal: `[icono] | (label de tipo, hostname) | IP copiable a la derecha`.
- Grid `grid-cols-1 xl:grid-cols-2` cuando hay columna izquierda, `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3` a full width (patrón actual).

## Scroll / altura

- El listado de **Equipos** tiene un **`max-height` fijo de `480px`** (`lg:max-h-[480px]` sobre `.office-assets-scroll`, con `overflow-y-auto`) — **no depende de la altura del desplegable**. Independientemente de cuántos equipos tenga una oficina, el área scrollea internamente y el desplegable nunca es interminable.
- Se agregan **degradados** (`bg-gradient-to-t from-base-100 to-transparent` inferior y `bg-gradient-to-b` superior, tokens DaisyUI → tema-aware) en el área de equipos **siempre** (independiente del número de columnas: 1, 2 o 3): el inferior se oculta al llegar al final de la lista (o sin overflow) y el superior se muestra solo cuando no estamos en el top (mismo mecanismo, vía scroll listener con capture).
- La **barra de desplazamiento** del área de equipos se oculta (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) manteniendo el scroll.
- En el layout de **3 columnas**, los números de **IP** de las cards compactas se renderizan a **10px** (via `:global([data-copy-label])`) para que no desborden la columna.

## Edge cases

| Caso | Resultado |
|------|-----------|
| Oficina solo equipos (sin info/siblings/contactos) | 1 columna full width (equipos con grid 3-col) — comportamiento actual |
| Oficina solo siblings + nada más | Izquierda no se renderiza (no hay info principal); centro + derecha |
| `contactsCount === 5` | Contactos quedan en izquierda |
| Sin siblings Y contactos ≤5 | Centro no existe; 2 columnas izq+der con proporción 2/3 |
| Oficina con Información | Información va primero (arriba de InvGate) |
| Oficina con `hasSiblings` y contactos >5 | Centro muestra siblings + Contactos; izquierda sin Contactos |
| Oficina con centro (3 cols) | Equipos en cards verticales compactas (IP debajo) + max-height scroll |
| Oficina sin centro (2 cols) | Equipos con diseño actual (IP a la derecha, 2 cards/fila), sin scroll |

## Alcance (fuera de scope)

- NO se cambian datos ni consultas (`officeQueries.ts`, `officeSiblings.ts`, tipos).
- NO se toca el Personal lazy (sigue en izquierda, sin movimiento dinámico).
- NO se cambia el master row de la tabla (solo el panel de detalle).
- NO se agregan colores/temas nuevos — solo reorden de markup existente.

## Testeo

- Unit: `node --import tsx --test src/lib/officeSiblings.test.ts` (7 tests, sin cambios esperados).
- Build: `npm run build`.
- E2E existente: `tests/office-siblings.spec.ts` (2 tests — deben seguir pasando; el contrato `data-sibling-office` / `data-sibling-code` / `data-copy-control` se mantiene aunque la sección cambie de columna).
- Manual: expandir Santa Fe S0000 y verificar 3 columnas, Contactos en centro (si >5), equipos compactos con IP debajo, Información arriba de InvGate.
