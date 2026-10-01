const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  fs.mkdirSync('docs/screenshots/collecte', { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

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

  // Test 1: Campagnes - Details modal
  console.log('Testing /admin/campagnes details modal...');
  await page.goto('http://localhost:3000/admin/campagnes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Voir les détails/i }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/collecte/campagne_details_modal.png' });
  console.log('Saved campagne_details_modal.png');

  // Close details
  await page.getByRole('button', { name: /Fermer/i }).first().click();
  await page.waitForTimeout(300);

  // Test 2: Campagnes - Close modal
  console.log('Testing /admin/campagnes close modal...');
  await page.getByRole('button', { name: /Clôturer la Campagne/i }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/collecte/campagne_close_modal.png' });
  console.log('Saved campagne_close_modal.png');

  // Cancel close
  await page.getByRole('button', { name: /Annuler/i }).click();
  await page.waitForTimeout(300);

  // Test 3: Questionnaires - Preview modal
  console.log('Testing /admin/questionnaires preview modal...');
  await page.goto('http://localhost:3000/admin/questionnaires', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Aperçu/i }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/collecte/questionnaire_preview_modal.png' });
  console.log('Saved questionnaire_preview_modal.png');

  // Close preview
  await page.getByRole('button', { name: /Fermer/i }).first().click();
  await page.waitForTimeout(300);

  // Test 4: Questionnaires - New questionnaire modal
  console.log('Testing /admin/questionnaires new modal...');
  await page.getByRole('button', { name: /Nouveau Questionnaire/i }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screenshots/collecte/questionnaire_create_modal.png' });
  console.log('Saved questionnaire_create_modal.png');

  await browser.close();
  console.log('All modal tests completed!');
})();
