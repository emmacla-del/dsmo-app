// lib/theme/ultra_theme.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class UltraTheme {
  UltraTheme._();

  // ── Landing page greens ─────────────────────────────────────
  static const Color primary = Color(0xFF005F54); // main green
  static const Color primaryDark = Color(0xFF003D35); // darker
  static const Color primaryLight = Color(0xFF007A6A); // lighter
  static const Color primaryLightBg = Color(0xFFEAF6F4); // very light
  static const Color primaryMid = Color(0xFFD0EDE9); // mid tone

  // ── Accent (kept from original) ────────────────────────────
  static const Color accent = Color(0xFF00D9C0);

  // ── Neutrals ───────────────────────────────────────────────
  static const Color background = Color(0xFFF9FAFB);
  static const Color surface = Colors.white;
  static const Color textPrimary = Color(0xFF1E293B);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textMuted = Color(0xFF94A3B8);

  // ── Status ─────────────────────────────────────────────────
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color error = Color(0xFFEF4444);
  static const Color info = Color(0xFF3B82F6);

  // ── Shadows ────────────────────────────────────────────────
  static List<BoxShadow> get softShadow => [
        const BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 12,
            offset: Offset(0, 4),
            spreadRadius: -2),
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
  static TextStyle get displayLarge => GoogleFonts.inter(
      fontSize: 32,
      fontWeight: FontWeight.w800,
      color: textPrimary,
      letterSpacing: -0.5);
  static TextStyle get displayMedium => GoogleFonts.inter(
      fontSize: 24,
      fontWeight: FontWeight.w700,
      color: textPrimary,
      letterSpacing: -0.3);
  static TextStyle get titleLarge => GoogleFonts.inter(
      fontSize: 20,
      fontWeight: FontWeight.w600,
      color: textPrimary,
      letterSpacing: -0.2);
  static TextStyle get titleMedium => GoogleFonts.inter(
      fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary);
  static TextStyle get bodyLarge => GoogleFonts.inter(
      fontSize: 15,
      fontWeight: FontWeight.w400,
      color: textSecondary,
      height: 1.5);
  static TextStyle get bodyMedium => GoogleFonts.inter(
      fontSize: 14,
      fontWeight: FontWeight.w400,
      color: textSecondary,
      height: 1.4);
  static TextStyle get labelLarge => GoogleFonts.inter(
      fontSize: 13,
      fontWeight: FontWeight.w600,
      color: textSecondary,
      letterSpacing: 0.3);
  static TextStyle get labelMedium => GoogleFonts.inter(
      fontSize: 12,
      fontWeight: FontWeight.w500,
      color: textMuted,
      letterSpacing: 0.2);

  // ── Radius ─────────────────────────────────────────────────
  static const double radiusSmall = 8;
  static const double radiusMedium = 12;
  static const double radiusLarge = 16;
  static const double radiusXL = 24;
  static const double radiusFull = 999;

  // ── Durations ──────────────────────────────────────────────
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 300);
  static const Duration slow = Duration(milliseconds: 500);
}
