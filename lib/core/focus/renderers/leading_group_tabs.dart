// lib/core/focus/renderers/leading_group_tabs.dart
//
// Mobile-only alternative rendering for a leadingGroup GridRenderSpec
// (see TableRenderer.renderTable and GridRenderSpec.splitByLeadingGroup)
// — a Permanent/Temporaire-style tab row switches which group's compact
// grid is shown, instead of stacking every group's output one after
// another (which desktop still does, via boxed mini-tables with a header
// band each).
//
// The selected tab is local widget state only — it never touches cell
// IDs, controller data, or the section-unit cursor, so autosave, the
// recalc engine, validation, coherence checks, and unit navigation are
// all completely unaffected by which tab happens to be active. Only the
// selected group's GenericSpreadsheetTable is ever built/mounted, same
// "one thing mounted at a time" principle as the section-unit reveal.

import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../unified_focus_manager_v2.dart';
import 'generic_spreadsheet_table.dart';
import 'grid_render_spec.dart';
import 'grid_theme.dart';
import 'onefop_layout_constants.dart';

class LeadingGroupTabs extends StatefulWidget {
  final List<({String label, GridRenderSpec spec})> groups;
  final String prefix;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final void Function(String, int?) onNumberChanged;
  final void Function(String, String) onTextChanged;
  final UnifiedFocusManagerV2 focusManager;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;
  final TextEditingController Function(String)? hybridController;

  const LeadingGroupTabs({
    super.key,
    required this.groups,
    required this.prefix,
    required this.numberValues,
    required this.textValues,
    required this.onNumberChanged,
    required this.onTextChanged,
    required this.focusManager,
    this.onExitTable,
    this.onExitPrevious,
    this.hybridController,
  });

  @override
  State<LeadingGroupTabs> createState() => _LeadingGroupTabsState();
}

class _LeadingGroupTabsState extends State<LeadingGroupTabs> {
  int _selected = 0;

  @override
  Widget build(BuildContext context) {
    final groups = widget.groups;
    final selected = _selected.clamp(0, groups.length - 1);
    final active = groups[selected];
    final tableId = '${widget.prefix}_g$selected';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            for (int i = 0; i < groups.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: _TabButton(
                  label: groups[i].label,
                  selected: i == selected,
                  onTap: () => setState(() => _selected = i),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 10),
        Center(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Container(
              // foregroundDecoration, not decoration — GenericSpreadsheetTable
              // draws its own outer frame as straight, un-rounded rects (see
              // grid_layout_engine.dart); clipped by the ClipRRect above,
              // those stop short of the actual corner curve while the flush
              // cell fill beneath still reaches it, reading as a border that
              // doesn't wrap around the corner. Painting this border last
              // (on top, via foregroundDecoration) instead of first (behind
              // the table, via decoration) means it's the last thing drawn
              // at every pixel — Flutter's own rounded-rect border painter
              // traces a real curve here, always covering that gap.
              foregroundDecoration: BoxDecoration(
                // Black, matching the GenericSpreadsheetTable it wraps —
                // that table always paints GridTheme.borderColor (real
                // black) gridlines, so a softer OL.borderColor frame here
                // would show as a two-tone seam at the edge.
                border: Border.all(color: GridTheme.borderColor),
                borderRadius: BorderRadius.circular(10),
              ),
              // Re-keyed per selected group so switching tabs mounts a
              // fresh table instead of GenericSpreadsheetTable trying to
              // diff two entirely different specs under one Element.
              child: GenericSpreadsheetTable(
                key: ValueKey(tableId),
                spec: active.spec,
                numberValues: widget.numberValues,
                textValues: widget.textValues,
                onNumberChanged: widget.onNumberChanged,
                onTextChanged: widget.onTextChanged,
                focusManager: widget.focusManager,
                tableId: tableId,
                onExitTable: widget.onExitTable,
                onExitPrevious: widget.onExitPrevious,
                hybridController: widget.hybridController,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _TabButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _TabButton({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected
              ? AppColors.deepEmerald.withValues(alpha: 0.10)
              : Colors.transparent,
          border: Border.all(
            color: selected ? AppColors.deepEmerald : OL.borderColor,
            width: selected ? 1.5 : 1,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? AppColors.deepEmerald : AppColors.silver,
          ),
        ),
      ),
    );
  }
}
