import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../theme/ultra_theme.dart';
import '../../../widgets/common_widgets.dart';
import '../../../widgets/admin_kit.dart';

// ══════════════════════════════════════════════════════════════
// UsersDirectoryScreen — single searchable/filterable roster of
// every non-COMPANY user (pending approval, active, suspended,
// rejected). Replaces the old PendingUsersScreen/ActiveUsersScreen
// pair, which lived behind a second, nested layer of tabs inside
// the Annuaire's "Utilisateurs" tab. One table, a status filter,
// row actions that change with the row's status.
// ══════════════════════════════════════════════════════════════

const _pageSize = 20;

const _tableHeaderStyle = TextStyle(
    fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w700, color: UltraTheme.textSecondary);
const _tableCellStyle = TextStyle(fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textPrimary);

enum _StatusFilter { all, pending, active, suspended, rejected }

extension on _StatusFilter {
  String get label => switch (this) {
        _StatusFilter.all => 'Tous',
        _StatusFilter.pending => 'En attente',
        _StatusFilter.active => 'Actifs',
        _StatusFilter.suspended => 'Suspendus',
        _StatusFilter.rejected => 'Rejetés',
      };

  String? get status => switch (this) {
        _StatusFilter.all => null,
        _StatusFilter.pending => 'PENDING_APPROVAL',
        _StatusFilter.active => 'ACTIVE',
        _StatusFilter.suspended => 'ACTIVE',
        _StatusFilter.rejected => 'REJECTED',
      };

  bool? get isActive => switch (this) {
        _StatusFilter.active => true,
        _StatusFilter.suspended => false,
        _ => null,
      };

  Color get color => switch (this) {
        _StatusFilter.all => UltraTheme.primary,
        _StatusFilter.pending => UltraTheme.warning,
        _StatusFilter.active => UltraTheme.success,
        _StatusFilter.suspended => UltraTheme.error,
        _StatusFilter.rejected => UltraTheme.textMuted,
      };
}

({String label, Color color, IconData icon}) _rowStatusMeta(Map u) {
  final status = u['status'] as String? ?? 'ACTIVE';
  if (status == 'PENDING_APPROVAL') {
    return (label: 'En attente', color: UltraTheme.warning, icon: Icons.hourglass_empty_rounded);
  }
  if (status == 'REJECTED') {
    return (label: 'Rejeté', color: UltraTheme.textMuted, icon: Icons.block_rounded);
  }
  final isActive = u['isActive'] == true;
  return isActive
      ? (label: 'Actif', color: UltraTheme.success, icon: Icons.check_circle_outline_rounded)
      : (label: 'Suspendu', color: UltraTheme.error, icon: Icons.pause_circle_outline_rounded);
}

class UsersDirectoryScreen extends ConsumerStatefulWidget {
  const UsersDirectoryScreen({super.key});

  @override
  ConsumerState<UsersDirectoryScreen> createState() => _UsersDirectoryScreenState();
}

