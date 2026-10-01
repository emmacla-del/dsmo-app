// lib/screens/onefop/wizard/vt_wizard_fields.dart
// ══════════════════════════════════════════════════════════════
// VT WIZARD MODE — field-level widgets, pixel-matched against the
// "Real VTC form" Figma file (fileKey KQsJpxfxlSkhKxQP0AAoMx), read via
// get_design_context on nodes 11:228 (Identification) and 11:677
// (Infos Générales) — exact colors/radii/paddings below are taken
// directly from that design context, not estimated from the screenshot.
//
// Every widget here reads/writes through the SAME OnefopFormController
// primitives every other mode already uses — ctrl.ctrl[id] (the shared
// TextEditingController), ctrl.setRadioValue, ctrl.setCheckboxValues,
// ctrl.onSelectChanged, ctrl.onBlur, ctrl.focusFieldOffset — so this is a
// new visual skin only. No option list, validation rule, or persistence
// path is duplicated from onefop_form_widgets.dart's existing SimpleField/
// RadioField/CheckboxGroupField/SelectField.
//
// Bilingual display: Figma always shows French primary + a secondary
// English line (in parens for a short field label, on its own line for a
// full question), regardless of the app's active locale — a deliberate
// wizard-only departure from the rest of the app's locale.of(...)
// single-language pattern, since that's what the design shows.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/focus/schema/field_schema.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/localized_text.dart'
    show LocalizedOption, LocalizedText;
import '../onefop_form_constants.dart' show kAccent, kAccentDeep;
import '../onefop_form_controller.dart';
import 'vt_cameroon_admin_data.dart';
import 'vt_wizard_constants.dart';

const _kBorderMuted = Color(0xFFCBD5E1);

class _VtWizardFieldError extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const _VtWizardFieldError({required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
    if (!ctrl.hasError(field)) return const SizedBox.shrink();
    final msg = ctrl.errorText(field, context.l10n);
    return Padding(
      padding: const EdgeInsets.only(top: 6, left: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline_rounded,
              size: 14, color: kVtWizardRed),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              msg,
              style: const TextStyle(
                fontFamily: kVtWizardFontFamily,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: kVtWizardRed,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Prompts introduce a response group (radio buttons, checkboxes or a
/// Yes/No choice). They are deliberately more prominent than their answer
/// alternatives, so a respondent can distinguish the question from the
/// controls that answer it at a glance.
class _VtWizardQuestionLabel extends StatelessWidget {
  final FieldSchema field;
  const _VtWizardQuestionLabel({required this.field});

  @override
  Widget build(BuildContext context) {
    final text = field.label?.of(context.loc) ?? field.id;
    final requiredLabel = const LocalizedText(
      fr: ' (obligatoire)',
      en: ' (required)',
    ).of(context.loc);
    final tooltip = kFieldTooltips[field.id]?.of(context.loc);
    final labelWidget = Text.rich(
      TextSpan(
        text: text,
        children: [
          if (field.required)
            TextSpan(
              text: requiredLabel,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: kVtWizardRed,
              ),
            ),
        ],
      ),
      style: const TextStyle(
        fontFamily: kVtWizardFontFamily,
        fontWeight: FontWeight.w800,
        fontSize: 16,
        color: kVtWizardInk,
      ),
    );
    if (tooltip == null) return labelWidget;
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Flexible(child: labelWidget),
        const SizedBox(width: 6),
        _VtWizardInfoBadge(tooltip: tooltip),
      ],
    );
  }
}

/// Field label in the app's active locale — human-readable text only
/// (e.g. "Nom du CFP"), never prefixed with the codebook number
/// (field.paperCode) — a government-form field-design requirement: a
/// respondent should read the question, not a form code. paperCode stays
/// on the model for anything that still needs it (PDF, exports) but is
/// never rendered here.
class _VtWizardFieldLabel extends StatelessWidget {
  final FieldSchema field;
  const _VtWizardFieldLabel({required this.field});

  @override
  Widget build(BuildContext context) {
    final text = field.label?.of(context.loc) ?? field.id;
    final requiredLabel = const LocalizedText(
      fr: ' (obligatoire)',
      en: ' (required)',
    ).of(context.loc);
    final tooltip = kFieldTooltips[field.id]?.of(context.loc);
    final labelWidget = Text.rich(
      TextSpan(
        text: text,
        children: [
          if (field.required)
            TextSpan(
              text: requiredLabel,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: kVtWizardRed,
              ),
            ),
        ],
      ),
      style: const TextStyle(
        fontFamily: kVtWizardFontFamily,
        fontWeight: FontWeight.w700,
        fontSize: 15,
        color: kVtWizardInk,
      ),
    );
    if (tooltip == null) return labelWidget;
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Flexible(child: labelWidget),
        const SizedBox(width: 6),
        _VtWizardInfoBadge(tooltip: tooltip),
      ],
    );
  }
}

