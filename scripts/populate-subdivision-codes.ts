/**
 * scripts/populate-subdivision-codes.ts
 *
 * Populates unique administrative codes for regions, departments, and subdivisions
 * according to the canonical Cameroon administrative hierarchy.
 *
 * Scheme:
 *  - Regions (10): 2-digit code '01' to '10'
 *  - Departments (58): 2-digit code '01' to '58'
 *  - Subdivisions (331): 4-digit code 'DDSS' where:
 *      - DD is the 2-digit department code (01-58)
 *      - SS is the 2-digit subdivision index within that department (01-13)
 *
 * When AuthService or EstablishmentIdGenerator runs:
 *  - subdivision.code.slice(-2) extracts 'SS' (2 digits)
 *  - EstablishmentIdGenerator generates ${prefix}${yearLast2}${serial}${subdivCode}
 *  - All 331 subdivision codes are globally unique in the database
 *
 * Usage:
 *   npx ts-node scripts/populate-subdivision-codes.ts
 *   npx ts-node scripts/populate-subdivision-codes.ts --apply
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split(/\r?\n/)) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        process.env[match[1]] = value;
      }
    }
  }
}

const regionsData = [
  {
    name: 'Adamaoua',
    departments: [
      { name: 'Djérem', subdivisions: ['Mbakaou', 'Ngaoundal', 'Tibati'] },
      { name: 'Faro-et-Déo', subdivisions: ['Galim-Tignère', 'Kontcha', 'Mayo-Baléo', 'Tignère'] },
      { name: 'Mayo-Banyo', subdivisions: ['Bankim', 'Banyo', 'Mayo-Darle', 'Ngan-Ha'] },
      { name: 'Mbéré', subdivisions: ['Djohong', 'Gonmé', 'Meiganga', 'Ngaoui'] },
      { name: 'Vina', subdivisions: ['Belel', 'Martap', 'Meidougou', 'Ngaoundéré I', 'Ngaoundéré II', 'Ngaoundéré III', 'Nyambaka'] },
    ],
  },
  {
    name: 'Centre',
    departments: [
      { name: 'Haute-Sanaga', subdivisions: ['Lembe-Yezoum', 'Minta', 'Nanga-Eboko', 'Nkoteng'] },
      { name: 'Lékié', subdivisions: ['Batchenga', 'Ebebda', 'Elig-Mfomo', 'Evodoula', 'Monatélé', 'Obala', "Sa'a"] },
      { name: 'Mbam-et-Inoubou', subdivisions: ['Bafia', 'Bokito', 'Deuk', 'Kiiki', 'Koro', 'Makénéné', 'Ndikiniméki', 'Nitoukou', 'Ombessa'] },
      { name: 'Mbam-et-Kim', subdivisions: ['Mbangassina', 'Ngambe-Tikar', 'Ngoro', 'Ntui', 'Yoko'] },
      { name: 'Méfou-et-Afamba', subdivisions: ['Awaé', 'Esse', 'Mfou', 'Nkolafamba', 'Soa', 'Yaoundé VII'] },
      { name: 'Méfou-et-Akono', subdivisions: ['Akono', 'Bikok', 'Dzeng', 'Mengueme', 'Ngog-Mapubi', 'Ngoumou'] },
      { name: 'Mfoundi', subdivisions: ['Yaoundé I', 'Yaoundé II', 'Yaoundé III', 'Yaoundé IV', 'Yaoundé V', 'Yaoundé VI'] },
      { name: 'Nyong-et-Kellé', subdivisions: ['Éséka', 'Makak', 'Matomb', 'Messondo', 'Ngog-Mapubi', 'Nyanon', 'Pouma'] },
      { name: 'Nyong-et-Mfoumou', subdivisions: ['Akonolinga', 'Ayos', 'Endom', 'Kobdombo', 'Menomale', 'Ngomedzap'] },
      { name: "Nyong-et-So'o", subdivisions: ['Dzeng', 'Mbalmayo', 'Mbankomo', 'Mengueme', 'Mfou', 'Ngomedzap', 'Ngoumou'] },
    ],
  },
  {
    name: 'Est',
    departments: [
      { name: 'Boumba-et-Ngoko', subdivisions: ['Gari-Gombo', 'Moloundou', 'Salapoumbé', 'Yokadouma'] },
      { name: 'Haut-Nyong', subdivisions: ['Abong-Mbang', 'Angossas', 'Atok', 'Dimako', 'Doumaintang', 'Doume', 'Lomié', 'Mboma', 'Messamena', 'Mindourou', 'Ngoyla', 'Nguelemendouka', 'Somalomo'] },
      { name: 'Kadey', subdivisions: ['Batouri', 'Kette', 'Mbang', 'Ndelele', 'Nguelebok', 'Ouli'] },
      { name: 'Lom-et-Djérem', subdivisions: ['Bélabo', 'Bertoua I', 'Bertoua II', 'Betaré-Oya', 'Diang', 'Ngoura'] },
    ],
  },
  {
    name: 'Extrême-Nord',
    departments: [
      { name: 'Diamaré', subdivisions: ['Gazawa', 'Maroua I', 'Maroua II', 'Maroua III', 'Meri', 'Ndoukoula', 'Pette'] },
      { name: 'Logone-et-Chari', subdivisions: ['Fotokol', 'Goulfey', 'Hilé-Alifa', 'Kousseri', 'Logone-Birni', 'Makary', 'Waza', 'Zina'] },
      { name: 'Mayo-Danay', subdivisions: ['Datcheka', 'Gazawa', 'Kaélé', 'Kar-Hay', 'Maga', 'Mindif', 'Moulouvaye', 'Tchatibali', 'Yagoua'] },
      { name: 'Mayo-Kani', subdivisions: ['Blangoua', 'Guidiguis', 'Kaïkaï', 'Moulvoudaye', 'Tchanaga', 'Toulourou'] },
      { name: 'Mayo-Sava', subdivisions: ['Kolofata', 'Limani', 'Méri', 'Mora', 'Tokombéré'] },
      { name: 'Mayo-Tsanaga', subdivisions: ['Bourha', 'Hina', 'Koza', 'Mogodé', 'Mokolo', 'Mozogo', 'Roua', 'Soulédé-Roua'] },
    ],
  },
  {
    name: 'Littoral',
    departments: [
      { name: 'Moungo', subdivisions: ['Bare-Bakem', 'Bonalea', 'Dibombari', 'Ekom', 'Loum', 'Manjo', 'Mbanga', 'Melong', 'Mombo', 'Njombe-Penja', 'Nkongsamba I', 'Nkongsamba II', 'Nkongsamba III'] },
      { name: 'Nkam', subdivisions: ['Ndom', 'Ngambe', 'Yabassi', 'Yingui'] },
      { name: 'Sanaga-Maritime', subdivisions: ['Dibamba', 'Dizangue', 'Édéa I', 'Édéa II', 'Mouanko', 'Ndom', 'Ngambe', 'Nyanon', 'Pouma'] },
      { name: 'Wouri', subdivisions: ['Douala I', 'Douala II', 'Douala III', 'Douala IV', 'Douala V', 'Manoka'] },
    ],
  },
  {
    name: 'Nord',
    departments: [
      { name: 'Bénoué', subdivisions: ['Bibemi', 'Dembo', 'Garoua I', 'Garoua II', 'Garoua III', 'Lagdo', 'Ngong', 'Pitoa', 'Tchéboa'] },
      { name: 'Faro', subdivisions: ['Beka', 'Poli'] },
      { name: 'Mayo-Louti', subdivisions: ['Figuil', 'Guider', 'Mayo-Oulo'] },
      { name: 'Mayo-Rey', subdivisions: ['Pignde', 'Rey-Bouba', 'Tcholliré', 'Touboro'] },
    ],
  },
  {
    name: 'Nord-Ouest',
    departments: [
      { name: 'Boyo', subdivisions: ['Belo', 'Fonfuka', 'Fundong'] },
      { name: 'Bui', subdivisions: ['Jakiri', 'Kumbo', 'Mbven', 'Nkum', 'Noni', 'Oku'] },
      { name: 'Donga-Mantung', subdivisions: ['Ako', 'Ndu', 'Nkambe', 'Nwa'] },
      { name: 'Menchum', subdivisions: ['Benakuma', 'Fungom', 'Wum', 'Zhoa'] },
      { name: 'Mezam', subdivisions: ['Bafut', 'Bali', 'Bamenda I', 'Bamenda II', 'Bamenda III', 'Santa', 'Tubah'] },
      { name: 'Momo', subdivisions: ['Batibo', 'Mbengwi', 'Njikwa', 'Widikum-Menka'] },
      { name: 'Ngo-Ketunjia', subdivisions: ['Babessi', 'Balikumbat', 'Ndop'] },
    ],
  },
  {
    name: 'Ouest',
    departments: [
      { name: 'Bamboutos', subdivisions: ['Babadjou', 'Batcham', 'Galim', 'Mbouda'] },
      { name: 'Haut-Nkam', subdivisions: ['Bafang', 'Banka', 'Bandja', 'Batcham', 'Kekem'] },
      { name: 'Hauts-Plateaux', subdivisions: ['Baham', 'Bamendjou', 'Bangou', 'Bansoa'] },
      { name: 'Koung-Khi', subdivisions: ['Bamendjou', 'Kouoptamo', 'Poumougne'] },
      { name: 'Menoua', subdivisions: ['Dschang', 'Fongo-Tongo', 'Fokoué', 'Kekem', 'Nkong-Ni', 'Penka-Michel', 'Santchou'] },
      { name: 'Mifi', subdivisions: ['Bafoussam I', 'Bafoussam II', 'Bafoussam III'] },
      { name: 'Ndé', subdivisions: ['Bangangté', 'Bassamba', 'Bazou', 'Tonga'] },
      { name: 'Noun', subdivisions: ['Foumban', 'Foumbot', 'Kouoptamo', 'Koutaba', 'Magba', 'Malantouen', 'Massangam', 'Njimom'] },
    ],
  },
  {
    name: 'Sud',
    departments: [
      { name: 'Dja-et-Lobo', subdivisions: ['Bengbis', 'Djoum', 'Meyomessala', 'Meyomessi', 'Mintom', 'Mvangan', 'Oveng', 'Sangmélima'] },
      { name: 'Mvila', subdivisions: ['Ambam', 'Bengbis', 'Ebolowa I', 'Ebolowa II', 'Efoulan', "Ma'an", 'Mengong', 'Mvangan', 'Ngoulemakong'] },
      { name: 'Océan', subdivisions: ['Akom II', 'Campo', 'Grand Batanga', 'Kribi I', 'Kribi II', 'Lolodorf', 'Mvengue'] },
      { name: 'Vallée-du-Ntem', subdivisions: ['Biwong-Bané', 'Biwong-Bulu', 'Djoum', 'Meyomessala', 'Nkpwa'] },
    ],
  },
  {
    name: 'Sud-Ouest',
    departments: [
      { name: 'Fako', subdivisions: ['Buea', 'Limbe I', 'Limbe II', 'Limbe III', 'Muyuka', 'Tiko'] },
      { name: 'Koupé-Muanenguba', subdivisions: ['Bangem', 'Nguti', 'Tombel'] },
      { name: 'Lebialem', subdivisions: ['Alou', 'Fontem', 'Wabane'] },
      { name: 'Manyu', subdivisions: ['Akwaya', 'Eyumojock', 'Mamfe', 'Tinto'] },
      { name: 'Meme', subdivisions: ['Konye', 'Kumba I', 'Kumba II', 'Kumba III', 'Mbonge'] },
      { name: 'Ndian', subdivisions: ['Ekondo-Titi', 'Isangele', 'Kombo-Abedimo', 'Kombo-Itindi', 'Mundemba'] },
    ],
  },
];

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`\n=== Populate Subdivision Codes (${isApply ? 'APPLY' : 'DRY-RUN'} MODE) ===\n`);

  const prisma = new PrismaClient();

  try {
    const [regions, departments, subdivisions] = await Promise.all([
      prisma.region.findMany(),
      prisma.department.findMany(),
      prisma.subdivision.findMany(),
    ]);

    const regionByName = new Map(regions.map((r) => [r.name, r]));
    const deptByRegionAndName = new Map(departments.map((d) => [`${d.regionId}::${d.name}`, d]));
    const subByDeptAndName = new Map(subdivisions.map((s) => [`${s.departmentId}::${s.name}`, s]));

    const regionUpdates: Array<{ id: string; name: string; oldCode: string | null; newCode: string }> = [];
    const deptUpdates: Array<{ id: string; name: string; oldCode: string | null; newCode: string }> = [];
    const subUpdates: Array<{ id: string; name: string; deptName: string; regionName: string; oldCode: string | null; newCode: string }> = [];

    let deptGlobalIndex = 0;

    for (let rIdx = 0; rIdx < regionsData.length; rIdx++) {
      const r = regionsData[rIdx];
      const regionCode = String(rIdx + 1).padStart(2, '0');
      const regRecord = regionByName.get(r.name);
      if (!regRecord) {
        console.warn(`WARNING: Region '${r.name}' not found in database.`);
        continue;
      }
      if (regRecord.code !== regionCode) {
        regionUpdates.push({ id: regRecord.id, name: regRecord.name, oldCode: regRecord.code, newCode: regionCode });
      }

      for (let dIdx = 0; dIdx < r.departments.length; dIdx++) {
        deptGlobalIndex++;
        const d = r.departments[dIdx];
        const deptCode = String(deptGlobalIndex).padStart(2, '0');
        const deptRecord = deptByRegionAndName.get(`${regRecord.id}::${d.name}`);
        if (!deptRecord) {
          console.warn(`WARNING: Department '${d.name}' in region '${r.name}' not found in database.`);
          continue;
        }
        if (deptRecord.code !== deptCode) {
          deptUpdates.push({ id: deptRecord.id, name: deptRecord.name, oldCode: deptRecord.code, newCode: deptCode });
        }

        for (let sIdx = 0; sIdx < d.subdivisions.length; sIdx++) {
          const subName = d.subdivisions[sIdx];
          const subIndex = String(sIdx + 1).padStart(2, '0');
          const subCode = `${deptCode}${subIndex}`;
          const subRecord = subByDeptAndName.get(`${deptRecord.id}::${subName}`);
          if (!subRecord) {
            console.warn(`WARNING: Subdivision '${subName}' in department '${d.name}' not found in database.`);
            continue;
          }
          if (subRecord.code !== subCode) {
            subUpdates.push({
              id: subRecord.id,
              name: subRecord.name,
              deptName: d.name,
              regionName: r.name,
              oldCode: subRecord.code,
              newCode: subCode,
            });
          }
        }
      }
    }

    console.log(`Regions to update:     ${regionUpdates.length} / ${regions.length}`);
    console.log(`Departments to update: ${deptUpdates.length} / ${departments.length}`);
    console.log(`Subdivisions to update: ${subUpdates.length} / ${subdivisions.length}\n`);

    if (subUpdates.length > 0) {
      console.log('Sample subdivision updates:');
      for (const s of subUpdates.slice(0, 10)) {
        console.log(`  [${s.regionName} > ${s.deptName}] ${s.name}: ${s.oldCode ?? 'null'} -> ${s.newCode} (suffix ${s.newCode.slice(-2)})`);
      }
      if (subUpdates.length > 10) {
        console.log(`  ... and ${subUpdates.length - 10} more.`);
      }
    }

    if (!isApply) {
      console.log('\nDRY-RUN complete. Run with --apply to write changes to the database.');
      return;
    }

    console.log('\nApplying updates in transaction...');
    await prisma.$transaction(
      async (tx) => {
        for (const r of regionUpdates) {
          await tx.region.update({ where: { id: r.id }, data: { code: r.newCode } });
        }
        for (const d of deptUpdates) {
          await tx.department.update({ where: { id: d.id }, data: { code: d.newCode } });
        }
        for (const s of subUpdates) {
          await tx.subdivision.update({ where: { id: s.id }, data: { code: s.newCode } });
        }
      },
      { timeout: 60000 },
    );

    console.log('✅ Successfully applied all territory code updates!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
