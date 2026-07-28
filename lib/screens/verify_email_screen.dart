import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../theme/app_colors.dart';
import '../main.dart' show router;

class VerifyEmailScreen extends ConsumerStatefulWidget {
  final String? token;
  const VerifyEmailScreen({super.key, this.token});

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  bool _loading = true;
  bool _success = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _verify();
  }

  Future<void> _verify() async {
    final token = widget.token;
    if (token == null || token.isEmpty) {
      setState(() {
        _loading = false;
        _success = false;
        _message = 'Lien de vérification invalide. Veuillez refaire une '
            'demande depuis votre compte.';
      });
      return;
    }
    try {
      final message =
          await ref.read(authProvider.notifier).verifyEmail(token);
      setState(() {
        _loading = false;
        _success = true;
        _message = message;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _success = false;
        _message = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 40),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withAlpha(12),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: _buildContent(),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Column(
          children: [
            CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation(AppColors.deepEmerald)),
            SizedBox(height: 16),
            Text('Vérification en cours...',
                style: TextStyle(fontSize: 14, color: AppColors.slate)),
          ],
        ),
      );
    }

    return Column(
      children: [
        Icon(
          _success ? Icons.check_circle_outline : Icons.error_outline,
          size: 48,
          color: _success ? AppColors.deepEmerald : Colors.red,
        ),
        const SizedBox(height: 16),
        Text(
          _success ? 'Adresse e-mail vérifiée' : 'Vérification impossible',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Text(
          _message ?? '',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, color: AppColors.slate),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: () => router.go(_success ? '/home' : '/'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.deepEmerald,
              foregroundColor: Colors.white,
              shape:
                  RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
            child: Text(_success ? 'Continuer' : 'Retour à la connexion',
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }
}
