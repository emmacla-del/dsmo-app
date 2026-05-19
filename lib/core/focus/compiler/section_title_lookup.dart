// lib/core/focus/compiler/section_title_lookup.dart

import 'form_ast.dart';

class SectionTitleLookup {
  static final Map<String, String> _titles = {};

  static void register(SectionAst section) {
    _titles[section.id] = section.title;
  }

  static void registerAll(List<SectionAst> sections) {
    for (final s in sections) {
      register(s);
    }
  }

  static String getTitle(String sectionId) {
    return _titles[sectionId] ?? sectionId;
  }
}
