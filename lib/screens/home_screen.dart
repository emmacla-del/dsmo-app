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
//   SUPER_ADMIN     DSMO       SUPER_ADMIN_DSMO      DSMO only  (3 tabs)
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
import '../core/i18n/localized_text.dart';
import '../providers/auth_provider.dart';
import '../providers/providers.dart';
import '../data/api_client.dart' show ApiException;
import '../models/user.dart';
import '../theme/ultra_theme.dart';
import '../services/draft_service.dart';
import '../services/reference_cache_service.dart';
import '../providers/connectivity_provider.dart';
import '../providers/locations_provider.dart';
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
import 'onefop/onefop_form_constants.dart'
    show EntityType, entityTypeString, entityTypeForSchema;

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

  // "New declaration" (both DSMO and ONEFOP) gates on a network-first
  // active-period check (ReferenceCacheService.getFresh always awaits a
  // live fetch — see reference_cache_service.dart) before anything appears
  // on screen. Against a cold backend that round trip can take tens of
  // seconds, and with no feedback during the wait the tap looked like it
  // had done nothing. This flag drives a full-screen spinner overlay (see
  // build()) for the duration of whichever gate function is running,
  // regardless of which of its internal branches it takes.
  bool _navGateLoading = false;

  Future<void> _withNavGate(Future<void> Function() task) async {
    if (mounted) setState(() => _navGateLoading = true);
    try {
      await task();
    } finally {
      if (mounted) setState(() => _navGateLoading = false);
    }
  }

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
        return [
          _Tab(context.l10n.submissionsTitle, Icons.list_alt_outlined,
              const SubmissionsViewerScreen()),
          _Tab(context.l10n.analyticsTabLabel, Icons.bar_chart_outlined,
              const OnefopDashboardScreen()),
        ];

      case 'REGIONAL':
        // VETTING SUSPENDED: Removed pending queue, using viewer
        return [
          _Tab(context.l10n.submissionsTitle, Icons.list_alt_outlined,
              const SubmissionsViewerScreen()),
          _Tab(context.l10n.homeTabAnalyticsDsmo, Icons.bar_chart_outlined,
              const OnefopDashboardScreen()),
          _Tab(context.l10n.settingsTabNotifications,
              Icons.notifications_outlined, const SendNotificationScreen()),
        ];

      case 'CENTRAL':
        // VETTING SUSPENDED: Both DSMO and ONEFOP views
        return [
          _Tab(context.l10n.homeTabAnalyticsDsmo, Icons.bar_chart_outlined,
              const OnefopDashboardScreen()),
          _Tab(context.l10n.regionsSectorsOnefopSubmissionsStatLabel,
              Icons.assignment_outlined, const SubmissionsViewerScreen()),
          _Tab(context.l10n.settingsTabNotifications,
              Icons.notifications_outlined, const SendNotificationScreen()),
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
          _Tab(context.l10n.homeTabAnalyticsDsmo, Icons.bar_chart_outlined,
              const OnefopDashboardScreen()),
          _Tab(context.l10n.homeTabReports, Icons.description_outlined,
              const ReportScreen()),
          _Tab(context.l10n.homeTabCommunication, Icons.campaign_outlined,
              const CommunicationScreen()),
          _Tab(context.l10n.submissionsTitle, Icons.assignment_outlined,
              const SoumissionsScreen()),
          _Tab(context.l10n.annuaireLabel, Icons.contacts_outlined,
              const AnnuaireScreen()),
          _Tab(context.l10n.settingsTabLabel, Icons.settings_outlined,
              const SystemSettingsScreen()),
        ];
      case 'SUPER_ADMIN_DSMO':
        // DSMO-only admin without vetting. No "new declaration" FAB here —
        // this role reviews companies' declarations, it doesn't file its own.
        return [
          _Tab(context.l10n.declarationsTabLabel, Icons.folder_open_outlined,
              const DeclarationsListScreen()),
          _Tab(context.l10n.annuaireLabel, Icons.contacts_outlined,
              const AnnuaireScreen(showUsersTab: false)),
          _Tab(context.l10n.settingsTabNotifications,
              Icons.notifications_outlined, const SendNotificationScreen()),
        ];

      case 'SUPER_ADMIN_ONEFOP':
        // ONEFOP-only admin without vetting
        return [
          _Tab(context.l10n.dashboardFallbackTitle, Icons.dashboard_outlined,
              const OnefopDashboardScreen()),
          _Tab(context.l10n.submissionsTitle, Icons.list_alt_outlined,
              const SubmissionsViewerScreen()),
          _Tab(context.l10n.annuaireLabel, Icons.contacts_outlined,
              const AnnuaireScreen(showUsersTab: false)),
          _Tab(context.l10n.settingsTabNotifications,
              Icons.notifications_outlined, const SendNotificationScreen()),
        ];

      default:
        debugPrint(
          '⚠️ [HomeScreen] Unrecognised role: "$role" — '
          'showing fallback tabs. Check backend role strings.',
        );
        return [
          _Tab(context.l10n.settingsTabNotifications,
              Icons.notifications_outlined, const SendNotificationScreen()),
        ];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 3 — ROLE LABELS
  // ═══════════════════════════════════════════════════════════

  String _roleLabel(String role) {
    if (role == 'COMPANY') return context.l10n.roleLabelCompany;
    final labels = {
      'DIVISIONAL': context.l10n.roleLabelDivisional,
      'REGIONAL': context.l10n.roleLabelRegional,
      'CENTRAL': context.l10n.roleLabelCentral,
      'SUPER_ADMIN': context.l10n.roleLabelSuperAdmin,
      'SUPER_ADMIN_DSMO': context.l10n.roleLabelSuperAdminDsmo,
      'SUPER_ADMIN_ONEFOP': context.l10n.roleLabelSuperAdminOnefop,
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

    final regions = ref.read(locationRegionsProvider);
    final allLabel = context.l10n.allMasculine;
    final statuses = [
      allLabel,
      context.l10n.dsmoDraftBadge,
      context.l10n.statusSubmittedShort,
      context.l10n.approvedHistoricalStatusOption,
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final departments = ref.read(locationDepartmentsProvider(tempRegion));
          return Padding(
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
                  Text(context.l10n.filterByZoneTitle,
                      style: const TextStyle(
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
                      child: Text(context.l10n.clearButton,
                          style: const TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 13,
                              color: UltraTheme.textMuted)),
                    ),
                ]),
                const SizedBox(height: 20),
                // Region
                Text(context.l10n.pdfRegionLabel,
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: UltraTheme.textMuted)),
                const SizedBox(height: 8),
                _FilterDropdown(
                  hint: context.l10n.allRegionsCheckboxLabel,
                  value: tempRegion,
                  items: regions,
                  onChanged: (v) => setSheet(() {
                    tempRegion = v;
                    tempDept = null;
                  }),
                ),
                const SizedBox(height: 16),
                // Department
                Text(context.l10n.departmentDivisionLabel,
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: UltraTheme.textMuted)),
                const SizedBox(height: 8),
                _FilterDropdown(
                  hint: context.l10n.allDepartmentsHint,
                  value: departments.contains(tempDept) ? tempDept : null,
                  items: departments,
                  onChanged: (v) => setSheet(() => tempDept = v),
                ),
                const SizedBox(height: 16),
                // Status filter (NEW)
                Text(context.l10n.statusColumnHeader,
                    style: const TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: UltraTheme.textMuted)),
                const SizedBox(height: 8),
                _FilterDropdown(
                  hint: context.l10n.sendNotifAllStatusesHint,
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
                    if (tempStatus != null && tempStatus != allLabel)
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
                            tempStatus == allLabel ? null : tempStatus;
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
                    child: Text(context.l10n.applyFilterButton,
                        style: const TextStyle(
                            fontFamily: 'Inter',
                            fontWeight: FontWeight.w600,
                            fontSize: 15)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    ),
  );
}

  // ═══════════════════════════════════════════════════════════
  // SECTION 5 — ENTITY TYPE HELPERS
  // ═══════════════════════════════════════════════════════════
  //
  // Promoted to top-level functions (below the class) so they're directly
  // unit-testable — Dart's leading-underscore privacy is library-scoped,
  // so a private instance method cannot be called from a separate test
  // file. All of these are pure functions of their parameters (no `this`,
  // no BuildContext, no widget state), so top-level placement changes
  // nothing about behavior — see parseCompanyEntityType/
  // companyToInitialData/mapActivityToSector/mapCoopType/
  // mapEnterpriseSize/mapLegalStatus/mapAreaBack/setIfPresent below.

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
      // Same SubmissionRound this whole gate already reads from — S21Q01's
      // dynamic period wording rides along with it rather than fetching its
      // own copy. Missing/unparsable in the cached-offline case just falls
      // back to S21Q01's own "not set" wording; nothing else here depends
      // on these two.
      final campaignPeriodStart =
          DateTime.tryParse(activeQuarter['periodStart']?.toString() ?? '');
      final campaignPeriodEnd =
          DateTime.tryParse(activeQuarter['periodEnd']?.toString() ?? '');

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

      final parsedType = parseCompanyEntityType(entityType);
      if (parsedType == null) {
        if (!context.mounted) return;
        _snack(context,
            message: context.l10n.unknownEntityTypeError,
            type: SnackBarType.error);
        return;
      }
      final entityTypeStr = entityTypeForSchema(parsedType);

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

      var initialData = companyToInitialData(company, parsedType, user);

      // Inject hidden metadata — flows to backend but never renders as form fields
      initialData['__meta_establishment_id'] = establishmentId;
      initialData['__meta_tax_number'] = taxNumber;
      initialData['__meta_cnps_number'] = cnpsNumber;
      initialData['__meta_registration_number'] = registrationNumber;
      initialData['__meta_entity_type'] = entityTypeStr;
      initialData['__meta_quarter_code'] = activeQuarterCode;

      final existingDraft = resumeDraft ? localDraft : null;
      final merged = {...initialData, ...?existingDraft};

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
            // Acknowledgment is required for every new declaration. Only a
            // user explicitly resuming an existing draft may bypass the
            // notice after acknowledging it once.
            isReturningUser: resumeDraft && hasAcknowledged,
            // S0Q01/S0Q02 hold the respondent's name/quality — set
            // unconditionally by companyToInitialData for every entity type
            // (VT additionally mirrors them under VT1_15_NAME/FUNCTION),
            // sourced from the registration "Fonction" field or, for a
            // resumed draft, whatever the user has since entered themselves.
            respondentName: merged['S0Q01'] as String?,
            respondentFunction: merged['S0Q02'] as String?,
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
                  campaignPeriodStart: campaignPeriodStart,
                  campaignPeriodEnd: campaignPeriodEnd,
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

  /// Shown when the server has a newer draft than this device's local copy.
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
                  const LocalizedText(
                      fr: 'Brouillon plus récent trouvé',
                      en: 'A newer draft was found')
                    .of(context.loc),
                  style: UltraTheme.displayMedium.copyWith(fontSize: 22)),
              const SizedBox(height: 8),
              Text(
                  const LocalizedText(
                      fr: 'Un autre appareil a enregistré une version plus récente.',
                      en: 'Another device saved a newer version.')
                    .of(context.loc),
                  style: UltraTheme.bodyMedium),
              const SizedBox(height: 24),
              SubmissionOptionCard(
                  icon: Icons.cloud_download_outlined,
                  title: const LocalizedText(
                      fr: "Utiliser l'autre version",
                      en: 'Use the other version')
                    .of(context.loc),
                  subtitle: const LocalizedText(
                      fr: 'Depuis un autre appareil',
                      en: 'From another device')
                    .of(context.loc),
                  color: UltraTheme.primary,
                  onTap: () => Navigator.pop(ctx, true)),
              const SizedBox(height: 12),
              SubmissionOptionCard(
                  icon: Icons.smartphone_outlined,
                  title: const LocalizedText(
                      fr: 'Garder cet appareil', en: 'Keep this device')
                    .of(context.loc),
                  subtitle: const LocalizedText(
                      fr: 'Votre version actuelle',
                      en: 'Your current version')
                    .of(context.loc),
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
              const SizedBox(height: 8),
              EntityTypeCard(
                  icon: Icons.school,
                  label: const LocalizedText(
                          fr: 'Formation professionnelle',
                          en: 'Vocational Training')
                      .of(context.loc),
                  value: EntityType.vocationalTraining.apiValue,
                  onTap: () => Navigator.pop(
                      ctx, EntityType.vocationalTraining.apiValue)),
              const SizedBox(height: 8),
              EntityTypeCard(
                  icon: Icons.account_balance_outlined,
                  label: const LocalizedText(
                          fr: 'Administration publique (MINFOPRA)',
                          en: 'Public Administration (MINFOPRA)')
                      .of(context.loc),
                  value: EntityType.administration.apiValue,
                  onTap: () =>
                      Navigator.pop(ctx, EntityType.administration.apiValue)),
              const SizedBox(height: 8),
              EntityTypeCard(
                  icon: Icons.assignment_outlined,
                  label: const LocalizedText(
                          fr: 'Projet / Programme',
                          en: 'Project / Program')
                      .of(context.loc),
                  value: EntityType.projectProgram.apiValue,
                  onTap: () =>
                      Navigator.pop(ctx, EntityType.projectProgram.apiValue)),
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
      await _withNavGate(_openDsmoFormForCompany);
    } else if (result == 'onefop') {
      await _withNavGate(_openOnefopFormForCompany);
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
          Text(context.l10n.logoutDialogTitle,
              style: UltraTheme.displayMedium.copyWith(fontSize: 22)),
          const SizedBox(height: 8),
          Text(context.l10n.logoutConfirmBody,
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
                child: Text(context.l10n.logoutButton,
                    style: const TextStyle(
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
          action: SnackBarAction(
              label: context.l10n.okButton, textColor: color, onPressed: () {}),
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
                    DrawerSectionHeader(context.l10n.drawerSectionConsultation),
                    DrawerNavItem(
                      icon: Icons.list_alt_outlined,
                      label: context.l10n.submissionsTitle,
                      subtitle: context.l10n.drawerViewQuestionnairesSubtitle,
                      onTap: () {
                        Navigator.pop(context);
                        _push(const SubmissionsViewerScreen());
                      },
                    ),
                    const Divider(height: 32, indent: 16, endIndent: 16),
                  ],
                  if (isDsmoAdmin) ...[
                    DrawerSectionHeader(context.l10n.drawerSectionAdminDsmo),
                    DrawerNavItem(
                      icon: Icons.folder_open_outlined,
                      label: context.l10n.drawerDeclarationsDsmoLabel,
                      subtitle: context.l10n.drawerViewDeclarationsSubtitle,
                      onTap: () {
                        Navigator.pop(context);
                        _push(const DeclarationsListScreen());
                      },
                    ),
                    DrawerNavItem(
                      icon: Icons.contacts_outlined,
                      label: context.l10n.annuaireLabel,
                      subtitle: context.l10n.drawerAnnuaireSubtitle,
                      onTap: () {
                        Navigator.pop(context);
                        _push(const AnnuaireScreen());
                      },
                    ),
                    DrawerNavItem(
                      icon: Icons.password_outlined,
                      label: context.l10n.adminResetPasswordTitle,
                      subtitle: context.l10n.drawerResetPasswordSubtitle,
                      onTap: () {
                        Navigator.pop(context);
                        _push(const AdminResetPasswordScreen());
                      },
                    ),
                    const Divider(height: 32, indent: 16, endIndent: 16),
                  ],
                  if (isOnefopAdmin) ...[
                    DrawerSectionHeader(context.l10n.drawerSectionAdminOnefop),
                    DrawerNavItem(
                      icon: Icons.list_alt_outlined,
                      label: context.l10n.regionsSectorsOnefopSubmissionsStatLabel,
                      subtitle: context.l10n.drawerViewQuestionnairesSubtitle,
                      onTap: () {
                        Navigator.pop(context);
                        _push(const SubmissionsViewerScreen());
                      },
                    ),
                    if (!isDsmoAdmin) ...[
                      DrawerNavItem(
                        icon: Icons.contacts_outlined,
                        label: context.l10n.annuaireLabel,
                        subtitle: context.l10n.drawerAnnuaireSubtitle,
                        onTap: () {
                          Navigator.pop(context);
                          _push(const AnnuaireScreen());
                        },
                      ),
                      DrawerNavItem(
                        icon: Icons.password_outlined,
                        label: context.l10n.adminResetPasswordTitle,
                        subtitle: context.l10n.drawerResetPasswordSubtitle,
                        onTap: () {
                          Navigator.pop(context);
                          _push(const AdminResetPasswordScreen());
                        },
                      ),
                    ],
                    const Divider(height: 32, indent: 16, endIndent: 16),
                  ],
                  if (!isCompany) ...[
                    DrawerSectionHeader(context.l10n.drawerSectionSaisieOnefop),
                    DrawerNavItem(
                      icon: Icons.add_business_outlined,
                      label: context.l10n.drawerNewQuestionnaireLabel,
                      subtitle: context.l10n.drawerAssistedEntrySubtitle,
                      onTap: () {
                        Navigator.pop(context);
                        _withNavGate(_navigateToBlankForm);
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
      width: expanded ? (context.isDesktop ? 220 : 180) : 72,
      decoration: const BoxDecoration(
        color: UltraTheme.surface,
        border: Border(right: BorderSide(color: UltraTheme.border, width: 1)),
      ),
      child: Column(children: [
        Container(
          padding:
              EdgeInsets.fromLTRB(expanded ? 20 : 0, 18, expanded ? 12 : 0, 14),
          child: Row(
            children: [
              Expanded(child: Center(child: RailLogo(isExpanded: expanded))),
              _railToggleButton(expanded),
            ],
          ),
        ),
        const Divider(height: 1, indent: 0, endIndent: 0),
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

  Widget _railToggleButton(bool expanded) {
    return Tooltip(
      message: expanded
          ? context.l10n.navCollapseTooltip
          : context.l10n.navExpandTooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => setState(() => _railExpanded = !_railExpanded),
          borderRadius: BorderRadius.circular(9),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: expanded
                  ? UltraTheme.background
                  : UltraTheme.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(9),
              border: Border.all(
                  color: expanded
                      ? UltraTheme.border
                      : UltraTheme.primary.withValues(alpha: 0.2)),
              boxShadow: const [
                BoxShadow(
                    color: Color(0x100F172A), blurRadius: 5, offset: Offset(0, 2)),
              ],
            ),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 160),
              child: Icon(
                expanded ? Icons.chevron_left_rounded : Icons.chevron_right_rounded,
                key: ValueKey(expanded),
                size: 19,
                color: UltraTheme.primary,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 12 — APP BAR (with filter button)
  // ═══════════════════════════════════════════════════════════

  PreferredSizeWidget _buildAppBar(
      BuildContext context, User user, String role, List<_Tab> tabs) {
    final isMobile = context.isMobile;

    // The company portal owns its own page header (for example, the
    // declarations screen renders "My Declarations" with its primary action).
    // Keep the desktop rail, but remove the duplicate global title/status/user
    // bar so the portal content starts at the top of the workspace.
    if (role == 'COMPANY' && !isMobile) {
      return const PreferredSize(
        preferredSize: Size.zero,
        child: SizedBox.shrink(),
      );
    }

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
            : null,
          title: isMobile
            ? Text(
              role == 'COMPANY'
                  ? context.l10n.companyDeclMyDeclarationsTitle
                  : context.l10n.platformName,
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: UltraTheme.textPrimary,
                letterSpacing: -0.5,
              ))
          : Text(
              role == 'COMPANY'
                  ? context.l10n.companyDeclMyDeclarationsTitle
                  : (tabs.isNotEmpty
                      ? tabs[_selectedIndex.clamp(0, tabs.length - 1)].label
                      : context.l10n.dashboardFallbackTitle),
              style: UltraTheme.displayMedium.copyWith(fontSize: 20),
            ),
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
            tooltip: context.l10n.filterByRegionTooltip,
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
            Text(context.l10n.logoutDialogTitle,
                style: const TextStyle(
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

  Future<void> _navigateToBlankForm() async {
    final userId = ref.read(authProvider).value?.id ?? 'guest';
    final api = ref.read(apiClientProvider);
    // Same active-campaign gate/source as _openOnefopFormForCompany() above
    // — this "assisted entry" path used to skip it entirely and open the
    // form with no campaign context at all, which is why S21Q01 rendered
    // "not set to not set" here: campaignPeriodStart/End were never fetched
    // in the first place, not merely unavailable in time for first paint.
    Map<String, dynamic>? activeQuarter;
    try {
      activeQuarter = await _periodCache.getFresh(
        key: 'onefop_active_quarter',
        fetch: () => api.getActiveQuarter(),
      );
    } catch (_) {
      activeQuarter = null;
    }
    if (!mounted) return;
    if (activeQuarter == null || activeQuarter['isOpen'] != true) {
      if (!context.mounted) return;
      _snack(context,
          message: context.l10n.noOpenSubmissionPeriodError,
          type: SnackBarType.warning);
      return;
    }
    final campaignPeriodStart =
        DateTime.tryParse(activeQuarter['periodStart']?.toString() ?? '');
    final campaignPeriodEnd =
        DateTime.tryParse(activeQuarter['periodEnd']?.toString() ?? '');

    _push(OnefopUnifiedFormScreenV4(
      entityType: EntityType.enterprise,
      initialData: const {},
      userId: userId,
      campaignPeriodStart: campaignPeriodStart,
      campaignPeriodEnd: campaignPeriodEnd,
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

    return Stack(
      children: [
        ResponsiveScaffold(
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
        ),
        if (_navGateLoading) const _NavGateLoadingOverlay(),
      ],
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
            Text(context.l10n.loadingEllipsis, style: UltraTheme.bodyLarge),
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
              Text(context.l10n.connectionErrorTitle, style: UltraTheme.titleLarge),
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
                child: Text(context.l10n.backToLogin,
                    style: const TextStyle(
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
// ENTITY TYPE / COMPANY-PREFILL HELPERS (top-level — see SECTION 5 note
// above _HomeScreenState for why these are pure top-level functions
// rather than private instance methods)
// ═══════════════════════════════════════════════════════════════

/// Returns null for an unrecognized value — callers must handle that
/// explicitly (see the entityType-resolution guard in
/// _openOnefopFormForCompany) rather than silently defaulting to
/// Enterprise, which used to hand the wrong census questionnaire to
/// whichever company had an unrecognized/corrupt stored entityType.
EntityType? parseCompanyEntityType(String s) {
  switch (s.toUpperCase()) {
    case 'ENTERPRISE':
    case 'ENTREPRISE':
      return EntityType.enterprise;
    case 'COOPERATIVE':
      return EntityType.cooperative;
    case 'CTD':
      return EntityType.ctd;
    case 'ONG':
      return EntityType.ong;
    case 'ADMINISTRATION':
      return EntityType.administration;
    case 'PROJECT_PROGRAM':
      return EntityType.projectProgram;
    case 'VOCATIONAL_TRAINING':
      return EntityType.vocationalTraining;
    default:
      return null;
  }
}

String mapActivityToSector(String? activity) {
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

String? mapCoopType(String? v) =>
    (v == null || v.trim().isEmpty) ? null : v.trim();

String? mapEnterpriseSize(String? size) {
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

String? mapLegalStatus(String? s) {
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

String? mapAreaBack(dynamic area) {
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

void setIfPresent(Map<String, dynamic> data, String key, dynamic value) {
  if (value == null) return;
  final s = value.toString().trim();
  if (s.isNotEmpty) data[key] = s;
}

Map<String, dynamic> companyToInitialData(
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
      setIfPresent(data, 'S1Q01', mapLegalStatus(company['legalStatus'] as String?));
      setIfPresent(data, 'S1Q02', company['companyName'] ?? company['name']);
      setIfPresent(data, 'S1Q04_REGION', company['region']);
      setIfPresent(data, 'S1Q04_DEPT', company['department']);
      setIfPresent(data, 'S1Q04_SUBDIV', company['subdivision']);
      setIfPresent(data, 'S1Q04_LOCALITY', company['address']);
      final aEnt = mapAreaBack(company['area']);
      if (aEnt != null) data['S1Q03'] = aEnt;
      setIfPresent(data, 'S1Q05_TEL1', company['phone']);
      setIfPresent(data, 'S1Q05_TEL2', company['phone2']);
      setIfPresent(data, 'S1Q05_BP', company['poBox']);
      setIfPresent(data, 'S1Q05_EMAIL', company['email']);
      final act = (company['mainActivity'] as String? ?? '').trim();
      final br = (company['branch'] as String? ?? '').trim();
      if (act.isNotEmpty) {
        data['S1Q06'] = mapActivityToSector(act);
        data['S1Q08'] = act;
      }
      if (br.isNotEmpty) data['S1Q07'] = br;
      setIfPresent(data, 'S1Q09', company['address']);
      setIfPresent(data, 'S1Q10', company['totalEmployees']?.toString());
      setIfPresent(data, 'S1Q12',
          mapEnterpriseSize(company['enterpriseSize'] as String?));
      break;

    case EntityType.cooperative:
      setIfPresent(data, 'COOP_S1Q01', company['cooperativeName'] ?? company['name']);
      setIfPresent(data, 'COOP_S1Q02',
          company['cooperativeHeadOffice'] ?? company['address']);
      setIfPresent(data, 'COOP_S1Q03', company['yearOfCreation']?.toString());
      setIfPresent(data, 'COOP_S1Q05_REGION', company['region']);
      setIfPresent(data, 'COOP_S1Q05_DEPT', company['department']);
      setIfPresent(data, 'COOP_S1Q05_SUBDIV', company['subdivision']);
      setIfPresent(data, 'COOP_S1Q05_LOCALITY',
          company['cooperativeHeadOffice'] ?? company['address']);
      final aCoop = mapAreaBack(company['area']);
      if (aCoop != null) data['COOP_S1Q04'] = aCoop;
      setIfPresent(data, 'COOP_S1Q06_TEL1', company['phone']);
      setIfPresent(data, 'COOP_S1Q06_TEL2', company['phone2']);
      setIfPresent(data, 'COOP_S1Q06_BP', company['poBox']);
      final coopAct = (company['mainActivity'] as String? ?? '').trim();
      final coopBr = (company['branch'] as String? ?? '').trim();
      if (coopAct.isNotEmpty) {
        data['COOP_S1Q07'] = mapActivityToSector(coopAct);
        data['COOP_S1Q09'] = coopAct;
      }
      if (coopBr.isNotEmpty) data['COOP_S1Q08'] = coopBr;
      setIfPresent(data, 'COOP_S1Q10',
          mapCoopType(company['cooperativeType'] as String?));
      setIfPresent(data, 'COOP_S1Q10_OTHER', company['cooperativeTypeOther']);
      setIfPresent(data, 'COOP_S1Q11', company['totalEmployees']?.toString());
      break;

    case EntityType.ctd:
      setIfPresent(data, 'CTD_S1Q01', company['ctdType']);
      setIfPresent(data, 'CTD_S1Q02', company['councilType']);
      setIfPresent(data, 'CTD_S1Q03', company['yearOfCreation']?.toString());
      setIfPresent(data, 'CTD_S1Q05_REGION', company['region']);
      setIfPresent(data, 'CTD_S1Q05_DEPT', company['department']);
      setIfPresent(data, 'CTD_S1Q05_SUBDIV', company['subdivision']);
      setIfPresent(data, 'CTD_S1Q05_LOCALITY', company['address']);
      final aCtd = mapAreaBack(company['area']);
      if (aCtd != null) data['CTD_S1Q04'] = aCtd;
      setIfPresent(data, 'CTD_S1Q06_TEL1', company['phone']);
      setIfPresent(data, 'CTD_S1Q06_TEL2', company['phone2']);
      setIfPresent(data, 'CTD_S1Q06_BP', company['poBox']);
      final ctdAct = (company['mainActivity'] as String? ?? '').trim();
      final ctdBr = (company['branch'] as String? ?? '').trim();
      if (ctdAct.isNotEmpty) data['CTD_S1Q07'] = mapActivityToSector(ctdAct);
      if (ctdBr.isNotEmpty) data['CTD_S1Q08'] = ctdBr;
      setIfPresent(data, 'CTD_S1Q01_NAME', company['ctdName'] ?? company['name']);
      setIfPresent(data, 'CTD_S1Q09', company['totalEmployees']?.toString());
      break;

    case EntityType.ong:
      setIfPresent(data, 'ONG_S1Q01', company['ngoName'] ?? company['name']);
      setIfPresent(data, 'ONG_S1Q02', company['address']);
      setIfPresent(data, 'ONG_S1Q03', company['yearOfCreation']?.toString());
      setIfPresent(data, 'ONG_S1Q05_REGION', company['region']);
      setIfPresent(data, 'ONG_S1Q05_DEPT', company['department']);
      setIfPresent(data, 'ONG_S1Q05_SUBDIV', company['subdivision']);
      setIfPresent(data, 'ONG_S1Q05_LOCALITY', company['address']);
      final aOng = mapAreaBack(company['area']);
      if (aOng != null) data['ONG_S1Q04'] = aOng;
      setIfPresent(data, 'ONG_S1Q06_TEL1', company['phone']);
      setIfPresent(data, 'ONG_S1Q06_TEL2', company['phone2']);
      setIfPresent(data, 'ONG_S1Q06_BP', company['poBox']);
      final ongAct = (company['mainActivity'] as String? ?? '').trim();
      final ongBr = (company['branch'] as String? ?? '').trim();
      if (ongAct.isNotEmpty) data['ONG_S1Q07'] = mapActivityToSector(ongAct);
      if (ongBr.isNotEmpty) data['ONG_S1Q08'] = ongBr;
      setIfPresent(data, 'ONG_S1Q09', company['mainMission']);
      setIfPresent(data, 'ONG_S1Q10', company['totalEmployees']?.toString());
      break;
    case EntityType.vocationalTraining:
      setIfPresent(data, 'VT1_1', company['establishmentId']);
      setIfPresent(data, 'VT1_2', company['centerName'] ?? company['name']);
      setIfPresent(data, 'VT1_3', company['sigle']);
      setIfPresent(data, 'VT1_4', company['region']);
      setIfPresent(data, 'VT1_5', company['department']);
      setIfPresent(data, 'VT1_6', company['subdivision']);
      // VT1_7 (Commune) has no Company column and no analog anywhere in
      // the shared schema (no other entity has this geo concept either)
      // — not prefilled; genuine business/schema decision, not invented
      // here. VT1_8 (Quartier/Village) reuses company['address'] — the
      // same approximation every other entity type already makes for its
      // own LOCALITY field (S1Q04_LOCALITY, COOP_S1Q05_LOCALITY,
      // CTD_S1Q05_LOCALITY, ONG_S1Q05_LOCALITY all map to company['address']
      // above), not a VT-specific weakening.
      setIfPresent(data, 'VT1_8', company['address']);
      final aVt = mapAreaBack(company['area']);
      if (aVt != null) data['VT1_9'] = aVt;
      setIfPresent(data, 'VT1_10', company['educationSystem']);
      setIfPresent(data, 'VT1_11', company['cfpType']);
      setIfPresent(data, 'VT1_12', company['functionalStatus']);
      setIfPresent(data, 'VT1_13', company['nonFunctionalReason']);
      setIfPresent(data, 'VT1_13_OTHER', company['nonFunctionalReasonOther']);
      setIfPresent(data, 'VT1_14', company['yearOfCreation']?.toString());
      // VT has no synthetic Section 0 — its respondent fields (§1.15)
      // are declared under its own Section 1 AST keys, not the shared
      // S0Q01/S0Q02/S0Q03_* keys set above for the other six entities.
      // Reuse the same already-resolved respondent values.
      if (fullName.isNotEmpty) data['VT1_15_NAME'] = fullName;
      if (fn.isNotEmpty) data['VT1_15_FUNCTION'] = fn;
      if (phone1.isNotEmpty) data['VT1_15_TEL1'] = phone1;
      if (phone2.isNotEmpty) data['VT1_15_TEL2'] = phone2;
      setIfPresent(data, 'VT1_15_EMAIL', user?.email);
      // VT1_15_SEX has no source anywhere (not captured at
      // registration, not on OnefopRespondent) — correctly left
      // unprefilled rather than invented.
      setIfPresent(data, 'VT1_16_NAME', company['promoterName']);
      setIfPresent(data, 'VT1_16_SEX', company['promoterSex']);
      setIfPresent(data, 'VT1_16_TEL1', company['promoterPhone1']);
      setIfPresent(data, 'VT1_16_TEL2', company['promoterPhone2']);
      break;

    case EntityType.administration:
      setIfPresent(data, 'ADMIN_S1Q01', company['administrationName'] ?? company['name']);
      setIfPresent(data, 'ADMIN_S1Q02', company['sigle'] ?? company['shortName']);
      final aAdmin = mapAreaBack(company['area']);
      if (aAdmin != null) data['ADMIN_S1Q03'] = aAdmin;
      setIfPresent(data, 'ADMIN_S1Q04_REGION', company['region']);
      setIfPresent(data, 'ADMIN_S1Q04_DEPT', company['department']);
      setIfPresent(data, 'ADMIN_S1Q04_SUBDIV', company['subdivision']);
      setIfPresent(data, 'ADMIN_S1Q04_LOCALITY', company['address']);
      setIfPresent(data, 'ADMIN_S1Q05_TEL1', company['phone']);
      setIfPresent(data, 'ADMIN_S1Q05_TEL2', company['phone2']);
      setIfPresent(data, 'ADMIN_S1Q05_BP', company['poBox']);
      final adminAct = (company['mainActivity'] as String? ?? '').trim();
      final adminBr = (company['branch'] as String? ?? '').trim();
      if (adminAct.isNotEmpty) data['ADMIN_S1Q06'] = mapActivityToSector(adminAct);
      if (adminBr.isNotEmpty) data['ADMIN_S1Q07'] = adminBr;
      setIfPresent(data, 'ADMIN_S1Q08', company['mainMission']);
      break;

    case EntityType.projectProgram:
      setIfPresent(data, 'PP_S1Q02', company['projectName'] ?? company['name']);
      setIfPresent(data, 'PP_S1Q03', company['sigle'] ?? company['shortName']);
      setIfPresent(data, 'PP_S1Q04', company['promoterName'] ?? (fullName.isNotEmpty ? fullName : null));
      final aPp = mapAreaBack(company['area']);
      if (aPp != null) data['PP_S1Q05'] = aPp;
      setIfPresent(data, 'PP_S1Q06_REGION', company['region']);
      setIfPresent(data, 'PP_S1Q06_DEPT', company['department']);
      setIfPresent(data, 'PP_S1Q06_SUBDIV', company['subdivision']);
      setIfPresent(data, 'PP_S1Q06_LOCALITY', company['address']);
      setIfPresent(data, 'PP_S1Q07_TEL1', company['phone']);
      setIfPresent(data, 'PP_S1Q07_TEL2', company['phone2']);
      setIfPresent(data, 'PP_S1Q07_BP', company['poBox']);
      final ppAct = (company['mainActivity'] as String? ?? '').trim();
      final ppBr = (company['branch'] as String? ?? '').trim();
      if (ppAct.isNotEmpty) data['PP_S1Q08'] = mapActivityToSector(ppAct);
      if (ppBr.isNotEmpty) data['PP_S1Q09'] = ppBr;
      setIfPresent(data, 'PP_S1Q10', company['mainMission']);
      setIfPresent(data, 'PP_S1Q11', company['address']);
      setIfPresent(data, 'PP_S1Q15', company['totalEmployees']?.toString());
      break;
  }
  return data;
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

/// Full-screen scrim + spinner shown while a "new declaration" entry point
/// (_openOnefopFormForCompany / _openDsmoFormForCompany /
/// _navigateToBlankForm, via _withNavGate) is mid-flight — those all gate
/// on a network-first active-period check with no visual feedback of their
/// own, which against a slow/cold backend read as the tap having done
/// nothing. Absorbs taps (IgnorePointer would let them fall through to
/// whatever's underneath) so a second tap can't fire the same gate twice.
class _NavGateLoadingOverlay extends StatelessWidget {
  const _NavGateLoadingOverlay();

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: AbsorbPointer(
        child: Container(
          color: Colors.black.withValues(alpha: 0.15),
          child: const Center(
            child: SizedBox(
              width: 48,
              height: 48,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                valueColor: AlwaysStoppedAnimation<Color>(UltraTheme.primary),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
