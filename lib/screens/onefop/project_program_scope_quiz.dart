// lib/screens/onefop/project_program_scope_quiz.dart
// ══════════════════════════════════════════════════════════════
// The Project / Programme « Quiz préalable de déclaration » — the Flutter
// port of react-web's ProjectProgramScopeQuiz.tsx (with QuizAnswerReview
// and ScopeConfirmDialog), same wording. Rules and stored shape:
// core/focus/utils/pp_quiz.dart.
//
// One question per screen: the results recorded, permanent staff, temporary
// staff, recruitments, then their categories after « Oui ». The answers are
// listed for checking; « Confirmer et ouvrir les tableaux » writes them
// (statuses, zeros) and opens the tables.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../core/focus/utils/pp_quiz.dart';
import '../../core/i18n/l10n_ext.dart';
import 'onefop_form_constants.dart';
import 'onefop_form_controller.dart';
import 'onefop_table_engine.dart';

/// Whether the Project / Programme quiz has been confirmed.
bool isPpQuizComplete(OnefopFormController ctrl) => isPpQuizConfirmed(ctrl.data);

/// Cell ids of a Project / Programme Section 4 table, by paper code.
List<String> ppTableCells(OnefopFormController ctrl, String paperCode) {
  final schema = ctrl.schema;
  if (schema == null) return const [];
  for (final sec in schema.sections) {
    if (sec.id != 'section4_projectProgram') continue;
    for (final id in sec.fieldIds) {
      final f = schema.getField(id);
      if (f == null || f.type != 'table') continue;
      if ((f.paperCode ?? '').toUpperCase() == paperCode.toUpperCase() ||
          f.id.toUpperCase() == 'PP_${paperCode.toUpperCase()}') {
        return TableCellEngine.cellIds(f);
      }
    }
  }
  return const [];
}

// ── Wording (react-web ProjectProgramScopeQuiz + messages) ───────────

class _T {
  final bool en;
  const _T(this.en);
  String _s(String fr, String e) => en ? e : fr;

  String get title => _s('Quiz préalable de déclaration', 'Preliminary Declaration Quiz');
  String get yes => _s('Oui', 'Yes');
  String get no => _s('Non', 'No');
  String get previous => _s('Précédent', 'Previous');
  String get continueLabel => _s('Continuer', 'Continue');
  String get openTables => _s('Ouvrir les tableaux', 'Open tables');

  String get outcomesTitle =>
      _s("Résultats d'insertion et de formation", 'Placement and training results');
  String get outcomesQuestion => _s(
      'Au cours de la période, votre structure ou projet a-t-il enregistré des résultats parmi les catégories suivantes ? (Les catégories non cochées seront enregistrées à zéro).',
      'During the period, did your project or programme record results in any of the following categories? (Unchecked categories will be set to zero).');
  String get noOutcomesTitle => _s('Aucun bénéficiaire inséré ou formé au cours de la période',
      'No beneficiaries placed or trained during this period');
  String get noOutcomesDesc => _s(
      "Sélectionnez cette option si aucun résultat n'a été enregistré. Les réalisations de la période seront initialisées à 0.",
      'Select this option if no outcome has been recorded yet. Realizations will be initialized to 0.');

  String get permanentTitle => _s('4.1 Personnel permanent (CDI ou statutaire)',
      '4.1 Permanent staff (open-ended contract or civil servant)');
  String get permanentHint => _s(
      "Personnel titulaire d'un contrat à durée indéterminée ou d'un statut permanent dans la structure.",
      'Personnel holding open-ended employment contracts or permanent statutory appointment.');
  String s1Count(num n) => _s('Effectif permanent déclaré en Section 1 : $n.',
      'Permanent staff declared in Section 1: $n.');

  String get temporaryTitle => _s('4.2 Personnel temporaire (CDD, vacataires, consultants)',
      '4.2 Temporary staff (fixed-term, seasonal, consultant)');
  String get temporaryHint => _s(
      'Personnel sous contrat à durée déterminée, vacataires, consultants ou saisonniers.',
      'Personnel holding fixed-term contracts, service providers, or casual staff.');

