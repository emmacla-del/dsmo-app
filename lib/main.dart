import 'dart:async';

import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/theme/app_theme.dart';
import 'l10n/generated/app_localizations.dart';
import 'models/employee_adapter.dart';
import 'providers/connectivity_provider.dart';
import 'providers/locale_provider.dart';
import 'providers/sync_queue_provider.dart';
import 'providers/auth_provider.dart';
import 'services/draft_service.dart';
import 'widgets/offline_banner.dart';
import 'screens/change_password_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/login_portal_screen.dart';
import 'screens/register_screen.dart';
import 'screens/reset_password_screen.dart';
import 'screens/verify_email_screen.dart';
import 'screens/home_screen.dart';
import 'screens/dsmo/declaration_wizard_screen.dart';
import 'features/analytics/screens/onefop_dashboard_screen.dart';
import 'screens/onefop/onefop_progress_dashboard_screen.dart';
import 'screens/onefop/onefop_unified_form_screen_v4.dart';
import 'screens/onefop/onefop_form_constants.dart' show EntityType;

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

// The public marketing site (landing page + /lmis, /programme, /observatory,
// /roadmap redirect, and the ComingSoonScreen placeholder routes it linked
// to) is unwired here, not deleted — the screens/widgets it depended on
// (landing_screen.dart, lmis_screen.dart, programme_screen.dart,
// observatory_screen.dart, coming_soon_screen.dart, the _publicPage
// transition, and the LandingConfig CMS) are left in place on disk in case
// they're wanted again. The app now goes straight to /login.
final GoRouter router = GoRouter(
  navigatorKey: rootNavigatorKey,
  initialLocation: '/login',
  routes: [
    GoRoute(
      path: '/login',
      name: 'login',
      builder: (context, state) => const LoginPortalScreen(),
    ),
    GoRoute(
      path: '/register',
      name: 'register',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/change-password',
      name: 'change-password',
      builder: (context, state) => const ChangePasswordScreen(),
    ),
    GoRoute(
      path: '/forgot-password',
      name: 'forgot-password',
      builder: (context, state) => const ForgotPasswordScreen(),
    ),
    GoRoute(
      path: '/reset-password',
      name: 'reset-password',
      builder: (context, state) => ResetPasswordScreen(
        token: state.uri.queryParameters['token'],
      ),
    ),
    GoRoute(
      path: '/verify-email',
      name: 'verify-email',
      builder: (context, state) => VerifyEmailScreen(
        token: state.uri.queryParameters['token'],
      ),
    ),
    GoRoute(
      path: '/home',
      name: 'home',
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/declaration',
      name: 'declaration',
      builder: (context, state) => const DeclarationWizardScreen(),
    ),
    GoRoute(
      path: '/onefop/dashboard',
      name: 'onefop-dashboard',
      builder: (context, state) => OnefopProgressDashboardScreen(
        onContinue: () => router.go('/onefop/form'),
      ),
    ),
    GoRoute(
      path: '/onefop/form',
      name: 'onefop-vt-form',
      builder: (context, state) => Consumer(
        builder: (context, ref, _) {
          final userId = ref.read(authProvider).value?.id ?? 'guest';
          return OnefopUnifiedFormScreenV4(
            entityType: EntityType.vocationalTraining,
            initialData: const {},
            forceSimpleMode: true,
            userId: userId,
            onSave: (data) => DraftService.saveDraft(
              userId: userId,
              entityType: 'vocationalTraining',
              data: data,
            ),
            onCancel: () => router.go('/onefop/dashboard'),
            onSubmitSuccess: () => DraftService.clearDraft(
              userId: userId,
              entityType: 'vocationalTraining',
            ),
          );
        },
      ),
    ),
    GoRoute(
      path: '/analytics',
      name: 'analytics',
      builder: (context, state) => const OnefopDashboardScreen(),
    ),
  ],
);

