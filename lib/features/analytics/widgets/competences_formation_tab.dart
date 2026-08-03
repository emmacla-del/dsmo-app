// lib/features/analytics/widgets/competences_formation_tab.dart
// Compétences & Formation - Combines: Skills Gap, Training Domains, Internship Pipeline
// This matches the original "Inclusion & Capital" tab sections 3 & 4
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/onefop_dashboard_providers.dart';
import 'common_cards.dart';
import 'analytics_section_header.dart';

class CompetencesFormationTab extends ConsumerWidget {
  const CompetencesFormationTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(dashboardFilterProvider).period;
    final trainingAsync = ref.watch(onefopTrainingProvider(period));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AnalyticsSectionHeader(title: 'Compétences & Formation'),
          const SizedBox(height: 16),
          trainingAsync.when(
            loading: () => const Column(
              children: [
                Shimmer(height: 300),
                SizedBox(height: 16),
                Shimmer(height: 200),
              ],
            ),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _CompetencesFormationContent(data: data),
          ),
        ],
      ),
    );
  }
}

class _CompetencesFormationContent extends StatelessWidget {
  final dynamic data;
  const _CompetencesFormationContent({required this.data});

  @override
  Widget build(BuildContext context) {
    // Skills & Training data
    final List<dynamic> topSkillsRaw = data.topSkills as List? ?? [];
    final List<dynamic> topDomainsRaw = data.topDomains as List? ?? [];

    final List<Map<String, dynamic>> topSkills =
        topSkillsRaw.map((e) => Map<String, dynamic>.from(e as Map)).toList();

    final List<Map<String, dynamic>> topDomains =
        topDomainsRaw.map((e) => Map<String, dynamic>.from(e as Map)).toList();

    // Internship data
    final vacation = data.vacationInternships ?? 0;
    final academic = data.academicInternships ?? 0;
    final professional = data.professionalInternships ?? 0;
    final preEmployment = data.preEmploymentInternships ?? 0;
    final totalInternships = data.totalInternships ??
        (vacation + academic + professional + preEmployment);

    return Column(
      children: [
        // SECTION 1: Skills & Training Gap Analysis (2 columns)
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left: Skills in Demand with Gap Analysis
            Expanded(
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.psychology_outlined,
                            size: 14, color: AccentColor.blue),
                        const SizedBox(width: 6),
                        Text('COMPÉTENCES RECHERCHÉES',
                            style: textMono(10,
                                color: AccentColor.blue,
                                weight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (topSkills.isEmpty)
                      emptyState('Aucune donnée')
                    else
                      ...List.generate(
                          topSkills.length > 5 ? 5 : topSkills.length, (index) {
                        final item = topSkills[index];
                        final rank = index + 1;
                        final demand =
                            (item['demand'] ?? item['count'] ?? 0) as int;
                        final supply = (item['supply'] ?? 0) as int;
                        final gap = (item['gap'] ?? demand - supply) as int;

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  SizedBox(
                                    width: 28,
                                    child: Text('#$rank',
                                        style: textMono(10,
                                            color: TextColor.muted)),
                                  ),
                                  Expanded(
                                    child: Text(item['skill']?.toString() ?? '',
                                        style: textMono(11,
                                            color: TextColor.secondary),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                        color: gap > 0
                                            ? AccentColor.rose.withAlpha(30)
                                            : AccentColor.teal.withAlpha(30),
                                        borderRadius: BorderRadius.circular(4)),
                                    child: Text(
                                        gap > 0
                                            ? 'Déficit $gap'
                                            : 'Excédent ${gap.abs()}',
                                        style: textMono(9,
                                            color: gap > 0
                                                ? AccentColor.rose
                                                : AccentColor.teal,
                                            weight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(
                                    child: Stack(
                                      children: [
                                        Container(
                                          height: 6,
                                          decoration: BoxDecoration(
                                              borderRadius:
                                                  BorderRadius.circular(3),
                                              color:
                                                  Colors.white.withAlpha(12)),
                                        ),
                                        if (demand > 0 || supply > 0)
                                          Row(
                                            children: [
                                              if (demand > 0)
                                                Flexible(
                                                  flex: demand,
                                                  child: Container(
                                                    height: 6,
                                                    decoration: const BoxDecoration(
                                                        borderRadius:
                                                            BorderRadius.only(
                                                          topLeft:
                                                              Radius.circular(
                                                                  3),
                                                          bottomLeft:
                                                              Radius.circular(
                                                                  3),
                                                        ),
                                                        color:
                                                            AccentColor.blue),
                                                  ),
                                                ),
                                              if (supply > 0)
                                                Flexible(
                                                  flex: supply,
                                                  child: Container(
                                                    height: 6,
                                                    decoration: BoxDecoration(
                                                        color: AccentColor.teal
                                                            .withAlpha(180),
                                                        borderRadius: demand > 0
                                                            ? BorderRadius.zero
                                                            : BorderRadius
                                                                .circular(3)),
                                                  ),
                                                ),
                                            ],
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  SizedBox(
                                    width: 55,
                                    child: Text('$demand / $supply',
                                        style:
                                            textMono(9, color: TextColor.muted),
                                        textAlign: TextAlign.right),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      }),
                    if (topSkills.length > 5)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                            '+ ${topSkills.length - 5} autres compétences',
                            style: textMono(9, color: TextColor.muted)),
                      ),
                  ],
                ),
              ),
            ),

            const SizedBox(width: 12),

            // Right: Training Domains with Gap Analysis
            Expanded(
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.school_outlined,
                            size: 14, color: AccentColor.teal),
                        const SizedBox(width: 6),
                        Text('FORMATIONS DEMANDÉES',
                            style: textMono(10,
                                color: AccentColor.teal,
                                weight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (topDomains.isEmpty)
                      emptyState('Aucune donnée')
                    else
                      ...List.generate(
                          topDomains.length > 5 ? 5 : topDomains.length,
                          (index) {
                        final item = topDomains[index];
                        final rank = index + 1;
                        final demand =
                            (item['demand'] ?? item['count'] ?? 0) as int;
                        final supply = (item['supply'] ?? 0) as int;
                        final gap = (item['gap'] ?? demand - supply) as int;

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  SizedBox(
                                    width: 28,
                                    child: Text('#$rank',
                                        style: textMono(10,
                                            color: TextColor.muted)),
                                  ),
                                  Expanded(
                                    child: Text(
                                        item['domain']?.toString() ?? '',
                                        style: textMono(11,
                                            color: TextColor.secondary),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                        color: gap > 0
                                            ? AccentColor.rose.withAlpha(30)
                                            : AccentColor.teal.withAlpha(30),
                                        borderRadius: BorderRadius.circular(4)),
                                    child: Text(
                                        gap > 0
                                            ? 'Déficit $gap'
                                            : 'Excédent ${gap.abs()}',
                                        style: textMono(9,
                                            color: gap > 0
                                                ? AccentColor.rose
                                                : AccentColor.teal,
                                            weight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Expanded(
                                    child: Stack(
                                      children: [
                                        Container(
                                          height: 6,
                                          decoration: BoxDecoration(
                                              borderRadius:
                                                  BorderRadius.circular(3),
                                              color:
                                                  Colors.white.withAlpha(12)),
                                        ),
                                        if (demand > 0 || supply > 0)
                                          Row(
                                            children: [
                                              if (demand > 0)
                                                Flexible(
                                                  flex: demand,
                                                  child: Container(
                                                    height: 6,
                                                    decoration: const BoxDecoration(
                                                        borderRadius:
                                                            BorderRadius.only(
                                                          topLeft:
                                                              Radius.circular(
                                                                  3),
                                                          bottomLeft:
                                                              Radius.circular(
                                                                  3),
                                                        ),
                                                        color:
                                                            AccentColor.blue),
                                                  ),
                                                ),
                                              if (supply > 0)
                                                Flexible(
                                                  flex: supply,
                                                  child: Container(
                                                    height: 6,
                                                    decoration: BoxDecoration(
                                                        color: AccentColor.teal
                                                            .withAlpha(180),
                                                        borderRadius: demand > 0
                                                            ? BorderRadius.zero
                                                            : BorderRadius
                                                                .circular(3)),
                                                  ),
                                                ),
                                            ],
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  SizedBox(
                                    width: 55,
                                    child: Text('$demand / $supply',
                                        style:
                                            textMono(9, color: TextColor.muted),
                                        textAlign: TextAlign.right),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      }),
                    if (topDomains.length > 5)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                            '+ ${topDomains.length - 5} autres formations',
                            style: textMono(9, color: TextColor.muted)),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 16),

        // SECTION 2: Internship Pipeline (4 pills + total + breakdown)
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.work_history_outlined,
                      size: 14, color: AccentColor.gold),
                  const SizedBox(width: 6),
                  Text('PIPELINE DE STAGES',
                      style: textMono(10,
                          color: AccentColor.gold, weight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 16),

              // 4 Circular pills
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _InternshipPill(
                      label: 'Vacances',
                      value: vacation,
                      color: AccentColor.blue),
                  _InternshipPill(
                      label: 'Académique',
                      value: academic,
                      color: AccentColor.teal),
                  _InternshipPill(
                      label: 'Professionnel',
                      value: professional,
                      color: AccentColor.gold),
                  _InternshipPill(
                      label: 'Pré-emploi',
                      value: preEmployment,
                      color: AccentColor.rose),
                ],
              ),

              const SizedBox(height: 20),

              // Total interns
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: AccentColor.teal.withAlpha(12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  children: [
                    Text('TOTAL STAGIAIRES',
                        style: textMono(9, color: TextColor.muted)),
                    const SizedBox(height: 4),
                    Text(formatNumber(totalInternships),
                        style: textMono(28,
                            color: AccentColor.teal, weight: FontWeight.bold)),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Breakdown bars with percentages
              const Divider(height: 1, color: InkColor.border),
              const SizedBox(height: 12),
              Text('RÉPARTITION PAR TYPE',
                  style: textMono(9, color: TextColor.muted)),
              const SizedBox(height: 8),
              _buildBarRow(
                  'Vacances', vacation, totalInternships, AccentColor.blue),
              const SizedBox(height: 8),
              _buildBarRow(
                  'Académique', academic, totalInternships, AccentColor.teal),
              const SizedBox(height: 8),
              _buildBarRow('Professionnel', professional, totalInternships,
                  AccentColor.gold),
              const SizedBox(height: 8),
              _buildBarRow('Pré-emploi', preEmployment, totalInternships,
                  AccentColor.rose),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildBarRow(String label, int value, int total, Color color) {
    final percent = total > 0 ? (value / total * 100).toStringAsFixed(0) : '0';
    return Row(
      children: [
        SizedBox(
          width: 90,
          child: Text(label,
              style: textMono(10, color: TextColor.secondary),
              overflow: TextOverflow.ellipsis),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: LinearProgressIndicator(
            value: total > 0 ? value / total : 0,
            backgroundColor: Colors.white.withAlpha(12),
            valueColor: AlwaysStoppedAnimation(color),
            minHeight: 6,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 50,
          child: Text('$value ($percent%)',
              style: textMono(10, color: color, weight: FontWeight.bold),
              textAlign: TextAlign.right),
        ),
      ],
    );
  }
}

class _InternshipPill extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  const _InternshipPill({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: color.withAlpha(20),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(formatNumber(value),
              style: textMono(14, color: color, weight: FontWeight.bold)),
        ),
        const SizedBox(height: 6),
        Text(label,
            style: textMono(9, color: TextColor.muted),
            textAlign: TextAlign.center),
      ],
    );
  }
}
