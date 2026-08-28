// Throwaway visual-audit tool — renders the ONEFOP form to PNGs via golden
// capture so its current appearance can actually be inspected, not guessed
// from reading widget code. Not a real regression test; safe to delete.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/leading_group_switch_table.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/providers/onefop_mode_provider.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_unified_form_screen_v4.dart';

// Valid answers for every required field in section0 (Répondant) and
// section1_entreprise (Entité) — enough to satisfy canAdvance so the
// mobile stepper's page-level Suivant is enabled and this throwaway audit
// tool can reach section2 (Emploi) without a real user filling the form.
const _kFilledRespondentAndEntite = <String, dynamic>{
  'S0Q01': 'Jean Dupont',
  'S0Q02': 'DRH',
  'S0Q03_TEL1': '677123456',
  'S0Q03_EMAIL': 'contact@entreprise.com',
  'S1Q01': 'SARL/ LLC',
  'S1Q02': 'ACME SARL',
  'S1Q03': 'Urbain/ Urban',
  'S1Q04_REGION': 'Centre',
  'S1Q04_DEPT': 'Mfoundi',
  'S1Q04_SUBDIV': 'Yaoundé 1',
  'S1Q04_LOCALITY': 'Bastos',
  'S1Q05_TEL1': '677123456',
  'S1Q05_BP': '1234',
  'S1Q06': 'Tertiaire/ Tertiary',
  'S1Q07': 'Services',
  'S1Q08': 'Conseil',
  'S1Q09': 'Yaoundé',
  'S1Q10': 10,
  'S1Q11': 2,
  'S1Q12': 'PE/ Small enterprise',
};

Future<void> _capture(WidgetTester tester, String name,
    {Size size = const Size(1440, 1000),
    List<Override> overrides = const [],
    // Desktop: exact Sidebar label to tap (e.g. "Entreprise", "Emploi").
    // Mobile: same label, but matched against MobileContextHeader's
    // "$sectionLabel  ·  $page / $total" text instead of a direct tap
    // target — see the loop below.
    String? navigateToSection,
    // After landing on the target section, step through this many in-unit
    // Suivant taps to reach a later table/subsection within it.
    int unitAdvances = 0,
    bool prefillRespondentAndEntite = false,
    DateTime? campaignPeriodStart,
    DateTime? campaignPeriodEnd}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: const Locale('fr'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: OnefopUnifiedFormScreenV4(
          entityType: EntityType.enterprise,
          initialData: prefillRespondentAndEntite ? _kFilledRespondentAndEntite : const {},
          campaignPeriodStart: campaignPeriodStart,
          campaignPeriodEnd: campaignPeriodEnd,
          onSave: (_) {},
        ),
      ),
    ),
  );
  await tester.pump();
  tester.takeException(); // drain the known focusFirst()/warm-up-frame race

  if (navigateToSection != null) {
    final target = find.text(navigateToSection);
    if (target.evaluate().isNotEmpty) {
      // Desktop: the Sidebar has a direct tap target per section.
      await tester.tap(target.first);
      await tester.pump();
      tester.takeException();
    } else {
      // Mobile: no direct jump — the in-unit Suivant (UnitNavRow) is the
      // only Suivant left now that the page-level NavBar (which used to
      // duplicate it) is gone, and it only advances one unit at a time, so
      // a section with several units needs several taps to cross. Tap
      // until MobileContextHeader's own "$sectionLabel · $page / $total"
      // text confirms arrival, rather than a hardcoded tap count that
      // silently drifts stale whenever a section's unit count changes.
      for (var i = 0; i < 40; i++) {
        if (find.textContaining(navigateToSection).evaluate().isNotEmpty) break;
        final suivant = find.text('Suivant');
        if (suivant.evaluate().isEmpty) break;
        // A long unit (e.g. section1_entreprise's Localisation/Coordonnées
        // run) can push the button below the viewport — tap() doesn't
        // scroll for you, so an off-screen button silently misses and the
        // loop spins in place forever.
        await tester.ensureVisible(suivant.last);
        await tester.tap(suivant.last);
        await tester.pump();
        tester.takeException();
      }
    }
  }

  // Desktop: same single in-unit Suivant (UnitNavRow) — the section-wide
  // _BottomActionBar that used to duplicate it is gone.
  for (var i = 0; i < unitAdvances; i++) {
    final suivant = find.text('Suivant');
    if (suivant.evaluate().isEmpty) break;
    await tester.ensureVisible(suivant.first);
    await tester.tap(suivant.first);
    await tester.pump();
    tester.takeException();
  }

  // Focusing a field during the interactions above schedules the
  // controller's autosave Timer (schedAS/_doAS) — flush it with a real
  // time advance so it fires before teardown instead of leaking past the
  // disposed widget tree and failing the test on a pending-timer assertion.
  await tester.pump(const Duration(seconds: 1));

  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
}

