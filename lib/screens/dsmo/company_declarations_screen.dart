// lib/screens/dsmo/company_declarations_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../data/api_client.dart';
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
  final String statusLabel;
  final Color color;
  final String title;
  final String? subtitle;
  final DateTime? date;
  final Map<String, dynamic> raw;

  _HistoryEntry({
    required this.id,
    required this.stream,
    required this.status,
    required this.statusLabel,
    required this.color,
    required this.title,
    this.subtitle,
    this.date,
    required this.raw,
  });

  bool get isDraft => status == 'DRAFT';
}

enum _Group { draft, pending, approved, rejected }

const _dsmoStatusMeta = {
  'DRAFT': (label: 'Brouillon', color: UltraTheme.textMuted, group: _Group.draft),
  'SUBMITTED': (label: 'Soumise', color: UltraTheme.info, group: _Group.pending),
  'DIVISION_APPROVED': (
    label: 'Approuvée (division)',
    color: Color(0xFF8B5CF6),
    group: _Group.pending
  ),
  'REGION_APPROVED': (
    label: 'Approuvée (région)',
    color: UltraTheme.warning,
    group: _Group.pending
  ),
  'FINAL_APPROVED': (label: 'Approuvée', color: UltraTheme.success, group: _Group.approved),
  'REJECTED': (label: 'Rejetée', color: UltraTheme.error, group: _Group.rejected),
};

