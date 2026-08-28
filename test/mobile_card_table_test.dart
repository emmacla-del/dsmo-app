// Smoke test for MobileCardTable's collapsible-option treatment of
// editable-row-label tables (S3Q02's reasons, S4Q02's skills, S4Q03's
// training domains — see TableSpecBuilder._buildReasons/_buildSkills/
// _buildTraining): each option should render as its own collapsible card,
// generic label ("Compétence 1"/2/3) visible collapsed, only one open at a
// time (accordion), while the trailing non-editable "Total" row renders as
// a compact, always-visible "Total général" summary frame instead of a
// full card (see MobileCardTable._grandTotalFrame).
//
// Assertions count NumberField/FormTextField widgets (the actual editable
// input types — see shared/grid_cell_dispatch.dart) rather than text
// strings like "M"/"Total": those column labels legitimately repeat once
// per rendered row (the one open option AND the always-open Total row),
// so they're not a reliable signal for "how many options are open".
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/category_mini_grids.dart' show MiniSwitch;
import 'package:dsmo_app/core/focus/renderers/grid_render_spec.dart';
import 'package:dsmo_app/core/focus/renderers/mobile_card_table.dart';
import 'package:dsmo_app/core/focus/renderers/shared/number_field.dart';
import 'package:dsmo_app/core/focus/renderers/shared/text_field.dart';
import 'package:dsmo_app/core/focus/schema/form_schema_v2.dart';
import 'package:dsmo_app/core/focus/schema/navigation_engine.dart';
import 'package:dsmo_app/core/focus/schema/navigation_graph.dart';
import 'package:dsmo_app/core/focus/unified_focus_manager_v2.dart';

// Mirrors TableSpecBuilder._buildSkills's shape: 3 editable-label rows
// (skill_1/2/3, each with an editable male/female pair + a computed,
// non-editable per-row total) plus a trailing static "Total" row whose
// own male/female/total cells are all computed (non-editable).
GridRenderSpec _skillsSpec(String prefix) {
  const dataRows = ['skill_1', 'skill_2', 'skill_3'];
  const hints = ['Compétence 1', 'Compétence 2', 'Compétence 3'];
  List<String> genderRow(String rowKey) =>
      ['male', 'female', 'total'].map((g) => '${prefix}_${rowKey}_$g').toList();
  bool isTotal(String id) => id.contains('_total');

  return GridRenderSpec(
    id: prefix,
    rowLabels: [...hints, 'Total'],
    matrix: [for (final r in dataRows) genderRow(r), genderRow('total')],
    headers: const [HeaderNode('M'), HeaderNode('F'), HeaderNode('Total')],
    cornerLabel: 'Compétence',
    isTotalCell: isTotal,
    firstColWidthOverride: 220,
    rowLabelCellIds: [
      for (final r in dataRows) '${prefix}_${r}_label',
      '', // total row — static, not editable
    ],
    cellSpec: (id) {
      if (id.endsWith('_label')) {
        final idx = dataRows.indexWhere((r) => id.contains(r));
        return CellSpec(
          id: id,
          type: CellType.text,
          editable: true,
          hint: idx >= 0 ? hints[idx] : 'Compétence',
        );
      }
      return CellSpec(
        id: id,
        type: CellType.number,
        editable: !isTotal(id),
        backgroundColor: isTotal(id) ? const Color(0xFFE8F5EE) : null,
      );
    },
  );
}

UnifiedFocusManagerV2 _fm() => UnifiedFocusManagerV2(NavigationEngine(const FormSchemaV2(
      sections: [],
      fields: [],
      grids: [],
      navigation: NavigationGraph(next: {}, prev: {}, gridNeighbors: {}),
    )));

