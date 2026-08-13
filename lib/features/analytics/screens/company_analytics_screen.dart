// lib/features/analytics/screens/company_analytics_screen.dart
//
// Structure  : TabController — 3 tabs: Bilan RH · Benchmarking · Opportunités
// Tab 1      : Bilan RH — a single source (bilanRhProvider, ONEFOP-derived).
//              Used to also stack a second, DSMO-Declaration-derived
//              "Ma situation" summary (companySummaryProvider) on top, but
//              that read from a different approval workflow than the one
//              gating this tab, showed a separately-locked card next to
//              already-real data for the same year, and had no other
//              consumer — removed rather than kept in sync with two
//              approval pipelines going forward.
// Tab 2      : Real benchmarking via companyBenchmarksProvider, unlocked as
//              soon as the ONEFOP questionnaire is submitted (not full
//              approval — see computeOnefopFeatures).
// Tab 3      : Real "Opportunités" cards computed from data already
//              collected (skill/training gaps, vacancy signal, benchmark
//              gaps, upcoming deadlines) — see _OpportunitiesTabContent.

import 'dart:typed_data' show Uint8List;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:printing/printing.dart';
import '../../../providers/auth_provider.dart';
import '../../../data/api_client.dart';
import '../../../theme/ultra_theme.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../widgets/common_widgets.dart' show GlassCard;
import '../data/bilan_rh.dart';

Map<String, dynamic> _safeMap(dynamic value) {
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return <String, dynamic>{};
}

int _safeInt(dynamic value) {
  return (value as num?)?.toInt() ?? 0;
}

double _safeDouble(dynamic value) {
  return (value as num?)?.toDouble() ?? 0.0;
}

bool _safeBool(dynamic value) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) {
    final lower = value.trim().toLowerCase();
    return lower == 'true' || lower == '1';
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// DATA MODELS
// ═══════════════════════════════════════════════════════════

class BenchmarkData {
  final bool available;
  final String? reason;
  final int? peerCount;
  final String groupBy;
  final Map<String, dynamic>? metrics;

  BenchmarkData({
    required this.available,
    this.reason,
    this.peerCount,
    required this.groupBy,
    this.metrics,
  });

  factory BenchmarkData.fromJson(Map<String, dynamic> json) {
    final data = _safeMap(json);
    return BenchmarkData(
      available: _safeBool(data['available']),
      reason: data['reason']?.toString(),
      peerCount: data['peerCount'] is num
          ? _safeInt(data['peerCount'])
          : null,
      groupBy: data['groupBy']?.toString() ?? 'sector',
      metrics: data['metrics'] is Map
          ? Map<String, dynamic>.from(data['metrics'] as Map)
          : null,
    );
  }
}

// ═══════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════

/// Sectoral benchmarks (gated behind feature flag)
final companyBenchmarksProvider =
    FutureProvider.family<BenchmarkData?, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  try {
    final response = await api.get(
      '/dsmo/analytics/company-benchmarks',
      queryParameters: {'year': year, 'groupBy': 'sector'},
    );
    return BenchmarkData.fromJson(_safeMap(response.data));
  } on DioException catch (e) {
    if (e.response?.statusCode == 403 || e.response?.statusCode == 404) {
      return null;
    }
    rethrow;
  }
});

// bilanRhProvider is defined in ../data/bilan_rh.dart (v2)

/// Opportunités tab — "deadlines" card. Reuses the same
/// GET /campaigns/active/current endpoint already driving the Home tab's
/// active-campaign banner (company_workspace_dashboard.dart); this is just
/// a second, independent read of the same real data; no new backend
/// endpoint needed.
final companyOpportunityCampaignsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiClientProvider);
  try {
    final campaigns = await api.getActiveCampaigns();
    return campaigns.cast<Map<String, dynamic>>();
  } on DioException catch (e) {
    if (e.response?.statusCode == 403 || e.response?.statusCode == 404) {
      return const [];
    }
    rethrow;
  }
});

// ═══════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════

class CompanyAnalyticsScreen extends ConsumerStatefulWidget {
  const CompanyAnalyticsScreen({super.key});

  @override
  ConsumerState<CompanyAnalyticsScreen> createState() =>
      _CompanyAnalyticsScreenState();
}

