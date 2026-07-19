import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, '...');
});

test('settings menampilkan form provider dan tombol test aktif setelah diisi', async ({ page }) => {
  await page.route('/api/providers', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { success: true, data: { providers: [] } } });
      return;
    }
    await route.fulfill({ json: { success: true, data: { provider: { id: 'provider_e2e' } } } });
  });
  await page.route('/api/providers/test', async (route) => {
    await route.fulfill({ json: { success: true, data: { ok: true } } });
  });

  await page.goto('/settings');
  await expect(page.getByTestId('settings-heading')).toBeVisible();

  await page.getByPlaceholder(/Ketik nama model secara manual/).fill('gemini-2.5-flash');
  await page.getByPlaceholder('Masukkan API key').fill('e2e-api-key');
  await expect(page.getByRole('button', { name: 'Test', exact: true })).toBeEnabled();
});