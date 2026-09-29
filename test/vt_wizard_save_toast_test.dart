// Coverage for VtWizardShell's "just saved" confirmation
// (_VtWizardSaveToast) — additive to OnefopShellTitleBar's own persistent
// save-status chip, which stays untouched (that title bar is reused
// as-is across all three modes by established convention). This toast is
// a momentary confirmation for the specific instant a save completes:
// fires when `saving` flips true -> false, shows ~2.2s, then fades.
// Verifies: hidden initially, appears on the true->false transition,
// and fades back out after its timeout.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/providers/onefop_mode_provider.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_wizard_shell.dart';

Future<OnefopFormController> _controller() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Widget _shell(OnefopFormController ctrl, {required bool saving}) {
  return MaterialApp(
    locale: const Locale('fr'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(
      body: VtWizardShell(
        ctrl: ctrl,
        entityType: EntityType.vocationalTraining,
        buildField: (FieldSchema f) => const SizedBox.shrink(),
        onPreviewSubmit: () async {},
        title: 'Test',
        dirty: false,
        saving: saving,
        mode: OnefopViewMode.wizard,
        onModeChanged: (_) {},
      ),
    ),
  );
}

// _VtWizardSaveToast's own AnimatedOpacity (250ms, vt_wizard_shell.dart) is
// not the only one in the tree — real TextField/InputDecorator chrome
// elsewhere in the shell fades its hint text via its own AnimatedOpacity
// (Flutter's _kHintFadeTransitionDuration, 20ms), so find.byType(...).first
// isn't reliable. The 250ms duration is unique to the toast.
final _toastOpacity = find.byWidgetPredicate((w) =>
    w is AnimatedOpacity && w.duration == const Duration(milliseconds: 250));

void main() {
  testWidgets('desktop task rail contains the active section outline',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    tester.view.physicalSize = const Size(1920, 1080);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_shell(ctrl, saving: false));
    await tester.pump(); // receive the section screen's outline model
    // Mounting section 1 autofocuses its first field, which schedules the
    // controller's own debounce Timers (see the next test's comment) —
    // flush them within the test's fake-time zone before teardown.
    await tester.pump(const Duration(milliseconds: 700));

    expect(find.text('PLAN DE LA SECTION'), findsOneWidget);
  });

  testWidgets('toast is hidden before any save completes', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    tester.view.physicalSize = const Size(1920, 1080);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_shell(ctrl, saving: false));
    await tester.pumpAndSettle();
    // Mounting section 1 autofocuses its first field, which schedules the
    // controller's own debounce/autosave Timers (see
    // vt_wizard_keyboard_navigation_test.dart's header comment) —
    // pumpAndSettle does not wait those out, so flush them within the
    // test's fake-time zone before the widget tree is torn down.
    await tester.pump(const Duration(milliseconds: 700));

    final opacity = tester.widget<AnimatedOpacity>(_toastOpacity);
    expect(opacity.opacity, 0);
  });

  testWidgets(
      'toast fades in on saving true -> false, then fades out after its timeout',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    tester.view.physicalSize = const Size(1920, 1080);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_shell(ctrl, saving: true));
    await tester.pumpAndSettle();

    // Flip saving true -> false, as the parent does once a real save completes.
    await tester.pumpWidget(_shell(ctrl, saving: false));
    await tester.pump(); // let didUpdateWidget's setState land
    await tester.pump(const Duration(milliseconds: 260)); // fade-in duration

    expect(find.text('Enregistré à l\'instant'), findsOneWidget);

    // Still visible well before the ~2.2s hide timer.
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Enregistré à l\'instant'), findsOneWidget);

    // Past the hide timer + fade-out duration.
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 260));
    final opacity = tester.widget<AnimatedOpacity>(_toastOpacity);
    expect(opacity.opacity, 0);
  });
}
