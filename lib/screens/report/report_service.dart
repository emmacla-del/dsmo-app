// lib/screens/report/report_service.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import 'report_models.dart';

final reportServiceProvider = Provider<ReportService>((ref) {
  final apiClient = ref.read(apiClientProvider);
  return ReportService(apiClient: apiClient);
});

class ReportService {
  final ApiClient _apiClient;

  ReportService({required ApiClient apiClient}) : _apiClient = apiClient;

  // â”€â”€ Reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Future<List<GeneratedReport>> getReports() async {
    try {
      final response = await _apiClient.get('/reports/history');
      final List<dynamic> data = response.data ?? [];
      return data
          .map((e) => GeneratedReport.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('Get reports error: $e');
      return [];
    }
  }

  Future<bool> generateReport(Map<String, dynamic> payload) async {
    try {
      await _apiClient.post('/reports/dynamic', data: payload);
      return true;
    } catch (e) {
      debugPrint('Generate report error: $e');
      return false;
    }
  }

  // â”€â”€ Approvals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Future<List<GeneratedReport>> getPendingApprovals() async {
    try {
      final response = await _apiClient.get('/reports/pending-approval');
      final List<dynamic> data = response.data ?? [];
      return data
          .map((e) => GeneratedReport.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('Get pending approvals error: $e');
      return [];
    }
  }

  Future<bool> approveReport(String reportId, bool approved,
      {String? reason}) async {
    try {
      await _apiClient.post('/reports/approve', data: {
        'reportId': reportId,
        'approved': approved,
        'rejectionReason': reason,
      });
      return true;
    } catch (e) {
      debugPrint('Approve report error: $e');
      return false;
    }
  }

  // â”€â”€ Batch Jobs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Future<List<BatchJob>> getBatchJobs() async {
    try {
      final response = await _apiClient.get('/reports/batch-jobs');
      final List<dynamic> data = response.data ?? [];
      return data
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
              ))
          .toList();
    } catch (e) {
      debugPrint('Get batch jobs error: $e');
      return [];
    }
  }

  Future<bool> generateBatch(Map<String, dynamic> payload) async {
    try {
      await _apiClient.post('/reports/batch', data: payload);
      return true;
    } catch (e) {
      debugPrint('Generate batch error: $e');
      return false;
    }
  }

  Future<bool> retryBatchJob(String jobId) async {
    try {
      await _apiClient.post('/reports/retry/$jobId');
      return true;
    } catch (e) {
      debugPrint('Retry batch job error: $e');
      return false;
    }
  }

  // â”€â”€ Comparison â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Future<Map<String, dynamic>> getReportData(String reportId) async {
    try {
      final response = await _apiClient.get('/reports/$reportId/data');
      return response.data as Map<String, dynamic>? ?? {};
    } catch (e) {
      debugPrint('Get report data error: $e');
      return {};
    }
  }

  // â”€â”€ Distribution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Future<List<DistributionList>> getDistributionLists() async {
    try {
      final response = await _apiClient.get('/distribution/lists');
      final List<dynamic> data = response.data ?? [];
      return data
          .map((e) => DistributionList(
                id: e['id'],
                name: e['name'],
                emails: List<String>.from(e['emails']),
                isActive: e['isActive'],
              ))
          .toList();
    } catch (e) {
      debugPrint('Get distribution lists error: $e');
      return [];
    }
  }

  Future<bool> sendDistribution(String reportId, List<String> listIds) async {
    try {
      await _apiClient.post('/distribution/send', data: {
        'reportId': reportId,
        'distributionListIds': listIds,
      });
      return true;
    } catch (e) {
      debugPrint('Send distribution error: $e');
      return false;
    }
  }

  // â”€â”€ Audit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Future<List<AuditEntry>> getAuditLog() async {
    try {
      final response = await _apiClient.get('/audit/reports');
      final List<dynamic> data = response.data ?? [];
      return data
          .map((e) => AuditEntry(
                id: e['id'],
                userName: e['userName'],
                userRole:
                    UserRole.values.firstWhere((r) => r.name == e['userRole']),
                action:
                    AuditAction.values.firstWhere((a) => a.name == e['action']),
                reportName: e['reportName'],
                timestamp: DateTime.parse(e['timestamp']),
              ))
          .toList();
    } catch (e) {
      debugPrint('Get audit log error: $e');
      return [];
    }
  }

  // â”€â”€ Geo Structure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Future<List<Map<String, dynamic>>> getLocationStructure() async {
    try {
      final response = await _apiClient.getLocationStructure();
      return response.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (e) {
      debugPrint('Get location structure error: $e');
      return [];
    }
  }
}
