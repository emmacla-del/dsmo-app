// lib/screens/report/report_audit_tab.dart
import 'package:flutter/material.dart';
import '../../theme/ultra_theme.dart';
import 'report_models.dart';
import 'report_widgets.dart';

class ReportAuditTab extends StatelessWidget {
  final List<AuditEntry> auditEntries;

  const ReportAuditTab({
    super.key,
    required this.auditEntries,
  });

  String _formatDateTime(DateTime date) {
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (auditEntries.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.security_outlined, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text('Aucune activité enregistrée'),
            SizedBox(height: 8),
            Text('Les actions des utilisateurs apparaîtront ici',
                style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: auditEntries.length,
      itemBuilder: (ctx, i) {
        final entry = auditEntries[i];
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
                    Text(
                      '${entry.userName} · ${entry.action.label}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      entry.reportName ?? 'Action système',
                      style: const TextStyle(
                          fontSize: 12, color: UltraTheme.textMuted),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _formatDateTime(entry.timestamp),
                      style: const TextStyle(
                          fontSize: 10, color: UltraTheme.textMuted),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: entry.userRole == UserRole.superAdmin
                      ? const Color(0xFFE1F5EE)
                      : entry.userRole == UserRole.admin
                          ? const Color(0xFFE3F2FD)
                          : UltraTheme.textMuted.withAlpha(30),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  entry.userRole.label,
                  style: TextStyle(
                    fontSize: 10,
                    color: entry.userRole == UserRole.superAdmin
                        ? const Color(0xFF0F6E56)
                        : entry.userRole == UserRole.admin
                            ? Colors.blue
                            : UltraTheme.textMuted,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
