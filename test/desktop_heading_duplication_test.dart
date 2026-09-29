// Regression coverage for a live bug report: "in the simple form, [section/
// subsection headings] are doubling."
//
// Root cause: Sidebar's _SidebarPageItem already rendered its own copy of
// OnefopSectionMap (subsection headings + the ✓/●/○ question-chip line)
// for the active section, whenever ctrl.sidebarMode == 2 — the default
// (onefop_form_controller.dart: `int _sidebarMode = 2;`). Sidebar is
// shared, unchanged, between both desktop modes (see _desktopLayout in
// onefop_unified_form_screen_v4.dart). Two things then happened:
//
//  - Spreadsheet Mode: ExcelSectionBody was recently given its own
//    OnefopSectionMap (fixing "headings don't appear" at all in that
//    shell) — landing right next to Sidebar's pre-existing copy, so the
//    same heading/chip content is now on screen twice at once.
//  - Simple Mode: _UnitBody never had OnefopSectionMap of its own, only a
//    bare subsectionLabel caption — but that caption still duplicates
//    against Sidebar's copy whenever their text lines up (same subsection
//    label, both visible at once).
//
// Fix: Sidebar's per-item copy is removed entirely (see _SidebarPageItem);
// each mode's own content pane (ExcelSectionBody, and now _UnitBody too)
// is the single place this outline is shown, matching mobile's
// already-established pattern of showing it once, in the content column.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/excel/onefop_excel_field_rows.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_widgets.dart' show Sidebar;
import 'package:dsmo_app/screens/onefop/simple_mode_shell.dart';
import 'package:dsmo_app/providers/onefop_mode_provider.dart';

Future<OnefopFormController> _controller(EntityType entityType, {String? sectionId}) async {
  final ctrl = OnefopFormController(
    entityType: entityType,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  if (sectionId != null) {
    final idx = ctrl.schema!.sections.indexWhere((s) => s.id == sectionId);
    if (idx >= 0) ctrl.goto(idx, focus: false, scroll: false);
  }
  return ctrl;
}

Future<void> _pump(WidgetTester tester, Widget body) async {
  tester.view.physicalSize = const Size(1920, 1080);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(backgroundColor: kCanvas, body: body),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('Sidebar alone renders no chip-outline glyphs for the active '
      'item at the default sidebarMode (2) — that copy is gone', (tester) async {
    final ctrl = await _controller(EntityType.enterprise, sectionId: 'section2');
    addTearDown(ctrl.dispose);
    expect(ctrl.sidebarMode, 2, reason: 'this is the shell\'s default, not a special case');

    await _pump(tester, Sidebar(ctrl: ctrl, entityType: EntityType.enterprise));

    expect(find.textContaining(RegExp(r'[✓●○]')), findsNothing);
    expect(find.text("2.1 DEMANDE D'EMPLOIS"), findsNothing);
  });

  testWidgets(
      'Sidebar + ExcelSectionBody together (the real Spreadsheet Mode '
      'composition, _desktopLayout) show "2.1 DEMANDE D\'EMPLOIS" exactly '
      'once, not doubled', (tester) async {
    final ctrl = await _controller(EntityType.enterprise, sectionId: 'section2');
    addTearDown(ctrl.dispose);
    final section = ctrl.schema!.sections.firstWhere((s) => s.id == 'section2');

    await _pump(
      tester,
      Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Sidebar(ctrl: ctrl, entityType: EntityType.enterprise),
          Expanded(
            child: ExcelSectionBody(
              ctrl: ctrl,
              section: section,
              entityType: EntityType.enterprise,
              onPreviewSubmit: () async {},
            ),
          ),
        ],
      ),
    );

    expect(find.text("2.1 DEMANDE D'EMPLOIS"), findsOneWidget);
  });

  testWidgets(
      'Sidebar + SimpleModeShell together (the real Simple Mode composition) '
      'show "2.1 DEMANDE D\'EMPLOIS" exactly once, not doubled, and the '
      'question-chip line still lets you jump to a specific question',
      (tester) async {
    final ctrl = await _controller(EntityType.enterprise, sectionId: 'section2');
    addTearDown(ctrl.dispose);

    await _pump(
      tester,
      Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Sidebar(ctrl: ctrl, entityType: EntityType.enterprise),
          Expanded(
            child: SimpleModeShell(
              ctrl: ctrl,
              entityType: EntityType.enterprise,
              buildField: (f) => const SizedBox.shrink(),
              onPreviewSubmit: () async {},
              title: 'ONEFOP',
              dirty: false,
              saving: false,
              mode: OnefopViewMode.simple,
              onModeChanged: (_) {},
            ),
          ),
        ],
      ),
    );

    expect(find.text("2.1 DEMANDE D'EMPLOIS"), findsOneWidget);
    // The chip-jump navigation Sidebar used to be the only source of (see
    // this file's header comment) — still present, just relocated to the
    // one place it's shown now.
    expect(find.textContaining(RegExp(r'[✓●○]')), findsWidgets);
  });
}
