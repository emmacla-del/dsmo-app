// lib/core/focus/onefop_form_loader.dart
// ignore_for_file: avoid_print

import 'compiler/onefop_ast.dart';
import 'compiler/form_schema_compiler.dart';
import 'compiler/section_title_lookup.dart';
import 'schema/form_schema_v2.dart';

class OnefopFormLoader {
  static void _debug(String message) {
    if (const bool.fromEnvironment('VERBOSE_FORM_LOGS', defaultValue: false)) {
      print(message);
    }
  }

  // Synchronous by design: this compiles an in-memory AST with no I/O, so
  // wrapping it in a Future only forced an extra microtask hop before the
  // controller could mark itself loaded — which meant the form's first
  // frame always rendered the loading skeleton, then flashed to the real
  // form on the very next frame.
  static FormSchemaV2 loadForEntity(String entityType) {
    _debug('\n📚 ========== FORM LOADER ==========');
    _debug('📚 Loading for entity: $entityType');
    _debug('📚 Total sections in AST: ${allSections.length}');
    _debug('📚 Sections: ${allSections.map((s) => s.id).toList()}');
    _debug('📚 Total questions in AST: ${allQuestions.length}');

    // Use AST directly - no JSON file needed!
    final questions = allQuestions;
    const sections = allSections;

    // Register section titles for UI
    for (final section in sections) {
      SectionTitleLookup.register(section);
    }
    _debug('📚 Registered ${sections.length} sections with SectionTitleLookup');

    // Compile schema for this entity type
    final schema = FormSchemaCompiler.compile(
      sections: sections,
      questions: questions,
      entityType: entityType,
    );

    _debug('\n📚 ✅ Schema compiled successfully!');
    _debug('📚 Final sections in schema: ${schema.sections.length}');
    _debug('📚 Final sections: ${schema.sections.map((s) => s.id).toList()}');
    for (final s in schema.sections) {
      _debug('   📄 ${s.id}: ${s.fieldIds.length} fields');
    }
    _debug('📚 =================================\n');

    return schema;
  }
}
