// lib/screens/onefop/excel/onefop_excel_field_rows.dart
//
// Excel/spreadsheet-style row primitives for simple (non-table) ONEFOP
// fields — used only by the desktop Excel shell (onefop_excel_shell.dart).
// Mobile is untouched; this file has no mobile code path.
//
// Colors are the ONEFOP form's own existing design tokens
// (onefop_form_constants.dart: kAccent, kCanvas, kBorder, kInk, ...) —
// the same deep-emerald palette used everywhere else in this app, not a
// separate Excel-green theme.
//
// The simple-fields grid (_SimpleFieldsTable below) renders through the
// same GridLayoutEngine/GridTheme single-pass gridline painter as the
// table-type fields (see core/focus/renderers/generic_spreadsheet_table
// .dart) — same borderColor, same row-height model, same rendering
// mechanism — so this section matches the table sections in both look
// and gridline quality instead of drawing its own per-cell borders.
//
// Writes go through the SAME OnefopFormController mutation API the
// existing SimpleField/SelectField/RadioField widgets already use
// (onFieldChanged/onSelectChanged/setRadioValue) — no new state, no
// duplicated validation/autosave logic. Table-type fields are not
// handled here at all; the section walker below hands them to the
// existing TableRenderer.renderTable(mobile: false, ...), which already
// produces a desktop-shaped spreadsheet grid.
//
// VT tables are the one exception (VT-UIUX-02 desktop gap fix): they
// reach ExcelSectionBody's simpleFieldsBuilder (not addTableUnit/
// TableRenderer — see onefop_section_units.dart's isVtTable branch), and
// _SimpleFieldsTable below has no way to render them (VT cells write to
// synthesized per-cell ids, not field.id, so ExcelValueCell's
// `ctrl.ctrl[field.id]` is always null and the row renders empty) — the
// section walker below detects this case and resolves the field's
// VtTableDef directly, handing it to VtSpreadsheetTable (a real
// GridLayoutEngine grid — see core/focus/renderers/vt_spreadsheet_table
// .dart) instead of building a _SimpleFieldsTable for it. Mobile still
// goes through VtTableFieldWidget/VtRowEditor's tap-a-row/bottom-sheet
// editor (onefop_unified_form_screen_v4.dart's _buildField) — this is a
// desktop-only second rendering of the exact same VtTableDef/ctrl.data,
// not a replacement of the mobile path.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/focus/schema/field_schema.dart';
import '../../../core/focus/schema/section_schema.dart';
import '../../../core/focus/renderers/grid_layout_engine.dart';
import '../../../core/focus/renderers/grid_theme.dart';
import '../../../core/focus/renderers/vt_routing.dart';
import '../../../core/focus/renderers/vt_spreadsheet_table.dart';
import '../wizard/vt_scope_quiz.dart';
import '../../../core/focus/renderers/vt_table_defs.dart';
import '../onefop_form_constants.dart';
import '../onefop_form_controller.dart';
import '../onefop_form_widgets.dart' show RadioOption, keyboardType, pairShortFields;
import '../onefop_section_units.dart';

const _monoStyle = TextStyle(
  fontFamily: 'Consolas',
  fontFamilyFallback: ['Courier New', 'monospace'],
);

// ── Value cell ───────────────────────────────────────────────────

/// The value cell — dispatches to a text input, a numeric input, or a
/// dropdown depending on the field's type, all wired to the SAME
/// controller mutation methods the existing card-style widgets use.
class ExcelValueCell extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  // Checkbox fields only — the exact row height _SimpleFieldsTable
  // computed for this row (see _measureCheckboxHeight), passed through so
  // _ExcelCheckboxInput can impose a real bound of its own rather than
  // trusting GridLayoutEngine's cell wrapper to constrain it (it doesn't;
  // see the call site's own comment).
  final double? maxHeight;
  const ExcelValueCell({
    super.key,
    required this.ctrl,
    required this.field,
    this.maxHeight,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final hasError = ctrl.hasError(field);
    late final Widget input;

    if (field.type == 'select' || field.type == 'radio') {
      input = _ExcelSelectInput(ctrl: ctrl, field: field, locale: locale);
    } else if (field.type == 'checkbox') {
      final opts = field.optionsI18n ?? const [];
      // 3+ options used to mean a tall inline checklist whose own row
      // height was only ever an estimate (_measureCheckboxHeight) —
      // when that estimate ran short, the fallback SingleChildScrollView
      // it needed sat nested inside the page's own outer scroll view
      // (ExcelSectionBody, controller: ctrl.mainScroll), trapping the
      // user's scroll gesture inside the tiny checklist instead of the
      // page. A closed dropdown control has a fixed, single-line height
      // like every other cell type, so it never needs that estimate or
      // that nested scroll at all. 1-2 option fields stay inline — never
      // tall enough to hit the problem in the first place.
      input = opts.length >= 3
          ? _ExcelCheckboxDropdown(ctrl: ctrl, field: field, locale: locale)
          : _ExcelCheckboxInput(
              ctrl: ctrl, field: field, locale: locale, maxHeight: maxHeight);
    } else {
      input = _ExcelTextInput(ctrl: ctrl, field: field);
    }

    // The left red bar is a validation accent, not a gridline — grid
    // borders themselves come from GridLayoutEngine's single-pass
    // painter (see _SimpleFieldsTable), so this only ever adds the
    // extra error indicator, never a competing border.
    if (!hasError) return input;
    return Container(
      decoration: const BoxDecoration(
        border: Border(left: BorderSide(color: kDanger, width: 2)),
      ),
      child: input,
    );
  }
}

