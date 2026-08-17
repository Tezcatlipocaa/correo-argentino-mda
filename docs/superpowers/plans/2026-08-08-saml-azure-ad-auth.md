# SAML Azure AD Authentication - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SAML 2.0 authentication via Azure AD enterprise application using passport-saml. Azure AD handles identity verification ONLY (who are you?). Roles and permissions stay managed locally in SQLite via existing admin panel. Auto-provision users on first login with default role.

**Architecture:** Use SAML class from passport-saml (no Passport.js middleware). New `/auth/saml/login` (GET) initiates AuthnRequest, `/auth/saml/callback` (POST) is ACS endpoint. Existing session/cookie system stays. Login page adds Azure AD button. Users auto-provisioned on first login with `guest` role (minimal privileges, same as unauthenticated). Role escalation managed via existing `/admin/usuarios` panel — no Azure group claims required.

**Tech Stack:** passport-saml, existing Astro SSR + Drizzle ORM + SQLite

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install passport-saml**

```bash
npm install passport-saml
```

- [ ] **Step 2: Install type definitions**

```bash
npm install -D @types/passport-saml
```

- [ ] **Step 3: Verify install**

Run: `npm ls passport-saml`
Expected: package listed with version

---

### Task 2: Add SAML environment variables

**Files:**
- Modify: `src/env.d.ts`
- Create: `.env` (add new vars, values from Azure AD)

- [ ] **Step 1: Add SAML env vars to env.d.ts**

In `src/env.d.ts`, add to `ImportMetaEnv` interface:

```typescript
  readonly SAML_ENTRY_POINT: string;
  readonly SAML_ISSUER: string;
  readonly SAML_CALLBACK_URL: string;
  readonly SAML_IDP_CERT: string;
  readonly SAML_PRIVATE_KEY?: string;
  readonly SAML_WANT_ASSERTIONS_SIGNED?: string;
```

- [ ] **Step 2: Add sample values to .env**

Add to `.env` (values provided by Azure AD Enterprise App setup):

```env
SAML_ENTRY_POINT=https://login.microsoftonline.com/{tenant-id}/saml2
SAML_ISSUER=http://mda.correo.local/saml/metadata
SAML_CALLBACK_URL=https://mda.correo.local/auth/saml/callback
SAML_IDP_CERT=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
# SAML_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
# SAML_WANT_ASSERTIONS_SIGNED=true
```

**CRITICAL:** Azure AD requires HTTPS for the ACS Reply URL. The only exception is `localhost`. The portal MUST be reachable at `https://mda.correo.local/auth/saml/callback`. See Task 3 (HTTPS/TLS infrastructure) — it is a hard prerequisite, not optional.

The `SAML_ISSUER` (SP Entity ID) does NOT need to be a real URL — it just needs to match what's configured in the Azure AD Enterprise App "Identifier (Entity ID)" field. Using `http://mda.correo.local/saml/metadata` is valid as it's just an identifier string.

- [ ] **Step 3: Commit**

```bash
git add src/env.d.ts
git commit -m "feat: add SAML environment variables to type definitions"
```

---

### Task 3: Configure HTTPS/TLS on internal server (prerequisite)

**Files:**
- None (infrastructure task — no code changes)

