# Implementation Plan: Métricas de Código (Líneas +/-) y Estimación de Horas en Changelog

## Phase 1: Servicio de Métricas de Git y Algoritmo de Horas (TDD)
- [ ] Task: Escribir tests de dominio para el cálculo de estadísticas de código y clustering de sesiones
  - [ ] Crear tests en `src/lib/changelog/changelogStats.test.ts`
  - [ ] Test de cálculo de numstat (adiciones y eliminaciones ignorando binarios)
  - [ ] Test de clustering de horas: commit aislado = 30m, commits cercanos (<= 2h) = acumulación de delta_t, commits lejanos (> 2h) = nueva sesión
  - [ ] Test de resiliencia ante hashes inexistentes o fallos de git
- [ ] Task: Implementar funciones de cálculo de estadísticas en `src/lib/changelog/changelogStats.ts`
  - [ ] Implementar `calculateCommitsStats(commits: string[]): ChangelogStats`
  - [ ] Integrar con `git show --numstat` y timestamps de git con manejo fail-safe de excepciones
- [ ] Task: Integrar `ChangelogStats` en `changelogService.ts`
  - [ ] Extender `ChangelogEntry` con propiedad `stats: ChangelogStats`
  - [ ] Invocar el cálculo durante el procesamiento de entradas y preservar en cache
- [ ] Task: Phase Verification & Checkpoint (`npm run test:domain`)

## Phase 2: Renderizado UI en `/changelog` y Pruebas E2E
- [ ] Task: Actualizar `src/pages/changelog.astro` con badges visuales
  - [ ] Agregar badges estilizados para `+{additions}`, `-{deletions}` y `~{formattedHours}` en la cabecera de cada release
  - [ ] Utilizar tokens de DaisyUI/Tailwind (`text-success bg-success/10`, `text-error bg-error/10`) e ícono de reloj
  - [ ] Formatear números con separador de miles
- [ ] Task: Actualizar o extender spec E2E en `tests/changelog/changelog.spec.ts`
  - [ ] Verificar que los badges de métricas se rendericen visiblemente en el DOM
- [ ] Task: Phase Verification & Checkpoint
  - [ ] `npm run changelog:validate`
  - [ ] `npm run test:domain`
  - [ ] `npx playwright test tests/changelog/changelog.spec.ts` con puerto propio