class _ExcelTextInput extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const _ExcelTextInput({required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
    final c = ctrl.ctrl[field.id];
    final fn = ctrl.fm.getNode(field.id);
    final isNumeric = field.type == 'number';
    if (c == null) return const SizedBox.shrink();

    return TextField(
      controller: c,
      focusNode: fn,
      keyboardType: keyboardType(field.type),
      textAlign: isNumeric ? TextAlign.right : TextAlign.left,
      inputFormatters: [
        if (field.type == 'number') FilteringTextInputFormatter.digitsOnly,
        if (field.type == 'tel') ...[
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(9),
        ],
      ],
      style: isNumeric
          ? _monoStyle.copyWith(fontSize: 13.5, color: kInk)
          : const TextStyle(fontSize: 13.5, color: kInk),
      decoration: const InputDecoration(
        isDense: true,
        filled: true,
        fillColor: kSurface,
        contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        border: InputBorder.none,
        // Same gap as vt_spreadsheet_table.dart's cells had: the app's
        // global InputDecorationTheme (app_theme.dart) sets a rounded
        // `enabledBorder`, and InputDecoration.applyDefaults only fills
        // in whichever border variant is still null — overriding `border`
        // alone leaves the resting/unfocused state (what a cell shows
        // almost all the time) picking up that rounded default instead.
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
      ),
      onTapOutside: (_) => ctrl.onBlur(field.id),
      onSubmitted: (_) {
        ctrl.onBlur(field.id);
        ctrl.focusFieldOffset(1);
      },
    );
  }
}

class _ExcelSelectInput extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  final Locale locale;
  const _ExcelSelectInput({required this.ctrl, required this.field, required this.locale});

  @override
  Widget build(BuildContext context) {
    final opts = field.optionsI18n ?? [];
    final cur = ctrl.data[field.id] as String?;

    final isShortRadio = field.type == 'radio' && opts.length >= 2 && opts.length <= 3;
    if (isShortRadio) {
      // For Oui/Non fields: when a keyboard user arrives on an unanswered
      // cell, pre-select Non so that conditional follow-ups (gated on
      // Oui throughout this AST) are never auto-revealed by mere Tab
      // navigation — same behaviour the old YesNoToggle had.
      final isOuiNon =
          opts.any((o) => o.value == 'Oui/ Yes') && opts.any((o) => o.value == 'Non/ No');
      return Focus(
        focusNode: ctrl.fm.getNode(field.id),
        onFocusChange: (gained) {
          if (gained && isOuiNon && ctrl.data[field.id] == null) {
            ctrl.setRadioValue(field, 'Non/ No');
          }
        },
        onKeyEvent: (node, event) {
          if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.enter) {
            ctrl.focusFieldOffset(1);
            return KeyEventResult.handled;
          }
          return KeyEventResult.ignored;
        },
        child: Container(
          color: kSurface,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          alignment: Alignment.centerLeft,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (int i = 0; i < opts.length; i++) ...[
                RadioOption(
                  label: opts[i].text.of(locale),
                  isSelected: cur == opts[i].value,
                  onTap: () {
                    ctrl.fm.focus(field.id);
                    ctrl.setRadioValue(field, opts[i].value);
                  },
                ),
                if (i < opts.length - 1) const SizedBox(width: 16),
              ],
            ],
          ),
        ),
      );
    }

    return Container(
      color: kSurface,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: opts.any((o) => o.value == cur) ? cur : null,
          isExpanded: true,
          isDense: true,
          hint: Text(
            locale.languageCode == 'en' ? '— select —' : '— sélectionner —',
            style: const TextStyle(fontSize: 13.5, color: kInkFaint),
          ),
          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: kInkFaint),
          style: const TextStyle(fontSize: 13.5, color: kInk),
          items: [
            for (final o in opts)
              DropdownMenuItem(value: o.value, child: Text(o.text.of(locale))),
          ],
          onChanged: (v) {
            if (v == null) return;
            if (field.type == 'radio') {
              ctrl.setRadioValue(field, v);
            } else {
              ctrl.onSelectChanged(field, v);
            }
          },
        ),
      ),
    );
  }
}