class _VtWizardInfoBadge extends StatelessWidget {
  final String tooltip;
  const _VtWizardInfoBadge({required this.tooltip});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      preferBelow: false,
      verticalOffset: 14,
      constraints: const BoxConstraints(maxWidth: 300),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      margin: const EdgeInsets.symmetric(horizontal: 16),
      textStyle: const TextStyle(
        fontFamily: kVtWizardFontFamily,
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: kAccentDeep,
      ),
      decoration: BoxDecoration(
        color: kVtWizardAccentSoft,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: kAccent.withValues(alpha: 0.25)),
      ),
      child: InkWell(
        onTap: () {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                tooltip,
                style: const TextStyle(
                  fontFamily: kVtWizardFontFamily,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: kAccentDeep,
                ),
              ),
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 4),
              backgroundColor: kVtWizardAccentSoft,
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: const Padding(
          padding: EdgeInsets.all(2),
          child: Icon(
            Icons.info_outline_rounded,
            size: 15,
            color: kVtWizardInkFaint,
          ),
        ),
      ),
    );
  }
}

// Plain, single-border box — no drop shadow, no gray fill, just a clean
// white background with a simple border. Focus and error states change only
// the border color and width.
BoxDecoration _vtWizardInputBox(
        {required bool muted, bool focused = false, bool error = false}) =>
    BoxDecoration(
      color: muted ? const Color(0xFFF8FAFC) : Colors.white,
      border: Border.all(
        color: error ? kVtWizardRed : (focused ? kAccent : _kBorderMuted),
        width: focused || error ? 1.5 : 1,
      ),
      borderRadius: BorderRadius.circular(8),
    );

/// Text/number/tel/email input — Figma's "input-box": single 1px #D1D6D3
/// border (accent when focused, red when invalid), 8px radius, compact
/// padding. Reuses the controller's own TextEditingController
/// (ctrl.ctrl[field.id]) so keystrokes flow through the exact same
/// debounce/revalidate/autosave path SimpleField already relies on.
String _formatCameroonPhone(String raw) {
  final digits = raw.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return '';
  final sb = StringBuffer();
  for (var i = 0; i < digits.length && i < 9; i++) {
    if (i == 3 || i == 5 || i == 7) sb.write(' ');
    sb.write(digits[i]);
  }
  return sb.toString();
}

/// Small Cameroon flag swatch (green/red/yellow vertical bands, a tiny
/// star mark on the red band) shown ahead of the "+237" country code on
/// every phone field — Figma's "FlagSelector" (node 6:4320 on the
/// Identification reference). The app only ever collects Cameroon
/// numbers (no other country is ever a valid respondent), so this is a
/// static badge, not a live country picker — a working dropdown here
/// would be exactly the kind of fake affordance VtWizardSelectField's own
/// doc comment warns against.
class _CameroonFlagBadge extends StatelessWidget {
  const _CameroonFlagBadge();

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(2),
      child: SizedBox(
        width: 18,
        height: 12,
        child: Row(
          children: [
            Expanded(child: Container(color: const Color(0xFF007A5E))),
            Expanded(
              child: Container(
                color: const Color(0xFFCE1126),
                alignment: Alignment.center,
                child: const Icon(Icons.star_rounded,
                    size: 6, color: Color(0xFFFCD116)),
              ),
            ),
            Expanded(child: Container(color: const Color(0xFFFCD116))),
          ],
        ),
      ),
    );
  }
}

