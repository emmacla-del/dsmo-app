// Official Cameroon Administrative Hierarchy
// Canonical 360 Subdivisions, 58 Departments, 10 Regions.
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
      CameroonDepartment(name: 'Djérem', subdivisions: ['Ngaoundal', 'Tibati']),
      CameroonDepartment(name: 'Faro-et-Déo', subdivisions: ['Galim-Tignère', 'Kontcha', 'Mayo-Baléo', 'Tignère']),
      CameroonDepartment(name: 'Mayo-Banyo', subdivisions: ['Bankim', 'Banyo', 'Mayo-Darlé']),
      CameroonDepartment(name: 'Mbéré', subdivisions: ['Dir', 'Djohong', 'Meiganga', 'Ngaoui']),
      CameroonDepartment(name: 'Vina', subdivisions: ['Bélél', 'Martap', 'Mbé', 'Nganha', 'Ngaoundéré 1', 'Ngaoundéré 2', 'Ngaoundéré 3', 'Nyambaka']),
    ],
  ),
  CameroonRegion(
    name: 'Centre',
    departments: [
      CameroonDepartment(name: 'Haute-Sanaga', subdivisions: ['Bibey', 'Lembe-Yezoum', 'Mbandjock', 'Minta', 'Nanga-Eboko', 'Nkoteng', 'Nsem']),
      CameroonDepartment(name: 'Lékié', subdivisions: ['Batchenga', 'Ebebda', 'Elig-Mfomo', 'Evodoula', 'Lobo', 'Monatélé', 'Obala', 'Okola', 'Sa\'a']),
      CameroonDepartment(name: 'Mbam-et-Inoubou', subdivisions: ['Bafia', 'Bokito', 'Deuk', 'Kiiki', 'Kom-Yambetta', 'Makenene', 'Ndikinimeki', 'Nitoukou', 'Ombessa']),
      CameroonDepartment(name: 'Mbam-et-Kim', subdivisions: ['Mbangassina', 'Ngambé-Tikar', 'Ngoro', 'Ntui', 'Yoko']),
      CameroonDepartment(name: 'Mefou-et-Afamba', subdivisions: ['Afanloum', 'Assamba', 'Awaé', 'Edzendouan', 'Esse', 'Mfou', 'Nkolafamba', 'Soa']),
      CameroonDepartment(name: 'Mefou-et-Akono', subdivisions: ['Akono', 'Bikok', 'Mbankomo', 'Ngoumou']),
      CameroonDepartment(name: 'Mfoundi', subdivisions: ['Yaoundé 1', 'Yaoundé 2', 'Yaoundé 3', 'Yaoundé 4', 'Yaoundé 5', 'Yaoundé 6', 'Yaoundé 7']),
      CameroonDepartment(name: 'Nyong-et-Kellé', subdivisions: ['Biyouha', 'Bondjock', 'Bot-Makak', 'Dibang', 'Eséka', 'Makak', 'Matomb', 'Messondo', 'Ngog-Mapubi', 'Nguibassal']),
      CameroonDepartment(name: 'Nyong-et-Mfoumou', subdivisions: ['Akonolinga', 'Ayos', 'Endom', 'Mengang', 'Nyakokombo']),
      CameroonDepartment(name: 'Nyong-et-So\'o', subdivisions: ['Akoeman', 'Dzeng', 'Mbalmayo', 'Mengueme', 'Ngomedzap', 'Nkolmetet']),
    ],
  ),
  CameroonRegion(
    name: 'Est',
    departments: [
      CameroonDepartment(name: 'Boumba-et-Ngoko', subdivisions: ['Gari-Gombo', 'Moloundou', 'Salapoumbé', 'Yokadouma']),
      CameroonDepartment(name: 'Haut-Nyong', subdivisions: ['Abong-Mbang', 'Bebend', 'Dja', 'Doumaintang', 'Doumé', 'Lomié', 'Mboanz', 'Mboma', 'Messaména', 'Messok', 'Mindourou', 'Ngoyla', 'Nguelemendouka', 'Somalomo']),
      CameroonDepartment(name: 'Kadey', subdivisions: ['Batouri', 'Bombé', 'Kétté', 'Mbang', 'Mbotoro', 'Ndélélé', 'Ndem-Nam']),
      CameroonDepartment(name: 'Lom-et-Djérem', subdivisions: ['Belabo', 'Bertoua 1', 'Bertoua 2', 'Bétaré-Oya', 'Diang', 'Garoua-Boulaï', 'Mandjou', 'Ngoura']),
    ],
  ),
  CameroonRegion(
    name: 'Extrême-Nord',
    departments: [
      CameroonDepartment(name: 'Diamaré', subdivisions: ['Bogo', 'Dargala', 'Gazawa', 'Maroua 1', 'Maroua 2', 'Maroua 3', 'Méri', 'Ndoukoula', 'Petté']),
      CameroonDepartment(name: 'Logone-et-Chari', subdivisions: ['Blangoua', 'Darak', 'Fotokol', 'Goulfey', 'Hile-Halifa', 'Kousseri', 'Logone-Birni', 'Makary', 'Waza', 'Zina']),
      CameroonDepartment(name: 'Mayo-Danay', subdivisions: ['Datchéka', 'Gobo', 'Guéré', 'Kai-Kai', 'Kalfou', 'Kar-Hay', 'Maga', 'Tchatibali', 'Vélé', 'Wina', 'Yagoua']),
      CameroonDepartment(name: 'Mayo-Kani', subdivisions: ['Guidiguis', 'Kaélé', 'Mindif', 'Moulvoudaye', 'Moutourwa', 'Porhi', 'Taibong']),
      CameroonDepartment(name: 'Mayo-Sava', subdivisions: ['Kolofata', 'Mora', 'Tokombéré']),
      CameroonDepartment(name: 'Mayo-Tsanaga', subdivisions: ['Bourrha', 'Hina', 'Koza', 'Mayo-Moskota', 'Mogodé', 'Mokolo', 'Soulede-Roua']),
    ],
  ),
  CameroonRegion(
    name: 'Littoral',
    departments: [
      CameroonDepartment(name: 'Moungo', subdivisions: ['Baré-Bakem', 'Dibombari', 'Fiko', 'Loum', 'Manjo', 'Mbanga', 'Melong', 'Mombo', 'Njombé-Penja', 'Nkongsamba 1', 'Nkongsamba 2', 'Nkongsamba 3', 'Nlonako']),
      CameroonDepartment(name: 'Nkam', subdivisions: ['Nkondjock', 'Nord-Makombe', 'Yabassi', 'Yingui']),
      CameroonDepartment(name: 'Sanaga-Maritime', subdivisions: ['Dibamba', 'Dizangué', 'Edéa 1', 'Edéa 2', 'Massock-Songloulou', 'Mouanko', 'Ndom', 'Ngambé', 'Ngwei', 'Nyanon', 'Pouma']),
      CameroonDepartment(name: 'Wouri', subdivisions: ['Douala 1', 'Douala 2', 'Douala 3', 'Douala 4', 'Douala 5', 'Douala 6']),
    ],
  ),
  CameroonRegion(
    name: 'Nord',
    departments: [
      CameroonDepartment(name: 'Bénoué', subdivisions: ['Baschéo', 'Bibemi', 'Dembo', 'Demsa', 'Garoua 1', 'Garoua 2', 'Garoua 3', 'Lagdo', 'Mayo-Hourna', 'Pitoa', 'Tcheboa', 'Touroua']),
      CameroonDepartment(name: 'Faro', subdivisions: ['Béka', 'Poli']),
      CameroonDepartment(name: 'Mayo-Louti', subdivisions: ['Figuil', 'Guider', 'Mayo-Oulo']),
      CameroonDepartment(name: 'Mayo-Rey', subdivisions: ['Madingring', 'Rey-Bouba', 'Tcholliré', 'Touboro']),
    ],
  ),
  CameroonRegion(
    name: 'Nord-Ouest',
    departments: [
      CameroonDepartment(name: 'Boyo', subdivisions: ['Belo', 'Bum', 'Fundong', 'Njinikom']),
      CameroonDepartment(name: 'Bui', subdivisions: ['Jakiri', 'Kumbo', 'Mbven', 'Nkum', 'Noni', 'Oku']),
      CameroonDepartment(name: 'Donga-Mantung', subdivisions: ['Ako', 'Misaje', 'Ndu', 'Nkambe', 'Nwa']),
      CameroonDepartment(name: 'Menchum', subdivisions: ['Fungom', 'Furu-Awa', 'Menchum-Valley', 'Wum']),
      CameroonDepartment(name: 'Mezam', subdivisions: ['Bafut', 'Bali', 'Bamenda 1', 'Bamenda 2', 'Bamenda 3', 'Santa', 'Tubah']),
      CameroonDepartment(name: 'Momo', subdivisions: ['Batibo', 'Mbengwi', 'Ngie', 'Njikwa', 'Widikum-Menka']),
      CameroonDepartment(name: 'Ngo-Ketunjia', subdivisions: ['Babessi', 'Balikumbat', 'Ndop']),
    ],
  ),
  CameroonRegion(
    name: 'Ouest',
    departments: [
      CameroonDepartment(name: 'Bamboutos', subdivisions: ['Babadjou', 'Batcham', 'Galim', 'Mbouda']),
      CameroonDepartment(name: 'Haut-Nkam', subdivisions: ['Bafang', 'Bakou', 'Bana', 'Bandja', 'Banka', 'Banwa', 'Kékem']),
      CameroonDepartment(name: 'Hauts-Plateaux', subdivisions: ['Baham', 'Bamendjou', 'Bangou', 'Batié']),
      CameroonDepartment(name: 'Koung-Khi', subdivisions: ['Bayangam', 'Djebem', 'Poumougne']),
      CameroonDepartment(name: 'Menoua', subdivisions: ['Dschang', 'Fokoué', 'Fongo-Tongo', 'Nkong-Ni', 'Penka-Michel', 'Santchou']),
      CameroonDepartment(name: 'Mifi', subdivisions: ['Bafoussam 1', 'Bafoussam 2', 'Bafoussam 3']),
      CameroonDepartment(name: 'Ndé', subdivisions: ['Bangangté', 'Bassamba', 'Bazou', 'Tonga']),
      CameroonDepartment(name: 'Noun', subdivisions: ['Bangourain', 'Foumban', 'Foumbot', 'Kouoptamo', 'Koutaba', 'Magba', 'Malentouen', 'Massangam', 'Njimom']),
    ],
  ),
  CameroonRegion(
    name: 'Sud',
    departments: [
      CameroonDepartment(name: 'Dja-et-Lobo', subdivisions: ['Bengbis', 'Djoum', 'Meyomessala', 'Meyomessi', 'Mintom', 'Oveng', 'Sangmelima', 'Zoétélé']),
      CameroonDepartment(name: 'Mvila', subdivisions: ['Biwong-Bane', 'Biwong-Bulu', 'Ebolowa 1', 'Ebolowa 2', 'Efoulan', 'Mengong', 'Mvangan', 'Ngoulemakong']),
      CameroonDepartment(name: 'Océan', subdivisions: ['Akom II', 'Bipindi', 'Campo', 'Kribi 1', 'Kribi 2', 'Lokoundje', 'Lolodorf', 'Mvengue', 'Niété']),
      CameroonDepartment(name: 'Vallée-du-Ntem', subdivisions: ['Ambam', 'Kyé-Ossi', 'Ma\'an', 'Olamzé']),
    ],
  ),
  CameroonRegion(
    name: 'Sud-Ouest',
    departments: [
      CameroonDepartment(name: 'Fako', subdivisions: ['Buea', 'Limbe 1', 'Limbe 2', 'Limbe 3', 'Muyuka', 'Tiko', 'West-Coast']),
      CameroonDepartment(name: 'Kupe-Manenguba', subdivisions: ['Bangem', 'Nguti', 'Tombel']),
      CameroonDepartment(name: 'Lebialem', subdivisions: ['Alou', 'Fontem', 'Wabane']),
      CameroonDepartment(name: 'Manyu', subdivisions: ['Akwaya', 'Eyumodjock', 'Mamfe', 'Upper-Bayang']),
      CameroonDepartment(name: 'Meme', subdivisions: ['Konye', 'Kumba 1', 'Kumba 2', 'Kumba 3', 'Mbonge']),
      CameroonDepartment(name: 'Ndian', subdivisions: ['Bamusso', 'Dikome-Balue', 'Ekondo Titi', 'Idabato', 'Isangele', 'Kombo-Abedimo', 'Kombo-Itindi', 'Mundemba', 'Toko']),
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
