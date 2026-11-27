// lib/core/focus/utils/employer_quiz.dart
// ══════════════════════════════════════════════════════════════
// The employer preliminary quiz (« Quiz préalable de déclaration ») — the
// Flutter port of react-web's modern-jobs/scope: ScopeTypes.ts,
// ScopeDataManagement.ts, QuizSemantics.ts and resolveTableScope
// (modernJobsTableDefinitions.ts). Same answers, same stored shape
// (data['_scopeConfig'], '_scopeCsp', '_scopeAge'), same meaning, so a
// declaration started on one app resumes on the other.
//
//   quiz answer « Non »  → table _RESPONSE_STATUS = NONE (cells 0 at submit)
//   quiz answer « Oui »  → table _RESPONSE_STATUS = REPORTED; the categories,
//                          age groups, reasons… not chosen are not asked and
//                          are sent as 0
//   question unanswered  → nothing derived; submission is blocked instead
//
// Governs the enterprise family and Administration. Project / Programme and
// training centres have their own quizzes (React excludes them here too).
// ══════════════════════════════════════════════════════════════

/// One choice of a follow-up question (react-web FilterOption).
class QuizOption {
  final String id;
  final String fr;
  final String en;
  final String shortFr;
  final String shortEn;
  const QuizOption(this.id, this.fr, this.en, this.shortFr, this.shortEn);

  String label(bool isEn) => isEn ? en : fr;
  String short(bool isEn) => isEn ? shortEn : shortFr;
}

const kCspOptions = [
  QuizOption('cadres', 'Cadres', 'Executives', 'Cadres', 'Executives'),
  QuizOption('maitrise', 'Agents de maîtrise', 'Supervisors / Foremen',
      'Maîtrise', 'Supervisors'),
  QuizOption('execution', "Agents d'exécution", 'Field workers', 'Exécution',
      'Workers'),
];

const kAgeBandOptions = [
  QuizOption('15_24', 'Moins de 25 ans (15–24 ans)', 'Under 25 (15–24 years)',
      '< 25 ans', '< 25 yrs'),
  QuizOption('25_34', '25 à 34 ans', '25 to 34 years', '25–34 ans', '25–34 yrs'),
  QuizOption('35_plus', '35 ans et +', '35 years and over', '35+ ans', '35+ yrs'),
];

const kDiplomaOptions = [
  QuizOption('cep', 'CEP / CEPE / FSLC', 'CEP / CEPE / FSLC', 'CEP', 'CEP'),
  QuizOption('bepc', 'BEPC / CAP / GCE-OL', 'BEPC / CAP / GCE-OL', 'BEPC / CAP',
      'BEPC / CAP'),
  QuizOption('probatoire', 'Probatoire', 'Lower sixth', 'Probatoire', 'Lower 6th'),
  QuizOption('bac', 'BAC / GCE-AL', 'BAC / GCE-AL', 'BAC / GCE-A', 'BAC / GCE-A'),
  QuizOption('bts', 'BTS / DUT / HND', 'BTS / DUT / HND', 'BTS / DUT', 'BTS / DUT'),
  QuizOption('licence', 'Licence (Bac+3)', 'Bachelor', 'Licence', 'Bachelor'),
  QuizOption('maitrise', 'Maîtrise (Bac+4)', 'Master 1', 'Maîtrise', 'Master 1'),
  QuizOption('master', 'Master (Bac+5)', 'Master 2', 'Master', 'Master 2'),
  QuizOption('dqp', 'DQP / PQD', 'DQP / PQD', 'DQP', 'DQP'),
  QuizOption('cqp', 'CQP / CPQ', 'CQP / CPQ', 'CQP', 'CQP'),
  QuizOption('autres', 'Autres', 'Others', 'Autres', 'Others'),
  QuizOption('sans_diplome', 'Sans diplôme', 'Without diploma', 'Sans diplôme',
      'No diploma'),
];

const kDepartureReasonOptions = [
  QuizOption('licenciement', 'Licenciements', 'Dismissal', 'Licenciements',
      'Dismissal'),
  QuizOption('demission', 'Démissions', 'Resignation', 'Démissions', 'Resignation'),
  QuizOption('retraite', 'Départ à la retraite', 'Retirement', 'Retraite',
      'Retirement'),
  QuizOption('autre', 'Autres départs', 'Other departures', 'Autres', 'Others'),
];

