import * as fs from 'fs';

async function run() {
  console.log('🔑 1. Logging in as walti@gmail.com...');
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'walti@gmail.com', password: 'password123' })
  });

  if (!loginRes.ok) {
    console.error('❌ Login failed:', loginRes.status, await loginRes.text());
    process.exit(1);
  }

  const loginData = await loginRes.json();
  const token = loginData.access_token || loginData.accessToken || loginData.token;
  console.log('✅ Logged in successfully! Role:', loginData.user?.role, 'Company:', loginData.company?.name);

  // 2. Progressive VT Form Data (as the user fills it out)
  console.log('\n📝 2. Filling out Vocational Training (VT) form fields...');
  const vtFormData: Record<string, unknown> = {
    // S1 Identification
    VT1_1: 'Centre de Formation Professionnelle Waltz Tech',
    VT1_2: 'Waltz Training Academy',
    VT1_3: 'Centre',
    VT1_4: 'Mfoundi',
    VT1_5: 'Yaoundé 1er',
    VT1_6: 'Bastos, Rue 1.450',
    VT1_7: '237699112233',
    VT1_8: 'contact@waltz.cm',
    VT1_9: 'Privé laïc',
    VT1_10: 2018,
    VT1_11: 'Arrêté N° 00412/MINEFOP/SG/DFOP/2018',
    VT1_12: true, // Agréé MINEFOP
    VT1_15_NAME: 'Walti Walter',
    VT1_15_FUNCTION: 'Directeur Général',
    VT1_15_PHONE: '699112233',
    VT1_15_EMAIL: 'walti@gmail.com',

    // S2 Centre Infrastructure & Pedagogy
    VT2_1: 4, // Salles de cours
    VT2_2: 2, // Ateliers pratiques
    VT2_3: 35, // Postes informatiques
    VT2_4: true, // Connexion Internet disponible
    VT2_5: true, // Bibliothèque / Centre de ressources

    // S3 Formateurs / Enseignants
    VT3_TOTAL_TRAINERS: 12,
    VT3_PERMANENT_MALE: 6,
    VT3_PERMANENT_FEMALE: 4,
    VT3_VACANT_MALE: 2,
    VT3_VACANT_FEMALE: 0,

    // S4 Specialités & Apprenants
    VT4_SECTOR: 'Technologies de l Information et de la Communication',
    VT4_SPECIALTY_1: 'Développement Web et Mobile',
    VT4_SPECIALTY_1_STUDENTS_M: 25,
    VT4_SPECIALTY_1_STUDENTS_F: 18,
    VT4_SPECIALTY_2: 'Administration Réseaux et Cybersécurité',
    VT4_SPECIALTY_2_STUDENTS_M: 20,
    VT4_SPECIALTY_2_STUDENTS_F: 10,
  };

  console.log('   Filled fields:', Object.keys(vtFormData).length);

  // 3. Request progressive official HTML preview (0% Chrome, 100% offline)
  console.log('\n📄 3. Requesting Live Official HTML Preview from backend (/api/onefop/preview)...');
  const previewStart = Date.now();
  const previewRes = await fetch('http://localhost:3001/api/onefop/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      entityType: 'vocationalTraining',
      quarterCode: '2026-T4',
      locale: 'fr',
      format: 'html',
      data: vtFormData,
    }),
  });

  const previewDuration = Date.now() - previewStart;
  console.log(`⏱️ Preview response received in ${previewDuration}ms with status: ${previewRes.status}`);

  if (!previewRes.ok) {
    console.error('❌ Preview failed:', await previewRes.text());
    process.exit(1);
  }

  const html = await previewRes.text();
  console.log(`✅ Official HTML preview received! Size: ${(html.length / 1024).toFixed(1)} KB`);
  console.log('   Content-Type:', previewRes.headers.get('content-type'));

  // Verify preview content
  const hasTitle = html.includes('MINISTÈRE') || html.includes('FORMATION PROFESSIONNELLE') || html.includes('ONEFOP');
  const hasEstablishment = html.includes('Waltz') || html.includes('699112233');
  console.log('   Contains official header elements:', hasTitle);
  console.log('   Contains user filled data (Waltz):', hasEstablishment);

  fs.writeFileSync('test-vt-preview-output.html', html, 'utf-8');
  console.log('💾 Saved preview HTML to test-vt-preview-output.html');
  console.log('🎉 Live progressive preview successfully generated without Chrome!');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
