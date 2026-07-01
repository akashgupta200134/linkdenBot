// // connector.js
// const { chromium } = require("playwright");
// const ExcelJS = require("exceljs");
// const path = require("path");
// const { sleep, randomDelay, getFirstName } = require("./utils");

// const EXCEL_FILE = "./contacts.xlsx";
// const SHEET_NAME = "Sheet1";
// const MAX_CONNECTIONS_PER_RUN = 10; // keep low to avoid bans
// const PROFILE_DIR = path.join(__dirname, "profile");

// const buildNote = (firstName) =>
//   `Hi ${firstName}, I came across your profile and would love to connect!`;

// // ── Robust login check ──────────────────────────────────────────────────────
// async function isLoggedIn(page) {
//   try {
//     await page.goto("https://www.linkedin.com/feed", { waitUntil: "load", timeout: 30000 });
//     await sleep(5000);

//     const url = page.url();
//     if (url.includes("/login") || url.includes("/checkpoint") || url.includes("/authwall")) {
//       return false;
//     }

//     const title = await page.title().catch(() => "");
//     const bodyText = await page.evaluate(() => document.body.innerText).catch(() => "");

//     const looksSignedOut =
//       bodyText.includes("Email or phone") &&
//       bodyText.includes("Password") &&
//       bodyText.includes("Sign in");

//     if (looksSignedOut) return false;

//     if ((title.includes("Feed") || title.includes("LinkedIn")) && bodyText.length > 300) {
//       console.log("  ✅ Login confirmed via page title + content");
//       return true;
//     }

//     return false;
//   } catch (err) {
//     console.log(`  Login check error: ${err.message}`);
//     return false;
//   }
// }

// // ── Find the Connect button on a profile page ───────────────────────────────
// async function findConnectButton(page) {

//   // Close any open nav dropdowns first (For Business etc.)
//   await page.keyboard.press("Escape");
//   await sleep(500);

//   // Strategy 1: role=link with name "Invite [Name] to connect"
//   // Scope to main content only to avoid navbar links
//   try {
//     const loc = page.locator("main").getByRole("link", { name: /Invite .+ to/i }).first();
//     if (await loc.count() > 0) {
//       console.log("  Found via main role=link Invite to connect");
//       return await loc.elementHandle();
//     }
//   } catch {}

//   // Strategy 2: page-wide search (fallback)
//   try {
//     const loc = page.getByRole("link", { name: /Invite .+ to/i }).first();
//     if (await loc.count() > 0) {
//       console.log("  Found via page-wide role=link");
//       return await loc.elementHandle();
//     }
//   } catch {}

//   // Strategy 3: SVG id fallback
//   const bysvg = await page.$("button:has(svg#connect-small), a:has(svg#connect-small)").catch(() => null);
//   if (bysvg) {
//     console.log("  Found via svg#connect-small");
//     return bysvg;
//   }

//   return null;
// }

// // ── Main ────────────────────────────────────────────────────────────────────
// const run = async () => {
//   const workbook = new ExcelJS.Workbook();
//   await workbook.xlsx.readFile(EXCEL_FILE);
//   const sheet = workbook.getWorksheet(SHEET_NAME);

//   const rows = [];
//   sheet.eachRow((row, i) => {
//     if (i === 1) return;
//     rows.push({ row, i });
//   });

//   const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
//     headless: false,
//     viewport: { width: 1280, height: 800 },
//   });

//   try {
//     const page = await browser.newPage();

//     console.log("Checking LinkedIn login...");
//     let loggedIn = await isLoggedIn(page);

//     while (!loggedIn) {
//       console.log("⚠️  Not logged in. Please log in manually, then press ENTER...");
//       await new Promise(r => process.stdin.once("data", r));
//       loggedIn = await isLoggedIn(page);
//     }

//     console.log("✅ Logged in! Starting in 3 seconds...\n");
//     await sleep(3000);

//     let sentCount = 0;

//     for (const { row, i } of rows) {
//       if (sentCount >= MAX_CONNECTIONS_PER_RUN) {
//         console.log(`\n⚠️  Reached daily limit of ${MAX_CONNECTIONS_PER_RUN}. Stop for today.`);
//         break;
//       }

//       const name = (row.getCell(1).value || "").toString().trim();
//       let linkedinUrl = row.getCell(3).value;
//       const urlStatus = row.getCell(4).value;
//       const connectionStatus = (row.getCell(6).value || "").toString().trim();

