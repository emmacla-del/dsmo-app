// lib/screens/report/report_models.dart
import 'package:flutter/material.dart';

enum UserRole {
  superAdmin,
  admin,
  viewer,
}

extension UserRoleX on UserRole {
  String get label => switch (this) {
        UserRole.superAdmin => 'Super Administrateur',
        UserRole.admin => 'Administrateur',
        UserRole.viewer => 'Consultateur',
      };

  IconData get icon => switch (this) {
        UserRole.superAdmin => Icons.admin_panel_settings_outlined,
        UserRole.admin => Icons.person_outline,
        UserRole.viewer => Icons.visibility_outlined,
      };
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
  String get label => switch (this) {
        AuditAction.generate => 'Génération',
        AuditAction.approve => 'Approbation',
        AuditAction.reject => 'Rejet',
        AuditAction.download => 'Téléchargement',
        AuditAction.batchGenerate => 'Génération batch',
        AuditAction.distribute => 'Distribution',
        AuditAction.compare => 'Comparaison',
        AuditAction.retry => 'Reprise',
        AuditAction.delete => 'Suppression',
      };

  IconData get icon => switch (this) {
        AuditAction.generate => Icons.add_chart_outlined,
        AuditAction.approve => Icons.check_circle_outline,
        AuditAction.reject => Icons.cancel_outlined,
        AuditAction.download => Icons.download_outlined,
        AuditAction.batchGenerate => Icons.grid_view_outlined,
        AuditAction.distribute => Icons.share_outlined,
        AuditAction.compare => Icons.compare_arrows_outlined,
        AuditAction.retry => Icons.refresh_outlined,
        AuditAction.delete => Icons.delete_outline,
      };
}

enum BatchJobStatus { pending, running, completed, failed }

enum ReportStatus { pending, approved, rejected, ready, failed }

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
  final String? downloadUrl;

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
    this.downloadUrl,
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
      downloadUrl: pdfUrl,
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

  BatchJob({
    required this.id,
    required this.name,
    required this.regions,
    required this.dateRange,
    required this.status,
    required this.totalReports,
    required this.completedReports,
    required this.failedReports,
  });
}

class AuditEntry {
  final String id;
  final String userName;
  final UserRole userRole;
  final AuditAction action;
  final String? reportName;
  final DateTime timestamp;

  const AuditEntry({
    required this.id,
    required this.userName,
    required this.userRole,
    required this.action,
    this.reportName,
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

// Backend constants
const Map<String, List<String>> groupToBackendSections = {
  'Executive Summary': ['kpi', 'insights'],
  'Employment & Workforce': ['trends'],
  'Skills & Training': ['sectorAnalysis'],
  'Diversity & Inclusion': ['demographics'],
  'Regional Analysis': ['regionalBreakdown'],
};
