// lib/theme/ultra_theme.dart
import 'package:flutter/material.dart';

class UltraTheme {
  UltraTheme._();

  // ── Emerald & Gold ───────────────────────────────────────────
  static const Color primary = Color(0xFF0A6640); // deep emerald
  static const Color primaryDark = Color(0xFF063D27); // darker
  static const Color primaryLight = Color(0xFF2FA89F); // lighter
  static const Color primaryLightBg = Color(0xFFE5F0E9); // very light
  static const Color primaryMid = Color(0xFFCFE6D9); // mid tone

  // ── Accent — gold ─────────────────────────────────────────────
  static const Color accent = Color(0xFFC9920A);

  // ── Neutrals ───────────────────────────────────────────────
  static const Color background = Color(0xFFFAFAF7);
  static const Color surface = Colors.white;
  static const Color textPrimary = Color(0xFF0D0D0D);
  static const Color textSecondary = Color(0xFF4A4A4A);
  static const Color textMuted = Color(0xFF8A8A8A);

  // Flat, bordered card style (dashboard-app look: thin border carries the
  // shape, not a shadow) — border sits on cardBackground, not on
  // `background`, so it stays visible against both.
  static const Color border = Color(0xFFE4E4E7);
  static const Color borderStrong = Color(0xFFD4D4D8);

  // ── Status ─────────────────────────────────────────────────
  static const Color success = Color(0xFF0A6640);
  static const Color warning = Color(0xFFC9920A);
  static const Color error = Color(0xFFE8500A);
  static const Color info = Color(0xFF1A3A6E);

  // ── Shadows ────────────────────────────────────────────────
  // Cards carry their shape via `border` now, not elevation — softShadow is
  // near-invisible, just enough to lift a card a hair off the page
  // background. mediumShadow stays a real shadow, reserved for things that
  // actually float above content (dialogs, popovers), where a border alone
  // wouldn't read as "above" the page.
  static List<BoxShadow> get softShadow => [
        const BoxShadow(
            color: Color(0x05000000),
            blurRadius: 4,
            offset: Offset(0, 1),
            spreadRadius: 0),
      ];
  static List<BoxShadow> get mediumShadow => [
        const BoxShadow(
            color: Color(0x14000000),
            blurRadius: 24,
            offset: Offset(0, 8),
            spreadRadius: -4),
      ];

  // ── Gradients ──────────────────────────────────────────────
  static LinearGradient get primaryGradient => const LinearGradient(
        colors: [primary, primaryLight],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
  static LinearGradient get heroGradient => const LinearGradient(
        colors: [primaryDark, primary, primaryLight],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );

  // ── Text styles (unchanged) ────────────────────────────────
  static TextStyle get displayLarge => const TextStyle(
      fontFamily: 'Inter',
      fontSize: 32,
      fontWeight: FontWeight.w800,
      color: textPrimary,
      letterSpacing: -0.5);
  static TextStyle get displayMedium => const TextStyle(
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: FontWeight.w700,
      color: textPrimary,
      letterSpacing: -0.3);
  static TextStyle get titleLarge => const TextStyle(
      fontFamily: 'Inter',
      fontSize: 20,
      fontWeight: FontWeight.w600,
      color: textPrimary,
      letterSpacing: -0.2);
  static TextStyle get titleMedium => const TextStyle(
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: textPrimary);
  static TextStyle get bodyLarge => const TextStyle(
      fontFamily: 'Inter',
      fontSize: 15,
      fontWeight: FontWeight.w400,
      color: textSecondary,
      height: 1.5);
  static TextStyle get bodyMedium => const TextStyle(
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: FontWeight.w400,
      color: textSecondary,
      height: 1.4);
  static TextStyle get labelLarge => const TextStyle(
      fontFamily: 'Inter',
      fontSize: 13,
      fontWeight: FontWeight.w600,
      color: textSecondary,
      letterSpacing: 0.3);
  static TextStyle get labelMedium => const TextStyle(
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: FontWeight.w500,
      color: textMuted,
      letterSpacing: 0.2);

  // ── Radius ─────────────────────────────────────────────────
  // Tightened from (8/12/16/24) toward a dashboard-app corner scale —
  // large panels/dialogs (radiusXL) are unchanged since no reference for
  // that scale prompted the change; small/medium/large (cards, rows, rail
  // items) are what actually appeared "big" in a bordered layout.
  static const double radiusSmall = 6;
  static const double radiusMedium = 8;
  static const double radiusLarge = 10;
  static const double radiusXL = 24;
  static const double radiusFull = 999;

  // ── Durations ──────────────────────────────────────────────
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 300);
  static const Duration slow = Duration(milliseconds: 500);
}
