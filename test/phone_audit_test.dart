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

Future<void> _pumpForm(WidgetTester tester, EntityType type,
    {required bool simple, required String lang}) async {
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
          initialData: const {},
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
    {bool simple = false, String lang = 'fr'}) async {
  await _pumpForm(tester, type, simple: simple, lang: lang);
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
    await _auditAllPages(tester, 'enterprise', EntityType.enterprise);
  });

  testWidgets('phone audit — administration', (tester) async {
    await _auditAllPages(tester, 'administration', EntityType.administration);
  });

  testWidgets('phone audit — project / programme', (tester) async {
    await _auditAllPages(tester, 'project', EntityType.projectProgram);
  });

  testWidgets('phone audit — training centre (VT, wizard)', (tester) async {
    await _auditAllPages(tester, 'vt', EntityType.vocationalTraining,
        simple: true);
  });

  testWidgets('phone audit — employer, English', (tester) async {
    await _auditAllPages(tester, 'enterprise_en', EntityType.enterprise,
        lang: 'en');
  });
}
