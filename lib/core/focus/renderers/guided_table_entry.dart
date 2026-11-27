// lib/core/focus/renderers/guided_table_entry.dart
// ══════════════════════════════════════════════════════════════
// MODE GUIDÉ on a phone — the Flutter adaptation of the React web app's
// guided entry (react-web: GuidedStatisticalEntry.tsx, resolveGuidedScope.ts,
// GuidedReviewGate.tsx, messages modernJobs.guided). Same behaviour, same
// wording; nothing added. On a phone Guidé is the only mode.
//
//  - One question per screen: « Question n sur N », the group asked about
//    (category · dimension), the conversational question, then
//    « Nombre total » with « Aucun (0) »; above 0, « Parmi eux, combien de
//    femmes ? » with the men deduced (or the men first, by choice).
//  - The page's own Suivant / Précédent step through the questions
//    (GuidedRegistry, React's GuidedReviewGate): Suivant checks the
//    question, moves to the next one, and after the last opens
//    « Vérifiez vos réponses »; Suivant there moves on to the next question
//    of the form.
//  - Writes the same cells as the tables (onNumberChanged, the row-label
//    text controllers), so stored data and totals are unchanged.
//
// The questions are built from the GridRenderSpec the phone cards render,
// as React builds them from its table definition: one question per row ×
// age band / motive / status, the sex axis giving the men/women split.
// The preliminary quiz that narrows the rows in React (resolveTableScope)
// is not part of this file.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/app_colors.dart';
import '../../i18n/localized_text.dart';
import 'grid_render_spec.dart';

/// Below this width Guidé is the only mode (a phone).
const double kGuidedEntryMaxWidth = 600;

// ── Wording (react-web messages, modernJobs.guided) ────────────────────

class _T {
  final bool en;
  const _T(this.en);
  String _s(String fr, String e) => en ? e : fr;

  // ICU plural "one": French counts 0 and 1, English only 1.
  bool _one(int n) => en ? n == 1 : n < 2;

  String questionOf(int c, int t) =>
      _s('Question $c sur $t', 'Question $c of $t');
  String get totalNumber => _s('Nombre total', 'Total number');
  String get persons => _s('personne(s)', 'person(s)');
  String get none0 => _s('Aucun (0)', 'None (0)');
  String get declaredZero =>
      _s('✓ Déclaré à 0 pour ce groupe.', '✓ Declared as 0 for this group.');
  String get zeroIsValid => _s(
      "S'il n'y a personne dans ce groupe, 0 est une réponse valide.",
      'If there is nobody in this group, 0 is a valid answer.');
  String get fewerThanThree => _s(
      'Moins de trois à indiquer ? Choisissez « Aucun (0) » pour les lignes restantes.',
      'Fewer than three to list? Choose “None (0)” for the remaining lines.');
  String get howManyWomen =>
      _s('Parmi eux, combien de femmes ?', 'Of these, how many are women?');
  String get howManyMen =>
      _s("Parmi eux, combien d'hommes ?", 'Of these, how many are men?');
  String get women => _s('femme(s)', 'women');
  String get men => _s('homme(s)', 'men');
  String get menDeduced =>
      _s('homme(s) déduit(s) automatiquement', 'men, deduced automatically');
  String get womenDeduced =>
      _s('femme(s) déduite(s) automatiquement', 'women, deduced automatically');
  String get enterMenFirst =>
      _s("Renseigner les hommes d'abord", 'Enter men first instead');
  String get enterWomenFirst =>
      _s("Renseigner les femmes d'abord", 'Enter women first instead');
  String get clear => _s('Effacer', 'Clear');
  String get permanentCdi => _s('Permanents (CDI)', 'Permanent (CDI)');
  String get temporaryCdd => _s('Temporaires (CDD)', 'Temporary (CDD)');
  String get checkAnswers => _s('Vérifiez vos réponses', 'Check your answers');
  String get checkAnswersHint => _s(
      'Modifiez une ligne si nécessaire, puis poursuivez avec le bouton en bas de page.',
      'Change any line if needed, then carry on with the button at the bottom of the page.');
  String get answerThem => _s('Y répondre', 'Answer them');
  String get number => _s('Nombre', 'Number');
  String get notAnswered => _s('Sans réponse', 'Not answered');
  String get change => _s('Modifier', 'Change');
  String get total => 'Total';
  String get enterTotalOrNone => _s(
      'Indiquez le nombre total, ou choisissez « Aucun (0) ».',
      'Enter the total, or choose “None (0)”.');
  String get enterWomenCount => _s(
      "Indiquez combien de femmes (ou d'hommes) parmi eux.",
      'Enter how many women (or men) among them.');
  String cannotExceedTotal(int t) => _s(
      'Ce nombre ne peut pas dépasser le total ($t).',
      'This cannot exceed the total ($t).');
  String specifyTextField(String field) =>
      _s('Précisez le $field concerné.', 'Enter the $field for these people.');
  String get wholeNumber =>
      _s('Saisissez un nombre entier (ex. 12)', 'Enter a whole number (e.g. 12)');
  String people(int n) => en
      ? (_one(n) ? '$n person' : '$n people')
      : (_one(n) ? '$n personne' : '$n personnes');
  String menWomenSplit(int m, int w) => en
      ? '${_one(m) ? '$m man' : '$m men'}, ${_one(w) ? '$w woman' : '$w women'}'
      : '${_one(m) ? '$m homme' : '$m hommes'}, ${_one(w) ? '$w femme' : '$w femmes'}';
  String unansweredCount(int n) => en
      ? (_one(n)
          ? '$n question still unanswered.'
          : '$n questions still unanswered.')
      : (_one(n)
          ? '$n question encore sans réponse.'
          : '$n questions encore sans réponse.');
}

// ── Questions (react-web resolveGuidedScope.ts) ────────────────────────

enum GuidedContract { permanent, temporary, other }

enum _Sex { male, female, total }

_Sex? _sexOf(String label) {
  final l = label.toLowerCase().trim();
  if (l.isEmpty) return null;
  if (l == 'm' ||
      l == 'h' ||
      RegExp(r'^(homme|hommes|masculin|male|males|men)\b').hasMatch(l)) {
    return _Sex.male;
  }
  if (l == 'f' ||
      RegExp(r'^(femme|femmes|féminin|feminin|female|females|women)\b')
          .hasMatch(l)) {
    return _Sex.female;
  }
  if (l.startsWith('total') || l.startsWith('ensemble')) return _Sex.total;
  return null;
}

