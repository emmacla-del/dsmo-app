// Regression coverage for a live bug report: "if there are no
// [subsection] groupings, let the sections be shown" — OnefopSectionMap
// only ever displays *subsection* labels, and only once a section has
// more than one unit; a section's own title (e.g. "SECTION 3. ÉDUCATION
// EN SITUATION D'URGENCE") was never rendered anywhere at all, on either
// desktop shell (or mobile). ctrl.sectionTitle()/SectionTitleLookup
// already existed, fully wired from each SectionAst's own `title`
// through the compiler (see section_title_lookup.dart) — nothing had
// ever called it. Both desktop shells now show it unconditionally, at
// the top of every section regardless of whether that section has
// subsections.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/excel/onefop_excel_field_rows.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/simple_mode_shell.dart';
import 'package:dsmo_app/providers/onefop_mode_provider.dart';

Future<OnefopFormController> _pumpExcel(
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
  final pageIdx = ctrl.schema!.sections.indexOf(section);
  ctrl.goto(pageIdx, focus: false, scroll: false);
  // Real navigation (navigateToSection, onefop_section_units.dart) pins an
  // explicit unit cursor the moment a section is entered, so the
  // displayed unit stays put from then on. Pumping ExcelSectionBody
  // directly here (no navigation controller in the loop) skips that
  // pinning step — and a section whose first field is an unanswered
  // Yes/No radio (e.g. VT2_1) gets auto-focused on mount by Flutter's own
  // default focus behavior with nothing else in this bare test tree to
  // claim it, which defaults it to Non (see _ExcelSelectInput's
  // onFocusChange) before the first real pump even completes — that
  // alone satisfies hasData for the whole unit, so currentUnitIndex's
  // live "first not done" fallback skips straight past it. Pre-existing
  // interaction between two already-established features, not new here;
  // same fix already used elsewhere in this suite.
  ctrl.setUnitCursor(sectionId, 0);

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
            entityType: entityType,
            onPreviewSubmit: () async {},
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

void main() {
  testWidgets(
      'Spreadsheet Mode: a flat section with no subsections (VT3 — '
      'Emergencies) still shows its own section title', (tester) async {
    await _pumpExcel(
        tester, EntityType.vocationalTraining, 'section3_vocationalTraining');
    expect(
      find.text("SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION "
          "D'URGENCE"),
      findsOneWidget,
    );
  });

  testWidgets(
      'Spreadsheet Mode: a section WITH subsections (VT2 — General '
      'information) shows the section title AND the active subsection\'s '
      'own full heading (code + complete description) — no separate bare-'
      'code breadcrumb duplicating it', (tester) async {
    await _pumpExcel(
        tester, EntityType.vocationalTraining, 'section2_vocationalTraining');
    expect(
      find.text('SECTION 2. INFORMATIONS GÉNÉRALE SUR L\'ÉTABLISSEMENT'),
      findsOneWidget,
    );
    expect(find.text('→ 2.1'), findsNothing);
    expect(find.text('2.1 Renseignements généraux'), findsOneWidget);
  });

  testWidgets(
      'Non-VT entity (enterprise, section0 — single-unit, no '
      'subsections) also shows its section title now', (tester) async {
    await _pumpExcel(tester, EntityType.enterprise, 'section0');
    expect(find.text('SECTION 0. IDENTIFICATION DU RÉPONDANT'),
        findsOneWidget);
  });

  testWidgets(
      'Simple Mode: same flat VT3 section shows its section title too',
      (tester) async {
    final ctrl = OnefopFormController(
      entityType: EntityType.vocationalTraining,
      initialData: const {},
      onSave: (_) async {},
    );
    await ctrl.initialize();
    addTearDown(ctrl.dispose);
    final section = ctrl.schema!.sections
        .firstWhere((s) => s.id == 'section3_vocationalTraining');
    final pageIdx = ctrl.schema!.sections.indexOf(section);
    ctrl.goto(pageIdx, focus: false, scroll: false);

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
            builder: (context, _) => SimpleModeShell(
              ctrl: ctrl,
              entityType: EntityType.vocationalTraining,
              buildField: (f) => const SizedBox.shrink(),
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

    expect(
      find.text("SECTION 3. INFORMATIONS SUR L'ÉDUCATION EN SITUATION "
          "D'URGENCE"),
      findsOneWidget,
    );
  });
}
