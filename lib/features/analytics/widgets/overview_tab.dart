// lib/features/analytics/widgets/overview_tab.dart
//
// Onepager layout: a findings ticker, a compact KPI strip, then a dense
// grid of small panels (trend / sector / balance / gender) plus a YoY
// panel — everything sized to read as one BI-style screen instead of a
// long scroll of stacked sections.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/onefop_dashboard_providers.dart';
import '../providers/dashboard_providers.dart' as dash_providers;
import '../models/dashboard_models.dart';
import 'common_cards.dart';

class OverviewTab extends ConsumerStatefulWidget {
  final DashboardSummary dashboard;
  final DashboardSummary? previous;
  final List<TimeSeriesData> trends;
  final EmploymentBalance? employmentBalance;
  final List<Animation<double>>? cardAnimations;
  final dash_providers.Granularity granularity;
  final void Function(dash_providers.Granularity) onGranularityChanged;

  const OverviewTab({
    super.key,
    required this.dashboard,
    required this.previous,
    required this.trends,
    this.employmentBalance,
    this.cardAnimations,
    required this.granularity,
    required this.onGranularityChanged,
  });

  @override
  ConsumerState<OverviewTab> createState() => _OverviewTabState();
}

class _OverviewTabState extends ConsumerState<OverviewTab> {
  @override
  Widget build(BuildContext context) {
    final granularity = ref.watch(granularityProvider);
    final period = ref.watch(dashboardFilterProvider).period;

    final hasSubScope = ref.watch(effectiveRegionProvider) != null ||
        ref.watch(effectiveDepartmentProvider) != null;
    final national = hasSubScope
        ? ref.watch(onefopNationalSummaryProvider(period)).value
        : null;

    final cur = widget.dashboard;
    final prev = widget.previous;
    final findings = _buildFindings(cur, prev);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(Gap.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Answer-first ticker — compact pills, not a paragraph.
          if (findings.isNotEmpty) ...[
            Wrap(spacing: Gap.sm, runSpacing: Gap.sm, children: findings),
            const SizedBox(height: Gap.sm),
          ],

          // Compact KPI strip.
          Wrap(
            spacing: Gap.sm,
            runSpacing: Gap.sm,
            children: [
              CompactStatChip(
                label: 'Entreprises déclarantes',
                value: _kpiValue(cur, prev, 'totalDeclarations'),
                delta: _kpiDelta(cur, prev, 'totalDeclarations'),
                onTap: () => _drillDown(context, 'totalDeclarations', cur, prev, national),
              ),
              CompactStatChip(
                label: 'Effectif total',
                value: _kpiValue(cur, prev, 'totalEmployees'),
                delta: _kpiDelta(cur, prev, 'totalEmployees'),
                onTap: () => _drillDown(context, 'totalEmployees', cur, prev, national),
              ),
              CompactStatChip(
                label: 'Recrutements',
                value: _kpiValue(cur, prev, 'totalRecruitments'),
                delta: _kpiDelta(cur, prev, 'totalRecruitments'),
                onTap: () => _drillDown(context, 'totalRecruitments', cur, prev, national),
              ),
              CompactStatChip(
                label: 'Départs',
                value: _kpiValue(cur, prev, 'totalDepartures'),
                delta: _kpiDelta(cur, prev, 'totalDepartures'),
                lowerBetter: true,
                onTap: () => _drillDown(context, 'totalDepartures', cur, prev, national),
              ),
              CompactStatChip(
                label: 'Variation nette',
                value: _kpiValue(cur, prev, 'netChange'),
                delta: _kpiDelta(cur, prev, 'netChange'),
                onTap: () => _drillDown(context, 'netChange', cur, prev, national),
              ),
              CompactStatChip(
                label: 'Croissance',
                value: _kpiValue(cur, prev, 'employmentGrowthRate'),
                onTap: () => _drillDown(context, 'employmentGrowthRate', cur, prev, national),
              ),
              CompactStatChip(
                label: 'Secteur leader',
                value: _kpiValue(cur, prev, 'topSector'),
                onTap: () => _drillDown(context, 'topSector', cur, prev, national),
              ),
            ],
          ),
          const SizedBox(height: Gap.sm),

          // Dense panel grid — small multiples side by side.
          LayoutBuilder(builder: (context, constraints) {
            final width = constraints.maxWidth;
            final columns = width >= 1100 ? 4 : (width >= 620 ? 2 : 1);
            final panelWidth = columns == 1
                ? width
                : (width - Gap.sm * (columns - 1)) / columns;
            return Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.sm,
              children: [
                SizedBox(
                    width: panelWidth, height: 280, child: _trendPanel(granularity)),
                SizedBox(width: panelWidth, height: 280, child: _sectorPanel(cur)),
                SizedBox(
                    width: panelWidth,
                    height: 280,
                    child: _balancePanel(widget.employmentBalance)),
                SizedBox(width: panelWidth, height: 280, child: _genderPanel(cur)),
              ],
            );
          }),
          const SizedBox(height: Gap.sm),

          // YoY comparison — one compact full-width panel. No fixed height
          // here (it sits directly in the scrollable column), so the panel
          // must size to its content rather than try to fill/expand.
          DashboardPanel(
            title: 'Évolution annuelle',
            fillHeight: false,
            child: _yoyTable(cur, prev),
          ),
        ],
      ),
    );
  }

  // ── KPI strip data (unchanged computation, reused as-is) ───────

  String _kpiValue(DashboardSummary cur, DashboardSummary? prev, String key) {
    switch (key) {
      case 'totalDeclarations':
        return formatNumber(cur.totalDeclarations);
      case 'totalEmployees':
        return formatNumber(cur.totalEmployees);
      case 'totalRecruitments':
        return formatNumber(cur.totalRecruitments);
      case 'totalDepartures':
        return formatNumber(cur.totalDismissals + cur.totalRetirements);
      case 'netChange':
        final sign = cur.netChange >= 0 ? '+' : '';
        return '$sign${formatNumber(cur.netChange)}';
      case 'femalePercentage':
        return '${cur.genderDistribution.female.toStringAsFixed(1)}%';
      case 'employmentGrowthRate':
        final rate = _employmentGrowthRate(cur, prev);
        if (rate == null) return '—';
        return '${rate >= 0 ? '+' : ''}${rate.toStringAsFixed(1)}%';
      case 'topSector':
        return cur.topSectors.isNotEmpty ? cur.topSectors.first.sector : '—';
      default:
        return '—';
    }
  }

  /// YoY growth of the total employee stock. Returns null when there's no
  /// prior-year figure to compare against (instead of the always-0.0 value
  /// the dashboard endpoint returns for this field).
  double? _employmentGrowthRate(DashboardSummary cur, DashboardSummary? prev) {
    if (prev == null || prev.totalEmployees == 0) return null;
    return (cur.totalEmployees - prev.totalEmployees) /
        prev.totalEmployees *
        100;
  }

  int? _kpiDelta(DashboardSummary cur, DashboardSummary? prev, String key) {
    if (prev == null) return null;
    switch (key) {
      case 'totalEmployees':
        return cur.totalEmployees - prev.totalEmployees;
      case 'totalDeclarations':
        return cur.totalDeclarations - prev.totalDeclarations;
      case 'totalRecruitments':
        return cur.totalRecruitments - prev.totalRecruitments;
      case 'totalDepartures':
        final curDepartures = cur.totalDismissals + cur.totalRetirements;
        final prevDepartures = prev.totalDismissals + prev.totalRetirements;
        return curDepartures - prevDepartures;
      case 'netChange':
        return cur.netChange - prev.netChange;
      default:
        return null;
    }
  }

  String? _comparatorText(DashboardSummary? national, String key) {
    if (national == null) return null;
    switch (key) {
      case 'totalDeclarations':
        return 'National : ${formatNumber(national.totalDeclarations)}';
      case 'totalEmployees':
        return 'National : ${formatNumber(national.totalEmployees)}';
      case 'totalRecruitments':
        return 'National : ${formatNumber(national.totalRecruitments)}';
      case 'totalDepartures':
        return 'National : ${formatNumber(national.totalDismissals + national.totalRetirements)}';
      case 'netChange':
        return 'National : ${national.netChange >= 0 ? '+' : ''}${formatNumber(national.netChange)}';
      case 'femalePercentage':
        return 'National : ${national.genderDistribution.female.toStringAsFixed(1)}%';
      default:
        return null;
    }
  }

  void _drillDown(BuildContext context, String key, DashboardSummary cur,
      DashboardSummary? prev, DashboardSummary? national) {
    String title, value, desc;
    switch (key) {
      case 'totalDeclarations':
        title = 'Entreprises déclarantes';
        value = formatNumber(cur.totalDeclarations);
        desc = 'Volume annuel des déclarations';
        break;
      case 'totalEmployees':
        title = 'Effectif total';
        value = formatNumber(cur.totalEmployees);
        desc = 'Annuel (pas de détail trimestriel)';
        break;
      case 'totalRecruitments':
        title = 'Recrutements';
        value = formatNumber(cur.totalRecruitments);
        desc = 'Total des embauches sur l\'année';
        break;
      case 'totalDepartures':
        title = 'Départs';
        value = formatNumber(cur.totalDismissals + cur.totalRetirements);
        desc = 'Licenciements + départs volontaires + retraites';
        break;
      case 'netChange':
        title = 'Variation nette';
        value =
            '${cur.netChange >= 0 ? '+' : ''}${formatNumber(cur.netChange)}';
        desc = 'Recrutements moins départs';
        break;
      case 'femalePercentage':
        title = 'Part féminine (candidatures)';
        value = '${cur.genderDistribution.female.toStringAsFixed(1)}%';
        desc = 'Pourcentage de femmes parmi les candidatures reçues '
            '(S21Q01) — pas la composition de l\'effectif, non collectée';
        break;
      case 'employmentGrowthRate':
        title = 'Taux de croissance';
        final rate = _employmentGrowthRate(cur, prev);
        if (rate == null) {
          value = '—';
          desc = 'Pas de donnée pour l\'année précédente';
        } else {
          value = '${rate >= 0 ? '+' : ''}${rate.toStringAsFixed(1)}%';
          desc = 'Évolution de l\'effectif total vs ${cur.year - 1}';
        }
        break;
      case 'topSector':
        title = 'Secteur leader';
        if (cur.topSectors.isNotEmpty) {
          value = cur.topSectors.first.sector;
          desc = '${formatNumber(cur.topSectors.first.employees)} employés';
        } else {
          value = '—';
          desc = 'Aucune donnée disponible';
        }
        break;
      default:
        return;
    }
    final comparator = _comparatorText(national, key);
    if (comparator != null) desc = '$desc · $comparator';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DrillSheet(title: title, value: value, desc: desc),
    );
  }

  // ── Findings ticker ─────────────────────────────────────────────

  List<FindingChip> _buildFindings(DashboardSummary cur, DashboardSummary? prev) {
    final findings = <FindingChip>[];

    findings.add(FindingChip(
      icon: cur.netChange >= 0
          ? Icons.trending_up_rounded
          : Icons.trending_down_rounded,
      text: cur.netChange >= 0
          ? 'Création nette de ${formatNumber(cur.netChange)} emplois'
          : 'Perte nette de ${formatNumber(cur.netChange.abs())} emplois',
      color: SemanticColor.trend(cur.netChange),
    ));

    if (cur.topSectors.isNotEmpty) {
      final top = cur.topSectors.first;
      findings.add(FindingChip(
        icon: Icons.leaderboard_rounded,
        text: '${top.sector} : premier secteur employeur (${formatNumber(top.employees)})',
        color: AccentColor.teal,
      ));
    }

    final growth = _employmentGrowthRate(cur, prev);
    if (growth != null) {
      findings.add(FindingChip(
        icon: Icons.show_chart_rounded,
        text: 'Effectif ${growth >= 0 ? '+' : ''}${growth.toStringAsFixed(1)}% vs ${cur.year - 1}',
        color: SemanticColor.trend(growth),
      ));
    }

    final departures = cur.totalDismissals + cur.totalRetirements;
    if (departures > 0 && cur.totalRecruitments > 0) {
      final ratio = cur.totalRecruitments / departures;
      findings.add(FindingChip(
        icon: Icons.balance_rounded,
        text: ratio >= 1
            ? 'Recrutements ${ratio.toStringAsFixed(1)}x les départs'
            : 'Départs supérieurs aux recrutements',
        color: ratio >= 1 ? SemanticColor.positive : SemanticColor.warning,
      ));
    }

    return findings;
  }

  // ── Panels ───────────────────────────────────────────────────────

  Widget _trendPanel(Granularity granularity) {
    return DashboardPanel(
      title: 'Évolution de l\'emploi',
      trailing: DropdownButton<Granularity>(
        value: granularity,
        isDense: true,
        underline: const SizedBox.shrink(),
        style: textMono(TextSize.caption, color: TextColor.secondary),
        dropdownColor: InkColor.card,
        items: const [
          DropdownMenuItem(value: Granularity.year, child: Text('Année')),
          DropdownMenuItem(value: Granularity.quarter, child: Text('Trimestre')),
          DropdownMenuItem(value: Granularity.semester, child: Text('Semestre')),
          DropdownMenuItem(value: Granularity.month, child: Text('Mois')),
        ],
        onChanged: (v) {
          if (v != null) {
            ref.read(granularityProvider.notifier).state = v;
          }
        },
      ),
      child: _trendChart(widget.trends, widget.dashboard.year),
    );
  }

  Widget _trendChart(List<TimeSeriesData> trends, int currentYear) {
    if (trends.isEmpty) return emptyState('Aucune donnée');
    final maxVal = trends
        .map((t) => t.totalEmployees.toDouble())
        .reduce((a, b) => a > b ? a : b);

    return BarChart(BarChartData(
      barGroups: trends.asMap().entries.map((e) {
        final t = e.value;
        final isCur = t.year == currentYear;
        return BarChartGroupData(
          x: e.key,
          barRods: [
            BarChartRodData(
              toY: t.totalEmployees / 1000,
              color: isCur ? ChartTheme.current : ChartTheme.current.withAlpha(60),
              width: 16,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
              backDrawRodData: BackgroundBarChartRodData(
                  show: true, toY: maxVal / 1000 * 1.2, color: InkColor.surface),
            ),
          ],
        );
      }).toList(),
      titlesData: FlTitlesData(
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 22,
            getTitlesWidget: (value, _) {
              final i = value.toInt();
              if (i < 0 || i >= trends.length) return const SizedBox.shrink();
              final t = trends[i];
              final isCur = t.year == currentYear;
              return Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(t.shortLabel,
                    style: textMono(TextSize.micro,
                        color: isCur ? ChartTheme.current : TextColor.muted,
                        weight: isCur ? FontWeight.bold : FontWeight.normal)),
              );
            },
          ),
        ),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 28,
            getTitlesWidget: (v, _) {
              final rawValue = (v * 1000).toInt();
              final label = rawValue < 1000
                  ? '$rawValue'
                  : rawValue % 1000 == 0
                      ? '${rawValue ~/ 1000}K'
                      : '${(rawValue / 1000).toStringAsFixed(1)}K';
              return Text(label, style: ChartTheme.axisLabel);
            },
          ),
        ),
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      gridData: ChartTheme.horizontalGrid,
      borderData: ChartTheme.noBorder,
    ));
  }

  Widget _sectorPanel(DashboardSummary dashboard) {
    final sectors = dashboard.topSectors;
    return DashboardPanel(
      title: 'Performance sectorielle',
      child: sectors.isEmpty
          ? emptyState('Aucune donnée')
          : _sectorRanking(sectors),
    );
  }

  Widget _sectorRanking(List<TopSector> sectors) {
    final maxEmployees =
        sectors.map((s) => s.employees).reduce((a, b) => a > b ? a : b);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (final entry in sectors.asMap().entries)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: [
                SizedBox(
                  width: 90,
                  child: Text(entry.value.sector,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                      style: const TextStyle(
                          fontSize: TextSize.caption,
                          color: TextColor.primary,
                          fontWeight: FontWeight.w600)),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(
                      value: maxEmployees > 0 ? entry.value.employees / maxEmployees : 0,
                      minHeight: 6,
                      backgroundColor: InkColor.border,
                      valueColor: const AlwaysStoppedAnimation(AccentColor.teal),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                SizedBox(
                  width: 44,
                  child: Text(formatNumber(entry.value.employees),
                      textAlign: TextAlign.right,
                      style: textMono(TextSize.caption,
                          color: TextColor.primary, weight: FontWeight.w700)),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _balancePanel(EmploymentBalance? balance) {
    return DashboardPanel(
      title: 'Dynamique du travail',
      child: _EmploymentBalanceCompact(balance: balance),
    );
  }

  Widget _genderPanel(DashboardSummary dashboard) {
    final g = dashboard.genderDistribution;
    return DashboardPanel(
      title: 'Genre (candidatures)',
      child: (g.male == 0 && g.female == 0)
          ? emptyState('Aucune donnée')
          : _genderSplit(g),
    );
  }

  Widget _genderSplit(GenderDistribution g) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('HOMMES',
                      style: textMono(TextSize.micro, color: ChartTheme.comparison)),
                  const SizedBox(height: 2),
                  Text('${g.male.toStringAsFixed(1)}%',
                      style: textMono(TextSize.kpi,
                          color: ChartTheme.comparison, weight: FontWeight.bold)),
                ],
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('FEMMES',
                      style: textMono(TextSize.micro, color: ChartTheme.negative)),
                  const SizedBox(height: 2),
                  Text('${g.female.toStringAsFixed(1)}%',
                      style: textMono(TextSize.kpi,
                          color: ChartTheme.negative, weight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: Gap.sm),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: Row(
            children: [
              Expanded(
                flex: g.male.round().clamp(0, 1000),
                child: Container(height: 8, color: ChartTheme.comparison),
              ),
              Expanded(
                flex: g.female.round().clamp(0, 1000),
                child: Container(height: 8, color: ChartTheme.negative),
              ),
            ],
          ),
        ),
        const MetricCaption(text: 'Candidatures reçues (S21Q01), pas l\'effectif.'),
      ],
    );
  }

  // ── YoY panel content (unchanged computation, reused as-is) ────

  Widget _yoyTable(DashboardSummary cur, DashboardSummary? prev) {
    final rows = [
      YoyDef('Effectif', Icons.people_outline, cur.totalEmployees,
          prev?.totalEmployees),
      YoyDef('Recrutements', Icons.person_add_outlined, cur.totalRecruitments,
          prev?.totalRecruitments),
      YoyDef(
          'Départs',
          Icons.person_remove_outlined,
          cur.totalDismissals + cur.totalRetirements,
          prev != null ? prev.totalDismissals + prev.totalRetirements : null,
          lowerBetter: true),
      YoyDef('Solde net', Icons.balance, cur.netChange, prev?.netChange),
    ];

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [
            const Expanded(flex: 3, child: SizedBox()),
            Expanded(
                flex: 2,
                child: Text('${cur.year - 1}',
                    textAlign: TextAlign.center,
                    style: textMono(TextSize.caption, color: TextColor.muted))),
            Expanded(
                flex: 2,
                child: Text('${cur.year}',
                    textAlign: TextAlign.center,
                    style: textMono(TextSize.caption,
                        color: ChartTheme.current, weight: FontWeight.bold))),
            Expanded(
                flex: 2,
                child: Text('Δ',
                    textAlign: TextAlign.right,
                    style: textMono(TextSize.caption, color: TextColor.muted))),
          ]),
        ),
        const Divider(color: InkColor.border, height: 1),
        ...rows.asMap().entries.map(
            (e) => YoyRow(def: e.value, isLast: e.key == rows.length - 1)),
      ],
    );
  }
}

