// Verifies Tickets A (row-tile label wrap) and D (radioCode caret) through
// the REAL rendering pipeline — real compiled VT AST, real
// buildTableGroupUnits, the same isVtTableTemplate-driven dispatch
// _buildField uses — not an isolated VtRowEditor pump (see
// vt_row_editor_screenshot_test.dart, which pumps VtTableDef objects
// directly and would not have caught the P0 routing bug or anything
// upstream of VtRowEditor).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_routing.dart';
import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_widgets.dart';
import 'package:dsmo_app/screens/onefop/onefop_section_units.dart';

Future<OnefopFormController> _vtController() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Widget _fieldsBuilder(OnefopFormController ctrl, List<FieldSchema> fields, int startRow) {
  return Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (final f in fields)
        if (isVtTableTemplate(f.tableSpec?['template'] as String?))
          VtTableFieldWidget(ctrl: ctrl, field: f)
        else
          Text('non-vt:${f.id}'),
    ],
  );
}

/// Pumps the real unit covering [fieldId] — same content() the live screen
/// mounts for that field once it's the active unit — at a 390×844 phone
/// viewport.
Future<void> _pumpLiveUnit(
  WidgetTester tester,
  OnefopFormController ctrl,
  String sectionId,
  String fieldId,
) async {
  const size = Size(390, 844);
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  const locale = Locale('fr');
  final section = ctrl.schema!.sections.firstWhere((s) => s.id == sectionId);
  final units = buildTableGroupUnits(
    ctrl,
    section,
    locale,
    entityType: ctrl.entityType,
    simpleFieldsBuilder: (fields, startRow) => _fieldsBuilder(ctrl, fields, startRow),
    mobile: true,
  );
  final unit = units.firstWhere((u) => u.fieldIds.contains(fieldId));

  await tester.pumpWidget(
    MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        body: SafeArea(
          child: SingleChildScrollView(padding: const EdgeInsets.all(12), child: unit.content()),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets(
      'live path — VT4_8 (4.8): "général" and "technique" rows both wrap to 2 lines '
      'at 390px instead of being ellipsized to an identical truncated prefix',
      (tester) async {
    final ctrl = await _vtController();
    addTearDown(ctrl.dispose);

    await _pumpLiveUnit(tester, ctrl, 'section4_vocationalTraining', 'VT4_8');

    const general = "Premier cycle de l'enseignement secondaire général";
    const technique = "Premier cycle de l'enseignement secondaire technique";
    const shortLabel = 'Non alphabétisé'; // same table, guaranteed single line

    final generalFinder = find.text(general);
    final techniqueFinder = find.text(technique);
    final shortFinder = find.text(shortLabel);
    expect(generalFinder, findsOneWidget);
    expect(techniqueFinder, findsOneWidget);
    expect(shortFinder, findsOneWidget);

    // Ticket A's actual change: the Text widget reached through the real
    // pipeline (not a hand-built one in a narrower unit test) carries
    // maxLines: 2.
    expect(tester.widget<Text>(generalFinder).maxLines, 2);
    expect(tester.widget<Text>(techniqueFinder).maxLines, 2);

    // Visual proof the wrap actually happens at this viewport, not just
    // that the widget is configured for it: the long labels render
    // meaningfully taller than a same-table label known to fit on one
    // line — i.e. two lines are actually laid out and painted, so
    // "général" and "technique" are each fully visible instead of both
    // being clipped to the same shared prefix.
    final shortHeight = tester.getSize(shortFinder).height;
    final generalHeight = tester.getSize(generalFinder).height;
    final techniqueHeight = tester.getSize(techniqueFinder).height;
    expect(generalHeight, greaterThan(shortHeight * 1.4));
    expect(techniqueHeight, greaterThan(shortHeight * 1.4));
  });

  testWidgets(
      'live path — VT8_8 (8.8) roster row sheet: radioCode cells show a real, '
      'always-visible Material caret (Icons.expand_more) in the token color',
      (tester) async {
    final ctrl = await _vtController();
    addTearDown(ctrl.dispose);

    await _pumpLiveUnit(tester, ctrl, 'section8_vocationalTraining', 'VT8_8');

    // Section 8 has no `subsection` on any field (see onefop_ast.dart),
    // so this unit bundles every section-8 VT table together (a separate,
    // already-flagged finding — see report) — several of them (8.4, 8.7,
    // 8.8) show the same "Ligne 1" placeholder for their own first empty
    // row. Scope to VT8_8's own VtTableFieldWidget specifically rather
    // than a bare text lookup, so this test targets the roster and not
    // whichever "Ligne 1" happens to come first.
    final rosterWidget = find.byWidgetPredicate(
        (w) => w is VtTableFieldWidget && w.field.id == 'VT8_8');
    expect(rosterWidget, findsOneWidget);
    final rosterRow1 = find.descendant(of: rosterWidget, matching: find.text('Ligne 1'));
    // VT8_8 now gets its own unit (VT-UI/UX-02's unit-boundary fix), so
    // this is normally already on-screen — ensureVisible is a harmless
    // no-op safety net, not a workaround for the old merged-unit scroll
    // depth.
    await tester.ensureVisible(rosterRow1);
    await tester.pumpAndSettle();
    await tester.tap(rosterRow1);
    await tester.pumpAndSettle();

    // 4 radioCode cells in the roster sheet: sex, trainerStatus,
    // academicDiploma, professionalDiploma.
    final caretFinder = find.byIcon(Icons.expand_more);
    expect(caretFinder, findsNWidgets(4));

    for (final element in caretFinder.evaluate()) {
      final icon = element.widget as Icon;
      expect(icon.color, kInkFaint);
      expect(icon.size, 20);
    }

    // The default DropdownButtonFormField arrow (arrow_drop_down) must NOT
    // also be present — Ticket D replaces it, not adds alongside it.
    expect(find.byIcon(Icons.arrow_drop_down), findsNothing);
  });
}
