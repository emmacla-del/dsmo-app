// lib/screens/onefop/excel/onefop_excel_shell.dart
//
// Desktop-only Excel/spreadsheet chrome for the ONEFOP questionnaire —
// title bar, formula bar, section body, bottom sheet-tabs. Swapped in by
// _desktopLayout() in onefop_unified_form_screen_v4.dart; the mobile
// layout in that same file is untouched and never builds this widget.
//
// This shell owns no form state of its own — everything reads/writes
// through the same OnefopFormController the mobile layout uses
// (ctrl.next/prev/goto, ctrl.valid, ctrl.missingLabels, ...), so autosave,
// validation, and the preview/submit flow all behave identically to the
// existing card-based desktop layout it replaces.

import 'package:flutter/material.dart';

import '../../../core/focus/renderers/table_size_scope.dart';
import '../../../providers/onefop_mode_provider.dart';
import '../onefop_form_constants.dart';
import '../onefop_form_controller.dart';
import '../onefop_form_widgets.dart' show OnefopShellTitleBar, Sidebar;
import 'onefop_excel_field_rows.dart';

class OnefopExcelShell extends StatefulWidget {
  final OnefopFormController ctrl;
  final EntityType entityType;
  final String title;
  final Future<void> Function() onPreviewSubmit;
  final VoidCallback? onOpenDrafts;
  final VoidCallback? onCancel;
  final OnefopViewMode mode;
  final void Function(OnefopViewMode) onModeChanged;
  final List<OnefopViewMode>? availableModes;

  const OnefopExcelShell({
    super.key,
    required this.ctrl,
    required this.entityType,
    required this.title,
    required this.onPreviewSubmit,
    required this.mode,
    required this.onModeChanged,
    this.availableModes,
    this.onOpenDrafts,
    this.onCancel,
  });

  @override
  State<OnefopExcelShell> createState() => _OnefopExcelShellState();
}

class _OnefopExcelShellState extends State<OnefopExcelShell> {
  // Created once for this shell's whole lifetime (not per section/table
  // navigation — ExcelSectionBody is rebuilt far more often than this
  // State is), so a row-height/column-width resize made
  // on one question's table stays in effect for the rest of the session
  // instead of resetting every time the user moves to another table —
  // see TableSizeScope's own doc comment.
  final _tableSize = TableSizeController();

  @override
  void dispose() {
    _tableSize.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = widget.ctrl;
    final idxs = ctrl.sectionIndicesForPage(ctrl.currentPage);
    final section = idxs.isEmpty ? null : ctrl.schema!.sections[idxs.first];

    return Container(
      color: kSurface,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Section navigation lives here now — a collapsible vertical
          // list (see Sidebar in onefop_form_widgets.dart) replaces the
          // old horizontal section-tabs row that used to sit at the
          // bottom of _SheetTabsBar/_SheetTab, which is gone.
          Sidebar(ctrl: ctrl, entityType: widget.entityType),
          Container(width: 1, color: kBorder),
          Expanded(
            child: Column(
              children: [
                OnefopShellTitleBar(
                  title: widget.title,
                  leadingIcon: Icons.grid_on_rounded,
                  dirty: ctrl.dirty,
                  saving: ctrl.saving,
                  saveFailed: ctrl.saveFailed,
                  lastSavedAt: ctrl.lastSavedAt,
                  onSaveNow: ctrl.saveNow,
                  onOpenDrafts: widget.onOpenDrafts,
                  onCancel: widget.onCancel,
                  mode: widget.mode,
                  onModeChanged: widget.onModeChanged,
                  availableModes: widget.availableModes,
                ),
                Expanded(
                  child: section == null
                      ? const SizedBox.shrink()
                      // ExcelSectionBody now owns its own pinned-header +
                      // scroll layout (so the question can stay pinned
                      // above the scrolling table — see its build()),
                      // rather than being handed an already-built
                      // scroll view here. TableSizeScope makes every
                      // GridLayoutEngine table underneath — real tables
                      // and the simple-fields grid alike — uniformly
                      // resizable by dragging a row/column boundary; see
                      // grid_layout_engine.dart's own resize-handle code.
                      : TableSizeScope(
                          controller: _tableSize,
                          child: ExcelSectionBody(
                            ctrl: ctrl,
                            section: section,
                            entityType: widget.entityType,
                            onPreviewSubmit: widget.onPreviewSubmit,
                          ),
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
