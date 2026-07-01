// messenger.js
const { chromium } = require("playwright");
const ExcelJS = require("exceljs");
const path = require("path");
const { sleep, randomDelay, getFirstName } = require("./utils");

const EXCEL_FILE = "./contacts.xlsx";
const SHEET_NAME = "Sheet1";
const MAX_MESSAGES_PER_RUN = 15; // safety limit
const PROFILE_DIR = path.join(__dirname, "profile"); // same folder finder.js / connector.js use

const buildMessage = (firstName) =>
  `Hi ${firstName}, thanks for connecting! I wanted to reach out regarding a potential collaboration opportunity. Would love to have a quick chat when you're free!`;

async function isLoggedIn(page) {
  try {
    await page.goto("https://www.linkedin.com/feed", { waitUntil: "load", timeout: 30000 });
    await sleep(5000);

    const url = page.url();
    console.log(`  [debug] Current URL: ${url}`);
    if (url.includes("/login") || url.includes("/checkpoint") || url.includes("/authwall")) {
      console.log("  [debug] URL indicates logged out");
      return false;
    }

    const title = await page.title().catch(() => "");
    console.log(`  [debug] Page title: "${title}"`);

    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => "");
    console.log(`  [debug] Body text length: ${bodyText.length} chars`);

    const looksSignedOut =
      bodyText.includes("Email or phone") &&
      bodyText.includes("Password") &&
      bodyText.includes("Sign in");

    if (looksSignedOut) {
      console.log("  [debug] Body text indicates signed-out login form");
      return false;
    }

    if ((title.includes("Feed") || title.includes("LinkedIn")) && bodyText.length > 300) {
      console.log("  [debug] Title + content length indicate logged in");
      return true;
    }

    const selectors = [
      ".global-nav",
      "#global-nav",
      'a[href="/feed/"]',
      ".feed-identity-module",
      'img.global-nav__me-photo',
      'a[href="/messaging/"]',
      'a[href="/mynetwork/"]',
    ];

    for (const sel of selectors) {
      const found = await page.$(sel).catch(() => null);
      if (found) {
        console.log(`  [debug] selector "${sel}" found: true`);
        return true;
      }
    }

    console.log("  [debug] No positive signal found — treating as logged out");
    return false;
  } catch (err) {
    console.log(`  [debug] isLoggedIn threw: ${err.message}`);
    return false;
  }
}

const run = async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);
  const sheet = workbook.getWorksheet(SHEET_NAME);

  const rows = [];
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    rows.push({ row, i });
  });

  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });

  try {
    const page = await browser.newPage();

    console.log("Checking LinkedIn login...");
    let loggedIn = await isLoggedIn(page);

    while (!loggedIn) {
      console.log("⚠️  Not logged in. Please log in manually, then press ENTER...");
      await new Promise(r => process.stdin.once("data", r));
      loggedIn = await isLoggedIn(page);
    }

    console.log("✅ Logged in! Starting in 3 seconds...\n");
    await sleep(3000);

    let sentCount = 0;

    for (const { row, i } of rows) {
      if (sentCount >= MAX_MESSAGES_PER_RUN) {
        console.log(`\n⚠️  Reached message limit of ${MAX_MESSAGES_PER_RUN}. Stop for today.`);
        break;
      }

      const name = row.getCell(1).value;
      let linkedinUrl = row.getCell(3).value;
      const connectionStatus = row.getCell(6).value;
      const messageSentDate = row.getCell(7).value;

      // Excel sometimes stores a URL as a hyperlink object — normalize it
      if (linkedinUrl && typeof linkedinUrl === "object") {
        linkedinUrl = linkedinUrl.hyperlink || linkedinUrl.text || "";
      }
      linkedinUrl = (linkedinUrl || "").toString().trim();

      if (connectionStatus !== "Accepted") {
        console.log(`Row ${i}: Skipping ${name} — not accepted yet (${connectionStatus})`);
        continue;
      }
      if (messageSentDate) {
        console.log(`Row ${i}: Skipping ${name} — message already sent`);
        continue;
      }
      if (!linkedinUrl) {
        console.log(`Row ${i}: Skipping ${name} — no LinkedIn URL`);
        continue;
      }

      console.log(`\nRow ${i}: Messaging ${name}...`);

      try {
        await page.goto(linkedinUrl);
        await randomDelay(3000, 5000);

        // Detect LinkedIn security checkpoint
        if (page.url().includes("/checkpoint/")) {
          console.log("\n🛑 LinkedIn is showing a security checkpoint/verification.");
          console.log("Please complete the verification manually in the browser window.");
          console.log("Once done, press ENTER here to continue...");
          await new Promise(r => process.stdin.once("data", r));
          await page.goto(linkedinUrl);
          await randomDelay(3000, 5000);
        }

        const msgBtn = await page.$('button:has-text("Message")');
        if (!msgBtn) {
          console.log(`  ⚠️  Message button not found — may not be 1st degree`);
          row.getCell(9).value = "Message button not found";
          row.commit();
          await workbook.xlsx.writeFile(EXCEL_FILE);
          continue;
        }

        await msgBtn.click();
        await sleep(2000);

        const msgBox = await page.$('.msg-form__contenteditable');
        if (!msgBox) {
          console.log(`  ❌ Message box not found`);
          row.getCell(9).value = "Message box not found";
          row.commit();
          await workbook.xlsx.writeFile(EXCEL_FILE);
          continue;
        }

        const message = buildMessage(getFirstName(name));
        await msgBox.click();
        await msgBox.type(message, { delay: 40 });
        await sleep(1500);

        const sendBtn = await page.$('button.msg-form__send-button');
        if (sendBtn) {
          await sendBtn.click();
          await sleep(2000);

          const today = new Date().toLocaleDateString("en-IN");
          row.getCell(7).value = today;
          row.getCell(8).value = message;
          row.commit();
          await workbook.xlsx.writeFile(EXCEL_FILE);

          console.log(`  ✅ Message sent to ${name}`);
          sentCount++;
        } else {
          console.log(`  ❌ Send button not found`);
          row.getCell(9).value = "Error - send button not found";
          row.commit();
          await workbook.xlsx.writeFile(EXCEL_FILE);
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        row.getCell(9).value = `Error: ${err.message}`;
        row.commit();
        try {
          await workbook.xlsx.writeFile(EXCEL_FILE);
        } catch (writeErr) {
          console.log(`  ⚠️  Could not save Excel (is it open?): ${writeErr.message}`);
        }
      }

      await randomDelay(8000, 15000); // slower — reduce ban risk
    }

    console.log(`\n✅ messenger.js done! Sent ${sentCount} messages.`);
  } finally {
    await browser.close();
  }
};

run().catch(console.error);