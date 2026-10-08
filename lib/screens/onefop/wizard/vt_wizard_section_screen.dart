// lib/screens/onefop/wizard/vt_wizard_section_screen.dart
// One VT AST section's fields, rendered inside a single Figma-styled card.
//
// Plain fields (text/number/tel/email/radio/checkbox/select) render via
// vtWizardBuildField (vt_wizard_fields.dart) — custom widgets pixel-matched
// against the real Figma design context, reading/writing through the same
// OnefopFormController primitives (ctrl.setRadioValue,
// ctrl.setCheckboxValues, ctrl.onSelectChanged, ctrl.ctrl[id]) every other
// mode's field widgets already use.
//
// Table fields: the updated Figma file (re-read 2026-09-06) shows every
// table-bearing section twice — once as "Mode Guidé" (08a/09a/13a/15a) and
// once as "Mode Tableur" (08b/09b/13b/15b) — switched by a segmented
// control confirmed in the app header on those frames. _VtWizardModeToggle
// below reproduces that control (placed at the top of the section body,
// not the shared OnefopShellTitleBar, to keep this VT-wizard-only — see
// vt_wizard_shell.dart's own note on reusing that title bar as-is).
// "Mode Tableur" always renders VtWizardSpreadsheetGrid
// (vt_wizard_spreadsheet_grid.dart) — a wizard-only grid pixel-matched
// against Figma's own "excel-grid" node (row-number column, zebra-striped
// rows, a per-row completion checkmark, a Σ TOTAL footer), NOT the shared
// VtSpreadsheetTable Excel Mode uses — that widget deliberately matches
// classic Excel Mode's own look instead (see grid_theme.dart: "no header
// shading, no row stripes... matching the reference Excel forms exactly"),
// so reusing it here would either mean changing Excel Mode's look or
// showing something that doesn't actually match Figma. "Mode Guidé"
// renders the pixel-matched guided-entry widgets
// (vt_wizard_table_guided_entry.dart) where a shape is supported, and
// falls back to the same VtWizardSpreadsheetGrid otherwise — the only
// remaining table shape with no Guidé design is §7.1.3's folded group
// (see below), so the always-available grid stays as the fallback there.
//
// The folded VT7.1.3 group (VT7_7-11) is the one exception to the table
// dispatch above: it has no tableSpec/template at all (Spreadsheet/Simple
// Mode's shared buildField folds those 5 plain AST checkbox fields into
// one VtRowEditor itself), so _vtWizardTableField's template lookup would
// never see it either way. The wizard now special-cases these 5 field
// ids directly in _vtWizardFieldRows (matching Figma's own new card, node
// 11:2206) rather than falling through to that shared VtRowEditor, which
// doesn't carry the wizard's own visual language at all.
//
// Layout: an earlier pass paired most simple/select/radio/toggle fields
// two-per-row, matching Figma's own "form-row" pairing (nodes 11:228/
// 11:677). Reverted to one full-width row per field, deliberately
// diverging from Figma here: two adjacent Oui/Non toggles read as
// visually dense/crowded and raised real misclick risk between them —
// and Wizard mode's whole reason to exist alongside the app's "Feuille
// de calcul" (Spreadsheet) mode is being the low-density, guided option,
// so favoring scanability over Figma's tighter packing is the right call
// for this mode specifically (Spreadsheet mode is untouched).

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/i18n/l10n_ext.dart';
import 'vt_scope_quiz.dart';
import '../../../core/i18n/localized_text.dart';
import '../../../core/focus/renderers/vt_table_defs.dart'
    show vtTableDefFor, vt713CommsInformedTableDef;
import '../../../core/focus/renderers/vt_table_types.dart';
import '../../../core/focus/schema/field_schema.dart';
import '../../../core/focus/schema/section_schema.dart';
import '../onefop_form_constants.dart' show kSidebarMeta, kAccent;
import '../onefop_form_controller.dart';
import '../onefop_form_widgets.dart' show groupFields, FieldGroup;
import 'vt_wizard_constants.dart';
import 'vt_wizard_fields.dart';
import 'vt_wizard_progress.dart' show vtWizardGroupStats;
import 'vt_wizard_spreadsheet_grid.dart' show VtWizardSpreadsheetGrid;
import 'vt_wizard_table_guided_entry.dart';

const _kVt713FoldedIds = {'VT7_7', 'VT7_8', 'VT7_9', 'VT7_10', 'VT7_11'};

bool _isVtWizardSimpleField(FieldSchema f) =>
    f.tableSpec == null &&
    f.type != 'table' &&
    f.type != 'repeating_table' &&
    !_kVt713FoldedIds.contains(f.id);

/// True when at least one of a section's fields is a real table (has a
/// tableSpec/template) — the Guidé/Tableur toggle only makes sense (and
/// only appears) on sections that actually contain a table, matching
/// Figma: 03/04/05/07/10/11/12 (no tables) show no such control at all.
bool _vtWizardSectionHasTable(List<FieldSchema> fields) =>
    fields.any((f) => (f.tableSpec?['template'] as String?) != null);

/// Resolves a table field's [VtTableDef], honoring [tableauMode]:
/// "Tableur" always shows VtWizardSpreadsheetGrid's real grid; "Guidé"
/// shows the pixel-matched guided-entry widget when the shape supports one
/// (vt_wizard_table_guided_entry.dart's own predicate), else the same
/// grid — see this file's header comment for why that fallback is
/// deliberate, not a gap.
Widget _vtWizardTableField(OnefopFormController ctrl, FieldSchema f,
        Widget Function(FieldSchema) buildField, bool tableauMode) =>
    // The preliminary quiz decides whether the table applies.
    VtTableQuizGate(
      ctrl: ctrl,
      field: f,
      child: _vtWizardTableBody(ctrl, f, buildField, tableauMode),
    );

Widget _vtWizardTableBody(OnefopFormController ctrl, FieldSchema f,
    Widget Function(FieldSchema) buildField, bool tableauMode) {
  final spec = f.tableSpec;
  final template = spec?['template'] as String?;
  if (template == null) return buildField(f);
  final def = vtTableDefFor(template, spec!);
  if (def == null) return buildField(f);
  if (!tableauMode && vtWizardSupportsGuidedEntry(def)) {
    if (def.isRoster) return VtWizardRosterGuidedEntry(ctrl: ctrl, def: def);
    if (!def.progressiveRows) {
      final numberCellCount =
          def.cells.where((c) => c.kind == VtCellKind.number).length;
      return numberCellCount > 2
          ? VtWizardFixedRowMultiNumberEntry(ctrl: ctrl, def: def)
          : VtWizardGuidedTableEntry(ctrl: ctrl, def: def);
    }
    final isBoolean = def.cells.length >= 2 &&
        def.cells.skip(1).every((c) => c.kind == VtCellKind.boolean);
    return isBoolean
        ? VtWizardProgressiveBooleanTableEntry(ctrl: ctrl, def: def)
        : VtWizardProgressiveGuidedTableEntry(ctrl: ctrl, def: def);
  }
  return _VtWizardTableauCard(ctrl: ctrl, def: def);
}

/// "Mode Tableur" wrapper — the table's own paperCode+title (guided entry
/// prints this itself; VtWizardSpreadsheetGrid's own caption line takes
/// care of the "N/M filled in" progress text but not a title) above the
/// grid, matching Figma's "guided-entry-card"/"excel-grid" nodes (e.g.
/// 79:128/82:753 on the Section 4 Tableur screen). The grid draws its own
/// border/radius (matching the excel-grid frame's own border in Figma),
/// so no extra wrapping card sits around it here.
class _VtWizardTableauCard extends StatelessWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const _VtWizardTableauCard({required this.ctrl, required this.def});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        VtWizardGuidedHeaderBox(
          title: def.paperCode != null
              ? LocalizedText(
                  fr: '${def.paperCode}  ${def.title.fr}',
                  // Was missing the paperCode prefix on the EN side —
                  // only surfaced once the wizard stopped always showing
                  // the FR string regardless of locale.
                  en: '${def.paperCode}  ${def.title.en}',
                )
              : def.title,
        ),
        const SizedBox(height: 16),
        VtWizardSpreadsheetGrid(ctrl: ctrl, def: def),
      ],
    );
  }
}

/// Figma's "Mode Guidé / Mode Tableur" segmented control (nodes 82:1296
/// on the Section 4/8 Tableur screens, 74:358/77:137 inline on the
/// guided cards themselves) — a light-accent-tinted pill container with
/// two selectable segments, active one filled solid accent/white text.
class _VtWizardModeToggle extends StatelessWidget {
  final bool tableauMode;
  final ValueChanged<bool> onChanged;
  const _VtWizardModeToggle(
      {required this.tableauMode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: kVtWizardAccentSoft,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _segment(
            label: const LocalizedText(fr: 'Mode Guidé', en: 'Guided Mode')
                .of(locale),
            active: !tableauMode,
            onTap: () => onChanged(false),
          ),
          _segment(
            label:
                const LocalizedText(fr: 'Mode Tableur', en: 'Spreadsheet Mode')
                    .of(locale),
            active: tableauMode,
            onTap: () => onChanged(true),
          ),
        ],
      ),
    );
  }

  Widget _segment(
      {required String label,
      required bool active,
      required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: active ? kAccent : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              fontSize: 12,
              color: active ? Colors.white : kVtWizardInkSoft),
        ),
      ),
    );
  }
}

/// Suivi Post-Formation (section 6) and Thèmes Transversaux (section 7)
/// are the two screens where Figma consistently draws every toggle/
/// checkbox at a smaller size (44x24 pill, 18px checkbox vs. the
/// standard 64x32/20px everywhere else — confirmed via
/// get_design_context against nodes 11:1992 and 11:2206) — see
/// VtWizardCheckboxGroup's own [compact] doc comments.
const _kVtCompactToggleSectionIds = {
  'section6_vocationalTraining',
  'section7_vocationalTraining',
};

Widget _vtWizardFieldWidget(OnefopFormController ctrl, FieldSchema f,
    Widget Function(FieldSchema) buildField, bool compact, bool tableauMode) {
  return _isVtWizardSimpleField(f)
      ? vtWizardBuildField(ctrl, f, compact: compact)
      : _vtWizardTableField(ctrl, f, buildField, tableauMode);
}

