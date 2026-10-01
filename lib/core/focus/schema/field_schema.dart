// lib/core/focus/schema/field_schema.dart

import '../../i18n/localized_text.dart';

class FieldSchema {
  final String id;
  final String path;
  final String type;
  final String? next;
  final String? prev;
  final LocalizedText?
      label; // Human-readable label (e.g., "Combien de demandes d'emplois...")
  final List<LocalizedOption>? optionsI18n; // For radio/select
  final bool required; // Is field required?
  final bool readOnly; // Is field read-only in UI?
  final LocalizedText? hint; // Helper text
  final String? paperCode; // Official PDF code
  final Map<String, dynamic>? tableSpec; // For table fields
  final String? dependsOn; // Conditional visibility
  final String? dependsValue; // Value that triggers visibility
  final String? dependsOperator; // null/"eq" (default) or "contains" — see form_ast.dart

  // Question and instruction text
  final String?
      questionText; // The question text (e.g., "2.1 DEMANDE D'EMPLOIS")
  final LocalizedText?
      instruction; // The instruction text (e.g., "Combien de demandes d'emplois...")

  // Subsection header (e.g., "2.1 DEMANDE D'EMPLOIS/ JOB APPLICATION")
  final LocalizedText? subsection;

  const FieldSchema({
    required this.id,
    required this.path,
    required this.type,
    this.next,
    this.prev,
    this.label,
    this.optionsI18n,
    this.required = false,
    this.readOnly = false,
    this.hint,
    this.paperCode,
    this.tableSpec,
    this.dependsOn,
    this.dependsValue,
    this.dependsOperator,
    this.questionText,
    this.instruction,
    this.subsection, // ← ADD THIS
  });

  /// Canonical option values only — what gets stored/submitted and compared
  /// against by BackendMappers/dependsValue. Never rendered directly; use
  /// [optionsI18n] + `.text.of(locale)` for display.
  List<String>? get options => optionsI18n?.map((o) => o.value).toList();

  /// Whether this field should be shown given the current answers in
  /// [data] — the single evaluator OnefopFormController.isFieldVisible and
  /// FieldValidator._isVisible both delegate to, so the two can never
  /// drift apart (VT-UI/UX-07).
  ///
  /// No dependsOn → always visible. dependsOperator null/"eq" (every
  /// dependsOn declared before VT-UI/UX-07, and the default for any new
  /// one) → equality: data[dependsOn] == dependsValue, unchanged from
  /// before this method existed. dependsOperator "contains" → data
  /// [dependsOn] must be an Iterable (a checkbox's List<String>) that
  /// contains dependsValue; a null/non-Iterable trigger (checkbox never
  /// touched) safely evaluates to not-visible rather than throwing.
  bool isVisibleGiven(Map<String, dynamic> data) {
    if (dependsOn == null || dependsOn!.isEmpty) return true;
    final trigger = data[dependsOn];
    if (dependsOperator == 'contains') {
      return trigger is Iterable && trigger.contains(dependsValue);
    }
    return trigger == dependsValue;
  }

  /// Used to patch a compiled field's label with runtime content (e.g.
  /// S21Q01's campaign-period wording — see
  /// OnefopFormController._applyCampaignPeriodLabels) without re-listing
  /// every other constructor argument at the call site.
  FieldSchema copyWith({LocalizedText? label}) => FieldSchema(
        id: id,
        path: path,
        type: type,
        next: next,
        prev: prev,
        label: label ?? this.label,
        optionsI18n: optionsI18n,
        required: required,
        hint: hint,
        paperCode: paperCode,
        tableSpec: tableSpec,
        dependsOn: dependsOn,
        dependsValue: dependsValue,
        dependsOperator: dependsOperator,
        questionText: questionText,
        instruction: instruction,
        subsection: subsection,
      );
}
