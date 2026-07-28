// lib/screens/dsmo/dsmo_form_style.dart
//
// Shared visual language for DSMO registration/declaration forms. Reuses
// the design tokens and schema-agnostic widgets already used by the
// ONEFOP form (lib/screens/onefop, lib/core/focus/renderers) so both
// flows look and feel consistent, without pulling in ONEFOP's schema/
// controller machinery — only pure-constant/stateless pieces are used.

import 'package:flutter/material.dart';

import '../onefop/onefop_form_constants.dart';
import '../../core/focus/renderers/onefop_layout_constants.dart';
import '../../core/focus/renderers/onefop_section_renderer.dart';

export '../onefop/onefop_form_constants.dart'
    show
        kAccent,
        kAccentDeep,
        kAccentSoft,
        kCanvas,
        kSurface,
        kBorder,
        kFieldFill,
        kInk,
        kInkSoft,
        kInkFaint,
        kDanger,
        kDangerSoft,
        kRadiusSm,
        kRadiusMd,
        kRadiusLg,
        kShadowCard,
        kScrollChildWidth,
        kColumnGap;
export '../../core/focus/renderers/onefop_section_renderer.dart'
    show OnefopFieldLabel, OnefopDividerLabel, OnefopSubsectionHeader;

/// Filled, rounded field decoration matching the ONEFOP form's look.
/// Error styling (red border/text) is driven by Flutter's own
/// TextFormField validation state via [errorBorder]/[errorStyle], so
/// existing `validator:` callbacks keep working unchanged.
InputDecoration dsmoInputDecoration({String? hint, String? helperText}) {
  return InputDecoration(
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
    filled: true,
    fillColor: kFieldFill,
    hintText: hint,
    hintStyle: const TextStyle(fontSize: 14, color: kInkFaint),
    helperText: helperText,
    helperStyle: const TextStyle(fontSize: 11, color: kInkFaint),
    errorStyle: const TextStyle(fontSize: 12, color: kDanger),
    errorMaxLines: 2,
    border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusSm),
        borderSide: const BorderSide(color: kBorder, width: 1)),
    enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusSm),
        borderSide: const BorderSide(color: kBorder, width: 1)),
    focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusSm),
        borderSide: const BorderSide(color: kAccent, width: 1.5)),
    errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusSm),
        borderSide: const BorderSide(color: kDanger, width: 1)),
    focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusSm),
        borderSide: const BorderSide(color: kDanger, width: 1.5)),
  );
}

/// White rounded card with a brand-green header bar — the same card
/// shell as ONEFOP's OnefopSectionContainer, minus the section-completion
/// pill (DSMO forms don't track per-section completion).
class DsmoSectionCard extends StatelessWidget {
  final String title;
  final IconData? icon;
  final Widget child;

  const DsmoSectionCard({
    super.key,
    required this.title,
    this.icon,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: OL.sectionGapV),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(OL.sectionBorderRadius),
        border: Border.all(color: kBorder, width: 1),
        boxShadow: kShadowCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: OL.sectionHeaderPaddingH,
              vertical: OL.sectionHeaderPaddingV,
            ),
            decoration: const BoxDecoration(
              color: kAccent,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(OL.sectionBorderRadius),
                topRight: Radius.circular(OL.sectionBorderRadius),
              ),
            ),
            child: Row(
              children: [
                if (icon != null) ...[
                  Icon(icon, color: Colors.white, size: 18),
                  const SizedBox(width: 10),
                ],
                Expanded(child: Text(title, style: OL.shStyle)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: OL.sectionBodyPaddingH,
              vertical: OL.sectionBodyPaddingV,
            ),
            child: child,
          ),
        ],
      ),
    );
  }
}

/// ONEFOP-style field wrapper: label (with required marker) above the
/// input, instead of a floating inside-border label.
class DsmoField extends StatelessWidget {
  final Widget input;
  final String label;
  final bool required;
  final EdgeInsetsGeometry padding;

  const DsmoField({
    super.key,
    required this.input,
    required this.label,
    this.required = false,
    this.padding = const EdgeInsets.only(bottom: OL.questionGapV),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          OnefopFieldLabel(label: label, required: required),
          const SizedBox(height: OL.labelGapV),
          input,
        ],
      ),
    );
  }
}

/// Primary CTA button matching ONEFOP's NavButton look: brand-green fill,
/// small radius, bold label, optional trailing icon.
class DsmoPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;

  const DsmoPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: kAccent,
          disabledBackgroundColor: kAccent.withValues(alpha: 0.5),
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(kRadiusSm),
          ),
        ),
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                    color: Colors.white, strokeWidth: 2.5),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(label,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700)),
                  if (icon != null) ...[
                    const SizedBox(width: 8),
                    Icon(icon, size: 18),
                  ],
                ],
              ),
      ),
    );
  }
}