/// True when [g] is a number field gated on [f] being Oui — VT5_1/VT5_2
/// and VT5_3/VT5_4's own shape (radio Oui/Non, then a `dependsOn`/
/// `dependsValue: "Oui/ Yes"` number field asking "how many"). Figma
/// (node 66:589) renders this pair as ONE row — the toggle's own label,
/// then an inline "Nombre: [box]" ahead of the pill, not two separate
/// field widgets — see _vtWizardToggleWithCount below.
bool _isToggleWithDependentCount(FieldSchema f, FieldSchema g) =>
    vtWizardIsYesNoField(f) &&
    g.type == 'number' &&
    g.dependsOn == f.id &&
    g.dependsValue == 'Oui/ Yes';

/// The "Nombre: [box]" inline count Figma pairs with a handful of
/// toggles — same shared ctrl.ctrl[id] controller every other wizard
/// number field uses, just a compact ~80px box instead of the full
/// VtWizardNumberStepperField (no +/- buttons: Figma shows a plain
/// editable box here, not a stepper).
Widget _vtWizardInlineCountBox(
    OnefopFormController ctrl, FieldSchema field, Locale locale) {
  return Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        const LocalizedText(fr: 'Nombre :', en: 'Number:').of(locale),
        style: const TextStyle(
            fontFamily: kVtWizardFontFamily,
            fontWeight: FontWeight.w600,
            fontSize: 13,
            color: kVtWizardInkSoft),
      ),
      const SizedBox(width: 8),
      Container(
        width: 84,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: kVtWizardCardBorder),
          borderRadius: BorderRadius.circular(8),
        ),
        child: TextField(
          controller: ctrl.ctrl[field.id],
          focusNode: ctrl.fm.getNode(field.id),
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: const TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: kVtWizardInk),
          decoration: const InputDecoration(
            isDense: true,
            border: InputBorder.none,
            contentPadding: EdgeInsets.zero,
          ),
          onTapOutside: (_) => ctrl.onBlur(field.id),
          onSubmitted: (_) => ctrl.onBlur(field.id),
        ),
      ),
    ],
  );
}

/// Fields whose `dependsOn` points at [trigger] — the real AST relationship
/// behind Figma's now-consistent "conditional reveal" pattern (e.g. node
/// 11:1178's "Types de chocs" panel under 3.1, the reference example the
/// whole file was audited against for this). [allFields] has already been
/// filtered to only-currently-visible fields by the caller
/// (VtWizardSectionScreen.build's `.where(ctrl.isFieldVisible)`), so an
/// empty result here means either [trigger] genuinely has no dependents,
/// or its dependents' condition isn't currently satisfied — no separate
/// visibility check is needed on top of this.
List<FieldSchema> _vtWizardDirectDependents(
        FieldSchema trigger, List<FieldSchema> allFields) =>
    allFields.where((g) => g.dependsOn == trigger.id).toList();

/// Recursively flattens a trigger's whole dependent subtree (a dependent's
/// own dependents, e.g. 3.1 → "Fermeture temporaire" (VT3_3) → "Durée de
/// fermeture" (VT3_4)) into one flat list, in AST order. Figma keeps a
/// whole chain like this inside ONE bordered container rather than nesting
/// a box within a box, so this file matches that rather than recursing
/// into nested _VtWizardConditionalContainers.
List<FieldSchema> _vtWizardDependentSubtree(
    FieldSchema trigger, List<FieldSchema> allFields) {
  final result = <FieldSchema>[];
  for (final d in _vtWizardDirectDependents(trigger, allFields)) {
    result.add(d);
    result.addAll(_vtWizardDependentSubtree(d, allFields));
  }
  return result;
}

/// Bordered/tinted "conditional reveal" box — Figma's own reference
/// pattern (node 11:1178, "Types de chocs" under 3.1: a light‑green‑tinted
/// card with a green border and rounded corners, clearly set apart from
/// the plain top‑level questions around it) confirmed via get_screenshot,
/// then found repeated (once code‑aligned) across 3.1's own closure/
/// relocation follow‑ups and 7.1's HIV‑rules sub‑questions — this used to
/// be the ONE properly‑designed conditional reveal in the whole file, with
/// every other section's conditional fields flowing inline with no visual
/// distinction from a top‑level question. Generic and content‑agnostic:
/// wraps whatever field widgets _vtWizardFieldRows gives it.
class _VtWizardConditionalContainer extends StatefulWidget {
  final List<Widget> children;
  const _VtWizardConditionalContainer({required this.children});

  @override
  State<_VtWizardConditionalContainer> createState() =>
      _VtWizardConditionalContainerState();
}

/// This widget is freshly constructed (a new State, so a fresh
/// `initState`) exactly when its trigger's `dependsOn` condition first
/// becomes true — `_vtWizardFieldRows` only puts it in the tree at all
/// once `_vtWizardDependentSubtree` is non-empty, and removes it outright
/// the moment the condition stops holding. That gives `initState` a clean
/// one-shot hook for an entrance animation: start collapsed/transparent,
/// then flip to revealed on the next frame so AnimatedSize/AnimatedOpacity
/// have a "from" state to interpolate away from. No exit animation — the
/// widget is simply removed from the tree when the condition goes false,
/// same as before; only the reveal is animated.
class _VtWizardConditionalContainerState
    extends State<_VtWizardConditionalContainer> {
  bool _revealed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _revealed = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
      alignment: Alignment.topCenter,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
        opacity: _revealed ? 1 : 0,
        child: !_revealed
            ? const SizedBox(width: double.infinity)
            : Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFFEDF7F2),
                  border: Border.all(color: const Color(0xFFBFE0D1)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: widget.children,
                ),
              ),
      ),
    );
  }
}

/// Sections whose short-pairable rows (see _isVtWizardShortPairableField)
/// batch into 3-wide rows instead of the usual 2. Identification is
/// Figma's own reference (node 6:4035) for a dense 3-column grid of text/
/// number fields (structure code/name/sigle, région/département/
/// arrondissement, ...). Informations Générales earns the same bump on
/// composition alone (no Figma reference needed): its own §2.1 has two
/// runs of 3-4 consecutive short-pairable fields — VT2_11 (text)/VT2_12
/// (email)/VT2_13 (text), and VT2_19-22, four consecutive trainee/trainer
/// headcount numbers — that a 2-column cap leaves as an awkward pair-plus-
/// leftover-single; §2.2's own ~20 equipment questions are almost
/// entirely radio/checkbox (full-width regardless of column count) with
/// their few number fields already pulled out into a conditional
/// container by _vtWizardDependentSubtree, so raising this section's
/// column count doesn't touch §2.2 at all. Every other section keeps the
/// 2-column pairing this file's header comment already explains the
/// reasoning for — they're dominated by toggles/checkboxes/tables a
/// column count can't affect, or only ever have isolated short fields
/// with nothing to batch alongside.
int _vtWizardRowColumnsFor(String sectionId) => const {
      'section1_vocationalTraining',
      'section2_vocationalTraining',
    }.contains(sectionId)
        ? 3
        : 2;

/// Greedily batches up to [columns] consecutive compact fields into one
/// row, matching Figma's own row grouping closely enough without
/// hand-listing rows per screen — see this file's header comment for the
/// tradeoff. Pairing never crosses a subsection boundary —
/// _vtWizardGroupedRows below calls this once per FieldGroup, never on
/// the whole field list.
/// Pairs consecutive short-pairable fields (text/number/email/tel/select —
/// see _isVtWizardShortPairableField) into two-wide rows, leaving every
/// other field type full-width. Used only for a conditional-reveal
/// trigger's own dependent subtree (_VtWizardConditionalContainer's
/// children below) — e.g. VT2_7/VT2_8 ("Nombre de formateurs formés" Total/
/// dont femmes, both gated on VT2_6), which Figma (node 6:4431) shows as
/// one inline pair rather than two stacked full-width number fields.
/// Deliberately NOT a call into the full _vtWizardFieldRows: that function
/// also detects and wraps a field's OWN dependents in a further
/// conditional box, and Figma keeps a whole dependent chain flat inside
/// ONE bordered container rather than nesting a box within a box (see
/// _vtWizardDependentSubtree's own doc comment) — this batcher only ever
/// decides row width, never wraps anything in a new box.
List<Widget> _vtWizardBatchDependentRows(
    List<FieldSchema> fields,
    OnefopFormController ctrl,
    Widget Function(FieldSchema) buildField,
    bool compact,
    bool tableauMode) {
  const columns = 2;
  final rows = <Widget>[];
  var i = 0;
  while (i < fields.length) {
    final f = fields[i];
    if (!_isVtWizardShortPairableField(f)) {
      rows.add(_vtWizardFieldWidget(ctrl, f, buildField, compact, tableauMode));
      i += 1;
      continue;
    }
    final batch = [f];
    while (batch.length < columns &&
        i + batch.length < fields.length &&
        _isVtWizardShortPairableField(fields[i + batch.length])) {
      batch.add(fields[i + batch.length]);
    }
    if (batch.length == 1) {
      rows.add(_vtWizardFieldWidget(ctrl, f, buildField, compact, tableauMode));
      i += 1;
      continue;
    }
    rows.add(LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 784) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = 0; j < batch.length; j++) ...[
                _vtWizardFieldWidget(
                    ctrl, batch[j], buildField, compact, tableauMode),
                if (j != batch.length - 1) const SizedBox(height: 12),
              ],
            ],
          );
        }
        const gap = 16.0;
        final fieldWidth =
            (constraints.maxWidth - gap * (batch.length - 1)) / batch.length;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var j = 0; j < batch.length; j++) ...[
              SizedBox(
                width: fieldWidth,
                child: _vtWizardFieldWidget(
                    ctrl, batch[j], buildField, compact, tableauMode),
              ),
              if (j != batch.length - 1) const SizedBox(width: gap),
            ],
          ],
        );
      },
    ));
    i += batch.length;
  }
  return rows;
}