bool _isTotalLabel(String l) {
  final s = l.toLowerCase().trim();
  return s.startsWith('total') || s.startsWith('ensemble');
}

/// "Sex"/"Sexe" heads the men/women columns; it is not a category to ask.
bool _isSexGroup(String? label) =>
    label != null &&
    RegExp(r'^\s*sex(e)?\s*$', caseSensitive: false).hasMatch(label);

class GuidedTextField {
  final String fieldId;
  final String label;
  final String placeholder;
  const GuidedTextField(this.fieldId, this.label, this.placeholder);
}

class GuidedQuestion {
  final String id;
  final String rowLabel;
  final String categoryTag;
  final String? dimensionTag;
  final GuidedContract contract;
  final String prompt;
  final String? totalId;
  final String? maleId;
  final String? femaleId;

  /// A question with no sex split: its one cell.
  final String? singleId;
  final GuidedTextField? textField;

  const GuidedQuestion({
    required this.id,
    required this.rowLabel,
    required this.categoryTag,
    required this.dimensionTag,
    required this.contract,
    required this.prompt,
    this.totalId,
    this.maleId,
    this.femaleId,
    this.singleId,
    this.textField,
  });

  bool get isGenderSplit => maleId != null && femaleId != null;

  List<String> get breakdownIds => [
        if (maleId != null) maleId!,
        if (femaleId != null) femaleId!,
        if (singleId != null) singleId!,
      ];
}

/// The free-text row of the reasons / skills / training tables
/// (react-web EMBEDDED_ROW_TEXT).
const _embeddedRowText = <String, (LocalizedText, LocalizedText)>{
  's3q02': (
    LocalizedText(fr: 'Motif de licenciement', en: 'Dismissal reason'),
    LocalizedText(
        fr: 'Décrivez le motif de licenciement',
        en: 'Describe the reason for dismissal'),
  ),
  's4q02': (
    LocalizedText(fr: 'Domaine de compétence', en: 'Skill domain'),
    LocalizedText(
        fr: 'Ex: Gestion, Comptabilité, Marketing, RH, Technique...',
        en: 'E.g. Management, Accounting, Marketing, HR, Technical...'),
  ),
  's4q03': (
    LocalizedText(fr: 'Domaine de formation', en: 'Training domain'),
    LocalizedText(
        fr: 'Ex: Leadership, Techniques de vente, Gestion de projet...',
        en: 'E.g. Leadership, Sales techniques, Project management...'),
  ),
};

class GuidedTableModel {
  final String tableId;
  final List<GuidedQuestion> questions;
  const GuidedTableModel(this.tableId, this.questions);

  /// Null when the table has a cell that is not a number (the phone cards
  /// then stay): React guides its statistical tables only.
  ///
  /// [keepCell]: the cells the preliminary quiz still asks (react-web
  /// resolveTableScope); a question with a cell it drops is not asked.
  static GuidedTableModel? from(
      GridRenderSpec spec, String tableId, Locale locale,
      {bool Function(String cellId)? keepCell}) {
    final en = locale.languageCode == 'en';
    final tid = tableId.toLowerCase();
    final raw = <_RawQ>[];

    final groups = spec.categoryGridGroups;
    if (groups != null) {
      for (final g in groups) {
        // « Total » / « Ensemble » groups are computed across the motives
        // or statuses: React never asks them (validGroups).
        if (g.outerLabel != null && _isTotalLabel(g.outerLabel!)) continue;
        for (final mini in g.categories) {
          final qs = _cellsToQuestions(mini.spec, rowLabel: mini.label);
          if (qs == null) return null;
          final outer = g.outerLabel;
          for (final q in qs) {
            if (outer == null || outer.isEmpty) {
              raw.add(q);
            } else if (q.dim == null) {
              // A motive / status axis (S3Q01, S3Q03, S22Q04, S22Q05): the
              // outer label is what the question is about.
              raw.add(q.copyWith(dim: outer));
            } else {
              // A row group of its own (S23Q02 Permanent / Temporaire).
              raw.add(q.copyWith(category: '$outer · ${q.row}'));
            }
          }
        }
      }
    } else {
      if (spec.matrix.isEmpty || spec.hasLeadingGroup) return null;
      final embedded = _embeddedRowText[tid];
      for (var r = 0; r < spec.matrix.length; r++) {
        final rowLabel = r < spec.rowLabels.length ? spec.rowLabels[r] : '';
        final rowSpec = GridRenderSpec(
          id: spec.id,
          rowLabels: [rowLabel],
          matrix: [spec.matrix[r]],
          headers: spec.headers,
          cellSpec: spec.cellSpec,
          isTotalCell: spec.isTotalCell,
        );
        final qs = _cellsToQuestions(rowSpec, rowLabel: rowLabel);
        if (qs == null) return null;
        final labelIds = spec.rowLabelCellIds;
        final textId =
            labelIds != null && r < labelIds.length ? labelIds[r] : '';
        for (final q in qs) {
          raw.add(textId.isNotEmpty && embedded != null
              ? q.copyWith(
                  text: GuidedTextField(
                  textId,
                  '${embedded.$1.of(locale)} ${r + 1}',
                  embedded.$2.of(locale),
                ))
              : q);
        }
      }
    }

    // React asks row by row, each row's age bands / motives in order.
    final order = <String>[];
    final byRow = <String, List<_RawQ>>{};
    for (final q in raw) {
      final key = q.category ?? q.row;
      if (!byRow.containsKey(key)) {
        order.add(key);
        byRow[key] = [];
      }
      byRow[key]!.add(q);
    }
    final questions = <GuidedQuestion>[];
    for (final key in order) {
      for (final q in byRow[key]!) {
        if (keepCell != null && !q.breakdowns.every(keepCell)) continue;
        final p = buildConversationalPrompt(tid, q.row, q.dim, en: en);
        questions.add(GuidedQuestion(
          id: q.breakdowns.join('|'),
          rowLabel: q.row,
          categoryTag: q.category ?? q.row,
          dimensionTag: _isSexGroup(q.dim) ? null : q.dim,
          contract: p.contract,
          prompt: p.prompt,
          totalId: q.totalId,
          maleId: q.maleId,
          femaleId: q.femaleId,
          singleId: q.singleId,
          textField: q.text,
        ));
      }
    }
    if (questions.isEmpty) return null;
    return GuidedTableModel(tid, questions);
  }

