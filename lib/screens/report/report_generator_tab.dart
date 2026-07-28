// lib/screens/report/report_generator_tab.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../widgets/period_selector.dart';
import '../../theme/ultra_theme.dart';
import 'report_models.dart';
import 'report_widgets.dart';

// Map of content groups to backend sections
const Map<String, List<String>> groupToBackendSections = {
  'Executive Summary': ['kpi', 'insights'],
  'Employment & Workforce': ['trends'],
  'Skills & Training': ['sectorAnalysis'],
  'Diversity & Inclusion': ['demographics'],
  'Regional Analysis': ['regionalBreakdown'],
};

class ReportGeneratorTab extends ConsumerStatefulWidget {
  final UserRole userRole;
  final ReportPermissions permissions;
  final PeriodConfig? prefillPeriod;
  final VoidCallback onReportGenerated;

  const ReportGeneratorTab({
    super.key,
    required this.userRole,
    required this.permissions,
    this.prefillPeriod,
    required this.onReportGenerated,
  });

  @override
  ConsumerState<ReportGeneratorTab> createState() => _ReportGeneratorTabState();
}

class _ReportGeneratorTabState extends ConsumerState<ReportGeneratorTab> {
  // Location filters
  String? _selectedRegion;
  String? _selectedDepartment;
  String? _selectedSubdivision;

  // Period selection
  String _datePreset = '6months';
  DateTimeRange? _customDateRange;

  // Content groups
  final Map<String, bool> _selectedGroups = {
    'Executive Summary': true,
    'Employment & Workforce': true,
    'Skills & Training': false,
    'Diversity & Inclusion': false,
    'Regional Analysis': false,
  };

  // Report name
  final TextEditingController _reportNameController = TextEditingController();

  // UI state
  bool _generating = false;
  List<Map<String, dynamic>> _geoStructure = [];
  bool _geoLoading = true;

  // Getters for geo hierarchy
  List<String> get _regionNames =>
      _geoStructure.map((r) => r['name'] as String).toList();

  List<String> _departmentNames(String? regionName) {
    if (regionName == null) return [];
    final region = _geoStructure.firstWhere(
      (r) => r['name'] == regionName,
      orElse: () => <String, dynamic>{},
    );
    if (region.isEmpty) return [];
    return (region['departments'] as List<dynamic>)
        .map((d) => d['name'] as String)
        .toList();
  }

  List<String> _subdivisionNames(String? regionName, String? deptName) {
    if (regionName == null || deptName == null) return [];
    final region = _geoStructure.firstWhere(
      (r) => r['name'] == regionName,
      orElse: () => <String, dynamic>{},
    );
    if (region.isEmpty) return [];
    final depts = region['departments'];
    if (depts is! List) return [];
    final dept = depts.whereType<Map>().firstWhere(
          (d) => d['name'] == deptName,
          orElse: () => {},
        );
    if (dept.isEmpty) return [];
    final subs = dept['subdivisions'];
    if (subs is! List) return [];
    return subs
        .whereType<Map>()
        .map((s) => s['name']?.toString() ?? '')
        .where((s) => s.isNotEmpty)
        .toList();
  }

  @override
  void initState() {
    super.initState();
    _loadGeoStructure();
    _applyPrefillPeriod();
  }

  void _applyPrefillPeriod() {
    if (widget.prefillPeriod != null) {
      final period = widget.prefillPeriod!;
      switch (period.type) {
        case PeriodType.year:
          if (period.year != null) {
            _datePreset = 'custom';
            _customDateRange = DateTimeRange(
              start: DateTime(period.year!, 1, 1),
              end: DateTime(period.year!, 12, 31),
            );
          }
          break;
        case PeriodType.quarter:
          if (period.year != null && period.quarter != null) {
            _datePreset = 'custom';
            final quarterNum = int.parse(period.quarter!.substring(1));
            final startMonth = (quarterNum - 1) * 3;
            final endMonth = startMonth + 2;
            _customDateRange = DateTimeRange(
              start: DateTime(period.year!, startMonth, 1),
              end: DateTime(period.year!, endMonth + 1, 0),
            );
          }
          break;
        case PeriodType.semester:
          if (period.year != null && period.semester != null) {
            _datePreset = 'custom';
            if (period.semester == 'S1') {
              _customDateRange = DateTimeRange(
                start: DateTime(period.year!, 1, 1),
                end: DateTime(period.year!, 6, 30),
              );
            } else {
              _customDateRange = DateTimeRange(
                start: DateTime(period.year!, 7, 1),
                end: DateTime(period.year!, 12, 31),
              );
            }
          }
          break;
        case PeriodType.custom:
          if (period.customRange != null) {
            _datePreset = 'custom';
            _customDateRange = period.customRange;
          }
          break;
      }
    }
  }