class VtWizardTextField extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const VtWizardTextField({super.key, required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
    final c = ctrl.ctrl[field.id]!;
    final fn = ctrl.fm.getNode(field.id);
    final isTel = field.type == 'tel';
    final isRegion = field.id == 'VT1_4';
    final isDept = field.id == 'VT1_5';
    final isSubdiv = field.id == 'VT1_6';
    final isCommune = field.id == 'VT1_7';

    // Compute cascading administrative suggestions if this is a Cameroon geo field
    List<String> suggestions = const [];
    String? suggestionHeader;
    if (isRegion) {
      suggestions = [for (final r in kCameroonAdminHierarchy) r.name];
    } else if (isDept) {
      final currentRegion = ctrl.ctrl['VT1_4']?.text.trim();
      final regObj = findCameroonRegion(currentRegion);
      if (regObj != null) {
        suggestions = [for (final d in regObj.departments) d.name];
        suggestionHeader = 'Départements ($currentRegion)';
      }
    } else if (isSubdiv) {
      final currentDept = ctrl.ctrl['VT1_5']?.text.trim();
      final currentRegion = ctrl.ctrl['VT1_4']?.text.trim();
      final deptObj =
          findCameroonDepartment(currentDept, regionName: currentRegion);
      if (deptObj != null) {
        suggestions = deptObj.subdivisions;
        suggestionHeader = 'Arrondissements ($currentDept)';
      }
    } else if (isCommune) {
      final currentSubdiv = ctrl.ctrl['VT1_6']?.text.trim();
      final currentDept = ctrl.ctrl['VT1_5']?.text.trim();
      final currentRegion = ctrl.ctrl['VT1_4']?.text.trim();
      final deptObj =
          findCameroonDepartment(currentDept, regionName: currentRegion);
      if (currentSubdiv != null && currentSubdiv.isNotEmpty) {
        suggestions = [currentSubdiv];
        if (deptObj != null) {
          final others = deptObj.subdivisions.where((s) => s != currentSubdiv);
          suggestions = [currentSubdiv, ...others];
        }
        suggestionHeader = 'Communes ($currentSubdiv)';
      } else if (deptObj != null) {
        suggestions = deptObj.subdivisions;
        suggestionHeader = 'Communes du département';
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _VtWizardFieldLabel(field: field),
        const SizedBox(height: 6),
        ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: double.infinity,
            minHeight: field.type == 'textarea' ? 112 : 50,
          ),
          child: AnimatedBuilder(
            animation: Listenable.merge([fn, ctrl, c]),
            builder: (context, _) => Container(
              decoration: _vtWizardInputBox(
                  muted: field.readOnly,
                  focused: fn.hasFocus && !field.readOnly,
                  error: ctrl.hasError(field)),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              alignment: field.type == 'textarea'
                  ? Alignment.topLeft
                  : Alignment.centerLeft,
              child: Row(
                children: [
                  if (isTel) ...[
                    const _CameroonFlagBadge(),
                    const SizedBox(width: 6),
                    const Text(
                      '+237',
                      style: TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                        color: kVtWizardInkSoft,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(width: 1, height: 20, color: _kBorderMuted),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: TextField(
                      controller: c,
                      focusNode: fn,
                      readOnly: field.readOnly,
                      maxLines: field.type == 'textarea' ? 4 : 1,
                      keyboardType: field.type == 'number'
                          ? TextInputType.number
                          : field.type == 'tel'
                              ? TextInputType.phone
                              : field.type == 'email'
                                  ? TextInputType.emailAddress
                                  : field.type == 'textarea'
                                      ? TextInputType.multiline
                                      : TextInputType.text,
                      inputFormatters: [
                        if (field.type == 'number')
                          FilteringTextInputFormatter.digitsOnly,
                        if (field.type == 'tel') ...[
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(9),
                        ],
                      ],
                      style: TextStyle(
                          fontFamily: kVtWizardFontFamily,
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                          color: field.readOnly
                              ? kVtWizardInkSoft
                              : kVtWizardInk),
                      decoration: InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        errorBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                        focusedErrorBorder: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                        hintText: isTel
                            ? '6XX XX XX XX'
                            : field.type == 'email'
                                ? 'exemple@domaine.cm'
                                : null,
                        hintStyle: const TextStyle(
                          fontFamily: kVtWizardFontFamily,
                          fontWeight: FontWeight.w400,
                          fontSize: 14,
                          color: kVtWizardInkFaint,
                        ),
                      ),
                      onTapOutside: (_) => ctrl.onBlur(field.id),
                      onSubmitted: (_) {
                        ctrl.onBlur(field.id);
                        ctrl.focusFieldOffset(1);
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        AnimatedBuilder(
          animation: c,
          builder: (context, _) {
            if (isTel && c.text.isNotEmpty) {
              return Padding(
                padding: const EdgeInsets.only(top: 4, left: 2),
                child: Row(
                  children: [
                    Text(
                      'Format national : ${_formatCameroonPhone(c.text)}',
                      style: TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: c.text.length == 9 ? kAccent : kVtWizardInkFaint,
                      ),
                    ),
                    if (c.text.length == 9) ...[
                      const SizedBox(width: 4),
                      const Icon(Icons.check_circle_rounded,
                          size: 12, color: kAccent),
                    ],
                  ],
                ),
              );
            }
            return const SizedBox.shrink();
          },
        ),
        if (suggestions.isNotEmpty && !field.readOnly) ...[
          const SizedBox(height: 6),
          AnimatedBuilder(
            animation: Listenable.merge([c, ctrl]),
            builder: (context, _) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (suggestionHeader != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4, left: 2),
                    child: Text(
                      suggestionHeader,
                      style: const TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: kVtWizardInkSoft,
                      ),
                    ),
                  ),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    for (final item in suggestions)
                      InkWell(
                        onTap: () {
                          c.text = item;
                          ctrl.onBlur(field.id);
                        },
                        borderRadius: BorderRadius.circular(4),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: c.text == item ? kAccent : Colors.white,
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                              color: c.text == item ? kAccent : _kBorderMuted,
                              width: 1,
                            ),
                          ),
                          child: Text(
                            item,
                            style: TextStyle(
                              fontFamily: kVtWizardFontFamily,
                              fontSize: 11,
                              fontWeight: c.text == item
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: c.text == item
                                  ? Colors.white
                                  : kVtWizardInkSoft,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
        _VtWizardFieldError(ctrl: ctrl, field: field),
      ],
    );
  }
}

/// Dedicated 4-digit calendar year field (e.g. "Année d'ouverture / Year of establishment"):
/// replaces cumbersome +/- steppers with a clean, focused 4-digit numeric box.
class VtWizardYearField extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const VtWizardYearField({super.key, required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
    final c = ctrl.ctrl[field.id]!;
    final fn = ctrl.fm.getNode(field.id);
    final isEn = Localizations.localeOf(context).languageCode == 'en';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _VtWizardFieldLabel(field: field),
        const SizedBox(height: 6),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 160, minHeight: 50),
          child: AnimatedBuilder(
            animation: Listenable.merge([fn, ctrl]),
            builder: (context, _) => Container(
              height: 50,
              decoration: _vtWizardInputBox(
                muted: false,
                focused: fn.hasFocus,
                error: ctrl.hasError(field),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              alignment: Alignment.centerLeft,
              child: TextField(
                controller: c,
                focusNode: fn,
                keyboardType: TextInputType.number,
                maxLength: 4,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(4),
                ],
                style: const TextStyle(
                  fontFamily: kVtWizardFontFamily,
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                  color: kVtWizardInk,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  errorBorder: InputBorder.none,
                  disabledBorder: InputBorder.none,
                  focusedErrorBorder: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                  counterText: '',
                  hintText: isEn ? 'YYYY' : 'AAAA',
                  hintStyle: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w400,
                    fontSize: 14,
                    color: kVtWizardInkFaint,
                  ),
                ),
                onTapOutside: (_) => ctrl.onBlur(field.id),
                onSubmitted: (_) {
                  ctrl.onBlur(field.id);
                  ctrl.focusFieldOffset(1);
                },
              ),
            ),
          ),
        ),
        _VtWizardFieldError(ctrl: ctrl, field: field),
      ],
    );
  }
}

/// Number stepper — Figma's "-/+" bordered counter (e.g. "Nombre de
/// sites occupés"): 44px-tall box, value left-aligned Bold 14px, two
/// 32x32 rounded-4px buttons (minus: #F4F6F5 fill; plus: accent fill,
/// white glyph). Reads/writes the exact same shared TextEditingController
/// (ctrl.ctrl[field.id]) VtWizardTextField and SimpleField both use, so
/// typing directly still works — the buttons are a convenience on top,
/// not a separate value store.
/// Open-ended headcount fields (a training center's total trainees/
/// trainers can run into the hundreds) — a stepper you'd click that many
/// times is worse than just typing on the numeric keypad, and these
/// fields' own labels are long enough to wrap to two lines, which read as
/// misaligned squeezed into the usual 3-up compact-number row. Exported so
/// vt_wizard_section_screen.dart's _isVtWizardShortPairableField can also
/// exclude these ids, giving them their own full-width row instead —
/// VtWizardNumberStepperField renders them without the +/- buttons and at
/// full row width instead of the usual 180px cap.
const kVtWizardNoStepperNumberFieldIds = {
  'VT2_19', // Total number of trainees in your center
  'VT2_20', // Total number of trainers in your center
  'VT2_21', // Total number of trainees from lower secondary
  'VT2_22', // Total number of trainees from upper secondary
};

class VtWizardNumberStepperField extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const VtWizardNumberStepperField(
      {super.key, required this.ctrl, required this.field});

  bool get _showStepper => !kVtWizardNoStepperNumberFieldIds.contains(field.id);

  void _step(int delta) {
    final c = ctrl.ctrl[field.id]!;
    final cur = int.tryParse(c.text.trim()) ?? 0;
    final next = (cur + delta).clamp(0, 999999);
    c.text = '$next';
    ctrl.onBlur(field.id);
  }

  @override
  Widget build(BuildContext context) {
    final c = ctrl.ctrl[field.id]!;
    final fn = ctrl.fm.getNode(field.id);
    final showStepper = _showStepper;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _VtWizardFieldLabel(field: field),
        const SizedBox(height: 6),
        ConstrainedBox(
          // Same short/plain cap as VtWizardTextField for the usual
          // stepper case; a no-stepper field renders on its own full-width
          // row instead, so it takes that row the same way a plain text
          // field would.
          constraints:
              BoxConstraints(maxWidth: showStepper ? 180 : double.infinity),
          child: AnimatedBuilder(
            animation: Listenable.merge([fn, ctrl]),
            builder: (context, _) => Container(
              height: 50,
              padding: const EdgeInsets.only(left: 14, right: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(
                  color: ctrl.hasError(field)
                      ? kVtWizardRed
                      : (fn.hasFocus ? kAccent : _kBorderMuted),
                  width: fn.hasFocus || ctrl.hasError(field) ? 1.5 : 1,
                ),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: c,
                      focusNode: fn,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      style: const TextStyle(
                          fontFamily: kVtWizardFontFamily,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: kVtWizardInk),
                      decoration: const InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        errorBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                        focusedErrorBorder: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                      ),
                      onTapOutside: (_) => ctrl.onBlur(field.id),
                      onSubmitted: (_) {
                        ctrl.onBlur(field.id);
                        ctrl.focusFieldOffset(1);
                      },
                    ),
                  ),
                  if (showStepper) ...[
                    _VtWizardStepperButton(
                      symbol: '−',
                      onTap: () => _step(-1),
                    ),
                    const SizedBox(width: 4),
                    _VtWizardStepperButton(
                      symbol: '+',
                      onTap: () => _step(1),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
        _VtWizardFieldError(ctrl: ctrl, field: field),
      ],
    );
  }
}

class _VtWizardStepperButton extends StatelessWidget {
  final String symbol;
  final VoidCallback onTap;
  const _VtWizardStepperButton({required this.symbol, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          border: Border.all(color: _kBorderMuted, width: 1),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(symbol,
            style: const TextStyle(
                fontFamily: kVtWizardFontFamily,
                fontWeight: FontWeight.w700,
                fontSize: 18,
                color: kVtWizardInk)),
      ),
    );
  }
}

