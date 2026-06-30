// // connector.js
// require("dotenv").config(); // npm install dotenv

// const { chromium } = require("playwright");
// const ExcelJS = require("exceljs");
// const path = require("path");
// const { sleep, randomDelay, getFirstName } = require("./utils");

// const EXCEL_FILE = "./contacts.xlsx";
// const SHEET_NAME = "Sheet1";
// const MAX_CONNECTIONS_PER_RUN = 20; // safety limit
// const PROFILE_DIR = path.join(__dirname, "profile"); // absolute path - stays stable regardless of cwd

// const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL;
// const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD;

// // Customize your connection note here
// const buildNote = (firstName) =>
//   `Hi ${firstName}, I came across your profile and would love to connect!`;

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
//     viewport: { width: 1280, height: 800 }
//   });

//   try {
//     const page = await browser.newPage();

//     async function isLoggedIn() {
//       try {
//         await page.waitForSelector(".global-nav", { timeout: 8000 });
//         return true;
//       } catch {
//         return false;
//       }
//     }

//     async function tryAutoLogin() {
//       console.log("Not logged in — attempting auto-login...");
//       await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });

//       const emailField = await page.$('#username');
//       const passField = await page.$('#password');

//       if (!emailField || !passField || !LINKEDIN_EMAIL || !LINKEDIN_PASSWORD) {
//         console.log("⚠️  Login form not found or credentials missing in .env");
//         return false;
//       }

//       await emailField.fill(LINKEDIN_EMAIL);
//       await randomDelay(500, 1200);
//       await passField.fill(LINKEDIN_PASSWORD);
//       await randomDelay(500, 1200);

//       const signInBtn = await page.$('button[type="submit"]');
//       if (signInBtn) {
//         await signInBtn.click();
//       }

//       await sleep(4000);
//       return await isLoggedIn();
//     }

//     // ---- Check LinkedIn login (single pass, no duplicates) ----
//     console.log("Checking LinkedIn login...");
//     await page.goto("https://www.linkedin.com/feed", { waitUntil: "domcontentloaded" });

//     let loggedIn = await isLoggedIn();

//     if (!loggedIn) {
//       loggedIn = await tryAutoLogin();
//     }

//     while (!loggedIn) {
//       console.log("⚠️  Auto-login didn't complete (likely a CAPTCHA/checkpoint).");
//       console.log("Please finish it manually in the browser, then press ENTER here...");
//       await new Promise(r => process.stdin.once("data", r));

//       await page.goto("https://www.linkedin.com/feed", { waitUntil: "domcontentloaded" });
//       loggedIn = await isLoggedIn();
//     }

//     console.log("✅ Logged in! Starting in 3 seconds...\n");
//     await sleep(3000);

//     // ---- Main sending loop ----
//     let sentCount = 0;

//     for (const { row, i } of rows) {
//       if (sentCount >= MAX_CONNECTIONS_PER_RUN) {
//         console.log(`\n⚠️  Reached daily limit of ${MAX_CONNECTIONS_PER_RUN}. Stop for today.`);
//         break;
//       }

//       const name = row.getCell(1).value;
//       const linkedinUrl = row.getCell(3).value;
//       const urlStatus = row.getCell(4).value;
//       const connectionStatus = row.getCell(6).value;

//       // Skip if no URL, or connection already sent/attempted
//       if (!linkedinUrl || urlStatus !== "URL Found") {
//         console.log(`Row ${i}: Skipping — no valid URL`);
//         continue;
//       }
//       if (connectionStatus && connectionStatus !== "") {
//         console.log(`Row ${i}: Skipping ${name} — already processed (${connectionStatus})`);
//         continue;
//       }

//       console.log(`\nRow ${i}: Sending connection to ${name}...`);

//       try {
//         await page.goto(linkedinUrl);
//         await randomDelay(3000, 5000);

//         // Try to find Connect button directly on profile
//         let connectBtn = await page.$('button:has-text("Connect")');

//         // If not visible, it might be inside "More" dropdown
//         if (!connectBtn) {
//           const moreBtn = await page.$('button:has-text("More")');
//           if (moreBtn) {
//             await moreBtn.click();
//             await sleep(1500);
//             connectBtn = await page.$('div[role="option"]:has-text("Connect")');
//           }
//         }

