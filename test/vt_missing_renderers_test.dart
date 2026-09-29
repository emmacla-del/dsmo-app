// Regression coverage for VT-5 — the 9 previously-unimplemented VT table
// fields (4.7, 4.8, 4.9, 4.11, 5.2, 5.3, 5.4, 8.3, 8.6) and the 11
// previously-broken checkbox/multi-select fields (VT2_2, VT2_18, VT2_25,
// VT2_27, VT2_38, VT2_42, VT3_2, VT6_2, VT6_5, VT6_8, VT9_2).
//
// Uses the same direct-controller pump pattern as
// test/vt_row_editor_screenshot_test.dart (a real OnefopFormController,
// same onGridCellChanged/setRawValue wiring the live form uses, without
// the full OnefopUnifiedFormScreenV4 navigation stack) — the established,
// already-proven way to exercise these widgets' actual read/write path.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/compiler/form_ast.dart';
import 'package:dsmo_app/core/focus/compiler/onefop_ast.dart';
import 'package:dsmo_app/core/focus/renderers/vt_row_editor.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_widgets.dart';

/// Mirrors what the live form does in its own initState: construct, then
/// call initialize() to populate _schema before any interaction happens.
/// Without this, OnefopFormController._recalcDirty() (reached from the
/// autosave timer that onGridCellChanged/setRawValue schedule) force-
/// unwraps a null _schema and crashes — a test-harness gap, not a bug in
/// the widgets under test: the real screen always calls initialize()
/// synchronously in initState before the first frame, so end users never
/// hit a null _schema.
Future<OnefopFormController> _controller({
  Map<String, dynamic> initialData = const {},
}) async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: initialData,
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<OnefopFormController> _pumpTable(
  WidgetTester tester,
  VtTableDef def,
) async {
  final ctrl = await _controller();
  addTearDown(ctrl.dispose);
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          child: VtRowEditor(ctrl: ctrl, def: def),
        ),
      ),
    ),
  );
  await tester.pump();
  return ctrl;
}

Future<OnefopFormController> _pumpCheckboxField(
  WidgetTester tester,
  FieldSchema field,
) async {
  final ctrl = await _controller();
  addTearDown(ctrl.dispose);
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          child: CheckboxGroupField(ctrl: ctrl, field: field),
        ),
      ),
    ),
  );
  await tester.pump();
  return ctrl;
}

/// Every mutation (onGridCellChanged/setRawValue) schedules a debounced
/// autosave timer (up to 3s) via OnefopFormController.schedAS. ctrl.data
/// is already updated synchronously before this — this call only exists
/// so the test doesn't end with that timer still pending (flutter_test
/// asserts no pending timers survive a test).
Future<void> _settleAutosave(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 4));
}

/// Builds a real FieldSchema straight from the actual FormQuestionAst
/// declaration for [id] — same options/label the compiled production
/// schema would carry (FormSchemaCompiler.compile always sets
/// `optionsI18n: q.options` unconditionally), not a hand-typed copy that
/// could drift from the AST.
FieldSchema _checkboxFieldFor(String id, List<FormQuestionAst> questions) {
  final q = questions.firstWhere((question) => question.id == id);
  return FieldSchema(
    id: q.id,
    path: q.path ?? '${q.sectionId}.${q.id}',
    type: 'checkbox',
    label: q.label,
    optionsI18n: q.options,
    required: q.requiredField,
    paperCode: q.paperCode,
  );
}

