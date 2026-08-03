// lib/core/focus/compiler/form_ast.dart

import '../../i18n/localized_text.dart';

/// ===========================================================
/// FIELD TYPES ENUM (For type safety)
/// ===========================================================
enum AstFieldType {
  text,
  number,
  radio,
  select,
  checkbox,
  table,
  email,
  tel,
  date,
  textarea,
}

/// ===========================================================
/// SECTION AST
/// ===========================================================
class SectionAst {
  /// Unique section ID (e.g., "section0", "section1_enterprise")
  final String id;

  /// Display title (French/English)
  final LocalizedText title;

  /// Display order in the form
  final int order;

  /// Optional description text
  final LocalizedText? description;

  /// Which entity types this section applies to
  /// null = all entity types
  final List<String>? entityTypes;

  const SectionAst({
    required this.id,
    required this.title,
    required this.order,
    this.description,
    this.entityTypes,
  });
}

/// ===========================================================
/// QUESTION AST
/// ===========================================================
class FormQuestionAst {
  /// Globally unique internal ID (e.g. "S22Q05_ENTERPRISE")
  final String id;

  /// Official PDF question code (e.g. "S22Q05")
  final String? paperCode;

  /// Human-readable label from the PDF
  final LocalizedText label;

  /// Reference to section ID
  final String sectionId;

  /// Position inside the section
  final int order;

  /// Field type from AstFieldType enum
  final AstFieldType type;

  /// For radio/select fields. Each option's canonical `value` is what gets
  /// stored/submitted and compared against by BackendMappers/dependsValue —
  /// only `text` is localized for display.
  final List<LocalizedOption>? options;

  /// For tables/grids later
  final Map<String, dynamic>? tableSpec;

  /// Which entities this field belongs to
  /// null = all entities
  final List<String>? entityTypes;

  /// Conditional logic
  final String? dependsOn;
  final String? dependsValue;

  /// Is this field required?
  final bool requiredField;

  /// Stable storage path (e.g. "section1.enterprise.name")
  final String? path;

  /// Help text / hint for the user
  final LocalizedText? hint;

  /// Instruction text (e.g. "Combien de demandes d'emplois...")
  final LocalizedText? instruction;

  /// Subsection header (e.g., "2.1 DEMANDE D'EMPLOIS/ JOB APPLICATION")
  final LocalizedText? subsection;

  const FormQuestionAst({
    required this.id,
    this.paperCode,
    required this.label,
    required this.sectionId,
    required this.order,
    required this.type,
    this.options,
    this.tableSpec,
    this.entityTypes,
    this.dependsOn,
    this.dependsValue,
    this.requiredField = false,
    this.path,
    this.hint,
    this.instruction,
    this.subsection,
  });
}