const kInternshipTypeOptions = [
  QuizOption('vacance', 'Stage de vacance', 'Holiday internship', 'Vacance',
      'Holiday'),
  QuizOption('academique', 'Stage académique', 'Academic internship',
      'Académique', 'Academic'),
  QuizOption('professionnel', 'Stage professionnel', 'Professional internship',
      'Professionnel', 'Professional'),
  QuizOption('preemploi', 'Stage pré-emploi', 'Pre-employment internship',
      'Pré-emploi', 'Pre-employment'),
];

const kRecruitmentTypeOptions = [
  QuizOption('permanent', 'Permanents', 'Permanent', 'Permanents', 'Permanent'),
  QuizOption('temporaire', 'Temporaires', 'Temporary', 'Temporaires', 'Temporary'),
];

/// The quiz answers (react-web ScopeState), kept as the same JSON map.
class QuizScope {
  final Map<String, dynamic> raw;
  const QuizScope(this.raw);

  static const Map<String, dynamic> defaults = {
    'applications': null,
    'application_csp': <String>[],
    'application_age': <String>[],
    'recruit': null,
    'recruit_types': <String>[],
    'recruit_csp': <String>[],
    'recruit_age': <String>[],
    'recruit_diploma': <String>[],
    'disability': null,
    'vulnerable': null,
    'primo_seekers': null,
    'primo_seekers_csp': <String>[],
    'primo_seekers_age': <String>[],
    'primo_workers': null,
    'primo_workers_types': <String>[],
    'primo_workers_csp': <String>[],
    'primo_workers_age': <String>[],
    'departures': null,
    'departure_reasons': <String>[],
    'dismissal_technical': null,
    'interns': null,
    'intern_types': <String>[],
    'skills_needs': null,
    'training_needs': null,
  };

  factory QuizScope.fresh() => QuizScope(Map<String, dynamic>.from(defaults));

  bool? b(String key) {
    final v = raw[key];
    return v is bool ? v : null;
  }

  List<String> l(String key) {
    final v = raw[key];
    return v is List ? v.map((e) => e.toString()).toList() : const [];
  }

  QuizScope copyWith(Map<String, dynamic> changes) =>
      QuizScope({...raw, ...changes});

  Map<String, dynamic> toJson() => Map<String, dynamic>.from(raw);
}

/// The saved answers, or null when the quiz was never opened
/// (react-web readQuizScope).
QuizScope? readQuizScope(Map<String, dynamic> data) {
  final raw = data['_scopeConfig'];
  if (raw is! Map) return null;
  return QuizScope({...QuizScope.defaults, ...Map<String, dynamic>.from(raw)});
}

typedef HasTable = bool Function(String code);

bool isAdministrationLayout(HasTable hasTable) => hasTable('S21Q02');
bool hasDisabilityTable(HasTable hasTable) =>
    hasTable('S22Q04') || hasTable('S21Q03');
bool hasVulnerableTable(HasTable hasTable) =>
    hasTable('S22Q05') ||
    hasTable('S22Q05_ENTERPRISE') ||
    hasTable('S22Q05_OTHER') ||
    hasTable('S21Q04');

/// The quiz questions an entity is asked, in order.
List<String> quizQuestionsFor(HasTable hasTable) {
  final list = <String>[];
  if (hasTable('S21Q01') && !isAdministrationLayout(hasTable)) {
    list.add('applications');
  }
  if (['S21Q02', 'S22Q01', 'S22Q02', 'S22Q03', 'S22Q04', 'S22Q05',
      'S22Q05_ENTERPRISE', 'S22Q05_OTHER'].any(hasTable)) {
    list.add('recruitment');
  }
  if (hasTable('S23Q01')) list.add('primo_seekers');
  if (hasTable('S23Q02')) list.add('primo_workers');
  if (hasTable('S3Q01')) list.add('departures');
  if (hasTable('S4Q01')) list.add('interns');
  if (hasTable('S4Q02')) list.add('skills');
  if (hasTable('S4Q03')) list.add('training');
  return list;
}

