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
  await page.getByTestId('chat-title-input').fill('E2E Generate');
  await page.getByTestId('start-chat-button').click();

  const generateButton = page.getByTestId('generate-button');
  await expect(generateButton).toBeDisabled();

  await page.getByTestId('chat-textarea').fill('Siap generate');
  await page.getByTestId('chat-textarea').press('Enter');
  await expect(generateButton).toBeEnabled();
});
