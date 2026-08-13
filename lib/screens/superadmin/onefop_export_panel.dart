// lib/screens/superadmin/onefop_export_panel.dart
//
// Bulk ONEFOP submission export (Excel + SPSS), filtered by region /
// department / survey year / date range. Extracted out of the old
// standalone "Data Mgmt" tab and into the Soumissions screen, where the
// data it exports actually lives — see soumissions_screen.dart.

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../theme/ultra_theme.dart';
import '../../data/api_client.dart';
import '../../widgets/file_saver.dart';
import '../../widgets/admin_kit.dart';

class OnefopExportPanel extends ConsumerStatefulWidget {
  const OnefopExportPanel({super.key, required this.onClose});
  final VoidCallback onClose;

  @override
  ConsumerState<OnefopExportPanel> createState() => _OnefopExportPanelState();
}

class _OnefopExportPanelState extends ConsumerState<OnefopExportPanel> {
  List<dynamic> _regions = [];
  bool _exporting = false;
  bool _exportingSpss = false;

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
    _loadRegions();
  }

  @override
  void dispose() {
    _yearController.dispose();
    super.dispose();
  }

  Future<void> _loadRegions() async {
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.get('/data-management/regions');
      if (mounted) setState(() => _regions = response.data);
    } catch (e) {
      debugPrint('Error loading regions: $e');
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
                onPressed: widget.onClose,
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
}
