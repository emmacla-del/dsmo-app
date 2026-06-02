// lib/features/analytics/screens/analytics_dashboard_screen.dart
//
// Cardless redesign:
//   • Underline TabBar (no pill backgrounds)
//   • KPI row = one bordered container divided by hairlines
//   • Chart sections = divider-grid (no ChartCard boxes, no shadows)
//   • Section headers = uppercase label + hairline rule only
//
// All providers unchanged:
//   dashboardSummaryProvider(year)      previousYearSummaryProvider(year)
//   sectorsProvider(year)               genderDistributionProvider(year)
//   filteredEmploymentTrendsProvider    yearProvider
//   firstTimeEmploymentProvider(year)   laborMarketProvider(year)
//   departuresProvider(year)            contractTypeProvider(year)
//   vulnerablePopProvider(year)         diplomaDistributionProvider(year)
//   trainingProvider(year)              entityBreakdownProvider(year)
//   entitySizeProvider(year)            regionalProvider(year)
//   employmentBalanceProvider(year)

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../widgets/analytics_widgets.dart';
import '../components/analytics_charts.dart';
import '../models/dashboard_models.dart';
import '../providers/onefop_dashboard_providers.dart';
import '../widgets/analytics_filter_bar.dart';

// ─────────────────────────────────────────────────────────────
// Design tokens (cardless)
// ─────────────────────────────────────────────────────────────

const _kHairline = Color(0xFFE2E8F0);
const _kTextPrimary = Color(0xFF0F172A);
const _kTextSecondary = Color(0xFF64748B);
const _kTextTertiary = Color(0xFF94A3B8);
const _kSurface = Color(0xFFF8FAFC);

// ─────────────────────────────────────────────────────────────
// Root screen
// ─────────────────────────────────────────────────────────────

class OnefopDashboardScreen extends ConsumerStatefulWidget {
  const OnefopDashboardScreen({super.key});

  @override
  ConsumerState<OnefopDashboardScreen> createState() =>
      _OnefopDashboardScreenState();
}

