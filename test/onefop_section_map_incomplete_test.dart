// Smoke test for Phase 3 — OnefopSectionMap's incomplete-unit indicator.
// Builds SectionUnits by hand (bypassing schema loading — OnefopSectionMap
// itself never touches ctrl.schema) so this doesn't need a real loaded
// form, just the plain data/advanced-unit bookkeeping OnefopFormController
// already exposes.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_section_units.dart';

OnefopFormController _ctrl({Map<String, dynamic> initialData = const {}}) {
  return OnefopFormController(
    entityType: EntityType.enterprise,
    initialData: initialData,
    onSave: (_) {},
  );
}

SectionUnit _unit(
  String key, {
  required bool Function(OnefopFormController) hasData,
  required bool Function(OnefopFormController) canAdvance,
  String? shortLabel,
}) {
  return SectionUnit(
    key: key,
    shortLabel: shortLabel ?? key,
    fieldIds: const [],
    content: () => const SizedBox.shrink(),
    hasData: hasData,
    canAdvance: canAdvance,
  );
}

Future<void> _pump(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(900, 400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(MaterialApp(home: Scaffold(body: child)));
}

void main() {
  testWidgets('done+complete shows a checkmark, done+incomplete shows a warning "!"',
      (tester) async {
    final ctrl = _ctrl();
    // Unit A: done and fully valid.
    final unitA = _unit('a',
        shortLabel: 'A', hasData: (_) => true, canAdvance: (_) => true);
    // Unit B: done (visited) but still missing something required —
    // this is the one Phase 3 should flag.
    final unitB = _unit('b',
        shortLabel: 'B', hasData: (_) => true, canAdvance: (_) => false);
    // Unit C: current.
    final unitC = _unit('c', shortLabel: 'C', hasData: (_) => false, canAdvance: (_) => false);
    // Unit D: upcoming, untouched — never flagged even though canAdvance
    // would also be false if checked (nothing to warn about yet).
    final unitD = _unit('d', shortLabel: 'D', hasData: (_) => false, canAdvance: (_) => false);

    final units = [unitA, unitB, unitC, unitD];
    var jumped = -1;

    await _pump(
      tester,
      OnefopSectionMap(
        ctrl: ctrl,
        units: units,
        currentIndex: 2, // unitC
        onJump: (i) => jumped = i,
        onJumpToLocation: (i) => jumped = i,
      ),
    );

    expect(find.textContaining('✓ A'), findsOneWidget);
    expect(find.textContaining('! B'), findsOneWidget);
    expect(find.textContaining('● C'), findsOneWidget);
    expect(find.textContaining('○ D'), findsOneWidget);

    // Soft signal only — the incomplete chip is still tappable (jumps),
    // navigation isn't blocked.
    await tester.tap(find.textContaining('! B'));
    await tester.pump();
    expect(jumped, 1);

    await expectLater(find.byType(OnefopSectionMap),
        matchesGoldenFile('goldens/section_map_incomplete.png'));
  });

  testWidgets('map hides entirely for a single-unit section (unchanged from Phase 1/2)',
      (tester) async {
    final ctrl = _ctrl();
    final onlyUnit =
        _unit('only', hasData: (_) => false, canAdvance: (_) => true);
    await _pump(
      tester,
      OnefopSectionMap(
        ctrl: ctrl,
        units: [onlyUnit],
        currentIndex: 0,
        onJump: (_) {},
        onJumpToLocation: (_) {},
      ),
    );
    expect(find.byType(OnefopSectionMap), findsOneWidget);
    expect(find.text('✓ only'), findsNothing);
    expect(find.text('● only'), findsNothing);
  });
}
