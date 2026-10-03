# Especificación: Bugfix & Mejoras — Calidad Multi-Canal

## Resumen

Corrección integral del módulo de evaluación de calidad multi-canal (Wise CX Llamadas, Wise CX Mails, InvGate Autogestiones) implementado en el track `calidad_multicanal_20261001`. La auditoría encontró **19 issues** que impiden el uso del feature en producción.

---

## Issues Críticos (5)

| # | Archivo | Líneas | Problema |
|---|---------|--------|----------|
| C1 | `fetch-metadata.ts` | 8-9 | `requireWriteAccess()` sin `await` — endpoint siempre devuelve Promise en vez de Response |
| C2 | `actions/index.ts` | 13, 257, 268 | `and` no importado de `drizzle-orm` — `ReferenceError` al guardar auditoría |
| C3 | `actions/index.ts` | 14, 318 | `calculateMultiChannelAuditScores` no importado — `ReferenceError` al guardar |
| C4 | `qualityCalculator.ts` | 10-59 | Scoring de `wise_call` incorrecto: secciones 45/55 promediadas como 100/100 → operador que falla todo obtiene 55% |
| C5 | `qualityMetadataFetcher.ts` | 206 | Endpoint InvGate incorrecto: `incidents/${id}` no existe, debe ser `incident?id=${id}` |

## Issues Altos (5)

| # | Archivo | Líneas | Problema |
|---|---------|--------|----------|
| A1 | `qualityMetadataFetcher.ts` | 101-103 | `created_at.split()` crashea con epoch numéricos de InvGate |
| A2 | `actions/index.ts` | 283-306 | `saveAudit` guarda scores de Sección 2 aunque no aplique → falsos incumplimientos |
| A3 | `actions/index.ts` | 18-174 | `saveParameters` no soporta `channel`/`section` |
| A4 | `CalidadContent.astro` | 2410-2704 | Modal de parámetros legacy, no soporta multi-canal |
| A5 | `AuditModal.astro` | 109 | `callId` con `required` bloquea submit en Autogestión |

## Issues Medios (7)

| # | Archivo | Problema |
|---|---------|----------|
| M1 | `AuditModal.astro` | Cambio de tab no resetea metadatos |
| M2 | `AuditModal.astro` | Autofill de llamada sobreescribe `ticketId` |
| M3 | `AuditModal.astro` | Score preview duplica bug matemático de C4 |
| M4 | `CalidadContent.astro` | Cálculo de cuota: `audits.length/12` en vez de `min(calls,4)+min(emails,4)+min(ags,4)` |
| M5 | `CalidadContent.astro` | AHT diluido por mails/tickets con duración 00:00 |
| M6 | `CalidadContent.astro` | Promedio Sección 2 incluye nota 0 cuando no aplica |
| M7 | `CalidadContent.astro` | Toggles MDA no resetean al abrir nueva auditoría |

## Issues Bajos (3)

| # | Archivo | Problema |
|---|---------|----------|
| B1 | `CalidadContent.astro` | CSV export sin columna canal ni metadatos nuevos |
| B2 | `AuditModal.astro` | Campo duración visible en mails/AG; Enter no busca |
| B3 | `types/quality.ts` | `weight` tipado como `number` pero es `number | null` |

---

## Criterios de Aceptación

1. El botón "Buscar en API" funciona para los 3 canales (llamada Wise, mail Wise, ticket InvGate)
2. Se puede guardar una auditoría completa para cada canal sin errores de runtime
3. El scoring de `wise_call` aplica ponderación 45/55 (no 50/50)
4. El score preview en el modal coincide con el score guardado
5. La cuota mensual refleja progreso real: `min(canal, 4)` por cada canal
6. Las estadísticas (AHT, promedios) solo consideran auditorías del canal correspondiente
7. El modal de configuración de parámetros permite gestionar los 3 canales
8. La exportación CSV incluye columna de canal y metadatos específicos

## Fuera de Alcance

- Cambios en la estructura de la base de datos (el schema actual es suficiente)
- Nuevos features no contemplados en la auditoría
- Tests unitarios (se validará con E2E manual según AGENTS.md)
