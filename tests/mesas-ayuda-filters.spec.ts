import 'dotenv/config';
import { test, expect } from '@playwright/test';
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
  type TestUser,
} from './helpers/auth';

let adminUser: TestUser;

test.beforeAll(async () => {
  adminUser = await createTestUserAndSession('admin');
});

test.afterAll(async () => {
  await cleanupTestUser(adminUser.userId, adminUser.sessionId);
});

test.beforeEach(async ({ context }) => {
  await setSessionCookie(context, adminUser.signedSessionId);
});

test('La barra de busqueda tiene grow prioritario y placeholder visible', async ({ page }) => {
  await page.goto('/mesas-de-ayuda');

  const searchInput = page.locator('#soportes-search');
  await expect(searchInput).toBeVisible();
  await expect(searchInput).toHaveAttribute(
    'placeholder',
    'Buscar por nombre SM, Invgate, topico...',
  );

  const searchBar = page.locator('label[for="soportes-search"]');
  const searchBox = await searchBar.boundingBox();
  const statusBox = await page.locator('#filter-status').boundingBox();
  expect(searchBox).not.toBeNull();
  expect(statusBox).not.toBeNull();
  expect(searchBox!.width).toBeGreaterThanOrEqual(350);
  expect(searchBox!.width).toBeGreaterThan(statusBox!.width);

  const flexWrap = await page
    .locator('#soportes-filters')
    .evaluate((el) => getComputedStyle(el).flexWrap);
  expect(flexWrap).toBe('wrap');
});

test('El select de mesas padre tambien crece junto a la barra', async ({ page }) => {
  await page.goto('/mesas-de-ayuda');
  await expect(page.locator('#soportes-search')).toBeVisible();

  const parentSelect = page.locator('#filter-parent');
  if ((await parentSelect.count()) === 0) {
    test.skip();
    return;
  }
  const parentBox = await parentSelect.boundingBox();
  expect(parentBox).not.toBeNull();
  expect(parentBox!.width).toBeGreaterThanOrEqual(160);
});

test('En pantallas angostas el placeholder sigue visible', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/mesas-de-ayuda');

  const searchInput = page.locator('#soportes-search');
  await expect(searchInput).toBeVisible();

  const searchBar = page.locator('label[for="soportes-search"]');
  const searchBox = await searchBar.boundingBox();
  expect(searchBox).not.toBeNull();
  expect(searchBox!.width).toBeGreaterThanOrEqual(350);
});