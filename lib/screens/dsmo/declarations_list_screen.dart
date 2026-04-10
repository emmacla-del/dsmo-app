import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../providers/auth_provider.dart';
import '../../../theme/app_colors.dart';
import 'declaration_approval_screen.dart';

class DeclarationsListScreen extends ConsumerStatefulWidget {
  const DeclarationsListScreen({super.key});

  @override
  ConsumerState<DeclarationsListScreen> createState() =>
      _DeclarationsListScreenState();
}

class _DeclarationsListScreenState
    extends ConsumerState<DeclarationsListScreen> {
  List<dynamic> _declarations = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final user = ref.read(authProvider).valueOrNull;
      final isCompany = user?.role == 'COMPANY';
      final path =
          isCompany ? '/dsmo/declarations' : '/dsmo/declarations/pending';
      final resp = await api.get(path);
      if (!mounted) return;
      setState(() {
        _declarations = resp.data is List ? resp.data as List : [];
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'SUBMITTED':
        return Colors.orange;
      case 'DIVISION_APPROVED':
        return Colors.blue;
      case 'REGION_APPROVED':
        return Colors.indigo;
      case 'FINAL_APPROVED':
        return Colors.green;
      case 'REJECTED':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'SUBMITTED':
        return 'Soumise';
      case 'DIVISION_APPROVED':
        return 'Approuvée — Division';
      case 'REGION_APPROVED':
        return 'Approuvée — Région';
      case 'FINAL_APPROVED':
        return 'Approuvée — Finale';
      case 'REJECTED':
        return 'Rejetée';
      case 'DRAFT':
        return 'Brouillon';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).valueOrNull;
    final isCompany = user?.role == 'COMPANY';

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 56),
              const SizedBox(height: 16),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Réessayer'),
              ),
            ],
          ),
        ),
      );
    }

    if (_declarations.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.inbox_outlined, size: 72, color: AppColors.ghost),
            const SizedBox(height: 16),
            Text(
              isCompany
                  ? 'Aucune déclaration soumise'
                  : 'Aucune déclaration en attente',
              style:
                  const TextStyle(fontSize: 16, color: AppColors.slate),
            ),
            const SizedBox(height: 8),
            if (isCompany)
              const Text(
                'Utilisez le bouton + pour soumettre votre première déclaration.',
                style: TextStyle(fontSize: 13, color: AppColors.silver),
                textAlign: TextAlign.center,
              ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _declarations.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final d = _declarations[index] as Map<String, dynamic>;
          final company =
              (d['company'] as Map<String, dynamic>?) ?? {};
          final status = d['status'] as String? ?? '';
          final employees = (d['employees'] as List?) ?? [];
          final rejectionReason = d['rejectionReason'] as String?;

          final isDraft = isCompany && status == 'DRAFT';
          final showTimeline = isCompany && status != 'DRAFT';

          return Card(
            elevation: isDraft ? 3 : 2,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: isDraft
                    ? const BorderSide(color: Colors.orange, width: 1.5)
                    : status == 'REJECTED'
                        ? const BorderSide(color: Colors.red, width: 1.5)
                        : BorderSide.none),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () async {
                final result = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => DeclarationApprovalScreen(
                      declarationId: d['id'] as String,
                      isReadOnly: isCompany,
                    ),
                  ),
                );
                if (result == true) _load();
              },
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: isDraft
                                ? Colors.orange.withAlpha(25)
                                : status == 'REJECTED'
                                    ? Colors.red.withAlpha(25)
                                    : AppColors.deepEmerald.withAlpha(25),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                              isDraft
                                  ? Icons.edit_note
                                  : status == 'REJECTED'
                                      ? Icons.cancel_outlined
                                      : Icons.business,
                              color: isDraft
                                  ? Colors.orange
                                  : status == 'REJECTED'
                                      ? Colors.red
                                      : AppColors.deepEmerald),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                company['name'] as String? ??
                                    'Entreprise inconnue',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                [
                                  'Année ${d['year']}',
                                  if ((company['region'] ?? d['region']) != null)
                                    company['region'] ?? d['region'],
                                  if ((company['district'] as String?)
                                          ?.isNotEmpty ==
                                      true)
                                    company['district'],
                                ].join('  •  '),
                                style: const TextStyle(
                                    color: AppColors.slate, fontSize: 12),
                              ),
                              if ((company['taxNumber'] as String?)
                                      ?.isNotEmpty ==
                                  true) ...[
                                const SizedBox(height: 2),
                                Text(
                                  'NIU: ${company['taxNumber']}'
                                  '${company['totalEmployees'] != null ? '  •  ${company['totalEmployees']} employé(s)' : employees.isNotEmpty ? '  •  ${employees.length} employé(s)' : ''}',
                                  style: const TextStyle(
                                      color: AppColors.silver, fontSize: 11),
                                ),
                              ],
                              const SizedBox(height: 6),
                              _StatusBadge(
                                label: _statusLabel(status),
                                color: _statusColor(status),
                              ),
                              if (isDraft) ...[
                                const SizedBox(height: 4),
                                const Text(
                                  'Appuyez pour reprendre et soumettre',
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.orange,
                                      fontStyle: FontStyle.italic),
                                ),
                              ],
                            ],
                          ),
                        ),
                        Icon(
                            isDraft ? Icons.arrow_forward : Icons.chevron_right,
                            color:
                                isDraft ? Colors.orange : AppColors.silver),
                      ],
                    ),

                    // ── Approval chain timeline (companies only, non-draft) ──
                    if (showTimeline) ...[
                      const SizedBox(height: 14),
                      const Divider(height: 1),
                      const SizedBox(height: 12),
                      _ApprovalTimeline(status: status),
                    ],

                    // ── Rejection reason ────────────────────────────────────
                    if (status == 'REJECTED' &&
                        rejectionReason != null &&
                        rejectionReason.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.info_outline,
                                color: Colors.red, size: 16),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Motif : $rejectionReason',
                                style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.red.shade700),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Approval chain timeline ─────────────────────────────────────────────────

