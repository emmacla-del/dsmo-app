import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../screens/dashboards/company_workspace_dashboard.dart';
import '../screens/dashboards/regional_agent_dashboard.dart';
import '../screens/dashboards/national_overview_dashboard.dart';
import '../screens/dsmo/declarations_list_screen.dart';
import '../screens/dsmo/send_notification_screen.dart';
import '../screens/admin/pending_users_screen.dart';
import '../features/analytics/screens/analytics_dashboard_screen.dart';
import '../features/analytics/screens/company_analytics_screen.dart';
import '../screens/onefop/onefop_dashboard_screen.dart';
import '../screens/onefop/pending_list_screen.dart';
import '../screens/onefop/onefop_analytics_screen.dart';

class HomeTab {
  const HomeTab(this.label, this.icon, this.screen);
  final String label;
  final IconData icon;
  final Widget screen;
}

String _resolveRole(User user) {
  if (user.role != 'SUPER_ADMIN') return user.role;
  switch (user.stream?.toUpperCase()) {
    case 'DSMO':
      return 'SUPER_ADMIN_DSMO';
    case 'ONEFOP':
      return 'SUPER_ADMIN_ONEFOP';
    default:
      return 'SUPER_ADMIN_DSMO';
  }
}

List<HomeTab> _companyTabs(User user) {
  final f = user.features;
  return [
    const HomeTab('Accueil', Icons.home_outlined, CompanyWorkspaceDashboard()),
    const HomeTab(
        'Déclarations', Icons.folder_open_outlined, DeclarationsListScreen()),
    if (f.onefopBasicAnalytics)
      const HomeTab(
          'Mon Analytique', Icons.insights_outlined, CompanyAnalyticsScreen()),
    const HomeTab('Paramètres', Icons.settings_outlined, Placeholder()),
  ];
}

List<HomeTab> _divisionalTabs() => const [
      HomeTab('File d\'attente', Icons.pending_actions_outlined,
          RegionalAgentDashboard()),
      HomeTab(
          'Analytique', Icons.bar_chart_outlined, AnalyticsDashboardScreen()),
      HomeTab('Notifications', Icons.notifications_outlined,
          SendNotificationScreen()),
    ];

List<HomeTab> _regionalTabs() => const [
      HomeTab('File d\'attente', Icons.pending_actions_outlined,
          RegionalAgentDashboard()),
      HomeTab('Analytique DSMO', Icons.bar_chart_outlined,
          AnalyticsDashboardScreen()),
      HomeTab(
          'LMIS · Région', Icons.analytics_outlined, OnefopDashboardScreen()),
      HomeTab('Notifications', Icons.notifications_outlined,
          SendNotificationScreen()),
    ];

List<HomeTab> _centralTabs() => const [
      HomeTab('Vue nationale', Icons.dashboard_outlined,
          NationalOverviewDashboard()),
      HomeTab('Analytique DSMO', Icons.bar_chart_outlined,
          AnalyticsDashboardScreen()),
      HomeTab(
          'LMIS · ONEFOP', Icons.analytics_outlined, OnefopDashboardScreen()),
      HomeTab('Notifications', Icons.notifications_outlined,
          SendNotificationScreen()),
    ];

List<HomeTab> _superAdminDsmoTabs() => const [
      HomeTab('Vue nationale', Icons.dashboard_outlined,
          NationalOverviewDashboard()),
      HomeTab('Déclarations', Icons.pending_actions_outlined,
          DeclarationsListScreen()),
      HomeTab('Analytique DSMO', Icons.bar_chart_outlined,
          AnalyticsDashboardScreen()),
      HomeTab('Agents', Icons.manage_accounts_outlined, PendingUsersScreen()),
      HomeTab('Notifications', Icons.notifications_outlined,
          SendNotificationScreen()),
    ];

List<HomeTab> _superAdminOnefopTabs() => const [
      HomeTab('LMIS · Tableau de bord', Icons.dashboard_outlined,
          OnefopDashboardScreen()),
      HomeTab('Questionnaires', Icons.pending_actions_outlined,
          PendingListScreen()),
      HomeTab('Analytique ONEFOP', Icons.analytics_outlined,
          OnefopAnalyticsScreen()),
      HomeTab('Notifications', Icons.notifications_outlined,
          SendNotificationScreen()),
    ];

List<HomeTab> _fallbackTabs() => const [
      HomeTab('Vue nationale', Icons.dashboard_outlined,
          NationalOverviewDashboard()),
      HomeTab('Notifications', Icons.notifications_outlined,
          SendNotificationScreen()),
    ];

final homeTabsProvider = Provider.family<List<HomeTab>, User>((ref, user) {
  final role = _resolveRole(user);
  switch (role) {
    case 'COMPANY':
      return _companyTabs(user);
    case 'DIVISIONAL':
      return _divisionalTabs();
    case 'REGIONAL':
      return _regionalTabs();
    case 'CENTRAL':
      return _centralTabs();
    case 'SUPER_ADMIN_DSMO':
      return _superAdminDsmoTabs();
    case 'SUPER_ADMIN_ONEFOP':
      return _superAdminOnefopTabs();
    default:
      debugPrint('⚠️ Unrecognised role: "$role"');
      return _fallbackTabs();
  }
});
