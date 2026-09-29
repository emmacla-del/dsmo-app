// lib/core/focus/renderers/yes_no_toggle.dart
//
// Compact Yes/No toggle — small round radio icon + label, no bordered
// pill/box ("wrapped" chip look). Shared by every place a binary
// Oui/Non answer needs a control: VT grid-table cells (VtCellKind.
// boolean, vt_row_editor.dart's own _OuiNonToggle used to draw its own
// bordered chip pair here), the desktop Excel shell's simple-field
// cells (a 2-option 'radio' AstFieldType field whose options are the
// Oui/Non pair, onefop_excel_field_rows.dart), and RadioField's own
// 2-option case (mobile + Simple Mode, onefop_form_widgets.dart) — all
// three used to draw their own separate bordered-pill/dropdown look;
// this is the one shared compact style for all of them now.
//
// Mutually exclusive, same as a 2-option radio: exactly one of Oui/Non
// selected, or neither. Deliberately stays two toggles rather than a
// single checkbox — a lone checkbox can't tell "answered No" apart
// from "never answered", which a required-field validator needs to
// distinguish.
import 'package:flutter/material.dart';

import '../../i18n/localized_text.dart';
import '../../../screens/onefop/onefop_form_constants.dart';

class YesNoToggle extends StatelessWidget {
  /// true = Oui selected, false = Non selected, null = unanswered.
  final bool? value;
  final ValueChanged<bool> onChanged;
  final Locale locale;
  const YesNoToggle({
    super.key,
    required this.value,
    required this.onChanged,
    required this.locale,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _option(
          const LocalizedText(fr: 'Oui', en: 'Yes').of(locale),
          value == true,
          () => onChanged(true),
        ),
        const SizedBox(width: 18),
        _option(
          const LocalizedText(fr: 'Non', en: 'No').of(locale),
          value == false,
          () => onChanged(false),
        ),
      ],
    );
  }

  Widget _option(String text, bool selected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              selected
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_unchecked_rounded,
              size: 20,
              color: selected ? kFigmaSimplePrimary : kFigmaSimpleMuted,
            ),
            const SizedBox(width: 5),
            Text(
              text,
              style: TextStyle(
                fontSize: 14,
                color: selected ? kFigmaSimpleInk : kFigmaSimpleSecondary,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// True when [field] is a 2-option `radio` field whose options are
/// exactly the app's Oui/Non pair (identical value strings across every
/// entity type — see onefop_ast.dart's `_vtYesNoOptions` doc comment),
/// regardless of which order they were declared in.
bool isYesNoRadioField(String fieldType, List<String> optionValues) {
  if (fieldType != 'radio' || optionValues.length != 2) return false;
  final set = optionValues.toSet();
  return set.length == 2 &&
      set.contains('Oui/ Yes') &&
      set.contains('Non/ No');
}
