// finder.js
const { chromium } = require("playwright");
const ExcelJS = require("exceljs");
const path = require("path");
const { sleep, randomDelay } = require("./utils");

const EXCEL_FILE = "./contacts.xlsx";
const SHEET_NAME = "Sheet1";
const PROFILE_DIR = path.join(__dirname, "profile");

// ── Shared robust login check (same logic as connector.js) ──────────────────
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
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ── Strategy 1: LinkedIn people search ─────────────────────────────────────
// Returns the URL only if the result name loosely matches the target name
async function searchLinkedIn(page, name, company) {
  try {
    const query = `${name} ${company}`;
    await page.goto(
      `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`,
      { waitUntil: "domcontentloaded" }
    );
    await randomDelay(3000, 5000);

    // Get all result cards: each has a name + profile link
    const results = await page.$$eval(
      'a[href*="/in/"]',
      (els) => els
        .filter(a => a.querySelector('span') || a.innerText.trim())
        .map(a => ({
          href: a.href,
          text: a.innerText.trim().toLowerCase()
        }))
        .filter(r => r.href.includes("/in/") && !r.href.includes("/search/"))
    );

    if (results.length === 0) return null;

    // Try to find a result whose text contains at least the first name
    const firstName = name.trim().split(" ")[0].toLowerCase();
    const lastName = name.trim().split(" ").slice(-1)[0].toLowerCase();

    const match = results.find(r =>
      r.text.includes(firstName) || r.text.includes(lastName)
    );

    const best = match || results[0];
    const clean = best.href.match(/https:\/\/[a-z.]*linkedin\.com\/in\/[^?/]+/);
    return clean ? clean[0] : best.href.split("?")[0];
  } catch (err) {
    console.log(`  LinkedIn search error: ${err.message}`);
    return null;
  }
}

// ── Strategy 2: Google fallback ─────────────────────────────────────────────
async function searchGoogle(page, name, company) {
  const queries = [
    `"${name}" "${company}" site:linkedin.com/in`,
    `"${name}" site:linkedin.com/in`,
  ];

  for (const query of queries) {
    try {
      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        { waitUntil: "domcontentloaded" }
      );
      await randomDelay(3000, 5000);

      const links = await page.$$eval("a", els =>
        els.map(a => a.href).filter(h => h.includes("linkedin.com/in/"))
      );

      if (links.length > 0) {
        const raw = links[0];
        const match = raw.match(/https:\/\/[a-z.]*linkedin\.com\/in\/[^&?/]+/);
        return match ? match[0] : raw;
      }

      console.log(`  Google: no result for "${query}", trying next...`);
      await randomDelay(2000, 3000);
    } catch (err) {
      console.log(`  Google search error: ${err.message}`);
    }
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

    console.log("✅ Logged in!\n");

    for (const { row, i } of rows) {
      const name = (row.getCell(1).value || "").toString().trim();
      const company = (row.getCell(2).value || "").toString().trim();
      const existingUrl = row.getCell(3).value;

      if (!name) {
        console.log(`Row ${i}: Skipping — no name`);
        continue;
      }
      if (existingUrl) {
        console.log(`Row ${i}: Skipping ${name} — URL already exists`);
        continue;
      }

      console.log(`\nRow ${i}: Searching for "${name}" @ "${company}"...`);

      let url = null;
      let source = "";

      url = await searchLinkedIn(page, name, company);
      if (url) source = "LinkedIn";

      if (!url) {
        url = await searchGoogle(page, name, company);
        if (url) source = "Google";
      }

      if (url) {
        row.getCell(3).value = url;
        row.getCell(4).value = "URL Found";
        row.getCell(9).value = `Found via ${source}`;
        console.log(`  ✅ Found via ${source}: ${url}`);
      } else {
        row.getCell(3).value = "";
        row.getCell(4).value = "URL Not Found";
        console.log(`  ❌ Not found`);
      }

      row.commit();
      try {
        await workbook.xlsx.writeFile(EXCEL_FILE);
      } catch (err) {
        console.log(`  ⚠️  Could not save Excel (close it first): ${err.message}`);
      }

      await randomDelay(4000, 7000);
    }

    console.log("\n✅ finder.js done! Check your Excel.");
  } finally {
    await browser.close();
  }
};

run().catch(console.error);