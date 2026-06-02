import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/ultra_theme.dart';
import '../../data/api_client.dart';

// ─── Models ─────────────────────────────────────────────────────────────────

class _Region {
  final String id;
  final String name;
  const _Region({required this.id, required this.name});
  factory _Region.fromJson(Map<String, dynamic> j) =>
      _Region(id: j['id'] as String, name: j['name'] as String);
}

class _Department {
  final String id;
  final String name;
  const _Department({required this.id, required this.name});
  factory _Department.fromJson(Map<String, dynamic> j) =>
      _Department(id: j['id'] as String, name: j['name'] as String);
}

// ─── Constants ───────────────────────────────────────────────────────────────

const _campaignTypes = ['QUARTERLY', 'SEMESTER', 'ANNUAL'];
const _campaignTypeLabels = {
  'QUARTERLY': 'Trimestrielle',
  'SEMESTER': 'Semestrielle',
  'ANNUAL': 'Annuelle',
};

const _entityTypes = ['ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG'];
const _entityTypeLabels = {
  'ENTREPRISE': 'Entreprise',
  'COOPERATIVE': 'Coopérative',
  'CTD': 'CTD',
  'ONG': 'ONG',
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

class CampaignManagementScreen extends ConsumerStatefulWidget {
  const CampaignManagementScreen({super.key});

  @override
  ConsumerState<CampaignManagementScreen> createState() =>
      _CampaignManagementScreenState();
}

class _CampaignManagementScreenState
    extends ConsumerState<CampaignManagementScreen> {
  List<dynamic> _campaigns = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCampaigns();
  }

  Future<void> _loadCampaigns() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.get('/campaigns');
      setState(() => _campaigns = response.data as List<dynamic>? ?? []);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        title: const Text(
          'Gestion des Campagnes',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadCampaigns,
            tooltip: 'Actualiser',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateDialog,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nouvelle campagne'),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.red.shade300),
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: _loadCampaigns,
              icon: const Icon(Icons.refresh),
              label: const Text('Réessayer'),
            ),
          ],
        ),
      );
    }
    if (_campaigns.isEmpty) {
      return _buildEmptyState();
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
      itemCount: _campaigns.length,
      itemBuilder: (context, i) => _buildCampaignCard(_campaigns[i]),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.campaign_outlined, size: 64, color: Colors.grey.shade400),
          const SizedBox(height: 16),
          Text('Aucune campagne',
              style: TextStyle(fontSize: 18, color: Colors.grey.shade600)),
          const SizedBox(height: 8),
          Text('Cliquez sur + pour créer une campagne',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade500)),
        ],
      ),
    );
  }

  Widget _buildCampaignCard(dynamic campaign) {
    final status = campaign['status'] as String? ?? 'DRAFT';
    final color = _statusColor(status);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Container(
          width: 50,
          height: 50,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(_statusIcon(status), color: color),
        ),
        title: Text(
          campaign['name'] as String? ?? 'Sans nom',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text('Code: ${campaign['code'] ?? '—'}',
                style: const TextStyle(fontSize: 12)),
            Text('Échéance: ${_formatDate(campaign['deadline'])}',
                style: const TextStyle(fontSize: 12)),
            Text(
                'Type: ${_campaignTypeLabels[campaign['type']] ?? campaign['type'] ?? '—'}',
                style: const TextStyle(fontSize: 12)),
            if (campaign['_count'] != null)
              Text(
                  'Soumissions: ${(campaign['_count'] as Map)['submissions'] ?? 0}',
                  style: const TextStyle(fontSize: 12)),
          ],
        ),
        isThreeLine: true,
        trailing: Chip(
          label: Text(status, style: const TextStyle(fontSize: 11)),
          backgroundColor: color.withValues(alpha: 0.1),
          labelStyle: TextStyle(color: color),
        ),
        onTap: () => _viewCampaign(campaign),
      ),
    );
  }

  Future<void> _openCreateDialog() async {
    final created = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _CreateCampaignDialog(api: ref.read(apiClientProvider)),
    );
    if (created == true) {
      _loadCampaigns();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Campagne créée avec succès'),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  Future<void> _viewCampaign(dynamic campaign) async {
    // TODO: navigate to campaign detail screen
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Détails: ${campaign['name']}')),
    );
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'ACTIVE':
        return Colors.green;
      case 'DRAFT':
        return Colors.orange;
      case 'CLOSED':
      case 'ARCHIVED':
        return Colors.grey;
      case 'PAUSED':
        return Colors.blue;
      default:
        return Colors.blueGrey;
    }
  }

  IconData _statusIcon(String? status) {
    switch (status) {
      case 'ACTIVE':
        return Icons.play_circle_outline;
      case 'DRAFT':
        return Icons.edit_outlined;
      case 'CLOSED':
        return Icons.check_circle_outline;
      case 'PAUSED':
        return Icons.pause_circle_outline;
      default:
        return Icons.campaign_outlined;
    }
  }

  String _formatDate(dynamic date) {
    if (date == null) return 'Non définie';
    try {
      final dt = DateTime.parse(date.toString());
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    } catch (_) {
      return date.toString();
    }
  }
}

