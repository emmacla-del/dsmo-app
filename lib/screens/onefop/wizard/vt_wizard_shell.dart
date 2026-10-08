// lib/screens/onefop/wizard/vt_wizard_shell.dart
// ══════════════════════════════════════════════════════════════
// VT WIZARD MODE — top-level shell.
//
// Third desktop mode, VT-only (see OnefopViewMode.wizard and its
// availableModes gating). Reuses the SAME OnefopFormController, the SAME
// FieldSchema/SectionSchema the other two modes read, and the SAME
// buildField dispatch the caller (onefop_unified_form_screen_v4.dart)
// already passes to SimpleModeShell — this file adds a third visual skin
// over identical data/logic, not a new questionnaire model.
//
// Flow: Section 1 -> ... -> Section 9 (in schema order) -> Validation &
// Submission. Back from Section 1 exits the wizard (widget.onCancel) rather
// than landing on an internal stage — there used to be a section-overview
// Dashboard stage reachable from there, but landing on an overview of 9
// sections you haven't started, right after leaving Identification, read as
// a dead end rather than an exit, and it duplicated the Validation screen's
// own section-status recap anyway (see VtWizardSectionStatusCard, now
// shared by Validation alone). There used to be a separate wizard-only
// "Welcome" stage first too, but it duplicated the confidentiality notice
// already shown by OnefopLegalAcknowledgmentScreen right before this shell
// mounts — also removed. Step list/labels come from kSidebarMeta
// (onefop_form_constants.dart) — not hardcoded here — so this can never
// drift from the AST's own section set.
// ══════════════════════════════════════════════════════════════

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/localized_text.dart';
import '../../../core/focus/schema/field_schema.dart';
import '../../../core/focus/schema/section_schema.dart';
import '../../../providers/onefop_mode_provider.dart';
import '../onefop_form_constants.dart';
import '../../../core/focus/utils/vt_quiz.dart';
import '../onefop_form_controller.dart';
import '../onefop_form_widgets.dart' show OnefopShellTitleBar;
import 'vt_wizard_constants.dart';
import 'vt_wizard_progress.dart';
import 'vt_wizard_section_screen.dart';
import 'vt_scope_quiz.dart';
import 'vt_wizard_validation_screen.dart';

enum _VtWizardStage { section, quiz, validation }

class VtWizardShell extends StatefulWidget {
  final OnefopFormController ctrl;
  final EntityType entityType;
  final Widget Function(FieldSchema) buildField;
  final Future<void> Function() onPreviewSubmit;
  final String title;
  final bool dirty;
  final bool saving;
  final bool saveFailed;
  final DateTime? lastSavedAt;
  final Future<void> Function()? onSaveNow;
  final VoidCallback? onOpenDrafts;
  final VoidCallback? onCancel;
  final OnefopViewMode mode;
  final void Function(OnefopViewMode) onModeChanged;
  final List<OnefopViewMode>? availableModes;

  const VtWizardShell({
    super.key,
    required this.ctrl,
    required this.entityType,
    required this.buildField,
    required this.onPreviewSubmit,
    required this.title,
    required this.dirty,
    required this.saving,
    required this.mode,
    required this.onModeChanged,
    this.saveFailed = false,
    this.lastSavedAt,
    this.availableModes,
    this.onSaveNow,
    this.onOpenDrafts,
    this.onCancel,
  });

  @override
  State<VtWizardShell> createState() => _VtWizardShellState();
}

class _VtWizardShellState extends State<VtWizardShell> {
  _VtWizardStage _stage = _VtWizardStage.section;
  final Map<String, bool> _tableauModes = {};
  VtWizardSectionOutlineModel? _sectionOutline;

