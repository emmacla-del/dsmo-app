// lib/core/focus/renderers/onefop_layout_constants.dart
//
// ══════════════════════════════════════════════════════════════
// PIXEL-PERFECT LAYOUT CONSTANTS  (v2 — modern unified)
//
// Derived from official ONEFOP HTML questionnaires, modernized:
//   • All fonts unified at 13–14 px (tables were 9 px)
//   • Row height 22 → 36 px (no more clipped text)
//   • Header row 22 → 40 px
//   • Softer slate borders (#E2E8F0) instead of harsh black
//   • 10–12 px border radius on inputs, cards, tables
//   • Generous spacing: 20 px questions, 24 px sections
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────
// PAGE & CONTAINER
// ─────────────────────────────────────────────────────────────

class OL {
  // A4 usable width = 794px − 2×28px margins = 738px
  // Forms use padding: 20px on each side → content = 698px
  static const double pageWidth = 794.0;
  static const double pageMarginH = 20.0;
  static const double contentWidth = pageWidth - 2 * pageMarginH; // 754

  // Section container
  static const double sectionBorderRadius = 12.0; // modern rounded cards
  static const double sectionHeaderPaddingV = 10.0;
  static const double sectionHeaderPaddingH = 16.0;
  static const double sectionBodyPaddingV = 16.0;
  static const double sectionBodyPaddingH = 16.0;

  // ─────────────────────────────────────────────────────────────
  // TYPOGRAPHY  (unified 13–14 px scale)
  // ─────────────────────────────────────────────────────────────

  // Section header (.sh)
  static const double shFontSize = 16.0;
  static const FontWeight shFontWeight = FontWeight.w700;
  static const double shLineHeight = 1.3;

  // Question text (.qt)
  static const double qtFontSize = 14.0;
  static const FontWeight qtFontWeight = FontWeight.w600;
  static const double qtLineHeight = 1.4;

  // Question code prefix  (S1Q01 etc.)
  static const double qcFontSize = 14.0;
  static const FontWeight qcFontWeight = FontWeight.w700;

  // Field label
  static const double lblFontSize = 14.0;
  static const FontWeight lblFontWeight = FontWeight.w400;

  // Table header cell
  static const double thFontSize = 13.0;
  static const FontWeight thFontWeight = FontWeight.w600;

  // Table data cell
  static const double tdFontSize = 13.0;
  static const FontWeight tdFontWeight = FontWeight.w400;

  // Row label (left col of table)
  static const double rlFontSize = 13.0;
  static const FontWeight rlFontWeight = FontWeight.w500;

  // Total / grand-total row
  static const double totFontSize = 13.0;
  static const FontWeight totFontWeight = FontWeight.w700;

  // Input field placeholder
  static const double phFontSize = 14.0;

  // ─────────────────────────────────────────────────────────────
  // COLORS  (modern slate/blue palette)
  // ─────────────────────────────────────────────────────────────

  // Section header backgrounds by section id
  static const Color shBgSection0 = Color(0xFF4472C4); // respondent — blue
  static const Color shBgSection1 = Color(0xFF4472C4); // entity identity
  static const Color shBgSection2 = Color(0xFF4472C4); // employment
  static const Color shBgSection3 = Color(0xFF4472C4); // departures
  static const Color shBgSection4 = Color(0xFF4472C4); // training
  static const Color shFg = Colors.white;

  // Question header (.qt) — warm amber box with soft border
  static const Color qtBg = Color(0xFFFFFBEB);
  static const Color qtBorder = Color(0xFFF59E0B);

  // Table header row
  static const Color tableHdrBg = Color(0xFFF1F5F9); // slate-100
  static const Color tableHdrFg = Color(0xFF1E293B); // slate-800

  // Table alternate row
  static const Color tableRowEven = Color(0xFFFFFFFF);
  static const Color tableRowOdd = Color(0xFFF8FAFC); // slate-50

  // Total cell background
  static const Color totalCellBg = Color(0xFFEFF6FF); // blue-50
  static const Color grandTotalBg =
      Color(0xFFF8FAFC); // slate-50 (very light grey)
  static const Color grandTotalFg = Colors.white;

  // Input cell background (editable)
  static const Color inputCellBg = Color(0xFFFFFFFF);
  static const Color inputCellBgFocus = Color(0xFFF8FAFF);
  static const Color inputCellBgTotal = Color(0xFFF1F5F9);

  // Border colour — soft slate instead of harsh black
  static const Color borderColor = Color(0xFFE2E8F0); // slate-200
  static const double borderWidth = 1.0;

  // Subtle grey used for internal cell separators in some tables
  static const Color cellSepColor = Color(0xFFCBD5E1); // slate-300

  // ─────────────────────────────────────────────────────────────
  // GRID GEOMETRY  (modern touch-friendly dimensions)
  // ─────────────────────────────────────────────────────────────