class _OnefopDashboardScreenState extends ConsumerState<OnefopDashboardScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  static const _tabs = [
    (label: 'Vue générale', icon: Icons.trending_up_outlined),
    (label: 'Marché du travail', icon: Icons.work_outline),
    (label: 'Inclusion & Capital', icon: Icons.school_outlined),
    (label: 'Territorial & Structurel', icon: Icons.map_outlined),
  ];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── Filter bar ───────────────────────────────────────
        const AnalyticsFilterBar(),

        // ── Underline tab bar ────────────────────────────────
        _UnderlineTabBar(controller: _tab, tabs: _tabs),

        // ── Content ─────────────────────────────────────────
        Expanded(
          child: TabBarView(
            controller: _tab,
            physics: const NeverScrollableScrollPhysics(),
            children:
                _tabs.asMap().keys.map((i) => _TabPage(index: i)).toList(),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Underline tab bar — no pill, no background fill
// ─────────────────────────────────────────────────────────────

class _UnderlineTabBar extends StatelessWidget {
  final TabController controller;
  final List<({String label, IconData icon})> tabs;

  const _UnderlineTabBar({
    required this.controller,
    required this.tabs,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: _kHairline, width: 1)),
      ),
      child: TabBar(
        controller: controller,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        labelPadding: const EdgeInsets.symmetric(horizontal: 4),
        indicator: const UnderlineTabIndicator(
          borderSide: BorderSide(color: _kTextPrimary, width: 2),
          insets: EdgeInsets.symmetric(horizontal: 8),
        ),
        labelColor: _kTextPrimary,
        unselectedLabelColor: _kTextSecondary,
        labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        unselectedLabelStyle:
            const TextStyle(fontSize: 13, fontWeight: FontWeight.w400),
        dividerColor: Colors.transparent,
        tabs: tabs
            .map((t) => Tab(
                  height: 44,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(t.icon, size: 15),
                      const SizedBox(width: 7),
                      Text(t.label),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Tab pages
// ─────────────────────────────────────────────────────────────

class _TabPage extends ConsumerWidget {
  final int index;
  const _TabPage({required this.index});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final year = ref.watch(yearProvider);
    final isDesktop = Breakpoints.isDesktop(context);

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => onefopRefreshAll(ref, year),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 48),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Page heading (always shown)
            if (index == 0) ...[
              _PageHeading(year: year),
              const SizedBox(height: 24),
              _KpiRow(year: year),
              const SizedBox(height: 36),
            ],

            // Section body
            _sectionBody(index, year, isDesktop),
          ],
        ),
      ),
    );
  }

  Widget _sectionBody(int idx, int year, bool isDesktop) {
    switch (idx) {
      case 0:
        return _OverviewSection(year: year, isDesktop: isDesktop);
      case 1:
        return _LabourSection(year: year, isDesktop: isDesktop);
      case 2:
        return _InclusionSection(year: year, isDesktop: isDesktop);
      case 3:
        return _TerritorySection(year: year, isDesktop: isDesktop);
      default:
        return const SizedBox.shrink();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Page heading
// ─────────────────────────────────────────────────────────────

class _PageHeading extends StatelessWidget {
  final int year;
  const _PageHeading({required this.year});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Tableau de bord',
          style: Theme.of(context)
              .textTheme
              .headlineSmall
              ?.copyWith(fontWeight: FontWeight.w700, color: _kTextPrimary),
        ),
        const SizedBox(height: 3),
        Text(
          "Vue d'ensemble des indicateurs d'emploi — $year",
          style: const TextStyle(fontSize: 13, color: _kTextSecondary),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// KPI row — one bordered container, cells divided by hairlines
// ─────────────────────────────────────────────────────────────

class _KpiRow extends ConsumerWidget {
  final int year;
  const _KpiRow({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentAsync = ref.watch(onefopDashboardSummaryProvider(year));
    final previousAsync = ref.watch(onefopPreviousYearSummaryProvider(year));

    return currentAsync.when(
      loading: () => const _KpiRowSkeleton(),
      error: (err, _) => EmptyState(
        message: 'Erreur KPI: $err',
        onRetry: () => ref.invalidate(onefopDashboardSummaryProvider(year)),
      ),
      data: (current) {
        double? growthTrend;
        double? recruitTrend;
        double? dismissTrend;
        previousAsync.whenData((prev) {
          if (prev.totalEmployees > 0) {
            growthTrend = (current.totalEmployees - prev.totalEmployees) /
                prev.totalEmployees *
                100;
          }
          if (prev.totalRecruitments > 0) {
            recruitTrend =
                (current.totalRecruitments - prev.totalRecruitments) /
                    prev.totalRecruitments *
                    100;
          }
          if (prev.totalDismissals > 0) {
            dismissTrend = (current.totalDismissals - prev.totalDismissals) /
                prev.totalDismissals *
                100;
          }
        });

        final cells = [
          _KpiCellData(
            label: 'Entreprises déclarantes',
            value: _fmt(current.totalDeclarations),
            sub: 'Déclarations $year',
          ),
          _KpiCellData(
            label: 'Effectif total',
            value: _fmt(current.totalEmployees),
            sub: 'Salariés permanents',
            trend: growthTrend,
          ),
          _KpiCellData(
            label: 'Recrutements',
            value: _fmt(current.totalRecruitments),
            sub: 'Embauches nettes',
            trend: recruitTrend,
            trendPositiveIsGood: true,
          ),
          _KpiCellData(
            label: 'Départs',
            value: _fmt(current.totalDismissals + current.totalRetirements),
            sub: 'Licenciements + Retraites',
            trend: dismissTrend,
            trendPositiveIsGood: false,
          ),
          _KpiCellData(
            label: 'Variation nette',
            value:
                '${current.netChange >= 0 ? '+' : ''}${_fmt(current.netChange)}',
            sub: 'Solde emploi',
            valueColor: current.netChange >= 0
                ? const Color(0xFF16A34A)
                : const Color(0xFFDC2626),
          ),
          _KpiCellData(
            label: 'Part féminine',
            value: '${current.genderDistribution.female.toStringAsFixed(1)}%',
            sub: 'Femmes dans effectif',
          ),
          _KpiCellData(
            label: 'Croissance',
            value: '${current.employmentGrowthRate.toStringAsFixed(1)}%',
            sub: 'Annuelle',
          ),
          _KpiCellData(
            label: 'Secteur leader',
            value: current.topSectors.isNotEmpty
                ? current.topSectors.first.sector
                : '—',
            sub: current.topSectors.isNotEmpty
                ? '${_fmt(current.topSectors.first.employees)} sal.'
                : '',
          ),
        ];

        final isDesktop = Breakpoints.isDesktop(context);
        final width = MediaQuery.of(context).size.width;
        final cols = isDesktop ? 4 : 2;
        final itemWidth = (width - 48 - (cols - 1) * 16) / cols;

        return Wrap(
          spacing: 16,
          runSpacing: 16,
          children: cells
              .map((cell) => SizedBox(
                    width: itemWidth,
                    child: _KpiBlock(data: cell),
                  ))
              .toList(),
        );
      },
    );
  }
}

class _KpiRowSkeleton extends StatelessWidget {
  const _KpiRowSkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 80,
      decoration: BoxDecoration(
        border: Border.all(color: _kHairline),
        borderRadius: BorderRadius.circular(10),
        color: _kSurface,
      ),
    );
  }
}

class _KpiCellData {
  final String label;
  final String value;
  final String sub;
  final double? trend;
  final bool trendPositiveIsGood;
  final Color? valueColor;

  const _KpiCellData({
    required this.label,
    required this.value,
    this.sub = '',
    this.trend,
    this.trendPositiveIsGood = true,
    this.valueColor,
  });
}

// ─────────────────────────────────────────────────────────────
// _KpiBlock — left-accent border only, no background fill
// ─────────────────────────────────────────────────────────────

class _KpiBlock extends StatelessWidget {
  final _KpiCellData data;
  const _KpiBlock({required this.data});

  @override
  Widget build(BuildContext context) {
    final trendColor = data.trend == null
        ? null
        : (data.trend! >= 0) == data.trendPositiveIsGood
            ? const Color(0xFF16A34A)
            : const Color(0xFFDC2626);

    final accentColor = data.valueColor ?? trendColor ?? AppColors.primary;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(color: accentColor, width: 3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            data.label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: _kTextSecondary,
              letterSpacing: 0.3,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 5),
          Text(
            data.value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: data.valueColor ?? _kTextPrimary,
              height: 1,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          if (data.trend != null)
            Row(children: [
              Icon(
                data.trend! >= 0
                    ? Icons.arrow_upward_rounded
                    : Icons.arrow_downward_rounded,
                size: 11,
                color: trendColor,
              ),
              const SizedBox(width: 2),
              Text(
                '${data.trend!.abs().toStringAsFixed(1)}%',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: trendColor),
              ),
            ])
          else if (data.sub.isNotEmpty)
            Text(
              data.sub,
              style: const TextStyle(fontSize: 11, color: _kTextTertiary),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Section header — uppercase label + hairline only
// ─────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: _kTextSecondary,
              letterSpacing: 0.08 * 11,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(child: Divider(height: 1, color: _kHairline)),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Cardless chart block — title + subtitle + content, no box
// ─────────────────────────────────────────────────────────────

class _ChartBlock extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget child;
  final bool isLoading;

  const _ChartBlock({
    required this.title,
    required this.subtitle,
    required this.child,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _kTextPrimary)),
          const SizedBox(height: 2),
          Text(subtitle,
              style: const TextStyle(fontSize: 11, color: _kTextSecondary)),
          const SizedBox(height: 16),
          isLoading
              ? Container(
                  height: 120,
                  decoration: BoxDecoration(
                    color: _kSurface,
                    borderRadius: BorderRadius.circular(6),
                  ),
                )
              : child,
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Divider grid — wraps 1 or 2 _ChartBlocks in a hairline box
// ─────────────────────────────────────────────────────────────

/// Wraps children in a bordered container with hairline separators.
/// [children] length 1 = full width; 2 = side by side on desktop.
class _ChartGrid extends StatelessWidget {
  final List<Widget> children;
  final bool isDesktop;

  const _ChartGrid({
    required this.children,
    required this.isDesktop,
  });

  @override
  Widget build(BuildContext context) {
    final twoCol = isDesktop && children.length == 2;

    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: _kHairline, width: 1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: twoCol
          ? IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: children[0]),
                  const VerticalDivider(
                      width: 1, thickness: 1, color: _kHairline),
                  Expanded(child: children[1]),
                ],
              ),
            )
          : Column(
              children: children
                  .asMap()
                  .entries
                  .map((e) => Column(
                        children: [
                          e.value,
                          if (e.key < children.length - 1)
                            const Divider(height: 1, color: _kHairline),
                        ],
                      ))
                  .toList(),
            ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION BODIES
// ═══════════════════════════════════════════════════════════════

class _OverviewSection extends StatelessWidget {
  final int year;
  final bool isDesktop;
  const _OverviewSection({required this.year, required this.isDesktop});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeader(title: 'Tendances générales'),
        _ChartGrid(
          isDesktop: isDesktop,
          children: [
            _EmploymentTrendBlock(),
            _GenderDistributionBlock(year: year),
          ],
        ),
      ],
    );
  }
}

class _LabourSection extends StatelessWidget {
  final int year;
  final bool isDesktop;
  const _LabourSection({required this.year, required this.isDesktop});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeader(title: 'Marché du travail'),

        // Employment balance — full width
        _ChartGrid(
          isDesktop: isDesktop,
          children: [_EmploymentBalanceBlock(year: year)],
        ),
        const SizedBox(height: 16),

        _ChartGrid(
          isDesktop: isDesktop,
          children: [
            _FirstTimeEmploymentBlock(year: year),
            _LaborMarketGapBlock(year: year),
          ],
        ),
        const SizedBox(height: 16),

        _ChartGrid(
          isDesktop: isDesktop,
          children: [
            _DepartureMobilityBlock(year: year),
            _ContractQualityBlock(year: year),
          ],
        ),
      ],
    );
  }
}

