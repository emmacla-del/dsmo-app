// lib/screens/onefop/submissions_viewer_screen.dart
// ═══════════════════════════════════════════════════════════════
// SUBMISSIONS VIEWER SCREEN
// Read-only viewer for ONEFOP submissions (admin roles)
// Replaces the old "Pending validation" tabs after vetting suspension
// ═══════════════════════════════════════════════════════════════

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/focus/compiler/section_title_lookup.dart';
import '../../core/focus/onefop_form_loader.dart';
import '../../core/focus/schema/form_schema_v2.dart';
import '../../data/api_client.dart';
import '../../theme/ultra_theme.dart';

// ═══════════════════════════════════════════════════════════════
// STATUS METADATA — must mirror the backend OnefopStatus enum
// (DRAFT | PENDING_REVIEW | APPROVED | REJECTED | CORRECTION_REQUESTED)
// ═══════════════════════════════════════════════════════════════

typedef _StatusMeta = ({String label, Color color, IconData icon});

const Map<String, _StatusMeta> _statusMeta = {
  'DRAFT': (
    label: 'Brouillon',
    color: UltraTheme.textMuted,
    icon: Icons.drafts_outlined,
  ),
  'PENDING_REVIEW': (
    label: 'En révision',
    color: Color(0xFF3B82F6),
    icon: Icons.hourglass_top_rounded,
  ),
  'APPROVED': (
    label: 'Approuvé',
    color: UltraTheme.success,
    icon: Icons.check_circle_rounded,
  ),
  'REJECTED': (
    label: 'Rejeté',
    color: UltraTheme.error,
    icon: Icons.cancel_rounded,
  ),
  'CORRECTION_REQUESTED': (
    label: 'Corrections demandées',
    color: UltraTheme.warning,
    icon: Icons.edit_note_rounded,
  ),
};

_StatusMeta _statusOf(String status) =>
    _statusMeta[status.toUpperCase()] ??
    (label: status, color: UltraTheme.textMuted, icon: Icons.help_outline_rounded);

String _entityTypeLabel(String type) {
  const labels = {
    'ENTREPRISE': 'Entreprise',
    'COOPERATIVE': 'Coopérative',
    'CTD': 'CTD',
    'ONG': 'ONG',
  };
  return labels[type.toUpperCase()] ?? type;
}

