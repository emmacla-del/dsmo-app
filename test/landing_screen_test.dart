import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/main.dart' show router;
import 'package:dsmo_app/models/landing_config.dart';
import 'package:dsmo_app/providers/landing_config_provider.dart';
import 'package:dsmo_app/screens/landing_screen.dart';
import 'package:dsmo_app/widgets/public_chrome.dart';

Future<void> _pump(
  WidgetTester tester, {
  required Size size,
  required Locale locale,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        landingConfigProvider.overrideWith(
          (ref) async => LandingConfig.defaults(),
        ),
      ],
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const LandingScreen(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

/// Resolves the header nav link's rendered text color for [label] — green
/// when active, gray when not. Used to verify the active tab is visibly
/// distinguished, not just structurally correct.
Color? _navLinkColor(WidgetTester tester, String label) {
  return tester.widget<Text>(find.text(label).first).style?.color;
}

void main() {
  testWidgets('desktop EN renders the minimal hero, visual statement and closing',
      (tester) async {
    await _pump(
      tester,
      size: const Size(1280, 900),
      locale: const Locale('en'),
    );

    // Hero: headline + one supporting statement (hero.description) + CTAs.
    expect(
      find.text("Building Cameroon's Labour Market Information System"),
      findsOneWidget,
    );
    expect(
      find.text(LandingConfig.defaults().hero.description.en),
      findsOneWidget,
    );
    expect(find.text('Explore the programme'), findsOneWidget);
    expect(find.text('Access the platform'), findsOneWidget);

    // Roadmap status pill must be gone from the hero.
    expect(find.textContaining('Component I'), findsNothing);
    expect(find.textContaining('Foundation phase'), findsNothing);

    // Content that now lives on /programme and /lmis must not be
    // previewed here.
    expect(
      find.text('Why a Labour Market Information System?'),
      findsNothing,
    );
    expect(find.text('Government & policy makers'), findsNothing);
    expect(find.text('Building the system progressively'), findsNothing);
    expect(find.text('What CAMLEAP is building'), findsNothing);

    // One visual statement: bookend + midpoint glyph (data sources ->
    // CAMLEAP -> intelligence -> decision-making), not the full 6-step
    // lmisArchitecture list — avoids restating /lmis's 7-step pipeline
    // almost verbatim. (Kicker renders its text upper-cased.)
    expect(find.text('THE LMIS'), findsOneWidget);
    expect(find.text('Data sources'), findsOneWidget);
    expect(find.text('Intelligence'), findsOneWidget);
    expect(find.text('Decision-making'), findsOneWidget);
    expect(find.text('CAMLEAP'), findsWidgets); // header identity + glyph node
    // The dropped middle steps (shared word-for-word with /lmis's
    // platformCapabilities pipeline) must not appear here.
    expect(find.text('Collection'), findsNothing);
    expect(find.text('Integration'), findsNothing);
    expect(find.text('Analysis'), findsNothing);

    // Closing: heading (ctaTitle) + doors to /lmis and /programme.
    expect(
      find.text(LandingConfig.defaults().ctaTitle.en),
      findsOneWidget,
    );
    expect(find.text('Enter the LMIS'), findsOneWidget);
    expect(find.text('Programme'), findsWidgets);

    // Header: Programme / LMIS / Observatory tabs, language, sign in — no
    // self-link back to '/' and no "Request access" on the front door
    // (contextual to /lmis's access band instead).
    expect(find.text('LMIS'), findsWidgets);
    expect(find.text('Observatory'), findsOneWidget);
    expect(find.text('Request access'), findsNothing);

    // Home has no self-referencing tab: none of the three nav links
    // should render in the active (green) color.
    for (final label in ['Programme', 'LMIS', 'Observatory']) {
      expect(_navLinkColor(tester, label), PublicColors.gray700);
    }

    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile FR renders without overflow', (tester) async {
    await _pump(
      tester,
      size: const Size(390, 844),
      locale: const Locale('fr'),
    );

    expect(
      find.text(
          'Bâtir le système d\'information sur le marché du travail du Cameroun'),
      findsOneWidget,
    );
    expect(find.text('SIMT'), findsWidgets);
    expect(find.text('Programme'), findsWidgets);
    expect(find.text('Demander l\'accès'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('tablet and narrow widths do not overflow', (tester) async {
    for (final size in const [Size(800, 900), Size(360, 760)]) {
      await _pump(tester, size: size, locale: const Locale('en'));
      expect(
        find.text("Building Cameroon's Labour Market Information System"),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets(
      'header and closing links reach /lmis and /programme via GoRouter navigation',
      (tester) async {
    tester.view.physicalSize = const Size(1280, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    // Uses the app's real singleton `router` (from main.dart) rather than a
    // locally-built GoRouter — landing_screen.dart's nav/CTA onTap handlers
    // call that singleton directly (`import '../main.dart' show router`),
    // so a separately-constructed router in this test would never see the
    // navigation triggered by tapping the actual UI.
    router.go('/');

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          landingConfigProvider.overrideWith(
            (ref) async => LandingConfig.defaults(),
          ),
        ],
        child: MaterialApp.router(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    // Header nav "LMIS" link.
    await tester.tap(find.text('LMIS').first);
    await tester.pumpAndSettle();
    expect(find.text('What CAMLEAP is building'), findsOneWidget);

    router.go('/');
    await tester.pumpAndSettle();

    // Header nav "Programme" link.
    await tester.tap(find.text('Programme').first);
    await tester.pumpAndSettle();
    expect(
      find.text('Why a Labour Market Information System?'),
      findsOneWidget,
    );
    expect(find.text('Building the system progressively'), findsOneWidget);

    router.go('/');
    await tester.pumpAndSettle();

    // Closing "Enter the LMIS" button — scroll it into view first, since
    // it sits below the fold in the landing page's scrollable.
    await tester.scrollUntilVisible(
      find.text('Enter the LMIS'),
      500,
      scrollable: find.descendant(
        of: find.byKey(const Key('landing-scroll')),
        matching: find.byType(Scrollable),
      ),
    );
    await tester.tap(find.text('Enter the LMIS'));
    await tester.pumpAndSettle();
    expect(find.text('What CAMLEAP is building'), findsOneWidget);

    expect(tester.takeException(), isNull);
  });
}
