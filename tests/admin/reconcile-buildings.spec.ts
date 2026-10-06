import "dotenv/config";
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../src/db/index";
import { offices, auditLogs, users, mesas } from "../../src/db/schema";
import { buildBuildingKey } from "../../src/lib/officeBuildingKey";
import { normalizeSearchValue } from "../../src/lib/clientSearch";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
  type TestUser,
} from "../helpers/auth";

const APPLY_URL_FRAGMENT = "/api/admin/offices/reconcile-buildings";
const BACKUP_DIR = path.resolve(process.cwd(), "database", "backups");

/**
 * Par de direcciones que `buildBuildingKey` colapsa en la MISMA clave
 * ("B#9999|GOBERNADOR+VALENTIN+VERGARA"): la pagina de edificios solo lista
 * grupos candidatos cuando las direcciones normalizadas difieren, asi que este
 * par es un grupo valido. La clave se derivó contra la base real (ninguna
 * oficina existente cae en ella), de modo que el fixture no colisiona con los
 * 66 grupos candidatos preexistentes.
 */
const CODES = ["E2EEDIF01", "E2EEDIF02"];
const ADDRESS_A = "AV. GDOR V VERGARA 9999";
const ADDRESS_B = "VERGARA GOBERNADOR DOCTOR VALENTIN 9999";
const PROVINCE = "B";
const EXPECTED_KEY = "B#9999|GOBERNADOR+VALENTIN+VERGARA";
const STREET_TOKEN = "VERGARA";

/** Mesa participativa: sin ella `resolveSessionMesa` deja al usuario "sin mesa"
 * y el middleware corta `/api/admin/*` con 401 antes de que la ruta vea el rol. */
const MDA_TI_MESA = "TI_GSM_MDA TI";

let admin: TestUser;
/** Snapshots `mda-reconcile-*` que ya existian antes de la corrida. */
let preExistingBackups: Set<string>;
/** Nombres de archivo (no rutas) de los snapshots creados durante la corrida. */
const createdBackups = new Set<string>();

function listReconcileBackups(): string[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => /^mda-reconcile-.*\.db$/.test(name));
}

async function seedOffices(): Promise<void> {
  // Idempotente: una corrida previa que murio a mitad de camino no debe dejar
  // filas que violen el UNIQUE de `offices.code`.
  await db.delete(offices).where(inArray(offices.code, CODES));

  await db.insert(offices).values([
    {
      code: CODES[0],
      name: "E2E EDIFICIO A",
      type: "SUCURSAL",
      provinceCode: PROVINCE,
      address: ADDRESS_A,
    },
    {
      code: CODES[1],
      name: "E2E EDIFICIO B",
      type: "SUCURSAL",
      provinceCode: PROVINCE,
      address: ADDRESS_B,
    },
  ]);
}

/**
 * Lee las filas sembradas de vuelta. `searchableText` es la SEGUNDA columna que
 * escribe la ruta: sin esto, una regresion que la dejara stale pasaria el test
 * y romperia en silencio la busqueda de oficinas. El fixture arranca con
 * `searchableText` NULL, asi que la asercion no es change-detector.
 */
async function readSeededOffices(): Promise<
  { code: string; name: string; address: string; searchableText: string }[]
> {
  const rows = await db
    .select({
      code: offices.code,
      name: offices.name,
      address: offices.address,
      searchableText: offices.searchableText,
    })
    .from(offices)
    .where(inArray(offices.code, CODES));
  expect(rows.map((r) => r.code).sort()).toEqual([...CODES].sort());
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    address: row.address ?? "",
    searchableText: row.searchableText ?? "",
  }));
}

/** La columna de busqueda que recalcula la ruta: code + name + direccion canonica. */
function expectedSearchableText(office: {
  code: string;
  name: string;
  address: string;
}): string {
  return normalizeSearchValue(
    [office.code, office.name, office.address].filter(Boolean).join(" "),
  );
}

