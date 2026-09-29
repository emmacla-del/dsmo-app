import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/i18n/l10n_ext.dart';
import '../providers/auth_provider.dart';
import '../widgets/public_chrome.dart';
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
    WidgetsBinding.instance.addPostFrameCallback((_) => _verify());
  }

  Future<void> _verify() async {
    final token = widget.token;
    if (token == null || token.isEmpty) {
      setState(() {
        _loading = false;
        _success = false;
        _message = null;
      });
      return;
    }
    try {
      final message = await ref.read(authProvider.notifier).verifyEmail(token);
      if (!mounted) return;
      setState(() {
        _loading = false;
        _success = true;
        _message = message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _success = false;
        _message = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return PublicAuthScaffold(
      onLogoTap: () => router.go('/login'),
      child: PublicCard(
        padding: const EdgeInsets.all(28),
        child: _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    if (_loading) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Column(
          children: [
            const CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation(PublicColors.green)),
            const SizedBox(height: 16),
            Text(context.l10n.verifyingInProgress,
                style:
                    const TextStyle(fontSize: 14, color: PublicColors.gray500)),
          ],
        ),
      );
    }

    return Column(
      children: [
        Icon(
          _success ? Icons.check_circle_outline : Icons.error_outline,
          size: 48,
          color: _success ? PublicColors.green : PublicColors.red,
        ),
        const SizedBox(height: 16),
        Text(
          _success
              ? context.l10n.emailVerifiedTitle
              : context.l10n.verificationFailedTitle,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Text(
          _message ??
              (_success ? '' : context.l10n.invalidVerificationLink),
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, color: PublicColors.gray500),
        ),
        const SizedBox(height: 24),
        PublicPrimaryButton(
          onPressed: () => router.go(_success ? '/home' : '/login'),
          label: _success
              ? context.l10n.registerContinueButton
              : context.l10n.backToLogin,
          expanded: true,
        ),
      ],
    );
  }
}
