import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/ultra_theme.dart';
import '../../data/api_client.dart';
import 'campaign_constants.dart';
import 'campaign_detail_screen.dart';
import 'date_picker_field.dart';
import 'region_department_selector.dart';

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
  String? _statusFilter;
  String? _actionInProgressId;

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
      final response = await api.get('/campaigns',
          queryParameters:
              _statusFilter != null ? {'status': _statusFilter} : null);
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
    return Column(
      children: [
        _buildStatusFilterBar(),
        Expanded(child: _buildList()),
      ],
    );
  }

  Widget _buildStatusFilterBar() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          _statusFilterChip(null, 'Toutes'),
          for (final s in campaignStatuses)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: _statusFilterChip(s, campaignStatusLabels[s] ?? s),
            ),
        ],
      ),
    );
  }

  Widget _statusFilterChip(String? status, String label) {
    final selected = _statusFilter == status;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) {
        setState(() => _statusFilter = status);
        _loadCampaigns();
      },
    );
  }

  Widget _buildList() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: UltraTheme.error.withValues(alpha: 0.6)),
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: UltraTheme.error)),
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
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: _buildCampaignTable(),
      ),
    );
  }

  Widget _buildCampaignTable() {
    return DataTable(
      columns: const [
        DataColumn(label: Text('Campagne')),
        DataColumn(label: Text('Nom')),
        DataColumn(label: Text('Statut')),
        DataColumn(label: Text('Action')),
      ],
      rows: _campaigns.map(_buildCampaignRow).toList(),
    );
  }

  DataRow _buildCampaignRow(dynamic campaign) {
    final status = campaign['status'] as String? ?? 'DRAFT';
    final color = _statusColor(status);
    return DataRow(
      cells: [
        DataCell(Text(campaign['code'] as String? ?? '—')),
        DataCell(
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 240),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(_statusIcon(status), size: 16, color: color),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    campaign['name'] as String? ?? 'Sans nom',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          onTap: () => _viewCampaign(campaign),
        ),
        DataCell(Chip(
          label: Text(campaignStatusLabels[status] ?? status,
              style: const TextStyle(fontSize: 11)),
          backgroundColor: color.withValues(alpha: 0.1),
          labelStyle: TextStyle(color: color),
          visualDensity: VisualDensity.compact,
        )),
        DataCell(_buildRowActions(campaign, status)),
      ],
    );
  }

  Widget _buildRowActions(dynamic campaign, String status) {
    final canActivate = status == 'DRAFT' || status == 'PAUSED';
    final canDeactivate = status == 'ACTIVE';
    final canEdit = status != 'ARCHIVED';
    final canClose = status == 'ACTIVE' || status == 'PAUSED';
    final canExtend = status != 'CLOSED' && status != 'ARCHIVED';
    final canRemind = status == 'ACTIVE';
    final hasMoreActions = canClose || canExtend || canRemind;
    final busy = _actionInProgressId == campaign['id'];

    if (busy) {
      return const Padding(
        padding: EdgeInsets.symmetric(horizontal: 12),
        child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (canActivate)
          IconButton(
            tooltip: 'Activer',
            icon: const Icon(Icons.play_circle_outline, color: UltraTheme.success),
            onPressed: () => _activateRow(campaign),
          ),
        if (canDeactivate)
          IconButton(
            tooltip: 'Désactiver',
            icon: const Icon(Icons.pause_circle_outline, color: UltraTheme.warning),
            onPressed: () => _deactivateRow(campaign),
          ),
        if (canEdit)
          IconButton(
            tooltip: 'Modifier',
            icon: const Icon(Icons.edit_outlined),
            onPressed: () => _editRow(campaign),
          ),
        IconButton(
          tooltip: 'Supprimer',
          icon: const Icon(Icons.delete_outline, color: UltraTheme.error),
          onPressed: () => _deleteRow(campaign),
        ),
        if (hasMoreActions)
          PopupMenuButton<String>(
            tooltip: "Plus d'actions",
            icon: const Icon(Icons.more_horiz_rounded),
            onSelected: (action) => _moreRowAction(campaign, action),
            itemBuilder: (ctx) => [
              if (canClose)
                const PopupMenuItem(value: 'close', child: Text('Clôturer')),
              if (canExtend)
                const PopupMenuItem(
                    value: 'extend', child: Text("Prolonger l'échéance")),
              if (canRemind)
                const PopupMenuItem(
                    value: 'remind', child: Text('Envoyer un rappel')),
            ],
          ),
      ],
    );
  }

  // ── Row action handlers ───────────────────────────────────────────────────

  Future<void> _runRowAction(
    dynamic campaign,
    Future<void> Function() action, {
    String? successMessage,
  }) async {
    final id = campaign['id'] as String;
    setState(() => _actionInProgressId = id);
    try {
      await action();
      await _loadCampaigns();
      if (mounted && successMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(successMessage),
          backgroundColor: UltraTheme.success,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString()),
          backgroundColor: UltraTheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _actionInProgressId = null);
    }
  }

  Future<void> _activateRow(dynamic campaign) => _runRowAction(
        campaign,
        () => ref
            .read(apiClientProvider)
            .post('/campaigns/${campaign['id']}/activate'),
        successMessage: 'Campagne activée.',
      );

  Future<void> _deactivateRow(dynamic campaign) => _runRowAction(
        campaign,
        () => ref
            .read(apiClientProvider)
            .post('/campaigns/${campaign['id']}/pause'),
        successMessage: 'Campagne désactivée.',
      );

  Future<void> _moreRowAction(dynamic campaign, String action) async {
    switch (action) {
      case 'close':
        await _runRowAction(
          campaign,
          () => ref
              .read(apiClientProvider)
              .post('/campaigns/${campaign['id']}/close'),
          successMessage: 'Campagne clôturée.',
        );
        break;
      case 'extend':
        await _extendRow(campaign);
        break;
      case 'remind':
        await _remindRow(campaign);
        break;
    }
  }

  Future<void> _extendRow(dynamic campaign) async {
    final current = DateTime.tryParse(campaign['deadline']?.toString() ?? '') ??
        DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: current.isAfter(DateTime.now()) ? current : DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime(2040),
    );
    if (picked == null) return;
    await _runRowAction(
      campaign,
      () => ref.read(apiClientProvider).post(
        '/campaigns/${campaign['id']}/extend',
        data: {'newDeadline': picked.toIso8601String()},
      ),
      successMessage: 'Échéance prolongée.',
    );
  }

  Future<void> _remindRow(dynamic campaign) async {
    String selected = reminderTypes.first;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Envoyer un rappel'),
          content: DropdownButtonFormField<String>(
            initialValue: selected,
            items: reminderTypes
                .map((t) => DropdownMenuItem(
                      value: t,
                      child: Text(reminderTypeLabels[t] ?? t),
                    ))
                .toList(),
            onChanged: (v) => setDialogState(() => selected = v ?? selected),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Annuler'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Envoyer'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    await _runRowAction(
      campaign,
      () => ref.read(apiClientProvider).post(
        '/campaigns/${campaign['id']}/remind',
        data: {'type': selected},
      ),
      successMessage: 'Rappel envoyé.',
    );
  }

  Future<void> _editRow(dynamic campaign) async {
    final updated = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => EditCampaignDialog(
        api: ref.read(apiClientProvider),
        campaign: campaign as Map<String, dynamic>,
      ),
    );
    if (updated == true) _loadCampaigns();
  }

  Future<void> _deleteRow(dynamic campaign) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Supprimer la campagne ?'),
        content: const Text(
            'Cette action est irréversible et supprimera également toutes les soumissions associées.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: UltraTheme.error),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _runRowAction(
      campaign,
      () => ref.read(apiClientProvider).delete('/campaigns/${campaign['id']}'),
      successMessage: 'Campagne supprimée.',
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.campaign_outlined, size: 64, color: UltraTheme.textMuted),
          const SizedBox(height: 16),
          Text('Aucune campagne',
              style: TextStyle(fontSize: 18, color: UltraTheme.textMuted)),
          const SizedBox(height: 8),
          Text('Cliquez sur + pour créer une campagne',
              style: TextStyle(fontSize: 14, color: UltraTheme.textMuted)),
        ],
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
            backgroundColor: UltraTheme.success,
          ),
        );
      }
    }
  }

  Future<void> _viewCampaign(dynamic campaign) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CampaignDetailScreen(
          initialCampaign: campaign as Map<String, dynamic>,
        ),
      ),
    );
    if (changed == true) _loadCampaigns();
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'ACTIVE':
        return UltraTheme.success;
      case 'DRAFT':
        return UltraTheme.warning;
      case 'CLOSED':
      case 'ARCHIVED':
        return UltraTheme.textMuted;
      case 'PAUSED':
        return UltraTheme.info;
      default:
        return UltraTheme.textSecondary;
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
}

