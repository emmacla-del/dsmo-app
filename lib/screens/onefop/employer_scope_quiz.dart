// lib/screens/onefop/employer_scope_quiz.dart
// ══════════════════════════════════════════════════════════════
// « Quiz préalable de déclaration » — the Flutter port of react-web's
// EventFactInterview (modern-jobs/scope/ScopeConfigurationWizard.tsx),
// EventQuestion.tsx, FactsReview.tsx / QuizAnswerReview.tsx and
// ScopeConfirmDialog.tsx, with the same wording (messages
// modernJobs.scope / event / facts / factsReview). Rules and stored shape:
// core/focus/utils/employer_quiz.dart.
//
// One question per screen: « Oui / Non » for each event, then its
// follow-ups (categories, age groups, reasons…) after « Oui ». Every
// answer is written at once (the answers, the global lists, each table's
// status). After the last question the answers are listed for checking;
// « Confirmer et ouvrir les tableaux » opens the tables.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../core/focus/utils/employer_quiz.dart';
import '../../core/i18n/l10n_ext.dart';
import 'onefop_form_constants.dart';
import 'onefop_form_controller.dart';
import 'onefop_table_engine.dart';

// ── Wording (react-web messages modernJobs.scope / event / facts) ─────

class _Q {
  final bool en;
  const _Q(this.en);
  String _s(String fr, String e) => en ? e : fr;

  String get title => _s('Quiz préalable de déclaration', 'Preliminary Declaration Quiz');
  String get yes => _s('Oui', 'Yes');
  String get no => _s('Non', 'No');
  String get previous => _s('Précédent', 'Previous');
  String get continueLabel => _s('Continuer', 'Continue');
  String get openTables => _s('Ouvrir les tableaux', 'Open tables');

  String q(String mainId) => switch (mainId) {
        'applications' => _s(
            'Des demandes d’emploi ont-elles été enregistrées au cours de la période de référence ?',
            'Were job applications registered during the reference period?'),
        'recruitment' => _s(
            'Des recrutements ou embauches ont-ils été effectués au cours de la période ?',
            'Were new hires or recruitments carried out during the period?'),
        'primo_seekers' => _s(
            'Des primo-demandeurs d’emploi ont-ils été enregistrés au cours de la période ?',
            'Were first-time job seekers registered during the period?'),
        'primo_workers' => _s(
            'Des primo-insérés (premier emploi) ont-ils été embauchés au cours de la période ?',
            'Were first-time workers hired for their first job during the period?'),
        'departures' => _s(
            'Des départs de personnel ont-ils eu lieu au cours de la période de référence ?',
            'Did any staff departures occur during the reference period?'),
        'interns' => _s(
            'Des stagiaires ont-ils été accueillis dans votre établissement au cours de la période ?',
            'Were any interns hosted in your establishment during the period?'),
        'skills' => _s(
            'Existe-t-il des besoins en compétences prioritaires au sein de votre établissement ?',
            'Are there priority skill needs within your establishment?'),
        'training' => _s(
            'Votre établissement dispose-t-il d’un plan de formation ou envisage-t-il des actions de formation continue ?',
            'Does your structure have a training plan or planned training actions?'),
        _ => '',
      };

  String short(String mainId) => switch (mainId) {
        'applications' => _s("Demandes d'emploi", 'Job applications'),
        'recruitment' => _s('Recrutements', 'Recruitment'),
        'primo_seekers' => _s('Primo-demandeurs', 'First-time job seekers'),
        'primo_workers' => _s('Primo-insérés', 'First-time entrants'),
        'departures' => _s('Départs de personnel', 'Staff departures'),
        'interns' => _s('Stagiaires accueillis', 'Interns'),
        _ => '',
      };

