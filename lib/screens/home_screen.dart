// lib/screens/home_screen.dart
// ═══════════════════════════════════════════════════════════════
// HomeScreen — role-aware navigation + scoped analytics.
//
// Role strings expected from backend:
//   COMPANY | DIVISIONAL | REGIONAL | CENTRAL
//   SUPER_ADMIN_DSMO | SUPER_ADMIN_ONEFOP | SUPER_ADMIN
//
// VETTING WORKFLOW SUSPENDED (2026-05-29):
//   - All approval/rejection UI removed
//   - "Pending validation" tabs repurposed to "Submissions"
//   - Read-only submission viewer replaces approval screens
//   - Status filters limited to DRAFT/SUBMITTED only
//
// Resolution table:
//   backend role    stream     resolved role        dashboards
//   ─────────────── ────────── ──────────────────── ─────────────────────
//   SUPER_ADMIN     DSMO       SUPER_ADMIN_DSMO      DSMO only  (4 tabs)
//   SUPER_ADMIN     ONEFOP     SUPER_ADMIN_ONEFOP    ONEFOP only (3 tabs)
//   SUPER_ADMIN     null       SUPER_ADMIN           BOTH        (5 tabs)
//   CENTRAL         —          CENTRAL               BOTH        (3 tabs)
//   REGIONAL        —          REGIONAL              BOTH        (3 tabs)
//   DIVISIONAL      —          DIVISIONAL            DSMO only   (2 tabs)
//   COMPANY         —          COMPANY               Workspace   (4 tabs)
// ═══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/i18n/l10n_ext.dart';
import '../providers/auth_provider.dart';
import '../providers/providers.dart';
import '../data/api_client.dart' show ApiException;
import '../models/user.dart';
import '../theme/ultra_theme.dart';
import '../services/draft_service.dart';
import '../services/reference_cache_service.dart';
import '../providers/connectivity_provider.dart';
import '../providers/sync_queue_provider.dart';
import '../widgets/common_widgets.dart';
import '../widgets/responsive_helpers.dart';

// ✅ Import main to access the global router
import '../main.dart';

// ── Analytics (DSMO stream) ──────────────────────────────────
import '../features/analytics/screens/onefop_dashboard_screen.dart';
import '../features/analytics/screens/company_analytics_screen.dart';

// ── Dashboards ───────────────────────────────────────────────
import 'dashboards/company_workspace_dashboard.dart';

// Add these imports with the other ONEFOP imports
import 'report/report_screen.dart';

// ── Super admin tab merges ──────────────────────────────────────
import 'superadmin/soumissions_screen.dart';
import 'superadmin/communication_screen.dart';

// ── DSMO ─────────────────────────────────────────────────────
import 'dsmo/declaration_wizard_screen.dart';
import 'dsmo/declarations_list_screen.dart';
import 'dsmo/company_declarations_screen.dart';
import 'dsmo/send_notification_screen.dart';

// ── ONEFOP ───────────────────────────────────────────────────
import 'onefop/onefop_unified_form_screen_v4.dart';
import 'onefop/onefop_legal_acknowledgment_screen.dart';
import 'onefop/submissions_viewer_screen.dart'; // NEW: read-only viewer
import 'onefop/onefop_form_constants.dart' show EntityType, entityTypeString;

// ── Admin ────────────────────────────────────────────────────
import 'admin/admin_reset_password_screen.dart';
import 'admin/annuaire_screen.dart';
import 'admin/system_settings_screen.dart';

// ── Settings ─────────────────────────────────────────────────
import '../screens/settings_screen.dart';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS — role sets used across drawer, appbar, tabs
// ═══════════════════════════════════════════════════════════════

/// Roles that can use the region/department filter picker.
/// Geo-locked roles (REGIONAL, DIVISIONAL) are excluded —
/// their scope is set automatically via effectiveRegionProvider.
const _nationalRoles = {
  'CENTRAL',
  'SUPER_ADMIN',
  'SUPER_ADMIN_DSMO',
  'SUPER_ADMIN_ONEFOP',
};

enum SnackBarType { success, error, warning, info }

class _Tab {
  const _Tab(this.label, this.icon, this.screen);
  final String label;
  final IconData icon;
  final Widget screen;
}

