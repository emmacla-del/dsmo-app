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
import 'widgets/offline_banner.dart';
import 'screens/change_password_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/minefop_portal_screen.dart';
import 'screens/register_screen.dart';
import 'screens/reset_password_screen.dart';
import 'screens/verify_email_screen.dart';
import 'screens/home_screen.dart';
import 'screens/dsmo/declaration_wizard_screen.dart';
import 'features/analytics/screens/onefop_dashboard_screen.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

final GoRouter router = GoRouter(
  navigatorKey: rootNavigatorKey,
  initialLocation: '/',
  redirect: (context, state) {
    if (state.matchedLocation == '/login') return '/';
    return null;
  },
  routes: [
    GoRoute(
      path: '/',
      name: 'portal',
      builder: (context, state) => const MinefopPortalScreen(),
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
      path: '/analytics',
      name: 'analytics',
      builder: (context, state) => const OnefopDashboardScreen(),
    ),
  ],
);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // A corrupt/locked local box must never block runApp() — that's the
  // difference between "logged out" and "app won't open" for whichever
  // device has a bad tokenBox on disk.
  try {
    await Hive.initFlutter();
    Hive.registerAdapter(EmployeeAdapter());
    await Hive.openBox('tokenBox');
  } catch (_) {
    try {
      await Hive.deleteBoxFromDisk('tokenBox');
      await Hive.openBox('tokenBox');
    } catch (_) {
      // Local storage still unavailable — proceed without it. ApiClient
      // and other Hive.openBox('tokenBox') call sites already re-open it
      // lazily and tolerate a missing/empty box.
    }
  }

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
    if (mounted) ref.read(pendingSubmissionCountProvider.notifier).state = count;
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
      title: 'DSMO Cameroon',
      theme: AppTheme.lightTheme(context), // Just use the theme directly
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      debugShowCheckedModeBanner: false,
      builder: (context, child) {
        return Column(
          children: [
            const OfflineBanner(),
            Expanded(child: child ?? const SizedBox.shrink()),
          ],
        );
      },
    );
  }
}