//         if (!connectBtn) {
//           console.log(`  ⚠️  Connect button not found — may already be connected`);
//           row.getCell(6).value = "Already Connected";
//           row.commit();
//           await workbook.xlsx.writeFile(EXCEL_FILE);
//           continue;
//         }

//         await connectBtn.click();
//         await sleep(2000);

//         // Add personalized note
//         const addNoteBtn = await page.$('button:has-text("Add a note")');
//         if (addNoteBtn) {
//           await addNoteBtn.click();
//           await sleep(1500);
//           const textarea = await page.$('textarea[name="message"]');
//           if (textarea) {
//             await textarea.fill(buildNote(getFirstName(name)));
//             await sleep(1000);
//           }
//         }

//         // Click Send
//         const sendBtn = await page.$('button:has-text("Send")');
//         if (sendBtn) {
//           await sendBtn.click();
//           await sleep(2000);

//           const today = new Date().toLocaleDateString("en-IN");
//           row.getCell(5).value = today;       // Connection Sent Date
//           row.getCell(6).value = "Sent";      // Connection Status
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
//         await workbook.xlsx.writeFile(EXCEL_FILE);
//       }

//       // Wait between each person — very important
//       await randomDelay(5000, 10000);
//     }

//     console.log(`\n✅ connector.js done! Sent ${sentCount} connection requests.`);
//   } finally {
//     await browser.close(); // always flushes the persistent profile, even on crash
//   }
// };

// run().catch(console.error);





// connector.js
const { chromium } = require("playwright");
const ExcelJS = require("exceljs");
const path = require("path");
const { sleep, randomDelay, getFirstName } = require("./utils");

const EXCEL_FILE = "./contacts.xlsx";
const SHEET_NAME = "Sheet1";
const MAX_CONNECTIONS_PER_RUN = 20; // safety limit
const PROFILE_DIR = path.join(__dirname, "profile"); // same folder finder.js / messenger.js use

const buildNote = (firstName) =>
  `Hi ${firstName}, I came across your profile and would love to connect!`;

async function isLoggedIn(page) {
  try {
    await page.goto("https://www.linkedin.com/feed", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".global-nav", { timeout: 8000 });
    return true;
  } catch {
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
      console.log("⚠️  Not logged in. Please log in manually in the browser, then press ENTER here...");
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

      const name = row.getCell(1).value;
      const linkedinUrl = row.getCell(3).value;
      const urlStatus = row.getCell(4).value;
      const connectionStatus = row.getCell(6).value;

      if (!linkedinUrl || urlStatus !== "URL Found") {
        console.log(`Row ${i}: Skipping — no valid URL`);
        continue;
      }
      if (connectionStatus && connectionStatus !== "") {
        console.log(`Row ${i}: Skipping ${name} — already processed (${connectionStatus})`);
        continue;
      }

      console.log(`\nRow ${i}: Sending connection to ${name}...`);

      try {
        await page.goto(linkedinUrl);
        await randomDelay(3000, 5000);

        let connectBtn = await page.$('button:has-text("Connect")');

        if (!connectBtn) {
          const moreBtn = await page.$('button:has-text("More")');
          if (moreBtn) {
            await moreBtn.click();
            await sleep(1500);
            connectBtn = await page.$('div[role="option"]:has-text("Connect")');
          }
        }

        if (!connectBtn) {
          console.log(`  ⚠️  Connect button not found — may already be connected`);
          row.getCell(6).value = "Already Connected";
          row.commit();
          await workbook.xlsx.writeFile(EXCEL_FILE);
          continue;
        }

        await connectBtn.click();
        await sleep(2000);

        const addNoteBtn = await page.$('button:has-text("Add a note")');
        if (addNoteBtn) {
          await addNoteBtn.click();
          await sleep(1500);
          const textarea = await page.$('textarea[name="message"]');
          if (textarea) {
            await textarea.fill(buildNote(getFirstName(name)));
            await sleep(1000);
          }
        }

        const sendBtn = await page.$('button:has-text("Send")');
        if (sendBtn) {
          await sendBtn.click();
          await sleep(2000);

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
        await workbook.xlsx.writeFile(EXCEL_FILE);
      }

      await randomDelay(5000, 10000);
    }

    console.log(`\n✅ connector.js done! Sent ${sentCount} connection requests.`);
  } finally {
    await browser.close();
  }
};

run().catch(console.error);