//       // Normalize Excel hyperlink objects to plain string
//       if (linkedinUrl && typeof linkedinUrl === "object") {
//         linkedinUrl = linkedinUrl.hyperlink || linkedinUrl.text || "";
//       }
//       linkedinUrl = (linkedinUrl || "").toString().trim();

//       if (!linkedinUrl || urlStatus !== "URL Found") {
//         console.log(`Row ${i}: Skipping ${name} — no valid URL`);
//         continue;
//       }

//       // Only skip truly terminal statuses — retry everything else
//       const terminalStatuses = ["Sent", "Already Connected"];
//       if (terminalStatuses.includes(connectionStatus)) {
//         console.log(`Row ${i}: Skipping ${name} — already processed (${connectionStatus})`);
//         continue;
//       }

//       console.log(`\nRow ${i}: Opening profile for ${name}...`);

//       try {
//         await page.goto(linkedinUrl, { waitUntil: "domcontentloaded" });
//         await randomDelay(4000, 6000);

//         // Handle security checkpoint
//         if (page.url().includes("/checkpoint/")) {
//           console.log("\n🛑 Security checkpoint detected!");
//           console.log("Please complete the verification in the browser, then press ENTER...");
//           await new Promise(r => process.stdin.once("data", r));
//           await page.goto(linkedinUrl, { waitUntil: "domcontentloaded" });
//           await randomDelay(3000, 5000);
//         }

//         // Check if already 1st degree (only Message button, no Connect)
//         const is1stDegree = await page.$(
//           'span.dist-value:has-text("1st"), span:has-text("· 1st")'
//         ).catch(() => null);

//         if (is1stDegree) {
//           console.log(`  ℹ️  Already 1st-degree connection — skipping`);
//           row.getCell(6).value = "Already Connected";
//           row.commit();
//           await workbook.xlsx.writeFile(EXCEL_FILE);
//           continue;
//         }

//         // Find the Connect button
//         const connectBtn = await findConnectButton(page);

//         if (!connectBtn) {
//           console.log(`  ⚠️  Connect button not found — needs manual check`);
//           row.getCell(6).value = "Connect button not found";
//           row.commit();
//           await workbook.xlsx.writeFile(EXCEL_FILE);
//           continue;
//         }

//         await connectBtn.scrollIntoViewIfNeeded();
//         await sleep(500);
//         await connectBtn.click();
//         await sleep(2000);

//         // Add personalized note if dialog appears
//         const addNoteBtn = await page.getByRole("button", { name: /Add a note/i })
//           .elementHandle().catch(() => null);
//         if (addNoteBtn) {
//           await addNoteBtn.click();
//           await sleep(1500);
//           const textarea = await page.$('textarea[name="message"]').catch(() => null);
//           if (textarea) {
//             await textarea.fill(buildNote(getFirstName(name)));
//             await sleep(1000);
//           }
//         }

//         // Handle "used all monthly invites" Premium upsell popup
//         // This appears instead of the note dialog when limit is reached
//         const premiumPopup = await page.$('button[aria-label="Dismiss"]').catch(() => null);
//         if (premiumPopup) {
//           console.log("  ⚠️  Monthly invite limit reached — closing Premium popup");
//           await premiumPopup.click();
//           await sleep(1000);
//         }

//         // Also handle if Premium popup has a different close button
//         const premiumClose2 = await page.$('button:has-text("Not now"), button:has-text("No thanks")').catch(() => null);
//         if (premiumClose2) await premiumClose2.click().catch(() => {});

//         // Try Send button (with note)
//         let sendBtn = await page.getByRole("button", { name: /^Send$/i }).elementHandle().catch(() => null);

//         // Try "Send without a note" (when monthly limit hit)
//         if (!sendBtn) {
//           sendBtn = await page.getByRole("button", { name: /Send without a note/i }).elementHandle().catch(() => null);
//         }

//         // Generic fallback
//         if (!sendBtn) {
//           sendBtn = await page.$('button:has-text("Send")').catch(() => null);
//         }

//         if (sendBtn) {
//           await sendBtn.click();
//           await sleep(2000);

//           // Dismiss "Invitation sent" success popup if it appears
//           const dismissSuccess = await page.getByRole("button", { name: /Not now/i }).elementHandle().catch(() => null);
//           if (dismissSuccess) await dismissSuccess.click();