class _UsersDirectoryScreenState extends ConsumerState<UsersDirectoryScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  List<dynamic> _users = [];
  bool _loading = true;
  String? _error;
  int _page = 1;
  int _total = 0;
  String? _roleFilter;
  // Pending approvals are the actionable default — admins land here
  // to clear the queue, not to browse the whole roster.
  _StatusFilter _statusFilter = _StatusFilter.pending;

  int get _totalPages => (_total / _pageSize).ceil().clamp(1, 999999);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.listUsers(
        search: _searchCtrl.text.trim(),
        role: _roleFilter,
        status: _statusFilter.status,
        isActive: _statusFilter.isActive,
        page: _page,
        pageSize: _pageSize,
      );
      if (!mounted) return;
      setState(() {
        _users = resp['users'] as List? ?? [];
        _total = resp['total'] as int? ?? _users.length;
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

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      _page = 1;
      _load();
    });
  }

  void _setRoleFilter(String? role) {
    setState(() => _roleFilter = role);
    _page = 1;
    _load();
  }

  void _setStatusFilter(_StatusFilter f) {
    setState(() => _statusFilter = f);
    _page = 1;
    _load();
  }

  void _changePage(int delta) {
    final next = _page + delta;
    if (next < 1 || next > _totalPages) return;
    setState(() => _page = next);
    _load();
  }

  String _name(Map u) => '${u['firstName'] ?? ''} ${u['lastName'] ?? ''}'.trim();

  // ── Actions ────────────────────────────────────────────────

  Future<void> _approveUser(Map u) async {
    final name = _name(u);
    final confirmed = await showAdminConfirmSheet(
      context,
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
      await api.patch('/auth/approve-user/${u['id']}');
      if (!mounted) return;
      _load();
      showAdminToast(context, '$name approuvé avec succès', UltraTheme.success,
          Icons.check_circle_rounded);
    } catch (e) {
      if (!mounted) return;
      showAdminToast(context, 'Erreur: $e', UltraTheme.error, Icons.error_rounded);
    }
  }

  Future<void> _rejectUser(Map u) async {
    final name = _name(u);
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
      await api.patch('/auth/reject-user/${u['id']}', data: {'reason': reason});
      if (!mounted) return;
      _load();
      showAdminToast(context, '$name rejeté', UltraTheme.warning, Icons.block_rounded);
    } catch (e) {
      if (!mounted) return;
      showAdminToast(context, 'Erreur: $e', UltraTheme.error, Icons.error_rounded);
    }
  }

  Future<void> _editRole(Map u) async {
    final newRole = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _RoleSelectSheet(currentRole: u['role'] as String? ?? ''),
    );
    if (newRole == null || newRole == u['role']) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.updateUserRole(u['id'], newRole);
      if (!mounted) return;
      _load();
      showAdminToast(context, 'Rôle mis à jour : ${roleLabel(newRole)}',
          UltraTheme.success, Icons.check_circle_rounded);
    } catch (e) {
      if (!mounted) return;
      showAdminToast(context, 'Erreur : $e', UltraTheme.error, Icons.error_rounded);
    }
  }

  Future<void> _toggleActive(Map u) async {
    final isActive = u['isActive'] == true;
    final name = _name(u);
    final confirmed = await showAdminConfirmSheet(
      context,
      icon: isActive ? Icons.pause_circle_outline_rounded : Icons.play_circle_outline_rounded,
      iconColor: isActive ? UltraTheme.warning : UltraTheme.success,
      title: isActive ? 'Suspendre le compte' : 'Réactiver le compte',
      body: isActive
          ? '$name ne pourra plus se connecter jusqu\'à réactivation.'
          : '$name pourra de nouveau se connecter.',
      confirmLabel: isActive ? 'Suspendre' : 'Réactiver',
      confirmColor: isActive ? UltraTheme.warning : UltraTheme.success,
    );
    if (confirmed != true) return;
    try {
      final api = ref.read(apiClientProvider);
      if (isActive) {
        await api.suspendUser(u['id']);
      } else {
        await api.activateUser(u['id']);
      }
      if (!mounted) return;
      _load();
      showAdminToast(context, isActive ? '$name suspendu' : '$name réactivé',
          UltraTheme.success, Icons.check_circle_rounded);
    } catch (e) {
      if (!mounted) return;
      showAdminToast(context, 'Erreur : $e', UltraTheme.error, Icons.error_rounded);
    }
  }

  Future<void> _deleteUser(Map u) async {
    final name = _name(u);
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _DeleteConfirmSheet(
        name: name,
        email: u['email'] as String? ?? '',
      ),
    );
    if (confirmed != true) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.deleteUser(u['id']);
      if (!mounted) return;
      _load();
      showAdminToast(context, '$name supprimé', UltraTheme.success, Icons.check_circle_rounded);
    } catch (e) {
      if (!mounted) return;
      final msg = e is ApiException ? e.message : e.toString();
      showAdminToast(context, msg, UltraTheme.error, Icons.error_rounded);
    }
  }

  // ── Row actions widget (varies with status) ───────────────
  Widget _rowActions(Map u) {
    final status = u['status'] as String? ?? 'ACTIVE';

    if (status == 'PENDING_APPROVAL') {
      return Row(mainAxisSize: MainAxisSize.min, children: [
        IconButton(
          tooltip: 'Rejeter',
          icon: const Icon(Icons.close_rounded, color: UltraTheme.error, size: 18),
          onPressed: () => _rejectUser(u),
        ),
        IconButton(
          tooltip: 'Approuver',
          icon: const Icon(Icons.check_rounded, color: UltraTheme.success, size: 18),
          onPressed: () => _approveUser(u),
        ),
      ]);
    }

    if (status == 'REJECTED') {
      return IconButton(
        tooltip: 'Supprimer',
        icon: const Icon(Icons.delete_outline_rounded, color: UltraTheme.error, size: 18),
        onPressed: () => _deleteUser(u),
      );
    }

    final isActive = u['isActive'] == true;
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert_rounded, color: UltraTheme.textMuted),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onSelected: (action) {
        switch (action) {
          case 'role':
            _editRole(u);
            break;
          case 'toggle':
            _toggleActive(u);
            break;
          case 'delete':
            _deleteUser(u);
            break;
        }
      },
      itemBuilder: (ctx) => [
        const PopupMenuItem(
          value: 'role',
          child: Row(children: [
            Icon(Icons.badge_outlined, size: 18, color: UltraTheme.textSecondary),
            SizedBox(width: 10),
            Text('Modifier le rôle'),
          ]),
        ),
        PopupMenuItem(
          value: 'toggle',
          child: Row(children: [
            Icon(
                isActive
                    ? Icons.pause_circle_outline_rounded
                    : Icons.play_circle_outline_rounded,
                size: 18,
                color: UltraTheme.textSecondary),
            const SizedBox(width: 10),
            Text(isActive ? 'Suspendre' : 'Réactiver'),
          ]),
        ),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: 'delete',
          child: Row(children: [
            Icon(Icons.delete_outline_rounded, size: 18, color: UltraTheme.error),
            SizedBox(width: 10),
            Text('Supprimer', style: TextStyle(color: UltraTheme.error)),
          ]),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      body: LayoutBuilder(builder: (context, constraints) {
        final isDesktop = constraints.maxWidth >= 760;
        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _buildToolbar()),
            if (_loading)
              const SliverFillRemaining(
                  child: Center(
                      child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation(UltraTheme.primary))))
            else if (_error != null)
              SliverFillRemaining(child: _buildError())
            else if (_users.isEmpty)
              SliverFillRemaining(child: _buildEmpty())
            else if (isDesktop)
              SliverToBoxAdapter(child: _buildDesktopTable())
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _buildUserCard(_users[i] as Map),
                    childCount: _users.length,
                  ),
                ),
              ),
            if (!_loading && _error == null && _users.isNotEmpty)
              SliverToBoxAdapter(child: _buildPagination()),
          ],
        );
      }),
    );
  }

  Widget _buildToolbar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        AdminSearchField(
          controller: _searchCtrl,
          onChanged: _onSearchChanged,
          hintText: 'Rechercher par nom, email, matricule...',
        ),
        const SizedBox(height: 10),
        SizedBox(height: 36, child: _buildStatusPills()),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _buildRoleFilterDropdown()),
          const SizedBox(width: 8),
          AdminRefreshButton(onTap: _load),
        ]),
        const SizedBox(height: 8),
        Text('$_total compte${_total == 1 ? '' : 's'}',
            style: const TextStyle(
                fontFamily: 'Inter', fontSize: 12, color: UltraTheme.textMuted)),
      ]),
    );
  }

  Widget _buildStatusPills() {
    return ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: _StatusFilter.values.length,
      separatorBuilder: (_, __) => const SizedBox(width: 8),
      itemBuilder: (_, i) {
        final f = _StatusFilter.values[i];
        final isSelected = _statusFilter == f;
        return GestureDetector(
          onTap: () => _setStatusFilter(f),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: isSelected ? f.color : UltraTheme.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                  color: isSelected ? f.color : UltraTheme.textMuted.withValues(alpha: 0.2)),
            ),
            child: Center(
              child: Text(f.label,
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: isSelected ? Colors.white : UltraTheme.textMuted)),
            ),
          ),
        );
      },
    );
  }

  Widget _buildRoleFilterDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.15)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String?>(
          value: _roleFilter,
          isExpanded: true,
          icon: const Icon(Icons.expand_more_rounded, size: 18, color: UltraTheme.textMuted),
          style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textPrimary),
          hint: const Text('Tous les rôles',
              style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted)),
          items: [
            const DropdownMenuItem(value: null, child: Text('Tous les rôles')),
            ...kAssignableRoles
                .map((r) => DropdownMenuItem(value: r, child: Text(roleLabel(r)))),
          ],
          onChanged: _setRoleFilter,
        ),
      ),
    );
  }

  // ── Desktop table ─────────────────────────────────────────
  Widget _buildDesktopTable() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: UltraTheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
        ),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowColor: WidgetStateProperty.all(UltraTheme.background),
            columns: const [
              DataColumn(label: Text('Nom', style: _tableHeaderStyle)),
              DataColumn(label: Text('Email', style: _tableHeaderStyle)),
              DataColumn(label: Text('Rôle', style: _tableHeaderStyle)),
              DataColumn(label: Text('Région / Département', style: _tableHeaderStyle)),
              DataColumn(label: Text('Statut', style: _tableHeaderStyle)),
              DataColumn(label: Text('Actions', style: _tableHeaderStyle)),
            ],
            rows: _users.map((raw) {
              final u = raw as Map;
              final name = _name(u);
              final role = u['role'] as String? ?? '';
              final statusMeta = _rowStatusMeta(u);
              final location = [u['region'], u['department']]
                  .where((e) => e != null && (e as String).isNotEmpty)
                  .join(' · ');
              return DataRow(cells: [
                DataCell(Text(name, style: _tableCellStyle)),
                DataCell(Text(u['email'] as String? ?? '', style: _tableCellStyle)),
                DataCell(StatusBadge(label: roleLabel(role), color: roleColor(role))),
                DataCell(Text(location.isEmpty ? '—' : location, style: _tableCellStyle)),
                DataCell(StatusBadge(
                    label: statusMeta.label, color: statusMeta.color, icon: statusMeta.icon)),
                DataCell(_rowActions(u)),
              ]);
            }).toList(),
          ),
        ),
      ),
    );
  }

  // ── Card (mobile) ──────────────────────────────────────────
  Widget _buildUserCard(Map u) {
    final name = _name(u);
    final role = u['role'] as String? ?? '';
    final statusMeta = _rowStatusMeta(u);
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
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: UltraTheme.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: Text(initial,
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w700,
                      color: UltraTheme.primary,
                      fontSize: 18)),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name,
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: UltraTheme.textPrimary)),
              const SizedBox(height: 2),
              Text(u['email'] ?? '',
                  style: const TextStyle(
                      fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted)),
              const SizedBox(height: 8),
              Wrap(spacing: 6, runSpacing: 6, children: [
                StatusBadge(label: roleLabel(role), color: roleColor(role)),
                StatusBadge(
                    label: statusMeta.label, color: statusMeta.color, icon: statusMeta.icon),
              ]),
            ]),
          ),
          _rowActions(u),
        ]),
      ),
    );
  }

  Widget _buildPagination() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        IconButton(
          onPressed: _page > 1 ? () => _changePage(-1) : null,
          icon: const Icon(Icons.chevron_left_rounded),
          color: UltraTheme.textSecondary,
        ),
        Text('Page $_page sur $_totalPages',
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: UltraTheme.textSecondary)),
        IconButton(
          onPressed: _page < _totalPages ? () => _changePage(1) : null,
          icon: const Icon(Icons.chevron_right_rounded),
          color: UltraTheme.textSecondary,
        ),
      ]),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: UltraTheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Icon(Icons.people_outline_rounded, size: 40, color: UltraTheme.primary),
        ),
        const SizedBox(height: 20),
        const Text('Aucun compte trouvé',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textPrimary)),
        const SizedBox(height: 8),
        const Text('Essayez une autre recherche ou un autre filtre.',
            style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted)),
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
          child: const Icon(Icons.wifi_off_rounded, size: 36, color: UltraTheme.error),
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
            style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted)),
        const SizedBox(height: 24),
        ElevatedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh_rounded, size: 16),
          label: const Text('Réessayer'),
          style: ElevatedButton.styleFrom(
            backgroundColor: UltraTheme.primary,
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ]),
    );
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
// Role-select bottom sheet
// ══════════════════════════════════════════════════════════════

