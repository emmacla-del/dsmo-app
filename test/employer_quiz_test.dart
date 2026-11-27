// The employer preliminary quiz (employer_quiz.dart, employer_scope_quiz.dart)
// against react-web's QuizSemantics / ScopeDataManagement / resolveTableScope.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/utils/employer_quiz.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/employer_scope_quiz.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

Future<OnefopFormController> _controller(EntityType type) async {
  final ctrl = OnefopFormController(
    entityType: type,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('which questions (react-web quizQuestionsFor)', () {
    test('employer: all eight, in order', () async {
      final ctrl = await _controller(EntityType.enterprise);
      addTearDown(ctrl.dispose);
      expect(quizQuestionsFor(hasTableIn(quizTablesOf(ctrl))), [
        'applications', 'recruitment', 'primo_seekers', 'primo_workers',
        'departures', 'interns', 'skills', 'training',
      ]);
      expect(isEmployerQuizGoverned(ctrl), isTrue);
    });

    test('administration: its census is not asked', () async {
      final ctrl = await _controller(EntityType.administration);
      addTearDown(ctrl.dispose);
      final qs = quizQuestionsFor(hasTableIn(quizTablesOf(ctrl)));
      expect(qs, isNot(contains('applications')));
      expect(qs.first, 'recruitment');
    });

    test('project / programme has its own quiz, not this one', () async {
      final ctrl = await _controller(EntityType.projectProgram);
      addTearDown(ctrl.dispose);
      expect(isEmployerQuizGoverned(ctrl), isFalse);
    });
  });

  group('statuses (react-web isTableReported / deriveQuizTableStatus)', () {
    bool has(String c) => true;

    test('unanswered gives no status, never NONE', () {
      expect(deriveQuizTableStatus('S22Q01', QuizScope.fresh(), has), isNull);
    });

    test('« Oui », permanent only: S22Q01 open, S22Q02 at nil', () {
      final s = QuizScope.fresh().copyWith({
        'recruit': true,
        'recruit_types': ['permanent'],
        'recruit_csp': ['cadres'],
        'recruit_age': ['25_34'],
        'recruit_diploma': ['licence'],
        'disability': false,
        'vulnerable': false,
      });
      expect(deriveQuizTableStatus('S22Q01', s, has), 'REPORTED');
      expect(deriveQuizTableStatus('S22Q02', s, has), 'NONE');
      expect(deriveQuizTableStatus('S22Q04', s, has), 'NONE');
    });
  });

  group('which cells are asked (react-web resolveTableScope)', () {
    final data = <String, dynamic>{
      '_scopeConfig': {
        'applications': true,
        'application_csp': ['cadres'],
        'application_age': ['15_24'],
        'departures': true,
        'departure_reasons': ['demission'],
        'interns': true,
        'intern_types': ['academique'],
      },
    };

    test('S21Q01 keeps the chosen category and age group only', () {
      expect(quizKeepsCell('s21q01', 's21q01_cadres_male_15_24', data), isTrue);
      expect(quizKeepsCell('s21q01', 's21q01_foremen_male_15_24', data), isFalse);
      expect(quizKeepsCell('s21q01', 's21q01_cadres_male_25_34', data), isFalse);
    });

    test('S3Q01 keeps the chosen reasons; S4Q01 the chosen internships', () {
      expect(quizKeepsCell('s3q01', 's3q01_cadres_resignation_male', data), isTrue);
      expect(quizKeepsCell('s3q01', 's3q01_cadres_dismissal_male', data), isFalse);
      expect(quizKeepsCell('s4q01', 's4q01_academic_male', data), isTrue);
      expect(quizKeepsCell('s4q01', 's4q01_vacation_male', data), isFalse);
    });

    test('without answers every cell is asked', () {
      expect(quizKeepsCell('s21q01', 's21q01_foremen_male_25_34', const {}), isTrue);
    });
  });

  test('submission: statuses, zeros, quiz keys dropped '
      '(react-web applyQuizDerivedTableSemantics)', () async {
    final ctrl = await _controller(EntityType.enterprise);
    addTearDown(ctrl.dispose);
    final tables = quizTablesOf(ctrl);
    final scope = QuizScope.fresh().copyWith({
      'applications': false,
      'recruit': false,
      'primo_seekers': false,
      'primo_workers': false,
      'departures': false,
      'interns': true,
      'intern_types': ['academique'],
      'skills_needs': false,
      'training_needs': false,
    });
    final out = applyEmployerQuizSemantics(tables, {
      '_scopeConfig': scope.toJson(),
      's4q01_academic_male': 3,
      's4q01_vacation_male': 2,
    });
    expect(out['S21Q01_RESPONSE_STATUS'], 'NONE');
    expect(out['S4Q01_RESPONSE_STATUS'], 'REPORTED');
    expect(out['s4q01_academic_male'], 3);
    expect(out['s4q01_vacation_male'], 0);
    expect(out.containsKey('_scopeConfig'), isFalse);
  });

  testWidgets('answering on a phone writes the answers and the statuses',
      (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final ctrl = await _controller(EntityType.enterprise);
    addTearDown(ctrl.dispose);
    var completed = false;
    await tester.pumpWidget(MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          child: EmployerScopeQuiz(
            ctrl: ctrl,
            onComplete: () => completed = true,
            onBack: () {},
          ),
        ),
      ),
    ));
    await tester.pump();

    expect(find.text('Quiz préalable de déclaration'), findsOneWidget);
    expect(
        find.text('Des demandes d’emploi ont-elles été enregistrées au cours '
            'de la période de référence ?'),
        findsOneWidget);

    // « Non » moves on to the next question and closes S21Q01.
    await tester.tap(find.text('Non'));
    await tester.pumpAndSettle();
    expect(ctrl.data['S21Q01_RESPONSE_STATUS'], 'NONE');
    expect(
        find.text('Des recrutements ou embauches ont-ils été effectués au '
            'cours de la période ?'),
        findsOneWidget);

    // « Oui » opens its first follow-up.
    await tester.tap(find.text('Oui'));
    await tester.pumpAndSettle();
    expect(find.text('Types de recrutement'), findsOneWidget);
    expect((ctrl.data['_scopeConfig'] as Map)['recruit'], isTrue);
    expect(completed, isFalse);
    await tester.pump(const Duration(seconds: 4));
  });
}