  /// (heading, question) of a follow-up.
  (String, String) child(String childId) => switch (childId) {
        'application_csp' => (staff, _s(
            'Quelles catégories socio-professionnelles concernent les demandes d’emploi reçues ?',
            'Which socio-professional categories apply to the job applications received?')),
        'application_age' => (ages, _s(
            'Quelles tranches d’âge concernent les demandes d’emploi reçues ?',
            'Which age brackets are concerned by the job applications received?')),
        'recruit_types' => (_s('Types de recrutement', 'Recruitment types'), _s(
            'Quels types de recrutements ont eu lieu au cours de la période ?',
            'Which types of recruitment took place during the period?')),
        'recruit_csp' => (staff, _s(
            'Quelles catégories socio-professionnelles ont été recrutées ?',
            'Which socio-professional categories were recruited?')),
        'recruit_age' => (ages, _s(
            'Quelles tranches d’âge concernent ces recrutements ?',
            'Which age brackets are concerned by these recruitments?')),
        'recruit_diploma' => (_s('Niveaux de diplôme', 'Diploma levels'), _s(
            'Indiquez les niveaux de diplôme des personnes recrutées.',
            'Indicate the diploma levels of the persons recruited.')),
        'recruit_disability' => (_s('Personnes en situation de handicap ?', 'Persons with disabilities?'), _s(
            'Les recrutements concernent-ils des personnes en situation de handicap ?',
            'Did recruitments include persons with disabilities?')),
        'recruit_vulnerable' => (_s('Personnes vulnérables ?', 'Vulnerable groups?'), _s(
            'Les recrutements concernent-ils des populations autochtones, réfugiés ou déplacés internes ?',
            'Did recruitments include indigenous peoples, refugees, or IDPs?')),
        'primo_seekers_csp' => (staff, _s(
            'Quelles catégories socio-professionnelles concernent les primo-demandeurs enregistrés ?',
            'Which socio-professional categories apply to the first-time seekers registered?')),
        'primo_seekers_age' => (ages, _s(
            'Quelles tranches d’âge concernent les primo-demandeurs enregistrés ?',
            'Which age brackets are concerned by the first-time seekers registered?')),
        'primo_workers_types' => (_s('Types de recrutement', 'Recruitment types'), _s(
            'Quels types de contrats ont été conclus pour les primo-insérés ?',
            'Which contract types were concluded for first-time job entrants?')),
        'primo_workers_csp' => (staff, _s(
            'Quelles catégories socio-professionnelles concernent les primo-insérés embauchés ?',
            'Which socio-professional categories apply to the first-time entrants hired?')),
        'primo_workers_age' => (ages, _s(
            'Quelles tranches d’âge concernent les primo-insérés embauchés ?',
            'Which age brackets are concerned by the first-time entrants hired?')),
        'departure_reasons' => (_s('Motifs de départ', 'Reasons for departure'), _s(
            'Quels sont les motifs de ces départs ?',
            'What were the reasons for these departures?')),
        'dismissal_technical' => (_s('Chômage technique ou licenciement économique ?', 'Technical unemployment or economic dismissals?'), _s(
            'Ces départs comprennent-ils des mesures de chômage technique ou des licenciements économiques ?',
            'Do these departures include technical unemployment or economic dismissals?')),
        'intern_types' => (_s('Types de stages', 'Internship types'), _s(
            'Quels types de stages ont été réalisés ?',
            'What types of internships were carried out?')),
        _ => ('', ''),
      };

  String get staff => _s('Personnels concernés', 'Staff categories concerned');
  String get ages => _s('Groupes d’âge concernés', 'Age groups concerned');

