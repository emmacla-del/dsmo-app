// lib/screens/report/report_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../theme/ultra_theme.dart';
import 'report_models.dart';
import 'report_providers.dart';
import 'report_generator_tab.dart';
import 'report_history_tab.dart';
import 'report_approvals_tab.dart';
import 'report_batch_tab.dart';
import 'report_compare_tab.dart';
import 'report_audit_tab.dart';

class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key});

  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final UserRole _currentUserRole = UserRole.superAdmin;
  late ReportPermissions _permissions;

  @override
  void initState() {
    super.initState();
    _permissions = ReportPermissions.forRole(_currentUserRole);
    _tabController = TabController(length: _getTabCount(), vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  int _getTabCount() {
    int count = 1; // Generate
    if (_permissions.canApprove) count++; // Approvals
    count++; // History
    if (_permissions.canBatchGenerate) count++; // Batch
    if (_permissions.canCompare) count++; // Compare
    if (_permissions.canViewAudit) count++; // Audit
    return count;
  }

  List<Tab> _getTabs() {
    final tabs = <Tab>[
      const Tab(text: 'Générer', icon: Icon(Icons.add_chart_outlined)),
    ];
    if (_permissions.canApprove) {
      tabs.add(const Tab(
          text: 'Approbations', icon: Icon(Icons.check_circle_outline)));
    }
    tabs.add(const Tab(text: 'Historique', icon: Icon(Icons.history_rounded)));
    if (_permissions.canBatchGenerate) {
      tabs.add(const Tab(text: 'Batch', icon: Icon(Icons.grid_view_outlined)));
    }
    if (_permissions.canCompare) {
      tabs.add(const Tab(
          text: 'Comparer', icon: Icon(Icons.compare_arrows_outlined)));
    }
    if (_permissions.canViewAudit) {
      tabs.add(
          const Tab(text: 'Audit', icon: Icon(Icons.receipt_long_outlined)));
    }
    return tabs;
  }

  void _refreshAll() {
    ref.read(reportRefreshProvider.notifier).refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Générateur de rapport',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            Row(
              children: [
                Icon(_currentUserRole.icon,
                    size: 12, color: UltraTheme.textSecondary),
                const SizedBox(width: 4),
                Text(_currentUserRole.label, style: TextStyle(fontSize: 10)),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _refreshAll,
            tooltip: 'Actualiser',
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: _getTabs(),
          isScrollable: true,
          indicatorColor: const Color(0xFF1D9E75),
          labelColor: const Color(0xFF1D9E75),
          unselectedLabelColor: UltraTheme.textMuted,
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 0: Generate
          ReportGeneratorTab(
            userRole: _currentUserRole,
            permissions: _permissions,
            onReportGenerated: _refreshAll,
          ),

          // Tab 1: Approvals (if SuperAdmin)
          if (_permissions.canApprove)
            Consumer(
              builder: (context, ref, _) {
                final approvalsAsync = ref.watch(pendingApprovalsProvider);
                return approvalsAsync.when(
                  data: (approvals) => ReportApprovalsTab(
                    pendingApprovals: approvals,
                    onApprove: _refreshAll,
                  ),
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('Erreur: $e')),
                );
              },
            ),

          // Tab 2: History
          Consumer(
            builder: (context, ref, _) {
              final reportsAsync = ref.watch(refreshableReportsProvider);
              return reportsAsync.when(
                data: (reports) => ReportHistoryTab(
                  reports: reports,
                  onRefresh: _refreshAll,
                ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Erreur: $e')),
              );
            },
          ),

          // Tab 3: Batch (if admin)
          if (_permissions.canBatchGenerate)
            Consumer(
              builder: (context, ref, _) {
                final batchJobsAsync = ref.watch(batchJobsProvider);
                return batchJobsAsync.when(
                  data: (jobs) => ReportBatchTab(
                    batchJobs: jobs,
                    onBatchGenerated: _refreshAll,
                  ),
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('Erreur: $e')),
                );
              },
            ),

          // Tab 4: Compare
          if (_permissions.canCompare)
            Consumer(
              builder: (context, ref, _) {
                final reportsAsync = ref.watch(refreshableReportsProvider);
                return reportsAsync.when(
                  data: (reports) => ReportCompareTab(reports: reports),
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('Erreur: $e')),
                );
              },
            ),

          // Tab 5: Audit (if SuperAdmin)
          if (_permissions.canViewAudit)
            Consumer(
              builder: (context, ref, _) {
                final auditAsync = ref.watch(auditEntriesProvider);
                return auditAsync.when(
                  data: (entries) => ReportAuditTab(auditEntries: entries),
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('Erreur: $e')),
                );
              },
            ),
        ].whereType<Widget>().toList(),
      ),
    );
  }
}