class _InclusionSection extends StatelessWidget {
  final int year;
  final bool isDesktop;
  const _InclusionSection({required this.year, required this.isDesktop});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeader(title: 'Inclusion & Capital humain'),
        _ChartGrid(
          isDesktop: isDesktop,
          children: [
            _InclusionSocialBlock(year: year),
            _QualificationPyramidBlock(year: year),
          ],
        ),
        const SizedBox(height: 16),
        _ChartGrid(
          isDesktop: isDesktop,
          children: [
            _SkillsTrainingGapBlock(year: year),
            _InternshipPipelineBlock(year: year),
          ],
        ),
      ],
    );
  }
}

class _TerritorySection extends StatelessWidget {
  final int year;
  final bool isDesktop;
  const _TerritorySection({required this.year, required this.isDesktop});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeader(title: 'Analyse territoriale & structurelle'),
        _ChartGrid(
          isDesktop: isDesktop,
          children: [
            _RegionalBlock(year: year),
            _SectorBlock(year: year),
          ],
        ),
        const SizedBox(height: 16),
        _ChartGrid(
          isDesktop: isDesktop,
          children: [_EntityStructureBlock(year: year)],
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// CHART BLOCKS (cardless — content only, no box)
// ═══════════════════════════════════════════════════════════════

class _EmploymentTrendBlock extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopFilteredTrendsProvider);
    return _ChartBlock(
      title: "Tendances d'emploi",
      subtitle: 'Évolution des effectifs sur la période sélectionnée',
      isLoading: async.isLoading,
      child: async.when(
        data: (trends) {
          final mapped = trends
              .map((t) => EmploymentTrend.fromJson({
                    'period': t.period,
                    'totalEmployees': t.totalEmployees,
                  }))
              .toList();
          return SizedBox(
            height: 260,
            child: EmploymentTrendChart(
                data: mapped, primaryLabel: 'Effectif total'),
          );
        },
        loading: () => const SizedBox(height: 260),
        error: (_, __) => const SizedBox(height: 260),
      ),
    );
  }
}

class _GenderDistributionBlock extends ConsumerWidget {
  final int year;
  const _GenderDistributionBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopDashboardSummaryProvider(year));
    return _ChartBlock(
      title: 'Répartition par genre',
      subtitle: "Distribution de l'effectif",
      isLoading: async.isLoading,
      child: async.when(
        data: (s) => SizedBox(
          height: 260,
          child: GenderPieChart(distribution: s.genderDistribution),
        ),
        loading: () => const SizedBox(height: 260),
        error: (_, __) => const SizedBox(height: 260),
      ),
    );
  }
}

// ── Employment balance ───────────────────────────────────────

class _EmploymentBalanceBlock extends ConsumerWidget {
  final int year;
  const _EmploymentBalanceBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopEmploymentBalanceProvider(year));
    return _ChartBlock(
      title: 'Solde emploi — Génération vs Perte',
      subtitle: 'S22Q01+Q02+S23Q02 créés · S3Q01+Q03 perdus',
      isLoading: async.isLoading,
      child: async.when(
        data: (d) => _EmploymentBalanceContent(data: d),
        loading: () => const SizedBox(height: 200),
        error: (err, _) => EmptyState(
          message: 'Erreur: $err',
          onRetry: () => ref.invalidate(onefopEmploymentBalanceProvider(year)),
        ),
      ),
    );
  }
}

class _EmploymentBalanceContent extends StatelessWidget {
  final EmploymentBalance data;
  const _EmploymentBalanceContent({required this.data});

  static const _green = Color(0xFF16A34A);
  static const _greenBg = Color(0xFFF0FDF4);
  static const _red = Color(0xFFDC2626);
  static const _redBg = Color(0xFFFEF2F2);

