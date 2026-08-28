// lib/screens/dsmo/company_declarations_screen.dart
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';
import '../../core/i18n/l10n_ext.dart';
import '../../data/api_client.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../theme/ultra_theme.dart';
import '../../widgets/common_widgets.dart' show StatusBadge;

// ══════════════════════════════════════════════════════════════
// CompanyDeclarationsScreen — read-only declaration/questionnaire
// history for the logged-in COMPANY, merging DSMO declarations and
// ONEFOP submissions (including drafts) into a single timeline.
// No approve/reject controls: this is the company's own record,
// not a reviewer queue.
// ══════════════════════════════════════════════════════════════

class _HistoryEntry {
  final String id;
  final String stream; // 'DSMO' | 'ONEFOP'
  final String status;
  final _Group group;
  final Color color;
  final String period; // year for DSMO, quarter code for ONEFOP
  final String? subtitle;
  final DateTime? date;
  final Map<String, dynamic> raw;

  _HistoryEntry({
    required this.id,
    required this.stream,
    required this.status,
    required this.group,
    required this.color,
    required this.period,
    this.subtitle,
    this.date,
    required this.raw,
  });

  bool get isDraft => status == 'DRAFT';
}

enum _Group { draft, pending, approved, rejected }

const _dsmoStatusMeta = {
  'DRAFT': (color: UltraTheme.textMuted, group: _Group.draft),
  'SUBMITTED': (color: UltraTheme.info, group: _Group.pending),
  'DIVISION_APPROVED': (color: Color(0xFF8B5CF6), group: _Group.pending),
  'REGION_APPROVED': (color: UltraTheme.warning, group: _Group.pending),
  'FINAL_APPROVED': (color: UltraTheme.success, group: _Group.approved),
  'REJECTED': (color: UltraTheme.error, group: _Group.rejected),
};

const _onefopStatusMeta = {
  'DRAFT': (color: UltraTheme.textMuted, group: _Group.draft),
  'PENDING_REVIEW': (color: UltraTheme.info, group: _Group.pending),
  'CORRECTION_REQUESTED': (color: UltraTheme.warning, group: _Group.pending),
  'APPROVED': (color: UltraTheme.success, group: _Group.approved),
  'REJECTED': (color: UltraTheme.error, group: _Group.rejected),
};

String _dsmoStatusLabel(AppLocalizations l10n, String status) {
  switch (status) {
    case 'DRAFT':
      return l10n.dsmoDraftBadge;
    case 'SUBMITTED':
      return l10n.dsmoSubmittedBadge;
    case 'DIVISION_APPROVED':
      return l10n.companyDeclStatusDivisionApproved;
    case 'REGION_APPROVED':
      return l10n.companyDeclStatusRegionApproved;
    case 'FINAL_APPROVED':
      return l10n.dsmoApprovedBadge;
    case 'REJECTED':
      return l10n.dsmoRejectedBadge;
    default:
      return status;
  }
}

String _onefopStatusLabel(AppLocalizations l10n, String status) {
  switch (status) {
    case 'DRAFT':
      return l10n.dsmoDraftBadge;
    case 'PENDING_REVIEW':
      return l10n.onefopUnderReview;
    case 'CORRECTION_REQUESTED':
      return l10n.companyDeclStatusCorrectionRequested;
    case 'APPROVED':
      return l10n.onefopApproved;
    case 'REJECTED':
      return l10n.onefopRejected;
    default:
      return status;
  }
}

String _statusLabel(AppLocalizations l10n, _HistoryEntry e) {
  return e.stream == 'DSMO'
      ? _dsmoStatusLabel(l10n, e.status)
      : _onefopStatusLabel(l10n, e.status);
}

String _entryTitle(AppLocalizations l10n, _HistoryEntry e) {
  return e.stream == 'DSMO'
      ? l10n.companyDeclDsmoTitle(e.period)
      : l10n.companyDeclOnefopTitle(e.period);
}

class CompanyDeclarationsScreen extends ConsumerStatefulWidget {
  const CompanyDeclarationsScreen({super.key, this.onNewSubmission});
  final VoidCallback? onNewSubmission;

  @override
  ConsumerState<CompanyDeclarationsScreen> createState() =>
      _CompanyDeclarationsScreenState();
}

