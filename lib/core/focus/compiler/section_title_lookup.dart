// lib/core/focus/compiler/section_title_lookup.dart

import 'package:flutter/widgets.dart';

import '../../i18n/localized_text.dart';
import 'form_ast.dart';

class SectionTitleLookup {
  static final Map<String, LocalizedText> _titles = {};

  static void register(SectionAst section) {
    _titles[section.id] = section.title;
  }

  static void registerAll(List<SectionAst> sections) {
    for (final s in sections) {
      register(s);
    }
  }

  static String getTitle(String sectionId, Locale locale) {
    return _titles[sectionId]?.of(locale) ?? sectionId;
  }
}
