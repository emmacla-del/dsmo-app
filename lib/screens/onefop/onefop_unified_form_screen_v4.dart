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
import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/schema/section_schema.dart';
import '../../core/focus/renderers/onefop_layout_constants.dart';
import '../../core/focus/renderers/onefop_section_renderer.dart';

// ── App-wide widgets ─────────────────────────────────────────
import '../../widgets/pdf_viewer_screen.dart';
import '../../providers/sync_queue_provider.dart';
import '../../providers/auth_provider.dart';
import '../dashboards/company_workspace_dashboard.dart' show companyWorkspaceProvider;

// ── Screen-local modules ─────────────────────────────────────
import 'onefop_form_constants.dart';
import 'onefop_form_controller.dart';
import 'onefop_form_widgets.dart';
import 'onefop_table_engine.dart';

class OnefopUnifiedFormScreenV4 extends StatefulWidget {
  final EntityType entityType;
  final Map<String, dynamic> initialData;
  final String? establishmentId;
  final String? companyId;
  final String? quarterCode;
  final void Function(Map<String, dynamic>) onSave;
  final VoidCallback? onCancel;
  final String? userId;
  final VoidCallback? onSubmitSuccess;

  const OnefopUnifiedFormScreenV4({
    super.key,
    required this.entityType,
    required this.initialData,
    this.establishmentId,
    this.companyId,
    this.quarterCode,
    required this.onSave,
    this.onCancel,
    this.userId,
    this.onSubmitSuccess,
  });

  @override
  State<OnefopUnifiedFormScreenV4> createState() => _State();
}

