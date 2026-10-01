const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  fs.mkdirSync('docs/screenshots/declarants', { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Set auth state for Super Admin (National / Littoral)
  await context.addInitScript(() => {
    const user = {
      id: 'usr_superadmin',
      email: 'm.ewane@minesec.cm',
      name: 'M. Ewane',
      role: 'SUPER_ADMIN',
      region: 'Littoral'
    };
    localStorage.setItem('camleap.cached_user', JSON.stringify(user));
    localStorage.setItem('camleap.access_token', 'mock-token-superadmin');
  });

  const page = await context.newPage();

  const pages = [
    { url: 'http://localhost:3000/admin/inscriptions', name: 'before_inscriptions.png' },
    { url: 'http://localhost:3000/admin/etablissements', name: 'before_etablissements.png' },
    { url: 'http://localhost:3000/admin/etablissement-detail', name: 'before_etablissement_detail.png' },
    { url: 'http://localhost:3000/admin/etablissement-detail/approbation', name: 'before_approbation.png' },
    { url: 'http://localhost:3000/admin/utilisateurs', name: 'before_utilisateurs.png' },
  ];

  for (const item of pages) {
    console.log(`Navigating to ${item.url}...`);
    try {
      await page.goto(item.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `docs/screenshots/declarants/${item.name}`, fullPage: true });
      console.log(`Saved docs/screenshots/declarants/${item.name}`);
    } catch (err) {
      console.error(`Error on ${item.url}:`, err.message);
    }
  }

  await browser.close();
  console.log('Screenshots completed!');
})();
