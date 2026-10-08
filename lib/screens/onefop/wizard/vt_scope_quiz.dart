// lib/screens/onefop/wizard/vt_scope_quiz.dart
//
// The training-centre preliminary quiz screen (rule: core/focus/utils/
// vt_quiz.dart, same questions and meaning as react-web's VtScopeQuiz).
// One Oui/Non question per table that can honestly be empty: Oui opens the
// table, Non records it as nothing to report and erases anything already
// typed in it. It gates tables only — every ordinary question stays in its
// section.
//
// Shown as the wizard's own stage after Section 1 (vt_wizard_shell.dart) and,
// in every other layout, as a sheet opened from a table that is waiting on
// it (VtTableQuizGate / showVtScopeQuizSheet).

import 'package:flutter/material.dart';

import '../../../core/focus/schema/field_schema.dart';
import '../../../core/focus/utils/vt_quiz.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../onefop_form_constants.dart';
import '../onefop_form_controller.dart';
import 'vt_wizard_constants.dart';

class VtScopeQuizView extends StatefulWidget {
  final OnefopFormController ctrl;

  /// Quiz validated (answers saved).
  final VoidCallback onComplete;

  /// Leave without validating; null hides the button.
  final VoidCallback? onBack;
  final String? backLabelFr;
  final String? backLabelEn;

  const VtScopeQuizView({
    super.key,
    required this.ctrl,
    required this.onComplete,
    this.onBack,
    this.backLabelFr,
    this.backLabelEn,
  });

  @override
  State<VtScopeQuizView> createState() => _VtScopeQuizViewState();
}

class _VtScopeQuizViewState extends State<VtScopeQuizView> {
  late Map<String, dynamic> _answers =
      Map<String, dynamic>.from(readVtQuiz(widget.ctrl.data) ?? const {});

  bool get _isEn => context.loc.languageCode == 'en';

  void _answer(String id, bool value) => setState(() {
        _answers = {..._answers, id: value};
        // A follow-up is asked only after "Oui" to its parent.
        if (!value) {
          for (final q in kVtQuizQuestions) {
            if (q.parent == id) _answers.remove(q.id);
          }
        }
      });

  FieldSchema? _table(String id) => widget.ctrl.schema?.getField(id);

  List<String> _cellIds(String tableId) {
    final f = _table(tableId);
    final def = f == null ? null : vtTableDefForField(f);
    if (def == null) return const [];
    return [for (final r in def.rows) for (final c in def.cells) def.cellId(r, c)];
  }

  // Tables the current answers turn off that still hold typed figures.
  List<VtQuizQuestion> get _tablesToErase => kVtQuizQuestions.where((q) {
        final off = _answers[q.id] == false ||
            (q.parent != null && _answers[q.parent] == false);
        if (!off) return false;
        final data = widget.ctrl.data;
        return _cellIds(q.tableId).any((id) {
          final v = data[id];
          return v != null && !(v is String && v.trim().isEmpty);
        });
      }).toList();

  void _validate() {
    if (!isVtQuizComplete(_answers)) return;
    for (final q in _tablesToErase) {
      for (final id in _cellIds(q.tableId)) {
        if (widget.ctrl.data.containsKey(id)) widget.ctrl.setRawValue(id, null);
      }
    }
    final scope = widget.ctrl.data['_scopeConfig'];
    widget.ctrl.setRawValue('_scopeConfig', {
      if (scope is Map) ...Map<String, dynamic>.from(scope),
      'vocationalTraining': {
        ..._answers,
        'completedAt': DateTime.now().toIso8601String(),
      },
    });
    widget.onComplete();
  }