class _CompanyAnalyticsScreenState extends ConsumerState<CompanyAnalyticsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  // Null until the user explicitly picks a year — the effective year
  // (below) defaults to the most recent one with an approved Bilan RH
  // once `bilanAvailableYearsProvider` resolves, rather than assuming
  // the current calendar year always has one.
  int? _selectedYear;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    // user.features (hasBenchmarking, onefopSubmissionStatus, ...) is only
    // ever set at login/register/2FA and otherwise goes stale for the rest
    // of the session — e.g. an ONEFOP submission approved after login would
    // leave this screen showing the "not submitted yet" gate indefinitely.
    // Refresh it on open so the gates reflect current server state without
    // requiring a logout/login.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(authProvider.notifier).refreshUser();
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final user = ref.watch(authProvider).value;
    final hasBenchmarking = user?.features.onefopBenchmarking ?? false;
    final submissionStatus = user?.features.onefopSubmissionStatus;

    final availableYearsAsync = ref.watch(bilanAvailableYearsProvider);
    final availableYears = availableYearsAsync.valueOrNull ?? const <int>[];
    final currentYear = _selectedYear ??
        (availableYears.isNotEmpty ? availableYears.first : DateTime.now().year);

    final bilanAsync = ref.watch(bilanRhProvider(currentYear));
    final benchmarksAsync = hasBenchmarking
        ? ref.watch(companyBenchmarksProvider(currentYear))
        : const AsyncValue<BenchmarkData?>.data(null);

    return Scaffold(
      backgroundColor: UltraTheme.background,
      body: Column(
        children: [
          // ── Tab Bar ──────────────────────────────────────
          Container(
            color: UltraTheme.surface,
            child: Row(
              children: [
                Expanded(
                  child: TabBar(
                    controller: _tabs,
                    labelColor: UltraTheme.primary,
                    unselectedLabelColor: UltraTheme.textMuted,
                    indicatorColor: UltraTheme.primary,
                    indicatorWeight: 2,
                    labelStyle: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600),
                    unselectedLabelStyle: const TextStyle(fontSize: 13),
                    tabs: [
                      Tab(text: l10n.companyAnalyticsTabBilanRh),
                      Tab(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(l10n.companyAnalyticsTabBenchmarking),
                            if (hasBenchmarking) ...[
                              const SizedBox(width: 6),
                              _ActiveBadge(
                                  label: l10n.companyAnalyticsBadgeActive,
                                  color: Colors.green,
                                  mini: true),
                            ],
                          ],
                        ),
                      ),
                      Tab(text: l10n.companyAnalyticsTabOpportunities),
                    ],
                  ),
                ),
                if (availableYears.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: _YearDropdown(
                      years: availableYears,
                      selected: currentYear,
                      onChanged: (y) => setState(() => _selectedYear = y),
                    ),
                  ),
              ],
            ),
          ),

          // ── Tab Views ─────────────────────────────────────
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                // ── Tab 1: Bilan RH ─────────────────────────
                RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(bilanRhProvider(currentYear));
                    ref.invalidate(bilanAvailableYearsProvider);
                  },
                  child: _BilanTabContent(
                    bilanAsync: bilanAsync,
                    submissionStatus: submissionStatus,
                    currentYear: currentYear,
                  ),
                ),

                // ── Tab 2: Benchmarking ────────────────────
                RefreshIndicator(
                  onRefresh: () async {
                    if (hasBenchmarking) {
                      ref.invalidate(companyBenchmarksProvider(currentYear));
                    }
                  },
                  child: _BenchmarkingTabContent(
                    hasBenchmarking: hasBenchmarking,
                    benchmarksAsync: benchmarksAsync,
                    submissionStatus: submissionStatus,
                    year: currentYear,
                  ),
                ),

                // ── Tab 3: Opportunités ────────────────────
                RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(bilanRhProvider(currentYear));
                    if (hasBenchmarking) {
                      ref.invalidate(companyBenchmarksProvider(currentYear));
                    }
                    ref.invalidate(companyOpportunityCampaignsProvider);
                  },
                  child: _OpportunitiesTabContent(
                    bilanAsync: bilanAsync,
                    hasBenchmarking: hasBenchmarking,
                    benchmarksAsync: benchmarksAsync,
                    submissionStatus: submissionStatus,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// YEAR DROPDOWN  (picks which approved Bilan RH year is shown)
// ═══════════════════════════════════════════════════════════

class _YearDropdown extends StatelessWidget {
  final List<int> years;
  final int selected;
  final ValueChanged<int> onChanged;

  const _YearDropdown({
    required this.years,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<int>(
      initialValue: selected,
      onSelected: onChanged,
      itemBuilder: (context) => years
          .map((y) => PopupMenuItem(
                value: y,
                child: Text('$y',
                    style: TextStyle(
                        fontWeight:
                            y == selected ? FontWeight.w700 : FontWeight.w400,
                        color: y == selected
                            ? UltraTheme.primary
                            : UltraTheme.textPrimary)),
              ))
          .toList(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: UltraTheme.background,
          borderRadius: BorderRadius.circular(UltraTheme.radiusSmall),
          border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('$selected',
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: UltraTheme.textPrimary)),
            const SizedBox(width: 4),
            const Icon(Icons.keyboard_arrow_down,
                size: 16, color: UltraTheme.textMuted),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// TAB 1 — BILAN RH
// ═══════════════════════════════════════════════════════════

class _BilanTabContent extends ConsumerStatefulWidget {
  final AsyncValue<BilanRh?> bilanAsync;
  final String? submissionStatus;
  final int currentYear;

  const _BilanTabContent({
    required this.bilanAsync,
    required this.submissionStatus,
    required this.currentYear,
  });

  @override
  ConsumerState<_BilanTabContent> createState() => _BilanTabContentState();
}

class _BilanTabContentState extends ConsumerState<_BilanTabContent> {
  bool _exportingPdf = false;

  Future<void> _exportPdf() async {
    if (_exportingPdf) return;
    setState(() => _exportingPdf = true);
    try {
      final bytes =
          await ref.read(apiClientProvider).getBilanPdf(widget.currentYear);
      await Printing.layoutPdf(onLayout: (_) => Uint8List.fromList(bytes));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.companyAnalyticsBilanPdfExportError)),
        );
      }
    } finally {
      if (mounted) setState(() => _exportingPdf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (widget.bilanAsync.isLoading) {
      return const _ShimmerBilan();
    }
    if (widget.bilanAsync.hasError) {
      return _ErrorView(message: widget.bilanAsync.error.toString());
    }

    final bilan = widget.bilanAsync.valueOrNull;
    if (bilan == null) {
      return _LockedBilanView(status: widget.submissionStatus);
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // ── Header + PDF export ─────────────────────────────
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                l10n.companyAnalyticsHeaderYear(widget.currentYear),
                style: UltraTheme.displayMedium.copyWith(fontSize: 24),
              ),
            ),
            const SizedBox(width: 12),
            OutlinedButton.icon(
              onPressed: _exportingPdf ? null : _exportPdf,
              icon: _exportingPdf
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.picture_as_pdf_outlined, size: 16),
              label: Text(l10n.companyAnalyticsExportPdfButton),
              style: OutlinedButton.styleFrom(
                foregroundColor: UltraTheme.primary,
                side: BorderSide(color: UltraTheme.primary.withValues(alpha: 0.4)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        _BilanRhView(bilan: bilan, year: widget.currentYear),
        const SizedBox(height: 8),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// TAB 2 — BENCHMARKING  (real data if unlocked, teaser otherwise)
// ═══════════════════════════════════════════════════════════

class _BenchmarkingTabContent extends StatelessWidget {
  final bool hasBenchmarking;
  final AsyncValue<BenchmarkData?> benchmarksAsync;
  final String? submissionStatus;
  final int year;

  const _BenchmarkingTabContent({
    required this.hasBenchmarking,
    required this.benchmarksAsync,
    required this.submissionStatus,
    required this.year,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    if (!hasBenchmarking) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _SectionTitle(
            l10n.companyAnalyticsSectionBenchmarking,
            trailing: _ActiveBadge(
                label: l10n.companyAnalyticsBadgePending,
                color: UltraTheme.warning),
          ),
          const _LockedBenchmarkCard(),
          const SizedBox(height: 32),
          _ComingSoonView(
            icon: Icons.bar_chart_outlined,
            title: l10n.companyAnalyticsBenchmarkingComingTitle,
            description: l10n.companyAnalyticsBenchmarkingComingDescription,
            badgeLabel: l10n.companyAnalyticsComingSoonBadge,
          ),
        ],
      );
    }

    return benchmarksAsync.when(
      data: (benchmarks) {
        if (benchmarks == null) return const SizedBox.shrink();
        if (!benchmarks.available) {
          // This tab's unlock gate (hasBenchmarking, ONEFOP-based) is
          // separate from what the comparison itself is computed from (an
          // approved DSMO declaration for `year`) — a company can clear
          // the gate with no DSMO declaration on file. NO_OWN_DATA names
          // that case explicitly instead of folding it into the generic
          // "not enough peer companies" message, which would be both
          // wrong and unhelpful here.
          final isOwnDataMissing = benchmarks.reason == 'NO_OWN_DATA';
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _SectionTitle(
                l10n.companyAnalyticsSectionBenchmarking,
                trailing: _ActiveBadge(
                    label: l10n.companyAnalyticsBadgeActive,
                    color: Colors.green),
              ),
              if (isOwnDataMissing)
                _NoOwnDataCard(year: year)
              else
                _InsufficientDataCard(
                  peerCount: benchmarks.peerCount ?? 0,
                  minRequired: 5,
                ),
            ],
          );
        }
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _SectionTitle(
              l10n.companyAnalyticsSectionBenchmarking,
              trailing: _ActiveBadge(
                  label: l10n.companyAnalyticsBadgeActive,
                  color: Colors.green),
            ),
            Text(
              l10n.companyAnalyticsPeerGroupCount(
                  '${benchmarks.peerCount ?? '—'}'),
              style: UltraTheme.bodyMedium
                  .copyWith(color: UltraTheme.textMuted, fontSize: 13),
            ),
            const SizedBox(height: 16),
            _BenchmarkCards(benchmarks: benchmarks),
          ],
        );
      },
      loading: () => const _ShimmerBenchmarkFull(),
      error: (e, _) =>
          _ErrorView(message: l10n.companyAnalyticsBenchmarkError('$e')),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// TAB 3 — OPPORTUNITÉS  (real, computed from data already collected —
// no candidate matching / training-provider directory / tax-incentive
// engine, since none of those have a data source today; see
// companyOpportunityCampaignsProvider above and the cards below)
// ═══════════════════════════════════════════════════════════

/// Only campaigns the company hasn't already dealt with, nearest deadline
/// first, capped at 3 — this is a "what needs attention" list, not a full
/// campaign history (that already exists on the Home tab).
List<Map<String, dynamic>> _actionableCampaigns(
    List<Map<String, dynamic>> campaigns) {
  const done = {'SUBMITTED', 'VALIDATED'};
  final actionable = campaigns.where((c) {
    final mySubmission = c['mySubmission'] as String? ?? 'NOT_STARTED';
    if (done.contains(mySubmission)) return false;
    return DateTime.tryParse(c['deadline']?.toString() ?? '') != null;
  }).toList();
  actionable.sort((a, b) {
    final da = DateTime.parse(a['deadline'].toString());
    final db = DateTime.parse(b['deadline'].toString());
    return da.compareTo(db);
  });
  return actionable.take(3).toList();
}

class _OpportunitiesTabContent extends ConsumerWidget {
  final AsyncValue<BilanRh?> bilanAsync;
  final bool hasBenchmarking;
  final AsyncValue<BenchmarkData?> benchmarksAsync;
  final String? submissionStatus;

  const _OpportunitiesTabContent({
    required this.bilanAsync,
    required this.hasBenchmarking,
    required this.benchmarksAsync,
    required this.submissionStatus,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;

    if (bilanAsync.isLoading) return const _ShimmerBilan();
    if (bilanAsync.hasError) {
      return _ErrorView(message: bilanAsync.error.toString());
    }

    final bilan = bilanAsync.valueOrNull;
    // Two of the four cards below (skill/training gaps, vacancy signal)
    // read the company's own approved ONEFOP data — without it there's
    // nothing yet to surface, so this reuses the Bilan RH tab's locked
    // state rather than showing a half-empty screen on a brand-new account.
    if (bilan == null) {
      return _LockedBilanView(status: submissionStatus);
    }

    final campaignsAsync = ref.watch(companyOpportunityCampaignsProvider);
    final hasSkillGaps =
        bilan.skillNeeds.isNotEmpty || bilan.trainingNeeds.isNotEmpty;
    final hasVacancies = bilan.vacancies > 0;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(l10n.companyAnalyticsOpportunitiesTitle,
            style: UltraTheme.displayMedium.copyWith(fontSize: 24)),
        const SizedBox(height: 4),
        Text(l10n.companyAnalyticsOpportunitiesDescription,
            style: UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted)),
        const SizedBox(height: 24),
        if (hasVacancies) ...[
          _VacancyOpportunityCard(bilan: bilan),
          const SizedBox(height: 16),
        ],
        if (hasBenchmarking)
          benchmarksAsync.when(
            data: (b) => (b == null || !b.available)
                ? const SizedBox.shrink()
                : _BenchmarkGapCard(benchmarks: b),
            loading: () => const Padding(
              padding: EdgeInsets.only(bottom: 16),
              child: _ShimmerCard(height: 90, borderRadius: 16),
            ),
            error: (_, __) => const SizedBox.shrink(),
          ),
        campaignsAsync.when(
          data: (campaigns) {
            final actionable = _actionableCampaigns(campaigns);
            return actionable.isEmpty
                ? const SizedBox.shrink()
                : Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _DeadlinesCard(campaigns: actionable),
                  );
          },
          loading: () => const Padding(
            padding: EdgeInsets.only(bottom: 16),
            child: _ShimmerCard(height: 90, borderRadius: 16),
          ),
          error: (_, __) => const SizedBox.shrink(),
        ),
        if (hasSkillGaps) ...[
          _SectionLabel(l10n.companyAnalyticsSectionSkillsTraining),
          _SkillsTrainingCard(
              skillNeeds: bilan.skillNeeds, trainingNeeds: bilan.trainingNeeds),
        ],
      ],
    );
  }
}