  @override
  Widget build(BuildContext context) {
    final net = data.jobsCreated - data.jobsLost;
    final isPositive = net >= 0;
    final turnoverRate = data.averageWorkforce > 0
        ? data.jobsLost / data.averageWorkforce * 100
        : 0.0;

    return LayoutBuilder(builder: (context, constraints) {
      final isWide = constraints.maxWidth > 480;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isWide)
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                  child: _BalanceBlock(
                      label: 'Emplois créés',
                      value: data.jobsCreated,
                      color: _green,
                      bgColor: _greenBg,
                      icon: Icons.add_circle_outline)),
              const SizedBox(width: 12),
              Expanded(
                  child: _BalanceBlock(
                      label: 'Emplois perdus',
                      value: data.jobsLost,
                      color: _red,
                      bgColor: _redBg,
                      icon: Icons.remove_circle_outline)),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isPositive
                        ? _green.withValues(alpha: 0.08)
                        : _red.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: isPositive
                            ? _green.withValues(alpha: 0.3)
                            : _red.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Icon(
                            isPositive
                                ? Icons.trending_up
                                : Icons.trending_down,
                            size: 14,
                            color: isPositive ? _green : _red),
                        const SizedBox(width: 4),
                        Text('Solde net',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: isPositive ? _green : _red)),
                      ]),
                      const SizedBox(height: 6),
                      Text(
                        '${isPositive ? '+' : ''}${_fmt(net)}',
                        style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: isPositive ? _green : _red),
                      ),
                      const SizedBox(height: 2),
                      Text('Taux rotation: ${turnoverRate.toStringAsFixed(1)}%',
                          style: const TextStyle(
                              fontSize: 10, color: _kTextSecondary)),
                    ],
                  ),
                ),
              ),
            ])
          else
            Column(children: [
              Row(children: [
                Expanded(
                    child: _BalanceBlock(
                        label: 'Emplois créés',
                        value: data.jobsCreated,
                        color: _green,
                        bgColor: _greenBg,
                        icon: Icons.add_circle_outline)),
                const SizedBox(width: 8),
                Expanded(
                    child: _BalanceBlock(
                        label: 'Emplois perdus',
                        value: data.jobsLost,
                        color: _red,
                        bgColor: _redBg,
                        icon: Icons.remove_circle_outline)),
              ]),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: isPositive
                      ? _green.withValues(alpha: 0.08)
                      : _red.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                      color: isPositive
                          ? _green.withValues(alpha: 0.3)
                          : _red.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Solde net',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: isPositive ? _green : _red)),
                    Text('${isPositive ? '+' : ''}${_fmt(net)}',
                        style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: isPositive ? _green : _red)),
                  ],
                ),
              ),
            ]),
          const SizedBox(height: 16),
          const Text('Détail des pertes',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: _kTextSecondary)),
          const SizedBox(height: 8),
          _BreakdownRow(
              label: 'Licenciements',
              value: data.dismissals,
              total: data.jobsLost,
              color: const Color(0xFFEF4444)),
          _BreakdownRow(
              label: 'Démissions',
              value: data.resignations,
              total: data.jobsLost,
              color: const Color(0xFFF59E0B)),
          _BreakdownRow(
              label: 'Retraites',
              value: data.retirements,
              total: data.jobsLost,
              color: const Color(0xFF64748B)),
          _BreakdownRow(
              label: 'Chômage tech.',
              value: data.technicalUnemployment,
              total: data.jobsLost,
              color: const Color(0xFF8B5CF6)),
          const SizedBox(height: 12),
          _InterpretationBadge(data: data, net: net),
        ],
      );
    });
  }
}

class _InterpretationBadge extends StatelessWidget {
  final EmploymentBalance data;
  final int net;
  const _InterpretationBadge({required this.data, required this.net});

  @override
  Widget build(BuildContext context) {
    final dismissalShare =
        data.jobsLost > 0 ? data.dismissals / data.jobsLost : 0.0;
    final resignationShare =
        data.jobsLost > 0 ? data.resignations / data.jobsLost : 0.0;
    final techShare =
        data.jobsLost > 0 ? data.technicalUnemployment / data.jobsLost : 0.0;

    final String message;
    final Color color;
    final IconData icon;

    if (net > 0 && dismissalShare > 0.4) {
      message = 'Économie de rotation — croissance nette mais turnover élevé';
      color = const Color(0xFFF59E0B);
      icon = Icons.swap_horiz;
    } else if (net > 0) {
      message = 'Croissance saine — solde positif, licenciements maîtrisés';
      color = const Color(0xFF16A34A);
      icon = Icons.check_circle_outline;
    } else if (net < 0 && techShare > 0.2) {
      message =
          'Signal de contraction — chômage technique élevé, surveiller la tendance';
      color = const Color(0xFFDC2626);
      icon = Icons.warning_amber_outlined;
    } else if (net < 0 && resignationShare > 0.3) {
      message = 'Risque de fuite des talents — démissions prépondérantes';
      color = const Color(0xFFEF4444);
      icon = Icons.logout;
    } else if (net < 0) {
      message =
          'Contraction nette — recrutements insuffisants face aux départs';
      color = const Color(0xFFDC2626);
      icon = Icons.trending_down;
    } else {
      message = "Marché stable — solde à l'équilibre";
      color = const Color(0xFF0EA5E9);
      icon = Icons.balance;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 8),
          Expanded(
              child: Text(message,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: color))),
        ],
      ),
    );
  }
}

// ── First-time employment ────────────────────────────────────

class _FirstTimeEmploymentBlock extends ConsumerWidget {
  final int year;
  const _FirstTimeEmploymentBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopFirstTimeEmploymentProvider(year));
    return _ChartBlock(
      title: 'Insertion des primo-demandeurs',
      subtitle: 'S23Q01 Demandes → S23Q02 Recrutements',
      isLoading: async.isLoading,
      child: async.when(
        data: (d) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                  child: _FunnelBlock(
                      label: 'Demandes enregistrées',
                      value: d.seekersTotal,
                      color: const Color(0xFF4472C4),
                      sub: '${d.seekersMale} H · ${d.seekersFemale} F')),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child:
                    Icon(Icons.arrow_forward, color: _kTextTertiary, size: 20),
              ),
              Expanded(
                  child: _FunnelBlock(
                      label: 'Primo-recrutés',
                      value: d.recruitsTotal,
                      color: const Color(0xFF70AD47),
                      sub: '${d.recruitsMale} H · ${d.recruitsFemale} F')),
            ]),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF86EFAC)),
              ),
              child: Text(
                'Taux de conversion: ${d.conversionRate.toStringAsFixed(1)}%',
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF15803D)),
              ),
            ),
            const SizedBox(height: 12),
            const Text('Âge des recrutés',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: _kTextSecondary)),
            const SizedBox(height: 6),
            _CompactBarRow(segments: [
              _BarSegment(
                  label: '15-24',
                  value: d.recruitsAge15_24,
                  total: d.recruitsTotal,
                  color: const Color(0xFF60A5FA)),
              _BarSegment(
                  label: '25-34',
                  value: d.recruitsAge25_34,
                  total: d.recruitsTotal,
                  color: const Color(0xFF34D399)),
              _BarSegment(
                  label: '35+',
                  value: d.recruitsAge35Plus,
                  total: d.recruitsTotal,
                  color: const Color(0xFFFBBF24)),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              _MiniPill(
                  label: 'CDI/Perm',
                  value: d.recruitsPermanent,
                  color: const Color(0xFF4472C4)),
              const SizedBox(width: 8),
              _MiniPill(
                  label: 'Temporaire',
                  value: d.recruitsTemporary,
                  color: const Color(0xFFF59E0B)),
            ]),
          ],
        ),
        loading: () => const SizedBox(height: 200),
        error: (_, __) => const SizedBox(height: 200),
      ),
    );
  }
}