class _RoleSelectSheet extends StatelessWidget {
  const _RoleSelectSheet({required this.currentRole});
  final String currentRole;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      decoration: const BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 40,
          height: 4,
          margin: const EdgeInsets.only(bottom: 20),
          decoration: BoxDecoration(
            color: UltraTheme.textMuted.withValues(alpha: 0.25),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const Text('Modifier le rôle',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: UltraTheme.textPrimary)),
        const SizedBox(height: 16),
        ...kAssignableRoles.map((r) {
          final selected = r == currentRole;
          return ListTile(
            onTap: () => Navigator.pop(context, r),
            contentPadding: EdgeInsets.zero,
            title: Text(roleLabel(r),
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected ? UltraTheme.primary : UltraTheme.textPrimary)),
            trailing: selected
                ? const Icon(Icons.check_circle_rounded, color: UltraTheme.primary, size: 20)
                : null,
          );
        }),
      ]),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// Delete confirmation — requires typing the account email, since
// this is a hard, irreversible delete against the production DB.
// ══════════════════════════════════════════════════════════════

class _DeleteConfirmSheet extends StatefulWidget {
  const _DeleteConfirmSheet({required this.name, required this.email});
  final String name;
  final String email;

  @override
  State<_DeleteConfirmSheet> createState() => _DeleteConfirmSheetState();
}

