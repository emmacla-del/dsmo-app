const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  fs.mkdirSync('docs/screenshots', { recursive: true });
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

  console.log('1. Navigating to /admin/pilotage...');
  try {
    await page.goto('http://localhost:3005/admin/pilotage', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/screenshots/pilotage.png', fullPage: true });
    console.log('Saved docs/screenshots/pilotage.png');
  } catch (err) {
    console.error('Pilotage error:', err.message);
  }

  console.log('2. Navigating to /admin/dossiers...');
  try {
    await page.goto('http://localhost:3005/admin/dossiers', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/screenshots/dossiers.png', fullPage: true });
    console.log('Saved docs/screenshots/dossiers.png');
  } catch (err) {
    console.error('Dossiers error:', err.message);
  }

  console.log('3. Navigating to /admin/activite (NEW dedicated view)...');
  try {
    await page.goto('http://localhost:3005/admin/activite', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/screenshots/activite_alertes.png', fullPage: true });
    console.log('Saved docs/screenshots/activite_alertes.png');
  } catch (err) {
    console.error('Activite error:', err.message);
  }

  console.log('4. Navigating to /admin/dossiers/ENT-2026-04521...');
  try {
    await page.goto('http://localhost:3005/admin/dossiers/ENT-2026-04521', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/screenshots/dossier_detail.png', fullPage: true });
    console.log('Saved docs/screenshots/dossier_detail.png');

    const correctionBtn = page.getByRole('button', { name: /Demander une correction/i });
    if (await correctionBtn.count() > 0) {
      await correctionBtn.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'docs/screenshots/retour_correction.png' });
      console.log('Saved docs/screenshots/retour_correction.png');
    }
  } catch (err) {
    console.error('Detail error:', err.message);
  }

  await browser.close();
  console.log('All screenshots completed successfully!');
})();
