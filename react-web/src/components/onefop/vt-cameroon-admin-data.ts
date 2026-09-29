/**
 * Official Cameroon administrative hierarchy, sourced from national census
 * classification, powering the VT wizard's region/department/arrondissement
 * suggestion chips (VT1_4-VT1_7). Ported 1:1 from
 * lib/screens/onefop/wizard/vt_cameroon_admin_data.dart.
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
    name: "Adamaoua",
    departments: [
      { name: "Djérem", subdivisions: ["Mbakaou", "Ngaoundal", "Tibati"] },
      { name: "Faro-et-Déo", subdivisions: ["Galim-Tignère", "Kontcha", "Mayo-Baléo", "Tignère"] },
      { name: "Mayo-Banyo", subdivisions: ["Bankim", "Banyo", "Mayo-Darle", "Ngan-Ha"] },
      { name: "Mbéré", subdivisions: ["Djohong", "Gonmé", "Meiganga", "Ngaoui"] },
      {
        name: "Vina",
        subdivisions: ["Belel", "Martap", "Meidougou", "Ngaoundéré I", "Ngaoundéré II", "Ngaoundéré III", "Nyambaka"],
      },
    ],
  },
  {
    name: "Centre",
    departments: [
      { name: "Haute-Sanaga", subdivisions: ["Lembe-Yezoum", "Minta", "Nanga-Eboko", "Nkoteng"] },
      { name: "Lékié", subdivisions: ["Batchenga", "Ebebda", "Elig-Mfomo", "Evodoula", "Monatélé", "Obala", "Sa'a"] },
      {
        name: "Mbam-et-Inoubou",
        subdivisions: ["Bafia", "Bokito", "Deuk", "Kiiki", "Koro", "Makénéné", "Ndikiniméki", "Nitoukou", "Ombessa"],
      },
      { name: "Mbam-et-Kim", subdivisions: ["Mbangassina", "Ngambe-Tikar", "Ngoro", "Ntui", "Yoko"] },
      { name: "Méfou-et-Afamba", subdivisions: ["Awaé", "Esse", "Mfou", "Nkolafamba", "Soa", "Yaoundé VII"] },
      { name: "Méfou-et-Akono", subdivisions: ["Akono", "Bikok", "Dzeng", "Mengueme", "Ngog-Mapubi", "Ngoumou"] },
      {
        name: "Mfoundi",
        subdivisions: ["Yaoundé I", "Yaoundé II", "Yaoundé III", "Yaoundé IV", "Yaoundé V", "Yaoundé VI"],
      },
      {
        name: "Nyong-et-Kellé",
        subdivisions: ["Éséka", "Makak", "Matomb", "Messondo", "Ngog-Mapubi", "Nyanon", "Pouma"],
      },
      {
        name: "Nyong-et-Mfoumou",
        subdivisions: ["Akonolinga", "Ayos", "Endom", "Kobdombo", "Menomale", "Ngomedzap"],
      },
      {
        name: "Nyong-et-So'o",
        subdivisions: ["Dzeng", "Mbalmayo", "Mbankomo", "Mengueme", "Mfou", "Ngomedzap", "Ngoumou"],
      },
    ],
  },
  {
    name: "Est",
    departments: [
      { name: "Boumba-et-Ngoko", subdivisions: ["Gari-Gombo", "Moloundou", "Salapoumbé", "Yokadouma"] },
      {
        name: "Haut-Nyong",
        subdivisions: [
          "Abong-Mbang", "Angossas", "Atok", "Dimako", "Doumaintang", "Doume", "Lomié", "Mboma",
          "Messamena", "Mindourou", "Ngoyla", "Nguelemendouka", "Somalomo",
        ],
      },
      { name: "Kadey", subdivisions: ["Batouri", "Kette", "Mbang", "Ndelele", "Nguelebok", "Ouli"] },
      {
        name: "Lom-et-Djérem",
        subdivisions: ["Bélabo", "Bertoua I", "Bertoua II", "Betaré-Oya", "Diang", "Ngoura"],
      },
    ],
  },
  {
    name: "Extrême-Nord",
    departments: [
      {
        name: "Diamaré",
        subdivisions: ["Gazawa", "Maroua I", "Maroua II", "Maroua III", "Meri", "Ndoukoula", "Pette"],
      },
      {
        name: "Logone-et-Chari",
        subdivisions: ["Fotokol", "Goulfey", "Hilé-Alifa", "Kousseri", "Logone-Birni", "Makary", "Waza", "Zina"],
      },
      {
        name: "Mayo-Danay",
        subdivisions: ["Datcheka", "Gazawa", "Kaélé", "Kar-Hay", "Maga", "Mindif", "Moulouvaye", "Tchatibali", "Yagoua"],
      },
      {
        name: "Mayo-Kani",
        subdivisions: ["Blangoua", "Guidiguis", "Kaïkaï", "Moulvoudaye", "Tchanaga", "Toulourou"],
      },
      { name: "Mayo-Sava", subdivisions: ["Kolofata", "Limani", "Méri", "Mora", "Tokombéré"] },
      {
        name: "Mayo-Tsanaga",
        subdivisions: ["Bourha", "Hina", "Koza", "Mogodé", "Mokolo", "Mozogo", "Roua", "Soulédé-Roua"],
      },
    ],
  },
  {
    name: "Littoral",
    departments: [
      {
        name: "Moungo",
        subdivisions: [
          "Bare-Bakem", "Bonalea", "Dibombari", "Ekom", "Loum", "Manjo", "Mbanga", "Melong", "Mombo",
          "Njombe-Penja", "Nkongsamba I", "Nkongsamba II", "Nkongsamba III",
        ],
      },
      { name: "Nkam", subdivisions: ["Ndom", "Ngambe", "Yabassi", "Yingui"] },
      {
        name: "Sanaga-Maritime",
        subdivisions: ["Dibamba", "Dizangue", "Édéa I", "Édéa II", "Mouanko", "Ndom", "Ngambe", "Nyanon", "Pouma"],
      },
      { name: "Wouri", subdivisions: ["Douala I", "Douala II", "Douala III", "Douala IV", "Douala V", "Manoka"] },
    ],
  },
  {
    name: "Nord",
    departments: [
      {
        name: "Bénoué",
        subdivisions: ["Bibemi", "Dembo", "Garoua I", "Garoua II", "Garoua III", "Lagdo", "Ngong", "Pitoa", "Tchéboa"],
      },
      { name: "Faro", subdivisions: ["Beka", "Poli"] },
      { name: "Mayo-Louti", subdivisions: ["Figuil", "Guider", "Mayo-Oulo"] },
      { name: "Mayo-Rey", subdivisions: ["Pignde", "Rey-Bouba", "Tcholliré", "Touboro"] },
    ],
  },
  {
    name: "Nord-Ouest",
    departments: [
      { name: "Boyo", subdivisions: ["Belo", "Fonfuka", "Fundong"] },
      { name: "Bui", subdivisions: ["Jakiri", "Kumbo", "Mbven", "Nkum", "Noni", "Oku"] },
      { name: "Donga-Mantung", subdivisions: ["Ako", "Ndu", "Nkambe", "Nwa"] },
      { name: "Menchum", subdivisions: ["Benakuma", "Fungom", "Wum", "Zhoa"] },
      { name: "Mezam", subdivisions: ["Bafut", "Bali", "Bamenda I", "Bamenda II", "Bamenda III", "Santa", "Tubah"] },
      { name: "Momo", subdivisions: ["Batibo", "Mbengwi", "Njikwa", "Widikum-Menka"] },
      { name: "Ngo-Ketunjia", subdivisions: ["Babessi", "Balikumbat", "Ndop"] },
    ],
  },
  {
    name: "Ouest",
    departments: [
      { name: "Bamboutos", subdivisions: ["Babadjou", "Batcham", "Galim", "Mbouda"] },
      { name: "Haut-Nkam", subdivisions: ["Bafang", "Banka", "Bandja", "Batcham", "Kekem"] },
      { name: "Hauts-Plateaux", subdivisions: ["Baham", "Bamendjou", "Bangou", "Bansoa"] },
      { name: "Koung-Khi", subdivisions: ["Bamendjou", "Kouoptamo", "Poumougne"] },
      {
        name: "Menoua",
        subdivisions: ["Dschang", "Fongo-Tongo", "Fokoué", "Kekem", "Nkong-Ni", "Penka-Michel", "Santchou"],
      },
      { name: "Mifi", subdivisions: ["Bafoussam I", "Bafoussam II", "Bafoussam III"] },
      { name: "Ndé", subdivisions: ["Bangangté", "Bassamba", "Bazou", "Tonga"] },
      {
        name: "Noun",
        subdivisions: ["Foumban", "Foumbot", "Kouoptamo", "Koutaba", "Magba", "Malantouen", "Massangam", "Njimom"],
      },
    ],
  },
  {
    name: "Sud",
    departments: [
      {
        name: "Dja-et-Lobo",
        subdivisions: [
          "Bengbis", "Djoum", "Meyomessala", "Meyomessi", "Mintom", "Mvangan", "Oveng", "Sangmélima",
        ],
      },
      {
        name: "Mvila",
        subdivisions: [
          "Ambam", "Bengbis", "Ebolowa I", "Ebolowa II", "Efoulan", "Ma'an", "Mengong", "Mvangan", "Ngoulemakong",
        ],
      },
      {
        name: "Océan",
        subdivisions: ["Akom II", "Campo", "Grand Batanga", "Kribi I", "Kribi II", "Lolodorf", "Mvengue"],
      },
      { name: "Vallée-du-Ntem", subdivisions: ["Biwong-Bané", "Biwong-Bulu", "Djoum", "Meyomessala", "Nkpwa"] },
    ],
  },
  {
    name: "Sud-Ouest",
    departments: [
      { name: "Fako", subdivisions: ["Buea", "Limbe I", "Limbe II", "Limbe III", "Muyuka", "Tiko"] },
      { name: "Koupé-Muanenguba", subdivisions: ["Bangem", "Nguti", "Tombel"] },
      { name: "Lebialem", subdivisions: ["Alou", "Fontem", "Wabane"] },
      { name: "Manyu", subdivisions: ["Akwaya", "Eyumojock", "Mamfe", "Tinto"] },
      { name: "Meme", subdivisions: ["Konye", "Kumba I", "Kumba II", "Kumba III", "Mbonge"] },
      { name: "Ndian", subdivisions: ["Ekondo-Titi", "Isangele", "Kombo-Abedimo", "Kombo-Itindi", "Mundemba"] },
    ],
  },
];

/**
 * Cameroon's 10 regions have official English names (used throughout the
 * Anglophone North-West/South-West regions and in bilingual government
 * documents) — unlike departments/arrondissements/communes, which are place
 * names with no distinct English form and stay identical in both languages.
 * The French name above remains the stored value / lookup key throughout;
 * this is a display-only translation.
 */
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

