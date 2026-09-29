// Ticket B — _VtRowSheet's desktop width cap. showModalBottomSheet has no
// width constraint of its own (no global BottomSheetThemeData — see
// VT-UI/UX-01 §7), so before this fix the sheet's single-column fields
// stretched edge to edge on a wide desktop viewport. Verifies the sheet
// stays capped and centered at 1920×1080, and stays full-bleed (unchanged)
// on a 390px phone.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_row_editor.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

OnefopFormController _controller() {
  return OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
}

Future<void> _openSheet(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final ctrl = _controller();
  addTearDown(ctrl.dispose);
  final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(12),
          child: VtRowEditor(ctrl: ctrl, def: def),
        ),
      ),
    ),
  );
  await tester.pump();

  await tester.tap(find.text('Doctorat/PhD'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('desktop (1920×1080): sheet content is capped at maxWidth 560 and centered',
      (tester) async {
    await _openSheet(tester, const Size(1920, 1080));

    final doneButtonFinder = find.widgetWithText(FilledButton, 'Terminé');
    expect(doneButtonFinder, findsOneWidget);

    final constrainedBoxFinder = find.ancestor(
      of: doneButtonFinder,
      matching: find.byWidgetPredicate(
          (w) => w is ConstrainedBox && w.constraints.maxWidth == 560),
    );
    expect(constrainedBoxFinder, findsOneWidget);

    final sheetWidth = tester.getSize(constrainedBoxFinder).width;
    expect(sheetWidth, lessThanOrEqualTo(560));
    // Comfortably narrower than the 1920px viewport — proves the cap
    // actually took effect, not just that a 560-max box happens to exist.
    expect(sheetWidth, lessThan(600));

    // Centered: left edge and right-viewport-edge gaps match within a few
    // pixels (SafeArea/rounding tolerance).
    final topLeft = tester.getTopLeft(constrainedBoxFinder);
    final topRight = tester.getTopRight(constrainedBoxFinder);
    final leftGap = topLeft.dx;
    final rightGap = 1920 - topRight.dx;
    expect((leftGap - rightGap).abs(), lessThan(2.0));
  });

  testWidgets('phone (390×844): sheet stays full-bleed — cap is a no-op below 560',
      (tester) async {
    await _openSheet(tester, const Size(390, 844));

    final doneButtonFinder = find.widgetWithText(FilledButton, 'Terminé');
    expect(doneButtonFinder, findsOneWidget);

    final constrainedBoxFinder = find.ancestor(
      of: doneButtonFinder,
      matching: find.byWidgetPredicate(
          (w) => w is ConstrainedBox && w.constraints.maxWidth == 560),
    );
    expect(constrainedBoxFinder, findsOneWidget);

    final sheetWidth = tester.getSize(constrainedBoxFinder).width;
    // Same width the sheet already rendered at pre-Ticket-B — the modal
    // route's own full-device-width behavior, unconstrained by 560.
    expect(sheetWidth, 390);
  });
}
