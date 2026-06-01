// lib/screens/report/report_screen.dart
// ═══════════════════════════════════════════════════════════════
// ReportScreen — Enterprise-grade report generator
// ═══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../data/api_client.dart';
import '../../theme/ultra_theme.dart';

// ═══════════════════════════════════════════════════════════════
// ENUMS WITH EXTENSIONS
// ═══════════════════════════════════════════════════════════════

enum UserRole {
  superAdmin,
  admin,
  viewer,
}

extension UserRoleX on UserRole {
  String get label {
    switch (this) {
      case UserRole.superAdmin:
        return 'Super Administrateur';
      case UserRole.admin:
        return 'Administrateur';
      case UserRole.viewer:
        return 'Consultateur';
    }
  }

  IconData get icon {
    switch (this) {
      case UserRole.superAdmin:
        return Icons.admin_panel_settings_outlined;
      case UserRole.admin:
        return Icons.person_outline;
      case UserRole.viewer:
        return Icons.visibility_outlined;
    }
  }
}

enum AuditAction {
  generate,
  approve,
  reject,
  download,
  batchGenerate,
  distribute,
  compare,
  retry,
  delete,
}

extension AuditActionX on AuditAction {
  String get label {
    switch (this) {
      case AuditAction.generate:
        return 'Génération';
      case AuditAction.approve:
        return 'Approbation';
      case AuditAction.reject:
        return 'Rejet';
      case AuditAction.download:
        return 'Téléchargement';
      case AuditAction.batchGenerate:
        return 'Génération batch';
      case AuditAction.distribute:
        return 'Distribution';
      case AuditAction.compare:
        return 'Comparaison';
      case AuditAction.retry:
        return 'Reprise';
      case AuditAction.delete:
        return 'Suppression';
    }
  }

  IconData get icon {
    switch (this) {
      case AuditAction.generate:
        return Icons.add_chart_outlined;
      case AuditAction.approve:
        return Icons.check_circle_outline;
      case AuditAction.reject:
        return Icons.cancel_outlined;
      case AuditAction.download:
        return Icons.download_outlined;
      case AuditAction.batchGenerate:
        return Icons.grid_view_outlined;
      case AuditAction.distribute:
        return Icons.share_outlined;
      case AuditAction.compare:
        return Icons.compare_arrows_outlined;
      case AuditAction.retry:
        return Icons.refresh_outlined;
      case AuditAction.delete:
        return Icons.delete_outline;
    }
  }
}

enum ReportStatus {
  pending,
  approved,
  rejected,
  ready,
  failed,
}

enum BatchJobStatus {
  pending,
  running,
  completed,
  failed,
}

// ═══════════════════════════════════════════════════════════════
// DATA MODELS
// ═══════════════════════════════════════════════════════════════

class GeneratedReport {
  final String id;
  final String name;
  final String type;
  final int year;
  final String? region;
  final String? periodLabel;
  final DateTime generatedAt;
  final ReportStatus status;
  final ReportStatus? approvalStatus;
  final String? approvedBy;
  final DateTime? approvedAt;
  final String? rejectionReason;
  final String? downloadUrl;
  final String? sourceHash;

  const GeneratedReport({
    required this.id,
    required this.name,
    required this.type,
    required this.year,
    this.region,
    this.periodLabel,
    required this.generatedAt,
    required this.status,
    this.approvalStatus,
    this.approvedBy,
    this.approvedAt,
    this.rejectionReason,
    this.downloadUrl,
    this.sourceHash,
  });

