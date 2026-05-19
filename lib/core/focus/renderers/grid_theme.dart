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

class GridTheme {
  GridTheme._();

  // ── Canonical table width ─────────────────────────────────
  static const double tableTargetWidth = 940.0;

  // ── Row / cell geometry ────────────────────────────────────
  static const double rowHeight = 36.0;
  static const double colWidth = 60.0;

  // ── Label (first) column widths ───────────────────────────
  static const double firstColWidth = 180.0;
  static const double firstColWidthWide = 220.0;
  static const double firstColWidthNarrow = 140.0;

  // ── Leading group column (S23Q02 "Statut / Status") ───────
  static const double leadingGroupColWidth = 120.0;

  // ── Border ────────────────────────────────────────────────
  static const Color borderColor = Color(0xFFE2E8F0);
  static const double borderWidth = 1.0;

  // ── Background colours ─────────────────────────────────────
  static const Color headerBg = Color(0xFFF1F5F9);
  static const Color rowEven = Color(0xFFFFFFFF);
  static const Color rowOdd = Color(0xFFF8FAFC);
  static const Color totalBg = Color(0xFFEFF6FF);
  static const Color grandTotalBg = Color(0xFF1E293B);
  static const Color inputBg = Color(0xFFFFFFFF);
  static const Color inputBgFocus = Color(0xFFF8FAFF);
  static const Color readOnlyBg = Color(0xFFF1F5F9);

  // ── Typography (unified 13 px) ────────────────────────────
  static const String? fontFamily = null;

  static const TextStyle headerStyle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: Color(0xFF1E293B),
    height: 1.25,
  );

  static const TextStyle labelStyle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: Color(0xFF1E293B),
    height: 1.25,
  );

  static const TextStyle dataStyle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: Color(0xFF334155),
    height: 1.25,
  );

  static const TextStyle totalStyle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: Color(0xFF2563EB),
    height: 1.25,
  );

  static const TextStyle grandTotalStyle = TextStyle(
    fontFamily: fontFamily,
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: Colors.white,
    height: 1.25,
  );

  // ── Padding ───────────────────────────────────────────────
  static const EdgeInsets headerCellPadding =
      EdgeInsets.symmetric(horizontal: 10, vertical: 8);

  static const EdgeInsets labelCellPadding =
      EdgeInsets.symmetric(horizontal: 14, vertical: 8);

  static const EdgeInsets cellPadding =
      EdgeInsets.symmetric(horizontal: 10, vertical: 8);
}