  // Review (factsReview / facts)
  String get reviewTitle => _s('Vérifiez vos réponses au quiz préalable',
      'Check your answers to the preliminary quiz');
  String get proceed => _s('Confirmer et ouvrir les tableaux', 'Confirm and open the tables');
  String get reviewWarning => _s('Certaines rubriques déjà saisies ne seront plus déposées.',
      'Some figures already entered will not be submitted.');
  String get empty => _s('Les faits que vous indiquerez apparaîtront ici.',
      'The facts you enter will appear here.');
  String get changeAnswer => _s('Modifier', 'Change');
  String row(String mainId) => switch (mainId) {
        'applications' => _s('Demandes d’emploi', 'Job applications'),
        'recruitment' => _s('Recrutements', 'Recruitment'),
        'primo_seekers' => _s('Primo-demandeurs', 'First-time job seekers'),
        'primo_workers' => _s('Primo-insérés', 'First-time entrants'),
        'departures' => _s('Départs de personnel', 'Staff departures'),
        'interns' => _s('Stagiaires accueillis', 'Interns hosted'),
        'skills' => _s('Besoins en compétences prioritaires', 'Priority skills needs'),
        'training' => _s('Besoins en formation continue', 'Continuing training needs'),
        _ => '',
      };
  String get colTypes => _s('Types / motifs', 'Types / reasons');
  String get dimContracts => _s('Types de contrat', 'Contracts');
  String get dimReasons => _s('Motifs de départ', 'Departure reasons');
  String get dimInternships => _s('Types de stage', 'Internship types');
  String get dimCategories => _s('Catégories de personnel', 'Categories');
  String get dimAges => _s("Groupes d'âge", 'Age groups');
  String get dimDiplomas => _s('Niveaux de diplôme', 'Diplomas');
  String get dimSpecific => _s('Critères spécifiques', 'Specific criteria');
  String get otherDisability => _s('Personnes handicapées', 'Persons with disabilities');
  String get otherVulnerable => _s('Personnes vulnérables', 'Vulnerable people');
  String get otherTechnical => _s('Chômage technique', 'Technical unemployment');
  String otherItem(String label, String answer) =>
      en ? '$label: $answer' : '$label : $answer';

  // Dialogs (scope)
  String get excludedTitle =>
      _s('Données déjà saisies non retenues', 'Figures already entered will be dropped');
  String get excludedBody => _s(
      'Certaines rubriques pour lesquelles des chiffres ont été saisis précédemment ne seront plus déposées conformément à vos choix dans le quiz.',
      'Some items for which figures were entered earlier will no longer be submitted, based on your answers to the quiz.');
  String get modifyQuiz => _s('Modifier le quiz', 'Modify quiz');
  String get confirmOpen => _s('Confirmer et ouvrir les tableaux', 'Confirm and open tables');
  String get nilTitle =>
      _s("Confirmation d'une déclaration à néant", 'Confirmation of Nil Declaration');
  String get nilBody => _s(
      "Vous avez indiqué qu'aucun recrutement, départ, accueil de stagiaire ou besoin en compétences ne s'est produit au cours de ce trimestre. Tous les tableaux statistiques officiels seront enregistrés à néant. Confirmez-vous cette situation ?",
      'You have indicated that no recruitment, departures, internships or priority skills needs occurred during this quarter. All official statistical tables will be recorded as nil. Do you confirm?');
  String get reviewFacts => _s('Vérifier les faits', 'Review facts');
  String get confirmNil => _s('Confirmer la déclaration à néant', 'Confirm nil return');
}

/// The Section 2–4 tables of the controller's schema.
List<QuizTable> quizTablesOf(OnefopFormController ctrl) {
  final schema = ctrl.schema;
  if (schema == null) return const [];
  final out = <QuizTable>[];
  for (final sec in schema.sections) {
    for (final id in sec.fieldIds) {
      final f = schema.getField(id);
      if (f == null || f.type != 'table' || f.tableSpec == null) continue;
      final prefix = ((f.tableSpec!['prefix'] as String?) ?? f.id).toLowerCase();
      out.add(QuizTable(f.id, f.paperCode, sec.id, prefix, TableCellEngine.cellIds(f)));
    }
  }
  return out;
}

