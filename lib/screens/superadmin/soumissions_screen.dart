import 'package:flutter/material.dart';
import '../../theme/ultra_theme.dart';
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
// DSMO and ONEFOP stay two separate screens/data models (different
// status vocabularies, different columns, different available actions
// — DSMO still has approve/reject, ONEFOP is read-only per the
// suspended vetting workflow) rather than one merged table. The type
// switch is a dropdown (DSMO/ONEFOP, no "All") instead of pill tabs,
// sharing one toolbar row with the export button.
//
// No "new declaration" affordance here (and none passed down to
// DeclarationsListScreen) — this is a reviewer's view of everyone
// else's submissions, not a company filing its own.
//
// Also hosts the bulk ONEFOP export panel (Excel/SPSS) — this used
// to live in a separate "Data Mgmt" tab, which just duplicated the
// submission data already listed here. It opens as a dialog rather
// than an inline panel above the tabs: an inline panel competes with
// the tab content for vertical space and squeezed it into overflow
// on anything shorter than a tall desktop window; a dialog is an
// overlay, so it doesn't take space away from anything.
// ══════════════════════════════════════════════════════════════

enum _SubmissionType { dsmo, onefop }

class SoumissionsScreen extends StatefulWidget {
  const SoumissionsScreen({super.key});

  @override
  State<SoumissionsScreen> createState() => _SoumissionsScreenState();
}

class _SoumissionsScreenState extends State<SoumissionsScreen> {
  _SubmissionType _type = _SubmissionType.dsmo;

  Future<void> _openExportDialog(BuildContext context) {
    return showDialog(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.4),
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: 640,
            maxHeight: MediaQuery.of(ctx).size.height * 0.85,
          ),
          child: SingleChildScrollView(
            child: OnefopExportPanel(onClose: () => Navigator.of(ctx).pop()),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: UltraTheme.surface,
              borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
              border: Border.all(color: UltraTheme.border),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<_SubmissionType>(
                value: _type,
                icon: const Icon(Icons.keyboard_arrow_down_rounded,
                    color: UltraTheme.textMuted),
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: UltraTheme.textPrimary),
                items: const [
                  DropdownMenuItem(
                      value: _SubmissionType.dsmo, child: Text('DSMO')),
                  DropdownMenuItem(
                      value: _SubmissionType.onefop, child: Text('ONEFOP')),
                ],
                onChanged: (v) {
                  if (v != null) setState(() => _type = v);
                },
              ),
            ),
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.download_rounded),
            onPressed: () => _openExportDialog(context),
            tooltip: 'Exporter',
          ),
        ]),
      ),
      Expanded(
        // IndexedStack (not a conditional child) so switching the dropdown
        // doesn't tear down and re-fetch the screen not currently shown.
        child: IndexedStack(
          index: _type.index,
          children: const [
            DeclarationsListScreen(),
            SubmissionsViewerScreen(),
          ],
        ),
      ),
    ]);
  }
}