class _State extends State<OnefopUnifiedFormScreenV4> {
  late final OnefopFormController _ctrl;

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
      onSave: widget.onSave,
      onCancel: widget.onCancel,
      userId: widget.userId,
      onSubmitSuccess: widget.onSubmitSuccess,
    );
    _ctrl.initialize();
    _ctrl.addListener(_onControllerChange);
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

  // ═══════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final title = 'ONEFOP — ${entityTypeTitle(widget.entityType)}';
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
                child: Text('Erreur / Error : ${_ctrl.error}',
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
                child: const Text('Réessayer / Retry',
                    style: TextStyle(color: Colors.white, fontSize: 14)),
              ),
            ],
          ),
        ),
      );
    }

    // On mobile the MobileContextHeader already shows the current section's
    // label and progress, so the app bar's second row would be a redundant
    // ~52px of chrome on an already-tight phone viewport — only render it
    // on desktop, where there's no compact header.
    final headerSec = desktop ? _currentSection : null;
    return Scaffold(
      backgroundColor: kCanvas,
      appBar: OnefopAppBar(
        title: title,
        loading: false,
        saving: _ctrl.saving,
        dirty: _ctrl.dirty,
        onCancel: widget.onCancel,
        sectionTitle:
            headerSec == null ? null : kSidebarMeta[headerSec.id]?.label,
        sectionIcon:
            headerSec == null ? null : kSidebarMeta[headerSec.id]?.icon,
        sectionComplete:
            headerSec == null ? false : (_ctrl.valid[headerSec.id] ?? false),
      ),
      body: desktop ? _desktopLayout() : _mobileLayout(),
    );
  }

  // ═══════════════════════════════════════════════════════════
  // CURRENT SECTION  (drives the app bar's fused section row)
  // ═══════════════════════════════════════════════════════════

  SectionSchema? get _currentSection {
    final idxs = _ctrl.sectionIndicesForPage(_ctrl.currentPage);
    if (idxs.isEmpty) return null;
    return _ctrl.schema!.sections[idxs.first];
  }

  // ═══════════════════════════════════════════════════════════
  // LAYOUTS
  // ═══════════════════════════════════════════════════════════

  Widget _desktopLayout() => Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Sidebar(ctrl: _ctrl),
          AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            width: _ctrl.sidebarMode > 0 ? 1 : 0,
            child: const VerticalDivider(width: 1, thickness: 1, color: kBorder),
          ),
          Expanded(
            child: Column(children: [
              Expanded(
                child: Stack(
                  children: [
                    CustomScrollView(
                      controller: _ctrl.mainScroll,
                      slivers: [
                        ..._sectionSlivers(pairFields: true, mobile: false),
                        const SliverToBoxAdapter(
                          child: SizedBox(height: 40),
                        ),
                      ],
                    ),
                    if (_ctrl.sidebarMode == 0)
                      Positioned(
                        top: 12,
                        left: 12,
                        child: Tooltip(
                          message: 'Afficher la barre / Show sidebar',
                          child: InkWell(
                            onTap: () => _ctrl.setSidebarMode(2),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: kSurface,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: kBorder, width: 1),
                                boxShadow: kShadowFloating,
                              ),
                              child: const Icon(Icons.menu,
                                  size: 16, color: kInkSoft),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              _navBar(),
            ]),
          ),
        ],
      );

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
            ..._sectionSlivers(pairFields: false, mobile: true),
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
      _navBar(),
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
                          ? 'Incohérence détectée / Inconsistency detected'
                          : '${flags.length} incohérences détectées / '
                              'inconsistencies detected',
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
                      '• ${flag.message}',
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
    final missing = _ctrl.missingLabels(sec);
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
                          ? 'Champ manquant / Missing field'
                          : '${missing.length} champs manquants / '
                              'missing fields',
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

  List<Widget> _sectionSlivers({required bool pairFields, required bool mobile}) {
    final idxs = _ctrl.sectionIndicesForPage(_ctrl.currentPage);
    if (idxs.isEmpty) return const <Widget>[];
    final sec = _ctrl.schema!.sections[idxs.first];
    debugPrint(
        'Page ${_ctrl.currentPage} → ${sec.id} → fields: ${sec.fieldIds.length} → visible: ${_ctrl.computeVisibleFieldIds().length}');
    final isSection1 = sec.id.startsWith('section1_');
    final showValidationBanner = mobile &&
        _ctrl.advanceBlockedPage == _ctrl.currentPage &&
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
                      'ID Établissement: ${widget.establishmentId}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: kAccent,
                        fontFamily: 'Inter',
                      ),
                    ),
                    const Spacer(),
                    Text(
                      entityTypeTitle(widget.entityType),
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
                  child: _sectionBody(sec, pairFields: pairFields),
                ),
              ),
            ),
          ),
        ),
      ),
    ];
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION BODY
  // ═══════════════════════════════════════════════════════════

  Widget _sectionBody(SectionSchema sec, {required bool pairFields}) {
    final fields = sec.fieldIds
        .map((id) => _ctrl.schema!.getField(id))
        .whereType<FieldSchema>()
        .toList();
    final isSimple = _ctrl.isSimpleSection(sec.id);
    final groups = groupFields(fields);

    Widget buildGroupContent(FieldGroup g) {
      final children = <Widget>[];
      if (g.sub != null && g.sub!.isNotEmpty) {
        children.add(OnefopSubsectionHeader(title: g.sub!));
      }

      if (isSimple) {
        final visible = g.fields.where(_ctrl.isFieldVisible).toList();
        int i = 0;
        while (i < visible.length) {
          final f = visible[i];
          final div = _ctrl.dividerLabel(f.id);
          if (div != null) children.add(OnefopDividerLabel(label: div));

          final canPair = pairFields &&
              f.type != 'table' &&
              f.type != 'radio' &&
              !kHybridAstIds.contains(f.id);
          final next = i + 1 < visible.length ? visible[i + 1] : null;
          final nextCanPair = next != null &&
              next.type != 'table' &&
              next.type != 'radio' &&
              !kHybridAstIds.contains(next.id);

          if (canPair && nextCanPair) {
            children.add(
              Padding(
                padding: const EdgeInsets.only(bottom: OL.questionGapV),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _buildField(f)),
                    const SizedBox(width: kColumnGap),
                    Expanded(child: _buildField(next)),
                  ],
                ),
              ),
            );
            i += 2;
          } else {
            children.add(_buildField(f));
            i++;
          }
        }
      } else {
        for (final f in g.fields) {
          final div = _ctrl.dividerLabel(f.id);
          if (div != null) children.add(OnefopDividerLabel(label: div));
          children.add(_buildField(f));
        }
      }

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: children,
      );
    }

    return SizedBox(
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: groups.map(buildGroupContent).toList(),
      ),
    );
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

    final Widget? qh = (f.type != 'table' && !isSimple)
        ? OnefopQuestionHeader(
            paperCode: f.paperCode,
            questionText: f.questionText ?? f.label,
            subLabel:
                (f.label != null && (f.questionText ?? f.label) != f.label)
                    ? f.label
                    : null,
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
  // NAV BAR
  // ═══════════════════════════════════════════════════════════

  Widget _navBar() {
    final isLast = _ctrl.currentPage == _ctrl.pageCount - 1;
    final pageValid = _ctrl.validatePage(_ctrl.currentPage);
    final allValid = _ctrl.validateAllPages();
    final canProceed = isLast ? allValid : pageValid;

    return ValueListenableBuilder<int>(
      valueListenable: _ctrl.version,
      builder: (_, __, ___) => NavBar(
        isLast: isLast,
        canProceed: canProceed,
        allValid: allValid,
        pageLabel: _ctrl.pageLabel(_ctrl.currentPage),
        currentPage: _ctrl.currentPage,
        totalPages: _ctrl.pageCount,
        onPrevious: _ctrl.currentPage > 0 ? _ctrl.prev : null,
        onNextOrPreview: () => isLast ? _previewSubmit() : _ctrl.next(),
      ),
    );
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
      _snack(
          'Veuillez remplir tous les champs obligatoires avant de soumettre / '
          'Please fill in all required fields before submitting');
      return;
    }

    _showProgress("Génération de l'aperçu PDF… / Generating PDF preview…");
    final result = await _ctrl.preview();

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
    _showProgress('Soumission en cours… / Submitting…');
    final result = await _ctrl.submit();

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

  void _snack(String m) {
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
      backgroundColor: kDanger,
      behavior: SnackBarBehavior.floating,
      margin: const EdgeInsets.all(16),
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(kRadiusSm)),
      duration: duration,
    ));
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
    final title = wasQueued
        ? 'Connexion indisponible / Connection unavailable'
        : 'Soumission réussie ! / Submission successful!';
    final subtitle = wasQueued
        ? 'Votre formulaire a été enregistré sur cet appareil et sera '
            'envoyé automatiquement dès le retour de la connexion. / '
            'Your form was saved on this device and will be sent '
            'automatically once you\'re back online.'
        : 'Votre formulaire ONEFOP a été soumis avec succès. / '
            'Your ONEFOP form has been submitted successfully.';

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
                child: const Text('Terminer / Done',
                    style:
                        TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
        ),
      ),
    );
  }
}