bool isQuizQuestionComplete(String qId, QuizScope s, HasTable hasTable) {
  switch (qId) {
    case 'applications':
      final a = s.b('applications');
      if (a == null) return false;
      if (a == false) return true;
      return s.l('application_csp').isNotEmpty && s.l('application_age').isNotEmpty;
    case 'recruitment':
      final r = s.b('recruit');
      if (r == null) return false;
      if (r == false) return true;
      if (hasTable('S22Q02') && s.l('recruit_types').isEmpty) return false;
      if (!isAdministrationLayout(hasTable) && s.l('recruit_csp').isEmpty) return false;
      if (s.l('recruit_age').isEmpty) return false;
      if (hasTable('S22Q03') && s.l('recruit_diploma').isEmpty) return false;
      if (hasDisabilityTable(hasTable) && s.b('disability') == null) return false;
      if (hasVulnerableTable(hasTable) && s.b('vulnerable') == null) return false;
      return true;
    case 'primo_seekers':
      final p = s.b('primo_seekers');
      if (p == null) return false;
      if (p == false) return true;
      return s.l('primo_seekers_csp').isNotEmpty && s.l('primo_seekers_age').isNotEmpty;
    case 'primo_workers':
      final p = s.b('primo_workers');
      if (p == null) return false;
      if (p == false) return true;
      return s.l('primo_workers_types').isNotEmpty &&
          s.l('primo_workers_csp').isNotEmpty &&
          s.l('primo_workers_age').isNotEmpty;
    case 'departures':
      final d = s.b('departures');
      if (d == null) return false;
      if (d == false) return true;
      if (s.l('departure_reasons').isEmpty) return false;
      if (hasTable('S3Q03') &&
          s.l('departure_reasons').contains('licenciement') &&
          s.b('dismissal_technical') == null) {
        return false;
      }
      return true;
    case 'interns':
      final i = s.b('interns');
      if (i == null) return false;
      if (i == false) return true;
      return s.l('intern_types').isNotEmpty;
    case 'skills':
      return s.b('skills_needs') != null;
    case 'training':
      return s.b('training_needs') != null;
  }
  return false;
}

bool isQuizComplete(QuizScope? s, HasTable hasTable) {
  final qs = quizQuestionsFor(hasTable);
  if (qs.isEmpty) return true;
  if (s == null) return false;
  return qs.every((q) => isQuizQuestionComplete(q, s, hasTable));
}

/// Which tables each quiz question governs (react-web EVENT_TABLE_MAPPING).
class QuizEventMapping {
  final List<String> tableCodes;
  final List<String> prefixes;
  final Map<String, dynamic> resetScope;
  const QuizEventMapping(this.tableCodes, this.prefixes, this.resetScope);
}

const kEventTableMapping = <String, QuizEventMapping>{
  'applications': QuizEventMapping(['S21Q01'], ['s21q01_'], {
    'applications': false,
    'application_csp': <String>[],
    'application_age': <String>[],
  }),
  'recruitment': QuizEventMapping([
    'S22Q01', 'S22Q02', 'S22Q03', 'S22Q04', 'S22Q05', 'S22Q05_ENTERPRISE',
    'S22Q05_OTHER', 'S21Q02', 'S21Q03', 'S21Q04',
  ], [
    's22q01_', 's22q02_', 's22q03_', 's22q04_', 's22q05_', 's21q02_',
    's21q03_', 's21q04_',
  ], {
    'recruit': false,
    'recruit_types': <String>[],
    'recruit_csp': <String>[],
    'recruit_age': <String>[],
    'recruit_diploma': <String>[],
    'disability': null,
    'vulnerable': null,
  }),
  'primo_seekers': QuizEventMapping(['S23Q01'], ['s23q01_'], {
    'primo_seekers': false,
    'primo_seekers_csp': <String>[],
    'primo_seekers_age': <String>[],
  }),
  'primo_workers': QuizEventMapping(['S23Q02'], ['s23q02_'], {
    'primo_workers': false,
    'primo_workers_types': <String>[],
    'primo_workers_csp': <String>[],
    'primo_workers_age': <String>[],
  }),
  'departures': QuizEventMapping(['S3Q01', 'S3Q02', 'S3Q03'],
      ['s3q01_', 's3q02_', 's3q03_'], {
    'departures': false,
    'departure_reasons': <String>[],
    'dismissal_technical': null,
  }),
  'interns': QuizEventMapping(['S4Q01', 'PP_S4Q01'], ['s4q01_', 'pp_s4q01_'], {
    'interns': false,
    'intern_types': <String>[],
  }),
  'skills': QuizEventMapping(['S4Q02', 'PP_S4Q02'], ['s4q02_', 'pp_s4q02_'], {
    'skills_needs': false,
  }),
  'training': QuizEventMapping(['S4Q03', 'PP_S4Q03'], ['s4q03_', 'pp_s4q03_'], {
    'training_needs': false,
  }),
};

