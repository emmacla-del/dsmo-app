import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/i18n/l10n_ext.dart';
import '../data/api_client.dart';
import '../widgets/public_chrome.dart';
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

  String _title(BuildContext context) {
    return _step == 2
        ? context.l10n.forgotPasswordResetDoneTitle
        : context.l10n.forgotPasswordTitle;
  }

  String _subtitle(BuildContext context) {
    switch (_step) {
      case 0:
        return context.l10n.forgotPasswordStep1Subtitle;
      case 1:
        return context.l10n.forgotPasswordStep2Subtitle;
      default:
        return context.l10n.forgotPasswordDoneSubtitle;
    }
  }

  @override
  Widget build(BuildContext context) {
    return PublicAuthScaffold(
      onLogoTap: () => router.go('/login'),
      child: Column(
        children: [
          Text(
            _title(context),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: PublicColors.gray900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _subtitle(context),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: PublicColors.gray500),
          ),
          const SizedBox(height: 20),
          PublicCard(
            padding: const EdgeInsets.all(24),
            child: _buildStepContent(),
          ),
          if (_step != 2) ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => router.go('/login'),
              child: Text(
                context.l10n.backToLogin,
                style: const TextStyle(color: PublicColors.gray500),
              ),
            ),
          ],
        ],
      ),
    );
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
              labelText: context.l10n.accountEmailLabel,
              prefixIcon: const Icon(Icons.email_outlined, size: 20),
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) {
                return context.l10n.emailRequiredShort;
              }
              if (!v.contains('@')) return context.l10n.emailInvalid;
              return null;
            },
          ),
          const SizedBox(height: 20),
          if (_error != null) PublicErrorBox(_error!),
          PublicPrimaryButton(
            isBusy: _submitting,
            onPressed: _fetchQuestions,
            label: context.l10n.registerContinueButton,
            expanded: true,
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
                    color: PublicColors.gray900)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _answerCtrls[q['key']],
              textInputAction: TextInputAction.next,
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? context.l10n.answerRequiredShort
                  : null,
            ),
            const SizedBox(height: 16),
          ],
          TextFormField(
            controller: _newPasswordCtrl,
            obscureText: _obscure,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: context.l10n.newPasswordLabel,
              prefixIcon: const Icon(Icons.lock_outline, size: 20),
              suffixIcon: IconButton(
                icon: Icon(_obscure
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined),
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) {
                return context.l10n.registerPasswordRequired;
              }
              if (v.length < 8) return context.l10n.registerPasswordMinChars;
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
              labelText: context.l10n.confirmNewPasswordLabel,
              prefixIcon: const Icon(Icons.lock_outline, size: 20),
            ),
            validator: (v) {
              if (v != _newPasswordCtrl.text) {
                return context.l10n.registerPasswordsDontMatch;
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          if (_error != null) PublicErrorBox(_error!),
          PublicPrimaryButton(
            isBusy: _submitting,
            onPressed: _submitAnswers,
            label: context.l10n.resetPasswordButton,
            expanded: true,
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _submitting ? null : _backToStep1,
            child: Text(context.l10n.backLabel,
                style: const TextStyle(color: PublicColors.gray500)),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccess() {
    return PublicPrimaryButton(
      onPressed: () => router.go('/login'),
      label: context.l10n.goToSignIn,
      expanded: true,
    );
  }
}
