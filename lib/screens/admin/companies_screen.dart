import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../theme/ultra_theme.dart';
import '../../../widgets/common_widgets.dart';

// ══════════════════════════════════════════════════════════════
// CompaniesScreen — read-only company/organization directory.
// Search + pagination + a sortable table + a detail sheet per
// company. No edit actions: company profiles are still
// self-managed by their owning COMPANY account via lib/screens/dsmo.
// ══════════════════════════════════════════════════════════════

const _pageSize = 20;

const _tableHeaderStyle = TextStyle(
    fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w700, color: UltraTheme.textSecondary);
const _tableCellStyle = TextStyle(fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textPrimary);

String _entityTypeLabel(String? type) {
  if (type == null) return '';
  const labels = {
    'ENTREPRISE': 'Entreprise',
    'COOPERATIVE': 'Coopérative',
    'CTD': 'CTD',
    'ONG': 'ONG',
  };
  return labels[type.toUpperCase()] ?? type;
}

String _dash(String? v) => (v == null || v.isEmpty) ? '—' : v;

String _formatDate(String? iso) {
  if (iso == null) return '—';
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}

String _contactValue(Map c) {
  final respondentEmail = c['respondentEmail'] as String?;
  if (respondentEmail != null && respondentEmail.isNotEmpty) return respondentEmail;
  final user = c['user'] as Map?;
  return user?['email'] as String? ?? '';
}

class CompaniesScreen extends ConsumerStatefulWidget {
  const CompaniesScreen({super.key});

  @override
  ConsumerState<CompaniesScreen> createState() => _CompaniesScreenState();
}

