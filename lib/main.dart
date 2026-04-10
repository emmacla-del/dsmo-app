// lib/main.dart
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'models/employee_adapter.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/home_screen.dart';
import 'screens/dsmo/declaration_wizard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Hive
  await Hive.initFlutter();

  // Register the adapter
  Hive.registerAdapter(EmployeeAdapter());

  // ✅ Also open token box for authentication
  await Hive.openBox('tokenBox');

  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DSMO Cameroon',
      theme: ThemeData(
        primarySwatch: Colors.teal,
        useMaterial3: true,
      ),
      // ✅ Start with LoginScreen, NOT the wizard directly
      home: const LoginScreen(),
      debugShowCheckedModeBanner: false,
      routes: {
        '/login':    (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/home':     (context) => const HomeScreen(),
        '/declaration': (context) => const DeclarationWizardScreen(),
      },
    );
  }
}