/// Condensed jobs-created/lost composition — same EmploymentBalance fields,
/// trimmed to fit a small onepager panel.
class _EmploymentBalanceCompact extends StatelessWidget {
  final EmploymentBalance? balance;
  const _EmploymentBalanceCompact({required this.balance});

  @override
  Widget build(BuildContext context) {
    final b = balance;
    if (b == null) return emptyState('Aucune donnée');

    final breakdown = [
      ('Licenciements', b.dismissals, AccentColor.rose),
      ('Démissions', b.resignations, AccentColor.gold),
      ('Retraites', b.retirements, AccentColor.blue),
      ('Autres', b.other, TextColor.muted),
    ].where((e) => e.$2 > 0).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('EMPLOIS CRÉÉS',
                      style: textMono(TextSize.micro, color: SemanticColor.positive)),
                  Text(formatNumber(b.jobsCreated),
                      style: textMono(TextSize.metric,
                          color: SemanticColor.positive, weight: FontWeight.bold)),
                ],
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('EMPLOIS SUPPRIMÉS',
                      style: textMono(TextSize.micro, color: SemanticColor.negative)),
                  Text(formatNumber(b.jobsLost),
                      style: textMono(TextSize.metric,
                          color: SemanticColor.negative, weight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: Gap.xs),
        const Divider(color: InkColor.border, height: 1),
        const SizedBox(height: Gap.xs),
        if (breakdown.isEmpty)
          emptyState('Aucune donnée')
        else
          ...breakdown.map((e) {
            final pct = b.jobsLost > 0 ? e.$2 / b.jobsLost : 0.0;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  SizedBox(
                    width: 78,
                    child: Text(e.$1,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                        style: textMono(TextSize.caption, color: TextColor.secondary)),
                  ),
                  Expanded(
                    child: LinearProgressIndicator(
                      value: pct,
                      backgroundColor: InkColor.border,
                      valueColor: AlwaysStoppedAnimation(e.$3),
                      minHeight: 6,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(width: 6),
                  SizedBox(
                    width: 36,
                    child: Text(formatNumber(e.$2),
                        textAlign: TextAlign.right,
                        style: textMono(TextSize.caption,
                            color: e.$3, weight: FontWeight.bold)),
                  ),
                ],
              ),
            );
          }),
        if (b.technicalUnemployment > 0)
          MetricCaption(
              text: '${formatNumber(b.technicalUnemployment)} en chômage technique (hors total).'),
      ],
    );
  }
}
