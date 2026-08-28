import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/models/landing_config.dart';
import 'package:dsmo_app/providers/landing_config_provider.dart';
import 'package:dsmo_app/screens/landing_screen.dart';
import 'package:dsmo_app/screens/lmis_screen.dart';
import 'package:dsmo_app/screens/observatory_screen.dart';
import 'package:dsmo_app/screens/programme_screen.dart';
import 'package:dsmo_app/widgets/public_chrome.dart';

Future<void> _pump(
  WidgetTester tester,
  Widget home, {
  Size size = const Size(1280, 900),
  Locale locale = const Locale('en'),
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
        home: home,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

/// Resolves a header nav link's rendered text color for [label] — green
/// when active, gray when not.
Color? _navLinkColor(WidgetTester tester, String label) {
  return tester.widget<Text>(find.text(label).first).style?.color;
}

void main() {
  testWidgets(
      '/lmis renders pillars + pipeline + access band, standalone',
      (tester) async {
    await _pump(tester, const LmisScreen());

    expect(find.text('What CAMLEAP is building'), findsOneWidget);
    expect(find.text('From data to labour-market intelligence'),
        findsOneWidget);
    expect(find.text('Request access'), findsOneWidget);
    expect(
      find.text(LandingConfig.defaults().accessNote.en),
      findsOneWidget,
    );

    // Content relocated to /programme must not leak onto /lmis.
    expect(
      find.text('Why a Labour Market Information System?'),
      findsNothing,
    );
    expect(find.text('Government & policy makers'), findsNothing);
    expect(find.text('Building the system progressively'), findsNothing);

    expect(_navLinkColor(tester, 'LMIS'), PublicColors.green);
    expect(_navLinkColor(tester, 'Programme'), PublicColors.gray700);
    expect(_navLinkColor(tester, 'Observatory'), PublicColors.gray700);

    expect(tester.takeException(), isNull);
  });

  testWidgets(
      '/programme renders the why-LMIS narrative, full roadmap and ecosystem, standalone',
      (tester) async {
    await _pump(tester, const ProgrammeScreen());

    expect(
      find.text('Why a Labour Market Information System?'),
      findsOneWidget,
    );
    expect(find.text('Building the system progressively'), findsOneWidget);
    expect(find.text('Digital data collection'), findsOneWidget);
    expect(find.text('Labour-market intelligence & dissemination'),
        findsOneWidget);
    expect(find.text('Government & policy makers'), findsOneWidget);
    expect(find.textContaining('Component I'), findsWidgets);

    // LMIS-only content (pillars/pipeline page heading, access band) must
    // not leak onto /programme.
    expect(find.text('What CAMLEAP is building'), findsNothing);
    expect(find.text('Request access'), findsNothing);

    expect(_navLinkColor(tester, 'Programme'), PublicColors.green);
    expect(_navLinkColor(tester, 'LMIS'), PublicColors.gray700);
    expect(_navLinkColor(tester, 'Observatory'), PublicColors.gray700);

    expect(tester.takeException(), isNull);
  });

  testWidgets(
      '/observatory renders placeholder title, in-preparation badge and indicators, standalone',
      (tester) async {
    await _pump(tester, const ObservatoryScreen());

    final defaults = LandingConfig.defaults().observatory;
    expect(find.text(defaults.title.en), findsOneWidget);
    expect(find.text(defaults.description.en), findsOneWidget);
    expect(find.text('Content in preparation'), findsOneWidget);
    for (final indicator in defaults.indicators) {
      expect(find.text(indicator.en), findsOneWidget);
    }

    expect(_navLinkColor(tester, 'Observatory'), PublicColors.green);
    expect(_navLinkColor(tester, 'Programme'), PublicColors.gray700);
    expect(_navLinkColor(tester, 'LMIS'), PublicColors.gray700);

    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'router reaches /, /lmis, /programme and /observatory via GoRouter navigation, and /roadmap redirects to /programme',
      (tester) async {
    tester.view.physicalSize = const Size(1280, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final testRouter = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(path: '/', builder: (context, state) => const LandingScreen()),
        GoRoute(
            path: '/lmis', builder: (context, state) => const LmisScreen()),
        GoRoute(
            path: '/programme',
            builder: (context, state) => const ProgrammeScreen()),
        GoRoute(
            path: '/observatory',
            builder: (context, state) => const ObservatoryScreen()),
        GoRoute(
          path: '/roadmap',
          redirect: (context, state) => '/programme',
        ),
      ],
    );

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
          routerConfig: testRouter,
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    testRouter.go('/lmis');
    await tester.pumpAndSettle();
    expect(find.text('What CAMLEAP is building'), findsOneWidget);

    testRouter.go('/programme');
    await tester.pumpAndSettle();
    expect(find.text('Building the system progressively'), findsOneWidget);

    testRouter.go('/observatory');
    await tester.pumpAndSettle();
    expect(find.text('Content in preparation'), findsOneWidget);

    testRouter.go('/roadmap');
    await tester.pumpAndSettle();
    expect(
      testRouter.routerDelegate.currentConfiguration.uri.path,
      '/programme',
    );
    expect(find.text('Building the system progressively'), findsOneWidget);

    testRouter.go('/');
    await tester.pumpAndSettle();
    expect(
      find.text("Building Cameroon's Labour Market Information System"),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