/// AstFieldType.checkbox (multi-select) — before this, ExcelValueCell had
/// no case for it at all, so it fell through to _ExcelTextInput: a bare
/// TextField backed by a TextEditingController seeded from
/// `_data[field.id]?.toString()` (a List's Dart toString, e.g.
/// "[Autres/ Others]"), with no way to actually select/deselect an option
/// and typing into it never round-tripping back into the String[] shape
/// CheckboxGroupField/the backend expect — this is the checkbox-typed
/// field (VT9_2, and any other checkbox field reachable from the desktop
/// Excel shell) users reported as effectively not appearing. Renders as a
/// vertical checklist rather than CheckboxOption's horizontal chips (the
/// chip's own reference width assumes a wide mobile card, not a
/// spreadsheet cell) — same toggle semantics as CheckboxGroupField
/// (ctrl.setRawValue, empty selection clears the field), so this is only
/// a compact visual variant, not a second mutation path.
class _ExcelCheckboxInput extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  final Locale locale;
  // The row height _SimpleFieldsTable computed for this field (see
  // _measureCheckboxHeight). GridLayoutEngine's own cell wrapper never
  // actually enforces this — see the call site's comment — so this widget
  // has to impose the bound itself via SizedBox below, or nothing does.
  final double? maxHeight;
  const _ExcelCheckboxInput({
    required this.ctrl,
    required this.field,
    required this.locale,
    this.maxHeight,
  });

  List<String> _current() {
    final raw = ctrl.data[field.id];
    if (raw is List) return raw.map((e) => e.toString()).toList();
    return const [];
  }

  void _toggle(String value) {
    // Registers this field as "the active one" the same way every other
    // cell's own tap handler already does (ctrl.fm.focus) — without it, a
    // following Enter/Tab press wouldn't know a click just happened here.
    ctrl.fm.focus(field.id);
    final cur = _current();
    final next = cur.contains(value)
        ? (List<String>.from(cur)..remove(value))
        : (List<String>.from(cur)..add(value));
    ctrl.setCheckboxValues(field, next.isEmpty ? null : next);
  }

  @override
  Widget build(BuildContext context) {
    final opts = field.optionsI18n ?? const [];
    final cur = _current();

    final list = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final o in opts)
          InkWell(
            onTap: () => _toggle(o.value),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 1.5),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    cur.contains(o.value)
                        ? Icons.check_box_rounded
                        : Icons.check_box_outline_blank_rounded,
                    size: 16,
                    color: cur.contains(o.value) ? kAccent : kInkFaint,
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(o.text.of(locale),
                        style: const TextStyle(fontSize: 13, color: kInk)),
                  ),
                ],
              ),
            ),
          ),
      ],
    );

    // Live-reported (VT3_2, 10 options): GridLayoutEngine's own cell
    // Container(alignment: cell.alignment) loosens the constraints it
    // hands down to every cell's child, so nothing above this widget ever
    // actually bounds its height — Alignment.centerLeft alone (the old
    // version of this widget) let the checklist grow past the row
    // GridLayoutEngine had already committed to, painting the debug
    // RenderFlex-overflow banner right over the row below instead of
    // being clipped. The outer SizedBox is what makes maxHeight (already
    // inclusive of this Container's own vertical padding — see
    // _measureCheckboxHeight) a *real* total bound; a
    // SingleChildScrollView inside it means a height estimate that's
    // still slightly short scrolls instead of hiding an option (checkbox
    // 10, "Fires", was unreachable under the old ClipRect-only version)
    // — correctness over a cosmetic short-by-a-few-px cell.
    final container = Container(
      color: kSurface,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      child: maxHeight == null
          ? Align(alignment: Alignment.centerLeft, child: list)
          : Align(
              alignment: Alignment.topLeft,
              child: SingleChildScrollView(child: list),
            ),
    );
    final bounded = maxHeight == null
        ? container
        : SizedBox(height: maxHeight, child: container);

    // No onFocusChange default here, unlike the Yes/No cell above — an
    // open multi-select checklist has no single sensible "default
    // answer" to pre-check. Enter still just advances to the next cell.
    return Focus(
      focusNode: ctrl.fm.getNode(field.id),
      onKeyEvent: (node, event) {
        if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.enter) {
          ctrl.focusFieldOffset(1);
          return KeyEventResult.handled;
        }
        return KeyEventResult.ignored;
      },
      child: bounded,
    );
  }
}

/// AstFieldType.checkbox with 3+ options — see the dispatch comment in
/// ExcelValueCell.build() for the nested-scroll problem this replaces.
/// Same List<String> storage/toggle semantics as _ExcelCheckboxInput
/// (ctrl.setCheckboxValues, empty selection clears the field), just shown
/// as a closed, single-line MenuAnchor dropdown instead of an inline
/// checklist, so the row is a fixed height like every other cell type and
/// never needs a maxHeight/scroll-fallback of its own. Stateful (unlike
/// its stateless siblings in this file) because it owns a MenuController.
class _ExcelCheckboxDropdown extends StatefulWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  final Locale locale;
  const _ExcelCheckboxDropdown({
    required this.ctrl,
    required this.field,
    required this.locale,
  });

  @override
  State<_ExcelCheckboxDropdown> createState() => _ExcelCheckboxDropdownState();
}

class _ExcelCheckboxDropdownState extends State<_ExcelCheckboxDropdown> {
  final _menuController = MenuController();

  List<String> _current() {
    final raw = widget.ctrl.data[widget.field.id];
    if (raw is List) return raw.map((e) => e.toString()).toList();
    return const [];
  }

  void _toggle(String value) {
    // Same "register as active field" reason _ExcelCheckboxInput._toggle
    // already has — without it a following Enter/Tab wouldn't know a tap
    // just happened here.
    widget.ctrl.fm.focus(widget.field.id);
    final cur = _current();
    final next = cur.contains(value)
        ? (List<String>.from(cur)..remove(value))
        : (List<String>.from(cur)..add(value));
    widget.ctrl.setCheckboxValues(widget.field, next.isEmpty ? null : next);
  }

  // A raw comma-join of every selected label could grow the closed
  // control's text arbitrarily long (and, before the maxLines/ellipsis
  // backstop below, the row with it) — showing the first couple of labels
  // plus a "+N" tail keeps the summary legible and bounded without needing
  // to measure actual rendered width against the cell.
  String _summary(List<String> cur) {
    final opts = widget.field.optionsI18n ?? const [];
    final labels = [
      for (final o in opts)
        if (cur.contains(o.value)) o.text.of(widget.locale),
    ];
    if (labels.isEmpty) return '';
    if (labels.length <= 2) return labels.join(', ');
    return '${labels.take(2).join(', ')} +${labels.length - 2}';
  }