const _onefopStatusMeta = {
  'DRAFT': (label: 'Brouillon', color: UltraTheme.textMuted, group: _Group.draft),
  'PENDING_REVIEW': (label: 'En révision', color: UltraTheme.info, group: _Group.pending),
  'CORRECTION_REQUESTED': (
    label: 'Corrections requises',
    color: UltraTheme.warning,
    group: _Group.pending
  ),
  'APPROVED': (label: 'Approuvé', color: UltraTheme.success, group: _Group.approved),
  'REJECTED': (label: 'Rejeté', color: UltraTheme.error, group: _Group.rejected),
};

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
        api.get('/dsmo/declarations'),
        api.get('/onefop/submissions'),
      ]);

      final dsmoList = (results[0].data as List?) ?? [];
      final onefopList = (results[1].data as List?) ?? [];

      final entries = <_HistoryEntry>[];

      for (final raw in dsmoList) {
        final d = raw as Map<String, dynamic>;
        final status = (d['status'] as String?) ?? 'SUBMITTED';
        final meta = _dsmoStatusMeta[status] ??
            (label: status, color: UltraTheme.textMuted, group: _Group.pending);
        final year = d['year']?.toString() ?? '';
        final date = DateTime.tryParse(
            (d['submittedAt'] ?? d['updatedAt'] ?? d['createdAt'] ?? '')
                as String? ??
                '');
        entries.add(_HistoryEntry(
          id: d['id'] as String? ?? '',
          stream: 'DSMO',
          status: status,
          statusLabel: meta.label,
          color: meta.color,
          title: 'Déclaration DSMO $year',
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
            (label: status, color: UltraTheme.textMuted, group: _Group.pending);
        final quarter = s['quarterCode']?.toString() ?? '';
        final date = DateTime.tryParse((s['submittedAt'] ?? '') as String? ?? '');
        entries.add(_HistoryEntry(
          id: s['id'] as String? ?? '',
          stream: 'ONEFOP',
          status: status,
          statusLabel: meta.label,
          color: meta.color,
          title: 'Questionnaire ONEFOP $quarter',
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
          : _entries.where((e) {
              final meta = e.stream == 'DSMO'
                  ? _dsmoStatusMeta[e.status]
                  : _onefopStatusMeta[e.status];
              return meta?.group == _groupFilter;
            }).toList();
    });
  }

  int get _draftCount =>
      _entries.where((e) => e.isDraft).length;

  Future<void> _downloadPdf(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null || !await canLaunchUrl(uri)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Impossible d\'ouvrir le PDF')),
        );
      }
      return;
    }
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  // ═══════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      body: Column(children: [
        if (!_loading && _error == null) _buildStatStrip(),
        if (!_loading && _error == null) _buildFilterChips(),
        Expanded(child: _buildBody()),
      ]),
      floatingActionButton: widget.onNewSubmission != null
          ? FloatingActionButton.extended(
              onPressed: widget.onNewSubmission,
              backgroundColor: UltraTheme.primary,
              foregroundColor: Colors.white,
              elevation: 2,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nouvelle',
                  style: TextStyle(
                      fontFamily: 'Inter', fontWeight: FontWeight.w600)),
            )
          : null,
    );
  }

  Widget _buildStatStrip() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(children: [
        _StatPill(
            value: _entries.length, label: 'Total', color: UltraTheme.primary),
        const SizedBox(width: 8),
        _StatPill(
            value: _draftCount, label: 'Brouillons', color: UltraTheme.textSecondary),
        const Spacer(),
        _RefreshButton(onTap: _load),
      ]),
    );
  }

  Widget _buildFilterChips() {
    final chips = <(_Group?, String, Color)>[
      (null, 'Tous', UltraTheme.primary),
      (_Group.draft, 'Brouillons', UltraTheme.textSecondary),
      (_Group.pending, 'En cours', UltraTheme.info),
      (_Group.approved, 'Approuvées', UltraTheme.success),
      (_Group.rejected, 'Rejetées', UltraTheme.error),
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

  Widget _buildBody() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation(UltraTheme.primary)));
    }
    if (_error != null) return _buildError();
    if (_filtered.isEmpty) return _buildEmpty();

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
      itemCount: _filtered.length,
      itemBuilder: (_, i) {
        return AnimatedBuilder(
          animation: _animCtrl,
          builder: (_, child) {
            final delay = (i * 0.06).clamp(0.0, 0.5);
            final t = ((_animCtrl.value - delay) / (1 - delay)).clamp(0.0, 1.0);
            final curve = Curves.easeOutCubic.transform(t);
            return Opacity(
              opacity: curve,
              child: Transform.translate(
                  offset: Offset(0, 16 * (1 - curve)), child: child),
            );
          },
          child: _buildCard(_filtered[i]),
        );
      },
    );
  }

  Widget _buildCard(_HistoryEntry e) {
    final dateStr = e.date != null
        ? '${e.date!.day.toString().padLeft(2, '0')}/${e.date!.month.toString().padLeft(2, '0')}/${e.date!.year}'
        : 'Date inconnue';
    final streamColor =
        e.stream == 'DSMO' ? UltraTheme.primary : UltraTheme.accent;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _showDetailSheet(e),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: e.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  e.isDraft
                      ? Icons.drafts_outlined
                      : (e.stream == 'DSMO'
                          ? Icons.assignment_outlined
                          : Icons.bar_chart_outlined),
                  color: e.color,
                  size: 20,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: streamColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(e.stream,
                              style: TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: streamColor)),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(e.title,
                              style: const TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: UltraTheme.textPrimary),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis),
                        ),
                      ]),
                      const SizedBox(height: 4),
                      Row(children: [
                        const Icon(Icons.calendar_today_outlined,
                            size: 12, color: UltraTheme.textMuted),
                        const SizedBox(width: 3),
                        Text(dateStr,
                            style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 12,
                                color: UltraTheme.textMuted)),
                        if (e.subtitle != null) ...[
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(e.subtitle!,
                                style: const TextStyle(
                                    fontFamily: 'Inter',
                                    fontSize: 12,
                                    color: UltraTheme.textMuted),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis),
                          ),
                        ],
                      ]),
                    ]),
              ),
              const SizedBox(width: 10),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: e.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(e.statusLabel,
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: e.color)),
                ),
                const SizedBox(height: 6),
                const Icon(Icons.chevron_right_rounded,
                    size: 18, color: UltraTheme.textMuted),
              ]),
            ]),
          ),
        ),
      ),
    );
  }

  // ── Detail sheet (read-only, no approve/reject) ────────────
  void _showDetailSheet(_HistoryEntry e) {
    const hiddenKeys = {
      'id',
      'company',
      'submissionId',
      'establishmentId',
      'entityType',
      'pdfUrl',
      '__v',
    };
    final pdfUrl = e.raw['pdfUrl'] as String?;

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
                      child: Text(e.title,
                          style: UltraTheme.displayMedium
                              .copyWith(fontSize: 20)),
                    ),
                    StatusBadge(label: e.statusLabel, color: e.color),
                  ]),
                  if (pdfUrl != null && pdfUrl.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => _downloadPdf(pdfUrl),
                        icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
                        label: const Text('Télécharger le PDF'),
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
                        label: const Text('Reprendre le brouillon'),
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
  Widget _buildEmpty() {
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
                ? 'Aucun résultat'
                : 'Aucune déclaration pour le moment',
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textPrimary)),
        const SizedBox(height: 8),
        Text(
            _groupFilter != null
                ? "Essayez un autre filtre"
                : 'Vos déclarations DSMO et questionnaires ONEFOP\napparaîtront ici, y compris les brouillons.',
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
            child: const Text('Effacer le filtre'),
          ),
        ],
      ]),
    );
  }

  Widget _buildError() {
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
        const Text('Erreur de chargement',
            style: TextStyle(
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
          label: const Text('Réessayer'),
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
  const _RefreshButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: UltraTheme.surface,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            border:
                Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.refresh_rounded,
              size: 18, color: UltraTheme.textSecondary),
        ),
      ),
    );
  }
}
