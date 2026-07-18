import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, 'E2E_TEST_EMAIL dan E2E_TEST_PASSWORD tidak tersedia; protected E2E tests dilewati.');
});

async function bukaSesiChat(page: import('@playwright/test').Page) {
  await page.route('/api/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { success: true, data: { session: { id: 'ses_e2e_chat', title: 'E2E Chat', mode: 'docs' } } } });
      return;
    }
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { success: true, data: { sessions: [] } } });
      return;
    }
    await route.fallback();
  });

  await page.goto('/chat');
  await page.getByRole('button', { name: /Dokumen Instruksi Vibecoding/ }).click();
  await page.getByPlaceholder('Contoh: Aplikasi kasir toko').fill('E2E Chat');
  await page.getByRole('button', { name: 'Mulai Chat' }).click();
}

test('chat menampilkan empty state atau textarea', async ({ page }) => {
  await bukaSesiChat(page);
  await expect(page.getByText('Mulai Percakapan').or(page.getByPlaceholder('Ketik pesan...'))).toBeVisible();
});

test('chat bisa mengirim pesan dengan mock streaming', async ({ page }) => {
  await bukaSesiChat(page);
  await page.route('**/api/chat**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: `${JSON.stringify({ token: 'E2E_CHAT_SENTINEL' })}\n${JSON.stringify({ done: true, message: { id: 'msg_assistant', role: 'assistant', content: 'E2E_CHAT_SENTINEL' } })}\n`,
      });
      return;
    }
    await route.fallback();
  });

  await page.getByPlaceholder('Ketik pesan...').fill('Halo dari E2E');
  await page.getByPlaceholder('Ketik pesan...').press('Enter');
  await expect(page.getByText('Halo dari E2E')).toBeVisible();
  await expect(page.getByText('E2E_CHAT_SENTINEL')).toBeVisible();
});
