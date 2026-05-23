// lib/screens/settings/settings_screen.dart
// ═══════════════════════════════════════════════════════════════
// ParametresScreen — Company settings, built on UltraTheme.
//
// Tabs: General · Notifications · Securite · Integrations
// Replaces the Placeholder() in the COMPANY tab of HomeScreen.
// ═══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../theme/ultra_theme.dart';

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
  bool _emailNotif = true;
  bool _pushNotif = true;
  bool _weeklyReport = false;
  bool _smsNotif = false;
  bool _twoFactor = false;

  // ── Tab definitions ──────────────────────────────────────────
  static const _tabs = [
    (label: 'General', icon: Icons.tune_outlined),
    (label: 'Notifications', icon: Icons.notifications_outlined),
    (label: 'Securite', icon: Icons.shield_outlined),
    (label: 'Integrations', icon: Icons.electrical_services_outlined),
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
            Text('Parametres',
                style: UltraTheme.displayMedium.copyWith(fontSize: 22)),
            const SizedBox(height: 2),
            Text('Configurez votre etablissement et votre compte',
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
                          style: GoogleFonts.inter(
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
    return Column(
      children: [
        _SettingsCard(
          icon: Icons.business_outlined,
          title: 'Informations generales',
          subtitle: "Mettez a jour les informations de votre etablissement",
          child: Column(
            children: [
              _buildFormRow([
                _buildField("Nom de l'etablissement", _companyNameCtrl),
                _buildField('Email de contact', _emailCtrl,
                    type: TextInputType.emailAddress,
                    prefix: Icons.mail_outline),
              ]),
              const SizedBox(height: 20),
              _buildFormRow([
                _buildField('Numero SIRET', _siretCtrl),
                _buildField('Telephone', _phoneCtrl,
                    type: TextInputType.phone, prefix: Icons.phone_outlined),
              ]),
              const SizedBox(height: 20),
              _buildField('Adresse complete', _addressCtrl,
                  prefix: Icons.location_on_outlined),
              const SizedBox(height: 28),
              _buildFormActions(),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _buildDangerZone(),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════
  // TAB 1 — NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════

  Widget _buildNotificationsTab() {
    return _SettingsCard(
      icon: Icons.notifications_outlined,
      title: 'Preferences de notification',
      subtitle: 'Choisissez comment vous souhaitez etre alerte',
      child: Column(
        children: [
          _buildToggle(
            icon: Icons.email_outlined,
            title: 'Notifications email',
            subtitle: 'Recevez un email pour chaque nouvelle declaration',
            value: _emailNotif,
            onChanged: (v) => setState(() => _emailNotif = v),
          ),
          _buildToggle(
            icon: Icons.notifications_active_outlined,
            title: 'Alertes en temps reel',
            subtitle: 'Notifications push dans le navigateur',
            value: _pushNotif,
            onChanged: (v) => setState(() => _pushNotif = v),
          ),
          _buildToggle(
            icon: Icons.summarize_outlined,
            title: 'Rapports hebdomadaires',
            subtitle: 'Recevez un recapitulatif chaque lundi matin',
            value: _weeklyReport,
            onChanged: (v) => setState(() => _weeklyReport = v),
          ),
          _buildToggle(
            icon: Icons.sms_outlined,
            title: 'Notifications SMS',
            subtitle: 'Alertes urgentes par message texte',
            value: _smsNotif,
            onChanged: (v) => setState(() => _smsNotif = v),
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
    return _SettingsCard(
      icon: Icons.shield_outlined,
      title: 'Securite du compte',
      subtitle: "Protegez l'acces a votre espace DSMO",
      child: Column(
        children: [
          _buildFormRow([
            _buildField('Mot de passe actuel', _currentPassCtrl,
                obscure: true, prefix: Icons.lock_outline),
            _buildField('Nouveau mot de passe', _newPassCtrl,
                obscure: true,
                hint: 'Min. 8 caracteres',
                prefix: Icons.lock_reset_outlined),
          ]),
          const SizedBox(height: 20),
          _buildToggle(
            icon: Icons.verified_user_outlined,
            title: 'Authentification a deux facteurs (2FA)',
            subtitle: 'Exiger un code de verification a chaque connexion',
            value: _twoFactor,
            onChanged: (v) => setState(() => _twoFactor = v),
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
              'Votre mot de passe doit contenir au moins 8 caracteres, '
              'une majuscule et un chiffre.',
              style: GoogleFonts.inter(
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
    return _SettingsCard(
      icon: Icons.electrical_services_outlined,
      title: 'Integrations',
      subtitle: 'Connectez DSMO a vos outils externes',
      child: Column(
        children: [
          _buildIntegration(
            name: 'Slack',
            desc: 'Recevez les alertes dans votre canal Slack',
            icon: Icons.chat_bubble_outline,
            color: const Color(0xFF4A154B),
            connected: false,
          ),
          _buildIntegration(
            name: 'Microsoft Teams',
            desc: 'Notifications directement dans Teams',
            icon: Icons.groups_outlined,
            color: const Color(0xFF6264A7),
            connected: false,
          ),
          _buildIntegration(
            name: 'Google Calendar',
            desc: 'Synchronisez les echeances reglementaires',
            icon: Icons.calendar_month_outlined,
            color: const Color(0xFF4285F4),
            connected: true,
          ),
          _buildIntegration(
            name: 'API Webhook',
            desc: 'Envoyez les donnees a votre endpoint custom',
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
                    Text('Zone de danger',
                        style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: UltraTheme.error)),
                    const SizedBox(height: 1),
                    Text('Actions irreversibles sur votre compte',
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
                      Text('Supprimer le compte',
                          style: GoogleFonts.inter(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: UltraTheme.textPrimary)),
                      const SizedBox(height: 4),
                      Text(
                          'Cette action est definitive et supprimera toutes '
                          'vos declarations et donnees.',
                          style: UltraTheme.bodyMedium),
                    ],
                  ),
                ),
                const SizedBox(width: 20),
                OutlinedButton.icon(
                  onPressed: () => _confirmDelete(context),
                  icon: const Icon(Icons.delete_outline, size: 16),
                  label: const Text('Supprimer'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: UltraTheme.error,
                    side: BorderSide(
                        color: UltraTheme.error.withValues(alpha: 0.4)),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 18, vertical: 11),
                    shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(UltraTheme.radiusMedium)),
                    textStyle: GoogleFonts.inter(
                        fontSize: 13, fontWeight: FontWeight.w600),
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
              Text('Confirmer la suppression',
                  style: UltraTheme.displayMedium.copyWith(fontSize: 20)),
              const SizedBox(height: 8),
              Text(
                'Cette action est irreversible. Toutes vos donnees '
                'seront definitivement supprimees.',
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
                    child: Text('Annuler',
                        style: GoogleFonts.inter(
                            fontSize: 14, fontWeight: FontWeight.w600)),
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
                    child: Text('Supprimer',
                        style: GoogleFonts.inter(
                            fontSize: 14, fontWeight: FontWeight.w600)),
                  ),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
    // TODO: call API to delete account if confirm == true
    debugPrint('Delete confirmed: $confirm');
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
            style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textSecondary)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: type,
          obscureText: obscure,
          style: GoogleFonts.inter(fontSize: 14, color: UltraTheme.textPrimary),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle:
                GoogleFonts.inter(fontSize: 14, color: UltraTheme.textMuted),
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
                    style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.textPrimary)),
                const SizedBox(height: 2),
                Text(subtitle, style: UltraTheme.bodyMedium),
              ],
            ),
          ),
          const SizedBox(width: 12),
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
                    style: GoogleFonts.inter(
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
                  Text('Connecte',
                      style: GoogleFonts.inter(
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
                textStyle: GoogleFonts.inter(
                    fontSize: 13, fontWeight: FontWeight.w500),
              ),
              child: const Text('Connecter'),
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
            textStyle:
                GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
          ),
          child: const Text('Annuler'),
        ),
        const SizedBox(width: 12),
        ElevatedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.check_rounded, size: 17),
          label: const Text('Enregistrer'),
          style: ElevatedButton.styleFrom(
            backgroundColor: UltraTheme.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
            elevation: 0,
            shadowColor: UltraTheme.primary.withValues(alpha: 0.35),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(UltraTheme.radiusMedium)),
            textStyle:
                GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
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
                        style: GoogleFonts.inter(
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
