import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../theme/ultra_theme.dart';
import 'campaign_constants.dart';
import 'date_picker_field.dart';
import 'region_department_selector.dart';

class CampaignDetailScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> initialCampaign;
  const CampaignDetailScreen({super.key, required this.initialCampaign});

  @override
  ConsumerState<CampaignDetailScreen> createState() =>
      _CampaignDetailScreenState();
}

class _CampaignDetailScreenState extends ConsumerState<CampaignDetailScreen> {
  late Map<String, dynamic> _campaign;
  Map<String, dynamic>? _progress;
  List<dynamic> _submissions = [];
  bool _loadingDetail = true;
  bool _loadingSubmissions = true;
  String? _detailError;
  String? _submissionsError;
  String? _submissionStatusFilter;
  bool _actionInProgress = false;
  bool _changed = false;

  String get _id => widget.initialCampaign['id'] as String;
  ApiClient get _api => ref.read(apiClientProvider);

  @override
  void initState() {
    super.initState();
    _campaign = widget.initialCampaign;
    _loadDetail();
    _loadProgress();
    _loadSubmissions();
  }

  Future<void> _loadDetail() async {
    setState(() {
      _loadingDetail = true;
      _detailError = null;
    });
    try {
      final resp = await _api.get('/campaigns/$_id');
      if (!mounted) return;
      setState(() {
        _campaign = resp.data as Map<String, dynamic>;
        _loadingDetail = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingDetail = false;
        _detailError = e.toString();
      });
    }
  }

  Future<void> _loadProgress() async {
    try {
      final resp = await _api.get('/campaigns/$_id/progress');
      if (!mounted) return;
      setState(() => _progress = resp.data as Map<String, dynamic>?);
    } catch (_) {}
  }

  Future<void> _loadSubmissions() async {
    setState(() {
      _loadingSubmissions = true;
      _submissionsError = null;
    });
    try {
      final resp = await _api.get('/campaigns/$_id/submissions',
          queryParameters: _submissionStatusFilter != null
              ? {'status': _submissionStatusFilter}
              : null);
      if (!mounted) return;
      setState(() {
        _submissions = resp.data as List<dynamic>? ?? [];
        _loadingSubmissions = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingSubmissions = false;
        _submissionsError = e.toString();
      });
    }
  }

  Future<void> _refreshAll() async {
    await Future.wait([_loadDetail(), _loadProgress(), _loadSubmissions()]);
  }

  // ── Lifecycle actions ─────────────────────────────────────────────────

