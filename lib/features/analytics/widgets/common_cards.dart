// ==================================================================
// common_cards.dart – reusable UI components, design tokens, helpers
// ==================================================================
import 'package:flutter/material.dart';

// ===== DESIGN TOKENS =====
class InkColor {
  static const base = Color(0xFF0B1120);
  static const surface = Color(0xFF141E30);
  static const card = Color(0xFF1A2540);
  static const border = Color(0x14FFFFFF);
}

class AccentColor {
  static const teal = Color(0xFF00C896);
  static const blue = Color(0xFF3B82F6);
  static const rose = Color(0xFFFF4D6D);
  static const gold = Color(0xFFE8A000);
  static const purple = Color(0xFFAA44FF);
  static const cyan = Color(0xFF44DDFF);
}

class TextColor {
  static const primary = Color(0xFFFFFFFF);
  static const secondary = Color(0xAAFFFFFF);
  static const muted = Color(0x55FFFFFF);
  static const label = Color(0x77FFFFFF);
}

class RegionItem {
  final String id, name;
  const RegionItem(this.id, this.name);
}

// ===== UTILITY HELPERS =====
String formatNumber(int n) {
  if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
  return '$n';
}

TextStyle textMono(double size,
    {Color color = TextColor.secondary,
    FontWeight weight = FontWeight.normal}) {
  return TextStyle(
    fontFamily: 'SpaceMono',
    fontSize: size,
    fontWeight: weight,
    color: color,
    letterSpacing: 0.3,
  );
}

Widget sectionLabel(String text) {
  return Row(children: [
    Container(
        width: 3,
        height: 14,
        margin: const EdgeInsets.only(right: 8),
        decoration: BoxDecoration(
            color: AccentColor.teal, borderRadius: BorderRadius.circular(2))),
    Text(text, style: textMono(10, color: TextColor.secondary)),
  ]);
}

Widget emptyState(String msg) {
  return SizedBox(
      height: 100,
      child: Center(
          child: Text(msg, style: textMono(11, color: TextColor.muted))));
}

// ===== ANIMATED CARD =====
class AnimatedCard extends StatelessWidget {
  final Animation<double> animation;
  final Widget child;
  const AnimatedCard({super.key, required this.animation, required this.child});

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: animation,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.05), end: Offset.zero)
            .animate(animation),
        child: child,
      ),
    );
  }
}

// ===== GLASS CARD =====
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  const GlassCard({super.key, required this.child, this.padding, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: InkColor.card,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        splashColor: AccentColor.teal.withAlpha(15),
        child: Container(
          padding: padding ?? const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: InkColor.border),
          ),
          child: child,
        ),
      ),
    );
  }
}

// ===== KPI CARD =====
class KpiDef {
  final String key, label;
  final IconData icon;
  final Color color;
  const KpiDef(this.key, this.label, this.icon, this.color);
}

class KpiCard extends StatefulWidget {
  final KpiDef def;
  final String value;
  final int? delta;
  final VoidCallback onTap;
  const KpiCard(
      {super.key,
      required this.def,
      required this.value,
      required this.delta,
      required this.onTap});

  @override
  State<KpiCard> createState() => _KpiCardState();
}

class _KpiCardState extends State<KpiCard> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final d = widget.def;
    return Semantics(
      label: '${d.label}: ${widget.value}',
      button: true,
      child: MouseRegion(
        onEnter: (_) => setState(() => _hover = true),
        onExit: (_) => setState(() => _hover = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          decoration: BoxDecoration(
            color: InkColor.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color: _hover ? d.color.withAlpha(100) : InkColor.border),
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
                              color: d.color.withAlpha(20),
                              borderRadius: BorderRadius.circular(8)),
                          child: Icon(d.icon, color: d.color, size: 16),
                        ),
                        if (widget.delta != null)
                          DeltaBadge(delta: widget.delta!),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.value,
                            style: textMono(22,
                                color: d.color, weight: FontWeight.bold)),
                        const SizedBox(height: 2),
                        Text(d.label,
                            style: textMono(9, color: TextColor.label)),
                      ],
                    ),
                  ],
                ),
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
    final pos = delta >= 0;
    final color = pos ? AccentColor.teal : AccentColor.rose;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
          color: color.withAlpha(20),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withAlpha(40))),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(pos ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
              size: 9, color: color),
          const SizedBox(width: 2),
          Text('${delta.abs()}',
              style: textMono(9, color: color, weight: FontWeight.bold)),
        ],
      ),
    );
  }
}

// ===== YOY ROW =====
class YoyDef {
  final String label;
  final IconData icon;
  final int current;
  final int? previous;
  final bool lowerBetter;
  const YoyDef(this.label, this.icon, this.current, this.previous,
      {this.lowerBetter = false});
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
    final isPos = def.lowerBetter ? delta < 0 : delta > 0;
    final color = delta == 0
        ? TextColor.muted
        : isPos
            ? AccentColor.teal
            : AccentColor.rose;

    String pctStr;
    if (pct != null) {
      pctStr = '${pct >= 0 ? '+' : ''}${pct.toStringAsFixed(1)}%';
    } else {
      pctStr = '${delta >= 0 ? '+' : ''}$delta';
    }

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 14),
      decoration: isLast
          ? null
          : const BoxDecoration(
              border: Border(bottom: BorderSide(color: InkColor.border))),
      child: Row(children: [
        Expanded(
          flex: 3,
          child: Row(children: [
            Icon(def.icon, size: 13, color: AccentColor.teal.withAlpha(180)),
            const SizedBox(width: 6),
            Text(def.label, style: textMono(11, color: TextColor.secondary)),
          ]),
        ),
        Expanded(
            flex: 2,
            child: Text(formatNumber(p),
                textAlign: TextAlign.center,
                style: textMono(11, color: TextColor.muted))),
        Expanded(
            flex: 2,
            child: Text(formatNumber(c),
                textAlign: TextAlign.center,
                style: textMono(11,
                    color: TextColor.primary, weight: FontWeight.bold))),
        Expanded(
          flex: 2,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Icon(
                  delta == 0
                      ? Icons.remove
                      : isPos
                          ? Icons.trending_up
                          : Icons.trending_down,
                  size: 11,
                  color: color),
              const SizedBox(width: 2),
              Text(pctStr,
                  style: textMono(10, color: color, weight: FontWeight.bold)),
            ],
          ),
        ),
      ]),
    );
  }
}