class _VacancyOpportunityCard extends StatelessWidget {
  final BilanRh bilan;
  const _VacancyOpportunityCard({required this.bilan});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: UltraTheme.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        border: Border.all(color: UltraTheme.primary.withValues(alpha: 0.2)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.work_outline, color: UltraTheme.primary, size: 22),
        const SizedBox(width: 12),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l10n.opportunitiesVacancyTitle,
              style: UltraTheme.bodyMedium.copyWith(
                  fontWeight: FontWeight.w700, color: UltraTheme.primary)),
          const SizedBox(height: 4),
          Text(
            l10n.opportunitiesVacancyDetail(
                bilan.vacancies, bilan.vacancyRate.toStringAsFixed(1)),
            style: UltraTheme.bodyMedium.copyWith(fontSize: 13),
          ),
        ])),
      ]),
    );
  }
}

class _BenchmarkGapCard extends StatelessWidget {
  final BenchmarkData benchmarks;
  const _BenchmarkGapCard({required this.benchmarks});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final metrics = benchmarks.metrics;
    if (metrics == null) return const SizedBox.shrink();

    // Only reports metrics where the company is BELOW the sector median —
    // a "gap" here means something to close, not a fabricated one when
    // the company is already at or above par.
    final gaps = <String>[];

    final empMetrics = metrics['totalEmployees'] is Map
        ? Map<String, dynamic>.from(metrics['totalEmployees'] as Map)
        : <String, dynamic>{};
    if (empMetrics.isNotEmpty && _safeInt(empMetrics['percentile']) < 50) {
      gaps.add(l10n.opportunitiesBenchmarkGapWorkforce(
          _safeInt(empMetrics['mine']), _safeInt(empMetrics['median'])));
    }

