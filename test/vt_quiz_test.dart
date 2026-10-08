// The training-centre preliminary quiz rule (lib/core/focus/utils/vt_quiz.dart)
// and its use by the validator and the submission payload. Mirrors
// react-web/src/lib/vt-quiz.test.ts: both apps must submit the same thing,
// because the server checks either by the same rule.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/core/focus/utils/field_validator.dart';
import 'package:dsmo_app/core/focus/utils/table_response_status.dart';
import 'package:dsmo_app/core/focus/utils/vt_quiz.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_scope_quiz.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';

Future<OnefopFormController> _controller(EntityType type,
    [Map<String, dynamic> data = const {}]) async {
  final ctrl = OnefopFormController(
    entityType: type,
    initialData: data,
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

const Map<String, dynamic> _allNo = {
  'unemployedQualified': false,
  'informalSector': false,
  'vulnerable': false,
  'scholarships': false,
  'formerStudents': false,
  'trainersWithDisability': false,
};

Map<String, dynamic> _withQuiz(Map<String, dynamic> answers,
        [Map<String, dynamic> extra = const {}]) =>
    {
      '_scopeConfig': {'vocationalTraining': answers},
      ...extra,
    };

void main() {
  test('a table follows its quiz question; tables outside the quiz are always reported', () {
    final data = _withQuiz({..._allNo, 'vulnerable': true});
    expect(vtTableStatus('VT4_9', data), kVtReported);
    expect(vtTableStatus('VT4_3', data), kVtNone);
    expect(vtTableStatus('VT4_1', data), kVtReported);
    expect(vtTableStatus('VT4_3', const {}), isNull);
  });

  test('6.3 follows its follow-up, and is NONE when there were no former students', () {
    expect(vtTableStatus('VT6_13', _withQuiz(_allNo)), kVtNone);
    expect(
        vtTableStatus('VT6_13',
            _withQuiz({..._allNo, 'formerStudents': true, 'formerStudentsPlaced': true})),
        kVtReported);
    expect(isVtQuizComplete({..._allNo, 'formerStudents': true}), isFalse);
    expect(isVtQuizComplete(_allNo), isTrue);
  });

  test('4.6 applies only when 2.1.14 includes Formation Initiale', () {
    expect(
        vtTableStatus('VT4_6', {
          'VT2_18': ['Formation Initiale (FI)/ Initial Training (IT)']
        }),
        kVtReported);
    expect(
        vtTableStatus('VT4_6', {
          'VT2_18': ['Formation Continue (FC)/ Continuing Training (CT)']
        }),
        kVtNone);
  });

  testWidgets('submission: Non gives zeros to fixed tables and no rows to row-by-row tables',
      (tester) async {
    final ctrl = await _controller(EntityType.vocationalTraining);
    addTearDown(ctrl.dispose);
    final out = applyVtSubmissionSemantics(
      ctrl.schema!.fields,
      _withQuiz(_allNo, {
        's4q3_row1_specialtyText': 'Couture',
        's4q3_row1_fiMale': '3',
      }),
    );
    expect(out[vtStatusKey('VT4_9')], kVtNone);
    expect(out['s4q9_moteur_entrant_male'], 0);
    expect(out[vtStatusKey('VT4_3')], kVtNone);
    expect(out.containsKey('s4q3_row1_specialtyText'), isFalse);
    expect(out.containsKey('s4q3_row1_fiMale'), isFalse);
    expect(out[vtStatusKey('VT4_1')], kVtReported);
    expect(out.containsKey('_scopeConfig'), isFalse);

    final closed = applyVtSubmissionSemantics(
        ctrl.schema!.fields, _withQuiz(_allNo, {'VT1_12': 'Fermée/ Closed'}));
    expect(closed.containsKey(vtStatusKey('VT4_1')), isFalse);
  });

  testWidgets('reported tables: fixed rows need every count; a specialty table a complete row',
      (tester) async {
    final ctrl = await _controller(EntityType.vocationalTraining);
    addTearDown(ctrl.dispose);
    FieldSchema field(String id) => ctrl.schema!.getField(id)!;

    final def43 = vtTableDefForField(field('VT4_3'))!;
    expect(missingVtTableCells('VT4_3', def43, const {}), ['VT4_3']);
    expect(missingVtTableCells('VT4_3', def43, {'s4q3_row1_specialtyText': 'Couture'}), [
      's4q3_row1_fiMale',
      's4q3_row1_fiFemale',
      's4q3_row1_fcMale',
      's4q3_row1_fcFemale',
    ]);

    final def55 = vtTableDefForField(field('VT5_5'))!;
    expect(
        missingVtTableCells('VT5_5', def55,
            {'s5q2_row1_specialtyText': 'Couture', 's5q2_row1_hasCurriculum': false}),
        isEmpty);
    expect(
        missingVtTableCells('VT5_5', def55,
            {'s5q2_row1_specialtyText': 'Couture', 's5q2_row1_hasCurriculum': true}),
        ['s5q2_row1_isApproved']);

    // The validator uses the quiz rule: a table answered Non is not checked,
    // an empty one answered Oui is.
    expect(FieldValidator.validate(field('VT4_3'), _withQuiz(_allNo)), isNull);
    expect(
        FieldValidator.validate(
            field('VT4_3'), _withQuiz({..._allNo, 'unemployedQualified': true})),
        isNotNull);
  });

  testWidgets('sections: a closed centre answers Section 1 only; an unfinished quiz holds back Section 4',
      (tester) async {
    final ctrl = await _controller(EntityType.vocationalTraining);
    addTearDown(ctrl.dispose);
    final schema = ctrl.schema!;
    final s2 = schema.sections.firstWhere((s) => s.id == 'section2_vocationalTraining');
    final s4 = schema.sections.firstWhere((s) => s.id == 'section4_vocationalTraining');

    final closed = {'VT1_12': 'Fermée/ Closed'};
    expect(FieldValidator.isSectionComplete(s2, schema, closed), isTrue);
    expect(FieldValidator.isSectionComplete(s4, schema, closed), isTrue);

    final open = {'VT1_12': 'Fonctionnelle/ Functional'};
    expect(FieldValidator.isSectionComplete(s4, schema, open), isFalse);
    expect(FieldValidator.missingLabels(s4, schema, open, const Locale('fr')),
        contains('Questionnaire préliminaire'));
  });

  testWidgets('"Non applicable" is not offered by any table-status question', (tester) async {
    final ctrl = await _controller(EntityType.enterprise);
    addTearDown(ctrl.dispose);
    final statusFields =
        ctrl.schema!.fields.where((f) => TableResponseStatus.isFieldId(f.id)).toList();
    expect(statusFields, isNotEmpty);
    for (final f in statusFields) {
      expect(f.optionsI18n!.map((o) => o.value), isNot(contains(TableResponseStatus.notApplicable)),
          reason: f.id);
    }
    expect(TableResponseStatus.isClosed(TableResponseStatus.notApplicable), isFalse);
  });

  _widgetTests();
}

Future<void> _pump(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(1200, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(
    locale: const Locale('fr'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(body: SingleChildScrollView(child: child)),
  ));
  await tester.pump();
}

void _widgetTests() {
  testWidgets('quiz screen: all Non, typed figures erased, answers saved', (tester) async {
    final ctrl = await _controller(EntityType.vocationalTraining, {
      's4q3_row1_specialtyText': 'Couture',
      's4q3_row1_fiMale': '3',
    });
    addTearDown(ctrl.dispose);
    var completed = false;
    await _pump(tester, VtScopeQuizView(ctrl: ctrl, onComplete: () => completed = true));

    final validate = find.text('Valider et continuer →');
    expect(tester.widget<FilledButton>(find.ancestor(of: validate, matching: find.byType(FilledButton))).onPressed,
        isNull, reason: 'not before every question is answered');

    // 6 questions are asked (6.3's follow-up only after "Oui" to 4.10).
    expect(find.text('Non'), findsNWidgets(6));
    for (var i = 0; i < 6; i++) {
      await tester.tap(find.text('Non').at(i));
      await tester.pump();
    }
    expect(find.textContaining('seront effacés'), findsOneWidget);

    await tester.tap(validate);
    await tester.pump();
    expect(completed, isTrue);
    expect(ctrl.data.containsKey('s4q3_row1_specialtyText'), isFalse);
    expect(isVtQuizComplete(readVtQuiz(ctrl.data)), isTrue);
    expect(vtTableStatus('VT4_3', ctrl.data), kVtNone);
    await tester.pump(const Duration(seconds: 4)); // let the autosave timer run
  });

  testWidgets('table gate: waiting on the quiz, answered Non, answered Oui', (tester) async {
    final ctrl = await _controller(EntityType.vocationalTraining);
    addTearDown(ctrl.dispose);
    final f = ctrl.schema!.getField('VT4_3')!;
    const table = Text('LE TABLEAU');

    await _pump(tester, VtTableQuizGate(ctrl: ctrl, field: f, child: table));
    expect(find.text('LE TABLEAU'), findsNothing);
    expect(find.text('Ouvrir le questionnaire préliminaire'), findsOneWidget);

    ctrl.setRawValue('_scopeConfig', {'vocationalTraining': {..._allNo}});
    await _pump(tester, VtTableQuizGate(ctrl: ctrl, field: f, child: table));
    expect(find.textContaining('aucun cas à signaler'), findsOneWidget);
    expect(find.text('Modifier'), findsOneWidget);

    ctrl.setRawValue('_scopeConfig', {'vocationalTraining': {..._allNo, 'unemployedQualified': true}});
    await _pump(tester, VtTableQuizGate(ctrl: ctrl, field: f, child: table));
    expect(find.text('LE TABLEAU'), findsOneWidget);

    // A table outside the quiz always shows.
    await _pump(tester, VtTableQuizGate(ctrl: ctrl, field: ctrl.schema!.getField('VT4_1')!, child: table));
    expect(find.text('LE TABLEAU'), findsOneWidget);
    await tester.pump(const Duration(seconds: 4)); // let the autosave timer run
  });
}