  static List<List<String>> _leafPaths(List<HeaderNode> nodes,
      [List<String> prefix = const []]) {
    final out = <List<String>>[];
    for (final n in nodes) {
      final path = [...prefix, n.title];
      if (n.children.isEmpty) {
        out.add(path);
      } else {
        out.addAll(_leafPaths(n.children, path));
      }
    }
    return out;
  }

  /// The questions in one category's cells: cells that differ only on the
  /// sex axis are one question; a table with no sex axis asks each cell.
  static List<_RawQ>? _cellsToQuestions(GridRenderSpec s,
      {required String rowLabel}) {
    final leaves = _leafPaths(s.headers);
    final cells = <(String, List<String>, bool)>[];
    for (var r = 0; r < s.matrix.length; r++) {
      final row = s.matrix[r];
      final label = r < s.rowLabels.length ? s.rowLabels[r] : '';
      for (var c = 0; c < row.length; c++) {
        final id = row[c];
        if (id.isEmpty) continue;
        final cs = s.cellSpec?.call(id);
        final isTotal = s.isTotalCell?.call(id) ?? false;
        final editable = (cs?.editable ?? true) && !isTotal;
        if (editable && cs != null && cs.type != CellType.number) return null;
        final col = c < leaves.length ? leaves[c] : const <String>[];
        cells.add((id, [label, ...col], editable));
      }
    }
    if (!cells.any((x) => x.$3)) return const [];

    int? sexPos;
    for (final cell in cells) {
      final parts = cell.$2;
      for (var i = 0; i < parts.length; i++) {
        final sex = _sexOf(parts[i]);
        if (sex == _Sex.male || sex == _Sex.female) {
          sexPos = i;
          break;
        }
      }
      if (sexPos != null) break;
    }

    String? dimOf(List<String> parts, int? without) {
      final d = <String>[
        for (var i = 0; i < parts.length; i++)
          if (i != without &&
              parts[i].trim().isNotEmpty &&
              parts[i].trim() != rowLabel.trim())
            parts[i],
      ];
      return d.isEmpty ? null : d.join(' · ');
    }

    final out = <_RawQ>[];
    final pos = sexPos;
    if (pos == null) {
      for (final cell in cells) {
        if (!cell.$3) continue;
        final dim = dimOf(cell.$2, null);
        if (dim != null && dim.split(' · ').any(_isTotalLabel)) continue;
        out.add(_RawQ(row: rowLabel, dim: dim, singleId: cell.$1));
      }
      return out;
    }

    final order = <String>[];
    final byDim = <String, Map<_Sex, (String, bool)>>{};
    final dims = <String, String?>{};
    for (final cell in cells) {
      final parts = cell.$2;
      final sex = pos < parts.length ? _sexOf(parts[pos]) : null;
      if (sex == null) continue;
      final dim = dimOf(parts, pos);
      if (dim != null && dim.split(' · ').any(_isTotalLabel)) continue;
      final k = dim ?? '';
      if (!byDim.containsKey(k)) {
        order.add(k);
        byDim[k] = {};
        dims[k] = dim;
      }
      byDim[k]![sex] = (cell.$1, cell.$3);
    }
    for (final k in order) {
      final m = byDim[k]!;
      final male = m[_Sex.male];
      final female = m[_Sex.female];
      final total = m[_Sex.total];
      if (male != null && female != null && male.$2 && female.$2) {
        out.add(_RawQ(
          row: rowLabel,
          dim: dims[k],
          maleId: male.$1,
          femaleId: female.$1,
          totalId: total?.$1,
        ));
      }
    }
    return out;
  }
}

class _RawQ {
  final String row;
  final String? category;
  final String? dim;
  final String? maleId;
  final String? femaleId;
  final String? totalId;
  final String? singleId;
  final GuidedTextField? text;
  const _RawQ({
    required this.row,
    this.category,
    this.dim,
    this.maleId,
    this.femaleId,
    this.totalId,
    this.singleId,
    this.text,
  });

  List<String> get breakdowns => [
        if (maleId != null) maleId!,
        if (femaleId != null) femaleId!,
        if (singleId != null) singleId!,
      ];

  _RawQ copyWith({String? category, String? dim, GuidedTextField? text}) =>
      _RawQ(
        row: row,
        category: category ?? this.category,
        dim: dim ?? this.dim,
        maleId: maleId,
        femaleId: femaleId,
        totalId: totalId,
        singleId: singleId,
        text: text ?? this.text,
      );
}

// ── Conversational prompts (react-web buildConversationalPrompt) ───────

class GuidedPrompt {
  final String prompt;
  final GuidedContract contract;
  const GuidedPrompt(this.prompt, this.contract);
}

String? _agePhrase(String? dimLabel, bool en) {
  if (dimLabel == null) return null;
  final d = dimLabel.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (RegExp(r'^15\b').hasMatch(d)) {
    return en ? 'under 25' : 'de moins de 25 ans';
  }
  if (RegExp(r'^25\b').hasMatch(d)) {
    return en ? 'aged 25 to 34' : 'de 25 à 34 ans';
  }
  if (RegExp(r'^35\b').hasMatch(d)) {
    return en ? 'aged 35 and over' : 'de 35 ans et plus';
  }
  return null;
}

final _adminCategoryLabel = RegExp(
    r'^(fonctionnaire|d[ée]cisionnaire|contractuel|civil servant|decision-maker|contractual)',
    caseSensitive: false);

/// "Cadres" → "de cadres", "Agents de Maîtrise" → "d'agents de maîtrise".
String _deGroup(String rowLabel) {
  final lower = rowLabel.toLowerCase();
  return RegExp(r'^[aeiouhéèêàâîôûy]', caseSensitive: false).hasMatch(lower)
      ? "d'$lower"
      : 'de $lower';
}