// ── Labor market gap ─────────────────────────────────────────

class _LaborMarketGapBlock extends ConsumerWidget {
  final int year;
  const _LaborMarketGapBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopLaborMarketProvider(year));
    return _ChartBlock(
      title: 'Tension du marché',
      subtitle: "Demandes d'emploi vs Recrutements par CSP",
      isLoading: async.isLoading,
      child: async.when(
        data: (d) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _BigStat(
                    label: 'Demandes',
                    value: d.totalApplications,
                    color: const Color(0xFF4472C4)),
                _BigStat(
                    label: 'Recrutements',
                    value: d.totalRecruitments,
                    color: const Color(0xFF70AD47)),
                _BigStat(
                    label: 'Écart',
                    value: d.totalApplications - d.totalRecruitments,
                    color: const Color(0xFFE24B4A)),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1, color: _kHairline),
            const SizedBox(height: 12),
            ...d.byCsp.entries.map((e) {
              final cspData = e.value as Map<String, dynamic>;
              final applications = cspData['applications'] as int? ?? 0;
              final recruitments = cspData['recruitments'] as int? ?? 0;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(e.key,
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF334155))),
                    const SizedBox(height: 4),
                    _RatioBar(
                        left: applications,
                        right: recruitments,
                        leftColor: const Color(0xFF93C5FD),
                        rightColor: const Color(0xFF86EFAC)),
                    const SizedBox(height: 2),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('$applications demandes',
                            style: const TextStyle(
                                fontSize: 10, color: _kTextSecondary)),
                        Text('$recruitments recrutés',
                            style: const TextStyle(
                                fontSize: 10, color: _kTextSecondary)),
                      ],
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
        loading: () => const SizedBox(height: 200),
        error: (_, __) => const SizedBox(height: 200),
      ),
    );
  }
}

// ── Departure mobility ───────────────────────────────────────

class _DepartureMobilityBlock extends ConsumerWidget {
  final int year;
  const _DepartureMobilityBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopDeparturesProvider(year));
    return _ChartBlock(
      title: 'Départs & Mobilité',
      subtitle: 'S3Q01 · S3Q03 — Licenciements, démissions, retraites',
      isLoading: async.isLoading,
      child: async.when(
        data: (d) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _DepartureChip(
                    label: 'Licenciements',
                    value: d.dismissals,
                    color: const Color(0xFFEF4444)),
                _DepartureChip(
                    label: 'Démissions',
                    value: d.resignations,
                    color: const Color(0xFFF59E0B)),
                _DepartureChip(
                    label: 'Retraites',
                    value: d.retirements,
                    color: const Color(0xFF64748B)),
                _DepartureChip(
                    label: 'Autres',
                    value: d.other,
                    color: const Color(0xFF94A3B8)),
              ],
            ),
            const SizedBox(height: 16),
            const Text('Répartition par CSP',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: _kTextSecondary)),
            const SizedBox(height: 8),
            ...d.byCsp.entries.map((e) => _MiniProgressBar(
                label: e.key,
                value: e.value as int,
                total: d.total,
                color: const Color(0xFF4472C4))),
          ],
        ),
        loading: () => const SizedBox(height: 200),
        error: (_, __) => const SizedBox(height: 200),
      ),
    );
  }
}

// ── Contract quality ─────────────────────────────────────────

class _ContractQualityBlock extends ConsumerWidget {
  final int year;
  const _ContractQualityBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopContractTypeProvider(year));
    return _ChartBlock(
      title: "Qualité de l'emploi",
      subtitle: 'CDI / CDD-Temporaire — S22Q01·Q02·Q04·Q05',
      isLoading: async.isLoading,
      child: async.when(
        data: (d) => Row(
          children: [
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _BigNumber(
                      value: d.permanentPercent,
                      suffix: '%',
                      label: 'Permanent',
                      color: const Color(0xFF4472C4)),
                  const SizedBox(height: 4),
                  Text('${_fmt(d.permanent)} salariés',
                      style: const TextStyle(
                          fontSize: 12, color: _kTextSecondary)),
                ],
              ),
            ),
            Container(width: 1, height: 80, color: _kHairline),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _BigNumber(
                      value: d.temporaryPercent,
                      suffix: '%',
                      label: 'Temporaire',
                      color: const Color(0xFFF59E0B)),
                  const SizedBox(height: 4),
                  Text('${_fmt(d.temporary)} salariés',
                      style: const TextStyle(
                          fontSize: 12, color: _kTextSecondary)),
                ],
              ),
            ),
          ],
        ),
        loading: () => const SizedBox(height: 120),
        error: (_, __) => const SizedBox(height: 120),
      ),
    );
  }
}

// ── Inclusion social ─────────────────────────────────────────

