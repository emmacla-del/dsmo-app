// lib/screens/dashboards/company_workspace_dashboard.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:math' show pi;
import '../../theme/ultra_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../providers/auth_provider.dart';
import '../../data/api_client.dart';

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
  ]);

  final company = results[0] as Map<String, dynamic>?;
  final declarations = results[1] as List<dynamic>? ?? [];

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
    'hasOnefopDraft': hasDraft,
    'declarations': declarations,
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
    final totalWorkers = data['totalWorkers'] as int;
    final declarationsFiled = data['declarationsFiled'] as int;
    final pendingCount = data['pendingCount'] as int;
    final approvedCount = data['approvedCount'] as int;
    final lastUpdated = data['lastUpdated'] as DateTime?;
    final onefopStatus = data['onefopStatus'] as String?;
    final onefopSurveyYear = data['onefopSurveyYear'] as int?;
    final hasOnefopDraft = data['hasOnefopDraft'] as bool;

    final onefopDisplay =
        _formatOnefopStatus(onefopStatus, onefopSurveyYear, hasOnefopDraft);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (onNewSubmission != null)
            _buildNewSubmissionCard(onNewSubmission!),
          if (onNewSubmission != null) const SizedBox(height: 24),
          _buildHeroCard(totalWorkers, declarationsFiled, lastUpdated),
          const SizedBox(height: 24),
          _buildKpiRow(
              declarationsFiled, pendingCount, approvedCount, onefopDisplay),
          const SizedBox(height: 24),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _buildRecentActivity(data)),
              const SizedBox(width: 24),
              Expanded(child: _buildWorkforceByContract(totalWorkers)),
            ],
          ),
        ],
      ),
    );
  }

  // ── Nouvelle soumission card ─────────────────────────────

  Widget _buildNewSubmissionCard(VoidCallback onTap) {
    return Card(
      elevation: 0,
      color: UltraTheme.primary.withValues(alpha: 0.06),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        side: BorderSide(color: UltraTheme.primary.withValues(alpha: 0.2)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: UltraTheme.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.add, color: Colors.white),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Nouvelle soumission',
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: UltraTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Déclaration DSMO ou questionnaire ONEFOP',
                      style: UltraTheme.bodyMedium
                          .copyWith(color: UltraTheme.textMuted),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: UltraTheme.primary),
            ],
          ),
        ),
      ),
    );
  }

  // ── Hero card ────────────────────────────────────────────

  Widget _buildHeroCard(
      int totalWorkers, int activeDeclarations, DateTime? lastUpdated) {
    String lastUpdatedText;
    if (lastUpdated != null) {
      final now = DateTime.now();
      final diff = now.difference(lastUpdated);
      if (diff.inDays == 0) {
        lastUpdatedText = "Mis à jour aujourd'hui";
      } else if (diff.inDays == 1) {
        lastUpdatedText = 'Mis à jour hier';
      } else {
        lastUpdatedText = 'Mis à jour il y a ${diff.inDays} jours';
      }
    } else {
      lastUpdatedText = 'Aucune déclaration';
    }

    return GlassCard(
      padding: const EdgeInsets.all(28),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 80,
            decoration: BoxDecoration(
              color: UltraTheme.primary,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Workers currently declared',
                    style: UltraTheme.labelLarge),
                const SizedBox(height: 8),
                Text('$totalWorkers',
                    style: UltraTheme.displayLarge.copyWith(fontSize: 40)),
                const SizedBox(height: 8),
                Text(
                    '$activeDeclarations déclarations actives · $lastUpdatedText',
                    style: UltraTheme.bodyMedium),
              ],
            ),
          ),
          _buildOnefopStatusBadge(),
        ],
      ),
    );
  }

  Widget _buildOnefopStatusBadge() => const SizedBox.shrink();

  // ── KPI row ──────────────────────────────────────────────

  Widget _buildKpiRow(int declarationsFiled, int pendingCount,
      int approvedCount, Map<String, dynamic> onefopDisplay) {
    final declarationProgress = declarationsFiled > 0
        ? (approvedCount / declarationsFiled).clamp(0.0, 1.0)
        : 0.0;
    final pendingProgress = declarationsFiled > 0
        ? (pendingCount / declarationsFiled).clamp(0.0, 1.0)
        : 0.0;

    return Row(
      children: [
        Expanded(
          child: GlassCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Declarations filed', style: UltraTheme.labelLarge),
                const SizedBox(height: 12),
                Text('$declarationsFiled',
                    style: UltraTheme.displayLarge.copyWith(fontSize: 28)),
                const SizedBox(height: 8),
                Text('↑ $approvedCount approuvées',
                    style: UltraTheme.bodyMedium.copyWith(
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.success)),
                const SizedBox(height: 12),
                Container(
                  height: 4,
                  decoration: BoxDecoration(
                      color: UltraTheme.background,
                      borderRadius: BorderRadius.circular(2)),
                  child: FractionallySizedBox(
                    widthFactor: declarationProgress,
                    child: Container(
                      decoration: BoxDecoration(
                          color: UltraTheme.primary,
                          borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: GlassCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Awaiting approval', style: UltraTheme.labelLarge),
                const SizedBox(height: 12),
                Text('$pendingCount',
                    style: UltraTheme.displayLarge.copyWith(fontSize: 28)),
                const SizedBox(height: 8),
                Text(
                  pendingCount > 0 ? 'En cours de révision' : 'Tout est à jour',
                  style: UltraTheme.bodyMedium,
                ),
                const SizedBox(height: 12),
                Container(
                  height: 4,
                  decoration: BoxDecoration(
                      color: UltraTheme.background,
                      borderRadius: BorderRadius.circular(2)),
                  child: FractionallySizedBox(
                    widthFactor: pendingProgress,
                    child: Container(
                      decoration: BoxDecoration(
                          color: UltraTheme.warning,
                          borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: GlassCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(onefopDisplay['title'] as String,
                    style: UltraTheme.labelLarge),
                const SizedBox(height: 12),
                Text(
                  onefopDisplay['value'] as String,
                  style: UltraTheme.displayLarge.copyWith(
                      fontSize: 24, color: onefopDisplay['color'] as Color),
                ),
                const SizedBox(height: 8),
                Text(
                  onefopDisplay['subtitle'] as String,
                  style: UltraTheme.bodyMedium.copyWith(
                      fontWeight: FontWeight.w600,
                      color: onefopDisplay['color'] as Color),
                ),
                const SizedBox(height: 12),
                Container(
                  height: 4,
                  decoration: BoxDecoration(
                      color: UltraTheme.background,
                      borderRadius: BorderRadius.circular(2)),
                  child: FractionallySizedBox(
                    widthFactor: onefopDisplay['progress'] as double,
                    child: Container(
                      decoration: BoxDecoration(
                          color: onefopDisplay['color'] as Color,
                          borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── ONEFOP status formatter ──────────────────────────────

  Map<String, dynamic> _formatOnefopStatus(
      String? status, int? surveyYear, bool hasDraft) {
    final year = surveyYear ?? DateTime.now().year;
    switch (status) {
      case 'APPROVED':
        return {
          'title': 'ONEFOP $year',
          'value': 'Approuvé',
          'subtitle': '↑ Questionnaire validé',
          'color': UltraTheme.success,
          'progress': 1.0,
        };
      case 'PENDING_REVIEW':
        return {
          'title': 'ONEFOP $year',
          'value': 'En révision',
          'subtitle': '↑ En attente MINEFOP',
          'color': UltraTheme.warning,
          'progress': 0.7,
        };
      case 'REJECTED':
        return {
          'title': 'ONEFOP $year',
          'value': 'Rejeté',
          'subtitle': '↓ Corrections requises',
          'color': UltraTheme.error,
          'progress': 0.3,
        };
      case 'CORRECTION_REQUESTED':
        return {
          'title': 'ONEFOP $year',
          'value': 'Corrections',
          'subtitle': '↓ Modifications demandées',
          'color': UltraTheme.warning,
          'progress': 0.5,
        };
      case 'DRAFT':
      default:
        if (hasDraft) {
          return {
            'title': 'ONEFOP $year',
            'value': 'Brouillon',
            'subtitle': '→ Finalisez et soumettez',
            'color': UltraTheme.info,
            'progress': 0.4,
          };
        }
        return {
          'title': 'ONEFOP $year',
          'value': 'Non soumis',
          'subtitle': '→ Questionnaire requis',
          'color': UltraTheme.textMuted,
          'progress': 0.0,
        };
    }
  }

  // ── Recent activity (✅ button always enabled) ─────────────────────────

  Widget _buildRecentActivity(Map<String, dynamic> data) {
    final declarations = (data['declarations'] as List<dynamic>?) ?? [];
    final activities = <_ActivityItem>[];

    for (final decl in declarations.take(4)) {
      final status = decl['status'] as String? ?? 'UNKNOWN';
      final year = decl['year'] as int? ?? DateTime.now().year;
      final rawDate = decl['submittedAt'] ?? decl['updatedAt'];
      final updatedAt =
          rawDate != null ? DateTime.tryParse(rawDate as String) : null;
      final dateStr = updatedAt != null
          ? '${updatedAt.day}/${updatedAt.month}/${updatedAt.year}'
          : 'Date inconnue';

      switch (status) {
        case 'FINAL_APPROVED':
          activities.add(_ActivityItem(
              'DSMO Q$year approuvée',
              'Validée par MINEFOP',
              dateStr,
              Icons.check_circle_outlined,
              UltraTheme.success,
              'Approuvée'));
          break;
        case 'REGION_APPROVED':
          activities.add(_ActivityItem(
              'DSMO Q$year en attente',
              'En attente validation finale',
              dateStr,
              Icons.access_time,
              UltraTheme.warning,
              'En cours'));
          break;
        case 'DIVISION_APPROVED':
          activities.add(_ActivityItem(
              'DSMO Q$year en révision',
              'En attente régionale',
              dateStr,
              Icons.pending_actions,
              UltraTheme.info,
              'Révision'));
          break;
        case 'SUBMITTED':
          activities.add(_ActivityItem(
              'DSMO Q$year soumise',
              'En attente de révision',
              dateStr,
              Icons.outbound,
              UltraTheme.info,
              'Soumise'));
          break;
        case 'DRAFT':
          activities.add(_ActivityItem(
              'DSMO Q$year brouillon',
              'Non finalisée',
              dateStr,
              Icons.drafts_outlined,
              UltraTheme.textMuted,
              'Brouillon'));
          break;
        case 'REJECTED':
          activities.add(_ActivityItem(
              'DSMO Q$year rejetée',
              'Corrections nécessaires',
              dateStr,
              Icons.cancel_outlined,
              UltraTheme.error,
              'Rejetée'));
          break;
      }
    }

    if (activities.isEmpty) {
      activities.add(_ActivityItem(
        'Aucune déclaration',
        'Commencez par créer une déclaration DSMO',
        '',
        Icons.folder_open_outlined,
        UltraTheme.textMuted,
        'Vide',
      ));
    }

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Recent activity',
                  style: UltraTheme.titleLarge.copyWith(fontSize: 16)),
              TextButton(
                onPressed: onViewAll, // ✅ Always enabled
                child: Text(
                  'View all →',
                  style: GoogleFonts.inter(
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

  // ── Workforce by contract ────────────────────────────────

  Widget _buildWorkforceByContract(int totalWorkers) {
    final contracts = [
      _ContractType(
          'Permanent', (totalWorkers * 0.72).round(), UltraTheme.primary),
      _ContractType(
          'Fixed-term', (totalWorkers * 0.18).round(), UltraTheme.accent),
      _ContractType(
          'Other', (totalWorkers * 0.10).round(), UltraTheme.textMuted),
    ];

    final sum = contracts.fold(0, (s, c) => s + c.count);
    if (sum != totalWorkers && totalWorkers > 0) {
      contracts[0] = _ContractType(contracts[0].name,
          contracts[0].count + (totalWorkers - sum), contracts[0].color);
    }

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Workforce by contract',
              style: UltraTheme.titleLarge.copyWith(fontSize: 16)),
          const SizedBox(height: 24),
          Center(
            child: SizedBox(
              width: 160,
              height: 160,
              child: CustomPaint(
                painter: _DonutChartPainter(
                  totalWorkers > 0
                      ? contracts.map((c) => c.count.toDouble()).toList()
                      : [1.0],
                  totalWorkers > 0
                      ? contracts.map((c) => c.color).toList()
                      : [UltraTheme.textMuted],
                ),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('$totalWorkers',
                          style:
                              UltraTheme.displayLarge.copyWith(fontSize: 28)),
                      Text('workers',
                          style: UltraTheme.labelMedium.copyWith(fontSize: 12)),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          ...contracts.map((c) => _buildContractRow(c, totalWorkers)),
        ],
      ),
    );
  }

  Widget _buildContractRow(_ContractType contract, int total) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: contract.color,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(contract.name,
                style: UltraTheme.bodyMedium.copyWith(
                    fontWeight: FontWeight.w500,
                    color: UltraTheme.textPrimary)),
          ),
          SizedBox(
            width: 120,
            child: LinearProgressIndicator(
              value: total > 0 ? contract.count / total : 0,
              backgroundColor: UltraTheme.background,
              valueColor: AlwaysStoppedAnimation<Color>(contract.color),
              minHeight: 6,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 32,
            child: Text('${contract.count}',
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
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (onNewSubmission != null)
            _buildShimmerCard(height: 80, borderRadius: 16),
          if (onNewSubmission != null) const SizedBox(height: 24),
          _buildShimmerCard(height: 140, borderRadius: 24),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(child: _buildShimmerCard(height: 160, borderRadius: 20)),
              const SizedBox(width: 16),
              Expanded(child: _buildShimmerCard(height: 160, borderRadius: 20)),
              const SizedBox(width: 16),
              Expanded(child: _buildShimmerCard(height: 160, borderRadius: 20)),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _buildShimmerCard(height: 320, borderRadius: 20)),
              const SizedBox(width: 24),
              Expanded(child: _buildShimmerCard(height: 320, borderRadius: 20)),
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
            Text('Erreur de chargement', style: UltraTheme.titleLarge),
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
              child: const Text('Réessayer'),
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

class _ContractType {
  final String name;
  final int count;
  final Color color;
  _ContractType(this.name, this.count, this.color);
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
