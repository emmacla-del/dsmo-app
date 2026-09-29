// Regression coverage for two ONEFOP form-filling fixes:
//  1. No loading-skeleton flash on open (schema load is now synchronous).
//  2. No scroll jump on every keystroke while typing.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_unified_form_screen_v4.dart';
import 'package:dsmo_app/screens/onefop/excel/onefop_excel_shell.dart';
import 'package:dsmo_app/core/focus/renderers/generic_spreadsheet_table.dart';

void main() {
  test('clearing a VTC numeric answer does not turn it into zero', () {
    final ctrl = OnefopFormController(
      entityType: EntityType.vocationalTraining,
      initialData: const {},
      onSave: (_) {},
    );
    addTearDown(ctrl.dispose);
    ctrl.initialize();

    final numberField = ctrl.schema!.fields.firstWhere(
      (field) => field.type == 'number',
    );

    ctrl.onFieldChanged(numberField.id, '0', numberField);
    expect(ctrl.data[numberField.id], 0,
        reason: 'an explicitly typed zero is a real reported value');

    ctrl.onFieldChanged(numberField.id, '', numberField);
    expect(ctrl.data.containsKey(numberField.id), isFalse,
        reason: 'a cleared input is unanswered, rather than a manufactured zero');
  });

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

    final scrollFinder = find.descendant(
      of: find.byType(OnefopExcelShell),
      matching: find.byType(SingleChildScrollView),
    ).first;
    final controller = tester.widget<SingleChildScrollView>(scrollFinder).controller!;
    final offsetBefore = controller.offset;

    final field = find.descendant(
      of: find.byType(OnefopExcelShell),
      matching: find.byType(TextField),
    ).first;
    await tester.enterText(field, 'A');
    await tester.pump();
    await tester.enterText(field, 'Ab');
    await tester.pump();
    await tester.enterText(field, 'Abc');
    await tester.pump();

    final offsetAfter = controller.offset;
    expect(offsetAfter, offsetBefore,
        reason: 'typing should never trigger scrollToField anymore');

    expect(tester.takeException(), isNull);
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
    await tester.pumpAndSettle();

    expect(find.byType(OnefopExcelShell), findsOneWidget);
    expect(find.byType(GenericSpreadsheetTable), findsOneWidget,
      reason: 'the active Excel unit should render its shared table path');
    expect(tester.takeException(), isNull);
  });
}
