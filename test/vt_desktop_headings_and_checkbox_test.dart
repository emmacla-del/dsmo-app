// Regression coverage for two live bug reports on the desktop Excel shell
// (ExcelSectionBody, onefop_excel_field_rows.dart):
//
// 1. "Section and subsection headings still don't appear" — ExcelSectionBody
//    never rendered OnefopSectionMap at all (the mobile stepper always has;
//    see onefop_unified_form_screen_v4.dart's own OnefopSectionMap call),
//    so a subsection's own label (e.g. "2.1 DEMANDE D'EMPLOIS") and its
//    ✓/●/○ question-chip line never showed up on desktop, only on mobile.
//
// 2. "Some dropdowns don't appear like in the difficulty section" —
//    ExcelValueCell only special-cased 'select'/'radio'; every other field
//    type, checkbox (multi-select) included, fell through to
//    _ExcelTextInput: a bare TextField seeded from a List's raw
//    `.toString()`, with no way to actually select/deselect an option and
//    no way to write a real String[] back. VT9_1 ("Rencontre des
//    difficultés ?") -> VT9_2 ("Type(s) de difficultés", checkbox) is the
//    concrete case reported; any other checkbox-typed field reachable from
//    this shell (VT6_5, VT6_8, ...) had the exact same gap.
//
// VT9_2 (6 options), VT6_5 (5), and VT3_2 (10) all now render as the
// closed MenuAnchor dropdown (3+ options — see ExcelValueCell.build()'s
// dispatch comment for why), not the original inline checklist these
// tests were first written against — so each opens its own dropdown via
// _dropdownFor before reaching the individually toggleable option rows.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/excel/onefop_excel_field_rows.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_section_units.dart';

// Locates the closed dropdown control for a specific 3+-option checkbox
// field by its FocusNode (ctrl.fm.getNode is memoized per field id, so
// this is exact) rather than find.byType(InkWell), which would be
// ambiguous whenever a section renders more than one such field at once.
Finder _dropdownFor(OnefopFormController ctrl, String fieldId) {
  final focusFinder = find.byWidgetPredicate(
    (w) => w is Focus && w.focusNode == ctrl.fm.getNode(fieldId),
  );
  return find.descendant(of: focusFinder, matching: find.byType(InkWell));
}

// A dropdown's own closed-control summary can end up showing the exact
// same text as one of its still-open menu items (e.g. exactly one option
// remains selected after a deselect) — find.text(label) alone is then
// ambiguous. Scoping to a MenuItemButton ancestor always means "the menu
// row", never the closed control.
Finder _menuOption(String label) =>
    find.descendant(of: find.byType(MenuItemButton), matching: find.text(label));

// _SimpleFieldsTable renders every field's own row label via a raw
// RichText (see its _labelSpan), not a Text widget — flutter_test's
// find.text() only matches Text/EditableText, never RichText directly, so
// it always reports a field label as absent regardless of whether the row
// actually rendered. This is the RichText-aware equivalent, used for
// field-label assertions below; find.text(...) remains correct for every
// other assertion in this file (option labels are plain Text widgets, as
// is OnefopSectionMap's subsection heading).
// _SimpleFieldsTable's label RichText can also carry a trailing " *" for
// a required field (see _labelSpan) — checking by containment rather
// than exact match keeps these assertions correct either way.
bool _labelContains(WidgetTester tester, String text) => tester
    .widgetList<RichText>(find.byType(RichText))
    .any((rt) => rt.text.toPlainText().contains(text));

