// lib/core/focus/onefop_form_loader.dart
// ignore_for_file: avoid_print

import 'compiler/onefop_ast.dart';
import 'compiler/form_schema_compiler.dart';
import 'compiler/section_title_lookup.dart';
import 'schema/form_schema_v2.dart';

class OnefopFormLoader {
  static Future<FormSchemaV2> loadForEntity(String entityType) async {
    print('\n📚 ========== FORM LOADER ==========');
    print('📚 Loading for entity: $entityType');
    print('📚 Total sections in AST: ${allSections.length}');
    print('📚 Sections: ${allSections.map((s) => s.id).toList()}');
    print('📚 Total questions in AST: ${allQuestions.length}');

    // Use AST directly - no JSON file needed!
    const questions = allQuestions;
    const sections = allSections;

    // Register section titles for UI
    for (final section in sections) {
      SectionTitleLookup.register(section);
    }
    print('📚 Registered ${sections.length} sections with SectionTitleLookup');

    // Compile schema for this entity type
    final schema = FormSchemaCompiler.compile(
      sections: sections,
      questions: questions,
      entityType: entityType,
    );

    print('\n📚 ✅ Schema compiled successfully!');
    print('📚 Final sections in schema: ${schema.sections.length}');
    print('📚 Final sections: ${schema.sections.map((s) => s.id).toList()}');
    for (final s in schema.sections) {
      print('   📄 ${s.id}: ${s.fieldIds.length} fields');
    }
    print('📚 =================================\n');

    return schema;
  }
}