  String get recruitmentQuestion => _s(
      'Votre structure ou projet a-t-il effectué des recrutements au cours de la période ?',
      'Did your structure or project recruit during the period?');
  String get recruitmentHint => _s(
      'Recrutements de nouveaux collaborateurs (permanents, temporaires, handicapés, vulnérables).',
      'Recruitments of permanent, temporary, disabled, or vulnerable workers.');

  String get recruitment => _s('Recrutements', 'Recruitment');
  String get recruitmentTypesTitle => _s('Catégories de recrutement', 'Recruitment categories');
  String get recruitmentTypesQuestion => _s(
      'Sélectionnez les catégories de recrutement effectuées :',
      'Select the recruitment categories carried out:');

  // Review
  String get reviewTitle => _s('Vérifiez vos réponses sur le projet ou programme',
      'Check your project or programme answers');
  String get reviewWarning => _s('Certaines rubriques déjà saisies ne seront plus déposées.',
      'Some figures already entered will not be submitted.');
  String get proceed => _s('Confirmer et ouvrir les tableaux', 'Confirm and open the tables');
  String get changeAnswer => _s('Modifier', 'Change');
  String get results => _s('Résultats', 'Results');
  String get categories => _s('Catégories', 'Categories');

  // Dialogs
  String get nilTitle => _s('Confirmer une déclaration à néant', 'Confirm a nil declaration');
  String get nilBody => _s(
      'Vous avez indiqué aucun bénéficiaire inséré ou formé, aucun personnel permanent ou temporaire, et aucun recrutement au cours de cette période. Tous les tableaux statistiques officiels des sections 3 et 4 seront enregistrés à néant. Confirmez-vous cette situation ?',
      'You have indicated no beneficiaries placed or trained, no permanent or temporary staff, and no recruitments during this period. All official statistical tables in Sections 3 and 4 will be recorded as None. Do you confirm this situation?');
  String get nilCancel => _s('Modifier mes réponses', 'Modify my answers');
  String get nilConfirm => _s('Confirmer la déclaration à néant', 'Confirm the nil declaration');
  String get droppedTitle => _s('Des chiffres déjà saisis seront effacés',
      'Figures already entered will be cleared');
  String get droppedBody => _s(
      'Certaines rubriques pour lesquelles des chiffres ont été saisis précédemment ne seront plus déposées conformément à vos choix dans le quiz. Ces chiffres seront réinitialisés à zéro. Souhaitez-vous continuer ?',
      'Certain tables or outcome categories for which numbers were previously entered are now deselected according to your quiz choices. These numbers will be cleared to zero. Do you wish to proceed?');
  String get droppedCancel => _s('Modifier mes choix', 'Modify my choices');
  String get droppedConfirm => _s('Confirmer et réinitialiser', 'Confirm and clear');
}

class ProjectProgramScopeQuiz extends StatefulWidget {
  final OnefopFormController ctrl;

  /// The tables open (react-web onComplete).
  final VoidCallback onComplete;

  /// Précédent from the first question (back to Section 1).
  final VoidCallback onBack;

  const ProjectProgramScopeQuiz({
    super.key,
    required this.ctrl,
    required this.onComplete,
    required this.onBack,
  });

  @override
  State<ProjectProgramScopeQuiz> createState() => _ProjectProgramScopeQuizState();
}

class _ProjectProgramScopeQuizState extends State<ProjectProgramScopeQuiz> {
  Map<String, dynamic> get _data => widget.ctrl.data;
  _T get t => _T(context.loc.languageCode == 'en');
  bool get _en => context.loc.languageCode == 'en';

  late bool _noOutcomes;
  late List<String> _outcomes;
  bool? _hasPermanentStaff;
  bool? _hasTemporaryStaff;
  bool? _hasRecruitment;
  late List<String> _recruitmentTypes;
  late bool _reviewing;
  late PpBeat _beat;

  PpScope get _scope => PpScope(
        noOutcomes: _noOutcomes,
        outcomes: _outcomes,
        hasPermanentStaff: _hasPermanentStaff,
        hasTemporaryStaff: _hasTemporaryStaff,
        hasRecruitment: _hasRecruitment,
        recruitmentTypes: _recruitmentTypes,
      );