test.beforeAll(async () => {
  // Las dos direcciones deben colapsar en la misma clave, si no el fixture no
  // forma ningun grupo y el test pasaria por la razon equivocada.
  const keyA = buildBuildingKey(ADDRESS_A, PROVINCE).key;
  const keyB = buildBuildingKey(ADDRESS_B, PROVINCE).key;
  expect(keyA).toBe(EXPECTED_KEY);
  expect(keyB).toBe(EXPECTED_KEY);

  preExistingBackups = new Set(listReconcileBackups());
  admin = await createTestUserAndSession("admin");
});

test.afterAll(async () => {
  await db.delete(auditLogs).where(eq(auditLogs.username, admin.username));
  await db.delete(offices).where(inArray(offices.code, CODES));
  await cleanupTestUser(admin.userId, admin.sessionId);

  // Cada POST con escrituras deja un snapshot de ~19,7 MB. Los que creo la
  // corrida (por respuesta o por lista) no pueden quedar en el repo.
  for (const name of listReconcileBackups()) {
    if (!preExistingBackups.has(name)) {
      createdBackups.add(name);
    }
  }
  for (const name of createdBackups) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, name));
    } catch {
      // Si no esta, ya se borro.
    }
  }
});

test("admin unifica el grupo seleccionado y deja auditoría", async ({
  page,
  context,
}) => {
  await seedOffices();
  await setSessionCookie(context, admin.signedSessionId);

  await page.goto("/admin/oficinas/edificios");

  const row = page.locator("[data-edificio-row]").filter({
    hasText: EXPECTED_KEY,
  });
  await expect(row).toHaveCount(1);

  await row.locator("[data-edificio-checkbox]").check();
  const applyButton = page.locator("#edificios-apply");
  await expect(applyButton).toBeEnabled();

  page.once("dialog", (dialog) => dialog.accept());

  // Centinela en el documento actual: la isla recarga apenas termina el fetch
  // y `toHaveCount(0)` puede coincidir con el instante en que el DOM viejo se
  // desmonta. Esperar a que el centinela desaparezca garantiza que el documento
  // vivo es el post-reload, asi que "0 filas" significa "0 filas de verdad".
  await page.evaluate(() => {
    (window as unknown as { __preUnify?: boolean }).__preUnify = true;
  });

  // El POST lo dispara la isla del navegador. El cuerpo de la respuesta no se
  // lee: la isla recarga apenas la recibe y el recurso CDP ya no existe para
  // entonces. Los snapshots se recuperan por diferencia de directorio.
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(APPLY_URL_FRAGMENT)),
    applyButton.click(),
  ]);
  expect(response.ok()).toBe(true);

  // Al unificar, ambas oficinas guardan la misma direccion: las direcciones
  // normalizadas ya no difieren, el grupo deja de ser candidato y desaparece
  // tras el reload que hace la isla.
  await page.waitForFunction(
    () => !(window as unknown as { __preUnify?: boolean }).__preUnify,
  );
  await expect(row).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator("#edificios-apply")).toBeDisabled();

  const rows = await readSeededOffices();
  const canonical = rows[0].address;
  expect(rows[1].address).toBe(canonical);
  expect(canonical).toContain(STREET_TOKEN);

  // `searchableText` es lo que la pagina de oficinas busca. Sin esto, una
  // regresion que lo dejara con el valor viejo (o en NULL) pasaria el test y
  // la oficina quedaria invisible en el buscador.
  //
  // Solo se exige para las filas cuya direccion CAMBIO: la ruta descarta las
  // que ya guardan la canonica (`member.address === canonical`), asi que
  // `ADDRESS_B` - que ya es la canonica que la pagina propone - queda con su
  // `searchable_text` inicial (NULL) y la asercion de abajo lo fija.
  const originalByCode = new Map([
    [CODES[0], ADDRESS_A],
    [CODES[1], ADDRESS_B],
  ]);
  let rewritten = 0;
  for (const row of rows) {
    if (row.address === originalByCode.get(row.code)) {
      expect(row.searchableText).toBe("");
      continue;
    }
    expect(row.searchableText).toBe(expectedSearchableText(row));
    expect(row.searchableText).toContain(normalizeSearchValue(canonical));
    rewritten += 1;
  }
  expect(rewritten).toBeGreaterThan(0);

  const audits = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.username, admin.username));
  expect(audits.some((log) => log.action.includes(STREET_TOKEN))).toBe(true);
});