class VtWizardRadioGroup extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  final Widget? inlineExtra;
  const VtWizardRadioGroup(
      {super.key, required this.ctrl, required this.field, this.inlineExtra});

  @override
  Widget build(BuildContext context) {
    final opts = field.optionsI18n ?? [];
    final locale = context.loc;

    // Horizontal layout rules:
    // - 2-3 options only
    // - Each label must be short (<=25 chars)
    // - No descriptions (no " - " separator in any label)
    // Everything else goes vertical for better scannability
    final hasDescriptions = opts.any((o) => o.text.of(locale).contains(' - '));
    final isShort = opts.every((o) => o.text.of(locale).length <= 25);
    final horizontal =
        opts.length >= 2 && opts.length <= 3 && isShort && !hasDescriptions;

    return ListenableBuilder(
      listenable: ctrl.fm.getNode(field.id),
      builder: (context, _) {
        final cur = ctrl.data[field.id] as String?;
        void select(String value) {
          ctrl.fm.focus(field.id);
          ctrl.setRadioValue(field, value);
        }

        final cells = [
          for (final o in opts)
            _VtWizardGridRadioCell(
              option: o,
              selected: cur == o.value,
              onTap: () => select(o.value),
            ),
        ];

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _VtWizardQuestionLabel(field: field),
            const SizedBox(height: 10),
            if (horizontal)
              Wrap(
                spacing: 32,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: cells,
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (int i = 0; i < cells.length; i++) ...[
                    cells[i],
                    if (i < cells.length - 1) const SizedBox(height: 6),
                  ],
                ],
              ),
            if (inlineExtra != null) ...[
              const SizedBox(height: 10),
              inlineExtra!,
            ],
            _VtWizardFieldError(ctrl: ctrl, field: field),
          ],
        );
      },
    );
  }
}

