// lib/screens/onefop/wizard/vt_wizard_section_status_card.dart
// Per-section status card (SECTION N, label, Complété/En cours/Non commencé
// badge, N/M champs progress bar) — Figma's own status mini-card
// (node 66:1159 etc.), used by VtWizardValidationScreen's section recap
// grid. Originally shared with a standalone Dashboard overview screen too,
// but that screen was removed (Back from Section 1 used to land on it,
// which read as a dead end before Identification rather than an exit —
// see vt_wizard_shell.dart's header comment); this card is the only piece
// of it still in use.

import 'package:flutter/material.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/localized_text.dart';
import '../onefop_form_constants.dart' show kAccent;
import 'vt_wizard_constants.dart';
import 'vt_wizard_progress.dart';

/// Three states Figma's own status badge distinguishes (node 66:1164 "En
/// cours" pale-yellow vs 66:1177 "Non commencé" neutral-grey, confirmed
/// via get_design_context against the fresh Dashboard screen, 11:49) —
/// the wizard previously only had two (done/not-done), which showed
/// every untouched section as "En cours" instead of "Non commencé".
enum VtWizardSectionState { notStarted, inProgress, done }

class VtWizardSectionStatusCard extends StatelessWidget {
  final int index;
  final String label;
  final VtWizardSectionState state;
  final VtWizardSectionStats stats;
  final VoidCallback onTap;
  const VtWizardSectionStatusCard({
    super.key,
    required this.index,
    required this.label,
    required this.state,
    required this.stats,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final highlighted = state != VtWizardSectionState.notStarted;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(kVtWizardCardRadius),
      child: Container(
        padding: const EdgeInsets.all(16),
        // Unlike the plain form-card decoration (border only, no
        // shadow), Figma's own status mini-cards carry a soft drop
        // shadow (node 66:1159 etc.) — added here rather than in
        // vtWizardCardDecoration() since every other card in the wizard
        // (form-card, guided-entry-card, ...) is shadowless.
        decoration: vtWizardCardDecoration().copyWith(
          border: Border.all(
              color: highlighted ? kAccent : kVtWizardCardBorder,
              width: highlighted ? 1.5 : 1),
          boxShadow: const [
            BoxShadow(
                color: Color(0x0F000000), blurRadius: 4, offset: Offset(0, 2)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(context.l10n.vtWizardSectionNumberLabel(index),
                          style: TextStyle(
                              fontFamily: kVtWizardFontFamily,
                              fontWeight: FontWeight.w700,
                              fontSize: 11,
                              color: highlighted ? kAccent : kVtWizardInkSoft)),
                      Text(label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontFamily: kVtWizardFontFamily,
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                              color: kVtWizardInk)),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: switch (state) {
                      VtWizardSectionState.done => kVtWizardAccentSoft,
                      VtWizardSectionState.inProgress =>
                        const Color(0xFFFFFCEB),
                      VtWizardSectionState.notStarted => kVtWizardBackground,
                    },
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    switch (state) {
                      VtWizardSectionState.done =>
                        const LocalizedText(fr: 'Complété', en: 'Completed')
                            .of(locale),
                      VtWizardSectionState.inProgress =>
                        const LocalizedText(fr: 'En cours', en: 'In progress')
                            .of(locale),
                      VtWizardSectionState.notStarted => const LocalizedText(
                              fr: 'Non commencé', en: 'Not started')
                          .of(locale),
                    },
                    style: TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight: FontWeight.w700,
                        fontSize: 10,
                        color: switch (state) {
                          VtWizardSectionState.done => kAccent,
                          VtWizardSectionState.inProgress => kVtWizardInk,
                          VtWizardSectionState.notStarted => kVtWizardInkSoft,
                        }),
                  ),
                ),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (stats.total > 0)
                  Text(
                      context.l10n
                          .vtWizardFieldsFilledCount(stats.filled, stats.total),
                      style: kVtWizardCaption),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: stats.fraction,
                    minHeight: 4,
                    backgroundColor: kVtWizardBackground,
                    valueColor: const AlwaysStoppedAnimation(kAccent),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
