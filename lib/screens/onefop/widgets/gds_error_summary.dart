// lib/screens/onefop/widgets/gds_error_summary.dart
// ══════════════════════════════════════════════════════════════
// GDS ERROR SUMMARY BANNER (GOV.UK & USWDS STANDARD)
// Prominent, accessible top-of-page error summary container
// that lists all invalid fields and allows direct click-to-focus jump.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/focus/schema/section_schema.dart';
import '../onefop_form_controller.dart';

class GdsErrorSummary extends StatelessWidget {
  final OnefopFormController ctrl;
  final SectionSchema section;
  final VoidCallback? onDismiss;

  const GdsErrorSummary({
    super.key,
    required this.ctrl,
    required this.section,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final isEn = locale.languageCode == 'en';
    final l10n = context.l10n;

    // Collect invalid fields for the current section
    final invalidFields = <_FieldErrorInfo>[];
    for (final fid in section.fieldIds) {
      final f = ctrl.schema?.getField(fid);
      if (f != null && ctrl.isFieldVisible(f) && ctrl.hasError(f)) {
        final label = f.label?.of(locale) ?? f.paperCode ?? f.id;
        final error = ctrl.errorText(f, l10n);
        invalidFields.add(_FieldErrorInfo(fieldId: f.id, label: label, error: error));
      }
    }

    if (invalidFields.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2), // Light red surface
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: const Color(0xFFB91C1C), width: 2), // Heavy 2px GDS error border
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Error Header Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: const Color(0xFFB91C1C),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    isEn
                        ? 'There is a problem (${invalidFields.length} field${invalidFields.length > 1 ? "s" : ""} require attention)'
                        : 'Il y a un problème (${invalidFields.length} champ${invalidFields.length > 1 ? "s nécessitent" : " nécessite"} votre attention)',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
                if (onDismiss != null)
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white, size: 18),
                    onPressed: onDismiss,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
              ],
            ),
          ),

          // Error Links List
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isEn
                      ? 'Please correct the following before continuing:'
                      : 'Veuillez corriger les éléments suivants pour poursuivre :',
                  style: const TextStyle(
                    color: Color(0xFF7F1D1D),
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 10),
                for (final item in invalidFields)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: InkWell(
                      onTap: () {
                        ctrl.focusFieldId(item.fieldId, preferFirst: true, scroll: true);
                        ctrl.scrollToField(item.fieldId);
                      },
                      borderRadius: BorderRadius.circular(3),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              '• ',
                              style: TextStyle(
                                color: Color(0xFFB91C1C),
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            Expanded(
                              child: RichText(
                                text: TextSpan(
                                  children: [
                                    TextSpan(
                                      text: '${item.label} : ',
                                      style: const TextStyle(
                                        color: Color(0xFFB91C1C),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        decoration: TextDecoration.underline,
                                      ),
                                    ),
                                    TextSpan(
                                      text: item.error,
                                      style: const TextStyle(
                                        color: Color(0xFF991B1B),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldErrorInfo {
  final String fieldId;
  final String label;
  final String error;
  const _FieldErrorInfo({
    required this.fieldId,
    required this.label,
    required this.error,
  });
}
