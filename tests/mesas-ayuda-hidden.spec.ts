import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
  type TestUser,
} from './helpers/auth';
import { db } from '../src/db/index';
import { hiddenHelpdesks } from '../src/db/schema';
import { eq } from 'drizzle-orm';

let adminUser: TestUser;
let agentUser: TestUser;

async function getFirstVisibleCardId(page: Page): Promise<number> {
  await page.goto('/mesas-de-ayuda');
  const card = page
    .locator('[data-card-for]:not([data-hidden="true"])')
    .first();
  await expect(card).toBeVisible();
  const id = Number(await card.getAttribute('data-card-for'));
  expect(Number.isInteger(id) && id > 0).toBeTruthy();
  return id;
}

async function unHideByDb(invgateId: number): Promise<void> {
  await db
    .delete(hiddenHelpdesks)
    .where(eq(hiddenHelpdesks.invgateId, invgateId));
}

test.beforeAll(async () => {
  adminUser = await createTestUserAndSession('admin');
  agentUser = await createTestUserAndSession('agent');
});

test.afterAll(async () => {
  await cleanupTestUser(adminUser.userId, adminUser.sessionId);
  await cleanupTestUser(agentUser.userId, agentUser.sessionId);
});

test.beforeEach(async ({ context }) => {
  await setSessionCookie(context, adminUser.signedSessionId);
});

test('Admin oculta y muestra una mesa por API (persistencia)', async ({
  page,
  context,
}) => {
  await setSessionCookie(context, adminUser.signedSessionId);
  const id = await getFirstVisibleCardId(page);

  const hideResp = await page.request.post('/api/soportes/helpdesks/hide', {
    data: { invgate_id: id },
  });
  expect(hideResp.status()).toBe(200);
  expect(await hideResp.json()).toEqual({ ok: true });

  const rows = await db
    .select()
    .from(hiddenHelpdesks)
    .where(eq(hiddenHelpdesks.invgateId, id));
  expect(rows).toHaveLength(1);

  const showResp = await page.request.post('/api/soportes/helpdesks/show', {
    data: { invgate_id: id },
  });
  expect(showResp.status()).toBe(200);

  const after = await db
    .select()
    .from(hiddenHelpdesks)
    .where(eq(hiddenHelpdesks.invgateId, id));
  expect(after).toHaveLength(0);
});

test('Agente no puede ocultar ni mostrar mesas', async ({
  page,
  context,
}) => {
  await setSessionCookie(context, agentUser.signedSessionId);
  const id = await getFirstVisibleCardId(page);

  const hideResp = await page.request.post('/api/soportes/helpdesks/hide', {
    data: { invgate_id: id },
  });
  expect(hideResp.status()).toBe(403);

  const showResp = await page.request.post('/api/soportes/helpdesks/show', {
    data: { invgate_id: id },
  });
  expect(showResp.status()).toBe(403);
});
