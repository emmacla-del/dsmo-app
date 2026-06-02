// lib/screens/onefop/submissions_viewer_screen.dart
// ═══════════════════════════════════════════════════════════════
// SUBMISSIONS VIEWER SCREEN
// Read-only viewer for ONEFOP submissions (admin roles)
// Replaces the old "Pending validation" tabs after vetting suspension
// ═══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api_client.dart';
import '../../theme/ultra_theme.dart';
import '../../widgets/responsive_helpers.dart';
import 'onefop_form_constants.dart' show EntityType;

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════

class SubmissionsViewerScreen extends ConsumerStatefulWidget {
  const SubmissionsViewerScreen({super.key});

  @override
  ConsumerState<SubmissionsViewerScreen> createState() =>
      _SubmissionsViewerScreenState();
}

class _SubmissionsViewerScreenState
    extends ConsumerState<SubmissionsViewerScreen> {
  List<SubmissionSummary> _submissions = [];
  bool _isLoading = true;
  String? _error;

  // Filter state
  String? _filterStatus;
  String? _filterEntityType;
  String? _filterRegion;

  @override
  void initState() {
    super.initState();
    _loadSubmissions();
  }

  Future<void> _loadSubmissions() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      final submissions = await api.getOnefopSubmissions();

      setState(() {
        _submissions =
            submissions.map((s) => SubmissionSummary.fromJson(s)).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  List<SubmissionSummary> get _filteredSubmissions {
    var filtered = _submissions;

    if (_filterStatus != null && _filterStatus != 'Tous') {
      filtered = filtered.where((s) => s.status == _filterStatus).toList();
    }

    if (_filterEntityType != null && _filterEntityType != 'Tous') {
      filtered =
          filtered.where((s) => s.entityType == _filterEntityType).toList();
    }

    if (_filterRegion != null && _filterRegion != 'Toutes') {
      filtered = filtered.where((s) => s.region == _filterRegion).toList();
    }

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredSubmissions;

    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: _buildAppBar(),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: UltraTheme.primary))
          : _error != null
              ? _buildErrorView()
              : _buildSubmissionsList(filtered),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    final hasFilters = _filterStatus != null ||
        _filterEntityType != null ||
        _filterRegion != null;

    return AppBar(
      title: const Text(
        'Soumissions ONEFOP',
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: UltraTheme.textPrimary,
        ),
      ),
      backgroundColor: UltraTheme.surface,
      elevation: 0,
      actions: [
        IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: hasFilters
                  ? UltraTheme.primary.withValues(alpha: 0.15)
                  : UltraTheme.primary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.filter_list_rounded,
              color: hasFilters ? UltraTheme.primary : UltraTheme.textSecondary,
              size: 20,
            ),
          ),
          onPressed: _showFilterDialog,
          tooltip: 'Filtrer',
        ),
        const SizedBox(width: 8),
        IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: UltraTheme.primary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.refresh_rounded,
                size: 20, color: UltraTheme.textSecondary),
          ),
          onPressed: _loadSubmissions,
          tooltip: 'Actualiser',
        ),
        const SizedBox(width: 16),
      ],
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Container(
        margin: const EdgeInsets.all(32),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: UltraTheme.surface,
          borderRadius: BorderRadius.circular(UltraTheme.radiusXL),
          boxShadow: UltraTheme.softShadow,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: UltraTheme.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(32),
              ),
              child: const Icon(Icons.error_outline,
                  size: 32, color: UltraTheme.error),
            ),
            const SizedBox(height: 20),
            Text(
              'Erreur de chargement',
              style: UltraTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? 'Une erreur est survenue',
              textAlign: TextAlign.center,
              style:
                  UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadSubmissions,
              style: ElevatedButton.styleFrom(
                backgroundColor: UltraTheme.primary,
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
                ),
              ),
              child: const Text(
                'Réessayer',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmissionsList(List<SubmissionSummary> submissions) {
    if (submissions.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: UltraTheme.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(40),
              ),
              child: const Icon(Icons.inbox_outlined,
                  size: 40, color: UltraTheme.textMuted),
            ),
            const SizedBox(height: 20),
            Text(
              'Aucune soumission',
              style: UltraTheme.titleMedium
                  .copyWith(color: UltraTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            Text(
              'Aucune soumission ONEFOP trouvée',
              style:
                  UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: submissions.length,
      itemBuilder: (context, index) => SubmissionCard(
        submission: submissions[index],
        onTap: () => _viewSubmission(submissions[index]),
      ),
    );
  }

  void _showFilterDialog() {
    String? tempStatus = _filterStatus;
    String? tempEntityType = _filterEntityType;
    String? tempRegion = _filterRegion;

    const statuses = ['Tous', 'BROUILLON', 'SOUMIS', 'APPROUVE', 'REJETE'];
    const entityTypes = ['Tous', 'ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG'];
    const regions = [
      'Toutes',
      'Adamaoua',
      'Centre',
      'Est',
      'Extrême-Nord',
      'Littoral',
      'Nord',
      'Nord-Ouest',
      'Ouest',
      'Sud',
      'Sud-Ouest',
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Container(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
          decoration: const BoxDecoration(
            color: UltraTheme.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
              const Text(
                'Filtrer les soumissions',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: UltraTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 20),
              _buildFilterDropdown('Statut', tempStatus, statuses,
                  (v) => setSheet(() => tempStatus = v)),
              const SizedBox(height: 16),
              _buildFilterDropdown("Type d'entité", tempEntityType, entityTypes,
                  (v) => setSheet(() => tempEntityType = v)),
              const SizedBox(height: 16),
              _buildFilterDropdown('Région', tempRegion, regions,
                  (v) => setSheet(() => tempRegion = v)),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _filterStatus = tempStatus == 'Tous' ? null : tempStatus;
                      _filterEntityType =
                          tempEntityType == 'Tous' ? null : tempEntityType;
                      _filterRegion =
                          tempRegion == 'Toutes' ? null : tempRegion;
                    });
                    Navigator.pop(ctx);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: UltraTheme.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Appliquer',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterDropdown(String label, String? value, List<String> items,
      ValueChanged<String?> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: UltraTheme.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: UltraTheme.background,
            borderRadius: BorderRadius.circular(10),
            border:
                Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
          ),
          child: DropdownButtonFormField<String>(
            value: value,
            decoration: const InputDecoration(
              border: InputBorder.none,
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            items: items.map((item) {
              return DropdownMenuItem(value: item, child: Text(item));
            }).toList(),
            onChanged: onChanged,
          ),
        ),
      ],
    );
  }

  void _viewSubmission(SubmissionSummary submission) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SubmissionDetailScreen(submission: submission),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// SUBMISSION CARD
