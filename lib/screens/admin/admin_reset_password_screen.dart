import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../theme/ultra_theme.dart';

/// SUPER_ADMIN tool: after verifying a user's identity out-of-band (phone,
/// in person), trigger a password reset link to be emailed to them
/// directly. The backend generates the token and sends the email — this
/// screen never sees a password.
class AdminResetPasswordScreen extends ConsumerStatefulWidget {
  const AdminResetPasswordScreen({super.key});

  @override
  ConsumerState<AdminResetPasswordScreen> createState() =>
      _AdminResetPasswordScreenState();
}

class _AdminResetPasswordScreenState
    extends ConsumerState<AdminResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;
  String? _sentTo;

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendResetLink() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final email = _emailCtrl.text.trim();
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api
          .post('/auth/admin/reset-password', data: {'email': email});
      if (!mounted) return;
      setState(() {
        _sentTo = resp.data['email'] as String? ?? email;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _startOver() {
    setState(() {
      _sentTo = null;
      _error = null;
      _emailCtrl.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Réinitialiser un mot de passe',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: UltraTheme.textPrimary)),
                const SizedBox(height: 6),
                const Text(
                  "Vérifiez d'abord l'identité de l'utilisateur par un canal "
                  'officiel (téléphone, en personne), puis envoyez-lui un '
                  'lien de réinitialisation par e-mail.',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      color: UltraTheme.textMuted),
                ),
                const SizedBox(height: 24),
                if (_sentTo != null)
                  _SentConfirmationCard(email: _sentTo!, onDone: _startOver)
                else
                  _buildForm(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildForm() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.12)),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextFormField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) {
                if (!_submitting) _sendResetLink();
              },
              decoration: InputDecoration(
                labelText: 'Email du compte utilisateur',
                prefixIcon: const Icon(Icons.email_outlined, size: 20),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                filled: true,
                fillColor: UltraTheme.background,
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Email requis';
                if (!v.contains('@')) return 'Email invalide';
                return null;
              },
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: UltraTheme.error.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(_error!,
                    style:
                        const TextStyle(color: UltraTheme.error, fontSize: 13)),
              ),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _submitting ? null : _sendResetLink,
                style: ElevatedButton.styleFrom(
                  backgroundColor: UltraTheme.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Envoyer un lien de réinitialisation',
                        style: TextStyle(
                            fontFamily: 'Inter', fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SentConfirmationCard extends StatelessWidget {
  const _SentConfirmationCard({required this.email, required this.onDone});

  final String email;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.success.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: UltraTheme.success.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.check_circle_rounded,
                color: UltraTheme.success, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text('Un lien de réinitialisation a été envoyé à $email.',
                  style: const TextStyle(
                      fontFamily: 'Inter',
                      fontWeight: FontWeight.w600,
                      color: UltraTheme.textPrimary)),
            ),
          ]),
          const SizedBox(height: 8),
          const Text(
            "Le lien expire dans 45 minutes et ne peut être utilisé qu'une "
            'seule fois.',
            style: TextStyle(
                fontFamily: 'Inter', fontSize: 12.5, color: UltraTheme.textMuted),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: OutlinedButton(
              onPressed: onDone,
              style: OutlinedButton.styleFrom(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Envoyer un autre lien',
                  style: TextStyle(
                      fontFamily: 'Inter', fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}
