// lib/features/analytics/widgets/common_cards.dart
//
// Single design system for the ONEFOP analytics dashboard: palette,
// type scale, spacing scale, chart theming, and shared empty/loading
// state widgets. Every analytics screen/tab should import only this
// file for styling — no AppColors, no UltraTheme.
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:shimmer/shimmer.dart' as shimmer_pkg;

// ── Color Constants ───────────────────────────────────────────

class AccentColor {
  static const teal = Color(0xFF0D9488);
  static const blue = Color(0xFF3B82F6);
  static const rose = Color(0xFFE11D48);
  static const gold = Color(0xFFF59E0B);
}

class TextColor {
  static const primary = Color(0xFF1E293B);
  static const secondary = Color(0xFF64748B);
  static const muted = Color(0xFF94A3B8);
}

class InkColor {
  static const surface = Color(0xFFF8FAFC);
  static const card = Color(0xFFFFFFFF);
  static const border = Color(0xFFE2E8F0);
}

// ── Spacing Scale ──────────────────────────────────────────────
// The only gap/padding values analytics screens should use.

class Gap {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
}

// ── Type Scale ────────────────────────────────────────────────
// Named sizes for textMono()/inline TextStyles — replaces ad hoc
// literal font sizes scattered across tabs.

class TextSize {
  static const double micro = 9;
  static const double caption = 10;
  static const double label = 11;
  static const double body = 12;
  static const double section = 13;
  static const double title = 15;
  static const double metric = 18;
  static const double kpi = 22;
  static const double display = 28;
}

// ── Chart Theming ────────────────────────────────────────────
// Fixed color-to-meaning mapping so the same color always means the
// same thing across every chart in the dashboard, plus shared
// gridline/axis styling.

class ChartTheme {
  static const Color current = AccentColor.teal; // current period / positive
  static const Color comparison =
      AccentColor.blue; // prior period / male / secondary series
  static const Color negative =
      AccentColor.rose; // departures / deficits / female
  static const Color attention = AccentColor.gold; // warnings / tension

  static TextStyle get axisLabel =>
      textMono(TextSize.caption, color: TextColor.muted);

  static FlGridData get horizontalGrid => FlGridData(
        drawVerticalLine: false,
        getDrawingHorizontalLine: (_) =>
            const FlLine(color: InkColor.border, strokeWidth: 1),
      );

  static FlBorderData get noBorder => FlBorderData(show: false);
}

// ── Granularity Enum ────────────────────────────────────────

enum Granularity { year, quarter, semester, month }

// ── Format Helpers ────────────────────────────────────────────

String formatNumber(int number) {
  if (number >= 1000000) {
    return '${(number / 1000000).toStringAsFixed(1)}M';
  } else if (number >= 1000) {
    return '${(number / 1000).toStringAsFixed(1)}K';
  }
  return number.toString();
}

TextStyle textMono(double size, {Color? color, FontWeight? weight}) {
  return TextStyle(
    fontSize: size,
    color: color,
    fontWeight: weight,
    fontFamily: 'monospace',
    fontFamilyFallback: const ['Courier', 'monospace'],
  );
}

// ── Section Label ─────────────────────────────────────────────

Widget sectionLabel(String text) {
  return Text(
    text,
    style: const TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w600,
      color: TextColor.secondary,
    ),
  );
}

Widget subtitleLabel(String text) {
  return Padding(
    padding: const EdgeInsets.only(top: 2),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 11,
        fontStyle: FontStyle.italic,
        color: TextColor.muted,
      ),
    ),
  );
}

// ── Empty State ─────────────────────────────────────────────────

