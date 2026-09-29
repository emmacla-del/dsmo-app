import test from "node:test";
import assert from "node:assert/strict";

import {
  companyToInitialData,
  mergeWithAutofill,
  mapActivityToSector,
  mapLegalStatus,
  mapEnterpriseSize,
  mapArea,
  mapCtdType,
  mapCooperativeType,
  mapEducationSystem,
  mapCfpType,
  mapFunctionalStatus,
  mapNonFunctionalReason,
} from "../src/lib/onefop-autofill.ts";

test("Option mappers work accurately", () => {
  assert.equal(mapActivityToSector("Agriculture et élevage"), "Primaire/ Primary");
  assert.equal(mapActivityToSector("Industrie textile"), "Secondaire/ Secondary");
  assert.equal(mapActivityToSector("Services bancaires"), "Tertiaire/ Tertiary");

  assert.equal(mapLegalStatus("SARL"), "SARL/ LLC");
  assert.equal(mapLegalStatus("SA"), "SA/ PLC");
  assert.equal(mapLegalStatus("Société unipersonnelle"), "Société unipersonnelle/ Single-member company");
  assert.equal(mapLegalStatus("Autres"), "Autres/ Others");

  assert.equal(mapEnterpriseSize("TPE"), "TPE/ Very small enterprise");
  assert.equal(mapEnterpriseSize("PE"), "PE/ Small enterprise");
  assert.equal(mapEnterpriseSize("ME"), "ME/ Medium-sized enterprise");
  assert.equal(mapEnterpriseSize("GE"), "GE/ Large enterprise");

  assert.equal(mapArea("Urbain"), "Urbain/ Urban");
  assert.equal(mapArea("Rural"), "Rural/ Rural");

  assert.equal(mapCtdType("Commune"), "Commune/ Council");
  assert.equal(mapCtdType("Communauté Urbaine"), "Communauté Urbaine/ Urban Council");

  assert.equal(mapCooperativeType("Coopérative simplifiée"), "Coopérative à comptabilité simplifiée");
  assert.equal(mapCooperativeType("Coopérative avec conseil d'administration"), "Coopérative avec conseil d'administration");

  assert.equal(mapEducationSystem("Public"), "Public/ Public");
  assert.equal(mapEducationSystem("Privé laïc"), "Privé laïc/ Lay private");
  assert.equal(mapEducationSystem("Privé confessionnel"), "Privé confessionnel/ Private denominational");

  assert.equal(
    mapCfpType("Centre de Formation Professionnelle Rapide (CFPR)"),
    "Centre de Formation Professionnelle Rapide (CFPR)/ Intensive Vocational Training Centre (IVTC)"
  );
  assert.equal(mapFunctionalStatus("Fonctionnelle"), "Fonctionnelle/ Functional");
  assert.equal(mapFunctionalStatus("Non-fonctionnelle"), "Non-fonctionnelle/ Non-functional");
  assert.equal(mapFunctionalStatus("Fermée"), "Fermée/ Closed");
});

test("VT form wizard identification autofill", () => {
  const company = {
    id: "comp-vt-1",
    name: "CFP Excellence Yaoundé",
    centerName: "CFP Excellence Yaoundé",
    sigle: "CFPEY",
    establishmentId: "VT-2026-0000042",
    region: "Centre",
    department: "Mfoundi",
    subdivision: "Yaoundé 1",
    address: "Bastos",
    area: "Urbain",
    educationSystem: "Public",
    cfpType: "Centre de Formation Professionnelle Rapide (CFPR)",
    functionalStatus: "Fonctionnelle",
    yearOfCreation: "2018",
    respondentFirstName: "Paul",
    respondentLastName: "Biya",
    respondentFunction: "Directeur",
    phone: "699112233",
    phone2: "677112233",
    promoterName: "Chantal Biya",
    promoterSex: "Féminin",
    promoterPhone1: "699998877",
    promoterPhone2: "677998877",
  };

  const user = {
    id: "usr-1",
    email: "director@cfpe.cm",
    role: "COMPANY",
    isActive: true,
  };

  const data = companyToInitialData(company, "vocationalTraining", user);

  // Structure identification (§1.1 - §1.14)
  assert.equal(data["VT1_1"], "VT-2026-0000042");
  assert.equal(data["VT1_2"], "CFP Excellence Yaoundé");
  assert.equal(data["VT1_3"], "CFPEY");
  assert.equal(data["VT1_4"], "Centre");
  assert.equal(data["VT1_5"], "Mfoundi");
  assert.equal(data["VT1_6"], "Yaoundé 1");
  assert.equal(data["VT1_8"], "Bastos");
  assert.equal(data["VT1_9"], "Urbain/ Urban");
  assert.equal(data["VT1_10"], "Public/ Public");
  assert.equal(
    data["VT1_11"],
    "Centre de Formation Professionnelle Rapide (CFPR)/ Intensive Vocational Training Centre (IVTC)"
  );
  assert.equal(data["VT1_12"], "Fonctionnelle/ Functional");
  assert.equal(data["VT1_14"], "2018");

  // Respondent identification (§1.15)
  assert.equal(data["VT1_15_NAME"], "Paul Biya");
  assert.equal(data["VT1_15_FUNCTION"], "Directeur");
  assert.equal(data["VT1_15_TEL1"], "699112233");
  assert.equal(data["VT1_15_TEL2"], "677112233");
  assert.equal(data["VT1_15_EMAIL"], "director@cfpe.cm");

  // Promoter identification (§1.16)
  assert.equal(data["VT1_16_NAME"], "Chantal Biya");
  assert.equal(data["VT1_16_SEX"], "Féminin");
  assert.equal(data["VT1_16_TEL1"], "699998877");
  assert.equal(data["VT1_16_TEL2"], "677998877");
});