class _InclusionSocialBlock extends ConsumerWidget {
  final int year;
  const _InclusionSocialBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopInclusionProvider(year));
    return _ChartBlock(
      title: 'Inclusion & Handicap',
      subtitle: 'S22Q04 · S22Q05 — Vulnérabilité & recrutement',
      isLoading: async.isLoading,
      child: async.when(
        data: (d) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                  child: _InclusionBlock(
                      title: 'Handicap',
                      value: (d.byCsp['cadres'] as int? ?? 0) +
                          (d.byCsp['foremen'] as int? ?? 0) +
                          (d.byCsp['workers'] as int? ?? 0),
                      color: const Color(0xFF4472C4),
                      icon: Icons.accessible_forward)),
              const SizedBox(width: 12),
              Expanded(
                  child: _InclusionBlock(
                      title: 'Vulnérables',
                      value: d.total,
                      color: const Color(0xFF70AD47),
                      icon: Icons.people_outline)),
            ]),
            const SizedBox(height: 16),
            const Text('Nature de la vulnérabilité',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: _kTextSecondary)),
            const SizedBox(height: 8),
            _CompactBarRow(segments: [
              _BarSegment(
                  label: 'Déplacés',
                  value: d.internalDisplaced,
                  total: d.total,
                  color: const Color(0xFFF59E0B)),
              _BarSegment(
                  label: 'Réfugiés',
                  value: d.refugees,
                  total: d.total,
                  color: const Color(0xFFEF4444)),
              _BarSegment(
                  label: 'Orphelins',
                  value: d.orphans,
                  total: d.total,
                  color: const Color(0xFF8B5CF6)),
            ]),
          ],
        ),
        loading: () => const SizedBox(height: 200),
        error: (_, __) => const SizedBox(height: 200),
      ),
    );
  }
}

// ── Qualification pyramid ────────────────────────────────────

class _QualificationPyramidBlock extends ConsumerWidget {
  final int year;
  const _QualificationPyramidBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopDiplomaProvider(year));
    return _ChartBlock(
      title: 'Pyramide des diplômes',
      subtitle: 'S22Q03 — Recrutements par niveau de qualification',
      isLoading: async.isLoading,
      child: async.when(
        data: (list) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: (list as dynamic)
              .data
              .map<Widget>((d) => Padding(
                    padding: const EdgeInsets.only(bottom: 5),
                    child: Row(children: [
                      SizedBox(
                          width: 70,
                          child: Text(d.diploma,
                              style: const TextStyle(
                                  fontSize: 10, color: _kTextSecondary),
                              overflow: TextOverflow.ellipsis)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Stack(children: [
                          Container(
                              height: 14,
                              decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(4),
                                  color: const Color(0xFFF1F5F9))),
                          Row(children: [
                            if (d.male > 0)
                              Flexible(
                                  flex: d.male,
                                  child: Container(
                                      height: 14,
                                      decoration: BoxDecoration(
                                          borderRadius:
                                              BorderRadius.circular(4),
                                          color: const Color(0xFF93C5FD)))),
                            if (d.female > 0)
                              Flexible(
                                  flex: d.female,
                                  child: Container(
                                      height: 14,
                                      decoration: BoxDecoration(
                                          borderRadius:
                                              BorderRadius.circular(4),
                                          color: const Color(0xFFFBCFE8)))),
                          ]),
                        ]),
                      ),
                      const SizedBox(width: 6),
                      SizedBox(
                          width: 32,
                          child: Text('${d.total}',
                              style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: _kTextPrimary),
                              textAlign: TextAlign.right)),
                    ]),
                  ))
              .toList(),
        ),
        loading: () => const SizedBox(height: 200),
        error: (_, __) => const SizedBox(height: 200),
      ),
    );
  }
}

// ── Skills training gap ──────────────────────────────────────

class _SkillsTrainingGapBlock extends ConsumerWidget {
  final int year;
  const _SkillsTrainingGapBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopTrainingProvider(year));
    return _ChartBlock(
      title: 'Compétences & Formation',
      subtitle: 'S4Q02 Besoins · S4Q03 Domaines prioritaires',
      isLoading: async.isLoading,
      child: async.when(
        data: (d) {
          final data = d as dynamic;
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                  child: _SkillList(
                      title: 'Compétences recherchées',
                      items: (data.topSkills as List)
                          .take(5)
                          .map((item) => SkillTraining(
                                skill: item['skill']?.toString() ??
                                    item.skill?.toString() ??
                                    '',
                                count: (item['count'] as num?)?.toInt() ?? 0,
                                demand: (item['demand'] as num?)?.toInt() ?? 0,
                                supply: (item['supply'] as num?)?.toInt() ?? 0,
                                gap: (item['gap'] as num?)?.toInt() ?? 0,
                              ))
                          .toList(),
                      color: const Color(0xFF4472C4))),
              const VerticalDivider(width: 1, thickness: 1, color: _kHairline),
              Expanded(
                  child: _SkillList(
                      title: 'Formations demandées',
                      items: (data.topDomains as List)
                          .take(5)
                          .map((item) => SkillTraining(
                                skill: item['domain']?.toString() ??
                                    item.domain?.toString() ??
                                    '',
                                count: (item['count'] as num?)?.toInt() ?? 0,
                                demand: (item['demand'] as num?)?.toInt() ?? 0,
                                supply: (item['supply'] as num?)?.toInt() ?? 0,
                                gap: (item['gap'] as num?)?.toInt() ?? 0,
                              ))
                          .toList(),
                      color: const Color(0xFF70AD47))),
            ],
          );
        },
        loading: () => const SizedBox(height: 200),
        error: (_, __) => const SizedBox(height: 200),
      ),
    );
  }
}

// ── Internship pipeline ──────────────────────────────────────

class _InternshipPipelineBlock extends ConsumerWidget {
  final int year;
  const _InternshipPipelineBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch training provider for internship pipeline data
    final trainingAsync = ref.watch(onefopTrainingProvider(year));
    return _ChartBlock(
      title: 'Pipeline de stages',
      subtitle: 'S4Q01 — Stagiaires recrutés par type',
      isLoading: trainingAsync.isLoading,
      child: trainingAsync.when(
        data: (d) {
          final data = d as dynamic;
          return Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _InternshipPill(
                      label: 'Vacances',
                      value: data.vacationInternships as int,
                      color: const Color(0xFF60A5FA)),
                  _InternshipPill(
                      label: 'Académique',
                      value: data.academicInternships as int,
                      color: const Color(0xFF34D399)),
                  _InternshipPill(
                      label: 'Professionnel',
                      value: data.professionalInternships as int,
                      color: const Color(0xFFF59E0B)),
                  _InternshipPill(
                      label: 'Pré-emploi',
                      value: data.preEmploymentInternships as int,
                      color: const Color(0xFF8B5CF6)),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                'Total stagiaires: ${data.totalInternships as int}',
                style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: _kTextPrimary),
              ),
            ],
          );
        },
        loading: () => const SizedBox(height: 160),
        error: (_, __) => const SizedBox(height: 160),
      ),
    );
  }
}

