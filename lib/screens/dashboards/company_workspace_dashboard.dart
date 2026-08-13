// lib/screens/dashboards/company_workspace_dashboard.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:async' show Timer;
import 'dart:math' show pi;
import '../../core/i18n/l10n_ext.dart';
import '../../theme/ultra_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/responsive_helpers.dart';
import '../../providers/auth_provider.dart';
import '../../data/api_client.dart';
import '../campaign/campaign_constants.dart'
    show submissionStatusLabels, campaignTypeLabels, collectionTypeLabels;

// ═══════════════════════════════════════════════════════════
// PROVIDERS — wired to backend
// ═══════════════════════════════════════════════════════════

final companyWorkspaceProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiClientProvider);
  final user = ref.read(authProvider).value;

  final results = await Future.wait([
    api.getMyCompany(),
    api.getDeclarations(),
    api.getActiveCampaigns(),
  ]);

  final company = results[0] as Map<String, dynamic>?;
  final declarations = results[1] as List<dynamic>? ?? [];
  final activeCampaigns = results[2] as List<dynamic>? ?? [];

  final submittedCount = declarations
      .where((d) => ['SUBMITTED', 'DIVISION_APPROVED', 'REGION_APPROVED']
          .contains(d['status']))
      .length;
  final approvedCount =
      declarations.where((d) => d['status'] == 'FINAL_APPROVED').length;
  final pendingCount =
      declarations.where((d) => d['status'] == 'SUBMITTED').length;
  final draftCount = declarations.where((d) => d['status'] == 'DRAFT').length;

  DateTime? lastUpdated;
  if (declarations.isNotEmpty) {
    final dates = declarations
        .where((d) => d['updatedAt'] != null || d['submittedAt'] != null)
        .map((d) =>
            DateTime.tryParse(d['updatedAt'] ?? d['submittedAt'] ?? '') ??
            DateTime(1970))
        .toList();
    if (dates.isNotEmpty) {
      dates.sort((a, b) => b.compareTo(a));
      lastUpdated = dates.first;
    }
  }

  final onefopStatus = user?.features.onefopSubmissionStatus;
  final onefopSurveyYear = user?.features.onefopSurveyYear;
  final onefopSubmissionDate = user?.features.onefopSubmissionDate;
  final hasDraft = user?.features.onefopHasDraft ?? false;

  return {
    'company': company,
    'totalWorkers': company?['totalEmployees'] ?? 0,
    'declarationsFiled': declarations.length,
    'submittedCount': submittedCount,
    'approvedCount': approvedCount,
    'pendingCount': pendingCount,
    'draftCount': draftCount,
    'lastUpdated': lastUpdated,
    'onefopStatus': onefopStatus,
    'onefopSurveyYear': onefopSurveyYear,
    'onefopSubmissionDate': onefopSubmissionDate,
    'hasOnefopDraft': hasDraft,
    'declarations': declarations,
    'activeCampaigns': activeCampaigns,
  };
});

// ═══════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════

class CompanyWorkspaceDashboard extends ConsumerWidget {
  final VoidCallback? onNewSubmission;
  final VoidCallback? onViewAll;

