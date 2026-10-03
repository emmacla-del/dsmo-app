/**
 * scripts/populate-subdivision-codes.ts
 *
 * Populates unique administrative codes for regions, departments, and subdivisions
 * according to the canonical Cameroon administrative hierarchy.
 *
 * Scheme:
 *  - Regions (10): 2-digit code '01' to '10'
 *  - Departments (58): 2-digit code '01' to '58'
 *  - Subdivisions (360): 4-digit code 'DDSS' where:
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
    "name": "Adamaoua",
    "departments": [
      {
        "name": "Djérem",
        "subdivisions": [
          "Ngaoundal",
          "Tibati"
        ]
      },
      {
        "name": "Faro-et-Déo",
        "subdivisions": [
          "Galim-Tignère",
          "Kontcha",
          "Mayo-Baléo",
          "Tignère"
        ]
      },
      {
        "name": "Mayo-Banyo",
        "subdivisions": [
          "Bankim",
          "Banyo",
          "Mayo-Darlé"
        ]
      },
      {
        "name": "Mbéré",
        "subdivisions": [
          "Dir",
          "Djohong",
          "Meiganga",
          "Ngaoui"
        ]
      },
      {
        "name": "Vina",
        "subdivisions": [
          "Bélél",
          "Martap",
          "Mbé",
          "Nganha",
          "Ngaoundéré 1",
          "Ngaoundéré 2",
          "Ngaoundéré 3",
          "Nyambaka"
        ]
      }
    ]
  },
  {
    "name": "Centre",
    "departments": [
      {
        "name": "Haute-Sanaga",
        "subdivisions": [
          "Bibey",
          "Lembe-Yezoum",
          "Mbandjock",
          "Minta",
          "Nanga-Eboko",
          "Nkoteng",
          "Nsem"
        ]
      },
      {
        "name": "Lékié",
        "subdivisions": [
          "Batchenga",
          "Ebebda",
          "Elig-Mfomo",
          "Evodoula",
          "Lobo",
          "Monatélé",
          "Obala",
          "Okola",
          "Sa'a"
        ]
      },
      {
        "name": "Mbam-et-Inoubou",
        "subdivisions": [
          "Bafia",
          "Bokito",
          "Deuk",
          "Kiiki",
          "Kom-Yambetta",
          "Makenene",
          "Ndikinimeki",
          "Nitoukou",
          "Ombessa"
        ]
      },
      {
        "name": "Mbam-et-Kim",
        "subdivisions": [
          "Mbangassina",
          "Ngambé-Tikar",
          "Ngoro",
          "Ntui",
          "Yoko"
        ]
      },
      {
        "name": "Mefou-et-Afamba",
        "subdivisions": [
          "Afanloum",
          "Assamba",
          "Awaé",
          "Edzendouan",
          "Esse",
          "Mfou",
          "Nkolafamba",
          "Soa"
        ]
      },
      {
        "name": "Mefou-et-Akono",
        "subdivisions": [
          "Akono",
          "Bikok",
          "Mbankomo",
          "Ngoumou"
        ]
      },
      {
        "name": "Mfoundi",
        "subdivisions": [
          "Yaoundé 1",
          "Yaoundé 2",
          "Yaoundé 3",
          "Yaoundé 4",
          "Yaoundé 5",
          "Yaoundé 6",
          "Yaoundé 7"
        ]
      },
      {
        "name": "Nyong-et-Kellé",
        "subdivisions": [
          "Biyouha",
          "Bondjock",
          "Bot-Makak",
          "Dibang",
          "Eséka",
          "Makak",
          "Matomb",
          "Messondo",
          "Ngog-Mapubi",
          "Nguibassal"
        ]
      },
      {
        "name": "Nyong-et-Mfoumou",
        "subdivisions": [
          "Akonolinga",
          "Ayos",
          "Endom",
          "Mengang",
          "Nyakokombo"
        ]
      },
      {
        "name": "Nyong-et-So'o",
        "subdivisions": [
          "Akoeman",
          "Dzeng",
          "Mbalmayo",
          "Mengueme",
          "Ngomedzap",
          "Nkolmetet"
        ]
      }
    ]
  },
  {
    "name": "Est",
    "departments": [
      {
        "name": "Boumba-et-Ngoko",
        "subdivisions": [
          "Gari-Gombo",
          "Moloundou",
          "Salapoumbé",
          "Yokadouma"
        ]
      },
      {
        "name": "Haut-Nyong",
        "subdivisions": [
          "Abong-Mbang",
          "Bebend",
          "Dja",
          "Doumaintang",
          "Doumé",
          "Lomié",
          "Mboanz",
          "Mboma",
          "Messaména",
          "Messok",
          "Mindourou",
          "Ngoyla",
          "Nguelemendouka",
          "Somalomo"
        ]
      },
      {
        "name": "Kadey",
        "subdivisions": [
          "Batouri",
          "Bombé",
          "Kétté",
          "Mbang",
          "Mbotoro",
          "Ndélélé",
          "Ndem-Nam"
        ]
      },
      {
        "name": "Lom-et-Djérem",
        "subdivisions": [
          "Belabo",
          "Bertoua 1",
          "Bertoua 2",
          "Bétaré-Oya",
          "Diang",
          "Garoua-Boulaï",
          "Mandjou",
          "Ngoura"
        ]
      }
    ]
  },
  {
    "name": "Extrême-Nord",
    "departments": [
      {
        "name": "Diamaré",
        "subdivisions": [
          "Bogo",
          "Dargala",
          "Gazawa",
          "Maroua 1",
          "Maroua 2",
          "Maroua 3",
          "Méri",
          "Ndoukoula",
          "Petté"
        ]
      },
      {
        "name": "Logone-et-Chari",
        "subdivisions": [
          "Blangoua",
          "Darak",
          "Fotokol",
          "Goulfey",
          "Hile-Halifa",
          "Kousseri",
          "Logone-Birni",
          "Makary",
          "Waza",
          "Zina"
        ]
      },
      {
        "name": "Mayo-Danay",
        "subdivisions": [
          "Datchéka",
          "Gobo",
          "Guéré",
          "Kai-Kai",
          "Kalfou",
          "Kar-Hay",
          "Maga",
          "Tchatibali",
          "Vélé",
          "Wina",
          "Yagoua"
        ]
      },
      {
        "name": "Mayo-Kani",
        "subdivisions": [
          "Guidiguis",
          "Kaélé",
          "Mindif",
          "Moulvoudaye",
          "Moutourwa",
          "Porhi",
          "Taibong"
        ]
      },
      {
        "name": "Mayo-Sava",
        "subdivisions": [
          "Kolofata",
          "Mora",
          "Tokombéré"
        ]
      },
      {
        "name": "Mayo-Tsanaga",
        "subdivisions": [
          "Bourrha",
          "Hina",
          "Koza",
          "Mayo-Moskota",
          "Mogodé",
          "Mokolo",
          "Soulede-Roua"
        ]
      }
    ]
  },
  {
    "name": "Littoral",
    "departments": [
      {
        "name": "Moungo",
        "subdivisions": [
          "Baré-Bakem",
          "Dibombari",
          "Fiko",
          "Loum",
          "Manjo",
          "Mbanga",
          "Melong",
          "Mombo",
          "Njombé-Penja",
          "Nkongsamba 1",
          "Nkongsamba 2",
          "Nkongsamba 3",
          "Nlonako"
        ]
      },
      {
        "name": "Nkam",
        "subdivisions": [
          "Nkondjock",
          "Nord-Makombe",
          "Yabassi",
          "Yingui"
        ]
      },
      {
        "name": "Sanaga-Maritime",
        "subdivisions": [
          "Dibamba",
          "Dizangué",
          "Edéa 1",
          "Edéa 2",
          "Massock-Songloulou",
          "Mouanko",
          "Ndom",
          "Ngambé",
          "Ngwei",
          "Nyanon",
          "Pouma"
        ]
      },
      {
        "name": "Wouri",
        "subdivisions": [
          "Douala 1",
          "Douala 2",
          "Douala 3",
          "Douala 4",
          "Douala 5",
          "Douala 6"
        ]
      }
    ]
  },
  {
    "name": "Nord",
    "departments": [
      {
        "name": "Bénoué",
        "subdivisions": [
          "Baschéo",
          "Bibemi",
          "Dembo",
          "Demsa",
          "Garoua 1",
          "Garoua 2",
          "Garoua 3",
          "Lagdo",
          "Mayo-Hourna",
          "Pitoa",
          "Tcheboa",
          "Touroua"
        ]
      },
      {
        "name": "Faro",
        "subdivisions": [
          "Béka",
          "Poli"
        ]
      },
      {
        "name": "Mayo-Louti",
        "subdivisions": [
          "Figuil",
          "Guider",
          "Mayo-Oulo"
        ]
      },
      {
        "name": "Mayo-Rey",
        "subdivisions": [
          "Madingring",
          "Rey-Bouba",
          "Tcholliré",
          "Touboro"
        ]
      }
    ]
  },
  {
    "name": "Nord-Ouest",
    "departments": [
      {
        "name": "Boyo",
        "subdivisions": [
          "Belo",
          "Bum",
          "Fundong",
          "Njinikom"
        ]
      },
      {
        "name": "Bui",
        "subdivisions": [
          "Jakiri",
          "Kumbo",
          "Mbven",
          "Nkum",
          "Noni",
          "Oku"
        ]
      },
      {
        "name": "Donga-Mantung",
        "subdivisions": [
          "Ako",
          "Misaje",
          "Ndu",
          "Nkambe",
          "Nwa"
        ]
      },
      {
        "name": "Menchum",
        "subdivisions": [
          "Fungom",
          "Furu-Awa",
          "Menchum-Valley",
          "Wum"
        ]
      },
      {
        "name": "Mezam",
        "subdivisions": [
          "Bafut",
          "Bali",
          "Bamenda 1",
          "Bamenda 2",
          "Bamenda 3",
          "Santa",
          "Tubah"
        ]
      },
      {
        "name": "Momo",
        "subdivisions": [
          "Batibo",
          "Mbengwi",
          "Ngie",
          "Njikwa",
          "Widikum-Menka"
        ]
      },
      {
        "name": "Ngo-Ketunjia",
        "subdivisions": [
          "Babessi",
          "Balikumbat",
          "Ndop"
        ]
      }
    ]
  },
  {
    "name": "Ouest",
    "departments": [
      {
        "name": "Bamboutos",
        "subdivisions": [
          "Babadjou",
          "Batcham",
          "Galim",
          "Mbouda"
        ]
      },
      {
        "name": "Haut-Nkam",
        "subdivisions": [
          "Bafang",
          "Bakou",
          "Bana",
          "Bandja",
          "Banka",
          "Banwa",
          "Kékem"
        ]
      },
      {
        "name": "Hauts-Plateaux",
        "subdivisions": [
          "Baham",
          "Bamendjou",
          "Bangou",
          "Batié"
        ]
      },
      {
        "name": "Koung-Khi",
        "subdivisions": [
          "Bayangam",
          "Djebem",
          "Poumougne"
        ]
      },
      {
        "name": "Menoua",
        "subdivisions": [
          "Dschang",
          "Fokoué",
          "Fongo-Tongo",
          "Nkong-Ni",
          "Penka-Michel",
          "Santchou"
        ]
      },
      {
        "name": "Mifi",
        "subdivisions": [
          "Bafoussam 1",
          "Bafoussam 2",
          "Bafoussam 3"
        ]
      },
      {
        "name": "Ndé",
        "subdivisions": [
          "Bangangté",
          "Bassamba",
          "Bazou",
          "Tonga"
        ]
      },
      {
        "name": "Noun",
        "subdivisions": [
          "Bangourain",
          "Foumban",
          "Foumbot",
          "Kouoptamo",
          "Koutaba",
          "Magba",
          "Malentouen",
          "Massangam",
          "Njimom"
        ]
      }
    ]
  },
  {
    "name": "Sud",
    "departments": [
      {
        "name": "Dja-et-Lobo",
        "subdivisions": [
          "Bengbis",
          "Djoum",
          "Meyomessala",
          "Meyomessi",
          "Mintom",
          "Oveng",
          "Sangmelima",
          "Zoétélé"
        ]
      },
      {
        "name": "Mvila",
        "subdivisions": [
          "Biwong-Bane",
          "Biwong-Bulu",
          "Ebolowa 1",
          "Ebolowa 2",
          "Efoulan",
          "Mengong",
          "Mvangan",
          "Ngoulemakong"
        ]
      },
      {
        "name": "Océan",
        "subdivisions": [
          "Akom II",
          "Bipindi",
          "Campo",
          "Kribi 1",
          "Kribi 2",
          "Lokoundje",
          "Lolodorf",
          "Mvengue",
          "Niété"
        ]
      },
      {
        "name": "Vallée-du-Ntem",
        "subdivisions": [
          "Ambam",
          "Kyé-Ossi",
          "Ma'an",
          "Olamzé"
        ]
      }
    ]
  },
  {
    "name": "Sud-Ouest",
    "departments": [
      {
        "name": "Fako",
        "subdivisions": [
          "Buea",
          "Limbe 1",
          "Limbe 2",
          "Limbe 3",
          "Muyuka",
          "Tiko",
          "West-Coast"
        ]
      },
      {
        "name": "Kupe-Manenguba",
        "subdivisions": [
          "Bangem",
          "Nguti",
          "Tombel"
        ]
      },
      {
        "name": "Lebialem",
        "subdivisions": [
          "Alou",
          "Fontem",
          "Wabane"
        ]
      },
      {
        "name": "Manyu",
        "subdivisions": [
          "Akwaya",
          "Eyumodjock",
          "Mamfe",
          "Upper-Bayang"
        ]
      },
      {
        "name": "Meme",
        "subdivisions": [
          "Konye",
          "Kumba 1",
          "Kumba 2",
          "Kumba 3",
          "Mbonge"
        ]
      },
      {
        "name": "Ndian",
        "subdivisions": [
          "Bamusso",
          "Dikome-Balue",
          "Ekondo Titi",
          "Idabato",
          "Isangele",
          "Kombo-Abedimo",
          "Kombo-Itindi",
          "Mundemba",
          "Toko"
        ]
      }
    ]
  }
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
