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

test('results page menampilkan modal progres ketika file di-regenerate', async ({ page }) => {
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

  await page.route('/api/generate/sequential', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          file_name: '01_PRD.md',
          file_index: 0,
          total_files: 9,
          content: '# Product Requirements Document\n\nPRD baru di-regenerate.',
        },
      },
    });
  });

  await page.goto('/generate/results?session_id=ses_e2e_results');
  await expect(page.getByText('Product Requirements Document')).toBeVisible();

  // Klik tombol regenerate
  const regenerateButton = page.getByRole('button', { name: /Regenerate/i });
  await regenerateButton.click();

  // Verifikasi modal progres muncul
  const modal = page.getByTestId('regenerate-progress-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Progres Dokumen Saat Ini')).toBeVisible();
  await expect(modal.getByText('Progres Keseluruhan')).toBeVisible();

  // Verifikasi modal otomatis tertutup setelah selesai (dengan delay 1000ms di frontend)
  await expect(modal).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByText('PRD baru di-regenerate.')).toBeVisible();
});