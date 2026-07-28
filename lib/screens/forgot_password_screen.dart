import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/api_client.dart';
import '../theme/app_colors.dart';
import '../main.dart' show router;

/// Self-service password reset via security questions — demo flow, not
/// production-hardened (no rate limiting/lockout on the backend).
/// Step 1: enter login, fetch 2 random questions.
/// Step 2: answer both + set a new password.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _step1FormKey = GlobalKey<FormState>();
  final _step2FormKey = GlobalKey<FormState>();
  final _loginCtrl = TextEditingController();
  final _newPasswordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  List<Map<String, String>> _questions = [];
  final Map<String, TextEditingController> _answerCtrls = {};

  int _step = 0; // 0 = enter login, 1 = answer questions, 2 = done
  bool _submitting = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _loginCtrl.dispose();
    _newPasswordCtrl.dispose();
    _confirmCtrl.dispose();
    for (final c in _answerCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _fetchQuestions() async {
    if (!_step1FormKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.post('/auth/reset/questions', data: {
        'login': _loginCtrl.text.trim(),
      });
      final questions = (resp.data['questions'] as List)
          .map((q) => {
                'key': q['key'] as String,
                'question': q['question'] as String,
              })
          .toList();
      if (!mounted) return;
      setState(() {
        _questions = questions;
        for (final q in questions) {
          _answerCtrls[q['key']!] = TextEditingController();
        }
        _step = 1;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitAnswers() async {
    if (!_step2FormKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final answers = {
        for (final entry in _answerCtrls.entries)
          entry.key: entry.value.text.trim(),
      };
      await api.post('/auth/reset/verify', data: {
        'login': _loginCtrl.text.trim(),
        'answers': answers,
        'newPassword': _newPasswordCtrl.text,
      });
      if (!mounted) return;
      setState(() => _step = 2);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _backToStep1() {
    setState(() {
      _step = 0;
      _error = null;
      _questions = [];
      for (final c in _answerCtrls.values) {
        c.dispose();
      }
      _answerCtrls.clear();
    });
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
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppColors.deepEmerald,
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.deepEmerald.withAlpha(80),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.lock_reset,
                        size: 40, color: Colors.white),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    _step == 2
                        ? 'Mot de passe réinitialisé'
                        : 'Mot de passe oublié',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _stepSubtitle(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13, color: AppColors.slate),
                  ),
                  const SizedBox(height: 32),
                  Container(
                    padding: const EdgeInsets.all(24),
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
                    child: _buildStepContent(),
                  ),
                  if (_step != 2) ...[
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () => router.go('/'),
                      child: const Text("Retour à la connexion",
                          style: TextStyle(color: AppColors.slate)),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _stepSubtitle() {
    switch (_step) {
      case 0:
        return "Entrez l'adresse e-mail de votre compte pour commencer.";
      case 1:
        return 'Répondez aux deux questions et choisissez un nouveau mot de '
            'passe.';
      default:
        return 'Vous pouvez maintenant vous connecter avec votre nouveau '
            'mot de passe.';
    }
  }

  Widget _buildStepContent() {
    switch (_step) {
      case 0:
        return _buildStep1Form();
      case 1:
        return _buildStep2Form();
      default:
        return _buildSuccess();
    }
  }

  Widget _buildErrorBox() {
    if (_error == null) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        border: Border.all(color: Colors.red.shade200),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(_error!,
          style: const TextStyle(color: Colors.red, fontSize: 13)),
    );
  }

  Widget _buildStep1Form() {
    return Form(
      key: _step1FormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextFormField(
            controller: _loginCtrl,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) {
              if (!_submitting) _fetchQuestions();
            },
            decoration: InputDecoration(
              labelText: 'Email du compte',
              prefixIcon: const Icon(Icons.email_outlined, size: 20),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.grey.shade50,
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Email requis';
              if (!v.contains('@')) return 'Email invalide';
              return null;
            },
          ),
          const SizedBox(height: 20),
          _buildErrorBox(),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _submitting ? null : _fetchQuestions,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.deepEmerald,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Continuer',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep2Form() {
    return Form(
      key: _step2FormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final q in _questions) ...[
            Text(q['question']!,
                style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.obsidian)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _answerCtrls[q['key']],
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.grey.shade50,
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Réponse requise' : null,
            ),
            const SizedBox(height: 16),
          ],
          TextFormField(
            controller: _newPasswordCtrl,
            obscureText: _obscure,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: 'Nouveau mot de passe',
              prefixIcon: const Icon(Icons.lock_outline, size: 20),
              suffixIcon: IconButton(
                icon: Icon(_obscure
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined),
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.grey.shade50,
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Mot de passe requis';
              if (v.length < 8) return 'Au moins 8 caractères';
              return null;
            },
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _confirmCtrl,
            obscureText: _obscure,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) {
              if (!_submitting) _submitAnswers();
            },
            decoration: InputDecoration(
              labelText: 'Confirmer le nouveau mot de passe',
              prefixIcon: const Icon(Icons.lock_outline, size: 20),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.grey.shade50,
            ),
            validator: (v) {
              if (v != _newPasswordCtrl.text) {
                return 'Les mots de passe ne correspondent pas';
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          _buildErrorBox(),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submitAnswers,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.deepEmerald,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Réinitialiser le mot de passe',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _submitting ? null : _backToStep1,
            child: const Text('Retour',
                style: TextStyle(color: AppColors.slate)),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccess() {
    return Column(
      children: [
        const Icon(Icons.check_circle_rounded,
            color: AppColors.deepEmerald, size: 40),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: () => router.go('/'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.deepEmerald,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
            child: const Text('Aller à la connexion',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }
}
