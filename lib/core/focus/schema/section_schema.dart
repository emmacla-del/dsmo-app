// lib/core/focus/schema/section_schema.dart

class SectionSchema {
  final String id;
  final List<String> fieldIds;
  final String? firstField;
  final String? lastField;
  final String? nextSection;
  final String? prevSection;

  const SectionSchema({
    required this.id,
    required this.fieldIds,
    this.firstField,
    this.lastField,
    this.nextSection,
    this.prevSection,
  });
}