    // Turnover is the inverse of the other metrics here: a HIGH percentile
    // means more departures relative to peers than most of them, i.e. worse
    // retention — so the gap fires above the median, not below it.
    final turnoverMetrics = metrics['turnoverRate'] is Map
        ? Map<String, dynamic>.from(metrics['turnoverRate'] as Map)
        : <String, dynamic>{};
    if (turnoverMetrics.isNotEmpty && _safeInt(turnoverMetrics['percentile']) > 50) {
      gaps.add(l10n.opportunitiesBenchmarkGapTurnover(
          _safeDouble(turnoverMetrics['mine']).toStringAsFixed(1),
          _safeDouble(turnoverMetrics['median']).toStringAsFixed(1)));
    }

    if (gaps.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: UltraTheme.warning.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
          border: Border.all(color: UltraTheme.warning.withValues(alpha: 0.2)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.bar_chart_outlined,
                color: UltraTheme.warning, size: 20),
            const SizedBox(width: 10),
            Text(l10n.opportunitiesBenchmarkGapTitle,
                style: UltraTheme.bodyMedium.copyWith(fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 8),
          ...gaps.map((g) => Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(g, style: UltraTheme.bodyMedium.copyWith(fontSize: 13)),
              )),
        ]),
      ),
    );
  }
}

class _DeadlinesCard extends StatelessWidget {
  final List<Map<String, dynamic>> campaigns;
  const _DeadlinesCard({required this.campaigns});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.event_outlined, size: 18, color: UltraTheme.primary),
            const SizedBox(width: 8),
            Text(l10n.opportunitiesDeadlinesTitle,
                style:
                    UltraTheme.bodyMedium.copyWith(fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 12),
          ...campaigns.map((c) => _buildRow(context, c)),
        ],
      ),
    );
  }

  Widget _buildRow(BuildContext context, Map<String, dynamic> c) {
    final l10n = context.l10n;
    final name = c['name'] as String? ?? '';
    final deadline = DateTime.parse(c['deadline'].toString());
    final daysLeft = deadline.difference(DateTime.now()).inDays;
    final dateStr =
        '${deadline.day.toString().padLeft(2, '0')}/${deadline.month.toString().padLeft(2, '0')}/${deadline.year}';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        Expanded(
            child: Text(name,
                style: UltraTheme.bodyMedium.copyWith(fontSize: 13),
                overflow: TextOverflow.ellipsis)),
        const SizedBox(width: 8),
        Text(
          daysLeft >= 0
              ? l10n.opportunitiesDeadlineInDays(dateStr, daysLeft)
              : l10n.opportunitiesDeadlinePassed(dateStr),
          style: UltraTheme.bodyMedium.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: daysLeft <= 7 ? UltraTheme.warning : UltraTheme.textMuted),
        ),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// BENCHMARK CARDS
// ═══════════════════════════════════════════════════════════

class _BenchmarkCards extends StatelessWidget {
  final BenchmarkData benchmarks;
  const _BenchmarkCards({required this.benchmarks});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final metrics = benchmarks.metrics;
    if (metrics == null) return const SizedBox.shrink();

    final empMetrics = metrics['totalEmployees'] is Map
        ? Map<String, dynamic>.from(metrics['totalEmployees'] as Map)
        : <String, dynamic>{};
    final turnoverMetrics = metrics['turnoverRate'] is Map
        ? Map<String, dynamic>.from(metrics['turnoverRate'] as Map)
        : <String, dynamic>{};