/// Whether the answers open a table (react-web isTableReported).
bool isTableReported(String tableCode, QuizScope s) {
  final recruit = s.b('recruit') == true;
  switch (tableCode.toUpperCase()) {
    case 'S21Q01':
      return s.b('applications') == true;
    case 'S21Q02':
      return recruit;
    case 'S21Q03':
      return recruit && s.b('disability') == true;
    case 'S21Q04':
      return recruit && s.b('vulnerable') == true;
    case 'S22Q01':
      return recruit && s.l('recruit_types').contains('permanent');
    case 'S22Q02':
      return recruit && s.l('recruit_types').contains('temporaire');
    case 'S22Q03':
      return recruit && s.l('recruit_diploma').isNotEmpty;
    case 'S22Q04':
      return recruit && s.b('disability') == true;
    case 'S22Q05':
    case 'S22Q05_ENTERPRISE':
    case 'S22Q05_OTHER':
      return recruit && s.b('vulnerable') == true;
    case 'S23Q01':
      return s.b('primo_seekers') == true;
    case 'S23Q02':
      return s.b('primo_workers') == true;
    case 'S3Q01':
      return s.b('departures') == true && s.l('departure_reasons').isNotEmpty;
    case 'S3Q02':
      return s.b('departures') == true &&
          s.l('departure_reasons').contains('licenciement');
    case 'S3Q03':
      return s.b('departures') == true && s.b('dismissal_technical') == true;
    case 'S4Q01':
    case 'PP_S4Q01':
      return s.b('interns') == true && s.l('intern_types').isNotEmpty;
    case 'S4Q02':
    case 'PP_S4Q02':
      return s.b('skills_needs') == true;
    case 'S4Q03':
    case 'PP_S4Q03':
      return s.b('training_needs') == true;
  }
  return false;
}

String? quizQuestionForTable(String tableCode) {
  final code = tableCode.toUpperCase();
  for (final e in kEventTableMapping.entries) {
    if (e.value.tableCodes.contains(code)) return e.key;
  }
  return null;
}

/// REPORTED / NONE from the answers, or null while the governing question
/// is unanswered (react-web deriveQuizTableStatus).
String? deriveQuizTableStatus(String tableCode, QuizScope s, HasTable hasTable) {
  final qId = quizQuestionForTable(tableCode);
  if (qId == null || !isQuizQuestionComplete(qId, s, hasTable)) return null;
  return isTableReported(tableCode, s) ? 'REPORTED' : 'NONE';
}

/// The questions shown one by one: each main question, then its follow-ups
/// once answered « Oui » (react-web orderedBeats).
class QuizBeat {
  final String mainId;
  final String? childId;
  const QuizBeat(this.mainId, [this.childId]);

  @override
  bool operator ==(Object other) =>
      other is QuizBeat && other.mainId == mainId && other.childId == childId;
  @override
  int get hashCode => Object.hash(mainId, childId);
}