/// Whether this entity's form is governed by the employer quiz.
bool isEmployerQuizGoverned(OnefopFormController ctrl) {
  if (ctrl.entityType == EntityType.projectProgram ||
      ctrl.entityType == EntityType.vocationalTraining) {
    return false;
  }
  return quizQuestionsFor(hasTableIn(quizTablesOf(ctrl))).isNotEmpty;
}

bool isEmployerQuizComplete(OnefopFormController ctrl) => isQuizComplete(
    readQuizScope(ctrl.data), hasTableIn(quizTablesOf(ctrl)));

class EmployerScopeQuiz extends StatefulWidget {
  final OnefopFormController ctrl;

  /// The tables open (react-web onComplete).
  final VoidCallback onComplete;

  /// Précédent from the first question (back to Section 1).
  final VoidCallback onBack;

  const EmployerScopeQuiz({
    super.key,
    required this.ctrl,
    required this.onComplete,
    required this.onBack,
  });

  @override
  State<EmployerScopeQuiz> createState() => _EmployerScopeQuizState();
}

class _EmployerScopeQuizState extends State<EmployerScopeQuiz> {
  late final List<QuizTable> _tables = quizTablesOf(widget.ctrl);
  late final HasTable _hasTable = hasTableIn(_tables);
  late final List<String> _questions = quizQuestionsFor(_hasTable);
  late QuizScope _scope = readQuizScope(widget.ctrl.data) ?? QuizScope.fresh();
  late QuizBeat _beat;
  late bool _reviewing;

  _Q get t => _Q(context.loc.languageCode == 'en');
  Map<String, dynamic> get _data => widget.ctrl.data;

  @override
  void initState() {
    super.initState();
    final firstOpen = _questions.firstWhere(
        (q) => !isQuizQuestionComplete(q, _scope, _hasTable),
        orElse: () => _questions.isEmpty ? 'recruitment' : _questions.first);
    _beat = QuizBeat(firstOpen);
    // A finished quiz opens on its answers.
    _reviewing = _data['_scopeConfig'] != null &&
        _questions.isNotEmpty &&
        _questions.every((q) => isQuizQuestionComplete(q, _scope, _hasTable));
  }

  List<QuizBeat> get _beats => orderedQuizBeats(_scope, _hasTable);

  void _clearKey(String key) {
    final ctrl = widget.ctrl;
    if (ctrl.aGrid.containsKey(key) || ctrl.uGrid.containsKey(key)) {
      ctrl.onGridCellChanged(key, null);
    }
    final hc = ctrl.hctrl[key];
    if (hc != null) hc.text = '';
    ctrl.setRawValue(key, null);
  }

  /// Writes the answers, the global lists and each table's status; a table
  /// opened again loses the 0 it had while closed (react-web
  /// commitScopeToFormData).
  void _commit(QuizScope s) {
    for (final id in zeroedCellsBackInView(_tables, _data, s)) {
      _clearKey(id);
    }
    quizCommitUpdates(_tables, s).forEach(widget.ctrl.setRawValue);
  }

  void _update(Map<String, dynamic> changes) {
    var updated = _scope.copyWith(changes);
    // « Licenciements » no longer chosen: the technical-unemployment
    // follow-up goes with it.
    if (changes.containsKey('departure_reasons') &&
        !updated.l('departure_reasons').contains('licenciement') &&
        updated.b('dismissal_technical') != null) {
      updated = updated.copyWith({'dismissal_technical': null});
    }
    setState(() => _scope = updated);
    _commit(updated);
  }

  void _openReview() => setState(() => _reviewing = true);

  void _nextMainOrReview(String mainId) {
    final i = _questions.indexOf(mainId);
    if (i >= 0 && i < _questions.length - 1) {
      setState(() => _beat = QuizBeat(_questions[i + 1]));
    } else {
      _openReview();
    }
  }

