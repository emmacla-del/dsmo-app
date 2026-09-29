// lib/core/focus/renderers/vt_routing.dart
//
// Shared predicate deciding whether a field's tableSpec belongs to VT's
// own VtRowEditor renderer (vt_row_editor.dart) rather than
// TableRenderer/TableSpecBuilder's GenericSpreadsheetTable/MobileCardTable
// path. Every VT tableSpec template is prefixed `vt_` (vt_diploma_table,
// vt_trainer_roster_table, ...) — see vt_table_defs.dart's vtTableDefFor
// switch for the full list.
//
// Two call sites must agree on this test, or a VT table field can be
// intercepted by one and missed by the other:
//   - onefop_section_units.dart's buildTableGroupUnits, which decides
//     whether a `type: 'table'` field becomes its own TableRenderer unit
//     (addTableUnit) or falls through to simpleFieldsBuilder instead.
//   - onefop_unified_form_screen_v4.dart's _buildField, which is what
//     actually renders VtRowEditor once a field reaches it.
// Before this predicate existed, buildTableGroupUnits had no vt_ awareness
// at all: every `type: AstFieldType.table` VT field (4.1, 4.2, 4.7, 4.8,
// 4.9, 4.11, 5.3, 5.4, 8.1, 8.2, 8.3, 8.6 — the ones with fixed-taxonomy
// rows, correctly modelled as `table` rather than `repeatingTable`) was
// claimed by addTableUnit/TableRenderer before _buildField's own vt_
// intercept ever ran, and TableSpecBuilder has no `vt_*` case, so those
// fields rendered an empty GridRenderSpec — blank on screen. VT's other 10
// tables are `type: AstFieldType.repeatingTable`, a type
// buildTableGroupUnits never intercepted, so they already reached
// _buildField and worked.
bool isVtTableTemplate(String? template) =>
    template != null && template.startsWith('vt_');