class _VtWizardGridRadioCell extends StatelessWidget {
  final LocalizedOption option;
  final bool selected;
  final VoidCallback onTap;
  const _VtWizardGridRadioCell(
      {required this.option, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final label = option.text.of(context.loc);
    // Split "Short label - longer description" into a bold code + soft
    // caption if the label contains a dash separator, otherwise show
    // the full label as code with no caption.
    final dashIdx = label.indexOf(' - ');
    final (code, caption) = dashIdx >= 0
        ? (label.substring(0, dashIdx), label.substring(dashIdx + 3))
        : (label, null as String?);
    return Semantics(
      checked: selected,
      inMutuallyExclusiveGroup: true,
      label: option.text.of(context.loc),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(
                selected
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_unchecked_rounded,
                size: 20,
                color: selected ? kAccent : _kBorderMuted,
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      code,
                      style: TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight:
                            selected ? FontWeight.w600 : FontWeight.w400,
                        fontSize: 14,
                        color: selected ? kVtWizardInk : kVtWizardInkSoft,
                      ),
                    ),
                    if (caption != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        caption,
                        maxLines: 2,
                        softWrap: true,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: kVtWizardFontFamily,
                          fontWeight: FontWeight.w400,
                          fontSize: 12,
                          height: 1.25,
                          color:
                              selected ? kVtWizardInkSoft : kVtWizardInkFaint,
                        ),
                      ),
                    ],
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

class _VtWizardGridCheckboxCell extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _VtWizardGridCheckboxCell(
      {required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      checked: selected,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(
                selected
                    ? Icons.check_box_rounded
                    : Icons.check_box_outline_blank_rounded,
                size: 20,
                color: selected ? kAccent : _kBorderMuted,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                    fontSize: 14,
                    color: selected ? kVtWizardInk : kVtWizardInkSoft,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Checkbox group — pure minimal checkboxes: native checkbox marker + text
/// label, generous clickable area, and clean two-column layout on desktop.
class VtWizardCheckboxGroup extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  final bool compact;
  const VtWizardCheckboxGroup(
      {super.key,
      required this.ctrl,
      required this.field,
      this.compact = false});

  List<String> _current() {
    final raw = ctrl.data[field.id];
    if (raw is List) return raw.map((e) => e.toString()).toList();
    return const [];
  }

  void _toggle(String value) {
    final cur = _current();
    final next = cur.contains(value)
        ? (List<String>.from(cur)..remove(value))
        : (List<String>.from(cur)..add(value));
    ctrl.setCheckboxValues(field, next.isEmpty ? null : next);
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final opts = field.optionsI18n ?? [];
    final selectAllText = const LocalizedText(
      fr: 'Sélectionnez toutes les options applicables',
      en: 'Select all that apply',
    ).of(locale);

    return ListenableBuilder(
      listenable: ctrl.version,
      builder: (context, _) {
        final cur = _current();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _VtWizardQuestionLabel(field: field),
            const SizedBox(height: 4),
            Text(
              selectAllText,
              style: kVtWizardCaption.copyWith(fontStyle: FontStyle.italic),
            ),
            const SizedBox(height: 10),
            LayoutBuilder(
              builder: (context, constraints) {
                final isDesktop = constraints.maxWidth >= 500;
                if (opts.length > 4 && isDesktop) {
                  final mid = (opts.length / 2).ceil();
                  final leftOpts = opts.sublist(0, mid);
                  final rightOpts = opts.sublist(mid);
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            for (int i = 0; i < leftOpts.length; i++) ...[
                              _VtWizardGridCheckboxCell(
                                label: leftOpts[i].text.of(locale),
                                selected: cur.contains(leftOpts[i].value),
                                onTap: () => _toggle(leftOpts[i].value),
                              ),
                              if (i < leftOpts.length - 1)
                                const SizedBox(height: 6),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 32),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            for (int i = 0; i < rightOpts.length; i++) ...[
                              _VtWizardGridCheckboxCell(
                                label: rightOpts[i].text.of(locale),
                                selected: cur.contains(rightOpts[i].value),
                                onTap: () => _toggle(rightOpts[i].value),
                              ),
                              if (i < rightOpts.length - 1)
                                const SizedBox(height: 6),
                            ],
                          ],
                        ),
                      ),
                    ],
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (int i = 0; i < opts.length; i++) ...[
                      _VtWizardGridCheckboxCell(
                        label: opts[i].text.of(locale),
                        selected: cur.contains(opts[i].value),
                        onTap: () => _toggle(opts[i].value),
                      ),
                      if (i < opts.length - 1) const SizedBox(height: 6),
                    ],
                  ],
                );
              },
            ),
            _VtWizardFieldError(ctrl: ctrl, field: field),
          ],
        );
      },
    );
  }
}

