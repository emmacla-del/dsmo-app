// lib/screens/onefop/simple_mode_shell.dart
//
// Desktop "Simple Mode" — the guided, low-cognitive-load alternative to
// OnefopExcelShell's spreadsheet chrome (see onefop_mode_provider.dart).
// Phase 1 only: reuses the exact same per-unit navigation model
// (onefop_section_units.dart) both OnefopExcelShell and mobile's
// _sectionUnitBody already use — same OnefopFormController, same cell
// IDs, same validation/autosave — just larger, more guided chrome around
// it. The fine-grained "one cell-group per screen" flow is a later phase;
// this shows the real current table/question, not a placeholder.
//
// buildField is supplied by the caller (the screen's own _buildField)
// rather than duplicated here, so simple-field rendering can never drift
// between Simple Mode and the mobile layout that already renders them.

import 'package:flutter/material.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/schema/section_schema.dart';
import '../../providers/onefop_mode_provider.dart';
import 'onefop_form_constants.dart';
import 'onefop_form_controller.dart';
import 'onefop_form_widgets.dart' show OnefopShellTitleBar, pairShortFields;
import 'onefop_section_units.dart';
import 'widgets/gds_error_summary.dart';

class SimpleModeShell extends StatelessWidget {
  final OnefopFormController ctrl;
  final EntityType entityType;
  final Widget Function(FieldSchema) buildField;
  final Future<void> Function() onPreviewSubmit;
  // Title bar — mirrors OnefopExcelShell's own single title bar (see
  // OnefopShellTitleBar) so both desktop modes render exactly the same
  // one-app-bar/one-logo chrome instead of Simple Mode also keeping the
  // outer Scaffold app bar around it.
  final String title;
  final bool dirty;
  final bool saving;
  final Future<void> Function()? onSaveNow;
  final VoidCallback? onOpenDrafts;
  final VoidCallback? onCancel;
  final OnefopViewMode mode;
  final void Function(OnefopViewMode) onModeChanged;
  final List<OnefopViewMode>? availableModes;
  const SimpleModeShell({
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
    this.availableModes,
    this.onSaveNow,
    this.onOpenDrafts,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final sec = ctrl.primarySection(ctrl.currentPage);

    Widget body = const SizedBox.shrink();
    if (sec != null) {
      // mobile: true — Simple Mode wants the guided card-style table
      // rendering (MobileCardTable) regardless of screen width; the dense
      // spreadsheet grid is Spreadsheet Mode's job, not Simple Mode's.
      final units = buildTableGroupUnits(
        ctrl,
        sec,
        locale,
        entityType: entityType,
        // ListenableBuilder on ctrl.fm (not just ctrl itself, a separate
        // ChangeNotifier — see UnifiedFocusManagerV2) is what lets the
        // active-question frame below track keyboard focus reactively;
        // without it this Column would only ever repaint on ctrl's own
        // notifyListeners (data changes), not on a bare focus move.
        simpleFieldsBuilder: (fields, _) => ListenableBuilder(
          listenable: ctrl.fm,
          builder: (context, _) {
            // Section 0 (Respondent Identification) and each entity's
            // Section 1 pair short fields (text/number/email/tel)
            // two-per-row, matching VT Wizard's own field pairing — every
            // other section keeps one full-width question per row,
            // unchanged (see pairShortFields' doc comment).
            //
            // VT excluded: isSimpleSection's own endsWith('_vocationalTraining')
            // clause matches every VT section (not just its Section
            // 0/1-equivalents), and VT's Simple Mode fallback does reach
            // this builder — pairing those overflowed the 760px column
            // (live-caught: simple_mode_shell.dart Row overflow on
            // section2_vocationalTraining). VT's own two-column pairing is
            // VtWizardSectionScreen's job, not this one.
            if (entityType != EntityType.vocationalTraining &&
                ctrl.isSimpleSection(sec.id)) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final group in pairShortFields(fields))
                    if (group.length == 2)
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Expanded, not a fixed-width SizedBox: the
                          // content column isn't always exactly
                          // kSimpleModeContentWidth wide (live-caught: a
                          // 42px overflow when the actual available width
                          // was narrower, e.g. a smaller desktop window) —
                          // sharing the available width equally keeps this
                          // row responsive the same way the solo/full-width
                          // fields below it already are.
                          Expanded(
                            child: _ActiveQuestionFrame(
                              active: ctrl.fm.activeId == group[0].id,
                              child: buildField(group[0]),
                            ),
                          ),
                          const SizedBox(width: kTwoColGap),
                          Expanded(
                            child: _ActiveQuestionFrame(
                              active: ctrl.fm.activeId == group[1].id,
                              child: buildField(group[1]),
                            ),
                          ),
                        ],
                      )
                    else
                      _ActiveQuestionFrame(
                        active: ctrl.fm.activeId == group[0].id,
                        child: buildField(group[0]),
                      ),
                ],
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final f in fields)
                  _ActiveQuestionFrame(
                    active: ctrl.fm.activeId == f.id,
                    child: buildField(f),
                  ),
              ],
            );
          },
        ),
        mobile: false,
        squareCorners: true,
        // Pin the current question's paperCode/text above the scroll (see
        // _UnitBody) instead of letting it scroll away with the category
        // cards under it — the whole point of a long, freely-scrollable
        // card list is that the user shouldn't lose track of which
        // question those cards belong to partway down it.
        separateHeader: true,
      );
      if (units.isNotEmpty) {
        body = _UnitBody(
          ctrl: ctrl,
          section: sec,
          units: units,
          entityType: entityType,
          onPreviewSubmit: onPreviewSubmit,
        );
      }
    }

    // No section-label header of its own here — the Sidebar's highlighted
    // item already shows the current section; a second "Répondant" bar
    // just repeated in the body was pure redundant chrome.
    return Column(
      children: [
        OnefopShellTitleBar(
          title: title,
          leadingIcon: Icons.checklist_rtl_rounded,
          simpleMode: true,
          dirty: dirty,
          saving: saving,
          saveFailed: ctrl.saveFailed,
          lastSavedAt: ctrl.lastSavedAt,
          onSaveNow: onSaveNow,
          onOpenDrafts: onOpenDrafts,
          onCancel: onCancel,
          mode: mode,
          onModeChanged: onModeChanged,
          availableModes: availableModes,
        ),
        SimpleModeProgressHeader(ctrl: ctrl),
        Expanded(
          child: Container(color: kFigmaSimpleBackground, child: body),
        ),
      ],
    );
  }
}

