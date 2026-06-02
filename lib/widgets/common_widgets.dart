// lib/widgets/common_widgets.dart
import 'package:flutter/material.dart';
import '../theme/ultra_theme.dart';

class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;
  final EdgeInsets? margin;
  final double? borderRadius;
  final Color? backgroundColor;
  final List<BoxShadow>? shadows;
  final VoidCallback? onTap;
  final bool animate;

  const GlassCard(
      {super.key,
      required this.child,
      this.padding,
      this.margin,
      this.borderRadius,
      this.backgroundColor,
      this.shadows,
      this.onTap,
      this.animate = true});

  @override
  Widget build(BuildContext context) {
    Widget card = Container(
      margin: margin ?? EdgeInsets.zero,
      decoration: BoxDecoration(
        color: backgroundColor ?? UltraTheme.surface,
        borderRadius:
            BorderRadius.circular(borderRadius ?? UltraTheme.radiusLarge),
        border: Border.all(color: const Color(0x0D000000), width: 1),
        boxShadow: shadows ?? UltraTheme.softShadow,
      ),
      child: ClipRRect(
        borderRadius:
            BorderRadius.circular(borderRadius ?? UltraTheme.radiusLarge),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            splashColor: UltraTheme.primary.withValues(alpha: 0.05),
            highlightColor: UltraTheme.primary.withValues(alpha: 0.02),
            borderRadius:
                BorderRadius.circular(borderRadius ?? UltraTheme.radiusLarge),
            child: Padding(
                padding: padding ?? const EdgeInsets.all(20), child: child),
          ),
        ),
      ),
    );
    if (animate) {
      card = card;
    }
    return card;
  }
}

class AnimatedNavItem extends StatefulWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  final bool isExtended;
  const AnimatedNavItem(
      {super.key,
      required this.icon,
      required this.label,
      required this.isSelected,
      required this.onTap,
      this.isExtended = false});
  @override
  State<AnimatedNavItem> createState() => _AnimatedNavItemState();
}

class _AnimatedNavItemState extends State<AnimatedNavItem> {
  bool _isHovered = false;
  @override
  Widget build(BuildContext context) {
    final isActive = widget.isSelected || _isHovered;
    return LayoutBuilder(
      builder: (context, constraints) {
        final showLabel = widget.isExtended && constraints.maxWidth > 120;
        return MouseRegion(
          onEnter: (_) => setState(() => _isHovered = true),
          onExit: (_) => setState(() => _isHovered = false),
          child: GestureDetector(
            onTap: widget.onTap,
            child: AnimatedContainer(
              duration: UltraTheme.fast,
              margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              padding: showLabel
                  ? const EdgeInsets.symmetric(horizontal: 16, vertical: 12)
                  : const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: widget.isSelected ? UltraTheme.primaryGradient : null,
                color: widget.isSelected
                    ? null
                    : (_isHovered
                        ? UltraTheme.primary.withValues(alpha: 0.08)
                        : Colors.transparent),
                borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
              ),
              child: showLabel
                  ? Row(mainAxisSize: MainAxisSize.min, children: [
                      AnimatedScale(
                          scale: isActive ? 1.1 : 1.0,
                          duration: UltraTheme.fast,
                          child: Icon(widget.icon,
                              color: widget.isSelected
                                  ? Colors.white
                                  : (_isHovered
                                      ? UltraTheme.primary
                                      : UltraTheme.textMuted),
                              size: 20)),
                      const SizedBox(width: 12),
                      Text(widget.label,
                          style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              fontWeight: widget.isSelected
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                              color: widget.isSelected
                                  ? Colors.white
                                  : (_isHovered
                                      ? UltraTheme.primary
                                      : UltraTheme.textSecondary))),
                    ])
                  : AnimatedScale(
                      scale: isActive ? 1.15 : 1.0,
                      duration: UltraTheme.fast,
                      child: Icon(widget.icon,
                          color: widget.isSelected
                              ? UltraTheme.primary
                              : (_isHovered
                                  ? UltraTheme.primary
                                  : UltraTheme.textMuted),
                          size: 22)),
            ),
          ),
        );
      },
    );
  }
}

class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;
  const StatusBadge(
      {super.key, required this.label, required this.color, this.icon});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
          border: Border.all(color: color.withValues(alpha: 0.2))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 4)
        ],
        Text(label,
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: color)),
      ]),
    );
  }
}

class EntityTypeCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;
  const EntityTypeCard(
      {super.key,
      required this.icon,
      required this.label,
      required this.value,
      required this.onTap});
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: UltraTheme.background,
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            border: Border.all(color: const Color(0x0D000000)),
          ),
          child: Row(children: [
            Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                    color: UltraTheme.primary.withValues(alpha: 0.08),
                    borderRadius:
                        BorderRadius.circular(UltraTheme.radiusSmall)),
                child: Icon(icon, color: UltraTheme.primary, size: 22)),
            const SizedBox(width: 14),
            Expanded(
                child: Text(label,
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.textPrimary))),
            const Icon(Icons.arrow_forward_ios,
                size: 14, color: UltraTheme.textMuted),
          ]),
        ),
      ),
    );
  }
}

class SubmissionOptionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;
  const SubmissionOptionCard(
      {super.key,
      required this.icon,
      required this.title,
      required this.subtitle,
      required this.color,
      required this.onTap});
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [
              color.withValues(alpha: 0.08),
              color.withValues(alpha: 0.02)
            ], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            border: Border.all(color: color.withValues(alpha: 0.15)),
          ),
          child: Row(children: [
            Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius:
                        BorderRadius.circular(UltraTheme.radiusMedium)),
                child: Icon(icon, color: color, size: 24)),
            const SizedBox(width: 16),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(title,
                      style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: UltraTheme.textPrimary)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: UltraTheme.textMuted)),
                ])),
            Icon(Icons.arrow_forward_ios,
                size: 14, color: color.withValues(alpha: 0.5)),
          ]),
        ),
      ),
    );
  }
}