  // Derived from ctrl.currentPage rather than kept as its own local field
  // — VT's compiled schema is exactly _vtSections, in the same order (see
  // onefop_ast.dart: every VT section id ends in "_vocationalTraining" and
  // section0 explicitly excludes the "vocationalTraining" entity type), so
  // ctrl's own page cursor already *is* this wizard's section cursor, with
  // no offset to track. Reading it straight off the controller (instead of
  // a shadow int kept in sync by hand) is what makes Spreadsheet/Simple ↔
  // Wizard mode switching land on the same section for free, and is the
  // fix for the wizard's own navigation previously never touching ctrl at
  // all — see _goToSection/_nextSection/_prevSection below, and the (now
  // stale) warning in OnefopFormController.computeVisibleFieldIds about
  // this exact gap.
  int get _sectionIndex =>
      widget.ctrl.currentPage.clamp(0, _vtSections.length - 1);

  @override
  void initState() {
    super.initState();
    GoogleFonts.manrope();
    widget.ctrl.addListener(_handleCtrlChange);
  }

  @override
  void didUpdateWidget(covariant VtWizardShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.ctrl != widget.ctrl) {
      oldWidget.ctrl.removeListener(_handleCtrlChange);
      widget.ctrl.addListener(_handleCtrlChange);
    }
  }

  @override
  void dispose() {
    widget.ctrl.removeListener(_handleCtrlChange);
    super.dispose();
  }

  void _handleCtrlChange() {
    if (_stage == _VtWizardStage.validation &&
        widget.ctrl.advanceBlockedPage != null) {
      if (mounted) {
        setState(() {
          _stage = _VtWizardStage.section;
        });
      }
    }
  }

  List<SectionSchema> get _vtSections => widget.ctrl.schema!.sections
      .where((s) => s.id.endsWith('_vocationalTraining'))
      .toList();

  // Sidebar/Validation-screen "jump to this section" — an explicit
  // browse-to-location request, not a Suivant, so (matching
  // onefop_section_units.dart's navigateToSection/jumpToLocation for
  // every other mode) it is never gated by validation: the required-
  // fields gate still applies when actually leaving a section via
  // _nextSection below, and at submit time, it just doesn't also block
  // *looking* at a later section early.
  void _goToSection(int index) => setState(() {
        widget.ctrl.goto(index);
        _stage = _VtWizardStage.section;
        _sectionOutline = null;
      });

  void _goToValidation() => setState(() {
        _stage = _VtWizardStage.validation;
        _sectionOutline = null;
      });

  // The section's real Suivant — reached once VtWizardSectionScreen's own
  // internal step/tab pagination is on its last step (see widget.onNext
  // there). Routes through OnefopFormController.next(), the same
  // validatePage-gated primitive Simple Mode's advanceToNextSection
  // (onefop_section_units.dart) calls to leave a section: invalid ->
  // touched required fields + notifyListeners so the field widgets show
  // their errors, currentPage unchanged, nothing else happens here. Valid
  // -> next() advances ctrl's own page cursor, which _sectionIndex reads
  // straight back out, so the wizard simply shows the new section already.
  //
  // ctrl.next() is a no-op past the last page, so the "last VT section,
  // now leave the wizard's own section stage for Validation" case is
  // handled explicitly here instead of by comparing pages before/after.
  void _scrollToFirstError() {
    final curSection = _vtSections[_sectionIndex];
    final schema = widget.ctrl.schema!;
    final fields = curSection.fieldIds
        .map(schema.getField)
        .whereType<FieldSchema>()
        .where(widget.ctrl.isFieldVisible)
        .toList();
    for (final f in fields) {
      if (widget.ctrl.hasError(f)) {
        final node = widget.ctrl.fm.getNode(f.id);
        node.requestFocus();
        final ctx = node.context;
        if (ctx != null) {
          Scrollable.ensureVisible(
            ctx,
            duration: const Duration(milliseconds: 320),
            curve: Curves.easeOutCubic,
            alignment: 0.15,
          );
        }
        break;
      }
    }
  }

  // Section 1 → the preliminary quiz → Section 2, unless 1.12 says the
  // centre is non-functional or closed (Section 1 only, no quiz).
  bool get _quizApplies => !isVtCentreClosed(widget.ctrl.data);

  void _openQuiz() => setState(() {
        _stage = _VtWizardStage.quiz;
        _sectionOutline = null;
      });

  void _nextSection() {
    final isLastVtSection = _sectionIndex >= _vtSections.length - 1;
    if (!widget.ctrl.validatePage(widget.ctrl.currentPage)) {
      widget.ctrl.flagBlockedPage(widget.ctrl.currentPage);
      widget.ctrl.touchAllRequired();
      _scrollToFirstError();
      return;
    }
    if (_sectionIndex == 0 && _quizApplies) {
      _openQuiz();
      return;
    }
    if (isLastVtSection) {
      _goToValidation();
    } else {
      widget.ctrl.next();
      if (mounted) setState(() => _sectionOutline = null);
    }
  }

  void _prevSection() {
    if (_sectionIndex == 1 && _quizApplies) {
      _openQuiz();
      return;
    }
    if (_sectionIndex > 0) {
      widget.ctrl.prev();
    } else {
      widget.onCancel?.call();
    }
  }

  void _openTaskList(List<SectionSchema> sections) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(sheetContext).height * .82,
          child: _VtWizardSidebar(
            ctrl: widget.ctrl,
            sections: sections,
            currentIndex:
                _stage == _VtWizardStage.section ? _sectionIndex : null,
            sectionOutline: _sectionOutline,
            onTapSection: (index) {
              Navigator.of(sheetContext).pop();
              _goToSection(index);
            },
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sections = _vtSections;
    final viewport = MediaQuery.sizeOf(context);
    // The task rail is supplementary navigation. It earns permanent space
    // only at a true desktop width; phones and tablets use the same list in
    // an intentional sheet instead of compressing the form beside a rail.
    final showFullRail = viewport.width >= 1280;
    final showCompactRail = !showFullRail && viewport.width >= 900;
    // The contextual help rail is pure upside — it earns its own permanent
    // column only once there's real width left over after the task rail
    // (280) and the content column at its usual cap (980) both already
    // fit comfortably, so it never competes with either for space on a
    // merely-wide (not ultra-wide) desktop.
    final showHelperPanel =
        _stage == _VtWizardStage.section && viewport.width >= 1600;
    final pageGutter = viewport.width < 768
        ? 16.0
        : showFullRail
            ? 40.0
            : 24.0;

    Widget content;
    switch (_stage) {
      case _VtWizardStage.section:
        content = VtWizardSectionScreen(
          key: ValueKey(sections[_sectionIndex].id),
          ctrl: widget.ctrl,
          section: sections[_sectionIndex],
          buildField: widget.buildField,
          onBack: _prevSection,
          onNext: _nextSection,
          onSaveAndExit: widget.onSaveNow == null || widget.onCancel == null
              ? null
              : () async {
                  await widget.onSaveNow!();
                  if (mounted) widget.onCancel!();
                },
          isFirst: _sectionIndex == 0,
          isLast: _sectionIndex == sections.length - 1,
          tableauMode: _tableauModes[sections[_sectionIndex].id] ?? false,
          showBottomBar: false,
          onTableauModeChanged: (value) => setState(() {
            _tableauModes[sections[_sectionIndex].id] = value;
          }),
          onOutlineChanged: (outline) {
            if (!mounted) return;
            setState(() => _sectionOutline = outline);
          },
        );
        break;
      case _VtWizardStage.quiz:
        content = VtScopeQuizView(
          ctrl: widget.ctrl,
          onComplete: () => _goToSection(1),
          onBack: () => _goToSection(0),
          backLabelFr: '← Retour à la Section 1',
          backLabelEn: '← Back to Section 1',
        );
        break;
      case _VtWizardStage.validation:
        content = VtWizardValidationScreen(
          ctrl: widget.ctrl,
          sections: sections,
          onOpenSection: _goToSection,
          onBack: () => _goToSection(sections.length - 1),
          onPreviewSubmit: () async {
            await widget.onPreviewSubmit();
            if (widget.ctrl.firstFailingPage != null && mounted) {
              setState(() {
                _stage = _VtWizardStage.section;
              });
            }
          },
        );
        break;
    }

    return Container(
      color: kVtWizardBackground,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          OnefopShellTitleBar(
            title: widget.title,
            leadingIcon: Icons.auto_awesome_motion_outlined,
            dirty: widget.dirty,
            saving: widget.saving,
            saveFailed: widget.saveFailed,
            lastSavedAt: widget.lastSavedAt,
            onSaveNow: widget.onSaveNow,
            onOpenDrafts: widget.onOpenDrafts,
            onCancel: widget.onCancel,
            mode: widget.mode,
            onModeChanged: widget.onModeChanged,
            availableModes: widget.availableModes,
          ),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (showFullRail)
                  _VtWizardSidebar(
                    ctrl: widget.ctrl,
                    sections: sections,
                    currentIndex:
                        _stage == _VtWizardStage.section ? _sectionIndex : null,
                    sectionOutline: _sectionOutline,
                    onTapSection: _goToSection,
                  )
                else if (showCompactRail)
                  _VtWizardCompactRail(
                    ctrl: widget.ctrl,
                    sections: sections,
                    currentIndex:
                        _stage == _VtWizardStage.section ? _sectionIndex : null,
                    onTapSection: _goToSection,
                  ),
                Expanded(
                  child: Stack(
                    children: [
                      SingleChildScrollView(
                        controller: widget.ctrl.mainScroll,
                        padding: EdgeInsets.fromLTRB(
                          pageGutter,
                          pageGutter,
                          pageGutter,
                          pageGutter +
                              (_stage == _VtWizardStage.section ? 100 : 32),
                        ),
                        child: LayoutBuilder(
                          builder: (context, lc) {
                            final maxW = viewport.width < 768
                                ? lc.maxWidth
                                : lc.maxWidth.clamp(0.0, 980.0).toDouble();
                            return Center(
                              child: ConstrainedBox(
                                constraints: BoxConstraints(maxWidth: maxW),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    if (!showFullRail && !showCompactRail) ...[
                                      Align(
                                        alignment: Alignment.centerRight,
                                        child: OutlinedButton.icon(
                                          onPressed: () =>
                                              _openTaskList(sections),
                                          icon: const Icon(
                                            Icons.format_list_bulleted_rounded,
                                            size: 18,
                                          ),
                                          label: Text(
                                            const LocalizedText(
                                              fr: 'Liste des sections',
                                              en: 'Task list',
                                            ).of(context.loc),
                                          ),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: kVtWizardInkSoft,
                                            side: const BorderSide(
                                              color: kVtWizardCardBorder,
                                            ),
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 14,
                                              vertical: 12,
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 16),
                                    ],
                                    content,
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      Positioned(
                        top: 16,
                        right: 16,
                        child: _VtWizardSaveToast(
                            saving: widget.saving, failed: widget.saveFailed),
                      ),
                      if (_stage == _VtWizardStage.section)
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              border: const Border(
                                  top: BorderSide(color: kVtWizardCardBorder)),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 10,
                                  offset: const Offset(0, -3),
                                ),
                              ],
                            ),
                            padding: EdgeInsets.symmetric(
                              horizontal: pageGutter,
                              vertical: 12,
                            ),
                            child: Center(
                              child: ConstrainedBox(
                                constraints:
                                    const BoxConstraints(maxWidth: 980),
                                child: Row(
                                  children: [
                                    OutlinedButton.icon(
                                      onPressed: _prevSection,
                                      icon: const Icon(Icons.arrow_back_rounded,
                                          size: 16),
                                      label: Text(
                                        _sectionIndex == 0
                                            ? const LocalizedText(
                                                    fr: 'Annuler', en: 'Cancel')
                                                .of(context.loc)
                                            : const LocalizedText(
                                                    fr: 'Étape Précédente',
                                                    en: 'Previous')
                                                .of(context.loc),
                                      ),
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: kVtWizardInkSoft,
                                        side: const BorderSide(
                                            color: kVtWizardCardBorder),
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 20, vertical: 12),
                                      ),
                                    ),
                                    const Spacer(),
                                    if (widget.onSaveNow != null &&
                                        widget.onCancel != null) ...[
                                      OutlinedButton.icon(
                                        onPressed: () async {
                                          await widget.onSaveNow!();
                                          if (mounted) widget.onCancel!();
                                        },
                                        icon: const Icon(Icons.save_outlined,
                                            size: 16),
                                        label: Text(
                                          const LocalizedText(
                                            fr: 'Enregistrer et quitter',
                                            en: 'Save and exit',
                                          ).of(context.loc),
                                        ),
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: kVtWizardInkSoft,
                                          side: const BorderSide(
                                              color: kVtWizardCardBorder),
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 20, vertical: 12),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                    ],
                                    ElevatedButton.icon(
                                      onPressed: _nextSection,
                                      icon: const Icon(
                                          Icons.arrow_forward_rounded,
                                          size: 16),
                                      label: Text(
                                        _sectionIndex == sections.length - 1
                                            ? const LocalizedText(
                                                    fr:
                                                        'Passer à la Validation',
                                                    en: 'Proceed to Validation')
                                                .of(context.loc)
                                            : const LocalizedText(
                                                    fr: 'Suivant',
                                                    en: 'Next Step')
                                                .of(context.loc),
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w800),
                                      ),
                                      iconAlignment: IconAlignment.end,
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: kAccent,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 24, vertical: 12),
                                        shape: RoundedRectangleBorder(
                                            borderRadius:
                                                BorderRadius.circular(6)),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                if (showHelperPanel)
                  _VtWizardHelperPanel(
                    tips: _vtWizardSectionTips(sections[_sectionIndex]),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A brief, wizard‑styled "just saved" confirmation — additive to (not a
/// replacement of) OnefopShellTitleBar's own persistent Enregistrement…/
/// Non enregistré/Enregistré chip, which every mode already shares and
/// stays as-is by this file's own established convention (see this file's
/// header comment: the wizard reuses that title bar unchanged, only the
/// body gets its own visual language). That chip is an ongoing status
/// label; this is a momentary confirmation toast for the specific moment
/// a save completes, floating over the top‑right of the content pane so
/// it survives section navigation and doesn't compete with the title bar.
/// Fires off `saving` flipping true → false (a completed autosave or
/// explicit Save click — same signal OnefopShellTitleBar's own chip
/// already reacts to), shows for ~2.2s, then fades out.
class _VtWizardSaveToast extends StatefulWidget {
  final bool saving;
  // Whether the save attempt that just finished (saving true → false)
  // failed — a toast reading "Saved just now" after a save that actually
  // threw would tell a respondent their statistical declaration is safe
  // when it silently isn't (see OnefopFormController.saveFailed).
  final bool failed;
  const _VtWizardSaveToast({required this.saving, this.failed = false});

  @override
  State<_VtWizardSaveToast> createState() => _VtWizardSaveToastState();
}

class _VtWizardSaveToastState extends State<_VtWizardSaveToast> {
  bool _show = false;
  bool _shownFailed = false;
  Timer? _hideTimer;

  @override
  void didUpdateWidget(covariant _VtWizardSaveToast old) {
    super.didUpdateWidget(old);
    if (old.saving && !widget.saving) {
      _hideTimer?.cancel();
      setState(() {
        _show = true;
        _shownFailed = widget.failed;
      });
      // A failure stays visible until the next successful save rather than
      // fading after 2.2s like a routine confirmation — this is the one
      // moment most likely to need the respondent's attention.
      if (!widget.failed) {
        _hideTimer = Timer(const Duration(milliseconds: 2200), () {
          if (mounted) setState(() => _show = false);
        });
      }
    }
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final failed = _shownFailed;
    return IgnorePointer(
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
        opacity: _show ? 1 : 0,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: failed ? const Color(0xFFFBEAEA) : const Color(0xFFEDF7F2),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
                color:
                    failed ? const Color(0xFFE9B4B4) : const Color(0xFFBFE0D1)),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x14000000),
                  blurRadius: 6,
                  offset: Offset(0, 2)),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                failed ? Icons.error_rounded : Icons.check_circle_rounded,
                size: 14,
                color: failed ? kVtWizardRed : kAccent,
              ),
              const SizedBox(width: 6),
              Text(
                failed
                    ? const LocalizedText(
                            fr: "Échec de l'enregistrement — réessayez",
                            en: 'Could not save — please retry')
                        .of(locale)
                    : const LocalizedText(
                            fr: 'Enregistré à l\'instant', en: 'Saved just now')
                        .of(locale),
                style: TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                    color: failed ? kVtWizardRed : kAccent),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VtWizardCompactRail extends StatelessWidget {
  final OnefopFormController ctrl;
  final List<SectionSchema> sections;
  final int? currentIndex;
  final void Function(int) onTapSection;

  const _VtWizardCompactRail({
    required this.ctrl,
    required this.sections,
    required this.currentIndex,
    required this.onTapSection,
  });

  bool _isComplete(SectionSchema section) {
    final stats = vtWizardSectionStats(ctrl, section);
    return ctrl.valid[section.id] == true &&
        (stats.total == 0 || stats.filled == stats.total);
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    return Container(
      width: 68,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(right: BorderSide(color: kVtWizardCardBorder)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 16),
          Tooltip(
            message: 'MINEFOP / ONEFOP',
            child: Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: kVtWizardAccentSoft,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.school_rounded, color: kAccent, size: 20),
            ),
          ),
          const SizedBox(height: 12),
          const Divider(color: kVtWizardCardBorder, height: 1),
          const SizedBox(height: 8),
          Expanded(
            child: ListView.builder(
              itemCount: sections.length,
              itemBuilder: (context, i) {
                final s = sections[i];
                final meta = kSidebarMeta[s.id];
                final label = meta?.label.of(locale) ?? s.id;
                final isCurrent = i == currentIndex;
                final isDone = _isComplete(s);
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Tooltip(
                    message: '${i + 1}. $label',
                    child: InkWell(
                      onTap: () => onTapSection(i),
                      borderRadius: BorderRadius.circular(8),
                      child: Center(
                        child: Container(
                          width: 40,
                          height: 40,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: isCurrent
                                ? kAccent
                                : isDone
                                    ? kVtWizardAccentSoft
                                    : kVtWizardBackground,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isCurrent
                                  ? kAccent
                                  : isDone
                                      ? kAccent
                                      : kVtWizardCardBorder,
                              width: 1.5,
                            ),
                          ),
                          child: isDone && !isCurrent
                              ? const Icon(Icons.check_rounded,
                                  size: 18, color: kAccent)
                              : Text(
                                  '${i + 1}',
                                  style: TextStyle(
                                    fontFamily: kVtWizardFontFamily,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14,
                                    color:
                                        isCurrent ? Colors.white : kVtWizardInk,
                                  ),
                                ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

/// The current section's fields that carry a real kFieldTooltips entry, in
/// the section's own field order — feeds _VtWizardHelperPanel's static
/// bullet list. Deliberately every tip for the section at once (matching
/// Figma's own fixed "Aide & Instructions" bullet list, node 6:4386),
/// not just the currently-focused field's tip: a respondent may land on a
/// section without having focused anything yet, and the panel would
/// otherwise sit empty most of the time.
List<LocalizedText> _vtWizardSectionTips(SectionSchema section) => [
      for (final id in section.fieldIds)
        if (kFieldTooltips[id] != null) kFieldTooltips[id]!,
    ];

/// Figma's "Aide & Instructions" right-hand rail (node 6:4386 on the
/// Identification reference) — a static bullet list of contextual tips
/// for the fields on the active section, using the same kFieldTooltips
/// content the inline info-badge/tooltip already shows on hover
/// (vt_wizard_fields.dart's _VtWizardInfoBadge), just surfaced proactively
/// instead of hidden behind a tap. Purely additive: reads the exact same
/// tooltip map, writes nothing, and only ever appears once there's real
/// spare width left over after the task rail and content column (see
/// showHelperPanel's own doc comment in VtWizardShell.build).
class _VtWizardHelperPanel extends StatelessWidget {
  final List<LocalizedText> tips;
  const _VtWizardHelperPanel({required this.tips});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    return Container(
      width: kVtWizardSidebarWidth,
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(left: BorderSide(color: kVtWizardCardBorder)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Icon(Icons.help_outline_rounded,
                  size: 18, color: kVtWizardInk),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  const LocalizedText(
                          fr: 'Aide & Instructions', en: 'Help & Instructions')
                      .of(locale),
                  style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    color: kVtWizardInk,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: kVtWizardCardBorder, height: 1),
          const SizedBox(height: 16),
          if (tips.isEmpty)
            Text(
              const LocalizedText(
                fr: "Aucune indication complémentaire pour cette section.",
                en: 'No additional guidance for this section.',
              ).of(locale),
              style: kVtWizardCaption,
            )
          else
            for (var i = 0; i < tips.length; i++) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    margin: const EdgeInsets.only(top: 5),
                    decoration: const BoxDecoration(
                      color: kAccent,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      tips[i].of(locale),
                      style: const TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight: FontWeight.w500,
                        fontSize: 11,
                        height: 1.45,
                        color: kVtWizardInkSoft,
                      ),
                    ),
                  ),
                ],
              ),
              if (i != tips.length - 1) const SizedBox(height: 12),
            ],
        ],
      ),
    );
  }
}

/// Desktop task rail / compact task-list sheet: one declaration-level task
/// status per section. It deliberately avoids the former field percentage,
/// which excluded table cells and contradicted the green completion marks.
class _VtWizardSidebar extends StatelessWidget {
  final OnefopFormController ctrl;
  final List<SectionSchema> sections;
  final int? currentIndex;
  final VtWizardSectionOutlineModel? sectionOutline;
  final void Function(int) onTapSection;
  const _VtWizardSidebar({
    required this.ctrl,
    required this.sections,
    required this.currentIndex,
    this.sectionOutline,
    required this.onTapSection,
  });

  bool _isComplete(SectionSchema section) {
    final stats = vtWizardSectionStats(ctrl, section);
    // Regular field tasks are complete only when every visible field has a
    // value and the existing validator accepts the section. A table-only
    // task has no direct field count, so its established table-aware
    // validator remains the authoritative source.
    return ctrl.valid[section.id] == true &&
        (stats.total == 0 || stats.filled == stats.total);
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final done = sections.where(_isComplete).length;

    return Container(
      width: kVtWizardSidebarWidth,
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(right: BorderSide(color: kVtWizardCardBorder)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.l10n.minefopOnefopBrandTag, style: kVtWizardSectionTitle),
          const SizedBox(height: 4),
          Text(
            const LocalizedText(
                    fr: 'RECENSEMENT ANNUEL 2025-2026',
                    en: 'ANNUAL CENSUS 2025-2026')
                .of(locale),
            style: kVtWizardCaption,
          ),
          const SizedBox(height: 16),
          const Divider(color: kVtWizardCardBorder, height: 1),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.separated(
              itemCount: sections.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final s = sections[i];
                final meta = kSidebarMeta[s.id];
                final isCurrent = i == currentIndex;
                final isDone = _isComplete(s);
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _VtWizardStepRow(
                      index: i + 1,
                      label: meta?.label.of(locale) ?? s.id,
                      isCurrent: isCurrent,
                      isDone: isDone,
                      onTap: () => onTapSection(i),
                    ),
                    if (isCurrent && sectionOutline != null) ...[
                      const SizedBox(height: 6),
                      Padding(
                        padding: const EdgeInsets.only(left: 12),
                        child: _VtWizardSidebarOutline(
                          outline: sectionOutline!,
                        ),
                      ),
                    ],
                  ],
                );
              },
            ),
          ),
          const Divider(color: kVtWizardCardBorder, height: 1),
          const SizedBox(height: 12),
          Text(
            locale.languageCode == 'fr'
                ? '$done sur ${sections.length} sections terminées'
                : '$done of ${sections.length} sections complete',
            style: kVtWizardCaption,
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: sections.isEmpty ? 0 : done / sections.length,
              minHeight: 6,
              backgroundColor: kVtWizardBackground,
              valueColor: const AlwaysStoppedAnimation(kAccent),
            ),
          ),
        ],
      ),
    );
  }
}

/// The active section's outline lives with declaration navigation instead of
/// competing for width beside the respondent's form. Selecting an item only
/// changes reading location in the already-mounted section document.
class _VtWizardSidebarOutline extends StatelessWidget {
  final VtWizardSectionOutlineModel outline;

  const _VtWizardSidebarOutline({required this.outline});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final total = outline.items.fold<int>(0, (sum, item) => sum + item.total);
    final filled = outline.items.fold<int>(0, (sum, item) => sum + item.filled);
    final coverage = total == 0 ? 0.0 : filled / total;
    final coverageLabel = const LocalizedText(
      fr: 'PROGRESSION DE LA SECTION',
      en: 'SECTION PROGRESS',
    ).of(locale);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 2, 8, 6),
          child: Text(
            const LocalizedText(
              fr: 'PLAN DE LA SECTION',
              en: 'SECTION OUTLINE',
            ).of(locale),
            style: kVtWizardCaption.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: .3,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
          child: Semantics(
            label: '$coverageLabel ${(coverage * 100).round()}%',
            value: '${(coverage * 100).round()}%',
            child: ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(
                value: coverage,
                minHeight: 5,
                backgroundColor: kVtWizardBackground,
                valueColor: const AlwaysStoppedAnimation(kAccent),
              ),
            ),
          ),
        ),
        for (var i = 0; i < outline.items.length; i++)
          _VtWizardSidebarOutlineRow(
            item: outline.items[i],
            selected: i == outline.activeIndex,
            onTap: () => outline.onSelect(i),
          ),
      ],
    );
  }
}

