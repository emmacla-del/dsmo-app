// lib/core/focus/renderers/onefop_section_renderer.dart
//
// ══════════════════════════════════════════════════════════════
// ONEFOP SECTION RENDERER  (modern card aesthetic)
//
// Widgets:
//   • OnefopSectionContainer    — rounded card with header + body
//   • OnefopFieldLabel          — label with required/optional badge
//   • OnefopQuestionHeader      — amber question code box
//   • OnefopSubsectionHeader    — coloured accent bar + title
//   • OnefopDividerLabel        — section divider with text
//
// MODERNIZED:
//   • 12 px card radius, soft shadow
//   • 16 px section header, white on blue
//   • 14 px labels, 8 px gap to input
//   • Generous padding throughout
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'onefop_layout_constants.dart';

// ─────────────────────────────────────────────────────────────
// SECTION CONTAINER
// ─────────────────────────────────────────────────────────────

class OnefopSectionContainer extends StatelessWidget {
  final String sectionId;
  final String title;
  final IconData? icon;
  final bool isComplete;
  final Widget body;

  const OnefopSectionContainer({
    super.key,
    required this.sectionId,
    required this.title,
    this.icon,
    required this.isComplete,
    required this.body,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: OL.sectionGapV),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: OL.sectionHeaderPaddingH,
              vertical: OL.sectionHeaderPaddingV,
            ),
            decoration: BoxDecoration(
              color: OL.sectionHeaderBg(sectionId),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(12),
                topRight: Radius.circular(12),
              ),
            ),
            child: Row(
              children: [
                if (icon != null) ...[
                  Icon(icon, color: Colors.white, size: 18),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Text(
                    title,
                    style: OL.shStyle,
                  ),
                ),
                if (isComplete)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF70AD47),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check, color: Colors.white, size: 12),
                        SizedBox(width: 4),
                        Text(
                          'Complet',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: const Color(0xFFF59E0B), width: 0.5),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.pending, color: Color(0xFFD97706), size: 12),
                        SizedBox(width: 4),
                        Text(
                          'En cours',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFB45309),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: OL.sectionBodyPaddingH,
              vertical: OL.sectionBodyPaddingV,
            ),
            child: body,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// FIELD LABEL
// ─────────────────────────────────────────────────────────────

class OnefopFieldLabel extends StatelessWidget {
  final String label;
  final bool required;
  final bool optional;

  const OnefopFieldLabel({
    super.key,
    required this.label,
    this.required = false,
    this.optional = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Flexible(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Color(0xFF1E293B),
              height: 1.3,
            ),
          ),
        ),
        if (required) ...[
          const SizedBox(width: 4),
          const Text(
            '*',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFFE24B4A),
            ),
          ),
        ],
        if (optional) ...[
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Text(
              'Optionnel',
              style: TextStyle(
                fontSize: 10,
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// QUESTION HEADER (.qt box)
// ─────────────────────────────────────────────────────────────

class OnefopQuestionHeader extends StatelessWidget {
  final String? paperCode;
  final String? questionText;
  final String? subLabel;

  const OnefopQuestionHeader({
    super.key,
    this.paperCode,
    this.questionText,
    this.subLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: OL.labelGapV),
      padding: const EdgeInsets.symmetric(
        horizontal: OL.sectionBodyPaddingH,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        color: OL.qtBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: OL.qtBorder, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (paperCode != null && paperCode!.isNotEmpty)
            Text(paperCode!, style: OL.qcStyle),
          if (questionText != null && questionText!.isNotEmpty) ...[
            if (paperCode != null && paperCode!.isNotEmpty)
              const SizedBox(height: 4),
            Text(questionText!, style: OL.qtStyle),
          ],
          if (subLabel != null && subLabel!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              subLabel!,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w400,
                color: Color(0xFF64748B),
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SUBSECTION HEADER
// ─────────────────────────────────────────────────────────────

class OnefopSubsectionHeader extends StatelessWidget {
  final String title;

  const OnefopSubsectionHeader({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 16),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 20,
            decoration: BoxDecoration(
              color: const Color(0xFF4472C4),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Divider(
              height: 1,
              thickness: 1,
              color: Color(0xFFE2E8F0),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DIVIDER LABEL
// ─────────────────────────────────────────────────────────────

class OnefopDividerLabel extends StatelessWidget {
  final String label;

  const OnefopDividerLabel({super.key, required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 16),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 1,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFE2E8F0), Colors.transparent],
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Color(0xFF64748B),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              height: 1,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.transparent, Color(0xFFE2E8F0)],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
