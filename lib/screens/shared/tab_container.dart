import 'package:flutter/material.dart';
import '../../theme/ultra_theme.dart';

// ══════════════════════════════════════════════════════════════
// TabContainer — the pill-tab shell shared by every "wrapper"
// screen that groups two related sub-screens behind one nav
// entry (e.g. user approvals + roster, DSMO + ONEFOP submissions).
// Each wrapper only supplies its tab labels and child screens.
// ══════════════════════════════════════════════════════════════

class TabContainer extends StatefulWidget {
  const TabContainer({super.key, required this.tabs, this.actions});

  /// One entry per tab: its label and the screen it shows.
  final List<({String label, Widget child})> tabs;

  /// Optional controls shown alongside the pill tab bar (e.g. an export
  /// toggle) — rendered to its right, on the same row.
  final List<Widget>? actions;

  @override
  State<TabContainer> createState() => _TabContainerState();
}

class _TabContainerState extends State<TabContainer>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController =
      TabController(length: widget.tabs.length, vsync: this);

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
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
          child: Row(children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: UltraTheme.surface,
                  borderRadius: BorderRadius.circular(14),
                  border:
                      Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
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
                  tabs: [for (final t in widget.tabs) Tab(text: t.label)],
                ),
              ),
            ),
            if (widget.actions != null) ...[
              const SizedBox(width: 12),
              ...widget.actions!,
            ],
          ]),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [for (final t in widget.tabs) t.child],
          ),
        ),
      ]),
    );
  }
}
