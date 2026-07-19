import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, '...');
});

test('results page menampilkan data statis yang dimock', async ({ page }) => {
  await page.route('/api/sessions/ses_e2e_results/files', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          files: {
            '01_PRD.md': '# Product Requirements Document\n\nIni PRD.',
          },
        },
      },
    });
  });

  await page.goto('/generate/results?session_id=ses_e2e_results');
  
  await expect(page.getByTestId('results-heading')).toBeVisible();
  
  // Tunggu agar MarkdownRenderer selesai dynamic import
  await expect(page.getByText('Product Requirements Document')).toBeVisible();

  // Test tombol download
  const downloadButton = page.getByTestId('download-button');
  await expect(downloadButton).toBeVisible();
});