List<QuizBeat> orderedQuizBeats(QuizScope s, HasTable hasTable) {
  final beats = <QuizBeat>[];
  for (final q in quizQuestionsFor(hasTable)) {
    beats.add(QuizBeat(q));
    if (q == 'applications' && s.b('applications') == true) {
      beats.add(const QuizBeat('applications', 'application_csp'));
      beats.add(const QuizBeat('applications', 'application_age'));
    } else if (q == 'recruitment' && s.b('recruit') == true) {
      if (hasTable('S22Q02')) beats.add(const QuizBeat('recruitment', 'recruit_types'));
      if (!isAdministrationLayout(hasTable)) {
        beats.add(const QuizBeat('recruitment', 'recruit_csp'));
      }
      beats.add(const QuizBeat('recruitment', 'recruit_age'));
      if (hasTable('S22Q03')) beats.add(const QuizBeat('recruitment', 'recruit_diploma'));
      if (hasDisabilityTable(hasTable)) {
        beats.add(const QuizBeat('recruitment', 'recruit_disability'));
      }
      if (hasVulnerableTable(hasTable)) {
        beats.add(const QuizBeat('recruitment', 'recruit_vulnerable'));
      }
    } else if (q == 'primo_seekers' && s.b('primo_seekers') == true) {
      beats.add(const QuizBeat('primo_seekers', 'primo_seekers_csp'));
      beats.add(const QuizBeat('primo_seekers', 'primo_seekers_age'));
    } else if (q == 'primo_workers' && s.b('primo_workers') == true) {
      beats.add(const QuizBeat('primo_workers', 'primo_workers_types'));
      beats.add(const QuizBeat('primo_workers', 'primo_workers_csp'));
      beats.add(const QuizBeat('primo_workers', 'primo_workers_age'));
    } else if (q == 'departures' && s.b('departures') == true) {
      beats.add(const QuizBeat('departures', 'departure_reasons'));
      if (hasTable('S3Q03') && s.l('departure_reasons').contains('licenciement')) {
        beats.add(const QuizBeat('departures', 'dismissal_technical'));
      }
    } else if (q == 'interns' && s.b('interns') == true) {
      beats.add(const QuizBeat('interns', 'intern_types'));
    }
  }
  return beats;
}

/// The scope key a main question's « Oui / Non » is stored under.
const kMainAnswerKey = <String, String>{
  'applications': 'applications',
  'recruitment': 'recruit',
  'primo_seekers': 'primo_seekers',
  'primo_workers': 'primo_workers',
  'departures': 'departures',
  'interns': 'interns',
  'skills': 'skills_needs',
  'training': 'training_needs',
};

/// The first follow-up opened by « Oui » (react-web handleSelectMainYes).
QuizBeat? firstChildBeat(String mainId, HasTable hasTable) {
  switch (mainId) {
    case 'applications':
      return const QuizBeat('applications', 'application_csp');
    case 'recruitment':
      return QuizBeat(
          'recruitment',
          hasTable('S22Q02')
              ? 'recruit_types'
              : isAdministrationLayout(hasTable)
                  ? 'recruit_age'
                  : 'recruit_csp');
    case 'primo_seekers':
      return const QuizBeat('primo_seekers', 'primo_seekers_csp');
    case 'primo_workers':
      return const QuizBeat('primo_workers', 'primo_workers_types');
    case 'departures':
      return const QuizBeat('departures', 'departure_reasons');
    case 'interns':
      return const QuizBeat('interns', 'intern_types');
  }
  return null;
}

/// Whether the current beat is answered (react-web EventQuestion canContinue).
bool canContinueBeat(QuizBeat beat, QuizScope s) {
  final child = beat.childId;
  if (child == null) return s.b(kMainAnswerKey[beat.mainId]!) != null;
  switch (child) {
    case 'recruit_disability':
      return s.b('disability') != null;
    case 'recruit_vulnerable':
      return s.b('vulnerable') != null;
    case 'dismissal_technical':
      return s.b('dismissal_technical') != null;
    default:
      return s.l(child).isNotEmpty;
  }
}

/// The global category / age lists (react-web commitScopeToFormData).
({List<String> csps, List<String> ages}) activeCspsAndAges(QuizScope s) {
  final csps = <String>{};
  final ages = <String>{};
  void add(String flag, String csp, String age) {
    if (s.b(flag) == true) {
      csps.addAll(s.l(csp));
      ages.addAll(s.l(age));
    }
  }

  add('applications', 'application_csp', 'application_age');
  add('recruit', 'recruit_csp', 'recruit_age');
  add('primo_seekers', 'primo_seekers_csp', 'primo_seekers_age');
  add('primo_workers', 'primo_workers_csp', 'primo_workers_age');
  return (csps: csps.toList(), ages: ages.toList());
}

/// Every table would be at nil (react-web isGlobalNone).
bool isGlobalNone(QuizScope s) {
  if (s.b('applications') == true) return false;
  if (s.b('recruit') == true) return false;
  if (s.b('primo_seekers') == true) return false;
  if (s.b('primo_workers') == true) return false;
  if (s.b('departures') == true) return false;
  if (s.b('interns') == true && s.l('intern_types').isNotEmpty) return false;
  if (s.b('skills_needs') == true) return false;
  if (s.b('training_needs') == true) return false;
  return true;
}