  @override
  void initState() {
    super.initState();
    final initial = initialPpScope(_data);
    _noOutcomes = initial.noOutcomes;
    _outcomes = [...initial.outcomes];
    _hasPermanentStaff = initial.hasPermanentStaff;
    _hasTemporaryStaff = initial.hasTemporaryStaff;
    _hasRecruitment = initial.hasRecruitment;
    _recruitmentTypes = [...initial.recruitmentTypes];
    // A quiz already confirmed opens on its answers; table heuristics
    // pre-fill a question but do not skip it.
    final hasSaved = savedPpConfig(_data) != null;
    final savedComplete = hasSaved && ppQuizComplete(initial);
    _reviewing = savedComplete;
    _beat = hasSaved && !savedComplete ? firstOpenPpBeat(initial) : PpBeat.outcomes;
  }

  /// Section 1's permanent headcount, shown for context.
  num? get _s1PermanentCount {
    final v = _data['PP_S1Q15'] ?? _data['s1q15'];
    if (v == null || v == '') return null;
    return num.tryParse('$v');
  }

  // ── Navigation ──

  void _goAfter(PpBeat from) {
    final order = ppBeatOrder(_scope);
    final i = order.indexOf(from);
    setState(() {
      if (i >= 0 && i < order.length - 1) {
        _beat = order[i + 1];
      } else {
        _reviewing = true;
      }
    });
  }

  void _goPrev(PpBeat from) {
    final order = ppBeatOrder(_scope);
    final i = order.indexOf(from);
    if (i > 0) {
      setState(() => _beat = order[i - 1]);
    } else {
      widget.onBack();
    }
  }

  void _openBeat(PpBeat beat) => setState(() {
        _reviewing = false;
        _beat = beat;
      });

  // ── Commit (react-web commitScopeData) ──

  void _setCell(String key, int? value) {
    final ctrl = widget.ctrl;
    ctrl.onGridCellChanged(key, value);
    final hc = ctrl.hctrl[key];
    if (hc != null) hc.text = value?.toString() ?? '';
  }

  bool _isZero(dynamic v) => v == 0 || v == '0';

  void _commit() {
    final ctrl = widget.ctrl;
    final previous = savedPpConfig(_data);
    final previousStatus = {
      for (final tbl in kPpSection4Tables)
        tbl.paperCode: _data['${tbl.paperCode}_RESPONSE_STATUS'] ??
            _data['PP_${tbl.paperCode}_RESPONSE_STATUS'],
    };

    // 1. The answers.
    final scope = PpScope(
      completedAt: DateTime.now().toUtc().toIso8601String(),
      noOutcomes: _noOutcomes,
      outcomes: _outcomes,
      hasPermanentStaff: _hasPermanentStaff,
      hasTemporaryStaff: _hasTemporaryStaff,
      hasRecruitment: _hasRecruitment,
      recruitmentTypes: _recruitmentTypes,
    );
    final existing = _data['_scopeConfig'];
    ctrl.setRawValue('_scopeConfig', {
      if (existing is Map) ...Map<String, dynamic>.from(existing),
      'projectProgram': scope.toJson(),
    });

    // 2. Section 3 result rows: an unticked row is zeroed; a row ticked
    //    again after being zeroed is cleared back to blank.
    bool wasSelected(String ok) =>
        previous?['noOutcomes'] != true &&
        (previous?['outcomes'] is List && (previous!['outcomes'] as List).contains(ok));
    for (final ok in kPpOutcomeKeys) {
      final cellId = 's3kpi_${ok}_current';
      if (_noOutcomes || !_outcomes.contains(ok)) {
        _setCell(cellId, 0);
      } else if (!wasSelected(ok) && _isZero(_data[cellId])) {
        _setCell(cellId, null);
      }
    }

    // 3. Section 4 statuses: closing a table zero-fills it; re-opening one
    //    that was closed clears those zeros, so it opens unanswered.
    for (final tbl in kPpSection4Tables) {
      final open = ppTableIsOpen(tbl.paperCode, scope);
      final status = open ? 'REPORTED' : 'NONE';
      ctrl.setRawValue('${tbl.paperCode}_RESPONSE_STATUS', status);
      ctrl.setRawValue('PP_${tbl.paperCode}_RESPONSE_STATUS', status);
      final cells = ppTableCells(ctrl, tbl.paperCode);
      if (!open) {
        for (final id in cells) {
          _setCell(id, 0);
        }
      } else if (previousStatus[tbl.paperCode] == 'NONE') {
        for (final id in cells) {
          if (_isZero(_data[id])) _setCell(id, null);
        }
      }
    }
  }

