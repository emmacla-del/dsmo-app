// lib/features/analytics/widgets/analytics_widgets.dart
// Reusable layout primitive for the analytics dashboard.
// NO model imports — only String, int, double, IconData.

import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart' show Breakpoints;

// ============================================================
// RESPONSIVE GRID
// ============================================================

class ResponsiveGrid extends StatelessWidget {
  final List<Widget> children;
  final double spacing;
  final double runSpacing;

  const ResponsiveGrid(
      {super.key,
      required this.children,
      this.spacing = 16,
      this.runSpacing = 16});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    int crossAxisCount;
    if (width < Breakpoints.mobile) {
      crossAxisCount = 1;
    } else if (width < Breakpoints.tablet) {
      crossAxisCount = 2;
    } else if (width < Breakpoints.desktop) {
      crossAxisCount = 3;
    } else {
      crossAxisCount = 4;
    }

    return Wrap(
      spacing: spacing,
      runSpacing: runSpacing,
      children: children.map((child) {
        return SizedBox(
          width:
              (width - (spacing * (crossAxisCount - 1)) - 48) / crossAxisCount,
          child: child,
        );
      }).toList(),
    );
  }
}
