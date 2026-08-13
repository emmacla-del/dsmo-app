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
// Also hosts the bulk ONEFOP export panel (Excel/SPSS) — this used
// to live in a separate "Data Mgmt" tab, which just duplicated the
// submission data already listed here.
// ══════════════════════════════════════════════════════════════

class SoumissionsScreen extends StatefulWidget {
  const SoumissionsScreen({super.key, this.onNewSubmission});
  final VoidCallback? onNewSubmission;

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
      final panelMaxHeight =
          constraints.maxHeight.isFinite ? constraints.maxHeight * 0.55 : 420.0;
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
            tabs: [
              (
                label: 'DSMO',
                child: DeclarationsListScreen(
                    onNewSubmission: widget.onNewSubmission)
              ),
              (label: 'ONEFOP', child: const SubmissionsViewerScreen()),
            ],
          ),
        ),
      ]);
    });
  }
}
