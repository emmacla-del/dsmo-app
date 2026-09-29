// VT-UIUX-02 (desktop gap fix) — VT tables reached ExcelSectionBody's
// simpleFieldsBuilder (buildTableGroupUnits' own unit-boundary logic
// isolates each VT table into its own singleton unit — never routed
// through addTableUnit/TableRenderer), but _SimpleFieldsTable had no vt_
// awareness at all, so every VT table rendered as an empty grid row on
// desktop: VT cells write to synthesized per-cell ids, not field.id, so
// ExcelValueCell's `ctrl.ctrl[field.id]` was always null. The first fix
// deferred to VtRowEditor (mobile's own tap-a-row/bottom-sheet editor) —
// content appeared, but every other desktop table renders as a real
// GridLayoutEngine spreadsheet grid, so a VT section still broke the
// "this is a spreadsheet" illusion in the middle of the form. Superseded
// by VtSpreadsheetTable (core/focus/renderers/vt_spreadsheet_table.dart):
// the same VtTableDef/ctrl.data, rendered as an actual grid instead.
// Exercises the real ExcelSectionBody (the actual desktop shell widget,
// not a stand-in) at a real desktop viewport, for the two VT sections
// that are heaviest on tables.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_spreadsheet_table.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/excel/onefop_excel_field_rows.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

Future<OnefopFormController> _controller() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<OnefopFormController> _pumpDesktopSection(
  WidgetTester tester,
  String sectionId, {
  int? unitIndex,
}) async {
  tester.view.physicalSize = const Size(1920, 1080);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final ctrl = await _controller();
  addTearDown(ctrl.dispose);
  final section = ctrl.schema!.sections.firstWhere((s) => s.id == sectionId);
  // ExcelSectionBody is a plain StatelessWidget with no listener of its
  // own — setting the cursor before the first pumpWidget (rather than
  // calling setUnitCursor + tester.pump() on an already-built tree, which
  // notifies ctrl's own listeners but nothing here is subscribed to
  // rebuild from that) is what actually lands on a specific unit.
  if (unitIndex != null) ctrl.setUnitCursor(sectionId, unitIndex);

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        body: ExcelSectionBody(
          ctrl: ctrl,
          section: section,
          entityType: EntityType.vocationalTraining,
          onPreviewSubmit: () async {},
        ),
      ),
    ),
  );
  await tester.pump();
  return ctrl;
}

void main() {
  testWidgets(
      'desktop Excel shell: section 4 (fixed-taxonomy VT4_1, the first unit) '
      'renders VtSpreadsheetTable, not an empty grid row', (tester) async {
    await _pumpDesktopSection(tester, 'section4_vocationalTraining');

    // The old pinned paperCode/question-text banner (TableRenderer.
    // buildHeader) is gone for VT — see onefop_section_units.dart's
    // removed vtTableHeader path — replaced by the active subsection's own
    // real heading (code + complete description, from
    // unit.subsectionLabel) right above the table; no separate bare-code
    // breadcrumb duplicating it. The same full text is also shown in the
    // Sidebar's subsection tree (_VtSubsectionTree, onefop_form_widgets
    // .dart, a sibling of ExcelSectionBody in the real shell — see
    // vt_sidebar_subsection_tree_test.dart) — a local workspace heading
    // and the persistent nav map both showing it is intentional.
    expect(find.byType(VtSpreadsheetTable), findsOneWidget);
    expect(find.text('→ 4.1'), findsNothing);
    expect(
      find.text('4.1 Effectifs des apprenants par diplôme académique le plus élevé'),
      findsOneWidget,
    );
    expect(find.text('Doctorat/PhD'), findsOneWidget);

    // The old broken path (_SimpleFieldsTable) never rendered for this
    // unit — a plain "1" row-number cell (its own row-numbering scheme)
    // would be the only evidence it had claimed the field, and no diploma
    // labels would exist anywhere in the tree if it had.
  });

  testWidgets(
      'desktop Excel shell: roster (8.8, repeatingTable) also renders VtSpreadsheetTable',
      (tester) async {
    // Section 8's first unit is VT8_1 (a table-typed field). Unit order:
    // VT8_1, VT8_2, VT8_3, VT8_4 (each a singleton VT unit), then VT8_5's
    // six plain (non-VT) number fields bundled into one ordinary "simple"
    // unit, then VT8_6, VT8_7, VT8_8 — so the roster is unit index 7, not
    // 6. Jump straight there to prove the fix also covers
    // repeatingTable-typed VT fields, not just table-typed ones.
    await _pumpDesktopSection(tester, 'section8_vocationalTraining', unitIndex: 7);

    expect(find.byType(VtSpreadsheetTable), findsOneWidget);
    // Same full-heading-only story as 4.1 above.
    expect(find.text('→ 8.8'), findsNothing);
    expect(
      find.textContaining('Etat nominatif du personnel formateur et administratif'),
      findsOneWidget,
    );
  });

  testWidgets(
      'desktop Excel shell: a non-VT table (administration S21Q01) still uses '
      'the real spreadsheet grid — no regression', (tester) async {
    tester.view.physicalSize = const Size(1920, 1080);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final ctrl = OnefopFormController(
      entityType: EntityType.administration,
      initialData: const {},
      onSave: (_) async {},
    );
    await ctrl.initialize();
    addTearDown(ctrl.dispose);
    final section = ctrl.schema!.sections.firstWhere((s) => s.id == 'section2');

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('fr'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          backgroundColor: kCanvas,
          body: ExcelSectionBody(
            ctrl: ctrl,
            section: section,
            entityType: EntityType.administration,
            onPreviewSubmit: () async {},
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(VtSpreadsheetTable), findsNothing);
  });
}