GuidedContract _contractOf(String tid) {
  if (tid.contains('s22q01') ||
      tid.contains('permanent') ||
      tid.contains('cdi')) {
    return GuidedContract.permanent;
  }
  if (tid.contains('s22q02') ||
      tid.contains('temporaire') ||
      tid.contains('cdd')) {
    return GuidedContract.temporary;
  }
  return GuidedContract.other;
}

GuidedPrompt buildConversationalPrompt(
    String tableId, String rowLabel, String? dimLabel,
    {required bool en}) {
  final tid = tableId.toLowerCase();
  final contract = _contractOf(tid);
  final age = _agePhrase(dimLabel, en);
  final dimSuffix = dimLabel != null ? ' ($dimLabel)' : '';
  final lower = rowLabel.toLowerCase();
  final isTemp =
      RegExp('tempor', caseSensitive: false).hasMatch(dimLabel ?? '');

  // Administration Section 2 (S21Q01–S21Q04, chronological since
  // 2026-09-28). S21Q01 shares its id with the enterprise-family table, so
  // Administration's census is recognised by its civil-service rows.
  final adminCensus = tid == 's21q01' && _adminCategoryLabel.hasMatch(rowLabel);
  final adminRecruit = RegExp(r's21q0[234]').hasMatch(tid);
  if (adminCensus || adminRecruit) {
    final verb = adminCensus
        ? (en ? 'count' : 'recensées')
        : (en ? 'recruit' : 'recrutées');
    final String who;
    if (tid.contains('s21q04')) {
      who = en
          ? 'vulnerable people ($rowLabel)'
          : 'personnes vulnérables ($rowLabel)';
    } else if (tid.contains('s21q03')) {
      who = en
          ? 'people with a disability in the “$rowLabel” category'
          : 'personnes en situation de handicap de la catégorie « $rowLabel »';
    } else {
      final a = age != null ? ' $age' : '';
      who = en
          ? 'people in the “$rowLabel” category$a'
          : 'personnes de la catégorie « $rowLabel »$a';
    }
    return GuidedPrompt(
        en ? 'How many $who did you $verb?' : 'Combien de $who avez-vous $verb ?',
        GuidedContract.other);
  }

  // PP_S4Q01–Q04: permanents / temporaires, recensés / recrutés.
  for (final (code, perm, recruited) in const [
    ('pp_s4q01', true, false),
    ('pp_s4q02', false, false),
    ('pp_s4q03', true, true),
    ('pp_s4q04', false, true),
  ]) {
    if (!tid.contains(code)) continue;
    final kFr = perm ? 'permanents' : 'temporaires';
    final kEn = perm ? 'permanent' : 'temporary';
    final vFr = recruited ? 'recruté' : 'recensé';
    final vEn = recruited ? 'recruit' : 'count';
    return GuidedPrompt(
      en
          ? (age != null
              ? 'How many $kEn workers in the "$rowLabel" category $age did you $vEn?'
              : 'How many $kEn workers in the "$rowLabel" category did you $vEn?')
          : (age != null
              ? 'Combien de $kFr de la catégorie « $rowLabel » $age avez-vous $vFr ?'
              : 'Combien de $kFr de la catégorie « $rowLabel » avez-vous $vFr ?'),
      perm ? GuidedContract.permanent : GuidedContract.temporary,
    );
  }

  if (tid.contains('pp_s4q05')) {
    return GuidedPrompt(
      en
          ? 'How many workers with a disability in the "$rowLabel" category did you recruit as ${isTemp ? 'temporary' : 'permanent'} workers?'
          : 'Combien de personnes en situation de handicap de la catégorie « $rowLabel » avez-vous recruté en tant que ${isTemp ? 'temporaires' : 'permanents'} ?',
      isTemp ? GuidedContract.temporary : GuidedContract.permanent,
    );
  }

  if (tid.contains('pp_s4q06')) {
    return GuidedPrompt(
      en
          ? 'How many $lower did you recruit as ${isTemp ? 'temporary' : 'permanent'} workers?'
          : 'Combien ${_deGroup(rowLabel)} avez-vous recruté en tant que ${isTemp ? 'temporaires' : 'permanents'} ?',
      isTemp ? GuidedContract.temporary : GuidedContract.permanent,
    );
  }

  if (tid.contains('s21q01')) {
    final from = _deGroup(rowLabel).replaceFirstMapped(RegExp(r"^de |^d'"),
        (m) => m[0] == 'de ' ? 'de la part de ' : "de la part d'");
    return GuidedPrompt(
      en
          ? (age != null
              ? 'How many job applications did you receive from $lower $age this quarter?'
              : 'How many job applications from $rowLabel$dimSuffix did you receive?')
          : (age != null
              ? "Combien de demandes d'emploi avez-vous reçues $from $age au cours du trimestre ?"
              : "Combien de demandes d'emploi émanant de $rowLabel$dimSuffix avez-vous reçues ?"),
      contract,
    );
  }

  if (tid.contains('s22q01')) {
    return GuidedPrompt(
      en
          ? (age != null
              ? 'How many $lower $age did you recruit on permanent contracts (CDI) this quarter?'
              : 'How many permanent $rowLabel$dimSuffix did you recruit?')
          : (age != null
              ? 'Combien ${_deGroup(rowLabel)} $age avez-vous recrutés en CDI au cours du trimestre ?'
              : 'Combien de $rowLabel permanents (CDI)$dimSuffix avez-vous recrutés ?'),
      GuidedContract.permanent,
    );
  }

  if (tid.contains('s22q02')) {
    return GuidedPrompt(
      en
          ? (age != null
              ? 'How many $lower $age did you recruit on temporary contracts (CDD) this quarter?'
              : 'How many temporary $rowLabel$dimSuffix did you recruit?')
          : (age != null
              ? 'Combien ${_deGroup(rowLabel)} $age avez-vous recrutés en CDD au cours du trimestre ?'
              : 'Combien de $rowLabel temporaires (CDD)$dimSuffix avez-vous recrutés ?'),
      GuidedContract.temporary,
    );
  }

  if (tid.contains('s22q03')) {
    return GuidedPrompt(
      en
          ? 'How many recruits with education level $rowLabel$dimSuffix did you make?'
          : 'Combien de personnes ayant le diplôme $rowLabel$dimSuffix avez-vous recrutées ?',
      contract,
    );
  }

  if (tid.contains('s22q04')) {
    return GuidedPrompt(
      en
          ? 'How many persons with disabilities did you recruit among $rowLabel$dimSuffix?'
          : 'Combien de personnes en situation de handicap avez-vous recrutées parmi les $rowLabel$dimSuffix ?',
      contract,
    );
  }

  if (tid.contains('s3q01')) {
    return GuidedPrompt(
      en
          ? 'How many departures of $rowLabel$dimSuffix were recorded?'
          : 'Combien de départs de $rowLabel$dimSuffix ont été enregistrés ?',
      contract,
    );
  }

  if (tid.contains('s4q01')) {
    return GuidedPrompt(
      en
          ? 'How many interns did you host for: $rowLabel?'
          : 'Combien de stagiaires avez-vous accueillis au titre de : $rowLabel ?',
      contract,
    );
  }

  if (tid.contains('s23q02')) {
    return GuidedPrompt(
      en
          ? (age != null
              ? 'Among the $lower $age you recruited, how many are in their first job?'
              : 'How many first-time job entrants did you recruit among $rowLabel$dimSuffix?')
          : (age != null
              ? 'Parmi les $lower $age recrutés, combien occupent leur premier emploi ?'
              : 'Combien de primo-insérés (premier emploi) avez-vous embauchés parmi les $rowLabel$dimSuffix ?'),
      contract,
    );
  }

  if (tid.contains('s22q05')) {
    return GuidedPrompt(
      en
          ? 'Among your ${isTemp ? 'temporary (CDD)' : 'permanent (CDI)'} recruits, how many are $lower people?'
          : 'Parmi vos recrutements ${isTemp ? 'temporaires (CDD)' : 'permanents (CDI)'}, combien de personnes sont des $lower ?',
      isTemp ? GuidedContract.temporary : GuidedContract.permanent,
    );
  }

  if (tid.contains('s3q03')) {
    final technical = RegExp(r'ch[oô]mage|technical', caseSensitive: false)
        .hasMatch(dimLabel ?? '');
    return GuidedPrompt(
      en
          ? (technical
              ? 'How many $lower did you place on technical unemployment this quarter?'
              : 'How many $lower did you dismiss this quarter?')
          : (technical
              ? 'Combien ${_deGroup(rowLabel)} avez-vous mis en chômage technique au cours du trimestre ?'
              : 'Combien ${_deGroup(rowLabel)} avez-vous licenciés au cours du trimestre ?'),
      contract,
    );
  }

  if (tid.contains('s3q02')) {
    return GuidedPrompt(
      en
          ? 'How many people did you dismiss for this reason?'
          : 'Combien de personnes avez-vous licenciées pour ce motif ?',
      contract,
    );
  }

  if (tid.contains('s4q02') || tid.contains('s4q03')) {
    final training = tid.contains('s4q03');
    return GuidedPrompt(
      en
          ? (training
              ? 'How many of your staff need training in this field?'
              : 'How many people with this skill do you need?')
          : (training
              ? "Combien de membres de votre personnel ont besoin d'une formation dans ce domaine ?"
              : 'Combien de personnes ayant cette compétence vous faudrait-il ?'),
      contract,
    );
  }

  final dim = _isSexGroup(dimLabel) ? null : dimLabel;
  final d = dim != null ? ' — $dim' : '';
  return GuidedPrompt(
    en
        ? 'How many people in total for “$rowLabel”$d?'
        : 'Combien de personnes au total pour « $rowLabel »$d ?',
    contract,
  );
}

