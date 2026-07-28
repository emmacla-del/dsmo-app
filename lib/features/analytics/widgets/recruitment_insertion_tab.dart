// lib/features/analytics/widgets/recruitment_insertion_tab.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/onefop_dashboard_providers.dart';
import 'common_cards.dart';
import 'analytics_section_header.dart';

class RecruitmentInsertionTab extends ConsumerWidget {
  const RecruitmentInsertionTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(dashboardFilterProvider).period;
    final firstTimeAsync = ref.watch(onefopFirstTimeEmploymentProvider(period));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AnalyticsSectionHeader(title: 'Recrutement & Insertion'),
          const SizedBox(height: 16),
          firstTimeAsync.when(
            loading: () => const Shimmer(height: 400),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _FirstTimeEmploymentContent(data: data),
          ),
        ],
      ),
    );
  }
}

class _FirstTimeEmploymentContent extends StatelessWidget {
  final dynamic data;
  const _FirstTimeEmploymentContent({required this.data});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Funnel row
        Row(
          children: [
            Expanded(
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Demandes enregistrées',
                        style: const TextStyle(
                            fontSize: 9, color: TextColor.muted)),
                    const SizedBox(height: 6),
                    Text(formatNumber(data.seekersTotal),
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: AccentColor.blue,
                        )),
                    const SizedBox(height: 4),
                    Text('${data.seekersMale} H · ${data.seekersFemale} F',
                        style: const TextStyle(
                            fontSize: 9, color: TextColor.muted)),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            const Icon(Icons.arrow_forward, size: 20, color: TextColor.muted),
            const SizedBox(width: 12),
            Expanded(
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Primo-recrutés',
                        style: const TextStyle(
                            fontSize: 9, color: TextColor.muted)),
                    const SizedBox(height: 6),
                    Text(formatNumber(data.recruitsTotal),
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: AccentColor.teal,
                        )),
                    const SizedBox(height: 4),
                    Text('${data.recruitsMale} H · ${data.recruitsFemale} F',
                        style: const TextStyle(
                            fontSize: 9, color: TextColor.muted)),
                  ],
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 14),

        // Conversion rate
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          decoration: BoxDecoration(
            color: AccentColor.teal.withAlpha(20),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AccentColor.teal.withAlpha(40)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Taux de conversion',
                  style: const TextStyle(
                      fontSize: 11, color: TextColor.secondary)),
              Text('${data.conversionRate.toStringAsFixed(1)}%',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AccentColor.teal,
                  )),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Age breakdown
        sectionLabel('Âge des recrutés'),
        const SizedBox(height: 10),
        GlassCard(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                _AgePill(
                  label: '15-24',
                  value: data.recruitsAge15_24,
                  total: data.recruitsTotal,
                  color: const Color(0xFF60A5FA),
                ),
                const SizedBox(width: 8),
                _AgePill(
                  label: '25-34',
                  value: data.recruitsAge25_34,
                  total: data.recruitsTotal,
                  color: const Color(0xFF34D399),
                ),
                const SizedBox(width: 8),
                _AgePill(
                  label: '35+',
                  value: data.recruitsAge35Plus,
                  total: data.recruitsTotal,
                  color: const Color(0xFFFBBF24),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),

        // Contract types
        sectionLabel('Type de contrat'),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: GlassCard(
                child: Column(
                  children: [
                    Text('CDI / Permanent',
                        style: const TextStyle(
                            fontSize: 10, color: AccentColor.blue)),
                    const SizedBox(height: 6),
                    Text(formatNumber(data.recruitsPermanent),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AccentColor.blue,
                        )),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: GlassCard(
                child: Column(
                  children: [
                    Text('Temporaire',
                        style: const TextStyle(
                            fontSize: 10, color: AccentColor.gold)),
                    const SizedBox(height: 6),
                    Text(formatNumber(data.recruitsTemporary),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AccentColor.gold,
                        )),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _AgePill extends StatelessWidget {
  final String label;
  final int value;
  final int total;
  final Color color;

  const _AgePill({
    required this.label,
    required this.value,
    required this.total,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final percent = total > 0 ? (value / total * 100).toStringAsFixed(0) : '0';
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(label, style: TextStyle(fontSize: 10, color: color)),
            const SizedBox(height: 4),
            Text(formatNumber(value),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: TextColor.primary,
                )),
            Text('$percent%',
                style: const TextStyle(fontSize: 9, color: TextColor.muted)),
          ],
        ),
      ),
    );
  }
}
