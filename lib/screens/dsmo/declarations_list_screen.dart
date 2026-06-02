import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../theme/ultra_theme.dart';

// ══════════════════════════════════════════════════════════════
// DeclarationsListScreen — no redundant gradient banner,
// compact stat strip, consistent with app-bar context.
// ══════════════════════════════════════════════════════════════

class DeclarationsListScreen extends ConsumerStatefulWidget {
  const DeclarationsListScreen({super.key, this.onNewSubmission});
  final VoidCallback? onNewSubmission;

  @override
  ConsumerState<DeclarationsListScreen> createState() =>
      _DeclarationsListScreenState();
}

class _DeclarationsListScreenState extends ConsumerState<DeclarationsListScreen>
    with SingleTickerProviderStateMixin {
  List<dynamic> _declarations = [];
  List<dynamic> _filtered = [];
  bool _loading = true;
  String? _error;
  String _searchQuery = '';
  String? _statusFilter;
  late AnimationController _animCtrl;
  final _searchCtrl = TextEditingController();

  static const _statusMeta = {
    'SUBMITTED': (label: 'Soumis', color: Color(0xFF3B82F6)),
    'DIVISION_APPROVED': (label: 'Div. Approuvé', color: Color(0xFF8B5CF6)),
    'REGION_APPROVED': (label: 'Rég. Approuvé', color: Color(0xFFF59E0B)),
    'FINAL_APPROVED': (label: 'Approuvé', color: Color(0xFF10B981)),
    'REJECTED': (label: 'Rejeté', color: Color(0xFFEF4444)),
  };

  // ── stat helpers ──────────────────────────────────────────
  int get _total => _declarations.length;
  int get _pending =>
      _declarations.where((d) => d['status'] == 'SUBMITTED').length;
  int get _approved =>
      _declarations.where((d) => d['status'] == 'FINAL_APPROVED').length;
  int get _rejected =>
      _declarations.where((d) => d['status'] == 'REJECTED').length;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 450));
    _loadDeclarations();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadDeclarations() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.get('/dsmo/declarations');
      setState(() {
        _declarations = resp.data as List? ?? [];
        _loading = false;
        _applyFilters();
      });
      _animCtrl.forward(from: 0);
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _applyFilters() {
    setState(() {
      _filtered = _declarations.where((d) {
        final name =
            ((d['companyName'] ?? d['name'] ?? '') as String).toLowerCase();
        final matchSearch =
            _searchQuery.isEmpty || name.contains(_searchQuery.toLowerCase());
        final matchStatus =
            _statusFilter == null || (d['status'] as String?) == _statusFilter;
        return matchSearch && matchStatus;
      }).toList();
    });
  }

  Future<void> _updateStatus(String id, String status) async {
    try {
      final api = ref.read(apiClientProvider);
      await api
          .patch('/dsmo/declarations/$id/status', data: {'status': status});
      if (!mounted) return;
      _loadDeclarations();
      _toast(
        status == 'FINAL_APPROVED'
            ? 'Déclaration approuvée'
            : 'Déclaration rejetée',
        status == 'FINAL_APPROVED' ? UltraTheme.success : UltraTheme.error,
        status == 'FINAL_APPROVED'
            ? Icons.check_circle_rounded
            : Icons.cancel_rounded,
      );
    } catch (e) {
      if (!mounted) return;
      _toast('Erreur: $e', UltraTheme.error, Icons.error_rounded);
    }
  }

  void _toast(String msg, Color color, IconData icon) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 10),
        Expanded(
            child: Text(msg,
                style: const TextStyle(
                    fontFamily: 'Inter', fontWeight: FontWeight.w500))),
      ]),
      backgroundColor: const Color(0xFF1E293B),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  // ═══════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      body: Column(children: [
        // ── Compact stat strip (replaces gradient banner) ────
        if (!_loading && _error == null) _buildStatStrip(),
        // ── Filters ─────────────────────────────────────────
        if (!_loading && _error == null) ...[
          _buildSearchBar(),
          _buildStatusChips(),
        ],
        // ── Content ─────────────────────────────────────────
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

  // ── Stat strip ────────────────────────────────────────────
  Widget _buildStatStrip() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(children: [
        _StatPill(value: _total, label: 'Total', color: UltraTheme.primary),
        const SizedBox(width: 8),
        _StatPill(
            value: _pending,
            label: 'En attente',
            color: const Color(0xFF3B82F6)),
        const SizedBox(width: 8),
        _StatPill(
            value: _approved,
            label: 'Approuvées',
            color: const Color(0xFF10B981)),
        const SizedBox(width: 8),
        _StatPill(
            value: _rejected,
            label: 'Rejetées',
            color: const Color(0xFFEF4444)),
        const Spacer(),
        _RefreshButton(onTap: _loadDeclarations),
      ]),
    );
  }

  // ── Search bar ────────────────────────────────────────────
  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
      child: TextField(
        controller: _searchCtrl,
        onChanged: (v) {
          _searchQuery = v;
          _applyFilters();
        },
        style: const TextStyle(fontFamily: 'Inter', fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Rechercher une entreprise...',
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
                    _searchQuery = '';
                    _applyFilters();
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
    final all = [null, ..._statusMeta.keys];
    return SizedBox(
      height: 52,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
        scrollDirection: Axis.horizontal,
        itemCount: all.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final s = all[i];
          final isActive = _statusFilter == s;
          final meta = s != null ? _statusMeta[s] : null;
          final color = meta?.color ?? UltraTheme.primary;
          final label = meta?.label ?? 'Tous';
          return GestureDetector(
            onTap: () {
              setState(() => _statusFilter = s);
              _applyFilters();
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

  // ── Body ─────────────────────────────────────────────────
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
          child: _buildDeclarationCard(_filtered[i]),
        );
      },
    );
  }

  // ── Declaration card ──────────────────────────────────────
  Widget _buildDeclarationCard(Map<String, dynamic> d) {
    final name = (d['companyName'] ?? d['name'] ?? 'Entreprise') as String;
    final status = (d['status'] as String?) ?? 'SUBMITTED';
    final meta =
        _statusMeta[status] ?? (label: status, color: UltraTheme.textMuted);
    final region = d['region'] as String?;
    final dept = d['department'] as String?;
    final year = d['year']?.toString() ?? d['declarationYear']?.toString();
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

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
          onTap: () => _showDeclarationSheet(d),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              // Initial avatar
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: meta.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Center(
                  child: Text(initial,
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontWeight: FontWeight.w700,
                          color: meta.color,
                          fontSize: 17)),
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: UltraTheme.textPrimary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 4),
                      Row(children: [
                        if (region != null) ...[
                          const Icon(Icons.location_on_outlined,
                              size: 12, color: UltraTheme.textMuted),
                          const SizedBox(width: 3),
                          Flexible(
                            child: Text(
                                [region, if (dept != null) dept].join(' · '),
                                style: const TextStyle(
                                    fontFamily: 'Inter',
                                    fontSize: 12,
                                    color: UltraTheme.textMuted),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis),
                          ),
                        ],
                        if (year != null) ...[
                          if (region != null) const SizedBox(width: 8),
                          const Icon(Icons.calendar_today_outlined,
                              size: 12, color: UltraTheme.textMuted),
                          const SizedBox(width: 3),
                          Text(year,
                              style: const TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 12,
                                  color: UltraTheme.textMuted)),
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
                    color: meta.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(meta.label,
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: meta.color)),
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

  // ── Detail sheet ──────────────────────────────────────────
  void _showDeclarationSheet(Map<String, dynamic> d) {
    final name = (d['companyName'] ?? d['name'] ?? 'Entreprise') as String;
    final status = (d['status'] as String?) ?? 'SUBMITTED';
    final id = d['id'] as String? ?? '';
    final isPending = status == 'SUBMITTED' || status == 'REGION_APPROVED';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.55,
        maxChildSize: 0.85,
        minChildSize: 0.4,
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
                  Text(name,
                      style: UltraTheme.displayMedium.copyWith(fontSize: 20)),
                  const SizedBox(height: 16),
                  ...d.entries
                      .where((e) =>
                          e.value != null &&
                          e.value.toString().isNotEmpty &&
                          !['id', '__v'].contains(e.key))
                      .map((e) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  SizedBox(
                                    width: 120,
                                    child: Text(e.key,
                                        style: const TextStyle(
                                            fontFamily: 'Inter',
                                            fontSize: 12,
                                            color: UltraTheme.textMuted)),
                                  ),
                                  Expanded(
                                    child: Text(e.value.toString(),
                                        style: const TextStyle(
                                            fontFamily: 'Inter',
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                            color: UltraTheme.textPrimary)),
                                  ),
                                ]),
                          )),
                  if (isPending) ...[
                    const SizedBox(height: 24),
                    Row(children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.pop(ctx);
                            _updateStatus(id, 'REJECTED');
                          },
                          icon: const Icon(Icons.close_rounded, size: 16),
                          label: const Text('Rejeter'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: UltraTheme.error,
                            side: BorderSide(
                                color: UltraTheme.error.withValues(alpha: 0.4)),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(ctx);
                            _updateStatus(id, 'FINAL_APPROVED');
                          },
                          icon: const Icon(Icons.check_rounded, size: 16),
                          label: const Text('Approuver'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: UltraTheme.success,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                      ),
                    ]),
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
            _searchQuery.isNotEmpty || _statusFilter != null
                ? 'Aucun résultat'
                : 'Aucune déclaration en attente',
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textPrimary)),
        const SizedBox(height: 8),
        Text(
            _searchQuery.isNotEmpty || _statusFilter != null
                ? "Essayez d'autres critères de recherche"
                : 'Les déclarations soumises apparaîtront ici',
            style: const TextStyle(
                fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted),
            textAlign: TextAlign.center),
        if (_searchQuery.isNotEmpty || _statusFilter != null) ...[
          const SizedBox(height: 16),
          TextButton(
            onPressed: () {
              _searchCtrl.clear();
              _searchQuery = '';
              _statusFilter = null;
              _applyFilters();
            },
            child: const Text('Effacer les filtres'),
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
          onPressed: _loadDeclarations,
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
// Private helper widgets (shared pattern with pending_list_screen)
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
          child: Icon(Icons.refresh_rounded,
              size: 18, color: UltraTheme.textSecondary),
        ),
      ),
    );
  }
}