/// Select field — same input-box shell as VtWizardTextField, plus a
/// chevron-down and a real popup menu (MenuAnchor, mirroring SelectField's
/// own pattern in onefop_form_widgets.dart) — only rendered for fields
/// whose AST type is genuinely 'select' with real options; a region/
/// department field typed as plain text in the AST renders as
/// VtWizardTextField instead (Figma shows a chevron there purely as
/// visual flourish — this project's VT1 region/department fields are
/// free text, not a constrained option list, so a working dropdown would
/// be a fake affordance).
class VtWizardSelectField extends StatefulWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const VtWizardSelectField(
      {super.key, required this.ctrl, required this.field});

  @override
  State<VtWizardSelectField> createState() => _VtWizardSelectFieldState();
}

class _VtWizardSelectFieldState extends State<VtWizardSelectField> {
  final _menuController = MenuController();

  @override
  Widget build(BuildContext context) {
    final field = widget.field;
    final ctrl = widget.ctrl;
    final locale = context.loc;
    final opts = field.optionsI18n ?? [];
    final cur = ctrl.data[field.id] as String?;
    final selected = opts.where((o) => o.value == cur).toList();
    final label = selected.isNotEmpty ? selected.first.text.of(locale) : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        _VtWizardFieldLabel(field: field),
        const SizedBox(height: 6),
        ConstrainedBox(
          // Same short/plain cap as VtWizardTextField/VtWizardNumberStepperField.
          constraints: const BoxConstraints(maxWidth: 320),
          child: MenuAnchor(
            controller: _menuController,
            style: MenuStyle(
              backgroundColor: const WidgetStatePropertyAll(Colors.white),
              surfaceTintColor: const WidgetStatePropertyAll(Colors.white),
              shape: WidgetStatePropertyAll(RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: _kBorderMuted),
              )),
            ),
            menuChildren: [
              for (final o in opts)
                MenuItemButton(
                  onPressed: () => ctrl.onSelectChanged(field, o.value),
                  child: SizedBox(
                    width: 280,
                    child: Text(o.text.of(locale),
                        style: const TextStyle(
                            fontFamily: kVtWizardFontFamily, fontSize: 14)),
                  ),
                ),
            ],
            builder: (context, controller, _) => InkWell(
              onTap: () =>
                  controller.isOpen ? controller.close() : controller.open(),
              child: AnimatedBuilder(
                animation: ctrl,
                // Focus is already shown by vtWizardFocusable's bottom
                // border at this field's own call site — only error color
                // reacts here, so focus isn't double-indicated.
                builder: (context, _) => Container(
                  decoration: _vtWizardInputBox(
                      muted: false, error: ctrl.hasError(field)),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          label ?? '—',
                          style: const TextStyle(
                              fontFamily: kVtWizardFontFamily,
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                              color: kVtWizardInk),
                        ),
                      ),
                      const Icon(Icons.keyboard_arrow_down_rounded,
                          size: 18, color: kVtWizardInkSoft),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        _VtWizardFieldError(ctrl: ctrl, field: field),
      ],
    );
  }
}