// ── Page navigation (react-web GuidedReviewGate) ───────────────────────

/// The page's Suivant / Précédent ask the table first: true when the table
/// handled the step (another question, a validation message, its summary);
/// false lets the page move on to the next or previous question.
class GuidedHandle {
  final bool Function() advance;
  final bool Function() retreat;
  const GuidedHandle({required this.advance, required this.retreat});
}

class GuidedRegistry {
  GuidedRegistry._();

  /// By table prefix (the table's tableSpec 'prefix', lower case).
  static final Map<String, GuidedHandle> handles = {};
}

// ── Widgets ────────────────────────────────────────────────────────────

/// Mode Guidé on a phone; [cards] otherwise, and for a table it cannot ask.
class GuidedOrCards extends StatelessWidget {
  final GridRenderSpec spec;
  final Widget cards;
  final Map<String, int> numberValues;
  final Map<String, int>? enteredValues;
  final void Function(String, int?) onNumberChanged;
  final TextEditingController Function(String)? textController;
  final String tableId;
  final Locale locale;
  final bool disabled;
  final bool Function(String cellId)? keepCell;

  const GuidedOrCards({
    super.key,
    required this.spec,
    required this.cards,
    required this.numberValues,
    required this.onNumberChanged,
    required this.tableId,
    required this.locale,
    this.enteredValues,
    this.textController,
    this.disabled = false,
    this.keepCell,
  });

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width >= kGuidedEntryMaxWidth) return cards;
    final model =
        GuidedTableModel.from(spec, tableId, locale, keepCell: keepCell);
    if (model == null) return cards;
    return GuidedStatisticalEntry(
      key: ValueKey('guided_$tableId'),
      model: model,
      numberValues: numberValues,
      enteredValues: enteredValues,
      onNumberChanged: onNumberChanged,
      textController: textController,
      locale: locale,
      disabled: disabled,
    );
  }
}

class GuidedStatisticalEntry extends StatefulWidget {
  final GuidedTableModel model;
  final Map<String, int> numberValues;

  /// Values the respondent typed, zeros included; absence = no answer.
  final Map<String, int>? enteredValues;
  final void Function(String, int?) onNumberChanged;
  final TextEditingController Function(String)? textController;
  final Locale locale;
  final bool disabled;

  const GuidedStatisticalEntry({
    super.key,
    required this.model,
    required this.numberValues,
    required this.onNumberChanged,
    required this.locale,
    this.enteredValues,
    this.textController,
    this.disabled = false,
  });