  factory GeneratedReport.fromJson(Map<String, dynamic> json) {
    final rawUrls = (json['downloadUrls'] as Map<String, dynamic>? ?? {});
    final pdfUrl = rawUrls['PDF'] as String?;

    return GeneratedReport(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Rapport',
      type: json['type'] as String? ?? 'UNKNOWN',
      year: (json['year'] as num?)?.toInt() ?? DateTime.now().year,
      region: json['region'] as String?,
      periodLabel: json['periodLabel'] as String?,
      generatedAt: json['generatedAt'] != null
          ? DateTime.tryParse(json['generatedAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      status: _parseStatus(json['status']),
      approvalStatus: _parseStatus(json['approvalStatus']),
      approvedBy: json['approvedBy'] as String?,
      approvedAt: json['approvedAt'] != null
          ? DateTime.tryParse(json['approvedAt'] as String)
          : null,
      rejectionReason: json['rejectionReason'] as String?,
      downloadUrl: pdfUrl,
      sourceHash: json['sourceHash'] as String?,
    );
  }

  static ReportStatus _parseStatus(String? s) {
    switch (s?.toUpperCase()) {
      case 'PENDING':
        return ReportStatus.pending;
      case 'APPROVED':
        return ReportStatus.approved;
      case 'REJECTED':
        return ReportStatus.rejected;
      case 'READY':
        return ReportStatus.ready;
      case 'FAILED':
        return ReportStatus.failed;
      default:
        return ReportStatus.pending;
    }
  }

  bool get needsApproval => approvalStatus == ReportStatus.pending;
  bool get isApproved => approvalStatus == ReportStatus.approved;
  bool get isRejected => approvalStatus == ReportStatus.rejected;
}

class BatchJob {
  final String id;
  final String name;
  final List<String> regions;
  final DateTimeRange dateRange;
  final BatchJobStatus status;
  final int totalReports;
  final int completedReports;
  final int failedReports;
  final DateTime startedAt;
  final DateTime? completedAt;

  BatchJob({
    required this.id,
    required this.name,
    required this.regions,
    required this.dateRange,
    required this.status,
    required this.totalReports,
    required this.completedReports,
    required this.failedReports,
    required this.startedAt,
    this.completedAt,
  });
}

class AuditEntry {
  final String id;
  final String userId;
  final String userName;
  final UserRole userRole;
  final AuditAction action;
  final String? reportId;
  final String? reportName;
  final Map<String, dynamic> details;
  final DateTime timestamp;

  const AuditEntry({
    required this.id,
    required this.userId,
    required this.userName,
    required this.userRole,
    required this.action,
    this.reportId,
    this.reportName,
    required this.details,
    required this.timestamp,
  });
}

class DistributionList {
  final String id;
  final String name;
  final List<String> emails;
  final bool isActive;

  const DistributionList({
    required this.id,
    required this.name,
    required this.emails,
    required this.isActive,
  });
}

// ═══════════════════════════════════════════════════════════════
// BACKEND CONTRACT
// ═══════════════════════════════════════════════════════════════

const List<String> validBackendSections = [
  'kpi',
  'regionalBreakdown',
  'trends',
  'sectorAnalysis',
  'demographics',
  'insights',
];

const Map<String, List<String>> groupToBackendSections = {
  'Executive Summary': ['kpi', 'insights'],
  'Employment & Workforce': ['trends'],
  'Skills & Training': ['sectorAnalysis'],
  'Diversity & Inclusion': ['demographics'],
  'Regional Analysis': ['regionalBreakdown'],
};

// ═══════════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════════

class ReportPermissions {
  final bool canGenerate;
  final bool canApprove;
  final bool canBatchGenerate;
  final bool canDistribute;
  final bool canCompare;
  final bool canViewAudit;
  final bool canViewAllReports;

  const ReportPermissions({
    required this.canGenerate,
    required this.canApprove,
    required this.canBatchGenerate,
    required this.canDistribute,
    required this.canCompare,
    required this.canViewAudit,
    required this.canViewAllReports,
  });

  factory ReportPermissions.forRole(UserRole role) {
    switch (role) {
      case UserRole.superAdmin:
        return const ReportPermissions(
          canGenerate: true,
          canApprove: true,
          canBatchGenerate: true,
          canDistribute: true,
          canCompare: true,
          canViewAudit: true,
          canViewAllReports: true,
        );
      case UserRole.admin:
        return const ReportPermissions(
          canGenerate: true,
          canApprove: false,
          canBatchGenerate: true,
          canDistribute: true,
          canCompare: true,
          canViewAudit: false,
          canViewAllReports: false,
        );
      case UserRole.viewer:
        return const ReportPermissions(
          canGenerate: false,
          canApprove: false,
          canBatchGenerate: false,
          canDistribute: false,
          canCompare: false,
          canViewAudit: false,
          canViewAllReports: false,
        );
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════

class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key});

  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  // Current user (TODO: Get from auth provider)
  final UserRole _currentUserRole = UserRole.superAdmin;
  late ReportPermissions _permissions;

  // Tab state
  int _selectedTabIndex = 0;

  // Location
  String? _selectedRegion;
  String? _selectedDepartment;
  String? _selectedSubdivision;

  // Date range
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
  List<GeneratedReport> _reports = [];
  List<GeneratedReport> _pendingApprovals = [];
  List<BatchJob> _batchJobs = [];
  bool _loading = true;

  // Geo structure
  List<Map<String, dynamic>> _geoStructure = [];
  bool _geoLoading = true;

  // Batch generation
  final List<String> _selectedBatchRegions = [];
  bool _batchGenerating = false;

  // Compare
  String? _compareBaselineId;
  String? _compareTargetId;

  // Distribution
  List<DistributionList> _distributionLists = [];

  // Audit
  List<AuditEntry> _auditEntries = [];
  bool _auditLoading = false;

  @override
  void initState() {
    super.initState();
    _permissions = ReportPermissions.forRole(_currentUserRole);
    _loadGeoStructure();
    _loadData();
  }

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

  Future<void> _loadData() async {
    setState(() => _loading = true);
    await _loadReports();
    if (_permissions.canApprove) await _loadPendingApprovals();
    if (_permissions.canBatchGenerate) await _loadBatchJobs();
    await _loadDistributionLists();
    if (_permissions.canViewAudit) await _loadAuditTrail();
    setState(() => _loading = false);
  }

  Future<void> _loadReports() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get<List<dynamic>>('/reports/history');
      final list = res.data ?? [];
      setState(() {
        _reports = list
            .map((e) => GeneratedReport.fromJson(e as Map<String, dynamic>))
            .toList();
      });
    } catch (e) {
      debugPrint('Load reports error: $e');
    }
  }

