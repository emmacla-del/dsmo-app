// lib/screens/report/report_providers.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'report_models.dart';
import 'report_service.dart';

// Auto-refresh providers (refresh every 30 seconds)
final reportsProvider =
    FutureProvider.autoDispose<List<GeneratedReport>>((ref) async {
  final service = ref.read(reportServiceProvider);
  return service.getReports();
});

final pendingApprovalsProvider =
    FutureProvider.autoDispose<List<GeneratedReport>>((ref) async {
  final service = ref.read(reportServiceProvider);
  return service.getPendingApprovals();
});

final batchJobsProvider =
    FutureProvider.autoDispose<List<BatchJob>>((ref) async {
  final service = ref.read(reportServiceProvider);
  return service.getBatchJobs();
});

final auditEntriesProvider =
    FutureProvider.autoDispose<List<AuditEntry>>((ref) async {
  final service = ref.read(reportServiceProvider);
  return service.getAuditLog();
});

final distributionListsProvider =
    FutureProvider.autoDispose<List<DistributionList>>((ref) async {
  final service = ref.read(reportServiceProvider);
  return service.getDistributionLists();
});

final geoStructureProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(reportServiceProvider);
  return service.getLocationStructure();
});

// Refresh notifier (to manually refresh data)
class ReportRefreshNotifier extends StateNotifier<int> {
  ReportRefreshNotifier() : super(0);

  void refresh() {
    state = state + 1;
  }
}

final reportRefreshProvider =
    StateNotifierProvider<ReportRefreshNotifier, int>((ref) {
  return ReportRefreshNotifier();
});

// Combined provider that refreshes when refresh is called
final refreshableReportsProvider = FutureProvider<List<GeneratedReport>>((ref) {
  ref.watch(reportRefreshProvider); // Watch for refresh triggers
  final service = ref.read(reportServiceProvider);
  return service.getReports();
});
