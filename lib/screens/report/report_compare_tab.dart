// lib/screens/report/report_compare_tab.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/ultra_theme.dart';
import 'report_models.dart';
import 'report_service.dart';

class ReportCompareTab extends ConsumerStatefulWidget {
  final List<GeneratedReport> reports;

  const ReportCompareTab({super.key, required this.reports});

  @override
  ConsumerState<ReportCompareTab> createState() => _ReportCompareTabState();
}

class _ReportCompareTabState extends ConsumerState<ReportCompareTab> {
  String? _baselineId;
  String? _targetId;
  Map<String, dynamic>? _comparisonResult;
  bool _comparing = false;

  Future<void> _compare() async {
    if (_baselineId == null || _targetId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sélectionnez deux rapports à comparer')),
      );
      return;
    }

    setState(() => _comparing = true);
    try {
      final service = ref.read(reportServiceProvider);
      final results = await Future.wait([
        service.getReportData(_baselineId!),
        service.getReportData(_targetId!),
      ]);

      setState(() {
        _comparisonResult = _calculateComparison(
          results[0]['summary'] ?? {},
          results[1]['summary'] ?? {},
        );
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('Erreur: $e'), backgroundColor: UltraTheme.error),
      );
    } finally {
      setState(() => _comparing = false);
    }
  }

  Map<String, dynamic> _calculateComparison(
      Map<String, dynamic> baseline, Map<String, dynamic> target) {
    final comparison = <String, dynamic>{};
    final metricLabels = {
      'totalEmployees': 'Effectif total',
      'totalHires': 'Recrutements',
      'femalePercentage': 'Féminisation',
      'youthPercentage': 'Emploi jeunes',
    };

    for (final entry in metricLabels.entries) {
      final baseVal = (baseline[entry.key] ?? 0).toDouble();
      final targetVal = (target[entry.key] ?? 0).toDouble();
      comparison[entry.value] = {
        'baseline': baseVal,
        'target': targetVal,
        'change': targetVal - baseVal,
        'percentChange':
            baseVal != 0 ? ((targetVal - baseVal) / baseVal * 100) : 0,
      };
    }
    return comparison;
  }

  @override
  Widget build(BuildContext context) {
    final approvedReports = widget.reports.where((r) => r.isApproved).toList();

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
                value: _baselineId,
                hint: const Text('Sélectionner un rapport'),
                items: approvedReports
                    .map((r) =>
                        DropdownMenuItem(value: r.id, child: Text(r.name)))
                    .toList(),
                onChanged: (v) => setState(() => _baselineId = v),
                decoration:
                    const InputDecoration(labelText: 'Rapport de référence'),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _targetId,
                hint: const Text('Sélectionner un rapport'),
                items: approvedReports
                    .where((r) => r.id != _baselineId)
                    .map((r) =>
                        DropdownMenuItem(value: r.id, child: Text(r.name)))
                    .toList(),
                onChanged: (v) => setState(() => _targetId = v),
                decoration:
                    const InputDecoration(labelText: 'Rapport à comparer'),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _comparing ? null : _compare,
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1D9E75)),
                  child: _comparing
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Comparer'),
                ),
              ),
            ],
          ),
        ),
        if (_comparisonResult != null && _comparisonResult!.isNotEmpty) ...[
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: UltraTheme.surface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Résultats de la comparaison',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                const SizedBox(height: 16),
                ..._comparisonResult!.entries.map((entry) {
                  final data = entry.value;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(entry.key,
                            style:
                                const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: UltraTheme.background,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Column(
                                  children: [
                                    Text('Référence',
                                        style: TextStyle(
                                            fontSize: 10,
                                            color: UltraTheme.textMuted)),
                                    const SizedBox(height: 4),
                                    Text(
                                        '${data['baseline'].toStringAsFixed(0)}',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w600)),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Icon(Icons.arrow_forward,
                                color: Color(0xFF1D9E75)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE1F5EE),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Column(
                                  children: [
                                    Text('Comparé',
                                        style: TextStyle(
                                            fontSize: 10,
                                            color: UltraTheme.textMuted)),
                                    const SizedBox(height: 4),
                                    Text('${data['target'].toStringAsFixed(0)}',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                            color: Color(0xFF0F6E56))),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: data['percentChange'] >= 0
                                ? const Color(0xFFE1F5EE)
                                : const Color(0xFFFCEBEB),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            '${data['percentChange'] >= 0 ? '+' : ''}${data['percentChange'].toStringAsFixed(1)}%',
                            style: TextStyle(
                              color: data['percentChange'] >= 0
                                  ? const Color(0xFF0F6E56)
                                  : UltraTheme.error,
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        const Divider(height: 24),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