  Future<void> _loadPendingApprovals() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get<List<dynamic>>('/reports/pending-approval');
      final list = res.data ?? [];
      setState(() {
        _pendingApprovals = list
            .map((e) => GeneratedReport.fromJson(e as Map<String, dynamic>))
            .toList();
      });
    } catch (e) {
      debugPrint('Load pending approvals error: $e');
    }
  }

  Future<void> _loadBatchJobs() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get<List<dynamic>>('/reports/batch-jobs');
      final list = res.data ?? [];
      setState(() {
        _batchJobs = list
            .map((e) => BatchJob(
                  id: e['id'],
                  name: e['name'],
                  regions: List<String>.from(e['regions']),
                  dateRange: DateTimeRange(
                    start: DateTime.parse(e['startDate']),
                    end: DateTime.parse(e['endDate']),
                  ),
                  status: BatchJobStatus.values.firstWhere(
                    (s) => s.name == e['status'],
                    orElse: () => BatchJobStatus.pending,
                  ),
                  totalReports: e['totalReports'],
                  completedReports: e['completedReports'] ?? 0,
                  failedReports: e['failedReports'] ?? 0,
                  startedAt: DateTime.parse(e['startedAt']),
                  completedAt: e['completedAt'] != null
                      ? DateTime.parse(e['completedAt'])
                      : null,
                ))
            .toList();
      });
    } catch (e) {
      debugPrint('Load batch jobs error: $e');
    }
  }

  Future<void> _loadDistributionLists() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get<List<dynamic>>('/distribution/lists');
      final list = res.data ?? [];
      setState(() {
        _distributionLists = list
            .map((e) => DistributionList(
                  id: e['id'],
                  name: e['name'],
                  emails: List<String>.from(e['emails']),
                  isActive: e['isActive'],
                ))
            .toList();
      });
    } catch (e) {
      debugPrint('Load distribution lists error: $e');
    }
  }

  Future<void> _loadAuditTrail() async {
    setState(() => _auditLoading = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get<List<dynamic>>('/audit/reports');
      final list = res.data ?? [];
      setState(() {
        _auditEntries = list
            .map((e) => AuditEntry(
                  id: e['id'],
                  userId: e['userId'],
                  userName: e['userName'],
                  userRole: UserRole.values.firstWhere(
                    (r) => r.name == e['userRole'],
                    orElse: () => UserRole.viewer,
                  ),
                  action: AuditAction.values.firstWhere(
                    (a) => a.name == e['action'],
                    orElse: () => AuditAction.generate,
                  ),
                  reportId: e['reportId'],
                  reportName: e['reportName'],
                  details: e['details'] ?? {},
                  timestamp: DateTime.parse(e['timestamp']),
                ))
            .toList();
        _auditLoading = false;
      });
    } catch (e) {
      setState(() => _auditLoading = false);
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
        return DateTimeRange(start: DateTime(now.year, 1, 1), end: now);
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

  String _dateToQuarter(DateTime date) {
    final quarter = ((date.month - 1) ~/ 3) + 1;
    return '${date.year}-T$quarter';
  }

  Future<void> _generateReport() async {
    if (!_permissions.canGenerate) {
      _snack('Vous n\'avez pas les droits pour générer des rapports',
          isError: true);
      return;
    }

    if (!_hasSelectedContent()) {
      _snack('Sélectionnez au moins une section', isError: true);
      return;
    }

    final dateRange = _getDateRange();
    if (dateRange.end.isBefore(dateRange.start)) {
      _snack('La date de fin doit être postérieure à la date de début',
          isError: true);
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
      _snack('Rapport généré et soumis pour approbation');
      await _loadData();
      _clearForm();
    } catch (e) {
      _snack('Erreur: $e', isError: true);
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _approveReport(String reportId, bool approved,
      {String? reason}) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.post('/reports/approve', data: {
        'reportId': reportId,
        'approved': approved,
        'rejectionReason': reason,
      });
      _snack(approved ? 'Rapport approuvé' : 'Rapport rejeté');
      await _loadData();
    } catch (e) {
      _snack('Erreur: $e', isError: true);
    }
  }

  Future<void> _batchGenerate() async {
    if (_selectedBatchRegions.isEmpty) {
      _snack('Sélectionnez au moins une région', isError: true);
      return;
    }

    setState(() => _batchGenerating = true);

    final payload = {
      'name': _reportNameController.text.trim().isEmpty
          ? 'Batch ${DateTime.now().toString().substring(0, 10)}'
          : _reportNameController.text.trim(),
      'regions': _selectedBatchRegions,
      'dateRange': {
        'start': _getDateRange().start.toIso8601String(),
        'end': _getDateRange().end.toIso8601String(),
      },
      'sections': _getBackendSections(),
    };

    try {
      final api = ref.read(apiClientProvider);
      await api.post('/reports/batch', data: payload);
      _snack('Génération batch lancée');
      await _loadBatchJobs();
      _selectedBatchRegions.clear();
    } catch (e) {
      _snack('Erreur: $e', isError: true);
    } finally {
      setState(() => _batchGenerating = false);
    }
  }

  Future<void> _retryFailedJob(String jobId) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.post('/reports/retry/$jobId');
      _snack('Reprise en cours');
      await _loadBatchJobs();
    } catch (e) {
      _snack('Erreur: $e', isError: true);
    }
  }

  Future<void> _distributeReport(String reportId) async {
    if (_distributionLists.isEmpty) {
      _snack('Aucune liste de distribution disponible', isError: true);
      return;
    }

    final selectedIds = await _showDistributionDialog();
    if (selectedIds == null || selectedIds.isEmpty) return;

    try {
      final api = ref.read(apiClientProvider);
      await api.post('/distribution/send', data: {
        'reportId': reportId,
        'distributionListIds': selectedIds,
      });
      _snack('Rapport distribué avec succès');
    } catch (e) {
      _snack('Erreur: $e', isError: true);
    }
  }

  Future<List<String>?> _showDistributionDialog() async {
    final List<String> selectedIds = [];

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Distribuer le rapport'),
        content: SizedBox(
          width: 300,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: _distributionLists.map((list) {
              return CheckboxListTile(
                value: selectedIds.contains(list.id),
                onChanged: (v) {
                  if (v == true) {
                    selectedIds.add(list.id);
                  } else {
                    selectedIds.remove(list.id);
                  }
                },
                title: Text(list.name),
                subtitle: Text('${list.emails.length} destinataires'),
                dense: true,
              );
            }).toList(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, selectedIds),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1D9E75),
            ),
            child: const Text('Envoyer'),
          ),
        ],
      ),
    );

    return selectedIds.isEmpty ? null : selectedIds;
  }

  Future<void> _compareReports() async {
    if (_compareBaselineId == null || _compareTargetId == null) {
      _snack('Sélectionnez deux rapports à comparer', isError: true);
      return;
    }

    try {
      final api = ref.read(apiClientProvider);
      await Future.wait([
        api.get('/reports/${_compareBaselineId}/data'),
        api.get('/reports/${_compareTargetId}/data'),
      ]);
      _snack('Comparaison prête');
    } catch (e) {
      _snack('Erreur lors de la comparaison: $e', isError: true);
    }
  }

  void _clearForm() {
    _selectedRegion = null;
    _selectedDepartment = null;
    _selectedSubdivision = null;
    _datePreset = '6months';
    _customDateRange = null;
    _selectedGroups.updateAll((key, value) => false);
    _selectedGroups['Executive Summary'] = true;
    _reportNameController.clear();
  }

  void _snack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content:
          Text(msg, style: const TextStyle(fontFamily: 'Inter', fontSize: 13)),
      backgroundColor: isError ? UltraTheme.error : UltraTheme.success,
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 3),
    ));
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  // ═══════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Générateur de rapport',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: UltraTheme.textPrimary,
              ),
            ),
            Row(
              children: [
                Icon(_currentUserRole.icon,
                    size: 12, color: UltraTheme.textSecondary),
                const SizedBox(width: 4),
                Text(
                  _currentUserRole.label,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 10,
                    color: UltraTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded,
                color: UltraTheme.textSecondary),
            onPressed: _loadData,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            color: UltraTheme.surface,
            child: TabBar(
              tabs: _buildTabs(),
              isScrollable: true,
              indicatorColor: const Color(0xFF1D9E75),
              labelColor: const Color(0xFF1D9E75),
              unselectedLabelColor: UltraTheme.textMuted,
              onTap: (index) => setState(() => _selectedTabIndex = index),
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : IndexedStack(
              index: _selectedTabIndex,
              children: _buildTabBodies(),
            ),
    );
  }

  List<Tab> _buildTabs() {
    final tabs = <Tab>[
      const Tab(text: 'Générer'),
    ];

    if (_permissions.canApprove) {
      tabs.add(Tab(text: 'Approbations (${_pendingApprovals.length})'));
    }

    tabs.add(const Tab(text: 'Historique'));

    if (_permissions.canBatchGenerate) {
      tabs.add(const Tab(text: 'Batch'));
    }

    if (_permissions.canCompare) {
      tabs.add(const Tab(text: 'Comparer'));
    }

    if (_permissions.canViewAudit) {
      tabs.add(const Tab(text: 'Audit'));
    }

    return tabs;
  }

  List<Widget> _buildTabBodies() {
    final bodies = <Widget>[
      _buildGenerateTab(),
    ];

    if (_permissions.canApprove) {
      bodies.add(_buildApprovalsTab());
    }

    bodies.add(_buildHistoryTab());

    if (_permissions.canBatchGenerate) {
      bodies.add(_buildBatchTab());
    }

    if (_permissions.canCompare) {
      bodies.add(_buildCompareTab());
    }

    if (_permissions.canViewAudit) {
      bodies.add(_buildAuditTab());
    }

    return bodies;
  }

  // ── Generate Tab ──────────────────────────────────────────

  Widget _buildGenerateTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
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
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildLocationSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionLabel(icon: Icons.place_outlined, label: 'LOCALISATION'),
        const SizedBox(height: 12),
        if (_geoLoading)
          const LinearProgressIndicator(color: Color(0xFF1D9E75))
        else ...[
          _DropdownField<String?>(
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
            _DropdownField<String?>(
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
            _DropdownField<String?>(
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
    final presets = [
      ('3 derniers mois', '3months'),
      ('6 derniers mois', '6months'),
      ('12 derniers mois', '12months'),
      ('Année en cours', 'ytd'),
      ('Personnalisé', 'custom'),
    ];

    String selectedPreset = _datePreset;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionLabel(icon: Icons.calendar_today_outlined, label: 'PÉRIODE'),
        const SizedBox(height: 12),
        ...presets.map((preset) {
          return RadioListTile<String>(
            value: preset.$2,
            groupValue: selectedPreset,
            onChanged: (v) => setState(() => _datePreset = v!),
            title: Text(
              preset.$1,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: UltraTheme.textPrimary,
              ),
            ),
            activeColor: const Color(0xFF1D9E75),
            contentPadding: EdgeInsets.zero,
            dense: true,
          );
        }),
        if (_datePreset == 'custom') ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _DateField(
                  label: 'Du',
                  date: _customDateRange?.start,
                  onTap: _pickCustomDateRange,
                ),
              ),
              const SizedBox(width: 12),
              const Icon(Icons.arrow_forward,
                  size: 16, color: UltraTheme.textMuted),
              const SizedBox(width: 12),
              Expanded(
                child: _DateField(
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
            appBarTheme: const AppBarTheme(
              backgroundColor: Color(0xFF0F6E56),
              foregroundColor: Colors.white,
            ),
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF1D9E75),
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: Color(0xFF1A1D21),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) setState(() => _customDateRange = picked);
  }

  Widget _buildContentSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _SectionLabel(
                icon: Icons.folder_outlined, label: 'CONTENU DU RAPPORT'),
            Row(
              children: [
                TextButton(
                  onPressed: () =>
                      setState(() => _selectedGroups.updateAll((k, v) => true)),
                  child: const Text('Tout', style: TextStyle(fontSize: 12)),
                ),
                TextButton(
                  onPressed: () => setState(
                      () => _selectedGroups.updateAll((k, v) => false)),
                  child: const Text('Aucun', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ],
        ),
        ..._selectedGroups.entries.map((entry) => CheckboxListTile(
              value: entry.value,
              onChanged: (v) =>
                  setState(() => _selectedGroups[entry.key] = v ?? false),
              title: Text(entry.key, style: const TextStyle(fontSize: 13)),
              subtitle: Text(
                _groupSubtitle(entry.key),
                style:
                    const TextStyle(fontSize: 11, color: UltraTheme.textMuted),
              ),
              activeColor: const Color(0xFF1D9E75),
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
        _SectionLabel(
            icon: Icons.edit_note_outlined,
            label: 'NOM DU RAPPORT (optionnel)'),
        const SizedBox(height: 12),
        TextField(
          controller: _reportNameController,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            color: UltraTheme.textPrimary,
          ),
          decoration: InputDecoration(
            hintText: 'Briefing RH Littoral Juin 2026',
            hintStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              color: UltraTheme.textMuted,
            ),
            filled: true,
            fillColor: UltraTheme.surface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: UltraTheme.textMuted.withAlpha(50)),
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildGenerateButton() {
    final canGenerate =
        _permissions.canGenerate && _hasSelectedContent() && !_generating;

    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: canGenerate ? _generateReport : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF1D9E75),
          foregroundColor: Colors.white,
          disabledBackgroundColor: UltraTheme.textMuted.withAlpha(30),
          elevation: 0,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: _generating
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Text(
                'GÉNÉRER LE RAPPORT',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontWeight: FontWeight.w600,
                    fontSize: 15),
              ),
      ),
    );
  }

  // ── Approvals Tab ─────────────────────────────────────────

  Widget _buildApprovalsTab() {
    if (_pendingApprovals.isEmpty) {
      return const Center(
        child: Text('Aucune approbation en attente'),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _pendingApprovals.length,
      itemBuilder: (ctx, i) {
        final report = _pendingApprovals[i];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: UltraTheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE67E22).withAlpha(50)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF3E0),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'En attente',
                      style: TextStyle(fontSize: 11, color: Color(0xFFE67E22)),
                    ),
                  ),
                  const Spacer(),
                  Text(_formatDate(report.generatedAt),
                      style: const TextStyle(fontSize: 12)),
                ],
              ),
              const SizedBox(height: 12),
              Text(report.name,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 4),
              Text(
                  '${report.region ?? 'National'} · ${report.periodLabel ?? report.year}',
                  style: const TextStyle(
                      fontSize: 13, color: UltraTheme.textMuted)),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _showRejectionDialog(report.id),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: UltraTheme.error,
                      ),
                      child: const Text('Rejeter'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => _approveReport(report.id, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1D9E75),
                      ),
                      child: const Text('Approuver'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showRejectionDialog(String reportId) async {
    final reasonController = TextEditingController();
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Motif du rejet'),
        content: TextField(
          controller: reasonController,
          decoration: const InputDecoration(
            hintText: 'Expliquez pourquoi ce rapport est rejeté',
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _approveReport(reportId, false, reason: reasonController.text);
            },
            style: ElevatedButton.styleFrom(backgroundColor: UltraTheme.error),
            child: const Text('Rejeter'),
          ),
        ],
      ),
    );
  }

  // ── History Tab ───────────────────────────────────────────

  Widget _buildHistoryTab() {
    if (_reports.isEmpty) {
      return const Center(child: Text('Aucun rapport généré'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _reports.length,
      itemBuilder: (ctx, i) {
        final report = _reports[i];
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: UltraTheme.surface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(report.name,
                            style:
                                const TextStyle(fontWeight: FontWeight.w600)),
                        Text(
                          '${report.region ?? 'National'} · ${report.periodLabel ?? report.year}',
                          style: const TextStyle(
                              fontSize: 12, color: UltraTheme.textMuted),
                        ),
                      ],
                    ),
                  ),
                  if (report.isApproved)
                    const Icon(Icons.check_circle,
                        color: Color(0xFF1D9E75), size: 20),
                  if (report.isRejected)
                    const Icon(Icons.cancel, color: UltraTheme.error, size: 20),
                  if (report.needsApproval)
                    const Icon(Icons.pending,
                        color: Color(0xFFE67E22), size: 20),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (report.downloadUrl != null && report.isApproved)
                    _IconAction(
                      icon: Icons.download_outlined,
                      tooltip: 'Télécharger',
                      onTap: () async {
                        final uri = Uri.tryParse(report.downloadUrl!);
                        if (uri != null && await canLaunchUrl(uri)) {
                          await launchUrl(uri,
                              mode: LaunchMode.externalApplication);
                        }
                      },
                    ),
                  if (_permissions.canDistribute && report.isApproved)
                    _IconAction(
                      icon: Icons.share_outlined,
                      tooltip: 'Distribuer',
                      onTap: () => _distributeReport(report.id),
                    ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  // ── Batch Tab ─────────────────────────────────────────────

  Widget _buildBatchTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: UltraTheme.surface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Génération batch par région',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              ..._regionNames.map((region) => CheckboxListTile(
                    value: _selectedBatchRegions.contains(region),
                    onChanged: (v) {
                      setState(() {
                        if (v == true) {
                          _selectedBatchRegions.add(region);
                        } else {
                          _selectedBatchRegions.remove(region);
                        }
                      });
                    },
                    title: Text(region),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  )),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _batchGenerating ? null : _batchGenerate,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1D9E75),
                  ),
                  child: _batchGenerating
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Lancer la génération batch'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const Text('Tâches récentes',
            style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        ..._batchJobs.map((job) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: UltraTheme.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(job.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                            Text(
                                '${job.completedReports}/${job.totalReports} rapports',
                                style: const TextStyle(fontSize: 12)),
                          ],
                        ),
                      ),
                      if (job.status == BatchJobStatus.failed)
                        _IconAction(
                          icon: Icons.refresh,
                          tooltip: 'Réessayer',
                          onTap: () => _retryFailedJob(job.id),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: job.totalReports > 0
                        ? (job.completedReports + job.failedReports) /
                            job.totalReports
                        : 0,
                    backgroundColor: UltraTheme.textMuted.withAlpha(50),
                    color: job.status == BatchJobStatus.failed
                        ? UltraTheme.error
                        : const Color(0xFF1D9E75),
                  ),
                ],
              ),
            )),
      ],
    );
  }

  // ── Compare Tab ───────────────────────────────────────────

  Widget _buildCompareTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: UltraTheme.surface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              DropdownButtonFormField<String>(
                value: _compareBaselineId,
                items: _reports.where((r) => r.isApproved).map((r) {
                  return DropdownMenuItem(value: r.id, child: Text(r.name));
                }).toList(),
                onChanged: (v) => setState(() => _compareBaselineId = v),
                decoration:
                    const InputDecoration(labelText: 'Rapport de référence'),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _compareTargetId,
                items: _reports
                    .where((r) => r.isApproved && r.id != _compareBaselineId)
                    .map((r) {
                  return DropdownMenuItem(value: r.id, child: Text(r.name));
                }).toList(),
                onChanged: (v) => setState(() => _compareTargetId = v),
                decoration:
                    const InputDecoration(labelText: 'Rapport à comparer'),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _compareReports,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D9E75),
                ),
                child: const Text('Comparer'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Audit Tab ─────────────────────────────────────────────

  Widget _buildAuditTab() {
    if (_auditLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_auditEntries.isEmpty) {
      return const Center(child: Text('Aucune activité enregistrée'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _auditEntries.length,
      itemBuilder: (ctx, i) {
        final entry = _auditEntries[i];
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: UltraTheme.surface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: const Color(0xFFE1F5EE),
                radius: 18,
                child: Icon(entry.action.icon,
                    size: 16, color: const Color(0xFF0F6E56)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${entry.userName} · ${entry.action.label}',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text(entry.reportName ?? '',
                        style: const TextStyle(
                            fontSize: 12, color: UltraTheme.textMuted)),
                  ],
                ),
              ),
              Text(_formatDate(entry.timestamp),
                  style: const TextStyle(
                      fontSize: 11, color: UltraTheme.textMuted)),
            ],
          ),
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// PRIVATE WIDGETS
// ═══════════════════════════════════════════════════════════════

class _SectionLabel extends StatelessWidget {
  final IconData icon;
  final String label;
  const _SectionLabel({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: UltraTheme.textMuted),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: UltraTheme.textMuted,
            letterSpacing: 0.3,
          ),
        ),
      ],
    );
  }
}