List<Widget> _vtWizardFieldRows(
    List<FieldSchema> fields,
    OnefopFormController ctrl,
    Widget Function(FieldSchema) buildField,
    bool compact,
    bool tableauMode,
    Locale locale,
    {int columns = 2}) {
  final rows = <Widget>[];
  final consumed = <String>{};
  var i = 0;
  while (i < fields.length) {
    final f = fields[i];
    if (consumed.contains(f.id)) {
      i += 1;
      continue;
    }
    if (f.id == 'VT7_7') {
      rows.add(VtWizardStakeholderInformedCard(
          ctrl: ctrl, def: vt713CommsInformedTableDef));
      i += 5; // VT7_7..VT7_11 fold into this one card — see _kVt713FoldedIds
      continue;
    }
    // Guards against a trigger with a SECOND dependent right behind the
    // first (VT2_6 -> VT2_7 "Total" AND VT2_8 "dont femmes", both number,
    // both dependsOn: VT2_6) — the compact "Nombre : [box]" inline pattern
    // below only fits a trigger with exactly one number dependent (VT5_1/
    // VT5_2, VT5_3/VT5_4's own shape); with two, it would render the
    // first inline and strand the second as its own orphaned full-width
    // row. Falling through instead routes both into the generic
    // dependent-subtree/_VtWizardConditionalContainer path below, which
    // pairs same-trigger short fields (_vtWizardBatchDependentRows) —
    // matching Figma's "Nombre de formateurs formés (Total / Femmes)"
    // inline pair (node 6:4431) instead of stranding "dont femmes" alone.
    if (i + 1 < fields.length &&
        _isToggleWithDependentCount(f, fields[i + 1]) &&
        !(i + 2 < fields.length && fields[i + 2].dependsOn == f.id)) {
      final numberField = fields[i + 1];
      rows.add(vtWizardFocusable(
        ctrl,
        f,
        VtWizardRadioGroup(
          ctrl: ctrl,
          field: f,
          inlineExtra: ctrl.isFieldVisible(numberField)
              ? _vtWizardInlineCountBox(ctrl, numberField, locale)
              : null,
        ),
      ));
      i += 2;
      continue;
    }
    final dependentSubtree = _vtWizardDependentSubtree(f, fields);
    if (dependentSubtree.isNotEmpty) {
      consumed.addAll(dependentSubtree.map((d) => d.id));
      rows.add(_vtWizardFieldWidget(ctrl, f, buildField, compact, tableauMode));
      rows.add(const SizedBox(height: 12));
      final dependentRows = _vtWizardBatchDependentRows(
          dependentSubtree, ctrl, buildField, compact, tableauMode);
      rows.add(_VtWizardConditionalContainer(
        children: [
          for (var j = 0; j < dependentRows.length; j++) ...[
            dependentRows[j],
            if (j != dependentRows.length - 1) const SizedBox(height: 12),
          ],
        ],
      ));
      i += 1;
      continue;
    }
    // Toggles/radios/checkboxes/textareas/dropdowns stay one full-width
    // question per row — pairing those side by side is what read as
    // dense/crowded and raised real misclick risk on adjacent Oui/Non
    // toggles. Plain text/number fields are different: they're already
    // width-capped (VtWizardTextField/VtWizardNumberStepperField), so a
    // lone one on its own row just wastes horizontal space — batching
    // several into one row keeps each one short while using the row
    // better, with none of the toggle-misclick risk.
    if (_isVtWizardShortPairableField(f)) {
      final batch = [f];
      while (batch.length < columns &&
          i + batch.length < fields.length &&
          _isVtWizardShortPairableField(fields[i + batch.length])) {
        batch.add(fields[i + batch.length]);
      }
      if (batch.length == 1) {
        rows.add(
            _vtWizardFieldWidget(ctrl, f, buildField, compact, tableauMode));
        i += 1;
        continue;
      }
      // Each field needs a bounded width here, not just its input box —
      // placed directly in a Row with no Expanded/SizedBox, the label
      // above it (which wraps via Flexible) gets unbounded constraints
      // and renders on one very long line instead, overflowing the row.
      rows.add(LayoutBuilder(
        builder: (context, constraints) {
          // A batch should never force a narrow workspace wider. This also
          // keeps an individual section usable when browser zoom, a short
          // laptop viewport, or a translated label reduces available width.
          if (constraints.maxWidth < 784) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var j = 0; j < batch.length; j++) ...[
                  _vtWizardFieldWidget(
                      ctrl, batch[j], buildField, compact, tableauMode),
                  if (j != batch.length - 1) const SizedBox(height: 20),
                ],
              ],
            );
          }
          // A partial batch (fewer members than [columns], e.g. the last
          // row of an odd-sized run) still splits evenly across its own
          // members' count rather than the full column width, so it never
          // leaves a dangling empty slot.
          const gap = 24.0;
          final fieldWidth =
              (constraints.maxWidth - gap * (batch.length - 1)) / batch.length;
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var j = 0; j < batch.length; j++) ...[
                SizedBox(
                  width: fieldWidth,
                  child: _vtWizardFieldWidget(
                      ctrl, batch[j], buildField, compact, tableauMode),
                ),
                if (j != batch.length - 1) const SizedBox(width: gap),
              ],
            ],
          );
        },
      ));
      i += batch.length;
      continue;
    }
    rows.add(_vtWizardFieldWidget(ctrl, f, buildField, compact, tableauMode));
    i += 1;
  }
  return rows;
}

/// Places [children] in one explicit N-wide row at desktop width,
/// stacking to a single column below 784px (same breakpoint
/// _vtWizardFieldRows itself uses). Unlike that function's type-based
/// batching — which discovers adjacent short-pairable fields by scanning
/// — every child here is placed by explicit intent: a specific Figma row
/// (node 6:4035's §1.1/§1.2 grids) that mixes field types Figma still
/// shows side by side (e.g. Milieu d'implantation, a radio, sitting next
/// to Commune/Village) regardless of _isVtWizardShortPairableField's own
/// type-based rule. [flexes] gives each child a relative share of the
/// row width (defaults to an even split) — used for §1.2's Ordre
/// d'enseignement/Année d'ouverture row, which Figma sizes unevenly.
Widget _vtWizardFixedRow(List<Widget> children, {List<int>? flexes}) {
  assert(flexes == null || flexes.length == children.length);
  return LayoutBuilder(
    builder: (context, constraints) {
      if (constraints.maxWidth < 784) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < children.length; i++) ...[
              children[i],
              if (i != children.length - 1) const SizedBox(height: 20),
            ],
          ],
        );
      }
      const gap = 24.0;
      final effectiveFlexes = flexes ?? List.filled(children.length, 1);
      final totalFlex = effectiveFlexes.fold<int>(0, (a, b) => a + b);
      final unit =
          (constraints.maxWidth - gap * (children.length - 1)) / totalFlex;
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            SizedBox(width: unit * effectiveFlexes[i], child: children[i]),
            if (i != children.length - 1) const SizedBox(width: gap),
          ],
        ],
      );
    },
  );
}

/// §1.1's exact Figma rows (node 6:4035): Code/Nom/Sigle, then
/// Région/Département/Arrondissement, then Commune/Village/Milieu
/// d'implantation — three fixed 3-wide rows regardless of each field's
/// own AST type (Milieu is a radio, everything else here is text), which
/// is exactly why this bypasses _vtWizardFieldRows's type-based batching.
List<Widget> _vtWizardIdentificationLocalisationRows(
    List<FieldSchema> fields, OnefopFormController ctrl, bool compact) {
  final byId = {for (final f in fields) f.id: f};
  Widget field(String id) {
    final f = byId[id];
    return f == null
        ? const SizedBox.shrink()
        : vtWizardBuildField(ctrl, f, compact: compact);
  }

  return [
    _vtWizardFixedRow([field('VT1_1'), field('VT1_2'), field('VT1_3')]),
    const SizedBox(height: 20),
    _vtWizardFixedRow([field('VT1_4'), field('VT1_5'), field('VT1_6')]),
    const SizedBox(height: 20),
    _vtWizardFixedRow([field('VT1_7'), field('VT1_8'), field('VT1_9')]),
  ];
}

/// §1.2's exact Figma row: Ordre d'enseignement (a wide 3-option
/// segmented control) beside Année d'ouverture (a narrow year box), then
/// Type de CFP's checkbox/radio block full-width below — VT1_14 is
/// wizard-reordered next to VT1_10/11 for exactly this row (see
/// _vtWizardVisualFieldOrder) even though it sits later in the AST's own
/// field order.
List<Widget> _vtWizardIdentificationEnseignementRows(
    List<FieldSchema> fields, OnefopFormController ctrl, bool compact) {
  final byId = {for (final f in fields) f.id: f};
  Widget field(String id) {
    final f = byId[id];
    return f == null
        ? const SizedBox.shrink()
        : vtWizardBuildField(ctrl, f, compact: compact);
  }

  return [
    _vtWizardFixedRow([field('VT1_10'), field('VT1_14')], flexes: const [3, 2]),
    const SizedBox(height: 20),
    field('VT1_11'),
  ];
}

/// Wizard-only visual reorder for Identification: moves VT1_14 (Année
/// d'ouverture) to sit right after VT1_11 (Type de CFP) instead of its
/// real AST position (order: 15, after VT1_12/13's functional-status/
/// reason pair) — Figma places it beside Ordre d'enseignement/Type de
/// CFP, not beside Situation d'activité. _vtWizardGroupFieldsFor's
/// contiguous-run grouping needs the fields it labels "Enseignement" to
/// actually sit together, so the label change alone (VT1_14 now mapped
/// to _kVtSection1Enseignement in _kVtSection1FineGroups) isn't enough
/// without also moving it here. This only reorders the wizard's own
/// local rendering list — onefop_ast.dart's `order` (and every other
/// mode/export/PDF that reads it) is untouched. A no-op for every
/// section but Identification.
List<FieldSchema> _vtWizardVisualFieldOrder(
    String sectionId, List<FieldSchema> fields) {
  if (sectionId != 'section1_vocationalTraining') return fields;
  final reordered = List<FieldSchema>.from(fields);
  final yearIndex = reordered.indexWhere((f) => f.id == 'VT1_14');
  if (yearIndex == -1) return fields;
  final year = reordered.removeAt(yearIndex);
  final cfpTypeIndex = reordered.indexWhere((f) => f.id == 'VT1_11');
  if (cfpTypeIndex == -1) return fields;
  reordered.insert(cfpTypeIndex + 1, year);
  return reordered;
}

