import 'package:flutter/material.dart';
import '../../../core/theme/onefop_colors.dart';
import '../../../core/theme/typography.dart';

class NavIconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const NavIconBtn({super.key, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: OnefopColors.surface,
            border: Border.all(color: OnefopColors.border),
          ),
          child: Icon(icon, size: 20, color: OnefopColors.white60),
        ),
      );
}

class NavPill extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool loading;
  final bool isSubmit;

  const NavPill({
    super.key,
    required this.label,
    required this.icon,
    this.onTap,
    this.loading = false,
    this.isSubmit = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = isSubmit ? OnefopColors.gold : OnefopColors.teal;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: onTap == null ? color.withAlpha(80) : color,
          borderRadius: BorderRadius.circular(24),
        ),
        child: loading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white))
            : Row(mainAxisSize: MainAxisSize.min, children: [
                Text(label,
                    style:
                        mono(13, weight: FontWeight.w700, color: Colors.white)),
                const SizedBox(width: 6),
                Icon(icon, size: 15, color: Colors.white),
              ]),
      ),
    );
  }
}

class WelcomeCta extends StatelessWidget {
  final VoidCallback onTap;
  const WelcomeCta({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
              color: OnefopColors.teal,
              borderRadius: BorderRadius.circular(14)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text('Commencer / Start',
                style: mono(15, weight: FontWeight.w700, color: Colors.white)),
            const SizedBox(width: 10),
            const Icon(Icons.arrow_forward_rounded,
                size: 18, color: Colors.white),
          ]),
        ),
      );
}

class PhaseChips extends StatelessWidget {
  final int currentStep;
  final int totalSteps;
  final Function(int) onPhaseTap;

  const PhaseChips({
    super.key,
    required this.currentStep,
    required this.totalSteps,
    required this.onPhaseTap,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: List.generate(totalSteps, (index) {
          final isActive = index == currentStep;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onPhaseTap(index),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: isActive ? OnefopColors.teal : OnefopColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color:
                          isActive ? OnefopColors.teal : OnefopColors.border),
                ),
                child: Text(
                  'Étape ${index + 1}',
                  style: mono(11,
                      color: isActive ? Colors.white : OnefopColors.white70),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class TopBar extends StatelessWidget {
  final String entityLabel;
  final String stepTitle;
  final double progressValue;
  final VoidCallback? onBack;
  final int currentStep;
  final int totalSteps;

  const TopBar({
    super.key,
    required this.entityLabel,
    required this.stepTitle,
    required this.progressValue,
    this.onBack,
    required this.currentStep,
    required this.totalSteps,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      decoration: const BoxDecoration(
        color: OnefopColors.card,
        border:
            Border(bottom: BorderSide(color: OnefopColors.border, width: 0.5)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              if (onBack != null)
                GestureDetector(
                  onTap: onBack,
                  child: const Icon(Icons.arrow_back_rounded,
                      color: OnefopColors.white70, size: 22),
                ),
              Expanded(
                child: Column(
                  children: [
                    Text(entityLabel.toUpperCase(),
                        style: mono(10,
                            color: OnefopColors.teal, weight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(stepTitle,
                        style: mono(14,
                            weight: FontWeight.bold,
                            color: OnefopColors.white)),
                  ],
                ),
              ),
              if (onBack != null) const SizedBox(width: 40),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text('$currentStep/$totalSteps',
                  style: mono(10, color: OnefopColors.white40)),
              const SizedBox(width: 8),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progressValue,
                    backgroundColor: OnefopColors.border,
                    valueColor:
                        const AlwaysStoppedAnimation<Color>(OnefopColors.teal),
                    minHeight: 4,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class StepDots extends StatelessWidget {
  final int current;
  final int total;
  const StepDots({super.key, required this.current, required this.total});

  @override
  Widget build(BuildContext context) {
    if (total > 8) {
      // Fixed: proper string interpolation instead of unterminated string
      return Text('$current / $total',
          style: mono(11, color: OnefopColors.white40));
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(total, (i) {
        final active = i == current;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: active ? 16 : 6,
          height: 6,
          decoration: BoxDecoration(
            color: active ? OnefopColors.teal : OnefopColors.border,
            borderRadius: BorderRadius.circular(3),
          ),
        );
      }),
    );
  }
}