// ═══════════════════════════════════════════════════════════════

class SubmissionCard extends StatelessWidget {
  const SubmissionCard({
    super.key,
    required this.submission,
    required this.onTap,
  });

  final SubmissionSummary submission;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        side: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.1)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: _getStatusColor(submission.status)
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      _getStatusIcon(submission.status),
                      color: _getStatusColor(submission.status),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          submission.establishmentName ??
                              submission.establishmentId,
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: UltraTheme.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'ID: ${submission.establishmentId} • ${_formatDate(submission.submittedAt)}',
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            color: UltraTheme.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusColor(submission.status)
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _getStatusLabel(submission.status),
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _getStatusColor(submission.status),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _buildInfoChip(
                      Icons.business_center, submission.entityTypeLabel),
                  const SizedBox(width: 8),
                  if (submission.region != null)
                    _buildInfoChip(Icons.location_on, submission.region!),
                  const SizedBox(width: 8),
                  _buildInfoChip(
                      Icons.credit_card, 'Quartier: ${submission.quarterCode}'),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: UltraTheme.background,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: UltraTheme.textMuted),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 11,
              color: UltraTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'SOUMIS':
        return UltraTheme.success;
      case 'APPROUVE':
        return const Color(0xFF4472C4);
      case 'REJETE':
        return UltraTheme.error;
      default:
        return UltraTheme.warning;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status.toUpperCase()) {
      case 'SOUMIS':
        return Icons.send_rounded;
      case 'APPROUVE':
        return Icons.check_circle_rounded;
      case 'REJETE':
        return Icons.cancel_rounded;
      default:
        return Icons.hourglass_empty_rounded;
    }
  }

  String _getStatusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'SOUMIS':
        return 'Soumis';
      case 'APPROUVE':
        return 'Approuvé';
      case 'REJETE':
        return 'Rejeté';
      default:
        return 'Brouillon';
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }
}

// ═══════════════════════════════════════════════════════════════
// SUBMISSION DETAIL SCREEN
// ═══════════════════════════════════════════════════════════════

class SubmissionDetailScreen extends StatefulWidget {
  const SubmissionDetailScreen({super.key, required this.submission});

  final SubmissionSummary submission;

