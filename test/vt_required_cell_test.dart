// VT-UI/UX-03 (mechanism-only pass) — required-field marker + inline error
// state for VtRowEditor's row-detail sheet. No existing VtTableDef marks
// any cell `required: true` (none of the 22 VT AST table fields carry
// `required: true` today — confirmed via grep across sections 4/5/6/8 —
// so there's no business signal yet to derive per-cell requiredness from;
// this ships the mechanism only). Exercised here against a synthetic
// VtTableDef built the same way every real one is (VtTableDef/VtRowDef/
// VtCellDef, the real public API), one cell of each kind.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/i18n/localized_text.dart';
import 'package:dsmo_app/core/focus/renderers/vt_row_editor.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

const _requiredErrorText = 'Ce champ est requis.';

const _testDef = VtTableDef(
  prefix: 'reqtest',
  paperCode: 'X.1',
  title: LocalizedText(fr: 'Table de test', en: 'Test table'),
  progressNoun: LocalizedText(fr: 'lignes', en: 'rows'),
  rows: [
    VtRowDef(id: 'reqtest_row1', fixedLabel: LocalizedText(fr: 'Ligne test', en: 'Test row')),
  ],
  cells: [
    VtCellDef(
        key: 'reqNum',
        label: LocalizedText(fr: 'Nombre requis', en: 'Required number'),
        kind: VtCellKind.number,
        required: true),
    VtCellDef(
        key: 'optNum',
        label: LocalizedText(fr: 'Nombre optionnel', en: 'Optional number'),
        kind: VtCellKind.number),
    VtCellDef(
        key: 'reqText',
        label: LocalizedText(fr: 'Texte requis', en: 'Required text'),
        kind: VtCellKind.text,
        required: true),
    VtCellDef(
        key: 'reqRadio',
        label: LocalizedText(fr: 'Choix requis', en: 'Required choice'),
        kind: VtCellKind.radioCode,
        required: true,
        options: [
          VtOption(value: 'a', code: '1', label: LocalizedText.same('A')),
          VtOption(value: 'b', code: '2', label: LocalizedText.same('B')),
        ]),
    VtCellDef(
        key: 'reqBool',
        label: LocalizedText(fr: 'Oui/Non requis', en: 'Required yes/no'),
        kind: VtCellKind.boolean,
        required: true),
  ],
);

/// Mirrors vt_missing_renderers_test.dart's own _controller() — initialize()
/// must run before any interaction that can schedule the debounced autosave
/// (onGridCellChanged/setRawValue via schedAS), or OnefopFormController.
/// _recalcDirty() force-unwraps a null _schema once that timer elapses
/// under pumpAndSettle. Unlike vt_row_editor_screenshot_test.dart's own
/// (uninitialized) _controller(), this file actually types into a live
/// number field and lets pumpAndSettle elapse the debounce, so it needs
/// this — a real end-user session always has initialize() run first (see
/// OnefopUnifiedFormScreenV4.initState), so this isn't a workaround for a
/// bug real users hit.
Future<OnefopFormController> _controller({Map<String, dynamic> initialData = const {}}) async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: initialData,
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<void> _pumpAndOpenRow(WidgetTester tester, OnefopFormController ctrl, VtTableDef def) async {
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(12),
          child: VtRowEditor(ctrl: ctrl, def: def),
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.tap(find.text('Ligne test'));
  await tester.pumpAndSettle();
}