/// Dispatches a FieldSchema to the right Figma-matched widget by AST
/// type — the wizard's equivalent of onefop_unified_form_screen_v4.dart's
/// _buildField, but producing these pixel-matched widgets instead of the
/// app's default ones. VT table fields (type 'table'/'repeating_table')
/// are NOT handled here — the caller still routes those through the
/// existing buildField callback (VtTableFieldWidget/VtRowEditor), since
/// this file only covers the plain-field primitives Figma actually shows
/// a distinct style for.
/// True for a plain Oui/Non radio field — the same detection
/// vtWizardBuildField uses for radio fields, exported so
/// vt_wizard_section_screen.dart can spot a toggle+dependent-number pair
/// (VT5_1/VT5_2, VT5_3/VT5_4, ...) before generic field layout runs.
/// True for a field representing a calendar year (such as VT1_14 Year of establishment)
bool vtWizardIsYearField(FieldSchema field) {
  final id = field.id.toUpperCase();
  final path = field.path.toUpperCase();
  final fr = (field.label?.fr ?? '').toLowerCase();
  final en = (field.label?.en ?? '').toLowerCase();
  return id == 'VT1_14' ||
      id.contains('YEAR') ||
      path.contains('YEAR') ||
      fr.contains('année') ||
      en.contains('year');
}

bool vtWizardIsYesNoField(FieldSchema field) {
  final opts = field.optionsI18n ?? const [];
  return field.type == 'radio' &&
      opts.length == 2 &&
      opts.any((o) => o.value == 'Oui/ Yes') &&
      opts.any((o) => o.value == 'Non/ No');
}

/// The two Sex fields (VT1_15_SEX/VT1_16_SEX) — the one radio field this
/// wizard renders with Figma's own segmented-pill control (node 6:4308,
/// the "Sexe" M/F toggle) instead of VtWizardRadioGroup's circle-icon
/// list, per explicit request to match that specific Figma control
/// pixel-for-pixel. Every other radio field (Milieu d'implantation,
/// Ordre d'enseignement, Situation du centre, ...) keeps the circle-icon
/// rendering — exported so vt_wizard_section_screen.dart can also treat
/// these two ids as short-pairable (the segmented toggle is compact like
/// a normal field, not a full-width prompt, so it can sit inline in a
/// row next to text/number fields the same way Figma places it beside
/// the Promoteur/Directeur name).
const kVtWizardSegmentedRadioFieldIds = {'VT1_15_SEX', 'VT1_16_SEX'};