// ── Data of tables (react-web ScopeDataManagement) ─────────────────────

/// Cell / text prefixes of each table (react-web TABLE_PREFIX_MAP).
const kTablePrefixMap = <String, List<String>>{
  'S21Q01': ['s21q01_'],
  'S21Q02': ['s21q02_'],
  'S21Q03': ['s21q03_'],
  'S21Q04': ['s21q04_'],
  'S22Q01': ['s22q01_'],
  'S22Q02': ['s22q02_'],
  'S22Q03': ['s22q03_'],
  'S22Q04': ['s22q04_'],
  'S22Q05': ['s22q05_'],
  'S22Q05_ENTERPRISE': ['s22q05_'],
  'S22Q05_OTHER': ['s22q05_'],
  'S23Q01': ['s23q01_'],
  'S23Q02': ['s23q02_'],
  'S3Q01': ['s3q01_'],
  'S3Q02': ['s3q02_'],
  'S3Q03': ['s3q03_'],
  'S4Q01': ['s4q01_', 'pp_s4q01_'],
  'S4Q02': ['s4q02_', 'pp_s4q02_'],
  'S4Q03': ['s4q03_', 'pp_s4q03_'],
};

List<String> keysMatchingPrefixes(Map<String, dynamic> data, List<String> prefixes) {
  final lower = prefixes.map((p) => p.toLowerCase()).toList();
  return data.keys.where((k) {
    final lk = k.toLowerCase();
    if (lk.endsWith('_response_status')) return false;
    return lower.any(lk.startsWith);
  }).toList();
}

/// A figure or a typed text (zero and blank are not « entered data »).
bool isEnteredCellData(dynamic v) {
  if (v == null) return false;
  if (v is num) return v != 0;
  if (v is String) {
    final t = v.trim();
    if (t.isEmpty) return false;
    final n = num.tryParse(t);
    return n == null ? true : n != 0;
  }
  return false;
}

bool hasEnteredDataForEvent(String mainId, Map<String, dynamic> data, HasTable hasTable) {
  final m = kEventTableMapping[mainId];
  if (m == null || !m.tableCodes.any(hasTable)) return false;
  return keysMatchingPrefixes(data, m.prefixes).any((k) => isEnteredCellData(data[k]));
}

/// Figures typed in tables these answers close (react-web hasDroppedDataWarning).
bool hasDroppedData(QuizScope s, Map<String, dynamic> data, HasTable hasTable) {
  for (final e in kTablePrefixMap.entries) {
    if (!hasTable(e.key) || isTableReported(e.key, s)) continue;
    if (keysMatchingPrefixes(data, e.value).any((k) => isEnteredCellData(data[k]))) {
      return true;
    }
  }
  return false;
}

/// Keys of tables these answers close (react-web purgeAllDroppedTablesData).
List<String> droppedTableKeys(QuizScope s, Map<String, dynamic> data, HasTable hasTable) {
  final out = <String>{};
  for (final e in kTablePrefixMap.entries) {
    if (hasTable(e.key) && !isTableReported(e.key, s)) {
      out.addAll(keysMatchingPrefixes(data, e.value));
    }
  }
  return out.toList();
}

// ── Which cells the answers keep (react-web resolveTableScope & the
//    per-table filters of modernJobsTableDefinitions.ts) ──────────────

const _cspRowKeys = {'cadres', 'foremen', 'workers'};
const _adminRowKeys = {'fonctionnaire', 'decisionnaire', 'contractuelle'};
const _ageTokens = {'15_24', '25_34', '35_plus'};

String _normCsp(String k) =>
    k == 'maitrise' ? 'foremen' : (k == 'execution' ? 'workers' : k);