String _schemaEntityKey(String entityType) {
  switch (entityType.toUpperCase()) {
    case 'COOPERATIVE':
      return 'cooperative';
    case 'CTD':
      return 'ctd';
    case 'ONG':
      return 'ong';
    default:
      return 'enterprise';
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════

class SubmissionsViewerScreen extends ConsumerStatefulWidget {
  const SubmissionsViewerScreen({super.key});

  @override
  ConsumerState<SubmissionsViewerScreen> createState() =>
      _SubmissionsViewerScreenState();
}

class _SubmissionsViewerScreenState
    extends ConsumerState<SubmissionsViewerScreen> {
  List<SubmissionSummary> _submissions = [];
  bool _isLoading = true;
  String? _error;

  // Filter state
  String? _filterStatus;
  String? _filterEntityType;
  String? _filterRegion;
  String _searchQuery = '';
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadSubmissions();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSubmissions() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      final submissions = await api.getOnefopSubmissions();

      setState(() {
        _submissions =
            submissions.map((s) => SubmissionSummary.fromJson(s)).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  List<SubmissionSummary> get _filteredSubmissions {
    var filtered = _submissions;

    if (_filterStatus != null) {
      filtered = filtered
          .where((s) => s.status.toUpperCase() == _filterStatus)
          .toList();
    }

    if (_filterEntityType != null && _filterEntityType != 'Tous') {
      filtered =
          filtered.where((s) => s.entityType == _filterEntityType).toList();
    }

    if (_filterRegion != null && _filterRegion != 'Toutes') {
      filtered = filtered.where((s) => s.region == _filterRegion).toList();
    }

    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.trim().toLowerCase();
      filtered = filtered.where((s) {
        final name = (s.establishmentName ?? '').toLowerCase();
        return name.contains(q) || s.establishmentId.toLowerCase().contains(q);
      }).toList();
    }

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredSubmissions;

    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: _buildAppBar(),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: UltraTheme.primary))
          : _error != null
              ? _buildErrorView()
              : Column(
                  children: [
                    _buildStatStrip(),
                    _buildSearchBar(),
                    _buildStatusChips(),
                    Expanded(child: _buildSubmissionsList(filtered)),
                  ],
                ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    final hasFilters = _filterEntityType != null || _filterRegion != null;

    return AppBar(
      title: const Text(
        'Soumissions ONEFOP',
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: UltraTheme.textPrimary,
        ),
      ),
      backgroundColor: UltraTheme.surface,
      elevation: 0,
      actions: [
        IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: hasFilters
                  ? UltraTheme.primary.withValues(alpha: 0.15)
                  : UltraTheme.primary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.filter_list_rounded,
              color: hasFilters ? UltraTheme.primary : UltraTheme.textSecondary,
              size: 20,
            ),
          ),
          onPressed: _showFilterDialog,
          tooltip: 'Filtrer',
        ),
        const SizedBox(width: 8),
        IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: UltraTheme.primary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.refresh_rounded,
                size: 20, color: UltraTheme.textSecondary),
          ),
          onPressed: _loadSubmissions,
          tooltip: 'Actualiser',
        ),
        const SizedBox(width: 16),
      ],
    );
  }

  // ── Stat strip ────────────────────────────────────────────
  Widget _buildStatStrip() {
    final total = _submissions.length;
    final pendingReview = _submissions
        .where((s) => s.status.toUpperCase() == 'PENDING_REVIEW')
        .length;
    final approved =
        _submissions.where((s) => s.status.toUpperCase() == 'APPROVED').length;
    final rejected =
        _submissions.where((s) => s.status.toUpperCase() == 'REJECTED').length;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Row(children: [
        _StatPill(value: total, label: 'Total', color: UltraTheme.primary),
        const SizedBox(width: 8),
        _StatPill(
            value: pendingReview,
            label: 'En révision',
            color: const Color(0xFF3B82F6)),
        const SizedBox(width: 8),
        _StatPill(
            value: approved, label: 'Approuvées', color: UltraTheme.success),
        const SizedBox(width: 8),
        _StatPill(value: rejected, label: 'Rejetées', color: UltraTheme.error),
      ]),
    );
  }

  // ── Search bar ────────────────────────────────────────────
  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: TextField(
        controller: _searchCtrl,
        onChanged: (v) => setState(() => _searchQuery = v),
        style: const TextStyle(fontFamily: 'Inter', fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Rechercher un établissement...',
          hintStyle: const TextStyle(
              fontFamily: 'Inter', fontSize: 14, color: UltraTheme.textMuted),
          prefixIcon: const Icon(Icons.search_rounded,
              size: 20, color: UltraTheme.textMuted),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.close_rounded,
                      size: 18, color: UltraTheme.textMuted),
                  onPressed: () {
                    _searchCtrl.clear();
                    setState(() => _searchQuery = '');
                  },
                )
              : null,
          filled: true,
          fillColor: UltraTheme.surface,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: UltraTheme.primary, width: 1.5),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }

  // ── Status chips ──────────────────────────────────────────
  Widget _buildStatusChips() {
    const order = <String?>[
      null,
      'DRAFT',
      'PENDING_REVIEW',
      'APPROVED',
      'REJECTED',
      'CORRECTION_REQUESTED',
    ];

    return SizedBox(
      height: 52,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
        scrollDirection: Axis.horizontal,
        itemCount: order.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final s = order[i];
          final isActive = _filterStatus == s;
          final meta = s != null ? _statusOf(s) : null;
          final color = meta?.color ?? UltraTheme.primary;
          final label = meta?.label ?? 'Tous';
          return GestureDetector(
            onTap: () => setState(() => _filterStatus = s),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(
                color: isActive ? color : UltraTheme.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isActive
                      ? color
                      : UltraTheme.textMuted.withValues(alpha: 0.2),
                ),
              ),
              child: Center(
                child: Text(label,
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: isActive ? Colors.white : UltraTheme.textMuted)),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Container(
        margin: const EdgeInsets.all(32),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: UltraTheme.surface,
          borderRadius: BorderRadius.circular(UltraTheme.radiusXL),
          boxShadow: UltraTheme.softShadow,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: UltraTheme.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(32),
              ),
              child: const Icon(Icons.error_outline,
                  size: 32, color: UltraTheme.error),
            ),
            const SizedBox(height: 20),
            Text(
              'Erreur de chargement',
              style: UltraTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? 'Une erreur est survenue',
              textAlign: TextAlign.center,
              style:
                  UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadSubmissions,
              style: ElevatedButton.styleFrom(
                backgroundColor: UltraTheme.primary,
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
                ),
              ),
              child: const Text(
                'Réessayer',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmissionsList(List<SubmissionSummary> submissions) {
    if (submissions.isEmpty) {
      final hasActiveFilters = _filterStatus != null ||
          _filterEntityType != null ||
          _filterRegion != null ||
          _searchQuery.trim().isNotEmpty;
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: UltraTheme.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(40),
              ),
              child: const Icon(Icons.inbox_outlined,
                  size: 40, color: UltraTheme.textMuted),
            ),
            const SizedBox(height: 20),
            Text(
              'Aucune soumission',
              style: UltraTheme.titleMedium
                  .copyWith(color: UltraTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            Text(
              hasActiveFilters
                  ? "Aucun résultat pour ces critères"
                  : 'Aucune soumission ONEFOP trouvée',
              style:
                  UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: submissions.length,
      itemBuilder: (context, index) => SubmissionCard(
        submission: submissions[index],
        onTap: () => _viewSubmission(submissions[index]),
      ),
    );
  }

  void _showFilterDialog() {
    String? tempEntityType = _filterEntityType;
    String? tempRegion = _filterRegion;

    const entityTypes = ['Tous', 'ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG'];
    const regions = [
      'Toutes',
      'Adamaoua',
      'Centre',
      'Est',
      'Extrême-Nord',
      'Littoral',
      'Nord',
      'Nord-Ouest',
      'Ouest',
      'Sud',
      'Sud-Ouest',
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Container(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
          decoration: const BoxDecoration(
            color: UltraTheme.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: UltraTheme.textMuted.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const Text(
                "Filtrer par type / région",
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: UltraTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 20),
              _buildFilterDropdown("Type d'entité", tempEntityType, entityTypes,
                  (v) => setSheet(() => tempEntityType = v)),
              const SizedBox(height: 16),
              _buildFilterDropdown('Région', tempRegion, regions,
                  (v) => setSheet(() => tempRegion = v)),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _filterEntityType =
                          tempEntityType == 'Tous' ? null : tempEntityType;
                      _filterRegion =
                          tempRegion == 'Toutes' ? null : tempRegion;
                    });
                    Navigator.pop(ctx);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: UltraTheme.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Appliquer',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterDropdown(String label, String? value, List<String> items,
      ValueChanged<String?> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: UltraTheme.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: UltraTheme.background,
            borderRadius: BorderRadius.circular(10),
            border:
                Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
          ),
          child: DropdownButtonFormField<String>(
            initialValue: value,
            decoration: const InputDecoration(
              border: InputBorder.none,
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            items: items.map((item) {
              return DropdownMenuItem(value: item, child: Text(item));
            }).toList(),
            onChanged: onChanged,
          ),
        ),
      ],
    );
  }

  void _viewSubmission(SubmissionSummary submission) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SubmissionDetailScreen(submission: submission),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// SUBMISSION CARD
// ═══════════════════════════════════════════════════════════════

class SubmissionCard extends StatelessWidget {
  const SubmissionCard({
    super.key,
    required this.submission,
    required this.onTap,
  });

  final SubmissionSummary submission;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final meta = _statusOf(submission.status);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        side: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.1)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: meta.color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      meta.icon,
                      color: meta.color,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          submission.establishmentName ??
                              submission.establishmentId,
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: UltraTheme.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'ID: ${submission.establishmentId} • ${_formatDate(submission.submittedAt)}',
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            color: UltraTheme.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: meta.color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      meta.label,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: meta.color,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _buildInfoChip(
                      Icons.business_center, submission.entityTypeLabel),
                  const SizedBox(width: 8),
                  if (submission.region != null)
                    _buildInfoChip(Icons.location_on, submission.region!),
                  const SizedBox(width: 8),
                  _buildInfoChip(
                      Icons.credit_card, 'Quartier: ${submission.quarterCode}'),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: UltraTheme.background,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: UltraTheme.textMuted),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              color: UltraTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }
}