class _CompanyDeclarationsScreenState
    extends ConsumerState<CompanyDeclarationsScreen>
    with SingleTickerProviderStateMixin {
  List<_HistoryEntry> _entries = [];
  List<_HistoryEntry> _filtered = [];
  bool _loading = true;
  String? _error;
  _Group? _groupFilter;
  String _campaignFilter = 'ALL';
  final _searchController = TextEditingController();
  late AnimationController _animCtrl;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 450));
    _load();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final results = await Future.wait([
        api.getDeclarations(),
        api.getMyOnefopSubmissions(),
      ]);

      final dsmoList = results[0];
      final onefopList = results[1];

      final entries = <_HistoryEntry>[];

      for (final raw in dsmoList) {
        final d = raw as Map<String, dynamic>;
        final status = (d['status'] as String?) ?? 'SUBMITTED';
        final meta = _dsmoStatusMeta[status] ??
            (color: UltraTheme.textMuted, group: _Group.pending);
        final year = d['year']?.toString() ?? '';
        final date = DateTime.tryParse(
            (d['submittedAt'] ?? d['updatedAt'] ?? d['createdAt'] ?? '')
                as String? ??
                '');
        entries.add(_HistoryEntry(
          id: d['id'] as String? ?? '',
          stream: 'DSMO',
          status: status,
          group: meta.group,
          color: meta.color,
          period: year,
          subtitle: d['region'] != null
              ? [d['region'], d['department']]
                  .where((e) => e != null)
                  .join(' · ')
              : null,
          date: date,
          raw: d,
        ));
      }

      for (final raw in onefopList) {
        final s = raw as Map<String, dynamic>;
        final status = (s['status'] as String?) ?? 'PENDING_REVIEW';
        final meta = _onefopStatusMeta[status] ??
            (color: UltraTheme.textMuted, group: _Group.pending);
        final quarter = s['quarterCode']?.toString() ?? '';
        final date = DateTime.tryParse((s['submittedAt'] ?? '') as String? ?? '');
        entries.add(_HistoryEntry(
          id: s['id'] as String? ?? '',
          stream: 'ONEFOP',
          status: status,
          group: meta.group,
          color: meta.color,
          period: quarter,
          subtitle: s['entityTypeLabel'] as String?,
          date: date,
          raw: s,
        ));
      }

      entries.sort((a, b) {
        final ad = a.date ?? DateTime.fromMillisecondsSinceEpoch(0);
        final bd = b.date ?? DateTime.fromMillisecondsSinceEpoch(0);
        return bd.compareTo(ad);
      });

      setState(() {
        _entries = entries;
        _loading = false;
        _applyFilter();
      });
      _animCtrl.forward(from: 0);
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _applyFilter() {
    setState(() {
      final query = _searchController.text.trim().toLowerCase();
      _filtered = _entries.where((e) {
        final matchesStatus = _groupFilter == null || e.group == _groupFilter;
        final matchesCampaign = _campaignFilter == 'ALL' ||
            e.stream == _campaignFilter;
        final matchesSearch = query.isEmpty ||
            _entryTitle(context.l10n, e).toLowerCase().contains(query) ||
            e.stream.toLowerCase().contains(query) ||
            e.period.toLowerCase().contains(query);
        return matchesStatus && matchesCampaign && matchesSearch;
      }).toList();
    });
  }

  int get _draftCount =>
      _entries.where((e) => e.isDraft).length;

  int _count(_Group group) => _entries.where((e) => e.group == group).length;

    int get _submittedCount =>
      _entries.where((e) => e.status == 'SUBMITTED' || e.status == 'PENDING_REVIEW').length;

    int get _underReviewCount =>
      _count(_Group.pending) - _submittedCount < 0
        ? 0
        : _count(_Group.pending) - _submittedCount;

  // `pdfUrl` being set on the record is a proxy for "this declaration was
  // submitted with a PDF" — the actual bytes are always fetched fresh
  // through the API (see _downloadPdf) rather than opening that stored URL
  // directly, since it's a Supabase signed link that expires after 7 days.
  bool _hasPdf(_HistoryEntry e) {
    if (e.stream == 'DSMO') {
      final url = e.raw['pdfUrl'] as String?;
      return url != null && url.isNotEmpty;
    }
    return !e.isDraft;
  }

  Future<void> _downloadPdf(_HistoryEntry e) async {
    try {
      final api = ref.read(apiClientProvider);
      final bytes = e.stream == 'DSMO'
          ? await api.getDeclarationPdf(e.id)
          : await api.getOnefopSubmissionPdf(e.id);
      await Printing.layoutPdf(onLayout: (_) => Uint8List.fromList(bytes));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.companyDeclDownloadPdfError)),
        );
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: UltraTheme.background,
      body: Column(children: [
        if (!_loading && _error == null) _buildHeader(l10n),
        if (!_loading && _error == null) _buildSummary(l10n),
        if (!_loading && _error == null) _buildToolbar(l10n),
        Expanded(child: _buildBody(l10n)),
      ]),
    );
  }

  Widget _buildHeader(AppLocalizations l10n) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 18, 24, 8),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final action = widget.onNewSubmission == null
              ? null
              : ElevatedButton.icon(
                  onPressed: widget.onNewSubmission,
                  icon: const Icon(Icons.add_rounded, size: 17),
                  label: Text(l10n.companyDeclNewButton),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: UltraTheme.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                );
          final copy = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('My Declarations', style: UltraTheme.displayMedium.copyWith(fontSize: 24)),
              const SizedBox(height: 4),
              Text('Track your employment declarations, submissions, and approval status',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted)),
            ],
          );
          if (constraints.maxWidth < 680) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [copy, if (action != null) ...[const SizedBox(height: 10), action]],
            );
          }
          return Row(children: [Expanded(child: copy), if (action != null) action]);
        },
      ),
    );
  }

  Widget _buildSummary(AppLocalizations l10n) {
    final items = <(String, int, Color)>[
      ('Submitted', _submittedCount, UltraTheme.info),
      ('Under review', _underReviewCount, UltraTheme.info),
      ('Approved', _count(_Group.approved), UltraTheme.success),
      ('Drafts', _draftCount, UltraTheme.textSecondary),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: 12),
            Expanded(child: _SummaryCard(label: items[i].$1, value: items[i].$2, color: items[i].$3)),
          ],
        ],
      ),
    );
  }

  Widget _buildToolbar(AppLocalizations l10n) {
    final chips = <(_Group?, String, Color)>[
      (null, 'All ${_entries.length}', UltraTheme.primary),
      (_Group.draft, l10n.companyDeclDraftsFilter, UltraTheme.textSecondary),
      (_Group.pending, 'Under review ${_count(_Group.pending)}', UltraTheme.info),
      (_Group.approved, l10n.companyDeclApprovedFilter, UltraTheme.success),
      (_Group.rejected, l10n.companyDeclRejectedFilter, UltraTheme.error),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (group, label, color) in chips)
                _FilterPill(
                  label: label,
                  color: color,
                  selected: _groupFilter == group,
                  onTap: () {
                    setState(() => _groupFilter = group);
                    _applyFilter();
                  },
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onChanged: (_) => _applyFilter(),
                  decoration: InputDecoration(
                    hintText: 'Search declarations...',
                    prefixIcon: const Icon(Icons.search_rounded, size: 18),
                    isDense: true,
                    filled: true,
                    fillColor: UltraTheme.surface,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.18))),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _campaignFilter,
                  borderRadius: BorderRadius.circular(10),
                  items: const [
                    DropdownMenuItem(value: 'ALL', child: Text('All campaigns')),
                    DropdownMenuItem(value: 'DSMO', child: Text('DSMO')),
                    DropdownMenuItem(value: 'ONEFOP', child: Text('ONEFOP')),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() => _campaignFilter = value);
                    _applyFilter();
                  },
                ),
              ),
              const SizedBox(width: 8),
              _RefreshButton(onTap: _load, tooltip: l10n.refreshTooltip),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation(UltraTheme.primary)));
    }
    if (_error != null) return _buildError(l10n);
    if (_filtered.isEmpty) return _buildEmpty(l10n);

    return FadeTransition(
      opacity: _animCtrl,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        child: _buildTable(l10n),
      ),
    );
  }

  Widget _buildTable(AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
          child: Text('Declaration history',
              style: UltraTheme.titleMedium.copyWith(fontSize: 15)),
        ),
        for (final entry in _filtered) ...[
          _DeclarationHistoryTile(
            entry: entry,
            title: _entryTitle(l10n, entry),
            statusLabel: _statusLabel(l10n, entry),
            dateLabel: entry.date == null
                ? l10n.dateUnknown
                : '${entry.date!.day.toString().padLeft(2, '0')} ${_monthName(entry.date!.month)} ${entry.date!.year}',
            hasPdf: _hasPdf(entry),
            onTap: () => _showDetailSheet(l10n, entry),
            onPdf: () => _downloadPdf(entry),
            onContinue: entry.isDraft && widget.onNewSubmission != null
                ? widget.onNewSubmission
                : null,
          ),
          if (entry != _filtered.last) const SizedBox(height: 8),
        ],
      ],
    );
  }

  String _monthName(int month) => const [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ][month];

  // ── Detail sheet (read-only, no approve/reject) ────────────
  void _showDetailSheet(AppLocalizations l10n, _HistoryEntry e) {
    const hiddenKeys = {
      'id',
      'company',
      'submissionId',
      'establishmentId',
      'entityType',
      'pdfUrl',
      '__v',
    };
    final hasPdf = _hasPdf(e);
    final title = _entryTitle(l10n, e);
    final statusLabel = _statusLabel(l10n, e);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        maxChildSize: 0.85,
        minChildSize: 0.35,
        builder: (_, ctrl) => Container(
          decoration: const BoxDecoration(
            color: UltraTheme.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 20),
              decoration: BoxDecoration(
                color: UltraTheme.textMuted.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Expanded(
              child: ListView(
                controller: ctrl,
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                children: [
                  Row(children: [
                    Expanded(
                      child: Text(title,
                          style: UltraTheme.displayMedium
                              .copyWith(fontSize: 20)),
                    ),
                    StatusBadge(label: statusLabel, color: e.color),
                  ]),
                  const SizedBox(height: 22),
                  _StatusTimeline(entry: e),
                  if (hasPdf) ...[
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => _downloadPdf(e),
                        icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
                        label: Text(l10n.companyDeclDownloadPdfTooltip),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: UltraTheme.primary,
                          side: const BorderSide(color: UltraTheme.primary),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  ...e.raw.entries
                      .where((entry) =>
                          entry.value != null &&
                          entry.value.toString().isNotEmpty &&
                          !hiddenKeys.contains(entry.key))
                      .map((entry) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  SizedBox(
                                    width: 130,
                                    child: Text(entry.key,
                                        style: const TextStyle(
                                            fontFamily: 'Inter',
                                            fontSize: 12,
                                            color: UltraTheme.textMuted)),
                                  ),
                                  Expanded(
                                    child: Text(entry.value.toString(),
                                        style: const TextStyle(
                                            fontFamily: 'Inter',
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                            color: UltraTheme.textPrimary)),
                                  ),
                                ]),
                          )),
                  if (e.isDraft && widget.onNewSubmission != null) ...[
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.pop(ctx);
                          widget.onNewSubmission!();
                        },
                        icon: const Icon(Icons.edit_rounded, size: 16),
                        label: Text(l10n.companyDeclResumeDraft),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: UltraTheme.primary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ]),
        ),
      ),
    );
  }

  // ── Empty / Error states ──────────────────────────────────
  Widget _buildEmpty(AppLocalizations l10n) {
    return Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: UltraTheme.primary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Icon(Icons.inbox_rounded,
              size: 40, color: UltraTheme.primary.withValues(alpha: 0.6)),
        ),
        const SizedBox(height: 20),
        Text(
            _groupFilter != null
                ? l10n.companyDeclNoResultsTitle
                : l10n.companyDeclEmptyTitle,
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textPrimary)),
        const SizedBox(height: 8),
        Text(
            _groupFilter != null
                ? l10n.companyDeclTryDifferentFilter
                : l10n.companyDeclEmptySubtitle,
            style: const TextStyle(
                fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted),
            textAlign: TextAlign.center),
        if (_groupFilter != null) ...[
          const SizedBox(height: 16),
          TextButton(
            onPressed: () {
              _groupFilter = null;
              _applyFilter();
            },
            child: Text(l10n.companyDeclClearFilter),
          ),
        ],
      ]),
    );
  }

  Widget _buildError(AppLocalizations l10n) {
    return Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: UltraTheme.error.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Icon(Icons.cloud_off_rounded,
              size: 36, color: UltraTheme.error),
        ),
        const SizedBox(height: 16),
        Text(l10n.loadingErrorTitle,
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textPrimary)),
        const SizedBox(height: 8),
        Text(_error ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: UltraTheme.textMuted)),
        const SizedBox(height: 24),
        ElevatedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh_rounded, size: 16),
          label: Text(l10n.retry),
          style: ElevatedButton.styleFrom(
            backgroundColor: UltraTheme.primary,
            foregroundColor: Colors.white,
            elevation: 0,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ]),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// Private helper widgets