/// Whether a cell of table [tablePrefix] is still asked under the answers
/// in [data]. Without answers every cell is kept.
bool quizKeepsCell(String tablePrefix, String cellId, Map<String, dynamic> data) {
  final raw = data['_scopeConfig'];
  final scope = raw is Map ? QuizScope(Map<String, dynamic>.from(raw)) : null;
  final tid = tablePrefix.toLowerCase();
  final id = cellId.toLowerCase();
  if (!id.startsWith('${tid}_')) return true;
  final rest = id.substring(tid.length + 1);
  final tokens = rest.split('_');
  bool hasToken(String t) => tokens.contains(t);

  // Administration's census and Project / Programme Section 4 are never
  // narrowed by this quiz.
  if (tid.startsWith('pp_s4')) return true;
  if (tid == 's21q01' && _adminRowKeys.any(hasToken)) return true;

  List<String>? ages;
  List<String>? csps;
  List<String>? pick(String flag, String key) {
    if (scope == null || scope.b(flag) != true) return null;
    final v = scope.l(key);
    return v.isEmpty ? null : v;
  }

  if (tid == 's21q01') {
    ages = pick('applications', 'application_age');
    csps = pick('applications', 'application_csp');
  } else if (RegExp(r'^s21q0[234]$').hasMatch(tid) || tid.startsWith('s22q0')) {
    ages = pick('recruit', 'recruit_age');
    csps = pick('recruit', 'recruit_csp');
  } else if (tid == 's23q01') {
    ages = pick('primo_seekers', 'primo_seekers_age');
    csps = pick('primo_seekers', 'primo_seekers_csp');
  } else if (tid == 's23q02') {
    ages = pick('primo_workers', 'primo_workers_age');
    csps = pick('primo_workers', 'primo_workers_csp');
  }
  List<String>? global(String key) {
    final v = data[key];
    return v is List && v.isNotEmpty ? v.map((e) => e.toString()).toList() : null;
  }

  ages ??= global('_scopeAge');
  csps ??= global('_scopeCsp');

  // Age groups (the age-banded tables).
  if (ages != null) {
    for (final a in _ageTokens) {
      if (rest.contains(a) && !ages.contains(a)) return false;
    }
  }

  // Socio-professional categories (only rows that are one of the three).
  if (csps != null) {
    final kept = csps.map(_normCsp).toSet();
    final row = tokens.firstWhere(_cspRowKeys.contains, orElse: () => '');
    if (row.isNotEmpty && kept.intersection(_cspRowKeys).isNotEmpty && !kept.contains(row)) {
      return false;
    }
  }

  if (scope == null) return true;

  // S22Q03: diplomas.
  if (tid == 's22q03') {
    final dips = scope.l('recruit_diploma');
    if (dips.isNotEmpty) {
      final row = kDiplomaOptions.map((o) => o.id).firstWhere(
          (d) => rest.startsWith('${d}_'),
          orElse: () => '');
      if (row.isNotEmpty && !dips.contains(row)) return false;
    }
  }

  // S3Q01: departure reasons (« Ensemble » stays).
  if (tid == 's3q01') {
    final reasons = scope.l('departure_reasons');
    if (reasons.isNotEmpty) {
      const map = {
        'licenciement': 'dismissal',
        'demission': 'resignation',
        'retraite': 'retirement',
        'autre': 'other',
      };
      final kept = reasons.map((r) => map[r]).whereType<String>().toSet();
      for (final t in const ['dismissal', 'resignation', 'retirement', 'other']) {
        if (hasToken(t) && !kept.contains(t)) return false;
      }
    }
  }

  // S4Q01: internship types.
  if (tid == 's4q01') {
    final types = scope.l('intern_types');
    if (types.isNotEmpty) {
      const map = {
        'vacance': 'vacation',
        'academique': 'academic',
        'professionnel': 'professional',
        'preemploi': 'pre_employment',
      };
      final kept = types.map((t) => map[t]).whereType<String>().toSet();
      final row = const ['vacation', 'academic', 'professional', 'pre_employment']
          .firstWhere((r) => rest.startsWith('${r}_'), orElse: () => '');
      if (row.isNotEmpty && !kept.contains(row)) return false;
    }
  }

  // S23Q02: contract types.
  if (tid == 's23q02') {
    final types = scope.l('primo_workers_types');
    if (types.isNotEmpty) {
      final kept = types.map((t) => t == 'temporaire' ? 'temporary' : t).toSet();
      final c = rest.startsWith('permanent_')
          ? 'permanent'
          : rest.startsWith('temporary_')
              ? 'temporary'
              : '';
      if (c.isNotEmpty && !kept.contains(c)) return false;
    }
  }
  return true;
}

// ── Submission (react-web applyQuizDerivedTableSemantics) ──────────────