class SimpleModeProgressHeader extends StatelessWidget {
  final OnefopFormController ctrl;
  const SimpleModeProgressHeader({super.key, required this.ctrl});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final total = ctrl.pageCount;
    final page = total == 0 ? 0 : ctrl.currentPage + 1;
    final completed = ctrl.valid.values.where((value) => value).length;
    final ratio = total == 0 ? 0.0 : (page / total).clamp(0.0, 1.0);
    final section = ctrl.primarySection(ctrl.currentPage);
    final title = section == null
        ? 'ONEFOP'
        : ctrl.sectionTitle(ctrl.currentPage, context.loc);

    return Container(
      color: kFigmaSimpleBackground,
      padding: const EdgeInsets.fromLTRB(28, 16, 28, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '$title  ·  Section $page / $total',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: kFigmaSimpleInk,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                '$completed/${ctrl.valid.length} ${locale.languageCode == 'en' ? 'valid' : 'validé(s)'}',
                style: const TextStyle(
                  color: kFigmaSimplePrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: kOnefopProgressHeight,
              backgroundColor: kFigmaSimpleBorder,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(kFigmaSimplePrimary),
            ),
          ),
        ],
      ),
    );
  }
}

class SimpleModeSidebar extends StatelessWidget {
  final OnefopFormController ctrl;
  final EntityType entityType;

  const SimpleModeSidebar({
    super.key,
    required this.ctrl,
    required this.entityType,
  });