Widget emptyState(String message, {IconData icon = Icons.inbox_outlined}) {
  return Container(
    padding: const EdgeInsets.all(Gap.lg),
    decoration: BoxDecoration(
      color: InkColor.card,
      border: Border.all(color: InkColor.border),
      borderRadius: BorderRadius.circular(12),
      boxShadow: cardShadow,
    ),
    child: Column(
      children: [
        Icon(icon, size: 32, color: TextColor.muted),
        const SizedBox(height: Gap.sm),
        Text(
          message,
          style: textMono(TextSize.section, color: TextColor.muted),
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}

// ── Card Depth ────────────────────────────────────────────────
// One subtle shadow recipe shared by every card — just enough lift
// to read as a surface, not a Material "raised" effect.

const List<BoxShadow> cardShadow = [
  BoxShadow(
    color: Color(0x0A1E293B),
    blurRadius: 16,
    offset: Offset(0, 4),
  ),
];

// ── Shimmer Loading ───────────────────────────────────────────
// Real shimmer sweep (via the shimmer package) — same constructor
// shape as before so existing `Shimmer(height: ...)` call sites
// across every tab pick this up with no changes.

class Shimmer extends StatelessWidget {
  final double height;
  final double? width;

  const Shimmer({
    super.key,
    required this.height,
    this.width,
  });

  @override
  Widget build(BuildContext context) {
    return shimmer_pkg.Shimmer.fromColors(
      baseColor: InkColor.border,
      highlightColor: InkColor.surface,
      child: Container(
        height: height,
        width: width,
        decoration: BoxDecoration(
          color: InkColor.border,
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}

// ── Glass Card ──────────────────────────────────────────────────
// True glassmorphism: a frosted backdrop blur + translucent fill, so
// it reads as "glass" over the dashboard's tinted/gradient surfaces
// instead of a plain bordered box.

class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: InkColor.card.withValues(alpha: 0.78),
            border: Border.all(color: Colors.white.withValues(alpha: 0.6)),
            borderRadius: BorderRadius.circular(16),
            boxShadow: cardShadow,
          ),
          child: child,
        ),
      ),
    );
  }
}

// ── Animated Card Wrapper ───────────────────────────────────────

class AnimatedCard extends StatelessWidget {
  final Animation<double> animation;
  final Widget child;

  const AnimatedCard({
    super.key,
    required this.animation,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        return Opacity(
          opacity: animation.value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - animation.value)),
            child: child,
          ),
        );
      },
    );
  }
}

// ============================================================
// NEW: KPI Classes
// ============================================================

class KpiDef {
  final String key;
  final String label;
  final IconData icon;
  final Color color;

  const KpiDef(this.key, this.label, this.icon, this.color);
}

class KpiCard extends StatefulWidget {
  final KpiDef def;
  final String value;
  final int? delta;
  final VoidCallback onTap;

  const KpiCard({
    super.key,
    required this.def,
    required this.value,
    required this.delta,
    required this.onTap,
  });

  @override
  State<KpiCard> createState() => _KpiCardState();
}