test("un supervisor no puede aplicar la unificación", async ({
  page,
  context,
}) => {
  const supervisor = await createTestUserAndSession("supervisor");
  try {
    const [mesa] = await db
      .select({ invgateId: mesas.invgateId })
      .from(mesas)
      .where(eq(mesas.name, MDA_TI_MESA));
    expect(mesa, `falta la mesa ${MDA_TI_MESA}`).toBeTruthy();
    await db
      .update(users)
      .set({ helpdeskId: mesa.invgateId, helpdeskName: MDA_TI_MESA })
      .where(eq(users.id, supervisor.userId));

    await setSessionCookie(context, supervisor.signedSessionId);
    await seedOffices();

    const before = (await readSeededOffices()).map((row) => row.address);

    const response = await page.request.post(APPLY_URL_FRAGMENT, {
      data: {
        groups: [{ key: EXPECTED_KEY, canonical: "VERGARA 9999" }],
      },
    });

    expect(response.status()).toBe(403);

    // El 403 tiene que venir ANTES de cualquier escritura, no despues: si el
    // control de rol se moviera, el lote se aplicaria igual y el operador
    // veria direcciones sobrescritas sin autorizacion. La busqueda va por el
    // username del supervisor (el admin si escribe auditoria, legítimamente).
    const supervisorAudits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.username, supervisor.username));
    expect(supervisorAudits).toEqual([]);

    const after = (await readSeededOffices()).map((row) => row.address);
    expect(after).toEqual(before);
  } finally {
    await cleanupTestUser(supervisor.userId, supervisor.sessionId);
  }
});

test("un admin no puede unificar con una dirección canónica vacía", async ({
  page,
  context,
}) => {
  await setSessionCookie(context, admin.signedSessionId);

  // La isla frena el canonical vacio en el cliente; este POST a mano llega al
  // guard del servidor (`trim().min(3)`), que antes no tenia cobertura.
  const response = await page.request.post(APPLY_URL_FRAGMENT, {
    data: {
      groups: [{ key: EXPECTED_KEY, canonical: "   " }],
    },
  });

  expect(response.status()).toBe(400);
  // `response.text()` se puede leer una sola vez, asi que el cuerpo se captura
  // una vez y se asserta sobre el string. El mensaje de la ruta se compara sin
  // acentos para no atarlo a la redaccion exacta ("canónica" vs "canonica").
  const body = normalizeSearchValue(await response.text());
  expect(body).toContain("direccion canonica");
  expect(body).toContain("3");
});

test("un admin no puede repetir la clave de un edificio en el mismo pedido", async ({
  page,
  context,
}) => {
  await seedOffices();
  await setSessionCookie(context, admin.signedSessionId);

  const before = await readSeededOffices();

  // Sin este rechazo, el segundo grupo se aplicaba a medias: `processed`
  // descartaba a sus miembros, se escribia solo el primer canonical y ambos
  // grupos dejaban su fila de auditoria ("Unifico 2 oficinas" sobre un lote
  // que solo toco una).
  const response = await page.request.post(APPLY_URL_FRAGMENT, {
    data: {
      groups: [
        { key: EXPECTED_KEY, canonical: "VERGARA 9999" },
        { key: EXPECTED_KEY, canonical: "OTRA CANONICA 9999" },
      ],
    },
  });

  expect(response.status()).toBe(400);
  const body = normalizeSearchValue(await response.text());
  expect(body).toContain("repetir la clave");

  // Ademas del 400, el lote no puede haber tocado nada.
  expect(await readSeededOffices()).toEqual(before);
});
