// lib/screens/onefop/wizard/vt_wizard_progress.dart
// Shared per-section "N/M champs" estimate used by the sidebar and
// Validation screen. Deliberately simple: counts fields that currently
// have SOME non-empty value in ctrl.data against fields that are
// currently visible (dependsOn-aware, via the same isFieldVisible every
// other mode already uses). Table/repeatingTable fields store their
// answers under per-cell keys rather than ctrl.data[field.id] itself, so
// they're excluded from the count here and are instead reflected only by
// the authoritative ctrl.valid[section.id] flag (the real validator,
// unchanged, table-aware) — this estimate is a supplementary "how much is
// left" hint, not a second source of truth for whether a section is done.

import '../../../core/focus/schema/field_schema.dart';
import '../../../core/focus/schema/section_schema.dart';
import '../onefop_form_controller.dart';

class VtWizardSectionStats {
  final int filled;
  final int total;
  const VtWizardSectionStats(this.filled, this.total);
  double get fraction => total == 0 ? 0 : filled / total;
  int get percent => (fraction * 100).round();
}

/// Same "filled/total visible non-table fields" count as
/// [vtWizardSectionStats], but over an arbitrary field list rather than a
/// whole section — used to badge a single block (FieldGroup) in the
/// progressive-block wizard UI.
VtWizardSectionStats vtWizardGroupStats(
    OnefopFormController ctrl, List<FieldSchema> fields) {
  var filled = 0;
  var total = 0;
  for (final f in fields) {
    if (!ctrl.isFieldVisible(f)) continue;
    if (f.type == 'table' || f.type == 'repeating_table') continue;
    total++;
    final v = ctrl.data[f.id];
    final isEmpty = v == null ||
        (v is String && v.trim().isEmpty) ||
        (v is Iterable && v.isEmpty);
    if (!isEmpty) filled++;
  }
  return VtWizardSectionStats(filled, total);
}

VtWizardSectionStats vtWizardSectionStats(
    OnefopFormController ctrl, SectionSchema section) {
  final schema = ctrl.schema;
  if (schema == null) return const VtWizardSectionStats(0, 0);
  return vtWizardGroupStats(ctrl,
      section.fieldIds.map(schema.getField).whereType<FieldSchema>().toList());
}
