import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, 'E2E_TEST_EMAIL dan E2E_TEST_PASSWORD tidak tersedia; protected E2E tests dilewati.');
});

test('tombol generate disabled lalu enabled setelah readiness signal', async ({ page }) => {
  await page.route('/api/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { success: true, data: { session: { id: 'ses_e2e_generate', title: 'E2E Generate', mode: 'docs' } } } });
      return;
    }
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { success: true, data: { sessions: [] } } });
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/chat**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: `${JSON.stringify({ done: true, message: { id: 'msg_ready', role: 'assistant', content: 'Informasi sudah cukup. Silakan klik Generate Documentation.' } })}\n`,
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('/chat');
  await page.getByRole('button', { name: /Dokumen Instruksi Vibecoding/ }).click();
  await page.getByPlaceholder('Contoh: Aplikasi kasir toko').fill('E2E Generate');
  await page.getByRole('button', { name: 'Mulai Chat' }).click();

  const generateButton = page.locator('button[title="Selesaikan dulu sesi diskusi proyek Anda"]');
  await expect(generateButton).toBeDisabled();

  await page.getByPlaceholder('Ketik pesan...').fill('Siap generate');
  await page.getByPlaceholder('Ketik pesan...').press('Enter');
  await expect(page.locator('button[title="Generate 9 Engineering Documents"]')).toBeEnabled();
});