// ═══════════════════════════════════════════════════════════════
// HomeScreen
// ═══════════════════════════════════════════════════════════════

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _selectedIndex = 0;
  bool _railExpanded = true;

  // Short-TTL cache for "is the submission period open" — offline, this
  // lets a wizard reopen against the last-known window instead of hard
  // failing; the server re-validates for real at submit time.
  final _periodCache = ReferenceCacheService();

  // Filter state variables
  String? _filterRegion;
  String? _filterDepartment;
  String? _filterStatus; // NEW: for submission status filtering

  // ═══════════════════════════════════════════════════════════
  // SECTION 1 — ROLE RESOLUTION (FIXED)
  // ═══════════════════════════════════════════════════════════

  String _resolveRole(User user) {
    if (user.role != 'SUPER_ADMIN') return user.role;

    // FIX: Proper stream handling
    final stream = user.stream?.toUpperCase();
    if (stream == 'DSMO') {
      return 'SUPER_ADMIN_DSMO';
    } else if (stream == 'ONEFOP') {
      return 'SUPER_ADMIN_ONEFOP';
    }
    return 'SUPER_ADMIN';
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 2 — TAB DEFINITIONS (UPDATED - VETTING SUSPENDED)
  // ═══════════════════════════════════════════════════════════

  List<_Tab> _buildTabs(
      String role, VoidCallback onNewSubmission, VoidCallback onViewAll) {
    switch (role) {
      case 'COMPANY':
        return [
          _Tab(
            context.l10n.homeTabLabel,
            Icons.home_outlined,
            CompanyWorkspaceDashboard(
              onNewSubmission: onNewSubmission,
              onViewAll: onViewAll,
            ),
          ),
          _Tab(
            context.l10n.declarationsTabLabel,
            Icons.folder_open_outlined,
            CompanyDeclarationsScreen(onNewSubmission: onNewSubmission),
          ),
          _Tab(
            context.l10n.analyticsTabLabel,
            Icons.show_chart_outlined,
            const CompanyAnalyticsScreen(),
          ),
          _Tab(
            context.l10n.settingsTabLabel,
            Icons.settings_outlined,
            const ParametresScreen(),
          ),
        ];

      case 'DIVISIONAL':
        // VETTING SUSPENDED: Removed validation UI, keeping only view
        return const [
          _Tab('Soumissions', Icons.list_alt_outlined,
              SubmissionsViewerScreen()),
          _Tab('Analytique', Icons.bar_chart_outlined, OnefopDashboardScreen()),
        ];

      case 'REGIONAL':
        // VETTING SUSPENDED: Removed pending queue, using viewer
        return const [
          _Tab('Soumissions', Icons.list_alt_outlined,
              SubmissionsViewerScreen()),
          _Tab('Analytique DSMO', Icons.bar_chart_outlined,
              OnefopDashboardScreen()),
          _Tab('Notifications', Icons.notifications_outlined,
              SendNotificationScreen()),
        ];

      case 'CENTRAL':
        // VETTING SUSPENDED: Both DSMO and ONEFOP views
        return const [
          _Tab('Analytique DSMO', Icons.bar_chart_outlined,
              OnefopDashboardScreen()),
          _Tab('Soumissions ONEFOP', Icons.assignment_outlined,
              SubmissionsViewerScreen()),
          _Tab('Notifications', Icons.notifications_outlined,
              SendNotificationScreen()),
        ];

      case 'SUPER_ADMIN':
        // Merged tabs: Soumissions (DSMO + ONEFOP), Communication
        // (Campagnes + Notifications), Annuaire (Utilisateurs +
        // Entreprises) — see lib/screens/superadmin/ and
        // lib/screens/admin/annuaire_screen.dart. The standalone
        // "Data Mgmt" tab was removed: its bulk ONEFOP export moved into
        // the Soumissions tab (see onefop_export_panel.dart), and its
        // region/sector taxonomy management moved into Paramètres (see
        // regions_sectors_screen.dart) — both duplicated screens that
        // already existed elsewhere instead of having their own home.
        return [
          const _Tab('Analytics DSMO', Icons.bar_chart_outlined,
              OnefopDashboardScreen()),
          const _Tab('Reports', Icons.description_outlined, ReportScreen()),
          const _Tab('Communication', Icons.campaign_outlined,
              CommunicationScreen()),
          _Tab('Soumissions', Icons.assignment_outlined,
              SoumissionsScreen(onNewSubmission: onNewSubmission)),
          const _Tab('Annuaire', Icons.contacts_outlined, AnnuaireScreen()),
          const _Tab('Paramètres', Icons.settings_outlined,
              SystemSettingsScreen()),
        ];
      case 'SUPER_ADMIN_DSMO':
        // DSMO-only admin without vetting
        return [
          _Tab('Déclarations', Icons.folder_open_outlined,
              DeclarationsListScreen(onNewSubmission: onNewSubmission)),
          const _Tab('Analytique DSMO', Icons.bar_chart_outlined,
              OnefopDashboardScreen()),
          const _Tab('Annuaire', Icons.contacts_outlined,
              AnnuaireScreen(showUsersTab: false)),
          const _Tab('Notifications', Icons.notifications_outlined,
              SendNotificationScreen()),
        ];

      case 'SUPER_ADMIN_ONEFOP':
        // ONEFOP-only admin without vetting
        return const [
          _Tab('Tableau de bord', Icons.dashboard_outlined,
              OnefopDashboardScreen()),
          _Tab('Soumissions', Icons.list_alt_outlined,
              SubmissionsViewerScreen()),
          _Tab('Annuaire', Icons.contacts_outlined,
              AnnuaireScreen(showUsersTab: false)),
          _Tab('Notifications', Icons.notifications_outlined,
              SendNotificationScreen()),
        ];

      default:
        debugPrint(
          '⚠️ [HomeScreen] Unrecognised role: "$role" — '
          'showing fallback tabs. Check backend role strings.',
        );
        return const [
          _Tab('Notifications', Icons.notifications_outlined,
              SendNotificationScreen()),
        ];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 3 — ROLE LABELS
  // ═══════════════════════════════════════════════════════════

  String _roleLabel(String role) {
    if (role == 'COMPANY') return context.l10n.roleLabelCompany;
    const labels = {
      'DIVISIONAL': 'Division du Travail',
      'REGIONAL': 'Delegation Regionale',
      'CENTRAL': 'Direction Nationale',
      'SUPER_ADMIN': 'Super Admin · DSMO + ONEFOP',
      'SUPER_ADMIN_DSMO': 'Admin · Regulation MO',
      'SUPER_ADMIN_ONEFOP': 'Admin · ONEFOP',
    };
    return labels[role] ?? role;
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 4 — NAVIGATION HELPERS
  // ═══════════════════════════════════════════════════════════

  PageRouteBuilder _route(Widget screen) => PageRouteBuilder(
        pageBuilder: (_, a, __) => screen,
        transitionsBuilder: (_, a, __, child) => SlideTransition(
          position: Tween<Offset>(
                  begin: const Offset(0.05, 0), end: Offset.zero)
              .animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)),
          child: FadeTransition(opacity: a, child: child),
        ),
      );

  void _push(Widget screen) => Navigator.push(context, _route(screen));

  void _selectTab(int i, List<_Tab> tabs) {
    setState(() {
      _selectedIndex = i;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 4b — FILTER SHEET (UPDATED with status filter)
  // ═══════════════════════════════════════════════════════════

  void _openFilterSheet(List<_Tab> tabs) {
    String? tempRegion = _filterRegion;
    String? tempDept = _filterDepartment;
    String? tempStatus = _filterStatus;

    const regions = [
      'Adamaoua',
      'Centre',
      'Est',
      'Extrême-Nord',
      'Littoral',
      'Nord',
      'Nord-Ouest',
      'Ouest',
      'Sud',
      'Sud-Ouest',
    ];
    const departments = [
      'Bamboutos',
      'Djerem',
      'Fako',
      'Haut-Nkam',
      'Haute-Sanaga',
      'Lékié',
      'Mbam-et-Inoubou',
      'Mbam-et-Kim',
      'Mfoundi',
      'Mungo',
      'Nyong-et-Kellé',
      'Nyong-et-Mfoumou',
      "Nyong-et-So'o",
      'Vina',
      'Wouri',
    ];
    const statuses = ['Tous', 'Brouillon', 'Soumis', 'Approuvé (historique)'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding:
              EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
            decoration: const BoxDecoration(
              color: UltraTheme.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Drag handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: UltraTheme.textMuted.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                // Title row
                Row(children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: UltraTheme.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.tune_rounded,
                        color: UltraTheme.primary, size: 18),
                  ),
                  const SizedBox(width: 12),
                  const Text('Filtrer par zone',
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: UltraTheme.textPrimary)),
                  const Spacer(),
                  if (tempRegion != null ||
                      tempDept != null ||
                      tempStatus != null)
                    TextButton(
                      onPressed: () {
                        setSheet(() {
                          tempRegion = null;
                          tempDept = null;
                          tempStatus = null;
                        });
                      },
                      child: const Text('Effacer',
                          style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              color: UltraTheme.textMuted)),
                    ),
                ]),
                const SizedBox(height: 20),
                // Region
                const Text('Région',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: UltraTheme.textMuted)),
                const SizedBox(height: 8),
                _FilterDropdown(
                  hint: 'Toutes les régions',
                  value: tempRegion,
                  items: regions,
                  onChanged: (v) => setSheet(() => tempRegion = v),
                ),
                const SizedBox(height: 16),
                // Department
                const Text('Département / Division',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: UltraTheme.textMuted)),
                const SizedBox(height: 8),
                _FilterDropdown(
                  hint: 'Tous les départements',
                  value: tempDept,
                  items: departments,
                  onChanged: (v) => setSheet(() => tempDept = v),
                ),
                const SizedBox(height: 16),
                // Status filter (NEW)
                const Text('Statut',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: UltraTheme.textMuted)),
                const SizedBox(height: 8),
                _FilterDropdown(
                  hint: 'Tous les statuts',
                  value: tempStatus,
                  items: statuses,
                  onChanged: (v) => setSheet(() => tempStatus = v),
                ),
                const SizedBox(height: 24),
                // Active filter chips
                if (tempRegion != null ||
                    tempDept != null ||
                    tempStatus != null) ...[
                  Wrap(spacing: 8, children: [
                    if (tempRegion != null)
                      _ActiveFilterChip(
                          label: tempRegion!,
                          onRemove: () => setSheet(() => tempRegion = null)),
                    if (tempDept != null)
                      _ActiveFilterChip(
                          label: tempDept!,
                          onRemove: () => setSheet(() => tempDept = null)),
                    if (tempStatus != null && tempStatus != 'Tous')
                      _ActiveFilterChip(
                          label: tempStatus!,
                          onRemove: () => setSheet(() => tempStatus = null)),
                  ]),
                  const SizedBox(height: 16),
                ],
                // Apply button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: () {
                      setState(() {
                        _filterRegion = tempRegion;
                        _filterDepartment = tempDept;
                        _filterStatus =
                            tempStatus == 'Tous' ? null : tempStatus;
                      });
                      Navigator.pop(ctx);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: UltraTheme.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Appliquer le filtre',
                        style: TextStyle(
                            fontFamily: 'Inter',
                            fontWeight: FontWeight.w600,
                            fontSize: 15)),
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
  // SECTION 5 — ENTITY TYPE HELPERS
  // ═══════════════════════════════════════════════════════════

  String _entityTypeString(EntityType t) {
    switch (t) {
      case EntityType.enterprise:
        return 'enterprise';
      case EntityType.cooperative:
        return 'cooperative';
      case EntityType.ctd:
        return 'ctd';
      case EntityType.ong:
        return 'ong';
    }
  }

  EntityType _parseEntityType(String s) {
    switch (s.toUpperCase()) {
      case 'COOPERATIVE':
        return EntityType.cooperative;
      case 'CTD':
        return EntityType.ctd;
      case 'ONG':
        return EntityType.ong;
      default:
        return EntityType.enterprise;
    }
  }

  String _mapActivityToSector(String? activity) {
    if (activity == null) return 'Tertiaire/ Tertiary';
    final a = activity.toLowerCase();
    if (a.contains('agriculture') ||
        a.contains('elevage') ||
        a.contains('peche') ||
        a.contains('mine') ||
        a.contains('foret') ||
        a.contains('farming') ||
        a.contains('agro') ||
        a.contains('forestier')) {
      return 'Primaire/ Primary';
    }
    if (a.contains('industrie') ||
        a.contains('fabrication') ||
        a.contains('construction') ||
        a.contains('manufacturing') ||
        a.contains('batiment') ||
        a.contains('travaux')) {
      return 'Secondaire/ Secondary';
    }
    return 'Tertiaire/ Tertiary';
  }

  String? _mapCoopType(String? v) =>
      (v == null || v.trim().isEmpty) ? null : v.trim();

  String? _mapEnterpriseSize(String? size) {
    switch (size?.trim().toUpperCase()) {
      case 'TPE':
        return 'TPE/ Very small enterprise';
      case 'PE':
        return 'PE/ Small enterprise';
      case 'ME':
        return 'ME/ Medium-sized enterprise';
      case 'GE':
        return 'GE/ Large enterprise';
      default:
        return null;
    }
  }

  String? _mapLegalStatus(String? s) {
    switch (s?.trim().toUpperCase()) {
      case 'UNIPERSONNELLE':
      case 'SOCIETE UNIPERSONNELLE':
        return 'Societe unipersonnelle/ Single-member company';
      case 'SARL':
        return 'SARL/ LLC';
      case 'SA':
        return 'SA/ PLC';
      case 'AUTRES':
      case 'OTHER':
      case 'OTHERS':
        return 'Autres/ Others';
      default:
        return null;
    }
  }

  String? _mapAreaBack(dynamic area) {
    if (area == null) return null;
    if (area is String) {
      final l = area.toLowerCase();
      if (l.contains('urbain')) return 'Urbain/ Urban';
      if (l.contains('rural')) return 'Rural/ Rural';
      return area;
    }
    if (area is int) {
      if (area == 1) return 'Urbain/ Urban';
      if (area == 2) return 'Rural/ Rural';
    }
    return null;
  }

  void _set(Map<String, dynamic> data, String key, dynamic value) {
    if (value == null) return;
    final s = value.toString().trim();
    if (s.isNotEmpty) data[key] = s;
  }

  Map<String, dynamic> _companyToInitialData(
      Map<String, dynamic> company, EntityType type, User? user) {
    final data = <String, dynamic>{};

    var respFirst = company['respondentFirstName'] as String? ?? '';
    var respLast = company['respondentLastName'] as String? ?? '';
    if (respFirst.isEmpty) respFirst = user?.firstName ?? '';
    if (respLast.isEmpty) respLast = user?.lastName ?? '';

    final fullName = [respFirst, respLast].where((s) => s.isNotEmpty).join(' ');
    if (fullName.isNotEmpty) data['S0Q01'] = fullName;

    final fn = company['respondentFunction'] as String? ??
        company['positionTitle'] as String? ??
        user?.positionTitle ??
        '';
    if (fn.isNotEmpty) data['S0Q02'] = fn;
    if ((user?.email ?? '').isNotEmpty) data['S0Q03_EMAIL'] = user!.email;

    final phone1 = company['respondentPhone'] as String? ??
        company['phone'] as String? ??
        '';
    if (phone1.isNotEmpty) data['S0Q03_TEL1'] = phone1;
    final phone2 = company['respondentPhone2'] as String? ?? '';
    if (phone2.isNotEmpty) data['S0Q03_TEL2'] = phone2;

    switch (type) {
      case EntityType.enterprise:
        _set(data, 'S1Q01', _mapLegalStatus(company['legalStatus'] as String?));
        _set(data, 'S1Q02', company['companyName'] ?? company['name']);
        _set(data, 'S1Q04_REGION', company['region']);
        _set(data, 'S1Q04_DEPT', company['department']);
        _set(data, 'S1Q04_SUBDIV', company['subdivision']);
        _set(data, 'S1Q04_LOCALITY', company['address']);
        final aEnt = _mapAreaBack(company['area']);
        if (aEnt != null) data['S1Q03'] = aEnt;
        _set(data, 'S1Q05_TEL1', company['phone']);
        _set(data, 'S1Q05_TEL2', company['phone2']);
        _set(data, 'S1Q05_BP', company['poBox']);
        _set(data, 'S1Q05_EMAIL', company['email']);
        final act = (company['mainActivity'] as String? ?? '').trim();
        final br = (company['branch'] as String? ?? '').trim();
        if (act.isNotEmpty) {
          data['S1Q06'] = _mapActivityToSector(act);
          data['S1Q08'] = act;
        }
        if (br.isNotEmpty) data['S1Q07'] = br;
        _set(data, 'S1Q09', company['address']);
        _set(data, 'S1Q10', company['cnpsNumber']);
        _set(data, 'S1Q12',
            _mapEnterpriseSize(company['enterpriseSize'] as String?));
        break;

      case EntityType.cooperative:
        _set(data, 'COOP_S1Q01', company['cooperativeName'] ?? company['name']);
        _set(data, 'COOP_S1Q02',
            company['cooperativeHeadOffice'] ?? company['address']);
        _set(data, 'COOP_S1Q03', company['yearOfCreation']?.toString());
        _set(data, 'COOP_S1Q05_REGION', company['region']);
        _set(data, 'COOP_S1Q05_DEPT', company['department']);
        _set(data, 'COOP_S1Q05_SUBDIV', company['subdivision']);
        _set(data, 'COOP_S1Q05_LOCALITY',
            company['cooperativeHeadOffice'] ?? company['address']);
        final aCoop = _mapAreaBack(company['area']);
        if (aCoop != null) data['COOP_S1Q04'] = aCoop;
        _set(data, 'COOP_S1Q06_TEL1', company['phone']);
        _set(data, 'COOP_S1Q06_TEL2', company['phone2']);
        _set(data, 'COOP_S1Q06_BP', company['poBox']);
        final coopAct = (company['mainActivity'] as String? ?? '').trim();
        final coopBr = (company['branch'] as String? ?? '').trim();
        if (coopAct.isNotEmpty) {
          data['COOP_S1Q07'] = _mapActivityToSector(coopAct);
          data['COOP_S1Q09'] = coopAct;
        }
        if (coopBr.isNotEmpty) data['COOP_S1Q08'] = coopBr;
        _set(data, 'COOP_S1Q10',
            _mapCoopType(company['cooperativeType'] as String?));
        _set(data, 'COOP_S1Q10_OTHER', company['cooperativeTypeOther']);
        break;

      case EntityType.ctd:
        _set(data, 'CTD_S1Q01', company['ctdType']);
        _set(data, 'CTD_S1Q02', company['councilType']);
        _set(data, 'CTD_S1Q03', company['yearOfCreation']?.toString());
        _set(data, 'CTD_S1Q05_REGION', company['region']);
        _set(data, 'CTD_S1Q05_DEPT', company['department']);
        _set(data, 'CTD_S1Q05_SUBDIV', company['subdivision']);
        _set(data, 'CTD_S1Q05_LOCALITY', company['address']);
        final aCtd = _mapAreaBack(company['area']);
        if (aCtd != null) data['CTD_S1Q04'] = aCtd;
        _set(data, 'CTD_S1Q06_TEL1', company['phone']);
        _set(data, 'CTD_S1Q06_TEL2', company['phone2']);
        _set(data, 'CTD_S1Q06_BP', company['poBox']);
        final ctdAct = (company['mainActivity'] as String? ?? '').trim();
        final ctdBr = (company['branch'] as String? ?? '').trim();
        if (ctdAct.isNotEmpty) data['CTD_S1Q07'] = _mapActivityToSector(ctdAct);
        if (ctdBr.isNotEmpty) data['CTD_S1Q08'] = ctdBr;
        _set(data, 'CTD_S1Q01_NAME', company['ctdName'] ?? company['name']);
        break;

      case EntityType.ong:
        _set(data, 'ONG_S1Q01', company['ngoName'] ?? company['name']);
        _set(data, 'ONG_S1Q02', company['address']);
        _set(data, 'ONG_S1Q03', company['yearOfCreation']?.toString());
        _set(data, 'ONG_S1Q05_REGION', company['region']);
        _set(data, 'ONG_S1Q05_DEPT', company['department']);
        _set(data, 'ONG_S1Q05_SUBDIV', company['subdivision']);
        _set(data, 'ONG_S1Q05_LOCALITY', company['address']);
        final aOng = _mapAreaBack(company['area']);
        if (aOng != null) data['ONG_S1Q04'] = aOng;
        _set(data, 'ONG_S1Q06_TEL1', company['phone']);
        _set(data, 'ONG_S1Q06_TEL2', company['phone2']);
        _set(data, 'ONG_S1Q06_BP', company['poBox']);
        final ongAct = (company['mainActivity'] as String? ?? '').trim();
        final ongBr = (company['branch'] as String? ?? '').trim();
        if (ongAct.isNotEmpty) data['ONG_S1Q07'] = _mapActivityToSector(ongAct);
        if (ongBr.isNotEmpty) data['ONG_S1Q08'] = ongBr;
        _set(data, 'ONG_S1Q09', company['mainMission']);
        _set(data, 'ONG_S1Q10', company['registrationNumber']);
        break;
    }
    return data;
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 6 — ONEFOP FORM FLOW (LINKAGE INTEGRATED)
  // ═══════════════════════════════════════════════════════════

  Future<void> _openOnefopFormForCompany() async {
    final user = ref.read(authProvider).value;
    try {
      final api = ref.read(apiClientProvider);
      final company = await api.getMyCompany();
      if (!mounted) return;

      if (company == null) {
        if (!context.mounted) return;
        _snack(context,
            message: context.l10n.companyProfileNotFoundError,
            type: SnackBarType.error);
        return;
      }

      // ═══════════════════════════════════════════════════════════
      // NEW: Extract linkage identifiers from company profile
      // ═══════════════════════════════════════════════════════════
      final establishmentId = company['establishmentId'] as String?;
      final taxNumber = company['taxNumber'] as String?;
      final cnpsNumber = company['cnpsNumber'] as String?;
      final registrationNumber = company['registrationNumber'] as String?;
      final companyId = company['id'] as String?;
      if (establishmentId == null || establishmentId.isEmpty) {
        if (!context.mounted) return;
        _snack(context,
            message: context.l10n.missingEstablishmentIdError,
            type: SnackBarType.error);
        return;
      }

      // Cached so a device that's opened the wizard online at least once
      // can still open it offline — real enforcement happens server-side
      // at submit (see OnefopService.submitForm).
      Map<String, dynamic>? activeQuarter;
      try {
        activeQuarter = await _periodCache.getFresh(
          key: 'onefop_active_quarter',
          fetch: () => api.getActiveQuarter(),
        );
      } catch (_) {
        activeQuarter = null;
      }
      final periodCheckedOffline = !ref.read(isOnlineProvider);
      if (!mounted) return;
      if (activeQuarter == null || activeQuarter['isOpen'] != true) {
        if (!context.mounted) return;
        _snack(context,
            message: context.l10n.noOpenSubmissionPeriodError,
            type: SnackBarType.warning);
        return;
      }
      final activeQuarterCode = activeQuarter['code'] as String;

      String? entityType = company['entityType'] as String?;
      if (entityType == null) {
        entityType = await _pickEntityType();
        if (!mounted || entityType == null) return;
        await api.saveCompanyProfile({
          'name': company['name'] as String,
          'taxNumber': company['taxNumber'] as String,
          'mainActivity': company['mainActivity'] as String,
          'region': company['region'] as String,
          'department': company['department'] as String,
          'address': company['address'] as String? ?? '',
          'entityType': entityType,
          if (company['cnpsNumber'] != null)
            'cnpsNumber': company['cnpsNumber'],
          if (company['parentCompany'] != null)
            'parentCompany': company['parentCompany'],
          if (company['secondaryActivity'] != null)
            'secondaryActivity': company['secondaryActivity'],
        });
        if (!mounted) return;
      }

      final parsedType = _parseEntityType(entityType);
      final entityTypeStr = _entityTypeString(parsedType);

      // ═══════════════════════════════════════════════════════════
      // Local storage is the primary draft copy (instant, works offline).
      // The server copy (ApiClient.saveOnefopDraft) is a best-effort sync
      // target for cross-device resume.
      // ═══════════════════════════════════════════════════════════
      var localDraft = await DraftService.loadDraft(
          establishmentId: establishmentId, quarterCode: activeQuarterCode);
      final localSavedAt = localDraft == null
          ? null
          : await DraftService.getSavedAt(
              establishmentId: establishmentId, quarterCode: activeQuarterCode);

      Map<String, dynamic>? matchingServerDraft;
      try {
        final serverDrafts = await api.getOnefopDrafts();
        for (final d in serverDrafts) {
          if (d['quarterCode'] == activeQuarterCode) {
            matchingServerDraft = d;
            break;
          }
        }
      } catch (_) {
        // Offline — proceed with whatever's local.
      }

      if (matchingServerDraft != null) {
        final serverDraftData =
            matchingServerDraft['draftData'] as Map<String, dynamic>?;
        if (localDraft == null) {
          localDraft = serverDraftData;
        } else {
          // A >10s buffer so this device's own just-synced push never
          // reads back as a "conflict" against itself.
          final serverUpdatedAt = DateTime.tryParse(
              matchingServerDraft['lastSavedAt'] as String? ?? '');
          if (serverUpdatedAt != null &&
              localSavedAt != null &&
              serverUpdatedAt
                  .isAfter(localSavedAt.add(const Duration(seconds: 10)))) {
            if (!mounted) return;
            final useServer = await _showConflictDialog();
            if (useServer == true) localDraft = serverDraftData;
          }
        }
      }

      bool resumeDraft = false;
      if (localDraft != null && mounted) {
        final resume = await _showDraftDialog(
            establishmentId: establishmentId, quarterCode: activeQuarterCode);
        if (resume == null) return;
        resumeDraft = resume;
      }

      var initialData = _companyToInitialData(company, parsedType, user);

      // Inject hidden metadata — flows to backend but never renders as form fields
      initialData['__meta_establishment_id'] = establishmentId;
      initialData['__meta_tax_number'] = taxNumber;
      initialData['__meta_cnps_number'] = cnpsNumber;
      initialData['__meta_registration_number'] = registrationNumber;
      initialData['__meta_entity_type'] = entityTypeStr;
      initialData['__meta_quarter_code'] = activeQuarterCode;

      final existingDraft = resumeDraft ? localDraft : null;
      final merged = {...?existingDraft, ...initialData};

      final prefs = await SharedPreferences.getInstance();
      final hasAcknowledged =
          prefs.getBool('onefop_ack_${user?.id ?? "guest"}') ?? false;
      if (!mounted) return;

      if (!context.mounted) return;
      Navigator.push(
        context,
        PageRouteBuilder(
          opaque: true,
          transitionDuration: Duration.zero,
          reverseTransitionDuration: Duration.zero,
          pageBuilder: (_, __, ___) => OnefopLegalAcknowledgmentScreen(
            entityType: parsedType,
            isReturningUser: hasAcknowledged,
            onPreload: () async {},
            onAcknowledged: () async {
              if (!hasAcknowledged && user != null) {
                await prefs.setBool('onefop_ack_${user.id}', true);
              }
              if (!mounted) return;
              Navigator.pushReplacement(
                context,
                _route(OnefopUnifiedFormScreenV4(
                  entityType: parsedType,
                  initialData: merged,
                  establishmentId: establishmentId,
                  companyId: companyId,
                  quarterCode: activeQuarterCode,
                  userId: user?.id,
                  periodCheckedOffline: periodCheckedOffline,
                  onSave: (data) async {
                    await DraftService.saveDraft(
                        establishmentId: establishmentId,
                        quarterCode: activeQuarterCode,
                        data: data);
                    try {
                      await api.saveOnefopDraft(
                          quarterCode: activeQuarterCode,
                          entityType: entityTypeString(parsedType),
                          draftData: data);
                    } catch (_) {
                      // Offline — local copy already saved above; the
                      // reconnect listener in OnefopUnifiedFormScreenV4
                      // pushes it once connectivity returns.
                    }
                  },
                  onCancel: () {
                    if (context.mounted) Navigator.pop(context);
                  },
                  onSubmitSuccess: () async {
                    await DraftService.clearDraft(
                        establishmentId: establishmentId,
                        quarterCode: activeQuarterCode);
                    try {
                      await api.deleteOnefopDraft(activeQuarterCode);
                    } catch (_) {
                      // Best-effort — a leftover server draft after a
                      // successful submit is a stale-UI nuisance, not data
                      // loss (the local copy is already gone).
                    }
                  },
                )),
              );
            },
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      if (!context.mounted) return;
      _snack(context,
          message: context.l10n.profileLoadError('$e'),
          type: SnackBarType.error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 7 — DIALOGS (UPDATED for new draft keys)
  // ═══════════════════════════════════════════════════════════

  /// Shown when the server has a newer draft than this device's local
  /// copy — i.e. another device saved one more recently. Returns true to
  /// use the server's version, false to keep this device's. Plain
  /// bilingual literals rather than the .arb-generated l10n strings used
  /// elsewhere in this dialog, matching the precedent in OfflineBanner —
  /// keeps this addition from depending on a `flutter gen-l10n` run.
  Future<bool?> _showConflictDialog() {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => ResponsiveDialogBox(
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _dialogIcon(Icons.sync_problem_outlined, UltraTheme.warning),
              const SizedBox(height: 20),
              Text(
                  'Brouillon plus récent trouvé / A newer draft was found',
                  style: UltraTheme.displayMedium.copyWith(fontSize: 22)),
              const SizedBox(height: 8),
              Text(
                  "Un autre appareil a enregistré une version plus récente. / "
                  'Another device saved a newer version.',
                  style: UltraTheme.bodyMedium),
              const SizedBox(height: 24),
              SubmissionOptionCard(
                  icon: Icons.cloud_download_outlined,
                  title: "Utiliser l'autre version / Use the other version",
                  subtitle: 'Depuis un autre appareil / From another device',
                  color: UltraTheme.primary,
                  onTap: () => Navigator.pop(ctx, true)),
              const SizedBox(height: 12),
              SubmissionOptionCard(
                  icon: Icons.smartphone_outlined,
                  title: 'Garder cet appareil / Keep this device',
                  subtitle: 'Votre version actuelle / Your current version',
                  color: UltraTheme.warning,
                  onTap: () => Navigator.pop(ctx, false)),
            ]),
      ),
    );
  }

  Future<bool?> _showDraftDialog({
    required String establishmentId,
    required String quarterCode,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => ResponsiveDialogBox(
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _dialogIcon(Icons.restore_page_outlined, UltraTheme.primary),
              const SizedBox(height: 20),
              Text(context.l10n.draftFoundTitle,
                  style: UltraTheme.displayMedium.copyWith(fontSize: 22)),
              const SizedBox(height: 8),
              Text(context.l10n.draftFoundBody, style: UltraTheme.bodyMedium),
              const SizedBox(height: 24),
              SubmissionOptionCard(
                  icon: Icons.restore,
                  title: context.l10n.companyDeclResumeDraft,
                  subtitle: context.l10n.resumeDraftSubtitle,
                  color: UltraTheme.primary,
                  onTap: () => Navigator.pop(ctx, true)),
              const SizedBox(height: 12),
              SubmissionOptionCard(
                  icon: Icons.refresh,
                  title: context.l10n.startOverTitle,
                  subtitle: context.l10n.startOverSubtitle,
                  color: UltraTheme.warning,
                  onTap: () async {
                    await DraftService.clearDraft(
                        establishmentId: establishmentId,
                        quarterCode: quarterCode);
                    try {
                      await ref
                          .read(apiClientProvider)
                          .deleteOnefopDraft(quarterCode);
                    } on ApiException catch (e) {
                      // No connectivity — queue the delete so a stale
                      // draft doesn't linger server-side forever; the
                      // local copy is already cleared either way.
                      if (e.statusCode == null) {
                        await ref.read(syncQueueServiceProvider).enqueue(
                              method: 'delete',
                              path: '/onefop/draft/$quarterCode',
                              payload: const {},
                              label: 'Suppression brouillon ONEFOP $quarterCode',
                            );
                      }
                    } catch (_) {
                      // Best-effort — local copy is already cleared.
                    }
                    if (!ctx.mounted) return;
                    Navigator.pop(ctx, false);
                  }),
              const SizedBox(height: 16),
              _cancelButton(ctx),
            ]),
      ),
    );
  }

  Future<String?> _pickEntityType() {
    return showDialog<String>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.4),
      builder: (ctx) => ResponsiveDialogBox(
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(context.l10n.entityTypeDialogTitle,
                  style: UltraTheme.displayMedium.copyWith(fontSize: 22)),
              const SizedBox(height: 4),
              Text(context.l10n.entityTypeDialogBody,
                  style: UltraTheme.bodyMedium),
              const SizedBox(height: 24),
              EntityTypeCard(
                  icon: Icons.business,
                  label: context.l10n.entityTypeEnterprise,
                  value: 'ENTREPRISE',
                  onTap: () => Navigator.pop(ctx, 'ENTREPRISE')),
              const SizedBox(height: 8),
              EntityTypeCard(
                  icon: Icons.groups,
                  label: context.l10n.entityTypeCooperative,
                  value: 'COOPERATIVE',
                  onTap: () => Navigator.pop(ctx, 'COOPERATIVE')),
              const SizedBox(height: 8),
              EntityTypeCard(
                  icon: Icons.account_balance,
                  label: context.l10n.entityTypeCtd,
                  value: 'CTD',
                  onTap: () => Navigator.pop(ctx, 'CTD')),
              const SizedBox(height: 8),
              EntityTypeCard(
                  icon: Icons.volunteer_activism,
                  label: context.l10n.entityTypeOng,
                  value: 'ONG',
                  onTap: () => Navigator.pop(ctx, 'ONG')),
              const SizedBox(height: 16),
              _cancelButton(ctx),
            ]),
      ),
    );
  }

  Future<void> _openNewSubmissionDialog(BuildContext context) async {
    final result = await showDialog<String>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.4),
      builder: (ctx) => ResponsiveDialogBox(
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(context.l10n.newSubmissionDialogTitle,
                  style: UltraTheme.displayMedium.copyWith(fontSize: 24)),
              const SizedBox(height: 4),
              Text(context.l10n.newSubmissionDialogBody,
                  style: UltraTheme.bodyMedium),
              const SizedBox(height: 28),
              SubmissionOptionCard(
                  icon: Icons.assignment_outlined,
                  title: context.l10n.dsmoDeclarationOptionTitle,
                  subtitle: context.l10n.dsmoDeclarationOptionSubtitle,
                  color: UltraTheme.primary,
                  onTap: () => Navigator.pop(ctx, 'dsmo')),
              const SizedBox(height: 12),
              SubmissionOptionCard(
                  icon: Icons.bar_chart_outlined,
                  title: context.l10n.onefopQuestionnaireOptionTitle,
                  subtitle: context.l10n.onefopQuestionnaireOptionSubtitle,
                  color: UltraTheme.accent,
                  onTap: () => Navigator.pop(ctx, 'onefop')),
              const SizedBox(height: 24),
              _cancelButton(ctx),
            ]),
      ),
    );

    if (!mounted) return;
    if (result == 'dsmo') {
      await _openDsmoFormForCompany();
    } else if (result == 'onefop') {
      await _openOnefopFormForCompany();
    }
  }

  /// Gates the DSMO declaration wizard behind the active DSMO period —
  /// mirrors _openOnefopFormForCompany()'s active-quarter check below.
  Future<void> _openDsmoFormForCompany() async {
    final api = ref.read(apiClientProvider);
    // Same cache-with-fallback pattern as the ONEFOP flow above — lets a
    // device that's opened the wizard online at least once still open it
    // offline. DsmoService.submitDeclaration re-validates for real.
    Map<String, dynamic>? activePeriod;
    try {
      activePeriod = await _periodCache.getFresh(
        key: 'dsmo_active_period',
        fetch: () => api.getActiveDsmoPeriod(),
      );
    } catch (_) {
      activePeriod = null;
    }
    if (!mounted) return;
    if (activePeriod == null || activePeriod['isOpen'] != true) {
      _snack(context,
          message: context.l10n.noOpenDsmoPeriodError,
          type: SnackBarType.warning);
      return;
    }
    if (!mounted) return;
    _push(DeclarationWizardScreen(
        periodCheckedOffline: !ref.read(isOnlineProvider)));
  }

  Widget _dialogIcon(IconData icon, Color color) => Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Icon(icon, color: color, size: 28),
      );

  Widget _cancelButton(BuildContext ctx) => SizedBox(
        width: double.infinity,
        child: TextButton(
          onPressed: () => Navigator.pop(ctx),
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(UltraTheme.radiusMedium)),
          ),
          child: Text(ctx.l10n.cancelButton,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: UltraTheme.textMuted,
              )),
        ),
      );

  // ═══════════════════════════════════════════════════════════
  // SECTION 8 — LOGOUT
  // ═══════════════════════════════════════════════════════════

  Future<void> _confirmLogout(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.4),
      builder: (ctx) => ResponsiveDialogBox(
        maxWidth: 380,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          _dialogIcon(Icons.logout_rounded, UltraTheme.error),
          const SizedBox(height: 20),
          Text('Déconnexion',
              style: UltraTheme.displayMedium.copyWith(fontSize: 22)),
          const SizedBox(height: 8),
          Text('Voulez-vous vraiment vous déconnecter ?',
              textAlign: TextAlign.center, style: UltraTheme.bodyMedium),
          const SizedBox(height: 28),
          Row(children: [
            Expanded(child: _cancelButton(ctx)),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: UltraTheme.error,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(UltraTheme.radiusMedium)),
                  elevation: 0,
                ),
                child: const Text('Déconnecter',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w600)),
              ),
            ),
          ]),
        ]),
      ),
    );
    if (confirm == true && mounted) {
      await ref.read(authProvider.notifier).logout();
      router.go('/login');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 9 — SNACK BAR
  // ═══════════════════════════════════════════════════════════

  void _snack(BuildContext context,
      {required String message, required SnackBarType type}) {
    final color = {
      SnackBarType.success: UltraTheme.success,
      SnackBarType.error: UltraTheme.error,
      SnackBarType.warning: UltraTheme.warning,
      SnackBarType.info: UltraTheme.info,
    }[type]!;
    final icon = {
      SnackBarType.success: Icons.check_circle_rounded,
      SnackBarType.error: Icons.error_rounded,
      SnackBarType.warning: Icons.warning_rounded,
      SnackBarType.info: Icons.info_rounded,
    }[type]!;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          content: Row(children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(message,
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.white)),
            ),
          ]),
          backgroundColor: const Color(0xFF1E293B),
          behavior: SnackBarBehavior.fixed,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(UltraTheme.radiusLarge)),
          elevation: 8,
          duration: const Duration(seconds: 4),
          action:
              SnackBarAction(label: 'OK', textColor: color, onPressed: () {}),
        ));
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 10 — DRAWER (UPDATED - VETTING SUSPENDED)
  // ═══════════════════════════════════════════════════════════

  Widget _buildDrawer(User user, String role) {
    final isCompany = role == 'COMPANY';
    final isSuperAdmin = role == 'SUPER_ADMIN';
    final isDsmoAdmin = role == 'SUPER_ADMIN_DSMO' || isSuperAdmin;
    final isOnefopAdmin = role == 'SUPER_ADMIN_ONEFOP' || isSuperAdmin;
    final isFieldAgent = role == 'REGIONAL' || role == 'DIVISIONAL';
    final drawerW =
        (MediaQuery.of(context).size.width * 0.85).clamp(0.0, 300.0);

    return Drawer(
      width: drawerW,
      backgroundColor: UltraTheme.surface,
      elevation: 0,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.only(
              topRight: Radius.circular(UltraTheme.radiusXL),
              bottomRight: Radius.circular(UltraTheme.radiusXL))),
      child: SafeArea(
        child: Column(children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(gradient: UltraTheme.heroGradient),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                UserAvatar(email: user.email, size: 52, fontSize: 20),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user.email,
                            style: const TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Colors.white),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 2),
                        RoleBadge(label: _roleLabel(role)),
                      ]),
                ),
              ]),
              if (user.region != null) ...[
                const SizedBox(height: 12),
                Row(children: [
                  Icon(Icons.location_on_outlined,
                      size: 14, color: Colors.white.withValues(alpha: 0.7)),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      [
                        user.region!,
                        if (role == 'DIVISIONAL' && user.department != null)
                          user.department!,
                      ].join(' · '),
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.8)),
                    ),
                  ),
                ]),
              ],
            ]),
          ),
          Expanded(
            child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 12),
                children: [
                  if (isFieldAgent) ...[
                    const DrawerSectionHeader('Consultation'),
                    DrawerNavItem(
                      icon: Icons.list_alt_outlined,
                      label: "Soumissions",
                      subtitle: 'Consulter les questionnaires',
                      onTap: () {
                        Navigator.pop(context);
                        _push(const SubmissionsViewerScreen());
                      },
                    ),
                    const Divider(height: 32, indent: 16, endIndent: 16),
                  ],
                  if (isDsmoAdmin) ...[
                    const DrawerSectionHeader('Administration DSMO'),
                    DrawerNavItem(
                      icon: Icons.folder_open_outlined,
                      label: 'Déclarations DSMO',
                      subtitle: 'Consulter les déclarations',
                      onTap: () {
                        Navigator.pop(context);
                        _push(const DeclarationsListScreen());
                      },
                    ),
                    DrawerNavItem(
                      icon: Icons.contacts_outlined,
                      label: 'Annuaire',
                      subtitle: 'Utilisateurs et entreprises',
                      onTap: () {
                        Navigator.pop(context);
                        _push(const AnnuaireScreen());
                      },
                    ),
                    DrawerNavItem(
                      icon: Icons.password_outlined,
                      label: 'Réinitialiser un mot de passe',
                      subtitle: 'Après vérification d\'identité',
                      onTap: () {
                        Navigator.pop(context);
                        _push(const AdminResetPasswordScreen());
                      },
                    ),
                    const Divider(height: 32, indent: 16, endIndent: 16),
                  ],
                  if (isOnefopAdmin) ...[
                    const DrawerSectionHeader('Administration ONEFOP'),
                    DrawerNavItem(
                      icon: Icons.list_alt_outlined,
                      label: 'Soumissions ONEFOP',
                      subtitle: 'Consulter les questionnaires',
                      onTap: () {
                        Navigator.pop(context);
                        _push(const SubmissionsViewerScreen());
                      },
                    ),
                    if (!isDsmoAdmin) ...[
                      DrawerNavItem(
                        icon: Icons.contacts_outlined,
                        label: 'Annuaire',
                        subtitle: 'Utilisateurs et entreprises',
                        onTap: () {
                          Navigator.pop(context);
                          _push(const AnnuaireScreen());
                        },
                      ),
                      DrawerNavItem(
                        icon: Icons.password_outlined,
                        label: 'Réinitialiser un mot de passe',
                        subtitle: 'Après vérification d\'identité',
                        onTap: () {
                          Navigator.pop(context);
                          _push(const AdminResetPasswordScreen());
                        },
                      ),
                    ],
                    const Divider(height: 32, indent: 16, endIndent: 16),
                  ],
                  if (!isCompany) ...[
                    const DrawerSectionHeader('Saisie ONEFOP'),
                    DrawerNavItem(
                      icon: Icons.add_business_outlined,
                      label: 'Nouveau questionnaire',
                      subtitle: 'Saisie assistée',
                      onTap: () {
                        Navigator.pop(context);
                        _navigateToBlankForm();
                      },
                    ),
                  ],
                ]),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: DrawerLogoutButton(onTap: () => _confirmLogout(context)),
          ),
        ]),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 11 — NAV RAIL (tablet + desktop)
  // ═══════════════════════════════════════════════════════════

  Widget _buildNavRail(User user, String role, List<_Tab> tabs) {
    final expanded = _railExpanded && !context.isMobile;
    return AnimatedContainer(
      duration: UltraTheme.normal,
      width: expanded ? (context.isDesktop ? 260 : 200) : 72,
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        boxShadow: UltraTheme.softShadow,
      ),
      child: Column(children: [
        Container(
          padding:
              EdgeInsets.symmetric(horizontal: expanded ? 20 : 0, vertical: 24),
          child: Center(child: RailLogo(isExpanded: expanded)),
        ),
        const Divider(height: 1, indent: 12, endIndent: 12),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: tabs.length,
            itemBuilder: (_, i) => RailNavItem(
              icon: tabs[i].icon,
              label: tabs[i].label,
              isSelected: _selectedIndex == i,
              isExpanded: expanded,
              onTap: () => _selectTab(i, tabs),
            ),
          ),
        ),
        RailUserFooter(
          email: user.email,
          roleLabel: _roleLabel(role),
          isExpanded: expanded,
          onLogout: () => _confirmLogout(context),
        ),
      ]),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 12 — APP BAR (with filter button)
  // ═══════════════════════════════════════════════════════════

  PreferredSizeWidget _buildAppBar(
      BuildContext context, User user, String role, List<_Tab> tabs) {
    final isMobile = context.isMobile;
    final canFilter = _nationalRoles.contains(role);
    final filterActive = _filterRegion != null ||
        _filterDepartment != null ||
        _filterStatus != null;

    // The Analytics tab has its own in-page header (title + status + the
    // notification bell now live there — see OnefopDashboardScreen's
    // hero) — this shared chrome is fully redundant on desktop, so it
    // collapses to zero height to give that header the space instead.
    // Mobile keeps the full bar since it's the only way to open the nav
    // drawer there.
    final isAnalyticsTab = !isMobile &&
        tabs.isNotEmpty &&
        tabs[_selectedIndex.clamp(0, tabs.length - 1)].screen
            is OnefopDashboardScreen;

    if (isAnalyticsTab) {
      return const PreferredSize(
        preferredSize: Size.zero,
        child: SizedBox.shrink(),
      );
    }

    return AppBar(
      backgroundColor: isMobile ? UltraTheme.surface : UltraTheme.background,
      elevation: 0,
      scrolledUnderElevation: 0,
      toolbarHeight: 64,
      leading: isMobile
          ? Builder(
              builder: (ctx) => IconButton(
                icon: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: UltraTheme.primary.withValues(alpha: 0.08),
                    borderRadius:
                        BorderRadius.circular(UltraTheme.radiusMedium),
                  ),
                  child: const Icon(Icons.menu, size: 20),
                ),
                color: UltraTheme.textPrimary,
                onPressed: () => Scaffold.of(ctx).openDrawer(),
              ),
            )
          : IconButton(
              icon: Icon(_railExpanded ? Icons.menu_open : Icons.menu,
                  color: UltraTheme.textSecondary),
              onPressed: () => setState(() => _railExpanded = !_railExpanded),
              tooltip: _railExpanded ? 'Réduire le rail' : 'Étendre le rail',
            ),
      title: isMobile
          ? const Text('DSMO',
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: UltraTheme.textPrimary,
                letterSpacing: -0.5,
              ))
          : Row(children: [
              Text(
                tabs.isNotEmpty
                    ? tabs[_selectedIndex.clamp(0, tabs.length - 1)].label
                    : 'Tableau de bord',
                style: UltraTheme.displayMedium.copyWith(fontSize: 20),
              ),
              const SizedBox(width: 12),
              StatusBadge(
                  label: context.l10n.onlineStatusLabel,
                  color: UltraTheme.success,
                  icon: Icons.circle),
            ]),
      actions: [
        if (canFilter)
          IconButton(
            icon: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: filterActive
                    ? UltraTheme.primary.withValues(alpha: 0.15)
                    : UltraTheme.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
              ),
              child: Icon(
                Icons.tune_rounded,
                color: filterActive
                    ? UltraTheme.primary
                    : UltraTheme.textSecondary,
                size: 20,
              ),
            ),
            tooltip: 'Filtrer par région',
            onPressed: () => _openFilterSheet(tabs),
          ),
        const NotificationBell(),
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: _userPopupMenu(user, role),
        ),
      ],
    );
  }

  Future<void> _downloadAttestation() async {
    try {
      final url = await ref.read(apiClientProvider).getAttestationUrl();
      final launched =
          await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!launched && mounted) {
        _snack(context,
            message: context.l10n.attestationOpenError,
            type: SnackBarType.error);
      }
    } catch (e) {
      if (!mounted) return;
      _snack(context,
          message: e is ApiException
              ? e.message
              : context.l10n.attestationUnavailableError,
          type: SnackBarType.error);
    }
  }

  Widget _userPopupMenu(User user, String role) {
    return PopupMenuButton<String>(
      offset: const Offset(0, 48),
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(UltraTheme.radiusLarge)),
      elevation: 8,
      shadowColor: Colors.black.withValues(alpha: 0.1),
      color: UltraTheme.surface,
      icon: UserAvatar(email: user.email),
      onSelected: (v) {
        if (v == 'attestation') _downloadAttestation();
        if (v == 'logout') _confirmLogout(context);
      },
      itemBuilder: (_) => [
        PopupMenuItem(
          enabled: false,
          padding: const EdgeInsets.all(20),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            UserAvatar(email: user.email, size: 48, fontSize: 18),
            const SizedBox(height: 12),
            Text(user.email,
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: UltraTheme.textPrimary)),
            const SizedBox(height: 4),
            StatusBadge(label: _roleLabel(role), color: UltraTheme.primary),
            if (user.region != null) ...[
              const SizedBox(height: 8),
              Row(children: [
                const Icon(Icons.location_on_outlined,
                    size: 14, color: UltraTheme.textMuted),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    [
                      user.region!,
                      if (role == 'DIVISIONAL' && user.department != null)
                        user.department!,
                    ].join(' · '),
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        color: UltraTheme.textMuted),
                  ),
                ),
              ]),
            ],
          ]),
        ),
        if (role == 'COMPANY') ...[
          const PopupMenuDivider(),
          PopupMenuItem(
            value: 'attestation',
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: UltraTheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
                ),
                child: const Icon(Icons.picture_as_pdf_outlined,
                    color: UltraTheme.primary, size: 18),
              ),
              const SizedBox(width: 12),
              Flexible(
                child: Text(context.l10n.attestationMenuLabel,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: UltraTheme.textPrimary)),
              ),
            ]),
          ),
        ],
        const PopupMenuDivider(),
        PopupMenuItem(
          value: 'logout',
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Row(children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: UltraTheme.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
              ),
              child: const Icon(Icons.logout_rounded,
                  color: UltraTheme.error, size: 18),
            ),
            const SizedBox(width: 12),
            const Text('Déconnexion',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: UltraTheme.error)),
          ]),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 13 — BLANK FORM (non-company MINEFOP roles)
  // ═══════════════════════════════════════════════════════════

  void _navigateToBlankForm() {
    final userId = ref.read(authProvider).value?.id ?? 'guest';
    _push(OnefopUnifiedFormScreenV4(
      entityType: EntityType.enterprise,
      initialData: const {},
      userId: userId,
      onSave: (data) async {
        await DraftService.saveDraft(
            userId: userId, entityType: 'enterprise', data: data);
      },
      onCancel: () {
        if (mounted) Navigator.pop(context);
      },
      onSubmitSuccess: () async {
        await DraftService.clearDraft(userId: userId, entityType: 'enterprise');
      },
    ));
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 14 — BUILD
  // ═══════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    if (authState.isLoading) return _loadingScreen();
    if (authState.hasError) return _errorScreen('${authState.error}');

    final user = authState.value;
    if (user == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        router.go('/login');
      });
      return const Scaffold(
        backgroundColor: UltraTheme.background,
        body: Center(
            child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(UltraTheme.primary))),
      );
    }

    final role = _resolveRole(user);
    void onViewAll() {
      if (mounted) {
        _selectTab(1,
            _buildTabs(role, () => _openNewSubmissionDialog(context), () {}));
      }
    }

    final tabs =
        _buildTabs(role, () => _openNewSubmissionDialog(context), onViewAll);
    final safeIndex = _selectedIndex.clamp(0, tabs.length - 1);
    final isMobile = context.isMobile;

    assert(() {
      debugPrint(
        '👤 role=$role  '
        'region=${user.region}  '
        'dept=${user.department}',
      );
      return true;
    }());

    return ResponsiveScaffold(
      appBar: _buildAppBar(context, user, role, tabs),
      drawer: isMobile ? _buildDrawer(user, role) : null,
      railNav: isMobile ? null : _buildNavRail(user, role, tabs),
      body: Column(
        children: [
          Expanded(child: ContentShell(child: tabs[safeIndex].screen)),
        ],
      ),
      bottomNavigationBar: isMobile && tabs.length >= 2
          ? UltraBottomNavBar(
              tabs: tabs.map((t) => (icon: t.icon, label: t.label)).toList(),
              selectedIndex: safeIndex,
              onTap: (i) => _selectTab(i, tabs),
            )
          : null,
      floatingActionButton: null,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 15 — LOADING / ERROR STATE SCREENS
  // ═══════════════════════════════════════════════════════════

  Widget _loadingScreen() => Scaffold(
        backgroundColor: UltraTheme.background,
        body: Center(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const SizedBox(
              width: 48,
              height: 48,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                valueColor: AlwaysStoppedAnimation<Color>(UltraTheme.primary),
              ),
            ),
            const SizedBox(height: 20),
            Text('Chargement...', style: UltraTheme.bodyLarge),
          ]),
        ),
      );

  Widget _errorScreen(String message) => Scaffold(
        backgroundColor: UltraTheme.background,
        body: Center(
          child: Container(
            margin: const EdgeInsets.all(32),
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: UltraTheme.surface,
              borderRadius: BorderRadius.circular(UltraTheme.radiusXL),
              boxShadow: UltraTheme.softShadow,
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: UltraTheme.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(UltraTheme.radiusXL),
                ),
                child: const Icon(Icons.error_outline,
                    size: 36, color: UltraTheme.error),
              ),
              const SizedBox(height: 20),
              Text('Erreur de connexion', style: UltraTheme.titleLarge),
              const SizedBox(height: 8),
              Text(message,
                  textAlign: TextAlign.center, style: UltraTheme.bodyMedium),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  router.go('/login');
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: UltraTheme.primary,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(UltraTheme.radiusMedium)),
                  elevation: 0,
                ),
                child: const Text('Retour à la connexion',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        fontWeight: FontWeight.w600)),
              ),
            ]),
          ),
        ),
      );
}