//           const today = new Date().toLocaleDateString("en-IN");
//           row.getCell(5).value = today;
//           row.getCell(6).value = "Sent";
//           row.commit();
//           await workbook.xlsx.writeFile(EXCEL_FILE);
//           console.log(`  ✅ Connection sent to ${name}`);
//           sentCount++;
//         } else {
//           console.log(`  ❌ Send button not found`);
//           row.getCell(6).value = "Error - Send btn not found";
//           row.commit();
//           await workbook.xlsx.writeFile(EXCEL_FILE);
//         }

//       } catch (err) {
//         console.log(`  ❌ Error: ${err.message}`);
//         row.getCell(6).value = "Error";
//         row.commit();
//         try { await workbook.xlsx.writeFile(EXCEL_FILE); } catch {}
//       }

//       // Longer delay between each person — critical for avoiding bans
//       await randomDelay(10000, 20000);
//     }

//     console.log(`\n✅ connector.js done! Sent ${sentCount} connection requests.`);
//   } finally {
//     await browser.close();
//   }
// };

// run().catch(console.error);
















// connector.js
const { chromium } = require("playwright");
const ExcelJS = require("exceljs");
const path = require("path");
const { sleep, randomDelay } = require("./utils");

const EXCEL_FILE = "./contacts.xlsx";
const SHEET_NAME = "Sheet1";
const MAX_CONNECTIONS_PER_RUN = 10; // keep low to avoid bans
const PROFILE_DIR = path.join(__dirname, "profile");

// ── Robust login check ──────────────────────────────────────────────────────
async function isLoggedIn(page) {
  try {
    await page.goto("https://www.linkedin.com/feed", { waitUntil: "load", timeout: 30000 });
    await sleep(5000);

    const url = page.url();
    if (url.includes("/login") || url.includes("/checkpoint") || url.includes("/authwall")) {
      return false;
    }

    const title = await page.title().catch(() => "");
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => "");

    const looksSignedOut =
      bodyText.includes("Email or phone") &&
      bodyText.includes("Password") &&
      bodyText.includes("Sign in");

    if (looksSignedOut) return false;

    if ((title.includes("Feed") || title.includes("LinkedIn")) && bodyText.length > 300) {
      console.log("  ✅ Login confirmed via page title + content");
      return true;
    }

    return false;
  } catch (err) {
    console.log(`  Login check error: ${err.message}`);
    return false;
  }
}

// ── Find the Connect button on a profile page ───────────────────────────────
async function findConnectButton(page, name) {

  // Close any open nav dropdowns first (For Business etc.)
  await page.keyboard.press("Escape");
  await sleep(500);

  // Strategy 1: lazy-column testid + exact "Invite [Name] to connect" (from codegen)
  if (name) {
    try {
      const loc = page
        .getByTestId("lazy-column")
        .getByRole("link", { name: new RegExp(`Invite ${name} to connect`, "i") })
        .first();
      if (await loc.count() > 0) {
        console.log("  Found via lazy-column testid + exact name match");
        return await loc.elementHandle();
      }
    } catch {}
  }

  // Strategy 2: role=link with name "Invite [Name] to" (scoped to main, looser match)
  try {
    const loc = page.locator("main").getByRole("link", { name: /Invite .+ to/i }).first();
    if (await loc.count() > 0) {
      console.log("  Found via main role=link Invite to connect");
      return await loc.elementHandle();
    }
  } catch {}

  // Strategy 3: page-wide search (fallback)
  try {
    const loc = page.getByRole("link", { name: /Invite .+ to/i }).first();
    if (await loc.count() > 0) {
      console.log("  Found via page-wide role=link");
      return await loc.elementHandle();
    }
  } catch {}

  // Strategy 4: SVG id fallback
  const bysvg = await page.$("button:has(svg#connect-small), a:has(svg#connect-small)").catch(() => null);
  if (bysvg) {
    console.log("  Found via svg#connect-small");
    return bysvg;
  }

  return null;
}