/// Plain, already width-capped field types (VtWizardTextField for
/// text/email/tel, VtWizardNumberStepperField for number) — safe to pair
/// two-per-row without the density/misclick concerns toggles/radios/
/// checkboxes/textareas/dropdowns carry. Deliberately excludes
/// 'textarea' (wants its own full-width row to grow) even though it
/// renders through VtWizardTextField too. The two Sex fields
/// (kVtWizardSegmentedRadioFieldIds) are the one radio-typed exception:
/// they render as a compact segmented pill (VtWizardSegmentedToggle), not
/// a full-width prompt+choices block, so they're just as safe to sit
/// inline in a row as any other compact field — matching Figma's own
/// Sexe placement beside the Promoteur/Directeur name.
/// kVtWizardNoStepperNumberFieldIds is the opposite exception: those
/// open-ended headcount fields have long labels that wrap awkwardly at
/// compact-row width, so they get their own full-width row instead
/// (vt_wizard_fields.dart also drops their +/- stepper for the same
/// long-label/open-ended-count reason).
bool _isVtWizardShortPairableField(FieldSchema f) =>
    (f.type == 'text' ||
        f.type == 'number' ||
        f.type == 'email' ||
        f.type == 'tel' ||
        f.type == 'select' ||
        kVtWizardSegmentedRadioFieldIds.contains(f.id)) &&
    !kVtWizardNoStepperNumberFieldIds.contains(f.id);

/// Splits a section's fields into subsection clusters (reusing
/// groupFields — the exact same subsection-boundary logic
/// OnefopSectionMap/VtSectionOutline already group by elsewhere, not a
/// new grouping rule) and renders each as a plain subsection: a small
/// accent heading followed by its field rows, separated by whitespace
/// only — the field-design system explicitly avoids wrapping every
/// subsection in its own bordered card ("no nested cards, don't wrap
/// every question in a card... one primary surface per step").
///
/// Caveat: this only splits as finely as the AST's own `subsection` data
/// does. Some VT2 fields (§2.2's later items — governance councils,
/// fencing, health, ICT, playground, protection policies) currently all
/// share one AST subsection ("2.2 Informations sur les autres
/// équipements..."), so they still render as one combined card here even
/// though Figma's latest screens split that same content into ~7 separate
/// thematic mini-cards. Matching that exactly would mean adding new,
/// finer subsection labels to onefop_ast.dart for those fields — a real,
/// bounded content change, just not done in this pass.

/// Identification's three fine-groups (see _kVtSection1FineGroups) are the
/// only ones this function recognizes by identity to swap in Figma's own
/// plain heading style and, for §1.1/§1.2, a hand-laid-out fixed grid
/// instead of the generic type-based row batcher — matched by comparing
/// against the exact same const LocalizedText instances the fine-groups
/// map assigns (safe: const declarations of equal value canonicalize to
/// one instance, and no other section ever produces these exact labels).
bool _isVtWizardPlainHeadingGroup(LocalizedText? sub) =>
    sub == _kVtSection1Localisation ||
    sub == _kVtSection1Enseignement ||
    sub == _kVtSection1Situation ||
    sub == _kVtSection2Conventions ||
    sub == _kVtSection2Accessibilite ||
    sub == _kVtSection2Agrement ||
    sub == _kVtSection2Regime;

Widget _vtWizardCardForGroup(
    FieldGroup group,
    OnefopFormController ctrl,
    Widget Function(FieldSchema) buildField,
    Locale locale,
    bool compact,
    bool tableauMode,
    {String? headingTextOverride,
    Widget? headingTrailing,
    int columns = 2}) {
  final headingText = headingTextOverride ?? group.sub?.of(locale);
  final plainHeading = _isVtWizardPlainHeadingGroup(group.sub);
  Widget? heading;
  if (headingText != null) {
    final cleanHeading = headingText;
    // Figma's own Identification/Informations-Générales card headings
    // (nodes 6:4035/6:4431) are a plain bold dark-green line — no accent
    // bar, no uppercasing — distinct from every other section's generic
    // accent-bar/uppercase treatment.
    final textWidget = plainHeading
        ? Text(
            cleanHeading,
            style: const TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: Color(0xFF074C32),
            ),
          )
        : Row(
            children: [
              Container(
                width: 4,
                height: 18,
                decoration: BoxDecoration(
                  color: kAccent,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  cleanHeading.toUpperCase(),
                  style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    letterSpacing: 0.8,
                    color: kAccent,
                  ),
                ),
              ),
            ],
          );
    heading = headingTrailing == null
        ? textWidget
        : Row(children: [Expanded(child: textWidget), headingTrailing]);
  }
  final content = <Widget>[];
  if (heading != null) {
    content.add(heading);
    content.add(const SizedBox(height: 16));
  }
  final rows = group.sub == _kVtSection1Localisation
      ? _vtWizardIdentificationLocalisationRows(group.fields, ctrl, compact)
      : group.sub == _kVtSection1Enseignement
          ? _vtWizardIdentificationEnseignementRows(group.fields, ctrl, compact)
          : _vtWizardFieldRows(
              group.fields, ctrl, buildField, compact, tableauMode, locale,
              columns: columns);
  for (var i = 0; i < rows.length; i++) {
    content.add(rows[i]);
    // Whitespace only, no divider — "no horizontal rules between
    // individual questions... separate groups via whitespace" (16-24px
    // within-group spacing per the field-design system).
    if (i != rows.length - 1) content.add(const SizedBox(height: 20));
  }
  return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch, children: content);
}

/// Section 2's §2.2 block (VT2_23-55, ~20 paper questions) shares ONE
/// AST subsection label ("2.2 Informations sur les autres équipements
/// et commodités...") — Figma's Équipements screen (node 11:916) splits
/// that same content into 11 separate thematic mini-cards instead,
/// matching the paper form's own finer 2.2.1-2.2.20 numbering (already
/// present as each field's paperCode — this isn't invented content,
/// just a finer-grained read of numbering the AST already carries).
///
/// Deliberately a WIZARD-ONLY override, not a change to
/// onefop_ast.dart's own `subsection` text: that field is shared with
/// Simple/Spreadsheet Mode (and pinned by
/// vt_subsection_headings_test.dart's "Section 2: splits into 2.1 and
/// 2.2 units" assertion) — splitting it there would ripple into both
/// other modes' own subsection grouping, which is out of scope for a
/// wizard-visual-fidelity pass. This map only feeds
/// _vtWizardGroupFieldsFor below, called nowhere outside this file.
///
/// Titled groups match a genuine standalone title Figma shows above
/// multiple questions; untitled ones (mapped to null) are Figma's
/// single-question cards where the question's own bilingual label
/// already reads as the card's title, so no separate header sits above.
/// Re-verified card-by-card against a fresh Figma fetch of the section's
/// 3 finalized step frames (11:916 "06a", 196:2 "06b", 189:1078 "06c") —
/// corrects two mismatches an earlier pass got wrong by assuming the
/// paper form's own 2.2.1-2.2.20 numbering ran in tidy blocks: 2.2.3
/// (handwashing) and 2.2.7 (library) both render inside 06b's "Services
/// de Santé & Commodités" card, not standalone/with Eau Potable — and
/// 2.2.16 (violence training) renders inside 06c's "Programmes &
/// Politiques de Protection" card, not its own.
/// VT2_1-22's own fine groups — matching Figma's "Informations Générales
/// (2A)" reference (node 6:4431, fileKey GigkgQNC79hb9w87gt1wEN) card-by-
/// card: "2.1 Conventions, Sites et Infrastructures", "2.2 Accessibilité
/// & Adressage postal", "2.3 Agrément de fonctionnement (Accreditation)",
/// "2.4 Régime et Volume Global d'Apprenants". These are Figma's OWN
/// visual sub-numbering for this mockup, not the real paper form's
/// paperCode granularity — every field from VT2_1 to VT2_22 actually
/// carries a real "2.1.x" paperCode (confirmed against onefop_ast.dart),
/// and the real "2.2 ..." AST subsection doesn't begin until VT2_23. The
/// "2.2" reused here for Accessibilité is Figma's label text taken
/// verbatim for pixel conformity; it does not collide functionally with
/// the later real "2.2 Informations sur les autres équipements..." group
/// below since they're distinct LocalizedText constants read from
/// different, non-overlapping field-id ranges.
const _kVtSection2Conventions = LocalizedText(
    fr: 'Conventions, Sites et Infrastructures',
    en: 'Agreements, Sites and Infrastructure');
const _kVtSection2Accessibilite = LocalizedText(
    fr: 'Accessibilité & Adressage postal',
    en: 'Accessibility & Postal Address');
const _kVtSection2Agrement = LocalizedText(
    fr: 'Agrément de fonctionnement (Accreditation)',
    en: 'Operating Accreditation');
const _kVtSection2Regime = LocalizedText(
    fr: "Régime et Volume Global d'Apprenants",
    en: 'Training Mode and Overall Trainee Volume');

