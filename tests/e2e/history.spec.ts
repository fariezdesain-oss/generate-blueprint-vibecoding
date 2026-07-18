import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, 'E2E_TEST_EMAIL dan E2E_TEST_PASSWORD tidak tersedia; protected E2E tests dilewati.');
});

test('history menampilkan empty state', async ({ page }) => {
  await page.route('/api/sessions', async (route) => {
    await route.fulfill({ json: { success: true, data: { sessions: [] } } });
  });

  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(page.getByText('Belum ada sesi')).toBeVisible();
});

test('history menampilkan sesi dan klik navigasi ke chat', async ({ page }) => {
  await page.route('/api/sessions', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          sessions: [
            {
              id: 'ses_e2e_history',
              title: 'Sesi E2E History',
              created_at: '2026-07-18T00:00:00.000Z',
              mode: 'docs',
              has_generated: false,
              has_n8n: false,
            },
          ],
        },
      },
    });
  });
  await page.route('/api/chat?session_id=ses_e2e_history', async (route) => {
    await route.fulfill({ json: { success: true, data: { mode: 'docs', messages: [] } } });
  });

  await page.goto('/history');
  await page.getByText('Sesi E2E History').click();
  await expect(page).toHaveURL(/\/chat\?id=ses_e2e_history/);
});