// ═══════════════════════════════════════════════════════════════
// SUBMISSION DETAIL SCREEN
// ═══════════════════════════════════════════════════════════════

class SubmissionDetailScreen extends ConsumerStatefulWidget {
  const SubmissionDetailScreen({super.key, required this.submission});

  final SubmissionSummary submission;

  @override
  ConsumerState<SubmissionDetailScreen> createState() =>
      _SubmissionDetailScreenState();
}

class _SubmissionDetailScreenState
    extends ConsumerState<SubmissionDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _detail;
  FormSchemaV2? _schema;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final detail = await api.getOnefopSubmissionDetail(widget.submission.id);
      final entityType =
          (detail['formType'] as String?) ?? widget.submission.entityType;
      final schema =
          await OnefopFormLoader.loadForEntity(_schemaEntityKey(entityType));
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _schema = schema;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        title: Text(
          widget.submission.establishmentName ?? widget.submission.establishmentId,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: UltraTheme.primary))
          : _error != null
              ? _buildErrorView()
              : _buildContent(),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Container(
        margin: const EdgeInsets.all(32),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: UltraTheme.surface,
          borderRadius: BorderRadius.circular(UltraTheme.radiusXL),
          boxShadow: UltraTheme.softShadow,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: UltraTheme.error),
            const SizedBox(height: 16),
            Text('Erreur de chargement', style: UltraTheme.titleLarge),
            const SizedBox(height: 8),
            Text(_error ?? '',
                textAlign: TextAlign.center, style: UltraTheme.bodyMedium),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _load,
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

  Widget _buildContent() {
    final detail = _detail ?? const {};
    final company = detail['company'] as Map<String, dynamic>?;

    final status = (detail['status'] as String?) ?? widget.submission.status;
    final meta = _statusOf(status);

    final establishmentName =
        (company?['name'] as String?) ?? widget.submission.establishmentName;
    final region = (detail['region'] as String?) ??
        (company?['region'] as String?) ??
        widget.submission.region;
    final department = (detail['department'] as String?) ??
        (company?['department'] as String?) ??
        widget.submission.department;
    final entityType =
        (detail['formType'] as String?) ?? widget.submission.entityType;
    final quarterCode =
        (detail['quarterCode'] as String?) ?? widget.submission.quarterCode;
    final submittedAt = DateTime.tryParse(detail['createdAt'] as String? ?? '') ??
        widget.submission.submittedAt;
    final rejectionReason = detail['rejectionReason'] as String?;
    final reviewedBy = detail['reviewedBy'] as String?;
    final reviewedAt = DateTime.tryParse(detail['reviewedAt'] as String? ?? '');

    final sections = _buildAnswerSections(detail);

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeaderCard(
              meta: meta,
              establishmentName: establishmentName,
              entityType: entityType,
              quarterCode: quarterCode,
              submittedAt: submittedAt,
              region: region,
              department: department,
            ),
            if (rejectionReason != null && rejectionReason.trim().isNotEmpty) ...[
              const SizedBox(height: 16),
              _buildRejectionBox(meta, rejectionReason, reviewedBy, reviewedAt),
            ],
            const SizedBox(height: 16),
            if (sections.isEmpty) _buildEmptyAnswers() else ...sections,
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderCard({
    required _StatusMeta meta,
    required String? establishmentName,
    required String entityType,
    required String? quarterCode,
    required DateTime submittedAt,
    required String? region,
    required String? department,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        boxShadow: UltraTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: meta.color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(meta.icon, color: meta.color, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      establishmentName ?? widget.submission.establishmentId,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'ID: ${widget.submission.establishmentId}',
                      style: const TextStyle(
                          fontSize: 13, color: UltraTheme.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 24),
          _buildDetailRow("Type d'entité", _entityTypeLabel(entityType)),
          _buildDetailRow('Code trimestre', quarterCode ?? '—'),
          _buildDetailRow('Date de soumission', _formatDateTime(submittedAt)),
          _buildStatusRow(meta),
          if (region != null) _buildDetailRow('Région', region),
          if (department != null) _buildDetailRow('Département', department),
        ],
      ),
    );
  }

  Widget _buildRejectionBox(_StatusMeta meta, String reason,
      String? reviewedBy, DateTime? reviewedAt) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: meta.color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        border: Border.all(color: meta.color.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.report_problem_outlined, color: meta.color, size: 18),
            const SizedBox(width: 8),
            Text(meta.label,
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: meta.color)),
          ]),
          const SizedBox(height: 8),
          Text(reason,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: UltraTheme.textPrimary)),
          if (reviewedBy != null || reviewedAt != null) ...[
            const SizedBox(height: 8),
            Text(
              [
                if (reviewedBy != null) 'Par $reviewedBy',
                if (reviewedAt != null) _formatDateTime(reviewedAt),
              ].join(' · '),
              style: const TextStyle(
                  fontFamily: 'Inter', fontSize: 11, color: UltraTheme.textMuted),
            ),
          ],
        ],
      ),
    );
  }

  // ── Answers, grouped by the same form schema used to fill the survey ──
  List<Widget> _buildAnswerSections(Map<String, dynamic> detail) {
    final schema = _schema;
    if (schema == null) return [];

    final rawData = (detail['rawData'] as Map?)?.cast<String, dynamic>() ?? {};
    final widgets = <Widget>[];

    for (final section in schema.sections) {
      final rows = <Widget>[];
      String? currentSubsection;

      for (final fieldId in section.fieldIds) {
        final field = schema.getField(fieldId);
        if (field == null) continue;

        final value = rawData[fieldId];
        if (_isEmptyValue(value)) continue;

        if (field.subsection != null && field.subsection != currentSubsection) {
          currentSubsection = field.subsection;
          rows.add(_buildSubsectionHeader(currentSubsection!));
        }

        rows.add(_buildAnswerRow(
          field.label ?? field.questionText ?? field.id,
          _formatValue(value),
        ));
      }

      if (rows.isEmpty) continue;

      widgets.add(Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: _buildSectionCard(SectionTitleLookup.getTitle(section.id), rows),
      ));
    }

    return widgets;
  }

  bool _isEmptyValue(dynamic value) {
    if (value == null) return true;
    if (value is String) return value.trim().isEmpty;
    if (value is Iterable) return value.isEmpty;
    if (value is Map) return value.isEmpty;
    return false;
  }

  String _formatValue(dynamic value) {
    if (value is List) return value.join(', ');
    if (value is Map) return jsonEncode(value);
    return value.toString();
  }

  Widget _buildEmptyAnswers() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        boxShadow: UltraTheme.softShadow,
      ),
      child: Column(
        children: [
          const Icon(Icons.description_outlined,
              size: 32, color: UltraTheme.textMuted),
          const SizedBox(height: 12),
          Text(
            'Aucune réponse enregistrée pour cette soumission.',
            textAlign: TextAlign.center,
            style: UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCard(String title, List<Widget> rows) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        boxShadow: UltraTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: UltraTheme.textPrimary,
            ),
          ),
          const Divider(height: 20),
          ...rows,
        ],
      ),
    );
  }

  Widget _buildSubsectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 6),
      child: Text(
        title,
        style: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: UltraTheme.textSecondary,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  Widget _buildAnswerRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: UltraTheme.textMuted,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 5,
            child: Text(
              value,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: UltraTheme.textMuted,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusRow(_StatusMeta meta) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(
            width: 140,
            child: Text(
              'Statut',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: UltraTheme.textMuted,
              ),
            ),
          ),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: meta.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                meta.label,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: meta.color,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDateTime(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} à ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}