// ===== YEAR TAB BAR =====
class YearTabBar extends StatelessWidget {
  final int year;
  final ValueChanged<int> onYear;
  const YearTabBar({super.key, required this.year, required this.onYear});

  @override
  Widget build(BuildContext context) {
    final currentYear = DateTime.now().year;
    final years = List.generate(5, (i) => currentYear - i);
    return Container(
      color: InkColor.surface,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          Text('ANNÉE', style: textMono(9, color: TextColor.muted)),
          const SizedBox(width: 12),
          ...years.map((y) => Padding(
                padding: const EdgeInsets.only(right: 6),
                child: YearChip(
                    year: y, selected: y == year, onTap: () => onYear(y)),
              )),
        ]),
      ),
    );
  }
}

class YearChip extends StatelessWidget {
  final int year;
  final bool selected;
  final VoidCallback onTap;
  const YearChip(
      {super.key,
      required this.year,
      required this.selected,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? AccentColor.teal : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border:
              Border.all(color: selected ? AccentColor.teal : InkColor.border),
        ),
        child: Text('$year',
            style: textMono(11,
                color: selected ? InkColor.base : TextColor.secondary,
                weight: selected ? FontWeight.bold : FontWeight.normal)),
      ),
    );
  }
}

// ===== FILTER SHEET =====
class FilterSheet extends StatelessWidget {
  final List<RegionItem> regions;
  final String? selectedId;
  final void Function(String? id, String? name) onSelect;
  final VoidCallback onClear;
  const FilterSheet(
      {super.key,
      required this.regions,
      required this.selectedId,
      required this.onSelect,
      required this.onClear});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
          color: InkColor.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
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
                      borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('FILTRER PAR RÉGION',
                style: textMono(12, color: TextColor.primary)),
            if (selectedId != null)
              TextButton(
                  onPressed: onClear,
                  child: Text('EFFACER',
                      style: textMono(10, color: AccentColor.rose))),
          ]),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: regions.map((r) {
              final sel = r.id == selectedId;
              return GestureDetector(
                onTap: () => onSelect(r.id, r.name),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                      color: sel ? AccentColor.teal : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: sel ? AccentColor.teal : InkColor.border)),
                  child: Text(r.name,
                      style: textMono(11,
                          color: sel ? InkColor.base : TextColor.secondary,
                          weight: sel ? FontWeight.bold : FontWeight.normal)),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

// ===== DRILL SHEET =====
class DrillSheet extends StatelessWidget {
  final String title, value, desc;
  final List<Map<String, dynamic>> rows;
  const DrillSheet(
      {super.key,
      required this.title,
      required this.value,
      required this.desc,
      required this.rows});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
          color: InkColor.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
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
                      borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 16),
          Row(children: [
            Container(
                width: 2,
                height: 20,
                margin: const EdgeInsets.only(right: 10),
                color: AccentColor.teal),
            Text(title,
                style: textMono(15,
                    color: TextColor.primary, weight: FontWeight.bold))
          ]),
          const SizedBox(height: 6),
          Text(value,
              style: textMono(28,
                  color: AccentColor.teal, weight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(desc, style: textMono(11, color: TextColor.muted)),
          if (rows.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Divider(color: InkColor.border),
            const SizedBox(height: 8),
            ...rows.map((r) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(r['label']?.toString() ?? '',
                            style: textMono(12, color: TextColor.secondary)),
                        Text(r['value']?.toString() ?? '',
                            style: textMono(12,
                                color: TextColor.primary,
                                weight: FontWeight.bold)),
                      ]),
                )),
          ],
        ],
      ),
    );
  }
}

// ===== EXPORT TILE =====
class ExportTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label, sub;
  final VoidCallback onTap;
  const ExportTile(
      {super.key,
      required this.icon,
      required this.color,
      required this.label,
      required this.sub,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: InkColor.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withAlpha(40))),
        child: Row(children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: 12),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: textMono(12, color: TextColor.primary)),
            Text(sub, style: textMono(10, color: TextColor.muted))
          ]),
        ]),
      ),
    );
  }
}

// ===== TEAL BUTTON =====
class TealButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  const TealButton(
      {super.key,
      required this.label,
      required this.icon,
      this.onTap});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16),
      label: Text(label, style: textMono(12, color: InkColor.base)),
      style: ElevatedButton.styleFrom(
        backgroundColor: AccentColor.teal,
        foregroundColor: InkColor.base,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        elevation: 0,
      ),
    );
  }
}

// ===== SHIMMER =====
class Shimmer extends StatefulWidget {
  final double height;
  const Shimmer({super.key, required this.height});

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1400))
      ..repeat();
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Container(
        height: widget.height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          gradient: LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: const [
              Color(0xFF1A2540),
              Color(0xFF243060),
              Color(0xFF1A2540)
            ],
            stops: [
              (_anim.value - 0.3).clamp(0.0, 1.0),
              _anim.value.clamp(0.0, 1.0),
              (_anim.value + 0.3).clamp(0.0, 1.0)
            ],
          ),
        ),
      ),
    );
  }
}
