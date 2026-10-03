# Plan: Promedios por Canal y Promedio Total en Calidad

## Phase 1: Lógica de Cálculo de Promedios y Pruebas Unitarias
- [ ] Task: Escribir pruebas unitarias para funciones de cálculo de promedios por canal y consolidado
  - [ ] Crear tests en `tests/unit/calidad-channel-averages.test.ts` que validen cálculo de promedio simple por canal, casos con 0 auditorías (retorno `--` o null), y promedio consolidado total de todas las muestras.
- [ ] Task: Implementar/extraer función utilitaria helper para el cálculo de promedios
  - [ ] Implementar la función de cálculo tipada (en helper o módulo exportable) para garantizar reutilización limpia y paso de pruebas en verde.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Interfaz Visual en Tabs y Resumen Consolidado
- [ ] Task: Modificar el marcado HTML de las pestañas en `CalidadContent.astro`
  - [ ] Añadir contenedores/badges para los promedios dentro de cada pestaña (`#tab-avg-wise_call`, `#tab-avg-wise_email`, `#tab-avg-invgate_ticket`).
  - [ ] Incorporar un indicador o pill estilizado destacado para el "Promedio General / Total" junto a la barra de tabs o cuota mensual.
- [ ] Task: Actualizar la función client-side `updateChannelTabsAndList`
  - [ ] Calcular promedios al vuelo para `wiseCalls`, `wiseEmails`, `invgateAgs` y el total acumulado `allAudits`.
  - [ ] Formatear con porcentaje o un decimal (ej: `87.5%`) y aplicar clases semánticas DaisyUI acordes (success, warning, error, ghost).
  - [ ] Manejar dinámicamente la reactividad ante nuevas auditorías, ediciones y eliminaciones.
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
