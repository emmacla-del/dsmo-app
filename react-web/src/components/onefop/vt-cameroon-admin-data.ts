/**
 * Official Cameroon administrative hierarchy, sourced from national census
 * classification, powering the VT wizard's region/department/arrondissement
 * suggestion chips (VT1_4-VT1_7).
 *
 * Canonical 360 Subdivisions, 58 Departments, 10 Regions.
 */
export interface CameroonDepartment {
  name: string;
  subdivisions: string[];
}

export interface CameroonRegion {
  name: string;
  departments: CameroonDepartment[];
}

export const CAMEROON_ADMIN_HIERARCHY: CameroonRegion[] = [
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

const REGION_NAME_EN: Record<string, string> = {
  "Adamaoua": "Adamawa",
  "Centre": "Centre",
  "Est": "East",
  "Extrême-Nord": "Far North",
  "Littoral": "Littoral",
  "Nord": "North",
  "Nord-Ouest": "North-West",
  "Ouest": "West",
  "Sud": "South",
  "Sud-Ouest": "South-West",
};

export function regionDisplayName(frenchName: string, locale: string): string {
  if (!locale.startsWith("en")) return frenchName;
  return REGION_NAME_EN[frenchName] ?? frenchName;
}

export function findCameroonRegion(name: string | null | undefined): CameroonRegion | null {
  if (!name || !name.trim()) return null;
  const clean = name.trim().toLowerCase();
  return (
    CAMEROON_ADMIN_HIERARCHY.find(
      (r) =>
        r.name.toLowerCase() === clean ||
        (REGION_NAME_EN[r.name] && REGION_NAME_EN[r.name].toLowerCase() === clean),
    ) ?? null
  );
}

export function findCameroonDepartment(
  deptName: string | null | undefined,
  regionName?: string | null,
): CameroonDepartment | null {
  if (!deptName || !deptName.trim()) return null;
  const cleanDept = deptName.trim().toLowerCase();
  const region = findCameroonRegion(regionName);
  const regionsToSearch = region ? [region] : CAMEROON_ADMIN_HIERARCHY;
  for (const r of regionsToSearch) {
    const dept = r.departments.find((d) => d.name.toLowerCase() === cleanDept);
    if (dept) return dept;
  }
  return null;
}

export function findCameroonSubdivision(
  subdivName: string | null | undefined,
  deptName?: string | null,
  regionName?: string | null,
): string | null {
  if (!subdivName || !subdivName.trim()) return null;
  const cleanSubdiv = subdivName.trim().toLowerCase();
  const dept = findCameroonDepartment(deptName, regionName);
  if (dept) {
    const found = dept.subdivisions.find((s) => s.toLowerCase() === cleanSubdiv);
    if (found) return found;
  } else if (!deptName) {
    const region = findCameroonRegion(regionName);
    const regionsToSearch = region ? [region] : CAMEROON_ADMIN_HIERARCHY;
    for (const r of regionsToSearch) {
      for (const d of r.departments) {
        const found = d.subdivisions.find((s) => s.toLowerCase() === cleanSubdiv);
        if (found) return found;
      }
    }
  }
  return null;
}

export function getValidDepartments(regionName: string | null | undefined): string[] {
  const region = findCameroonRegion(regionName);
  return region ? region.departments.map((d) => d.name) : [];
}

export function getValidSubdivisions(
  deptName: string | null | undefined,
  regionName?: string | null | undefined,
): string[] {
  const dept = findCameroonDepartment(deptName, regionName);
  return dept ? dept.subdivisions : [];
}

export function validateCameroonGeography(
  region?: string | null,
  dept?: string | null,
  subdiv?: string | null,
): {
  valid: boolean;
  errorField?: "region" | "department" | "subdivision";
  errorMessage?: { fr: string; en: string };
} {
  if (!region || !region.trim()) return { valid: true };
  const regObj = findCameroonRegion(region);
  if (!regObj) {
    return {
      valid: false,
      errorField: "region",
      errorMessage: {
        fr: `Région '${region}' non reconnue`,
        en: `Unrecognized region '${region}'`,
      },
    };
  }

  if (dept && dept.trim()) {
    const deptObj = regObj.departments.find((d) => d.name.toLowerCase() === dept.trim().toLowerCase());
    if (!deptObj) {
      return {
        valid: false,
        errorField: "department",
        errorMessage: {
          fr: `Le département '${dept}' ne fait pas partie de la région ${regObj.name}`,
          en: `Department '${dept}' does not belong to region ${regObj.name}`,
        },
      };
    }

    if (subdiv && subdiv.trim()) {
      const subFound = deptObj.subdivisions.find((s) => s.toLowerCase() === subdiv.trim().toLowerCase());
      if (!subFound) {
        return {
          valid: false,
          errorField: "subdivision",
          errorMessage: {
            fr: `L'arrondissement '${subdiv}' ne fait pas partie du département ${deptObj.name}`,
            en: `Subdivision '${subdiv}' does not belong to department ${deptObj.name}`,
          },
        };
      }
    }
  }

  return { valid: true };
}

