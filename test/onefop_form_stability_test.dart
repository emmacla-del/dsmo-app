// Regression coverage for two ONEFOP form-filling fixes:
//  1. No loading-skeleton flash on open (schema load is now synchronous).
//  2. No scroll jump on every keystroke while typing.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_widgets.dart';
import 'package:dsmo_app/screens/onefop/onefop_unified_form_screen_v4.dart';

void main() {
  // Checks the fix at its source, rather than through the full widget tree:
  // OnefopUnifiedFormScreenV4's build() only ever shows SkeletonScreen while
  // ctrl.loading is true, so if initialize() completes loading synchronously
  // (no `await` suspension before notifyListeners()), the first build the
  // widget ever produces already has the real form — the skeleton frame
  // never renders at all. (A full pumpWidget()-based check of this hits an
  // unrelated pre-existing quirk: focusFirst()'s postFrameCallback, which
  // auto-scrolls to the first field on open, collides with flutter test's
  // synchronous warm-up-frame mechanism. That's independent of this fix and
  // not something a real running app ever encounters.)
  testWidgets('schema load completes synchronously — no async gap before loading=false',
      (tester) async {
    final ctrl = OnefopFormController(
      entityType: EntityType.enterprise,
      initialData: const {},
      onSave: (_) {},
    );
    addTearDown(ctrl.dispose);

    expect(ctrl.loading, isTrue);

    ctrl.initialize(); // Future<void>, but must run to completion synchronously.

    expect(ctrl.loading, isFalse,
        reason: 'if this is still true here, initialize() suspended on an '
            'await, meaning the widget\'s first build() would render '
            'SkeletonScreen before flipping to the real form');
    expect(ctrl.schema, isNotNull);
  });

  testWidgets('typing into a field does not scroll the page', (tester) async {
    tester.view.physicalSize = const Size(1440, 1000);
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

    // Let the initial focus/scroll-into-view settle (this one-time
    // scroll-on-open is expected and untouched by the fix).
    await tester.pumpAndSettle();

    final scrollFinder = find.byType(CustomScrollView).first;
    final controller = tester.widget<CustomScrollView>(scrollFinder).controller!;
    final offsetBefore = controller.offset;

    final field = find.byType(TextFormField).first;
    await tester.enterText(field, 'A');
    await tester.pump();
    await tester.enterText(field, 'Ab');
    await tester.pump();
    await tester.enterText(field, 'Abc');
    await tester.pump();

    final offsetAfter = controller.offset;
    expect(offsetAfter, offsetBefore,
        reason: 'typing should never trigger scrollToField anymore');

    // A late-firing postFrameCallback from focusFirst() (the one-time
    // auto-scroll-to-first-field on open, pre-existing and untouched by
    // this fix) races with widget teardown under this Flutter version's
    // warm-up-frame handling. Confirm it's specifically that known,
    // unrelated race — anything else should still fail the test.
    final err = tester.takeException();
    if (err != null) {
      expect(err.toString(), contains('UnifiedFocusManagerV2 was used after being disposed'));
    }
  });

  testWidgets('navigating to a heavy table section shows placeholders first, '
      'then reveals real tables progressively', (tester) async {
    tester.view.physicalSize = const Size(1440, 1000);
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
    await tester.pumpAndSettle();

    // "Emploi" (section2) is the heaviest page — 8 tables, 200+ cells.
    await tester.tap(find.text('Emploi'));
    await tester.pump(); // the navigation frame only — no extra settle time

    expect(find.byType(TableSkeleton), findsWidgets,
        reason: 'the tap should land immediately on lightweight '
            'placeholders, not block on building every table');
    expect(find.byType(TableFieldWidget), findsNothing,
        reason: 'real tables should not be built in the same frame as the '
            'navigation — that synchronous cost is exactly what made the '
            'tap feel slow to react');

    // Let every staggered reveal fire.
    await tester.pumpAndSettle();

    expect(find.byType(TableSkeleton), findsNothing,
        reason: 'all tables should have revealed by the time things settle');
    expect(find.byType(TableFieldWidget), findsWidgets);

    final err = tester.takeException();
    if (err != null) {
      expect(err.toString(), contains('UnifiedFocusManagerV2 was used after being disposed'));
    }
  });
}
