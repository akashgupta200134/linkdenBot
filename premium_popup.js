import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.linkedin.com/in/mitali180401araj/');
  await page.getByTestId('lazy-column').getByRole('link', { name: 'Invite Mitali Araj to connect' }).click();
  await page.getByRole('button', { name: 'Send without a note' }).click();
  await page.getByRole('button', { name: 'Not now' }).click();
});