# Especificación Técnica: Corrección de Discrepancia de Scores y Parámetros entre Modal y Card de Auditoría

## 1. Contexto y Descripción del Problema
Al visualizar una auditoría guardada en la card de detalle (`CalidadContent.astro`), se detecta:
- **Sección 1 (Interacción con el Usuario):** Aparece en `0%` (o puntaje severamente degradado).
- **Sección 2 (Gestión del Ticket):** Aparece con `100/100` y la lista de parámetros está totalmente vacía/en blanco.
- **Discrepancia al Editar:** Al hacer clic en el botón de edición ("Editar Auditoría"), el modal en vivo recalcula sobre los checkboxes actuales mostrando valores completamente distintos (ej: Sección 1: 93%, Sección 2: 100%, Total Final: 97%).

## 2. Diagnóstico de Causa Raíz
1. **Consulta de Parámetros Heredados en `saveAudit` (`src/actions/index.ts`):**
   - Cuando se edita una auditoría existente (`input.id`), la acción consultaba los IDs de parámetros presentes en `audit_scores` (`existingScores`).
   - Registros históricos arrastraban IDs de parámetros de versiones preliminares o esquemas anteriores (`cordialidad`, `solicitud`, etc.).
   - Al no existir esos códigos en el formulario actual (`input`), se computaban como `isChecked = false`.
   - Estas deducciones artificiales en Sección 1 superaban 45 puntos, provocando que `s1Raw` cayera a `0`.
   - Los nuevos parámetros de Sección 2 no estaban en `existingScores`, por lo que no deducían puntaje (quedando en 100) y no se insertaban en `audit_scores`.
2. **Filtrado de Parámetros en `renderCallCard` (`CalidadContent.astro`):**
   - La card renderizaba parámetros mediante `call.section2.details.hasOwnProperty(p.code)`. Si la auditoría no poseía registros para los códigos activos, `s2Params` resultaba vacío, dejando la sección en blanco.
3. **Inconsistencia de Datos Históricos en la Base de Datos:**
   - Auditorías preexistentes (como Audit 3 y 4) contienen scores desalineados y totales anómalos (ej: `totalScore: 55`, `s1: 0`, `s2: 100`).

## 3. Requerimientos Funcionales
1. **Unificación Canónica en `saveAudit`:**
   - Tanto para auditorías nuevas como para auditorías en edición (`input.id`), `allParams` debe obtenerse **exclusivamente** filtrando por los parámetros activos del canal:
     ```typescript
     and(
       eq(auditParameters.active, true),
       eq(auditParameters.channel, input.channelType)
     )
     ```
   - Eliminar la consulta de parámetros por IDs de scores viejos.
2. **Reemplazo Limpio de Scores:**
   - Al guardar la edición, `tx.delete(auditScores).where(eq(auditScores.auditId, input.id!))` ya se ejecuta; ahora insertará únicamente los parámetros canónicos actuales.
3. **Robustez en la Visualización de la Card (`CalidadContent.astro`):**
   - En `renderCallCard`, filtrar los parámetros canónicos del canal (`p.channel === call.channelType`).
   - Para la visualización de cada ítem, consultar el estado en `details` (si no existe, reportar el estado predeterminado o no evaluado de forma coherente).
4. **Script de Recálculo y Normalización de Auditorías (`scripts/recalculate-existing-audits.mts`):**
   - Script idempotente que inspecciona auditorías existentes en `quality_audits`.
   - Mapea scores históricos huérfanos a los parámetros canónicos correspondientes.
   - Recalcula `section1Score`, `section2Score` y `totalScore` usando `calculateMultiChannelAuditScores`.
   - Actualiza `quality_audits` y regenera `audit_scores` limpios.

## 4. Criterios de Aceptación
- Al guardar o editar una auditoría de llamada Wise con cumplimiento en ticket y una falta menor en atención, la card de detalle muestra exactamente los mismos valores porcentuales que el modal de auditoría (ej: 93% en S1, 100% en S2, 97% en Total).
- La lista de parámetros de Gestión del Ticket en la card no aparece en blanco y detalla cada uno de los 8 parámetros con su respectivo check/cruz.
- Todas las auditorías históricas en la base de datos quedan consistentes y sin discrepancias.
- Toda la suite de tests unitarios y Playwright E2E pasa satisfactoriamente.
