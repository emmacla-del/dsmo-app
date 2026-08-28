import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/i18n/l10n_ext.dart';
import '../providers/auth_provider.dart';
import '../widgets/public_chrome.dart';
import '../main.dart' show router;

class ResetPasswordScreen extends ConsumerStatefulWidget {
  final String? token;
  const ResetPasswordScreen({super.key, this.token});

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _obscure = true;
  bool _submitting = false;
  bool _done = false;
  String? _errorMessage;

  @override
  void dispose() {
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
          .resetPassword(widget.token!, _passwordCtrl.text);
      if (mounted) setState(() => _done = true);
    } catch (e) {
      if (mounted) setState(() => _errorMessage = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PublicAuthScaffold(
      onLogoTap: () => router.go('/'),
      child: Column(
        children: [
          Text(
            context.l10n.resetPasswordTitle,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: PublicColors.gray900,
            ),
          ),
          const SizedBox(height: 20),
          PublicCard(
            padding: const EdgeInsets.all(24),
            child: _buildContent(),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (widget.token == null || widget.token!.isEmpty) {
      return _Message(
        icon: Icons.error_outline,
        color: PublicColors.red,
        text: context.l10n.resetPasswordInvalidLink,
        actionLabel: context.l10n.backToLogin,
        onAction: () => router.go('/login'),
      );
    }

    if (_done) {
      return _Message(
        icon: Icons.check_circle_outline,
        color: PublicColors.green,
        text: context.l10n.resetPasswordSuccess,
        actionLabel: context.l10n.connectButton,
        onAction: () => router.go('/login'),
      );
    }

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.l10n.chooseNewPassword,
              style:
                  const TextStyle(fontSize: 14, color: PublicColors.gray500)),
          const SizedBox(height: 22),
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
              labelText: context.l10n.registerConfirmPasswordLabel,
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
            label: context.l10n.resetButton,
            expanded: true,
          ),
        ],
      ),
    );
  }
}

class _Message extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;
  final String actionLabel;
  final VoidCallback onAction;

  const _Message({
    required this.icon,
    required this.color,
    required this.text,
    required this.actionLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 48, color: color),
        const SizedBox(height: 16),
        Text(text,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: PublicColors.gray500)),
        const SizedBox(height: 24),
        PublicPrimaryButton(
          onPressed: onAction,
          label: actionLabel,
          expanded: true,
        ),
      ],
    );
  }
}
