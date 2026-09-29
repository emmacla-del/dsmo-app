// Official Cameroon Administrative Hierarchy
// Sourced from national census classification for VTC wizard smart input.

class CameroonDepartment {
  final String name;
  final List<String> subdivisions;
  const CameroonDepartment({required this.name, required this.subdivisions});
}

class CameroonRegion {
  final String name;
  final List<CameroonDepartment> departments;
  const CameroonRegion({required this.name, required this.departments});
}

const List<CameroonRegion> kCameroonAdminHierarchy = [
  CameroonRegion(
    name: 'Adamaoua',
    departments: [
      CameroonDepartment(
          name: 'Djérem', subdivisions: ['Mbakaou', 'Ngaoundal', 'Tibati']),
      CameroonDepartment(
          name: 'Faro-et-Déo',
          subdivisions: ['Galim-Tignère', 'Kontcha', 'Mayo-Baléo', 'Tignère']),
      CameroonDepartment(
          name: 'Mayo-Banyo',
          subdivisions: ['Bankim', 'Banyo', 'Mayo-Darle', 'Ngan-Ha']),
      CameroonDepartment(
          name: 'Mbéré',
          subdivisions: ['Djohong', 'Gonmé', 'Meiganga', 'Ngaoui']),
      CameroonDepartment(name: 'Vina', subdivisions: [
        'Belel',
        'Martap',
        'Meidougou',
        'Ngaoundéré I',
        'Ngaoundéré II',
        'Ngaoundéré III',
        'Nyambaka'
      ]),
    ],
  ),
  CameroonRegion(
    name: 'Centre',
    departments: [
      CameroonDepartment(
          name: 'Haute-Sanaga',
          subdivisions: ['Lembe-Yezoum', 'Minta', 'Nanga-Eboko', 'Nkoteng']),
      CameroonDepartment(name: 'Lékié', subdivisions: [
        'Batchenga',
        'Ebebda',
        'Elig-Mfomo',
        'Evodoula',
        'Monatélé',
        'Obala',
        "Sa'a"
      ]),
      CameroonDepartment(name: 'Mbam-et-Inoubou', subdivisions: [
        'Bafia',
        'Bokito',
        'Deuk',
        'Kiiki',
        'Koro',
        'Makénéné',
        'Ndikiniméki',
        'Nitoukou',
        'Ombessa'
      ]),
      CameroonDepartment(name: 'Mbam-et-Kim', subdivisions: [
        'Mbangassina',
        'Ngambe-Tikar',
        'Ngoro',
        'Ntui',
        'Yoko'
      ]),
      CameroonDepartment(name: 'Méfou-et-Afamba', subdivisions: [
        'Awaé',
        'Esse',
        'Mfou',
        'Nkolafamba',
        'Soa',
        'Yaoundé VII'
      ]),
      CameroonDepartment(name: 'Méfou-et-Akono', subdivisions: [
        'Akono',
        'Bikok',
        'Dzeng',
        'Mengueme',
        'Ngog-Mapubi',
        'Ngoumou'
      ]),
      CameroonDepartment(name: 'Mfoundi', subdivisions: [
        'Yaoundé I',
        'Yaoundé II',
        'Yaoundé III',
        'Yaoundé IV',
        'Yaoundé V',
        'Yaoundé VI'
      ]),
      CameroonDepartment(name: 'Nyong-et-Kellé', subdivisions: [
        'Éséka',
        'Makak',
        'Matomb',
        'Messondo',
        'Ngog-Mapubi',
        'Nyanon',
        'Pouma'
      ]),
      CameroonDepartment(name: 'Nyong-et-Mfoumou', subdivisions: [
        'Akonolinga',
        'Ayos',
        'Endom',
        'Kobdombo',
        'Menomale',
        'Ngomedzap'
      ]),
      CameroonDepartment(name: "Nyong-et-So'o", subdivisions: [
        'Dzeng',
        'Mbalmayo',
        'Mbankomo',
        'Mengueme',
        'Mfou',
        'Ngomedzap',
        'Ngoumou'
      ]),
    ],
  ),
  CameroonRegion(
    name: 'Est',
    departments: [
      CameroonDepartment(
          name: 'Boumba-et-Ngoko',
          subdivisions: ['Gari-Gombo', 'Moloundou', 'Salapoumbé', 'Yokadouma']),
      CameroonDepartment(name: 'Haut-Nyong', subdivisions: [
        'Abong-Mbang',
        'Angossas',
        'Atok',
        'Dimako',
        'Doumaintang',
        'Doume',
        'Lomié',
        'Mboma',
        'Messamena',
        'Mindourou',
        'Ngoyla',
        'Nguelemendouka',
        'Somalomo'
      ]),
      CameroonDepartment(name: 'Kadey', subdivisions: [
        'Batouri',
        'Kette',
        'Mbang',
        'Ndelele',
        'Nguelebok',
        'Ouli'
      ]),
      CameroonDepartment(name: 'Lom-et-Djérem', subdivisions: [
        'Bélabo',
        'Bertoua I',
        'Bertoua II',
        'Betaré-Oya',
        'Diang',
        'Ngoura'
      ]),
    ],
  ),
  CameroonRegion(
    name: 'Extrême-Nord',
    departments: [
      CameroonDepartment(name: 'Diamaré', subdivisions: [
        'Gazawa',
        'Maroua I',
        'Maroua II',
        'Maroua III',
        'Meri',
        'Ndoukoula',
        'Pette'
      ]),
      CameroonDepartment(name: 'Logone-et-Chari', subdivisions: [
        'Fotokol',
        'Goulfey',
        'Hilé-Alifa',
        'Kousseri',
        'Logone-Birni',
        'Makary',
        'Waza',
        'Zina'
      ]),
      CameroonDepartment(name: 'Mayo-Danay', subdivisions: [
        'Datcheka',
        'Gazawa',
        'Kaélé',
        'Kar-Hay',
        'Maga',
        'Mindif',
        'Moulouvaye',
        'Tchatibali',
        'Yagoua'
      ]),
      CameroonDepartment(name: 'Mayo-Kani', subdivisions: [
        'Blangoua',
        'Guidiguis',
        'Kaïkaï',
        'Moulvoudaye',
        'Tchanaga',
        'Toulourou'
      ]),
      CameroonDepartment(
          name: 'Mayo-Sava',
          subdivisions: ['Kolofata', 'Limani', 'Méri', 'Mora', 'Tokombéré']),
      CameroonDepartment(name: 'Mayo-Tsanaga', subdivisions: [
        'Bourha',
        'Hina',
        'Koza',
        'Mogodé',
        'Mokolo',
        'Mozogo',
        'Roua',
        'Soulédé-Roua'
      ]),
    ],
  ),
  CameroonRegion(
    name: 'Littoral',
    departments: [
      CameroonDepartment(name: 'Moungo', subdivisions: [
        'Bare-Bakem',
        'Bonalea',
        'Dibombari',
        'Ekom',
        'Loum',
        'Manjo',
        'Mbanga',
        'Melong',
        'Mombo',
        'Njombe-Penja',
        'Nkongsamba I',
        'Nkongsamba II',
        'Nkongsamba III'
      ]),
      CameroonDepartment(
          name: 'Nkam', subdivisions: ['Ndom', 'Ngambe', 'Yabassi', 'Yingui']),
      CameroonDepartment(name: 'Sanaga-Maritime', subdivisions: [
        'Dibamba',
        'Dizangue',
        'Édéa I',
        'Édéa II',
        'Mouanko',
        'Ndom',
        'Ngambe',
        'Nyanon',
        'Pouma'
      ]),
      CameroonDepartment(name: 'Wouri', subdivisions: [
        'Douala I',
        'Douala II',
        'Douala III',
        'Douala IV',
        'Douala V',
        'Manoka'
      ]),
    ],
  ),
  CameroonRegion(
    name: 'Nord',
    departments: [
      CameroonDepartment(name: 'Bénoué', subdivisions: [
        'Bibemi',
        'Dembo',
        'Garoua I',
        'Garoua II',
        'Garoua III',
        'Lagdo',
        'Ngong',
        'Pitoa',
        'Tchéboa'
      ]),
      CameroonDepartment(name: 'Faro', subdivisions: ['Beka', 'Poli']),
      CameroonDepartment(
          name: 'Mayo-Louti', subdivisions: ['Figuil', 'Guider', 'Mayo-Oulo']),
      CameroonDepartment(
          name: 'Mayo-Rey',
          subdivisions: ['Pignde', 'Rey-Bouba', 'Tcholliré', 'Touboro']),
    ],
  ),
  CameroonRegion(
    name: 'Nord-Ouest',
    departments: [
      CameroonDepartment(
          name: 'Boyo', subdivisions: ['Belo', 'Fonfuka', 'Fundong']),
      CameroonDepartment(
          name: 'Bui',
          subdivisions: ['Jakiri', 'Kumbo', 'Mbven', 'Nkum', 'Noni', 'Oku']),
      CameroonDepartment(
          name: 'Donga-Mantung', subdivisions: ['Ako', 'Ndu', 'Nkambe', 'Nwa']),
      CameroonDepartment(
          name: 'Menchum', subdivisions: ['Benakuma', 'Fungom', 'Wum', 'Zhoa']),
      CameroonDepartment(name: 'Mezam', subdivisions: [
        'Bafut',
        'Bali',
        'Bamenda I',
        'Bamenda II',
        'Bamenda III',
        'Santa',
        'Tubah'
      ]),
      CameroonDepartment(
          name: 'Momo',
          subdivisions: ['Batibo', 'Mbengwi', 'Njikwa', 'Widikum-Menka']),
      CameroonDepartment(
          name: 'Ngo-Ketunjia',
          subdivisions: ['Babessi', 'Balikumbat', 'Ndop']),
    ],
  ),
  CameroonRegion(
    name: 'Ouest',
    departments: [
      CameroonDepartment(
          name: 'Bamboutos',
          subdivisions: ['Babadjou', 'Batcham', 'Galim', 'Mbouda']),
      CameroonDepartment(
          name: 'Haut-Nkam',
          subdivisions: ['Bafang', 'Banka', 'Bandja', 'Batcham', 'Kekem']),
      CameroonDepartment(
          name: 'Hauts-Plateaux',
          subdivisions: ['Baham', 'Bamendjou', 'Bangou', 'Bansoa']),
      CameroonDepartment(
          name: 'Koung-Khi',
          subdivisions: ['Bamendjou', 'Kouoptamo', 'Poumougne']),
      CameroonDepartment(name: 'Menoua', subdivisions: [
        'Dschang',
        'Fongo-Tongo',
        'Fokoué',
        'Kekem',
        'Nkong-Ni',
        'Penka-Michel',
        'Santchou'
      ]),
      CameroonDepartment(
          name: 'Mifi',
          subdivisions: ['Bafoussam I', 'Bafoussam II', 'Bafoussam III']),
      CameroonDepartment(
          name: 'Ndé',
          subdivisions: ['Bangangté', 'Bassamba', 'Bazou', 'Tonga']),
      CameroonDepartment(name: 'Noun', subdivisions: [
        'Foumban',
        'Foumbot',
        'Kouoptamo',
        'Koutaba',
        'Magba',
        'Malantouen',
        'Massangam',
        'Njimom'
      ]),
    ],
  ),
  CameroonRegion(
    name: 'Sud',
    departments: [
      CameroonDepartment(name: 'Dja-et-Lobo', subdivisions: [
        'Bengbis',
        'Djoum',
        'Meyomessala',
        'Meyomessi',
        'Mintom',
        'Mvangan',
        'Oveng',
        'Sangmélima'
      ]),
      CameroonDepartment(name: 'Mvila', subdivisions: [
        'Ambam',
        'Bengbis',
        'Ebolowa I',
        'Ebolowa II',
        'Efoulan',
        "Ma'an",
        'Mengong',
        'Mvangan',
        'Ngoulemakong'
      ]),
      CameroonDepartment(name: 'Océan', subdivisions: [
        'Akom II',
        'Campo',
        'Grand Batanga',
        'Kribi I',
        'Kribi II',
        'Lolodorf',
        'Mvengue'
      ]),
      CameroonDepartment(name: 'Vallée-du-Ntem', subdivisions: [
        'Biwong-Bané',
        'Biwong-Bulu',
        'Djoum',
        'Meyomessala',
        'Nkpwa'
      ]),
    ],
  ),
  CameroonRegion(
    name: 'Sud-Ouest',
    departments: [
      CameroonDepartment(name: 'Fako', subdivisions: [
        'Buea',
        'Limbe I',
        'Limbe II',
        'Limbe III',
        'Muyuka',
        'Tiko'
      ]),
      CameroonDepartment(
          name: 'Koupé-Muanenguba',
          subdivisions: ['Bangem', 'Nguti', 'Tombel']),
      CameroonDepartment(
          name: 'Lebialem', subdivisions: ['Alou', 'Fontem', 'Wabane']),
      CameroonDepartment(
          name: 'Manyu',
          subdivisions: ['Akwaya', 'Eyumojock', 'Mamfe', 'Tinto']),
      CameroonDepartment(name: 'Meme', subdivisions: [
        'Konye',
        'Kumba I',
        'Kumba II',
        'Kumba III',
        'Mbonge'
      ]),
      CameroonDepartment(name: 'Ndian', subdivisions: [
        'Ekondo-Titi',
        'Isangele',
        'Kombo-Abedimo',
        'Kombo-Itindi',
        'Mundemba'
      ]),
    ],
  ),
];

/// Helper to find a region by name (case-insensitive & trimmed)
CameroonRegion? findCameroonRegion(String? name) {
  if (name == null || name.trim().isEmpty) return null;
  final clean = name.trim().toLowerCase();
  for (final r in kCameroonAdminHierarchy) {
    if (r.name.toLowerCase() == clean) return r;
  }
  return null;
}

/// Helper to find a department across all regions or within a specific region
CameroonDepartment? findCameroonDepartment(String? deptName,
    {String? regionName}) {
  if (deptName == null || deptName.trim().isEmpty) return null;
  final cleanDept = deptName.trim().toLowerCase();
  final region = findCameroonRegion(regionName);
  final regionsToSearch = region != null ? [region] : kCameroonAdminHierarchy;
  for (final r in regionsToSearch) {
    for (final d in r.departments) {
      if (d.name.toLowerCase() == cleanDept) return d;
    }
  }
  return null;
}