  @override
  State<GuidedStatisticalEntry> createState() =>
      _GuidedStatisticalEntryState();
}

enum _Gender { female, male }

class _GuidedStatisticalEntryState extends State<GuidedStatisticalEntry> {
  late bool _review;
  late int _idx;
  String? _error;
  final Map<String, String> _totalDrafts = {};
  final Map<String, String> _splitDrafts = {};
  final Map<String, _Gender> _firstGender = {};
  late final GuidedHandle _handle =
      GuidedHandle(advance: _advance, retreat: _retreat);

  // Only whole non-negative numbers are answers (react-web parseCountInput).
  static final _count = RegExp(r'^\d+$');

  List<GuidedQuestion> get _qs => widget.model.questions;
  _T get t => _T(widget.locale.languageCode == 'en');

  bool _has(String id) =>
      widget.enteredValues?.containsKey(id) ??
      widget.numberValues.containsKey(id);
  int? _num(String? id) =>
      id != null && _has(id) ? (widget.numberValues[id] ?? 0) : null;

  bool _answered(GuidedQuestion q) => q.breakdownIds.any(_has);

  int _total(GuidedQuestion q) {
    var sum = 0;
    for (final id in q.breakdownIds) {
      sum += _num(id) ?? 0;
    }
    return sum;
  }

  int _firstUnanswered() {
    final i = _qs.indexWhere((q) => !_answered(q));
    return i < 0 ? 0 : i;
  }

  bool get _allAnswered => _qs.isNotEmpty && _qs.every(_answered);

  @override
  void initState() {
    super.initState();
    // A table already fully answered opens straight on its summary.
    _review = _allAnswered;
    _idx = _firstUnanswered();
    GuidedRegistry.handles[widget.model.tableId] = _handle;
  }

  @override
  void dispose() {
    if (identical(GuidedRegistry.handles[widget.model.tableId], _handle)) {
      GuidedRegistry.handles.remove(widget.model.tableId);
    }
    super.dispose();
  }

  void _write(Map<String, int?> updates) =>
      updates.forEach(widget.onNumberChanged);

  String _displayTotal(GuidedQuestion q) {
    final raw = _totalDrafts[q.id];
    if (raw != null) return raw;
    return _answered(q) ? '${_total(q)}' : '';
  }

  void _onTotal(GuidedQuestion q, String text) {
    final s = text.trim();
    setState(() {
      _totalDrafts[q.id] = text;
      _error = null;
    });
    if (s.isNotEmpty && !_count.hasMatch(s)) {
      setState(() => _error = t.wholeNumber);
      _write({for (final id in q.breakdownIds) id: null});
      return;
    }
    if (s.isEmpty) {
      _splitDrafts[q.id] = '';
      _write({for (final id in q.breakdownIds) id: null});
      return;
    }
    final n = int.parse(s);
    if (n == 0) {
      _splitDrafts[q.id] = '';
      _write({for (final id in q.breakdownIds) id: 0});
      return;
    }
    if (q.singleId != null) {
      _write({q.singleId!: n});
      return;
    }
    if (q.isGenderSplit) {
      // A known primary-gender value is kept and the other re-deduced.
      final first = _firstGender[q.id] ?? _Gender.female;
      final primaryId = first == _Gender.female ? q.femaleId! : q.maleId!;
      final draft = _splitDrafts[q.id];
      final primary = draft != null && _count.hasMatch(draft.trim())
          ? int.parse(draft.trim())
          : _num(primaryId);
      if (primary != null && primary <= n) {
        final secondary = n - primary;
        _write({
          q.femaleId!: first == _Gender.female ? primary : secondary,
          q.maleId!: first == _Gender.female ? secondary : primary,
        });
      }
    }
  }

  void _onSplit(GuidedQuestion q, _Gender primary, String text, int total) {
    final s = text.trim();
    setState(() => _splitDrafts[q.id] = text);
    if (s.isNotEmpty && !_count.hasMatch(s)) {
      setState(() => _error = t.wholeNumber);
      _write({q.femaleId!: null, q.maleId!: null});
      return;
    }
    if (s.isEmpty) {
      setState(() => _error = null);
      _write({(primary == _Gender.female ? q.femaleId! : q.maleId!): null});
      return;
    }
    final p = int.parse(s);
    if (p > total) {
      // Not written: flagged so the respondent corrects it.
      setState(() => _error = t.cannotExceedTotal(total));
      return;
    }
    setState(() => _error = null);
    final d = total - p;
    _write({
      q.femaleId!: primary == _Gender.female ? p : d,
      q.maleId!: primary == _Gender.female ? d : p,
    });
  }

  void _clear(GuidedQuestion q) {
    setState(() {
      _totalDrafts.remove(q.id);
      _splitDrafts.remove(q.id);
      _error = null;
    });
    _write({for (final id in q.breakdownIds) id: null});
  }

  String? _validate(GuidedQuestion q) {
    final totalStr = _displayTotal(q).trim();
    if (totalStr.isEmpty) return t.enterTotalOrNone;
    final split = (_splitDrafts[q.id] ?? '').trim();
    if (!_count.hasMatch(totalStr) ||
        (split.isNotEmpty && !_count.hasMatch(split))) {
      return t.wholeNumber;
    }
    final target = int.parse(totalStr);
    final tf = q.textField;
    if (tf != null && target > 0) {
      final typed =
          widget.textController?.call(tf.fieldId).text.trim() ?? '';
      if (typed.isEmpty) {
        return t.specifyTextField(
            tf.label.replaceAll(RegExp(r'\s*\d+$'), '').toLowerCase());
      }
    }
    if (target == 0 || !q.isGenderSplit) return null;
    if (split.isNotEmpty && int.parse(split) > target) {
      return t.cannotExceedTotal(target);
    }
    final m = _num(q.maleId);
    final f = _num(q.femaleId);
    if (m == null || f == null || m + f != target) return t.enterWomenCount;
    return null;
  }

  void _goTo(int i) => setState(() {
        _error = null;
        _review = false;
        _idx = i;
      });

