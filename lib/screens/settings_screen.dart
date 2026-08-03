// lib/screens/settings/settings_screen.dart
// ═══════════════════════════════════════════════════════════════
// ParametresScreen — Company settings, built on UltraTheme.
//
// Tabs: General · Notifications · Securite · Integrations
// Replaces the Placeholder() in the COMPANY tab of HomeScreen.
// ═══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/ultra_theme.dart';
import '../core/i18n/l10n_ext.dart';
import '../providers/auth_provider.dart';
import '../providers/locale_provider.dart';
import '../providers/providers.dart';
import '../main.dart';

// ═══════════════════════════════════════════════════════════════
// ParametresScreen
// ═══════════════════════════════════════════════════════════════

class ParametresScreen extends ConsumerStatefulWidget {
  const ParametresScreen({super.key});

  @override
  ConsumerState<ParametresScreen> createState() => _ParametresScreenState();
}

class _ParametresScreenState extends ConsumerState<ParametresScreen>
    with SingleTickerProviderStateMixin {
  int _selectedTab = 0;

  // ── Controllers ─────────────────────────────────────────────
  final _companyNameCtrl = TextEditingController(text: 'DSMO Intelligence');
  final _emailCtrl = TextEditingController(text: 'contact@dsmo.fr');
  final _siretCtrl = TextEditingController(text: '123 456 789 00012');
  final _phoneCtrl = TextEditingController(text: '+33 1 23 45 67 89');
  final _addressCtrl =
      TextEditingController(text: '12 Rue de la Paix, 75002 Paris');
  final _currentPassCtrl = TextEditingController();
  final _newPassCtrl = TextEditingController();

  // ── Toggle state ─────────────────────────────────────────────
  // Values themselves come from authProvider's User (the source of
  // truth) — this just tracks which toggle has an in-flight request so
  // its Switch can be disabled and reverted on failure.
  final Set<String> _savingPrefs = {};

  Future<void> _updatePreference(
    String key,
    Future<void> Function() action,
  ) async {
    if (_savingPrefs.contains(key)) return;
    setState(() => _savingPrefs.add(key));
    try {
      await action();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(
                  context.l10n.settingsUpdatePreferenceError('$e'))),
        );
      }
    } finally {
      if (mounted) setState(() => _savingPrefs.remove(key));
    }
  }

  // ── Tab definitions ──────────────────────────────────────────
  List<({String label, IconData icon})> get _tabs => [
        (label: context.l10n.settingsTabGeneral, icon: Icons.tune_outlined),
        (
          label: context.l10n.settingsTabNotifications,
          icon: Icons.notifications_outlined
        ),
        (label: context.l10n.settingsTabSecurity, icon: Icons.shield_outlined),
        (
          label: context.l10n.settingsTabIntegrations,
          icon: Icons.electrical_services_outlined
        ),
      ];

  @override
  void dispose() {
    _companyNameCtrl.dispose();
    _emailCtrl.dispose();
    _siretCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _currentPassCtrl.dispose();
    _newPassCtrl.dispose();
    super.dispose();
  }

  // ═══════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Container(
      color: UltraTheme.background,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 900),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildPageHeader(),
                const SizedBox(height: 24),
                _buildTabBar(),
                const SizedBox(height: 24),
                AnimatedSwitcher(
                  duration: UltraTheme.normal,
                  transitionBuilder: (child, anim) => FadeTransition(
                    opacity: anim,
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0.02, 0),
                        end: Offset.zero,
                      ).animate(CurvedAnimation(
                          parent: anim, curve: Curves.easeOutCubic)),
                      child: child,
                    ),
                  ),
                  child: KeyedSubtree(
                    key: ValueKey(_selectedTab),
                    child: _buildTabContent(),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PAGE HEADER
  // ═══════════════════════════════════════════════════════════

  Widget _buildPageHeader() {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: UltraTheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
          ),
          child: const Icon(Icons.settings_outlined,
              color: UltraTheme.primary, size: 22),
        ),
        const SizedBox(width: 14),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(context.l10n.settingsPageTitle,
                style: UltraTheme.displayMedium.copyWith(fontSize: 22)),
            const SizedBox(height: 2),
            Text(context.l10n.settingsPageSubtitle,
                style: UltraTheme.bodyMedium),
          ],
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TAB BAR
  // ═══════════════════════════════════════════════════════════

  Widget _buildTabBar() {
    return Container(
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        boxShadow: UltraTheme.softShadow,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(_tabs.length, (i) {
          final isActive = i == _selectedTab;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: AnimatedContainer(
              duration: UltraTheme.normal,
              decoration: BoxDecoration(
                color: isActive ? UltraTheme.primary : Colors.transparent,
                borderRadius:
                    BorderRadius.circular(UltraTheme.radiusMedium - 2),
                boxShadow: isActive
                    ? [
                        BoxShadow(
                          color: UltraTheme.primary.withValues(alpha: 0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        )
                      ]
                    : null,
              ),
              child: Material(
                color: Colors.transparent,
                borderRadius:
                    BorderRadius.circular(UltraTheme.radiusMedium - 2),
                child: InkWell(
                  borderRadius:
                      BorderRadius.circular(UltraTheme.radiusMedium - 2),
                  onTap: () => setState(() => _selectedTab = i),
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _tabs[i].icon,
                          size: 15,
                          color: isActive ? Colors.white : UltraTheme.textMuted,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _tabs[i].label,
                          style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: isActive
                                ? Colors.white
                                : UltraTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TAB CONTENT ROUTER
  // ═══════════════════════════════════════════════════════════

  Widget _buildTabContent() {
    switch (_selectedTab) {
      case 0:
        return _buildGeneralTab();
      case 1:
        return _buildNotificationsTab();
      case 2:
        return _buildSecurityTab();
      default:
        return _buildIntegrationsTab();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TAB 0 — GENERAL
  // ═══════════════════════════════════════════════════════════

  Widget _buildGeneralTab() {
    final l10n = context.l10n;
    return Column(
      children: [
        _SettingsCard(
          icon: Icons.business_outlined,
          title: l10n.settingsGeneralCardTitle,
          subtitle: l10n.settingsGeneralCardSubtitle,
          child: Column(
            children: [
              _buildFormRow([
                _buildField(l10n.settingsFieldEstablishmentName, _companyNameCtrl),
                _buildField(l10n.settingsFieldContactEmail, _emailCtrl,
                    type: TextInputType.emailAddress,
                    prefix: Icons.mail_outline),
              ]),
              const SizedBox(height: 20),
              _buildFormRow([
                _buildField(l10n.settingsFieldSiret, _siretCtrl),
                _buildField(l10n.settingsFieldPhone, _phoneCtrl,
                    type: TextInputType.phone, prefix: Icons.phone_outlined),
              ]),
              const SizedBox(height: 20),
              _buildField(l10n.settingsFieldAddress, _addressCtrl,
                  prefix: Icons.location_on_outlined),
              const SizedBox(height: 28),
              _buildFormActions(),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _SettingsCard(
          icon: Icons.language_outlined,
          title: context.l10n.languageSettingTitle,
          subtitle: context.l10n.languageSettingSubtitle,
          child: _buildLanguageSelector(),
        ),
        const SizedBox(height: 20),
        _buildDangerZone(),
      ],
    );
  }

  Widget _buildLanguageSelector() {
    final current = ref.watch(localeProvider);
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: UltraTheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
          ),
          child: const Icon(Icons.translate,
              size: 18, color: UltraTheme.primary),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Text(context.l10n.languageSettingTitle,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: UltraTheme.textPrimary)),
        ),
        const SizedBox(width: 12),
        SegmentedButton<Locale>(
          segments: [
            ButtonSegment(
              value: const Locale('fr'),
              label: Text(context.l10n.languageFrench),
            ),
            ButtonSegment(
              value: const Locale('en'),
              label: Text(context.l10n.languageEnglish),
            ),
          ],
          selected: {current},
          onSelectionChanged: (selected) =>
              ref.read(localeProvider.notifier).setLocale(selected.first),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TAB 1 — NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════

  Widget _buildNotificationsTab() {
    final l10n = context.l10n;
    final user = ref.watch(authProvider).value;
    return _SettingsCard(
      icon: Icons.notifications_outlined,
      title: l10n.settingsNotificationsCardTitle,
      subtitle: l10n.settingsNotificationsCardSubtitle,
      child: Column(
        children: [
          _buildToggle(
            icon: Icons.email_outlined,
            title: l10n.settingsToggleEmailTitle,
            subtitle: l10n.settingsToggleEmailSubtitle,
            value: user?.emailNotificationsEnabled ?? true,
            enabled: !_savingPrefs.contains('email'),
            onChanged: (v) => _updatePreference(
              'email',
              () => ref
                  .read(authProvider.notifier)
                  .updateNotificationPreferences(emailNotificationsEnabled: v),
            ),
          ),
          _buildToggle(
            icon: Icons.notifications_active_outlined,
            title: l10n.settingsToggleRealtimeTitle,
            subtitle: l10n.settingsToggleRealtimeSubtitle,
            value: user?.pushNotificationsEnabled ?? true,
            enabled: !_savingPrefs.contains('push'),
            onChanged: (v) => _updatePreference(
              'push',
              () => ref
                  .read(authProvider.notifier)
                  .updateNotificationPreferences(pushNotificationsEnabled: v),
            ),
          ),
          _buildToggle(
            icon: Icons.summarize_outlined,
            title: l10n.settingsToggleWeeklyTitle,
            subtitle: l10n.settingsToggleWeeklySubtitle,
            value: user?.weeklyDigestEnabled ?? false,
            enabled: !_savingPrefs.contains('weekly'),
            onChanged: (v) => _updatePreference(
              'weekly',
              () => ref
                  .read(authProvider.notifier)
                  .updateNotificationPreferences(weeklyDigestEnabled: v),
            ),
          ),
          _buildToggle(
            icon: Icons.sms_outlined,
            title: l10n.settingsToggleSmsTitle,
            subtitle: l10n.settingsToggleSmsSubtitle,
            value: user?.smsNotificationsEnabled ?? false,
            enabled: !_savingPrefs.contains('sms'),
            onChanged: (v) => _updatePreference(
              'sms',
              () => ref
                  .read(authProvider.notifier)
                  .updateNotificationPreferences(smsNotificationsEnabled: v),
            ),
            isLast: true,
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TAB 2 — SECURITE
  // ═══════════════════════════════════════════════════════════

  Widget _buildSecurityTab() {
    final l10n = context.l10n;
    final user = ref.watch(authProvider).value;
    return _SettingsCard(
      icon: Icons.shield_outlined,
      title: l10n.settingsSecurityCardTitle,
      subtitle: l10n.settingsSecurityCardSubtitle,
      child: Column(
        children: [
          _buildFormRow([
            _buildField(l10n.settingsFieldCurrentPassword, _currentPassCtrl,
                obscure: true, prefix: Icons.lock_outline),
            _buildField(l10n.settingsFieldNewPassword, _newPassCtrl,
                obscure: true,
                hint: l10n.settingsPasswordHint,
                prefix: Icons.lock_reset_outlined),
          ]),
          const SizedBox(height: 20),
          _buildToggle(
            icon: Icons.verified_user_outlined,
            title: l10n.settingsToggle2faTitle,
            subtitle: l10n.settingsToggle2faSubtitle,
            value: user?.twoFactorEnabled ?? false,
            enabled: !_savingPrefs.contains('twoFactor'),
            onChanged: (v) => _updatePreference(
              'twoFactor',
              () => ref.read(authProvider.notifier).setTwoFactorEnabled(v),
            ),
            isLast: true,
          ),
          const SizedBox(height: 8),
          _buildSecurityInfo(),
          const SizedBox(height: 28),
          _buildFormActions(),
        ],
      ),
    );
  }

  Widget _buildSecurityInfo() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: UltraTheme.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        border: Border.all(color: UltraTheme.primary.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline,
              size: 16, color: UltraTheme.primary.withValues(alpha: 0.8)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              context.l10n.settingsPasswordRequirements,
              style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  color: UltraTheme.primary,
                  fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TAB 3 — INTEGRATIONS
  // ═══════════════════════════════════════════════════════════

  Widget _buildIntegrationsTab() {
    final l10n = context.l10n;
    return _SettingsCard(
      icon: Icons.electrical_services_outlined,
      title: l10n.settingsTabIntegrations,
      subtitle: l10n.settingsIntegrationsCardSubtitle,
      child: Column(
        children: [
          _buildIntegration(
            name: 'Slack',
            desc: l10n.settingsIntegrationSlackDesc,
            icon: Icons.chat_bubble_outline,
            color: const Color(0xFF4A154B),
            connected: false,
          ),
          _buildIntegration(
            name: 'Microsoft Teams',
            desc: l10n.settingsIntegrationTeamsDesc,
            icon: Icons.groups_outlined,
            color: const Color(0xFF6264A7),
            connected: false,
          ),
          _buildIntegration(
            name: 'Google Calendar',
            desc: l10n.settingsIntegrationCalendarDesc,
            icon: Icons.calendar_month_outlined,
            color: const Color(0xFF4285F4),
            connected: true,
          ),
          _buildIntegration(
            name: 'API Webhook',
            desc: l10n.settingsIntegrationWebhookDesc,
            icon: Icons.webhook_outlined,
            color: UltraTheme.accent,
            connected: false,
            isLast: true,
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // DANGER ZONE
  // ═══════════════════════════════════════════════════════════

  Widget _buildDangerZone() {
    final l10n = context.l10n;
    return Container(
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        border: Border.all(color: UltraTheme.error.withValues(alpha: 0.25)),
        boxShadow: UltraTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
            decoration: BoxDecoration(
              color: UltraTheme.error.withValues(alpha: 0.06),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(UltraTheme.radiusLarge),
                topRight: Radius.circular(UltraTheme.radiusLarge),
              ),
              border: Border(
                  bottom: BorderSide(
                      color: UltraTheme.error.withValues(alpha: 0.15))),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: UltraTheme.error.withValues(alpha: 0.12),
                    borderRadius:
                        BorderRadius.circular(UltraTheme.radiusMedium),
                  ),
                  child: const Icon(Icons.warning_amber_rounded,
                      color: UltraTheme.error, size: 18),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.settingsDangerZoneTitle,
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: UltraTheme.error)),
                    const SizedBox(height: 1),
                    Text(l10n.settingsDangerZoneSubtitle,
                        style: UltraTheme.bodyMedium),
                  ],
                ),
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.settingsDeleteAccountTitle,
                          style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: UltraTheme.textPrimary)),
                      const SizedBox(height: 4),
                      Text(
                          l10n.settingsDeleteAccountDesc,
                          style: UltraTheme.bodyMedium),
                    ],
                  ),
                ),
                const SizedBox(width: 20),
                OutlinedButton.icon(
                  onPressed: () => _confirmDelete(context),
                  icon: const Icon(Icons.delete_outline, size: 16),
                  label: Text(l10n.settingsDeleteButton),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: UltraTheme.error,
                    side: BorderSide(
                        color: UltraTheme.error.withValues(alpha: 0.4)),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 18, vertical: 11),
                    shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(UltraTheme.radiusMedium)),
                    textStyle: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.4),
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(UltraTheme.radiusXL)),
        backgroundColor: UltraTheme.surface,
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: UltraTheme.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
                ),
                child: const Icon(Icons.delete_forever_outlined,
                    color: UltraTheme.error, size: 28),
              ),
              const SizedBox(height: 20),
              Text(ctx.l10n.settingsConfirmDeleteTitle,
                  style: UltraTheme.displayMedium.copyWith(fontSize: 20)),
              const SizedBox(height: 8),
              Text(
                ctx.l10n.settingsConfirmDeleteBody,
                textAlign: TextAlign.center,
                style: UltraTheme.bodyMedium,
              ),
              const SizedBox(height: 28),
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(UltraTheme.radiusMedium)),
                    ),
                    child: Text(ctx.l10n.cancelButton,
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: UltraTheme.error,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(UltraTheme.radiusMedium)),
                    ),
                    child: Text(ctx.l10n.settingsDeleteButton,
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            fontWeight: FontWeight.w600)),
                  ),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
    if (confirm != true) return;
    try {
      await ref.read(apiClientProvider).deleteMyAccount();
      if (!context.mounted) return;
      await ref.read(authProvider.notifier).logout();
      if (!context.mounted) return;
      router.go('/login');
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(context.l10n.settingsDeleteAccountError('$e'))),
        );
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SHARED WIDGETS
  // ═══════════════════════════════════════════════════════════

  Widget _buildFormRow(List<Widget> fields) {
    return LayoutBuilder(builder: (ctx, constraints) {
      if (constraints.maxWidth > 580) {
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: fields.asMap().entries.map((e) {
            return Expanded(
              child: Padding(
                padding:
                    EdgeInsets.only(right: e.key < fields.length - 1 ? 16 : 0),
                child: e.value,
              ),
            );
          }).toList(),
        );
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: fields.asMap().entries.map((e) {
          return Padding(
            padding:
                EdgeInsets.only(bottom: e.key < fields.length - 1 ? 16 : 0),
            child: e.value,
          );
        }).toList(),
      );
    });
  }

  Widget _buildField(
    String label,
    TextEditingController controller, {
    TextInputType? type,
    bool obscure = false,
    String? hint,
    IconData? prefix,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textSecondary)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: type,
          obscureText: obscure,
          style: const TextStyle(
              fontFamily: 'Inter', fontSize: 14, color: UltraTheme.textPrimary),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(
                fontFamily: 'Inter', fontSize: 14, color: UltraTheme.textMuted),
            prefixIcon: prefix != null
                ? Icon(prefix, size: 18, color: UltraTheme.textMuted)
                : null,
            filled: true,
            fillColor: UltraTheme.background,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
              borderSide: BorderSide(
                  color: UltraTheme.textMuted.withValues(alpha: 0.2)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
              borderSide: BorderSide(
                  color: UltraTheme.textMuted.withValues(alpha: 0.2)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
              borderSide:
                  const BorderSide(color: UltraTheme.primary, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildToggle({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
    bool isLast = false,
    bool enabled = true,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: isLast
          ? null
          : BoxDecoration(
              border: Border(
                  bottom: BorderSide(
                      color: UltraTheme.textMuted.withValues(alpha: 0.12)))),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: value
                  ? UltraTheme.primary.withValues(alpha: 0.1)
                  : UltraTheme.background,
              borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            ),
            child: Icon(icon,
                size: 18,
                color: value ? UltraTheme.primary : UltraTheme.textMuted),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.textPrimary)),
                const SizedBox(height: 2),
                Text(subtitle, style: UltraTheme.bodyMedium),
              ],
            ),
          ),
          const SizedBox(width: 12),
          if (!enabled)
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Switch(
              value: value,
              onChanged: onChanged,
              activeThumbColor: Colors.white,
              activeTrackColor: UltraTheme.primary,
              inactiveThumbColor: Colors.white,
              inactiveTrackColor: UltraTheme.textMuted.withValues(alpha: 0.25),
            ),
        ],
      ),
    );
  }

  Widget _buildIntegration({
    required String name,
    required String desc,
    required IconData icon,
    required Color color,
    required bool connected,
    bool isLast = false,
  }) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: isLast
          ? null
          : BoxDecoration(
              border: Border(
                  bottom: BorderSide(
                      color: UltraTheme.textMuted.withValues(alpha: 0.12)))),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.textPrimary)),
                const SizedBox(height: 2),
                Text(desc, style: UltraTheme.bodyMedium),
              ],
            ),
          ),
          const SizedBox(width: 12),
          if (connected)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: UltraTheme.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                    color: UltraTheme.success.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.circle,
                      size: 7,
                      color: UltraTheme.success.withValues(alpha: 0.9)),
                  const SizedBox(width: 5),
                  Text(l10n.settingsConnectedBadge,
                      style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: UltraTheme.success)),
                ],
              ),
            )
          else
            OutlinedButton(
              onPressed: () {},
              style: OutlinedButton.styleFrom(
                foregroundColor: UltraTheme.textSecondary,
                side: BorderSide(
                    color: UltraTheme.textMuted.withValues(alpha: 0.3)),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(UltraTheme.radiusMedium)),
                textStyle: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    fontWeight: FontWeight.w500),
              ),
              child: Text(l10n.settingsConnectButton),
            ),
        ],
      ),
    );
  }

  Widget _buildFormActions() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        OutlinedButton(
          onPressed: () {},
          style: OutlinedButton.styleFrom(
            foregroundColor: UltraTheme.textSecondary,
            side:
                BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.3)),
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(UltraTheme.radiusMedium)),
            textStyle: const TextStyle(
                fontFamily: 'Inter', fontSize: 14, fontWeight: FontWeight.w600),
          ),
          child: Text(context.l10n.cancelButton),
        ),
        const SizedBox(width: 12),
        ElevatedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.check_rounded, size: 17),
          label: Text(context.l10n.settingsSaveButton),
          style: ElevatedButton.styleFrom(
            backgroundColor: UltraTheme.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
            elevation: 0,
            shadowColor: UltraTheme.primary.withValues(alpha: 0.35),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(UltraTheme.radiusMedium)),
            textStyle: const TextStyle(
                fontFamily: 'Inter', fontSize: 14, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// _SettingsCard — reusable card matching UltraTheme surface style
// ═══════════════════════════════════════════════════════════════

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        boxShadow: UltraTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Card header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
            decoration: BoxDecoration(
              border: Border(
                  bottom: BorderSide(
                      color: UltraTheme.textMuted.withValues(alpha: 0.12))),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: UltraTheme.primary.withValues(alpha: 0.1),
                    borderRadius:
                        BorderRadius.circular(UltraTheme.radiusMedium),
                  ),
                  child: Icon(icon, color: UltraTheme.primary, size: 18),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: UltraTheme.textPrimary)),
                    const SizedBox(height: 1),
                    Text(subtitle, style: UltraTheme.bodyMedium),
                  ],
                ),
              ],
            ),
          ),
          // Card body
          Padding(
            padding: const EdgeInsets.all(24),
            child: child,
          ),
        ],
      ),
    );
  }
}
