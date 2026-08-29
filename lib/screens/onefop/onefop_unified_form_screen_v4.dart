// lib/screens/onefop/onefop_unified_form_screen_v4.dart
// ══════════════════════════════════════════════════════════════
// PIXEL-PERFECT UNIFIED FORM RENDERER  (v9.0 — refactored)
//
// Architecture: Controller + Widgets + Engine + Constants
//  - onefop_form_controller.dart  → all state & business logic
//  - onefop_form_widgets.dart     → all UI widgets
//  - onefop_table_engine.dart     → cell ID generation & recalc dispatch
//  - onefop_form_constants.dart   → enums, maps, helpers
//
// USAGE in other files:
//   import 'onefop_unified_form_screen_v4.dart' show OnefopUnifiedFormScreenV4;
//   import 'onefop_form_constants.dart' show EntityType;
// ══════════════════════════════════════════════════════════════

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

// ── Core schema imports ──────────────────────────────────────
import '../../core/i18n/l10n_ext.dart';
import '../../core/i18n/localized_text.dart';
import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/schema/section_schema.dart';
import '../../core/focus/renderers/onefop_layout_constants.dart';
import '../../core/focus/renderers/onefop_section_renderer.dart';

// ── App-wide widgets ─────────────────────────────────────────
import '../../data/api_client.dart';
import '../../services/draft_service.dart';
import '../../services/sync_queue_service.dart';
import '../../widgets/pdf_viewer_screen.dart';
import '../../widgets/drafts_drawer.dart';
import '../../providers/connectivity_provider.dart';
import '../../providers/sync_queue_provider.dart';
import '../../providers/auth_provider.dart';
import '../dashboards/company_workspace_dashboard.dart' show companyWorkspaceProvider;

// ── Screen-local modules ─────────────────────────────────────
import '../../providers/onefop_mode_provider.dart';
import 'onefop_form_constants.dart';
import 'onefop_form_controller.dart';
import 'onefop_form_widgets.dart';
import 'onefop_section_units.dart';
import 'onefop_table_engine.dart';
import 'excel/onefop_excel_shell.dart';
import 'simple_mode_shell.dart';

class OnefopUnifiedFormScreenV4 extends StatefulWidget {
  final EntityType entityType;
  final Map<String, dynamic> initialData;
  final String? establishmentId;
  final String? companyId;
  final String? quarterCode;
  // The active campaign's data-collection window — see
  // OnefopFormController.campaignPeriodStart/End for how S21Q01 consumes
  // these instead of a hard-coded date.
  final DateTime? campaignPeriodStart;
  final DateTime? campaignPeriodEnd;
  final void Function(Map<String, dynamic>) onSave;
  final VoidCallback? onCancel;
  final String? userId;
  final VoidCallback? onSubmitSuccess;

  /// True when the "is the submission period open" check that gated entry
  /// to this screen (home_screen.dart) had to fall back to a cached/stale
  /// result instead of a live one — surfaced so the user knows the real
  /// check happens server-side at submit, not now.
  final bool periodCheckedOffline;

  const OnefopUnifiedFormScreenV4({
    super.key,
    required this.entityType,
    required this.initialData,
    this.establishmentId,
    this.companyId,
    this.quarterCode,
    this.campaignPeriodStart,
    this.campaignPeriodEnd,
    required this.onSave,
    this.onCancel,
    this.userId,
    this.onSubmitSuccess,
    this.periodCheckedOffline = false,
  });

  @override
  State<OnefopUnifiedFormScreenV4> createState() => _State();
}

class _State extends State<OnefopUnifiedFormScreenV4> {
  late final OnefopFormController _ctrl;
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  // Reset per section build; staggers each table field's reveal so a
  // heavy page (many big tables) doesn't build them all in one frame.
  int _tableStagger = 0;

