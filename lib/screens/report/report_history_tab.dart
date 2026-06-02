// lib/screens/report/report_history_tab.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme/ultra_theme.dart';
import 'report_models.dart';
import 'report_service.dart';
import 'report_widgets.dart';

class ReportHistoryTab extends ConsumerStatefulWidget {
  final List<GeneratedReport> reports;
  final VoidCallback onRefresh;

  const ReportHistoryTab({
    super.key,
    required this.reports,
    required this.onRefresh,
  });

  @override
  ConsumerState<ReportHistoryTab> createState() => _ReportHistoryTabState();
}

class _ReportHistoryTabState extends ConsumerState<ReportHistoryTab> {
  Future<void> _downloadReport(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Téléchargement démarré')),
        );
      }
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (widget.reports.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.description_outlined, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text('Aucun rapport généré'),
            SizedBox(height: 8),
            Text('Générez votre premier rapport dans l\'onglet "Générer"',
                style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async => widget.onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: widget.reports.length,
        itemBuilder: (ctx, i) {
          final report = widget.reports[i];
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: UltraTheme.surface,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: report.isApproved
                        ? const Color(0xFFE1F5EE)
                        : report.isRejected
                            ? const Color(0xFFFCEBEB)
                            : const Color(0xFFFFF3E0),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    report.isApproved
                        ? Icons.check_circle
                        : report.isRejected
                            ? Icons.cancel
                            : Icons.pending,
                    color: report.isApproved
                        ? const Color(0xFF0F6E56)
                        : report.isRejected
                            ? UltraTheme.error
                            : const Color(0xFFE67E22),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        report.name,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${report.region ?? 'National'} · ${report.periodLabel ?? report.year}',
                        style: const TextStyle(
                            fontSize: 12, color: UltraTheme.textMuted),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _formatDate(report.generatedAt),
                        style: const TextStyle(
                            fontSize: 10, color: UltraTheme.textMuted),
                      ),
                    ],
                  ),
                ),
                if (report.downloadUrl != null && report.isApproved)
                  IconAction(
                    icon: Icons.download_outlined,
                    tooltip: 'Télécharger',
                    onTap: () => _downloadReport(report.downloadUrl!),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