  Future<void> _proceed() async {
    final scope = _scope;
    if (!ppQuizComplete(scope)) return;
    if (isPpGlobalNone(scope)) {
      final ok = await _confirm(t.nilTitle, t.nilBody, t.nilCancel, t.nilConfirm);
      if (ok != true) return;
    } else if (ppHasDroppedData(scope, _data)) {
      final ok =
          await _confirm(t.droppedTitle, t.droppedBody, t.droppedCancel, t.droppedConfirm);
      if (ok != true) return;
    }
    _commit();
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

  static const _questionStyle =
      TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: kInk, height: 1.35);
  static const _hintStyle = TextStyle(fontSize: 14, color: kInkSoft, height: 1.4);

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

  Widget _question() {
    final scope = _scope;
    late final List<Widget> body;
    late final String nextLabel;
    late final VoidCallback onNext;
    var onPrevious = () => _goPrev(_beat);

    switch (_beat) {
      case PpBeat.outcomes:
        body = [
          Text(t.outcomesTitle, style: _questionStyle),
          const SizedBox(height: 8),
          Text(t.outcomesQuestion,
              style: const TextStyle(fontSize: 15, color: kInk, height: 1.4)),
          const SizedBox(height: 8),
          for (final o in kPpOutcomeOptions)
            _choice(
              checked: _outcomes.contains(o.id),
              onToggle: () => setState(() {
                _noOutcomes = false;
                _outcomes = _outcomes.contains(o.id)
                    ? _outcomes.where((k) => k != o.id).toList()
                    : [..._outcomes, o.id];
              }),
              title: o.title(_en),
              description: o.desc(_en),
            ),
          _choice(
            checked: _noOutcomes,
            onToggle: () => setState(() {
              _noOutcomes = true;
              _outcomes = [];
            }),
            title: t.noOutcomesTitle,
            description: t.noOutcomesDesc,
          ),
        ];
        nextLabel = t.continueLabel;
        onNext = () => _goAfter(PpBeat.outcomes);
        onPrevious = widget.onBack;
      case PpBeat.permanent:
        final n = _s1PermanentCount;
        body = [
          Text(t.permanentTitle, style: _questionStyle),
          const SizedBox(height: 6),
          Text(t.permanentHint, style: _hintStyle),
          if (n != null) ...[
            const SizedBox(height: 6),
            Text(t.s1Count(n), style: _hintStyle),
          ],
          _yesNo(_hasPermanentStaff, (v) => setState(() => _hasPermanentStaff = v)),
        ];
        nextLabel = t.continueLabel;
        onNext = () => _goAfter(PpBeat.permanent);
      case PpBeat.temporary:
        body = [
          Text(t.temporaryTitle, style: _questionStyle),
          const SizedBox(height: 6),
          Text(t.temporaryHint, style: _hintStyle),
          _yesNo(_hasTemporaryStaff, (v) => setState(() => _hasTemporaryStaff = v)),
        ];
        nextLabel = t.continueLabel;
        onNext = () => _goAfter(PpBeat.temporary);
      case PpBeat.recruitment:
        body = [
          Text(t.recruitmentQuestion, style: _questionStyle),
          const SizedBox(height: 6),
          Text(t.recruitmentHint, style: _hintStyle),
          _yesNo(
              _hasRecruitment,
              (v) => setState(() {
                    _hasRecruitment = v;
                    if (!v) _recruitmentTypes = [];
                  })),
        ];
        nextLabel = _hasRecruitment == true ? t.continueLabel : t.openTables;
        onNext = () => setState(() {
              if (_hasRecruitment == true) {
                _beat = PpBeat.recruitmentTypes;
              } else {
                _reviewing = true;
              }
            });
      case PpBeat.recruitmentTypes:
        body = [
          Text(t.recruitment, style: const TextStyle(fontSize: 13, color: kInkSoft)),
          const SizedBox(height: 4),
          Text(t.recruitmentTypesTitle, style: _questionStyle),
          const SizedBox(height: 8),
          Text(t.recruitmentTypesQuestion,
              style: const TextStyle(fontSize: 15, color: kInk, height: 1.4)),
          const SizedBox(height: 8),
          for (final o in kPpRecruitmentOptions)
            _choice(
              checked: _recruitmentTypes.contains(o.id),
              onToggle: () => setState(() {
                _recruitmentTypes = _recruitmentTypes.contains(o.id)
                    ? _recruitmentTypes.where((k) => k != o.id).toList()
                    : [..._recruitmentTypes, o.id];
              }),
              title: o.title(_en),
              description: o.desc(_en),
            ),
        ];
        nextLabel = t.openTables;
        onNext = () => setState(() => _reviewing = true);
    }

    final canGo = ppBeatComplete(_beat, scope);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: body),
        const SizedBox(height: 24),
        Row(
          children: [
            OutlinedButton(
              onPressed: onPrevious,
              style: OutlinedButton.styleFrom(
                  minimumSize: const Size(48, 48),
                  foregroundColor: kInkSoft,
                  side: const BorderSide(color: kBorder)),
              child: Text(t.previous),
            ),
            const Spacer(),
            FilledButton(
              onPressed: canGo ? onNext : null,
              style: FilledButton.styleFrom(
                  backgroundColor: kAccent, minimumSize: const Size(48, 48)),
              child: Text(nextLabel),
            ),
          ],
        ),
      ],
    );
  }

  /// One checkbox of a quiz list: the choice and its description.
  Widget _choice({
    required bool checked,
    required VoidCallback onToggle,
    required String title,
    required String description,
  }) =>
      CheckboxListTile(
        value: checked,
        onChanged: (_) => onToggle(),
        title: Text(title, style: const TextStyle(fontSize: 15, color: kInk)),
        subtitle: Text(description, style: const TextStyle(fontSize: 13, color: kInkSoft)),
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: EdgeInsets.zero,
        activeColor: kAccent,
      );

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

  // ── Review (react-web QuizAnswerReview) ──

  Widget _review() {
    final scope = _scope;
    final rows = <(PpBeat, String, bool?, List<(String, String)>)>[
      (
        PpBeat.outcomes,
        t.outcomesTitle,
        _noOutcomes ? false : _outcomes.isNotEmpty ? true : null,
        _noOutcomes
            ? const []
            : [
                (
                  t.results,
                  kPpOutcomeOptions
                      .where((o) => _outcomes.contains(o.id))
                      .map((o) => o.title(_en))
                      .join(', ')
                ),
              ],
      ),
      (PpBeat.permanent, ppTableLabel('S4Q01', _en), _hasPermanentStaff, const []),
      (PpBeat.temporary, ppTableLabel('S4Q02', _en), _hasTemporaryStaff, const []),
      (
        PpBeat.recruitment,
        t.recruitment,
        _hasRecruitment,
        _hasRecruitment == true
            ? [
                (
                  t.categories,
                  kPpRecruitmentTable.entries
                      .where((e) => _recruitmentTypes.contains(e.value))
                      .map((e) => ppTableLabel(e.key, _en))
                      .join(', ')
                ),
              ]
            : const [],
      ),
    ];
    final dropped = ppHasDroppedData(scope, _data);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(t.reviewTitle, style: _questionStyle),
        if (dropped) ...[
          const SizedBox(height: 12),
          Text(t.reviewWarning, style: const TextStyle(fontSize: 14, color: kWarning)),
        ],
        const SizedBox(height: 12),
        for (final (beat, title, answer, facets) in rows)
          InkWell(
            onTap: () => _openBeat(beat),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration:
                  const BoxDecoration(border: Border(bottom: BorderSide(color: kBorder))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(title,
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w700, color: kInk)),
                      ),
                      if (answer != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: answer
                                ? kAccent.withValues(alpha: 0.12)
                                : kBorder.withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(answer ? t.yes : t.no,
                              style: const TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w600, color: kInk)),
                        ),
                      const SizedBox(width: 10),
                      Text('${t.changeAnswer} ✎',
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600, color: kAccent)),
                    ],
                  ),
                  for (final (label, value) in facets)
                    if (value.isNotEmpty)
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
            onPressed: ppQuizComplete(scope) ? _proceed : null,
            style: FilledButton.styleFrom(
                backgroundColor: kAccent, minimumSize: const Size(48, 48)),
            child: Text(t.proceed),
          ),
        ),
      ],
    );
  }
}
