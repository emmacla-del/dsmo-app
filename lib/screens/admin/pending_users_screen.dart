import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../theme/ultra_theme.dart';

// ══════════════════════════════════════════════════════════════
// PendingUsersScreen — no redundant gradient banner,
// compact stat strip, consistent with app-bar context.
// ══════════════════════════════════════════════════════════════

class PendingUsersScreen extends ConsumerStatefulWidget {
  const PendingUsersScreen({super.key});

  @override
  ConsumerState<PendingUsersScreen> createState() => _PendingUsersScreenState();
}

class _PendingUsersScreenState extends ConsumerState<PendingUsersScreen>
    with SingleTickerProviderStateMixin {
  List<dynamic> _users = [];
  bool _loading = true;
  String? _error;
  late AnimationController _animCtrl;

  // ── stat helpers ──────────────────────────────────────────
  int get _total => _users.length;
  int get _regional => _users.where((u) => u['role'] == 'REGIONAL').length;
  int get _divisional => _users.where((u) => u['role'] == 'DIVISIONAL').length;
  int get _central => _users.where((u) => u['role'] == 'CENTRAL').length;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    _loadPendingUsers();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPendingUsers() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.get('/auth/pending-minefop');
      setState(() {
        _users = resp.data as List;
        _loading = false;
      });
      _animCtrl.forward(from: 0);
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _approveUser(String id, String name) async {
    final confirmed = await _showConfirmSheet(
      icon: Icons.check_circle_rounded,
      iconColor: UltraTheme.success,
      title: "Approuver l'agent",
      body: 'Confirmer l\'approbation de $name ?',
      confirmLabel: 'Approuver',
      confirmColor: UltraTheme.success,
    );
    if (confirmed != true) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/auth/approve-user/$id');
      if (!mounted) return;
      _loadPendingUsers();
      _toast('$name approuvé avec succès', UltraTheme.success,
          Icons.check_circle_rounded);
    } catch (e) {
      if (!mounted) return;
      _toast('Erreur: $e', UltraTheme.error, Icons.error_rounded);
    }
  }

  Future<void> _rejectUser(String id, String name) async {
    String reason = '';
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _RejectReasonSheet(
        name: name,
        onReject: (r) {
          reason = r;
          Navigator.pop(ctx, true);
        },
        onCancel: () => Navigator.pop(ctx, false),
      ),
    );
    if (confirmed != true) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/auth/reject-user/$id', data: {'reason': reason});
      if (!mounted) return;
      _loadPendingUsers();
      _toast('$name rejeté', UltraTheme.warning, Icons.block_rounded);
    } catch (e) {
      if (!mounted) return;
      _toast('Erreur: $e', UltraTheme.error, Icons.error_rounded);
    }
  }

  Future<bool?> _showConfirmSheet({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String body,
    required String confirmLabel,
    required Color confirmColor,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
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
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(icon, color: iconColor, size: 32),
          ),
          const SizedBox(height: 16),
          Text(title, style: UltraTheme.displayMedium.copyWith(fontSize: 20)),
          const SizedBox(height: 8),
          Text(body, textAlign: TextAlign.center, style: UltraTheme.bodyMedium),
          const SizedBox(height: 24),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.pop(ctx, false),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: BorderSide(
                      color: UltraTheme.textMuted.withValues(alpha: 0.3)),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
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
                onPressed: () => Navigator.pop(ctx, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: confirmColor,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(confirmLabel,
                    style: const TextStyle(
                        fontFamily: 'Inter', fontWeight: FontWeight.w600)),
              ),
            ),
          ]),
        ]),
      ),
    );
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
      body: CustomScrollView(
        slivers: [
          // ── Compact stat strip (replaces gradient banner) ──
          if (!_loading && _error == null)
            SliverToBoxAdapter(child: _buildStatStrip()),

          if (_loading)
            const SliverFillRemaining(
                child: Center(
                    child: CircularProgressIndicator(
                        valueColor:
                            AlwaysStoppedAnimation(UltraTheme.primary))))
          else if (_error != null)
            SliverFillRemaining(child: _buildError())
          else if (_users.isEmpty)
            SliverFillRemaining(child: _buildEmpty())
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => AnimatedBuilder(
                    animation: _animCtrl,
                    builder: (_, child) {
                      final delay = i * 0.08;
                      final progress =
                          (_animCtrl.value - delay).clamp(0.0, 1.0);
                      return Opacity(
                        opacity: Curves.easeOut.transform(progress),
                        child: Transform.translate(
                          offset: Offset(
                              0, 20 * (1 - Curves.easeOut.transform(progress))),
                          child: child,
                        ),
                      );
                    },
                    child: _buildUserCard(_users[i]),
                  ),
                  childCount: _users.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ── Stat strip ────────────────────────────────────────────
  Widget _buildStatStrip() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
      child: Row(children: [
        _StatPill(value: _total, label: 'Total', color: UltraTheme.primary),
        const SizedBox(width: 8),
        _StatPill(value: _regional, label: 'Régional', color: UltraTheme.info),
        const SizedBox(width: 8),
        _StatPill(
            value: _divisional, label: 'Division', color: UltraTheme.accent),
        const SizedBox(width: 8),
        _StatPill(value: _central, label: 'Central', color: UltraTheme.warning),
        const Spacer(),
        _RefreshButton(onTap: _loadPendingUsers),
      ]),
    );
  }

  // ── User card ─────────────────────────────────────────────
  Widget _buildUserCard(Map<String, dynamic> u) {
    final name = '${u['firstName'] ?? ''} ${u['lastName'] ?? ''}'.trim();
    final role = u['role'] as String? ?? '';
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Row(children: [
            // Avatar
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: UltraTheme.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(
                child: Text(initial,
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontWeight: FontWeight.w700,
                        color: UltraTheme.primary,
                        fontSize: 18)),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name,
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: UltraTheme.textPrimary)),
                    const SizedBox(height: 2),
                    Text(u['email'] ?? '',
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 13,
                            color: UltraTheme.textMuted)),
                  ]),
            ),
            _RoleBadge(role: role),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            if (u['matricule'] != null)
              _DetailChip(icon: Icons.badge_outlined, label: u['matricule']),
            if (u['serviceCode'] != null) ...[
              const SizedBox(width: 8),
              _DetailChip(
                  icon: Icons.business_outlined, label: u['serviceCode']),
            ],
            const Spacer(),
            _DetailChip(
                icon: Icons.calendar_today_outlined,
                label: _formatDate(u['createdAt'] ?? '')),
          ]),
          const SizedBox(height: 14),
          Divider(
              height: 1, color: UltraTheme.textMuted.withValues(alpha: 0.15)),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _rejectUser(u['id'], name),
                icon: const Icon(Icons.close_rounded, size: 16),
                label: const Text('Rejeter'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: UltraTheme.error,
                  side: BorderSide(
                      color: UltraTheme.error.withValues(alpha: 0.4)),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  textStyle: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => _approveUser(u['id'], name),
                icon: const Icon(Icons.check_rounded, size: 16),
                label: const Text('Approuver'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: UltraTheme.success,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  textStyle: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ]),
        ]),
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
            color: UltraTheme.success.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Icon(Icons.check_circle_outline_rounded,
              size: 40, color: UltraTheme.success),
        ),
        const SizedBox(height: 20),
        const Text('Aucune demande en attente',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textPrimary)),
        const SizedBox(height: 8),
        const Text('Toutes les demandes ont été traitées.',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: UltraTheme.textMuted)),
        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: _loadPendingUsers,
          icon: const Icon(Icons.refresh_rounded, size: 16),
          label: const Text('Rafraîchir'),
          style: OutlinedButton.styleFrom(
            foregroundColor: UltraTheme.primary,
            side: const BorderSide(color: UltraTheme.primary),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
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
          child: const Icon(Icons.wifi_off_rounded,
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
          onPressed: _loadPendingUsers,
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
// Reject reason bottom sheet
// ══════════════════════════════════════════════════════════════

class _RejectReasonSheet extends StatefulWidget {
  const _RejectReasonSheet(
      {required this.name, required this.onReject, required this.onCancel});
  final String name;
  final ValueChanged<String> onReject;
  final VoidCallback onCancel;

  @override
  State<_RejectReasonSheet> createState() => _RejectReasonSheetState();
}

class _RejectReasonSheetState extends State<_RejectReasonSheet> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
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
              color: UltraTheme.error.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.block_rounded,
                color: UltraTheme.error, size: 30),
          ),
          const SizedBox(height: 16),
          Text('Rejeter ${widget.name}',
              style: UltraTheme.displayMedium.copyWith(fontSize: 18)),
          const SizedBox(height: 8),
          const Text('Motif du rejet (optionnel)',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: UltraTheme.textMuted)),
          const SizedBox(height: 16),
          TextField(
            controller: _ctrl,
            maxLines: 3,
            style: const TextStyle(fontFamily: 'Inter', fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Ex: Documents incomplets...',
              hintStyle: const TextStyle(
                  fontFamily: 'Inter', color: UltraTheme.textMuted),
              filled: true,
              fillColor: UltraTheme.background,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(
                    color: UltraTheme.textMuted.withValues(alpha: 0.2)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(
                    color: UltraTheme.textMuted.withValues(alpha: 0.2)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide:
                    const BorderSide(color: UltraTheme.error, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: widget.onCancel,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: BorderSide(
                      color: UltraTheme.textMuted.withValues(alpha: 0.3)),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
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
                onPressed: () => widget.onReject(_ctrl.text.trim()),
                style: ElevatedButton.styleFrom(
                  backgroundColor: UltraTheme.error,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Confirmer le rejet',
                    style: TextStyle(
                        fontFamily: 'Inter', fontWeight: FontWeight.w600)),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// Small helper widgets
// ══════════════════════════════════════════════════════════════

class _StatPill extends StatelessWidget {
  const _StatPill(
      {required this.value, required this.label, required this.color});
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
        Text('$value',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: color)),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: color.withValues(alpha: 0.75))),
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

class _RoleBadge extends StatelessWidget {
  const _RoleBadge({required this.role});
  final String role;

  static final _colors = {
    'REGIONAL': UltraTheme.info,
    'DIVISIONAL': UltraTheme.accent,
    'CENTRAL': UltraTheme.warning,
  };

  @override
  Widget build(BuildContext context) {
    final color = _colors[role] ?? UltraTheme.primary;
    final label = role.replaceAll('_', ' ');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
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

class _DetailChip extends StatelessWidget {
  const _DetailChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 13, color: UltraTheme.textMuted),
      const SizedBox(width: 5),
      Text(label,
          style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              color: UltraTheme.textMuted,
              fontWeight: FontWeight.w500)),
    ]);
  }
}