const _kVtSection2FineGroups = <String, LocalizedText?>{
  'VT2_1': _kVtSection2Conventions,
  'VT2_2': _kVtSection2Conventions,
  'VT2_3': _kVtSection2Conventions,
  'VT2_4': _kVtSection2Conventions,
  'VT2_5': _kVtSection2Conventions,
  'VT2_6': _kVtSection2Accessibilite,
  'VT2_7': _kVtSection2Accessibilite,
  'VT2_8': _kVtSection2Accessibilite,
  'VT2_9': _kVtSection2Accessibilite,
  'VT2_10': _kVtSection2Accessibilite,
  'VT2_11': _kVtSection2Accessibilite,
  'VT2_11_CITY': _kVtSection2Accessibilite,
  'VT2_12': _kVtSection2Accessibilite,
  'VT2_13': _kVtSection2Accessibilite,
  'VT2_14': _kVtSection2Agrement,
  'VT2_15': _kVtSection2Agrement,
  'VT2_16': _kVtSection2Agrement,
  'VT2_17': _kVtSection2Agrement,
  'VT2_18': _kVtSection2Regime,
  'VT2_19': _kVtSection2Regime,
  'VT2_20': _kVtSection2Regime,
  'VT2_21': _kVtSection2Regime,
  'VT2_22': _kVtSection2Regime,
  'VT2_23': _kVtSection2Electricite, 'VT2_24': _kVtSection2Electricite,
  'VT2_25': _kVtSection2Electricite, // 2.2.1 Électricité
  'VT2_26': _kVtSection2EauPotable,
  'VT2_27': _kVtSection2EauPotable, // 2.2.2 Eau potable
  'VT2_28': _kVtSection2Sante, // 2.2.3 lavage des mains
  'VT2_29': _kVtSection2Sante, 'VT2_30': _kVtSection2Sante,
  'VT2_31': _kVtSection2Sante,
  'VT2_32': _kVtSection2Sante, // 2.2.7 Bibliothèque
  'VT2_33': _kVtSection2Cloture, // 2.2.8 Clôture
  'VT2_34': _kVtSection2Gouvernance,
  'VT2_35': _kVtSection2Gouvernance,
  'VT2_36': _kVtSection2Gouvernance,
  'VT2_37': _kVtSection2Latrines, 'VT2_38': _kVtSection2Latrines,
  'VT2_39': _kVtSection2Latrines,
  'VT2_40': _kVtSection2Latrines, // 2.2.12 Latrines
  'VT2_41': _kVtSection2Jeux, 'VT2_42': _kVtSection2Jeux,
  'VT2_43': _kVtSection2Ict,
  'VT2_44': _kVtSection2Ict,
  'VT2_45': _kVtSection2Ict,
  'VT2_46': _kVtSection2Ict,
  'VT2_47': _kVtSection2Ict,
  'VT2_48': _kVtSection2Ict,
  'VT2_49': _kVtSection2Protection, // 2.2.16 violence training
  'VT2_50': _kVtSection2Protection,
  'VT2_51': _kVtSection2Protection,
  'VT2_52': _kVtSection2Protection,
  'VT2_53': _kVtSection2Protection,
};

const _kVtSection2Electricite =
    LocalizedText(fr: 'Électricité', en: 'Electricity');
const _kVtSection2EauPotable =
    LocalizedText(fr: 'Eau potable', en: 'Drinking Water');
const _kVtSection2Cloture = LocalizedText(fr: 'Clôture', en: 'Fencing');
const _kVtSection2Latrines = LocalizedText(fr: 'Latrines', en: 'Latrines');
const _kVtSection2Sante = LocalizedText(
    fr: 'Services de Santé & Commodités', en: 'Hygiene & Welfare');
const _kVtSection2Gouvernance =
    LocalizedText(fr: 'Gouvernance & Conseils', en: 'Governance & Councils');
const _kVtSection2Jeux = LocalizedText(fr: 'Aires de jeux', en: 'Playgrounds');
const _kVtSection2Ict =
    LocalizedText(fr: 'Équipements informatiques', en: 'ICT Access');
const _kVtSection2Protection = LocalizedText(
    fr: 'Programmes & Politiques de Protection',
    en: 'School Protection & Social Programs');

const _kVtSection2Id = 'section2_vocationalTraining';

/// Per-section field-id -> group-title override maps, keyed by section id
/// — plus their own leading, subsection-less field runs (VT3_1-11,
/// VT7_1-12, VT9_1-3) so every block gets a real header once the wizard
/// renders one group per progressive block instead of stacking several
/// groups under one shared step header (see _kVtSectionsTabbedInTableur's
/// doc comment).
Map<String, Map<String, LocalizedText?>> get _kVtSectionFineGroups => {
      'section1_vocationalTraining': _kVtSection1FineGroups,
      _kVtSection2Id: _kVtSection2FineGroups,
      'section3_vocationalTraining': _kVtSection3FineGroups,
      'section7_vocationalTraining': _kVtSection7FineGroups,
      'section9_vocationalTraining': _kVtSection9FineGroups,
    };

/// Field-design-system worked example for Identification — re-grouped to
/// match the Figma reference (node 6:4035, get_design_context'd against
/// fileKey GigkgQNC79hb9w87gt1wEN) card-by-card: "1.1 Localisation
/// administrative et Milieu d'implantation" (institution + geography +
/// milieu), "1.2 Ordre d'enseignement et Type de CFP" (education
/// system + CFP type), "1.3 Situation d'activité et Contacts" (functional
/// status/reason + the promoter/respondent contact fields). VT1_15_*/
/// VT1_16_* now fold into the 1.3 group instead of keeping their own real
/// field.subsection headings ("1.15 Informations sur le répondant"/"1.16
/// Noms et contacts...") — Figma's own card puts them there, and (unlike
/// Section 2's fine-groups override) this is a wizard-only relabeling on
/// top of the same underlying fields, not a change to onefop_ast.dart's
/// subsection text, so Simple/Spreadsheet Mode and the sidebar tree
/// (still keyed by the real "1.15"/"1.16" subsection strings — see
/// vt_sidebar_subsection_tree_test.dart) are unaffected.
///
/// VT1_14 (Année d'ouverture) is grouped into "Enseignement" (1.2) here,
/// matching Figma's own row (beside Ordre d'enseignement) — even though
/// it sits after VT1_12/13 in the AST's own field order (order: 15, vs.
/// 12-14 for functionalStatus/reason). _vtWizardGroupFieldsFor's
/// contiguous-run grouping needs the fields sharing a label to actually
/// sit together in the list it's given, so _vtWizardVisualFieldOrder
/// (called once, in VtWizardSectionScreen.build, before this grouping
/// runs) physically moves VT1_14 next to VT1_11 in the wizard's own
/// local field list — onefop_ast.dart's real `order` (and every other
/// mode/export/PDF that reads it) is untouched.
final _kVtSection1FineGroups = <String, LocalizedText?>{
  for (final id in [
    'VT1_1',
    'VT1_2',
    'VT1_3',
    'VT1_4',
    'VT1_5',
    'VT1_6',
    'VT1_7',
    'VT1_8',
    'VT1_9'
  ])
    id: _kVtSection1Localisation,
  for (final id in ['VT1_10', 'VT1_11', 'VT1_14']) id: _kVtSection1Enseignement,
  for (final id in [
    'VT1_12',
    'VT1_13',
    'VT1_13_OTHER',
    'VT1_15_NAME',
    'VT1_15_FUNCTION',
    'VT1_15_TEL1',
    'VT1_15_TEL2',
    'VT1_15_EMAIL',
    'VT1_15_SEX',
    'VT1_16_NAME',
    'VT1_16_SEX',
    'VT1_16_TEL1',
    'VT1_16_TEL2',
    'VT1_16_EMAIL'
  ])
    id: _kVtSection1Situation,
};

const _kVtSection1Localisation = LocalizedText(
    fr: "Localisation administrative et Milieu d'implantation",
    en: 'Administrative Location and Area of Establishment');
const _kVtSection1Enseignement = LocalizedText(
    fr: "Ordre d'enseignement et Type de CFP",
    en: 'Education System and Type of VTC');
const _kVtSection1Situation = LocalizedText(
    fr: "Situation d'activité et Contacts", en: 'Activity Status and Contacts');

/// Same "consecutive same-subsection run becomes one group" rule
/// groupFields already applies, just reading subsection labels from a
/// section-specific override map (falling back to the field's own
/// field.subsection for anything not in that map) instead of always
/// reading field.subsection directly. Sections with no override map just
/// get plain groupFields.
List<FieldGroup> _vtWizardGroupFieldsFor(
    String sectionId, List<FieldSchema> fields) {
  final fineGroups = _kVtSectionFineGroups[sectionId];
  if (fineGroups == null) return groupFields(fields);
  final groups = <FieldGroup>[];
  LocalizedText? cSub;
  var cHasOverride = false;
  var cFields = <FieldSchema>[];
  for (final f in fields) {
    final hasOverride = fineGroups.containsKey(f.id);
    // A field with no override of its own inherits the still-open
    // subsection run the same way groupFields() does (f.subsection ??
    // cSub) — but only when that run is itself override-free; cHasOverride
    // already forces a fresh group on any override/no-override transition,
    // so falling through to f.subsection alone there stops a just-ended
    // override's title from leaking onto the next plain field.
    final sub = hasOverride
        ? fineGroups[f.id]
        : (cHasOverride ? f.subsection : (f.subsection ?? cSub));
    final sameGroup = cFields.isNotEmpty &&
        cHasOverride == hasOverride &&
        ((sub == null && cSub == null) || sub?.fr == cSub?.fr);
    if (sameGroup) {
      cFields.add(f);
    } else {
      if (cFields.isNotEmpty) {
        groups.add(FieldGroup(sub: cSub, fields: cFields));
      }
      cSub = sub;
      cHasOverride = hasOverride;
      cFields = [f];
    }
  }
  if (cFields.isNotEmpty) groups.add(FieldGroup(sub: cSub, fields: cFields));
  return groups;
}

/// Defensive fallback for a progressive block's header/collapsed-row
/// label — every group in scope already resolves to a real title via
/// [_vtWizardGroupFieldsFor]'s override maps or the field's own
/// `subsection`, but a future AST/override edit that leaves a gap should
/// degrade to a numbered placeholder rather than a blank header.
String _vtWizardBlockLabel(FieldGroup group, Locale locale, int index) =>
    group.sub?.of(locale) ??
    LocalizedText(fr: 'Bloc ${index + 1}', en: 'Block ${index + 1}').of(locale);

enum VtWizardSectionOutlineStatus {
  notStarted,
  inProgress,
  complete,
  needsAttention,
}

/// A subsection shown below the active declaration task in the desktop task
/// rail. The section screen owns the data and scrolling callback; the shell
/// only decides where that navigation is displayed.
class VtWizardSectionOutlineItem {
  final String label;
  final int filled;
  final int total;
  final int errors;
  final VtWizardSectionOutlineStatus status;

  const VtWizardSectionOutlineItem({
    required this.label,
    required this.filled,
    required this.total,
    required this.errors,
    required this.status,
  });
}

class VtWizardSectionOutlineModel {
  final List<VtWizardSectionOutlineItem> items;
  final int activeIndex;
  final ValueChanged<int> onSelect;

