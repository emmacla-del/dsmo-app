// lib/screens/report/report_widgets.dart
import 'package:flutter/material.dart';
import '../../theme/ultra_theme.dart';

class SectionLabel extends StatelessWidget {
  final IconData icon;
  final String label;
  const SectionLabel({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: UltraTheme.textMuted),
        const SizedBox(width: 8),
        Text(label,
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textMuted)),
      ],
    );
  }
}

class DropdownField<T> extends StatelessWidget {
  final String label;
  final T value;
  final List<T> items;
  final String Function(T) itemLabel;
  final ValueChanged<T?> onChanged;

  const DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.itemLabel,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: UltraTheme.textMuted.withAlpha(50)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style:
                  const TextStyle(fontSize: 10, color: UltraTheme.textMuted)),
          const SizedBox(height: 2),
          DropdownButtonHideUnderline(
            child: DropdownButton<T>(
              value: value,
              isExpanded: true,
              isDense: true,
              dropdownColor: UltraTheme.surface,
              items: items
                  .map((i) =>
                      DropdownMenuItem(value: i, child: Text(itemLabel(i))))
                  .toList(),
              onChanged: onChanged,
            ),
          ),
        ],
      ),
    );
  }
}

class DateField extends StatelessWidget {
  final String label;
  final DateTime? date;
  final VoidCallback onTap;
  const DateField({required this.label, this.date, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: UltraTheme.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: UltraTheme.textMuted.withAlpha(50)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style:
                    const TextStyle(fontSize: 10, color: UltraTheme.textMuted)),
            const SizedBox(height: 2),
            Text(
              date != null
                  ? '${date!.day}/${date!.month}/${date!.year}'
                  : '--/--/----',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}

class IconAction extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  const IconAction(
      {required this.icon, required this.tooltip, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: UltraTheme.background,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: UltraTheme.textMuted.withAlpha(50)),
          ),
          child: Icon(icon, size: 16, color: UltraTheme.textSecondary),
        ),
      ),
    );
  }
}

class PdfBadge extends StatelessWidget {
  const PdfBadge();
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
          color: const Color(0xFFFAECE7),
          borderRadius: BorderRadius.circular(20)),
      child: const Text('PDF',
          style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Color(0xFF993C1D))),
    );
  }
}
