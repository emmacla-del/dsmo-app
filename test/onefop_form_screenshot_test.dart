// Throwaway visual-audit tool — renders the ONEFOP form to PNGs via golden
// capture so its current appearance can actually be inspected, not guessed
// from reading widget code. Not a real regression test; safe to delete.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_unified_form_screen_v4.dart';

Future<void> _capture(WidgetTester tester, String name,
    {Size size = const Size(1440, 1000)}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: const Locale('fr'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: OnefopUnifiedFormScreenV4(
          entityType: EntityType.enterprise,
          initialData: const {},
          onSave: (_) {},
        ),
      ),
    ),
  );
  await tester.pump();
  tester.takeException(); // drain the known focusFirst()/warm-up-frame race

  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
}

void main() {
  testWidgets('capture desktop page 0', (tester) async {
    await _capture(tester, 'onefop_desktop_page0');
  });

  testWidgets('capture mobile page 0', (tester) async {
    await _capture(tester, 'onefop_mobile_page0', size: const Size(390, 844));
  });
}