  const VtWizardSectionOutlineModel({
    required this.items,
    required this.activeIndex,
    required this.onSelect,
  });
}

Widget _vtWizardBlockStatusChip(
    FieldGroup group, OnefopFormController ctrl, Locale locale) {
  return ValueListenableBuilder<int>(
    valueListenable: ctrl.version,
    builder: (context, _, __) {
      final rawStats = vtWizardGroupStats(ctrl, group.fields);
      final total = rawStats.total == 0 ? group.fields.length : rawStats.total;
      final filled = rawStats.total == 0
          ? (group.fields.every(ctrl.isFieldFilled) ? group.fields.length : 0)
          : rawStats.filled;
      final errors =
          group.fields.where(ctrl.isFieldVisible).where(ctrl.hasError).length;
      final isComplete = total > 0 && filled >= total && errors == 0;

      if (errors > 0) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: kVtWizardRedSoft,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: kVtWizardRed.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded,
                  size: 12, color: kVtWizardRed),
              const SizedBox(width: 4),
              Text(
                locale.languageCode == 'fr' ? 'À corriger' : 'Needs attention',
                style: const TextStyle(
                  fontFamily: kVtWizardFontFamily,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: kVtWizardRed,
                ),
              ),
            ],
          ),
        );
      }

      if (isComplete) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: kVtWizardAccentSoft,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: kAccent.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_rounded, size: 12, color: kAccent),
              const SizedBox(width: 4),
              Text(
                '$filled/$total ${locale.languageCode == 'fr' ? 'remplis' : 'complete'}',
                style: const TextStyle(
                  fontFamily: kVtWizardFontFamily,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: kAccent,
                ),
              ),
            ],
          ),
        );
      }

      if (filled > 0) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          child: Text(
            '$filled/$total ${locale.languageCode == 'fr' ? 'renseignés' : 'filled'}',
            style: const TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: kVtWizardInkSoft,
            ),
          ),
        );
      }

      return const SizedBox.shrink();
    },
  );
}

/// The section outline deliberately has one unambiguous status per block.
/// A green check is reserved for a block whose visible answers are all filled
/// and error-free; a partial answer count is neutral, rather than pretending
/// it is done.
VtWizardSectionOutlineItem _vtWizardBlockSummary(
  FieldGroup group,
  OnefopFormController ctrl,
  Locale locale,
  int index,
) {
  final rawStats = vtWizardGroupStats(ctrl, group.fields);
  final total = rawStats.total == 0 ? 1 : rawStats.total;
  final filled = rawStats.total == 0
      ? (group.fields.every(ctrl.isFieldFilled) ? 1 : 0)
      : rawStats.filled;
  final errors =
      group.fields.where(ctrl.isFieldVisible).where(ctrl.hasError).length;
  final complete = total > 0 && filled == total && errors == 0;
  final state = errors > 0
      ? VtWizardSectionOutlineStatus.needsAttention
      : complete
          ? VtWizardSectionOutlineStatus.complete
          : filled > 0
              ? VtWizardSectionOutlineStatus.inProgress
              : VtWizardSectionOutlineStatus.notStarted;
  return VtWizardSectionOutlineItem(
    label: _vtWizardBlockLabel(group, locale, index),
    filled: filled,
    total: total,
    errors: errors,
    status: state,
  );
}

/// Sections 4 (Effectifs) and 8 (Formateurs) are where Figma switched
/// from stacked cards to a "category-tabs" strip — one short pill per
/// subsection (4.1..4.11 / 8.1..8.8, confirmed via get_design_context
/// against nodes 11:1412/79:3 and 79:810/77:216), showing only the
/// active tab's card below it, in both Guidé and Tableur mode. Every
/// other multi-group section renders as progressive question blocks
/// instead — Figma only introduced tabs for sections whose subsections
/// are each a single (usually table-shaped) field heavy enough that
/// stacking all of them would make the page extremely long, unlike
/// section 2's lightweight toggle/checkbox subsection cards.
///
/// Section 5 is its own case, confirmed via get_screenshot (not just
/// metadata) of both its actual mode screens: Mode Tableur (79:811) uses
/// the same tabs pattern as 4/8, but Mode Guidé (66:589) uses progressive
/// blocks instead — and that Guidé screen carries its own Mode Guidé/
/// Tableur toggle, so it's confirmed current, not a frame the designer
/// forgot to update. Section 5 is deliberately absent from this always-
/// tabbed set — its Tableur-mode tabs are driven separately, gated on
/// _tableauMode via _kVtSectionsTabbedInTableur below.
const _kVtTabbedSectionIds = {
  'section4_vocationalTraining',
  'section8_vocationalTraining',
};

/// The 6 sections that were densest enough to warrant Figma's own
/// paginated "Étape N sur M" treatment (now progressive blocks in Guidé
/// mode) but fall back to the same category-tabs strip as 4/8 while in
/// Mode Tableur (each of their groups is table-shaped in that mode) —
/// same section set the old per-section stepper config used to key.
const _kVtSectionsTabbedInTableur = {
  'section2_vocationalTraining',
  'section3_vocationalTraining',
  'section5_vocationalTraining',
  'section6_vocationalTraining',
  'section7_vocationalTraining',
  'section9_vocationalTraining',
};

/// §3.5-3.12's own titled groups, plus VT3_1-11 (crisis + closure/
/// relocation, no AST subsection of their own) — previously left
/// unmapped to form one implicit untitled group under a shared step
/// header; now needs its own real block title.
const _kVtSection3CrisesImpact =
    LocalizedText(fr: 'Crises & Impact', en: 'Crises & Impact');
const _kVtSection3Prep = LocalizedText(
    fr: 'Préparation et formations des formateurs',
    en: 'Trainer Emergency Preparedness');
const _kVtSection3OtherAspects = LocalizedText(
    fr: "Formateurs formés sur d'autres aspects d'ESU",
    en: 'Trainers trained on other emergency aspects');
const _kVtSection3Securisation =
    LocalizedText(fr: 'Sécurisation', en: 'Security measures');
final _kVtSection3FineGroups = <String, LocalizedText?>{
  for (final id in [
    'VT3_1',
    'VT3_2',
    'VT3_3',
    'VT3_4',
    'VT3_5',
    'VT3_6',
    'VT3_7',
    'VT3_8',
    'VT3_9',
    'VT3_10',
    'VT3_11'
  ])
    id: _kVtSection3CrisesImpact,
  for (final id in [
    'VT3_12',
    'VT3_13',
    'VT3_14',
    'VT3_15',
    'VT3_16',
    'VT3_17',
    'VT3_18',
    'VT3_19',
    'VT3_20',
    'VT3_21',
    'VT3_22',
    'VT3_23'
  ])
    id: _kVtSection3Prep,
  for (final id in ['VT3_24', 'VT3_25', 'VT3_26']) id: _kVtSection3OtherAspects,
  for (final id in ['VT3_27', 'VT3_28', 'VT3_29', 'VT3_30'])
    id: _kVtSection3Securisation,
};

/// §7.4-7.7's one titled group, plus VT7_1-12 (HIV/AIDS rules, stigma
/// sub-questions, disciplinary procedures, §7.1.3 stakeholders informed,
/// IST question — no AST subsection of their own) — previously left
/// unmapped to form one implicit untitled group under a shared step
/// header; now needs its own real block title.
const _kVtSection7VbgDiscipline =
    LocalizedText(fr: 'VBG & Discipline', en: 'GBV & Discipline');
const _kVtSection7Suite = LocalizedText(
    fr: 'Éducation Sexuelle & Orientation', en: 'Sex Education & Guidance');
final _kVtSection7FineGroups = <String, LocalizedText?>{
  for (final id in [
    'VT7_1',
    'VT7_2',
    'VT7_3',
    'VT7_4',
    'VT7_5',
    'VT7_6',
    'VT7_6_INFORMED',
    'VT7_7',
    'VT7_8',
    'VT7_9',
    'VT7_10',
    'VT7_11',
    'VT7_12'
  ])
    id: _kVtSection7VbgDiscipline,
  for (final id in [
    'VT7_13',
    'VT7_14',
    'VT7_15',
    'VT7_16',
    'VT7_17',
    'VT7_18',
    'VT7_19',
    'VT7_20',
    'VT7_20_DOMAINS',
    'VT7_21',
    'VT7_22'
  ])
    id: _kVtSection7Suite,
};

/// VT9_1-3 ("9.1 Difficultés", no AST subsection of their own) —
/// previously left unmapped to form one implicit untitled group under a
/// shared step header; now needs its own real block title. VT9_4 ("9.2
/// Perspectives") already carries its own real AST subsection and stays
/// out of this map.
const _kVtSection9Difficultes =
    LocalizedText(fr: 'Difficultés', en: 'Difficulties');
final _kVtSection9FineGroups = <String, LocalizedText?>{
  for (final id in ['VT9_1', 'VT9_2', 'VT9_3']) id: _kVtSection9Difficultes,
};

/// Difficultés & Perspectives (section 9, the last content section) is
/// where Figma adds a "Signatures & Approbations" card (node 66:1050 on
/// screen 14) below the regular field cards — three dashed stamp/
/// signature placeholder boxes (Directeur/Promoteur, Délégué
/// Départemental ou Régional, Secrétaire Technique Régional de l'ONEFOP).
/// Purely presentational: no AST field anywhere backs a physical
/// signature, so VtWizardSignaturesCard below writes nothing — it mirrors
/// the paper form's own closing signature block, shown but never
/// submitted through this UI (the real submit flow stays on the
/// Validation screen, unchanged).
const _kVtSignaturesSectionId = 'section9_vocationalTraining';

/// Identifies which groups Figma shows sharing ONE continuous bordered
/// card (with a thin divider line between them) rather than the usual
/// stack of separately-bordered cards — Identification's own 3 groups
/// (node 6:4035) and Informations Générales's first 4 groups (node
/// 6:4431), each returning a distinct family id here. Every other group
/// (including section2's own LATER equipment sub-groups, which belong to
/// a different, not-yet-pixel-matched Figma screen) returns null and
/// keeps its existing separate-card treatment untouched.
String? _vtWizardCardFamilyOf(LocalizedText? sub) {
  if (sub == _kVtSection1Localisation ||
      sub == _kVtSection1Enseignement ||
      sub == _kVtSection1Situation) {
    return 'section1Identification';
  }
  if (sub == _kVtSection2Conventions ||
      sub == _kVtSection2Accessibilite ||
      sub == _kVtSection2Agrement ||
      sub == _kVtSection2Regime) {
    return 'section2InformationsGenerales';
  }
  return null;
}