    return Column(
      children: [
        if (empMetrics.isNotEmpty)
          _BenchmarkRow(
            label: l10n.companyAnalyticsTotalWorkforce,
            mine: _safeInt(empMetrics['mine']),
            median: _safeInt(empMetrics['median']),
            percentile: _safeInt(empMetrics['percentile']),
            unit: l10n.companyAnalyticsUnitEmployees,
          ),
        if (turnoverMetrics.isNotEmpty)
          _BenchmarkRow(
            label: l10n.companyAnalyticsTurnoverRate,
            mine: _safeDouble(turnoverMetrics['mine']),
            median: _safeDouble(turnoverMetrics['median']),
            percentile: _safeInt(turnoverMetrics['percentile']),
            unit: '%',
            isPercentage: true,
            higherIsBetter: false,
          ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// v2 BILAN RH VIEW  (unchanged from v2)
// ═══════════════════════════════════════════════════════════

class _BilanRhView extends StatelessWidget {
  final BilanRh bilan;
  final int year;
  const _BilanRhView({required this.bilan, required this.year});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
            bilan.quarterCount > 1
                ? l10n.companyAnalyticsBilanAggregatedSubtitle(bilan.quarterCount)
                : l10n.companyAnalyticsBilanDeclarationSubtitle,
            style: UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted)),
        const SizedBox(height: 20),
        _SectionLabel(l10n.companyAnalyticsSectionEffectifs),
        _MetricRow(children: [
          _MetricCard(
            label: l10n.companyAnalyticsPermanentEmployees,
            value: bilan.permanentWorkers.toString(),
            icon: Icons.people_outline,
            color: UltraTheme.primary,
          ),
          _MetricCard(
            label: l10n.companyAnalyticsVacantPositions,
            value: bilan.vacancies.toString(),
            badge: '${bilan.vacancyRate.toStringAsFixed(1)}%',
            badgeColor: bilan.vacancyRate > 10 ? Colors.orange : Colors.green,
            icon: Icons.work_outline,
          ),
        ]),
        const SizedBox(height: 8),
        _MetricRow(children: [
          _MetricCard(
            label: l10n.companyAnalyticsRecruitmentsLabel,
            value: bilan.totalRecruitments.toString(),
            icon: Icons.person_add_alt_outlined,
            color: Colors.green,
          ),
          _MetricCard(
            label: l10n.companyAnalyticsTurnoverRate,
            value: '${bilan.turnoverRate.toStringAsFixed(1)}%',
            badge: bilan.turnoverRate > 10 ? l10n.companyAnalyticsHigh : l10n.companyAnalyticsNormal,
            badgeColor: bilan.turnoverRate > 10 ? Colors.orange : Colors.green,
            icon: Icons.swap_horiz,
          ),
        ]),
        const SizedBox(height: 24),
        _SectionLabel(l10n.companyAnalyticsSectionRecruitmentsByCategory),
        _CspRecruitmentCard(breakdown: bilan.recruitments.combined),
        const SizedBox(height: 24),
        _SectionLabel(l10n.companyAnalyticsDeparturesLabel),
        _DeparturesCard(departures: bilan.departures),
        const SizedBox(height: 24),
        if (bilan.internships.total > 0) ...[
          _SectionLabel(l10n.companyAnalyticsSectionInterns),
          _InternshipCard(internships: bilan.internships),
          const SizedBox(height: 24),
        ],
        if (bilan.skillNeeds.isNotEmpty || bilan.trainingNeeds.isNotEmpty) ...[
          _SectionLabel(l10n.companyAnalyticsSectionSkillsTraining),
          _SkillsTrainingCard(
              skillNeeds: bilan.skillNeeds, trainingNeeds: bilan.trainingNeeds),
          const SizedBox(height: 24),
        ],
        if (bilan.vulnerableWorkers.total > 0 ||
            bilan.disabledRecruitments.total > 0)
          _InclusionInsightCard(
            vulnerable: bilan.vulnerableWorkers,
            disabled: bilan.disabledRecruitments,
            totalRecruitments: bilan.totalRecruitments,
          ),
        const SizedBox(height: 8),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// SHARED SECTION HEADERS
// ═══════════════════════════════════════════════════════════

/// v1-style section title (used at ListView level, with accent bar + optional trailing badge)
class _SectionTitle extends StatelessWidget {
  final String title;
  final Widget? trailing;
  const _SectionTitle(this.title, {this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16, top: 8),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 20,
            decoration: BoxDecoration(
              color: UltraTheme.primary,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Text(title, style: UltraTheme.titleLarge),
          const Spacer(),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// v2-style section label (used inline within card columns)
class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Container(
            width: 3,
            height: 16,
            decoration: BoxDecoration(
                color: UltraTheme.primary,
                borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 8),
        Text(text, style: UltraTheme.titleMedium),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// v1 WIDGETS
// ═══════════════════════════════════════════════════════════

class _ActiveBadge extends StatelessWidget {
  final String label;
  final Color color;
  final bool mini;
  const _ActiveBadge(
      {required this.label, required this.color, this.mini = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: mini ? 6 : 10, vertical: mini ? 2 : 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.circle, size: mini ? 6 : 8, color: color),
          SizedBox(width: mini ? 3 : 4),
          Text(label,
              style: TextStyle(
                  fontSize: mini ? 10 : 11,
                  fontWeight: FontWeight.w600,
                  color: color)),
        ],
      ),
    );
  }
}

class _BenchmarkRow extends StatelessWidget {
  final String label;
  final num mine;
  final num median;
  final int percentile;
  final String unit;
  final bool isPercentage;
  // Workforce size: a higher raw percentile (more peers below you) reads as
  // "better" as-is. Turnover is the opposite — a higher percentile means
  // more departures than most peers, i.e. worse retention — so that case
  // passes false to flip which end of the scale counts as "top".
  final bool higherIsBetter;

  const _BenchmarkRow({
    required this.label,
    required this.mine,
    required this.median,
    required this.percentile,
    required this.unit,
    this.isPercentage = false,
    this.higherIsBetter = true,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final mineStr = isPercentage ? mine.toStringAsFixed(1) : mine.toString();
    final medianStr =
        isPercentage ? median.toStringAsFixed(1) : median.toString();

    // Normalized so 100 always means "best possible standing", regardless
    // of which raw direction this particular metric's percentile runs.
    final rank = higherIsBetter ? percentile : 100 - percentile;

    Color percentileColor;
    String percentileText;
    if (rank >= 75) {
      percentileColor = Colors.green;
      percentileText = l10n.companyAnalyticsPercentileTop(rank);
    } else if (rank >= 50) {
      percentileColor = Colors.orange;
      percentileText = l10n.companyAnalyticsPercentileMedianPlus;
    } else {
      percentileColor = Colors.red;
      percentileText = l10n.companyAnalyticsPercentileBottom(100 - rank);
    }

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(label,
                      style: UltraTheme.bodyMedium
                          .copyWith(color: UltraTheme.textMuted)),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: percentileColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    percentileText,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: percentileColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _BenchmarkValue(
                    label: l10n.companyAnalyticsYourCompany,
                    value: '$mineStr $unit',
                    isHighlighted: true,
                  ),
                ),
                Container(height: 40, width: 1, color: Colors.grey.shade300),
                Expanded(
                  child: _BenchmarkValue(
                    label: l10n.companyAnalyticsSectorMedian,
                    value: '$medianStr $unit',
                    isHighlighted: false,
                  ),
                ),
              ],
            ),
          ],
        ),
    );
  }
}

