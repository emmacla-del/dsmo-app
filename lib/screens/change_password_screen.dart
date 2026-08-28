import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/i18n/l10n_ext.dart';
import '../providers/auth_provider.dart';
import '../widgets/public_chrome.dart';
import '../main.dart' show router;

/// Forced password change after an admin-issued temporary password.
/// Reached only via the mustChangePassword redirect after login — there's
/// no way back to the rest of the app until this succeeds. The logo is
/// not tappable so the user cannot leave via the landing page.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _obscure = true;
  bool _submitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      await ref
          .read(authProvider.notifier)
          .changePassword(_currentCtrl.text, _passwordCtrl.text);
      if (mounted) router.go('/home');
    } catch (e) {
      if (mounted) setState(() => _errorMessage = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: PublicAuthScaffold(
        child: Column(
          children: [
            Text(
              context.l10n.changePasswordRequiredTitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: PublicColors.gray900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              context.l10n.changePasswordRequiredBody,
              textAlign: TextAlign.center,
              style:
                  const TextStyle(fontSize: 13, color: PublicColors.gray500),
            ),
            const SizedBox(height: 20),
            PublicCard(
              padding: const EdgeInsets.all(24),
              child: _buildForm(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextFormField(
            controller: _currentCtrl,
            obscureText: _obscure,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: context.l10n.temporaryPasswordLabel,
              prefixIcon: const Icon(Icons.password_outlined, size: 20),
            ),
            validator: (v) => (v == null || v.isEmpty)
                ? context.l10n.temporaryPasswordRequired
                : null,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _passwordCtrl,
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
              if (!_submitting) _submit();
            },
            decoration: InputDecoration(
              labelText: context.l10n.confirmNewPasswordLabel,
              prefixIcon: const Icon(Icons.lock_outline, size: 20),
            ),
            validator: (v) {
              if (v != _passwordCtrl.text) {
                return context.l10n.registerPasswordsDontMatch;
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          if (_errorMessage != null) PublicErrorBox(_errorMessage!),
          PublicPrimaryButton(
            isBusy: _submitting,
            onPressed: _submit,
            label: context.l10n.changePasswordButton,
            expanded: true,
          ),
        ],
      ),
    );
  }
}
