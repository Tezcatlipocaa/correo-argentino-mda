# Product Definition: Portal MDA

## Overview
El **Portal de la Mesa de Ayuda (MDA)** es la plataforma web interna de soporte corporativo logístico y postal de **Correo Argentino**. Centraliza las herramientas y flujos de trabajo de la operación diaria para operadores de Nivel 1 (N1) y Nivel 2 (N2), coordinadores, referentes y supervisores, optimizando los tiempos de respuesta, minimizando errores de carga y garantizando la trazabilidad integral de los casos.

## Target Audience
- **Operadores N1 / N2 (`agent`):** Personal de primera y segunda línea responsable de la atención telefónica y digital, tipificación de incidencias, consultas de personal y monitoreo de terminales.
- **Referentes y Team Leaders (`referent`, `team_leader`):** Gestión operativa, revisión de casos, asignación de autogestiones y soporte avanzado.
- **Supervisores (`supervisor`):** Monitoreo del cronograma, métricas de calidad de atención, control de asistencia y estadísticas operativas.
- **Administradores (`admin`):** Gestión de usuarios, sincronización y configuración de mesas de ayuda, auditoría de seguridad y administración de la base de conocimiento.

## Core Capabilities
1. **Tipificación de Tickets y Gestión de Consultas:** Asistentes rápidos para categorización de incidentes, integración con InvGate Service Management y Wise CX.
2. **Buscador de Personal y Oficinas:** Localización rápida de empleados de Correo Argentino vía AD/LDAP, visualización de oficinas postales, mapas interactivos e información de contacto.
3. **Monitoreo y Reconciliación de Terminales:** Inventario y estado de terminales (incluyendo cubics), pruebas de conectividad y sincronización con sistemas legados.
4. **Gestión de Personal, Cronogramas y Asistencia:** Planificación de turnos, control horario, francos, horas extras y seguimiento de asistencia diaria con invariantes estrictas.
5. **Base de Conocimiento Centralizada (KB):** Repositorio estructurado de procedimientos, manuales, guías y soluciones con control de versiones, soporte Markdown y protección CSRF.
6. **Generador de Firmas Institucionales:** Herramienta estandarizada para la generación uniforme de firmas de correo electrónico según normativas de marca corporativa.
7. **Control de Acceso Basado en Roles (RBAC) y Auditoría:** Jerarquía de 5 roles (`agent` < `referent` < `team_leader` < `supervisor` < `admin`), visibilidad segmentada por mesa de ayuda y logging de auditoría en todas las mutaciones críticas.
8. **Evaluación de Calidad Multi-Canal:** Sistema integral de auditorías operativas para llamadas Wise CX, correos Wise CX e incidentes InvGate, con autocompletado de metadatos vía API, matrices de puntuación por deducción porcentual y seguimiento de cuota mensual por operador (12 evaluaciones/mes).
