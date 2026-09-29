// Throwaway visual-audit tool (same status as vt_row_editor_screenshot_test
// .dart) for VtFixedRowGrid — the always-visible, no-Add-step row grid used
// at tablet/desktop widths for the 7 fixed-checklist VT tables (4.1, 4.2,
// 5.3, 8.1, 8.2, 8.3, 8.6). Renders the real widget bound to a real
// OnefopFormController, directly, the same way the row-editor goldens do.
// Not a regression test; safe to delete.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_fixed_row_grid.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_types.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

OnefopFormController _controller({Map<String, dynamic> initialData = const {}}) {
  return OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: initialData,
    onSave: (_) async {},
  );
}

Future<void> _capture(
  WidgetTester tester,
  String name,
  VtTableDef def, {
  required Size size,
  Map<String, dynamic> initialData = const {},
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final ctrl = _controller(initialData: initialData);
  addTearDown(ctrl.dispose);

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(12),
            child: VtFixedRowGrid(ctrl: ctrl, def: def),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  tester.takeException();

  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
}

// 5.3 (9 rows x 4 plain-number cells, no computed column) — fully-filled
// initial data covering every row.
final Map<String, dynamic> _s53Full = {
  for (final t in vtInfrastructureRows)
    for (final col in ['totalCount', 'permanentGoodCount', 'permanentBadCount', 'temporaryCount'])
      's5q3_${t.key}_$col': 2,
};

final Map<String, dynamic> _s53Partial = {
  's5q3_${vtInfrastructureRows.first.key}_totalCount': 5,
  's5q3_${vtInfrastructureRows.first.key}_permanentGoodCount': 3,
  's5q3_${vtInfrastructureRows[2].key}_temporaryCount': 1,
};

// 4.1 (11 rows x male/female + computed Total) — fully-filled covers every
// row's two entered cells (Total is derived, never entered).
final Map<String, dynamic> _s41Full = {
  for (final d in vtAcademicDiplomaRows) 's4q1_${d.key}_male': 4,
  for (final d in vtAcademicDiplomaRows) 's4q1_${d.key}_female': 3,
};

final Map<String, dynamic> _s41Partial = {
  's4q1_${vtAcademicDiplomaRows.first.key}_male': 12,
  's4q1_${vtAcademicDiplomaRows.first.key}_female': 8,
  // An explicit zero on a second row — must render distinguishably from
  // the remaining, never-touched rows (not pre-filled with 0 anywhere else).
  's4q1_${vtAcademicDiplomaRows[1].key}_male': 0,
};

void main() {
  const sizes = {'1440': Size(1440, 900), '768': Size(768, 1024)};

  for (final entry in sizes.entries) {
    final tag = entry.key;
    final size = entry.value;

    testWidgets('VtFixedRowGrid $tag — 5.3 infrastructure, empty', (tester) async {
      final def = vtTableDefFor('vt_infrastructure_table', {'prefix': 's5q3'})!;
      await _capture(tester, 'vt_fixed_grid_${tag}_5_3_empty', def, size: size);
    });

    testWidgets('VtFixedRowGrid $tag — 5.3 infrastructure, partially filled', (tester) async {
      final def = vtTableDefFor('vt_infrastructure_table', {'prefix': 's5q3'})!;
      await _capture(tester, 'vt_fixed_grid_${tag}_5_3_partial', def,
          size: size, initialData: _s53Partial);
    });

    testWidgets('VtFixedRowGrid $tag — 5.3 infrastructure, fully filled', (tester) async {
      final def = vtTableDefFor('vt_infrastructure_table', {'prefix': 's5q3'})!;
      await _capture(tester, 'vt_fixed_grid_${tag}_5_3_full', def,
          size: size, initialData: _s53Full);
    });

    testWidgets('VtFixedRowGrid $tag — 4.1 diploma, empty', (tester) async {
      final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
      await _capture(tester, 'vt_fixed_grid_${tag}_4_1_empty', def, size: size);
    });

    testWidgets('VtFixedRowGrid $tag — 4.1 diploma, partially filled (incl. explicit zero)',
        (tester) async {
      final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
      await _capture(tester, 'vt_fixed_grid_${tag}_4_1_partial', def,
          size: size, initialData: _s41Partial);
    });

    testWidgets('VtFixedRowGrid $tag — 4.1 diploma, fully filled', (tester) async {
      final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
      await _capture(tester, 'vt_fixed_grid_${tag}_4_1_full', def,
          size: size, initialData: _s41Full);
    });
  }
}
