// Phone audit (2026-11-27): renders every page of each ONEFOP questionnaire
// at a phone size, so the forms' look on a phone can be reviewed from real
// renders instead of guessed from widget code. Not a regression test: run
//
//   flutter test test/phone_audit_test.dart --update-goldens
//
// and the PNGs land in test/goldens/phone_audit/. Pages are reached through
// the controller (debugLastOnefopFormController.goto), not by filling every
// required field; the surface is 360px wide (a small Android phone) and
// tall enough to show a whole page in one image.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_unified_form_screen_v4.dart';

const _width = 360.0;
const _height = 1800.0;

/// Every quiz question answered « Oui » with every choice ticked, so the
/// tables after the employer quiz open in full.
const _allYesScope = <String, dynamic>{
  '_scopeConfig': {
    'applications': true,
    'application_csp': ['cadres', 'maitrise', 'execution'],
    'application_age': ['15_24', '25_34', '35_plus'],
    'recruit': true,
    'recruit_types': ['permanent', 'temporaire'],
    'recruit_csp': ['cadres', 'maitrise', 'execution'],
    'recruit_age': ['15_24', '25_34', '35_plus'],
    'recruit_diploma': ['cep', 'bepc', 'probatoire', 'bac', 'bts', 'licence',
        'maitrise', 'master', 'dqp', 'cqp', 'autres', 'sans_diplome'],
    'disability': true,
    'vulnerable': true,
    'primo_seekers': true,
    'primo_seekers_csp': ['cadres', 'maitrise', 'execution'],
    'primo_seekers_age': ['15_24', '25_34', '35_plus'],
    'primo_workers': true,
    'primo_workers_types': ['permanent', 'temporaire'],
    'primo_workers_csp': ['cadres', 'maitrise', 'execution'],
    'primo_workers_age': ['15_24', '25_34', '35_plus'],
    'departures': true,
    'departure_reasons': ['licenciement', 'demission', 'retraite', 'autre'],
    'dismissal_technical': true,
    'interns': true,
    'intern_types': ['vacance', 'academique', 'professionnel', 'preemploi'],
    'skills_needs': true,
    'training_needs': true,
  },
};

// The Project / Programme quiz confirmed with every answer « Oui », so the
// audit reaches its tables.
const _ppAllYesScope = <String, dynamic>{
  '_scopeConfig': {
    'projectProgram': {
      'completedAt': '2026-11-27T10:00:00Z',
      'noOutcomes': false,
      'outcomes': ['employed', 'self_employed', 'jobs_created', 'trained'],
      'hasPermanentStaff': true,
      'hasTemporaryStaff': true,
      'hasRecruitment': true,
      'recruitmentTypes': ['permanent', 'temporary', 'disability', 'vulnerable'],
    },
  },
};

Future<void> _pumpForm(WidgetTester tester, EntityType type,
    {required bool simple,
    required String lang,
    Map<String, dynamic> initialData = const {}}) async {
  tester.view.physicalSize = const Size(_width, _height);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: Locale(lang),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: OnefopUnifiedFormScreenV4(
          entityType: type,
          initialData: initialData,
          forceSimpleMode: simple,
          campaignPeriodStart: DateTime(2026, 1, 1),
          campaignPeriodEnd: DateTime(2026, 6, 30),
          onSave: (_) {},
        ),
      ),
    ),
  );
  await tester.pump();
  tester.takeException();
  await tester.pump(const Duration(milliseconds: 300));
  tester.takeException();
}

Future<void> _auditAllPages(WidgetTester tester, String name, EntityType type,
    {bool simple = false,
    String lang = 'fr',
    Map<String, dynamic> initialData = const {}}) async {
  await _pumpForm(tester, type,
      simple: simple, lang: lang, initialData: initialData);
  final ctrl = debugLastOnefopFormController!;
  final pages = ctrl.pageCount;
  for (var p = 0; p < pages; p++) {
    ctrl.goto(p, focus: false);
    await tester.pump();
    tester.takeException();
    await tester.pump(const Duration(milliseconds: 300));
    tester.takeException();
    final n = p.toString().padLeft(2, '0');
    await expectLater(find.byType(MaterialApp),
        matchesGoldenFile('goldens/phone_audit/${name}_p$n.png'));
  }
  // Flush the controller's autosave timer before teardown.
  await tester.pump(const Duration(seconds: 4));
}

void main() {
  testWidgets('phone audit — employer (enterprise)', (tester) async {
    await _auditAllPages(tester, 'enterprise', EntityType.enterprise,
        initialData: _allYesScope);
  });

  // The employer preliminary quiz, unanswered: it stands before Section 2.
  testWidgets('phone audit — employer quiz', (tester) async {
    await _pumpForm(tester, EntityType.enterprise, simple: false, lang: 'fr');
    debugLastOnefopFormController!.goto(2, focus: false);
    await tester.pump();
    tester.takeException();
    await tester.pump(const Duration(milliseconds: 300));
    await expectLater(find.byType(MaterialApp),
        matchesGoldenFile('goldens/phone_audit/quiz_p00.png'));
    await tester.tap(find.text('Oui'));
    await tester.pump(const Duration(milliseconds: 300));
    await expectLater(find.byType(MaterialApp),
        matchesGoldenFile('goldens/phone_audit/quiz_p01.png'));
    await tester.pump(const Duration(seconds: 4));
  });

  // The Project / Programme quiz, unanswered: it stands before Section 2.
  testWidgets('phone audit — project / programme quiz', (tester) async {
    await _pumpForm(tester, EntityType.projectProgram, simple: false, lang: 'fr');
    debugLastOnefopFormController!.goto(2, focus: false);
    await tester.pump();
    tester.takeException();
    await tester.pump(const Duration(milliseconds: 300));
    await expectLater(find.byType(MaterialApp),
        matchesGoldenFile('goldens/phone_audit/pp_quiz_p00.png'));
    await tester.pump(const Duration(seconds: 4));
  });

  testWidgets('phone audit — administration', (tester) async {
    await _auditAllPages(tester, 'administration', EntityType.administration,
        initialData: _allYesScope);
  });

  testWidgets('phone audit — project / programme', (tester) async {
    await _auditAllPages(tester, 'project', EntityType.projectProgram,
        initialData: _ppAllYesScope);
  });

  testWidgets('phone audit — training centre (VT, wizard)', (tester) async {
    await _auditAllPages(tester, 'vt', EntityType.vocationalTraining,
        simple: true);
  });

  testWidgets('phone audit — employer, English', (tester) async {
    await _auditAllPages(tester, 'enterprise_en', EntityType.enterprise,
        lang: 'en', initialData: _allYesScope);
  });
}