// ── Regional ─────────────────────────────────────────────────

class _RegionalBlock extends ConsumerWidget {
  final int year;
  const _RegionalBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopGenderDistributionProvider(year));
    return _ChartBlock(
      title: 'Performance régionale',
      subtitle: 'Top régions par effectif total',
      isLoading: async.isLoading,
      child: async.when(
        data: (regions) {
          final sorted = [...regions]
            ..sort((a, b) => b.total.compareTo(a.total));
          final top5 = sorted.take(5).toList();
          return SizedBox(
            height: 260,
            child: HorizontalRankingChart(
              data: top5
                  .map((r) => RankData(label: r.region, value: r.total))
                  .toList(),
              unit: ' salariés',
            ),
          );
        },
        loading: () => const SizedBox(height: 260),
        error: (_, __) => const SizedBox(height: 260),
      ),
    );
  }
}

// ── Sector ───────────────────────────────────────────────────

class _SectorBlock extends ConsumerWidget {
  final int year;
  const _SectorBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(onefopSectorsProvider(year));
    return _ChartBlock(
      title: "Secteurs d'activité",
      subtitle: 'Répartition par effectif',
      isLoading: async.isLoading,
      child: async.when(
        data: (sectors) =>
            SizedBox(height: 260, child: SectorBarChart(sectors: sectors)),
        loading: () => const SizedBox(height: 260),
        error: (_, __) => const SizedBox(height: 260),
      ),
    );
  }
}

// ── Entity structure ─────────────────────────────────────────

class _EntityStructureBlock extends ConsumerWidget {
  final int year;
  const _EntityStructureBlock({required this.year});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bAsync = ref.watch(onefopEntityBreakdownProvider(year));
    final sAsync = ref.watch(onefopEntitySizeProvider(year));

    return _ChartBlock(
      title: 'Structure des entités',
      subtitle: "Répartition par type et taille d'entreprise",
      isLoading: bAsync.isLoading || sAsync.isLoading,
      child: bAsync.when(
        data: (bd) => sAsync.when(
          data: (sz) => Column(children: [
            Row(children: [
              _EntityPill(
                  label: 'Entreprises',
                  count: (bd as dynamic).enterprises.count as int? ?? 0,
                  employees: (bd as dynamic).enterprises.employees as int? ?? 0,
                  color: const Color(0xFF4472C4)),
              _EntityPill(
                  label: 'Coopératives',
                  count: (bd as dynamic).cooperatives.count as int? ?? 0,
                  employees:
                      (bd as dynamic).cooperatives.employees as int? ?? 0,
                  color: const Color(0xFF70AD47)),
              _EntityPill(
                  label: 'CTD',
                  count: (bd as dynamic).ctds.count as int? ?? 0,
                  employees: (bd as dynamic).ctds.employees as int? ?? 0,
                  color: const Color(0xFFF59E0B)),
              _EntityPill(
                  label: 'ONG',
                  count: (bd as dynamic).ongs.count as int? ?? 0,
                  employees: (bd as dynamic).ongs.employees as int? ?? 0,
                  color: const Color(0xFF8B5CF6)),
            ]),
            const SizedBox(height: 20),
            const Divider(height: 1, color: _kHairline),
            const SizedBox(height: 12),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('Tailles des entreprises',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _kTextSecondary)),
            ),
            const SizedBox(height: 8),
            _CompactBarRow(segments: [
              _BarSegment(
                  label: 'TPE',
                  value: (sz as dynamic).tpe as int? ?? 0,
                  total: (sz as dynamic).total as int? ?? 1,
                  color: const Color(0xFF93C5FD)),
              _BarSegment(
                  label: 'PE',
                  value: (sz as dynamic).pe as int? ?? 0,
                  total: (sz as dynamic).total as int? ?? 1,
                  color: const Color(0xFF60A5FA)),
              _BarSegment(
                  label: 'ME',
                  value: (sz as dynamic).me as int? ?? 0,
                  total: (sz as dynamic).total as int? ?? 1,
                  color: const Color(0xFF3B82F6)),
              _BarSegment(
                  label: 'GE',
                  value: (sz as dynamic).ge as int? ?? 0,
                  total: (sz as dynamic).total as int? ?? 1,
                  color: const Color(0xFF1D4ED8)),
            ]),
          ]),
          loading: () => const SizedBox(height: 160),
          error: (_, __) => const SizedBox(height: 160),
        ),
        loading: () => const SizedBox(height: 160),
        error: (_, __) => const SizedBox(height: 160),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// SHARED HELPER WIDGETS (unchanged logic, updated color refs)
// ═══════════════════════════════════════════════════════════════

String _fmt(int n) {
  if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
  if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
  return n.toString();
}

// ── _BalanceBlock: tint only, no border ──────────────────────

class _BalanceBlock extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final Color bgColor;
  final IconData icon;

  const _BalanceBlock({
    required this.label,
    required this.value,
    required this.color,
    required this.bgColor,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bgColor.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Expanded(
                child: Text(label,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: color),
                    overflow: TextOverflow.ellipsis)),
          ]),
          const SizedBox(height: 6),
          Text(_fmt(value),
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }
}

class _BreakdownRow extends StatelessWidget {
  final String label;
  final int value;
  final int total;
  final Color color;

  const _BreakdownRow({
    required this.label,
    required this.value,
    required this.total,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? value / total : 0.0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(children: [
        SizedBox(
            width: 110,
            child: Text(label,
                style:
                    const TextStyle(fontSize: 11, color: Color(0xFF475569)))),
        Expanded(
          child: LinearProgressIndicator(
            value: pct,
            backgroundColor: const Color(0xFFF1F5F9),
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 6,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 52,
          child: Text(
            '${_fmt(value)} (${(pct * 100).toStringAsFixed(0)}%)',
            style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: _kTextPrimary),
            textAlign: TextAlign.right,
          ),
        ),
      ]),
    );
  }
}

// ── _FunnelBlock: tint only, no border ───────────────────────

