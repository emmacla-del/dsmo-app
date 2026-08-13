import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../theme/ultra_theme.dart';
import '../../data/api_client.dart';
import '../../widgets/responsive_helpers.dart';
import '../../widgets/file_saver.dart';
import '../../widgets/admin_kit.dart';

class DataManagementScreen extends ConsumerStatefulWidget {
  const DataManagementScreen({super.key});

  @override
  ConsumerState<DataManagementScreen> createState() =>
      _DataManagementScreenState();
}

class _DataManagementScreenState extends ConsumerState<DataManagementScreen> {
  List<dynamic> _regions = [];
  List<dynamic> _sectors = [];
  Map<String, dynamic>? _stats;
  bool _isLoading = true;
  bool _exporting = false;
  bool _exportingSpss = false;
  bool _exportPanelOpen = false;

  // ── Table search/filter ─────────────────────────────────────
  String _searchQuery = '';
  String _typeFilter = 'ALL'; // ALL | REGION | SECTOR

  // ── Export filters ──────────────────────────────────────────
  String? _filterRegion;
  String? _filterDepartment;
  DateTimeRange? _filterDateRange;
  final _yearController = TextEditingController();

  List<dynamic> get _departmentsForSelectedRegion {
    if (_filterRegion == null) return const [];
    final region = _regions.firstWhere(
      (r) => r['name'] == _filterRegion,
      orElse: () => null,
    );
    return (region?['departments'] as List?)?.cast<dynamic>() ?? const [];
  }

  int get _activeFilterCount => [
        _filterRegion,
        _filterDepartment,
        _yearController.text.trim().isNotEmpty ? _yearController.text : null,
        _filterDateRange,
      ].whereType<Object>().length;

  void _resetFilters() {
    setState(() {
      _filterRegion = null;
      _filterDepartment = null;
      _filterDateRange = null;
      _yearController.clear();
    });
  }

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _yearController.dispose();
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
      final year = int.tryParse(_yearController.text.trim());
      final bytes = await api.exportOnefopSubmissionsExcel(
        region: _filterRegion,
        department: _filterDepartment,
        year: year,
        fromDate: _filterDateRange?.start.toIso8601String(),
        toDate: _filterDateRange?.end.toIso8601String(),
      );
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

