// lib/screens/onefop/simple_mode_shell.dart
//
// Desktop "Simple Mode" — the guided, low-cognitive-load alternative to
// OnefopExcelShell's spreadsheet chrome (see onefop_mode_provider.dart).
// Phase 1 only: reuses the exact same per-unit navigation model
// (onefop_section_units.dart) both OnefopExcelShell and mobile's
// _sectionUnitBody already use — same OnefopFormController, same cell
// IDs, same validation/autosave — just larger, more guided chrome around
// it. The fine-grained "one cell-group per screen" flow is a later phase;
// this shows the real current table/question, not a placeholder.
//
// buildField is supplied by the caller (the screen's own _buildField)
// rather than duplicated here, so simple-field rendering can never drift
// between Simple Mode and the mobile layout that already renders them.

import 'package:flutter/material.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/schema/section_schema.dart';
import '../../providers/onefop_mode_provider.dart';
import 'onefop_form_constants.dart';
import 'onefop_form_controller.dart';
import 'onefop_form_widgets.dart' show OnefopShellTitleBar;
import 'onefop_section_units.dart';

class SimpleModeShell extends StatelessWidget {
  final OnefopFormController ctrl;
  final EntityType entityType;
  final Widget Function(FieldSchema) buildField;
  final Future<void> Function() onPreviewSubmit;
  // Title bar — mirrors OnefopExcelShell's own single title bar (see
  // OnefopShellTitleBar) so both desktop modes render exactly the same
  // one-app-bar/one-logo chrome instead of Simple Mode also keeping the
  // outer Scaffold app bar around it.
  final String title;
  final bool dirty;
  final bool saving;
  final Future<void> Function()? onSaveNow;
  final VoidCallback? onOpenDrafts;
  final VoidCallback? onCancel;
  final OnefopViewMode mode;
  final void Function(OnefopViewMode) onModeChanged;
  const SimpleModeShell({
    super.key,
    required this.ctrl,
    required this.entityType,
    required this.buildField,
    required this.onPreviewSubmit,
    required this.title,
    required this.dirty,
    required this.saving,
    required this.mode,
    required this.onModeChanged,
    this.onSaveNow,
    this.onOpenDrafts,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final sec = ctrl.primarySection(ctrl.currentPage);

    Widget body = const SizedBox.shrink();
    if (sec != null) {
      // mobile: true — Simple Mode wants the guided card-style table
      // rendering (MobileCardTable) regardless of screen width; the dense
      // spreadsheet grid is Spreadsheet Mode's job, not Simple Mode's.
      final units = buildTableGroupUnits(
        ctrl,
        sec,
        locale,
        entityType: entityType,
        simpleFieldsBuilder: (fields, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [for (final f in fields) buildField(f)],
        ),
        mobile: true,
        squareCorners: true,
        // Pin the current question's paperCode/text above the scroll (see
        // _UnitBody) instead of letting it scroll away with the category
        // cards under it — the whole point of a long, freely-scrollable
        // card list is that the user shouldn't lose track of which
        // question those cards belong to partway down it.
        separateHeader: true,
      );
      if (units.isNotEmpty) {
        body = _UnitBody(
          ctrl: ctrl,
          section: sec,
          units: units,
          onPreviewSubmit: onPreviewSubmit,
        );
      }
    }

    // No section-label header of its own here — the Sidebar's highlighted
    // item already shows the current section; a second "Répondant" bar
    // just repeated in the body was pure redundant chrome.
    return Column(
      children: [
        OnefopShellTitleBar(
          title: title,
          leadingIcon: Icons.checklist_rtl_rounded,
          dirty: dirty,
          saving: saving,
          onSaveNow: onSaveNow,
          onOpenDrafts: onOpenDrafts,
          onCancel: onCancel,
          mode: mode,
          onModeChanged: onModeChanged,
        ),
        Expanded(
          child: Container(color: kCanvas, child: body),
        ),
      ],
    );
  }
}

/// Reads the live unit list/cursor on every rebuild (the screen already
/// rebuilds on controller notifyListeners — see _onControllerChange), so
/// this stays a plain StatelessWidget with no extra listening of its own.
class _UnitBody extends StatelessWidget {
  final OnefopFormController ctrl;
  final SectionSchema section;
  final List<SectionUnit> units;
  final Future<void> Function() onPreviewSubmit;
  const _UnitBody({
    required this.ctrl,
    required this.section,
    required this.units,
    required this.onPreviewSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final currentIdx = (ctrl.unitCursor(section.id) ?? currentUnitIndex(ctrl, units))
        .clamp(0, units.length - 1);
    final unit = units[currentIdx];
    final isFirst = currentIdx == 0;
    final isLast = currentIdx == units.length - 1;
    // True end of the whole form — the last unit of the last section, past
    // which there is no next unit or next page to advance/cross into. This
    // is the only place Simple Mode can offer Submit at all (unlike
    // Spreadsheet Mode's OnefopExcelShell and mobile's _navBar(), Simple
    // Mode has no page-level action bar of its own), so without this the
    // Next button simply disappears once the form is fully filled in,
    // leaving no way to submit.
    final isFormEnd = isLast && ctrl.currentPage == ctrl.pageCount - 1;

    ctrl.setRevealedFieldIds(unit.fieldIds);
    ctrl.setRevealBoundaryActions(
      forward: isFormEnd
          ? () => onPreviewSubmit()
          : isLast
              ? () => advanceToNextSection(ctrl)
              : () => advanceToUnit(ctrl, section, units, currentIdx),
      backward: isFirst
          ? () => retreatToPreviousSection(ctrl)
          : () => retreatToUnit(ctrl, section, units, currentIdx),
    );

    return Column(
      children: [
        // The subsection caption, question header, and table all travel
        // together inside the same centered block now (see below) instead
        // of being pinned above the scroll — so a short unit centers as
        // one group with no gap opening up between its pieces. The
        // tradeoff: for a unit tall enough to actually scroll, the caption
        // and header scroll away with it instead of staying pinned. Only
        // UnitNavRow stays a real fixed footer, outside this Column
        // entirely, since a control the user taps every unit needs a
        // stable position, not one that moves with content height.
        Expanded(
          child: LayoutBuilder(
            builder: (context, viewport) {
              const scrollPadV = 24.0 + 24.0;
              return SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  // Gives the Center below a height to work with: when the
                  // current unit is shorter than the viewport, the leftover
                  // space splits evenly above and below the whole block,
                  // centering it. Taller content just grows past this
                  // minimum and scrolls from the top, same as plain
                  // scrolling content always does.
                  constraints: BoxConstraints(
                    minHeight: (viewport.maxHeight - scrollPadV)
                        .clamp(0.0, double.infinity),
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: kSimpleModeContentWidth),
                      child: KeyedSubtree(
                        key: ctrl.keyForUnit(unit.key),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (unit.subsectionLabel != null)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: Text(
                                  unit.subsectionLabel!,
                                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: kInkFaint, letterSpacing: 0.02),
                                ),
                              ),
                            if (unit.header != null) unit.header!(),
                            UnitTransition(
                              child: KeyedSubtree(key: ValueKey(unit.key), child: unit.content()),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        UnitNavRow(
          large: true,
          contentMaxWidth: kSimpleModeContentWidth,
          // This widget owns no other page-level control of its own (no
          // bottom action bar) — the desktop Sidebar (added one level up,
          // in _desktopLayout) can jump straight to a section, but moving
          // unit-by-unit within/across sections is still only this row, so
          // it has to keep showing (and crossing into the next/previous
          // section) past this section's own last/first unit rather than
          // stopping there. See advanceToNextSection/retreatToPreviousSection.
          showBack: !isFirst || ctrl.currentPage > 0,
          onBack: () => isFirst
              ? retreatToPreviousSection(ctrl)
              : retreatToUnit(ctrl, section, units, currentIdx),
          // At the true form end there's no further unit/page to advance
          // into, so this becomes the Submit action instead of disappearing
          // — see isFormEnd above. Submit is gated on the whole form's
          // validity (mirrors OnefopExcelShell's _BottomActionBar and the
          // page-level NavBar), not just this last unit's own fields.
          showNext: true,
          isSubmit: isFormEnd,
          nextEnabled: isFormEnd ? ctrl.validateAllPages() : unit.canAdvance(ctrl),
          onNext: () => isFormEnd
              ? onPreviewSubmit()
              : isLast
                  ? advanceToNextSection(ctrl)
                  : advanceToUnit(ctrl, section, units, currentIdx),
        ),
      ],
    );
  }
}