class _DropdownField<T> extends StatelessWidget {
  final String label;
  final T value;
  final List<T> items;
  final String Function(T) itemLabel;
  final ValueChanged<T?> onChanged;

  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.itemLabel,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: UltraTheme.textMuted.withAlpha(50)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 10,
                  color: UltraTheme.textMuted)),
          const SizedBox(height: 2),
          DropdownButtonHideUnderline(
            child: DropdownButton<T>(
              value: value,
              isDense: true,
              isExpanded: true,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: UltraTheme.textPrimary),
              dropdownColor: UltraTheme.surface,
              items: items.map((i) {
                return DropdownMenuItem(
                  value: i,
                  child:
                      Text(itemLabel(i), style: const TextStyle(fontSize: 13)),
                );
              }).toList(),
              onChanged: onChanged,
            ),
          ),
        ],
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  final String label;
  final DateTime? date;
  final VoidCallback onTap;
  const _DateField({required this.label, this.date, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: UltraTheme.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: UltraTheme.textMuted.withAlpha(50)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 10,
                    color: UltraTheme.textMuted)),
            const SizedBox(height: 2),
            Text(
              date != null
                  ? '${date!.day.toString().padLeft(2, '0')}/${date!.month.toString().padLeft(2, '0')}/${date!.year}'
                  : '--/--/----',
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: UltraTheme.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}

class _IconAction extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  const _IconAction(
      {required this.icon, required this.tooltip, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: UltraTheme.background,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: UltraTheme.textMuted.withAlpha(50)),
          ),
          child: Icon(icon, size: 16, color: UltraTheme.textSecondary),
        ),
      ),
    );
  }
}