  @override
  Widget build(BuildContext context) {
    if (ctrl.schema == null) return const SizedBox.shrink();
    return ValueListenableBuilder<int>(
      valueListenable: ctrl.version,
      builder: (context, _, __) {
        final total = ctrl.pageCount;
        final completed =
            List.generate(total, (page) => page).where(_isPageComplete).length;
        final ratio = total == 0 ? 0.0 : completed / total;
        return Container(
          width: kFigmaSimpleSidebarWidth,
          color: kSurface,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _brandHeader(context),
              const Divider(height: 1, color: kFigmaSimpleBorder),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
                  itemCount: total,
                  itemBuilder: (context, page) => _sectionItem(context, page),
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: kFigmaSimpleBorder)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            context.l10n.completedSlashLabel,
                            style: const TextStyle(
                              color: kFigmaSimpleSecondary,
                              fontSize: 10,
                            ),
                          ),
                        ),
                        Text(
                          '${(ratio * 100).round()}%',
                          style: const TextStyle(
                            color: kFigmaSimplePrimary,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: ratio,
                      minHeight: 4,
                      backgroundColor: kFigmaSimpleBorder,
                      valueColor: const AlwaysStoppedAnimation<Color>(
                          kFigmaSimplePrimary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  bool _isPageComplete(int page) {
    final indexes = ctrl.sectionIndicesForPage(page);
    return indexes.isNotEmpty &&
        indexes.every(
            (index) => ctrl.valid[ctrl.schema!.sections[index].id] ?? false);
  }

  Widget _brandHeader(BuildContext context) {
    return SizedBox(
      height: kFigmaSimpleHeaderHeight,
      child: Row(
        children: [
          const SizedBox(width: 16),
          Image.asset(
            'assets/images/onefop_logo.png',
            width: 28,
            height: 28,
            fit: BoxFit.contain,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              context.l10n.minefopOnefopBrandTag,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: kFigmaSimplePrimary,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionItem(BuildContext context, int page) {
    final indexes = ctrl.sectionIndicesForPage(page);
    final section =
        indexes.isEmpty ? null : ctrl.schema!.sections[indexes.first];
    if (section == null) return const SizedBox.shrink();
    final active = page == ctrl.currentPage;
    final complete = _isPageComplete(page);
    final meta = kSidebarMeta[section.id];
    final label = meta?.label.of(context.loc) ?? 'Section ${page + 1}';

    return InkWell(
      onTap: () => navigateToSection(ctrl, context.loc, entityType, section.id),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFE8F4EF) : Colors.transparent,
          border: Border.all(
            color: active ? kFigmaSimplePrimary : Colors.transparent,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Container(
              width: 22,
              height: 22,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: complete || active
                    ? kFigmaSimplePrimary
                    : const Color(0xFFF1F5F4),
              ),
              child: complete
                  ? const Icon(Icons.check, color: Colors.white, size: 13)
                  : Text(
                      '${page + 1}',
                      style: TextStyle(
                        color: active ? Colors.white : kFigmaSimpleSecondary,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: active ? kFigmaSimplePrimary : kFigmaSimpleInk,
                  fontSize: 11,
                  fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SimpleModeGovernmentHeader extends StatelessWidget {
  const SimpleModeGovernmentHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: kFigmaSimpleHeaderHeight,
      color: kSurface,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Image.asset(
            'assets/images/onefop_logo.png',
            width: 28,
            height: 28,
            fit: BoxFit.contain,
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 210,
            child: Text(
              context.l10n.minefopOnefopBrandTag,
              style: const TextStyle(
                color: kFigmaSimplePrimary,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const Expanded(
            child: _GovernmentIdentity(
              title: 'RÉPUBLIQUE DU CAMEROUN',
              subtitle: 'Paix · Travail · Patrie',
            ),
          ),
          Container(
            width: 42,
            height: 22,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(3),
              border: Border.all(color: kFigmaSimpleBorder),
            ),
            clipBehavior: Clip.antiAlias,
            child: const Row(
              children: [
                Expanded(child: ColoredBox(color: kFigmaSimplePrimary)),
                Expanded(child: ColoredBox(color: kFigmaSimpleRed)),
                Expanded(child: ColoredBox(color: kFigmaSimpleYellow)),
              ],
            ),
          ),
          const Expanded(
            child: _GovernmentIdentity(
              title: 'REPUBLIC OF CAMEROON',
              subtitle: 'Peace · Work · Fatherland',
              alignEnd: true,
            ),
          ),
          const SizedBox(width: 16),
          Text(
            context.l10n.minefopOnefopBrandTag,
            style: const TextStyle(
              color: kFigmaSimpleSecondary,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _GovernmentIdentity extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool alignEnd;

  const _GovernmentIdentity({
    required this.title,
    required this.subtitle,
    this.alignEnd = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment:
          alignEnd ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Text(title,
            style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w800)),
        Text(subtitle,
            style: const TextStyle(fontSize: 7, color: kFigmaSimpleMuted)),
      ],
    );
  }
}

/// Reads the live unit list/cursor on every rebuild (the screen already
/// rebuilds on controller notifyListeners — see _onControllerChange), so
/// this stays a plain StatelessWidget with no extra listening of its own.
class _UnitBody extends StatelessWidget {
  final OnefopFormController ctrl;
  final SectionSchema section;
  final List<SectionUnit> units;
  final EntityType entityType;
  final Future<void> Function() onPreviewSubmit;
  const _UnitBody({
    required this.ctrl,
    required this.section,
    required this.units,
    required this.entityType,
    required this.onPreviewSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final currentIdx =
        (ctrl.unitCursor(section.id) ?? currentUnitIndex(ctrl, units))
            .clamp(0, units.length - 1);
    final unit = units[currentIdx];
    final isFirst = currentIdx == 0;
    final isLast = currentIdx == units.length - 1;
    // True end of the whole form — the last unit of the last section, past
    // which there is no next unit or next page to advance/cross into. This
    // is the only place Simple Mode can offer Submit at all (unlike
    // Spreadsheet Mode's OnefopExcelShell and mobile's _navBar(), Simple
    // Mode has no page-level action bar of its own), so without this the
    // Next button simply disappears once the form is fully filled in,
    // leaving no way to submit.
    final isFormEnd = isLast && ctrl.currentPage == ctrl.pageCount - 1;

    ctrl.setRevealedFieldIds(unit.fieldIds);
    ctrl.setRevealBoundaryActions(
      forward: isFormEnd
          ? () => onPreviewSubmit()
          : isLast
              ? () => advanceToNextSection(ctrl)
              : () => advanceToUnit(ctrl, section, units, currentIdx),
      backward: isFirst
          ? () => retreatToPreviousSection(ctrl)
          : () => retreatToUnit(ctrl, section, units, currentIdx),
    );

    return Column(
      children: [
        // The subsection caption, question header, and table all travel
        // together inside the same centered block now (see below) instead
        // of being pinned above the scroll — so a short unit centers as
        // one group with no gap opening up between its pieces. The
        // tradeoff: for a unit tall enough to actually scroll, the caption
        // and header scroll away with it instead of staying pinned. Only
        // UnitNavRow stays a real fixed footer, outside this Column
        // entirely, since a control the user taps every unit needs a
        // stable position, not one that moves with content height.
        Expanded(
          child: LayoutBuilder(
            builder: (context, viewport) {
              const scrollPadV = 24.0 + 24.0;
              // Responsive content column: up to 85% of the available width,
              // clamped to [kSimpleModeContentWidth … 1100 px]. The lower
              // bound preserves the existing tested layout on narrow desktops
              // and tablets; the upper bound keeps text lines from becoming
              // unreadable on ultra-wide monitors. kSimpleModeContentWidth
              // (760) is still used for the UnitNavRow footer so its
              // Back/Next buttons line up under the narrower reading column
              // even when the content above is allowed to be wider.
              final contentW = (viewport.maxWidth * 0.85)
                  .clamp(kSimpleModeContentWidth, 1100.0);
              return SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                child: ConstrainedBox(
                  // Gives the Center below a height to work with: when the
                  // current unit is shorter than the viewport, the leftover
                  // space splits evenly above and below the whole block,
                  // centering it. Taller content just grows past this
                  // minimum and scrolls from the top, same as plain
                  // scrolling content always does.
                  constraints: BoxConstraints(
                    minHeight: (viewport.maxHeight - scrollPadV)
                        .clamp(0.0, double.infinity),
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: contentW),
                      child: KeyedSubtree(
                        key: ctrl.keyForUnit(unit.key),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // The section's own title — see
                            // ExcelSectionBody's identical addition for why
                            // (ctrl.sectionTitle()/SectionTitleLookup
                            // existed already, fully wired from the AST,
                            // but nothing on either platform ever called
                            // it). Shown unconditionally, same as there —
                            // a section with no subsections still deserves
                            // to say which section it is.
                            GdsErrorSummary(ctrl: ctrl, section: section),
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Text(
                                ctrl.sectionTitle(
                                    ctrl.currentPage, context.loc),
                                style: kTableHeaderStyle.copyWith(
                                    fontSize: 14, color: kInk),
                              ),
                            ),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: kSurface,
                                border: Border.all(color: kFigmaSimpleBorder),
                                borderRadius:
                                    BorderRadius.circular(kFigmaSimpleRadius),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (unit.header != null) unit.header!(),
                                  UnitTransition(
                                    child: KeyedSubtree(
                                      key: ValueKey(unit.key),
                                      child: unit.content(),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        UnitNavRow(
          large: true,
          contentMaxWidth: kSimpleModeContentWidth,
          // This widget owns no other page-level control of its own (no
          // bottom action bar) — the desktop Sidebar (added one level up,
          // in _desktopLayout) can jump straight to a section, but moving
          // unit-by-unit within/across sections is still only this row, so
          // it has to keep showing (and crossing into the next/previous
          // section) past this section's own last/first unit rather than
          // stopping there. See advanceToNextSection/retreatToPreviousSection.
          showBack: !isFirst || ctrl.currentPage > 0,
          onBack: () => isFirst
              ? retreatToPreviousSection(ctrl)
              : retreatToUnit(ctrl, section, units, currentIdx),
          // At the true form end there's no further unit/page to advance
          // into, so this becomes the Submit action instead of disappearing
          // — see isFormEnd above. Submit is gated on the whole form's
          // validity (mirrors OnefopExcelShell's _BottomActionBar and the
          // page-level NavBar), not just this last unit's own fields.
          showNext: true,
          isSubmit: isFormEnd,
          nextEnabled:
              isFormEnd ? ctrl.validateAllPages() : unit.canAdvance(ctrl),
          onNext: () => isFormEnd
              ? onPreviewSubmit()
              : isLast
                  ? advanceToNextSection(ctrl)
                  : advanceToUnit(ctrl, section, units, currentIdx),
        ),
      ],
    );
  }
}

/// Wraps one Simple Mode question with a thin left accent rail + a very
/// faint tint while it holds keyboard focus — the restrained "which
/// question am I on" signal the approved design direction asked for,
/// applied only to the field currently in focus rather than a persistent
/// card around every question. Every other (inactive) question keeps
/// exactly the flat, borderless look it already had — this widget is a
/// no-op wrapper (returns [child] verbatim) whenever [active] is false, so
/// nothing about spacing or layout changes for the common case.
class _ActiveQuestionFrame extends StatelessWidget {
  final bool active;
  final Widget child;
  const _ActiveQuestionFrame({required this.active, required this.child});

  @override
  Widget build(BuildContext context) {
    if (!active) return child;
    return Container(
      padding: const EdgeInsets.only(left: 13, top: 4, right: 4, bottom: 4),
      decoration: BoxDecoration(
        color: kAccent.withValues(alpha: 0.045),
        border: const Border(left: BorderSide(color: kAccent, width: 3)),
        borderRadius: const BorderRadius.only(
          topRight: Radius.circular(kRadiusXs),
          bottomRight: Radius.circular(kRadiusXs),
        ),
      ),
      child: child,
    );
  }
}
