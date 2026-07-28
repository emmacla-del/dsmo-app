// lib/features/analytics/widgets/tab_bar_widget.dart
//
// The visual tab selector used to live here as a TabBar — it's now the
// "Section" dropdown inside AnalyticsFilterBar (analytics_filter_bar.dart),
// merged into the same bar as the period/location/entity/sector filters.
// TabContent below is unchanged: it's still the TabBarView driven by the
// same DefaultTabController, just no longer paired with a TabBar sibling.

import 'package:flutter/material.dart';

import '../models/dashboard_models.dart';

import 'overview_tab.dart';
import 'benchmarking_tab.dart';
import 'labor_market_tab.dart';
import 'workforce_structure_tab.dart';
import 'recruitment_insertion_tab.dart';
import 'mobility_retention_tab.dart';
import 'inclusion_tab.dart';
import 'competences_formation_tab.dart';
import 'common_cards.dart' show Granularity;

class TabContent extends StatelessWidget {
  final DashboardSummary dashboard;
  final DashboardSummary? previous;
  final List<TimeSeriesData> trends;
  final List<Sector> sectors;
  final List<GenderRegion> gender;
  final EmploymentBalance? employmentBalance;
  final List<Animation<double>>? cardAnimations;
  final Granularity granularity;
  final void Function(Granularity) onGranularityChanged;

  const TabContent({
    super.key,
    required this.dashboard,
    required this.previous,
    required this.trends,
    required this.sectors,
    required this.gender,
    this.employmentBalance,
    this.cardAnimations,
    required this.granularity,
    required this.onGranularityChanged,
  });

  @override
  Widget build(BuildContext context) {
    return TabBarView(
      children: [
        // ─────────────────────────────────────────────
        // 1. SYNTHÈSE
        // ─────────────────────────────────────────────
        OverviewTab(
          dashboard: dashboard,
          previous: previous,
          trends: trends,
          employmentBalance: employmentBalance,
          cardAnimations: cardAnimations,
          granularity: granularity,
          onGranularityChanged: onGranularityChanged,
        ),

        // ─────────────────────────────────────────────
        // 2. BENCHMARKING
        // ─────────────────────────────────────────────
        const BenchmarkingTab(),

        // ─────────────────────────────────────────────
        // 3. MARCHÉ DU TRAVAIL
        // ─────────────────────────────────────────────
        const LaborMarketTab(),

        // ─────────────────────────────────────────────
        // 4. STRUCTURE DES RECRUTEMENTS
        // ─────────────────────────────────────────────
        WorkforceStructureTab(
          sectors: sectors,
          cardAnimations: cardAnimations,
        ),

        // ─────────────────────────────────────────────
        // 5. RECRUTEMENT & INSERTION
        // ─────────────────────────────────────────────
        const RecruitmentInsertionTab(),

        // ─────────────────────────────────────────────
        // 6. MOBILITÉ & RÉTENTION
        // ─────────────────────────────────────────────
        const MobilityRetentionTab(),

        // ─────────────────────────────────────────────
        // 7. INCLUSION
        // ─────────────────────────────────────────────
        InclusionTab(
          gender: gender,
          dashboard: dashboard,
          cardAnimations: cardAnimations,
        ),

        // ─────────────────────────────────────────────
        // 8. COMPÉTENCES & FORMATION
        // ─────────────────────────────────────────────
        const CompetencesFormationTab(),
      ],
    );
  }
}