// ─── Create Campaign Dialog ───────────────────────────────────────────────────

class _CreateCampaignDialog extends StatefulWidget {
  final ApiClient api;
  const _CreateCampaignDialog({required this.api});

  @override
  State<_CreateCampaignDialog> createState() => _CreateCampaignDialogState();
}

class _CreateCampaignDialogState extends State<_CreateCampaignDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();

  // Campaign type
  String _selectedType = 'QUARTERLY';

  // Dates
  DateTime? _startDate;
  DateTime? _deadline;

  // Reminders
  bool _autoReminders = true;
  final List<int> _reminderDays = [7, 3, 1];

  // Entity types (multi-select)
  final Set<String> _selectedEntityTypes = {};

  // Regions cascade
  List<_Region> _regions = [];
  List<_Department> _departments = [];
  final Set<String> _selectedRegionNames =
      {}; // stored as names (backend expects names)
  final Set<String> _selectedDepartmentNames = {};

  // Loading states
  bool _loadingRegions = true;
  bool _loadingDepartments = false;
  bool _submitting = false;
  String? _submitError;

  // For cascading — the region whose departments are shown
  String? _expandedRegionId;

  @override
  void initState() {
    super.initState();
    _loadRegions();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadRegions() async {
    try {
      final data = await widget.api.getRegions();
      setState(() {
        _regions = data
            .whereType<Map<String, dynamic>>()
            .map(_Region.fromJson)
            .toList();
        _loadingRegions = false;
      });
    } catch (_) {
      setState(() => _loadingRegions = false);
    }
  }

  Future<void> _loadDepartments(String regionId) async {
    setState(() {
      _loadingDepartments = true;
      _departments = [];
    });
    try {
      final data = await widget.api.getDepartments(regionId);
      setState(() {
        _departments = data
            .whereType<Map<String, dynamic>>()
            .map(_Department.fromJson)
            .toList();
        _loadingDepartments = false;
      });
    } catch (_) {
      setState(() => _loadingDepartments = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_startDate == null || _deadline == null) {
      setState(() => _submitError = 'Veuillez sélectionner les deux dates.');
      return;
    }
    if (_deadline!.isBefore(_startDate!)) {
      setState(
          () => _submitError = "L'échéance doit être après la date de début.");
      return;
    }

    setState(() {
      _submitting = true;
      _submitError = null;
    });

    try {
      await widget.api.post('/campaigns', data: {
        'name': _nameCtrl.text.trim(),
        'description':
            _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        'type': _selectedType,
        'startDate': _startDate!.toIso8601String(),
        'deadline': _deadline!.toIso8601String(),
        'targetRegions': _selectedRegionNames.toList(),
        'targetDepartments': _selectedDepartmentNames.toList(),
        'targetEntityTypes': _selectedEntityTypes.toList(),
        'autoReminders': _autoReminders,
        'reminderDays': _reminderDays,
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() {
        _submitError = e.toString();
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560, maxHeight: 720),
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.fromLTRB(20, 16, 8, 16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(12)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.campaign_rounded,
                      color: Colors.white, size: 22),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Nouvelle campagne',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    onPressed: () => Navigator.of(context).pop(false),
                  ),
                ],
              ),
            ),

            // Scrollable form body
            Expanded(
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    // ── Name ──────────────────────────────────────────────
                    _sectionLabel('Informations générales'),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _nameCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Nom de la campagne *',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.label_outline),
                      ),
                      validator: (v) =>
                          (v == null || v.trim().isEmpty) ? 'Requis' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _descCtrl,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Description (optionnel)',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.notes_outlined),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // ── Type ──────────────────────────────────────────────
                    _sectionLabel('Type de campagne'),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _selectedType,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.category_outlined),
                      ),
                      items: _campaignTypes
                          .map((t) => DropdownMenuItem(
                                value: t,
                                child: Text(_campaignTypeLabels[t] ?? t),
                              ))
                          .toList(),
                      onChanged: (v) =>
                          setState(() => _selectedType = v ?? 'QUARTERLY'),
                    ),
                    const SizedBox(height: 16),

                    // ── Dates ─────────────────────────────────────────────
                    _sectionLabel('Période'),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                            child: _DatePickerField(
                          label: 'Date de début *',
                          value: _startDate,
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2040),
                          onPicked: (d) => setState(() => _startDate = d),
                        )),
                        const SizedBox(width: 12),
                        Expanded(
                            child: _DatePickerField(
                          label: 'Échéance *',
                          value: _deadline,
                          firstDate: _startDate ?? DateTime.now(),
                          lastDate: DateTime(2040),
                          onPicked: (d) => setState(() => _deadline = d),
                        )),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // ── Entity types ──────────────────────────────────────
                    _sectionLabel('Types d\'entités ciblées'),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: _entityTypes.map((et) {
                        final selected = _selectedEntityTypes.contains(et);
                        return FilterChip(
                          label: Text(_entityTypeLabels[et] ?? et),
                          selected: selected,
                          onSelected: (v) => setState(() {
                            if (v) {
                              _selectedEntityTypes.add(et);
                            } else {
                              _selectedEntityTypes.remove(et);
                            }
                          }),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),

                    // ── Regions cascade ───────────────────────────────────
                    _sectionLabel('Régions & Départements ciblés'),
                    const SizedBox(height: 4),
                    Text(
                      'Sélectionnez des régions. Développez une région pour cibler des départements spécifiques.',
                      style:
                          TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ),
                    const SizedBox(height: 10),
                    if (_loadingRegions)
                      const Center(child: CircularProgressIndicator())
                    else
                      _buildRegionCascade(),
                    const SizedBox(height: 16),

                    // ── Reminders ─────────────────────────────────────────
                    _sectionLabel('Rappels automatiques'),
                    const SizedBox(height: 8),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Activer les rappels'),
                      subtitle: const Text(
                          'Envoyer des rappels aux établissements avant l\'échéance'),
                      value: _autoReminders,
                      onChanged: (v) => setState(() => _autoReminders = v),
                    ),
                    if (_autoReminders) ...[
                      const SizedBox(height: 4),
                      Text('Rappels à J-:',
                          style: TextStyle(
                              fontSize: 13, color: Colors.grey.shade700)),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        children: [1, 3, 7, 14, 30].map((day) {
                          final active = _reminderDays.contains(day);
                          return FilterChip(
                            label: Text('$day j'),
                            selected: active,
                            onSelected: (v) => setState(() {
                              if (v) {
                                _reminderDays.add(day);
                                _reminderDays
                                    .sort((a, b) => b.compareTo(a)); // desc
                              } else {
                                _reminderDays.remove(day);
                              }
                            }),
                          );
                        }).toList(),
                      ),
                    ],

                    // ── Error ─────────────────────────────────────────────
                    if (_submitError != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline,
                                color: Colors.red.shade600, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(_submitError!,
                                  style: TextStyle(
                                      color: Colors.red.shade700,
                                      fontSize: 13)),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),

            // Footer buttons
            Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: Colors.grey.shade200)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: _submitting
                        ? null
                        : () => Navigator.of(context).pop(false),
                    child: const Text('Annuler'),
                  ),
                  const SizedBox(width: 12),
                  FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: _submitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.check_rounded, size: 18),
                    label: const Text('Créer la campagne'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRegionCascade() {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: _regions.asMap().entries.map((entry) {
          final i = entry.key;
          final region = entry.value;
          final isExpanded = _expandedRegionId == region.id;
          final regionSelected = _selectedRegionNames.contains(region.name);

          return Column(
            children: [
              if (i > 0) Divider(height: 1, color: Colors.grey.shade200),

              // Region row
              InkWell(
                onTap: () async {
                  // Toggle expansion for department loading
                  if (isExpanded) {
                    setState(() => _expandedRegionId = null);
                  } else {
                    setState(() => _expandedRegionId = region.id);
                    await _loadDepartments(region.id);
                  }
                },
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      // Region checkbox
                      Checkbox(
                        value: regionSelected,
                        onChanged: (v) => setState(() {
                          if (v == true) {
                            _selectedRegionNames.add(region.name);
                          } else {
                            _selectedRegionNames.remove(region.name);
                            // Also deselect all its departments
                            if (_expandedRegionId == region.id) {
                              for (final d in _departments) {
                                _selectedDepartmentNames.remove(d.name);
                              }
                            }
                          }
                        }),
                      ),
                      Expanded(
                        child: Text(
                          region.name,
                          style: TextStyle(
                            fontWeight: regionSelected
                                ? FontWeight.w600
                                : FontWeight.normal,
                          ),
                        ),
                      ),
                      // Expand arrow for departments
                      Icon(
                        isExpanded
                            ? Icons.keyboard_arrow_up
                            : Icons.keyboard_arrow_down,
                        color: Colors.grey.shade500,
                        size: 20,
                      ),
                    ],
                  ),
                ),
              ),

              // Department sub-list (cascaded)
              if (isExpanded)
                Container(
                  color: Colors.grey.shade50,
                  child: _loadingDepartments
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: Center(
                              child: SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2))),
                        )
                      : _departments.isEmpty
                          ? Padding(
                              padding: const EdgeInsets.all(12),
                              child: Text(
                                'Aucun département disponible',
                                style: TextStyle(
                                    color: Colors.grey.shade500, fontSize: 13),
                              ),
                            )
                          : Column(
                              children: _departments.map((dept) {
                                final deptSelected = _selectedDepartmentNames
                                    .contains(dept.name);
                                return CheckboxListTile(
                                  dense: true,
                                  contentPadding: const EdgeInsets.only(
                                      left: 32, right: 12),
                                  title: Text(dept.name,
                                      style: const TextStyle(fontSize: 13)),
                                  value: deptSelected,
                                  onChanged: (v) => setState(() {
                                    if (v == true) {
                                      _selectedDepartmentNames.add(dept.name);
                                      // Auto-select parent region if not already selected
                                      _selectedRegionNames.add(region.name);
                                    } else {
                                      _selectedDepartmentNames
                                          .remove(dept.name);
                                    }
                                  }),
                                );
                              }).toList(),
                            ),
                ),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: Colors.grey.shade700,
        letterSpacing: 0.3,
      ),
    );
  }
}

// ─── Date Picker Field ────────────────────────────────────────────────────────

class _DatePickerField extends StatelessWidget {
  final String label;
  final DateTime? value;
  final DateTime firstDate;
  final DateTime lastDate;
  final ValueChanged<DateTime> onPicked;

  const _DatePickerField({
    required this.label,
    required this.value,
    required this.firstDate,
    required this.lastDate,
    required this.onPicked,
  });

  String _format(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: value ?? DateTime.now(),
          firstDate: firstDate,
          lastDate: lastDate,
        );
        if (picked != null) onPicked(picked);
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          prefixIcon: const Icon(Icons.calendar_today_outlined, size: 18),
          suffixIcon: const Icon(Icons.arrow_drop_down),
        ),
        child: Text(
          value != null ? _format(value!) : 'Choisir...',
          style: TextStyle(
            color: value != null ? null : Colors.grey.shade500,
          ),
        ),
      ),
    );
  }
}
