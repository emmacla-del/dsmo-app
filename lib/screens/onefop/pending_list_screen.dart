import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../theme/ultra_theme.dart';

// ══════════════════════════════════════════════════════════════
// PendingListScreen — ONEFOP Questionnaires
// Redesign: no redundant gradient header, compact stat strip,
// cleaner card layout, consistent with app-bar context.
// ══════════════════════════════════════════════════════════════

class PendingListScreen extends ConsumerStatefulWidget {
  const PendingListScreen({super.key});

  @override
  ConsumerState<PendingListScreen> createState() => _PendingListScreenState();
}

class _PendingListScreenState extends ConsumerState<PendingListScreen>
    with SingleTickerProviderStateMixin {
  List<dynamic> _items = [];
  List<dynamic> _filtered = [];
  bool _loading = true;
  String? _error;
  String _searchQuery = '';
  String? _typeFilter;
  late AnimationController _animCtrl;
  final _searchCtrl = TextEditingController();

  static const _typeMeta = {
    'enterprise': (
      label: 'Entreprise',
      icon: Icons.business_rounded,
      color: Color(0xFF3B82F6)
    ),
    'cooperative': (
      label: 'Coopérative',
      icon: Icons.groups_rounded,
      color: Color(0xFF8B5CF6)
    ),
    'ctd': (
      label: 'CTD',
      icon: Icons.account_balance_rounded,
      color: Color(0xFFF59E0B)
    ),
    'ong': (
      label: 'ONG',
      icon: Icons.volunteer_activism_rounded,
      color: Color(0xFF10B981)
    ),
  };

  static const _statusMeta = {
    'SUBMITTED': (label: 'Soumis', color: Color(0xFF3B82F6)),
    'UNDER_REVIEW': (label: 'En révision', color: Color(0xFFF59E0B)),
    'APPROVED': (label: 'Approuvé', color: Color(0xFF10B981)),
    'REJECTED': (label: 'Rejeté', color: Color(0xFFEF4444)),
  };

  // ── stat helpers ──────────────────────────────────────────
  int get _total => _items.length;
  int get _pending => _items.where((i) => i['status'] == 'SUBMITTED').length;
  int get _approved => _items.where((i) => i['status'] == 'APPROVED').length;
  int get _rejected => _items.where((i) => i['status'] == 'REJECTED').length;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 450));
    _loadItems();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadItems() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.get('/onefop/pending');
      setState(() {
        _items = resp.data as List? ?? [];
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
      _filtered = _items.where((item) {
        final name = ((item['companyName'] ??
                item['cooperativeName'] ??
                item['ctdName'] ??
                item['ngoName'] ??
                item['name'] ??
                '') as String)
            .toLowerCase();
        final type = ((item['entityType'] ?? '') as String).toLowerCase();
        final matchSearch =
            _searchQuery.isEmpty || name.contains(_searchQuery.toLowerCase());
        final matchType =
            _typeFilter == null || type == _typeFilter!.toLowerCase();
        return matchSearch && matchType;
      }).toList();
    });
  }

  Future<void> _updateStatus(String id, String status, String name) async {
    try {
      final api = ref.read(apiClientProvider);
      await api
          .patch('/onefop/questionnaires/$id/status', data: {'status': status});
      if (!mounted) return;
      _loadItems();
      _toast(
        status == 'APPROVED' ? '$name approuvé' : '$name rejeté',
        status == 'APPROVED' ? UltraTheme.success : UltraTheme.error,
        status == 'APPROVED'
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
        // ── Stat strip (replaces redundant gradient banner) ──
        if (!_loading && _error == null) _buildStatStrip(),
        // ── Filters ─────────────────────────────────────────
        if (!_loading && _error == null) ...[
          _buildTypeChips(),
          _buildSearchBar(),
        ],
        // ── Content ─────────────────────────────────────────
        Expanded(child: _buildBody()),
      ]),
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
            label: 'Approuvés',
            color: const Color(0xFF10B981)),
        const SizedBox(width: 8),
        _StatPill(
            value: _rejected, label: 'Rejetés', color: const Color(0xFFEF4444)),
        const Spacer(),
        // Refresh sits here now — uncluttered, top-right of strip
        _RefreshButton(onTap: _loadItems),
      ]),
    );
  }

  // ── Type chips ────────────────────────────────────────────
  Widget _buildTypeChips() {
    final types = [null, ..._typeMeta.keys];
    return SizedBox(
      height: 50,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
        scrollDirection: Axis.horizontal,
        itemCount: types.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final t = types[i];
          final isActive = _typeFilter == t;
          final meta = t != null ? _typeMeta[t] : null;
          final color = meta?.color ?? UltraTheme.primary;
          final label = meta?.label ?? 'Tous';
          return GestureDetector(
            onTap: () {
              setState(() => _typeFilter = t);
              _applyFilters();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: isActive ? color : UltraTheme.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isActive
                      ? color
                      : UltraTheme.textMuted.withValues(alpha: 0.2),
                ),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                if (meta != null) ...[
                  Icon(meta.icon,
                      size: 14, color: isActive ? Colors.white : color),
                  const SizedBox(width: 5),
                ],
                Text(label,
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: isActive ? Colors.white : UltraTheme.textMuted)),
              ]),
            ),
          );
        },
      ),
    );
  }

  // ── Search bar ────────────────────────────────────────────
  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
      child: TextField(
        controller: _searchCtrl,
        onChanged: (v) {
          _searchQuery = v;
          _applyFilters();
        },
        style: const TextStyle(fontFamily: 'Inter', fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Rechercher un organisme...',
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
            borderSide: const BorderSide(color: Color(0xFF3B82F6), width: 1.5),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }

  // ── Body ─────────────────────────────────────────────────
  Widget _buildBody() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation(Color(0xFF3B82F6))));
    }
    if (_error != null) return _buildError();
    if (_filtered.isEmpty) return _buildEmpty();

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
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
          child: _buildItemCard(_filtered[i]),
        );
      },
    );
  }

  // ── Item card ─────────────────────────────────────────────
  Widget _buildItemCard(Map<String, dynamic> item) {
    final typeRaw =
        ((item['entityType'] ?? 'enterprise') as String).toLowerCase();
    final meta = _typeMeta[typeRaw] ??
        (
          label: 'Entreprise',
          icon: Icons.business_rounded,
          color: UltraTheme.primary
        );
    final name = (item['companyName'] ??
        item['cooperativeName'] ??
        item['ctdName'] ??
        item['ngoName'] ??
        item['name'] ??
        'Organisme') as String;
    final status = (item['status'] as String?) ?? 'SUBMITTED';
    final statusMeta =
        _statusMeta[status] ?? (label: status, color: UltraTheme.textMuted);
    final id = item['id'] as String? ?? '';
    final region = item['region'] as String?;
    final submittedAt =
        item['submittedAt'] as String? ?? item['createdAt'] as String?;

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
          onTap: () => _showDetailSheet(item, name, id),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              Row(children: [
                // Type icon
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: meta.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Center(
                      child: Icon(meta.icon, color: meta.color, size: 22)),
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
                          _TypeTag(label: meta.label, color: meta.color),
                          if (region != null) ...[
                            const SizedBox(width: 8),
                            const Icon(Icons.location_on_outlined,
                                size: 12, color: UltraTheme.textMuted),
                            const SizedBox(width: 3),
                            Flexible(
                              child: Text(region,
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
                // Status + date column
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  _StatusBadge(
                      label: statusMeta.label, color: statusMeta.color),
                  if (submittedAt != null) ...[
                    const SizedBox(height: 4),
                    Text(_formatDate(submittedAt),
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 11,
                            color: UltraTheme.textMuted)),
                  ],
                ]),
              ]),
              // Action buttons — only for SUBMITTED items
              if (status == 'SUBMITTED') ...[
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _updateStatus(id, 'REJECTED', name),
                      icon: const Icon(Icons.close_rounded, size: 14),
                      label: const Text('Rejeter'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: UltraTheme.error,
                        side: BorderSide(
                            color: UltraTheme.error.withValues(alpha: 0.4)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        textStyle: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _updateStatus(id, 'APPROVED', name),
                      icon: const Icon(Icons.check_rounded, size: 14),
                      label: const Text('Approuver'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: UltraTheme.success,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        textStyle: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ]),
              ],
            ]),
          ),
        ),
      ),
    );
  }

  // ── Detail sheet ──────────────────────────────────────────
  void _showDetailSheet(Map<String, dynamic> item, String name, String id) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
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
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
                children: [
                  Text(name,
                      style: UltraTheme.displayMedium.copyWith(fontSize: 20)),
                  const SizedBox(height: 16),
                  ...item.entries
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
                                    width: 130,
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
            color: UltraTheme.primary.withValues(alpha: 0.07),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Icon(Icons.assignment_turned_in_rounded,
              size: 40, color: UltraTheme.primary.withValues(alpha: 0.6)),
        ),
        const SizedBox(height: 20),
        Text(
            _searchQuery.isNotEmpty || _typeFilter != null
                ? 'Aucun résultat'
                : 'Aucun questionnaire en attente',
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textPrimary)),
        const SizedBox(height: 8),
        Text(
            _searchQuery.isNotEmpty || _typeFilter != null
                ? 'Modifiez vos filtres de recherche'
                : 'Les questionnaires soumis apparaîtront ici',
            style: const TextStyle(
                fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted),
            textAlign: TextAlign.center),
        if (_searchQuery.isNotEmpty || _typeFilter != null) ...[
          const SizedBox(height: 16),
          TextButton(
            onPressed: () {
              _searchCtrl.clear();
              _searchQuery = '';
              _typeFilter = null;
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
          onPressed: _loadItems,
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

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      return '${d.day}/${d.month}/${d.year}';
    } catch (_) {
      return iso;
    }
  }
}

// ══════════════════════════════════════════════════════════════
// Private helper widgets
// ══════════════════════════════════════════════════════════════

/// Compact inline stat pill: "0  Total"
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

/// Circular refresh button — subtle, top-right of stat strip
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

/// Tiny coloured type label
class _TypeTag extends StatelessWidget {
  const _TypeTag({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label,
          style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: color)),
    );
  }
}

/// Pill-shaped status badge
class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label,
          style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color)),
    );
  }
}
