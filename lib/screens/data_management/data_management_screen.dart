import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/ultra_theme.dart';
import '../../data/api_client.dart';
import '../../widgets/responsive_helpers.dart';
import '../../widgets/file_saver.dart';
import '../../widgets/admin_kit.dart';

Color _statusColor(String status) {
  final s = status.toUpperCase();
  if (s.contains('APPROV') || s.contains('VALID')) return UltraTheme.success;
  if (s.contains('REJECT')) return UltraTheme.error;
  if (s.contains('PENDING') || s.contains('CORRECTION')) return UltraTheme.warning;
  if (s.contains('DRAFT')) return UltraTheme.textMuted;
  return UltraTheme.info;
}

String _statusLabel(String status) =>
    status.replaceAll('_', ' ').toLowerCase().replaceFirstMapped(
        RegExp('^.'), (m) => m.group(0)!.toUpperCase());

class DataManagementScreen extends ConsumerStatefulWidget {
  const DataManagementScreen({super.key});

  @override
  ConsumerState<DataManagementScreen> createState() =>
      _DataManagementScreenState();
}

class _DataManagementScreenState extends ConsumerState<DataManagementScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  List<dynamic> _regions = [];
  List<dynamic> _sectors = [];
  Map<String, dynamic>? _stats;
  bool _isLoading = true;
  bool _exporting = false;

  final List<Map<String, dynamic>> _tabs = [
    {'label': 'Régions', 'icon': Icons.map_outlined},
    {'label': 'Secteurs', 'icon': Icons.business_outlined},
    {'label': 'Données', 'icon': Icons.data_usage_outlined},
    {'label': 'Export', 'icon': Icons.download_outlined},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _tabController.addListener(() => setState(() {}));
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
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

  Future<void> _exportData() async {
    setState(() => _exporting = true);
    try {
      final api = ref.read(apiClientProvider);
      final bytes = await api.exportOnefopSubmissionsExcel();
      final date = DateTime.now();
      final filename =
          'onefop_submissions_${date.year}${date.month.toString().padLeft(2, '0')}${date.day.toString().padLeft(2, '0')}.xlsx';
      final savedPath = await saveBytesAsFile(
        bytes,
        filename,
        mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      if (!mounted) return;
      showAdminToast(context, 'Fichier Excel téléchargé : $savedPath',
          UltraTheme.success, Icons.check_circle_outline_rounded);
    } catch (e) {
      if (!mounted) return;
      showAdminToast(context, 'Erreur lors de l\'export : $e',
          UltraTheme.error, Icons.error_outline_rounded);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        title: const Text('Gestion des Données',
            style: TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        actions: [
          if (_tabController.index == 3)
            IconButton(
              icon: const Icon(Icons.download_rounded),
              onPressed: _exporting ? null : _exportData,
              tooltip: 'Exporter',
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadData,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: UltraTheme.primary,
          unselectedLabelColor: UltraTheme.textMuted,
          indicatorColor: UltraTheme.primary,
          labelStyle: const TextStyle(
              fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w600),
          unselectedLabelStyle:
              const TextStyle(fontFamily: 'Inter', fontSize: 13),
          tabs: _tabs
              .map((tab) => Tab(
                    icon: Icon(tab['icon'] as IconData, size: 20),
                    text: tab['label'] as String,
                  ))
              .toList(),
        ),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation(UltraTheme.primary)))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildRegionsTab(),
                _buildSectorsTab(),
                _buildDataTab(),
                _buildExportTab(),
              ],
            ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RÉGIONS
  // ═══════════════════════════════════════════════════════════

  Widget _buildRegionsTab() {
    if (_regions.isEmpty) {
      return _buildEmptyState(
        icon: Icons.map_outlined,
        title: 'Aucune région trouvée',
        subtitle: 'Les régions configurées apparaîtront ici.',
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      itemCount: _regions.length,
      itemBuilder: (context, index) {
        final region = _regions[index];
        final counts = region['_count'] as Map?;
        return _EntityCard(
          icon: Icons.location_on_outlined,
          iconColor: UltraTheme.info,
          title: region['name'] ?? 'Sans nom',
          subtitle: 'Code : ${region['code'] ?? '—'}',
          pills: counts == null
              ? const []
              : [
                  StatPill(
                      value: (counts['companies'] ?? 0) as int,
                      label: 'Entreprises',
                      color: UltraTheme.info),
                  StatPill(
                      value: (counts['departments'] ?? 0) as int,
                      label: 'Départements',
                      color: UltraTheme.primary),
                ],
          onEdit: () => _editRegion(region),
          onDelete: () => _deleteRegion(region),
        );
      },
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SECTEURS
  // ═══════════════════════════════════════════════════════════

  Widget _buildSectorsTab() {
    if (_sectors.isEmpty) {
      return _buildEmptyState(
        icon: Icons.business_outlined,
        title: 'Aucun secteur trouvé',
        subtitle: 'Les secteurs configurés apparaîtront ici.',
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      itemCount: _sectors.length,
      itemBuilder: (context, index) {
        final sector = _sectors[index];
        final counts = sector['_count'] as Map?;
        return _EntityCard(
          icon: Icons.business_outlined,
          iconColor: UltraTheme.success,
          title: sector['name'] ?? 'Sans nom',
          subtitle: (sector['category'] as String?)?.isNotEmpty == true
              ? sector['category']
              : null,
          pills: counts == null
              ? const []
              : [
                  StatPill(
                      value: (counts['companies'] ?? 0) as int,
                      label: 'Entreprises',
                      color: UltraTheme.success),
                ],
          onEdit: () => _editSector(sector),
          onDelete: () => _deleteSector(sector),
        );
      },
    );
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
  // DONNÉES
  // ═══════════════════════════════════════════════════════════

  Widget _buildDataTab() {
    final totals = (_stats?['totals'] as Map?) ?? {};
    final declarationsByStatus =
        (_stats?['declarationsByStatus'] as Map?) ?? {};
    final onefopByStatus = (_stats?['onefopByStatus'] as Map?) ?? {};
    final companiesByRegion =
        (_stats?['companiesByRegion'] as List?)?.cast<dynamic>() ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LayoutBuilder(builder: (context, constraints) {
            final wide = constraints.maxWidth > 640;
            final cards = [
              _buildDataCard(
                  'Entreprises enregistrées',
                  totals['companies'] ?? 0,
                  Icons.apartment_outlined,
                  UltraTheme.info,
                  "Nombre total d'entreprises dans la base"),
              _buildDataCard(
                  'Déclarations DSMO',
                  totals['declarations'] ?? 0,
                  Icons.folder_open_outlined,
                  UltraTheme.primary,
                  'Nombre total de déclarations soumises'),
              _buildDataCard(
                  'Soumissions ONEFOP',
                  totals['onefopSubmissions'] ?? 0,
                  Icons.fact_check_outlined,
                  UltraTheme.success,
                  'Nombre total de questionnaires soumis'),
              _buildDataCard('Utilisateurs', totals['users'] ?? 0,
                  Icons.people_outline, UltraTheme.accent,
                  'Nombre total de comptes utilisateurs'),
            ];
            if (!wide) {
              return Column(
                children: [
                  for (final c in cards) ...[c, const SizedBox(height: 14)]
                ],
              );
            }
            return GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 14,
              crossAxisSpacing: 14,
              childAspectRatio: 2.6,
              children: cards,
            );
          }),
          const SizedBox(height: 28),
          if (onefopByStatus.isNotEmpty)
            _buildStatusBreakdownCard(
                'Soumissions ONEFOP par statut', onefopByStatus),
          if (onefopByStatus.isNotEmpty) const SizedBox(height: 16),
          if (declarationsByStatus.isNotEmpty)
            _buildStatusBreakdownCard(
                'Déclarations DSMO par statut', declarationsByStatus),
          if (declarationsByStatus.isNotEmpty) const SizedBox(height: 16),
          if (companiesByRegion.isNotEmpty)
            _buildTopRegionsCard(companiesByRegion),
        ],
      ),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: UltraTheme.titleMedium),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  Widget _buildStatusBreakdownCard(String title, Map data) {
    final entries = data.entries.toList()
      ..sort((a, b) => (b.value as int).compareTo(a.value as int));
    return _sectionCard(
      title: title,
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: entries.map((e) {
          final status = e.key as String;
          final count = e.value as int;
          final color = _statusColor(status);
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text('$count',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: color)),
              const SizedBox(width: 6),
              Text(_statusLabel(status),
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: color.withValues(alpha: 0.85))),
            ]),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTopRegionsCard(List companiesByRegion) {
    final top = companiesByRegion.take(5).toList();
    final maxCount = top.isEmpty
        ? 1
        : (top.first['count'] as int? ?? 1).clamp(1, 1 << 30);
    return _sectionCard(
      title: 'Régions les plus représentées',
      child: Column(
        children: top.map((r) {
          final region = r['region'] as String? ?? 'Inconnue';
          final count = r['count'] as int? ?? 0;
          final fraction = count / maxCount;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(region,
                          style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: UltraTheme.textPrimary)),
                    ),
                    Text('$count',
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: UltraTheme.textPrimary)),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: fraction.toDouble(),
                    minHeight: 6,
                    backgroundColor: UltraTheme.textMuted.withValues(alpha: 0.1),
                    valueColor:
                        const AlwaysStoppedAnimation(UltraTheme.primary),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildDataCard(String title, dynamic value, IconData icon, Color color,
      String description) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 26, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(value.toString(),
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: UltraTheme.textPrimary)),
                const SizedBox(height: 2),
                Text(title,
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.textSecondary)),
                const SizedBox(height: 2),
                Text(description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        color: UltraTheme.textMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════

  Widget _buildExportTab() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: UltraTheme.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.download_rounded,
                    size: 34, color: UltraTheme.primary),
              ),
              const SizedBox(height: 20),
              const Text('Exporter les soumissions ONEFOP',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      color: UltraTheme.textPrimary)),
              const SizedBox(height: 8),
              const Text(
                  'Compile toutes les soumissions approuvées (Entreprises, '
                  'Coopératives, CTD, ONG) dans un classeur Excel : une '
                  'ligne par soumission avec les données d\'identification '
                  'et les sections 1 à 4 du questionnaire.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      color: UltraTheme.textSecondary,
                      height: 1.5)),
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _exporting ? null : _exportData,
                  icon: _exporting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.file_download_rounded),
                  label: Text(
                      _exporting ? 'Génération en cours…' : 'Exporter en Excel'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: UltraTheme.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => showAdminToast(
                      context,
                      'Export PDF bientôt disponible',
                      UltraTheme.info,
                      Icons.info_outline_rounded),
                  icon: const Icon(Icons.picture_as_pdf_rounded),
                  label: const Text('Exporter en PDF'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: UltraTheme.textSecondary,
                    side: BorderSide(
                        color: UltraTheme.textMuted.withValues(alpha: 0.3)),
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
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

/// Flat bordered card for a région/secteur row: icon, title/subtitle,
/// stat pills, and compact edit/delete actions — consistent with the
/// card style used across the other admin screens (companies, users).
class _EntityCard extends StatelessWidget {
  const _EntityCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    this.subtitle,
    required this.pills,
    required this.onEdit,
    required this.onDelete,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String? subtitle;
  final List<Widget> pills;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: UltraTheme.textPrimary)),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(subtitle!,
                          style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 12,
                              color: UltraTheme.textMuted)),
                    ],
                  ],
                ),
              ),
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
          ),
          if (pills.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: pills),
          ],
        ],
      ),
    );
  }
}
