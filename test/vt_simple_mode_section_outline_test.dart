// Regression coverage for a live UI report: VT desktop Simple Mode
// showed a "floating isolated code" — OnefopSectionMap's own separate
// caption ("2.1 General Information") followed underneath by a lone chip
// line ("● 2.1") duplicating the same code with no context around it.
// Root cause: shared behavior, not a bug in OnefopSectionMap itself —
// SimpleModeShell (desktop) and the mobile stepper
// (onefop_unified_form_screen_v4.dart) both render the exact same
// OnefopSectionMap every other entity gets, unmodified. VT's own desktop
// Spreadsheet Mode already got a dedicated replacement for this
// (_VtSidebarSectionItem/_VtSubsectionTree, in the persistent Sidebar);
// this fix gives VT the same treatment on the two remaining shells it
// still shared OnefopSectionMap on: SimpleModeShell and mobile.
// VtSectionOutline folds the caption and chip into one integrated
// glyph+full-text row per subsection instead. OnefopSectionMap itself is
// unmodified and still used, unchanged, by every non-VT entity on both
// platforms — this file's second group covers that explicitly.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/providers/onefop_mode_provider.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_section_units.dart'
    show OnefopSectionMap, VtSectionOutline;
import 'package:dsmo_app/screens/onefop/simple_mode_shell.dart';

Future<OnefopFormController> _pumpSimpleMode(
  WidgetTester tester,
  EntityType entityType,
  String sectionId,
) async {
  final ctrl = OnefopFormController(
    entityType: entityType,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  addTearDown(ctrl.dispose);
  final section = ctrl.schema!.sections.firstWhere((s) => s.id == sectionId);
  ctrl.goto(ctrl.schema!.sections.indexOf(section), focus: false, scroll: false);

  tester.view.physicalSize = const Size(1920, 1080);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        body: ListenableBuilder(
          listenable: ctrl,
          builder: (context, _) => SimpleModeShell(
            ctrl: ctrl,
            entityType: entityType,
            buildField: (f) => const SizedBox.shrink(),
            onPreviewSubmit: () async {},
            title: 'ONEFOP',
            dirty: false,
            saving: false,
            mode: OnefopViewMode.simple,
            onModeChanged: (_) {},
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 3));
  await tester.pump(const Duration(milliseconds: 700));
  return ctrl;
}

void main() {
  group('VT: Simple Mode uses VtSectionOutline, not OnefopSectionMap', () {
    testWidgets(
        'section2 (2.1/2.2) shows one integrated row per subsection — no '
        'separate floating "● 2.1" chip under the caption', (tester) async {
      await _pumpSimpleMode(
          tester, EntityType.vocationalTraining, 'section2_vocationalTraining');

      expect(find.byType(VtSectionOutline), findsOneWidget);
      expect(find.byType(OnefopSectionMap), findsNothing);
      // The row shows the FULL text (code + description) exactly once —
      // no bare "2.1" glyph line separate from it.
      expect(find.text('2.1 Renseignements généraux'), findsOneWidget);
      expect(find.text('2.1'), findsNothing);
    });
  });

  group('Non-VT entities: Simple Mode keeps OnefopSectionMap unchanged', () {
    testWidgets('enterprise section2 still uses OnefopSectionMap, not VtSectionOutline',
        (tester) async {
      await _pumpSimpleMode(tester, EntityType.enterprise, 'section2');

      expect(find.byType(OnefopSectionMap), findsOneWidget);
      expect(find.byType(VtSectionOutline), findsNothing);
    });
  });
}
