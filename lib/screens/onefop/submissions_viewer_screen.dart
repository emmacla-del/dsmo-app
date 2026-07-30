// lib/screens/onefop/submissions_viewer_screen.dart
// ═══════════════════════════════════════════════════════════════
// SUBMISSIONS VIEWER SCREEN
// Viewer for ONEFOP submissions (admin roles). Vetting (approve/
// reject/request-correction) was suspended for DIVISIONAL/REGIONAL/
// CENTRAL — this screen stays read-only for them. SUPER_ADMIN keeps
// the vetting actions on the detail screen (see SubmissionDetailScreen).
// ═══════════════════════════════════════════════════════════════

import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';
import 'package:shimmer/shimmer.dart' as shimmer_pkg;

import '../../core/focus/compiler/section_title_lookup.dart';
import '../../core/focus/onefop_form_loader.dart';
import '../../core/focus/schema/form_schema_v2.dart';
import '../../data/api_client.dart';
import '../../providers/auth_provider.dart';
import '../../theme/ultra_theme.dart';
import '../../widgets/admin_kit.dart';

// ═══════════════════════════════════════════════════════════════
// STATUS METADATA — must mirror the backend OnefopStatus enum
// (DRAFT | PENDING_REVIEW | APPROVED | REJECTED | CORRECTION_REQUESTED)
//
// Colors use accessible "700"-weight shades (not the brighter UltraTheme
// status tokens) so badge text/icons meet WCAG AA contrast both on a
// light tint background and as solid white-on-fill chips.
// ═══════════════════════════════════════════════════════════════

typedef _StatusMeta = ({String label, Color color, IconData icon});

const Map<String, _StatusMeta> _statusMeta = {
  'DRAFT': (
    label: 'Brouillon',
    color: UltraTheme.textSecondary, // #475569 — accessible neutral
    icon: Icons.drafts_outlined,
  ),
  'PENDING_REVIEW': (
    label: 'En révision',
    color: Color(0xFF1D4ED8), // blue-700
    icon: Icons.hourglass_top_rounded,
  ),
  'APPROVED': (
    label: 'Approuvé',
    color: Color(0xFF047857), // emerald-700
    icon: Icons.check_circle_rounded,
  ),
  'REJECTED': (
    label: 'Rejeté',
    color: Color(0xFFB91C1C), // red-700
    icon: Icons.cancel_rounded,
  ),
  'CORRECTION_REQUESTED': (
    label: 'Corrections demandées',
    color: Color(0xFFB45309), // amber-700
    icon: Icons.edit_note_rounded,
  ),
};

const List<String> _statusOrder = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'CORRECTION_REQUESTED',
];

_StatusMeta _statusOf(String status) =>
    _statusMeta[status.toUpperCase()] ??
    (
      label: status,
      color: UltraTheme.textMuted,
      icon: Icons.help_outline_rounded,
    );

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

String _formatDate(DateTime date) {
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
}