test("Modern jobs form wizard - Enterprise identification autofill", () => {
  const company = {
    name: "CAMTEL SA",
    legalStatus: "SA",
    region: "Centre",
    department: "Mfoundi",
    subdivision: "Yaoundé 1",
    address: "Boulevard du 20 Mai",
    area: "Urbain",
    phone: "222234065",
    phone2: "699000111",
    poBox: "BP 1571",
    mainActivity: "Télécommunications",
    branch: "Télécom & TIC",
    totalEmployees: 2500,
    enterpriseSize: "GE",
    respondentFirstName: "Judith",
    respondentLastName: "Yah Sunday",
    respondentFunction: "Directrice Générale",
  };

  const user = {
    id: "usr-2",
    email: "dg@camtel.cm",
    role: "COMPANY",
    isActive: true,
  };

  const data = companyToInitialData(company, "enterprise", user);

  // Section 0 - Respondent
  assert.equal(data["S0Q01"], "Judith Yah Sunday");
  assert.equal(data["S0Q02"], "Directrice Générale");
  assert.equal(data["S0Q03_TEL1"], "222234065");
  assert.equal(data["S0Q03_TEL2"], "699000111");
  assert.equal(data["S0Q03_EMAIL"], "dg@camtel.cm");

  // Section 1 - Enterprise
  assert.equal(data["S1Q01"], "SA/ PLC");
  assert.equal(data["S1Q02"], "CAMTEL SA");
  assert.equal(data["S1Q03"], "Urbain/ Urban");
  assert.equal(data["S1Q04_REGION"], "Centre");
  assert.equal(data["S1Q04_DEPT"], "Mfoundi");
  assert.equal(data["S1Q04_SUBDIV"], "Yaoundé 1");
  assert.equal(data["S1Q04_LOCALITY"], "Boulevard du 20 Mai");
  assert.equal(data["S1Q05_TEL1"], "222234065");
  assert.equal(data["S1Q05_TEL2"], "699000111");
  assert.equal(data["S1Q05_BP"], "BP 1571");
  assert.equal(data["S1Q06"], "Tertiaire/ Tertiary");
  assert.equal(data["S1Q07"], "Télécom & TIC");
  assert.equal(data["S1Q08"], "Télécommunications");
  assert.equal(data["S1Q09"], "Boulevard du 20 Mai");
  assert.equal(data["S1Q10"], "2500");
  assert.equal(data["S1Q12"], "GE/ Large enterprise");
});

test("Modern jobs form wizard - Cooperative identification autofill", () => {
  const company = {
    name: "SOCOOPCAM",
    cooperativeName: "SOCOOPCAM",
    cooperativeType: "Coopérative avec conseil d'administration",
    yearOfCreation: "2010",
    region: "Ouest",
    department: "Mifi",
    subdivision: "Bafoussam 1",
    address: "Marché B",
    area: "Rural",
    phone: "677000111",
    mainActivity: "Agriculture et café",
    branch: "Agro-alimentaire",
    totalEmployees: 45,
    respondentFirstName: "Pierre",
    respondentLastName: "Kamga",
    respondentFunction: "Président du Conseil",
  };

  const user = {
    id: "usr-3",
    email: "contact@socoopcam.cm",
    role: "COMPANY",
    isActive: true,
  };

  const data = companyToInitialData(company, "cooperative", user);

  // Section 0
  assert.equal(data["S0Q01"], "Pierre Kamga");
  assert.equal(data["S0Q02"], "Président du Conseil");
  assert.equal(data["S0Q03_TEL1"], "677000111");
  assert.equal(data["S0Q03_EMAIL"], "contact@socoopcam.cm");

  // Section 1 - Cooperative
  assert.equal(data["COOP_S1Q01"], "SOCOOPCAM");
  assert.equal(data["COOP_S1Q02"], "Marché B");
  assert.equal(data["COOP_S1Q03"], "2010");
  assert.equal(data["COOP_S1Q04"], "Rural/ Rural");
  assert.equal(data["COOP_S1Q05_REGION"], "Ouest");
  assert.equal(data["COOP_S1Q05_DEPT"], "Mifi");
  assert.equal(data["COOP_S1Q05_SUBDIV"], "Bafoussam 1");
  assert.equal(data["COOP_S1Q05_LOCALITY"], "Marché B");
  assert.equal(data["COOP_S1Q06_TEL1"], "677000111");
  assert.equal(data["COOP_S1Q07"], "Primaire/ Primary");
  assert.equal(data["COOP_S1Q08"], "Agro-alimentaire");
  assert.equal(data["COOP_S1Q09"], "Agriculture et café");
  assert.equal(data["COOP_S1Q10"], "Coopérative avec conseil d'administration");
  assert.equal(data["COOP_S1Q11"], "45");
});