  @override
  Widget build(BuildContext context) {
    final opts = widget.field.optionsI18n ?? const [];
    final cur = _current();
    final summary = _summary(cur);

    return MenuAnchor(
      controller: _menuController,
      // Square corners, thin kBorder outline, flat — matches the app's
      // established institutional tone (no Material-3 rounded/elevated
      // "SaaS" surface), and a bounded maximumSize so a long option list
      // (VT3_2, 10 options) scrolls inside this floating panel rather
      // than growing past the viewport — scrolling here is harmless: the
      // panel is an overlay above the page, not nested inside
      // ExcelSectionBody's own SingleChildScrollView the way the old
      // inline checklist's fallback was.
      style: const MenuStyle(
        backgroundColor: WidgetStatePropertyAll(kSurface),
        surfaceTintColor: WidgetStatePropertyAll(Colors.transparent),
        elevation: WidgetStatePropertyAll(2),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(side: BorderSide(color: kBorder)),
        ),
        padding: WidgetStatePropertyAll(EdgeInsets.symmetric(vertical: 4)),
        maximumSize: WidgetStatePropertyAll(Size(360, 320)),
      ),
      menuChildren: [
        for (final o in opts)
          MenuItemButton(
            // Multi-select: toggling one option must not close the menu,
            // unlike a normal (single-select) menu item's default.
            closeOnActivate: false,
            style: MenuItemButton.styleFrom(
              shape: const RoundedRectangleBorder(),
              foregroundColor: kInk,
              textStyle: const TextStyle(fontSize: 13),
            ),
            leadingIcon: Icon(
              cur.contains(o.value)
                  ? Icons.check_box_rounded
                  : Icons.check_box_outline_blank_rounded,
              size: 16,
              color: cur.contains(o.value) ? kAccent : kInkFaint,
            ),
            onPressed: () => _toggle(o.value),
            child: Text(o.text.of(widget.locale)),
          ),
      ],
      builder: (context, controller, child) {
        return Focus(
          focusNode: widget.ctrl.fm.getNode(widget.field.id),
          // Only reachable while the menu is closed: MenuAnchor moves
          // focus onto its own MenuItemButtons (a separate FocusScope)
          // once open, so Arrow Up/Down between options and Space/Enter
          // to toggle the highlighted one are Flutter's own built-in menu
          // traversal, not anything wired here — confirmed by the widget
          // test (opening the menu and sending ArrowDown must not move
          // ctrl.fm.activeId).
          onKeyEvent: (node, event) {
            if (event is! KeyDownEvent) return KeyEventResult.ignored;
            final key = event.logicalKey;
            if (key == LogicalKeyboardKey.enter) {
              // Same "Enter always advances" contract every other cell
              // type has (text/Yes-No/inline checkbox) — a closed combo
              // box opens via Down/Space instead, the standard combobox
              // convention, so Enter is never overloaded with two
              // meanings depending on state.
              if (controller.isOpen) controller.close();
              widget.ctrl.focusFieldOffset(1);
              return KeyEventResult.handled;
            }
            if (!controller.isOpen &&
                (key == LogicalKeyboardKey.space ||
                    key == LogicalKeyboardKey.arrowDown)) {
              widget.ctrl.fm.focus(widget.field.id);
              controller.open();
              return KeyEventResult.handled;
            }
            if (controller.isOpen && key == LogicalKeyboardKey.escape) {
              controller.close();
              return KeyEventResult.handled;
            }
            return KeyEventResult.ignored;
          },
          child: InkWell(
            onTap: () {
              widget.ctrl.fm.focus(widget.field.id);
              if (controller.isOpen) {
                controller.close();
              } else {
                controller.open();
              }
            },
            child: Container(
              color: kSurface,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              alignment: Alignment.centerLeft,
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      summary.isEmpty
                          ? (widget.locale.languageCode == 'en'
                              ? '— select —'
                              : '— sélectionner —')
                          : summary,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13.5,
                        color: summary.isEmpty ? kInkFaint : kInk,
                      ),
                    ),
                  ),
                  Icon(
                    controller.isOpen
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 18,
                    color: controller.isOpen ? kAccent : kInkFaint,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

// ── Section walker ───────────────────────────────────────────────

/// Renders one full section as a single active unit — a spreadsheet-style
/// grid of rows for a run of simple fields, or one reused desktop table
/// grid for a table field — grouped by subsection exactly the way the
/// shared unit model groups them (see buildTableGroupUnits in
/// onefop_section_units.dart). Only the current unit is ever mounted;
/// advancing/retreating swaps it via UnitTransition and scrolls the new
/// one into view top-first (OnefopFormController.scrollToUnit) — no
/// manual scrolling needed to reach a freshly-revealed table.
class ExcelSectionBody extends StatelessWidget {
  final OnefopFormController ctrl;
  final SectionSchema section;
  final EntityType entityType;
  final Future<void> Function() onPreviewSubmit;
  const ExcelSectionBody({
    super.key,
    required this.ctrl,
    required this.section,
    required this.entityType,
    required this.onPreviewSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final units = buildTableGroupUnits(
      ctrl,
      section,
      locale,
      entityType: entityType,
      simpleFieldsBuilder: (fields, startRow) {
        // buildTableGroupUnits' own unit-boundary logic
        // (onefop_section_units.dart's isVtTable branch) always isolates a
        // VT table field into its own singleton unit — never mixed with
        // ordinary fields in the same simpleFieldsBuilder call — so a
        // length-1, vt_-templated list here always means "this whole unit
        // is one VT table," never "one VT field among several ordinary
        // ones." Desktop gets the real spreadsheet-grid rendering
        // (VtSpreadsheetTable) here instead of VtTableFieldWidget's
        // mobile-shaped tap-a-row/bottom-sheet editor — see that widget's
        // own file-level comment for why a VT table needed one at all.
        // Same width cap/centering the pinned table header above already
        // uses, for visual parity with every other desktop table.
        if (fields.length == 1 &&
            isVtTableTemplate(fields.first.tableSpec?['template'] as String?)) {
          final spec = fields.first.tableSpec ?? const {};
          final template = spec['template'] as String?;
          final def = template == null ? null : vtTableDefFor(template, spec);
          if (def == null) return const SizedBox.shrink();
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: GridTheme.tableTargetWidth),
              child: VtTableQuizGate(
                ctrl: ctrl,
                field: fields.first,
                child: VtSpreadsheetTable(ctrl: ctrl, def: def),
              ),
            ),
          );
        }
        return _SimpleFieldsTable(
          ctrl: ctrl,
          fields: fields,
          startRow: startRow,
          paired: entityType != EntityType.vocationalTraining &&
              ctrl.isSimpleSection(section.id),
        );
      },
      mobile: false,
      // Pin the current table's paperCode/question-text banner above the
      // scroll (see the Column below) instead of letting it scroll away
      // with a tall matrix under it — same reasoning as SimpleModeShell's
      // _UnitBody, which already does this for the card-based platforms.
      separateHeader: true,
    );
    if (units.isEmpty) return const SizedBox.shrink();

    final currentIdx =
        (ctrl.unitCursor(section.id) ?? currentUnitIndex(ctrl, units))
            .clamp(0, units.length - 1);
    final unit = units[currentIdx];
    final isFirst = currentIdx == 0;
    final isLast = currentIdx == units.length - 1;
    final hasMoreForward = unit.hasMoreInternalSteps?.call(ctrl) ?? false;
    final hasMoreBackward = unit.hasMoreInternalStepsBack?.call(ctrl) ?? false;
    // True end of the whole form — see UnitNavRow.isSubmit doc comment for
    // why this is the only place left to offer Submit.
    final isFormEnd =
        isLast && !hasMoreForward && ctrl.currentPage == ctrl.pageCount - 1;

    // Keep Tab/Enter navigation (computeVisibleFieldIds) from trying to
    // focus a field in a unit that isn't rendered — a plain field write on
    // the controller, not a notification, so it's safe to do from within
    // build(). The boundary hooks let Tab/Enter off the unit's last field
    // advance to the next unit (or, for a tabbed unit, the next tab first
    // — see nextWithinUnit) before crossing into the next/previous section
    // (advanceToNextSection/retreatToPreviousSection) — Suivant/Précédent
    // reads as one continuous "next" across the whole form, not just
    // within the current section.
    ctrl.setRevealedFieldIds(unit.fieldIds);
    ctrl.setRevealBoundaryActions(
      forward: isFormEnd
          ? () => onPreviewSubmit()
          : (isLast && !hasMoreForward)
              ? () => advanceToNextSection(ctrl)
              : () => nextWithinUnit(ctrl, section, units, currentIdx),
      backward: (isFirst && !hasMoreBackward)
          ? () => retreatToPreviousSection(ctrl)
          : () => prevWithinUnit(ctrl, section, units, currentIdx),
    );

    // Fixed chrome (header, nav row); the table area in between scrolls
    // on its own (vertical — GenericSpreadsheetTable already wraps itself
    // in a horizontal scroll when a row of columns doesn't fit, see its
    // _HorizontalScrollTable) rather than the whole header+table+nav
    // stack scrolling together as one page. Précédent/Suivant stay
    // reachable without scrolling past a tall table to find them.
    //
    // Pinch/pan zoom used to live here (ZoomableTable) instead of plain
    // scroll, specifically so a table wider or taller than the canvas
    // could be zoomed out to see the whole thing at once — removed since
    // it turned out to fight the browser/OS's own gesture handling more
    // than it helped (see conversation history); GenericSpreadsheetTable's
    // uniform cell resize (TableSizeScope, still in effect here — see
    // OnefopExcelShell) is what covers "make a cramped table easier to
    // read" now instead.
    return KeyedSubtree(
      key: ctrl.keyForUnit(unit.key),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The section's own title (e.g. "SECTION 3. ÉDUCATION EN
            // SITUATION D'URGENCE") — live-reported: "if there are no
            // [subsection] groupings, let the sections be shown" still
            // didn't hold, because this had never been rendered ANYWHERE
            // in the app, on either platform, for any entity type.
            // ctrl.sectionTitle()/SectionTitleLookup already existed,
            // fully wired from the AST's own SectionAst.title through the
            // compiler — nothing actually called it. Shown here
            // unconditionally (unlike OnefopSectionMap below, which only
            // matters once a section has more than one unit), since a
            // section with no subsections still deserves to say which
            // section it is.
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: GridTheme.tableTargetWidth),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(
                    ctrl.sectionTitle(ctrl.currentPage, locale),
                    style: kTableHeaderStyle.copyWith(fontSize: 14, color: kInk),
                  ),
                ),
              ),
            ),
            // Section/subsection navigation. VT's full subsection outline
            // now lives in the persistent left Sidebar (see
            // _VtSidebarSectionItem/_VtSubsectionTree in
            // onefop_form_widgets.dart) — every subsection listed in full,
            // always, auto-expanding around the active one — so the
            // sidebar stays the primary navigation structure. This spot
            // still needs *local* context for whoever is looking only at
            // the workspace: the active subsection's own real heading —
            // code + complete description, straight from
            // unit.subsectionLabel (the same AST-driven text the sidebar
            // itself shows — see FormQuestionAst.subsection in
            // onefop_ast.dart — never hardcoded here). A separate bare-code
            // breadcrumb ("→ 4.6") used to sit above this — removed as a
            // redundant, "floating" duplicate of the code the heading
            // itself already leads with. Every other entity keeps the
            // compact OnefopSectionMap chip row right here, exactly as
            // before — both self-hide/no-op for a single-unit section
            // (e.g. section0).
            if (entityType == EntityType.vocationalTraining) ...[
              if (unit.subsectionLabel != null || units.length > 1)
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: GridTheme.tableTargetWidth),
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          unit.subsectionLabel ?? unit.shortLabel,
                          style: const TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w700, color: kInk),
                        ),
                      ),
                    ),
                  ),
                ),
            ] else
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: GridTheme.tableTargetWidth),
                  child: OnefopSectionMap(
                    ctrl: ctrl,
                    units: units,
                    currentIndex: currentIdx,
                    onJump: (i) => jumpToUnit(ctrl, section, units, i),
                    onJumpToLocation: (i) => jumpToLocation(ctrl, section, units, i),
                  ),
                ),
              ),
            if (unit.header != null) ...[
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: GridTheme.tableTargetWidth),
                  child: unit.header!(),
                ),
              ),
              const SizedBox(height: 8),
            ],
            Expanded(
              child: UnitTransition(
                child: KeyedSubtree(
                  key: ValueKey(unit.key),
                  child: SingleChildScrollView(
                    controller: ctrl.mainScroll,
                    child: unit.content(),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: GridTheme.tableTargetWidth),
                // showNext is unconditional now — this row is the only
                // Précédent/Suivant/Soumettre control left in Spreadsheet
                // Mode.
                child: UnitNavRow(
                  showBack: !isFirst || hasMoreBackward || ctrl.currentPage > 0,
                  onBack: () => (isFirst && !hasMoreBackward)
                      ? retreatToPreviousSection(ctrl)
                      : prevWithinUnit(ctrl, section, units, currentIdx),
                  showNext: true,
                  isSubmit: isFormEnd,
                  nextEnabled:
                      isFormEnd ? ctrl.validateAllPages() : unit.canAdvance(ctrl),
                  onNext: () => isFormEnd
                      ? onPreviewSubmit()
                      : (isLast && !hasMoreForward)
                          ? advanceToNextSection(ctrl)
                          : nextWithinUnit(ctrl, section, units, currentIdx),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One bordered mini spreadsheet — RowNum | Code+Libellé | Valeur — for a
/// consecutive run of non-table fields, mirroring the reference's
/// SpreadsheetTable/LabelCell/TextCell pattern.
///
/// Renders through GridLayoutEngine (the same engine the table-type
/// fields use via GenericSpreadsheetTable) rather than a plain Flutter
/// Table with per-cell borders — every gridline is one continuous
/// stroke from a single painter, same as the CSP/SPC-style tables, so
/// this section doesn't draw its own, potentially-seamed, borders.
class _SimpleFieldsTable extends StatelessWidget {
  final OnefopFormController ctrl;
  final List<FieldSchema> fields;
  final int startRow;
  // Section 0 / Section 1 two-column layout (see onefop_form_widgets.dart's
  // pairShortFields and simple_mode_shell.dart's mirror of this same
  // pairing rule) — false everywhere else, so every other call site keeps
  // the original single-field-per-row grid unchanged.
  final bool paired;
  const _SimpleFieldsTable({
    required this.ctrl,
    required this.fields,
    required this.startRow,
    this.paired = false,
  });

  // Wide enough for the longest real paper code in this AST ("2.2.15",
  // "6.1.3", "7.1.3") — see the rownum_ cell below, which shows the
  // field's own paperCode here instead of a plain sequential counter now
  // that _labelSpan no longer duplicates it as a prefix on the label.
  static const double _rowNumColW = 52;
  // Fixed, not derived from the available page width — sized to what
  // each control actually needs (a phone number and a company address
  // don't need the same box). Previously this column stretched to 3/5
  // of the full ~940px table width for every row regardless of type,
  // leaving a large empty click-target next to short answers (a 6-digit
  // phone number in a ~545px-wide cell). The mini-grid tables elsewhere
  // in this shell already size columns to their content rather than to
  // the page, so this brings simple-field rows in line with them.
  static const double _labelColW = 360;
  static const _labelPad = EdgeInsets.symmetric(horizontal: 12, vertical: 3);

  // Section 0/1 two-column layout (paired == true) — fixed, not measured
  // like _valueColWidth: pairShortFields only ever pairs text/number/
  // email/tel fields, all short enough for one common width. Sized so two
  // full rownum+label+value triples plus a hairline gap column fit inside
  // GridTheme.tableTargetWidth: 52+230+150 = 432 per side, ×2 + 12 = 876,
  // under the 940px budget (see the plan's Finding 7). A solo row (a
  // non-pairable field, or an odd one left over) reuses these same seven
  // column boundaries via colSpan instead of a width of its own, so every
  // row — paired or solo — lines up on one consistent grid.
  static const double _pairedLabelColW = 230;
  static const double _pairedValueColW = 150;
  static const double _pairedGapW = 12;

  static double _valueColWidth(FieldSchema field) {
    switch (field.type) {
      case 'number':
      case 'tel':
        return 150;
      case 'select':
      case 'radio':
        return 260;
      case 'checkbox':
        // 3+ options render as a closed single-line dropdown now (see
        // ExcelValueCell.build()) — same footprint as select/radio, not
        // the wider column the inline checklist (1-2 options) still
        // needs for its option text.
        return (field.optionsI18n?.length ?? 0) < 3 ? 340 : 260;
      default:
        return 300;
    }
  }

  // A checkbox field only still needs its own measured row height (and
  // the maxHeight/topLeft-alignment treatment that goes with it) while
  // it's rendered as the inline checklist — 1-2 options, see
  // ExcelValueCell.build(). 3+ options are a closed dropdown now, a
  // single-line control like every other field type, needing none of
  // that machinery.
  static bool _isInlineChecklist(FieldSchema field) =>
      field.type == 'checkbox' && (field.optionsI18n?.length ?? 0) < 3;

  TextSpan _labelSpan(FieldSchema field, String label) {
    // No paperCode prefix here anymore — it has its own column now (see
    // the rownum_ cell below), so repeating it on every label would just
    // be the same code shown twice in the same row.
    return TextSpan(
      style: const TextStyle(fontSize: 13.5, color: kInk),
      children: [
        TextSpan(text: label, style: const TextStyle(fontWeight: FontWeight.w500)),
        if (field.required) const TextSpan(text: ' *', style: TextStyle(color: kDanger)),
      ],
    );
  }

  // Row heights are fixed (GridLayoutEngine positions everything
  // absolutely, no runtime auto-sizing pass) — so a wrapped long label
  // needs to be measured ahead of time with the same layout engine
  // Flutter's own Text/RichText widgets use internally, the same
  // approach generic_spreadsheet_table.dart uses for its row labels.
  double _measureLabelHeight(
      FieldSchema field, String label, double maxWidth, TextScaler scaler) {
    final tp = TextPainter(
      text: _labelSpan(field, label),
      textDirection: TextDirection.ltr,
      maxLines: null,
      textScaler: scaler,
    )..layout(maxWidth: maxWidth > 0 ? maxWidth : 0);
    return tp.height;
  }

  // A checkbox field's value cell isn't a single line like every other
  // type — it's a vertical checklist, one row per option (see
  // _ExcelCheckboxInput) — so its needed height depends on both the
  // option count and how many of them wrap at this column's width.
  // Measured the same way _measureLabelHeight measures a long label,
  // since GridLayoutEngine positions every cell at a fixed height with no
  // runtime auto-sizing pass to fall back on.
  double _measureCheckboxHeight(
      FieldSchema field, double valueW, Locale locale, TextScaler scaler) {
    final opts = field.optionsI18n ?? const [];
    if (opts.isEmpty) return 0;
    const cellHPad = 20.0; // ExcelValueCell/_ExcelCheckboxInput's own horizontal padding (10 * 2)
    const iconAndGap = 22.0; // 16px icon + 6px gap before the option text
    // GridLayoutEngine's own cell border eats a little more off the real
    // available width than the two constants above account for (see its
    // borderWidth-based inset math) — this measurement pass has no way to
    // read that number precisely, so it's estimated generously instead:
    // erring toward *more* wrapping (and so *more* height) than the real
    // render needs is safe (a little empty space at the bottom of the
    // cell), erring the other way overflows it, which is exactly the bug
    // this is fixing. Reported live: VT6_5 overflowed by 3-4px at this
    // constant's previous, tighter value.
    const wrapSafetyMargin = 12.0;
    final maxTextW = valueW - cellHPad - iconAndGap - wrapSafetyMargin;
    double total = 8; // _ExcelCheckboxInput's vertical padding (4 top + 4 bottom)
    for (final o in opts) {
      final tp = TextPainter(
        text: TextSpan(text: o.text.of(locale), style: const TextStyle(fontSize: 13)),
        textDirection: TextDirection.ltr,
        maxLines: null,
        textScaler: scaler,
      )..layout(maxWidth: maxTextW > 0 ? maxTextW : 0);
      total += (tp.height < 16 ? 16 : tp.height) + 3; // 1.5px vertical padding above/below each option
    }
    return total + 4; // final rounding/inset safety margin
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final textScaler = MediaQuery.textScalerOf(context);
    if (paired) return _buildPaired(context, locale, textScaler);

    // One value-column width for the whole run — the widest any field in
    // it actually needs, so a text field sharing a table with a select
    // doesn't leave the select's cell oversized (or vice versa).
    final valueW = fields.map(_valueColWidth).fold(0.0, (a, b) => a > b ? a : b);
    final colWidths = [_rowNumColW, _labelColW, valueW];
    final maxLabelTextW = _labelColW - _labelPad.horizontal;

    final rowHeights = <double>[
      for (final f in fields)
        () {
          final labelH = _measureLabelHeight(f, ctrl.fieldLabel(f, locale), maxLabelTextW, textScaler) +
              _labelPad.vertical;
          final checkboxH =
              _isInlineChecklist(f) ? _measureCheckboxHeight(f, valueW, locale, textScaler) : 0.0;
          final h = labelH > checkboxH ? labelH : checkboxH;
          return h > GridTheme.rowHeight ? h.ceilToDouble() : GridTheme.rowHeight;
        }(),
    ];

    final cells = <GridCell>[];
    for (final entry in fields.asMap().entries) {
      final i = entry.key;
      final f = entry.value;

      cells.add(GridCell(
        id: 'rownum_${f.id}',
        row: i,
        col: 0,
        backgroundColor: kSurface,
        alignment: Alignment.centerLeft,
        // The field's own official paper code (e.g. "3.10", "6.1.3") —
        // previously shown as a prefix on the label itself (see
        // _labelSpan), now broken out into its own column instead of
        // being duplicated there. Falls back to a running row count only
        // for the rare field with no paperCode at all, so the column is
        // never blank.
        child: Padding(
          padding: const EdgeInsets.only(left: 8),
          child: Text(
            (f.paperCode != null && f.paperCode!.isNotEmpty)
                ? f.paperCode!
                : '${startRow + i}',
            style: _monoStyle.copyWith(
                fontSize: 12.5, fontWeight: FontWeight.w700, color: kAccent),
          ),
        ),
      ));

      cells.add(GridCell(
        id: 'label_${f.id}',
        row: i,
        col: 1,
        backgroundColor: kSurface,
        alignment: Alignment.centerLeft,
        child: Padding(
          padding: _labelPad,
          child: RichText(
            text: _labelSpan(f, ctrl.fieldLabel(f, locale)),
            softWrap: true,
            overflow: TextOverflow.visible,
          ),
        ),
      ));

      cells.add(GridCell(
        id: f.id,
        row: i,
        col: 2,
        backgroundColor: kSurface,
        // A checkbox field's value cell is a vertical checklist, not a
        // single centered control — top-left keeps it flush with the
        // row's top edge instead of vertically centering a short list
        // inside a row sized (see _measureCheckboxHeight) to exactly fit
        // it, which would look identical, or a long one against a
        // taller neighbour row, which wouldn't.
        alignment: _isInlineChecklist(f) ? Alignment.topLeft : Alignment.center,
        // Live-reported (VT3_2, 10 options): GridLayoutEngine wraps every
        // cell in its own Container(alignment: cell.alignment, ...) with
        // no clip of its own, which *loosens* the constraints it hands
        // down — so a cell's child is never actually height-bound by the
        // row height GridLayoutEngine positions it at, no matter what the
        // child does internally with its own ClipRect/Column. Passing the
        // exact computed row height down explicitly (checkbox fields
        // only) is what lets _ExcelCheckboxInput impose a real, finite
        // bound of its own instead of just clipping to whatever loose
        // size its children happen to end up wanting.
        child: ExcelValueCell(
          ctrl: ctrl,
          field: f,
          maxHeight: _isInlineChecklist(f) ? rowHeights[i] : null,
        ),
      ));
    }

    return GridLayoutEngine(
      cells: cells,
      rowCount: fields.length,
      colCount: 3,
      colWidths: colWidths,
      rowHeights: rowHeights,
      borderColor: GridTheme.borderColor,
      borderWidth: GridTheme.borderWidth,
      backgroundColor: kSurface,
    );
  }

  // Section 0/1 two-column layout. A 7-column grid — rownum|label|value
  // per side, columns 0-2 and 4-6, with column 3 left empty as a hairline
  // divider (the grid's own single-painter border rendering draws it as a
  // seam, same as every other gridline here — see the class doc comment).
  // A solo row (a non-pairable field, or an odd leftover) reuses the same
  // seven column boundaries via colSpan instead of its own width, so
  // paired and solo rows both read as one consistent grid rather than two
  // visually different tables stacked together.
  Widget _buildPaired(BuildContext context, Locale locale, TextScaler textScaler) {
    final groups = pairShortFields(fields);
    const colWidths = [
      _rowNumColW, _pairedLabelColW, _pairedValueColW, _pairedGapW, // left pair + gap
      _rowNumColW, _pairedLabelColW, _pairedValueColW, // right pair
    ];
    final maxLabelTextW = _pairedLabelColW - _labelPad.horizontal;
    // A solo row's label spans columns 1-2 (_pairedLabelColW + _pairedValueColW)
    // and its value spans columns 4-6 (_rowNumColW + _pairedLabelColW +
    // _pairedValueColW) — see the class doc comment above.
    final soloLabelTextW =
        _pairedLabelColW + _pairedValueColW - _labelPad.horizontal;
    const soloValueW = _rowNumColW + _pairedLabelColW + _pairedValueColW;

    double fieldRowHeight(FieldSchema f, bool solo) {
      final maxTextW = solo ? soloLabelTextW : maxLabelTextW;
      final valueW = solo ? soloValueW : _pairedValueColW;
      final labelH =
          _measureLabelHeight(f, ctrl.fieldLabel(f, locale), maxTextW, textScaler) +
              _labelPad.vertical;
      final checkboxH =
          _isInlineChecklist(f) ? _measureCheckboxHeight(f, valueW, locale, textScaler) : 0.0;
      final h = labelH > checkboxH ? labelH : checkboxH;
      return h > GridTheme.rowHeight ? h.ceilToDouble() : GridTheme.rowHeight;
    }

    final rowHeights = <double>[
      for (final group in groups)
        group.length == 2
            ? [fieldRowHeight(group[0], false), fieldRowHeight(group[1], false)]
                .reduce((a, b) => a > b ? a : b)
            : fieldRowHeight(group[0], true),
    ];

    final cells = <GridCell>[];
    var fieldIndex = 0;
    for (final entry in groups.asMap().entries) {
      final row = entry.key;
      final group = entry.value;
      if (group.length == 2) {
        _addPairedFieldCells(cells, group[0], row, 0, fieldIndex, rowHeights[row], locale);
        _addPairedFieldCells(cells, group[1], row, 4, fieldIndex + 1, rowHeights[row], locale);
      } else {
        _addSoloFieldCells(cells, group[0], row, fieldIndex, rowHeights[row], locale);
      }
      fieldIndex += group.length;
    }

    return GridLayoutEngine(
      cells: cells,
      rowCount: groups.length,
      colCount: 7,
      colWidths: colWidths,
      rowHeights: rowHeights,
      borderColor: GridTheme.borderColor,
      borderWidth: GridTheme.borderWidth,
      backgroundColor: kSurface,
    );
  }

  Widget _rowNumCell(FieldSchema f, int fieldIndex) => Padding(
        padding: const EdgeInsets.only(left: 8),
        child: Text(
          (f.paperCode != null && f.paperCode!.isNotEmpty) ? f.paperCode! : '${startRow + fieldIndex}',
          style: _monoStyle.copyWith(fontSize: 12.5, fontWeight: FontWeight.w700, color: kAccent),
        ),
      );

  Widget _valueCell(FieldSchema f, double rowHeight) => ExcelValueCell(
        ctrl: ctrl,
        field: f,
        maxHeight: _isInlineChecklist(f) ? rowHeight : null,
      );

  // One field, occupying columns [colOffset, colOffset+2] (rownum/label/
  // value, one column each) — a paired row's left (colOffset 0) or right
  // (colOffset 4) half.
  void _addPairedFieldCells(List<GridCell> cells, FieldSchema f, int row, int colOffset,
      int fieldIndex, double rowHeight, Locale locale) {
    cells.add(GridCell(
      id: 'rownum_${f.id}',
      row: row,
      col: colOffset,
      backgroundColor: kSurface,
      alignment: Alignment.centerLeft,
      child: _rowNumCell(f, fieldIndex),
    ));
    cells.add(GridCell(
      id: 'label_${f.id}',
      row: row,
      col: colOffset + 1,
      backgroundColor: kSurface,
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: _labelPad,
        child: RichText(
          text: _labelSpan(f, ctrl.fieldLabel(f, locale)),
          softWrap: true,
          overflow: TextOverflow.visible,
        ),
      ),
    ));
    cells.add(GridCell(
      id: f.id,
      row: row,
      col: colOffset + 2,
      backgroundColor: kSurface,
      alignment: _isInlineChecklist(f) ? Alignment.topLeft : Alignment.center,
      child: _valueCell(f, rowHeight),
    ));
  }

  // One field, occupying the full row width via colSpan — a non-pairable
  // field, or an odd field left over after greedy pairing.
  void _addSoloFieldCells(List<GridCell> cells, FieldSchema f, int row, int fieldIndex,
      double rowHeight, Locale locale) {
    cells.add(GridCell(
      id: 'rownum_${f.id}',
      row: row,
      col: 0,
      backgroundColor: kSurface,
      alignment: Alignment.centerLeft,
      child: _rowNumCell(f, fieldIndex),
    ));
    cells.add(GridCell(
      id: 'label_${f.id}',
      row: row,
      col: 1,
      colSpan: 2,
      backgroundColor: kSurface,
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: _labelPad,
        child: RichText(
          text: _labelSpan(f, ctrl.fieldLabel(f, locale)),
          softWrap: true,
          overflow: TextOverflow.visible,
        ),
      ),
    ));
    cells.add(GridCell(
      id: f.id,
      row: row,
      col: 4,
      colSpan: 3,
      backgroundColor: kSurface,
      alignment: _isInlineChecklist(f) ? Alignment.topLeft : Alignment.center,
      child: _valueCell(f, rowHeight),
    ));
  }
}
