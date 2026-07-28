import 'package:flutter/material.dart';
import '../../theme/ultra_theme.dart';
import '../campaign/campaign_management_screen.dart';
import '../dsmo/send_notification_screen.dart';

// ══════════════════════════════════════════════════════════════
// CommunicationScreen — merges campaign management and the
// notification composer behind one "Communication" nav entry.
// Only used by the full SUPER_ADMIN role — the stream-scoped
// admins don't manage campaigns, so they keep a bare
// "Notifications" tab.
// ══════════════════════════════════════════════════════════════

class CommunicationScreen extends StatefulWidget {
  const CommunicationScreen({super.key});

  @override
  State<CommunicationScreen> createState() => _CommunicationScreenState();
}

class _CommunicationScreenState extends State<CommunicationScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController = TabController(length: 2, vsync: this);

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      body: Column(children: [
        Container(
          margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: UltraTheme.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
          ),
          child: TabBar(
            controller: _tabController,
            indicator: BoxDecoration(
              color: UltraTheme.primary,
              borderRadius: BorderRadius.circular(10),
            ),
            indicatorSize: TabBarIndicatorSize.tab,
            dividerColor: Colors.transparent,
            labelColor: Colors.white,
            unselectedLabelColor: UltraTheme.textMuted,
            labelStyle: const TextStyle(
                fontFamily: 'Inter', fontWeight: FontWeight.w600, fontSize: 13),
            tabs: const [
              Tab(text: 'Campagnes'),
              Tab(text: 'Notifications'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: const [
              CampaignManagementScreen(),
              SendNotificationScreen(),
            ],
          ),
        ),
      ]),
    );
  }
}
