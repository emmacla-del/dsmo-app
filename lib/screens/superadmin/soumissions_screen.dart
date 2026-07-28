import 'package:flutter/material.dart';
import '../shared/tab_container.dart';
import '../dsmo/declarations_list_screen.dart';
import '../onefop/submissions_viewer_screen.dart';

// ══════════════════════════════════════════════════════════════
// SoumissionsScreen — merges DSMO declarations and ONEFOP
// submissions behind one "Soumissions" nav entry. Only used by
// the full SUPER_ADMIN (both-stream) role — the stream-scoped
// SUPER_ADMIN_DSMO/SUPER_ADMIN_ONEFOP roles only ever have one
// of the two, so they keep their single dedicated tab.
// ══════════════════════════════════════════════════════════════

class SoumissionsScreen extends StatelessWidget {
  const SoumissionsScreen({super.key, this.onNewSubmission});
  final VoidCallback? onNewSubmission;

  @override
  Widget build(BuildContext context) {
    return TabContainer(tabs: [
      (label: 'DSMO', child: DeclarationsListScreen(onNewSubmission: onNewSubmission)),
      (label: 'ONEFOP', child: const SubmissionsViewerScreen()),
    ]);
  }
}