class _DeleteConfirmSheetState extends State<_DeleteConfirmSheet> {
  final _ctrl = TextEditingController();
  bool _matches = false;

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
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 24),
              decoration: BoxDecoration(
                color: UltraTheme.textMuted.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Center(
            child: Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: UltraTheme.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(Icons.delete_outline_rounded, color: UltraTheme.error, size: 30),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text('Supprimer ${widget.name} ?',
                style: UltraTheme.displayMedium.copyWith(fontSize: 18)),
          ),
          const SizedBox(height: 8),
          const Text(
            'Action irréversible. Si ce compte a des déclarations, soumissions ou '
            'notifications liées, la suppression sera refusée — suspendez-le à la place.',
            textAlign: TextAlign.center,
            style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted),
          ),
          const SizedBox(height: 16),
          Text('Tapez "${widget.email}" pour confirmer',
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: UltraTheme.textMuted)),
          const SizedBox(height: 8),
          TextField(
            controller: _ctrl,
            onChanged: (v) => setState(() => _matches = v.trim() == widget.email),
            style: const TextStyle(fontFamily: 'Inter', fontSize: 14),
            decoration: InputDecoration(
              hintText: widget.email,
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
                borderSide: const BorderSide(color: UltraTheme.error, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context, false),
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
                onPressed: _matches ? () => Navigator.pop(context, true) : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: UltraTheme.error,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: UltraTheme.error.withValues(alpha: 0.3),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Supprimer',
                    style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w600)),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}