void main() {
  test('a started VTC row remains a draft until its required-cell policy is defined', () async {
    final ctrl = await _controller(initialData: const {'s4q1_doctorat_male': 1});
    addTearDown(ctrl.dispose);
    final def = vtTableDefFor('vt_diploma_table', const {'prefix': 's4q1'})!;

    expect(vtRowStatus(ctrl, def, def.rows.first), VtRowStatus.draft);
  });

  test('a row with all declared required cells is complete', () async {
    final ctrl = await _controller(initialData: const {
      'reqtest_row1_reqNum': 1,
      'reqtest_row1_reqText': 'Menuiserie',
      'reqtest_row1_reqRadio': 'a',
      'reqtest_row1_reqBool': true,
    });
    addTearDown(ctrl.dispose);

    expect(vtRowStatus(ctrl, _testDef, _testDef.rows.single), VtRowStatus.complete);
  });

  testWidgets('required cells show a red asterisk marker as soon as the sheet opens',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pumpAndOpenRow(tester, ctrl, _testDef);

    // One asterisk per required cell (reqNum, reqText, reqRadio, reqBool)
    // — none on the optional cell.
    expect(find.text('*'), findsNWidgets(4));
    for (final asterisk in find.text('*').evaluate()) {
      expect((asterisk.widget as Text).style?.color, kDanger);
    }
    // No error shown yet — nothing attempted.
    expect(find.text(_requiredErrorText), findsNothing);
  });

  testWidgets('tapping Terminé with required cells empty blocks close and shows one error each',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pumpAndOpenRow(tester, ctrl, _testDef);

    await tester.tap(find.text('Terminé'));
    await tester.pumpAndSettle();

    // Still open — Terminé is still visible.
    expect(find.text('Terminé'), findsOneWidget);
    // One error per required-and-empty cell: reqNum, reqText, reqRadio,
    // reqBool — the optional cell never errors.
    expect(find.text(_requiredErrorText), findsNWidgets(4));
  });

  testWidgets('filling one required cell clears only that cell\'s error on the next attempt',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pumpAndOpenRow(tester, ctrl, _testDef);

    await tester.tap(find.text('Terminé'));
    await tester.pumpAndSettle();
    expect(find.text(_requiredErrorText), findsNWidgets(4));

    await tester.enterText(find.widgetWithText(TextFormField, 'Nombre requis'), '5');
    await tester.pump();
    // Live-clears immediately (isError recomputed from current emptiness
    // on every rebuild, no separate "un-mark" step needed) — no re-tap of
    // Terminé required to see this specific error disappear.
    expect(find.text(_requiredErrorText), findsNWidgets(3));

    await tester.tap(find.text('Terminé'));
    await tester.pumpAndSettle();
    // Still blocked — 3 required cells remain empty — but reqNum's error
    // stays gone.
    expect(find.text('Terminé'), findsOneWidget);
    expect(find.text(_requiredErrorText), findsNWidgets(3));
  });

  testWidgets('Terminé closes the sheet once every required cell is filled', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pumpAndOpenRow(tester, ctrl, _testDef);

    await tester.enterText(find.widgetWithText(TextFormField, 'Nombre requis'), '5');
    await tester.enterText(find.widgetWithText(TextFormField, 'Texte requis'), 'Menuiserie');
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('1 — A').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Oui'));
    await tester.pumpAndSettle();
    // Elapse setRawValue's 3-second debounced autosave (schedAS) while the
    // sheet is still mounted — otherwise it fires after Terminé pops and
    // disposes the sheet below, tripping the test framework's "no pending
    // timers left behind" invariant.
    await tester.pump(const Duration(seconds: 3));

    await tester.tap(find.text('Terminé'));
    await tester.pumpAndSettle();

    // Sheet closed — no more Terminé button, no error text left behind.
    expect(find.text('Terminé'), findsNothing);
    expect(find.text(_requiredErrorText), findsNothing);
  });

  testWidgets('non-required tables: no markers, no errors, Terminé always closes immediately '
      '(mechanism is fully inert for every table shipped today)', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('fr'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          backgroundColor: kCanvas,
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(12),
            child: VtRowEditor(ctrl: ctrl, def: def),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.tap(find.text('Doctorat/PhD'));
    await tester.pumpAndSettle();

    expect(find.text('*'), findsNothing);
    await tester.tap(find.text('Terminé'));
    await tester.pumpAndSettle();
    expect(find.text('Terminé'), findsNothing); // closed immediately, no validation blocked it
    expect(find.text(_requiredErrorText), findsNothing);
  });
}