  Future<void> _runAction(Future<void> Function() action,
      {String? successMessage, bool refresh = true}) async {
    setState(() => _actionInProgress = true);
    try {
      await action();
      _changed = true;
      if (refresh) await _refreshAll();
      if (mounted && successMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(successMessage),
          backgroundColor: Colors.green,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString()),
          backgroundColor: Colors.red,
        ));
      }
    } finally {
      if (mounted) setState(() => _actionInProgress = false);
    }
  }

  Future<void> _activate() => _runAction(
        () async {
          await _api.post('/campaigns/$_id/activate');
        },
        successMessage: 'Campagne activée.',
      );

  Future<void> _pause() => _runAction(
        () async {
          await _api.post('/campaigns/$_id/pause');
        },
        successMessage: 'Campagne mise en pause.',
      );

  Future<void> _close() => _runAction(
        () async {
          await _api.post('/campaigns/$_id/close');
        },
        successMessage: 'Campagne clôturée.',
      );

  Future<void> _confirmDelete() async {
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
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _runAction(() async {
      await _api.delete('/campaigns/$_id');
    }, refresh: false);
    if (mounted) Navigator.of(context).pop(true);
  }

  Future<void> _extendDeadline() async {
    final current =
        DateTime.tryParse(_campaign['deadline']?.toString() ?? '') ??
            DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: current.isAfter(DateTime.now()) ? current : DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime(2040),
    );
    if (picked == null) return;
    await _runAction(
      () async {
        await _api.post('/campaigns/$_id/extend',
            data: {'newDeadline': picked.toIso8601String()});
      },
      successMessage: 'Échéance prolongée.',
    );
  }

  Future<void> _sendReminder() async {
    String selected = reminderTypes.first;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Envoyer un rappel'),
          content: DropdownButtonFormField<String>(
            value: selected,
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
    await _runAction(
      () async {
        await _api.post('/campaigns/$_id/remind', data: {'type': selected});
      },
      successMessage: 'Rappel envoyé.',
    );
  }

  Future<void> _openEditDialog() async {
    final updated = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => EditCampaignDialog(api: _api, campaign: _campaign),
    );
    if (updated == true) {
      _changed = true;
      _refreshAll();
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final status = _campaign['status'] as String? ?? 'DRAFT';
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(_changed),
        ),
        title: Text(_campaign['name'] as String? ?? 'Campagne'),
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        bottom: _loadingDetail
            ? const PreferredSize(
                preferredSize: Size.fromHeight(2),
                child: LinearProgressIndicator(minHeight: 2),
              )
            : null,
      ),
      body: RefreshIndicator(
        onRefresh: _refreshAll,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_detailError != null) _errorBanner(_detailError!, _loadDetail),
            _buildActionBar(status),
            const SizedBox(height: 12),
            _buildInfoCard(status),
            const SizedBox(height: 12),
            _buildProgressCard(),
            const SizedBox(height: 12),
            _buildTargetingCard(),
            const SizedBox(height: 12),
            _buildRemindersCard(),
            const SizedBox(height: 12),
            _buildSubmissionsCard(),
          ],
        ),
      ),
    );
  }

  Widget _errorBanner(String message, VoidCallback onRetry) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: Colors.red.shade600, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(message,
                style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
          ),
          TextButton(onPressed: onRetry, child: const Text('Réessayer')),
        ],
      ),
    );
  }

  Widget _card({required Widget child}) {
    return Card(
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    );
  }

  // ── Visible action bar (was hidden in an AppBar overflow menu) ──────────

  Widget _buildActionBar(String status) {
    final canActivate = status == 'DRAFT' || status == 'PAUSED';
    final canDeactivate = status == 'ACTIVE';
    final canEdit = status != 'ARCHIVED';
    final canClose = status == 'ACTIVE' || status == 'PAUSED';
    final canExtend = status != 'CLOSED' && status != 'ARCHIVED';
    final canRemind = status == 'ACTIVE';
    final hasMoreActions = canClose || canExtend || canRemind;

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (canActivate)
          FilledButton.icon(
            onPressed: _actionInProgress ? null : _activate,
            icon: const Icon(Icons.play_arrow_rounded, size: 18),
            label: const Text('Activer'),
          ),
        if (canDeactivate)
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: Colors.orange),
            onPressed: _actionInProgress ? null : _pause,
            icon: const Icon(Icons.pause_rounded, size: 18),
            label: const Text('Désactiver'),
          ),
        if (canEdit)
          OutlinedButton.icon(
            onPressed: _actionInProgress ? null : _openEditDialog,
            icon: const Icon(Icons.edit_outlined, size: 18),
            label: const Text('Modifier'),
          ),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
          onPressed: _actionInProgress ? null : _confirmDelete,
          icon: const Icon(Icons.delete_outline, size: 18),
          label: const Text('Supprimer'),
        ),
        if (hasMoreActions)
          PopupMenuButton<String>(
            enabled: !_actionInProgress,
            tooltip: "Plus d'actions",
            onSelected: (action) {
              switch (action) {
                case 'close':
                  _close();
                  break;
                case 'extend':
                  _extendDeadline();
                  break;
                case 'remind':
                  _sendReminder();
                  break;
              }
            },
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
            icon: const Icon(Icons.more_horiz_rounded),
          ),
        if (_actionInProgress)
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
      ],
    );
  }

  Widget _buildInfoCard(String status) {
    final color = _statusColor(status);
    final creator = _campaign['creator'] as Map<String, dynamic>?;
    String? creatorLabel;
    if (creator != null) {
      final fullName =
          '${creator['firstName'] ?? ''} ${creator['lastName'] ?? ''}'.trim();
      creatorLabel =
          fullName.isNotEmpty ? fullName : (creator['email'] as String? ?? '—');
    }
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Chip(
                label: Text(campaignStatusLabels[status] ?? status,
                    style: TextStyle(color: color, fontSize: 12)),
                backgroundColor: color.withValues(alpha: 0.1),
              ),
              const SizedBox(width: 8),
              Text('Code: ${_campaign['code'] ?? '—'}',
                  style: UltraTheme.labelMedium),
            ],
          ),
          const SizedBox(height: 12),
          if ((_campaign['description'] as String?)?.isNotEmpty == true) ...[
            Text(_campaign['description'] as String,
                style: UltraTheme.bodyMedium),
            const SizedBox(height: 12),
          ],
          _infoRow(
              'Type',
              campaignTypeLabels[_campaign['type']] ??
                  (_campaign['type'] as String? ?? '—')),
          _infoRow(
              'Collecte',
              collectionTypeLabels[_campaign['collectionType']] ??
                  (_campaign['collectionType'] as String? ?? '—')),
          _infoRow('Début', _formatDate(_campaign['startDate'])),
          _infoRow('Échéance', _formatDate(_campaign['deadline'])),
          if (_campaign['extendedDeadline'] != null)
            _infoRow('Échéance prolongée',
                _formatDate(_campaign['extendedDeadline'])),
          if (creatorLabel != null) _infoRow('Créée par', creatorLabel),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(
              width: 140, child: Text(label, style: UltraTheme.labelMedium)),
          Expanded(child: Text(value, style: UltraTheme.bodyMedium)),
        ],
      ),
    );
  }

  Widget _buildProgressCard() {
    if (_progress == null) {
      return _card(
        child: const Center(
          child: Padding(
            padding: EdgeInsets.all(8),
            child: SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2)),
          ),
        ),
      );
    }
    final p = _progress!;
    final total = p['total'] as int? ?? 0;
    final submitted = p['submitted'] as int? ?? 0;
    final notStarted = p['notStarted'] as int? ?? 0;
    final inProgress = p['inProgress'] as int? ?? 0;
    final rate = double.tryParse('${p['completionRate']}') ?? 0;
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Progression', style: UltraTheme.titleMedium),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: total > 0 ? rate / 100 : 0,
              minHeight: 10,
              backgroundColor: Colors.grey.shade200,
              color: UltraTheme.primary,
            ),
          ),
          const SizedBox(height: 6),
          Text('${rate.toStringAsFixed(1)}% complété',
              style: UltraTheme.labelMedium),
          const SizedBox(height: 16),
          Row(
            children: [
              _statTile('Total', total, UltraTheme.textSecondary),
              _statTile('Soumises', submitted, UltraTheme.success),
              _statTile('En cours', inProgress, UltraTheme.info),
              _statTile('Non commencées', notStarted, UltraTheme.warning),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statTile(String label, int value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text('$value',
              style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w700, color: color)),
          const SizedBox(height: 2),
          Text(label,
              textAlign: TextAlign.center,
              style: UltraTheme.labelMedium.copyWith(fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildTargetingCard() {
    final regions = (_campaign['targetRegions'] as List?)?.cast<String>() ?? [];
    final departments =
        (_campaign['targetDepartments'] as List?)?.cast<String>() ?? [];
    final entities =
        (_campaign['targetEntityTypes'] as List?)?.cast<String>() ?? [];
    final autoReminders = _campaign['autoReminders'] as bool? ?? false;
    final reminderDays =
        (_campaign['reminderDays'] as List?)?.cast<int>() ?? [];

    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Ciblage', style: UltraTheme.titleMedium),
          const SizedBox(height: 12),
          _chipGroup('Régions', regions, 'Toutes (aucune restriction)'),
          const SizedBox(height: 8),
          _chipGroup('Départements', departments, 'Aucun'),
          const SizedBox(height: 8),
          _chipGroup('Types d\'entités',
              entities.map((e) => entityTypeLabels[e] ?? e).toList(), 'Tous'),
          const SizedBox(height: 12),
          Text(
            autoReminders
                ? 'Rappels automatiques activés (J-${reminderDays.join(', J-')})'
                : 'Rappels automatiques désactivés',
            style: UltraTheme.bodyMedium,
          ),
        ],
      ),
    );
  }

  Widget _chipGroup(String label, List<String> items, String emptyLabel) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: UltraTheme.labelMedium),
        const SizedBox(height: 4),
        items.isEmpty
            ? Text(emptyLabel, style: UltraTheme.bodyMedium)
            : Wrap(
                spacing: 6,
                runSpacing: 4,
                children: items
                    .map((i) => Chip(
                          label: Text(i, style: const TextStyle(fontSize: 12)),
                          visualDensity: VisualDensity.compact,
                        ))
                    .toList(),
              ),
      ],
    );
  }

  Widget _buildRemindersCard() {
    final reminders = (_campaign['reminders'] as List?) ?? [];
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Historique des rappels', style: UltraTheme.titleMedium),
          const SizedBox(height: 8),
          if (reminders.isEmpty)
            Text('Aucun rappel envoyé pour le moment.',
                style: UltraTheme.bodyMedium)
          else
            ...reminders.map((r) {
              final reminder = r as Map<String, dynamic>;
              final type = reminder['reminderType'] as String? ?? '';
              final sentCount = reminder['recipientCount'] as int? ?? 0;
              final failedCount = reminder['failedCount'] as int? ?? 0;
              final hasFailures = failedCount > 0;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(
                      hasFailures
                          ? Icons.warning_amber_rounded
                          : Icons.notifications_outlined,
                      size: 16,
                      color: hasFailures ? UltraTheme.warning : null,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(reminderTypeLabels[type] ?? type,
                          style: UltraTheme.bodyMedium),
                    ),
                    Text(
                      hasFailures
                          ? '$sentCount destinataires · $failedCount échecs · ${_formatDate(reminder['sentAt'])}'
                          : '$sentCount destinataires · ${_formatDate(reminder['sentAt'])}',
                      style: UltraTheme.labelMedium.copyWith(
                        color: hasFailures ? UltraTheme.warning : null,
                        fontWeight: hasFailures ? FontWeight.w600 : null,
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildSubmissionsCard() {
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Soumissions', style: UltraTheme.titleMedium),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _submissionFilterChip(null, 'Toutes'),
                for (final s in submissionStatuses)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: _submissionFilterChip(
                        s, submissionStatusLabels[s] ?? s),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          if (_submissionsError != null)
            _errorBanner(_submissionsError!, _loadSubmissions)
          else if (_loadingSubmissions)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(12),
                    child: CircularProgressIndicator()))
          else if (_submissions.isEmpty)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text('Aucune soumission.', style: UltraTheme.bodyMedium),
            )
          else
            Column(
              children: _submissions.map((s) {
                final sub = s as Map<String, dynamic>;
                final subStatus = sub['status'] as String? ?? 'PENDING';
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(
                      sub['companyName'] as String? ?? 'Entreprise inconnue'),
                  subtitle: Text(
                      [sub['region'], sub['department']]
                          .where((v) => v != null)
                          .join(' · '),
                      style: UltraTheme.labelMedium),
                  trailing: Chip(
                    label: Text(submissionStatusLabels[subStatus] ?? subStatus,
                        style: const TextStyle(fontSize: 11)),
                    visualDensity: VisualDensity.compact,
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  Widget _submissionFilterChip(String? status, String label) {
    final selected = _submissionStatusFilter == status;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) {
        setState(() => _submissionStatusFilter = status);
        _loadSubmissions();
      },
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

// ─── Edit Campaign Dialog ─────────────────────────────────────────────────

class EditCampaignDialog extends StatefulWidget {
  final ApiClient api;
  final Map<String, dynamic> campaign;
  const EditCampaignDialog(
      {super.key, required this.api, required this.campaign});

  @override
  State<EditCampaignDialog> createState() => EditCampaignDialogState();
}

class EditCampaignDialogState extends State<EditCampaignDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _descCtrl;
  DateTime? _deadline;
  late Set<String> _selectedEntityTypes;
  late Set<String> _selectedRegionNames;
  late Set<String> _selectedDepartmentNames;
  late List<int> _reminderDays;

  bool _submitting = false;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    final c = widget.campaign;
    _descCtrl = TextEditingController(text: c['description'] as String? ?? '');
    _deadline = DateTime.tryParse(c['deadline']?.toString() ?? '');
    _selectedEntityTypes =
        ((c['targetEntityTypes'] as List?)?.cast<String>() ?? []).toSet();
    _selectedRegionNames =
        ((c['targetRegions'] as List?)?.cast<String>() ?? []).toSet();
    _selectedDepartmentNames =
        ((c['targetDepartments'] as List?)?.cast<String>() ?? []).toSet();
    _reminderDays = ((c['reminderDays'] as List?)?.cast<int>() ?? []).toList();
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_deadline == null) {
      setState(() => _submitError = 'Veuillez sélectionner une échéance.');
      return;
    }

    setState(() {
      _submitting = true;
      _submitError = null;
    });

    try {
      await widget.api.put('/campaigns/${widget.campaign['id']}', data: {
        'description':
            _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        'deadline': _deadline!.toIso8601String(),
        'targetRegions': _selectedRegionNames.toList(),
        'targetDepartments': _selectedDepartmentNames.toList(),
        'targetEntityTypes': _selectedEntityTypes.toList(),
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
            Container(
              padding: const EdgeInsets.fromLTRB(20, 16, 8, 16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(12)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.edit_outlined,
                      color: Colors.white, size: 22),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Modifier la campagne',
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
            Expanded(
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    Text(
                      'Le nom, le type de campagne, le type de collecte et la '
                      'date de début ne sont pas modifiables après création.',
                      style:
                          TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: Text(
                        widget.campaign['name'] as String? ?? 'Sans nom',
                        style: const TextStyle(fontWeight: FontWeight.w600),
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
                    DatePickerField(
                      label: 'Échéance *',
                      value: _deadline,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2040),
                      onPicked: (d) => setState(() => _deadline = d),
                    ),
                    const SizedBox(height: 16),
                    Text('Types d\'entités ciblées',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey.shade700)),
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
                    Text('Régions & Départements ciblés',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey.shade700)),
                    const SizedBox(height: 10),
                    RegionDepartmentSelector(
                      api: widget.api,
                      initialRegionNames: _selectedRegionNames,
                      initialDepartmentNames: _selectedDepartmentNames,
                      onRegionsChanged: (s) => _selectedRegionNames = s,
                      onDepartmentsChanged: (s) => _selectedDepartmentNames = s,
                    ),
                    const SizedBox(height: 16),
                    Text('Jours de rappel (J-)',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey.shade700)),
                    const SizedBox(height: 8),
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
                              _reminderDays.sort((a, b) => b.compareTo(a));
                            } else {
                              _reminderDays.remove(day);
                            }
                          }),
                        );
                      }).toList(),
                    ),
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
                    label: const Text('Enregistrer'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
