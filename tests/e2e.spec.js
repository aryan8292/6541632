import { test, expect } from '@playwright/test';
test('app shell responds', async ({ page }) => { await page.goto('/'); await expect(page).toHaveTitle(/PriceTracker Pro/); });