  Future<void> _loadGeoStructure() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.getLocationStructure();
      if (mounted) {
        setState(() {
          _geoStructure =
              res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          _geoLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _geoLoading = false);
    }
  }

  List<String> _getBackendSections() {
    final sections = <String>[];
    for (final entry in _selectedGroups.entries) {
      if (entry.value) {
        sections.addAll(groupToBackendSections[entry.key]!);
      }
    }
    return sections.toSet().toList();
  }

  bool _hasSelectedContent() => _selectedGroups.values.any((v) => v);

  DateTimeRange _getDateRange() {
    final now = DateTime.now();
    switch (_datePreset) {
      case '3months':
        return DateTimeRange(
          start: DateTime(now.year, now.month - 3, now.day),
          end: now,
        );
      case '6months':
        return DateTimeRange(
          start: DateTime(now.year, now.month - 6, now.day),
          end: now,
        );
      case '12months':
        return DateTimeRange(
          start: DateTime(now.year - 1, now.month, now.day),
          end: now,
        );
      case 'ytd':
        return DateTimeRange(
          start: DateTime(now.year, 1, 1),
          end: now,
        );
      case 'custom':
        return _customDateRange ??
            DateTimeRange(
              start: now.subtract(const Duration(days: 180)),
              end: now,
            );
      default:
        return DateTimeRange(
          start: now.subtract(const Duration(days: 180)),
          end: now,
        );
    }
  }

  String _dateToQuarter(DateTime date) =>
      '${date.year}-T${((date.month - 1) ~/ 3) + 1}';

  Future<void> _generate() async {
    if (!_hasSelectedContent()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sélectionnez au moins une section')),
      );
      return;
    }

