

@'
const { chromium } = require("playwright");
const ExcelJS = require("exceljs");
const { randomDelay } = require("./utils");

const EXCEL_FILE = "./contacts.xlsx";
const SHEET_NAME = "Sheet1";

const findLinkedInUrl = async (page, name, company) => {
  // Try 3 different search strategies
  const queries = [
    `${name} ${company} linkedin`,
    `${name} linkedin ${company}`,
    `${name} linkedin India`,
  ];

  for (const query of queries) {
    try {
      await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`);
      await randomDelay(2000, 4000);

      const links = await page.$$eval("a", els =>
        els.map(a => a.href).filter(h =>
          h.includes("linkedin.com/in/") && !h.includes("bing.com")
        )
      );

      if (links.length > 0) {
        const raw = links[0];
        const match = raw.match(/https:\/\/[a-z.]*linkedin\.com\/in\/[^&?/]+/);
        return match ? match[0] : raw;
      }

      console.log(`  Tried: "${query}" — no result, trying next...`);
      await randomDelay(2000, 3000);

    } catch (err) {
      console.log(`  Search error: ${err.message}`);
    }
  }

  return null;
};

const run = async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);
  const sheet = workbook.getWorksheet(SHEET_NAME);

  const rows = [];
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    rows.push({ row, i });
  });

  const browser = await chromium.launchPersistentContext("./profile", {
    headless: false,
    viewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();

  for (const { row, i } of rows) {
    const name = (row.getCell(1).value || "").toString().trim();
    const company = (row.getCell(2).value || "").toString().trim();
    const existingUrl = row.getCell(3).value;
    const existingStatus = row.getCell(4).value;

    // Skip if already found or already marked not found
    if (!name) {
      console.log(`Row ${i}: Skipping — no name`);
      continue;
    }
    if (existingUrl) {
      console.log(`Row ${i}: Skipping ${name} — URL already exists`);
      continue;
    }

    console.log(`\nRow ${i}: Searching for "${name}" @ "${company}"...`);

    const url = await findLinkedInUrl(page, name, company);

    if (url) {
      row.getCell(3).value = url;
      row.getCell(4).value = "URL Found";
      console.log(`  ✅ Found: ${url}`);
    } else {
      row.getCell(3).value = "";
      row.getCell(4).value = "URL Not Found";
      console.log(`  ❌ Not found after all attempts`);
    }

    row.commit();
    await workbook.xlsx.writeFile(EXCEL_FILE);
    await randomDelay(4000, 7000);
  }

  console.log("\n✅ finder.js done! Check your Excel.");
  await browser.close();
};

run().catch(console.error);
'@ | Set-Content -Path "C:\Drive Data\OneDrive\Desktop\linkdenBot\finder.js" -Encoding UTF8