test("Modern jobs form wizard - CTD, ONG, Administration, ProjectProgram identification autofill", () => {
  // CTD
  const ctd = {
    name: "Commune de Kribi 1er",
    ctdType: "Commune",
    yearOfCreation: "1996",
    region: "Sud",
    department: "Océan",
    subdivision: "Kribi 1",
    address: "Hôtel de Ville",
    area: "Urbain",
    phone: "233461234",
    mainActivity: "Administration locale",
    totalEmployees: 120,
    respondentFirstName: "Maire",
    respondentLastName: "Kribi",
    respondentFunction: "Maire",
  };
  const ctdData = companyToInitialData(ctd, "ctd", { email: "contact@mairiekribi1.cm" });
  assert.equal(ctdData["S0Q01"], "Maire Kribi");
  assert.equal(ctdData["CTD_S1Q01"], "Commune/ Council");
  assert.equal(ctdData["CTD_S1Q01_NAME"], "Commune de Kribi 1er");
  assert.equal(ctdData["CTD_S1Q03"], "1996");
  assert.equal(ctdData["CTD_S1Q04"], "Urbain/ Urban");
  assert.equal(ctdData["CTD_S1Q05_REGION"], "Sud");
  assert.equal(ctdData["CTD_S1Q09"], "120");

  // ONG
  const ong = {
    name: "Care Cameroon",
    ngoName: "Care Cameroon",
    mainMission: "Lutte contre la pauvreté et aide d'urgence",
    yearOfCreation: "2002",
    region: "Adamaoua",
    department: "Vina",
    subdivision: "Ngaoundéré 1",
    address: "Quartier Baladji",
    phone: "222251122",
    totalEmployees: 35,
  };
  const ongData = companyToInitialData(ong, "ong", null);
  assert.equal(ongData["ONG_S1Q01"], "Care Cameroon");
  assert.equal(ongData["ONG_S1Q03"], "2002");
  assert.equal(ongData["ONG_S1Q05_REGION"], "Adamaoua");
  assert.equal(ongData["ONG_S1Q09"], "Lutte contre la pauvreté et aide d'urgence");
  assert.equal(ongData["ONG_S1Q10"], "35");

  // Administration
  const admin = {
    name: "Ministère de la Fonction Publique",
    sigle: "MINFOPRA",
    mainMission: "Gestion des carrières des agents publics",
    region: "Centre",
    department: "Mfoundi",
    subdivision: "Yaoundé 3",
    address: "Immeuble Ministériel No 1",
    phone: "222221100",
  };
  const adminData = companyToInitialData(admin, "administration", null);
  assert.equal(adminData["ADMIN_S1Q01"], "Ministère de la Fonction Publique");
  assert.equal(adminData["ADMIN_S1Q02"], "MINFOPRA");
  assert.equal(adminData["ADMIN_S1Q08"], "Gestion des carrières des agents publics");

  // ProjectProgram
  const pp = {
    name: "Programme National de Développement Participatif",
    sigle: "PNDP",
    mainMission: "Appui au développement local",
    region: "Centre",
    department: "Mfoundi",
    subdivision: "Yaoundé 1",
    address: "Nouvelle Route Bastos",
    phone: "222212345",
    promoterName: "Coordonnateur National",
    totalEmployees: 60,
  };
  const ppData = companyToInitialData(pp, "projectProgram", null);
  assert.equal(ppData["PP_S1Q02"], "Programme National de Développement Participatif");
  assert.equal(ppData["PP_S1Q03"], "PNDP");
  assert.equal(ppData["PP_S1Q04"], "Coordonnateur National");
  assert.equal(ppData["PP_S1Q10"], "Appui au développement local");
  assert.equal(ppData["PP_S1Q15"], "60");
});

test("mergeWithAutofill: registration data always wins for identification fields (D3 fix)", () => {
  // Scenario: draft has a stale respondent name from a prior session;
  // registration was updated with a new name. The fresh registration value
  // must override the stale draft value so SPSS carries current data.
  const existingDraft = {
    S0Q01: "Stale Respondent Name", // stale from prior session
    S1Q02: "", // user cleared this
    // S1Q04_REGION missing
  };

  const autofill = {
    S0Q01: "Account First Last", // fresh from registration
    S0Q02: "Directeur",
    S1Q02: "Company Name From Account",
    S1Q04_REGION: "Littoral",
  };

  const merged = mergeWithAutofill(existingDraft, autofill);

  assert.equal(merged["S0Q01"], "Account First Last"); // registration wins!
  assert.equal(merged["S0Q02"], "Directeur"); // filled from registration
  assert.equal(merged["S1Q02"], "Company Name From Account"); // filled (draft was empty)
  assert.equal(merged["S1Q04_REGION"], "Littoral"); // filled (missing from draft)
});