// Mirrors TableSpecBuilder._buildInternship's shape (S4Q01): static row
// labels (no rowLabelCellIds at all), 4 data rows + a trailing computed
// "Total" row, M/F/Total columns — the one template with more than one
// non-Total row whose label *isn't* user-typed.
GridRenderSpec _internshipSpec(String prefix) {
  const dataRows = ['vacation', 'academic', 'professional', 'pre_employment'];
  const labels = ['Holiday jobs', 'Academic', 'Professional', 'Pre-work', 'Total'];
  List<String> genderRow(String rowKey) =>
      ['male', 'female', 'total'].map((g) => '${prefix}_${rowKey}_$g').toList();
  bool isTotal(String id) => id.contains('_total');

  return GridRenderSpec(
    id: prefix,
    rowLabels: labels,
    matrix: [for (final r in dataRows) genderRow(r), genderRow('total')],
    headers: const [HeaderNode('M'), HeaderNode('F'), HeaderNode('Total')],
    cornerLabel: 'Nature',
    isTotalCell: isTotal,
    // Mirrors TableSpecBuilder._buildInternship's own rowKeys — the '' for
    // the trailing Total row is what keeps it out of the skip toggle.
    rowKeys: [for (final r in dataRows) '${prefix}_$r', ''],
    cellSpec: (id) => CellSpec(
      id: id,
      type: CellType.number,
      editable: !isTotal(id),
      backgroundColor: isTotal(id) ? const Color(0xFFE8F5EE) : null,
    ),
  );
}

Future<void> _pump(WidgetTester tester, Map<String, String> textValues) async {
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: SingleChildScrollView(
        child: MobileCardTable(
          spec: _skillsSpec('s4q02'),
          numberValues: const {},
          textValues: textValues,
          onNumberChanged: (_, __) {},
          onTextChanged: (_, __) {},
          focusManager: _fm(),
          tableId: 's4q02',
        ),
      ),
    ),
  ));
}