/// Partitions [groups] (in order) into the physical cards they render as:
/// a run of consecutive groups sharing the same non-null
/// _vtWizardCardFamilyOf id shares ONE bordered card; every other group
/// — including a lone group whose family has only one member actually
/// present (e.g. a section where conditional visibility hid the rest) —
/// still gets its own untouched separate card, so this is a strict
/// opt-in keyed off real Figma card boundaries, not a general behavior
/// change to every multi-group section.
List<List<int>> _vtWizardCardChunksFor(List<FieldGroup> groups) {
  final chunks = <List<int>>[];
  String? openFamily;
  for (var i = 0; i < groups.length; i++) {
    final family = _vtWizardCardFamilyOf(groups[i].sub);
    if (family != null && family == openFamily) {
      chunks.last.add(i);
    } else {
      chunks.add([i]);
      openFamily = family;
    }
  }
  return chunks;
}

/// Figma's own short tab titles (nodes 70:21/79:105/77:321/79:914/
/// 79:1328 across the Section 4/5/8 Guidé+Tableur screens) — a
/// paperCode-plus-a-few-words label, not derivable from the AST's own
/// content (which only carries the paperCode and a full descriptive
/// sentence, never a short title). Wizard-UI-only lookup, same precedent
/// as kSidebarMeta's own short sidebar labels alongside the AST's fuller
/// section titles — indexed by tab position within each tabbed section,
/// since group order already matches this list's order exactly (11
/// groups for section 4, 4 for section 5, 8 for section 8 — see
/// _kVtTabbedSectionIds).
const _kVtTabLabels = <String, List<LocalizedText>>{
  'section4_vocationalTraining': [
    LocalizedText(fr: '4.1 Diplôme Académique', en: '4.1 Academic Diploma'),
    LocalizedText(
        fr: '4.2 Diplôme Professionnel', en: '4.2 Professional Diploma'),
    LocalizedText(
        fr: '4.3 Qualifiés Non Occupés', en: '4.3 Qualified Not Working'),
    LocalizedText(fr: '4.4 Secteur Informel', en: '4.4 Informal Sector'),
    LocalizedText(fr: '4.5 Par Spécialité', en: '4.5 By Specialty'),
    LocalizedText(fr: '4.6 Par Année', en: '4.6 By Year'),
    LocalizedText(fr: '4.7 Par Âge', en: '4.7 By Age'),
    LocalizedText(fr: '4.8 Entrants & Flux', en: '4.8 Entrants & Flow'),
    LocalizedText(fr: '4.9 Vulnérables', en: '4.9 Vulnerable'),
    LocalizedText(fr: '4.10 Sortants', en: '4.10 Leavers'),
    LocalizedText(fr: '4.11 Bourses', en: '4.11 Scholarships'),
  ],
  // Figma's own Tableur-screen tab text ("5.1 Frais Scolaires", "5.2
  // Manuels") doesn't match what VT5_1-4/VT5_5 actually are (study
  // guides and a curriculum-approval table — nothing about school fees),
  // and the "5.2" Tableur tab's own table content (a fictional
  // Disponibles/Nécessaires/Ratio grid) doesn't match VT5_5's real
  // hasCurriculum/isApproved shape either — both read as Figma mockup
  // placeholder text/content, not the real form. Labels below are
  // shortened from each group's own real AST subsection text instead
  // (onefop_ast.dart's VT5_1/VT5_5/VT5_6/VT5_7 subsection fields).
  'section5_vocationalTraining': [
    LocalizedText(fr: "5.1 Manuels d'Apprentissage", en: '5.1 Study Guides'),
    LocalizedText(
        fr: '5.2 Référentiel de Formation', en: '5.2 Training Curriculum'),
    LocalizedText(fr: '5.3 Infrastructures', en: '5.3 Infrastructure'),
    LocalizedText(fr: '5.4 Équipements Mobiliers', en: '5.4 Furniture'),
  ],
  'section8_vocationalTraining': [
    LocalizedText(fr: '8.1 Diplômes Académiques', en: '8.1 Academic Diplomas'),
    LocalizedText(
        fr: '8.2 Diplômes Professionnels', en: '8.2 Professional Diplomas'),
    LocalizedText(fr: '8.3 Par Âge', en: '8.3 By Age'),
    LocalizedText(fr: '8.4 Par Spécialité', en: '8.4 By Specialty'),
    LocalizedText(fr: '8.5 Par Statut', en: '8.5 By Status'),
    LocalizedText(fr: '8.6 Handicap', en: '8.6 Disability'),
    LocalizedText(fr: '8.7 Capacité', en: '8.7 Capacity'),
    LocalizedText(fr: '8.8 État Nominatif', en: '8.8 Nominal Roll'),
  ],
};

/// Figma's "category-tabs" pill row (e.g. node 70:21 on the Section 4
/// screens) — wrapping row of rounded-8px pills, active one filled solid
/// accent/white text, each labeled with Figma's own short title (see
/// _kVtTabLabels) rather than just the bare paperCode.
class _VtWizardCategoryTabs extends StatelessWidget {
  final String sectionId;
  final List<FieldGroup> groups;
  final int activeIndex;
  final ValueChanged<int> onChanged;
  const _VtWizardCategoryTabs(
      {required this.sectionId,
      required this.groups,
      required this.activeIndex,
      required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final labels = _kVtTabLabels[sectionId];
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: kVtWizardCardBorder),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (var i = 0; i < groups.length; i++)
            _tab(
              label: (labels != null && i < labels.length)
                  ? labels[i].of(locale)
                  : groups[i].fields.first.paperCode ?? '${i + 1}',
              active: i == activeIndex,
              onTap: () => onChanged(i),
            ),
        ],
      ),
    );
  }

  Widget _tab(
      {required String label,
      required bool active,
      required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: active ? kAccent : Colors.white,
          border: Border.all(color: active ? kAccent : kVtWizardCardBorder),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: FontWeight.w700,
              fontSize: 12,
              color: active ? Colors.white : kVtWizardInkSoft),
        ),
      ),
    );
  }
}

/// The paper form's closing signature block (Figma node 66:1050) —
/// three tinted mini-cards, each a role label over a dashed "Zone de
/// signature / Stamp area" placeholder. Display-only (see
/// _kVtSignaturesSectionId's doc comment above).
class VtWizardSignaturesCard extends StatelessWidget {
  const VtWizardSignaturesCard({super.key});

  static const _roles = [
    LocalizedText(
      fr: 'Nom, signature et cachet du Directeur/Promoteur du CFP',
      en: 'Name, signature and stamp of the VTC Director/Promoter',
    ),
    LocalizedText(
      fr: 'Nom, signature et cachet du Délégué Départemental ou Régional',
      en: 'Name, signature and stamp of the Divisional or Regional Delegate',
    ),
    LocalizedText(
      fr: "Nom, signature et cachet du Secrétaire Technique Régional de l'ONEFOP",
      en: 'Name, signature and stamp of the ONEFOP Regional Technical Secretary',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: vtWizardCardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            const LocalizedText(
                    fr: 'Signatures & Approbations',
                    en: 'Signatures & Approvals')
                .of(locale)
                .toUpperCase(),
            style: const TextStyle(
                fontFamily: kVtWizardFontFamily,
                fontWeight: FontWeight.w800,
                fontSize: 14,
                color: kAccent),
          ),
          const SizedBox(height: 16),
          const Divider(color: kVtWizardCardBorder, height: 1),
          const SizedBox(height: 20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < _roles.length; i++) ...[
                if (i != 0) const SizedBox(width: 20),
                Expanded(child: _VtWizardSignatureBlock(role: _roles[i])),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _VtWizardSignatureBlock extends StatelessWidget {
  final LocalizedText role;
  const _VtWizardSignatureBlock({required this.role});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kVtWizardBackground,
        border: Border.all(color: kVtWizardCardBorder),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 40,
            child: Text(
              role.of(locale),
              style: const TextStyle(
                  fontFamily: kVtWizardFontFamily,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                  color: kVtWizardInk),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            height: 100,
            alignment: Alignment.center,
            // Figma draws this box's border dashed — a solid border here
            // instead, since Flutter has no built-in dashed BorderSide and
            // a one-off CustomPainter isn't worth it for a purely
            // decorative placeholder.
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: kVtWizardCardBorder),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              const LocalizedText(fr: 'Zone de signature', en: 'Stamp area')
                  .of(locale),
              style: kVtWizardCaption,
            ),
          ),
        ],
      ),
    );
  }
}

class VtWizardSectionScreen extends StatefulWidget {
  final OnefopFormController ctrl;
  final SectionSchema section;
  final Widget Function(FieldSchema) buildField;
  final VoidCallback onBack;
  final VoidCallback onNext;
  final Future<void> Function()? onSaveAndExit;
  final bool isFirst;
  final bool isLast;
  final bool tableauMode;
  final bool showBottomBar;
  final ValueChanged<bool>? onTableauModeChanged;
  final ValueChanged<VtWizardSectionOutlineModel?>? onOutlineChanged;
  const VtWizardSectionScreen({
    super.key,
    required this.ctrl,
    required this.section,
    required this.buildField,
    required this.onBack,
    required this.onNext,
    this.onSaveAndExit,
    required this.isFirst,
    this.isLast = false,
    this.tableauMode = false,
    this.showBottomBar = true,
    this.onTableauModeChanged,
    this.onOutlineChanged,
  });

  @override
  State<VtWizardSectionScreen> createState() => _VtWizardSectionScreenState();
}

class _VtWizardSectionScreenState extends State<VtWizardSectionScreen> {
  // Local fallback keeps this public widget usable in isolated tests. The
  // shell supplies a per-section value/callback in production, so a
  // respondent's chosen entry method survives section navigation.
  bool _localTableauMode = false;
  bool get _requestedTableauMode => widget.onTableauModeChanged == null
      ? _localTableauMode
      : widget.tableauMode;

