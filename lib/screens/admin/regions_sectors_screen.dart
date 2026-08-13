// lib/screens/admin/regions_sectors_screen.dart
//
// Region/sector reference-data management (rename, delete, view usage
// counts) — the taxonomy underlying every region/sector filter and
// dropdown in the app. Reached from Paramètres; this used to be bundled
// into a standalone "Data Mgmt" tab alongside bulk submission export,
// which has since moved to the Soumissions screen where that data
// actually lives (see onefop_export_panel.dart).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/ultra_theme.dart';
import '../../data/api_client.dart';
import '../../widgets/responsive_helpers.dart';
import '../../widgets/admin_kit.dart';

class RegionsSectorsScreen extends ConsumerStatefulWidget {
  const RegionsSectorsScreen({super.key});

  @override
  ConsumerState<RegionsSectorsScreen> createState() =>
      _RegionsSectorsScreenState();
}

class _RegionsSectorsScreenState extends ConsumerState<RegionsSectorsScreen> {
  List<dynamic> _regions = [];
  List<dynamic> _sectors = [];
  Map<String, dynamic>? _stats;
  bool _isLoading = true;

  String _searchQuery = '';
  String _typeFilter = 'ALL'; // ALL | REGION | SECTOR

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final api = ref.read(apiClientProvider);
      final [regions, sectors, stats] = await Future.wait([
        api.get('/data-management/regions'),
        api.get('/data-management/sectors'),
        api.get('/data-management/stats'),
      ]);
      setState(() {
        _regions = regions.data;
        _sectors = sectors.data;
        _stats = stats.data as Map<String, dynamic>;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error loading data: $e');
      setState(() => _isLoading = false);
      if (!mounted) return;
      showAdminToast(context, 'Erreur de chargement : $e', UltraTheme.error,
          Icons.error_outline_rounded);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        title: const Text('Régions & Secteurs',
            style: TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation(UltraTheme.primary)))
          : _buildUnifiedTable(),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RÉGIONS + SECTEURS — one screen, two purpose-built tables
  // (kept separate because the two entities don't share columns:
  // régions have "Départements", secteurs have "Catégorie" — a merged
  // table left half of every row's cells blank and unreadable).
  // ═══════════════════════════════════════════════════════════

  List<dynamic> get _filteredRegions {
    final q = _searchQuery.trim().toLowerCase();
    if (_typeFilter == 'SECTOR') return const [];
    final list = q.isEmpty
        ? _regions
        : _regions
            .where((r) =>
                ((r['name'] as String?) ?? '').toLowerCase().contains(q) ||
                ((r['code'] as String?) ?? '').toLowerCase().contains(q))
            .toList();
    return [...list]
      ..sort((a, b) =>
          ((a['name'] as String?) ?? '').compareTo((b['name'] as String?) ?? ''));
  }

  List<dynamic> get _filteredSectors {
    final q = _searchQuery.trim().toLowerCase();
    if (_typeFilter == 'REGION') return const [];
    final list = q.isEmpty
        ? _sectors
        : _sectors
            .where((s) =>
                ((s['name'] as String?) ?? '').toLowerCase().contains(q) ||
                ((s['code'] as String?) ?? '').toLowerCase().contains(q))
            .toList();
    return [...list]
      ..sort((a, b) =>
          ((a['name'] as String?) ?? '').compareTo((b['name'] as String?) ?? ''));
  }

  Widget _buildUnifiedTable() {
    final regions = _filteredRegions;
    final sectors = _filteredSectors;
    final hasAny = regions.isNotEmpty || sectors.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
          child: _buildStatsStrip(),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: _buildTableToolbar(),
        ),
        Expanded(
          child: !hasAny
              ? _buildEmptyState(
                  icon: Icons.table_rows_outlined,
                  title: 'Aucun résultat',
                  subtitle:
                      'Aucune région ou secteur ne correspond à votre recherche.',
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  children: [
                    if (regions.isNotEmpty) ...[
                      _buildSectionHeader(
                          'Régions', regions.length, Icons.map_outlined,
                          UltraTheme.info),
                      const SizedBox(height: 10),
                      _buildRegionsTable(regions),
                      const SizedBox(height: 28),
                    ],
                    if (sectors.isNotEmpty) ...[
                      _buildSectionHeader('Secteurs', sectors.length,
                          Icons.business_outlined, UltraTheme.success),
                      const SizedBox(height: 10),
                      _buildSectorsTable(sectors),
                    ],
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(
      String title, int count, IconData icon, Color color) {
    return Row(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 8),
        Text('$title ($count)',
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: UltraTheme.textPrimary)),
      ],
    );
  }

  Widget _buildStatsStrip() {
    final totals = (_stats?['totals'] as Map?) ?? {};
    final items = <(String, dynamic)>[
      ('Entreprises', totals['companies'] ?? 0),
      ('Déclarations', totals['declarations'] ?? 0),
      ('Soumissions ONEFOP', totals['onefopSubmissions'] ?? 0),
      ('Utilisateurs', totals['users'] ?? 0),
    ];
    return Wrap(
      spacing: 22,
      runSpacing: 6,
      children: items
          .map((e) => RichText(
                text: TextSpan(children: [
                  TextSpan(
                      text: '${e.$2} ',
                      style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: UltraTheme.textPrimary)),
                  TextSpan(
                      text: e.$1,
                      style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          color: UltraTheme.textMuted)),
                ]),
              ))
          .toList(),
    );
  }

  Widget _buildTableToolbar() {
    return Row(
      children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: _filterFieldDecoration(),
            child: TextField(
              onChanged: (v) => setState(() => _searchQuery = v),
              style: const TextStyle(
                  fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textPrimary),
              decoration: const InputDecoration(
                icon: Icon(Icons.search_rounded,
                    size: 18, color: UltraTheme.textMuted),
                hintText: 'Rechercher une région ou un secteur…',
                hintStyle: TextStyle(
                    fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        _typeChip('ALL', 'Tout'),
        const SizedBox(width: 6),
        _typeChip('REGION', 'Régions'),
        const SizedBox(width: 6),
        _typeChip('SECTOR', 'Secteurs'),
      ],
    );
  }

  Widget _typeChip(String value, String label) {
    final selected = _typeFilter == value;
    return ChoiceChip(
      label: Text(label,
          style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              color: selected ? Colors.white : UltraTheme.textSecondary)),
      selected: selected,
      onSelected: (_) => setState(() => _typeFilter = value),
      selectedColor: UltraTheme.primary,
      backgroundColor: UltraTheme.background,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.2))),
    );
  }

  BoxDecoration _filterFieldDecoration() => BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
      );

  Widget _tableCard(DataTable table) {
    return Container(
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.08)),
        boxShadow: UltraTheme.softShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SingleChildScrollView(child: table),
      ),
    );
  }

  Widget _actionCell({required VoidCallback onEdit, required VoidCallback onDelete}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: const Icon(Icons.edit_outlined, size: 18),
          color: UltraTheme.textSecondary,
          onPressed: onEdit,
          tooltip: 'Modifier',
        ),
        IconButton(
          icon: const Icon(Icons.delete_outline_rounded, size: 18),
          color: UltraTheme.error,
          onPressed: onDelete,
          tooltip: 'Supprimer',
        ),
      ],
    );
  }

  Widget _buildRegionsTable(List<dynamic> regions) {
    return _tableCard(DataTable(
      headingRowColor: WidgetStateProperty.all(UltraTheme.background),
      headingTextStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: UltraTheme.textMuted),
      dataTextStyle: const TextStyle(
          fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textPrimary),
      columns: const [
        DataColumn(label: Text('Nom')),
        DataColumn(label: Text('Code')),
        DataColumn(label: Text('Entreprises'), numeric: true),
        DataColumn(label: Text('Départements'), numeric: true),
        DataColumn(label: Text('Actions')),
      ],
      rows: regions.map((r) {
        final counts = r['_count'] as Map?;
        return DataRow(cells: [
          DataCell(Text((r['name'] as String?) ?? 'Sans nom')),
          DataCell(Text((r['code'] as String?) ?? '—')),
          DataCell(Text('${(counts?['companies']) ?? 0}')),
          DataCell(Text('${(counts?['departments']) ?? 0}')),
          DataCell(_actionCell(
            onEdit: () => _editRegion(r),
            onDelete: () => _deleteRegion(r),
          )),
        ]);
      }).toList(),
    ));
  }

  Widget _buildSectorsTable(List<dynamic> sectors) {
    return _tableCard(DataTable(
      headingRowColor: WidgetStateProperty.all(UltraTheme.background),
      headingTextStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: UltraTheme.textMuted),
      dataTextStyle: const TextStyle(
          fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textPrimary),
      columns: const [
        DataColumn(label: Text('Nom')),
        DataColumn(label: Text('Code')),
        DataColumn(label: Text('Catégorie')),
        DataColumn(label: Text('Entreprises'), numeric: true),
        DataColumn(label: Text('Actions')),
      ],
      rows: sectors.map((s) {
        final counts = s['_count'] as Map?;
        final category = (s['category'] as String?);
        return DataRow(cells: [
          DataCell(Text((s['name'] as String?) ?? 'Sans nom')),
          DataCell(Text((s['code'] as String?) ?? '—')),
          DataCell(Text(category?.isNotEmpty == true ? category! : '—')),
          DataCell(Text('${(counts?['companies']) ?? 0}')),
          DataCell(_actionCell(
            onEdit: () => _editSector(s),
            onDelete: () => _deleteSector(s),
          )),
        ]);
      }).toList(),
    ));
  }

  Widget _buildEmptyState({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: UltraTheme.textMuted.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(icon, size: 32, color: UltraTheme.textMuted),
          ),
          const SizedBox(height: 16),
          Text(title,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: UltraTheme.textPrimary)),
          const SizedBox(height: 6),
          Text(subtitle,
              style: const TextStyle(
                  fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted)),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // EDIT / DELETE DIALOGS
  // ═══════════════════════════════════════════════════════════

  Future<Map<String, String>?> _showEditDialog({
    required String title,
    required Map<String, String> fields,
    required Map<String, String> labels,
  }) {
    final controllers = fields.map((k, v) => MapEntry(k, TextEditingController(text: v)));
    return showDialog<Map<String, String>>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.4),
      builder: (ctx) => ResponsiveDialogBox(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: UltraTheme.displayMedium.copyWith(fontSize: 20)),
            const SizedBox(height: 20),
            for (final entry in controllers.entries) ...[
              Text(labels[entry.key] ?? entry.key,
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: UltraTheme.textMuted)),
              const SizedBox(height: 6),
              TextField(
                controller: entry.value,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: UltraTheme.background,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
                  ),
                ),
              ),
              const SizedBox(height: 14),
            ],
            const SizedBox(height: 6),
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium)),
                  ),
                  child: const Text('Annuler'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(
                      ctx, controllers.map((k, c) => MapEntry(k, c.text.trim()))),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: UltraTheme.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium)),
                  ),
                  child: const Text('Enregistrer'),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  Future<bool> _confirmDelete(String itemName) async {
    final confirmed = await showAdminConfirmSheet(
      context,
      icon: Icons.delete_outline_rounded,
      iconColor: UltraTheme.error,
      title: 'Confirmer la suppression',
      body: 'Supprimer définitivement $itemName ?',
      confirmLabel: 'Supprimer',
      confirmColor: UltraTheme.error,
    );
    return confirmed == true;
  }

  Future<void> _editRegion(dynamic region) async {
    final result = await _showEditDialog(
      title: 'Modifier la région',
      fields: {'name': region['name'] ?? '', 'code': region['code'] ?? ''},
      labels: {'name': 'Nom', 'code': 'Code'},
    );
    if (result == null || !mounted) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/data-management/regions/${region['id']}', data: result);
      if (!mounted) return;
      showAdminToast(context, 'Région mise à jour', UltraTheme.success,
          Icons.check_circle_outline_rounded);
      _loadData();
    } catch (e) {
      if (!mounted) return;
      showAdminToast(
          context, 'Erreur : $e', UltraTheme.error, Icons.error_outline_rounded);
    }
  }

  Future<void> _deleteRegion(dynamic region) async {
    final confirmed = await _confirmDelete(region['name'] ?? '');
    if (!confirmed || !mounted) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.delete('/data-management/regions/${region['id']}');
      if (!mounted) return;
      showAdminToast(context, 'Région supprimée', UltraTheme.success,
          Icons.check_circle_outline_rounded);
      _loadData();
    } catch (e) {
      if (!mounted) return;
      showAdminToast(
          context, 'Erreur : $e', UltraTheme.error, Icons.error_outline_rounded);
    }
  }

  Future<void> _editSector(dynamic sector) async {
    final result = await _showEditDialog(
      title: 'Modifier le secteur',
      fields: {
        'name': sector['name'] ?? '',
        'code': sector['code'] ?? '',
        'category': sector['category'] ?? '',
      },
      labels: {'name': 'Nom', 'code': 'Code', 'category': 'Catégorie'},
    );
    if (result == null || !mounted) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/data-management/sectors/${sector['id']}', data: result);
      if (!mounted) return;
      showAdminToast(context, 'Secteur mis à jour', UltraTheme.success,
          Icons.check_circle_outline_rounded);
      _loadData();
    } catch (e) {
      if (!mounted) return;
      showAdminToast(
          context, 'Erreur : $e', UltraTheme.error, Icons.error_outline_rounded);
    }
  }

  Future<void> _deleteSector(dynamic sector) async {
    final confirmed = await _confirmDelete(sector['name'] ?? '');
    if (!confirmed || !mounted) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.delete('/data-management/sectors/${sector['id']}');
      if (!mounted) return;
      showAdminToast(context, 'Secteur supprimé', UltraTheme.success,
          Icons.check_circle_outline_rounded);
      _loadData();
    } catch (e) {
      if (!mounted) return;
      showAdminToast(
          context, 'Erreur : $e', UltraTheme.error, Icons.error_outline_rounded);
    }
  }
}
