import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.linkedin.com/in/yashika-sharma04/');
  await page.getByTestId('lazy-column').getByRole('link', { name: 'Invite Yashika Sharma to' }).click();
  await page.getByRole('button', { name: 'Send without a note' }).click();
  await page.getByTestId('lazy-column').getByRole('button', { name: 'More' }).click();
  await page.getByRole('link', { name: 'Message' }).click();
  await page.getByTestId('interop-shadowdom').getByRole('button', { name: 'Dismiss' }).click();
});