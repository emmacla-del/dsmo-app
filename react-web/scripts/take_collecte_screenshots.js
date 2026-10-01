const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  fs.mkdirSync('docs/screenshots/collecte', { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Set auth state for Super Admin (Littoral)
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

  console.log('1. Navigating to /admin/campagnes...');
  try {
    await page.goto('http://localhost:3000/admin/campagnes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/screenshots/collecte/current_campagnes.png', fullPage: true });
    console.log('Saved docs/screenshots/collecte/current_campagnes.png');
  } catch (err) {
    console.error('Campagnes error:', err.message);
  }

  console.log('2. Navigating to /admin/questionnaires...');
  try {
    await page.goto('http://localhost:3000/admin/questionnaires', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/screenshots/collecte/current_questionnaires.png', fullPage: true });
    console.log('Saved docs/screenshots/collecte/current_questionnaires.png');
  } catch (err) {
    console.error('Questionnaires error:', err.message);
  }

  await browser.close();
  console.log('Screenshots completed!');
})();
