// lib/screens/report/report_batch_tab.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/ultra_theme.dart';
import 'report_models.dart';
import 'report_service.dart';
import 'report_widgets.dart';

class ReportBatchTab extends ConsumerStatefulWidget {
  final List<BatchJob> batchJobs;
  final VoidCallback onBatchGenerated;

  const ReportBatchTab({
    super.key,
    required this.batchJobs,
    required this.onBatchGenerated,
  });

  @override
  ConsumerState<ReportBatchTab> createState() => _ReportBatchTabState();
}

class _ReportBatchTabState extends ConsumerState<ReportBatchTab> {
  final List<String> _selectedRegions = [];
  bool _generating = false;

  final List<String> _availableRegions = [
    'Littoral',
    'Centre',
    'Nord',
    'Extrême-Nord',
    'Ouest',
    'Sud',
    'Est',
    'Adamaoua',
    'Nord-Ouest',
    'Sud-Ouest'
  ];

  Future<void> _generateBatch() async {
    if (_selectedRegions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sélectionnez au moins une région')),
      );
      return;
    }

    setState(() => _generating = true);
    try {
      final service = ref.read(reportServiceProvider);
      final success = await service.generateBatch({
        'name': 'Batch ${DateTime.now().toString().substring(0, 10)}',
        'regions': _selectedRegions,
        'dateRange': {
          'start': DateTime(DateTime.now().year, 1, 1).toIso8601String(),
          'end': DateTime.now().toIso8601String(),
        },
        'sections': ['kpi', 'trends', 'insights'],
      });

      if (success && mounted) {
        widget.onBatchGenerated();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Génération batch lancée')),
        );
        setState(() => _selectedRegions.clear());
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Erreur: $e'), backgroundColor: UltraTheme.error),
        );
      }
    } finally {
      setState(() => _generating = false);
    }
  }

  Future<void> _retryJob(String jobId) async {
    try {
      final service = ref.read(reportServiceProvider);
      final success = await service.retryBatchJob(jobId);

      if (success && mounted) {
        widget.onBatchGenerated();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reprise en cours')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Erreur: $e'), backgroundColor: UltraTheme.error),
        );
      }
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Batch form
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
              ..._availableRegions.map((region) => CheckboxListTile(
                    value: _selectedRegions.contains(region),
                    onChanged: (v) {
                      setState(() {
                        if (v == true) {
                          _selectedRegions.add(region);
                        } else {
                          _selectedRegions.remove(region);
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
                  onPressed: _generating ? null : _generateBatch,
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1D9E75)),
                  child: _generating
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Lancer la génération batch'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        // Batch jobs history
        const Text('Tâches récentes',
            style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        if (widget.batchJobs.isEmpty)
          const Padding(
            padding: EdgeInsets.all(32),
            child: Center(child: Text('Aucune tâche batch')),
          )
        else
          ...widget.batchJobs.map((job) => Container(
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
                              const SizedBox(height: 2),
                              Text(
                                  '${job.completedReports}/${job.totalReports} rapports'),
                              const SizedBox(height: 2),
                              Text(
                                _formatDate(job.dateRange.start),
                                style: const TextStyle(
                                    fontSize: 10, color: UltraTheme.textMuted),
                              ),
                            ],
                          ),
                        ),
                        if (job.status == BatchJobStatus.failed)
                          IconAction(
                            icon: Icons.refresh,
                            tooltip: 'Réessayer',
                            onTap: () => _retryJob(job.id),
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
}
