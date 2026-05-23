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
import 'package:path_provider/path_provider.dart';

// ── Core schema imports ──────────────────────────────────────
import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/schema/section_schema.dart';
import '../../core/focus/compiler/section_title_lookup.dart';
import '../../core/focus/renderers/onefop_layout_constants.dart';
import '../../core/focus/renderers/onefop_section_renderer.dart';

// ── App-wide widgets ─────────────────────────────────────────
import '../../widgets/pdf_viewer_screen.dart';

// ── Screen-local modules ─────────────────────────────────────
import 'onefop_form_constants.dart';
import 'onefop_form_controller.dart';
import 'onefop_form_widgets.dart';

class OnefopUnifiedFormScreenV4 extends StatefulWidget {
  final EntityType entityType;
  final Map<String, dynamic> initialData;
  final void Function(Map<String, dynamic>) onSave;
  final VoidCallback? onCancel;
  final String? userId;
  final VoidCallback? onSubmitSuccess;

  const OnefopUnifiedFormScreenV4({
    super.key,
    required this.entityType,
    required this.initialData,
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

  @override
  void initState() {
    super.initState();
    _ctrl = OnefopFormController(
      entityType: widget.entityType,
      initialData: widget.initialData,
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
        backgroundColor: const Color(0xFFF8FAFC),
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
        backgroundColor: const Color(0xFFF8FAFC),
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
              const Icon(Icons.error_outline,
                  size: 56, color: Color(0xFFCC0000)),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text('Erreur : ${_ctrl.error}',
                    style:
                        const TextStyle(color: Color(0xFFCC0000), fontSize: 14),
                    textAlign: TextAlign.center),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _ctrl.initialize,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4472C4),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                child: const Text('Réessayer',
                    style: TextStyle(color: Colors.white, fontSize: 14)),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: OnefopAppBar(
        title: title,
        loading: false,
        saving: _ctrl.saving,
        dirty: _ctrl.dirty,
        onCancel: widget.onCancel,
      ),
      body: desktop ? _desktopLayout() : _mobileLayout(),
    );
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
            child: const VerticalDivider(
                width: 1, thickness: 1, color: Color(0xFFE2E8F0)),
          ),
          Expanded(
            child: Column(children: [
              Expanded(
                child: Stack(
                  children: [
                    CustomScrollView(
                      controller: _ctrl.mainScroll,
                      slivers: [
                        const SliverToBoxAdapter(
                          child: SizedBox(height: OL.sectionBodyPaddingH),
                        ),
                        ..._sectionSlivers(),
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
                          message: 'Afficher la barre',
                          child: InkWell(
                            onTap: () => _ctrl.setSidebarMode(2),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                    color: const Color(0xFFE2E8F0), width: 1),
                                boxShadow: const [
                                  BoxShadow(
                                      color: Color(0x1A000000),
                                      blurRadius: 6,
                                      offset: Offset(0, 2)),
                                ],
                              ),
                              child: const Icon(Icons.menu,
                                  size: 16, color: Color(0xFF475569)),
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
          color: Colors.white,
          border:
              Border(bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
        ),
        child: StepperStrip(ctrl: _ctrl),
      ),
      Expanded(
        child: CustomScrollView(
          controller: _ctrl.mainScroll,
          slivers: [
            const SliverToBoxAdapter(
              child: SizedBox(height: OL.sectionBodyPaddingH),
            ),
            ..._sectionSlivers(),
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

  List<Widget> _sectionSlivers() {
    final idxs = _ctrl.sectionIndicesForPage(_ctrl.currentPage);
    if (idxs.isEmpty) return const <Widget>[];
    final sec = _ctrl.schema!.sections[idxs.first];
    final title = SectionTitleLookup.getTitle(sec.id);
    final isV = _ctrl.valid[sec.id] ?? false;
    final meta = kSidebarMeta[sec.id];

    return [
      SliverPersistentHeader(
        pinned: true,
        delegate: StickySectionHeaderDelegate(
          sectionId: sec.id,
          title: title,
          icon: meta?.icon,
          isComplete: isV,
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.only(bottom: OL.sectionBodyPaddingH),
        sliver: SliverToBoxAdapter(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: kScrollChildWidth),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(12),
                    bottomRight: Radius.circular(12),
                  ),
                  border: Border(
                    left: BorderSide(color: Color(0xFFE2E8F0), width: 1),
                    right: BorderSide(color: Color(0xFFE2E8F0), width: 1),
                    bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x0D000000),
                      blurRadius: 12,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: OL.sectionBodyPaddingH,
                    vertical: OL.sectionBodyPaddingV,
                  ),
                  child: _sectionBody(sec),
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

  Widget _sectionBody(SectionSchema sec) {
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

          final canPair = f.type != 'table' &&
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
                    Expanded(child: _buildField(next)),
                    const SizedBox(width: kColumnGap),
                    Expanded(child: _buildField(f)),
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
        field = RepaintBoundary(child: TableFieldWidget(ctrl: _ctrl, field: f));
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
        _ctrl.goto(failPage);
      }
      _snack(
          'Veuillez remplir tous les champs obligatoires avant de soumettre');
      return;
    }

    _showProgress("Génération de l'aperçu PDF…");
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
    _showProgress('Soumission en cours…');
    final result = await _ctrl.submit();

    if (!mounted) return;
    Navigator.of(context).pop();

    if (result.success) {
      _successDialog();
    } else {
      _snack(result.error!);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DIALOGS / SNACKS
  // ═══════════════════════════════════════════════════════════

  void _snack(String m) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(m, style: const TextStyle(fontSize: 14)),
      backgroundColor: const Color(0xFFCC0000),
      behavior: SnackBarBehavior.floating,
      margin: const EdgeInsets.all(16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      duration: const Duration(seconds: 2),
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
                  const CircularProgressIndicator(color: Color(0xFF4472C4)),
                  const SizedBox(height: 16),
                  Text(msg, style: const TextStyle(fontSize: 14)),
                ],
              ),
            ),
          ),
        ),
      );

  void _successDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        contentPadding: const EdgeInsets.all(28),
        content: Column(
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
                      color: const Color(0xFF70AD47).withValues(alpha: 0.1),
                      shape: BoxShape.circle),
                  child: const Icon(Icons.check_circle,
                      color: Color(0xFF70AD47), size: 40),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Soumission réussie !',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1E293B))),
            const SizedBox(height: 8),
            const Text('Votre formulaire ONEFOP a été soumis avec succès.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Color(0xFF64748B))),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4472C4),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Terminer',
                    style:
                        TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