  Future<void> _exportSpss() async {
    setState(() => _exportingSpss = true);
    try {
      final api = ref.read(apiClientProvider);
      final year = int.tryParse(_yearController.text.trim());
      final result = await api.exportOnefopSubmissionsSpss(
        region: _filterRegion,
        department: _filterDepartment,
        year: year,
        fromDate: _filterDateRange?.start.toIso8601String(),
        toDate: _filterDateRange?.end.toIso8601String(),
      );
      // Filenames must match exactly what the .sps syntax's GET DATA /FILE=
      // references (see buildSpssSyntax on the backend) — no date stamp,
      // so the two downloads stay a matched pair regardless of when the
      // user later places them together and runs the syntax in SPSS.
      await saveBytesAsFile(
        utf8.encode(result['csv'] as String),
        'onefop_submissions.csv',
        mimeType: 'text/csv',
      );
      final spsPath = await saveBytesAsFile(
        utf8.encode(result['sps'] as String),
        'onefop_submissions.sps',
        mimeType: 'text/plain',
      );

      if (!mounted) return;
      showAdminToast(
          context,
          'Fichiers SPSS téléchargés (CSV + syntaxe .sps) : $spsPath. '
          'Placez les deux fichiers dans le même dossier puis exécutez le '
          '.sps dans SPSS.',
          UltraTheme.success,
          Icons.check_circle_outline_rounded);
    } catch (e) {
      if (!mounted) return;
      showAdminToast(context, 'Erreur lors de l\'export SPSS : $e',
          UltraTheme.error, Icons.error_outline_rounded);
    } finally {
      if (mounted) setState(() => _exportingSpss = false);
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
          IconButton(
            icon: Icon(_exportPanelOpen
                ? Icons.keyboard_arrow_up_rounded
                : Icons.download_rounded),
            onPressed: () => setState(() => _exportPanelOpen = !_exportPanelOpen),
            tooltip: 'Exporter',
          ),
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
          : Column(
              children: [
                if (_exportPanelOpen)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                    child: _buildExportPanel(),
                  ),
                Expanded(child: _buildUnifiedTable()),
              ],
            ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // UNIFIED RÉGIONS + SECTEURS TABLE
  // ═══════════════════════════════════════════════════════════

  List<_ManagedRow> get _allRows => [
        for (final r in _regions)
          _ManagedRow(
            type: 'REGION',
            name: (r['name'] as String?) ?? 'Sans nom',
            code: (r['code'] as String?) ?? '—',
            category: null,
            companies: (((r['_count'] as Map?)?['companies']) ?? 0) as int,
            departments:
                (((r['_count'] as Map?)?['departments']) ?? 0) as int,
            onEdit: () => _editRegion(r),
            onDelete: () => _deleteRegion(r),
          ),
        for (final s in _sectors)
          _ManagedRow(
            type: 'SECTOR',
            name: (s['name'] as String?) ?? 'Sans nom',
            code: (s['code'] as String?) ?? '—',
            category: (s['category'] as String?)?.isNotEmpty == true
                ? s['category'] as String
                : null,
            companies: (((s['_count'] as Map?)?['companies']) ?? 0) as int,
            departments: null,
            onEdit: () => _editSector(s),
            onDelete: () => _deleteSector(s),
          ),
      ];

  List<_ManagedRow> get _filteredRows {
    final q = _searchQuery.trim().toLowerCase();
    final rows = _allRows.where((row) {
      if (_typeFilter != 'ALL' && row.type != _typeFilter) return false;
      if (q.isEmpty) return true;
      return row.name.toLowerCase().contains(q) ||
          row.code.toLowerCase().contains(q);
    }).toList();
    rows.sort((a, b) => a.name.compareTo(b.name));
    return rows;
  }

  Widget _buildUnifiedTable() {
    final rows = _filteredRows;
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
          child: rows.isEmpty
              ? _buildEmptyState(
                  icon: Icons.table_rows_outlined,
                  title: 'Aucun résultat',
                  subtitle:
                      'Aucune région ou secteur ne correspond à votre recherche.',
                )
              : _buildDataTable(rows),
        ),
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

  Widget _buildDataTable(List<_ManagedRow> rows) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Container(
        decoration: BoxDecoration(
          color: UltraTheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.08)),
          boxShadow: UltraTheme.softShadow,
        ),
        clipBehavior: Clip.antiAlias,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SingleChildScrollView(
            child: DataTable(
              headingRowColor:
                  WidgetStateProperty.all(UltraTheme.background),
              headingTextStyle: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: UltraTheme.textMuted),
              dataTextStyle: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: UltraTheme.textPrimary),
              columns: const [
                DataColumn(label: Text('Type')),
                DataColumn(label: Text('Nom')),
                DataColumn(label: Text('Code')),
                DataColumn(label: Text('Catégorie')),
                DataColumn(label: Text('Entreprises'), numeric: true),
                DataColumn(label: Text('Départements'), numeric: true),
                DataColumn(label: Text('Actions')),
              ],
              rows: rows
                  .map((row) => DataRow(cells: [
                        DataCell(_typeBadge(row.type)),
                        DataCell(Text(row.name)),
                        DataCell(Text(row.code)),
                        DataCell(Text(row.category ?? '—')),
                        DataCell(Text('${row.companies}')),
                        DataCell(Text(
                            row.departments == null ? '—' : '${row.departments}')),
                        DataCell(Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.edit_outlined, size: 18),
                              color: UltraTheme.textSecondary,
                              onPressed: row.onEdit,
                              tooltip: 'Modifier',
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline_rounded,
                                  size: 18),
                              color: UltraTheme.error,
                              onPressed: row.onDelete,
                              tooltip: 'Supprimer',
                            ),
                          ],
                        )),
                      ]))
                  .toList(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _typeBadge(String type) {
    final isRegion = type == 'REGION';
    final color = isRegion ? UltraTheme.info : UltraTheme.success;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(isRegion ? 'Région' : 'Secteur',
          style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color)),
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
  // EXPORT PANEL
  // ═══════════════════════════════════════════════════════════

  Widget _buildExportPanel() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
        boxShadow: UltraTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Exporter les soumissions ONEFOP',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: UltraTheme.textPrimary)),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 18),
                color: UltraTheme.textMuted,
                onPressed: () => setState(() => _exportPanelOpen = false),
                tooltip: 'Fermer',
              ),
            ],
          ),
          const Text(
              'Compile toutes les soumissions approuvées (Entreprises, '
              'Coopératives, CTD, ONG) : données d\'identification et '
              'sections 1 à 4 du questionnaire.',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  color: UltraTheme.textSecondary,
                  height: 1.4)),
          const SizedBox(height: 18),
          _buildFilterCard(),
          const SizedBox(height: 18),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              ElevatedButton.icon(
                onPressed: (_exporting || _exportingSpss) ? null : _exportData,
                icon: _exporting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.grid_on_rounded, size: 18),
                label: Text(_exporting ? 'Génération…' : 'Exporter en Excel'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: UltraTheme.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
              OutlinedButton.icon(
                onPressed: (_exporting || _exportingSpss) ? null : _exportSpss,
                icon: _exportingSpss
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.dataset_outlined, size: 18),
                label: Text(_exportingSpss ? 'Génération…' : 'Exporter en SPSS'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: UltraTheme.primary,
                  side: const BorderSide(color: UltraTheme.primary),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => showAdminToast(
                    context,
                    'Export PDF bientôt disponible',
                    UltraTheme.info,
                    Icons.info_outline_rounded),
                icon: const Icon(Icons.picture_as_pdf_rounded, size: 18),
                label: const Text('Exporter en PDF'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: UltraTheme.textSecondary,
                  side: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.3)),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // EXPORT FILTERS
  // ═══════════════════════════════════════════════════════════

  Widget _buildFilterCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _activeFilterCount > 0
                      ? 'Filtres ($_activeFilterCount actif${_activeFilterCount > 1 ? 's' : ''})'
                      : 'Filtres (optionnel)',
                  style: UltraTheme.titleMedium,
                ),
              ),
              if (_activeFilterCount > 0)
                TextButton(
                  onPressed: _resetFilters,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('Réinitialiser',
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: UltraTheme.primary)),
                ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
              'Restreint l\'export à une région, un département, une année '
              'd\'enquête et/ou une période précises.',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  color: UltraTheme.textMuted,
                  height: 1.4)),
          const SizedBox(height: 18),
          LayoutBuilder(builder: (context, constraints) {
            final wide = constraints.maxWidth > 380;
            final region = _buildRegionDropdown();
            final department = _buildDepartmentDropdown();
            final year = _buildYearField();
            final dateRange = _buildDateRangeField();
            if (!wide) {
              return Column(children: [
                region,
                const SizedBox(height: 14),
                department,
                const SizedBox(height: 14),
                year,
                const SizedBox(height: 14),
                dateRange,
              ]);
            }
            return Column(children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: region),
                  const SizedBox(width: 12),
                  Expanded(child: department),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: year),
                  const SizedBox(width: 12),
                  Expanded(flex: 2, child: dateRange),
                ],
              ),
            ]);
          }),
        ],
      ),
    );
  }

  Widget _filterLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text,
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textMuted)),
      );

  BoxDecoration _filterFieldDecoration({bool enabled = true}) => BoxDecoration(
        color: enabled
            ? UltraTheme.surface
            : UltraTheme.textMuted.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
      );

  Widget _buildRegionDropdown() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _filterLabel('Région'),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: _filterFieldDecoration(),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _filterRegion,
              isExpanded: true,
              style: const TextStyle(
                  fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textPrimary),
              icon: const Icon(Icons.keyboard_arrow_down_rounded,
                  color: UltraTheme.textMuted),
              items: [
                const DropdownMenuItem<String>(
                  value: null,
                  child: Text('Toutes les régions',
                      style: TextStyle(color: UltraTheme.textMuted),
                      overflow: TextOverflow.ellipsis),
                ),
                ..._regions.map((r) => DropdownMenuItem(
                      value: r['name'] as String,
                      child: Text(r['name'] as String,
                          overflow: TextOverflow.ellipsis),
                    )),
              ],
              onChanged: (v) => setState(() {
                _filterRegion = v;
                _filterDepartment = null;
              }),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDepartmentDropdown() {
    final departments = _departmentsForSelectedRegion;
    final enabled = _filterRegion != null && departments.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _filterLabel('Département'),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: _filterFieldDecoration(enabled: enabled),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _filterDepartment,
              isExpanded: true,
              hint: Text(
                  _filterRegion == null
                      ? 'Choisir une région d\'abord'
                      : 'Tous les départements',
                  style: const TextStyle(
                      fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted)),
              style: const TextStyle(
                  fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textPrimary),
              icon: const Icon(Icons.keyboard_arrow_down_rounded,
                  color: UltraTheme.textMuted),
              items: [
                const DropdownMenuItem<String>(
                  value: null,
                  child: Text('Tous les départements',
                      style: TextStyle(color: UltraTheme.textMuted),
                      overflow: TextOverflow.ellipsis),
                ),
                ...departments.map((d) => DropdownMenuItem(
                      value: d['name'] as String,
                      child: Text(d['name'] as String,
                          overflow: TextOverflow.ellipsis),
                    )),
              ],
              onChanged: enabled
                  ? (v) => setState(() => _filterDepartment = v)
                  : null,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildYearField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _filterLabel('Année d\'enquête'),
        Container(
          decoration: _filterFieldDecoration(),
          child: TextField(
            controller: _yearController,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(4),
            ],
            style: const TextStyle(
                fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textPrimary),
            decoration: InputDecoration(
              hintText: 'Ex. ${DateTime.now().year}',
              hintStyle: const TextStyle(
                  fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted),
              border: InputBorder.none,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            onChanged: (_) => setState(() {}),
          ),
        ),
      ],
    );
  }

  Widget _buildDateRangeField() {
    final hasRange = _filterDateRange != null;
    final fmt = DateFormat('dd/MM/yyyy');
    final label = hasRange
        ? '${fmt.format(_filterDateRange!.start)} → ${fmt.format(_filterDateRange!.end)}'
        : 'Toute la période';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _filterLabel('Période de soumission'),
        InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () async {
            final now = DateTime.now();
            final picked = await showDateRangePicker(
              context: context,
              firstDate: DateTime(now.year - 10),
              lastDate: now,
              initialDateRange: _filterDateRange,
            );
            if (picked != null) setState(() => _filterDateRange = picked);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: _filterFieldDecoration(),
            child: Row(
              children: [
                const Icon(Icons.date_range_rounded,
                    size: 16, color: UltraTheme.textMuted),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(label,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: hasRange
                              ? UltraTheme.textPrimary
                              : UltraTheme.textMuted)),
                ),
                if (hasRange)
                  InkWell(
                    onTap: () => setState(() => _filterDateRange = null),
                    child: const Icon(Icons.close_rounded,
                        size: 16, color: UltraTheme.textMuted),
                  ),
              ],
            ),
          ),
        ),
      ],
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

/// A row in the unified régions + secteurs table.
class _ManagedRow {
  const _ManagedRow({
    required this.type,
    required this.name,
    required this.code,
    required this.category,
    required this.companies,
    required this.departments,
    required this.onEdit,
    required this.onDelete,
  });

  final String type; // REGION | SECTOR
  final String name;
  final String code;
  final String? category;
  final int companies;
  final int? departments;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
}
