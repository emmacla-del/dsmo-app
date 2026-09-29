// VT-UI/UX-05 P1 — desktop density for VtRowEditor's row list. Reuses the
// same desktop/mobile breakpoint the rest of ONEFOP already uses
// (OL.pageWidth, 794px — see onefop_unified_form_screen_v4.dart's own
// `desktop = ... >= OL.pageWidth` check), not a new one.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_row_editor.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

OnefopFormController _controller({Map<String, dynamic> initialData = const {}}) {
  return OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: initialData,
    onSave: (_) async {},
  );
}

Future<OnefopFormController> _pump(
  WidgetTester tester,
  VtTableDef def,
  Size size, {
  Map<String, dynamic> initialData = const {},
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final ctrl = _controller(initialData: initialData);
  addTearDown(ctrl.dispose);
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
  return ctrl;
}

void main() {
  group('fixed-taxonomy table (4.1 diploma)', () {
    final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
    const filledData = {'s4q1_licence_male': 12, 's4q1_licence_female': 8};

    testWidgets('mobile (390×844): no secondary line, gap between tiles unchanged from before',
        (tester) async {
      await _pump(tester, def, const Size(390, 844), initialData: filledData);

      expect(find.text('Hommes: 12 · Femmes: 8'), findsNothing);

      // Two adjacent row tiles' vertical gap — this is the same 6px bottom
      // margin the tile already had before this ticket (isDesktop is
      // always false at this width).
      final doctorat = tester.getBottomLeft(find.text('Doctorat/PhD'));
      final master2 = tester.getTopLeft(find.text('Master II/DEA/DESS'));
      final gap = master2.dy - doctorat.dy;
      expect(gap, greaterThan(0));
      expect(gap, lessThan(40)); // sanity bound, not a strict pixel pin
    });

    testWidgets('desktop (1920×1080): secondary line shows the row\'s own filled cells',
        (tester) async {
      await _pump(tester, def, const Size(1920, 1080), initialData: filledData);

      expect(find.text('Hommes: 12 · Femmes: 8'), findsOneWidget);
      // An unfilled row (Master II) shows no secondary line at all.
      expect(find.text('Master II/DEA/DESS'), findsOneWidget);
    });

    testWidgets('desktop tiles are visibly denser than mobile tiles for the same data',
        (tester) async {
      // Measure the mobile gap between two DIFFERENT, both-unfilled rows
      // (no secondary line on either side, so the comparison is purely
      // about the tile's own margin/padding, not extra content height).
      await _pump(tester, def, const Size(390, 844));
      final mobileTop = tester.getBottomLeft(find.text('Doctorat/PhD'));
      final mobileBottom = tester.getTopLeft(find.text('Master II/DEA/DESS'));
      final mobileGap = mobileBottom.dy - mobileTop.dy;

      await _pump(tester, def, const Size(1920, 1080));
      final desktopTop = tester.getBottomLeft(find.text('Doctorat/PhD'));
      final desktopBottom = tester.getTopLeft(find.text('Master II/DEA/DESS'));
      final desktopGap = desktopBottom.dy - desktopTop.dy;

      expect(desktopGap, lessThan(mobileGap));
    });
  });

  group('progressive/roster table (8.8)', () {
    const filledData = {
      's8q8_row1_lastName': 'Nkoa',
      's8q8_row1_firstName': 'Paul',
      's8q8_row1_sex': '1',
      's8q8_row1_trainerStatus': '3',
    };

    testWidgets('mobile: no secondary line for the roster row either', (tester) async {
      await _pump(tester, vtTrainerRosterTableDef, const Size(390, 844),
          initialData: filledData);

      expect(find.text('Nkoa Paul'), findsOneWidget); // row-tile label only
      expect(find.text('Sexe: Homme · Statut: Permanent'), findsNothing);
    });

    testWidgets('desktop: secondary line shows the roster row\'s picked sex/status',
        (tester) async {
      await _pump(tester, vtTrainerRosterTableDef, const Size(1920, 1080),
          initialData: filledData);

      expect(find.text('Nkoa Paul'), findsOneWidget);
      expect(find.text('Sexe: Homme · Statut: Permanent'), findsOneWidget);
    });
  });

  group('sheet width stays capped on desktop with density on', () {
    testWidgets('opening a row sheet on a dense desktop list still caps at 560px',
        (tester) async {
      final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
      await _pump(tester, def, const Size(1920, 1080),
          initialData: const {'s4q1_licence_male': 12, 's4q1_licence_female': 8});

      await tester.tap(find.text('Licence').first);
      await tester.pumpAndSettle();

      final doneButtonFinder = find.widgetWithText(FilledButton, 'Terminé');
      final constrainedBoxFinder = find.ancestor(
        of: doneButtonFinder,
        matching:
            find.byWidgetPredicate((w) => w is ConstrainedBox && w.constraints.maxWidth == 560),
      );
      expect(constrainedBoxFinder, findsOneWidget);
      expect(tester.getSize(constrainedBoxFinder).width, lessThanOrEqualTo(560));
    });
  });
}