// ═══════════════════════════════════════════════════════════════
// DATA MODELS
// ═══════════════════════════════════════════════════════════════

class SubmissionSummary {
  final String id;
  final String establishmentId;
  final String? establishmentName;
  final String quarterCode;
  final String status;
  final String entityType;
  final String entityTypeLabel;
  final DateTime submittedAt;
  final String? region;
  final String? department;

  SubmissionSummary({
    required this.id,
    required this.establishmentId,
    this.establishmentName,
    required this.quarterCode,
    required this.status,
    required this.entityType,
    required this.entityTypeLabel,
    required this.submittedAt,
    this.region,
    this.department,
  });

  factory SubmissionSummary.fromJson(Map<String, dynamic> json) {
    return SubmissionSummary(
      id: json['id'] as String,
      establishmentId: json['establishmentId'] as String,
      establishmentName: json['establishmentName'] as String?,
      quarterCode: json['quarterCode'] as String,
      status: json['status'] as String,
      entityType: json['entityType'] as String,
      entityTypeLabel: _entityTypeLabel(json['entityType'] as String),
      submittedAt: DateTime.parse(json['submittedAt'] as String),
      region: json['region'] as String?,
      department: json['department'] as String?,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// STAT PILL
// ═══════════════════════════════════════════════════════════════

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.value,
    required this.label,
    required this.color,
  });
  final int value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(
          '$value',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: color.withValues(alpha: 0.75),
          ),
        ),
      ]),
    );
  }
}