  @override
  State<SubmissionDetailScreen> createState() => _SubmissionDetailScreenState();
}

class _SubmissionDetailScreenState extends State<SubmissionDetailScreen> {
  bool _isLoading = false;
  Map<String, dynamic>? _formData;

  @override
  void initState() {
    super.initState();
    _loadFormData();
  }

  Future<void> _loadFormData() async {
    setState(() => _isLoading = true);
    // TODO: Load full form data from API using submission ID
    await Future.delayed(const Duration(milliseconds: 500)); // Simulate loading
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        title: Text(
          'Soumission - ${widget.submission.establishmentName ?? widget.submission.establishmentId}',
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: UltraTheme.primary))
          : _buildDetailContent(),
    );
  }

  Widget _buildDetailContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: UltraTheme.surface,
              borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
              boxShadow: UltraTheme.softShadow,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: UltraTheme.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.assignment_outlined,
                          color: UltraTheme.primary, size: 24),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.submission.establishmentName ??
                                widget.submission.establishmentId,
                            style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'ID: ${widget.submission.establishmentId}',
                            style: const TextStyle(
                                fontSize: 13, color: UltraTheme.textMuted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const Divider(height: 24),
                _buildDetailRow(
                    'Type d\'entité', widget.submission.entityTypeLabel),
                _buildDetailRow(
                    'Code trimestre', widget.submission.quarterCode),
                _buildDetailRow('Date de soumission',
                    _formatDateTime(widget.submission.submittedAt)),
                _buildDetailRow('Statut', widget.submission.status,
                    isStatus: true),
                if (widget.submission.region != null)
                  _buildDetailRow('Région', widget.submission.region!),
                if (widget.submission.department != null)
                  _buildDetailRow('Département', widget.submission.department!),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Form data preview
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: UltraTheme.surface,
              borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
              boxShadow: UltraTheme.softShadow,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Données du formulaire',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Aperçu des réponses disponible dans la version complète',
                  style: TextStyle(color: UltraTheme.textMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {bool isStatus = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                color: UltraTheme.textMuted,
              ),
            ),
          ),
          Expanded(
            child: isStatus
                ? Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusColor(widget.submission.status)
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _getStatusLabel(widget.submission.status),
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: _getStatusColor(widget.submission.status),
                      ),
                    ),
                  )
                : Text(
                    value,
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'SOUMIS':
        return UltraTheme.success;
      case 'APPROUVE':
        return const Color(0xFF4472C4);
      case 'REJETE':
        return UltraTheme.error;
      default:
        return UltraTheme.warning;
    }
  }

  String _getStatusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'SOUMIS':
        return 'Soumis';
      case 'APPROUVE':
        return 'Approuvé';
      case 'REJETE':
        return 'Rejeté';
      default:
        return 'Brouillon';
    }
  }

  String _formatDateTime(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} à ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}

// ═══════════════════════════════════════════════════════════════
// DATA MODELS
// ═══════════════════════════════════════════════════════════════

class SubmissionSummary {
  final String id;
  final String establishmentId;
  final String? establishmentName;
  final String quarterCode;
  final String status;
  final String entityType;
  final String entityTypeLabel;
  final DateTime submittedAt;
  final String? region;
  final String? department;

  SubmissionSummary({
    required this.id,
    required this.establishmentId,
    this.establishmentName,
    required this.quarterCode,
    required this.status,
    required this.entityType,
    required this.entityTypeLabel,
    required this.submittedAt,
    this.region,
    this.department,
  });

  factory SubmissionSummary.fromJson(Map<String, dynamic> json) {
    return SubmissionSummary(
      id: json['id'] as String,
      establishmentId: json['establishmentId'] as String,
      establishmentName: json['establishmentName'] as String?,
      quarterCode: json['quarterCode'] as String,
      status: json['status'] as String,
      entityType: json['entityType'] as String,
      entityTypeLabel: _getEntityTypeLabel(json['entityType'] as String),
      submittedAt: DateTime.parse(json['submittedAt'] as String),
      region: json['region'] as String?,
      department: json['department'] as String?,
    );
  }

  static String _getEntityTypeLabel(String type) {
    switch (type.toUpperCase()) {
      case 'ENTERPRISE':
        return 'Entreprise';
      case 'COOPERATIVE':
        return 'Coopérative';
      case 'CTD':
        return 'CTD';
      case 'ONG':
        return 'ONG';
      default:
        return type;
    }
  }
}