Future<void> _initializeHive() async {
  try {
    await Hive.initFlutter().timeout(const Duration(seconds: 8));
    if (!Hive.isAdapterRegistered(0)) {
      Hive.registerAdapter(EmployeeAdapter());
    }
    await Hive.openBox('tokenBox').timeout(const Duration(seconds: 8));
  } catch (error) {
    // Storage must not prevent the Flutter shell from starting. Do not delete
    // the token box here: a transient web-storage or file-lock error should
    // never turn into an unexpected logout or data loss.
    debugPrint('Hive initialization unavailable: $error');
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await _initializeHive();
  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends ConsumerStatefulWidget {
  const MyApp({super.key});

  @override
  ConsumerState<MyApp> createState() => _MyAppState();
}

class _MyAppState extends ConsumerState<MyApp> {
  Timer? _backstopTimer;

  @override
  void initState() {
    super.initState();
    // Replay anything left over from a previous session as soon as the
    // app has a live ApiClient, without blocking the first frame.
    Future.microtask(() => _flushQueue());

    // Backstop for the reconnect listener below: that only fires on a
    // clean offline→online transition, so it misses the case where the OS
    // reports "online" (wifi connected) but the API host itself is
    // unreachable (bad DNS, captive portal, host cold-starting) — nothing
    // would otherwise retry until some other connectivity blip happens.
    // Only does real work when there's something queued and the device
    // currently looks online.
    _backstopTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      if (ref.read(isOnlineProvider)) _flushQueue();
    });
  }

  @override
  void dispose() {
    _backstopTimer?.cancel();
    super.dispose();
  }

  Future<void> _flushQueue() async {
    final count0 = await ref.read(syncQueueServiceProvider).pendingCount();
    if (count0 == 0) return;
    await ref.read(syncQueueServiceProvider).flush();
    final count = await ref.read(syncQueueServiceProvider).pendingCount();
    if (mounted) {
      ref.read(pendingSubmissionCountProvider.notifier).state = count;
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<bool>(isOnlineProvider, (previous, next) {
      if (previous == false && next == true) {
        _flushQueue();
      }
    });

    final locale = ref.watch(localeProvider);

    return MaterialApp.router(
      routerConfig: router,
      title: 'CAMLEAP | Labour Market Intelligence',
      theme: AppTheme.lightTheme(context), // Just use the theme directly
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      debugShowCheckedModeBanner: false,
      builder: (context, child) {
        // Every screen in the app displays its text via plain Text widgets
        // (only 2 files use SelectableText out of hundreds), so none of it
        // is selectable/copyable by default — Flutter's Text paints glyphs
        // without any selection handling of its own. Wrapping the whole
        // app once here, instead of converting every Text to SelectableText
        // one screen at a time, makes all of it selectable in one place;
        // TextFields/TextFormFields keep their own normal editing selection
        // unaffected, and buttons/gestures keep working as before.
        //
        // The explicit Overlay below is required, not decorative: `child`
        // here is MaterialApp.router's own Router/Navigator, which is what
        // creates the app's Overlay — so that Overlay ends up BELOW
        // SelectionArea in the tree, not above it. SelectionArea's own
        // SelectableRegion needs an Overlay ANCESTOR (it hosts selection
        // handles/the copy toolbar as an OverlayEntry), and walking up from
        // inside SelectionArea never reaches one that's actually a
        // descendant — hence "No Overlay widget found" at runtime.
        // Providing a small dedicated Overlay right here, directly above
        // SelectionArea, satisfies that lookup; the app's own Navigator
        // further down still creates its own nested Overlay for routing/
        // dialogs exactly as before — nested Overlays are normal in
        // Flutter and don't conflict.
        return Overlay(
          initialEntries: [
            OverlayEntry(
              builder: (context) => SelectionArea(
                child: Column(
                  children: [
                    const OfflineBanner(),
                    Expanded(child: child ?? const SizedBox.shrink()),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
