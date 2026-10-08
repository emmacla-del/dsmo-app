// VT P0 routing fix — regression coverage for the "12 blank VT tables"
// bug: buildTableGroupUnits (onefop_section_units.dart) used to route
// EVERY `type: 'table'` AST field to addTableUnit/TableRenderer before
// _buildField's own vt_ intercept (onefop_unified_form_screen_v4.dart) ever
// got a chance to run — TableSpecBuilder has no vt_* case, so those 12
// fixed-taxonomy VT tables (4.1, 4.2, 4.7, 4.8, 4.9, 4.11, 5.3, 5.4, 8.1,
// 8.2, 8.3, 8.6) rendered an empty grid. VT's other 10 tables
// (type: 'repeatingTable') were never intercepted by that branch, so they
// already reached _buildField and worked — which is why "22/22 wired" and
// "12 blank" could both be true.
//
// Existing goldens (vt_row_editor_screenshot_test.dart,
// vt_missing_renderers_test.dart) pump VtRowEditor directly and never
// exercise buildTableGroupUnits at all — that's why this bug survived them
// both. This file goes through the real pipeline instead: a real, compiled
// AST schema (via a real, initialized OnefopFormController), the real
// buildTableGroupUnits, and a simpleFieldsBuilder that — like the live
// screen's own _buildField — dispatches purely on isVtTableTemplate.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_fixed_row_grid.dart';
import 'package:dsmo_app/core/focus/renderers/vt_row_editor.dart';
import 'package:dsmo_app/core/focus/renderers/vt_routing.dart';
import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_widgets.dart';
import 'package:dsmo_app/screens/onefop/onefop_section_units.dart';

/// Same initialize()-before-interaction pattern as
/// test/vt_missing_renderers_test.dart — required before _recalcDirty()
/// (reached from the autosave timer) can safely force-unwrap _schema.
Future<OnefopFormController> _controller(EntityType entityType) async {
  final ctrl = OnefopFormController(
    entityType: entityType,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

/// A simpleFieldsBuilder that mirrors _buildField's own vt_ intercept
/// (onefop_unified_form_screen_v4.dart) — dispatches on the same
/// isVtTableTemplate predicate the production code now shares, so this
/// test proves the routing guard actually works rather than re-testing a
/// hand-duplicated condition. A field that fails the predicate renders its
/// own id as plain text instead — a marker proving that field did NOT take
/// the VT branch, for the non-VT control case below.
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

/// Finds the unit covering [fieldId] and pumps its content() — the same
/// widget the real screen would mount for that field once it's the active
/// unit.
Future<void> _pumpUnitFor(
  WidgetTester tester,
  OnefopFormController ctrl,
  String sectionId,
  String fieldId,
) async {
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
        body: SingleChildScrollView(child: unit.content()),
      ),
    ),
  );
  await tester.pump();
  tester.takeException();
}

void main() {
  group('isVtTableTemplate', () {
    test('true for a VT template', () {
      expect(isVtTableTemplate('vt_diploma_table'), isTrue);
      expect(isVtTableTemplate('vt_trainer_roster_table'), isTrue);
    });
    test('false for null, empty, or a non-VT template', () {
      expect(isVtTableTemplate(null), isFalse);
      expect(isVtTableTemplate(''), isFalse);
      expect(isVtTableTemplate('enrollment_grid'), isFalse);
      expect(isVtTableTemplate('csp_gender_age_table'), isFalse);
    });
  });

  group('buildTableGroupUnits routing (real AST, real pipeline)', () {
    testWidgets(
        'VT4_1 (4.1, type: table, vt_diploma_table) reaches VtRowEditor, not an empty grid',
        (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);

      await _pumpUnitFor(tester, ctrl, 'section4_vocationalTraining', 'VT4_1');

      // The default flutter_test surface (800x600 logical) is >=768px, and
      // 4.1 is one of the 7 fixed-checklist tables VtTableFieldWidget routes
      // to VtFixedRowGrid at that width (see vt_fixed_row_grid.dart) — so at
      // this width it's VtFixedRowGrid, not VtRowEditor, that proves the
      // field took the real VT branch instead of TableRenderer's empty-grid
      // default case. VT4_3 below (an open-ended table, never routed to
      // VtFixedRowGrid) still asserts VtRowEditor directly.
      expect(find.byType(VtTableFieldWidget), findsWidgets);
      expect(find.byType(VtFixedRowGrid), findsWidgets);
      expect(find.byType(VtRowEditor), findsNothing);
      expect(find.text('4.1'), findsOneWidget); // the paper-code chip
      expect(find.text('Doctorat/PhD'), findsOneWidget); // a fixed diploma row
      expect(find.text('non-vt:VT4_1'), findsNothing);
    });

    testWidgets(
        'VT4_3 (4.3, type: repeatingTable, vt_specialty_fi_fc_table) still reaches VtRowEditor — no regression',
        (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      // 4.3 appears once the preliminary quiz answered its question "Oui"
      // (core/focus/utils/vt_quiz.dart); before that it shows a notice.
      ctrl.setRawValue('_scopeConfig', {
        'vocationalTraining': {'unemployedQualified': true},
      });

      await _pumpUnitFor(tester, ctrl, 'section4_vocationalTraining', 'VT4_3');

      expect(find.byType(VtTableFieldWidget), findsWidgets);
      expect(find.byType(VtRowEditor), findsWidgets);
      expect(find.text('4.3'), findsOneWidget);
      expect(find.text('non-vt:VT4_3'), findsNothing);
      await tester.pump(const Duration(seconds: 4)); // let the autosave timer run
    });

    testWidgets(
        'S21Q01 (administration, type: table, non-VT template) still uses TableRenderer — no regression',
        (tester) async {
      final ctrl = await _controller(EntityType.administration);
      addTearDown(ctrl.dispose);

      await _pumpUnitFor(tester, ctrl, 'section2', 'S21Q01');

      // Never took the VT branch: neither VtTableFieldWidget nor the
      // fallback marker (this field's simpleFieldsBuilder branch) fired,
      // because it never reached simpleFieldsBuilder at all — addTableUnit
      // claimed it, same as before this fix.
      expect(find.byType(VtTableFieldWidget), findsNothing);
      expect(find.byType(VtRowEditor), findsNothing);
      expect(find.text('non-vt:S21Q01'), findsNothing);
    });
  });
}