  void _setTableauMode(bool value) {
    if (widget.onTableauModeChanged != null) {
      widget.onTableauModeChanged!(value);
    } else {
      setState(() => _localTableauMode = value);
    }
  }

  // Active category-tab index for the tabbed sections (4, 8, and 2/3/5/6/
  // 7/9 while in desktop Tableur mode).
  int _activeTab = 0;

  // An outline item identifies the current reading location after the user
  // jumps to it. All non-tabbed groups remain mounted in one section-long
  // vertical document; this index never hides the other groups.
  int _outlinedBlock = 0;
  final Map<int, GlobalKey> _blockKeys = {};
  String? _publishedOutlineSignature;

  GlobalKey _blockKeyFor(int index) =>
      _blockKeys.putIfAbsent(index, () => GlobalKey());

  // _vtWizardVisualFieldOrder/_vtWizardGroupFieldsFor only depend on the
  // section id and which fields are currently visible — never on a
  // visible field's own entered value — but this section rebuilds on
  // every controller notifyListeners(), including a keystroke into a
  // field that gates no conditional reveal at all (the common case).
  // Caching on the visible-id signature (rather than e.g. ctrl.version,
  // which bumps on that same keystroke and so would never hit) skips
  // re-running the reorder/grouping scan over the whole section field
  // list when the actual input it depends on hasn't changed.
  String? _cachedGroupsKey;
  List<FieldSchema>? _cachedFields;
  List<FieldGroup>? _cachedGroups;

  void _scrollToBlock(int index) {
    setState(() => _outlinedBlock = index);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = _blockKeys[index]?.currentContext;
      if (target == null) return;
      Scrollable.ensureVisible(
        target,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOut,
        alignment: 0.08,
      );
    });
  }

  void _publishOutline(VtWizardSectionOutlineModel? outline) {
    final callback = widget.onOutlineChanged;
    if (callback == null) return;
    final signature = outline == null
        ? 'none'
        : '${outline.activeIndex}:${outline.items.map((item) => '${item.label}/${item.filled}/${item.total}/${item.errors}/${item.status.name}').join('|')}';
    if (_publishedOutlineSignature == signature) return;
    _publishedOutlineSignature = signature;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) callback(outline);
    });
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = widget.ctrl;
    final section = widget.section;
    final buildField = widget.buildField;
    final locale = context.loc;
    final schema = ctrl.schema!;
    final meta = kSidebarMeta[section.id];
    final visibleFields = section.fieldIds
        .map(schema.getField)
        .whereType<FieldSchema>()
        .where(ctrl.isFieldVisible)
        .toList();
    final groupsKey =
        '${section.id}|${visibleFields.map((f) => f.id).join(',')}';
    final List<FieldSchema> fields;
    final List<FieldGroup> groups;
    if (_cachedGroupsKey == groupsKey) {
      fields = _cachedFields!;
      groups = _cachedGroups!;
    } else {
      fields = _vtWizardVisualFieldOrder(section.id, visibleFields);
      groups = _vtWizardGroupFieldsFor(section.id, fields);
      _cachedGroupsKey = groupsKey;
      _cachedFields = fields;
      _cachedGroups = groups;
    }

    final compact = _kVtCompactToggleSectionIds.contains(section.id);
    final hasTable = _vtWizardSectionHasTable(fields);
    // Spreadsheet grids are a desktop productivity preference, not a phone
    // layout. Narrow viewports always receive the guided/card equivalent.
    final canUseTableauMode = MediaQuery.sizeOf(context).width >= 1024;
    final tableauMode = canUseTableauMode && _requestedTableauMode;
    final tabbed = _kVtTabbedSectionIds.contains(section.id) ||
        (_kVtSectionsTabbedInTableur.contains(section.id) && tableauMode);
    final activeTab = tabbed && groups.isNotEmpty
        ? _activeTab.clamp(0, groups.length - 1)
        : 0;
    final outlinedBlock =
        groups.isEmpty ? 0 : _outlinedBlock.clamp(0, groups.length - 1);

    // In document-style sections every visible group is mounted at once, so
    // keyboard navigation can follow the respondent's natural reading order.
    // Tabbed table workspaces remain intentionally scoped to their active tab.
    final revealedFieldIds = tabbed
        ? (groups.isEmpty
            ? const <String>[]
            : [for (final f in groups[activeTab].fields) f.id])
        : [for (final field in fields) field.id];
    ctrl.setRevealedFieldIds(revealedFieldIds);
    ctrl.setRevealBoundaryActions(
      forward: widget.onNext,
      backward: widget.onBack,
    );

    final rowColumns = _vtWizardRowColumnsFor(section.id);
    final cards = tabbed
        ? (groups.isEmpty
            ? const <Widget>[]
            : [
                _vtWizardCardForGroup(groups[activeTab], ctrl, buildField,
                    locale, compact, tableauMode,
                    columns: rowColumns)
              ])
        : [
            for (var i = 0; i < groups.length; i++)
              KeyedSubtree(
                key: _blockKeyFor(i),
                child: _vtWizardCardForGroup(
                  groups[i],
                  ctrl,
                  buildField,
                  locale,
                  compact,
                  tableauMode,
                  headingTextOverride:
                      _vtWizardBlockLabel(groups[i], locale, i),
                  headingTrailing:
                      _vtWizardBlockStatusChip(groups[i], ctrl, locale),
                  columns: rowColumns,
                ),
              ),
          ];
    final blockSummaries = [
      for (var i = 0; i < groups.length; i++)
        _vtWizardBlockSummary(groups[i], ctrl, locale, i),
    ];
    final sectionOutline = !tabbed && blockSummaries.length > 1
        ? VtWizardSectionOutlineModel(
            items: blockSummaries,
            activeIndex: outlinedBlock,
            onSelect: _scrollToBlock,
          )
        : null;
    _publishOutline(sectionOutline);
    // Groups Figma shows sharing one continuous bordered card (with a
    // thin divider between them) get chunked together here; everything
    // else stays a lone chunk, i.e. its own separate card exactly as
    // before — see _vtWizardCardFamilyOf's own doc comment.
    final cardChunks = _vtWizardCardChunksFor(groups);
    final cardContent = fields.isEmpty
        ? Padding(
            padding: const EdgeInsets.all(8),
            child: Text(
              const LocalizedText(
                fr: 'Aucun champ visible pour le moment.',
                en: 'No fields currently visible.',
              ).of(locale),
              style: kVtWizardBody.copyWith(color: kVtWizardInkFaint),
            ),
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < cards.length; i++) ...[
                cards[i],
                if (i != cards.length - 1) const SizedBox(height: 28),
              ],
            ],
          );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
                child: Text(meta?.label.of(locale) ?? section.id,
                    style: kVtWizardSectionTitle)),
            if (hasTable && canUseTableauMode) ...[
              const SizedBox(width: 16),
              _VtWizardModeToggle(
                tableauMode: tableauMode,
                onChanged: _setTableauMode,
              ),
            ],
          ],
        ),
        const SizedBox(height: 24),
        if (tabbed && groups.length > 1) ...[
          _VtWizardCategoryTabs(
            sectionId: section.id,
            groups: groups,
            activeIndex: activeTab,
            onChanged: (i) => setState(() => _activeTab = i),
          ),
          const SizedBox(height: 20),
        ],
        if (groups.length > 1 && !tabbed) ...[
          for (var c = 0; c < cardChunks.length; c++) ...[
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(
                  MediaQuery.sizeOf(context).width < 768 ? 20 : 28),
              decoration: vtWizardCardDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var j = 0; j < cardChunks[c].length; j++) ...[
                    cards[cardChunks[c][j]],
                    if (j != cardChunks[c].length - 1)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 20),
                        child: Container(height: 1, color: kVtWizardCardBorder),
                      ),
                  ],
                ],
              ),
            ),
            if (c != cardChunks.length - 1) const SizedBox(height: 20),
          ],
          if (section.id == _kVtSignaturesSectionId) ...[
            const SizedBox(height: 20),
            const VtWizardSignaturesCard(),
          ],
        ] else
          Container(
            width: double.infinity,
            padding: EdgeInsets.all(
                MediaQuery.sizeOf(context).width < 768 ? 20 : 28),
            decoration: vtWizardCardDecoration(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                cardContent,
                if (section.id == _kVtSignaturesSectionId) ...[
                  const SizedBox(height: 28),
                  const VtWizardSignaturesCard(),
                ],
              ],
            ),
          ),
        if (widget.showBottomBar) ...[
          const SizedBox(height: 24),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: widget.onBack,
                icon: const Icon(Icons.arrow_back_rounded, size: 16),
                label: Text(
                  widget.isFirst
                      ? const LocalizedText(fr: 'Annuler', en: 'Cancel')
                          .of(locale)
                      : const LocalizedText(
                              fr: 'Étape Précédente', en: 'Previous')
                          .of(locale),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: kVtWizardInkSoft,
                  side: const BorderSide(color: kVtWizardCardBorder),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                ),
              ),
              const Spacer(),
              if (widget.onSaveAndExit != null) ...[
                OutlinedButton.icon(
                  onPressed: widget.onSaveAndExit,
                  icon: const Icon(Icons.save_outlined, size: 16),
                  label: Text(
                    const LocalizedText(
                      fr: 'Enregistrer et quitter',
                      en: 'Save and exit',
                    ).of(locale),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: kVtWizardInkSoft,
                    side: const BorderSide(color: kVtWizardCardBorder),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 12),
                  ),
                ),
                const SizedBox(width: 12),
              ],
              ElevatedButton.icon(
                onPressed: widget.onNext,
                icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                label: Text(
                  widget.isLast
                      ? const LocalizedText(
                          fr: 'Passer à la Validation',
                          en: 'Proceed to Validation',
                        ).of(locale)
                      : const LocalizedText(
                          fr: 'Suivant',
                          en: 'Next Step',
                        ).of(locale),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                iconAlignment: IconAlignment.end,
                style: ElevatedButton.styleFrom(
                  backgroundColor: kAccent,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6)),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
