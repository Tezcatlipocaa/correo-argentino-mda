# Technology Stack: Portal MDA

## Core Technologies
- **Runtime Environment:** Node.js (>= 22.12.0) with native ECMAScript Modules (ESM).
- **Primary Language:** TypeScript (v5.9.3) in strict mode.
- **Web Framework:** Astro v7 (v7.3.2) configured with Server-Side Rendering (`output: "server"`) and `@astrojs/node` standalone adapter.
- **Frontend Islands:** React 19 (`@astrojs/react`) reserved strictly for complex interactive components.
- **Styling & Design System:** Tailwind CSS v4 (`@tailwindcss/vite`) + DaisyUI v5 (`daisyui`). Zero custom hex colors; strictly DaisyUI semantic tokens.
- **Typography & Icons:** Geist Sans Variable & Geist Mono Variable via Fontsource; `astro-icon` with Boxicons (`@iconify-json/boxicons`).
- **Database & Persistence:** SQLite (`database/mda.db`) managed via `better-sqlite3` and Drizzle ORM (`drizzle-orm`, `drizzle-kit`).
- **Validation:** Zod (`zod`, `drizzle-zod`).

## Security & Architecture
- **Authentication:** HMAC-signed session cookies managed via `src/middleware.ts`.
- **Role-Based Access Control (RBAC):** Strict 5-tier hierarchy (`agent` < `referent` < `team_leader` < `supervisor` < `admin`) defined in `src/lib/rbac.ts` and `src/lib/helpdeskAccess.ts`.
- **CSRF & Rate Limiting:** Signed session token verification (`src/lib/csrf.ts`) and memory rate limiters for mutating routes.
- **Encryption:** AES-256-GCM (`ENCRYPTION_KEY`) for sensitive credentials and tokens.

## External Services & Integrations
- **Ticketing & Service Desk:** InvGate Service Management REST API (`INVGATE_BASE_URL`).
- **Contact Center & Telephony:** Wise CX REST API (`WISE_CX_BASE_URL`).
- **Corporate Directory:** Active Directory / LDAP authentication via `ldapjs`.
- **Geographic & Mapping:** Leaflet and `topojson-client` for postal office visualization.
- **Hardware Monitoring:** ICMP Ping via `ping` for cubic and terminal health verification.

## Testing & Quality Assurance
- **End-to-End Testing (Primary):** Playwright (`@playwright/test`) running serially (1 worker) against local Astro SSR (`http://localhost:4321`).
- **Unit Testing:** Vitest (`vitest`) for standalone business logic and migration helper verification.
- **Linting & Formatting:** Prettier with Astro and Tailwind plugins; TypeScript type checking via `astro check`.

## Deployment & Operations
- **Process Manager:** PM2 managing 5 background processes (`ecosystem.config.cjs`):
  1. `correo-argentino-mda` (Astro SSR application)
  2. `mda-ping-cubics`
  3. `sync-legacy-inventory`
  4. `sync-users`
  5. `sync-office-links`
- **Automation Scripts:** `scripts/auto-deploy.bat` (pull, pm2 kill, install, schema align, backfill, build verification, restart).