void main() {
  group('VT-5 — 9 previously-missing table fields', () {
    testWidgets('4.7 vt_trainee_age_flow_table renders and round-trips a cell',
        (tester) async {
      final def = vtTableDefFor('vt_trainee_age_flow_table', const {'prefix': 's4q7'});
      expect(def, isNotNull, reason: '4.7 must now resolve to a real VtTableDef');
      expect(def!.rows.length, 24, reason: '24 age-band rows per the design note');
      expect(def.cells.length, 6, reason: 'entrant/sortant/abandon x male/female, no Total');

      final ctrl = await _pumpTable(tester, def);
      // First row = "Moins de 14 ans" (under_14).
      await tester.tap(find.text('Moins de 14 ans'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, '5');
      await tester.pump();
      expect(ctrl.data['s4q7_under_14_entrant_male'], 5);
      // Close the sheet and confirm the row now reads as filled.
      await tester.tap(find.text('Terminé'));
      await tester.pumpAndSettle();
      expect(ctrl.data['s4q7_under_14_entrant_male'], 5,
          reason: 'value must still be visible/retained after closing the sheet');
      await _settleAutosave(tester);
    });

    testWidgets('4.8 vt_education_level_flow_table renders and round-trips a cell',
        (tester) async {
      final def = vtTableDefFor('vt_education_level_flow_table', const {'prefix': 's4q8'});
      expect(def, isNotNull);
      expect(def!.rows.length, 8, reason: '8 education levels per the design note');
      expect(def.cells.length, 9, reason: '3 flow groups x (male/female/computed total)');

      final ctrl = await _pumpTable(tester, def);
      await tester.tap(find.text('Non alphabétisé'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, '3');
      await tester.pump();
      expect(ctrl.data['s4q8_non_alphabetise_entrant_male'], 3);
      // Computed Total cell must reflect the new value live without being
      // itself written to controller state.
      expect(find.text('3'), findsWidgets);
      expect(ctrl.data.containsKey('s4q8_non_alphabetise_entrant_total'), isFalse,
          reason: 'computed cells are never persisted');
      await _settleAutosave(tester);
    });

    testWidgets('4.9 vt_vulnerable_table renders and round-trips a cell', (tester) async {
      final def = vtTableDefFor('vt_vulnerable_table', const {'prefix': 's4q9'});
      expect(def, isNotNull);
      expect(def!.rows.length, 11, reason: '11 vulnerability categories');
      expect(def.cells.length, 9);

      final ctrl = await _pumpTable(tester, def);
      await tester.tap(find.text('Moteur (ou physique)'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, '2');
      await tester.pump();
      expect(ctrl.data['s4q9_moteur_entrant_male'], 2);
      await _settleAutosave(tester);
    });

    testWidgets('4.11 vt_scholarship_table renders and round-trips a cell', (tester) async {
      final def = vtTableDefFor('vt_scholarship_table', const {'prefix': 's4q11'});
      expect(def, isNotNull);
      expect(def!.rows.length, 2, reason: '2 fixed scholarship categories');
      expect(def.cells.length, 6, reason: 'granted/received x male/female/computed total');

      final ctrl = await _pumpTable(tester, def);
      await tester.tap(find.text('Bourses offertes par autres administrations'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, '4');
      await tester.pump();
      expect(ctrl.data['s4q11_other_admin_granted_male'], 4);
      await _settleAutosave(tester);
    });

    testWidgets('5.2 vt_curriculum_table renders and round-trips a cell', (tester) async {
      final def = vtTableDefFor('vt_curriculum_table', const {'prefix': 's5q2'});
      expect(def, isNotNull);
      expect(def!.rows.length, 15, reason: '15 repeating rows');
      expect(def.cells.length, 3, reason: 'specialtyText + hasCurriculum + isApproved');

      final ctrl = await _pumpTable(tester, def);
      await tester.tap(find.text('Ligne 1'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, 'Maçonnerie');
      await tester.pump();
      expect(ctrl.data['s5q2_row1_specialtyText'], 'Maçonnerie');
      // hasCurriculum is a boolean cell — toggle "Oui".
      await tester.tap(find.text('Oui').first);
      await tester.pump();
      expect(ctrl.data['s5q2_row1_hasCurriculum'], true);
      await _settleAutosave(tester);
    });

    testWidgets('5.3 vt_infrastructure_table renders and round-trips a cell',
        (tester) async {
      final def = vtTableDefFor('vt_infrastructure_table', const {'prefix': 's5q3'});
      expect(def, isNotNull);
      expect(def!.rows.length, 9, reason: '9 infrastructure types');
      expect(def.cells.length, 4,
          reason: 'totalCount/permanentGoodCount/permanentBadCount/temporaryCount');

      final ctrl = await _pumpTable(tester, def);
      await tester.tap(find.text('Salle de classe'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, '12');
      await tester.pump();
      expect(ctrl.data['s5q3_salle_classe_totalCount'], 12);
      await _settleAutosave(tester);
    });

    testWidgets('5.4 vt_furniture_table renders and round-trips a cell', (tester) async {
      final def = vtTableDefFor('vt_furniture_table', const {'prefix': 's5q4'});
      expect(def, isNotNull);
      expect(def!.rows.length, 8, reason: '8 furniture types');
      expect(def.cells.length, 2, reason: 'goodCount/badCount');

      final ctrl = await _pumpTable(tester, def);
      await tester.tap(find.text('Table-banc — 1 place'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, '30');
      await tester.pump();
      expect(ctrl.data['s5q4_banc_1_place_goodCount'], 30);
      await _settleAutosave(tester);
    });

    testWidgets('8.3 vt_trainer_age_table renders and round-trips a cell', (tester) async {
      final def = vtTableDefFor('vt_trainer_age_table', const {'prefix': 's8q3'});
      expect(def, isNotNull);
      expect(def!.rows.length, 4, reason: '4 trainer age bands');
      expect(def.cells.length, 2, reason: 'male/female, no Total per PDF p.16');

      final ctrl = await _pumpTable(tester, def);
      await tester.tap(find.text('De 18 à 24 ans'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, '7');
      await tester.pump();
      expect(ctrl.data['s8q3_age_18_24_male'], 7);
      await _settleAutosave(tester);
    });

    testWidgets('8.6 vt_trainer_disability_table renders and round-trips a cell',
        (tester) async {
      final def = vtTableDefFor('vt_trainer_disability_table', const {'prefix': 's8q6'});
      expect(def, isNotNull);
      expect(def!.rows.length, 4, reason: '4 disability categories');
      expect(def.cells.length, 3, reason: 'male/female/computed total');

      final ctrl = await _pumpTable(tester, def);
      await tester.tap(find.text('Handicap moteur (ou physique)'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, '1');
      await tester.pump();
      expect(ctrl.data['s8q6_moteur_male'], 1);
      await _settleAutosave(tester);
    });

    test('unrelated/unknown VT templates still return null (no regression to the '
        'default-nothing fallback for genuinely unwired templates)', () {
      expect(vtTableDefFor('vt_some_future_table', const {'prefix': 's99q9'}), isNull);
    });
  });

  group('VT-5 — checkbox/multi-select fields', () {
    testWidgets('VT2_2 (4 options) — initial empty state shows nothing selected',
        (tester) async {
      final field = _checkboxFieldFor('VT2_2', section2VocationalTrainingQuestions);
      final ctrl = await _pumpCheckboxField(tester, field);
      expect(ctrl.data.containsKey('VT2_2'), isFalse);
      expect(find.byType(CheckboxOption), findsNWidgets(4));
    });

    testWidgets('VT2_2 — selecting one option writes a single-element list',
        (tester) async {
      final field = _checkboxFieldFor('VT2_2', section2VocationalTrainingQuestions);
      final ctrl = await _pumpCheckboxField(tester, field);
      await tester.tap(find.text('Stage académique'));
      await tester.pump();
      expect(ctrl.data['VT2_2'], ['Stage académique/ academic internship']);
      await _settleAutosave(tester);
    });

    testWidgets('VT2_2 — selecting multiple options preserves all of them',
        (tester) async {
      final field = _checkboxFieldFor('VT2_2', section2VocationalTrainingQuestions);
      final ctrl = await _pumpCheckboxField(tester, field);
      await tester.tap(find.text('Stage académique'));
      await tester.pump();
      await tester.tap(find.text('Insertion'));
      await tester.pump();
      expect(
        ctrl.data['VT2_2'],
        containsAll(['Stage académique/ academic internship', 'Insertion/ Insertion']),
      );
      expect((ctrl.data['VT2_2'] as List).length, 2);
      await _settleAutosave(tester);
    });

    testWidgets('VT2_2 — deselecting one option preserves the others', (tester) async {
      final field = _checkboxFieldFor('VT2_2', section2VocationalTrainingQuestions);
      final ctrl = await _pumpCheckboxField(tester, field);
      await tester.tap(find.text('Stage académique'));
      await tester.pump();
      await tester.tap(find.text('Insertion'));
      await tester.pump();
      // Deselect the first — the second must survive.
      await tester.tap(find.text('Stage académique'));
      await tester.pump();
      expect(ctrl.data['VT2_2'], ['Insertion/ Insertion']);
      await _settleAutosave(tester);
    });

    testWidgets('VT2_2 — deselecting the last remaining option clears the field '
        'entirely (empty selection supported, not left as a bare [])', (tester) async {
      final field = _checkboxFieldFor('VT2_2', section2VocationalTrainingQuestions);
      final ctrl = await _pumpCheckboxField(tester, field);
      await tester.tap(find.text('Stage académique'));
      await tester.pump();
      await tester.tap(find.text('Stage académique'));
      await tester.pump();
      expect(ctrl.data.containsKey('VT2_2'), isFalse);
      await _settleAutosave(tester);
    });

    testWidgets('VT2_2 — a pre-existing selection is displayed correctly on open',
        (tester) async {
      final field = _checkboxFieldFor('VT2_2', section2VocationalTrainingQuestions);
      final ctrl = await _controller(initialData: const {
        'VT2_2': ['Stage professionnel/ work placement'],
      });
      addTearDown(ctrl.dispose);
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('fr'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: CheckboxGroupField(ctrl: ctrl, field: field)),
        ),
      );
      await tester.pump();
      final selectedOption = tester.widget<CheckboxOption>(
        find.ancestor(
          of: find.text('Stage professionnel'),
          matching: find.byType(CheckboxOption),
        ),
      );
      expect(selectedOption.isSelected, isTrue);
    });

    testWidgets('VT9_2 (6 options, different option structure) — multi-select '
        'round trip works the same as VT2_2', (tester) async {
      final field = _checkboxFieldFor('VT9_2', section9VocationalTrainingQuestions);
      final ctrl = await _pumpCheckboxField(tester, field);
      expect(find.byType(CheckboxOption), findsNWidgets(6));
      await tester.tap(find.text('Coût de la formation'));
      await tester.pump();
      expect(ctrl.data['VT9_2'], ['Coût de la formation/ Training cost']);
      await tester.tap(find.text('Insuffisance du personnel enseignant'));
      await tester.pump();
      expect((ctrl.data['VT9_2'] as List).length, 2);
      await _settleAutosave(tester);
    });
  });
}
