// Regression coverage for a live bug report: "the section to section
// navigation does not work from the last cell of section 3 to the first
// cell of section 4 when we press Enter" — plus "i think other cases
// also exist".
//
// Root cause: OnefopFormController.focusFieldId's `field.type == 'table'`
// branch resolves a table field's real first/last CELL id via
// TableCellEngine.cellIds(field) — built for ordinary ONEFOP tables
// (csp_table, diploma_table, ...) and returning an EMPTY list for every
// VT template (onefop_table_engine.dart's switch has no `vt_*` case).
// VT tables render through VtSpreadsheetTable/VtRowEditor instead, whose
// cells use VtTableDef-synthesized ids (e.g. "s4q1_doctorat_male"), never
// the field's own schema id — and VT's OTHER 10 tables are
// `type: repeatingTable`, which never even entered that branch at all
// (falling straight to the outer `else`). Either way, landing focus on
// the bare field id (e.g. "VT4_1") attaches to no real widget: no VT
// cell's FocusNode is ever keyed by it. The page/section itself changed
// correctly — ctrl.currentPage really did advance — but nothing was
// actually focused/typeable, which read as "navigation doesn't work".
//
// Fixed by teaching focusFieldId a VT-aware branch
// (_firstFocusableVtCellId) that resolves to a real VtTableDef cell id
// before ever falling through to TableCellEngine. Since focusFieldId is
// the single choke point every cross-unit/cross-section navigation path
// already funnels through (focusFirst, advanceToUnit/retreatToUnit,
// jumpToUnit, jumpToLocation, navigateToSection/navigateToSectionUnit),
// this one fix covers every "other case" of the same shape: Suivant/
// Précédent crossing a section boundary onto a VT table (either
// direction), a Sidebar section click, and a VT subsection-tree click —
// not just the specific section3->section4 (VT4_1, `type: table`) case
// reported.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/excel/onefop_excel_field_rows.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_section_units.dart';

/// Mirrors OnefopExcelShell's own section-follows-currentPage wiring —
/// real desktop navigation (Suivant/Précédent, Sidebar clicks) always
/// changes ctrl.currentPage first and expects the section body to follow;
/// a bare ExcelSectionBody pump for a fixed section (as most other tests
/// in this suite use) can't observe a *crossing*.
class _Harness extends StatelessWidget {
  final OnefopFormController ctrl;
  const _Harness({required this.ctrl});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ctrl,
      builder: (context, _) {
        final section = ctrl.primarySection(ctrl.currentPage);
        if (section == null) return const SizedBox.shrink();
        return ExcelSectionBody(
          ctrl: ctrl,
          section: section,
          entityType: EntityType.vocationalTraining,
          onPreviewSubmit: () async {},
        );
      },
    );
  }
}

Future<OnefopFormController> _pumpHarness(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1920, 1080);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  addTearDown(ctrl.dispose);

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(backgroundColor: kCanvas, body: _Harness(ctrl: ctrl)),
    ),
  );
  await tester.pump();
  return ctrl;
}

void main() {
  testWidgets(
      'Enter on VT3_30 (section3\'s last field) crosses into section4 and '
      'focuses a real VT table cell (VT4_1, `type: table`) — not the dead '
      'bare field id', (tester) async {
    final ctrl = await _pumpHarness(tester);
    final section3Idx =
        ctrl.schema!.sections.indexWhere((s) => s.id == 'section3_vocationalTraining');
    ctrl.goto(section3Idx, focus: false, scroll: false);
    ctrl.setUnitCursor('section3_vocationalTraining', 0);
    await tester.pump();

    ctrl.fm.focus('VT3_30');
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();

    expect(ctrl.currentPage, section3Idx + 1);
    expect(ctrl.schema!.sections[ctrl.currentPage].id, 'section4_vocationalTraining');
    // The bug's exact symptom: activeId must be a real VtTableDef cell id
    // (attached to a real, focused widget), never the bare "VT4_1".
    expect(ctrl.fm.activeId, isNot('VT4_1'));
    expect(ctrl.fm.activeId, 's4q1_doctorat_male');
    final node = ctrl.fm.getNode(ctrl.fm.activeId!);
    expect(node.context, isNotNull);
    expect(node.hasFocus, isTrue);

    await tester.pump(const Duration(seconds: 4)); // flush debounced revalidation
  });

  testWidgets(
      'jumping backward into section4\'s last unit (VT4_11, `type: '
      'table`) focuses its LAST row\'s real cell, not the bare field id',
      (tester) async {
    final ctrl = await _pumpHarness(tester);
    final section4Idx =
        ctrl.schema!.sections.indexWhere((s) => s.id == 'section4_vocationalTraining');
    ctrl.goto(section4Idx, focus: false, scroll: false);
    final section = ctrl.schema!.sections[section4Idx];
    final units = buildTableGroupUnits(
      ctrl, section, const Locale('fr'),
      entityType: EntityType.vocationalTraining,
      simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
      mobile: false,
    );
    expect(units.last.fieldIds, ['VT4_11']);

    // Entering the unit backward (preferFirst: false) — same pairing
    // retreatToUnit itself makes (setUnitCursor + focusFieldId) for
    // whichever unit it lands the cursor on; done directly here, on the
    // LAST unit specifically, to target exactly the "entering a VT table
    // backward" scenario this test is about, independent of
    // retreatToUnit's own fromIndex-1 bookkeeping. setUnitCursor first
    // (mounting VT4_11's own table) is required — focusFieldId alone
    // resolves a real cell id, but that cell's widget only exists once
    // ExcelSectionBody is actually showing this unit.
    ctrl.setUnitCursor(section.id, units.length - 1);
    ctrl.focusFieldId(units.last.fieldIds.first, preferFirst: false, scroll: false);
    await tester.pump();

    expect(ctrl.fm.activeId, isNot('VT4_11'));
    expect(ctrl.fm.activeId, isNotNull);
    expect(ctrl.fm.activeId, startsWith('s4q11_'));
    final node = ctrl.fm.getNode(ctrl.fm.activeId!);
    expect(node.context, isNotNull);

    await tester.pump(const Duration(seconds: 4));
  });

  testWidgets(
      'a `repeatingTable`-typed VT table (8.8, the roster) also resolves '
      'to a real cell, not the bare field id — repeatingTable fields '
      'never even reached the old TableCellEngine branch at all',
      (tester) async {
    final ctrl = await _pumpHarness(tester);
    final section8Idx =
        ctrl.schema!.sections.indexWhere((s) => s.id == 'section8_vocationalTraining');
    ctrl.goto(section8Idx, focus: false, scroll: false);
    final section = ctrl.schema!.sections[section8Idx];
    final units = buildTableGroupUnits(
      ctrl, section, const Locale('fr'),
      entityType: EntityType.vocationalTraining,
      simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
      mobile: false,
    );
    final rosterIdx = units.indexWhere((u) => u.fieldIds.contains('VT8_8'));
    expect(rosterIdx, greaterThan(0));

    jumpToUnit(ctrl, section, units, rosterIdx);
    await tester.pump();

    expect(ctrl.fm.activeId, isNot('VT8_8'));
    expect(ctrl.fm.activeId, isNotNull);
    final node = ctrl.fm.getNode(ctrl.fm.activeId!);
    expect(node.context, isNotNull);

    await tester.pump(const Duration(seconds: 4));
  });
}
