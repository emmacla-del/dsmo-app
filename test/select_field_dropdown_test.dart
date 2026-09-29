// Coverage for the new custom SelectField (onefop_form_widgets.dart) —
// approved replacement for the previous stock DropdownButtonFormField,
// built on the same flat MenuAnchor pattern already proven for the
// desktop Excel shell's checkbox dropdown (_ExcelCheckboxDropdown,
// onefop_excel_field_rows.dart). Options/values/labels are read straight
// from field.optionsI18n — no second copy of questionnaire content lives
// in the widget.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_widgets.dart' show SelectField;

Future<OnefopFormController> _controller() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.enterprise,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  final idx = ctrl.schema!.sections.indexWhere((s) => s.id == 'section1_entreprise');
  ctrl.goto(idx, focus: false, scroll: false);
  return ctrl;
}

FieldSchema _s1q01(OnefopFormController ctrl) => ctrl.schema!.getField('S1Q01')!;

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
          builder: (_, __) => SelectField(ctrl: ctrl, field: _s1q01(ctrl)),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('closed/idle: shows the placeholder when nothing is selected',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pump(tester, ctrl);

    final l10n = AppLocalizations.of(tester.element(find.byType(SelectField)));
    expect(find.text(l10n.selectPlaceholder), findsOneWidget);
    expect(find.byType(MenuAnchor), findsOneWidget);
  });

  testWidgets('tapping the closed control opens the popup with every real option',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pump(tester, ctrl);

    await tester.tap(find.byType(SelectField));
    await tester.pumpAndSettle();

    for (final label in ['Société unipersonnelle', 'SARL', 'SA', 'Autres']) {
      expect(find.text(label), findsOneWidget);
    }
  });

  testWidgets('selecting an option writes ctrl.data, closes the popup, and '
      'the closed control now shows that option\'s label', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pump(tester, ctrl);

    await tester.tap(find.byType(SelectField));
    await tester.pumpAndSettle();
    await tester.tap(find.text('SARL'));
    await tester.pumpAndSettle();

    expect(ctrl.data['S1Q01'], 'SARL/ LLC');
    expect(find.byType(MenuItemButton), findsNothing, reason: 'popup closed on pick');
    expect(find.text('SARL'), findsOneWidget);
    await tester.pump(const Duration(seconds: 4)); // flush debounced revalidation
  });

  testWidgets('the already-selected option is visually marked with a checkmark '
      'when the popup reopens', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    ctrl.onSelectChanged(_s1q01(ctrl), 'SA/ PLC');
    await _pump(tester, ctrl);

    await tester.tap(find.byType(SelectField));
    await tester.pumpAndSettle();

    final saItem = tester.widget<MenuItemButton>(find.ancestor(
      of: find.text('SA'),
      matching: find.byType(MenuItemButton),
    ));
    expect(saItem.trailingIcon, isNotNull);
  });

  testWidgets('keyboard: ArrowDown opens the closed control, Escape closes it',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pump(tester, ctrl);

    ctrl.fm.focus('S1Q01');
    await tester.pump();
    expect(find.byType(MenuItemButton), findsNothing);

    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pumpAndSettle();
    expect(find.byType(MenuItemButton), findsWidgets);

    await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    await tester.pumpAndSettle();
    expect(find.byType(MenuItemButton), findsNothing);
  });

  testWidgets('disabled: tapping does nothing — no popup, no value change',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('fr'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          backgroundColor: kCanvas,
          body: ListenableBuilder(
            listenable: ctrl,
            builder: (_, __) =>
                SelectField(ctrl: ctrl, field: _s1q01(ctrl), enabled: false),
          ),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.byType(SelectField));
    await tester.pumpAndSettle();

    expect(find.byType(MenuItemButton), findsNothing);
    expect(ctrl.data['S1Q01'], isNull);
  });
}
