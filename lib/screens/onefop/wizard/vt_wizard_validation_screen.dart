// lib/screens/onefop/wizard/vt_wizard_validation_screen.dart
// Figma screen 12 — "Validation & Submission". Recap grid of all 9
// sections + confidentiality reminder + the existing save-draft/submit
// actions.
//
// The review-copy and review-declaration actions both call the SAME
// onPreviewSubmit callback every other mode's submit button already uses
// — it validates every page, generates the PDF, and opens PdfViewerScreen
// with an onConfirm that's the actual submit (see _previewSubmit in
// onefop_unified_form_screen_v4.dart). Neither wizard button submits by
// itself: opening the PDF viewer IS "export," and the real submission
// only happens if the user then confirms inside that viewer. Figma draws
// this as two separate buttons anyway. The labels below deliberately say
// review rather than submit: the actual submission is confirmed later in
// the PDF viewer, so the initial action must not promise an irreversible
// outcome it has not yet performed.

import 'package:flutter/material.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/localized_text.dart';
import '../../../core/focus/schema/section_schema.dart';
import '../onefop_form_constants.dart';
import '../onefop_form_controller.dart';
import 'vt_wizard_constants.dart';
import 'vt_wizard_section_status_card.dart'
    show VtWizardSectionStatusCard, VtWizardSectionState;
import 'vt_wizard_progress.dart';

class VtWizardValidationScreen extends StatelessWidget {
  final OnefopFormController ctrl;
  final List<SectionSchema> sections;
  final void Function(int) onOpenSection;
  final VoidCallback onBack;
  final Future<void> Function() onPreviewSubmit;
  const VtWizardValidationScreen({
    super.key,
    required this.ctrl,
    required this.sections,
    required this.onOpenSection,
    required this.onBack,
    required this.onPreviewSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final incomplete = <SectionSchema>[
      for (final s in sections)
        if (ctrl.valid[s.id] != true) s,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          const LocalizedText(
            fr: 'Merci pour votre participation',
            en: 'Thank you for your participation',
          ).of(locale),
          // Figma prints this heading in the accent green (#006643), not
          // the default ink kVtWizardTitle carries — confirmed via
          // get_design_context against node 11:2484.
          style: kVtWizardTitle.copyWith(color: kAccent),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: kVtWizardAccentSoft,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.gpp_good_outlined, size: 20, color: kAccent),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(context.l10n.confidentialityNoticeHeading,
                        style: const TextStyle(
                            fontFamily: kVtWizardFontFamily,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: kAccent)),
                    const SizedBox(height: 4),
                    Text(context.l10n.confidentialityNoticeBody,
                        style: kVtWizardBody.copyWith(height: 1.5)),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (incomplete.isNotEmpty) ...[
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: kVtWizardYellowSoft,
              border: Border.all(color: kVtWizardYellow),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              const LocalizedText(
                fr: 'Attention : certaines sections ne sont pas encore '
                    'complètes. Vous pouvez les corriger avant de soumettre.',
                en: 'Note: some sections are not yet complete. You can fix '
                    'them before submitting.',
              ).of(locale),
              style: kVtWizardBody,
            ),
          ),
        ],
        const SizedBox(height: 24),
        Text(
          const LocalizedText(
                  fr: 'Récapitulatif des 9 sections',
                  en: 'Summary of the 9 sections')
              .of(locale)
              .toUpperCase(),
          style: kVtWizardSectionTitle.copyWith(fontSize: 14),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            childAspectRatio: 2.6,
          ),
          itemCount: sections.length,
          itemBuilder: (context, i) {
            final s = sections[i];
            final meta = kSidebarMeta[s.id];
            final stats = vtWizardSectionStats(ctrl, s);
            final state = ctrl.valid[s.id] == true
                ? VtWizardSectionState.done
                : stats.filled > 0
                    ? VtWizardSectionState.inProgress
                    : VtWizardSectionState.notStarted;
            return VtWizardSectionStatusCard(
              index: i + 1,
              label: meta?.label.of(locale) ?? s.id,
              state: state,
              stats: stats,
              onTap: () => onOpenSection(i),
            );
          },
        ),
        const SizedBox(height: 32),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            OutlinedButton.icon(
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back_rounded, size: 16),
              label: Text(const LocalizedText(fr: 'Précédent', en: 'Previous')
                  .of(locale)),
              style: OutlinedButton.styleFrom(
                foregroundColor: kVtWizardInkSoft,
                side: const BorderSide(color: kVtWizardCardBorder),
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        // Review and Save Draft. The true submit action is intentionally
        // named only at the final confirmation point in the existing PDF
        // viewer flow; calling this first step "Submit" was misleading.
        Center(
          child: Column(
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  OutlinedButton(
                    onPressed: () => onPreviewSubmit(),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kVtWizardInk,
                      side: const BorderSide(color: kVtWizardCardBorder),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 14),
                    ),
                    child: Text(
                      const LocalizedText(
                              fr: '📄 Formulaire officiel ONEFOP (CAM-LEAP)',
                              en: '📄 Official ONEFOP Form (CAM-LEAP)')
                          .of(locale),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(width: 16),
                  OutlinedButton(
                    onPressed: ctrl.saveNow,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kVtWizardInk,
                      side: const BorderSide(color: kVtWizardCardBorder),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 14),
                    ),
                    child: Text(
                      const LocalizedText(
                              fr: 'Sauvegarder Brouillon', en: 'Save Draft')
                          .of(locale),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => onPreviewSubmit(),
                icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                iconAlignment: IconAlignment.end,
                label: Text(
                  const LocalizedText(
                          fr: 'Vérifier la déclaration',
                          en: 'Review declaration')
                      .of(locale),
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 15),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: kAccent,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 48, vertical: 18),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
