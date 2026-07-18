import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Vibecoding Docs' })).toBeVisible();
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForURL('/login');
  });

  test('should show register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Buat Akun' })).toBeVisible();
  });
});
