import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { expect, test as setup } from '@playwright/test';

const authFile = 'tests/e2e/.auth/user.json';

setup('login dan simpan storage state', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  mkdirSync(dirname(authFile), { recursive: true });

  if (!email || !password) {
    await page.context().storageState({ path: authFile });
    console.log('E2E_TEST_EMAIL dan E2E_TEST_PASSWORD tidak tersedia; storageState kosong dibuat dan protected E2E tests akan dilewati.');
    return;
  }

  await page.goto('/login');
  await page.getByPlaceholder('nama@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/\/chat/);
  await expect(page).toHaveURL(/\/chat/);
  await page.context().storageState({ path: authFile });
});