  bool _advance() {
    if (!mounted || widget.disabled || _qs.isEmpty || _review) return false;
    final q = _qs[_idx.clamp(0, _qs.length - 1)];
    final err = _validate(q);
    if (err != null) {
      setState(() => _error = err);
      return true;
    }
    if (_idx < _qs.length - 1) {
      _goTo(_idx + 1);
    } else {
      setState(() {
        _error = null;
        _review = true;
      });
    }
    return true;
  }

  bool _retreat() {
    if (!mounted || widget.disabled || _qs.isEmpty) return false;
    if (_review) {
      _goTo(_qs.length - 1);
      return true;
    }
    if (_idx > 0) {
      _goTo(_idx - 1);
      return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    GuidedRegistry.handles[widget.model.tableId] = _handle;
    return _review
        ? _summary()
        : _question(_qs[_idx.clamp(0, _qs.length - 1)]);
  }

  // ── Summary: a plain list of the answers, each line reopened by
  // « Modifier »; the page's Suivant moves on. ──
  Widget _summary() {
    final unanswered = _qs.where((q) => !_answered(q)).length;
    final groups = <(String, List<(GuidedQuestion, int)>)>[];
    for (var i = 0; i < _qs.length; i++) {
      final q = _qs[i];
      if (groups.isNotEmpty && groups.last.$1 == q.categoryTag) {
        groups.last.$2.add((q, i));
      } else {
        groups.add((q.categoryTag, [(q, i)]));
      }
    }
    final grand =
        _qs.fold<int>(0, (s, q) => s + (_answered(q) ? _total(q) : 0));
    final contract = _qs.first.contract;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t.checkAnswers,
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.obsidian)),
                  const SizedBox(height: 4),
                  Text(t.checkAnswersHint,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.slate)),
                ],
              ),
            ),
            if (contract != GuidedContract.other) ...[
              const SizedBox(width: 8),
              _ContractBadge(contract: contract, t: t),
            ],
          ],
        ),
        if (unanswered > 0) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.accentAmber.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                  color: AppColors.accentAmber.withValues(alpha: 0.45)),
            ),
            child: Wrap(
              spacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(t.unansweredCount(unanswered),
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.obsidian)),
                _LinkButton(
                    label: t.answerThem,
                    onTap: () => _goTo(_firstUnanswered())),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.ghost),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final g in groups)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(g.$1,
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.obsidian)),
                      for (final item in g.$2) _summaryLine(item.$1, item.$2),
                    ],
                  ),
                ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  color: AppColors.snowWhite,
                  borderRadius:
                      BorderRadius.vertical(bottom: Radius.circular(8)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(t.total,
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.obsidian)),
                    ),
                    Text(t.people(grand),
                        style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.obsidian)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _summaryLine(GuidedQuestion q, int i) {
    final answered = _answered(q);
    final total = _total(q);
    final typed = q.textField != null
        ? (widget.textController?.call(q.textField!.fieldId).text.trim() ??
            '')
        : '';
    final label = typed.isNotEmpty ? typed : (q.dimensionTag ?? t.number);
    final detail = answered && total > 0 && q.isGenderSplit
        ? t.menWomenSplit(_num(q.maleId) ?? 0, _num(q.femaleId) ?? 0)
        : '';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Text(label,
                style: const TextStyle(fontSize: 14, color: AppColors.slate)),
          ),
          const SizedBox(width: 12),
          Flexible(
            flex: 2,
            child: answered
                ? Text.rich(
                    TextSpan(children: [
                      TextSpan(
                          text: t.people(total),
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      if (detail.isNotEmpty)
                        TextSpan(
                            text: ' ($detail)',
                            style: const TextStyle(color: AppColors.slate)),
                    ]),
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                        fontSize: 14, color: AppColors.obsidian),
                  )
                : Text(t.notAnswered,
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.richGold)),
          ),
          const SizedBox(width: 12),
          _LinkButton(label: t.change, onTap: () => _goTo(i)),
        ],
      ),
    );
  }

  // ── One question per screen ──
  Widget _question(GuidedQuestion q) {
    final answeredCount = _qs.where(_answered).length;
    final displayTotal = _displayTotal(q);
    final totalText = displayTotal.trim();
    final targetNum =
        _count.hasMatch(totalText) ? int.parse(totalText) : null;
    final first = _firstGender[q.id] ?? _Gender.female;
    final committedPrimary =
        first == _Gender.female ? _num(q.femaleId) : _num(q.maleId);
    final splitShown =
        _splitDrafts[q.id] ?? (committedPrimary?.toString() ?? '');
    final splitText = splitShown.trim();
    final deduced = targetNum != null &&
            _count.hasMatch(splitText) &&
            int.parse(splitText) <= targetNum
        ? targetNum - int.parse(splitText)
        : null;

    return Column(
      key: ValueKey('guided_q_${q.id}'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Progress
        Row(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: answeredCount / _qs.length,
                  minHeight: 6,
                  backgroundColor: AppColors.ghost.withValues(alpha: 0.5),
                  color: AppColors.deepEmerald,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Text(t.questionOf(_idx + 1, _qs.length),
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.slate)),
          ],
        ),
        const SizedBox(height: 16),
        const Divider(height: 1, color: AppColors.ghost),
        const SizedBox(height: 16),
        // Context: the group being asked about
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 12,
          runSpacing: 8,
          children: [
            Text.rich(
              TextSpan(children: [
                TextSpan(text: q.categoryTag),
                if (q.dimensionTag != null)
                  TextSpan(
                      text: ' · ${q.dimensionTag}',
                      style: const TextStyle(fontWeight: FontWeight.w600)),
              ]),
              style: const TextStyle(fontSize: 15, color: AppColors.slate),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (q.contract != GuidedContract.other)
                  _ContractBadge(contract: q.contract, t: t),
                if (_answered(q)) ...[
                  const SizedBox(width: 12),
                  _LinkButton(
                    label: t.clear,
                    color: AppColors.accentRed,
                    onTap: widget.disabled ? null : () => _clear(q),
                  ),
                ],
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),
        // Question
        Text(q.prompt,
            style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.obsidian,
                height: 1.35)),
        const SizedBox(height: 6),
        Text(q.textField != null ? t.fewerThanThree : t.zeroIsValid,
            style: const TextStyle(fontSize: 13, color: AppColors.slate)),
        // Free-text reason / domain
        if (q.textField != null && widget.textController != null) ...[
          const SizedBox(height: 16),
          Text(q.textField!.label,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.slate)),
          const SizedBox(height: 8),
          TextField(
            controller: widget.textController!(q.textField!.fieldId),
            enabled: !widget.disabled,
            decoration: _inputDecoration()
                .copyWith(hintText: q.textField!.placeholder),
            onChanged: (_) => setState(() => _error = null),
          ),
        ],
        const SizedBox(height: 16),
        // Total
        Text(t.totalNumber,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.slate)),
        const SizedBox(height: 8),
        Row(
          children: [
            SizedBox(
              width: 144,
              child: _CountBox(
                key: ValueKey('guided_total_${q.id}'),
                text: displayTotal,
                enabled: !widget.disabled,
                invalid: _error != null && totalText.isEmpty,
                onChanged: (s) => _onTotal(q, s),
              ),
            ),
            const SizedBox(width: 12),
            Text(t.persons,
                style: const TextStyle(fontSize: 15, color: AppColors.slate)),
          ],
        ),
        if (targetNum == null || targetNum == 0) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              OutlinedButton(
                onPressed: widget.disabled ? null : () => _onTotal(q, '0'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(48, 40),
                  foregroundColor: AppColors.obsidian,
                  side: const BorderSide(color: AppColors.lightSlate),
                ),
                child: Text(t.none0),
              ),
              if (targetNum == 0)
                Text(t.declaredZero,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.deepEmerald)),
            ],
          ),
        ],
        // Women / men split, the other deduced
        if (q.isGenderSplit && targetNum != null && targetNum > 0) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.only(left: 16),
            decoration: const BoxDecoration(
              border:
                  Border(left: BorderSide(color: AppColors.ghost, width: 2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(first == _Gender.female ? t.howManyWomen : t.howManyMen,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.obsidian)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    SizedBox(
                      width: 112,
                      child: _CountBox(
                        key: ValueKey('guided_split_${q.id}_${first.name}'),
                        text: splitShown,
                        enabled: !widget.disabled,
                        invalid: _error != null && totalText.isNotEmpty,
                        onChanged: (s) => _onSplit(q, first, s, targetNum),
                      ),
                    ),
                    Text(first == _Gender.female ? t.women : t.men,
                        style: const TextStyle(
                            fontSize: 15, color: AppColors.slate)),
                    if (deduced != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.deepEmerald.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                              color: AppColors.deepEmerald
                                  .withValues(alpha: 0.3)),
                        ),
                        child: Text.rich(TextSpan(children: [
                          TextSpan(
                              text: '$deduced ',
                              style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.deepEmerald)),
                          TextSpan(
                              text: first == _Gender.female
                                  ? t.menDeduced
                                  : t.womenDeduced,
                              style: const TextStyle(
                                  fontSize: 13, color: AppColors.obsidian)),
                        ])),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                _LinkButton(
                  label: first == _Gender.female
                      ? t.enterMenFirst
                      : t.enterWomenFirst,
                  color: AppColors.slate,
                  small: true,
                  onTap: () => setState(() {
                    _firstGender[q.id] = first == _Gender.female
                        ? _Gender.male
                        : _Gender.female;
                    _splitDrafts.remove(q.id);
                    _error = null;
                  }),
                ),
              ],
            ),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.accentRed.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                  color: AppColors.accentRed.withValues(alpha: 0.35)),
            ),
            child: Text(_error!,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.accentRed)),
          ),
        ],
      ],
    );
  }
}

