// lib/widgets/drafts_drawer.dart
// ─────────────────────────────────────────────────────────────
// Shared slide-out panel for viewing/saving/discarding a saved
// declaration draft. Used by both the DSMO and ONEFOP wizards —
// each screen supplies its own fetch/save/delete callbacks so this
// widget stays decoupled from either screen's state shape.
// ─────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';

/// One saved draft, as shown in [DraftsDrawer].
class DraftSummary {
  /// Opaque identifier passed back to [DraftsDrawer.onDelete] — e.g. a
  /// quarter code for ONEFOP, or a fixed sentinel for DSMO's single slot.
  final String key;
  final String label;
  final DateTime updatedAt;

  const DraftSummary({
    required this.key,
    required this.label,
    required this.updatedAt,
  });
}

class DraftsDrawer extends StatefulWidget {
  final String title;
  final Future<List<DraftSummary>> Function() fetchDrafts;
  final Future<void> Function() onSaveNow;
  final Future<void> Function(DraftSummary draft) onDelete;

  const DraftsDrawer({
    super.key,
    required this.title,
    required this.fetchDrafts,
    required this.onSaveNow,
    required this.onDelete,
  });

  @override
  State<DraftsDrawer> createState() => _DraftsDrawerState();
}

class _DraftsDrawerState extends State<DraftsDrawer> {
  late Future<List<DraftSummary>> _draftsFuture;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _draftsFuture = widget.fetchDrafts();
  }

  void _refresh() {
    setState(() => _draftsFuture = widget.fetchDrafts());
  }

  Future<void> _saveNow() async {
    setState(() => _busy = true);
    try {
      await widget.onSaveNow();
      _refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Brouillon enregistré / Draft saved')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmDelete(DraftSummary draft) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer le brouillon ? / Discard draft?'),
        content: Text(draft.label),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler / Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Supprimer / Discard'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);
    try {
      await widget.onDelete(draft);
      _refresh();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  static String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return "à l'instant / just now";
    if (diff.inMinutes < 60) return 'il y a ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'il y a ${diff.inHours} h';
    return 'il y a ${diff.inDays} j';
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: AppColors.background,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.divider),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _busy ? null : _saveNow,
                  icon: const Icon(Icons.save_outlined, size: 18),
                  label: const Text('Sauvegarder maintenant / Save now'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ),
            Expanded(
              child: FutureBuilder<List<DraftSummary>>(
                future: _draftsFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return const Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'Impossible de charger les brouillons / Failed to load drafts',
                        style: TextStyle(color: AppColors.danger),
                        textAlign: TextAlign.center,
                      ),
                    );
                  }
                  final drafts = snapshot.data ?? const [];
                  if (drafts.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.drafts_outlined,
                              size: 40, color: AppColors.textMuted),
                          SizedBox(height: 12),
                          Text(
                            'Aucun brouillon enregistré / No saved draft',
                            style: TextStyle(color: AppColors.textSecondary),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: drafts.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final draft = drafts[i];
                      return Card(
                        elevation: 0,
                        color: AppColors.cardBg,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                          side: const BorderSide(color: AppColors.divider),
                        ),
                        child: ListTile(
                          leading:
                              const Icon(Icons.description_outlined, color: AppColors.primary),
                          title: Text(draft.label,
                              style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(_relativeTime(draft.updatedAt)),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline,
                                color: AppColors.danger),
                            onPressed: _busy ? null : () => _confirmDelete(draft),
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
