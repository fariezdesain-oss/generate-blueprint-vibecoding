import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-heading')).toBeVisible();
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/chat');
    // Tambah timeout eksplisit untuk redirection middleware
    await page.waitForURL('/login', { timeout: 15000 });
  });

  test('should show register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByTestId('register-heading')).toBeVisible();
  });
});