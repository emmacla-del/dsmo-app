import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/i18n/l10n_ext.dart';
import '../../data/api_client.dart';
import '../../theme/ultra_theme.dart';
import '../../widgets/admin_kit.dart';
import 'regions_sectors_screen.dart';

// ══════════════════════════════════════════════════════════════
// SystemSettingsScreen — SUPER_ADMIN-only platform configuration.
// Backed by the singleton SystemSettings row (src/system-settings).
// Every field here is actually enforced server-side, not cosmetic:
//   - passwordMinLength gates every password change/reset in AuthService
//   - require2FAForStaff blocks staff (non-COMPANY) accounts from
//     disabling their own 2FA
//   - maintenanceMode blocks every RolesGuard-protected route for
//     everyone except SUPER_ADMIN (see roles.guard.ts)
// ══════════════════════════════════════════════════════════════

class SystemSettingsScreen extends ConsumerStatefulWidget {
  const SystemSettingsScreen({super.key});

  @override
  ConsumerState<SystemSettingsScreen> createState() => _SystemSettingsScreenState();
}

class _SystemSettingsScreenState extends ConsumerState<SystemSettingsScreen> {
  bool _loading = true;
  bool _saving = false;
  String? _error;

  int _passwordMinLength = 8;
  bool _require2FAForStaff = false;
  bool _maintenanceMode = false;
  final _maintenanceMessageCtrl = TextEditingController();
  DateTime? _updatedAt;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _maintenanceMessageCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final settings = await api.getSystemSettings();
      if (!mounted) return;
      setState(() {
        _passwordMinLength = (settings['passwordMinLength'] as num?)?.toInt() ?? 8;
        _require2FAForStaff = settings['require2FAForStaff'] as bool? ?? false;
        _maintenanceMode = settings['maintenanceMode'] as bool? ?? false;
        _maintenanceMessageCtrl.text = settings['maintenanceMessage'] as String? ?? '';
        final updatedAt = settings['updatedAt'] as String?;
        _updatedAt = updatedAt != null ? DateTime.tryParse(updatedAt) : null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final settings = await api.updateSystemSettings(
        passwordMinLength: _passwordMinLength,
        require2FAForStaff: _require2FAForStaff,
        maintenanceMode: _maintenanceMode,
        maintenanceMessage: _maintenanceMessageCtrl.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        final updatedAt = settings['updatedAt'] as String?;
        _updatedAt = updatedAt != null ? DateTime.tryParse(updatedAt) : null;
      });
      if (!mounted) return;
      showAdminToast(context, context.l10n.settingsSavedToast, UltraTheme.success,
          Icons.check_circle_outline_rounded);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
      showAdminToast(context, context.l10n.landingConfigSaveFailedToast('$e'), UltraTheme.error,
          Icons.error_outline_rounded);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(20),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 560),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(context.l10n.systemSettingsScreenTitle,
                            style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                color: UltraTheme.textPrimary)),
                        const SizedBox(height: 6),
                        Text(
                          context.l10n.systemSettingsScreenSubtitle,
                          style: const TextStyle(
                              fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted),
                        ),
                        if (_updatedAt != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            context.l10n.landingConfigLastModifiedLabel(_formatDate(_updatedAt!)),
                            style: const TextStyle(
                                fontFamily: 'Inter', fontSize: 12, color: UltraTheme.textMuted),
                          ),
                        ],
                        const SizedBox(height: 20),
                        if (_error != null)
                          Container(
                            width: double.infinity,
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: UltraTheme.error.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(_error!,
                                style: const TextStyle(color: UltraTheme.error, fontSize: 13)),
                          ),
                        _SettingsSection(
                          title: context.l10n.securityPolicySectionTitle,
                          icon: Icons.shield_outlined,
                          children: [
                            _StepperField(
                              label: context.l10n.passwordMinLengthLabel,
                              value: _passwordMinLength,
                              min: 6,
                              max: 32,
                              onChanged: (v) => setState(() => _passwordMinLength = v),
                            ),
                            const SizedBox(height: 4),
                            _SwitchTile(
                              label: context.l10n.require2faStaffLabel,
                              subtitle: context.l10n.require2faStaffSubtitle,
                              value: _require2FAForStaff,
                              onChanged: (v) => setState(() => _require2FAForStaff = v),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _SettingsSection(
                          title: context.l10n.maintenanceModeSectionTitle,
                          icon: Icons.build_circle_outlined,
                          children: [
                            _SwitchTile(
                              label: context.l10n.enableMaintenanceModeLabel,
                              subtitle: context.l10n.maintenanceModeSubtitle,
                              value: _maintenanceMode,
                              onChanged: (v) => setState(() => _maintenanceMode = v),
                              activeColor: UltraTheme.warning,
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _maintenanceMessageCtrl,
                              maxLines: 3,
                              decoration: InputDecoration(
                                labelText: context.l10n.maintenanceMessageFieldLabel,
                                hintText: context.l10n.maintenanceMessageFieldHint,
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                filled: true,
                                fillColor: UltraTheme.background,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _SettingsSection(
                          title: context.l10n.referenceDataSectionTitle,
                          icon: Icons.map_outlined,
                          children: [
                            Text(
                              context.l10n.referenceDataSectionDescription,
                              style: const TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 12.5,
                                  color: UltraTheme.textMuted,
                                  height: 1.4),
                            ),
                            const SizedBox(height: 12),
                            OutlinedButton.icon(
                              onPressed: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                    builder: (_) => const RegionsSectorsScreen()),
                              ),
                              icon: const Icon(Icons.tune_rounded, size: 18),
                              label: Text(context.l10n.manageRegionsSectorsButton),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: UltraTheme.primary,
                                side: const BorderSide(color: UltraTheme.primary),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 12),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: ElevatedButton(
                            onPressed: _saving ? null : _save,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: UltraTheme.primary,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10)),
                            ),
                            child: _saving
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Colors.white),
                                  )
                                : Text(context.l10n.settingsSaveButton,
                                    style: const TextStyle(
                                        fontFamily: 'Inter', fontWeight: FontWeight.w600)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
      ),
    );
  }

  String _formatDate(DateTime d) {
    final local = d.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(local.day)}/${two(local.month)}/${local.year} à ${two(local.hour)}:${two(local.minute)}';
  }
}