// ─── Create Campaign Dialog ──────────────────────────────────────────────────

class _CreateCampaignDialog extends StatefulWidget {
  final ApiClient api;
  const _CreateCampaignDialog({required this.api});

  @override
  State<_CreateCampaignDialog> createState() => _CreateCampaignDialogState();
}

class _CreateCampaignDialogState extends State<_CreateCampaignDialog> {
  final _formKey = GlobalKey<FormState>();
  final _descCtrl = TextEditingController();

  // Campaign type
  String _selectedType = 'QUARTERLY';
  String _selectedCollectionType = 'ONEFOP';

  // Dates
  DateTime? _startDate;
  DateTime? _deadline;

  // Reminders
  bool _autoReminders = true;
  final List<int> _reminderDays = [7, 3, 1];

  // Entity types (multi-select)
  final Set<String> _selectedEntityTypes = {};

  // Regions/departments cascade (stored as names — backend expects names)
  Set<String> _selectedRegionNames = {};
  Set<String> _selectedDepartmentNames = {};

  bool _submitting = false;
  String? _submitError;

  @override
  void dispose() {
    _descCtrl.dispose();
    super.dispose();
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
      final conflict = await _checkConflict();
      if (conflict != null) {
        setState(() => _submitting = false);
        if (!mounted) return;
        final proceed = await _confirmOverwrite(conflict);
        if (proceed != true) return;
        setState(() => _submitting = true);
      }

      // name is intentionally omitted — the backend always derives the
      // full official title (base title + period) from collectionType,
      // type and startDate, so anything sent here would just be ignored.
      await widget.api.post('/campaigns', data: {
        'description':
            _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        'type': _selectedType,
        'collectionType': _selectedCollectionType,
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

  /// The campaign already active for the chosen module, if any — null if
  /// there's nothing to warn about, also null (rather than throwing) if the
  /// check itself fails so a transient error here never blocks creation.
  Future<Map<String, dynamic>?> _checkConflict() async {
    try {
      final resp = await widget.api.get('/campaigns/conflicts',
          queryParameters: {'collectionType': _selectedCollectionType});
      return resp.data as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  Future<bool?> _confirmOverwrite(Map<String, dynamic> conflict) {
    final label = collectionTypeLabels[_selectedCollectionType] ??
        _selectedCollectionType;
    final deadline = _formatConflictDate(conflict['deadline']);
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Campagne déjà active'),
        content: Text(
          'Une campagne "$label" est déjà active : "${conflict['name']}" '
          '(échéance $deadline).\n\n'
          'Créer cette nouvelle campagne clôturera la précédente et ouvrira '
          'celle-ci à sa place. Continuer ?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Continuer'),
          ),
        ],
      ),
    );
  }

  String _formatConflictDate(dynamic date) {
    if (date == null) return 'non définie';
    try {
      final dt = DateTime.parse(date.toString());
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    } catch (_) {
      return date.toString();
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
                color: UltraTheme.primary,
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
                    // ── Name (derived from collection type) ───────────────
                    _sectionLabel('Informations générales'),
                    const SizedBox(height: 4),
                    Text(
                      "Le nom officiel détermine aussi quel formulaire s'ouvre "
                      "pour les établissements ciblés une fois la campagne active.",
                      style:
                          TextStyle(fontSize: 12, color: UltraTheme.textMuted),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _selectedCollectionType,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Nom de la campagne *',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.label_outline),
                      ),
                      items: collectionTypes
                          .map((ct) => DropdownMenuItem(
                                value: ct,
                                child: Text(
                                  campaignNameByCollectionType[ct] ?? ct,
                                  style: const TextStyle(fontSize: 13),
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 2,
                                ),
                              ))
                          .toList(),
                      onChanged: (v) => setState(
                          () => _selectedCollectionType = v ?? 'ONEFOP'),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: UltraTheme.background,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        campaignFullNamePreview(
                            _selectedCollectionType, _selectedType, _startDate),
                        style: TextStyle(
                            fontSize: 12,
                            color: UltraTheme.textSecondary,
                            fontStyle: FontStyle.italic),
                      ),
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
                      items: campaignTypes
                          .map((t) => DropdownMenuItem(
                                value: t,
                                child: Text(campaignTypeLabels[t] ?? t),
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
                            child: DatePickerField(
                          label: 'Date de début *',
                          value: _startDate,
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2040),
                          onPicked: (d) => setState(() => _startDate = d),
                        )),
                        const SizedBox(width: 12),
                        Expanded(
                            child: DatePickerField(
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
                      children: [
                        FilterChip(
                          label: const Text('Toutes'),
                          selected: _selectedEntityTypes.isEmpty,
                          onSelected: (v) {
                            if (v) setState(() => _selectedEntityTypes.clear());
                          },
                        ),
                        ...entityTypes.map((et) {
                          final selected = _selectedEntityTypes.contains(et);
                          return FilterChip(
                            label: Text(entityTypeLabels[et] ?? et),
                            selected: selected,
                            onSelected: (v) => setState(() {
                              if (v) {
                                _selectedEntityTypes.add(et);
                              } else {
                                _selectedEntityTypes.remove(et);
                              }
                            }),
                          );
                        }),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // ── Regions cascade ───────────────────────────────────
                    _sectionLabel('Régions & Départements ciblés'),
                    const SizedBox(height: 4),
                    Text(
                      'Sélectionnez des régions. Développez une région pour cibler des départements spécifiques.',
                      style:
                          TextStyle(fontSize: 12, color: UltraTheme.textMuted),
                    ),
                    const SizedBox(height: 10),
                    RegionDepartmentSelector(
                      api: widget.api,
                      initialRegionNames: _selectedRegionNames,
                      initialDepartmentNames: _selectedDepartmentNames,
                      onRegionsChanged: (s) => _selectedRegionNames = s,
                      onDepartmentsChanged: (s) => _selectedDepartmentNames = s,
                    ),
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
                              fontSize: 13, color: UltraTheme.textSecondary)),
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
                          color: UltraTheme.error.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: UltraTheme.error.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline,
                                color: UltraTheme.error, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(_submitError!,
                                  style: TextStyle(
                                      color: UltraTheme.error,
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
                border: Border(top: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.2))),
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

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: UltraTheme.textSecondary,
        letterSpacing: 0.3,
      ),
    );
  }
}