  // Standard row height for all data rows
  static const double rowHeight = 36.0;

  // Header rows
  static const double headerRowHeight = 40.0;

  // First column (row-label column) widths by table type
  static const double firstColWidthNarrow = 140.0;
  static const double firstColWidthMedium = 180.0;
  static const double firstColWidthWide = 220.0;
  static const double firstColWidthMatrix = 200.0;

  // Standard data column width (numeric cells)
  static const double dataColWidth = 60.0;

  // Text cell width (hybrid tables — reasons / skills / domains)
  static const double hybridTextColWidth = 240.0;

  // Hybrid numeric columns (M / F / Total)
  static const double hybridNumColWidth = 100.0;

  // Input field inner padding
  static const double cellPadH = 6.0;
  static const double cellPadV = 4.0;

  // ─────────────────────────────────────────────────────────────
  // SPACING
  // ─────────────────────────────────────────────────────────────

  static const double questionGapV = 20.0; // gap between questions
  static const double sectionGapV = 24.0; // gap between sections
  static const double labelGapV = 8.0; // gap between label and control
  static const double tableOverflow = 16.0; // scroll handle area

  // ─────────────────────────────────────────────────────────────
  // DERIVED HELPERS
  // ─────────────────────────────────────────────────────────────

  static Color sectionHeaderBg(String sectionId) {
    return shBgSection0;
  }

  static TextStyle get shStyle => const TextStyle(
        fontSize: shFontSize,
        fontWeight: shFontWeight,
        color: shFg,
        height: shLineHeight,
      );

  static TextStyle get qtStyle => const TextStyle(
        fontSize: qtFontSize,
        fontWeight: qtFontWeight,
        color: Color(0xFF1E293B),
        height: qtLineHeight,
      );

  static TextStyle get qcStyle => const TextStyle(
        fontSize: qcFontSize,
        fontWeight: qcFontWeight,
        color: Color(0xFF1E40AF),
      );

  static TextStyle get lblStyle => const TextStyle(
        fontSize: lblFontSize,
        fontWeight: lblFontWeight,
        color: Color(0xFF334155),
      );

  static TextStyle get thStyle => const TextStyle(
        fontSize: thFontSize,
        fontWeight: thFontWeight,
        color: Color(0xFF1E293B),
      );

  static TextStyle get tdStyle => const TextStyle(
        fontSize: tdFontSize,
        fontWeight: tdFontWeight,
        color: Color(0xFF334155),
      );

  static TextStyle get rlStyle => const TextStyle(
        fontSize: rlFontSize,
        fontWeight: rlFontWeight,
        color: Color(0xFF1E293B),
      );

  static TextStyle get totStyle => const TextStyle(
        fontSize: totFontSize,
        fontWeight: totFontWeight,
        color: Color(0xFF1E293B),
      );

  static TextStyle get grandTotStyle => const TextStyle(
        fontSize: totFontSize,
        fontWeight: totFontWeight,
        color: grandTotalFg,
      );

  // ─────────────────────────────────────────────────────────────
  // BORDER HELPERS
  // ─────────────────────────────────────────────────────────────

  static const BoxDecoration cellBorder = BoxDecoration(
    border: Border(
      top: BorderSide(color: borderColor, width: borderWidth),
      left: BorderSide(color: borderColor, width: borderWidth),
      right: BorderSide(color: borderColor, width: borderWidth),
      bottom: BorderSide(color: borderColor, width: borderWidth),
    ),
  );

  static BoxDecoration gridCellBorder({
    required bool isFirstRow,
    required bool isFirstCol,
  }) {
    const s = BorderSide(color: borderColor, width: borderWidth);
    const n = BorderSide.none;
    return BoxDecoration(
      border: Border(
        top: isFirstRow ? s : n,
        left: isFirstCol ? s : n,
        right: s,
        bottom: s,
      ),
    );
  }

  static const BoxDecoration qtDecoration = BoxDecoration(
    color: qtBg,
    border: Border.fromBorderSide(
      BorderSide(color: qtBorder, width: borderWidth),
    ),
    borderRadius: BorderRadius.all(Radius.circular(8)),
  );

  static const BoxDecoration tableHdrDecoration = BoxDecoration(
    color: tableHdrBg,
    border: Border.fromBorderSide(
      BorderSide(color: borderColor, width: borderWidth),
    ),
  );

  static const BoxDecoration totalRowDecoration = BoxDecoration(
    color: totalCellBg,
    border: Border.fromBorderSide(
      BorderSide(color: borderColor, width: borderWidth),
    ),
  );

  static const BoxDecoration grandTotalRowDecoration = BoxDecoration(
    color: grandTotalBg,
    border: Border.fromBorderSide(
      BorderSide(color: borderColor, width: borderWidth),
    ),
  );
}
