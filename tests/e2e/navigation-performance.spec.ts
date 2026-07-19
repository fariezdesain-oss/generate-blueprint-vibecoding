import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    'E2E_TEST_EMAIL dan E2E_TEST_PASSWORD tidak tersedia; protected E2E tests dilewati.'
  );
});

const SLOW_THRESHOLD_MS = 3000;

test('navigasi ke /history harus selesai dalam 3 detik', async ({ page }) => {
  const start = Date.now();
  await page.route('/api/sessions', async (route) => {
    await route.fulfill({ json: { success: true, data: { sessions: [] } } });
  });

  await page.goto('/history');
  await expect(page.getByTestId('history-heading')).toBeVisible();

  const elapsed = Date.now() - start;
  expect(elapsed, `Navigasi ke /history memakan ${elapsed}ms (threshold ${SLOW_THRESHOLD_MS}ms)`).toBeLessThan(SLOW_THRESHOLD_MS);
});

test('navigasi ke /settings harus selesai dalam 3 detik', async ({ page }) => {
  const start = Date.now();
  await page.route('/api/providers', async (route) => {
    await route.fulfill({ json: { success: true, data: { providers: [] } } });
  });

  await page.goto('/settings');
  await expect(page.getByTestId('settings-heading')).toBeVisible();

  const elapsed = Date.now() - start;
  expect(elapsed, `Navigasi ke /settings memakan ${elapsed}ms (threshold ${SLOW_THRESHOLD_MS}ms)`).toBeLessThan(SLOW_THRESHOLD_MS);
});

test('navigasi ke /chat harus selesai dalam 3 detik', async ({ page }) => {
  const start = Date.now();
  await page.route('/api/sessions', async (route) => {
    await route.fulfill({ json: { success: true, data: { sessions: [] } } });
  });

  await page.goto('/chat');
  await page.waitForLoadState('domcontentloaded');
  const elapsed = Date.now() - start;
  expect(elapsed, `Navigasi ke /chat memakan ${elapsed}ms (threshold ${SLOW_THRESHOLD_MS}ms)`).toBeLessThan(SLOW_THRESHOLD_MS);
});

test('navigasi antar halaman berurutan tidak ada delay kumulatif', async ({ page }) => {
  await page.route('/api/sessions', async (route) => {
    await route.fulfill({ json: { success: true, data: { sessions: [] } } });
  });
  await page.route('/api/providers', async (route) => {
    await route.fulfill({ json: { success: true, data: { providers: [] } } });
  });

  const times: Record<string, number> = {};

  let start = Date.now();
  await page.goto('/history');
  await expect(page.getByTestId('history-heading')).toBeVisible();
  times.history = Date.now() - start;

  start = Date.now();
  await page.goto('/settings');
  await expect(page.getByTestId('settings-heading')).toBeVisible();
  times.settings = Date.now() - start;

  start = Date.now();
  await page.goto('/chat');
  await page.waitForLoadState('domcontentloaded');
  times.chat = Date.now() - start;

  for (const [route, elapsed] of Object.entries(times)) {
    expect(elapsed, `Navigasi ke /${route} memakan ${elapsed}ms`).toBeLessThan(SLOW_THRESHOLD_MS);
  }
});