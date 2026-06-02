// lib/screens/report/report_generator_tab.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../theme/ultra_theme.dart';
import 'report_models.dart';
import 'report_widgets.dart';

class ReportGeneratorTab extends ConsumerStatefulWidget {
  final UserRole userRole;
  final ReportPermissions permissions;
  final VoidCallback onReportGenerated;

  const ReportGeneratorTab({
    super.key,
    required this.userRole,
    required this.permissions,
    required this.onReportGenerated,
  });

  @override
  ConsumerState<ReportGeneratorTab> createState() => _ReportGeneratorTabState();
}

class _ReportGeneratorTabState extends ConsumerState<ReportGeneratorTab> {
  String? _selectedRegion;
  String? _selectedDepartment;
  String? _selectedSubdivision;
  String _datePreset = '6months';
  DateTimeRange? _customDateRange;
  final Map<String, bool> _selectedGroups = {
    'Executive Summary': true,
    'Employment & Workforce': true,
    'Skills & Training': false,
    'Diversity & Inclusion': false,
    'Regional Analysis': false,
  };
  final TextEditingController _reportNameController = TextEditingController();
  bool _generating = false;
  List<Map<String, dynamic>> _geoStructure = [];
  bool _geoLoading = true;

  List<String> get _regionNames =>
      _geoStructure.map((r) => r['name'] as String).toList();

  @override
  void initState() {
    super.initState();
    _loadGeoStructure();
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
      setState(() => _geoLoading = false);
    }
  }

  List<String> _getBackendSections() {
    final sections = <String>[];
    for (final entry in _selectedGroups.entries) {
      if (entry.value) sections.addAll(groupToBackendSections[entry.key]!);
    }
    return sections.toSet().toList();
  }

  bool _hasSelectedContent() => _selectedGroups.values.any((v) => v);

  DateTimeRange _getDateRange() {
    final now = DateTime.now();
    switch (_datePreset) {
      case '3months':
        return DateTimeRange(
            start: DateTime(now.year, now.month - 3, now.day), end: now);
      case '6months':
        return DateTimeRange(
            start: DateTime(now.year, now.month - 6, now.day), end: now);
      case '12months':
        return DateTimeRange(
            start: DateTime(now.year - 1, now.month, now.day), end: now);
      case 'ytd':
        return DateTimeRange(start: DateTime(now.year, 1, 1), end: now);
      case 'custom':
        return _customDateRange ??
            DateTimeRange(
                start: now.subtract(const Duration(days: 180)), end: now);
      default:
        return DateTimeRange(
            start: now.subtract(const Duration(days: 180)), end: now);
    }
  }

  String _dateToQuarter(DateTime date) =>
      '${date.year}-T${((date.month - 1) ~/ 3) + 1}';

  Future<void> _generate() async {
    if (!_hasSelectedContent()) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sélectionnez au moins une section')));
      return;
    }

    setState(() => _generating = true);
    final dateRange = _getDateRange();
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
    if (_reportNameController.text.trim().isNotEmpty)
      payload['name'] = _reportNameController.text.trim();

    try {
      final api = ref.read(apiClientProvider);
      await api.post('/reports/dynamic', data: payload);
      _clearForm();
      widget.onReportGenerated();
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Rapport généré')));
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red));
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  void _clearForm() {
    _selectedRegion = null;
    _selectedDepartment = null;
    _selectedSubdivision = null;
    _datePreset = '6months';
    _customDateRange = null;
    _selectedGroups.updateAll((k, v) => false);
    _selectedGroups['Executive Summary'] = true;
    _reportNameController.clear();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
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
    );
  }

  Widget _buildLocationSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionLabel(icon: Icons.place_outlined, label: 'LOCALISATION'),
        const SizedBox(height: 12),
        if (_geoLoading)
          const LinearProgressIndicator(color: Color(0xFF1D9E75))
        else ...[
          DropdownField<String?>(
            label: 'Région',
            value: _selectedRegion,
            items: [null, ..._regionNames],
            itemLabel: (v) => v ?? 'Nationale',
            onChanged: (v) => setState(() => _selectedRegion = v),
          ),
        ],
      ],
    );
  }

  Widget _buildPeriodSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionLabel(
            icon: Icons.calendar_today_outlined, label: 'PÉRIODE'),
        const SizedBox(height: 12),
        ...['3 mois', '6 mois', '12 mois', 'Année en cours', 'Personnalisé']
            .asMap()
            .entries
            .map((entry) {
          final value =
              ['3months', '6months', '12months', 'ytd', 'custom'][entry.key];
          return RadioListTile<String>(
            value: value,
            groupValue: _datePreset,
            onChanged: (v) => setState(() => _datePreset = v!),
            title: Text(entry.value),
            activeColor: const Color(0xFF1D9E75),
            contentPadding: EdgeInsets.zero,
            dense: true,
          );
        }),
        if (_datePreset == 'custom')
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              children: [
                Expanded(
                    child: DateField(
                        label: 'Du',
                        date: _customDateRange?.start,
                        onTap: () async {
                          final picked = await showDateRangePicker(
                              context: context,
                              firstDate: DateTime(2020),
                              lastDate: DateTime.now());
                          if (picked != null)
                            setState(() => _customDateRange = picked);
                        })),
                const SizedBox(width: 12),
                Expanded(
                    child: DateField(
                        label: 'Au',
                        date: _customDateRange?.end,
                        onTap: () async {
                          final picked = await showDateRangePicker(
                              context: context,
                              firstDate: DateTime(2020),
                              lastDate: DateTime.now());
                          if (picked != null)
                            setState(() => _customDateRange = picked);
                        })),
              ],
            ),
          ),
      ],
    );
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
                        () => _selectedGroups.updateAll((k, v) => true)),
                    child: const Text('Tout')),
                TextButton(
                    onPressed: () => setState(
                        () => _selectedGroups.updateAll((k, v) => false)),
                    child: const Text('Aucun')),
              ],
            ),
          ],
        ),
        ..._selectedGroups.entries.map((entry) => CheckboxListTile(
              value: entry.value,
              onChanged: (v) =>
                  setState(() => _selectedGroups[entry.key] = v ?? false),
              title: Text(entry.key),
              subtitle: Text(_groupSubtitle(entry.key),
                  style: const TextStyle(fontSize: 11)),
              activeColor: const Color(0xFF1D9E75),
              contentPadding: EdgeInsets.zero,
              dense: true,
              controlAffinity: ListTileControlAffinity.leading,
            )),
      ],
    );
  }

  String _groupSubtitle(String group) => switch (group) {
        'Executive Summary' => 'KPIs + insights',
        'Employment & Workforce' => 'Tendances temporelles',
        'Skills & Training' => 'Analyse sectorielle',
        'Diversity & Inclusion' => 'Parité & inclusion',
        'Regional Analysis' => 'Détail par région',
        _ => '',
      };

  Widget _buildReportNameField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionLabel(
            icon: Icons.edit_note_outlined,
            label: 'NOM DU RAPPORT (optionnel)'),
        const SizedBox(height: 12),
        TextField(
          controller: _reportNameController,
          decoration: InputDecoration(
            hintText: 'Briefing RH Littoral Juin 2026',
            filled: true,
            fillColor: UltraTheme.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ],
    );
  }

  Widget _buildGenerateButton() {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: _hasSelectedContent() && !_generating ? _generate : null,
        style:
            ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1D9E75)),
        child: _generating
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2))
            : const Text('GÉNÉRER LE RAPPORT',
                style: TextStyle(fontWeight: FontWeight.w600)),
      ),
    );
  }
}
