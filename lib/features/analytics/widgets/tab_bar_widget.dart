// lib/features/analytics/widgets/tab_bar_widget.dart
// ==================================================================
// TabBar and TabBarView wrapper
// ==================================================================

import 'package:flutter/material.dart';
import '../models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';
import '../models/time_series_data.dart';
import 'common_cards.dart';
import 'overview_tab.dart';
import 'sectors_tab.dart';
import 'movements_tab.dart';
import 'gender_tab.dart';

// TabBarWidget intentionally uses DefaultTabController.of(context) so it stays
// in sync with the TabBarView in TabContent, which also inherits the same ancestor.
class TabBarWidget extends StatelessWidget {
  const TabBarWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: InkColor.surface,
      child: TabBar(
        // No explicit controller → uses DefaultTabController ancestor
        indicator: BoxDecoration(
          color: AccentColor.teal.withAlpha(20),
          borderRadius: BorderRadius.circular(8),
        ),
        indicatorSize: TabBarIndicatorSize.label,
        labelColor: AccentColor.teal,
        unselectedLabelColor: TextColor.muted,
        labelStyle: textMono(11, weight: FontWeight.bold),
        unselectedLabelStyle: textMono(11),
        tabs: const [
          Tab(text: 'Synthèse'),
          Tab(text: 'Secteurs'),
          Tab(text: 'Mouvements'),
          Tab(text: 'Parité'),
        ],
      ),
    );
  }
}

class TabContent extends StatelessWidget {
  final DashboardSummary dashboard;
  final DashboardSummary? previous;
  final List<TimeSeriesData> trends;
  final List<Sector> sectors;
  final List<GenderRegion> gender;
  final List<Animation<double>> cardAnimations;
  final Granularity granularity;
  final void Function(Granularity) onGranularityChanged;

  const TabContent({
    required this.dashboard,
    required this.previous,
    required this.trends,
    required this.sectors,
    required this.gender,
    required this.cardAnimations,
    required this.granularity,
    required this.onGranularityChanged,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    // Explicit height allows TabBarView to function inside a scrollable view
    return SizedBox(
      height: MediaQuery.of(context).size.height - 200,
      child: TabBarView(
        children: [
          OverviewTab(
            dashboard: dashboard,
            previous: previous,
            trends: trends,
            cardAnimations: cardAnimations,
            granularity: granularity,
            onGranularityChanged: onGranularityChanged,
          ),
          SectorsTab(
            sectors: sectors,
            cardAnimations: cardAnimations,
          ),
          MovementsTab(
            dashboard: dashboard,
            cardAnimations: cardAnimations,
          ),
          GenderTab(
            gender: gender,
            dashboard: dashboard,
            cardAnimations: cardAnimations,
          ),
        ],
      ),
    );
  }
}