class _KpiCardState extends State<KpiCard> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final d = widget.def;
    return MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        transform: Matrix4.translationValues(0, _hover ? -2 : 0, 0),
        decoration: BoxDecoration(
          color: InkColor.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: _hover ? d.color.withAlpha(110) : InkColor.border,
          ),
          boxShadow: _hover
              ? [
                  BoxShadow(
                    color: d.color.withAlpha(30),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ]
              : cardShadow,
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: widget.onTap,
            borderRadius: BorderRadius.circular(14),
            splashColor: d.color.withAlpha(15),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              d.color.withAlpha(35),
                              d.color.withAlpha(15),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: Icon(d.icon, color: d.color, size: 16),
                      ),
                      if (widget.delta != null)
                        DeltaBadge(delta: widget.delta!),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.value,
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: TextColor.primary,
                          fontFamily: 'monospace',
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        d.label,
                        style: const TextStyle(
                          fontSize: 9,
                          color: TextColor.muted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class DeltaBadge extends StatelessWidget {
  final int delta;

  const DeltaBadge({super.key, required this.delta});

  @override
  Widget build(BuildContext context) {
    final isNeutral = delta == 0;
    final isPositive = delta > 0;
    final color = isNeutral
        ? TextColor.muted
        : isPositive
            ? AccentColor.teal
            : AccentColor.rose;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(40)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isNeutral
                ? Icons.remove_rounded
                : isPositive
                    ? Icons.arrow_upward_rounded
                    : Icons.arrow_downward_rounded,
            size: 9,
            color: color,
          ),
          const SizedBox(width: 2),
          Text(
            delta.abs().toString(),
            style: TextStyle(
                fontSize: 9, color: color, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// NEW: Drill Sheet
// ============================================================

class DrillSheet extends StatelessWidget {
  final String title;
  final String value;
  final String desc;
  final List<Map<String, dynamic>> rows;

  const DrillSheet({
    super.key,
    required this.title,
    required this.value,
    required this.desc,
    required this.rows,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: InkColor.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 32,
              height: 3,
              decoration: BoxDecoration(
                color: InkColor.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                width: 2,
                height: 20,
                margin: const EdgeInsets.only(right: 10),
                color: AccentColor.teal,
              ),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: TextColor.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: AccentColor.teal,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            desc,
            style: const TextStyle(fontSize: 11, color: TextColor.muted),
          ),
          if (rows.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Divider(color: InkColor.border),
            const SizedBox(height: 8),
            ...rows.map(
              (r) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      r['label']?.toString() ?? '',
                      style: const TextStyle(
                          fontSize: 12, color: TextColor.secondary),
                    ),
                    Text(
                      r['value']?.toString() ?? '',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: TextColor.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ============================================================
// NEW: YoY Table Classes
// ============================================================

class YoyDef {
  final String label;
  final IconData icon;
  final int current;
  final int? previous;
  final bool lowerBetter;

  const YoyDef(
    this.label,
    this.icon,
    this.current,
    this.previous, {
    this.lowerBetter = false,
  });
}

class YoyRow extends StatelessWidget {
  final YoyDef def;
  final bool isLast;

  const YoyRow({super.key, required this.def, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final c = def.current;
    final p = def.previous ?? 0;
    final delta = c - p;
    final pct = p == 0 ? null : (delta / p.abs() * 100);
    final isPositive = def.lowerBetter ? delta < 0 : delta > 0;
    final color = delta == 0
        ? TextColor.muted
        : isPositive
            ? AccentColor.teal
            : AccentColor.rose;

    String pctStr;
    if (delta == 0) {
      pctStr = '0';
    } else if (pct != null) {
      pctStr = '${pct >= 0 ? '+' : ''}${pct.toStringAsFixed(1)}%';
    } else {
      pctStr = '${delta >= 0 ? '+' : ''}$delta';
    }

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 14),
      decoration: isLast
          ? null
          : const BoxDecoration(
              border: Border(bottom: BorderSide(color: InkColor.border)),
            ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Row(
              children: [
                Icon(def.icon,
                    size: 13, color: AccentColor.teal.withAlpha(180)),
                const SizedBox(width: 6),
                Text(
                  def.label,
                  style:
                      const TextStyle(fontSize: 11, color: TextColor.secondary),
                ),
              ],
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              formatNumber(p),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, color: TextColor.muted),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              formatNumber(c),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: TextColor.primary,
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Icon(
                  delta == 0
                      ? Icons.remove
                      : isPositive
                          ? Icons.trending_up
                          : Icons.trending_down,
                  size: 11,
                  color: color,
                ),
                const SizedBox(width: 2),
                Text(
                  pctStr,
                  style: TextStyle(
                      fontSize: 10, color: color, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// ONEPAGER COMPONENTS — used exclusively by the redesigned
// Synthèse tab (overview_tab.dart) + dashboard hero header.
// Existing components above (KpiCard, GlassCard, DeltaBadge, ...)
// are untouched and keep backing the other 7 analytics tabs.
//
// Built for a dense, single-screen BI layout (small stat tiles +
// a grid of compact panels) rather than stacked full-width sections.
// ============================================================

/// Canonical "what does this color mean" mapping — positive movement is
/// always teal/green, negative is always rose, slowdown is gold, no change
/// is slate. Centralizes the meaning already implicit in ChartTheme /
/// DeltaBadge so every onepager component applies one consistent rule
/// instead of a decorative color picked per widget.
class SemanticColor {
  static const positive = AccentColor.teal;
  static const negative = AccentColor.rose;
  static const warning = AccentColor.gold;
  static const neutral = TextColor.muted;

  static Color trend(num delta, {bool lowerBetter = false}) {
    if (delta == 0) return neutral;
    final isGood = lowerBetter ? delta < 0 : delta > 0;
    return isGood ? positive : negative;
  }
}

/// Small, dense stat tile for the onepager KPI strip — bare number + label,
/// optional tiny trend chip. Sized to sit many in a row, BI-dashboard style,
/// instead of the large card-per-KPI grid this replaces.
class CompactStatChip extends StatelessWidget {
  final String label;
  final String value;
  final int? delta;
  final bool lowerBetter;
  final VoidCallback? onTap;

  const CompactStatChip({
    super.key,
    required this.label,
    required this.value,
    this.delta,
    this.lowerBetter = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: InkColor.card,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          constraints: const BoxConstraints(minWidth: 140),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            border: Border.all(color: InkColor.border),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(value,
                      style: const TextStyle(
                        fontSize: TextSize.metric,
                        fontWeight: FontWeight.w800,
                        color: TextColor.primary,
                        fontFamily: 'monospace',
                      )),
                  if (delta != null) ...[
                    const SizedBox(width: 6),
                    _TrendChip(delta: delta!, lowerBetter: lowerBetter),
                  ],
                ],
              ),
              const SizedBox(height: 2),
              Text(label,
                  style: const TextStyle(fontSize: TextSize.caption, color: TextColor.secondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ),
    );
  }
}

/// Small panel for the onepager grid: a tiny uppercase title + content,
/// flat card chrome — the "small multiple" building block that replaces
/// the old full-width lettered sections.
class DashboardPanel extends StatelessWidget {
  final String title;
  final Widget child;
  final Widget? trailing;
  // Grid usage wraps this panel in a fixed-height SizedBox, where the
  // content should stretch to fill it (charts especially). The YoY panel
  // at the bottom of the page has no fixed height (unbounded scroll
  // context), where wrapping content in Expanded would throw a layout
  // exception ("RenderFlex children have non-zero flex but incoming
  // height constraints are unbounded") — so callers without a fixed
  // height must pass false here.
  final bool fillHeight;

  const DashboardPanel({
    super.key,
    required this.title,
    required this.child,
    this.trailing,
    this.fillHeight = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Gap.sm + 2),
      decoration: BoxDecoration(
        color: InkColor.card,
        border: Border.all(color: InkColor.border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: fillHeight ? MainAxisSize.max : MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title.toUpperCase(),
                style: textMono(TextSize.caption,
                        color: TextColor.secondary, weight: FontWeight.w700)
                    .copyWith(letterSpacing: 0.6),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: Gap.sm),
          fillHeight ? Expanded(child: child) : child,
        ],
      ),
    );
  }
}

/// Single auto-derived observation rendered as a compact pill — several
/// sit side by side in the findings ticker instead of a stacked card list
/// or a prose paragraph.
class FindingChip extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;

  const FindingChip({
    super.key,
    required this.icon,
    required this.text,
    this.color = AccentColor.teal,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withAlpha(12),
        border: Border.all(color: color.withAlpha(40)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              text,
              style: const TextStyle(
                  fontSize: TextSize.label, color: TextColor.primary, fontWeight: FontWeight.w500),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _TrendChip extends StatelessWidget {
  final int delta;
  final bool lowerBetter;

  const _TrendChip({required this.delta, required this.lowerBetter});

  @override
  Widget build(BuildContext context) {
    final color = SemanticColor.trend(delta, lowerBetter: lowerBetter);
    final isFlat = delta == 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(18),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            // Direction reflects what the number actually did; color (via
            // SemanticColor above) reflects whether that's good or bad —
            // for lowerBetter metrics these can disagree (e.g. departures
            // up is bad but still an up arrow), and conflating them made
            // the arrow contradict the number it sits next to.
            isFlat
                ? Icons.remove_rounded
                : delta > 0
                    ? Icons.arrow_upward_rounded
                    : Icons.arrow_downward_rounded,
            size: 11,
            color: color,
          ),
          const SizedBox(width: 3),
          Text(
            formatNumber(delta.abs()),
            style: TextStyle(
                fontSize: TextSize.label, color: color, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

/// Small muted footnote for source/methodology lines under KPIs and charts.
class MetricCaption extends StatelessWidget {
  final String text;

  const MetricCaption({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: Gap.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 1),
            child: Icon(Icons.info_outline_rounded, size: 11, color: TextColor.muted),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(text, style: textMono(TextSize.caption, color: TextColor.muted)),
          ),
        ],
      ),
    );
  }
}

