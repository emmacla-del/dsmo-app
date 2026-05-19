import 'package:flutter/material.dart';
import '../../../core/theme/onefop_colors.dart';
import '../../../core/theme/typography.dart';

class ReviewSection extends StatelessWidget {
  final String title;
  final int step;
  final VoidCallback onEdit;
  final List<(String, String)> items;

  const ReviewSection({
    super.key,
    required this.title,
    required this.step,
    required this.onEdit,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: OnefopColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: OnefopColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(title,
              style:
                  mono(13, weight: FontWeight.bold, color: OnefopColors.white)),
          const Spacer(),
          GestureDetector(
            onTap: onEdit,
            child: Row(children: [
              const Icon(Icons.edit_rounded,
                  size: 14, color: OnefopColors.teal),
              const SizedBox(width: 4),
              Text('Modifier', style: mono(11, color: OnefopColors.teal)),
            ]),
          ),
        ]),
        if (items.isNotEmpty) ...[
          const SizedBox(height: 8),
          for (int i = 0; i < items.length; i++) ...[
            Row(children: [
              Text(items[i].$1,
                  style: mono(11, color: OnefopColors.white60)),
              const Spacer(),
              Text(
                items[i].$2.isEmpty ? '—' : items[i].$2,
                style: mono(11,
                    weight: FontWeight.w600,
                    color: items[i].$2.isEmpty
                        ? OnefopColors.white40
                        : OnefopColors.white),
              ),
            ]),
            if (i < items.length - 1) const SizedBox(height: 4),
          ],
        ],
      ]),
    );
  }
}
