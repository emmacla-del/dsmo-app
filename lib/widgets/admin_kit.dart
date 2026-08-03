import 'package:flutter/material.dart';
import '../core/i18n/l10n_ext.dart';
import '../theme/ultra_theme.dart';

// ══════════════════════════════════════════════════════════════
// admin_kit — shared building blocks for admin list/roster screens
// (stat pills, refresh button, search field, toast, confirm sheet,
// role labelling). Extracted from the near-identical copies that
// had accumulated across pending_users_screen, active_users_screen
// and the ONEFOP pending-list screen.
// ══════════════════════════════════════════════════════════════

/// Staff roles a SUPER_ADMIN can assign — mirrors
/// AuthService.ASSIGNABLE_ROLES on the backend.
const kAssignableRoles = [
  'DIVISIONAL',
  'REGIONAL',
  'CENTRAL',
  'SUPER_ADMIN',
  'SUPER_ADMIN_DSMO',
  'SUPER_ADMIN_ONEFOP',
  'DATA_MANAGER',
  'CAMPAIGN_MANAGER',
  'ANALYST',
  'AUDITOR',
];

const _roleColors = <String, Color>{
  'REGIONAL': UltraTheme.info,
  'DIVISIONAL': UltraTheme.accent,
  'CENTRAL': UltraTheme.warning,
  'DATA_MANAGER': UltraTheme.info,
  'CAMPAIGN_MANAGER': UltraTheme.accent,
  'ANALYST': UltraTheme.info,
  'AUDITOR': UltraTheme.warning,
  'SUPER_ADMIN_DSMO': UltraTheme.success,
  'SUPER_ADMIN_ONEFOP': UltraTheme.primaryLight,
};

Color roleColor(String role) => _roleColors[role] ?? UltraTheme.primary;

const _roleLabels = <String, String>{
  'SUPER_ADMIN_DSMO': 'Admin DSMO',
  'SUPER_ADMIN_ONEFOP': 'Admin ONEFOP',
};

String roleLabel(String role) => _roleLabels[role] ?? role.replaceAll('_', ' ');

/// Compact inline stat pill: "0  Total"
class StatPill extends StatelessWidget {
  const StatPill(
      {super.key, required this.value, required this.label, required this.color});
  final int value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text('$value',
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: color)),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: color.withValues(alpha: 0.75))),
      ]),
    );
  }
}

/// Circular refresh button — subtle, for stat strips and toolbars.
class AdminRefreshButton extends StatelessWidget {
  const AdminRefreshButton({super.key, required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: UltraTheme.surface,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.refresh_rounded,
              size: 18, color: UltraTheme.textSecondary),
        ),
      ),
    );
  }
}

/// Search field with prefix icon + clear button — consistent look
/// across admin list screens.
class AdminSearchField extends StatelessWidget {
  const AdminSearchField({
    super.key,
    required this.controller,
    required this.onChanged,
    this.hintText = 'Rechercher...',
  });
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      style: const TextStyle(fontFamily: 'Inter', fontSize: 14),
      decoration: InputDecoration(
        hintText: hintText,
        hintStyle: const TextStyle(
            fontFamily: 'Inter', fontSize: 14, color: UltraTheme.textMuted),
        prefixIcon:
            const Icon(Icons.search_rounded, size: 20, color: UltraTheme.textMuted),
        suffixIcon: controller.text.isNotEmpty
            ? IconButton(
                icon: const Icon(Icons.close_rounded,
                    size: 18, color: UltraTheme.textMuted),
                onPressed: () {
                  controller.clear();
                  onChanged('');
                },
              )
            : null,
        filled: true,
        fillColor: UltraTheme.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.15)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.15)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: UltraTheme.primary, width: 1.5),
        ),
      ),
    );
  }
}

/// Floating snackbar with an icon — used for action feedback
/// (approve/reject/suspend/etc.) across admin screens.
void showAdminToast(BuildContext context, String message, Color color, IconData icon) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Row(children: [
      Icon(icon, color: color, size: 20),
      const SizedBox(width: 10),
      Expanded(
          child: Text(message,
              style:
                  const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w500))),
    ]),
    backgroundColor: const Color(0xFF1E293B),
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    margin: const EdgeInsets.all(16),
  ));
}

/// Bottom-sheet confirmation dialog (icon + title + body + two
/// buttons). Used before destructive/irreversible admin actions.
Future<bool?> showAdminConfirmSheet(
  BuildContext context, {
  required IconData icon,
  required Color iconColor,
  required String title,
  required String body,
  required String confirmLabel,
  required Color confirmColor,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Container(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      decoration: const BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 40,
          height: 4,
          margin: const EdgeInsets.only(bottom: 24),
          decoration: BoxDecoration(
            color: UltraTheme.textMuted.withValues(alpha: 0.25),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Icon(icon, color: iconColor, size: 32),
        ),
        const SizedBox(height: 16),
        Text(title, style: UltraTheme.displayMedium.copyWith(fontSize: 20)),
        const SizedBox(height: 8),
        Text(body, textAlign: TextAlign.center, style: UltraTheme.bodyMedium),
        const SizedBox(height: 24),
        Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: () => Navigator.pop(ctx, false),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.3)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(ctx.l10n.cancelButton,
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w600,
                      color: UltraTheme.textMuted)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: confirmColor,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(confirmLabel,
                  style:
                      const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w600)),
            ),
          ),
        ]),
      ]),
    ),
  );
}
