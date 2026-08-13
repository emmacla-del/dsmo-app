import 'package:flutter/material.dart';
import '../shared/tab_container.dart';
import '../dsmo/declarations_list_screen.dart';
import '../onefop/submissions_viewer_screen.dart';
import 'onefop_export_panel.dart';

// ══════════════════════════════════════════════════════════════
// SoumissionsScreen — merges DSMO declarations and ONEFOP
// submissions behind one "Soumissions" nav entry. Only used by
// the full SUPER_ADMIN (both-stream) role — the stream-scoped
// SUPER_ADMIN_DSMO/SUPER_ADMIN_ONEFOP roles only ever have one
// of the two, so they keep their single dedicated tab.
//
// No "new declaration" affordance here (and none passed down to
// DeclarationsListScreen) — this is a reviewer's view of everyone
// else's submissions, not a company filing its own.
//
// Also hosts the bulk ONEFOP export panel (Excel/SPSS) — this used
// to live in a separate "Data Mgmt" tab, which just duplicated the
// submission data already listed here.
// ══════════════════════════════════════════════════════════════

class SoumissionsScreen extends StatefulWidget {
  const SoumissionsScreen({super.key});

  @override
  State<SoumissionsScreen> createState() => _SoumissionsScreenState();
}

class _SoumissionsScreenState extends State<SoumissionsScreen> {
  bool _exportPanelOpen = false;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      // Capped + scrollable rather than sized to its natural height: the
      // panel's filter card grows with content, and on a short window an
      // uncapped panel above the Expanded tab content below can squeeze it
      // to near-zero height and overflow — same reasoning as the toolbar
      // bound in submissions_viewer_screen.dart.
      //
      // A flat percentage cap (e.g. 55%) still fails on a short-enough
      // window — it shifts the threshold rather than removing it. Instead,
      // reserve a fixed minimum for the tab content (its own AppBar +
      // toolbar + pagination bar need real space to not overflow
      // themselves) and give the panel whatever's left above that.
      const kMinTabContentHeight = 360.0;
      final panelMaxHeight = constraints.maxHeight.isFinite
          ? (constraints.maxHeight - kMinTabContentHeight)
              .clamp(0.0, double.infinity)
          : 420.0;
      return Column(children: [
        if (_exportPanelOpen)
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: panelMaxHeight),
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: OnefopExportPanel(
                  onClose: () => setState(() => _exportPanelOpen = false),
                ),
              ),
            ),
          ),
        Expanded(
          child: TabContainer(
            actions: [
              IconButton(
                icon: Icon(_exportPanelOpen
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.download_rounded),
                onPressed: () =>
                    setState(() => _exportPanelOpen = !_exportPanelOpen),
                tooltip: 'Exporter',
              ),
            ],
            tabs: const [
              (label: 'DSMO', child: DeclarationsListScreen()),
              (label: 'ONEFOP', child: SubmissionsViewerScreen()),
            ],
          ),
        ),
      ]);
    });
  }
}
