// lib/core/focus/renderers/grid_theme.dart
//
// ══════════════════════════════════════════════════════════════
// GRID THEME — single source of truth for table geometry
//
// CHANGES (v2 — modern unified typography):
//   • All fonts: 9 px → 13 px (unified with rest of form)
//   • rowHeight: 22 → 36 px (no more clipped text)
//   • colWidth: 52 → 60 px (wider for 13 px numerals)
//   • firstColWidth: 160 → 180 px
//   • leadingGroupColWidth: 100 → 120 px
//   • Borders softened: #000000 → #E2E8F0 (slate-200)
//   • Colors modernized: slate/blue palette
//   • Padding increased for breathing room
//   • tableTargetWidth preserved at 940.0
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

class GridTheme {
  GridTheme._();

  // ── Canonical table width ─────────────────────────────────
  static const double tableTargetWidth = 940.0;

  // ── Row / cell geometry ────────────────────────────────────
  // 24px ≈ Excel's default compact row height, down from the earlier
  // 36px "generous padding" pass.
  static const double rowHeight = 24.0;
  static const double colWidth = 60.0;
  static const double mobileColWidth = 64.0;

  // ── Label (first) column widths ───────────────────────────
  static const double firstColWidth = 180.0;
  static const double firstColWidthWide = 220.0;
  static const double firstColWidthNarrow = 140.0;

  // ── Leading group column (S23Q02 "Statut / Status") ───────
  static const double leadingGroupColWidth = 120.0;

  // ── Border ────────────────────────────────────────────────
  // Real black, matching Excel's own gridlines — this was previously
  // softened away to #000000 → #E7E9F0 → #B9BEC7; reverted all the way
  // back on request.
  static const Color borderColor = Color(0xFF000000);
  static const double borderWidth = 1.0;

  // ── Active-cell focus ring — same brand green as the plain-field
  // focus glow (kAccent in onefop_form_constants.dart), so tabbing from
  // a simple field into a grid cell reads as one continuous focus
  // language instead of two different interaction styles. A border only
  // (no fill) — an Excel-style highlighted outline around the active
  // cell rather than a colored background, which read as an unwanted
  // "shadow" on numeric cells (see number_field.dart).
  static const Color focusRingColor = AppColors.deepEmerald;
  static const double focusRingWidth = 1.5;
  static const Duration focusRingDuration = Duration(milliseconds: 140);

  // ── Background colours — all-white sheet, matching the reference
  // Excel forms exactly: no header shading, no row stripes. Most rows
  // are distinguished by text weight and color only (see headerStyle/
  // totalStyle/grandTotalStyle below), not by cell fill — except total
  // cells, which get a subtle tint (same value as OL.totalCellBg in
  // onefop_layout_constants.dart) so read-only computed cells are
  // visually distinct from editable input cells at a glance, not just
  // by their bold green text.
  static const Color headerBg = Color(0xFFFFFFFF);
  static const Color rowEven = Color(0xFFFFFFFF);
  static const Color rowOdd = Color(0xFFFFFFFF);
  static const Color totalBg = Color(0xFFE1F0E8);
  static const Color grandTotalBg = Color(0xFFFFFFFF);
  static const Color inputBg = Color(0xFFFFFFFF);
  static const Color readOnlyBg = Color(0xFFFFFFFF);

  // ── Typography (unified 13 px) ────────────────────────────
  static const String? fontFamily = null;

  static const TextStyle headerStyle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: Color(0xFF1A1A1A),
    height: 1.25,
  );

  static const TextStyle labelStyle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: Color(0xFF1A1A1A),
    height: 1.25,
  );

  static const TextStyle dataStyle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: Color(0xFF4A4A4A),
    height: 1.25,
  );

  static const TextStyle totalStyle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: AppColors.deepEmerald,
    height: 1.25,
  );

  static const TextStyle grandTotalStyle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: AppColors.deepEmerald,
    height: 1.25,
  );

  // ── Padding ───────────────────────────────────────────────
  // Vertical insets trimmed to fit the smaller rowHeight above — 8px top
  // + 8px bottom would overflow a 24px row once text height is added.
  static const EdgeInsets headerCellPadding =
      EdgeInsets.symmetric(horizontal: 6, vertical: 3);

  static const EdgeInsets labelCellPadding =
      EdgeInsets.symmetric(horizontal: 14, vertical: 3);

  static const EdgeInsets cellPadding =
      EdgeInsets.symmetric(horizontal: 10, vertical: 3);

  // ── "Polished" variant — opt-in, additive only ────────────
  // Same hex values as vt_wizard_constants.dart's card/typography tokens
  // (kVtWizardFontFamily/Ink/InkSoft/CardBorder/Background), duplicated
  // here rather than imported: lib/core/focus/renderers/ only depends on
  // lib/theme/ today, never on lib/screens/, and importing a screens-layer
  // file into this renderers-layer one would invert that direction for a
  // handful of color constants. Used by buildGridCellWidget/NumberField/
  // FormTextField's own `polished` param (see grid_cell_dispatch.dart) —
  // Simple Mode's Enterprise/Cooperative/CTD/ONG table cards only; every
  // other caller (Spreadsheet Mode included) keeps using the plain styles
  // above, unchanged.
  static const String polishedFontFamily = 'Manrope';
  static const Color polishedInk = Color(0xFF1C1F1D);
  static const Color polishedInkSoft = Color(0xFF4E5451);
  static const Color polishedBorder = Color(0xFFE5EAE7);
  static const Color polishedBackground = Color(0xFFF4F6F5);

  static const TextStyle polishedHeaderStyle = TextStyle(
    fontFamily: polishedFontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: polishedInk,
    height: 1.25,
  );

  static const TextStyle polishedLabelStyle = TextStyle(
    fontFamily: polishedFontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: polishedInk,
    height: 1.25,
  );

  static const TextStyle polishedDataStyle = TextStyle(
    fontFamily: polishedFontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: polishedInk,
    height: 1.25,
  );

  static const TextStyle polishedTotalStyle = TextStyle(
    fontFamily: polishedFontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: AppColors.deepEmerald,
    height: 1.25,
  );

  static const TextStyle polishedGrandTotalStyle = polishedTotalStyle;
}