// ══════════════════════════════════════════════════════════════

class _SummaryCard extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  const _SummaryCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        height: 82,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: UltraTheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.16)),
          boxShadow: UltraTheme.softShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: UltraTheme.textMuted)),
            Text('$value',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
          ],
        ),
      );
}

class _FilterPill extends StatelessWidget {
  final String label;
  final Color color;
  final bool selected;
  final VoidCallback onTap;
  const _FilterPill({required this.label, required this.color, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        selected: selected,
        child: Material(
          color: selected ? color : UltraTheme.surface,
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(18),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: selected ? color : color.withValues(alpha: 0.2)),
              ),
              child: Text(label,
                  style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700,
                      color: selected ? Colors.white : color)),
            ),
          ),
        ),
      );
}

class _DeclarationHistoryTile extends StatelessWidget {
  final _HistoryEntry entry;
  final String title;
  final String statusLabel;
  final String dateLabel;
  final bool hasPdf;
  final VoidCallback onTap;
  final VoidCallback onPdf;
  final VoidCallback? onContinue;

  const _DeclarationHistoryTile({
    required this.entry,
    required this.title,
    required this.statusLabel,
    required this.dateLabel,
    required this.hasPdf,
    required this.onTap,
    required this.onPdf,
    this.onContinue,
  });