class _BenchmarkValue extends StatelessWidget {
  final String label;
  final String value;
  final bool isHighlighted;

  const _BenchmarkValue({
    required this.label,
    required this.value,
    required this.isHighlighted,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label,
            style: UltraTheme.bodyMedium
                .copyWith(fontSize: 12)
                .copyWith(color: UltraTheme.textMuted)),
        const SizedBox(height: 4),
        Text(
          value,
          style: UltraTheme.titleMedium.copyWith(
            fontWeight: isHighlighted ? FontWeight.bold : FontWeight.w500,
            color: isHighlighted ? UltraTheme.primary : UltraTheme.textPrimary,
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// v2 BILAN WIDGETS
// ═══════════════════════════════════════════════════════════

class _MetricRow extends StatelessWidget {
  final List<Widget> children;
  const _MetricRow({required this.children});

  @override
  Widget build(BuildContext context) => Row(
        children: children
            .map((c) => Expanded(child: c))
            .toList()
            .expand((w) => [w, const SizedBox(width: 10)])
            .toList()
          ..removeLast(),
      );
}

class _MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final String? badge;
  final Color? badgeColor;
  final IconData icon;
  final Color? color;

  const _MetricCard({
    required this.label,
    required this.value,
    this.badge,
    this.badgeColor,
    required this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? UltraTheme.textPrimary;
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(icon, size: 18, color: c),
            const Spacer(),
            if (badge != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: (badgeColor ?? Colors.grey).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(badge!,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: badgeColor ?? Colors.grey)),
              ),
          ]),
          const SizedBox(height: 10),
          Text(value,
              style: UltraTheme.titleLarge
                  .copyWith(fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(label,
              style: UltraTheme.bodyMedium
                  .copyWith(color: UltraTheme.textMuted, fontSize: 12)),
        ]),
    );
  }
}

class _CspRecruitmentCard extends StatelessWidget {
  final CspBreakdown breakdown;
  const _CspRecruitmentCard({required this.breakdown});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final rows = [
      (l10n.companyAnalyticsExecutivesRow, breakdown.executives),
      (l10n.companyAnalyticsForemenRow, breakdown.foremen),
      (l10n.companyAnalyticsWorkersFieldRow, breakdown.workers),
    ];
    final grandTotal = breakdown.total.total;

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                  child: Text(l10n.companyAnalyticsCategoryHeader,
                      style: UltraTheme.bodyMedium.copyWith(
                          color: UltraTheme.textMuted, fontSize: 12))),
              SizedBox(
                  width: 48,
                  child: Text(l10n.companyAnalyticsGenderColumnMale,
                      textAlign: TextAlign.center,
                      style: UltraTheme.bodyMedium.copyWith(
                          color: Colors.blue,
                          fontSize: 12,
                          fontWeight: FontWeight.w600))),
              SizedBox(
                  width: 48,
                  child: Text(l10n.companyAnalyticsGenderColumnFemale,
                      textAlign: TextAlign.center,
                      style: UltraTheme.bodyMedium.copyWith(
                          color: Colors.pink,
                          fontSize: 12,
                          fontWeight: FontWeight.w600))),
              SizedBox(
                  width: 48,
                  child: Text(l10n.total,
                      textAlign: TextAlign.center,
                      style: UltraTheme.bodyMedium.copyWith(
                          color: UltraTheme.textMuted, fontSize: 12))),
            ]),
            const Divider(height: 12),
            ...rows.map((r) =>
                _CspRow(label: r.$1, counts: r.$2, grandTotal: grandTotal)),
            const Divider(height: 12),
            Row(children: [
              Expanded(
                  child: Text(l10n.total,
                      style: UltraTheme.bodyMedium
                          .copyWith(fontWeight: FontWeight.w700))),
              SizedBox(
                  width: 48,
                  child: Text(breakdown.total.male.toString(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14))),
              SizedBox(
                  width: 48,
                  child: Text(breakdown.total.female.toString(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14))),
              SizedBox(
                  width: 48,
                  child: Text(breakdown.total.total.toString(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: UltraTheme.primary))),
            ]),
          ],
        ),
    );
  }
}

class _CspRow extends StatelessWidget {
  final String label;
  final CspGenderCount counts;
  final int grandTotal;
  const _CspRow(
      {required this.label, required this.counts, required this.grandTotal});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final pct = grandTotal > 0
        ? (counts.total / grandTotal * 100).toStringAsFixed(0)
        : '0';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: UltraTheme.bodyMedium.copyWith(fontSize: 13)),
          Text(l10n.companyAnalyticsPercentOfTotal(pct),
              style: UltraTheme.bodyMedium
                  .copyWith(fontSize: 11, color: UltraTheme.textMuted)),
        ])),
        SizedBox(
            width: 48,
            child: Text(counts.male.toString(),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13))),
        SizedBox(
            width: 48,
            child: Text(counts.female.toString(),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13))),
        SizedBox(
            width: 48,
            child: Text(counts.total.toString(),
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600))),
      ]),
    );
  }
}

