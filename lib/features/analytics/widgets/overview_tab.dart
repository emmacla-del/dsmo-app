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

    // A second, nested tab controller for the secondary-information tabs
    // below the main two-column area — independent of the outer 8-section
    // DefaultTabController this whole OverviewTab already lives inside.
    return DefaultTabController(
      length: 4,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(Gap.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Key insight — the single most important read, first.
            _insightBanner(cur),
            const SizedBox(height: Gap.md),

            // 2. Primary KPIs — exactly 4, largest/clearest numbers on
            // the page after the insight banner.
            _primaryKpiRow(context, cur, prev, national),
            const SizedBox(height: Gap.md),

            // 3. Main visual area — trend chart (main) + jobs dynamic
            // (supporting), roughly 60/40.
            _mainContent(granularity),
            const SizedBox(height: Gap.lg),

            // 4. Secondary detail, tabbed rather than always-on so it
            // doesn't compete with the main content for attention. The
            // annual comparison table lives inside the "Évolution
            // annuelle" tab (below) rather than also repeating full-width
            // here — showing it in both places just made the tab itself
            // look empty by comparison.
            _secondaryTabs(context, cur, prev, national),
          ],
        ),
      ),
    );
  }

  // ── 2. Key insight banner ───────────────────────────────────────
  // Same underlying facts as the old findings ticker (net change, jobs
  // balance, leading sector) but only the top 3, promoted to one prominent
  // banner instead of a row of equal-weight pills.

  Widget _insightBanner(DashboardSummary cur) {
    final netChangeText = cur.netChange >= 0
        ? 'Création nette de ${formatNumber(cur.netChange)} emplois'
        : 'Perte nette de ${formatNumber(cur.netChange.abs())} emplois';
    final color = SemanticColor.trend(cur.netChange);
    final icon = cur.netChange >= 0
        ? Icons.trending_up_rounded
        : Icons.trending_down_rounded;

    final departures = cur.totalDismissals + cur.totalRetirements;
    String? balanceText;
    if (departures > 0 && cur.totalRecruitments > 0) {
      final ratio = cur.totalRecruitments / departures;
      balanceText = ratio >= 1
          ? 'Recrutements ${ratio.toStringAsFixed(1)}x les départs'
          : 'Départs supérieurs aux recrutements';
    }

    String? topSectorText;
    if (cur.topSectors.isNotEmpty) {
      final top = cur.topSectors.first;
      topSectorText =
          'Secteur leader : ${top.sector} (${formatNumber(top.employees)})';
    }

    return InsightBanner(
      headline: netChangeText,
      icon: icon,
      color: color,
      secondaryLines: [
        if (balanceText != null) balanceText,
        if (topSectorText != null) topSectorText,
      ],
    );
  }

  // ── 3. Primary KPI row — all 6, one line, no "Voir plus" ────────

  Widget _primaryKpiRow(BuildContext context, DashboardSummary cur,
      DashboardSummary? prev, DashboardSummary? national) {
    final defs = <KpiDef>[
      const KpiDef('totalEmployees', 'Effectif total',
          Icons.groups_outlined, AccentColor.blue),
      KpiDef(
          'netChange',
          'Variation nette',
          cur.netChange >= 0
              ? Icons.trending_up_rounded
              : Icons.trending_down_rounded,
          SemanticColor.trend(cur.netChange)),
      const KpiDef('totalRecruitments', 'Recrutements',
          Icons.person_add_outlined, AccentColor.teal),
      const KpiDef('totalDepartures', 'Départs',
          Icons.person_remove_outlined, AccentColor.rose),
      const KpiDef('totalDeclarations', 'Entreprises déclarantes',
          Icons.apartment_outlined, AccentColor.blue),
      const KpiDef('employmentGrowthRate', 'Croissance',
          Icons.show_chart_rounded, AccentColor.gold),
    ];

    // Fixed card width so all 6 always render as one line: on comfortably
    // wide screens that width fills the row exactly (no scrolling needed);
    // on anything narrower it just becomes a horizontally-scrollable
    // strip instead of wrapping to a second line or needing a "Voir plus".
    return LayoutBuilder(builder: (context, constraints) {
      const minCardWidth = 108.0;
      final evenWidth = (constraints.maxWidth - Gap.sm * (defs.length - 1)) /
          defs.length;
      final cardWidth = evenWidth < minCardWidth ? minCardWidth : evenWidth;
      final row = Row(
        children: [
          for (final def in defs) ...[
            SizedBox(
              width: cardWidth,
              height: 96,
              child: PrimaryKpiCard(
                def: def,
                value: _kpiValue(cur, prev, def.key),
                delta: _kpiDelta(cur, prev, def.key),
                lowerBetter: def.key == 'totalDepartures',
                onTap: () => _drillDown(context, def.key, cur, prev, national),
              ),
            ),
            if (def != defs.last) const SizedBox(width: Gap.sm),
          ],
        ],
      );
      if (cardWidth == minCardWidth) {
        return SingleChildScrollView(scrollDirection: Axis.horizontal, child: row);
      }
      return row;
    });
  }

  // ── 4. Main content — two-column (≈60/65 · 35/40) ───────────────
  // Left: the primary chart, tallest element on the page. Right: jobs
  // created/suppressed — Genre moved out entirely into its own secondary
  // tab so this column stays lean rather than stacking a second panel
  // under it.

  Widget _mainContent(Granularity granularity) {
    const mainHeight = 300.0;
    return LayoutBuilder(builder: (context, constraints) {
      final wide = constraints.maxWidth >= 760;
      final trend = SizedBox(height: mainHeight, child: _trendPanel(granularity));
      final balance = SizedBox(
          height: mainHeight, child: _balancePanel(widget.employmentBalance));
      if (!wide) {
        return Column(children: [
          trend,
          const SizedBox(height: Gap.md),
          balance,
        ]);
      }
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 62, child: trend),
          const SizedBox(width: Gap.md),
          Expanded(flex: 38, child: balance),
        ],
      );
    });
  }

  // ── 5. Secondary information tabs ────────────────────────────────
  // Dynamique détaillée / Genre & candidatures / Secteurs / Évolution
  // annuelle — everything that used to sit in the always-on dense grid,
  // now one tap away instead of competing for space with the main chart
  // above. No "Synthèse" tab here: it would just repeat the outer
  // "Section" picker in the header, which already reads "Synthèse" for
  // this whole page — the two extra KPIs that used to live in that tab
  // (Entreprises déclarantes, Croissance) now sit behind "Voir plus"
  // under the primary KPI row instead.

  // Deliberately not a TabBarView: its children all share one fixed
  // viewport height, which is exactly what made "Évolution annuelle" (a
  // full comparison table) look cramped/empty next to "Genre &
  // candidatures" (a couple of stats). Driving the content off the
  // TabController's index instead — same pattern SectionPicker already
  // uses elsewhere in this feature — lets each tab size to its own
  // content in the surrounding scroll view. Trade-off: no swipe gesture
  // between tabs, tap-only — acceptable for a secondary nav row sitting
  // inside an already vertically-scrolling page.
  Widget _secondaryTabs(BuildContext context, DashboardSummary cur,
      DashboardSummary? prev, DashboardSummary? national) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const TabBar(
          isScrollable: true,
          labelColor: AccentColor.teal,
          unselectedLabelColor: TextColor.secondary,
          indicatorColor: AccentColor.teal,
          indicatorSize: TabBarIndicatorSize.label,
          labelStyle: TextStyle(fontSize: TextSize.body, fontWeight: FontWeight.w700),
          unselectedLabelStyle: TextStyle(fontSize: TextSize.body),
          tabAlignment: TabAlignment.start,
          tabs: [
            Tab(text: 'Dynamique détaillée'),
            Tab(text: 'Genre & candidatures'),
            Tab(text: 'Secteurs'),
            Tab(text: 'Évolution annuelle'),
          ],
        ),
        const SizedBox(height: Gap.md),
        Builder(builder: (context) {
          final controller = DefaultTabController.of(context);
          return ListenableBuilder(
            listenable: controller,
            builder: (context, _) {
              switch (controller.index) {
                case 1:
                  return _genderPanel(cur, fillHeight: false);
                case 2:
                  return _sectorPanel(cur, fillHeight: false);
                case 3:
                  return _annualEvolutionTab(context, cur, prev, national);
                case 0:
                default:
                  return SectionCard(
                    title: 'Dynamique du travail — détail',
                    subtitle: 'Créations vs suppressions, détail par motif',
                    fillHeight: false,
                    child: _EmploymentBalanceCompact(balance: widget.employmentBalance),
                  );
              }
            },
          );
        }),
      ],
    );
  }

  /// The tab that used to look "almost empty": now leads with a compact
  /// recap of the same 4 primary KPIs (so the comparison has context
  /// without repeating the full-size cards) and gives the YoY table the
  /// full unconstrained height it needs instead of a clipped 320px box.
  Widget _annualEvolutionTab(BuildContext context, DashboardSummary cur,
      DashboardSummary? prev, DashboardSummary? national) {
    return SectionCard(
      title: 'Évolution annuelle',
      subtitle: 'Comparaison ${cur.year - 1} → ${cur.year}',
      fillHeight: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: Gap.sm,
            runSpacing: Gap.sm,
            children: [
              CompactStatChip(
                label: 'Effectif total',
                value: _kpiValue(cur, prev, 'totalEmployees'),
                delta: _kpiDelta(cur, prev, 'totalEmployees'),
                onTap: () =>
                    _drillDown(context, 'totalEmployees', cur, prev, national),
              ),
              CompactStatChip(
                label: 'Variation nette',
                value: _kpiValue(cur, prev, 'netChange'),
                delta: _kpiDelta(cur, prev, 'netChange'),
                onTap: () => _drillDown(context, 'netChange', cur, prev, national),
              ),
              CompactStatChip(
                label: 'Recrutements',
                value: _kpiValue(cur, prev, 'totalRecruitments'),
                delta: _kpiDelta(cur, prev, 'totalRecruitments'),
                onTap: () =>
                    _drillDown(context, 'totalRecruitments', cur, prev, national),
              ),
              CompactStatChip(
                label: 'Départs',
                value: _kpiValue(cur, prev, 'totalDepartures'),
                delta: _kpiDelta(cur, prev, 'totalDepartures'),
                lowerBetter: true,
                onTap: () =>
                    _drillDown(context, 'totalDepartures', cur, prev, national),
              ),
            ],
          ),
          const SizedBox(height: Gap.md),
          const Divider(color: InkColor.border, height: 1),
          const SizedBox(height: Gap.sm),
          _yoyTable(cur, prev),
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

  // ── Panels ───────────────────────────────────────────────────────

  Widget _trendPanel(Granularity granularity) {
    return SectionCard(
      title: 'Évolution de la variation nette',
      subtitle: 'Recrutements moins départs, par période',
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

    // Net change per period — unlike a headcount/recruitment-count series
    // this can legitimately go negative (a period with more départs than
    // recrutements), so bars diverge from a zero baseline instead of all
    // growing up from 0.
    final values = trends.map((t) => t.totalEmployees.toDouble()).toList();
    final maxVal = values.reduce((a, b) => a > b ? a : b);
    final minVal = values.reduce((a, b) => a < b ? a : b);
    final topPad = (maxVal > 0 ? maxVal : 0) * 0.25 + 1;
    final bottomPad = (minVal < 0 ? minVal.abs() : 0) * 0.25 + 1;

    return BarChart(BarChartData(
      minY: (minVal < 0 ? minVal : 0) - bottomPad,
      maxY: (maxVal > 0 ? maxVal : 0) + topPad,
      barGroups: trends.asMap().entries.map((e) {
        final t = e.value;
        final value = t.totalEmployees.toDouble();
        final color = SemanticColor.trend(t.totalEmployees);
        return BarChartGroupData(
          x: e.key,
          barRods: [
            BarChartRodData(
              toY: value,
              color: color,
              width: 16,
              borderRadius: value >= 0
                  ? const BorderRadius.vertical(top: Radius.circular(4))
                  : const BorderRadius.vertical(bottom: Radius.circular(4)),
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
            reservedSize: 40,
            getTitlesWidget: (v, _) =>
                Text(formatNumber(v.round()), style: ChartTheme.axisLabel),
          ),
        ),
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      ),
      gridData: ChartTheme.horizontalGrid,
      borderData: ChartTheme.noBorder,
      extraLinesData: ExtraLinesData(horizontalLines: [
        HorizontalLine(y: 0, color: TextColor.muted, strokeWidth: 1.5),
      ]),
    ));
  }

  Widget _sectorPanel(DashboardSummary dashboard, {bool fillHeight = true}) {
    final sectors = dashboard.topSectors;
    return SectionCard(
      title: 'Performance sectorielle',
      subtitle: 'Classement par effectif employé',
      fillHeight: fillHeight,
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
    return SectionCard(
      title: 'Dynamique du travail',
      child: _EmploymentBalanceCompact(balance: balance),
    );
  }

  Widget _genderPanel(DashboardSummary dashboard, {bool fillHeight = true}) {
    final g = dashboard.genderDistribution;
    return SectionCard(
      title: 'Genre (candidatures)',
      subtitle: 'Répartition des candidatures reçues (S21Q01)',
      fillHeight: fillHeight,
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
        const SizedBox(height: Gap.sm),
        const Divider(color: InkColor.border, height: 1),
        const SizedBox(height: Gap.sm),
        if (breakdown.isEmpty)
          emptyState('Aucune donnée')
        else
          ...breakdown.map((e) {
            final pct = b.jobsLost > 0 ? e.$2 / b.jobsLost : 0.0;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                children: [
                  SizedBox(
                    width: 90,
                    child: Text(e.$1,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                        style: textMono(TextSize.caption, color: TextColor.secondary)),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: pct,
                        backgroundColor: InkColor.border,
                        valueColor: AlwaysStoppedAnimation(e.$3),
                        minHeight: 8,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  SizedBox(
                    width: 44,
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