  void _selectMainYes(String mainId) {
    final updated = _scope.copyWith({kMainAnswerKey[mainId]!: true});
    setState(() => _scope = updated);
    _commit(updated);
    final child = firstChildBeat(mainId, _hasTable);
    if (child != null) {
      setState(() => _beat = child);
    } else {
      _nextMainOrReview(mainId);
    }
  }

  void _applyEventNo(String mainId) {
    final mapping = kEventTableMapping[mainId];
    if (mapping != null) {
      for (final k in keysMatchingPrefixes(Map.of(_data), mapping.prefixes)) {
        _clearKey(k);
      }
    }
    final updated = _scope.copyWith(mapping?.resetScope ?? const {});
    setState(() => _scope = updated);
    _commit(updated);
    _nextMainOrReview(mainId);
  }

  Future<void> _selectMainNo(String mainId) async {
    if (hasEnteredDataForEvent(mainId, _data, _hasTable)) {
      final ok = await _confirm(t.excludedTitle, t.excludedBody, t.modifyQuiz, t.confirmOpen);
      if (ok != true) return;
    }
    _applyEventNo(mainId);
  }

  void _continue() {
    final beats = _beats;
    final i = beats.indexOf(_beat);
    if (i >= 0 && i < beats.length - 1) {
      setState(() => _beat = beats[i + 1]);
    } else {
      _openReview();
    }
  }

  void _previous() {
    final beats = _beats;
    final i = beats.indexOf(_beat);
    if (i > 0) {
      setState(() => _beat = beats[i - 1]);
    } else {
      widget.onBack();
    }
  }

  /// From the answers: a nil declaration is confirmed first; figures in
  /// tables the answers close are dropped (the warning is on the page).
  Future<void> _proceed() async {
    if (isGlobalNone(_scope)) {
      final ok = await _confirm(t.nilTitle, t.nilBody, t.reviewFacts, t.confirmNil);
      if (ok != true) return;
    }
    if (hasDroppedData(_scope, _data, _hasTable)) {
      for (final k in droppedTableKeys(_scope, Map.of(_data), _hasTable)) {
        _clearKey(k);
      }
    }
    _commit(_scope);
    widget.onComplete();
  }