/// Fetches the submission's PDF and opens the platform print/save dialog —
/// same pattern used for DSMO declarations (declaration_approval_screen.dart).
Future<void> _printSubmissionPdf(
  BuildContext context,
  WidgetRef ref,
  String submissionId,
) async {
  try {
    final api = ref.read(apiClientProvider);
    final bytes = await api.getOnefopSubmissionPdf(submissionId);
    await Printing.layoutPdf(onLayout: (_) => Uint8List.fromList(bytes));
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Impossible de charger le PDF : $e')),
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SHARED VISUAL PRIMITIVES
// ═══════════════════════════════════════════════════════════════

/// Solid, high-contrast status badge — meant to be scannable at a glance
/// from across a dense table. Used in both the registry table and the
/// detail screen header so the same color/icon always means the same thing.
class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.meta, this.dense = false});
  final _StatusMeta meta;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: dense ? 8 : 12, vertical: dense ? 3 : 6),
      decoration: BoxDecoration(
        color: meta.color,
        borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(meta.icon, size: dense ? 12 : 14, color: Colors.white),
          SizedBox(width: dense ? 4 : 6),
          Text(
            meta.label,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: dense ? 11 : 12,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

/// A clickable KPI pill that doubles as a status filter. Light tint when
/// inactive, solid fill when selected — so the active filter visually
/// matches the badges it filters for.
class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.count,
    required this.color,
    required this.selected,
    required this.onTap,
    this.icon,
  });

  final String label;
  final int count;
  final Color color;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
        child: AnimatedContainer(
          duration: UltraTheme.fast,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? color : color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
            border: Border.all(
              color: selected ? color : color.withValues(alpha: 0.25),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 13, color: selected ? Colors.white : color),
                const SizedBox(width: 5),
              ],
              Text(
                label,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : color,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: selected
                      ? Colors.white.withValues(alpha: 0.22)
                      : color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: selected ? Colors.white : color,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Small dismissible chip representing one active filter constraint.
class _ActiveFilterChip extends StatelessWidget {
  const _ActiveFilterChip({required this.label, required this.onRemove});
  final String label;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(left: 10, right: 4, top: 4, bottom: 4),
      decoration: BoxDecoration(
        color: UltraTheme.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
        border: Border.all(color: UltraTheme.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: UltraTheme.primary,
            ),
          ),
          const SizedBox(width: 2),
          InkWell(
            onTap: onRemove,
            borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.close_rounded,
                  size: 14, color: UltraTheme.primary),
            ),
          ),
        ],
      ),
    );
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
  final _searchFocusNode = FocusNode();

  // Table sort state
  int? _sortColumnIndex;
  bool _sortAscending = true;
  final Set<String> _downloadingPdfIds = {};

  // Pagination — client-side, so hundreds/thousands of rows never get
  // built into the widget tree at once.
  int _page = 0;
  int _pageSize = 25;
  static const _pageSizeOptions = [25, 50, 100, 200];

  @override
  void initState() {
    super.initState();
    _loadSubmissions();
    // Repaints to show/hide the suggestion dropdown as focus changes.
    _searchFocusNode.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _searchFocusNode.dispose();
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
        _page = 0;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  // ── Derived filter facets (computed from loaded data, so dropdowns
  // only ever show values that actually exist) ──────────────────────
  List<String> get _availableEntityTypes {
    final set = _submissions.map((s) => s.entityType).toSet().toList()
      ..sort();
    return set;
  }

  List<String> get _availableRegions {
    final set = _submissions
        .map((s) => s.region)
        .whereType<String>()
        .toSet()
        .toList()
      ..sort();
    return set;
  }

  bool get _hasActiveFilters =>
      _filterStatus != null ||
      _filterEntityType != null ||
      _filterRegion != null ||
      _searchQuery.trim().isNotEmpty;

  void _resetFilters() {
    setState(() {
      _filterStatus = null;
      _filterEntityType = null;
      _filterRegion = null;
      _searchQuery = '';
      _searchCtrl.clear();
      _page = 0;
    });
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
        return (s.establishmentName ?? '').toLowerCase().contains(q) ||
            s.establishmentId.toLowerCase().contains(q) ||
            (s.region ?? '').toLowerCase().contains(q) ||
            s.quarterCode.toLowerCase().contains(q) ||
            s.entityTypeLabel.toLowerCase().contains(q);
      }).toList();
    }

    return filtered;
  }

  static const _maxSuggestions = 6;

  /// Top matches shown as a type-ahead dropdown under the search field.
  /// Mirrors [_filteredSubmissions] (so it respects the active status /
  /// entity-type / region filters too) but caps the list for a quick scan.
  List<SubmissionSummary> get _searchSuggestions {
    if (_searchQuery.trim().isEmpty) return const [];
    return _filteredSubmissions.take(_maxSuggestions).toList();
  }

  void _selectSuggestion(SubmissionSummary submission) {
    _searchFocusNode.unfocus();
    _viewSubmission(submission);
  }

  List<SubmissionSummary> _applySort(List<SubmissionSummary> list) {
    if (_sortColumnIndex == null) return list;

    int compare(SubmissionSummary a, SubmissionSummary b) {
      switch (_sortColumnIndex) {
        case 0:
          return (a.establishmentName ?? a.establishmentId)
              .compareTo(b.establishmentName ?? b.establishmentId);
        case 1:
          return a.establishmentId.compareTo(b.establishmentId);
        case 2:
          return a.entityTypeLabel.compareTo(b.entityTypeLabel);
        case 3:
          return (a.region ?? '').compareTo(b.region ?? '');
        case 4:
          return a.quarterCode.compareTo(b.quarterCode);
        case 5:
          return a.submittedAt.compareTo(b.submittedAt);
        case 6:
          return a.status.compareTo(b.status);
        default:
          return 0;
      }
    }

    final sorted = [...list];
    sorted.sort(_sortAscending ? compare : (a, b) => compare(b, a));
    return sorted;
  }

  void _onSort(int columnIndex, bool ascending) {
    setState(() {
      _sortColumnIndex = columnIndex;
      _sortAscending = ascending;
    });
  }

  Future<void> _downloadPdf(SubmissionSummary submission) async {
    if (_downloadingPdfIds.contains(submission.id)) return;
    setState(() => _downloadingPdfIds.add(submission.id));
    await _printSubmissionPdf(context, ref, submission.id);
    if (mounted) setState(() => _downloadingPdfIds.remove(submission.id));
  }

  @override
  Widget build(BuildContext context) {
    final filteredSorted = _applySort(_filteredSubmissions);

    // Clamp page if filtering shrank the result set below the current page.
    final maxPage =
        (filteredSorted.length / _pageSize).ceil().clamp(1, 999999) - 1;
    if (_page > maxPage) _page = maxPage < 0 ? 0 : maxPage;

    final start = (_page * _pageSize).clamp(0, filteredSorted.length);
    final end = (start + _pageSize).clamp(0, filteredSorted.length);
    final paged = filteredSorted.sublist(start, end);

    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: _buildAppBar(),
      body: _isLoading
          ? _buildSkeleton()
          : _error != null
              ? _buildErrorView()
              : GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: _searchFocusNode.unfocus,
                  child: RefreshIndicator(
                    onRefresh: _loadSubmissions,
                    color: UltraTheme.primary,
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final isNarrow = constraints.maxWidth < 760;
                        // Bound + scroll the toolbar instead of letting it
                        // overflow: the type-ahead dropdown grows with the
                        // number of matches, and on short viewports that
                        // can otherwise push past the bottom of the screen.
                        final toolbarMaxHeight = constraints.maxHeight.isFinite
                            ? constraints.maxHeight * 0.6
                            : 360.0;
                        return Column(
                          children: [
                            ConstrainedBox(
                              constraints:
                                  BoxConstraints(maxHeight: toolbarMaxHeight),
                              child: SingleChildScrollView(
                                child: _buildFilterToolbar(),
                              ),
                            ),
                            Expanded(
                              child: filteredSorted.isEmpty
                                  ? _buildEmptyResults()
                                  : isNarrow
                                      ? _buildCardList(paged)
                                      : _buildTable(
                                          paged,
                                          rowOffset: start,
                                          wide: constraints.maxWidth >= 1100,
                                        ),
                            ),
                            if (filteredSorted.isNotEmpty)
                              _buildPaginationBar(filteredSorted.length),
                          ],
                        );
                      },
                    ),
                  ),
                ),
    );
  }

  // ── App bar ───────────────────────────────────────────────
  PreferredSizeWidget _buildAppBar() {
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

  // ── Filter toolbar: search, status pills, quick dropdowns,
  // active-filter chips, and result count ─────────────────────
  Widget _buildFilterToolbar() {
    final total = _submissions.length;
    final filteredCount = _filteredSubmissions.length;

    return Container(
      color: UltraTheme.surface,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSearchBar(),
          _buildSuggestionsPanel(),
          const SizedBox(height: 12),
          _buildStatusPills(),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _buildEntityTypeDropdown(),
              _buildRegionDropdown(),
              if (_filterEntityType != null)
                _ActiveFilterChip(
                  label: 'Type : ${_entityTypeLabel(_filterEntityType!)}',
                  onRemove: () =>
                      setState(() => _filterEntityType = null),
                ),
              if (_filterRegion != null)
                _ActiveFilterChip(
                  label: 'Région : $_filterRegion',
                  onRemove: () => setState(() => _filterRegion = null),
                ),
              if (_hasActiveFilters)
                TextButton.icon(
                  onPressed: _resetFilters,
                  icon: const Icon(Icons.filter_alt_off_rounded, size: 16),
                  label: const Text('Réinitialiser'),
                  style: TextButton.styleFrom(
                    foregroundColor: UltraTheme.textMuted,
                    textStyle: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            _hasActiveFilters
                ? 'Affichage de $filteredCount sur $total soumissions'
                : '$total soumission${total == 1 ? '' : 's'} au total',
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: UltraTheme.textMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return TextField(
      controller: _searchCtrl,
      focusNode: _searchFocusNode,
      onChanged: (v) => setState(() {
        _searchQuery = v;
        _page = 0;
      }),
      onSubmitted: (_) => _searchFocusNode.unfocus(),
      textInputAction: TextInputAction.search,
      style: const TextStyle(fontFamily: 'Inter', fontSize: 14),
      decoration: InputDecoration(
        hintText:
            'Rechercher par établissement, ID, région, trimestre, type...',
        hintStyle: const TextStyle(
            fontFamily: 'Inter', fontSize: 13.5, color: UltraTheme.textMuted),
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
        fillColor: UltraTheme.background,
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
    );
  }

  /// Type-ahead dropdown: shown while the search field has focus and the
  /// query has matches. Renders in-flow (pushing the pills/dropdowns below
  /// it down slightly) rather than as a floating overlay, so it behaves
  /// predictably at any screen size without extra positioning logic.
  Widget _buildSuggestionsPanel() {
    if (!_searchFocusNode.hasFocus || _searchQuery.trim().isEmpty) {
      return const SizedBox.shrink();
    }
    final suggestions = _searchSuggestions;
    // No matches: the empty-state panel further down already explains this
    // with a reset CTA, so skip a redundant message here.
    if (suggestions.isEmpty) return const SizedBox.shrink();

    final totalMatches = _filteredSubmissions.length;

    return Container(
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: UltraTheme.primary.withValues(alpha: 0.25)),
        boxShadow: UltraTheme.softShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final s in suggestions) _buildSuggestionTile(s),
          if (totalMatches > suggestions.length)
            InkWell(
              onTap: () => _searchFocusNode.unfocus(),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: UltraTheme.primary.withValues(alpha: 0.04),
                ),
                child: Text(
                  'Voir les $totalMatches résultats dans le tableau',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: UltraTheme.primary,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSuggestionTile(SubmissionSummary s) {
    final meta = _statusOf(s.status);
    return InkWell(
      onTap: () => _selectSuggestion(s),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(
                color: UltraTheme.textMuted.withValues(alpha: 0.1)),
          ),
        ),
        child: Row(
          children: [
            const Icon(Icons.search_rounded,
                size: 16, color: UltraTheme.textMuted),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    s.establishmentName ?? s.establishmentId,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: UltraTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'ID ${s.establishmentId} · ${s.region ?? '—'} · ${s.quarterCode}',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11.5,
                      color: UltraTheme.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _StatusBadge(meta: meta, dense: true),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusPills() {
    final counts = <String, int>{};
    for (final s in _submissions) {
      final key = s.status.toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return SizedBox(
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _FilterPill(
            label: 'Tous',
            count: _submissions.length,
            color: UltraTheme.primary,
            selected: _filterStatus == null,
            onTap: () => setState(() {
              _filterStatus = null;
              _page = 0;
            }),
          ),
          const SizedBox(width: 8),
          for (final status in _statusOrder) ...[
            _FilterPill(
              label: _statusOf(status).label,
              count: counts[status] ?? 0,
              color: _statusOf(status).color,
              icon: _statusOf(status).icon,
              selected: _filterStatus == status,
              onTap: () => setState(() {
                _filterStatus = _filterStatus == status ? null : status;
                _page = 0;
              }),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  Widget _buildEntityTypeDropdown() {
    return _CompactDropdown<String>(
      hint: "Type d'entité",
      value: _filterEntityType,
      icon: Icons.category_outlined,
      items: [
        const DropdownMenuItem(value: null, child: Text('Tous les types')),
        ..._availableEntityTypes.map((t) => DropdownMenuItem(
              value: t,
              child: Text(_entityTypeLabel(t)),
            )),
      ],
      onChanged: (v) => setState(() {
        _filterEntityType = v;
        _page = 0;
      }),
    );
  }

  Widget _buildRegionDropdown() {
    return _CompactDropdown<String>(
      hint: 'Région',
      value: _filterRegion,
      icon: Icons.map_outlined,
      items: [
        const DropdownMenuItem(value: null, child: Text('Toutes les régions')),
        ..._availableRegions.map((r) => DropdownMenuItem(
              value: r,
              child: Text(r),
            )),
      ],
      onChanged: (v) => setState(() {
        _filterRegion = v;
        _page = 0;
      }),
    );
  }

  // ── Table (desktop / tablet) ──────────────────────────────
  List<int> _flexFor(bool wide) {
    // [#, Établissement, ID, Type, Région, Trimestre, Date, Statut, Actions]
    if (wide) return [1, 4, 3, 2, 3, 2, 2, 3, 2];
    // Medium width: drop ID + Type to keep things legible.
    return [1, 4, 0, 0, 3, 2, 2, 3, 2];
  }

  Widget _buildTable(
    List<SubmissionSummary> rows, {
    required int rowOffset,
    required bool wide,
  }) {
    final flex = _flexFor(wide);

    return Column(
      children: [
        _TableHeaderRow(
          flex: flex,
          wide: wide,
          sortColumnIndex: _sortColumnIndex,
          sortAscending: _sortAscending,
          onSort: _onSort,
        ),
        Expanded(
          child: ListView.builder(
            itemCount: rows.length,
            itemBuilder: (context, i) {
              final submission = rows[i];
              return _SubmissionTableRow(
                key: ValueKey(submission.id),
                submission: submission,
                rowNumber: rowOffset + i + 1,
                zebra: i.isOdd,
                flex: flex,
                isDownloading: _downloadingPdfIds.contains(submission.id),
                onView: () => _viewSubmission(submission),
                onDownload: () => _downloadPdf(submission),
              );
            },
          ),
        ),
      ],
    );
  }

  // ── Card list (narrow / mobile) ───────────────────────────
  Widget _buildCardList(List<SubmissionSummary> rows) {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      itemCount: rows.length,
      itemBuilder: (context, i) {
        final submission = rows[i];
        final meta = _statusOf(submission.status);
        final isDownloading = _downloadingPdfIds.contains(submission.id);
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          elevation: 0,
          color: UltraTheme.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            side: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            onTap: () => _viewSubmission(submission),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          submission.establishmentName ??
                              submission.establishmentId,
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: UltraTheme.textPrimary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (submission.flagCount > 0) ...[
                        Tooltip(
                          message: submission.flagCount == 1
                              ? '1 incohérence détectée'
                              : '${submission.flagCount} incohérences détectées',
                          child: const Icon(Icons.rule_outlined,
                              size: 15, color: UltraTheme.warning),
                        ),
                        const SizedBox(width: 8),
                      ],
                      _StatusBadge(meta: meta, dense: true),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'ID ${submission.establishmentId} · ${submission.entityTypeLabel}',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: UltraTheme.textMuted,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${submission.region ?? '—'} · ${submission.quarterCode} · ${_formatDate(submission.submittedAt)}',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: UltraTheme.textMuted,
                    ),
                  ),
                  const Divider(height: 18),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton.icon(
                        onPressed: () => _viewSubmission(submission),
                        icon: const Icon(Icons.visibility_outlined, size: 16),
                        label: const Text('Voir'),
                        style: TextButton.styleFrom(
                          foregroundColor: UltraTheme.primary,
                          textStyle: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(width: 4),
                      isDownloading
                          ? const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 12),
                              child: SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: UltraTheme.primary),
                              ),
                            )
                          : TextButton.icon(
                              onPressed: () => _downloadPdf(submission),
                              icon: const Icon(Icons.picture_as_pdf_outlined,
                                  size: 16),
                              label: const Text('PDF'),
                              style: TextButton.styleFrom(
                                foregroundColor: UltraTheme.primary,
                                textStyle: const TextStyle(
                                    fontFamily: 'Inter',
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600),
                              ),
                            ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  // ── Pagination bar ─────────────────────────────────────────
  Widget _buildPaginationBar(int totalFiltered) {
    final maxPage = (totalFiltered / _pageSize).ceil().clamp(1, 999999);
    final start = (_page * _pageSize) + 1;
    final end = ((_page + 1) * _pageSize).clamp(0, totalFiltered);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        border: Border(
          top: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
        ),
      ),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        runSpacing: 8,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Par page :',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: UltraTheme.textMuted)),
              const SizedBox(width: 8),
              DropdownButton<int>(
                value: _pageSize,
                underline: const SizedBox(),
                items: _pageSizeOptions
                    .map((n) => DropdownMenuItem(value: n, child: Text('$n')))
                    .toList(),
                onChanged: (v) {
                  if (v == null) return;
                  setState(() {
                    _pageSize = v;
                    _page = 0;
                  });
                },
              ),
            ],
          ),
          Text(
            '$start–$end sur $totalFiltered',
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: UltraTheme.textSecondary,
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: const Icon(Icons.chevron_left_rounded),
                onPressed: _page > 0 ? () => setState(() => _page--) : null,
                tooltip: 'Page précédente',
              ),
              Text(
                'Page ${_page + 1} / $maxPage',
                style: const TextStyle(fontFamily: 'Inter', fontSize: 12.5),
              ),
              IconButton(
                icon: const Icon(Icons.chevron_right_rounded),
                onPressed: _page + 1 < maxPage
                    ? () => setState(() => _page++)
                    : null,
                tooltip: 'Page suivante',
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Empty / error / loading states ────────────────────────
  Widget _buildEmptyResults() {
    final noDataAtAll = _submissions.isEmpty;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
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
              child: Icon(
                noDataAtAll
                    ? Icons.inbox_outlined
                    : Icons.search_off_rounded,
                size: 40,
                color: UltraTheme.textMuted,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              noDataAtAll ? 'Aucune soumission' : 'Aucun résultat',
              style: UltraTheme.titleMedium
                  .copyWith(color: UltraTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            Text(
              noDataAtAll
                  ? 'Aucune soumission ONEFOP trouvée pour le moment.'
                  : 'Aucune soumission ne correspond à votre recherche ou aux filtres actifs.',
              textAlign: TextAlign.center,
              style:
                  UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted),
            ),
            if (_hasActiveFilters) ...[
              const SizedBox(height: 20),
              OutlinedButton.icon(
                onPressed: _resetFilters,
                icon: const Icon(Icons.filter_alt_off_rounded, size: 16),
                label: const Text('Réinitialiser les filtres'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: UltraTheme.primary,
                  side: const BorderSide(color: UltraTheme.primary),
                ),
              ),
            ],
          ],
        ),
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

  /// Skeleton state that mirrors the toolbar + table shape, so the layout
  /// doesn't jump once real data arrives.
  Widget _buildSkeleton() {
    Widget bar({double width = double.infinity, double height = 14}) {
      return shimmer_pkg.Shimmer.fromColors(
        baseColor: UltraTheme.textMuted.withValues(alpha: 0.15),
        highlightColor: UltraTheme.textMuted.withValues(alpha: 0.05),
        child: Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: UltraTheme.textMuted.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(6),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          color: UltraTheme.surface,
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              bar(height: 44),
              const SizedBox(height: 14),
              Row(children: [
                bar(width: 70, height: 30),
                const SizedBox(width: 8),
                bar(width: 90, height: 30),
                const SizedBox(width: 8),
                bar(width: 90, height: 30),
              ]),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: 8,
            itemBuilder: (_, i) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: bar(height: 52),
            ),
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
    ).then((_) => _loadSubmissions());
  }
}

// ═══════════════════════════════════════════════════════════════
// TABLE PIECES
// ═══════════════════════════════════════════════════════════════

/// Compact, inline filter dropdown used in the quick-filter toolbar —
/// replaces the old modal bottom sheet for entity-type/region filtering.
class _CompactDropdown<T> extends StatelessWidget {
  const _CompactDropdown({
    required this.hint,
    required this.value,
    required this.items,
    required this.onChanged,
    required this.icon,
  });

  final String hint;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final isActive = value != null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: isActive
            ? UltraTheme.primary.withValues(alpha: 0.08)
            : UltraTheme.background,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isActive
              ? UltraTheme.primary.withValues(alpha: 0.35)
              : UltraTheme.textMuted.withValues(alpha: 0.2),
        ),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          hint: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 15, color: UltraTheme.textMuted),
              const SizedBox(width: 6),
              Text(hint,
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12.5,
                      color: UltraTheme.textMuted)),
            ],
          ),
          icon: const Icon(Icons.expand_more_rounded, size: 18),
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: isActive ? UltraTheme.primary : UltraTheme.textSecondary,
          ),
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }
}

/// Sticky table header — sits above the scrollable [ListView] of rows so
/// column titles stay visible while reviewing long lists. Tapping a
/// sortable column toggles ascending/descending, mirroring [DataColumn].
class _TableHeaderRow extends StatelessWidget {
  const _TableHeaderRow({
    required this.flex,
    required this.wide,
    required this.sortColumnIndex,
    required this.sortAscending,
    required this.onSort,
  });

  final List<int> flex;
  final bool wide;
  final int? sortColumnIndex;
  final bool sortAscending;
  final void Function(int columnIndex, bool ascending) onSort;

  static const _labels = [
    'Établissement',
    'ID',
    'Type',
    'Région',
    'Trimestre',
    'Date',
    'Statut',
  ];

  @override
  Widget build(BuildContext context) {
    Widget cell(int colIndex, String label, int flexValue,
        {TextAlign align = TextAlign.left}) {
      if (flexValue == 0) return const SizedBox.shrink();
      final isSorted = sortColumnIndex == colIndex;
      return Expanded(
        flex: flexValue,
        child: InkWell(
          onTap: () => onSort(colIndex, isSorted ? !sortAscending : true),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: align == TextAlign.center
                  ? MainAxisAlignment.center
                  : MainAxisAlignment.start,
              children: [
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    textAlign: align,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: isSorted
                          ? UltraTheme.primary
                          : UltraTheme.textSecondary,
                    ),
                  ),
                ),
                if (isSorted) ...[
                  const SizedBox(width: 2),
                  Icon(
                    sortAscending
                        ? Icons.arrow_upward_rounded
                        : Icons.arrow_downward_rounded,
                    size: 13,
                    color: UltraTheme.primary,
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: UltraTheme.primary.withValues(alpha: 0.06),
        border: Border(
          bottom:
              BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.15)),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          const SizedBox(
            width: 28,
            child: Text('#',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: UltraTheme.textMuted)),
          ),
          for (int i = 0; i < _labels.length; i++)
            cell(i, _labels[i], flex[i + 1],
                align: i >= 4 ? TextAlign.center : TextAlign.left),
          const SizedBox(
            width: 96,
            child: Text('Actions',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: UltraTheme.textMuted)),
          ),
        ],
      ),
    );
  }
}