class _ApprovalTimeline extends StatelessWidget {
  final String status;

  const _ApprovalTimeline({required this.status});

  // Returns 0-based index of the last completed step.
  // -1 means none completed yet (SUBMITTED = step 0 in progress).
  int get _completedUpTo {
    switch (status) {
      case 'SUBMITTED':
        return 0; // step 0 done (submitted)
      case 'DIVISION_APPROVED':
        return 1;
      case 'REGION_APPROVED':
        return 2;
      case 'FINAL_APPROVED':
        return 3;
      case 'REJECTED':
        return -1; // will be handled separately
      default:
        return -1;
    }
  }

  @override
  Widget build(BuildContext context) {
    const steps = ['Soumise', 'Division', 'Région', 'Central'];
    final done = _completedUpTo;
    final isRejected = status == 'REJECTED';

    return Row(
      children: List.generate(steps.length * 2 - 1, (i) {
        // Odd indices are connectors
        if (i.isOdd) {
          final stepIndex = i ~/ 2;
          final lineComplete = done >= stepIndex + 1;
          return Expanded(
            child: Container(
              height: 2,
              color: isRejected
                  ? Colors.red.shade200
                  : lineComplete
                      ? Colors.green
                      : Colors.grey.shade300,
            ),
          );
        }

        final stepIndex = i ~/ 2;
        final isComplete = !isRejected && done >= stepIndex;
        final isActive = !isRejected && done == stepIndex - 1 + 1;

        Color nodeColor;
        Widget nodeIcon;

        if (isRejected) {
          nodeColor = Colors.red.shade100;
          nodeIcon = Icon(Icons.close, size: 12, color: Colors.red.shade400);
        } else if (isComplete) {
          nodeColor = Colors.green;
          nodeIcon = const Icon(Icons.check, size: 12, color: Colors.white);
        } else if (isActive) {
          nodeColor = Colors.orange;
          nodeIcon =
              const Icon(Icons.schedule, size: 12, color: Colors.white);
        } else {
          nodeColor = Colors.grey.shade300;
          nodeIcon = Icon(Icons.circle,
              size: 6, color: Colors.grey.shade400);
        }

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: nodeColor,
                shape: BoxShape.circle,
              ),
              child: Center(child: nodeIcon),
            ),
            const SizedBox(height: 4),
            Text(
              steps[stepIndex],
              style: TextStyle(
                fontSize: 9,
                fontWeight: isComplete ? FontWeight.w600 : FontWeight.normal,
                color: isRejected
                    ? Colors.red.shade400
                    : isComplete
                        ? Colors.green.shade700
                        : Colors.grey.shade500,
              ),
            ),
          ],
        );
      }),
    );
  }
}

// ── Status badge ────────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _StatusBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(30),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(150)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
