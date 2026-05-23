// lib/core/focus/utils/field_validator.dart
//
// ══════════════════════════════════════════════════════════════
// CENTRALIZED FIELD VALIDATOR
//
// FIXES:
//   • Replaces tripled validation logic scattered across:
//       _hasErr(), _errorText(), _vSec(), _missing()
//     in onefop_unified_form_screen_v3.dart
//   • Single source of truth: validate() returns String? (null = valid)
//   • isSectionComplete() and missingLabels() delegate to validate()
//   • Phone/year/email rules no longer hardcoded in the screen
//   • Optional override set injected, not hardcoded
// ══════════════════════════════════════════════════════════════

import '../schema/field_schema.dart';
import '../schema/section_schema.dart';
import '../schema/form_schema_v2.dart';

// ─────────────────────────────────────────────────────────────
// Field IDs whose number values represent a calendar year.
// Add new year fields here rather than touching the screen.
// ─────────────────────────────────────────────────────────────
const Set<String> kYearFieldIds = {
  'COOP_S1Q03',
  'CTD_S1Q03',
  'ONG_S1Q03',
};

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
  static String? validate(
    FieldSchema f,
    Map<String, dynamic> data, {
    Set<String>? touched,
  }) {
    // Skip non-required and optional overrides always
    if (!f.required || kOptionalOverrides.contains(f.id)) return null;
    // Skip invisible (conditional) fields
    if (!_isVisible(f, data)) return null;
    // Skip table fields — validated elsewhere
    if (f.type == 'table') return null;

    // If we're in touched-only mode, skip untouched fields
    if (touched != null && !touched.contains(f.id)) return null;

    final raw = data[f.id];
    final v = raw?.toString().trim() ?? '';

    if (v.isEmpty) return 'Champ obligatoire';

    switch (f.type) {
      case 'tel':
        if (!isValidPhone(v)) {
          if (v.length != 9) {
            return 'Le numéro doit contenir exactement 9 chiffres';
          }
          return 'Le numéro doit commencer par 2 (fixe) ou 6 (mobile)';
        }
        break;
      case 'email':
        if (!isValidEmail(v)) {
          return 'Veuillez entrer une adresse e-mail valide'
              ' (ex: contact@entreprise.com)';
        }
        break;
      case 'number':
        if (isYearField(f)) {
          if (int.tryParse(v) == null) {
            return 'Veuillez entrer une année valide (ex: 1998)';
          }
          final year = int.parse(v);
          if (year < 1900) return "L'année doit être ≥ 1900";
          final current = DateTime.now().year;
          if (year > current) return "L'année doit être ≤ $current";
        }
        break;
    }

    // Conditional required: dependsOn / dependsValue
    if (f.dependsOn != null && f.dependsValue != null) {
      if (data[f.dependsOn] == f.dependsValue && v.isEmpty) {
        return 'Champ obligatoire (conditionnel)';
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
    Map<String, dynamic> data, {
    Set<String> hybridIds = const {},
  }) {
    final out = <String>[];
    for (final id in sec.fieldIds) {
      final f = schema.getField(id);
      if (f == null) continue;
      if (hybridIds.contains(f.id)) continue;
      if (validate(f, data) != null) {
        out.add(_label(f));
      }
    }
    return out;
  }

  // ── Helpers ───────────────────────────────────────────────
  static bool _isVisible(FieldSchema f, Map<String, dynamic> data) {
    if (f.dependsOn == null || f.dependsOn!.isEmpty) return true;
    return data[f.dependsOn] == f.dependsValue;
  }

  static String _label(FieldSchema f) {
    if (f.label != null && f.label!.isNotEmpty) return f.label!;
    if (f.instruction != null && f.instruction!.isNotEmpty) {
      return f.instruction!;
    }
    if (f.questionText != null && f.questionText!.isNotEmpty) {
      return f.questionText!;
    }
    return f.id;
  }
}