  @override
  Widget build(BuildContext context) {
    final streamColor = entry.stream == 'DSMO' ? UltraTheme.primary : UltraTheme.accent;
    final compact = MediaQuery.sizeOf(context).width < 640;
    final content = Row(
      children: [
        Container(
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
              color: streamColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10)),
          child: Text(entry.stream,
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: streamColor)),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 3,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              const SizedBox(height: 3),
              Text(entry.subtitle ?? 'Company submission',
                  style: const TextStyle(fontSize: 11, color: UltraTheme.textMuted)),
            ],
          ),
        ),
        if (!compact) ...[
          Expanded(
            flex: 2,
            child: Text(dateLabel,
                style: const TextStyle(fontSize: 12, color: UltraTheme.textMuted)),
          ),
          Expanded(
            flex: 2,
            child: Align(
              alignment: Alignment.centerLeft,
              child: _StatusPill(label: statusLabel, color: entry.color),
            ),
          ),
        ],
        PopupMenuButton<String>(
          tooltip: 'Actions',
          onSelected: (action) {
            if (action == 'view') onTap();
            if (action == 'pdf' && hasPdf) onPdf();
            if (action == 'continue' && onContinue != null) onContinue!();
          },
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'view', child: Text('View details')),
            if (onContinue != null)
              const PopupMenuItem(value: 'continue', child: Text('Continue draft')),
            if (hasPdf)
              const PopupMenuItem(value: 'pdf', child: Text('Download PDF')),
            const PopupMenuItem(value: 'track', child: Text('Track status')),
          ],
        ),
      ],
    );
    return Material(
      color: UltraTheme.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.14)),
          ),
          child: compact
              ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  content,
                  const SizedBox(height: 8),
                  Row(children: [
                    _StatusPill(label: statusLabel, color: entry.color),
                    const SizedBox(width: 10),
                    Text(dateLabel, style: const TextStyle(fontSize: 11, color: UltraTheme.textMuted)),
                  ]),
                ])
              : content,
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusPill({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
        child: Text(label, overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
      );
}

class _StatusTimeline extends StatelessWidget {
  final _HistoryEntry entry;
  const _StatusTimeline({required this.entry});

  @override
  Widget build(BuildContext context) {
    final submitted = !entry.isDraft;
    final reviewed = entry.group == _Group.approved || entry.group == _Group.rejected;
    final approved = entry.group == _Group.approved;
    final steps = [
      ('Created', true),
      ('Submitted', submitted),
      ('Under review', reviewed),
      ('Approved', approved),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Status timeline', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        for (var i = 0; i < steps.length; i++)
          Row(children: [
            Icon(steps[i].$2 ? Icons.check_circle : Icons.radio_button_unchecked,
                size: 16, color: steps[i].$2 ? entry.color : UltraTheme.textMuted),
            const SizedBox(width: 8),
            Text(steps[i].$1, style: TextStyle(fontSize: 12, color: steps[i].$2 ? UltraTheme.textPrimary : UltraTheme.textMuted)),
            if (i < steps.length - 1)
              const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('↓', style: TextStyle(color: UltraTheme.textMuted))),
          ]),
      ],
    );
  }
}

class _RefreshButton extends StatelessWidget {
  const _RefreshButton({required this.onTap, required this.tooltip});
  final VoidCallback onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              border: Border.all(
                  color: UltraTheme.textMuted.withValues(alpha: 0.2)),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.refresh_rounded,
                size: 18, color: UltraTheme.textSecondary),
          ),
        ),
      ),
    );
  }
}
