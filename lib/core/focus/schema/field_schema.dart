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
  final LocalizedText? hint; // Helper text
  final String? paperCode; // Official PDF code
  final Map<String, dynamic>? tableSpec; // For table fields
  final String? dependsOn; // Conditional visibility
  final String? dependsValue; // Value that triggers visibility

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
    this.hint,
    this.paperCode,
    this.tableSpec,
    this.dependsOn,
    this.dependsValue,
    this.questionText,
    this.instruction,
    this.subsection, // ← ADD THIS
  });

  /// Canonical option values only — what gets stored/submitted and compared
  /// against by BackendMappers/dependsValue. Never rendered directly; use
  /// [optionsI18n] + `.text.of(locale)` for display.
  List<String>? get options => optionsI18n?.map((o) => o.value).toList();
}
