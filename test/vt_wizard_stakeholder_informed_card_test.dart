// Coverage for VtWizardStakeholderInformedCard (screens/onefop/wizard/
// vt_wizard_table_guided_entry.dart) — the §7.1.3 stakeholder-informed
// toggle card built to match Figma's new block on node 11:2206 ("Thèmes
// Transversaux"), and its wiring into Section 7's field rows
// (vt_wizard_section_screen.dart's _vtWizardFieldRows: VT7_7 renders the
// card, VT7_8-11 fold into it and render nothing of their own). Verifies:
// the card renders all 5 stakeholder rows with no layout exception,
// tapping a toggle round-trips the encoded ['informed']/['not_informed']
// value onto VT7_7's own flat key (matching what VtRowEditor already
// writes for Simple/Spreadsheet Mode), and the section screen shows
// exactly one card for the whole group.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_wizard_section_screen.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_wizard_table_guided_entry.dart';

Future<OnefopFormController> _controller() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<void> _pump(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(1920, 1400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: SingleChildScrollView(child: child)),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('renders all 5 stakeholder rows with no layout exception', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pump(
      tester,
      VtWizardStakeholderInformedCard(ctrl: ctrl, def: vt713CommsInformedTableDef),
    );
    expect(tester.takeException(), isNull);
    expect(find.text('Élèves'), findsOneWidget);
    expect(find.text('Personnel Enseignant'), findsOneWidget);
    expect(find.text('Personnel Non Enseignant'), findsOneWidget);
    expect(find.text('Parents/Tuteurs'), findsOneWidget);
    expect(find.text("Conseil d'établissement"), findsOneWidget);
  });

  testWidgets('tapping a row toggle round-trips the encoded value onto the real flat key',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pump(
      tester,
      VtWizardStakeholderInformedCard(ctrl: ctrl, def: vt713CommsInformedTableDef),
    );

    expect(ctrl.data['VT7_7'], isNull);
    await tester.tap(find.text('Oui').first);
    await tester.pumpAndSettle();
    expect(ctrl.data['VT7_7'], const ['informed']);

    await tester.tap(find.text('Non').first);
    await tester.pumpAndSettle();
    expect(ctrl.data['VT7_7'], const ['not_informed']);

    await tester.pump(const Duration(seconds: 4));
  });

  testWidgets('Section 7 renders exactly one card for the VT7_7-11 group', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final section = ctrl.schema!.getSection('section7_vocationalTraining')!;

    await _pump(
      tester,
      VtWizardSectionScreen(
        ctrl: ctrl,
        section: section,
        buildField: (f) => const SizedBox.shrink(),
        onBack: () {},
        onNext: () {},
        isFirst: false,
      ),
    );

    expect(find.byType(VtWizardStakeholderInformedCard), findsOneWidget);
    expect(find.text('Élèves'), findsOneWidget);
  });
}