/// A single registry row. Stateful only to track mouse-hover (web/desktop)
/// so officials scanning a dense table get a clear visual anchor on the
/// row their cursor is over, in addition to zebra striping.
class _SubmissionTableRow extends StatefulWidget {
  const _SubmissionTableRow({
    super.key,
    required this.submission,
    required this.rowNumber,
    required this.zebra,
    required this.flex,
    required this.isDownloading,
    required this.onView,
    required this.onDownload,
  });

  final SubmissionSummary submission;
  final int rowNumber;
  final bool zebra;
  final List<int> flex;
  final bool isDownloading;
  final VoidCallback onView;
  final VoidCallback onDownload;

  @override
  State<_SubmissionTableRow> createState() => _SubmissionTableRowState();
}

class _SubmissionTableRowState extends State<_SubmissionTableRow> {
  bool _hovering = false;

  @override
  Widget build(BuildContext context) {
    final s = widget.submission;
    final meta = _statusOf(s.status);
    final baseColor =
        widget.zebra ? UltraTheme.background : UltraTheme.surface;
    final bgColor =
        _hovering ? UltraTheme.primary.withValues(alpha: 0.05) : baseColor;

    Widget textCell(String text, int flexValue,
        {bool bold = false, TextAlign align = TextAlign.left}) {
      if (flexValue == 0) return const SizedBox.shrink();
      return Expanded(
        flex: flexValue,
        child: Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Text(
            text,
            overflow: TextOverflow.ellipsis,
            textAlign: align,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
              color: UltraTheme.textPrimary,
            ),
          ),
        ),
      );
    }

    return MouseRegion(
      onEnter: (_) => setState(() => _hovering = true),
      onExit: (_) => setState(() => _hovering = false),
      child: Material(
        color: bgColor,
        child: InkWell(
          onTap: widget.onView,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: 28,
                  child: Text(
                    '${widget.rowNumber}',
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11.5,
                        color: UltraTheme.textMuted),
                  ),
                ),
                Expanded(
                  flex: widget.flex[1],
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Row(
                      children: [
                        Flexible(
                          child: Text(
                            s.establishmentName ?? s.establishmentId,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: UltraTheme.textPrimary,
                            ),
                          ),
                        ),
                        if (s.flagCount > 0) ...[
                          const SizedBox(width: 6),
                          Tooltip(
                            message: s.flagCount == 1
                                ? '1 incohérence détectée'
                                : '${s.flagCount} incohérences détectées',
                            child: const Icon(Icons.rule_outlined,
                                size: 14, color: UltraTheme.warning),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                textCell(s.establishmentId, widget.flex[2]),
                textCell(s.entityTypeLabel, widget.flex[3]),
                textCell(s.region ?? '—', widget.flex[4]),
                textCell(s.quarterCode, widget.flex[5],
                    align: TextAlign.center),
                textCell(_formatDate(s.submittedAt), widget.flex[6],
                    align: TextAlign.center),
                Expanded(
                  flex: widget.flex[7],
                  child: Align(
                    alignment: Alignment.center,
                    child: _StatusBadge(meta: meta, dense: true),
                  ),
                ),
                SizedBox(
                  width: 96,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.visibility_outlined, size: 18),
                        color: UltraTheme.textSecondary,
                        tooltip: 'Voir la soumission',
                        onPressed: widget.onView,
                        constraints:
                            const BoxConstraints(minWidth: 36, minHeight: 36),
                        padding: EdgeInsets.zero,
                      ),
                      widget.isDownloading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: UltraTheme.primary),
                            )
                          : IconButton(
                              icon: const Icon(Icons.picture_as_pdf_outlined,
                                  size: 18),
                              color: UltraTheme.primary,
                              tooltip: 'Télécharger le PDF',
                              onPressed: widget.onDownload,
                              constraints: const BoxConstraints(
                                  minWidth: 36, minHeight: 36),
                              padding: EdgeInsets.zero,
                            ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
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
  bool _downloadingPdf = false;
  bool _actioning = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _downloadPdf() async {
    if (_downloadingPdf) return;
    setState(() => _downloadingPdf = true);
    await _printSubmissionPdf(context, ref, widget.submission.id);
    if (mounted) setState(() => _downloadingPdf = false);
  }

  // ── Vetting actions — SUPER_ADMIN only, see class doc comment ──

  bool get _isSuperAdmin => ref.read(authProvider).value?.role == 'SUPER_ADMIN';

  Future<void> _approve() async {
    final confirmed = await showAdminConfirmSheet(
      context,
      icon: Icons.check_circle_rounded,
      iconColor: UltraTheme.success,
      title: 'Approuver la soumission',
      body: 'Confirmer l\'approbation de cette soumission ONEFOP ?',
      confirmLabel: 'Approuver',
      confirmColor: UltraTheme.success,
    );
    if (confirmed != true) return;
    await _runAction(
      () => ref.read(apiClientProvider).approveQuestionnaire(widget.submission.id),
      'Soumission approuvée',
      UltraTheme.success,
      Icons.check_circle_rounded,
    );
  }

  Future<void> _reject() async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _ActionReasonSheet(
        title: 'Rejeter la soumission',
        hintText: 'Motif du rejet (optionnel)',
        confirmLabel: 'Confirmer le rejet',
        confirmColor: UltraTheme.error,
        icon: Icons.block_rounded,
      ),
    );
    if (reason == null) return;
    await _runAction(
      () => ref.read(apiClientProvider).rejectQuestionnaire(widget.submission.id, reason),
      'Soumission rejetée',
      UltraTheme.error,
      Icons.cancel_rounded,
    );
  }

  Future<void> _requestCorrection() async {
    final comments = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _ActionReasonSheet(
        title: 'Demander une correction',
        hintText: 'Précisez ce qui doit être corrigé (optionnel)',
        confirmLabel: 'Demander la correction',
        confirmColor: Color(0xFFB45309),
        icon: Icons.edit_note_rounded,
      ),
    );
    if (comments == null) return;
    await _runAction(
      () => ref.read(apiClientProvider).requestCorrection(widget.submission.id, comments),
      'Correction demandée',
      const Color(0xFFB45309),
      Icons.edit_note_rounded,
    );
  }

  Future<void> _runAction(
    Future<void> Function() action,
    String successMessage,
    Color color,
    IconData icon,
  ) async {
    setState(() => _actioning = true);
    try {
      await action();
      if (!mounted) return;
      showAdminToast(context, successMessage, color, icon);
      await _load();
    } catch (e) {
      if (!mounted) return;
      showAdminToast(context, 'Erreur : $e', UltraTheme.error, Icons.error_rounded);
    } finally {
      if (mounted) setState(() => _actioning = false);
    }
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
          OnefopFormLoader.loadForEntity(_schemaEntityKey(entityType));
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
          overflow: TextOverflow.ellipsis,
        ),
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          if (_downloadingPdf)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: UltraTheme.primary),
                ),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.picture_as_pdf_outlined),
              tooltip: 'Télécharger le PDF',
              onPressed: _downloadPdf,
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: _loading
          ? _buildDetailSkeleton()
          : _error != null
              ? _buildErrorView()
              : _buildContent(),
    );
  }

  Widget _buildDetailSkeleton() {
    Widget bar({double width = double.infinity, double height = 14}) {
      return shimmer_pkg.Shimmer.fromColors(
        baseColor: UltraTheme.textMuted.withValues(alpha: 0.15),
        highlightColor: UltraTheme.textMuted.withValues(alpha: 0.05),
        child: Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: UltraTheme.textMuted.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(6),
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: UltraTheme.surface,
            borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              bar(width: 220, height: 20),
              const SizedBox(height: 12),
              bar(width: 140, height: 14),
            ],
          ),
        ),
        const SizedBox(height: 16),
        for (int i = 0; i < 3; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: UltraTheme.surface,
                borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  bar(width: 160, height: 16),
                  const SizedBox(height: 16),
                  bar(height: 12),
                  const SizedBox(height: 8),
                  bar(height: 12),
                  const SizedBox(height: 8),
                  bar(width: 200, height: 12),
                ],
              ),
            ),
          ),
      ],
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
    final flags = (detail['flags'] as List?)?.cast<Map>() ?? const [];

    final sections = _buildAnswerSections(detail);

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 960),
            child: Padding(
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
                  if (flags.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _buildCoherenceFlagsBox(flags),
                  ],
                  if (rejectionReason != null &&
                      rejectionReason.trim().isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _buildRejectionBox(
                        meta, rejectionReason, reviewedBy, reviewedAt),
                  ],
                  if (_isSuperAdmin && status.toUpperCase() == 'PENDING_REVIEW') ...[
                    const SizedBox(height: 16),
                    _buildActionBar(),
                  ],
                  const SizedBox(height: 16),
                  if (sections.isEmpty) _buildEmptyAnswers() else ...sections,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActionBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        boxShadow: UltraTheme.softShadow,
      ),
      child: _actioning
          ? const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: UltraTheme.primary),
                ),
              ),
            )
          : Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _reject,
                  icon: const Icon(Icons.close_rounded, size: 16),
                  label: const Text('Rejeter'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: UltraTheme.error,
                    side: BorderSide(color: UltraTheme.error.withValues(alpha: 0.4)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _requestCorrection,
                  icon: const Icon(Icons.edit_note_rounded, size: 16),
                  label: const Text('Corriger'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFB45309),
                    side: const BorderSide(color: Color(0x66B45309)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _approve,
                  icon: const Icon(Icons.check_rounded, size: 16),
                  label: const Text('Approuver'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: UltraTheme.success,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ]),
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      establishmentName ?? widget.submission.establishmentId,
                      style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        color: UltraTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'ID établissement : ${widget.submission.establishmentId}',
                      style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: UltraTheme.textMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              _StatusBadge(meta: meta),
            ],
          ),
          const Divider(height: 28),
          Wrap(
            spacing: 24,
            runSpacing: 16,
            children: [
              _MetaItem(
                  label: "Type d'entité", value: _entityTypeLabel(entityType)),
              _MetaItem(label: 'Code trimestre', value: quarterCode ?? '—'),
              _MetaItem(
                  label: 'Date de soumission',
                  value: _formatDateTime(submittedAt)),
              if (region != null) _MetaItem(label: 'Région', value: region),
              if (department != null)
                _MetaItem(label: 'Département', value: department),
            ],
          ),
        ],
      ),
    );
  }

  // ── Coherence flags — cross-question mismatches computed at submit time
  // (see checkCoherence() in questionnaires.service.ts), e.g. recruitments
  // re-partitioned by diploma not summing to the permanent+temporary total.
  // Informational only, never blocks the submission itself.
  Widget _buildCoherenceFlagsBox(List<Map> flags) {
    const color = UltraTheme.warning;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.rule_outlined, color: color, size: 18),
            const SizedBox(width: 8),
            Text(
              flags.length == 1
                  ? 'Incohérence détectée'
                  : '${flags.length} incohérences détectées',
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: color),
            ),
          ]),
          const SizedBox(height: 8),
          for (final flag in flags)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '• ${flag['message'] ?? flag['code'] ?? ''}',
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    color: UltraTheme.textPrimary),
              ),
            ),
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
        child: _buildSectionCard(
            SectionTitleLookup.getTitle(section.id), rows, rows.length),
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

  Widget _buildSectionCard(String title, List<Widget> rows, int fieldCount) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        boxShadow: UltraTheme.softShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: true,
          tilePadding: const EdgeInsets.symmetric(horizontal: 20),
          childrenPadding:
              const EdgeInsets.fromLTRB(20, 0, 20, 20),
          title: Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: UltraTheme.textPrimary,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: UltraTheme.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
                ),
                child: Text(
                  '$fieldCount',
                  style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: UltraTheme.primary,
                  ),
                ),
              ),
            ],
          ),
          children: [
            const Divider(height: 1),
            const SizedBox(height: 12),
            ...rows,
          ],
        ),
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

  String _formatDateTime(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} à ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}

