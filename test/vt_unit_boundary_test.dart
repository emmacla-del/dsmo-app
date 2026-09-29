// VT-UI/UX-02 P0 — unit-boundary regression coverage.
//
// Section 4 and Section 8 carry no `subsection` on any field
// (onefop_ast.dart), so before this fix nothing broke a run of VT tables
// apart inside buildTableGroupUnits: every VT table (type: table, caught by
// the isVtTableTemplate guard; and type: repeatingTable, which never took
// the addTableUnit branch to begin with) fell straight into pendingSimple
// and merged into one giant unit together — e.g. VT8_8's roster ending up
// ~3250px down the same continuous scroll as VT8_1 through VT8_7.
//
// This exercises the real, unmodified buildTableGroupUnits against the
// real compiled VT and administration AST schemas — no isolated
// VtRowEditor pump, no hand-built FieldSchema/SectionSchema stand-ins.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_routing.dart';
import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_section_units.dart';

Future<OnefopFormController> _controller(EntityType entityType) async {
  final ctrl = OnefopFormController(
    entityType: entityType,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

/// Throwaway builder — this file only inspects unit structure
/// (fieldIds/count), never mounts content(), same "throwaway" convention
/// already used by _SidebarPageItem/navigateToSection in
/// onefop_section_units.dart itself.
Widget _throwawayBuilder(List<FieldSchema> fields, int startRow) => const SizedBox.shrink();

List<SectionUnit> _unitsFor(OnefopFormController ctrl, String sectionId) {
  const locale = Locale('fr');
  final section = ctrl.schema!.sections.firstWhere((s) => s.id == sectionId);
  return buildTableGroupUnits(
    ctrl,
    section,
    locale,
    entityType: ctrl.entityType,
    simpleFieldsBuilder: _throwawayBuilder,
    mobile: true,
  );
}

/// Number of VT-table fieldIds (isVtTableTemplate == true) present in [u].
int _vtTableFieldCount(OnefopFormController ctrl, SectionUnit u) => u.fieldIds
    .map((id) => ctrl.schema!.getField(id))
    .whereType<FieldSchema>()
    .where((f) => isVtTableTemplate(f.tableSpec?['template'] as String?))
    .length;

SectionUnit _unitContaining(List<SectionUnit> units, String fieldId) =>
    units.firstWhere((u) => u.fieldIds.contains(fieldId));

void main() {
  group('Section 4 (section4_vocationalTraining)', () {
    testWidgets('every VT table field gets its own unit — none merged', (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      final units = _unitsFor(ctrl, 'section4_vocationalTraining');

      // No unit — VT-table-boundary or otherwise — ever bundles more than
      // one VT table together.
      for (final u in units) {
        expect(_vtTableFieldCount(ctrl, u), lessThanOrEqualTo(1),
            reason: 'unit ${u.key} (${u.fieldIds}) contains more than one VT table');
      }

      // Every VT table field declared in this section actually got a unit
      // of its own — none silently dropped, none silently absorbed into a
      // neighbour's unit.
      final section =
          ctrl.schema!.sections.firstWhere((s) => s.id == 'section4_vocationalTraining');
      final vtTableFieldIds = section.fieldIds.where((id) {
        final f = ctrl.schema!.getField(id);
        return f != null && isVtTableTemplate(f.tableSpec?['template'] as String?);
      }).toList();
      expect(vtTableFieldIds, isNotEmpty);
      for (final id in vtTableFieldIds) {
        final unit = _unitContaining(units, id);
        expect(_vtTableFieldCount(ctrl, unit), 1);
      }

      // VT4_1 and VT4_8 specifically land in two different units.
      expect(_unitContaining(units, 'VT4_1').key, isNot(_unitContaining(units, 'VT4_8').key));
    });
  });

  group('Section 8 (section8_vocationalTraining)', () {
    testWidgets('every VT table field gets its own unit — VT8_8 no longer ~3250px down VT8_1',
        (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      final units = _unitsFor(ctrl, 'section8_vocationalTraining');

      for (final u in units) {
        expect(_vtTableFieldCount(ctrl, u), lessThanOrEqualTo(1),
            reason: 'unit ${u.key} (${u.fieldIds}) contains more than one VT table');
      }

      final section =
          ctrl.schema!.sections.firstWhere((s) => s.id == 'section8_vocationalTraining');
      final vtTableFieldIds = section.fieldIds.where((id) {
        final f = ctrl.schema!.getField(id);
        return f != null && isVtTableTemplate(f.tableSpec?['template'] as String?);
      }).toList();
      // VT8_1..VT8_4, VT8_6, VT8_7, VT8_8 — 7 VT tables in this section
      // (VT8_5_* are plain embedded number questions, not tables).
      expect(vtTableFieldIds.length, 7);
      for (final id in vtTableFieldIds) {
        final unit = _unitContaining(units, id);
        expect(_vtTableFieldCount(ctrl, unit), 1);
      }

      // VT8_1 (first table in the section) and VT8_8 (the roster, the
      // concrete symptom reported) are two different units — VT8_8 is
      // reachable as its own navigation step, not scrolled-past content
      // buried under six other tables.
      final vt81Unit = _unitContaining(units, 'VT8_1');
      final vt88Unit = _unitContaining(units, 'VT8_8');
      expect(vt81Unit.key, isNot(vt88Unit.key));
      // And it's the very next VT unit after VT8_1..VT8_7 — not merged
      // anywhere in between either.
      final vt88Index = units.indexOf(vt88Unit);
      final vt81Index = units.indexOf(vt81Unit);
      expect(vt88Index, greaterThan(vt81Index));
    });
  });

  group('Non-VT control (administration / section2)', () {
    testWidgets('S21Q01 groups exactly as before — solo table unit, no VT-boundary effect',
        (tester) async {
      final ctrl = await _controller(EntityType.administration);
      addTearDown(ctrl.dispose);
      final units = _unitsFor(ctrl, 'section2');

      final unit = _unitContaining(units, 'S21Q01');
      // Same addTableUnit shape as always — S21Q01 plus its own
      // TableResponseStatus attached field, nothing VT-related.
      expect(unit.fieldIds, ['S21Q01', 'S21Q01_RESPONSE_STATUS']);
      // Never routed through the new VT-only branch — isVtTableTemplate is
      // false for this field's (non-VT) template.
      expect(_vtTableFieldCount(ctrl, unit), 0);
    });
  });
}