    final dateRange = _getDateRange();
    if (dateRange.end.isBefore(dateRange.start)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text(
                'La date de fin doit être postérieure à la date de début')),
      );
      return;
    }

    final monthsDiff = dateRange.end.difference(dateRange.start).inDays / 30;
    if (monthsDiff > 36) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('La période ne peut pas dépasser 36 mois')),
      );
      return;
    }

    setState(() => _generating = true);

    final payload = {
      'baseType': 'customMix',
      'sections': _getBackendSections(),
      'scope': {
        'year': dateRange.start.year,
        'region': _selectedRegion,
        'department': _selectedDepartment,
        'subdivision': _selectedSubdivision,
        'fromQuarter': _dateToQuarter(dateRange.start),
        'toQuarter': _dateToQuarter(dateRange.end),
      },
      'formats': ['PDF'],
    };

    if (_reportNameController.text.trim().isNotEmpty) {
      payload['name'] = _reportNameController.text.trim();
    }

    try {
      final api = ref.read(apiClientProvider);
      await api.post('/reports/dynamic', data: payload);
      _clearForm();
      widget.onReportGenerated();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Rapport généré avec succès')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  void _clearForm() {
    setState(() {
      _selectedRegion = null;
      _selectedDepartment = null;
      _selectedSubdivision = null;
      _datePreset = '6months';
      _customDateRange = null;
      _selectedGroups.updateAll((key, value) => false);
      _selectedGroups['Executive Summary'] = true;
    });
    _reportNameController.clear();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildLocationSection(),
          const SizedBox(height: 24),
          _buildPeriodSection(),
          const SizedBox(height: 24),
          _buildContentSection(),
          const SizedBox(height: 24),
          _buildReportNameField(),
          const SizedBox(height: 24),
          _buildGenerateButton(),
        ],
      ),
    );
  }

  Widget _buildLocationSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionLabel(icon: Icons.place_outlined, label: 'LOCALISATION'),
        const SizedBox(height: 12),
        if (_geoLoading)
          const LinearProgressIndicator(color: UltraTheme.primary)
        else ...[
          DropdownField<String?>(
            label: 'Région',
            value: _selectedRegion,
            items: [null, ..._regionNames],
            itemLabel: (v) => v ?? 'Nationale (toutes)',
            onChanged: (v) => setState(() {
              _selectedRegion = v;
              _selectedDepartment = null;
              _selectedSubdivision = null;
            }),
          ),
          if (_selectedRegion != null) ...[
            const SizedBox(height: 10),
            DropdownField<String?>(
              label: 'Département',
              value: _selectedDepartment,
              items: [null, ..._departmentNames(_selectedRegion)],
              itemLabel: (v) => v ?? 'Tous',
              onChanged: (v) => setState(() {
                _selectedDepartment = v;
                _selectedSubdivision = null;
              }),
            ),
          ],
          if (_selectedDepartment != null &&
              _subdivisionNames(_selectedRegion, _selectedDepartment)
                  .isNotEmpty) ...[
            const SizedBox(height: 10),
            DropdownField<String?>(
              label: 'Arrondissement',
              value: _selectedSubdivision,
              items: [
                null,
                ..._subdivisionNames(_selectedRegion, _selectedDepartment),
              ],
              itemLabel: (v) => v ?? 'Tous',
              onChanged: (v) => setState(() => _selectedSubdivision = v),
            ),
          ],
        ],
      ],
    );
  }

  Widget _buildPeriodSection() {
    final periodOptions = [
      ('3 mois', '3months'),
      ('6 mois', '6months'),
      ('12 mois', '12months'),
      ('Année en cours', 'ytd'),
      ('Personnalisé', 'custom'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionLabel(
          icon: Icons.calendar_today_outlined,
          label: 'PÉRIODE',
        ),
        const SizedBox(height: 12),
        ...periodOptions.map((option) => RadioListTile<String>(
              value: option.$2,
              groupValue: _datePreset,
              onChanged: (value) => setState(() => _datePreset = value!),
              title: Text(option.$1),
              activeColor: UltraTheme.primary,
              contentPadding: EdgeInsets.zero,
              dense: true,
            )),
        if (_datePreset == 'custom') ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: DateField(
                  label: 'Du',
                  date: _customDateRange?.start,
                  onTap: _pickCustomDateRange,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DateField(
                  label: 'Au',
                  date: _customDateRange?.end,
                  onTap: _pickCustomDateRange,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Future<void> _pickCustomDateRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 5),
      lastDate: now,
      initialDateRange: _customDateRange ??
          DateTimeRange(
            start: now.subtract(const Duration(days: 180)),
            end: now,
          ),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: UltraTheme.primary,
              onPrimary: Colors.white,
              surface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && mounted) {
      setState(() => _customDateRange = picked);
    }
  }

  Widget _buildContentSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const SectionLabel(icon: Icons.folder_outlined, label: 'CONTENU'),
            Row(
              children: [
                TextButton(
                  onPressed: () => setState(
                    () => _selectedGroups.updateAll((key, value) => true),
                  ),
                  child: const Text('Tout sélectionner'),
                ),
                TextButton(
                  onPressed: () => setState(
                    () => _selectedGroups.updateAll((key, value) => false),
                  ),
                  child: const Text('Tout désélectionner'),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 8),
        ..._selectedGroups.entries.map((entry) => CheckboxListTile(
              value: entry.value,
              onChanged: (value) => setState(
                () => _selectedGroups[entry.key] = value ?? false,
              ),
              title: Text(
                entry.key,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              subtitle: Text(
                _groupSubtitle(entry.key),
                style: const TextStyle(fontSize: 11),
              ),
              activeColor: UltraTheme.primary,
              contentPadding: EdgeInsets.zero,
              dense: true,
              controlAffinity: ListTileControlAffinity.leading,
            )),
      ],
    );
  }

  String _groupSubtitle(String group) {
    switch (group) {
      case 'Executive Summary':
        return 'KPIs + insights';
      case 'Employment & Workforce':
        return 'Tendances temporelles';
      case 'Skills & Training':
        return 'Analyse sectorielle';
      case 'Diversity & Inclusion':
        return 'Parité & inclusion';
      case 'Regional Analysis':
        return 'Détail par région';
      default:
        return '';
    }
  }

  Widget _buildReportNameField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionLabel(
          icon: Icons.edit_note_outlined,
          label: 'NOM DU RAPPORT (optionnel)',
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _reportNameController,
          style: const TextStyle(fontSize: 13),
          decoration: InputDecoration(
            hintText: 'Briefing RH Littoral Juin 2026',
            hintStyle: const TextStyle(fontSize: 13),
            filled: true,
            fillColor: UltraTheme.surface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 12,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildGenerateButton() {
    final canGenerate = _hasSelectedContent() && !_generating;

    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: canGenerate ? _generate : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: UltraTheme.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: UltraTheme.textMuted.withOpacity(0.15),
          disabledForegroundColor: UltraTheme.textMuted,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: _generating
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Text(
                'GÉNÉRER LE RAPPORT',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
      ),
    );
  }

  @override
  void dispose() {
    _reportNameController.dispose();
    super.dispose();
  }
}
