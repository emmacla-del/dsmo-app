// lib/core/focus/utils/field_validator.dart
//
// ══════════════════════════════════════════════════════════════
// CENTRALIZED FIELD VALIDATOR
//
// FIXES:
//   • Replaces tripled validation logic scattered across:
//       _hasErr(), _errorText(), _vSec(), _missing()
//     in onefop_unified_form_screen_v3.dart
//   • Single source of truth: validate() returns ValidationError? (null = valid)
//   • isSectionComplete() and missingLabels() delegate to validate()
//   • Phone/year/email rules no longer hardcoded in the screen
//   • Optional override set injected, not hardcoded
//
// validate() returns an error CODE rather than resolved text, so callers
// resolve the message via AppLocalizations at the point they have a
// BuildContext. This also keeps OnefopFormController's error cache
// (_valCache) language-neutral — it never needs invalidating on a
// mid-form language switch.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/widgets.dart';

import '../../../l10n/generated/app_localizations.dart';
import '../schema/field_schema.dart';
import '../schema/section_schema.dart';
import '../schema/form_schema_v2.dart';
import 'table_response_status.dart';

// ─────────────────────────────────────────────────────────────
// Field IDs whose number values represent a calendar year.
// Add new year fields here rather than touching the screen.
// ─────────────────────────────────────────────────────────────
const Set<String> kYearFieldIds = {
  'COOP_S1Q03',
  'CTD_S1Q03',
  'ONG_S1Q03',
};

enum ValidationErrorCode {
  required,
  telLength,
  telPrefix,
  email,
  yearFormat,
  yearMin,
  yearMax,
  requiredConditional,
  tableResponseRequired,
  tableFiguresRequired,
}

@immutable
class ValidationError {
  final ValidationErrorCode code;
  final Map<String, Object?> args;
  const ValidationError(this.code, [this.args = const {}]);
}

class FieldValidator {
  // ── IDs that are explicitly optional even when FieldSchema.required
  //    is true (e.g. second phone number). ────────────────────
  static const Set<String> kOptionalOverrides = {
    'S0Q03_TEL2',
    'S1Q05_TEL2',
    'COOP_S1Q06_TEL2',
    'CTD_S1Q06_TEL2',
    'ONG_S1Q06_TEL2',
  };

  // ── Cameroon phone ────────────────────────────────────────
  static bool isValidPhone(String? v) {
    if (v == null || v.isEmpty) return false;
    if (v.length != 9) return false;
    return v[0] == '2' || v[0] == '6';
  }

  // ── Email ─────────────────────────────────────────────────
  static bool isValidEmail(String? v) {
    if (v == null || v.isEmpty) return false;
    return RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        .hasMatch(v);
  }

  // ── Year ──────────────────────────────────────────────────
  static bool isYearField(FieldSchema f) {
    if (kYearFieldIds.contains(f.id)) return true;
    return f.type == 'number' && f.id.toLowerCase().contains('year');
  }

  static bool isValidYear(String? v) {
    if (v == null || v.isEmpty) return false;
    final y = int.tryParse(v);
    if (y == null) return false;
    final current = DateTime.now().year;
    return y >= 1900 && y <= current;
  }

  // ── Core: validate a single field ────────────────────────
  //
  // Returns null when the field is valid or does not need
  // validation (not required, invisible, optional override).
  //
  // [data]    — the full form data map
  // [touched] — if non-null, only validate touched fields
  //             (pass null to validate unconditionally, e.g. in _vSec)
  static ValidationError? validate(
    FieldSchema f,
    Map<String, dynamic> data, {
    Set<String>? touched,
  }) {
    if (!_isVisible(f, data)) return null;
    if (f.type == 'table') {
      if (touched != null &&
          !touched.contains(f.id) &&
          (f.paperCode == null ||
              !touched.contains(TableResponseStatus.fieldId(f.paperCode!)))) {
        return null;
      }
      return _validateTable(f, data);
    }

    // Skip non-required and optional overrides always
    if (!f.required || kOptionalOverrides.contains(f.id)) return null;

    // If we're in touched-only mode, skip untouched fields
    if (touched != null && !touched.contains(f.id)) return null;

    final raw = data[f.id];
    final v = raw?.toString().trim() ?? '';

    if (v.isEmpty) return const ValidationError(ValidationErrorCode.required);

    switch (f.type) {
      case 'tel':
        if (!isValidPhone(v)) {
          if (v.length != 9) {
            return const ValidationError(ValidationErrorCode.telLength);
          }
          return const ValidationError(ValidationErrorCode.telPrefix);
        }
        break;
      case 'email':
        if (!isValidEmail(v)) {
          return const ValidationError(ValidationErrorCode.email);
        }
        break;
      case 'number':
        if (isYearField(f)) {
          if (int.tryParse(v) == null) {
            return const ValidationError(ValidationErrorCode.yearFormat);
          }
          final year = int.parse(v);
          if (year < 1900) {
            return const ValidationError(ValidationErrorCode.yearMin);
          }
          final current = DateTime.now().year;
          if (year > current) {
            return ValidationError(ValidationErrorCode.yearMax, {'max': current});
          }
        }
        break;
    }

    // Conditional required: dependsOn / dependsValue
    if (f.dependsOn != null && f.dependsValue != null) {
      if (data[f.dependsOn] == f.dependsValue && v.isEmpty) {
        return const ValidationError(ValidationErrorCode.requiredConditional);
      }
    }

    return null; // valid
  }