class _DeparturesCard extends StatelessWidget {
  final BilanDepartures departures;
  const _DeparturesCard({required this.departures});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final rows = [
      (l10n.companyAnalyticsDismissals, departures.dismissals, Colors.red),
      (l10n.companyAnalyticsResignations, departures.resignations, Colors.orange),
      (l10n.companyAnalyticsRetirements, departures.retirements, Colors.teal),
      (l10n.companyAnalyticsOthers, departures.others, Colors.grey),
    ].where((r) => r.$2.total > 0).toList();

    if (rows.isEmpty) {
      return GlassCard(
        padding: const EdgeInsets.all(16),
        child: Text(l10n.companyAnalyticsNoDeparturesRecorded,
            style:
                UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted)),
      );
    }

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
          ...rows.map((r) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  Container(
                      width: 8,
                      height: 8,
                      decoration:
                          BoxDecoration(color: r.$3, shape: BoxShape.circle)),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Text(r.$1,
                          style: UltraTheme.bodyMedium.copyWith(fontSize: 13))),
                  Text('${l10n.companyAnalyticsGenderColumnMale}: ${r.$2.male}',
                      style: UltraTheme.bodyMedium
                          .copyWith(fontSize: 12, color: UltraTheme.textMuted)),
                  const SizedBox(width: 12),
                  Text('${l10n.companyAnalyticsGenderColumnFemale}: ${r.$2.female}',
                      style: UltraTheme.bodyMedium
                          .copyWith(fontSize: 12, color: UltraTheme.textMuted)),
                  const SizedBox(width: 12),
                  Text('${l10n.total}: ${r.$2.total}',
                      style: UltraTheme.bodyMedium
                          .copyWith(fontSize: 13, fontWeight: FontWeight.w600)),
                ]),
              )),
          const Divider(),
          Row(children: [
            Expanded(
                child: Text(l10n.companyAnalyticsTotalDepartures,
                    style: UltraTheme.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600))),
            Text(departures.total.total.toString(),
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: UltraTheme.primary)),
          ]),
        ]),
    );
  }
}

class _InternshipCard extends StatelessWidget {
  final BilanInternships internships;
  const _InternshipCard({required this.internships});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final rows = [
      (l10n.companyAnalyticsInternshipHoliday, internships.holiday),
      (l10n.companyAnalyticsInternshipAcademic, internships.academic),
      (l10n.companyAnalyticsInternshipProfessional, internships.professional),
      (l10n.companyAnalyticsInternshipPreWork, internships.preWork),
    ].where((r) => r.$2 > 0).toList();

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        ...rows.map((r) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                Expanded(
                    child: Text(r.$1,
                        style: UltraTheme.bodyMedium.copyWith(fontSize: 13))),
                Text(r.$2.toString(),
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600)),
              ]),
            )),
        const Divider(),
        Row(children: [
          Expanded(
              child: Text(l10n.companyAnalyticsTotalInterns,
                  style: UltraTheme.bodyMedium
                      .copyWith(fontWeight: FontWeight.w600))),
          Text(internships.total.toString(),
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: UltraTheme.primary)),
        ]),
      ]),
    );
  }
}

class _SkillsTrainingCard extends StatelessWidget {
  final List<SkillNeed> skillNeeds;
  final List<TrainingNeed> trainingNeeds;
  const _SkillsTrainingCard(
      {required this.skillNeeds, required this.trainingNeeds});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (skillNeeds.isNotEmpty) ...[
            Text(l10n.companyAnalyticsSkillNeeds,
                style: UltraTheme.bodyMedium.copyWith(
                    color: UltraTheme.textMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ...skillNeeds.map((s) => _SkillRow(
                index: s.index,
                label: s.description,
                color: UltraTheme.primary)),
          ],
          if (skillNeeds.isNotEmpty && trainingNeeds.isNotEmpty)
            const Divider(height: 20),
          if (trainingNeeds.isNotEmpty) ...[
            Text(l10n.companyAnalyticsTrainingNeeds,
                style: UltraTheme.bodyMedium.copyWith(
                    color: UltraTheme.textMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ...trainingNeeds.map((t) => _SkillRow(
                index: t.index, label: t.domain, color: Colors.indigo)),
          ],
        ],
      ),
    );
  }
}

class _SkillRow extends StatelessWidget {
  final int index;
  final String label;
  final Color color;
  const _SkillRow(
      {required this.index, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6)),
          child: Center(
              child: Text(index.toString(),
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: color))),
        ),
        const SizedBox(width: 10),
        Expanded(
            child: Text(label,
                style: UltraTheme.bodyMedium.copyWith(fontSize: 13))),
      ]),
    );
  }
}

class _InclusionInsightCard extends StatelessWidget {
  final BilanVulnerable vulnerable;
  final SimpleCount disabled;
  final int totalRecruitments;

  const _InclusionInsightCard({
    required this.vulnerable,
    required this.disabled,
    required this.totalRecruitments,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final inclPct = totalRecruitments > 0
        ? ((vulnerable.total + disabled.total) / totalRecruitments * 100)
            .toStringAsFixed(1)
        : '0';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.teal.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        border: Border.all(color: Colors.teal.withValues(alpha: 0.2)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.verified_outlined, color: Colors.teal.shade600, size: 22),
        const SizedBox(width: 12),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l10n.companyAnalyticsSocialImpact,
              style: UltraTheme.bodyMedium.copyWith(
                  fontWeight: FontWeight.w700, color: Colors.teal.shade700)),
          const SizedBox(height: 4),
          if (vulnerable.total > 0)
            Text(
                l10n.companyAnalyticsVulnerableWorkersRecruited(
                    vulnerable.total,
                    vulnerable.internalDisplaced.total,
                    vulnerable.refugees.total,
                    vulnerable.orphans.total),
                style: UltraTheme.bodyMedium.copyWith(fontSize: 13)),
          if (disabled.total > 0)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                  l10n.companyAnalyticsDisabledWorkersRecruited(disabled.total),
                  style: UltraTheme.bodyMedium.copyWith(fontSize: 13)),
            ),
          const SizedBox(height: 4),
          Text(
              l10n.companyAnalyticsPriorityProfilesShare(inclPct),
              style: UltraTheme.bodyMedium.copyWith(
                  fontSize: 12,
                  color: Colors.teal.shade600,
                  fontWeight: FontWeight.w500)),
        ])),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// LOCKED / ERROR / COMING SOON STATES  (both versions)
