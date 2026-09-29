// Coverage for the approved segmented progress rail (onefop_form_widgets
// .dart's Sidebar) replacing the previous LinearProgressIndicator. Same
// underlying done/total numbers as before — _progressHeader()'s own text
// ("$done/$total", "$pct%") is untouched and still the source of truth
// this test checks the rail against, confirming the calculation itself
// was not changed, only how it's drawn.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_widgets.dart' show Sidebar;

Future<OnefopFormController> _controller() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  ctrl.setSidebarMode(2); // full-width — the progress block only renders here
  return ctrl;
}

Future<void> _pump(WidgetTester tester, OnefopFormController ctrl) async {
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        body: ListenableBuilder(
          listenable: ctrl,
          builder: (_, __) => Sidebar(ctrl: ctrl, entityType: EntityType.vocationalTraining),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('no stock LinearProgressIndicator remains in the sidebar',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pump(tester, ctrl);

    expect(find.byType(LinearProgressIndicator), findsNothing);
  });

  testWidgets('the rail draws exactly one segment per section, matching the '
      'same done/total numbers the header text already shows', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pump(tester, ctrl);

    final total = ctrl.schema!.sections.length;
    final done = ctrl.valid.values.where((v) => v).length;
    expect(find.text('$done/$total'), findsOneWidget);
    expect(find.text('${(done / total.clamp(1, 999) * 100).round()}%'), findsOneWidget);

    // One rail Container per section — Sidebar's own section list items
    // also render Containers, so scope to the rail's own Semantics wrapper
    // rather than counting every Container on the page.
    final rail = find.bySemanticsLabel('Progression');
    expect(rail, findsOneWidget);
    final containers = find.descendant(of: rail, matching: find.byType(Container));
    expect(tester.widgetList(containers).length, total);
  });
}