Future<OnefopFormController> _pumpDesktopSection(
  WidgetTester tester,
  EntityType entityType,
  String sectionId,
) async {
  tester.view.physicalSize = const Size(1920, 1080);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final ctrl = OnefopFormController(
    entityType: entityType,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  addTearDown(ctrl.dispose);
  final section = ctrl.schema!.sections.firstWhere((s) => s.id == sectionId);

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        // Mirrors how the real screen wires the shell to the controller
        // (onefop_unified_form_screen_v4.dart's _onControllerChange ->
        // setState) — ExcelSectionBody is a plain StatelessWidget with no
        // listener of its own, so without this a setRadioValue/setRawValue
        // call updates ctrl but never triggers a rebuild here.
        body: ListenableBuilder(
          listenable: ctrl,
          builder: (context, _) => ExcelSectionBody(
            ctrl: ctrl,
            section: section,
            entityType: entityType,
            onPreviewSubmit: () async {},
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  // Mounting can itself schedule the same debounce timers a mutation
  // does (e.g. an initial focus/selection pass through EditableText) —
  // flush them now so every test built on this helper starts clean,
  // same pending-timer pattern this session's other VT tests already
  // guard against.
  await tester.pump(const Duration(seconds: 3));
  await tester.pump(const Duration(milliseconds: 700));
  return ctrl;
}

void main() {
  group('Section/subsection headings on the desktop Excel shell', () {
    testWidgets(
        'section2 (enterprise): "2.1 DEMANDE D\'EMPLOIS" subsection heading '
        'and the ✓/●/○ question-chip line both render', (tester) async {
      await _pumpDesktopSection(tester, EntityType.enterprise, 'section2');

      // OnefopSectionMap is a whole-section outline, not a per-unit label —
      // every subsection run in the section gets its own heading + chip
      // line (see its own doc comment: "a dense document outline, not a
      // stepper"), same as it already does on mobile.
      expect(find.text("2.1 DEMANDE D'EMPLOIS"), findsOneWidget);
      expect(find.text('2.2 RECRUTEMENTS'), findsOneWidget);
      expect(find.textContaining(RegExp(r'[✓●○]')), findsWidgets);
    });

    testWidgets('section0 (single-unit section): no heading/chip clutter, '
        'OnefopSectionMap stays self-hidden exactly like on mobile',
        (tester) async {
      await _pumpDesktopSection(tester, EntityType.enterprise, 'section0');
      expect(find.textContaining(RegExp(r'[✓●○]')), findsNothing);
    });

    testWidgets(
        'section5 (VT): ExcelSectionBody shows the active subsection\'s '
        'own full heading (code + complete description) right above the '
        'table — not OnefopSectionMap\'s chip row, and no separate bare-'
        'code breadcrumb duplicating it. The same full text also appears '
        'in the Sidebar\'s subsection tree (vt_sidebar_subsection_tree_test '
        '.dart) — a local workspace heading and the persistent nav map are '
        'deliberately allowed to both show it', (tester) async {
      await _pumpDesktopSection(
          tester, EntityType.vocationalTraining, 'section5_vocationalTraining');

      expect(find.byType(OnefopSectionMap), findsNothing);
      expect(find.text('→ 5.1'), findsNothing);
      expect(
        find.text("5.1 Manuels d'apprentissage pour l'année en cours"),
        findsOneWidget,
      );
    });
  });

  group('Checkbox (multi-select) fields on the desktop Excel shell', () {
    testWidgets(
        'VT9_2 ("Type(s) de difficultés") is hidden until VT9_1 = Oui, then '
        'renders a real checklist — not a blank/garbled text field',
        (tester) async {
      final ctrl =
          await _pumpDesktopSection(tester, EntityType.vocationalTraining, 'section9_vocationalTraining');

      // VT9_1 has no dependsOn — always visible, a sanity check that the
      // section's first unit actually rendered before touching it. VT9_4
      // ("Citer les 5 principales perspectives") now lives in its own,
      // later unit (see the "9.2 Cinq principales perspectives" test
      // below) — it was only in this same first unit before subsection
      // metadata split 9.1 (VT9_1-3) from 9.2 (VT9_4) into two units,
      // matching how the printed form actually groups them.
      expect(_labelContains(tester, 'Rencontrez-vous des difficultés'), isTrue);
      expect(_labelContains(tester, 'Lesquelles ? (Cochez svp)'), isFalse);

      // Real navigation (navigateToSection, onefop_section_units.dart:504)
      // pins an explicit unit cursor the moment a section is entered, so
      // the displayed unit stays put from then on — it does NOT
      // live-recompute currentUnitIndex() on every rebuild. Pumping
      // ExcelSectionBody directly here (no navigation controller in the
      // loop) skips that pinning step; without it, answering VT9_1 below
      // marks this unit "done" (hasData) and currentUnitIndex()'s live
      // fallback would jump straight to VT9_4's own later unit before
      // VT9_2 is ever reached — a test-harness gap, not a real one.
      ctrl.setUnitCursor('section9_vocationalTraining', 0);

      final vt91 = ctrl.schema!.getField('VT9_1')!;
      ctrl.setRadioValue(vt91, 'Oui/ Yes');
      await tester.pump();

      expect(_labelContains(tester, 'Lesquelles ? (Cochez svp)'), isTrue);
      // 6 fixed options (PDF-confirmed, p.18), 3+ so this is the closed
      // dropdown now — open it to reach the individually toggleable
      // checkbox rows, not one collapsed TextField.
      final dropdown = _dropdownFor(ctrl, 'VT9_2');
      expect(dropdown, findsOneWidget);
      await tester.tap(dropdown);
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.check_box_outline_blank_rounded), findsNWidgets(6));
      expect(_menuOption('Coût de la formation'), findsOneWidget);

      await tester.tap(_menuOption('Coût de la formation'));
      await tester.pumpAndSettle();

      // Written back as a real List<String> (the shape the backend
      // normalizer/DTO expect for every checkbox column) — not a raw
      // stringified list from a TextEditingController.
      expect(ctrl.data['VT9_2'], ['Coût de la formation/ Training cost']);
      expect(find.byIcon(Icons.check_box_rounded), findsOneWidget);
      expect(find.byIcon(Icons.check_box_outline_blank_rounded), findsNWidgets(5));

      // Toggling a second option preserves the first (add, not replace).
      await tester.tap(_menuOption('Insécurité'));
      await tester.pumpAndSettle();
      expect(
        ctrl.data['VT9_2'],
        ['Coût de la formation/ Training cost', 'Insécurité/ Insecurity'],
      );

      // Deselecting the only selected option clears the field entirely
      // (empty selection -> setCheckboxValues(field, null)), matching
      // CheckboxGroupField's own convention — not left behind as `[]`.
      // (_menuOption, not find.text, from here on: once only one option
      // remains selected the closed control's own summary text becomes
      // identical to that option's menu-row label.)
      await tester.tap(_menuOption('Coût de la formation'));
      await tester.pumpAndSettle();
      await tester.tap(_menuOption('Insécurité'));
      await tester.pumpAndSettle();
      expect(ctrl.data.containsKey('VT9_2'), isFalse);

      // Flush setRawValue's debounced autosave timer before the widget
      // tree is disposed (same pending-timer pattern as every other VT
      // test this session that mutates the controller).
      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(milliseconds: 700));
    });

    testWidgets(
        'VT9_4 (textarea, its own "9.2 Cinq principales perspectives" '
        'subsection) is unaffected — still a plain text field',
        (tester) async {
      final ctrl = OnefopFormController(
        entityType: EntityType.vocationalTraining,
        initialData: const {},
        onSave: (_) async {},
      );
      await ctrl.initialize();
      addTearDown(ctrl.dispose);
      final section =
          ctrl.schema!.sections.firstWhere((s) => s.id == 'section9_vocationalTraining');
      // VT9_4 now lands on its own unit, separate from VT9_1-3's "9.1"
      // group — see the subsection metadata added to it — so it's no
      // longer the section's default first-shown unit; resolve the real
      // index rather than assuming it.
      final units = buildTableGroupUnits(
        ctrl,
        section,
        const Locale('fr'),
        entityType: EntityType.vocationalTraining,
        simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
        mobile: false,
      );
      final unitIdx = units.indexWhere((u) => u.fieldIds.contains('VT9_4'));
      expect(unitIdx, greaterThanOrEqualTo(0));
      ctrl.setUnitCursor(section.id, unitIdx);

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('fr'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            backgroundColor: kCanvas,
            body: ListenableBuilder(
              listenable: ctrl,
              builder: (context, _) => ExcelSectionBody(
                ctrl: ctrl,
                section: section,
                entityType: EntityType.vocationalTraining,
                onPreviewSubmit: () async {},
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(_labelContains(tester, 'Citer les 5 principales perspectives'), isTrue);
      expect(find.text('→ 9.2'), findsNothing);
      expect(find.text('9.2 Cinq principales perspectives'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets(
        'VT6_5 (5 options, one of them long enough to wrap) renders with no '
        'RenderFlex overflow — live-reported regression in '
        '_measureCheckboxHeight\'s wrap-width estimate', (tester) async {
      // VT6_5 is asked only when 6.1.1 says the centre has a guidance service.
      final ctrl = OnefopFormController(
        entityType: EntityType.vocationalTraining,
        initialData: const {'VT6_1': 'Oui/ Yes'},
        onSave: (_) async {},
      );
      await ctrl.initialize();
      addTearDown(ctrl.dispose);
      final section =
          ctrl.schema!.sections.firstWhere((s) => s.id == 'section6_vocationalTraining');
      // buildTableGroupUnits landed VT6_5 on the very first unit at the
      // time this was written, but resolving the real index here (instead
      // of hardcoding it) keeps the test correct if that ever shifts, same
      // as the roster-index recount vt_desktop_excel_shell_test.dart's own
      // doc comment already warns about.
      final units = buildTableGroupUnits(
        ctrl,
        section,
        const Locale('fr'),
        entityType: EntityType.vocationalTraining,
        simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
        mobile: false,
      );
      final unitIdx = units.indexWhere((u) => u.fieldIds.contains('VT6_5'));
      expect(unitIdx, greaterThanOrEqualTo(0));
      ctrl.setUnitCursor(section.id, unitIdx);

      tester.view.physicalSize = const Size(1920, 1080);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('fr'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            backgroundColor: kCanvas,
            body: ListenableBuilder(
              listenable: ctrl,
              builder: (context, _) => ExcelSectionBody(
                ctrl: ctrl,
                section: section,
                entityType: EntityType.vocationalTraining,
                onPreviewSubmit: () async {},
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(milliseconds: 700));

      expect(tester.takeException(), isNull);
      expect(
        _labelContains(tester,
            "Quel accompagnement le service d'orientation assure aux apprenants"),
        isTrue,
      );
      // 5 options, 3+ so this is the closed dropdown now — open it to
      // reach the option rows the overflow this test guards against would
      // have shown up in.
      final dropdown = _dropdownFor(ctrl, 'VT6_5');
      expect(dropdown, findsOneWidget);
      await tester.tap(dropdown);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byIcon(Icons.check_box_outline_blank_rounded), findsNWidgets(5));
    });

    testWidgets(
        'VT3_2 (10 options — live-reported: overflow banner painted over '
        'the row below, and option 10 "Fires" unreachable) renders with no '
        'overflow, every option present, and the last option is still '
        'selectable', (tester) async {
      final ctrl = OnefopFormController(
        entityType: EntityType.vocationalTraining,
        initialData: const {},
        onSave: (_) async {},
      );
      await ctrl.initialize();
      addTearDown(ctrl.dispose);
      final section =
          ctrl.schema!.sections.firstWhere((s) => s.id == 'section3_vocationalTraining');
      final vt31 = ctrl.schema!.getField('VT3_1')!;
      ctrl.setRadioValue(vt31, 'Oui/ Yes');

      final units = buildTableGroupUnits(
        ctrl,
        section,
        const Locale('fr'),
        entityType: EntityType.vocationalTraining,
        simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
        mobile: false,
      );
      final unitIdx = units.indexWhere((u) => u.fieldIds.contains('VT3_2'));
      expect(unitIdx, greaterThanOrEqualTo(0));
      ctrl.setUnitCursor(section.id, unitIdx);

      tester.view.physicalSize = const Size(1920, 1080);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('fr'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            backgroundColor: kCanvas,
            body: ListenableBuilder(
              listenable: ctrl,
              builder: (context, _) => ExcelSectionBody(
                ctrl: ctrl,
                section: section,
                entityType: EntityType.vocationalTraining,
                onPreviewSubmit: () async {},
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(milliseconds: 700));

      expect(tester.takeException(), isNull);
      // 10 options, 3+ so this is the closed dropdown now (see
      // ExcelValueCell.build()'s dispatch comment) — no more row overflow
      // to guard against (the dropdown's fixed single-line row can't
      // overflow the way the old inline checklist did), but the menu's
      // own bounded MenuStyle.maximumSize means its content can scroll
      // internally, so this still confirms all 10 options are actually
      // reachable, not just the first few that fit the panel's height.
      final dropdown = _dropdownFor(ctrl, 'VT3_2');
      expect(dropdown, findsOneWidget);
      await tester.tap(dropdown);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byIcon(Icons.check_box_outline_blank_rounded), findsNWidgets(10));

      // Locale is 'fr' throughout this file, so the rendered option text
      // is "Incendies", not the English "Fires".
      final fires = find.text('Incendies');
      expect(fires, findsOneWidget);
      await tester.ensureVisible(fires);
      await tester.pumpAndSettle();
      await tester.tap(fires);
      await tester.pumpAndSettle();
      expect(ctrl.data['VT3_2'], contains('Incendies/ Fires'));

      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(milliseconds: 700));
    });
  });
}