class _SettingsSection extends StatelessWidget {
  const _SettingsSection({required this.title, required this.icon, required this.children});

  final String title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 18, color: UltraTheme.primary),
            const SizedBox(width: 8),
            Text(title,
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: UltraTheme.textPrimary)),
          ]),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }
}

class _SwitchTile extends StatelessWidget {
  const _SwitchTile({
    required this.label,
    required this.value,
    required this.onChanged,
    this.subtitle,
    this.activeColor,
  });

  final String label;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  final Color? activeColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: UltraTheme.textPrimary)),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(subtitle!,
                    style: const TextStyle(
                        fontFamily: 'Inter', fontSize: 12, color: UltraTheme.textMuted)),
              ],
            ],
          ),
        ),
        Switch(
          value: value,
          onChanged: onChanged,
          activeThumbColor: activeColor ?? UltraTheme.primary,
        ),
      ],
    );
  }
}

class _StepperField extends StatelessWidget {
  const _StepperField({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
  });

  final String label;
  final int value;
  final int min;
  final int max;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(label,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: UltraTheme.textPrimary)),
        ),
        IconButton(
          icon: const Icon(Icons.remove_circle_outline, size: 20),
          color: UltraTheme.textMuted,
          onPressed: value > min ? () => onChanged(value - 1) : null,
        ),
        SizedBox(
          width: 28,
          child: Text('$value',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 14)),
        ),
        IconButton(
          icon: const Icon(Icons.add_circle_outline, size: 20),
          color: UltraTheme.textMuted,
          onPressed: value < max ? () => onChanged(value + 1) : null,
        ),
      ],
    );
  }
}