class _FunnelBlock extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final String sub;

  const _FunnelBlock({
    required this.label,
    required this.value,
    required this.color,
    required this.sub,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
      ),
    );
  }
}

class _BarSegment {
  final String label;
  final int value;
  final int total;
  final Color color;

  const _BarSegment({
    required this.label,
    required this.value,
    required this.total,
    required this.color,
  });
}

class _CompactBarRow extends StatelessWidget {
  final List<_BarSegment> segments;
  const _CompactBarRow({required this.segments});

  @override
  Widget build(BuildContext context) {
    final total = segments.fold<int>(0, (sum, s) => sum + s.value);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 8,
          decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
              color: const Color(0xFFF1F5F9)),
          child: total == 0
              ? null
              : Row(
                  children: segments
                      .where((s) => s.value > 0)
                      .map((s) => Flexible(
                            flex: s.value,
                            child: Container(
                              decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(4),
                                  color: s.color),
                            ),
                          ))
                      .toList(),
                ),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 12,
          children: segments.map((s) {
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        color: s.color)),
                const SizedBox(width: 4),
                Text('${s.label} ${_fmt(s.value)}',
                    style:
                        const TextStyle(fontSize: 10, color: _kTextSecondary)),
              ],
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _RatioBar extends StatelessWidget {
  final int left;
  final int right;
  final Color leftColor;
  final Color rightColor;

  const _RatioBar({
    required this.left,
    required this.right,
    required this.leftColor,
    required this.rightColor,
  });

  @override
  Widget build(BuildContext context) {
    final total = left + right;
    if (total == 0) {
      return Container(
          height: 8,
          decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
              color: const Color(0xFFF1F5F9)));
    }
    return Container(
      height: 8,
      decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(4),
          color: const Color(0xFFF1F5F9)),
      child: Row(children: [
        if (left > 0)
          Flexible(
              flex: left,
              child: Container(
                  decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      color: leftColor))),
        if (right > 0)
          Flexible(
              flex: right,
              child: Container(
                  decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      color: rightColor))),
      ]),
    );
  }
}

// ── _MiniPill: tint only, no border ──────────────────────────

class _MiniPill extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _MiniPill(
      {required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text('$label: ${_fmt(value)}',
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

class _BigStat extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _BigStat(
      {required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(_fmt(value),
            style: TextStyle(
                fontSize: 20, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 2),
        Text(label,
            style: const TextStyle(fontSize: 11, color: _kTextSecondary)),
      ],
    );
  }
}

class _BigNumber extends StatelessWidget {
  final double value;
  final String suffix;
  final String label;
  final Color color;

  const _BigNumber({
    required this.value,
    required this.suffix,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text('${value.toStringAsFixed(1)}$suffix',
          style: TextStyle(
              fontSize: 28, fontWeight: FontWeight.w800, color: color)),
      const SizedBox(height: 4),
      Text(label, style: const TextStyle(fontSize: 12, color: _kTextSecondary)),
    ]);
  }
}

// ── _InclusionBlock: tint only, no border ────────────────────

class _InclusionBlock extends StatelessWidget {
  final String title;
  final int value;
  final Color color;
  final IconData icon;

  const _InclusionBlock({
    required this.title,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(title,
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600, color: color)),
          ]),
          const SizedBox(height: 8),
          Text(_fmt(value),
              style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }
}

class _SkillList extends StatelessWidget {
  final String title;
  final List<SkillTraining> items;
  final Color color;

  const _SkillList({
    required this.title,
    required this.items,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final maxCount = items.isNotEmpty
        ? items.map((e) => e.count).reduce((a, b) => a > b ? a : b)
        : 1;
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w700, color: color)),
          const SizedBox(height: 10),
          ...items.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                            child: Text(item.skill,
                                style: const TextStyle(
                                    fontSize: 11, color: Color(0xFF334155)),
                                overflow: TextOverflow.ellipsis)),
                        Text('${item.count}',
                            style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: _kTextPrimary)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    LinearProgressIndicator(
                      value: item.count / maxCount,
                      backgroundColor: const Color(0xFFF1F5F9),
                      valueColor: AlwaysStoppedAnimation<Color>(color),
                      minHeight: 4,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ],
                ),
              )),
        ],
      ),
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
          width: 48,
          height: 48,
          decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1), shape: BoxShape.circle),
          alignment: Alignment.center,
          child: Text(_fmt(value),
              style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w700, color: color)),
        ),
        const SizedBox(height: 6),
        Text(label,
            style: const TextStyle(fontSize: 10, color: _kTextSecondary),
            textAlign: TextAlign.center),
      ],
    );
  }
}

class _DepartureChip extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _DepartureChip({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_fmt(value),
              style: TextStyle(
                  fontSize: 16, fontWeight: FontWeight.w700, color: color)),
          const SizedBox(height: 2),
          Text(label,
              style:
                  TextStyle(fontSize: 11, color: color.withValues(alpha: 0.8))),
        ],
      ),
    );
  }
}

class _MiniProgressBar extends StatelessWidget {
  final String label;
  final int value;
  final int total;
  final Color color;

  const _MiniProgressBar({
    required this.label,
    required this.value,
    required this.total,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(children: [
        SizedBox(
            width: 100,
            child: Text(label,
                style:
                    const TextStyle(fontSize: 11, color: Color(0xFF475569)))),
        const SizedBox(width: 8),
        Expanded(
          child: LinearProgressIndicator(
            value: total == 0 ? 0 : value / total,
            backgroundColor: const Color(0xFFF1F5F9),
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 6,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
            width: 32,
            child: Text('$value',
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: _kTextPrimary),
                textAlign: TextAlign.right)),
      ]),
    );
  }
}

// ── _EntityPill: tint only, no border ────────────────────────

class _EntityPill extends StatelessWidget {
  final String label;
  final int count;
  final int employees;
  final Color color;

  const _EntityPill({
    required this.label,
    required this.count,
    required this.employees,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(children: [
          Text(label,
              style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w600, color: color)),
          const SizedBox(height: 6),
          Text('$count',
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text('${_fmt(employees)} empl.',
              style: const TextStyle(fontSize: 10, color: _kTextSecondary)),
        ]),
      ),
    );
  }
}