  // ── Section completeness ──────────────────────────────────
  //
  // Returns true only when every visible required non-table field
  // in [sec] passes validation unconditionally (ignores touched).
  static bool isSectionComplete(
    SectionSchema sec,
    FormSchemaV2 schema,
    Map<String, dynamic> data, {
    Set<String> hybridIds = const {},
  }) {
    for (final id in sec.fieldIds) {
      final f = schema.getField(id);
      if (f == null) continue;
      if (hybridIds.contains(f.id)) continue;
      if (validate(f, data) != null) return false;
    }
    return true;
  }

  // ── Missing field labels (for sidebar count) ──────────────
  static List<String> missingLabels(
    SectionSchema sec,
    FormSchemaV2 schema,
    Map<String, dynamic> data,
    Locale locale, {
    Set<String> hybridIds = const {},
  }) {
    final out = <String>[];
    for (final id in sec.fieldIds) {
      final f = schema.getField(id);
      if (f == null) continue;
      if (hybridIds.contains(f.id)) continue;
      if (validate(f, data) != null) {
        out.add(_label(f, locale));
      }
    }
    return out;
  }

  static ValidationError? _validateTable(
    FieldSchema f,
    Map<String, dynamic> data,
  ) {
    final paper = f.paperCode;
    if (paper == null || paper.isEmpty) return null;
    final status = data[TableResponseStatus.fieldId(paper)]?.toString();
    if (status == null || status.isEmpty) {
      return const ValidationError(ValidationErrorCode.tableResponseRequired);
    }
    if (TableResponseStatus.isClosed(status)) return null;
    if (TableResponseStatus.isReported(status)) {
      return _tableHasEnteredValue(f, data)
          ? null
          : const ValidationError(ValidationErrorCode.tableFiguresRequired);
    }
    return const ValidationError(ValidationErrorCode.tableResponseRequired);
  }

  static bool _tableHasEnteredValue(
    FieldSchema f,
    Map<String, dynamic> data,
  ) {
    final pfx = ((f.tableSpec?['prefix'] as String?) ?? f.id).toLowerCase();
    final start = '${pfx}_';
    for (final entry in data.entries) {
      if (!entry.key.startsWith(start)) continue;
      if (entry.key.endsWith('_skipped') ||
          entry.key.endsWith('_RESPONSE_STATUS')) {
        continue;
      }
      final v = entry.value;
      if (v is int) return true;
      if (v is num) return true;
      if (v is String && v.trim().isNotEmpty && int.tryParse(v.trim()) != null) {
        return true;
      }
    }
    return false;
  }

  // ── Helpers ───────────────────────────────────────────────
  static bool _isVisible(FieldSchema f, Map<String, dynamic> data) =>
      f.isVisibleGiven(data);

  static String _label(FieldSchema f, Locale locale) {
    if (f.label != null) return f.label!.of(locale);
    if (f.instruction != null) return f.instruction!.of(locale);
    if (f.questionText != null && f.questionText!.isNotEmpty) {
      return f.questionText!;
    }
    return f.id;
  }
}

/// Resolves a [ValidationError] code to display text via [l10n]. Kept
/// separate from [FieldValidator.validate] so the validator itself stays
/// pure and locale-independent (see the class doc comment).
String validationErrorMessage(AppLocalizations l10n, ValidationError error) {
  switch (error.code) {
    case ValidationErrorCode.required:
      return l10n.requiredField;
    case ValidationErrorCode.telLength:
      return l10n.telExactly9Digits;
    case ValidationErrorCode.telPrefix:
      return l10n.telMustStartWith2Or6;
    case ValidationErrorCode.email:
      return l10n.emailInvalid;
    case ValidationErrorCode.yearFormat:
      return l10n.yearInvalid;
    case ValidationErrorCode.yearMin:
      return l10n.yearMin;
    case ValidationErrorCode.yearMax:
      return l10n.yearMax(error.args['max'] as int);
    case ValidationErrorCode.requiredConditional:
      return l10n.requiredFieldConditional;
    case ValidationErrorCode.tableResponseRequired:
      return l10n.tableResponseRequired;
    case ValidationErrorCode.tableFiguresRequired:
      return l10n.tableFiguresRequired;
  }
}