/// One label/value pair in the detail header's metadata grid. Sized to
/// reflow via [Wrap] — multiple columns on desktop/tablet, single column
/// once the viewport gets narrow.
/// Bottom sheet capturing an optional reason/comment for reject and
/// request-correction actions. Pops with the entered text (possibly
/// empty), or null if cancelled — mirrors the reason-capture pattern
/// already used for user rejection in users_directory_screen.dart.
class _ActionReasonSheet extends StatefulWidget {
  const _ActionReasonSheet({
    required this.title,
    required this.hintText,
    required this.confirmLabel,
    required this.confirmColor,
    required this.icon,
  });

  final String title;
  final String hintText;
  final String confirmLabel;
  final Color confirmColor;
  final IconData icon;

  @override
  State<_ActionReasonSheet> createState() => _ActionReasonSheetState();
}

class _ActionReasonSheetState extends State<_ActionReasonSheet> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
        decoration: const BoxDecoration(
          color: UltraTheme.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 24),
            decoration: BoxDecoration(
              color: UltraTheme.textMuted.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: widget.confirmColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(widget.icon, color: widget.confirmColor, size: 30),
          ),
          const SizedBox(height: 16),
          Text(widget.title, style: UltraTheme.displayMedium.copyWith(fontSize: 18)),
          const SizedBox(height: 16),
          TextField(
            controller: _ctrl,
            maxLines: 3,
            autofocus: true,
            style: const TextStyle(fontFamily: 'Inter', fontSize: 14),
            decoration: InputDecoration(
              hintText: widget.hintText,
              hintStyle: const TextStyle(fontFamily: 'Inter', color: UltraTheme.textMuted),
              filled: true,
              fillColor: UltraTheme.background,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: widget.confirmColor, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.3)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Annuler',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.textMuted)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context, _ctrl.text.trim()),
                style: ElevatedButton.styleFrom(
                  backgroundColor: widget.confirmColor,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(widget.confirmLabel,
                    style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w600)),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 200,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 11.5,
              color: UltraTheme.textMuted,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: UltraTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
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
  final int flagCount;

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
    this.flagCount = 0,
  });

  factory SubmissionSummary.fromJson(Map<String, dynamic> json) {
    return SubmissionSummary(
      id: json['id'] as String,
      establishmentId: json['establishmentId'] as String? ?? '—',
      establishmentName: json['establishmentName'] as String?,
      quarterCode: json['quarterCode'] as String? ?? '—',
      status: json['status'] as String,
      entityType: json['entityType'] as String,
      entityTypeLabel: _entityTypeLabel(json['entityType'] as String),
      submittedAt: DateTime.parse(json['submittedAt'] as String),
      region: json['region'] as String?,
      department: json['department'] as String?,
      flagCount: (json['flagCount'] as num?)?.toInt() ?? 0,
    );
  }
}