void main() {
  testWidgets('collapsed by default except the first option, generic labels visible',
      (tester) async {
    await _pump(tester, const {});

    expect(find.text('Compétence 1'), findsWidgets); // header, + hint since it's open & empty
    expect(find.text('Compétence 2'), findsOneWidget); // collapsed — header only
    expect(find.text('Compétence 3'), findsOneWidget);
    // "Total" (the column label) doesn't show yet — Compétence 1 opens on
    // just M, the first fillable column; Total only appears once every
    // fillable column's been visited and everything's revealed together
    // for review (see the cascade test below).
    expect(find.text('Total'), findsNothing);

    // The Total row has no editable cells at all (every one of its ids
    // contains "_total" — see isTotal above), so every NumberField/
    // FormTextField mounted belongs to the one open option (skill_1) —
    // and within that option, only M (the first fillable column) shows
    // at first, F waiting its own turn (see _CollapsibleLabelRowsState's
    // field-level reveal), plus the option's own label field.
    expect(find.byType(NumberField), findsOneWidget);
    expect(find.byType(FormTextField), findsOneWidget);
  });

  testWidgets('tapping a collapsed option opens it and collapses the other (accordion)',
      (tester) async {
    await _pump(tester, const {});

    await tester.tap(find.text('Compétence 2'));
    await tester.pump();

    // Still exactly one option's worth of fields, and within it just the
    // first fillable column — Skill 1's closed, Skill 2's open (M only),
    // never both options — or both of an option's columns — at once.
    expect(find.byType(NumberField), findsOneWidget);
    expect(find.byType(FormTextField), findsOneWidget);

    await tester.tap(find.text('Compétence 3'));
    await tester.pump();
    expect(find.byType(NumberField), findsOneWidget);
    expect(find.byType(FormTextField), findsOneWidget);
  });

  testWidgets('tapping the open option collapses it with nothing else opening',
      (tester) async {
    await _pump(tester, const {});
    await tester.tap(find.text('Compétence 1').first);
    await tester.pump();
    expect(find.byType(NumberField), findsNothing);
    expect(find.byType(FormTextField), findsNothing);
  });

  testWidgets('once a domain name is typed, it shows as the collapsed subtitle',
      (tester) async {
    await _pump(tester, const {'s4q02_skill_2_label': 'Comptabilité'});

    // Skill 2 isn't open by default (only the first is), so its typed name
    // should still be legible collapsed.
    expect(find.text('Comptabilité'), findsOneWidget);
  });

  testWidgets('the trailing Total row is not collapsible — always rendered, never editable',
      (tester) async {
    await _pump(tester, const {});
    // Collapsing the only open option leaves zero editable fields — the
    // always-visible Total frame contributes none of its own, confirming
    // it never joined the accordion in the first place.
    await tester.tap(find.text('Compétence 1').first);
    await tester.pump();
    // "Grand total" — the compact Grand Total frame's own label (see
    // MobileCardTable._grandTotalFrame; this file's MaterialApp pins no
    // locale, so it resolves to English) — not the bare column header
    // "Total", which only shows inside an *open* option's card; with
    // every option collapsed, this is the one remaining source of it.
    expect(find.text('Grand total'), findsOneWidget);
    expect(find.byType(NumberField), findsNothing);
  });

  testWidgets('visual: one option open, two collapsed, Total always open',
      (tester) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await _pump(tester, const {'s4q02_skill_2_label': 'Comptabilité'});

    await expectLater(find.byType(MobileCardTable),
        matchesGoldenFile('goldens/mobile_card_table_collapsible_options.png'));
  });

  testWidgets(
      'Tab off an open option\'s last field cascades into the next option, '
      'and off the table only at the true edges',
      (tester) async {
    final fm = _fm();
    var exitTableCalls = 0;
    var exitPreviousCalls = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: MobileCardTable(
            spec: _skillsSpec('s4q02'),
            numberValues: const {},
            textValues: const {},
            onNumberChanged: (_, __) {},
            onTextChanged: (_, __) {},
            focusManager: fm,
            tableId: 's4q02',
            onExitTable: () => exitTableCalls++,
            onExitPrevious: () => exitPreviousCalls++,
          ),
        ),
      ),
    ));

    // Compétence 1 starts open (nothing filled), showing just its label
    // and M (F waiting its own turn — see _CollapsibleLabelRowsState's
    // field-level reveal, one level down from the option-level one).
    fm.focus('s4q02_skill_1_label');
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // label -> male
    expect(fm.activeId, 's4q02_skill_1_male');
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // male -> female
    // _focusField always defers via addPostFrameCallback (female isn't
    // mounted yet at the moment it's called — the setState that reveals
    // it hasn't rebuilt), unlike the label->male hop above, which moved
    // synchronously since male was already on screen.
    await tester.pump();
    expect(fm.activeId, 's4q02_skill_1_female');
    expect(find.byType(NumberField), findsOneWidget); // still just F, M now hidden

    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // female was the last
    // fillable column — reveals M/F/Total together for cross-checking,
    // without moving focus off female yet.
    await tester.pump();
    expect(fm.activeId, 's4q02_skill_1_female');
    expect(find.byType(NumberField), findsNWidgets(2)); // M and F both back

    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // female, now truly
    // the option's last field — collapses option 1, opens option 2.
    await tester.pumpAndSettle();

    expect(find.text('Compétence 1'), findsOneWidget); // collapsed header only
    expect(fm.activeId, 's4q02_skill_2_label');
    expect(exitTableCalls, 0);

    // Repeating from option 2 cascades into option 3 — same 4-Tab shape
    // (label -> M -> F -> reveal-for-review -> exit) each option has.
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // label -> male
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // male -> female
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // female -> reveal for review
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // female -> option 3
    await tester.pumpAndSettle();
    expect(fm.activeId, 's4q02_skill_3_label');

    // Off option 3's last field — no further option to cascade into, so
    // this is what actually leaves the table (previously a dead
    // keystroke: Tab walked the whole table's flat cell list regardless
    // of which option/field was actually mounted, landing on an
    // unmounted field's FocusNode with nothing wired to receive it).
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // label -> male
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // male -> female
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // female -> reveal for review
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // female -> table exit
    await tester.pumpAndSettle();
    expect(exitTableCalls, 1);
    // Still open — nowhere to move to. (2, not 1: the header label plus
    // its own now-empty label field's placeholder hint, both showing the
    // same generic text while expanded.)
    expect(find.text('Compétence 3'), findsNWidgets(2));

    // Shift+Tab off option 3's first field walks back into option 2.
    fm.focus('s4q02_skill_3_label');
    await tester.pump();
    await tester.sendKeyDownEvent(LogicalKeyboardKey.shiftLeft);
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.sendKeyUpEvent(LogicalKeyboardKey.shiftLeft);
    await tester.pumpAndSettle();

    expect(find.text('Compétence 2'), findsNWidgets(2)); // header + its own empty hint
    expect(fm.activeId, 's4q02_skill_2_female');
    expect(exitPreviousCalls, 0);
  });

  testWidgets(
      'S4Q01-shaped table (static row labels, no typed option name) gets the '
      'same collapsible-option cascade',
      (tester) async {
    final fm = _fm();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: MobileCardTable(
            spec: _internshipSpec('s4q01'),
            numberValues: const {},
            textValues: const {},
            onNumberChanged: (_, __) {},
            onTextChanged: (_, __) {},
            focusManager: fm,
            tableId: 's4q01',
          ),
        ),
      ),
    ));

    // First option open by default, generic labels for the rest visible
    // collapsed — same accordion CategoryGridGroupsView/the editable-label
    // variant above use, just with a real static label instead of a typed
    // one. No label field here (static, not editable), so the field-level
    // reveal starts straight on M — same one-field-then-the-next shape as
    // the editable-label case, just without a label field ahead of it.
    expect(find.text('Holiday jobs'), findsOneWidget);
    expect(find.byType(NumberField), findsOneWidget); // just M — F waiting its turn

    fm.focus('s4q01_vacation_male');
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // male -> female
    await tester.pump(); // _focusField defers via addPostFrameCallback
    expect(fm.activeId, 's4q01_vacation_female');
    expect(find.byType(NumberField), findsOneWidget); // still just F, M now hidden

    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // female was the last
    // fillable column — reveals M/F/Total for review, no focus move yet.
    await tester.pump();
    expect(fm.activeId, 's4q01_vacation_female');
    expect(find.byType(NumberField), findsNWidgets(2));

    await tester.sendKeyEvent(LogicalKeyboardKey.tab); // female, now truly
    // the option's last field — collapses option 1, opens option 2.
    await tester.pumpAndSettle();

    expect(fm.activeId, 's4q01_academic_male');
    expect(find.byType(NumberField), findsOneWidget); // option 2's own M only
  });

  testWidgets(
      'S4Q01-shaped rows get a "nothing to report" skip toggle (S3Q02/S4Q02/'
      'S4Q03 rows have no rowKeys and never show one)',
      (tester) async {
    final skipped = <String>{};
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: StatefulBuilder(
            builder: (context, setState) => MobileCardTable(
              spec: _internshipSpec('s4q01'),
              numberValues: const {'s4q01_vacation_male': 3},
              textValues: const {},
              onNumberChanged: (_, __) {},
              onTextChanged: (_, __) {},
              focusManager: _fm(),
              tableId: 's4q01',
              isCategorySkipped: skipped.contains,
              onCategorySkipChanged: (key, value, cellIds) => setState(
                  () => value ? skipped.add(key) : skipped.remove(key)),
            ),
          ),
        ),
      ),
    ));

    // Holiday jobs (vacation) starts open, partially filled (male=3) —
    // toggle visible, off.
    expect(find.byType(MiniSwitch), findsOneWidget);
    await tester.tap(find.byType(MiniSwitch));
    await tester.pump();

    expect(skipped, {'s4q01_vacation'});
    expect(find.text('Nothing to report'), findsWidgets);
    // Toggling on cleared the option's own already-typed value and hid
    // its fields entirely — nothing left to accidentally edit while
    // "nothing to report" is the stated answer.
    expect(find.byType(NumberField), findsNothing);

    // S3Q02/S4Q02/S4Q03 (no rowKeys at all — see TableSpecBuilder) never
    // get this toggle, callbacks wired or not: an empty slot in a free-
    // form "top 3" list doesn't need an explicit skip flag the way a
    // fixed category does.
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: MobileCardTable(
            spec: _skillsSpec('s4q02'),
            numberValues: const {},
            textValues: const {},
            onNumberChanged: (_, __) {},
            onTextChanged: (_, __) {},
            focusManager: _fm(),
            tableId: 's4q02',
            isCategorySkipped: (_) => false,
            onCategorySkipChanged: (_, __, ___) {},
          ),
        ),
      ),
    ));
    expect(find.byType(MiniSwitch), findsNothing);
  });
}
