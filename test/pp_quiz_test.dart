// The Project / Programme preliminary quiz (pp_quiz.dart,
// project_program_scope_quiz.dart) against react-web's
// ProjectProgramScopeQuiz / applyProjectProgramQuizSemantics.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/utils/pp_quiz.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/project_program_scope_quiz.dart';

Future<OnefopFormController> _controller([Map<String, dynamic> data = const {}]) async {
  final ctrl = OnefopFormController(
    entityType: EntityType.projectProgram,
    initialData: data,
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('starting answers (react-web initialConfig)', () {
    test('nothing saved, nothing entered: every question open', () {
      final c = initialPpScope(const {});
      expect(c.noOutcomes, isFalse);
      expect(c.outcomes, isEmpty);
      expect(c.hasPermanentStaff, isNull);
      expect(c.hasRecruitment, isNull);
      expect(ppQuizComplete(c), isFalse);
      expect(firstOpenPpBeat(c), PpBeat.outcomes);
    });

    test('read from the tables already there', () {
      final c = initialPpScope(const {
        'PP_S1Q15': '4',
        'S4Q02_RESPONSE_STATUS': 'NONE',
        'S4Q03_RESPONSE_STATUS': 'REPORTED',
        's3kpi_trained_outlook_june': 12,
      });
      expect(c.hasPermanentStaff, isTrue); // Section 1 headcount > 0
      expect(c.hasTemporaryStaff, isFalse);
      expect(c.hasRecruitment, isTrue);
      expect(c.recruitmentTypes, ['permanent']);
      // A forecast alone counts as a result.
      expect(c.outcomes, ['trained']);
      expect(c.noOutcomes, isFalse);
    });

    test('saved answers win', () {
      final c = initialPpScope(const {
        '_scopeConfig': {
          'projectProgram': {
            'completedAt': '2026-11-27T10:00:00Z',
            'noOutcomes': true,
            'outcomes': [],
            'hasPermanentStaff': false,
            'hasTemporaryStaff': false,
            'hasRecruitment': false,
            'recruitmentTypes': [],
          },
        },
        'S4Q01_RESPONSE_STATUS': 'REPORTED',
      });
      expect(c.hasPermanentStaff, isFalse);
      expect(ppQuizComplete(c), isTrue);
      expect(isPpGlobalNone(c), isTrue);
    });
  });

  group('tables the answers open', () {
    const c = PpScope(
      outcomes: ['employed'],
      hasPermanentStaff: true,
      hasTemporaryStaff: false,
      hasRecruitment: true,
      recruitmentTypes: ['disability'],
    );
    test('statuses', () {
      expect(ppTableIsOpen('S4Q01', c), isTrue);
      expect(ppTableIsOpen('S4Q02', c), isFalse);
      expect(ppTableIsOpen('S4Q03', c), isFalse);
      expect(ppTableIsOpen('S4Q05', c), isTrue);
      expect(ppBeatOrder(c).last, PpBeat.recruitmentTypes);
    });

    test('figures in a table the answers close are flagged', () {
      expect(ppHasDroppedData(c, const {'pp_s4q02_cadres_male_15_24': 3}), isTrue);
      expect(ppHasDroppedData(c, const {'pp_s4q01_cadres_male_15_24': 3}), isFalse);
      expect(ppHasDroppedData(c, const {'s3kpi_trained_current': 2}), isTrue);
      expect(ppHasDroppedData(c, const {'s3kpi_employed_current': 2}), isFalse);
      // A status is not a figure.
      expect(ppHasDroppedData(c, const {'S4Q02_RESPONSE_STATUS': 'REPORTED'}), isFalse);
    });
  });

  group('submission (react-web applyProjectProgramQuizSemantics)', () {
    List<String> cells(String code) => ['pp_${code.toLowerCase()}_a', 'pp_${code.toLowerCase()}_b'];

    test('unconfirmed quiz: data unchanged, quiz keys left out', () {
      final out = applyPpQuizSemantics(const {
        '_scopeConfig': {'projectProgram': <String, dynamic>{}},
        'pp_s4q01_a': 5,
      }, cells);
      expect(out['pp_s4q01_a'], 5);
      expect(out.containsKey('_scopeConfig'), isFalse);
      expect(out.containsKey('S4Q01_RESPONSE_STATUS'), isFalse);
    });

    test('confirmed quiz: statuses, zeros, both status keys', () {
      final out = applyPpQuizSemantics(const {
        '_scopeConfig': {
          'projectProgram': {
            'completedAt': '2026-11-27T10:00:00Z',
            'noOutcomes': false,
            'outcomes': ['employed'],
            'hasPermanentStaff': true,
            'hasTemporaryStaff': false,
            'hasRecruitment': true,
            'recruitmentTypes': ['vulnerable'],
          },
        },
        'pp_s4q01_a': 5,
        'pp_s4q02_a': 7,
        's3kpi_employed_current': 9,
        's3kpi_trained_current': 4,
      }, cells);
      expect(out['S4Q01_RESPONSE_STATUS'], 'REPORTED');
      expect(out['PP_S4Q01_RESPONSE_STATUS'], 'REPORTED');
      expect(out['S4Q02_RESPONSE_STATUS'], 'NONE');
      expect(out['PP_S4Q06_RESPONSE_STATUS'], 'REPORTED');
      expect(out['S4Q03_RESPONSE_STATUS'], 'NONE');
      expect(out['pp_s4q01_a'], 5);
      expect(out['pp_s4q02_a'], 0);
      expect(out['pp_s4q02_b'], 0);
      expect(out['s3kpi_employed_current'], 9);
      expect(out['s3kpi_trained_current'], 0);
      expect(out.containsKey('_scopeConfig'), isFalse);
    });

    test('the controller applies it to a Project / Programme payload', () async {
      final ctrl = await _controller(const {
        '_scopeConfig': {
          'projectProgram': {
            'completedAt': '2026-11-27T10:00:00Z',
            'noOutcomes': true,
            'outcomes': [],
            'hasPermanentStaff': false,
            'hasTemporaryStaff': false,
            'hasRecruitment': false,
            'recruitmentTypes': [],
          },
        },
      });
      addTearDown(ctrl.dispose);
      final out = ctrl.collectAndMapData();
      expect(out['S4Q01_RESPONSE_STATUS'], 'NONE');
      expect(out['pp_s4q01_cadres_male_15_24'], 0);
      expect(out['s3kpi_employed_current'], 0);
      expect(out.containsKey('_scopeConfig'), isFalse);
    });
  });

  testWidgets('answering on a phone: one question per screen, then the review',
      (tester) async {
    tester.view.physicalSize = const Size(360, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    var completed = false;
    await tester.pumpWidget(MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          child: ProjectProgramScopeQuiz(
            ctrl: ctrl,
            onComplete: () => completed = true,
            onBack: () {},
          ),
        ),
      ),
    ));
    await tester.pump();

    expect(find.text("Résultats d'insertion et de formation"), findsOneWidget);
    await tester.tap(find.text('Personnes formées aux métiers ou développement de compétences'));
    await tester.pump();
    await tester.tap(find.text('Continuer'));
    await tester.pump();

    expect(find.text('4.1 Personnel permanent (CDI ou statutaire)'), findsOneWidget);
    await tester.tap(find.text('Oui'));
    await tester.pump();
    await tester.tap(find.text('Continuer'));
    await tester.pump();

    expect(find.text('4.2 Personnel temporaire (CDD, vacataires, consultants)'),
        findsOneWidget);
    await tester.tap(find.text('Non'));
    await tester.pump();
    await tester.tap(find.text('Continuer'));
    await tester.pump();

    // « Non » to recruitments: the button opens the tables (the review).
    await tester.tap(find.text('Non'));
    await tester.pump();
    expect(find.text('Ouvrir les tableaux'), findsOneWidget);
    await tester.tap(find.text('Ouvrir les tableaux'));
    await tester.pump();

    expect(find.text('Vérifiez vos réponses sur le projet ou programme'), findsOneWidget);
    expect(find.text('4.1 Permanents recensés'), findsOneWidget);
    // Nothing is written before confirmation.
    expect(ctrl.data['_scopeConfig'], isNull);

    await tester.tap(find.text('Confirmer et ouvrir les tableaux'));
    await tester.pumpAndSettle();
    expect(completed, isTrue);
    final cfg = (ctrl.data['_scopeConfig'] as Map)['projectProgram'] as Map;
    expect(cfg['completedAt'], isNotNull);
    expect(cfg['outcomes'], ['trained']);
    expect(ctrl.data['S4Q01_RESPONSE_STATUS'], 'REPORTED');
    expect(ctrl.data['S4Q02_RESPONSE_STATUS'], 'NONE');
    expect(ctrl.data['PP_S4Q03_RESPONSE_STATUS'], 'NONE');
    expect(ctrl.data['pp_s4q02_cadres_male_15_24'], 0);
    expect(ctrl.data['s3kpi_employed_current'], 0);
    expect(isPpQuizComplete(ctrl), isTrue);
    await tester.pump(const Duration(seconds: 4));
  });

  testWidgets('a nil declaration is confirmed first', (tester) async {
    tester.view.physicalSize = const Size(360, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final ctrl = await _controller(const {
      '_scopeConfig': {
        'projectProgram': {
          'noOutcomes': true,
          'outcomes': [],
          'hasPermanentStaff': false,
          'hasTemporaryStaff': false,
          'hasRecruitment': false,
          'recruitmentTypes': [],
        },
      },
    });
    addTearDown(ctrl.dispose);
    var completed = false;
    await tester.pumpWidget(MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          child: ProjectProgramScopeQuiz(
            ctrl: ctrl,
            onComplete: () => completed = true,
            onBack: () {},
          ),
        ),
      ),
    ));
    await tester.pump();

    // Saved answers that cover every question open on the review.
    expect(find.text('Vérifiez vos réponses sur le projet ou programme'), findsOneWidget);
    await tester.tap(find.text('Confirmer et ouvrir les tableaux'));
    await tester.pumpAndSettle();
    expect(find.text('Confirmer une déclaration à néant'), findsOneWidget);
    await tester.tap(find.text('Modifier mes réponses'));
    await tester.pumpAndSettle();
    expect(completed, isFalse);

    await tester.tap(find.text('Confirmer et ouvrir les tableaux'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmer la déclaration à néant'));
    await tester.pumpAndSettle();
    expect(completed, isTrue);
    expect(ctrl.data['S4Q06_RESPONSE_STATUS'], 'NONE');
    await tester.pump(const Duration(seconds: 4));
  });
}