// ── Main ────────────────────────────────────────────────────────────────────
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
      if (sentCount >= MAX_CONNECTIONS_PER_RUN) {
        console.log(`\n⚠️  Reached daily limit of ${MAX_CONNECTIONS_PER_RUN}. Stop for today.`);
        break;
      }

      const name = (row.getCell(1).value || "").toString().trim();
      let linkedinUrl = row.getCell(3).value;
      const urlStatus = row.getCell(4).value;
      const connectionStatus = (row.getCell(6).value || "").toString().trim();

      // Normalize Excel hyperlink objects to plain string
      if (linkedinUrl && typeof linkedinUrl === "object") {
        linkedinUrl = linkedinUrl.hyperlink || linkedinUrl.text || "";
      }
      linkedinUrl = (linkedinUrl || "").toString().trim();

      if (!linkedinUrl || urlStatus !== "URL Found") {
        console.log(`Row ${i}: Skipping ${name} — no valid URL`);
        continue;
      }

      // Only skip truly terminal statuses — retry everything else
      const terminalStatuses = ["Sent", "Already Connected"];
      if (terminalStatuses.includes(connectionStatus)) {
        console.log(`Row ${i}: Skipping ${name} — already processed (${connectionStatus})`);
        continue;
      }

      console.log(`\nRow ${i}: Opening profile for ${name}...`);

      try {
        await page.goto(linkedinUrl, { waitUntil: "domcontentloaded" });
        await randomDelay(4000, 6000);

        // Handle security checkpoint
        if (page.url().includes("/checkpoint/")) {
          console.log("\n🛑 Security checkpoint detected!");
          console.log("Please complete the verification in the browser, then press ENTER...");
          await new Promise(r => process.stdin.once("data", r));
          await page.goto(linkedinUrl, { waitUntil: "domcontentloaded" });
          await randomDelay(3000, 5000);
        }

        // Check if already 1st degree (only Message button, no Connect)
        const is1stDegree = await page.$(
          'span.dist-value:has-text("1st"), span:has-text("· 1st")'
        ).catch(() => null);

        if (is1stDegree) {
          console.log(`  ℹ️  Already 1st-degree connection — skipping`);
          row.getCell(6).value = "Already Connected";
          row.commit();
          await workbook.xlsx.writeFile(EXCEL_FILE);
          continue;
        }

        // Find the Connect button
        const connectBtn = await findConnectButton(page, name);

        if (!connectBtn) {
          console.log(`  ⚠️  Connect button not found — needs manual check`);
          row.getCell(6).value = "Connect button not found";
          row.commit();
          await workbook.xlsx.writeFile(EXCEL_FILE);
          continue;
        }

        await connectBtn.scrollIntoViewIfNeeded();
        await sleep(500);
        await connectBtn.click();
        await sleep(2000);

        // NOTE: We intentionally skip "Add a note" — always send a plain invite.
        // The dialog that appears offers "Send without a note" directly.

        // Try "Send without a note" first (primary path, no note dialog needed)
        let sendBtn = await page.getByRole("button", { name: /Send without a note/i })
          .elementHandle().catch(() => null);

        // Fallback: some accounts/dialogs show a plain "Send" button instead
        if (!sendBtn) {
          sendBtn = await page.getByRole("button", { name: /^Send$/i }).elementHandle().catch(() => null);
        }

        // Generic fallback
        if (!sendBtn) {
          sendBtn = await page.$('button:has-text("Send")').catch(() => null);
        }

        if (sendBtn) {
          await sendBtn.click();
          await sleep(2000);

          // Dismiss "Invitation sent" success popup if it appears
          const dismissSuccess = await page.getByRole("button", { name: /Not now/i }).elementHandle().catch(() => null);
          if (dismissSuccess) await dismissSuccess.click();

          const today = new Date().toLocaleDateString("en-IN");
          row.getCell(5).value = today;
          row.getCell(6).value = "Sent";
          row.commit();
          await workbook.xlsx.writeFile(EXCEL_FILE);
          console.log(`  ✅ Connection sent to ${name}`);
          sentCount++;
        } else {
          console.log(`  ❌ Send button not found`);
          row.getCell(6).value = "Error - Send btn not found";
          row.commit();
          await workbook.xlsx.writeFile(EXCEL_FILE);
        }

      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        row.getCell(6).value = "Error";
        row.commit();
        try { await workbook.xlsx.writeFile(EXCEL_FILE); } catch {}
      }

      // Longer delay between each person — critical for avoiding bans
      await randomDelay(10000, 20000);
    }

    console.log(`\n✅ connector.js done! Sent ${sentCount} connection requests.`);
  } finally {
    await browser.close();
  }
};

run().catch(console.error);