**Goal:** Make the portal reachable at `https://mda.correo.local` so Azure AD accepts the ACS Reply URL. For a `.local` internal domain, public CAs (Let's Encrypt) cannot issue certificates. This must go through the organization's internal CA.

- [ ] **Step 1: Emit certificate via internal CA**

For `.local` domains, request an SSL/TLS certificate from the infrastructure/identity team via the internal Certificate Authority (Active Directory Certificate Services — AD CS). Deliverables: public key certificate (`.crt`/`.cer`) and private key (`.key`).

- [ ] **Step 2: Configure server or reverse proxy**

Integrate the certificate into one of:
- **Reverse proxy (recommended):** Nginx, Caddy, or IIS in front of the Astro app, terminating TLS on port 443 and forwarding to the Astro process (port 4321). Caddy auto-manages internal certs if the internal CA chain is trusted.
- **Direct:** Configure TLS on the Node/Astro server itself (via a proxy layer like `http-proxy` or a process manager wrapper).

Example Nginx config:

```nginx
server {
    listen 443 ssl;
    server_name mda.correo.local;

    ssl_certificate     /etc/ssl/mda.correo.local.crt;
    ssl_certificate_key /etc/ssl/mda.correo.local.key;

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

server {
    listen 80;
    server_name mda.correo.local;
    return 301 https://$host$request_uri;
}
```

- [ ] **Step 3: Update endpoints in Azure AD**

Once TLS is operational, register in the Azure AD Enterprise App:
- Identifier (Entity ID): `http://mda.correo.local/saml/metadata`
- Reply URL (ACS): `https://mda.correo.local/auth/saml/callback`
- Sign-on URL: `https://mda.correo.local/login`

Verify the ACS endpoint is reachable: `curl -k https://mda.correo.local/auth/saml/callback` should not return a connection error (a 404/405 from the app is expected before the POST handler is wired; the TLS handshake must succeed).

- [ ] **Step 4: Record completion**

No commit needed (infra task). Confirm HTTPS is live before proceeding to Task 4+ and before configuring SAML in Azure AD.

---

### Task 4: Create SAML library module

**Files:**
- Create: `src/lib/saml.ts`

This module contains:
1. Profile claim extraction from SAML Response
2. User lookup/creation with default role on first login

- [ ] **Step 1: Read existing session.ts for reference on patterns**

- [ ] **Step 2: Create src/lib/saml.ts**

Azure AD handles authentication only. Roles are managed locally via `/admin/usuarios`.

```typescript
import { db } from "@db/index";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const DEFAULT_ROLE = "guest";

export interface SamlProfile {
  nameID: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
}

export function extractProfile(profile: any): SamlProfile | null {
  const email =
    profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ||
    profile.emailaddress ||
    profile.mail ||
    profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/email"] ||
    "";

  const displayName =
    profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ||
    profile.name ||
    profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/displayname"] ||
    "";

  const firstName =
    profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"] ||
    profile.givenname ||
    "";

  const lastName =
    profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"] ||
    profile.surname ||
    "";

  const nameID = profile.nameID || "";

  if (!nameID || !email) {
    return null;
  }

  return { nameID, email, displayName, firstName, lastName };
}

export async function findOrCreateUser(profile: SamlProfile): Promise<{
  id: number;
  username: string;
  role: string;
}> {
  const bySaml = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users)
    .where(eq(users.samlNameId, profile.nameID));

  if (bySaml.length > 0) {
    return bySaml[0];
  }

  const byEmail = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users)
    .where(eq(users.username, profile.email));

  if (byEmail.length > 0) {
    await db.update(users).set({ samlNameId: profile.nameID }).where(eq(users.id, byEmail[0].id));
    return byEmail[0];
  }

  const randomPassword = crypto.randomBytes(32).toString("hex");

  const result = await db
    .insert(users)
    .values({
      username: profile.email,
      password: randomPassword,
      role: DEFAULT_ROLE,
      samlNameId: profile.nameID,
    })
    .returning({ id: users.id, username: users.username, role: users.role });

  return result[0];
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/saml.ts
git commit -m "feat: add SAML library module with profile extraction and user provisioning"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/saml.ts
git commit -m "feat: add SAML library module with group mapping, profile extraction, and user provisioning"
```

---

### Task 5: Add "guest" role to RBAC system

**Files:**
- Modify: `src/lib/rbac.ts`

The `guest` role is the default for auto-provisioned SAML users. It has minimal permissions — same access level as an unauthenticated visitor. Admins promote users via `/admin/usuarios`.

- [ ] **Step 1: Add "guest" to Role type and hierarchy**

In `src/lib/rbac.ts`, modify:

```typescript
export type Role = "admin" | "supervisor" | "team_leader" | "referent" | "agent" | "guest";

export const ROLE_HIERARCHY: Record<Role, number> = {
  guest: 0,
  agent: 1,
  referent: 2,
  team_leader: 3,
  supervisor: 4,
  admin: 5,
};
```

- [ ] **Step 2: Add "guest" to normalizeRole**

In `normalizeRole`, add guest handling:

```typescript
export function normalizeRole(role: string): Role {
  const clean = role.toLowerCase().replace(/[-_]/g, " ").trim();
  if (clean === "admin") return "admin";
  if (clean === "supervisor") return "supervisor";
  if (clean === "team leader" || clean === "team_leader" || clean === "team-leader") return "team_leader";
  if (clean === "referent" || clean === "referente") return "referent";
  if (clean === "agent" || clean === "agente") return "agent";
  if (clean === "guest" || clean === "invitado") return "guest";
  return "agent";
}
```

**Important:** Keep `"agent"` as fallback in `normalizeRole()` so existing users without explicit role still resolve to `agent`. The `guest` role is only assigned explicitly via SAML auto-provision.

- [ ] **Step 3: Run db:push (no schema change, but verify roles)**

```bash
npm run db:push
```

Role type changes are TypeScript-only. The DB column `role` is TEXT, so "guest" is valid.

- [ ] **Step 4: Commit**

```bash
git add src/lib/rbac.ts
git commit -m "feat: add guest role to RBAC hierarchy (rank 0, minimal permissions)"
```

---

### Task 6: Add samlNameId column to users table

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add samlNameId column to users table**

In `src/db/schema.ts`, modify the `users` table to add:

```typescript
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("agent"),
  samlNameId: text("samlNameId").unique(),
});
```

- [ ] **Step 2: Run db:push to apply schema change**

```bash
npm run db:push
```

Expected: Schema updated, `samlNameId` column added to `users` table.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add samlNameId column to users table for SAML identity mapping"
```

---

### Task 7: Create SAML login route (GET /auth/saml/login)

**Files:**
- Create: `src/pages/auth/saml/login.ts`

- [ ] **Step 1: Create src/pages/auth/saml/login.ts**

Use `SAML` class from passport-saml directly (no Passport middleware needed):

```typescript
import type { APIRoute } from "astro";
import { SAML } from "passport-saml";
import { getCleanBase } from "@lib/baseUrl";

export const GET: APIRoute = async ({ redirect }) => {
  const entryPoint = import.meta.env.SAML_ENTRY_POINT;
  const issuer = import.meta.env.SAML_ISSUER;
  const callbackUrl = import.meta.env.SAML_CALLBACK_URL;
  const idpCert = import.meta.env.SAML_IDP_CERT;
  const privateKey = import.meta.env.SAML_PRIVATE_KEY || undefined;

  if (!entryPoint || !issuer || !callbackUrl || !idpCert) {
    return redirect(
      `${getCleanBase()}login?toast_msg=${encodeURIComponent("SAML no configurado")}&toast_type=error`
    );
  }

  const saml = new SAML({
    entryPoint,
    issuer,
    callbackUrl,
    cert: idpCert,
    privateKey,
    signatureAlgorithm: "sha256",
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  });

  return new Promise<Response>((resolve) => {
    saml.getAuthorizeUrl(
      "/",
      { additionalParams: {} },
      (err: Error | null, url: string | null) => {
        if (err || !url) {
          const params = new URLSearchParams({
            toast_msg: "Error al iniciar autenticación SAML",
            toast_type: "error",
          });
          resolve(redirect(`${getCleanBase()}login?${params.toString()}`));
          return;
        }
        resolve(new Response(null, { status: 302, headers: { Location: url } }));
      }
    );
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/auth/saml/login.ts
git commit -m "feat: add SAML login initiation endpoint"
```

---

### Task 8: Create SAML callback route (POST /auth/saml/callback)

**Files:**
- Create: `src/pages/auth/saml/callback.ts`

- [ ] **Step 1: Create src/pages/auth/saml/callback.ts**

Use `SAML` class directly for validation:

```typescript
import type { APIRoute } from "astro";
import { SAML } from "passport-saml";
import { extractProfile, findOrCreateUser } from "@lib/saml";
import { generateSessionId, signSessionId, setSessionCookie } from "@lib/session";
import { db } from "@db/index";
import { sessions } from "@db/schema";
import { getCleanBase } from "@lib/baseUrl";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const entryPoint = import.meta.env.SAML_ENTRY_POINT;
  const issuer = import.meta.env.SAML_ISSUER;
  const callbackUrl = import.meta.env.SAML_CALLBACK_URL;
  const idpCert = import.meta.env.SAML_IDP_CERT;
  const privateKey = import.meta.env.SAML_PRIVATE_KEY || undefined;
  const wantAssertionsSigned = import.meta.env.SAML_WANT_ASSERTIONS_SIGNED !== "false";

  if (!entryPoint || !issuer || !callbackUrl || !idpCert) {
    return redirect(
      `${getCleanBase()}login?toast_msg=${encodeURIComponent("SAML no configurado")}&toast_type=error`
    );
  }

  const body = await request.text();
  const formParams = new URLSearchParams(body);

  const samlResponse = formParams.get("SAMLResponse");
  const relayState = formParams.get("RelayState") || "/";

  if (!samlResponse) {
    return redirect(
      `${getCleanBase()}login?toast_msg=${encodeURIComponent("Respuesta SAML inválida")}&toast_type=error`
    );
  }

  return new Promise<Response>((resolve) => {
    const saml = new SAML({
      entryPoint,
      issuer,
      callbackUrl,
      cert: idpCert,
      privateKey,
      signatureAlgorithm: "sha256",
      identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      wantAssertionsSigned,
      validateInResponseTo: false,
      acceptedClockSkewMs: 600000,
    });

    saml.validatePostResponse(
      { SAMLResponse: samlResponse },
      async (err: Error | null, profile: any) => {
        if (err) {
          console.error("[SAML] Validation error:", err.message || err);
          const params = new URLSearchParams({
            toast_msg: "Error de validación SAML",
            toast_type: "error",
          });
          resolve(redirect(`${getCleanBase()}login?${params.toString()}`));
          return;
        }

        if (!profile) {
          const params = new URLSearchParams({
            toast_msg: "Perfil SAML vacío",
            toast_type: "error",
          });
          resolve(redirect(`${getCleanBase()}login?${params.toString()}`));
          return;
        }

        const extracted = extractProfile(profile);
        if (!extracted) {
          const params = new URLSearchParams({
            toast_msg: "Perfil SAML incompleto (falta email o identificador)",
            toast_type: "error",
          });
          resolve(redirect(`${getCleanBase()}login?${params.toString()}`));
          return;
        }

        try {
          const user = await findOrCreateUser(extracted);

          const sessionId = generateSessionId();
          const expiresAtMs = Date.now() + 1000 * 60 * 60 * 24 * 7;
          const expiresAtDate = new Date(expiresAtMs);

          await db.insert(sessions).values({
            id: sessionId,
            userId: user.id,
            expiresAt: expiresAtMs,
          });

          const signedId = signSessionId(sessionId);
          setSessionCookie(cookies, signedId, expiresAtDate);

          const redirectUrl = relayState && relayState !== "/"
            ? `${getCleanBase()}${relayState.replace(/^\//, "")}`
            : getCleanBase();

          resolve(redirect(redirectUrl));
        } catch (err) {
          console.error("[SAML] Session creation error:", err);
          const params = new URLSearchParams({
            toast_msg: "Error al crear sesión de usuario",
            toast_type: "error",
          });
          resolve(redirect(`${getCleanBase()}login?${params.toString()}`));
        }
      }
    );
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/auth/saml/callback.ts
git commit -m "feat: add SAML assertion consumer service endpoint"
```

---

### Task 9: Verify TypeScript compilation

**Files:**
- None (verification only)

- [ ] **Step 1: Check TypeScript for errors**

```bash
npx tsc --noEmit
```

Expected: No errors. If `@types/passport-saml` doesn't include SAML class types, add `declare module "passport-saml"` to `src/env.d.ts` if needed.

- [ ] **Step 2: Commit**

No code changes needed if compilation succeeds.

---

### Task 10: Update login page with Azure AD button

**Files:**
- Modify: `src/pages/login/index.astro`

- [ ] **Step 1: Edit src/pages/login/index.astro to add SAML login button**

Modify the login form area. After the existing form, before closing `</div>`, add:

```astro
          <div class="divider my-4 text-xs text-base-content/40">o</div>

          <a href="/auth/saml/login" class="btn btn-outline btn-neutral w-full">
            <Icon name="boxicons:windows" size={20} aria-hidden="true" />
            Iniciar sesión con Azure AD
          </a>
```

- [ ] **Step 2: Verify icon "boxicons:windows" exists**

The project uses `@iconify-json/boxicons`. `boxicons:windows` is the old Windows logo. For Azure, `boxicons:windows` works as visual cue. Alternative: use a text-based approach.

If icon not found, use `boxicons:microsoft` or change to text-only.

- [ ] **Step 3: Commit**

```bash
git add src/pages/login/index.astro
git commit -m "feat: add Azure AD SAML login button to login page"
```

---

### Task 11: Mark SAML callback route as non-protected in middleware

**Files:**
- Modify: `src/middleware.ts`

The `/auth/saml/callback` POST route receives unauthenticated POST from Azure AD. It must not be blocked by the middleware's API protection or auth redirect.

- [ ] **Step 1: Add exclusion for SAML callback in middleware.ts**

In `src/middleware.ts`, after line ~115 (`const relativePath = getRelativePath(path);`), add:

```typescript
  if (relativePath === "/auth/saml/callback" || relativePath === "/auth/saml/login") {
    return next();
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: exclude SAML routes from middleware auth checks"
```

---

### Task 12: Update design doc for final config

**Files:**
- Modify: `docs/superpowers/specs/2026-08-08-saml-azure-ad-auth-design.md`

- [ ] **Step 1: Update design doc with Azure AD specific configuration**

Add attribute mapping table and clarify auth-only approach:

```markdown
### SAML Attribute Claims (Azure AD)
Azure AD attribute statements mapped in enterprise app:
| SAML Attribute | Azure AD Source | `profile` key |
|---------------|-----------------|---------------|
| givenname | `user.givenname` | `profile.givenname` |
| surname | `user.surname` | `profile.surname` |
| emailaddress | `user.mail` | `profile.emailaddress` / `profile.mail` |
| name | `user.userprincipalname` | `profile.name` |
| Unique User Identifier | `user.userprincipalname` | `profile.nameID` |

### Auth Model
Azure AD handles **authentication only** (identity verification). Roles managed locally:
- Default role on first login: `agent`
- Role changes via `/admin/usuarios` panel
- No Azure AD group claims needed

### Environment URLs (Intranet)
| Variable | Value |
|----------|-------|
| `SAML_ISSUER` (Entity ID) | `http://mda.correo.local/saml/metadata` |
| `SAML_CALLBACK_URL` (ACS) | `https://mda.correo.local/auth/saml/callback` |

**HTTPS mandatory for ACS:** Azure AD rejects non-HTTPS Reply URLs.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-08-saml-azure-ad-auth-design.md
git commit -m "docs: update SAML design with Azure AD specific attribute mapping"
```

---

### Task 13: Build and verify

- [ ] **Step 1: Build project**

```bash
npm run build
```

Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 2: Start dev server and test login page**

```bash
npm run dev
```

Navigate to `http://localhost:4321/login` and verify:
- Azure AD button is visible
- Clicking it redirects to Azure AD (or shows error if SAML not configured locally)

- [ ] **Step 3: Run existing tests**

```bash
npx playwright test
```

Expected: Existing tests pass (they use local username/password auth which is unchanged).

---

### Rollout Notes

1. **HTTPS/TLS en servidor interno:** Azure AD rechaza Reply URLs con `http://` (excepto `localhost`). El servidor `mda.correo.local` DEBE tener certificado SSL/TLS configurado para que el ACS responda en `https://mda.correo.local/auth/saml/callback`.

2. **Azure AD Enterprise App Setup:** Administrator debe crear enterprise app en Azure AD, configurar:
   - Identifier (Entity ID): `http://mda.correo.local/saml/metadata` (o valor que coincida con `SAML_ISSUER`)
   - Reply URL (ACS): `https://mda.correo.local/auth/saml/callback` (debe ser HTTPS)
   - Sign-on URL: `https://mda.correo.local/login`
   - User Identifier: `user.userprincipalname`
   - Attribute mapping: `user.givenname` → givenname, `user.surname` → surname, `user.mail` → emailaddress, `user.userprincipalname` → name
   - **NO configurar Group claims** (los roles se gestionan localmente)

3. **Gestión de roles:** Todos los usuarios nuevos entran con rol `guest` (privilegios mínimos, mismo acceso que usuario no autenticado). Para promover a `agent`, `referent`, `team_leader`, `supervisor` o `admin`, usar el panel `/admin/usuarios`. No se requiere intervención en Azure AD.

4. **Testing:** Usar tenant de test de Azure AD antes de rollout a producción. El flujo SAML no se puede probar localmente sin un IdP real o un mock.