InputDecoration _inputDecoration({bool invalid = false}) => InputDecoration(
      isDense: true,
      filled: true,
      fillColor: Colors.white,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: BorderSide(
            color: invalid ? AppColors.accentRed : AppColors.lightSlate),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: AppColors.deepEmerald, width: 2),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: AppColors.ghost),
      ),
    );

/// A count answer box: the number keypad, the text kept as typed.
class _CountBox extends StatefulWidget {
  final String text;
  final bool enabled;
  final bool invalid;
  final ValueChanged<String> onChanged;
  const _CountBox({
    super.key,
    required this.text,
    required this.onChanged,
    this.enabled = true,
    this.invalid = false,
  });

  @override
  State<_CountBox> createState() => _CountBoxState();
}

class _CountBoxState extends State<_CountBox> {
  late final TextEditingController _c =
      TextEditingController(text: widget.text);
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    // Selected on focus, as React's onFocus select().
    _focus.addListener(() {
      if (_focus.hasFocus) {
        _c.selection =
            TextSelection(baseOffset: 0, extentOffset: _c.text.length);
      }
    });
  }

  @override
  void didUpdateWidget(covariant _CountBox old) {
    super.didUpdateWidget(old);
    if (!_focus.hasFocus && _c.text != widget.text) _c.text = widget.text;
  }

  @override
  void dispose() {
    _c.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _c,
      focusNode: _focus,
      enabled: widget.enabled,
      keyboardType: TextInputType.number,
      textAlign: TextAlign.center,
      style: const TextStyle(fontSize: 18, color: AppColors.obsidian),
      inputFormatters: [LengthLimitingTextInputFormatter(6)],
      decoration: _inputDecoration(invalid: widget.invalid),
      onChanged: widget.onChanged,
    );
  }
}

class _ContractBadge extends StatelessWidget {
  final GuidedContract contract;
  final _T t;
  const _ContractBadge({required this.contract, required this.t});

  @override
  Widget build(BuildContext context) {
    final perm = contract == GuidedContract.permanent;
    final color = perm ? AppColors.deepEmerald : AppColors.accentAmber;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(perm ? t.permanentCdi : t.temporaryCdd,
          style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.obsidian)),
    );
  }
}

class _LinkButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final Color color;
  final bool small;
  const _LinkButton({
    required this.label,
    required this.onTap,
    this.color = AppColors.deepEmerald,
    this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 40),
        child: Align(
          alignment: Alignment.centerLeft,
          widthFactor: 1,
          child: Text(
            label,
            style: TextStyle(
              fontSize: small ? 12 : 13,
              fontWeight: FontWeight.w600,
              color: color,
              decoration: TextDecoration.underline,
              decorationColor: color,
            ),
          ),
        ),
      ),
    );
  }
}
