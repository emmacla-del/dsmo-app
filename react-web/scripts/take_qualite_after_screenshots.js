const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const outDir = path.resolve(process.cwd(), "docs/screenshots/qualite");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } });

  // Set auth state for Super Admin (National)
  await context.addInitScript(() => {
    const user = {
      id: "usr_superadmin",
      email: "m.ewane@minesec.cm",
      name: "M. Ewane",
      role: "SUPER_ADMIN",
      region: "National",
    };
    localStorage.setItem("camleap.cached_user", JSON.stringify(user));
    localStorage.setItem("camleap.access_token", "mock-token-superadmin");
  });

  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/admin/centre-qualite...");
  await page.goto("http://localhost:3000/admin/centre-qualite", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, "after_centre_qualite.png"), fullPage: true });
  console.log("Saved docs/screenshots/qualite/after_centre_qualite.png");

  // Open rules modal
  console.log("Clicking 'Gérer les règles de validation →'...");
  const rulesBtn = await page.$("button:has-text('Gérer les règles de validation')");
  if (rulesBtn) {
    await rulesBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, "after_rules_modal.png"), fullPage: false });
    console.log("Saved docs/screenshots/qualite/after_rules_modal.png");
  }

  console.log("Navigating to http://localhost:3000/admin/files-attente?tab=anomalies...");
  await page.goto("http://localhost:3000/admin/files-attente?tab=anomalies", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, "after_files_attente.png"), fullPage: true });
  console.log("Saved docs/screenshots/qualite/after_files_attente.png");

  await browser.close();
  console.log("After screenshots completed!");
})();
