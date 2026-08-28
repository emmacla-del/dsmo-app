// Regression tests for the vertical navigation's Section/Subsection/
// Question jump behavior (navigateToSection / jumpToLocation / jumpToUnit
// in onefop_section_units.dart):
//
//   - A Section click must land on that section's very first unit (index
//     0) regardless of any prior progress, and must NOT focus a field.
//   - A Subsection click (jumpToLocation) must land on that subsection's
//     first unit and also must NOT focus a field.
//   - A Question click (jumpToUnit) must focus that unit's first editable
//     cell — and, critically, must work even when the target unit hasn't
//     been reached/completed yet (the whole point of a real "jump
//     anywhere" outline, not a linear replay of Suivant).
//
// Exercised directly against OnefopFormController + buildTableGroupUnits
// (the same real schema onefop_unit_ordering_test.dart uses) rather than
// through the Sidebar/OnefopSectionMap widgets — this is the shared
// "architecture layer" both platforms' UI ultimately calls into, so
// testing it here covers Spreadsheet Mode, Simple Mode and mobile at
// once without depending on any one shell's widget tree.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_section_units.dart';

void main() {
  const locale = Locale('fr');

  Future<OnefopFormController> ctrl() async {
    final c = OnefopFormController(
      entityType: EntityType.enterprise,
      initialData: const {},
      onSave: (_) {},
    );
    await c.initialize();
    return c;
  }

  testWidgets('navigateToSection lands on the section\'s first page and unit, without focusing',
      (tester) async {
    final c = await ctrl();
    final section3Idx = c.schema!.sections.indexWhere((s) => s.id == 'section3');
    expect(section3Idx, greaterThan(0), reason: 'section3 must not already be the starting page');

    expect(c.currentPage, isNot(section3Idx));
    expect(c.fm.activeId, isNull);

    navigateToSection(c, locale, EntityType.enterprise, 'section3');

    expect(c.currentPage, section3Idx,
        reason: 'Section click must switch to that section\'s page');
    expect(c.unitCursor('section3'), 0,
        reason: 'Section click must land on the very first unit, not a resumed/incomplete one');
    expect(c.fm.activeId, isNull,
        reason: 'Section click must not focus a field — only Question clicks do');
  });

  testWidgets('navigateToSection always resets to unit 0, even after progress past it',
      (tester) async {
    final c = await ctrl();
    final section3 = c.schema!.sections.firstWhere((s) => s.id == 'section3');
    final units = buildTableGroupUnits(
      c,
      section3,
      locale,
      entityType: EntityType.enterprise,
      simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
      mobile: false,
    );
    expect(units.length, greaterThan(1));

    // Simulate having already advanced deep into the section (e.g. via
    // Suivant) before clicking the section in the outline again.
    jumpToUnit(c, section3, units, units.length - 1);
    expect(c.unitCursor('section3'), units.length - 1);

    navigateToSection(c, locale, EntityType.enterprise, 'section3');

    expect(c.unitCursor('section3'), 0,
        reason: 'A Section click is an explicit "top of section" jump, not a resume');
  });

  testWidgets('jumpToLocation (Subsection click) moves the cursor without focusing a field',
      (tester) async {
    final c = await ctrl();
    final section3 = c.schema!.sections.firstWhere((s) => s.id == 'section3');
    final units = buildTableGroupUnits(
      c,
      section3,
      locale,
      entityType: EntityType.enterprise,
      simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
      mobile: false,
    );
    expect(units.length, greaterThanOrEqualTo(2));

    expect(c.fm.activeId, isNull);
    jumpToLocation(c, section3, units, 1);

    expect(c.unitCursor('section3'), 1);
    expect(c.fm.activeId, isNull,
        reason: 'Subsection click must not focus a field — only Question clicks do');
  });

  testWidgets('jumpToUnit (Question click) focuses the target unit\'s first cell, even unvisited',
      (tester) async {
    final c = await ctrl();
    final section3 = c.schema!.sections.firstWhere((s) => s.id == 'section3');
    final units = buildTableGroupUnits(
      c,
      section3,
      locale,
      entityType: EntityType.enterprise,
      simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
      mobile: false,
    );
    // S3Q01, S3Q02, S3Q03 — jump straight to the last one, skipping the
    // first two entirely (never visited, never marked done).
    final targetIdx = units.length - 1;
    expect(c.isUnitAdvanced(units[targetIdx].key), isFalse);

    jumpToUnit(c, section3, units, targetIdx);

    expect(c.unitCursor('section3'), targetIdx,
        reason: 'Jumping ahead of progress must still be allowed — this is a real outline, '
            'not a linear replay of Suivant');
    expect(c.fm.activeId, isNotNull,
        reason: 'Question click must focus the unit\'s first editable cell immediately');
  });
}