// ═══════════════════════════════════════════════════════════

class _LockedBenchmarkCard extends StatelessWidget {
  // hasBenchmarking now unlocks as soon as ONEFOP is submitted (see
  // computeOnefopFeatures), so this card is only ever reachable pre-
  // submission — there's no longer a distinct "submitted, awaiting
  // approval" state to show here, since that state already has real
  // benchmark content by the time it's reached.
  const _LockedBenchmarkCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return GlassCard(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Icon(Icons.lock_outline, size: 40, color: UltraTheme.textMuted),
          const SizedBox(height: 12),
          Text(l10n.companyAnalyticsBenchmarkLockedDefault,
              textAlign: TextAlign.center, style: UltraTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _LockedBilanView extends StatelessWidget {
  final String? status;
  const _LockedBilanView({this.status});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    IconData icon;
    String message;
    Color color;

    switch (status) {
      case 'SUBMITTED':
      case 'PENDING_REVIEW':
        icon = Icons.hourglass_top;
        message = l10n.companyAnalyticsBilanLockedUnderReview;
        color = UltraTheme.warning;
        break;
      case 'DRAFT':
        icon = Icons.edit_note;
        message = l10n.companyAnalyticsBilanLockedDraft;
        color = UltraTheme.info;
        break;
      case 'APPROVED':
        // The company has an approved submission, just not for the
        // currently-selected year (the year dropdown only ever offers
        // years that do have one, so this is a transient/edge case,
        // e.g. while bilanAvailableYearsProvider is still loading).
        icon = Icons.event_busy_outlined;
        message = l10n.companyAnalyticsBilanLockedWrongYear;
        color = UltraTheme.textMuted;
        break;
      default:
        icon = Icons.lock_outline;
        message = l10n.companyAnalyticsBilanLockedDefault;
        color = UltraTheme.textMuted;
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 56, color: color),
          const SizedBox(height: 16),
          Text(message,
              textAlign: TextAlign.center,
              style: UltraTheme.bodyMedium.copyWith(height: 1.5)),
        ]),
      ),
    );
  }
}

class _InsufficientDataCard extends StatelessWidget {
  final int peerCount;
  final int minRequired;
  const _InsufficientDataCard(
      {required this.peerCount, required this.minRequired});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return GlassCard(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Icon(Icons.bar_chart, size: 40, color: UltraTheme.textMuted),
          const SizedBox(height: 12),
          Text(l10n.companyAnalyticsInsufficientDataTitle,
              textAlign: TextAlign.center,
              style:
                  UltraTheme.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(
              l10n.companyAnalyticsInsufficientDataDetail(peerCount, minRequired),
              textAlign: TextAlign.center,
              style: UltraTheme.bodyMedium
                  .copyWith(fontSize: 12)
                  .copyWith(color: UltraTheme.textMuted)),
        ],
      ),
    );
  }
}

class _NoOwnDataCard extends StatelessWidget {
  final int year;
  const _NoOwnDataCard({required this.year});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return GlassCard(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Icon(Icons.fact_check_outlined,
              size: 40, color: UltraTheme.textMuted),
          const SizedBox(height: 12),
          Text(l10n.companyAnalyticsNoOwnDataTitle,
              textAlign: TextAlign.center,
              style:
                  UltraTheme.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(
              l10n.companyAnalyticsNoOwnDataDetail(year),
              textAlign: TextAlign.center,
              style: UltraTheme.bodyMedium
                  .copyWith(fontSize: 12)
                  .copyWith(color: UltraTheme.textMuted)),
        ],
      ),
    );
  }
}

class _ComingSoonView extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final String badgeLabel;

  const _ComingSoonView({
    required this.icon,
    required this.title,
    required this.description,
    required this.badgeLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: UltraTheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(badgeLabel,
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: UltraTheme.primary)),
          ),
          const SizedBox(height: 16),
          Icon(icon, size: 48, color: UltraTheme.textMuted),
          const SizedBox(height: 12),
          Text(title,
              style:
                  UltraTheme.titleMedium.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(description,
              textAlign: TextAlign.center,
              style: UltraTheme.bodyMedium
                  .copyWith(color: UltraTheme.textMuted, height: 1.5)),
        ]),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  const _ErrorView({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Row(children: [
          const Icon(Icons.error_outline, color: UltraTheme.error),
          const SizedBox(width: 12),
          Expanded(
              child: Text(message,
                  style:
                      const TextStyle(color: UltraTheme.error, fontSize: 13))),
        ]),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// SHIMMER PLACEHOLDERS
// ═══════════════════════════════════════════════════════════

class _ShimmerBenchmarkFull extends StatelessWidget {
  const _ShimmerBenchmarkFull();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: List.generate(
          3,
          (_) => const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: _ShimmerCard(height: 120, borderRadius: 16),
              )),
    );
  }
}

class _ShimmerBilan extends StatelessWidget {
  const _ShimmerBilan();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: List.generate(
          5,
          (_) => const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: _ShimmerCard(height: 80, borderRadius: 12),
              )),
    );
  }
}

/// Animated shimmer card
class _ShimmerCard extends StatelessWidget {
  final double height;
  final double borderRadius;
  const _ShimmerCard({required this.height, required this.borderRadius});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: UltraTheme.softShadow,
      ),
      child: const _ShimmerLoading(),
    );
  }
}

class _ShimmerLoading extends StatefulWidget {
  const _ShimmerLoading();

  @override
  State<_ShimmerLoading> createState() => __ShimmerLoadingState();
}

class __ShimmerLoadingState extends State<_ShimmerLoading>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Colors.grey.shade200,
                Colors.grey.shade50,
                Colors.grey.shade200,
              ],
              stops: [0.0, _animation.value, 1.0],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        );
      },
    );
  }
}
