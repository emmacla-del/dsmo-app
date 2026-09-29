// Coverage for the VT desktop hierarchical Section→Subsection sidebar
// (_VtSidebarSectionItem/_VtSubsectionTree, onefop_form_widgets.dart) — a
// live spec with an explicit mockup asked for the persistent left Sidebar
// (previously section-only, one row per page) to become a real
// questionnaire map for VT: every subsection listed in full under its
// section, the section containing the active subsection auto-expanded,
// the active row highlighted in the app's emerald accent, and tapping any
// row jumping straight to it. This superseded VtSectionOutline (a
// body-inline panel — see vt_subsection_headings_test.dart's header
// comment for that history); ExcelSectionBody now shows only a compact
// breadcrumb (see vt_desktop_excel_shell_test.dart /
// vt_desktop_headings_and_checkbox_test.dart for that side).
//
// Sidebar itself is shared by every entity type — these tests exercise it
// directly (not just _VtSubsectionTree in isolation) specifically to
// prove the non-VT path renders through the exact same, unmodified
// _SidebarPageItem it always has: the itemBuilder branch in Sidebar.build
// is the only thing gating VT's tree in at all.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_widgets.dart' show Sidebar;

Future<OnefopFormController> _controller(EntityType entityType) async {
  final ctrl = OnefopFormController(
    entityType: entityType,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<void> _pumpSidebar(
  WidgetTester tester,
  OnefopFormController ctrl,
  EntityType entityType,
) async {
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        body: ListenableBuilder(
          listenable: ctrl,
          builder: (_, __) => Sidebar(ctrl: ctrl, entityType: entityType),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  group('VT: full-width sidebar shows a real subsection tree', () {
    testWidgets(
        'the active section (page 0, section1) auto-expands and shows its '
        'own subsections in full, without needing a tap', (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      ctrl.setSidebarMode(2);
      await _pumpSidebar(tester, ctrl, EntityType.vocationalTraining);

      expect(find.text('1.15 Informations sur le répondant'), findsOneWidget);
      expect(
        find.text('1.16 Noms et contacts du Promoteur/Directeur du CFP'),
        findsOneWidget,
      );
    });

    testWidgets(
        'a section other than the active one starts collapsed — no '
        'subsection text from it leaks into the tree', (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      ctrl.setSidebarMode(2);
      await _pumpSidebar(tester, ctrl, EntityType.vocationalTraining);

      // Section 5's own subsections should not appear while section1 is
      // the active (auto-expanded) one.
      expect(find.text('5.2 Référentiel de formation'), findsNothing);
    });

    testWidgets('tapping a collapsed section\'s chevron reveals its tree',
        (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      ctrl.setSidebarMode(2);
      await _pumpSidebar(tester, ctrl, EntityType.vocationalTraining);

      expect(find.text('5.2 Référentiel de formation'), findsNothing);
      // Section 5's own row ("Guides et infrastructures", from
      // kSidebarMeta) — find its chevron specifically, not just any
      // collapsed section's, so this really proves section5 opened. Two
      // Row ancestors up from the label: the first is _SidebarPageItem's
      // own inner Row (icon + label column); the second is
      // _VtSidebarSectionItem's outer Row, which is what actually holds
      // the chevron alongside the header.
      final outerRow = find
          .ancestor(of: find.text('Guides et infrastructures'), matching: find.byType(Row))
          .at(1);
      final chevron =
          find.descendant(of: outerRow, matching: find.byIcon(Icons.expand_more_rounded));
      await tester.tap(chevron);
      await tester.pump();
      expect(find.text('5.2 Référentiel de formation'), findsOneWidget);
    });

    testWidgets(
        'tapping a subsection row switches the page and sets that '
        'section\'s unit cursor to the tapped row', (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      ctrl.setSidebarMode(2);
      await _pumpSidebar(tester, ctrl, EntityType.vocationalTraining);

      expect(ctrl.unitCursor('section1_vocationalTraining'), isNull);
      await tester.tap(find.text('1.16 Noms et contacts du Promoteur/Directeur du CFP'));
      await tester.pump();
      expect(ctrl.unitCursor('section1_vocationalTraining'), 2);
    });

    testWidgets(
        'when the active subsection changes within the currently active '
        'section, its tree re-expands even if the user had manually '
        'collapsed that same section', (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      ctrl.setSidebarMode(2);
      await _pumpSidebar(tester, ctrl, EntityType.vocationalTraining);

      // Seed the tracked "last active index" via one real rebuild before
      // manually collapsing — mirrors how the tracking is always primed
      // by the time a section has actually been entered in real usage
      // (see _VtSidebarSectionItemState's own doc comment).
      ctrl.setUnitCursor('section1_vocationalTraining', 0);
      await tester.pump();

      final outerRow = find
          .ancestor(of: find.text('Identification'), matching: find.byType(Row))
          .at(1);
      final chevron =
          find.descendant(of: outerRow, matching: find.byIcon(Icons.expand_less_rounded));
      await tester.tap(chevron);
      await tester.pump();
      expect(find.text('1.15 Informations sur le répondant'), findsNothing);

      ctrl.setUnitCursor('section1_vocationalTraining', 1);
      await tester.pump();
      expect(find.text('1.15 Informations sur le répondant'), findsOneWidget);
    });

    testWidgets(
        'when the active subsection changes, the sidebar auto-scrolls so '
        'the newly active row becomes visible', (tester) async {
      tester.view.physicalSize = const Size(500, 400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      ctrl.setSidebarMode(2);
      await _pumpSidebar(tester, ctrl, EntityType.vocationalTraining);

      // Section 4 (page index 3) has 11 subsections — more rows than fit
      // in a 400px-tall viewport alongside every other section's own
      // collapsed row, so reaching the last one requires a real scroll.
      ctrl.goto(3, focus: false, scroll: false);
      await tester.pump();

      final scrollable = tester.state<ScrollableState>(find.byType(Scrollable).first);
      final before = scrollable.position.pixels;

      ctrl.setUnitCursor('section4_vocationalTraining', 10);
      // Scrollable.ensureVisible animates rather than jumping, and the
      // animation's own ticker only starts measuring elapsed time from
      // its first tick — a single timed pump() right after scheduling it
      // lands exactly on that first (zero-progress) tick, so this needs
      // pumpAndSettle rather than one manual duration jump.
      await tester.pumpAndSettle();

      expect(scrollable.position.pixels, greaterThan(before));
      expect(
        find.text('4.11 Effectifs des apprenants par types de bourse et selon le sexe'),
        findsOneWidget,
      );
    });

    testWidgets(
        'the active row is visually distinct: exactly one "●" glyph, and '
        'every other row of the same expanded section is done/upcoming',
        (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      ctrl.setSidebarMode(2);
      await _pumpSidebar(tester, ctrl, EntityType.vocationalTraining);

      expect(find.text('●'), findsOneWidget);
      expect(find.text('○'), findsWidgets);
    });

    testWidgets(
        'collapsed-icon sidebar mode (1) shows sections only — no '
        'subsection text, no chevrons', (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      ctrl.setSidebarMode(1);
      await _pumpSidebar(tester, ctrl, EntityType.vocationalTraining);

      expect(find.text('1.15 Informations sur le répondant'), findsNothing);
      expect(find.byIcon(Icons.expand_more_rounded), findsNothing);
      expect(find.byIcon(Icons.expand_less_rounded), findsNothing);
    });
  });

  group('Non-VT entities: Sidebar renders exactly as before', () {
    testWidgets(
        'an ordinary entity (enterprise) shows no subsection tree/chevron '
        'anywhere in the sidebar, even in full-width mode', (tester) async {
      final ctrl = await _controller(EntityType.enterprise);
      addTearDown(ctrl.dispose);
      ctrl.setSidebarMode(2);
      await _pumpSidebar(tester, ctrl, EntityType.enterprise);

      expect(find.byIcon(Icons.expand_more_rounded), findsNothing);
      expect(find.byIcon(Icons.expand_less_rounded), findsNothing);
      expect(find.textContaining(RegExp(r'^[✓●○]$')), findsNothing);
    });
  });
}
