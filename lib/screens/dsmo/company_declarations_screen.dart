// lib/screens/dsmo/company_declarations_screen.dart
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';
import 'package:url_launcher/url_launcher.dart';
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

const _tableHeaderStyle = TextStyle(
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: FontWeight.w700,
    color: UltraTheme.textSecondary);
const _tableCellStyle =
    TextStyle(fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textPrimary);

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
      _filtered = _groupFilter == null
          ? _entries
          : _entries.where((e) => e.group == _groupFilter).toList();
    });
  }

  int get _draftCount =>
      _entries.where((e) => e.isDraft).length;

  // DSMO declarations carry a pre-signed `pdfUrl` straight on the record, so
  // opening it is just a launchUrl. ONEFOP submissions don't store one —
  // the PDF is generated/cached on demand behind an authenticated endpoint —
  // so we fetch the bytes through the API client and hand them to the
  // system print/save dialog, same as submissions_viewer_screen.dart does
  // for reviewer roles.
  bool _hasPdf(_HistoryEntry e) {
    if (e.stream == 'DSMO') {
      final url = e.raw['pdfUrl'] as String?;
      return url != null && url.isNotEmpty;
    }
    return !e.isDraft;
  }

  Future<void> _downloadPdf(_HistoryEntry e) async {
    if (e.stream == 'DSMO') {
      final url = e.raw['pdfUrl'] as String?;
      final uri = url == null ? null : Uri.tryParse(url);
      if (uri == null || !await canLaunchUrl(uri)) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.l10n.companyDeclDownloadPdfError)),
          );
        }
        return;
      }
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      return;
    }

    try {
      final api = ref.read(apiClientProvider);
      final bytes = await api.getOnefopSubmissionPdf(e.id);
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
        if (!_loading && _error == null) _buildStatStrip(l10n),
        if (!_loading && _error == null) _buildFilterChips(l10n),
        Expanded(child: _buildBody(l10n)),
      ]),
      floatingActionButton: widget.onNewSubmission != null
          ? FloatingActionButton.extended(
              onPressed: widget.onNewSubmission,
              backgroundColor: UltraTheme.primary,
              foregroundColor: Colors.white,
              elevation: 2,
              icon: const Icon(Icons.add_rounded),
              label: Text(l10n.companyDeclNewButton,
                  style: const TextStyle(
                      fontFamily: 'Inter', fontWeight: FontWeight.w600)),
            )
          : null,
    );
  }

  Widget _buildStatStrip(AppLocalizations l10n) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(children: [
        _StatPill(
            value: _entries.length, label: l10n.total, color: UltraTheme.primary),
        const SizedBox(width: 8),
        _StatPill(
            value: _draftCount,
            label: l10n.companyDeclDraftsFilter,
            color: UltraTheme.textSecondary),
        const Spacer(),
        _RefreshButton(onTap: _load, tooltip: l10n.refreshTooltip),
      ]),
    );
  }

  Widget _buildFilterChips(AppLocalizations l10n) {
    final chips = <(_Group?, String, Color)>[
      (null, l10n.allMasculine, UltraTheme.primary),
      (_Group.draft, l10n.companyDeclDraftsFilter, UltraTheme.textSecondary),
      (_Group.pending, l10n.inProgressLabel, UltraTheme.info),
      (_Group.approved, l10n.companyDeclApprovedFilter, UltraTheme.success),
      (_Group.rejected, l10n.companyDeclRejectedFilter, UltraTheme.error),
    ];
    return SizedBox(
      height: 52,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
        scrollDirection: Axis.horizontal,
        itemCount: chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (group, label, color) = chips[i];
          final isActive = _groupFilter == group;
          return GestureDetector(
            onTap: () {
              setState(() => _groupFilter = group);
              _applyFilter();
            },
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
              child: Text(label,
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: isActive ? Colors.white : UltraTheme.textMuted)),
            ),
          );
        },
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
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowColor: WidgetStateProperty.all(UltraTheme.surface),
          columnSpacing: 20,
          horizontalMargin: 16,
          showCheckboxColumn: false,
          columns: [
            DataColumn(
                label:
                    Text(l10n.companyDeclFiliereColumn, style: _tableHeaderStyle)),
            DataColumn(
                label: Text(l10n.companyDeclDeclarationColumn,
                    style: _tableHeaderStyle)),
            DataColumn(
                label:
                    Text(l10n.companyDeclDetailsColumn, style: _tableHeaderStyle)),
            DataColumn(
                label: Text(l10n.companyDeclDateColumn, style: _tableHeaderStyle)),
            DataColumn(
                label: Text(l10n.statusColumnHeader, style: _tableHeaderStyle)),
            DataColumn(
                label: Text(l10n.companyDeclPdfColumn, style: _tableHeaderStyle)),
          ],
          rows: _filtered.map((e) => _buildRow(l10n, e)).toList(),
        ),
      ),
    );
  }

  DataRow _buildRow(AppLocalizations l10n, _HistoryEntry e) {
    final dateStr = e.date != null
        ? '${e.date!.day.toString().padLeft(2, '0')}/${e.date!.month.toString().padLeft(2, '0')}/${e.date!.year}'
        : l10n.dateUnknown;
    final streamColor =
        e.stream == 'DSMO' ? UltraTheme.primary : UltraTheme.accent;
    final hasPdf = _hasPdf(e);
    final statusLabel = _statusLabel(l10n, e);

    return DataRow(
      onSelectChanged: (_) => _showDetailSheet(l10n, e),
      cells: [
        DataCell(Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: streamColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(e.stream,
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: streamColor)),
        )),
        DataCell(SizedBox(
          width: 220,
          child: Text(_entryTitle(l10n, e),
              style: _tableCellStyle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        )),
        DataCell(SizedBox(
          width: 160,
          child: Text(e.subtitle ?? '—',
              style: _tableCellStyle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        )),
        DataCell(Text(dateStr, style: _tableCellStyle)),
        DataCell(Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: e.color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(statusLabel,
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: e.color)),
        )),
        DataCell(
          hasPdf
              ? IconButton(
                  onPressed: () => _downloadPdf(e),
                  icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
                  color: UltraTheme.primary,
                  tooltip: l10n.companyDeclDownloadPdfTooltip,
                )
              : const Text('—', style: _tableCellStyle),
        ),
      ],
    );
  }

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
