// Throwaway visual-audit tool for the VT row-editor milestone (4.1, 4.2,
// 4.3, 8.8 roster) — renders the real VtRowEditor widget, bound to a real
// OnefopFormController (same class the live form uses, same
// onGridCellChanged/hybridController/setRawValue wiring), directly rather
// than through the full OnefopUnifiedFormScreenV4 navigation stack — that
// stack's own multi-section "Suivant" walk has pre-existing settle-timing
// behavior unrelated to this widget that made it an unreliable way to
// reach Section 4/8 in a single continuous test run. This still exercises
// the actual widget tree and the actual controller read/write path this
// milestone needs verified; it just skips unrelated navigation chrome.
// Not a real regression test; safe to delete.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_row_editor.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
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
  Size size = const Size(390, 844),
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
            child: VtRowEditor(ctrl: ctrl, def: def),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  tester.takeException();

  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
}

void main() {
  testWidgets('VT mobile — 4.1 diploma table, empty', (tester) async {
    final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
    await _capture(tester, 'vt_mobile_4_1_diploma_empty', def);
  });

  testWidgets('VT mobile — 4.1 diploma table, two rows filled', (tester) async {
    final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
    await _capture(tester, 'vt_mobile_4_1_diploma_filled', def, initialData: const {
      's4q1_licence_male': 12,
      's4q1_licence_female': 8,
      's4q1_cep_male': 3,
    });
  });

  testWidgets('VT mobile — 4.2 diploma table (professional)', (tester) async {
    final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q2'})!;
    await _capture(tester, 'vt_mobile_4_2_diploma', def);
  });

  testWidgets('VT mobile — 4.3 specialty table', (tester) async {
    final def = vtTableDefFor('vt_specialty_fi_fc_table', {'prefix': 's4q3'})!;
    await _capture(tester, 'vt_mobile_4_3_specialty', def, initialData: const {
      's4q3_row1_specialtyText': 'Coiffure',
      's4q3_row1_fiMale': 5,
      's4q3_row1_fiFemale': 8,
    });
  });

  testWidgets('VT mobile — 8.8 roster, empty (only first slot visible)', (tester) async {
    await _capture(tester, 'vt_mobile_8_8_roster_empty', vtTrainerRosterTableDef);
  });

  testWidgets('VT mobile — 8.8 roster, two named rows (reveals a third blank slot)',
      (tester) async {
    await _capture(tester, 'vt_mobile_8_8_roster_filled', vtTrainerRosterTableDef,
        initialData: const {
          's8q8_row1_lastName': 'Nkoa',
          's8q8_row1_firstName': 'Paul',
          's8q8_row1_sex': '1',
          's8q8_row1_trainerStatus': '3',
          's8q8_row2_lastName': 'Ateba',
        });
  });

  // The actual "tap a row, edit in a bottom sheet" interaction — the core
  // UX ask — captured mid-interaction, sheet open, on 4.1's first row.
  testWidgets('VT mobile — 4.1 row tapped, bottom sheet open', (tester) async {
    const size = Size(390, 844);
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final ctrl = _controller();
    addTearDown(ctrl.dispose);
    final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;

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
              child: VtRowEditor(ctrl: ctrl, def: def),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    // First row tile — "Doctorat/PhD".
    await tester.tap(find.text('Doctorat/PhD'));
    await tester.pumpAndSettle();

    await expectLater(
        find.byType(MaterialApp), matchesGoldenFile('goldens/vt_mobile_4_1_row_sheet_open.png'));
  });

  // ── Batch 2 additions ──────────────────────────────────────────
  // 8.1/8.2 (trainer diploma tables) reuse vtDiplomaTableDef verbatim —
  // one confirmation shot, not the full empty+filled+sheet set 4.1
  // already covered for the identical widget shape.
  testWidgets('VT mobile — 8.1 diploma table (trainer, academic)', (tester) async {
    final def = vtTableDefFor('vt_diploma_table', {'prefix': 's8q1'})!;
    await _capture(tester, 'vt_mobile_8_1_diploma', def);
  });

  // 4.4/4.5/8.4 reuse vtSpecialtyFiFcTableDef verbatim (same shape 4.3
  // already covered) — one confirmation shot for the 10-row (8.4) variant,
  // since its row count differs from 4.3/4.4/4.5's 12.
  testWidgets('VT mobile — 8.4 specialty table (trainers, 10 rows)', (tester) async {
    final def = vtTableDefFor('vt_specialty_fi_fc_table', {'prefix': 's8q4'})!;
    await _capture(tester, 'vt_mobile_8_4_specialty', def, initialData: const {
      's8q4_row1_specialtyText': 'Menuiserie',
      's8q4_row1_fiMale': 2,
    });
  });

  // 4.6 — new shape this batch: year1/year2 x gender, no FI/FC split.
  testWidgets('VT mobile — 4.6 specialty x year-of-study table', (tester) async {
    final def = vtTableDefFor('vt_specialty_year_table', {'prefix': 's4q6'})!;
    await _capture(tester, 'vt_mobile_4_6_specialty_year', def, initialData: const {
      's4q6_row1_specialtyText': 'Couture',
      's4q6_row1_year1Male': 4,
      's4q6_row1_year1Female': 6,
    });
  });

  // 4.10 — new shape this batch: male/female + a computed read-only Total
  // column. Captured with the row sheet open so the live-computed Total
  // (male + female, never user-entered) is actually visible in the shot.
  testWidgets('VT mobile — 4.10 specialty table, row sheet open (computed Total)',
      (tester) async {
    const size = Size(390, 844);
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final ctrl = _controller(initialData: const {
      's4q10_row1_specialtyText': 'Plomberie',
      's4q10_row1_male': 7,
      's4q10_row1_female': 3,
    });
    addTearDown(ctrl.dispose);
    final def = vtTableDefFor('vt_specialty_gender_total_table', {'prefix': 's4q10'})!;

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
              child: VtRowEditor(ctrl: ctrl, def: def),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('Plomberie'));
    await tester.pumpAndSettle();

    await expectLater(find.byType(MaterialApp),
        matchesGoldenFile('goldens/vt_mobile_4_10_row_sheet_open.png'));
  });

  // 8.7 — new shape this batch: FI/FC headcount, no gender split at all.
  testWidgets('VT mobile — 8.7 hosting-capacity table', (tester) async {
    final def = vtTableDefFor('vt_specialty_fi_fc_count_table', {'prefix': 's8q7'})!;
    await _capture(tester, 'vt_mobile_8_7_hosting_capacity', def, initialData: const {
      's8q7_row1_specialtyText': 'Électricité',
      's8q7_row1_fiCount': 20,
    });
  });

  // 5.2 — Ticket C's progressiveRows: worst-case table before this fix (15
  // always-visible empty rows); now just the trailing blank slot.
  testWidgets('VT mobile — 5.2 curriculum table, empty (progressiveRows)', (tester) async {
    final def = vtTableDefFor('vt_curriculum_table', {'prefix': 's5q2'})!;
    await _capture(tester, 'vt_mobile_5_2_curriculum_empty', def);
  });

  // 7.1.3 — the five-stakeholder Oui/Non consolidation. Empty first...
  testWidgets('VT mobile — 7.1.3 comms-informed table, empty', (tester) async {
    await _capture(tester, 'vt_mobile_7_1_3_comms_empty', vt713CommsInformedTableDef);
  });

  // ...then with the row sheet open on "Élèves", toggling Oui, to confirm
  // the boolean encode/decode round-trip (String[] sentinel, not a raw
  // bool) actually reflects back into the toggle after the tap.
  testWidgets('VT mobile — 7.1.3 row tapped, Oui toggled', (tester) async {
    const size = Size(390, 844);
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final ctrl = _controller();
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
              child: VtRowEditor(ctrl: ctrl, def: vt713CommsInformedTableDef),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('Élèves'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Oui'));
    await tester.pumpAndSettle();

    expect(ctrl.data['VT7_7'], const ['informed']);

    await expectLater(find.byType(MaterialApp),
        matchesGoldenFile('goldens/vt_mobile_7_1_3_row_sheet_open.png'));
  });

  // Roster row's sheet — the richest cell mix in this milestone (text,
  // two radio-code pickers, a boolean toggle, two more radio-code
  // pickers) — the one most worth reviewing before the next milestone.
  testWidgets('VT mobile — 8.8 roster row 1 tapped, bottom sheet open', (tester) async {
    const size = Size(390, 844);
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final ctrl = _controller();
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
              child: VtRowEditor(ctrl: ctrl, def: vtTrainerRosterTableDef),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('Ligne 1'));
    await tester.pumpAndSettle();

    await expectLater(find.byType(MaterialApp),
        matchesGoldenFile('goldens/vt_mobile_8_8_row_sheet_open.png'));
  });
}
