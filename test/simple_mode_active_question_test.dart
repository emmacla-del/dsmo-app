// Coverage for the approved "active question" hierarchy treatment in
// Simple Mode (SimpleModeShell's simpleFieldsBuilder, simple_mode_shell
// .dart) — a thin left accent rail + faint tint on whichever question
// currently holds keyboard focus (ctrl.fm.activeId), and nothing else.
// This file's real purpose is to confirm the treatment is purely additive:
// every field still renders, in the same order, and only ever gets ONE
// field highlighted at a time — question order/content/navigation is
// unaffected by wrapping each field in _ActiveQuestionFrame.
//
// VT2_1/VT2_3/VT2_4 (not VT2_2) are the fields used below — section2's
// own VT2_2 is a conditional follow-up (dependsOn an earlier field) that
// stays hidden on a fresh, empty-data controller like this one, same as
// several other VT2 fields (VT2_5, VT2_7, VT2_8, VT2_15-17, ...) — see
// OnefopFormController.isFieldVisible. VT2_1/VT2_3/VT2_4 are all
// unconditional, confirmed present in the rendered field list.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/providers/onefop_mode_provider.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/simple_mode_shell.dart';

Future<OnefopFormController> _pumpSimpleMode(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1920, 1080);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  addTearDown(ctrl.dispose);
  final idx =
      ctrl.schema!.sections.indexWhere((s) => s.id == 'section2_vocationalTraining');
  ctrl.goto(idx, focus: false, scroll: false);

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        body: ListenableBuilder(
          listenable: ctrl,
          builder: (context, _) => SimpleModeShell(
            ctrl: ctrl,
            entityType: EntityType.vocationalTraining,
            // Each field renders as a plain, uniquely-keyed marker so this
            // test can assert on count/order/position without needing the
            // real RadioField/SelectField/... widgets at all.
            buildField: (FieldSchema f) => Text(f.id, key: ValueKey('marker_${f.id}')),
            onPreviewSubmit: () async {},
            title: 'ONEFOP',
            dirty: false,
            saving: false,
            mode: OnefopViewMode.simple,
            onModeChanged: (_) {},
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 3));
  await tester.pump(const Duration(milliseconds: 700));
  return ctrl;
}

/// The nearest ancestor Container of a field marker with a left accent
/// border — present only when _ActiveQuestionFrame actually wrapped it.
bool _hasActiveFrame(WidgetTester tester, String fieldId) {
  final containers = tester.widgetList<Container>(
    find.ancestor(
      of: find.byKey(ValueKey('marker_$fieldId')),
      matching: find.byType(Container),
    ),
  );
  for (final c in containers) {
    final deco = c.decoration;
    if (deco is BoxDecoration && deco.border is Border) {
      final left = (deco.border as Border).left;
      if (left.width == 3 && left.color == kAccent) return true;
    }
  }
  return false;
}

void main() {
  testWidgets(
      'on mount, only the pre-existing auto-focused first field (VT2_1) '
      'carries the active-question frame — every other field renders '
      'plain, matching OnefopFormController\'s own pre-existing "focus '
      'the first field on load" behavior (unrelated to this change)',
      (tester) async {
    await _pumpSimpleMode(tester);

    for (final id in ['VT2_1', 'VT2_3', 'VT2_4']) {
      expect(find.byKey(ValueKey('marker_$id')), findsOneWidget);
    }
    expect(_hasActiveFrame(tester, 'VT2_1'), isTrue);
    expect(_hasActiveFrame(tester, 'VT2_3'), isFalse);
    expect(_hasActiveFrame(tester, 'VT2_4'), isFalse);
  });

  testWidgets(
      'focusing a different field frames only that field — order and '
      'presence of every other field is unchanged', (tester) async {
    final ctrl = await _pumpSimpleMode(tester);

    ctrl.fm.focus('VT2_3');
    await tester.pump();

    expect(_hasActiveFrame(tester, 'VT2_1'), isFalse);
    expect(_hasActiveFrame(tester, 'VT2_3'), isTrue);
    expect(_hasActiveFrame(tester, 'VT2_4'), isFalse);

    // Order preserved: VT2_1 sits above VT2_3 sits above VT2_4.
    final y1 = tester.getTopLeft(find.byKey(const ValueKey('marker_VT2_1'))).dy;
    final y3 = tester.getTopLeft(find.byKey(const ValueKey('marker_VT2_3'))).dy;
    final y4 = tester.getTopLeft(find.byKey(const ValueKey('marker_VT2_4'))).dy;
    expect(y1, lessThan(y3));
    expect(y3, lessThan(y4));
  });

  testWidgets('moving focus again moves the frame with it', (tester) async {
    final ctrl = await _pumpSimpleMode(tester);

    ctrl.fm.focus('VT2_3');
    await tester.pump();
    expect(_hasActiveFrame(tester, 'VT2_3'), isTrue);
    expect(_hasActiveFrame(tester, 'VT2_4'), isFalse);

    ctrl.fm.focus('VT2_4');
    await tester.pump();
    expect(_hasActiveFrame(tester, 'VT2_3'), isFalse);
    expect(_hasActiveFrame(tester, 'VT2_4'), isTrue);
  });
}
