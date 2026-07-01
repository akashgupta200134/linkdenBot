// test_connect.js
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launchPersistentContext(
    path.join(__dirname, "profile"),
    { headless: false }
  );
  const page = await browser.newPage();
  await page.goto("https://www.linkedin.com/in/yashika-sharma04/", {
    waitUntil: "domcontentloaded",
  });
  await new Promise((r) => setTimeout(r, 5000));

  // Try the SVG id selector
  const btn = await page.$("button:has(svg#connect-small)");
  if (btn) {
    console.log("✅ FOUND Connect button via svg#connect-small!");
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    console.log("✅ CLICKED! Check the browser for the connect dialog.");
    await new Promise((r) => setTimeout(r, 5000));
  } else {
    console.log("❌ NOT FOUND via svg selector");

    // Try locator approach
    const loc = page.locator("button", { hasText: /^Connect$/ }).first();
    const count = await loc.count();
    console.log("Locator count:", count);
    if (count > 0) {
      await loc.click();
      console.log("✅ CLICKED via locator!");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  await browser.close();
})();





import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.linkedin.com/in/yashika-sharma04/');
  await page.getByTestId('lazy-column').getByRole('link', { name: 'Invite Yashika Sharma to' }).click();
  await page.getByRole('button', { name: 'Send without a note' }).click();
  await page.getByTestId('lazy-column').getByRole('button', { name: 'More' }).click();
  await page.getByRole('link', { name: 'Message' }).click();
  await page.getByTestId('interop-shadowdom').getByRole('button', { name: 'Dismiss' }).click();
});



import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.linkedin.com/in/mitali180401araj/');
  await page.getByTestId('lazy-column').getByRole('link', { name: 'Invite Mitali Araj to connect' }).click();
  await page.getByRole('button', { name: 'Send without a note' }).click();
  await page.getByRole('button', { name: 'Not now' }).click();
});