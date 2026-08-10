// lib/core/theme/app_theme.dart
// Government-professional Material 3 theme, shared across DSMO and ONEFOP

import 'package:flutter/material.dart';

class AppColors {
  // Primary palette — Emerald & Gold (MINEFOP institutional identity)
  static const Color primary = Color(0xFF0A6640);
  static const Color primaryLight = Color(0xFF2FA89F);
  static const Color primaryDark = Color(0xFF063D27);

  // Secondary — gold accent
  static const Color secondary = Color(0xFFC9920A);
  static const Color secondaryLight = Color(0xFF2FA89F);

  // Semantic colors
  static const Color success = Color(0xFF0A6640);
  static const Color warning = Color(0xFFC9920A);
  static const Color danger = Color(0xFFE8500A);
  static const Color info = Color(0xFF1A3A6E);

  // Neutral palette
  static const Color background = Color(0xFFFAFAF7);
  static const Color surface = Colors.white;
  static const Color cardBg = Colors.white;
  static const Color divider = Color(0xFFECE7D8);
  static const Color textPrimary = Color(0xFF0D0D0D);
  static const Color textSecondary = Color(0xFF4A4A4A);
  static const Color textMuted = Color(0xFF8A8A8A);

  // Chart palette
  static const List<Color> chartColors = [
    Color(0xFF0A6640),
    Color(0xFFC9920A),
    Color(0xFF1A3A6E),
    Color(0xFF2FA89F),
    Color(0xFFE8500A),
    Color(0xFF8A8368),
    Color(0xFF063D27),
    Color(0xFFB0B0B0),
  ];
}

class AppTheme {
  static ThemeData lightTheme(BuildContext context) {
    final base = ThemeData.light(useMaterial3: true);

    return base.copyWith(
      colorScheme: const ColorScheme.light(
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        surface: AppColors.surface,
        error: AppColors.danger,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: AppColors.textPrimary,
      ),
      scaffoldBackgroundColor: AppColors.background,
      textTheme: base.textTheme.copyWith(
        displayLarge: const TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
          fontFamily: 'Inter',
        ),
        displayMedium: const TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
          fontFamily: 'Inter',
        ),
        titleLarge: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
          fontFamily: 'Inter',
        ),
        titleMedium: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
          fontFamily: 'Inter',
        ),
        bodyLarge: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: AppColors.textPrimary,
          fontFamily: 'Inter',
        ),
        bodyMedium: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w400,
          color: AppColors.textSecondary,
          fontFamily: 'Inter',
        ),
        labelLarge: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.textSecondary,
          letterSpacing: 0.5,
          fontFamily: 'Inter',
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        color: AppColors.cardBg,
        surfaceTintColor: Colors.transparent,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.divider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.divider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.background,
        selectedColor: AppColors.primary.withValues(alpha: 0.1),
        labelStyle: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          fontFamily: 'Inter',
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        side: const BorderSide(color: AppColors.divider),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.divider,
        thickness: 1,
        space: 1,
      ),
      appBarTheme: const AppBarTheme(
        elevation: 0,
        centerTitle: false,
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        titleTextStyle: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: Colors.white,
          fontFamily: 'Inter',
        ),
      ),
      navigationRailTheme: const NavigationRailThemeData(
        backgroundColor: AppColors.surface,
        selectedIconTheme: IconThemeData(color: AppColors.primary),
        selectedLabelTextStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.primary,
          fontFamily: 'Inter',
        ),
        unselectedIconTheme: IconThemeData(color: AppColors.textSecondary),
        unselectedLabelTextStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: AppColors.textSecondary,
          fontFamily: 'Inter',
        ),
      ),
    );
  }
}

// Breakpoints for responsive layout
class Breakpoints {
  static const double mobile = 600;
  static const double tablet = 1024;
  static const double desktop = 1440;

  static bool isMobile(BuildContext context) =>
      MediaQuery.of(context).size.width < mobile;
  static bool isTablet(BuildContext context) =>
      MediaQuery.of(context).size.width >= mobile &&
      MediaQuery.of(context).size.width < tablet;
  static bool isDesktop(BuildContext context) =>
      MediaQuery.of(context).size.width >= tablet;
}
