import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/theme/app_theme.dart';
import 'models/employee_adapter.dart';
import 'providers/connectivity_provider.dart';
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

  await Hive.initFlutter();
  Hive.registerAdapter(EmployeeAdapter());
  await Hive.openBox('tokenBox');

  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends ConsumerStatefulWidget {
  const MyApp({super.key});

  @override
  ConsumerState<MyApp> createState() => _MyAppState();
}

class _MyAppState extends ConsumerState<MyApp> {
  @override
  void initState() {
    super.initState();
    // Replay anything left over from a previous session as soon as the
    // app has a live ApiClient, without blocking the first frame.
    Future.microtask(() => _flushQueue());
  }

  Future<void> _flushQueue() async {
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

    return MaterialApp.router(
      routerConfig: router,
      title: 'DSMO Cameroon',
      theme: AppTheme.lightTheme(context), // Just use the theme directly
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