void main() {
  testWidgets('capture desktop page 0 (Répondant)', (tester) async {
    await _capture(tester, 'onefop_desktop_page0');
  });

  testWidgets('capture mobile page 0 (Répondant)', (tester) async {
    await _capture(tester, 'onefop_mobile_page0', size: const Size(390, 844));
  });

  testWidgets('capture desktop page 0 filled (Répondant)', (tester) async {
    await _capture(tester, 'onefop_desktop_page0_filled', prefillRespondentAndEntite: true);
  });

  testWidgets('capture desktop Entité filled', (tester) async {
    await _capture(tester, 'onefop_desktop_entite_filled',
        navigateToSection: 'Entreprise', prefillRespondentAndEntite: true);
  });

  testWidgets('capture desktop simple mode page 0', (tester) async {
    await _capture(
      tester,
      'onefop_desktop_simple_page0',
      overrides: [
        onefopModeProvider.overrideWith((ref) => OnefopModeNotifier()..setMode(OnefopViewMode.simple)),
      ],
    );
  });

  testWidgets('capture desktop Entité section', (tester) async {
    await _capture(tester, 'onefop_desktop_entite', navigateToSection: 'Entreprise');
  });

  testWidgets('capture mobile Entité section', (tester) async {
    await _capture(tester, 'onefop_mobile_entite',
        size: const Size(390, 844),
        navigateToSection: 'Entreprise',
        prefillRespondentAndEntite: true);
  });

  // S21Q01 (the first question landed on here) embeds the active campaign's
  // data-collection period in its wording — see
  // OnefopFormController._applyCampaignPeriodLabels(). A fixed period is
  // passed so the golden reflects real production text (dates rendered,
  // question wraps to its real line count) rather than the "no active
  // campaign" fallback wording used when these two params are omitted.
  testWidgets('capture desktop section2 (category mini-grids, 2.1)', (tester) async {
    await _capture(tester, 'onefop_desktop_section2',
        navigateToSection: 'Emploi',
        campaignPeriodStart: DateTime(2026, 1, 1),
        campaignPeriodEnd: DateTime(2026, 6, 30));
  });

  testWidgets('capture mobile section2 (category mini-grids, 2.1)', (tester) async {
    await _capture(tester, 'onefop_mobile_section2',
        size: const Size(390, 844),
        navigateToSection: 'Emploi',
        prefillRespondentAndEntite: true,
        campaignPeriodStart: DateTime(2026, 1, 1),
        campaignPeriodEnd: DateTime(2026, 6, 30));
  });

  testWidgets('capture desktop section2 recrutements (2.2)', (tester) async {
    await _capture(tester, 'onefop_desktop_section2_recrutements',
        navigateToSection: 'Emploi', unitAdvances: 1);
  });

  testWidgets('capture mobile section2 recrutements (2.2)', (tester) async {
    await _capture(tester, 'onefop_mobile_section2_recrutements',
        size: const Size(390, 844),
        navigateToSection: 'Emploi',
        unitAdvances: 1,
        prefillRespondentAndEntite: true);
  });

  // S3Q02 (reasons_table) has 3 hybrid row-label text fields
  // (S3Q02_REASON_*_TEXT) attached to it — these must not re-appear as a
  // second, unfillable table below it, and must not block Suivant from
  // ever reaching S3Q03.
  testWidgets('capture desktop Départs S3Q02 (reasons table)', (tester) async {
    await _capture(tester, 'onefop_desktop_departs_s3q02',
        navigateToSection: 'Départs', unitAdvances: 5);
  });

  testWidgets('capture desktop Départs S3Q03 (reachable past S3Q02)', (tester) async {
    await _capture(tester, 'onefop_desktop_departs_s3q03',
        navigateToSection: 'Départs', unitAdvances: 6);
  });

  // Same shape for S4Q02 (skills_table) / S4Q03 (training_table).
  testWidgets('capture desktop Formation S4Q02 (skills table)', (tester) async {
    await _capture(tester, 'onefop_desktop_formation_s4q02',
        navigateToSection: 'Formation', unitAdvances: 1);
  });

  testWidgets('capture desktop Formation S4Q03 (reachable past S4Q02)', (tester) async {
    await _capture(tester, 'onefop_desktop_formation_s4q03',
        navigateToSection: 'Formation', unitAdvances: 2);
  });

  // S23Q02 (Permanent/Temporaire first-time-workers table) is the one
  // "flatten Spreadsheet Mode" case with a genuine top-level split that
  // isn't already an ageBandSwitcher/statusSwitcher table — it used to
  // fall back to categoryGridGroups' cards on desktop; now it should
  // render via LeadingGroupSwitchTable: a Permanent/Temporaire tab strip
  // (matching AgeBandSwitchTable/StatusSwitchTable's Row+Expanded style)
  // over one flat table, no card anywhere.
  testWidgets('capture desktop Emploi S23Q02 (Permanent/Temporaire flat table, no cards)',
      (tester) async {
    tester.view.physicalSize = const Size(1440, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          locale: const Locale('fr'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: OnefopUnifiedFormScreenV4(
            entityType: EntityType.enterprise,
            initialData: const {},
            onSave: (_) {},
          ),
        ),
      ),
    );
    await tester.pump();
    tester.takeException();

    await tester.tap(find.text('Emploi'));
    await tester.pump();
    tester.takeException();

    // S22Q04/S22Q05 (StatusSwitchTable) also show a "Permanent" tab, so
    // stop specifically on LeadingGroupSwitchTable mounting, not just any
    // "Permanent" text — otherwise this loop would stop several
    // questions too early.
    for (var i = 0; i < 20; i++) {
      if (find.byType(LeadingGroupSwitchTable).evaluate().isNotEmpty) break;
      final suivant = find.text('Suivant');
      if (suivant.evaluate().isEmpty) break;
      await tester.ensureVisible(suivant.first);
      await tester.tap(suivant.first);
      await tester.pump();
      tester.takeException();
    }

    expect(find.byType(LeadingGroupSwitchTable), findsOneWidget,
        reason: 'S23Q02 should be reachable and render via LeadingGroupSwitchTable');
    expect(find.text('Permanent'), findsOneWidget,
        reason: 'S23Q02 should be reachable and show its Permanent/Temporaire tab strip');
    expect(find.text('Temporaire'), findsOneWidget);
    // No card chrome anywhere — CategoryGridGroupsView's collapsible
    // cards (and their full "Aucun cas à signaler pour cette catégorie"
    // skip-row label) never mount on desktop for this question anymore;
    // only RowSkipToggle's icon (no on-screen label) does.
    expect(find.textContaining('pour cette catégorie'), findsNothing,
        reason: "the card view's skip-toggle row must not appear in Spreadsheet Mode");

    await tester.pump(const Duration(seconds: 1));
    await expectLater(find.byType(MaterialApp),
        matchesGoldenFile('goldens/onefop_desktop_section2_s23q02.png'));
  });
}
