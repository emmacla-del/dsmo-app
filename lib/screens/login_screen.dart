import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _isRegistering = false;
  String _role = 'COMPANY';
  String? _region;
  String? _department;

  Future<void> _submit() async {
    if (_isRegistering) {
      await ref.read(authProvider.notifier).register(
            _emailCtrl.text.trim(),
            _passwordCtrl.text,
            _role,
            region: _region,
            department: _department,
          );
    } else {
      await ref
          .read(authProvider.notifier)
          .login(_emailCtrl.text.trim(), _passwordCtrl.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('DSMO Digital',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
              const SizedBox(height: 40),
              TextField(
                  controller: _emailCtrl,
                  decoration: const InputDecoration(labelText: 'Email'),
                  keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 12),
              TextField(
                  controller: _passwordCtrl,
                  decoration: const InputDecoration(labelText: 'Mot de passe'),
                  obscureText: true),
              if (_isRegistering) ...[
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _role, // ✅ fixed
                  items: const [
                    DropdownMenuItem(
                        value: 'COMPANY', child: Text('Entreprise')),
                    DropdownMenuItem(
                        value: 'DIVISIONAL',
                        child: Text('Délégation divisionnaire')),
                    DropdownMenuItem(
                        value: 'REGIONAL', child: Text('Délégation régionale')),
                    DropdownMenuItem(
                        value: 'CENTRAL', child: Text('Commandement central')),
                  ],
                  onChanged: (v) => setState(() => _role = v!),
                  decoration: const InputDecoration(labelText: 'Rôle'),
                ),
                if (_role == 'DIVISIONAL')
                  TextField(
                    onChanged: (v) => _department = v,
                    decoration: const InputDecoration(labelText: 'Département'),
                  ),
                if (_role == 'REGIONAL')
                  TextField(
                    onChanged: (v) => _region = v,
                    decoration: const InputDecoration(labelText: 'Région'),
                  ),
              ],
              const SizedBox(height: 24),
              if (authState.isLoading) const CircularProgressIndicator(),
              if (authState.hasError)
                Text('Erreur: ${authState.error}',
                    style: const TextStyle(color: Colors.red)),
              ElevatedButton(
                onPressed: _submit,
                style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.teal,
                    minimumSize: const Size(double.infinity, 48)),
                child: Text(_isRegistering ? 'S\'inscrire' : 'Se connecter'),
              ),
              TextButton(
                onPressed: () =>
                    setState(() => _isRegistering = !_isRegistering),
                child: Text(_isRegistering
                    ? 'Déjà un compte ? Connectez-vous'
                    : 'Pas de compte ? Inscrivez-vous'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