  const CompanyWorkspaceDashboard({
    super.key,
    this.onNewSubmission,
    this.onViewAll,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(companyWorkspaceProvider);

    return asyncData.when(
      data: (data) => _buildContent(context, data),
      loading: () => _buildShimmerLoading(context),
      error: (e, _) => _buildError(context, ref, e.toString()),
    );
  }

  Widget _buildContent(BuildContext context, Map<String, dynamic> data) {
    final company = data['company'] as Map<String, dynamic>?;
    final totalWorkers = data['totalWorkers'] as int;
    final declarationsFiled = data['declarationsFiled'] as int;
    final pendingCount = data['pendingCount'] as int;
    final approvedCount = data['approvedCount'] as int;
    final lastUpdated = data['lastUpdated'] as DateTime?;
    final onefopStatus = data['onefopStatus'] as String?;
    final onefopSurveyYear = data['onefopSurveyYear'] as int?;
    final hasOnefopDraft = data['hasOnefopDraft'] as bool;
    final activeCampaigns = data['activeCampaigns'] as List<dynamic>? ?? [];

    final onefopDisplay = _formatOnefopStatus(
        context, onefopStatus, onefopSurveyYear, hasOnefopDraft);
    final mobile = context.isMobile;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (activeCampaigns.isNotEmpty) ...[
            _buildActiveCampaigns(context, activeCampaigns, onNewSubmission),
            const SizedBox(height: 24),
          ],
          _buildHeroCard(context, totalWorkers, declarationsFiled, lastUpdated,
              mobile, onNewSubmission),
          const SizedBox(height: 24),
          _buildKpiRow(context, mobile, declarationsFiled, pendingCount,
              approvedCount, onefopDisplay),
          const SizedBox(height: 24),
          if (mobile)
            Column(
              children: [
                _buildRecentActivity(context, data),
                const SizedBox(height: 24),
                _buildWorkforceByGender(context, company, totalWorkers),
              ],
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 3, child: _buildRecentActivity(context, data)),
                const SizedBox(width: 24),
                Expanded(
                    flex: 2,
                    child: _buildWorkforceByGender(
                        context, company, totalWorkers)),
              ],
            ),
        ],
      ),
    );
  }

  // ── Active campaigns ─────────────────────────────────────

  Widget _buildActiveCampaigns(BuildContext context,
      List<dynamic> campaigns, VoidCallback? onNewSubmission) {
    const spacing = 16.0;
    final mobile = context.isMobile;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.l10n.activeCampaignsTitle, style: UltraTheme.titleMedium),
        const SizedBox(height: 12),
        if (mobile)
          for (final c in campaigns)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _CampaignCard(
                campaign: c as Map<String, dynamic>,
                onNewSubmission: onNewSubmission,
              ),
            )
        else
          // Cards are capped at half the row's width rather than divided by
          // count, so two fit side by side and a single active campaign
          // still sits at half width instead of stretching the full line.
          LayoutBuilder(
            builder: (context, constraints) {
              final cardWidth = (constraints.maxWidth - spacing) / 2;
              return Wrap(
                spacing: spacing,
                runSpacing: spacing,
                children: [
                  for (final c in campaigns)
                    SizedBox(
                      width: cardWidth,
                      child: _CampaignCard(
                        campaign: c as Map<String, dynamic>,
                        onNewSubmission: onNewSubmission,
                      ),
                    ),
                ],
              );
            },
          ),
      ],
    );
  }

  // ── Hero card ────────────────────────────────────────────

  Widget _buildHeroCard(BuildContext context, int totalWorkers,
      int activeDeclarations, DateTime? lastUpdated, bool mobile,
      VoidCallback? onNewSubmission) {
    final l10n = context.l10n;
    String lastUpdatedText;
    if (lastUpdated != null) {
      final now = DateTime.now();
      final diff = now.difference(lastUpdated);
      if (diff.inDays == 0) {
        lastUpdatedText = l10n.updatedToday;
      } else if (diff.inDays == 1) {
        lastUpdatedText = l10n.updatedYesterday;
      } else {
        lastUpdatedText = l10n.updatedDaysAgo(diff.inDays);
      }
    } else {
      lastUpdatedText = l10n.noDeclarationsYet;
    }

    final stats = Row(
      children: [
        Container(
          width: 4,
          height: 56,
          decoration: BoxDecoration(
            color: UltraTheme.primary,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.workersCurrentlyDeclared, style: UltraTheme.labelLarge),
              const SizedBox(height: 6),
              Text('$totalWorkers',
                  style: UltraTheme.displayLarge.copyWith(fontSize: 32),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
              const SizedBox(height: 6),
              Text(
                  l10n.activeDeclarationsCount(
                      activeDeclarations, lastUpdatedText),
                  style: UltraTheme.bodyMedium),
            ],
          ),
        ),
      ],
    );

    final ctaButton = onNewSubmission == null
        ? null
        : ElevatedButton.icon(
            onPressed: onNewSubmission,
            icon: const Icon(Icons.add_rounded, size: 18),
            label: Text(l10n.newDeclarationCta),
            style: ElevatedButton.styleFrom(
              backgroundColor: UltraTheme.primary,
              foregroundColor: Colors.white,
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            ),
          );

    return GlassCard(
      padding: const EdgeInsets.all(20),
      child: mobile
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                stats,
                if (ctaButton != null) ...[
                  const SizedBox(height: 16),
                  SizedBox(width: double.infinity, child: ctaButton),
                ],
              ],
            )
          : Row(
              children: [
                Expanded(child: stats),
                if (ctaButton != null) ...[
                  const SizedBox(width: 20),
                  ctaButton,
                ],
              ],
            ),
    );
  }

  // ── KPI row ──────────────────────────────────────────────

  Widget _buildKpiRow(BuildContext context, bool mobile, int declarationsFiled,
      int pendingCount, int approvedCount, Map<String, dynamic> onefopDisplay) {
    final l10n = context.l10n;
    final declarationProgress = declarationsFiled > 0
        ? (approvedCount / declarationsFiled).clamp(0.0, 1.0)
        : 0.0;
    final pendingProgress = declarationsFiled > 0
        ? (pendingCount / declarationsFiled).clamp(0.0, 1.0)
        : 0.0;

    // Declarations-filed and Awaiting-approval are both plain DSMO counts —
    // same shape, so they pair naturally at half width. ONEFOP status keeps
    // its own full-width row: its value is a status word (e.g. "Corrections
    // requises"), not a number, and it's the most action-critical of the
    // three, so it shouldn't be squeezed down to match the others.
    Widget declarationsCard(bool compact) => _kpiCard(
          title: l10n.declarationsFiledTitle,
          value: '$declarationsFiled',
          valueColor: UltraTheme.textPrimary,
          subtitle: l10n.approvedCountSubtitle(approvedCount),
          subtitleColor: UltraTheme.success,
          progress: declarationProgress.toDouble(),
          progressColor: UltraTheme.primary,
          valueFontSize: compact ? 20 : 28,
          compact: compact,
        );

    Widget pendingCard(bool compact) => _kpiCard(
          title: l10n.awaitingApprovalTitle,
          value: '$pendingCount',
          valueColor: UltraTheme.textPrimary,
          subtitle: pendingCount > 0 ? l10n.underReview : l10n.allUpToDate,
          subtitleColor: UltraTheme.textSecondary,
          progress: pendingProgress.toDouble(),
          progressColor: UltraTheme.warning,
          valueFontSize: compact ? 20 : 28,
          compact: compact,
        );

    final onefopCard = _kpiCard(
      title: onefopDisplay['title'] as String,
      value: onefopDisplay['value'] as String,
      valueColor: onefopDisplay['color'] as Color,
      subtitle: onefopDisplay['subtitle'] as String,
      subtitleColor: onefopDisplay['color'] as Color,
      progress: onefopDisplay['progress'] as double,
      progressColor: onefopDisplay['color'] as Color,
      valueFontSize: 24,
    );

    if (mobile) {
      return Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: declarationsCard(true)),
              const SizedBox(width: 12),
              Expanded(child: pendingCard(true)),
            ],
          ),
          const SizedBox(height: 12),
          onefopCard,
        ],
      );
    }

    return Row(
      children: [
        Expanded(child: declarationsCard(false)),
        const SizedBox(width: 16),
        Expanded(child: pendingCard(false)),
        const SizedBox(width: 16),
        Expanded(child: onefopCard),
      ],
    );
  }

  Widget _kpiCard({
    required String title,
    required String value,
    required Color valueColor,
    required String subtitle,
    required Color subtitleColor,
    required double progress,
    required Color progressColor,
    double valueFontSize = 28,
    bool compact = false,
  }) {
    return GlassCard(
      padding: EdgeInsets.all(compact ? 14 : 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: UltraTheme.labelLarge
                  .copyWith(fontSize: compact ? 11 : null),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          SizedBox(height: compact ? 8 : 12),
          Text(value,
              style: UltraTheme.displayLarge
                  .copyWith(fontSize: valueFontSize, color: valueColor)),
          SizedBox(height: compact ? 4 : 8),
          Text(subtitle,
              style: UltraTheme.bodyMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: subtitleColor,
                  fontSize: compact ? 11 : null),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          SizedBox(height: compact ? 8 : 12),
          Container(
            height: compact ? 3 : 4,
            decoration: BoxDecoration(
                color: UltraTheme.background,
                borderRadius: BorderRadius.circular(2)),
            child: FractionallySizedBox(
              widthFactor: progress,
              child: Container(
                decoration: BoxDecoration(
                    color: progressColor, borderRadius: BorderRadius.circular(2)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── ONEFOP status formatter ──────────────────────────────

  Map<String, dynamic> _formatOnefopStatus(
      BuildContext context, String? status, int? surveyYear, bool hasDraft) {
    final l10n = context.l10n;
    final year = surveyYear ?? DateTime.now().year;
    switch (status) {
      case 'APPROVED':
        return {
          'title': 'ONEFOP $year',
          'value': l10n.onefopApproved,
          'subtitle': l10n.onefopValidatedSubtitle,
          'color': UltraTheme.success,
          'progress': 1.0,
        };
      case 'PENDING_REVIEW':
        return {
          'title': 'ONEFOP $year',
          'value': l10n.onefopUnderReview,
          'subtitle': l10n.onefopPendingMinefopSubtitle,
          'color': UltraTheme.warning,
          'progress': 0.7,
        };
      case 'REJECTED':
        return {
          'title': 'ONEFOP $year',
          'value': l10n.onefopRejected,
          'subtitle': l10n.onefopCorrectionsRequiredSubtitle,
          'color': UltraTheme.error,
          'progress': 0.3,
        };
      case 'CORRECTION_REQUESTED':
        return {
          'title': 'ONEFOP $year',
          'value': l10n.onefopCorrections,
          'subtitle': l10n.onefopModificationsRequestedSubtitle,
          'color': UltraTheme.warning,
          'progress': 0.5,
        };
      case 'DRAFT':
      default:
        if (hasDraft) {
          return {
            'title': 'ONEFOP $year',
            'value': l10n.onefopDraft,
            'subtitle': l10n.onefopFinalizeSubtitle,
            'color': UltraTheme.info,
            'progress': 0.4,
          };
        }
        return {
          'title': 'ONEFOP $year',
          'value': l10n.onefopNotSubmitted,
          'subtitle': l10n.onefopRequiredSubtitle,
          'color': UltraTheme.textMuted,
          'progress': 0.0,
        };
    }
  }

  /// Builds the Recent Activity entry for the company's ONEFOP submission,
  /// mirroring the DSMO status→label mapping above. Returns null when
  /// there's no submitted/approved/rejected ONEFOP record to show (a bare
  /// draft, or nothing at all) — mirrors `_formatOnefopStatus`'s DRAFT
  /// handling by only surfacing entries reviewers actually acted on.
  (DateTime, _ActivityItem)? _onefopActivityItem(
      BuildContext context, Map<String, dynamic> data) {
    final l10n = context.l10n;
    final status = data['onefopStatus'] as String?;
    if (status == null) return null;
    final year = data['onefopSurveyYear'] as int? ?? DateTime.now().year;
    final date = data['onefopSubmissionDate'] as DateTime?;
    final dateStr = date != null
        ? '${date.day}/${date.month}/${date.year}'
        : l10n.dateUnknown;
    final sortDate = date ?? DateTime.fromMillisecondsSinceEpoch(0);

    switch (status) {
      case 'APPROVED':
        return (
          sortDate,
          _ActivityItem(l10n.onefopApprovedActivity(year), l10n.validatedByMinefop,
              dateStr, Icons.check_circle_outlined, UltraTheme.success,
              l10n.onefopApproved)
        );
      case 'PENDING_REVIEW':
        return (
          sortDate,
          _ActivityItem(l10n.onefopSubmittedActivity(year), l10n.pendingMinefop,
              dateStr, Icons.outbound, UltraTheme.warning, l10n.onefopUnderReview)
        );
      case 'REJECTED':
        return (
          sortDate,
          _ActivityItem(l10n.onefopRejectedActivity(year), l10n.correctionsRequired,
              dateStr, Icons.cancel_outlined, UltraTheme.error, l10n.onefopRejected)
        );
      case 'CORRECTION_REQUESTED':
        return (
          sortDate,
          _ActivityItem(l10n.onefopToCorrectActivity(year), l10n.modificationsRequested,
              dateStr, Icons.pending_actions, UltraTheme.warning, l10n.onefopCorrections)
        );
      default:
        return null;
    }
  }

  // ── Recent activity (✅ button always enabled) ─────────────────────────

  Widget _buildRecentActivity(BuildContext context, Map<String, dynamic> data) {
    final l10n = context.l10n;
    final declarations = (data['declarations'] as List<dynamic>?) ?? [];
    // (sortDate, item) pairs so DSMO and ONEFOP entries can be merged and
    // ranked together by actual recency before formatting/truncating —
    // ONEFOP submissions used to be entirely absent from this feed since
    // it only ever read `declarations` (DSMO).
    final dated = <(DateTime, _ActivityItem)>[];

    for (final decl in declarations) {
      final status = decl['status'] as String? ?? 'UNKNOWN';
      final year = decl['year'] as int? ?? DateTime.now().year;
      final rawDate = decl['submittedAt'] ?? decl['updatedAt'];
      final updatedAt =
          rawDate != null ? DateTime.tryParse(rawDate as String) : null;
      final dateStr = updatedAt != null
          ? '${updatedAt.day}/${updatedAt.month}/${updatedAt.year}'
          : l10n.dateUnknown;
      final sortDate = updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0);

      switch (status) {
        case 'FINAL_APPROVED':
          dated.add((
            sortDate,
            _ActivityItem(
                l10n.dsmoApprovedTitle(year),
                l10n.dsmoApprovedSubtitle,
                dateStr,
                Icons.check_circle_outlined,
                UltraTheme.success,
                l10n.dsmoApprovedBadge)
          ));
          break;
        case 'REGION_APPROVED':
          dated.add((
            sortDate,
            _ActivityItem(
                l10n.dsmoPendingFinalTitle(year),
                l10n.dsmoPendingFinalSubtitle,
                dateStr,
                Icons.access_time,
                UltraTheme.warning,
                l10n.dsmoPendingFinalBadge)
          ));
          break;
        case 'DIVISION_APPROVED':
          dated.add((
            sortDate,
            _ActivityItem(
                l10n.dsmoDivisionReviewTitle(year),
                l10n.dsmoDivisionReviewSubtitle,
                dateStr,
                Icons.pending_actions,
                UltraTheme.info,
                l10n.dsmoDivisionReviewBadge)
          ));
          break;
        case 'SUBMITTED':
          dated.add((
            sortDate,
            _ActivityItem(
                l10n.dsmoSubmittedTitle(year),
                l10n.dsmoSubmittedSubtitle,
                dateStr,
                Icons.outbound,
                UltraTheme.info,
                l10n.dsmoSubmittedBadge)
          ));
          break;
        case 'DRAFT':
          dated.add((
            sortDate,
            _ActivityItem(
                l10n.dsmoDraftTitle(year),
                l10n.dsmoDraftSubtitle,
                dateStr,
                Icons.drafts_outlined,
                UltraTheme.textMuted,
                l10n.dsmoDraftBadge)
          ));
          break;
        case 'REJECTED':
          dated.add((
            sortDate,
            _ActivityItem(
                l10n.dsmoRejectedTitle(year),
                l10n.dsmoRejectedSubtitle,
                dateStr,
                Icons.cancel_outlined,
                UltraTheme.error,
                l10n.dsmoRejectedBadge)
          ));
          break;
      }
    }

    final onefopItem = _onefopActivityItem(context, data);
    if (onefopItem != null) dated.add(onefopItem);

    dated.sort((a, b) => b.$1.compareTo(a.$1));
    final activities = dated.take(4).map((e) => e.$2).toList();

    if (activities.isEmpty) {
      activities.add(_ActivityItem(
        l10n.noDeclarationsTitle,
        l10n.noDeclarationsSubtitle,
        '',
        Icons.folder_open_outlined,
        UltraTheme.textMuted,
        l10n.emptyBadge,
      ));
    }

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(l10n.recentActivityTitle,
                    style: UltraTheme.titleLarge.copyWith(fontSize: 16),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ),
              TextButton(
                onPressed: onViewAll, // ✅ Always enabled
                child: Text(
                  l10n.viewAllLink,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: onViewAll != null
                        ? UltraTheme.primary
                        : UltraTheme.textMuted,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...activities.map((a) => _buildActivityRow(a)),
        ],
      ),
    );
  }

  Widget _buildActivityRow(_ActivityItem activity) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: activity.iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            ),
            child: Icon(activity.icon, color: activity.iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(activity.title,
                    style: UltraTheme.bodyMedium.copyWith(
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.textPrimary)),
                const SizedBox(height: 2),
                Text(activity.subtitle, style: UltraTheme.labelMedium),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(activity.date,
                  style: UltraTheme.labelMedium.copyWith(fontSize: 11)),
              const SizedBox(height: 4),
              StatusBadge(label: activity.status, color: activity.iconColor),
            ],
          ),
        ],
      ),
    );
  }

  // ── Workforce by gender ───────────────────────────────────

  Widget _buildWorkforceByGender(
      BuildContext context, Map<String, dynamic>? company, int totalWorkers) {
    final l10n = context.l10n;
    final menCount = company?['menCount'] as int?;
    final womenCount = company?['womenCount'] as int?;
    final hasGenderData =
        menCount != null && womenCount != null && (menCount + womenCount) > 0;

    final segments = hasGenderData
        ? [
            _GenderSegment(l10n.menLabel, menCount, UltraTheme.primary),
            _GenderSegment(l10n.womenLabel, womenCount, UltraTheme.accent),
          ]
        : <_GenderSegment>[];

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.genderDistributionTitle,
              style: UltraTheme.titleLarge.copyWith(fontSize: 16)),
          const SizedBox(height: 16),
          Center(
            child: SizedBox(
              width: 130,
              height: 130,
              child: CustomPaint(
                painter: _DonutChartPainter(
                  hasGenderData
                      ? segments.map((s) => s.count.toDouble()).toList()
                      : [1.0],
                  hasGenderData
                      ? segments.map((s) => s.color).toList()
                      : [UltraTheme.textMuted],
                ),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('$totalWorkers',
                          style:
                              UltraTheme.displayLarge.copyWith(fontSize: 22)),
                      Text(l10n.employeesLabel,
                          style: UltraTheme.labelMedium.copyWith(fontSize: 11)),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (hasGenderData)
            ...segments.map((s) => _buildGenderRow(s, menCount + womenCount))
          else
            Text(
              l10n.genderDistributionUnavailable,
              style: UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted),
            ),
        ],
      ),
    );
  }

  Widget _buildGenderRow(_GenderSegment segment, int total) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: segment.color,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 3,
            child: Text(segment.name,
                overflow: TextOverflow.ellipsis,
                style: UltraTheme.bodyMedium.copyWith(
                    fontWeight: FontWeight.w500,
                    color: UltraTheme.textPrimary)),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: LinearProgressIndicator(
              value: total > 0 ? segment.count / total : 0,
              backgroundColor: UltraTheme.background,
              valueColor: AlwaysStoppedAnimation<Color>(segment.color),
              minHeight: 6,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 32,
            child: Text('${segment.count}',
                textAlign: TextAlign.right,
                style: UltraTheme.bodyMedium.copyWith(
                    fontWeight: FontWeight.w600,
                    color: UltraTheme.textPrimary)),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SHIMMER LOADING
  // ═══════════════════════════════════════════════════════════

  Widget _buildShimmerLoading(BuildContext context) {
    final mobile = context.isMobile;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildShimmerCard(height: 140, borderRadius: 24),
          const SizedBox(height: 24),
          if (mobile)
            Column(
              children: [
                Row(
                  children: [
                    Expanded(
                        child:
                            _buildShimmerCard(height: 130, borderRadius: 16)),
                    const SizedBox(width: 12),
                    Expanded(
                        child:
                            _buildShimmerCard(height: 130, borderRadius: 16)),
                  ],
                ),
                const SizedBox(height: 12),
                _buildShimmerCard(height: 160, borderRadius: 20),
              ],
            )
          else
            Row(
              children: [
                Expanded(
                    child: _buildShimmerCard(height: 160, borderRadius: 20)),
                const SizedBox(width: 16),
                Expanded(
                    child: _buildShimmerCard(height: 160, borderRadius: 20)),
                const SizedBox(width: 16),
                Expanded(
                    child: _buildShimmerCard(height: 160, borderRadius: 20)),
              ],
            ),
          const SizedBox(height: 24),
          if (mobile)
            Column(
              children: [
                _buildShimmerCard(height: 320, borderRadius: 20),
                const SizedBox(height: 24),
                _buildShimmerCard(height: 320, borderRadius: 20),
              ],
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                    child: _buildShimmerCard(height: 320, borderRadius: 20)),
                const SizedBox(width: 24),
                Expanded(
                    child: _buildShimmerCard(height: 320, borderRadius: 20)),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildShimmerCard(
      {required double height, required double borderRadius}) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: UltraTheme.softShadow,
      ),
      child: const ShimmerLoading(),
    );
  }

  Widget _buildError(BuildContext context, WidgetRef ref, String message) {
    return Center(
      child: Container(
        margin: const EdgeInsets.all(32),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: UltraTheme.surface,
          borderRadius: BorderRadius.circular(UltraTheme.radiusXL),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: UltraTheme.error),
            const SizedBox(height: 16),
            Text(context.l10n.loadingErrorTitle, style: UltraTheme.titleLarge),
            const SizedBox(height: 8),
            Text(message,
                textAlign: TextAlign.center, style: UltraTheme.bodyMedium),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                ref.invalidate(companyWorkspaceProvider);
              },
              style: ElevatedButton.styleFrom(
                  backgroundColor: UltraTheme.primary,
                  foregroundColor: Colors.white),
              child: Text(context.l10n.retry),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// SHIMMER LOADING ANIMATION
// ═══════════════════════════════════════════════════════════

class ShimmerLoading extends StatefulWidget {
  const ShimmerLoading({super.key});

  @override
  State<ShimmerLoading> createState() => _ShimmerLoadingState();
}

class _ShimmerLoadingState extends State<ShimmerLoading>
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
              stops: [
                0.0,
                _animation.value,
                1.0,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ACTIVE CAMPAIGN CARD — ticks its own countdown clock
// ═══════════════════════════════════════════════════════════

class _CampaignCard extends StatefulWidget {
  final Map<String, dynamic> campaign;
  final VoidCallback? onNewSubmission;

  const _CampaignCard({required this.campaign, this.onNewSubmission});

  @override
  State<_CampaignCard> createState() => _CampaignCardState();
}

class _CampaignCardState extends State<_CampaignCard> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final campaign = widget.campaign;
    final mySubmission = campaign['mySubmission'] as String? ?? 'NOT_STARTED';
    final isDone = mySubmission == 'SUBMITTED' || mySubmission == 'VALIDATED';
    final statusColor = isDone ? UltraTheme.success : UltraTheme.warning;
    final type = campaign['type'] as String?;
    final collectionType = campaign['collectionType'] as String?;
    final startDate =
        DateTime.tryParse(campaign['startDate']?.toString() ?? '');
    final deadline = DateTime.tryParse(campaign['deadline']?.toString() ?? '');

    return GlassCard(
      padding: const EdgeInsets.all(20),
      onTap: isDone ? null : widget.onNewSubmission,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: (isDone ? UltraTheme.success : UltraTheme.primary)
                      .withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  isDone ? Icons.check_circle_outline : Icons.campaign_outlined,
                  color: isDone ? UltraTheme.success : UltraTheme.primary,
                ),
              ),
              const SizedBox(width: 16),
              // Title gets the full remaining row width (the status badge
              // used to compete with it here, which on a phone-width card
              // could squeeze the title's available width down to less than
              // a single word — forcing mid-word character breaks instead
              // of wrapping at spaces). Badge now sits below the title.
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      campaign['name'] as String? ?? context.l10n.campaignFallbackName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: UltraTheme.bodyLarge.copyWith(
                        fontWeight: FontWeight.w700,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Chip(
                        label: Text(
                          submissionStatusLabels[mySubmission]?.of(context.loc) ??
                              mySubmission,
                          style: TextStyle(fontSize: 11, color: statusColor),
                        ),
                        backgroundColor: statusColor.withValues(alpha: 0.1),
                        visualDensity: VisualDensity.compact,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              if (type != null)
                _tag(Icons.repeat_rounded,
                    campaignTypeLabels[type]?.of(context.loc) ?? type),
              if (collectionType != null)
                _tag(Icons.description_outlined,
                    collectionTypeLabels[collectionType]?.of(context.loc) ??
                        collectionType),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            context.l10n.periodLabel(_formatPeriod(startDate, deadline)),
            style: UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted),
          ),
          const SizedBox(height: 10),
          _buildCountdown(deadline),
        ],
      ),
    );
  }

  Widget _tag(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: UltraTheme.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: UltraTheme.primary),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: UltraTheme.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  String _formatPeriod(DateTime? start, DateTime? end) {
    String fmt(DateTime d) =>
        '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
    if (start != null && end != null) return '${fmt(start)} → ${fmt(end)}';
    if (end != null) return context.l10n.periodUntil(fmt(end));
    if (start != null) return context.l10n.periodSince(fmt(start));
    return context.l10n.periodUndefined;
  }

  Widget _buildCountdown(DateTime? deadline) {
    final l10n = context.l10n;
    if (deadline == null) {
      return Text(
        l10n.deadlineUndefined,
        style: UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted),
      );
    }

    final remaining = deadline.difference(DateTime.now());
    if (remaining.isNegative) {
      return Row(
        children: [
          const Icon(Icons.timer_off_outlined,
              size: 16, color: UltraTheme.error),
          const SizedBox(width: 6),
          Text(
            l10n.deadlinePassed,
            style: UltraTheme.bodyMedium
                .copyWith(color: UltraTheme.error, fontWeight: FontWeight.w600),
          ),
        ],
      );
    }

    String two(int n) => n.toString().padLeft(2, '0');
    final days = remaining.inDays;
    final hours = remaining.inHours % 24;
    final minutes = remaining.inMinutes % 60;
    final seconds = remaining.inSeconds % 60;
    final dayAbbrev = l10n.localeName == 'en' ? 'd' : 'j';
    final clock = days > 0
        ? '$days$dayAbbrev ${two(hours)}:${two(minutes)}:${two(seconds)}'
        : '${two(hours)}:${two(minutes)}:${two(seconds)}';

    return Row(
      children: [
        const Icon(Icons.timer_outlined, size: 16, color: UltraTheme.primary),
        const SizedBox(width: 6),
        Text(
          clock,
          style: const TextStyle(
            fontFamily: 'monospace',
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: UltraTheme.textPrimary,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(width: 6),
        Text(l10n.remainingLabel,
            style: UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted)),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// DATA CLASSES
// ═══════════════════════════════════════════════════════════

class _ActivityItem {
  final String title;
  final String subtitle;
  final String date;
  final IconData icon;
  final Color iconColor;
  final String status;
  _ActivityItem(this.title, this.subtitle, this.date, this.icon, this.iconColor,
      this.status);
}

class _GenderSegment {
  final String name;
  final int count;
  final Color color;
  _GenderSegment(this.name, this.count, this.color);
}

// ═══════════════════════════════════════════════════════════
// DONUT CHART PAINTER
// ═══════════════════════════════════════════════════════════

class _DonutChartPainter extends CustomPainter {
  final List<double> values;
  final List<Color> colors;

  _DonutChartPainter(this.values, this.colors);

  @override
  void paint(Canvas canvas, Size size) {
    final total = values.reduce((a, b) => a + b);
    if (total <= 0) return;
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    final strokeWidth = radius * 0.3;
    double startAngle = -pi / 2;

    for (int i = 0; i < values.length; i++) {
      final sweepAngle = (values[i] / total) * 2 * pi;
      final paint = Paint()
        ..color = colors[i]
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius - strokeWidth / 2),
        startAngle,
        sweepAngle,
        false,
        paint,
      );
      startAngle += sweepAngle;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