  Future<bool?> _confirm(String title, String body, String cancel, String confirm) =>
      showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          title: Text(title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kInk)),
          content: Text(body, style: const TextStyle(fontSize: 14, color: kInkSoft, height: 1.45)),
          actionsOverflowDirection: VerticalDirection.up,
          actionsOverflowAlignment: OverflowBarAlignment.end,
          actions: [
            // The safe answer first (it takes focus in React).
            OutlinedButton(
              autofocus: true,
              onPressed: () => Navigator.of(ctx).pop(false),
              style: OutlinedButton.styleFrom(minimumSize: const Size(48, 44)),
              child: Text(cancel),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              style: FilledButton.styleFrom(
                  backgroundColor: kAccent, minimumSize: const Size(48, 44)),
              child: Text(confirm),
            ),
          ],
        ),
      );

  // ── Build ──

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(t.title,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: kInk)),
        const SizedBox(height: 16),
        if (_reviewing) _review() else _question(),
      ],
    );
  }

  TextStyle get _headingStyle => const TextStyle(
      fontSize: 17, fontWeight: FontWeight.w700, color: kInk, height: 1.35);

  Widget _question() {
    final beats = _beats;
    final i = beats.indexOf(_beat);
    final isLast = i == beats.length - 1;
    final child = _beat.childId;
    final main = _beat.mainId;

    final Widget body;
    if (child == null) {
      final key = kMainAnswerKey[main]!;
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t.q(main), style: _headingStyle),
          _yesNo(_scope.b(key), (v) => v ? _selectMainYes(main) : _selectMainNo(main)),
        ],
      );
    } else {
      final (heading, question) = t.child(child);
      final Widget control = switch (child) {
        'recruit_disability' =>
          _yesNo(_scope.b('disability'), (v) => _update({'disability': v})),
        'recruit_vulnerable' =>
          _yesNo(_scope.b('vulnerable'), (v) => _update({'vulnerable': v})),
        'dismissal_technical' =>
          _yesNo(_scope.b('dismissal_technical'), (v) => _update({'dismissal_technical': v})),
        _ => _options(child),
      };
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t.short(main), style: const TextStyle(fontSize: 13, color: kInkSoft)),
          const SizedBox(height: 4),
          Text(heading,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: kInk)),
          const SizedBox(height: 8),
          Text(question, style: _headingStyle),
          control,
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        body,
        const SizedBox(height: 24),
        Row(
          children: [
            OutlinedButton(
              onPressed: _previous,
              style: OutlinedButton.styleFrom(
                  minimumSize: const Size(48, 48),
                  foregroundColor: kInkSoft,
                  side: const BorderSide(color: kBorder)),
              child: Text(t.previous),
            ),
            const Spacer(),
            FilledButton(
              onPressed: canContinueBeat(_beat, _scope) ? _continue : null,
              style: FilledButton.styleFrom(
                  backgroundColor: kAccent, minimumSize: const Size(48, 48)),
              child: Text(isLast ? t.openTables : t.continueLabel),
            ),
          ],
        ),
      ],
    );
  }

  List<QuizOption> _optionsFor(String child) => switch (child) {
        'application_csp' || 'recruit_csp' || 'primo_seekers_csp' || 'primo_workers_csp' =>
          kCspOptions,
        'application_age' || 'recruit_age' || 'primo_seekers_age' || 'primo_workers_age' =>
          kAgeBandOptions,
        'recruit_types' || 'primo_workers_types' => kRecruitmentTypeOptions,
        'recruit_diploma' => kDiplomaOptions,
        'departure_reasons' => kDepartureReasonOptions,
        'intern_types' => kInternshipTypeOptions,
        _ => const [],
      };

  Widget _options(String child) {
    final selected = _scope.l(child);
    final en = context.loc.languageCode == 'en';
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        children: [
          for (final o in _optionsFor(child))
            CheckboxListTile(
              value: selected.contains(o.id),
              onChanged: (on) => _update({
                child: on == true
                    ? [...selected, o.id]
                    : selected.where((s) => s != o.id).toList(),
              }),
              title: Text(o.label(en), style: const TextStyle(fontSize: 15, color: kInk)),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              dense: false,
              activeColor: kAccent,
            ),
        ],
      ),
    );
  }

  Widget _yesNo(bool? value, ValueChanged<bool> onChanged) {
    Widget option(bool v, String label) => InkWell(
          onTap: () => onChanged(v),
          borderRadius: BorderRadius.circular(6),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Radio<bool>(value: v, activeColor: kAccent),
                Text(label, style: const TextStyle(fontSize: 15, color: kInk)),
                const SizedBox(width: 12),
              ],
            ),
          ),
        );
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: RadioGroup<bool>(
        groupValue: value,
        onChanged: (v) {
          if (v != null) onChanged(v);
        },
        child: Wrap(spacing: 16, children: [option(true, t.yes), option(false, t.no)]),
      ),
    );
  }

  // ── Review of the answers (react-web FactsReview / QuizAnswerReview) ──

  List<_ReviewRow> _rows() {
    final en = context.loc.languageCode == 'en';
    String pick(List<QuizOption> options, List<String> ids) =>
        options.where((o) => ids.contains(o.id)).map((o) => o.label(en)).join(', ');
    String? yesNo(bool? v) => v == null ? null : (v ? t.yes : t.no);
    List<String> other(String label, bool? v) =>
        v == null ? const [] : [t.otherItem(label, yesNo(v)!)];

    final rows = <_ReviewRow>[];
    for (final q in _questions) {
      final answer = _scope.b(kMainAnswerKey[q]!);
      if (answer == null) continue;
      final facets = <(String, String)>[];
      void add(String label, String value) {
        if (value.isNotEmpty) facets.add((label, value));
      }

      switch (q) {
        case 'applications':
          add(t.dimCategories, pick(kCspOptions, _scope.l('application_csp')));
          add(t.dimAges, pick(kAgeBandOptions, _scope.l('application_age')));
        case 'recruitment':
          add(t.dimContracts, pick(kRecruitmentTypeOptions, _scope.l('recruit_types')));
          add(t.dimCategories, pick(kCspOptions, _scope.l('recruit_csp')));
          add(t.dimAges, pick(kAgeBandOptions, _scope.l('recruit_age')));
          add(t.dimDiplomas, pick(kDiplomaOptions, _scope.l('recruit_diploma')));
          add(t.dimSpecific, [
            ...other(t.otherDisability, _scope.b('disability')),
            ...other(t.otherVulnerable, _scope.b('vulnerable')),
          ].join(' · '));
        case 'primo_seekers':
          add(t.dimCategories, pick(kCspOptions, _scope.l('primo_seekers_csp')));
          add(t.dimAges, pick(kAgeBandOptions, _scope.l('primo_seekers_age')));
        case 'primo_workers':
          add(t.dimContracts, pick(kRecruitmentTypeOptions, _scope.l('primo_workers_types')));
          add(t.dimCategories, pick(kCspOptions, _scope.l('primo_workers_csp')));
          add(t.dimAges, pick(kAgeBandOptions, _scope.l('primo_workers_age')));
        case 'departures':
          add(t.dimReasons, pick(kDepartureReasonOptions, _scope.l('departure_reasons')));
          add(t.dimSpecific, other(t.otherTechnical, _scope.b('dismissal_technical')).join(' · '));
        case 'interns':
          add(t.dimInternships, pick(kInternshipTypeOptions, _scope.l('intern_types')));
      }
      rows.add(_ReviewRow(q, t.row(q), answer, answer ? facets : const []));
    }
    return rows;
  }

  Widget _review() {
    final rows = _rows();
    final dropped = hasDroppedData(_scope, _data, _hasTable);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(t.reviewTitle, style: _headingStyle),
        if (dropped) ...[
          const SizedBox(height: 12),
          Text(t.reviewWarning, style: const TextStyle(fontSize: 14, color: kWarning)),
        ],
        if (rows.isEmpty) ...[
          const SizedBox(height: 12),
          Text(t.empty, style: const TextStyle(fontSize: 14, color: kInkSoft)),
        ],
        const SizedBox(height: 12),
        for (final r in rows)
          InkWell(
            onTap: () => setState(() {
              _reviewing = false;
              _beat = QuizBeat(r.mainId);
            }),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: kBorder))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(r.title,
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w700, color: kInk)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: r.answer
                              ? kAccent.withValues(alpha: 0.12)
                              : kBorder.withValues(alpha: 0.6),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(r.answer ? t.yes : t.no,
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w600, color: kInk)),
                      ),
                      const SizedBox(width: 10),
                      Text('${t.changeAnswer} ✎',
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600, color: kAccent)),
                    ],
                  ),
                  for (final (label, value) in r.facets)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text.rich(
                        TextSpan(children: [
                          TextSpan(
                              text: '$label: ',
                              style: const TextStyle(fontWeight: FontWeight.w600)),
                          TextSpan(text: value),
                        ]),
                        style: const TextStyle(fontSize: 13.5, color: kInkSoft),
                      ),
                    ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 24),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: _proceed,
            style: FilledButton.styleFrom(
                backgroundColor: kAccent, minimumSize: const Size(48, 48)),
            child: Text(t.proceed),
          ),
        ),
      ],
    );
  }
}

class _ReviewRow {
  final String mainId;
  final String title;
  final bool answer;
  final List<(String, String)> facets;
  const _ReviewRow(this.mainId, this.title, this.answer, this.facets);
}

