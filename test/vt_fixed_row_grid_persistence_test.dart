// Persistence test for VtFixedRowGrid — confirms the widget writes through
// OnefopFormController's real int-or-absent convention (typing 0 persists
// an explicit 0, never touching a cell leaves its key absent — the two
// must stay distinguishable in _data and in what onSave receives) and that
// flushPendingSave() (the dispose-path flush already wired in
// onefop_unified_form_screen_v4.dart) captures edits still sitting on the
// debounce timer. Also documents (not "fixes" — see vt_fixed_row_grid.dart's
// header comment, finding #4 of the approved plan) DraftService.saveDraft's
// pre-existing zero-stripping behavior, which collapses that same
// distinction after a real save/reload cycle.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:dsmo_app/core/focus/renderers/vt_fixed_row_grid.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/services/draft_service.dart';

/// Mirrors vt_required_cell_test.dart's own _controller() — initialize()
/// must run before any interaction that can schedule the debounced
/// autosave (onGridCellChanged -> schedAS), or OnefopFormController.
/// _recalcDirty() force-unwraps a null _schema once that timer elapses
/// under pumpAndSettle.
Future<OnefopFormController> _controller(
  void Function(Map<String, dynamic>) onSave, {
  Map<String, dynamic> initialData = const {},
}) async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: initialData,
    onSave: onSave,
  );
  await ctrl.initialize();
  return ctrl;
}

void main() {
  testWidgets(
      'explicit zero and an untouched cell stay distinguishable in _data '
      'through flushPendingSave', (tester) async {
    final saves = <Map<String, dynamic>>[];
    final ctrl = await _controller(saves.add);
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
            child: VtFixedRowGrid(ctrl: ctrl, def: def),
          ),
        ),
      ),
    );
    await tester.pump();

    final row0 = def.rows[0];
    final row1 = def.rows[1];
    final maleCell = def.cells.firstWhere((c) => c.key == 'male');
    final femaleCell = def.cells.firstWhere((c) => c.key == 'female');
    final row0MaleId = def.cellId(row0, maleCell);
    final row0FemaleId = def.cellId(row0, femaleCell);
    final row1MaleId = def.cellId(row1, maleCell);

    // Row 0: fill both columns normally.
    await tester.enterText(find.byKey(ValueKey(row0MaleId)), '12');
    await tester.pump();
    await tester.enterText(find.byKey(ValueKey(row0FemaleId)), '8');
    await tester.pump();
    // Row 1, male: explicit zero — femaleId on row1 is left untouched.
    await tester.enterText(find.byKey(ValueKey(row1MaleId)), '0');
    await tester.pump();

    // The first onGridCellChanged call fires schedAS's immediate branch
    // (no prior _lastSaveRequest), so onSave has already been called at
    // least once by now with whatever _data held at that instant. The
    // remaining edits landed within the 3s debounce window and are still
    // only in _data, not yet flushed to onSave — flushPendingSave (the
    // real dispose-path call) must capture them without waiting out the
    // timer.
    ctrl.flushPendingSave();

    // _data-level correctness: explicit zero is present, untouched is
    // absent — never conflated.
    final row1FemaleId = def.cellId(row1, femaleCell);
    expect(ctrl.data[row1MaleId], 0);
    expect(ctrl.data.containsKey(row1FemaleId), isFalse);
    expect(ctrl.data[row0MaleId], 12);
    expect(ctrl.data[row0FemaleId], 8);

    // onSave-level correctness: the last captured save (from
    // flushPendingSave, since it always fires after the earlier
    // schedAS-triggered ones) shows the same distinction.
    expect(saves, isNotEmpty);
    final last = saves.last;
    expect(last[row1MaleId], 0);
    expect(last.containsKey(row1FemaleId), isFalse);
    expect(last[row0MaleId], 12);
    expect(last[row0FemaleId], 8);

    // Elapse the stray timers left behind by the earlier onGridCellChanged
    // calls (_doAS's own in-flight delay, _schedRecalc) so none are still
    // pending once the test ends and the controller disposes — same
    // reason vt_required_cell_test.dart pumps 3s before its own last
    // assertion.
    await tester.pump(const Duration(seconds: 3));
  });

  test(
      'DraftService.saveDraft strips explicit zeros (pre-existing, '
      'documented limitation — not fixed by VtFixedRowGrid)', () async {
    SharedPreferences.setMockInitialValues({});
    const untouchedKey = 's4q1_someDiploma_female';
    const zeroKey = 's4q1_someDiploma_male';
    const nonZeroKey = 's4q1_otherDiploma_male';

    // Mirrors exactly what VtFixedRowGrid (and VtRowEditor before it) would
    // hand to onSave: the zero key present and distinguishable from the
    // untouched key, which is simply absent (never in _data to begin with).
    final data = <String, dynamic>{zeroKey: 0, nonZeroKey: 12};

    await DraftService.saveDraft(
        userId: 'test-user', entityType: 'vocational_training', data: data);
    final reloaded =
        await DraftService.loadDraft(userId: 'test-user', entityType: 'vocational_training');

    // Documented limitation (finding #4 of the approved plan): the explicit
    // 0 does not survive the round trip — DraftService.saveDraft strips
    // any int value equal to 0 before persisting, so a real save/reload
    // cycle makes an explicitly-zeroed cell indistinguishable from one
    // nobody ever touched. This assertion exists to keep that behavior
    // visible and intentional, not to endorse it as correct.
    expect(reloaded, isNotNull);
    expect(reloaded!.containsKey(zeroKey), isFalse);
    expect(reloaded.containsKey(untouchedKey), isFalse);
    // A genuinely non-zero value survives normally.
    expect(reloaded[nonZeroKey], 12);
  });
}