  Widget _choice(String label, bool selected, VoidCallback onTap) => Semantics(
        button: true,
        selected: selected,
        child: OutlinedButton(
          onPressed: onTap,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(72, 40),
            backgroundColor: selected ? kAccent : Colors.white,
            foregroundColor: selected ? Colors.white : kVtWizardInk,
            side: BorderSide(
                color: selected ? kAccent : kVtWizardCardBorder,
                width: selected ? 2 : 1),
            textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          ),
          child: Text(label),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final asked =
        kVtQuizQuestions.where((q) => isVtQuizQuestionAsked(q, _answers)).toList();
    final answered = asked.where((q) => _answers[q.id] is bool).length;
    final complete = isVtQuizComplete(_answers);
    final erase = _tablesToErase;
    final isEn = _isEn;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(isEn ? 'PRELIMINARY QUESTIONNAIRE' : 'QUESTIONNAIRE PRÉLIMINAIRE',
            style: const TextStyle(
                fontSize: 12, fontWeight: FontWeight.w700, color: kAccent, letterSpacing: .5)),
        const SizedBox(height: 6),
        Text(
          isEn ? 'Which tables apply to your centre?' : 'Quels tableaux concernent votre centre ?',
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: kVtWizardInk),
        ),
        const SizedBox(height: 8),
        Text(
          isEn
              ? 'Answer each question for the period. Yes opens the table for you to fill; No records it as nothing to report. The other tables always apply.'
              : "Répondez à chaque question pour la période. Oui ouvre le tableau à renseigner ; Non l'enregistre comme « aucun cas à signaler ». Les autres tableaux s'appliquent toujours.",
          style: const TextStyle(fontSize: 14, height: 1.5, color: kVtWizardInkSoft),
        ),
        const SizedBox(height: 10),
        Semantics(
          liveRegion: true,
          child: Text(
            isEn ? '$answered of ${asked.length} answered' : '$answered sur ${asked.length} répondues',
            style: const TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600, color: kVtWizardInkSoft),
          ),
        ),
        const SizedBox(height: 12),
        const Divider(height: 1, color: kVtWizardCardBorder),
        for (final q in asked) ...[
          Padding(
            padding: EdgeInsets.fromLTRB(q.parent != null ? 28 : 0, 16, 0, 16),
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 16,
              runSpacing: 10,
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(q.text.of(context.loc),
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              height: 1.4,
                              color: kVtWizardInk)),
                      const SizedBox(height: 4),
                      Text(
                        _answers[q.id] == true
                            ? (isEn
                                ? 'Table ${q.tableCode} will be open to fill.'
                                : 'Le tableau ${q.tableCode} sera à renseigner.')
                            : _answers[q.id] == false
                                ? (isEn
                                    ? 'Table ${q.tableCode}: nothing to report.'
                                    : 'Tableau ${q.tableCode} : aucun cas à signaler.')
                                : (isEn
                                    ? 'Decides table ${q.tableCode}.'
                                    : 'Détermine le tableau ${q.tableCode}.'),
                        style: const TextStyle(fontSize: 12.5, color: kVtWizardInkSoft),
                      ),
                    ],
                  ),
                ),
                Row(mainAxisSize: MainAxisSize.min, children: [
                  _choice(isEn ? 'Yes' : 'Oui', _answers[q.id] == true, () => _answer(q.id, true)),
                  const SizedBox(width: 8),
                  _choice(isEn ? 'No' : 'Non', _answers[q.id] == false, () => _answer(q.id, false)),
                ]),
              ],
            ),
          ),
          const Divider(height: 1, color: kVtWizardCardBorder),
        ],
        if (erase.isNotEmpty) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: kVtWizardYellowSoft,
              border: Border.all(color: kVtWizardYellow),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              isEn
                  ? 'The figures already entered in table(s) ${erase.map((q) => q.tableCode).join(', ')} will be erased when you validate.'
                  : 'Les chiffres déjà saisis dans le(s) tableau(x) ${erase.map((q) => q.tableCode).join(', ')} seront effacés à la validation.',
              style: const TextStyle(fontSize: 13, height: 1.5, color: kVtWizardInk),
            ),
          ),
        ],
        const SizedBox(height: 28),
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          spacing: 16,
          runSpacing: 12,
          children: [
            if (widget.onBack != null)
              OutlinedButton(
                onPressed: widget.onBack,
                child: Text(isEn
                    ? (widget.backLabelEn ?? '← Back')
                    : (widget.backLabelFr ?? '← Retour')),
              ),
            FilledButton(
              onPressed: complete ? _validate : null,
              style: FilledButton.styleFrom(backgroundColor: kAccent),
              child: Text(isEn ? 'Validate and continue →' : 'Valider et continuer →'),
            ),
          ],
        ),
      ],
    );
  }
}

/// Opens the quiz as a sheet, from any layout.
Future<void> showVtScopeQuizSheet(BuildContext context, OnefopFormController ctrl) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(sheetContext).height * .88,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
          child: VtScopeQuizView(
            ctrl: ctrl,
            onComplete: () => Navigator.of(sheetContext).pop(),
            onBack: () => Navigator.of(sheetContext).pop(),
            backLabelFr: 'Fermer',
            backLabelEn: 'Close',
          ),
        ),
      ),
    ),
  );
}

/// A training-centre table as the preliminary quiz decides it: the table
/// itself when it applies, a one-line note when the quiz said "Non", and a
/// link to the quiz while its question is unanswered. A closed or
/// non-functional centre has no quiz: its tables stay as they are
/// (optional). Tables outside the quiz always pass through.
class VtTableQuizGate extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  final Widget child;

  /// Opens the quiz; defaults to the sheet.
  final VoidCallback? onOpenQuiz;

  const VtTableQuizGate({
    super.key,
    required this.ctrl,
    required this.field,
    required this.child,
    this.onOpenQuiz,
  });

  @override
  Widget build(BuildContext context) {
    final data = ctrl.data;
    if (isVtCentreClosed(data) || vtTableDefForField(field) == null) return child;
    final status = vtTableStatus(field.id, data);
    if (status == kVtReported) return child;

    final isEn = context.loc.languageCode == 'en';
    final code = field.paperCode ?? field.id;
    void open() => onOpenQuiz != null ? onOpenQuiz!() : showVtScopeQuizSheet(context, ctrl);
    final hasQuestion = vtQuizQuestionForTable(field.id) != null;

    final String text;
    if (status == kVtNone) {
      text = field.id == 'VT4_6'
          ? (isEn
              ? 'Table $code concerns initial training only, which question 2.1.14 does not list.'
              : 'Le tableau $code ne concerne que la formation initiale, que la question 2.1.14 ne mentionne pas.')
          : (isEn
              ? 'Table $code: nothing to report (answer "No" in the preliminary questionnaire).'
              : 'Tableau $code : aucun cas à signaler (réponse « Non » au questionnaire préliminaire).');
    } else {
      text = isEn
          ? 'Table $code depends on a question of the preliminary questionnaire, which is not answered yet.'
          : "Le tableau $code dépend d'une question du questionnaire préliminaire, pas encore répondue.";
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 8,
        children: [
          Text(text, style: const TextStyle(fontSize: 13, height: 1.5, color: kVtWizardInkSoft)),
          if (hasQuestion)
            TextButton(
              onPressed: open,
              child: Text(status == kVtNone
                  ? (isEn ? 'Change' : 'Modifier')
                  : (isEn ? 'Open the preliminary questionnaire' : 'Ouvrir le questionnaire préliminaire')),
            ),
        ],
      ),
    );
  }
}
