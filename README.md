# Correo Argentino — Portal de la Mesa de Ayuda (MDA)

> Plataforma web unificada para la operación técnica diaria, estandarización de procesos y gestión operativa de la Mesa de Ayuda corporativa de Correo Argentino.

![Astro](https://img.shields.io/badge/Astro_SSR-BC52EE?style=for-the-badge&logo=astro&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite_WAL-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![DaisyUI](https://img.shields.io/badge/DaisyUI_v5-FF9903?style=for-the-badge&logo=daisyui&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PM2](https://img.shields.io/badge/PM2-2B037A?style=for-the-badge&logo=pm2&logoColor=white)

---

## Propósito y Valor Operativo

El **Portal MDA** es el centro de comando diario diseñado para los equipos de soporte técnico N1 y N2 de Correo Argentino. Su objetivo es reducir drásticamente los tiempos de respuesta, minimizar errores humanos en la carga de datos y garantizar la trazabilidad de cada gestión operativa.

La solución unifica herramientas críticas que previamente requerían múltiples sistemas dispersos:
- **Agilidad en la atención:** Tipificación estandarizada de tickets y consulta unificada de contactos, guías de derivación y personal.
- **Control y planificación operativa:** Monitoreo en tiempo real de cobertura horaria, control de asistencia y distribución balanceada de carga de trabajo.
- **Centralización del conocimiento:** Base de documentación técnica validada con ciclo de vida editorial y gestión segmentada por mesa de ayuda.
- **Automatización y gobierno:** Ejecución de flujos operativos guiados, inventario en vivo de terminales y resguardo seguro ante eliminaciones accidentales.

---

## Módulos y Funcionalidades Clave

### 1. Supervisión & Gestión Operativa
Panel de control para supervisores, líderes de equipo y referentes que centraliza:
- **Cronograma de turnos:** Distribución horaria y esquemas de trabajo de los operadores.
- **Control de asistencia:** Seguimiento de presencia y cumplimiento operativo diario.
- **Calidad de operadores:** Métricas de rendimiento y trazabilidad del servicio.
- **Asignación de autogestiones:** Reparto equitativo y balanceo de tareas recurrentes.

![Supervisión](docs/screenshots/supervision.png)

---

### 2. Base de Conocimiento (KB)
Repositorio institucional de procedimientos técnicos, soluciones homologadas y manuales de soporte:
- **Ciclo editorial robusto:** Flujo estructurado de estados (`Borrador` → `Publicado` → `Archivado`).
- **Segmentación por mesa:** Visualización y categorización contextualizada según el equipo de atención.
- **Contenido enriquecido:** Renderizado seguro de Markdown con sanitización e inserción controlada de imágenes institucionales.

---

### 3. Automatizaciones & Flujos de Trabajo
Módulo diseñado para orquestar y ejecutar tareas operativas recurrentes:
- **Estandarización de procesos:** Pasos guiados para gestiones de soporte complejas que eliminan desvíos operativos.
- **Trazabilidad:** Registro y reconciliación periódica de estados para garantizar el éxito de cada ejecución.

---

### 4. Atención & Tipificación Inmediata
Herramientas pensadas para acelerar el trabajo en línea durante la llamada o gestión de ticket:
- **Títulos de tickets:** Catálogo de tipificaciones predefinidas con copia instantánea al portapapeles en un clic.
- **Guía de soportes:** Matriz interactiva de derivaciones con responsables, horarios y canales según el área.
- **Directorio de contactos:** Teléfonos internos, líneas directas y casillas corporativas esenciales.

| Títulos de tickets | Guía de soportes | Contactos de soporte |
| :---: | :---: | :---: |
| ![Títulos de tickets](docs/screenshots/titulos-tickets.png) | ![Guía de soportes](docs/screenshots/guia-soportes.png) | ![Contactos](docs/screenshots/contactos.png) |

---

### 5. Herramientas de Identidad & Búsqueda
- **Buscador de usuarios:** Consulta ágil del directorio corporativo para verificar nombres, legajos, cuentas de red y datos de contacto de empleados.
- **Generador de firmas:** Creador interactivo de firmas de correo electrónico para Outlook alineado a los estándares de marca institucional de Correo Argentino.

| Buscador de usuarios | Generador de firmas institucionales |
| :---: | :---: |
| ![Buscador de usuarios](docs/screenshots/buscador-usuarios.png) | ![Generador de firmas](docs/screenshots/generador-firmas.png) |

---

### 6. Infraestructura & Parque Informático
- **Inventario de terminales:** Monitoreo técnico de equipos cliente (hostnames, direcciones IP, características de hardware y sistema operativo) complementado con diagnóstico de conectividad en segundo plano.
- **Directorio de oficinas:** Catálogo nacional de sucursales, centros de distribución y cabeceras logísticas en todo el país.
- **Catálogo de aplicativos y enlaces:** Repositorio homologado de instaladores oficiales para descarga segura y accesos directos a utilidades operativas externas.

| Inventario de terminales | Directorio de oficinas | Catálogo de aplicativos |
| :---: | :---: | :---: |
| ![Inventario de equipos](docs/screenshots/inventario-equipos.png) | ![Directorio de oficinas](docs/screenshots/directorio-oficinas.png) | ![Catálogo de Aplicativos](docs/screenshots/catalogo-aplicativos.png) |

---

### 7. Administración, Gobierno & Seguridad
Consola centralizada para la administración integral de datos maestros, accesos y seguridad:
- **Gestión de usuarios y RBAC:** Modelo de permisos en 5 niveles jerárquicos (`agent`, `referent`, `team_leader`, `supervisor`, `admin`) con sincronización de perfiles.
- **Gestión de Mesas de Ayuda:** Configuración de mesas habilitadas y asignación de visibilidad de herramientas.
- **Papelera de borrado recuperable:** Mecanismo de soft-delete con snapshot atómico que permite restaurar registros ante eliminaciones accidentales sin pérdida de integridad referencial.
- **Auditoría completa:** Registro inmutable de acciones administrativas y cambios de estado críticos.

![Panel de administración](docs/screenshots/admin.png)

---

## Arquitectura y Stack Tecnológico

La plataforma prioriza tiempos de carga mínimos, alta densidad de información y robustez operativa:

- **Frontend & Presentación:**
  - **Astro v7 (SSR):** Renderizado en servidor con islas interactivas en React donde se requiere estado reactivo complejo.
  - **Tailwind CSS v4 & DaisyUI v5:** Sistema de diseño institucional basado en tokens semánticos, modo claro/oscuro y tipografías corporativas optimizadas (`Geist` y `Geist Mono`).
- **Servidor & Backend:**
  - **Node.js (>=22.12.0) + Express (`server.mjs`):** Arquitectura SSR con compresión HTTP, manejo optimizado de assets estáticos y proxy reverso Apache.
  - **SQLite (`better-sqlite3` con modo WAL):** Base de datos relacional local de altísimo rendimiento y baja latencia.
  - **Drizzle ORM:** Definición estricta de esquemas y tipado de extremo a extremo con Drizzle Zod.
- **Calidad & Pruebas:**
  - **Playwright:** Suite de pruebas End-to-End (E2E) serializadas que validan flujos reales de navegación, permisos y operaciones críticas.

---

## Orquestación de Procesos (PM2)

En entornos productivos, la plataforma opera de forma autónoma mediante servicios continuos y tareas programadas orquestadas con **PM2** (`ecosystem.config.cjs`):

1. **`correo-argentino-mda`:** Servidor principal Astro SSR bajo Node.js.
2. **`mda-ping-cubics`:** Daemon continuo de monitoreo y diagnóstico de conectividad sobre el parque de terminales.
3. **`sync-legacy-inventory`:** Sincronización programada diaria con la base de datos de inventario histórico.
4. **`sync-users`:** Tarea periódica de reconciliación de usuarios corporativos.
5. **`sync-office-links`:** Actualización programada de enlaces y conectividad con oficinas.
6. **`purge-deleted-records`:** Limpieza programada de registros obsoletos de la papelera según política de retención (90 días).
7. **`reconcile-automation-parents`:** Conciliación y verificación de coherencia en flujos automatizados.

---

## Estructura del Repositorio

```
correo-argentino-mda/
├── database/                # Base de datos física local SQLite (mda.db)
├── docs/                    # Documentación de diseño, contexto, reglas y capturas
│   └── screenshots/         # Capturas de pantalla de los módulos
├── drizzle/                 # Migraciones e historial de esquemas de base de datos
├── public/                  # Recursos estáticos servidos directamente (logos, aplicativos)
├── scripts/                 # Daemons en segundo plano, tareas cron y utilidades operativas
├── src/
│   ├── components/          # Componentes Astro y React organizados por funcionalidad
│   ├── db/                  # Esquema Drizzle, tipos y conexión a base de datos
│   ├── layouts/             # Contenedores estructurales (BaseLayout)
│   ├── lib/                 # Lógica de negocio, RBAC, auditoría y utilidades auxiliares
│   ├── middleware.ts        # Manejo de sesiones, cookies firmadas y autorización por rol
│   └── pages/               # Rutas y endpoints del portal (vistas operativas y API)
└── tests/                   # Pruebas integrales E2E con Playwright
```

---

## Comandos Esenciales

```bash
# Instalación de dependencias
npm install

# Iniciar servidor de desarrollo (puerto 4321)
npm run dev

# Compilar para producción (SSR)
npm run build

# Alinear base de datos SQLite con el esquema Drizzle
npx tsx scripts/align-db-to-schema.mts

# Ejecutar suite de pruebas E2E
npx playwright test
```