class _VtWizardSidebarOutlineRow extends StatelessWidget {
  final VtWizardSectionOutlineItem item;
  final bool selected;
  final VoidCallback onTap;

  const _VtWizardSidebarOutlineRow({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final (icon, color, detail) = switch (item.status) {
      VtWizardSectionOutlineStatus.complete => (
          Icons.check_circle_rounded,
          kAccent,
          const LocalizedText(fr: 'Terminé', en: 'Complete').of(locale),
        ),
      VtWizardSectionOutlineStatus.inProgress => (
          Icons.timelapse_rounded,
          kVtWizardInkSoft,
          const LocalizedText(fr: 'En cours', en: 'In progress').of(locale),
        ),
      VtWizardSectionOutlineStatus.needsAttention => (
          Icons.error_outline_rounded,
          kVtWizardRed,
          locale.languageCode == 'fr'
              ? '${item.errors} réponse${item.errors == 1 ? '' : 's'} à corriger'
              : '${item.errors} answer${item.errors == 1 ? '' : 's'} to fix',
        ),
      VtWizardSectionOutlineStatus.notStarted => (
          Icons.radio_button_unchecked_rounded,
          kVtWizardInkFaint,
          const LocalizedText(fr: 'Pas commencé', en: 'Not started').of(locale),
        ),
    };
    return Semantics(
      button: true,
      selected: selected,
      label: '${item.label}, $detail',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? kVtWizardAccentSoft : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight:
                            selected ? FontWeight.w800 : FontWeight.w700,
                        fontSize: 11,
                        color: selected ? kAccent : kVtWizardInk,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      detail,
                      style: TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight: FontWeight.w600,
                        fontSize: 10,
                        color: color,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VtWizardStepRow extends StatelessWidget {
  final int index;
  final String label;
  final bool isCurrent;
  final bool isDone;
  final VoidCallback onTap;
  const _VtWizardStepRow({
    required this.index,
    required this.label,
    required this.isCurrent,
    required this.isDone,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isCurrent ? kVtWizardAccentSoft : Colors.transparent,
          border: isCurrent ? Border.all(color: kAccent) : null,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isDone
                    ? kAccent
                    : (isCurrent ? kAccent : kVtWizardBackground),
                borderRadius: BorderRadius.circular(12),
              ),
              child: isDone
                  ? const Icon(Icons.check_rounded,
                      size: 12, color: Colors.white)
                  : Text('$index',
                      style: TextStyle(
                          fontFamily: kVtWizardFontFamily,
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                          color: isCurrent ? Colors.white : kVtWizardInkSoft)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                    color: isCurrent ? kAccent : kVtWizardInk),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