// ═══════════════════════════════════════════════════════════════
// PRIVATE HELPER WIDGETS
// ═══════════════════════════════════════════════════════════════

class _FilterDropdown extends StatelessWidget {
  const _FilterDropdown({
    required this.hint,
    required this.value,
    required this.items,
    required this.onChanged,
  });
  final String hint;
  final String? value;
  final List<String> items;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: UltraTheme.background,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: value != null
              ? UltraTheme.primary.withValues(alpha: 0.4)
              : UltraTheme.textMuted.withValues(alpha: 0.2),
        ),
      ),
      child: DropdownButtonFormField<String>(
        initialValue: value,
        decoration: const InputDecoration(
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          isDense: true,
        ),
        hint: Text(hint,
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 14,
                color: UltraTheme.textMuted)),
        style: const TextStyle(
            fontFamily: 'Inter', fontSize: 14, color: UltraTheme.textPrimary),
        dropdownColor: UltraTheme.surface,
        borderRadius: BorderRadius.circular(12),
        items: [
          DropdownMenuItem<String>(
            value: null,
            child: Text(hint,
                style: const TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    color: UltraTheme.textMuted)),
          ),
          ...items.map((item) => DropdownMenuItem<String>(
                value: item,
                child: Text(item,
                    style: const TextStyle(fontFamily: 'Inter', fontSize: 14)),
              )),
        ],
        onChanged: onChanged,
      ),
    );
  }
}

class _ActiveFilterChip extends StatelessWidget {
  const _ActiveFilterChip({required this.label, required this.onRemove});
  final String label;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: UltraTheme.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: UltraTheme.primary.withValues(alpha: 0.2)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(label,
            style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: UltraTheme.primary)),
        const SizedBox(width: 6),
        GestureDetector(
          onTap: onRemove,
          child: const Icon(Icons.close_rounded,
              size: 14, color: UltraTheme.primary),
        ),
      ]),
    );
  }
}
