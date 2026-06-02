// lib/screens/report/report_approvals_tab.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/ultra_theme.dart';
import 'report_models.dart';
import 'report_service.dart';
import 'report_widgets.dart';

class ReportApprovalsTab extends ConsumerStatefulWidget {
  final List<GeneratedReport> pendingApprovals;
  final VoidCallback onApprove;

  const ReportApprovalsTab({
    super.key,
    required this.pendingApprovals,
    required this.onApprove,
  });

  @override
  ConsumerState<ReportApprovalsTab> createState() => _ReportApprovalsTabState();
}

class _ReportApprovalsTabState extends ConsumerState<ReportApprovalsTab> {
  bool _processing = false;

  Future<void> _approveReport(String reportId, bool approved,
      {String? reason}) async {
    setState(() => _processing = true);
    try {
      final service = ref.read(reportServiceProvider);
      final success =
          await service.approveReport(reportId, approved, reason: reason);

      if (success && mounted) {
        widget.onApprove();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(approved ? 'Rapport approuvé' : 'Rapport rejeté')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Erreur: $e'), backgroundColor: UltraTheme.error),
        );
      }
    } finally {
      setState(() => _processing = false);
    }
  }

  void _showRejectionDialog(String reportId) {
    final reasonController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Motif du rejet'),
        content: TextField(
          controller: reasonController,
          decoration: const InputDecoration(hintText: 'Expliquez pourquoi...'),
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

  @override
  Widget build(BuildContext context) {
    if (widget.pendingApprovals.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_outline, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text('Aucune approbation en attente'),
            SizedBox(height: 8),
            Text('Tous les rapports ont été traités',
                style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: widget.pendingApprovals.length,
      itemBuilder: (ctx, i) {
        final report = widget.pendingApprovals[i];
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
                    child: const Text('En attente',
                        style:
                            TextStyle(fontSize: 11, color: Color(0xFFE67E22))),
                  ),
                  const Spacer(),
                  Text(
                      '${report.generatedAt.day}/${report.generatedAt.month}/${report.generatedAt.year}'),
                ],
              ),
              const SizedBox(height: 12),
              Text(report.name,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 4),
              Text(
                  '${report.region ?? 'National'} · ${report.periodLabel ?? report.year}'),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _processing
                          ? null
                          : () => _showRejectionDialog(report.id),
                      style: OutlinedButton.styleFrom(
                          foregroundColor: UltraTheme.error),
                      child: const Text('Rejeter'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _processing
                          ? null
                          : () => _approveReport(report.id, true),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1D9E75)),
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
}