  @override
  void initState() {
    super.initState();
    _ctrl = OnefopFormController(
      entityType: widget.entityType,
      initialData: widget.initialData,
      establishmentId: widget.establishmentId,
      companyId: widget.companyId,
      quarterCode: widget.quarterCode,
      campaignPeriodStart: widget.campaignPeriodStart,
      campaignPeriodEnd: widget.campaignPeriodEnd,
      onSave: widget.onSave,
      onCancel: widget.onCancel,
      userId: widget.userId,
      onSubmitSuccess: widget.onSubmitSuccess,
    );
    _ctrl.initialize();
    _ctrl.addListener(_onControllerChange);
    if (_ctrl.resumedFromSavedPosition) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _showResumeToast());
    }
  }

  @override
  void dispose() {
    _ctrl.flushPendingSave();
    _ctrl.removeListener(_onControllerChange);
    _ctrl.dispose();
    super.dispose();
  }

  void _onControllerChange() {
    if (mounted) setState(() {});
  }

  /// The current quarter's draft comes from local storage first (instant,
  /// works offline). When online, other quarters' server-side drafts are
  /// merged in too, so the drawer doubles as cleanup for drafts left behind
  /// from earlier, now-closed submission rounds.
  Future<List<DraftSummary>> _fetchDraftSummaries() async {
    final result = <DraftSummary>[];
    final establishmentId = widget.establishmentId;
    final quarterCode = widget.quarterCode;

    if (establishmentId != null && quarterCode != null) {
      final local = await DraftService.loadDraft(
          establishmentId: establishmentId, quarterCode: quarterCode);
      if (local != null) {
        final updatedAt = await DraftService.getSavedAt(
                establishmentId: establishmentId, quarterCode: quarterCode) ??
            DateTime.now();
        result.add(DraftSummary(
          key: quarterCode,
          label: '$quarterCode · ${entityTypeString(widget.entityType)}',
          updatedAt: updatedAt,
        ));
      }
    }

    final hasLocalForCurrentQuarter = result.isNotEmpty;
    try {
      final serverDrafts = await ApiClient().getOnefopDrafts();
      for (final d in serverDrafts) {
        final code = d['quarterCode'] as String? ?? '';
        if (hasLocalForCurrentQuarter && code == quarterCode) continue;
        final entityType = d['entityType'] as String? ?? '';
        final updatedAt =
            DateTime.tryParse(d['lastSavedAt'] as String? ?? '') ??
                DateTime.now();
        result.add(DraftSummary(
          key: code,
          label: '$code · $entityType',
          updatedAt: updatedAt,
        ));
      }
    } catch (_) {
      // Offline — only the local entry (if any) is shown.
    }
    return result;
  }

  Future<void> _deleteDraft(String quarterCode) async {
    final establishmentId = widget.establishmentId;
    if (establishmentId != null) {
      await DraftService.clearDraft(
          establishmentId: establishmentId, quarterCode: quarterCode);
    }
    final api = ApiClient();
    try {
      await api.deleteOnefopDraft(quarterCode);
    } on ApiException catch (e) {
      // No connectivity — queue the delete so a stale draft doesn't linger
      // server-side forever; the local copy is already gone either way.
      if (e.statusCode == null) {
        await SyncQueueService(api).enqueue(
          method: 'delete',
          path: '/onefop/draft/$quarterCode',
          payload: const {},
          label: 'Suppression brouillon ONEFOP $quarterCode',
        );
      }
    } catch (_) {
      // Best-effort — the local copy is already gone.
    }
  }

  // ═══════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final title = 'ONEFOP — ${entityTypeTitle(widget.entityType).of(locale)}';
    final desktop = MediaQuery.of(context).size.width >= OL.pageWidth;

    if (_ctrl.loading) {
      return Scaffold(
        backgroundColor: kCanvas,
        appBar: OnefopAppBar(
          title: title,
          loading: true,
          saving: false,
          dirty: false,
          onCancel: widget.onCancel,
        ),
        body: const SkeletonScreen(),
      );
    }

    if (_ctrl.error != null || _ctrl.schema == null) {
      return Scaffold(
        backgroundColor: kCanvas,
        appBar: OnefopAppBar(
          title: title,
          loading: false,
          saving: false,
          dirty: false,
          onCancel: widget.onCancel,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 56, color: kDanger),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text('${context.l10n.errorLabel} : ${_ctrl.error}',
                    style: const TextStyle(color: kDanger, fontSize: 14),
                    textAlign: TextAlign.center),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _ctrl.initialize,
                style: ElevatedButton.styleFrom(
                  backgroundColor: kAccent,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(kRadiusSm)),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                child: Text(context.l10n.retry,
                    style: const TextStyle(color: Colors.white, fontSize: 14)),
              ),
            ],
          ),
        ),
      );
    }

    // Consumer rather than converting the whole State to ConsumerState —
    // this is the only spot that needs ref, to push the local draft to the
    // server as soon as connectivity returns (local writes always succeed
    // via _ctrl's autosave; this is just the best-effort sync half).
    return Consumer(
      builder: (context, ref, _) {
        ref.listen<bool>(isOnlineProvider, (previous, next) {
          if (previous == false && next == true) _ctrl.flushPendingSave();
        });
        final mode = ref.watch(onefopModeProvider);
        void onModeChanged(OnefopViewMode m) =>
            ref.read(onefopModeProvider.notifier).setMode(m);
        // Both desktop modes now carry their own single title bar
        // (OnefopShellTitleBar — title, save status, mode switch, drafts,
        // dashboard — see OnefopExcelShell and SimpleModeShell), sitting
        // next to the Sidebar's own logo header, so the outer white app bar
        // here would just repeat that chrome one level up. Only mobile,
        // which has no bar of its own, keeps it.
        return Scaffold(
          key: _scaffoldKey,
          backgroundColor: kCanvas,
          endDrawer: DraftsDrawer(
            title: 'Brouillon / Draft',
            fetchDrafts: _fetchDraftSummaries,
            onSaveNow: () async => _ctrl.flushPendingSave(),
            onDelete: (draft) => _deleteDraft(draft.key),
          ),
          appBar: desktop
              ? null
              : OnefopAppBar(
                  title: title,
                  loading: false,
                  saving: _ctrl.saving,
                  dirty: _ctrl.dirty,
                  onCancel: widget.onCancel,
                  onOpenDrafts: () => _scaffoldKey.currentState?.openEndDrawer(),
                ),
          body: Column(
            children: [
              if (widget.periodCheckedOffline) _offlinePeriodBanner(),
              Expanded(
                child: desktop
                    ? _desktopLayout(mode, onModeChanged)
                    : _mobileLayout(),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Shown when the entry-point period check (home_screen.dart) had to
  /// fall back to a cached result instead of a live one.
  Widget _offlinePeriodBanner() => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        color: kAccent.withValues(alpha: 0.08),
        child: Row(
          children: [
            const Icon(Icons.wifi_off, color: kAccent, size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                const LocalizedText(
                  fr:
                      'Période vérifiée hors ligne — sera revalidée lors de l\'envoi.',
                  en: 'Period checked offline — will be re-verified on submit.',
                ).of(context.loc),
                style: const TextStyle(fontSize: 12.5, color: kAccent),
              ),
            ),
          ],
        ),
      );

  // ═══════════════════════════════════════════════════════════
  // LAYOUTS
  // ═══════════════════════════════════════════════════════════

  // The card-based Sidebar+CustomScrollView tree this replaced is now only
  // used on mobile (_mobileLayout below) — desktop renders either the
  // Excel/spreadsheet-style sheet (Spreadsheet Mode) or the guided
  // SimpleModeShell (Simple Mode), per the desktop-only mode toggle in the
  // app bar (see onefop_mode_provider.dart). Both this and mobile share
  // the same OnefopFormController, so autosave/validation/submit are
  // identical across all three; only the visual chrome differs. See
  // lib/screens/onefop/excel/ for the spreadsheet shell + row widgets.
  Widget _desktopLayout(
      OnefopViewMode mode, void Function(OnefopViewMode) onModeChanged) {
    final title = 'ONEFOP — ${entityTypeTitle(widget.entityType).of(context.loc)}';
    if (mode == OnefopViewMode.simple) {
      // The vertical section nav (Sidebar) is desktop-only chrome, shared
      // with OnefopExcelShell below rather than duplicated — mobile is the
      // only layout that should ever lack it. SimpleModeShell itself stays
      // sidebar-less (see its own doc comment) since Spreadsheet Mode wraps
      // it the same way, one level up, instead of owning it internally.
      return Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Sidebar(ctrl: _ctrl, entityType: widget.entityType),
          Container(width: 1, color: kBorder),
          Expanded(
            child: SimpleModeShell(
              ctrl: _ctrl,
              entityType: widget.entityType,
              buildField: _buildField,
              onPreviewSubmit: _previewSubmit,
              title: title,
              dirty: _ctrl.dirty,
              saving: _ctrl.saving,
              onSaveNow: _ctrl.saveNow,
              onOpenDrafts: () => _scaffoldKey.currentState?.openEndDrawer(),
              onCancel: widget.onCancel,
              mode: mode,
              onModeChanged: onModeChanged,
            ),
          ),
        ],
      );
    }
    return OnefopExcelShell(
      ctrl: _ctrl,
      entityType: widget.entityType,
      title: title,
      onPreviewSubmit: _previewSubmit,
      onOpenDrafts: () => _scaffoldKey.currentState?.openEndDrawer(),
      onCancel: widget.onCancel,
      mode: mode,
      onModeChanged: onModeChanged,
    );
  }

  Widget _mobileLayout() {
    return Column(children: [
      Container(
        decoration: const BoxDecoration(
          color: kSurface,
          border: Border(bottom: BorderSide(color: kBorder, width: 1)),
        ),
        child: MobileContextHeader(ctrl: _ctrl),
      ),
      Expanded(
        child: CustomScrollView(
          controller: _ctrl.mainScroll,
          slivers: [
            ..._sectionSlivers(),
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    ]);
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION SLIVERS
  // ═══════════════════════════════════════════════════════════

  // Non-blocking coherence hints (e.g. recruitments re-partitioned by
  // diploma not matching the permanent+temporary total) — see
  // onefop_coherence_checker.dart. Shown regardless of which section is
  // currently open since the mismatched tables are often a section apart.
  Widget _coherenceBanner() {
    final flags = _ctrl.coherenceFlags;
    return SliverToBoxAdapter(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: kScrollChildWidth),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: kWarning.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(kRadiusSm),
              border: Border.all(color: kWarning.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.rule_outlined, size: 16, color: kWarning),
                    const SizedBox(width: 8),
                    Text(
                      flags.length == 1
                          ? context.l10n.inconsistencyDetectedTitle
                          : context.l10n
                              .inconsistenciesDetectedTitle(flags.length),
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: kWarning,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                for (final flag in flags)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      '• ${flag.message.of(context.loc)}',
                      style: const TextStyle(fontSize: 12, color: kInkSoft),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Mobile only: the desktop sidebar's "N missing" chip
  // (_SidebarPageItem) doesn't exist on mobile, so a user who fails to
  // advance would otherwise only see pass/fail on the stepper dot with
  // no indication of *what's* still missing. Mirrors the sidebar chip's
  // own data source (ctrl.missingLabels) so the two never disagree.
  Widget _validationBanner(SectionSchema sec) {
    final missing = _ctrl.missingLabels(sec, context.loc);
    return SliverToBoxAdapter(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: kScrollChildWidth),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: kDangerSoft,
              borderRadius: BorderRadius.circular(kRadiusSm),
              border: Border.all(color: kDanger.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.error_outline, size: 16, color: kDanger),
                    const SizedBox(width: 8),
                    Text(
                      missing.length == 1
                          ? context.l10n.missingFieldTitle
                          : context.l10n.missingFieldsTitle(missing.length),
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: kDanger,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                for (final label in missing)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('• $label',
                        style: const TextStyle(fontSize: 12, color: kInkSoft)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // One table/question-group at a time, mirroring the desktop excel
  // shell's ExcelSectionBody — see onefop_section_units.dart for the
  // shared unit model + advance/retreat/scroll-into-view logic.
  Widget _sectionUnitBody(SectionSchema sec) {
    final locale = context.loc;
    final units = buildTableGroupUnits(
      _ctrl,
      sec,
      locale,
      entityType: widget.entityType,
      simpleFieldsBuilder: (fields, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final f in fields) ...[
            if (_ctrl.dividerLabel(f.id, locale) != null)
              OnefopDividerLabel(label: _ctrl.dividerLabel(f.id, locale)!),
            _buildField(f),
          ],
        ],
      ),
      mobile: true,
    );
    if (units.isEmpty) return const SizedBox.shrink();

    final currentIdx = (_ctrl.unitCursor(sec.id) ?? currentUnitIndex(_ctrl, units))
        .clamp(0, units.length - 1);
    final unit = units[currentIdx];
    final isFirst = currentIdx == 0;
    final isLast = currentIdx == units.length - 1;
    // True end of the whole form — see UnitNavRow.isSubmit doc comment for
    // why this is the only place left to offer Submit on mobile now that
    // the page-level NavBar (which duplicated this same Précédent/Suivant
    // pair everywhere else) is gone.
    final isFormEnd = isLast && _ctrl.currentPage == _ctrl.pageCount - 1;

    _ctrl.setRevealedFieldIds(unit.fieldIds);
    _ctrl.setRevealBoundaryActions(
      forward: isFormEnd
          ? () => _previewSubmit()
          : isLast
              ? () => advanceToNextSection(_ctrl)
              : () => advanceToUnit(_ctrl, sec, units, currentIdx),
      backward: isFirst
          ? () => retreatToPreviousSection(_ctrl)
          : () => retreatToUnit(_ctrl, sec, units, currentIdx),
    );

    return SizedBox(
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          OnefopSectionMap(
            ctrl: _ctrl,
            units: units,
            currentIndex: currentIdx,
            onJump: (i) => jumpToUnit(_ctrl, sec, units, i),
            onJumpToLocation: (i) => jumpToLocation(_ctrl, sec, units, i),
          ),
          KeyedSubtree(
            key: _ctrl.keyForUnit(unit.key),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                UnitTransition(
                  child: KeyedSubtree(key: ValueKey(unit.key), child: unit.content()),
                ),
                // showNext is unconditional now — this row is the only
                // Précédent/Suivant/Soumettre control left on mobile (the
                // page-level NavBar that used to duplicate it is gone), so
                // it has to keep rendering all the way through the very
                // last unit of the very last section instead of hiding
                // once this section's own units run out.
                UnitNavRow(
                  showBack: !isFirst || _ctrl.currentPage > 0,
                  onBack: () => isFirst
                      ? retreatToPreviousSection(_ctrl)
                      : retreatToUnit(_ctrl, sec, units, currentIdx),
                  showNext: true,
                  isSubmit: isFormEnd,
                  nextEnabled: isFormEnd ? _ctrl.validateAllPages() : unit.canAdvance(_ctrl),
                  onNext: () => isFormEnd
                      ? _previewSubmit()
                      : isLast
                          ? advanceToNextSection(_ctrl)
                          : advanceToUnit(_ctrl, sec, units, currentIdx),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _sectionSlivers() {
    final idxs = _ctrl.sectionIndicesForPage(_ctrl.currentPage);
    if (idxs.isEmpty) return const <Widget>[];
    final sec = _ctrl.schema!.sections[idxs.first];
    debugPrint(
        'Page ${_ctrl.currentPage} → ${sec.id} → fields: ${sec.fieldIds.length} → visible: ${_ctrl.computeVisibleFieldIds().length}');
    final isSection1 = sec.id.startsWith('section1_');
    final showValidationBanner = _ctrl.advanceBlockedPage == _ctrl.currentPage &&
        !_ctrl.validatePage(_ctrl.currentPage);
    _tableStagger = 0;

    return [
      if (showValidationBanner) _validationBanner(sec),
      if (_ctrl.coherenceFlags.isNotEmpty) _coherenceBanner(),
      if (isSection1 && widget.establishmentId != null)
        SliverToBoxAdapter(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: kScrollChildWidth),
              child: Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: kAccentSoft,
                  borderRadius: BorderRadius.circular(kRadiusSm),
                  border: Border.all(color: kAccent.withValues(alpha: 0.25)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.verified_outlined, size: 16, color: kAccent),
                    const SizedBox(width: 8),
                    Text(
                      context.l10n
                          .establishmentIdInline(widget.establishmentId!),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: kAccent,
                        fontFamily: 'Inter',
                      ),
                    ),
                    const Spacer(),
                    Text(
                      entityTypeTitle(widget.entityType).of(context.loc),
                      style: TextStyle(
                        fontSize: 11,
                        color: kAccent.withValues(alpha: 0.75),
                        fontFamily: 'Inter',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      SliverPadding(
        padding: const EdgeInsets.only(bottom: OL.sectionBodyPaddingH),
        sliver: SliverToBoxAdapter(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: kScrollChildWidth),
              child: Container(
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(OL.sectionBorderRadius),
                  border: Border.all(color: kBorder, width: 1),
                  boxShadow: kShadowCard,
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: OL.sectionBodyPaddingH,
                    vertical: OL.sectionBodyPaddingV,
                  ),
                  child: _sectionUnitBody(sec),
                ),
              ),
            ),
          ),
        ),
      ),
    ];
  }

  // ═══════════════════════════════════════════════════════════
  // FIELD BUILDER
  // ═══════════════════════════════════════════════════════════

  Widget _buildField(FieldSchema f) {
    if (!_ctrl.isFieldVisible(f) || kHybridAstIds.contains(f.id)) {
      return const SizedBox.shrink();
    }
    final currentSectionId = _ctrl.primarySection(_ctrl.currentPage)?.id ?? '';
    final isSimple = _ctrl.isSimpleSection(currentSectionId);

    // questionText is always sourced from f.label (see the l10n-debt note on
    // FormSchemaCompiler.compile()), so a secondary subLabel is never shown —
    // matches prior behavior, where the two were always the same value.
    final Widget? qh = (f.type != 'table' && !isSimple)
        ? OnefopQuestionHeader(
            paperCode: f.paperCode,
            questionText: f.label?.of(context.loc),
          )
        : null;

    Widget field;
    switch (f.type) {
      case 'radio':
        field = RadioField(ctrl: _ctrl, field: f);
        break;
      case 'select':
        field = SelectField(ctrl: _ctrl, field: f);
        break;
      case 'table':
        final delay = Duration(milliseconds: 40 * _tableStagger);
        _tableStagger++;
        field = RepaintBoundary(
          child: DeferredReveal(
            delay: delay,
            placeholder: TableSkeleton(height: _estimateTableHeight(f)),
            builder: (_) => TableFieldWidget(ctrl: _ctrl, field: f),
          ),
        );
        break;
      case 'repeating_table':
        field = ActivitiesTableFieldWidget(ctrl: _ctrl, field: f);
        break;
      default:
        field = SimpleField(ctrl: _ctrl, field: f);
    }

    final content = qh == null
        ? field
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [qh, field]);

    return HighlightBlock(
      key: _ctrl.blockKeys[f.id],
      fieldId: f.id,
      fm: _ctrl.fm,
      isTable: f.type == 'table',
      child: content,
    );
  }

  // Cheap (no widget construction) — just derives a rough row count from
  // the table's cell-id list so the placeholder is close enough in size
  // to avoid a big layout jump when the real table swaps in.
  double _estimateTableHeight(FieldSchema f) {
    final cellCount = TableCellEngine.cellIds(f).length;
    final approxRows = (cellCount / 3).ceil().clamp(1, 40);
    return 56 + approxRows * 40.0;
  }

  // ═══════════════════════════════════════════════════════════
  // REMOTE ACTIONS
  // ═══════════════════════════════════════════════════════════

  Future<void> _previewSubmit() async {
    if (!_ctrl.validateAllPages()) {
      _ctrl.touchAllRequired();
      final failPage = _ctrl.firstFailingPage;
      if (failPage != null) {
        // Set before goto() so the jump doesn't clear the flag — goto()
        // only clears it when landing somewhere other than the blocked
        // page, and here we're landing exactly on it.
        _ctrl.flagBlockedPage(failPage);
        _ctrl.goto(failPage);
      }
      _snack(context.l10n.fillRequiredFields);
      return;
    }

    final l10n = context.l10n;
    _showProgress(l10n.generatingPdfPreview);
    final result = await _ctrl.preview(l10n);

    if (!mounted) return;
    Navigator.of(context).pop();

    if (result.success) {
      final fn = result.fileName!;
      if (kIsWeb) {
        PdfCache.currentPdfBytes = result.bytes;
        PdfCache.currentPdfName = fn;
        Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => PdfViewerScreen(
                pdfPath: fn,
                onConfirm: _submitForm,
              ),
            ));
      } else {
        final td = await getTemporaryDirectory();
        final ff = File('${td.path}/$fn');
        await ff.writeAsBytes(result.bytes!);
        if (!mounted) return;
        Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => PdfViewerScreen(
                pdfPath: ff.path,
                onConfirm: _submitForm,
              ),
            ));
      }
    } else {
      _snack(result.error!);
    }
  }

  Future<void> _submitForm() async {
    final l10n = context.l10n;
    _showProgress(l10n.submittingInProgress);
    final result = await _ctrl.submit(l10n);

    if (!mounted) return;
    Navigator.of(context).pop(); // dismiss loading dialog

    if (result.success) {
      // OnefopFormController has no Riverpod ref of its own, so
      // post-submit state refreshes happen here instead.
      final container = ProviderScope.containerOf(context, listen: false);
      if (result.wasQueued) {
        // Queued offline — nothing changed server-side yet, so just
        // refresh the pending-sync banner's count.
        final count =
            await container.read(syncQueueServiceProvider).pendingCount();
        if (!mounted) return;
        container.read(pendingSubmissionCountProvider.notifier).state = count;
      } else {
        // The cached auth user (and the company dashboard's "ONEFOP
        // $year" stat tile, which reads onefopSubmissionStatus off of
        // it) otherwise stays stuck showing "Non soumis" until the next
        // login, since nothing else re-fetches /auth/me mid-session.
        await container.read(authProvider.notifier).refreshUser();
        if (!mounted) return;
        container.invalidate(companyWorkspaceProvider);
      }
      // Pop the PdfViewerScreen before showing the dialog — on Flutter Web,
      // HtmlElementView renders above the Flutter canvas so the iframe would
      // intercept all taps on the dialog if the viewer screen stays alive.
      Navigator.of(context).pop();
      _successDialog(wasQueued: result.wasQueued);
    } else {
      _snack(result.error!);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DIALOGS / SNACKS
  // ═══════════════════════════════════════════════════════════

  void _snack(String m, {Color color = kDanger}) {
    // Bilingual copy runs long — give it enough time to actually be read,
    // scaling past the default 4s for longer messages.
    final duration = Duration(seconds: m.length > 60 ? 6 : 4);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      // Bounded so an unexpectedly long/raw error string (e.g. an
      // unmapped exception) can never balloon into a screen-filling toast.
      content: Text(m,
          style: const TextStyle(fontSize: 14),
          maxLines: 4,
          overflow: TextOverflow.ellipsis),
      backgroundColor: color,
      behavior: SnackBarBehavior.floating,
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(kRadiusSm)),
      duration: duration,
      // Capped and centered instead of stretching edge-to-edge on wide
      // desktop viewports (SnackBar's default floating width) — a toast
      // this short reads better sized to its message than as a bar
      // spanning the whole screen. width and margin are mutually
      // exclusive on SnackBar, so this replaces the old fixed margin.
      width: (MediaQuery.sizeOf(context).width - 32).clamp(0.0, 480.0),
    ));
  }

  /// One-time toast for a resumed draft — tells the user where they left
  /// off last time instead of silently landing them there. Fired once
  /// from initState() (see _ctrl.resumedFromSavedPosition), not on every
  /// rebuild.
  void _showResumeToast() {
    if (!mounted) return;
    final locale = context.loc;
    final label = _ctrl.pageLabel(_ctrl.currentPage, locale);
    _snack(
      LocalizedText(
        fr: 'Vous avez repris là où vous vous étiez arrêté : $label',
        en: 'Resumed where you left off: $label',
      ).of(locale),
      color: kAccent,
    );
  }

  void _showProgress(String msg) => showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => Center(
          child: Card(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 4,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(color: kAccent),
                  const SizedBox(height: 16),
                  Text(msg, style: const TextStyle(fontSize: 14)),
                ],
              ),
            ),
          ),
        ),
      );

  void _successDialog({bool wasQueued = false}) {
    final accentColor = wasQueued ? kWarning : kSuccess;
    final icon = wasQueued ? Icons.cloud_off : Icons.check_circle;
    final l10n = context.l10n;
    final title = wasQueued
        ? l10n.connectionUnavailableTitle
        : l10n.submissionSuccessTitle;
    final subtitle = wasQueued
        ? l10n.queuedOfflineSubtitle
        : l10n.submissionSuccessSubtitle;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        contentPadding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
        insetPadding: const EdgeInsets.symmetric(horizontal: 40, vertical: 24),
        content: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 340),
          child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 500),
              curve: Curves.elasticOut,
              builder: (context, value, child) => Transform.scale(
                scale: value,
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.1),
                      shape: BoxShape.circle),
                  child: Icon(icon, color: accentColor, size: 40),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w700, color: kInk)),
            const SizedBox(height: 8),
            Text(subtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: kInkSoft)),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: kAccent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(kRadiusSm)),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(l10n.doneButton,
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
        ),
      ),
    );
  }
}