class _CompaniesScreenState extends ConsumerState<CompaniesScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  List<dynamic> _companies = [];
  bool _loading = true;
  String? _error;
  int _page = 1;
  int _total = 0;

  int? _sortColumnIndex;
  bool _sortAscending = true;

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
      final resp = await api.listCompanies(
        search: _searchCtrl.text.trim(),
        page: _page,
        pageSize: _pageSize,
      );
      if (!mounted) return;
      setState(() {
        _companies = resp['companies'] as List? ?? [];
        _total = resp['total'] as int? ?? _companies.length;
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

  void _changePage(int delta) {
    final next = _page + delta;
    if (next < 1 || next > _totalPages) return;
    setState(() => _page = next);
    _load();
  }

  void _showDetail(Map c) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _CompanyDetailSheet(company: c),
    );
  }

  // ── Sorting (client-side, scoped to the currently loaded page) ──

  int _compareColumn(Map ca, Map cb, int columnIndex) {
    switch (columnIndex) {
      case 0:
        return (ca['name'] as String? ?? '')
            .toLowerCase()
            .compareTo((cb['name'] as String? ?? '').toLowerCase());
      case 1:
        return _entityTypeLabel(ca['entityType'] as String?)
            .compareTo(_entityTypeLabel(cb['entityType'] as String?));
      case 2:
        return (ca['taxNumber'] as String? ?? '').compareTo(cb['taxNumber'] as String? ?? '');
      case 3:
        return (ca['establishmentId'] as String? ?? '')
            .compareTo(cb['establishmentId'] as String? ?? '');
      case 4:
        return (ca['region'] as String? ?? '').compareTo(cb['region'] as String? ?? '');
      case 5:
        return (ca['department'] as String? ?? '').compareTo(cb['department'] as String? ?? '');
      case 6:
        final da = DateTime.tryParse(ca['createdAt'] as String? ?? '') ?? DateTime(0);
        final db = DateTime.tryParse(cb['createdAt'] as String? ?? '') ?? DateTime(0);
        return da.compareTo(db);
      case 7:
        return _contactValue(ca).toLowerCase().compareTo(_contactValue(cb).toLowerCase());
      case 8:
        final aActive = (ca['user'] as Map?)?['isActive'] == true;
        final bActive = (cb['user'] as Map?)?['isActive'] == true;
        return (aActive ? 1 : 0).compareTo(bActive ? 1 : 0);
      default:
        return 0;
    }
  }

  void _onSort(int columnIndex, bool ascending) {
    setState(() {
      _sortColumnIndex = columnIndex;
      _sortAscending = ascending;
      _companies.sort((a, b) {
        final cmp = _compareColumn(a as Map, b as Map, columnIndex);
        return ascending ? cmp : -cmp;
      });
    });
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
          SliverToBoxAdapter(child: _buildToolbar()),
          if (_loading)
            const SliverFillRemaining(
                child: Center(
                    child: CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation(UltraTheme.primary))))
          else if (_error != null)
            SliverFillRemaining(child: _buildError())
          else if (_companies.isEmpty)
            SliverFillRemaining(child: _buildEmpty())
          else
            SliverToBoxAdapter(child: _buildCompaniesTable()),
          if (!_loading && _error == null && _companies.isNotEmpty)
            SliverToBoxAdapter(child: _buildPagination()),
        ],
      ),
    );
  }

  Widget _buildToolbar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              style: const TextStyle(fontFamily: 'Inter', fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Rechercher par nom, NIU, identifiant, région...',
                hintStyle:
                    const TextStyle(fontFamily: 'Inter', color: UltraTheme.textMuted),
                prefixIcon: const Icon(Icons.search_rounded,
                    color: UltraTheme.textMuted, size: 20),
                filled: true,
                fillColor: UltraTheme.surface,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.15)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.15)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: UltraTheme.primary, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          _RefreshButton(onTap: _load),
        ]),
        const SizedBox(height: 8),
        Text('$_total entreprise${_total == 1 ? '' : 's'}',
            style: const TextStyle(
                fontFamily: 'Inter', fontSize: 12, color: UltraTheme.textMuted)),
      ]),
    );
  }

  Widget _buildCompaniesTable() {
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
            headingRowColor: WidgetStateProperty.all(UltraTheme.surface),
            columnSpacing: 16,
            horizontalMargin: 12,
            sortColumnIndex: _sortColumnIndex,
            sortAscending: _sortAscending,
            showCheckboxColumn: false,
            columns: [
              DataColumn(label: const Text('Nom', style: _tableHeaderStyle), onSort: _onSort),
              DataColumn(label: const Text('Type', style: _tableHeaderStyle), onSort: _onSort),
              DataColumn(label: const Text('NIU', style: _tableHeaderStyle), onSort: _onSort),
              DataColumn(
                  label: const Text('Identifiant', style: _tableHeaderStyle), onSort: _onSort),
              DataColumn(label: const Text('Région', style: _tableHeaderStyle), onSort: _onSort),
              DataColumn(
                  label: const Text('Département', style: _tableHeaderStyle), onSort: _onSort),
              DataColumn(label: const Text('Créé le', style: _tableHeaderStyle), onSort: _onSort),
              DataColumn(label: const Text('Contact', style: _tableHeaderStyle), onSort: _onSort),
              DataColumn(label: const Text('Statut', style: _tableHeaderStyle), onSort: _onSort),
            ],
            rows: _companies.map((raw) {
              final c = raw as Map;
              final user = c['user'] as Map?;
              final isActive = user?['isActive'] == true;
              return DataRow(
                onSelectChanged: (_) => _showDetail(c),
                cells: [
                  DataCell(Text(_dash(c['name'] as String?), style: _tableCellStyle)),
                  DataCell(Text(_dash(_entityTypeLabel(c['entityType'] as String?)),
                      style: _tableCellStyle)),
                  DataCell(Text(_dash(c['taxNumber'] as String?), style: _tableCellStyle)),
                  DataCell(Text(_dash(c['establishmentId'] as String?), style: _tableCellStyle)),
                  DataCell(Text(_dash(c['region'] as String?), style: _tableCellStyle)),
                  DataCell(Text(_dash(c['department'] as String?), style: _tableCellStyle)),
                  DataCell(Text(_formatDate(c['createdAt'] as String?), style: _tableCellStyle)),
                  DataCell(Text(_dash(_contactValue(c)), style: _tableCellStyle)),
                  DataCell(StatusBadge(
                    label: isActive ? 'Actif' : 'Suspendu',
                    color: isActive ? UltraTheme.success : UltraTheme.error,
                  )),
                ],
              );
            }).toList(),
          ),
        ),
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
            color: UltraTheme.accent.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Icon(Icons.apartment_outlined, size: 40, color: UltraTheme.accent),
        ),
        const SizedBox(height: 20),
        const Text('Aucune entreprise trouvée',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textPrimary)),
        const SizedBox(height: 8),
        const Text('Essayez une autre recherche.',
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
// Company detail sheet
// ══════════════════════════════════════════════════════════════

class _CompanyDetailSheet extends StatelessWidget {
  const _CompanyDetailSheet({required this.company});
  final Map company;

  Widget _row(String label, String? value) {
    if (value == null || value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          width: 140,
          child: Text(label,
              style: const TextStyle(
                  fontFamily: 'Inter', fontSize: 12, color: UltraTheme.textMuted)),
        ),
        Expanded(
          child: Text(value,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: UltraTheme.textPrimary)),
        ),
      ]),
    );
  }

  /// Renders a section header followed by its rows — but only if at least
  /// one field in the section actually has a value, so empty sections
  /// (e.g. a company with no respondent info on file) don't leave a
  /// dangling header with nothing under it.
  Widget _buildSection(String title, List<MapEntry<String, String?>> fields) {
    final present = fields.where((e) => e.value != null && e.value!.isNotEmpty).toList();
    if (present.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 8),
          child: Text(title,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: UltraTheme.primary,
                  letterSpacing: 0.4)),
        ),
        ...present.map((e) => _row(e.key, e.value)),
      ],
    );
  }

  String? _formatDate(String? iso) {
    if (iso == null) return null;
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }

  String? _genderBreakdown(dynamic men, dynamic women) {
    if (men == null && women == null) return null;
    final parts = <String>[
      if (men != null) '$men hommes',
      if (women != null) '$women femmes',
    ];
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final user = company['user'] as Map?;
    final sector = company['sector'] as Map?;
    final respondentName = [company['respondentFirstName'], company['respondentLastName']]
        .where((e) => e != null && (e as String).isNotEmpty)
        .join(' ');

    return Container(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      decoration: const BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: UltraTheme.textMuted.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Text(company['name'] as String? ?? '',
              style: UltraTheme.displayMedium.copyWith(fontSize: 18)),
          const SizedBox(height: 16),
          _buildSection('Identité', [
            MapEntry('Identifiant', company['establishmentId'] as String?),
            MapEntry('NIU', company['taxNumber'] as String?),
            MapEntry('Type d\'entité', _entityTypeLabel(company['entityType'] as String?)),
            MapEntry('Secteur d\'activité', sector?['name'] as String?),
            MapEntry('Activité principale', company['mainActivity'] as String?),
            MapEntry('Statut juridique', company['legalStatus'] as String?),
            MapEntry('N° d\'enregistrement', company['registrationNumber'] as String?),
            MapEntry('N° CNPS', company['cnpsNumber'] as String?),
            MapEntry('Année de création', company['yearOfCreation'] as String?),
            MapEntry('Taille d\'entreprise', company['enterpriseSize'] as String?),
            MapEntry('Enregistré le', _formatDate(company['createdAt'] as String?)),
          ]),
          _buildSection('Localisation', [
            MapEntry('Région', company['region'] as String?),
            MapEntry('Département', company['department'] as String?),
            MapEntry('Subdivision', company['subdivision'] as String?),
            MapEntry('Adresse', company['address'] as String?),
          ]),
          _buildSection('Contact entreprise', [
            MapEntry('Téléphone', company['phone'] as String?),
            MapEntry('Email du compte', user?['email'] as String?),
            MapEntry('Statut du compte', user?['isActive'] == true ? 'Actif' : 'Suspendu'),
          ]),
          _buildSection('Répondant', [
            MapEntry('Nom', respondentName.isEmpty ? null : respondentName),
            MapEntry('Fonction', company['respondentFunction'] as String?),
            MapEntry('Téléphone', company['respondentPhone'] as String?),
          ]),
          _buildSection('Effectifs', [
            MapEntry('Effectif total', company['totalEmployees']?.toString()),
            MapEntry('Répartition', _genderBreakdown(company['menCount'], company['womenCount'])),
            MapEntry('Effectif année précédente', company['lastYearTotal']?.toString()),
            MapEntry('Répartition (année précédente)',
                _genderBreakdown(company['lastYearMenCount'], company['lastYearWomenCount'])),
          ]),
        ]),
      ),
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
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.15)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.refresh_rounded, size: 18, color: UltraTheme.textSecondary),
        ),
      ),
    );
  }
}