/// Figma's own "SegmentContainer" binary pill toggle — a light-tinted
/// track with the active option filled solid accent and bold white text.
/// Reads/writes through the exact same ctrl.setRadioValue/ctrl.data
/// primitives VtWizardRadioGroup uses, so it's a visual skin only.
class VtWizardSegmentedToggle extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const VtWizardSegmentedToggle(
      {super.key, required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
    final opts = field.optionsI18n ?? const [];
    final locale = context.loc;
    return ListenableBuilder(
      listenable: ctrl.fm.getNode(field.id),
      builder: (context, _) {
        final cur = ctrl.data[field.id] as String?;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _VtWizardFieldLabel(field: field),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  for (final o in opts)
                    Expanded(
                      child: _VtWizardSegmentedOption(
                        label: o.text.of(locale),
                        active: cur == o.value,
                        onTap: () {
                          ctrl.fm.focus(field.id);
                          ctrl.setRadioValue(field, o.value);
                        },
                      ),
                    ),
                ],
              ),
            ),
            _VtWizardFieldError(ctrl: ctrl, field: field),
          ],
        );
      },
    );
  }
}

class _VtWizardSegmentedOption extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _VtWizardSegmentedOption(
      {required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      checked: active,
      inMutuallyExclusiveGroup: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: active ? kAccent : Colors.transparent,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: FontWeight.w700,
              fontSize: 12,
              color: active ? Colors.white : kVtWizardInkSoft,
            ),
          ),
        ),
      ),
    );
  }
}

/// Attaches [field]'s shared FocusNode (ctrl.fm.getNode — the exact same
/// node Simple/Spreadsheet Mode use for this field id) to the real focus
/// tree and draws a thin accent ring around [child] while focused.
///
/// OnefopFormController._initKeyH already wires every field's FocusNode.
/// onKeyEvent to handleFieldKey (Tab/Shift+Tab, arrow keys, Enter — see
/// that method) at controller-init time, for every field in the schema
/// regardless of mode. VtWizardTextField/VtWizardNumberStepperField get
/// this for free since they hand that same node straight to Flutter's own
/// TextField, which attaches it to a real Focus widget internally — but
/// VtWizardRadioGroup/VtWizardCheckboxGroup/
/// VtWizardSelectField never wrapped their GestureDetector/InkWell in a
/// Focus widget at all, so Tab could never land on them and no keyboard
/// event ever reached handleFieldKey for these types. This wrapper is the
/// fix — called once, here, rather than editing each widget internally.
Widget vtWizardFocusable(
    OnefopFormController ctrl, FieldSchema field, Widget child) {
  final node = ctrl.fm.getNode(field.id);
  return Focus(
    focusNode: node,
    child: AnimatedBuilder(
      animation: node,
      // Plain by design: a thin bottom-border indicator only, no padded/
      // rounded box — matches the same understated treatment the Tableur
      // grid's own cells use (see _numberCell/_textCell's focusedBorder).
      builder: (context, c) => Container(
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: node.hasFocus ? kAccent : Colors.transparent,
              width: 1.5,
            ),
          ),
        ),
        child: c,
      ),
      child: child,
    ),
  );
}

Widget vtWizardBuildField(OnefopFormController ctrl, FieldSchema field,
    {bool compact = false}) {
  switch (field.type) {
    case 'radio':
      return kVtWizardSegmentedRadioFieldIds.contains(field.id)
          ? vtWizardFocusable(
              ctrl, field, VtWizardSegmentedToggle(ctrl: ctrl, field: field))
          : vtWizardFocusable(
              ctrl, field, VtWizardRadioGroup(ctrl: ctrl, field: field));
    case 'checkbox':
      return vtWizardFocusable(ctrl, field,
          VtWizardCheckboxGroup(ctrl: ctrl, field: field, compact: compact));
    case 'select':
      return vtWizardFocusable(
          ctrl, field, VtWizardSelectField(ctrl: ctrl, field: field));
    case 'number':
      return vtWizardIsYearField(field)
          ? VtWizardYearField(ctrl: ctrl, field: field)
          : VtWizardNumberStepperField(ctrl: ctrl, field: field);
    default:
      return VtWizardTextField(ctrl: ctrl, field: field);
  }
}