/// A table of the schema, as the submission needs it.
class QuizTable {
  final String id;
  final String? paperCode;
  final String sectionId;
  final String prefix;
  final List<String> cellIds;
  const QuizTable(this.id, this.paperCode, this.sectionId, this.prefix, this.cellIds);
}

String quizStatusKey(QuizTable t) => '${t.paperCode ?? t.id}_RESPONSE_STATUS';

/// The table code the quiz governs this table by, if any.
String? quizTableCode(QuizTable t) {
  for (final c in [t.id.toUpperCase(), (t.paperCode ?? '').toUpperCase()]) {
    if (c.isNotEmpty && quizQuestionForTable(c) != null) return c;
  }
  return null;
}

HasTable hasTableIn(List<QuizTable> tables) {
  final codes = <String>{};
  for (final t in tables) {
    if (t.sectionId == 'section0' || t.sectionId.startsWith('section1_')) continue;
    codes.add(t.id.toUpperCase());
    if (t.paperCode != null) codes.add(t.paperCode!.toUpperCase());
  }
  return (code) => codes.contains(code.toUpperCase());
}

/// Statuses (and the zeros they imply) the answers give the tables, applied
/// to a copy of the payload; the quiz keys are dropped from it.
Map<String, dynamic> applyEmployerQuizSemantics(
    List<QuizTable> tables, Map<String, dynamic> payload) {
  final out = Map<String, dynamic>.from(payload);
  final hasTable = hasTableIn(tables);
  final scope = readQuizScope(payload);
  if (scope != null && quizQuestionsFor(hasTable).isNotEmpty) {
    for (final t in tables) {
      final code = quizTableCode(t);
      if (code == null) continue;
      final status = deriveQuizTableStatus(code, scope, hasTable);
      if (status == null) continue; // unanswered — submission is blocked
      out[quizStatusKey(t)] = status;
      for (final id in t.cellIds) {
        if (status == 'NONE' || !quizKeepsCell(t.prefix, id, payload)) out[id] = 0;
      }
    }
    // Administration's census is never governed by the quiz: a submitted
    // Administration declaration has it filled.
    if (isAdministrationLayout(hasTable)) {
      for (final t in tables) {
        if ((t.paperCode ?? t.id).toUpperCase() == 'S21Q01') {
          out[quizStatusKey(t)] = 'REPORTED';
        }
      }
    }
  }
  out.remove('_scopeConfig');
  out.remove('_scopeCsp');
  out.remove('_scopeAge');
  return out;
}

/// What the answers write into the form: the answers themselves, the
/// global lists, and each governed table's status (react-web
/// commitScopeToFormData). Unanswered questions write no status.
Map<String, dynamic> quizCommitUpdates(List<QuizTable> tables, QuizScope s) {
  final hasTable = hasTableIn(tables);
  final ca = activeCspsAndAges(s);
  final out = <String, dynamic>{
    '_scopeConfig': s.toJson(),
    '_scopeCsp': ca.csps,
    '_scopeAge': ca.ages,
  };
  for (final t in tables) {
    final code = quizTableCode(t);
    if (code == null) continue;
    final status = deriveQuizTableStatus(code, s, hasTable);
    if (status != null) out[quizStatusKey(t)] = status;
  }
  return out;
}

/// Cells of tables the new answers open again that still hold the 0 they
/// were given while closed (react-web zeroedCellsBackInView): they come
/// back blank, never as an answer.
List<String> zeroedCellsBackInView(List<QuizTable> tables,
    Map<String, dynamic> before, QuizScope after) {
  final hasTable = hasTableIn(tables);
  final out = <String>[];
  for (final t in tables) {
    final code = quizTableCode(t);
    if (code == null) continue;
    if (deriveQuizTableStatus(code, after, hasTable) != 'REPORTED') continue;
    final wasOpen = before[quizStatusKey(t)] == 'REPORTED';
    final ca = activeCspsAndAges(after);
    final afterData = {
      ...before,
      '_scopeConfig': after.toJson(),
      '_scopeCsp': ca.csps,
      '_scopeAge': ca.ages,
    };
    for (final id in t.cellIds) {
      final v = before[id];
      final isZero = v == 0 || v == '0';
      if (!isZero) continue;
      final visibleBefore = wasOpen && quizKeepsCell(t.prefix, id, before);
      if (!visibleBefore && quizKeepsCell(t.prefix, id, afterData)) out.add(id);
    }
  }
  return out;
}
