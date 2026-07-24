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
  await page.getByTestId('chat-textarea').press('Control+Enter');
  await expect(generateButton).toBeEnabled();
});

test('modal progres di ChatContent menampilkan dot step dan progress bar yang akurat saat generate', async ({ page }) => {
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
    await route.fulfill({ json: { success: true, data: { messages: [], title: 'E2E Generate', mode: 'docs' } } });
  });

  let pollCount = 0;
  await page.route('**/api/sessions/ses_e2e_generate/files', async (route) => {
    if (route.request().method() === 'GET') {
      pollCount++;
      if (pollCount === 1) {
        await route.fulfill({
          json: {
            success: true,
            data: {
              files: {},
              generation_status: 'generating',
              generation_progress: {
                currentFileIndex: 0,
                currentFileName: '01_PRD.md',
                currentFileProgress: 50,
                overallProgress: 5,
                stage: 'generating',
                message: 'Menulis dokumen...',
              },
            },
          },
        });
      } else {
        await route.fulfill({
          json: {
            success: true,
            data: {
              files: {
                '01_PRD.md': '# PRD',
                '02_ARCHITECTURE.md': '# ARCH',
                '03_DATA_MODELS.md': '# DATA',
                '04_PROJECT_STANDARDS.md': '# STD',
                '05_DESIGN_SYSTEM.md': '# DESIGN',
                '06_DELIVERY.md': '# DELIV',
                '07_AGENT_CONTEXT.md': '# CTX',
                '08_TASKS.md': '# TASKS',
                '09_AI_RULES.md': '# RULES',
              },
              generation_status: 'completed',
              generation_progress: {
                currentFileIndex: 8,
                currentFileName: '09_AI_RULES.md',
                currentFileProgress: 100,
                overallProgress: 100,
                stage: 'done',
                message: 'Selesai',
              },
            },
          },
        });
      }
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/generate/start', async (route) => {
    await route.fulfill({ json: { success: true, data: { completed: false } } });
  });

  await page.goto('/chat');
  await page.getByRole('button', { name: /Dokumen Instruksi Vibecoding/ }).click();
  await page.getByTestId('chat-title-input').fill('E2E Generate');
  await page.getByTestId('start-chat-button').click();

  const generateButton = page.getByTestId('generate-button');
  await page.getByTestId('chat-textarea').fill('Siap generate');
  await page.getByTestId('chat-textarea').press('Control+Enter');
  await expect(generateButton).toBeEnabled();

  await generateButton.click();

  // Verifikasi modal progres muncul
  const modalText = page.locator('text=Progres Dokumen Saat Ini');
  await expect(modalText).toBeVisible();

  // Verifikasi bar progress saat ini (50%)
  const currentProgressVal = page.locator('text=50%');
  await expect(currentProgressVal).toBeVisible();

  // Verifikasi bar progress keseluruhan (5%)
  const overallProgressVal = page.locator('text=5%');
  await expect(overallProgressVal).toBeVisible();

  // Verifikasi dot step yang aktif berdenyut (01_PRD.md di indeks 0)
  const pulseDot = page.locator('.animate-pulse');
  await expect(pulseDot).toBeVisible();

  // Tunggu redirect ke halaman hasil (karena status complete)
  await expect(page).toHaveURL(/\/generate\/results/);
});

test('mengklik Hentikan Generate memanggil API cancel dan memungkinkan user untuk generate kembali', async ({ page }) => {
  let cancelCalled = false;
  let currentGenStatus = 'generating';

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
    await route.fulfill({ json: { success: true, data: { messages: [], title: 'E2E Generate', mode: 'docs' } } });
  });

  await page.route('**/api/sessions/ses_e2e_generate/files', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          files: {},
          generation_status: currentGenStatus,
          generation_progress: {
            currentFileIndex: 1,
            currentFileName: '02_ARCHITECTURE.md',
            currentFileProgress: 40,
            overallProgress: 15,
            stage: 'generating',
            message: 'Menulis dokumen...',
          },
        },
      },
    });
  });

  await page.route('**/api/generate/cancel', async (route) => {
    if (route.request().method() === 'POST') {
      cancelCalled = true;
      currentGenStatus = 'cancelled'; // update status untuk get selanjutnya
      await route.fulfill({ json: { success: true } });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/generate/start', async (route) => {
    await route.fulfill({ json: { success: true, data: { completed: false } } });
  });

  await page.goto('/chat');
  await page.getByRole('button', { name: /Dokumen Instruksi Vibecoding/ }).click();
  await page.getByTestId('chat-title-input').fill('E2E Generate');
  await page.getByTestId('start-chat-button').click();

  const generateButton = page.getByTestId('generate-button');
  await page.getByTestId('chat-textarea').fill('Siap generate');
  await page.getByTestId('chat-textarea').press('Control+Enter');
  await expect(generateButton).toBeEnabled();

  await generateButton.click();

  // Verifikasi modal progres muncul
  const modalText = page.locator('text=Progres Dokumen Saat Ini');
  await expect(modalText).toBeVisible();

  // Klik tombol Hentikan Generate
  const stopButton = page.getByRole('button', { name: /Hentikan Generate/i });
  await stopButton.click();

  // Verifikasi modal progres hilang
  await expect(modalText).not.toBeVisible();

  // Verifikasi popup notifikasi muncul dengan teks yang benar
  const popupNotif = page.locator('text=proses generate 02_ARCHITECTURE.md dihentikan');
  await expect(popupNotif).toBeVisible();

  // Verifikasi API cancel dipanggil
  await expect.poll(() => cancelCalled).toBe(true);

  // Tutup popup error/notifikasi agar tombol generate terlihat/bisa diklik lagi
  await page.getByRole('button', { name: 'OK' }).click();

  // Klik tombol generate lagi untuk membuktikan bahwa generate ulang berhasil dimulai
  await generateButton.click();

  // Verifikasi modal progres muncul kembali
  await expect(modalText).toBeVisible();
});
