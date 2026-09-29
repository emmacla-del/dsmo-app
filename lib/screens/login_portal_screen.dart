// CAMLEAP login portal — reached at '/login'.
// Sign in | Forgot ID. Registration lives on '/register'; password reset
// on '/forgot-password'. Logo tap returns to the landing page.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/i18n/l10n_ext.dart';
import '../data/api_client.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../widgets/public_chrome.dart';
import '../widgets/responsive_helpers.dart';
import '../main.dart' show router;

const String _supportWhatsappNumber = '237651965905';
const String _supportPhoneDisplay = '+237 6 51 96 59 05';

Future<void> _launchSupportWhatsApp(
    BuildContext context, String message) async {
  final uri = Uri.https('wa.me', _supportWhatsappNumber, {'text': message});
  try {
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched) throw Exception('launchUrl returned false');
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: PublicColors.red,
        content: Text(
          context.l10n.portalWhatsappNotFound(_supportPhoneDisplay),
        ),
      ),
    );
  }
}

class LoginPortalScreen extends ConsumerStatefulWidget {
  const LoginPortalScreen({super.key});

  @override
  ConsumerState<LoginPortalScreen> createState() => _LoginPortalScreenState();
}

class _LoginPortalScreenState extends ConsumerState<LoginPortalScreen>
    with SingleTickerProviderStateMixin {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _twoFactorCodeCtrl = TextEditingController();

  bool _obscure = true;
  bool _rememberMe = true;
  bool _submitting = false;
  bool _twoFactorSubmitting = false;
  int _tab = 0; // 0=login 1=forgot ID

  late final AnimationController _fadeCtrl;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 280));
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _fadeCtrl.forward();
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _twoFactorCodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      await ref.read(authProvider.notifier).login(
            _emailCtrl.text.trim(),
            _passwordCtrl.text,
            remember: _rememberMe,
          );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitTwoFactor() async {
    if (_twoFactorSubmitting) return;
    setState(() => _twoFactorSubmitting = true);
    try {
      await ref
          .read(authProvider.notifier)
          .verifyTwoFactorCode(_twoFactorCodeCtrl.text.trim());
    } finally {
      if (mounted) setState(() => _twoFactorSubmitting = false);
    }
  }

  void _cancelTwoFactor() {
    _twoFactorCodeCtrl.clear();
    ref.read(authProvider.notifier).cancelTwoFactorChallenge();
  }

  void _switchTab(int t) {
    setState(() => _tab = t);
    _fadeCtrl
      ..reset()
      ..forward();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<dynamic>>(authProvider, (_, next) {
      if (next is AsyncData && next.value is User) {
        final user = next.value as User;
        router.go(user.mustChangePassword ? '/change-password' : '/home');
      }
    });

    final authState = ref.watch(authProvider);
    final twoFactorToken = ref.watch(twoFactorChallengeProvider);
    final bool isBusy = _submitting || authState.isLoading;
    // auth_provider's login/verifyTwoFactorCode already put the server's
    // real message on AsyncValue.error (ApiException.message — lockout
    // text, "code invalide", etc., already bilingual fr/en from the
    // backend, same as everywhere else ApiException.message is shown
    // directly). Prefer that over the generic fallback strings so the
    // user sees the actual reason instead of a blanket "wrong
    // credentials" whenever the server sent one.
    final Object? authErrorObj = authState.error;
    final String? serverMessage = authErrorObj is ApiException
        ? authErrorObj.message
        : authErrorObj?.toString();
    final String? authError = authState.hasError && !isBusy
        ? ((serverMessage != null && serverMessage.trim().isNotEmpty)
            ? serverMessage
            : (twoFactorToken != null
                ? context.l10n.portalTwoFactorCodeError
                : context.l10n.portalCredentialsError))
        : null;

    return PublicAuthScaffold(
      onLogoTap: () => router.go('/login'),
      child: twoFactorToken != null
          ? PublicCard(
              padding: EdgeInsets.fromLTRB(
                  context.isMobile ? 16 : 28, 24, context.isMobile ? 16 : 28, 28),
              child: _TwoFactorPane(
                codeCtrl: _twoFactorCodeCtrl,
                isBusy: _twoFactorSubmitting || authState.isLoading,
                authError: authError,
                onSubmit: _submitTwoFactor,
                onCancel: _cancelTwoFactor,
              ),
            )
          : PublicCard(
              clip: true,
              child: _LoginCard(
                tab: _tab,
                onTabChange: _switchTab,
                emailCtrl: _emailCtrl,
                passwordCtrl: _passwordCtrl,
                obscure: _obscure,
                onToggleObscure: () => setState(() => _obscure = !_obscure),
                rememberMe: _rememberMe,
                onToggleRememberMe: (v) => setState(() => _rememberMe = v),
                isBusy: isBusy,
                authError: authError,
                onSubmit: _submit,
                fadeAnim: _fadeAnim,
              ),
            ),
    );
  }
}

class _LoginCard extends StatelessWidget {
  final int tab;
  final ValueChanged<int> onTabChange;
  final TextEditingController emailCtrl, passwordCtrl;
  final bool obscure, isBusy;
  final bool rememberMe;
  final ValueChanged<bool> onToggleRememberMe;
  final String? authError;
  final VoidCallback onToggleObscure, onSubmit;
  final Animation<double> fadeAnim;

  const _LoginCard({
    required this.tab,
    required this.onTabChange,
    required this.emailCtrl,
    required this.passwordCtrl,
    required this.obscure,
    required this.isBusy,
    required this.rememberMe,
    required this.onToggleRememberMe,
    required this.authError,
    required this.onToggleObscure,
    required this.onSubmit,
    required this.fadeAnim,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _AuthTabBar(current: tab, onTap: onTabChange),
        Padding(
          padding: EdgeInsets.fromLTRB(
              context.isMobile ? 16 : 28, 20, context.isMobile ? 16 : 28, 28),
          child: FadeTransition(
            opacity: fadeAnim,
            child: tab == 0
                ? _LoginPane(
                    emailCtrl: emailCtrl,
                    passwordCtrl: passwordCtrl,
                    obscure: obscure,
                    onToggleObscure: onToggleObscure,
                    rememberMe: rememberMe,
                    onToggleRememberMe: onToggleRememberMe,
                    isBusy: isBusy,
                    authError: authError,
                    onSubmit: onSubmit,
                  )
                : const _ForgotPane(),
          ),
        ),
      ],
    );
  }
}

class _TwoFactorPane extends StatefulWidget {
  final TextEditingController codeCtrl;
  final bool isBusy;
  final String? authError;
  final VoidCallback onSubmit, onCancel;

  const _TwoFactorPane({
    required this.codeCtrl,
    required this.isBusy,
    required this.authError,
    required this.onSubmit,
    required this.onCancel,
  });

  @override
  State<_TwoFactorPane> createState() => _TwoFactorPaneState();
}

class _TwoFactorPaneState extends State<_TwoFactorPane> {
  final _formKey = GlobalKey<FormState>();

  void _handleSubmit() {
    if (_formKey.currentState!.validate()) widget.onSubmit();
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.l10n.twoFactorTitle,
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: PublicColors.gray900)),
          const SizedBox(height: 6),
          Text(
            context.l10n.twoFactorBody,
            style: const TextStyle(
                fontSize: 13, color: PublicColors.gray700, height: 1.4),
          ),
          const SizedBox(height: 18),
          if (widget.authError != null) PublicErrorBox(widget.authError!),
          _FieldRow(
            label: context.l10n.codeLabel,
            child: TextFormField(
              controller: widget.codeCtrl,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              maxLength: 6,
              onFieldSubmitted: (_) => _handleSubmit(),
              style: const TextStyle(
                  fontSize: 18, letterSpacing: 4, color: PublicColors.gray900),
              decoration: _dgiInput(hint: '000000').copyWith(counterText: ''),
              validator: (v) {
                if (v == null || v.trim().length != 6) {
                  return context.l10n.codeRequired;
                }
                return null;
              },
            ),
          ),
          const SizedBox(height: 18),
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 16,
            runSpacing: 10,
            children: [
              PublicPrimaryButton(
                isBusy: widget.isBusy,
                onPressed: _handleSubmit,
                label: context.l10n.verifyButton,
              ),
              TextButton(
                onPressed: widget.isBusy ? null : widget.onCancel,
                child: Text(
                  context.l10n.backToLogin,
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: PublicColors.green),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AuthTabBar extends StatelessWidget {
  final int current;
  final ValueChanged<int> onTap;
  const _AuthTabBar({required this.current, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final labels = [
      context.l10n.tabSignIn,
      context.l10n.tabForgotId,
    ];
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: PublicColors.gray200)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: List.generate(labels.length, (i) {
          final active = current == i;
          return Expanded(
            child: GestureDetector(
              onTap: () => onTap(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding:
                    const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
                margin: const EdgeInsets.only(right: 6),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: active ? PublicColors.green : Colors.transparent,
                      width: 3,
                    ),
                  ),
                ),
                child: Text(
                  labels[i],
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: active ? PublicColors.greenDark : PublicColors.green,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _LoginPane extends StatefulWidget {
  final TextEditingController emailCtrl, passwordCtrl;
  final bool obscure, isBusy;
  final bool rememberMe;
  final ValueChanged<bool> onToggleRememberMe;
  final String? authError;
  final VoidCallback onToggleObscure, onSubmit;

  const _LoginPane({
    required this.emailCtrl,
    required this.passwordCtrl,
    required this.obscure,
    required this.isBusy,
    required this.rememberMe,
    required this.onToggleRememberMe,
    required this.authError,
    required this.onToggleObscure,
    required this.onSubmit,
  });

  @override
  State<_LoginPane> createState() => _LoginPaneState();
}

class _LoginPaneState extends State<_LoginPane> {
  final _formKey = GlobalKey<FormState>();

  void _handleSubmit() {
    if (_formKey.currentState!.validate()) widget.onSubmit();
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.authError != null) PublicErrorBox(widget.authError!),
          _FieldRow(
            label: context.l10n.loginLabel,
            child: TextFormField(
              controller: widget.emailCtrl,
              keyboardType: TextInputType.text,
              textInputAction: TextInputAction.next,
              style: const TextStyle(fontSize: 14, color: PublicColors.gray900),
              decoration: _dgiInput(hint: context.l10n.loginHint),
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return context.l10n.requiredShort;
                }
                return null;
              },
            ),
          ),
          const SizedBox(height: 12),
          _FieldRow(
            label: context.l10n.passwordLabel,
            child: TextFormField(
              controller: widget.passwordCtrl,
              obscureText: widget.obscure,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _handleSubmit(),
              style: const TextStyle(fontSize: 14, color: PublicColors.gray900),
              decoration: _dgiInput(
                hint: '••••••••',
                suffix: IconButton(
                  icon: Icon(
                    widget.obscure
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    size: 15,
                    color: PublicColors.gray400,
                  ),
                  onPressed: widget.onToggleObscure,
                  padding: EdgeInsets.zero,
                  constraints:
                      const BoxConstraints(minWidth: 44, minHeight: 44),
                ),
              ),
              validator: (v) =>
                  (v == null || v.isEmpty) ? context.l10n.requiredShort : null,
            ),
          ),
          const SizedBox(height: 18),
          _buildSubmitRow(context),
          const SizedBox(height: 16),
          Center(
            child: Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  context.l10n.noAccountPrompt,
                  style: const TextStyle(
                      fontSize: 13, color: PublicColors.gray500),
                ),
                TextButton(
                  onPressed: () => router.go('/register'),
                  child: Text(
                    context.l10n.tabCreateAccount,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: PublicColors.green),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitRow(BuildContext context) {
    final rememberMe = InkWell(
      onTap: () => widget.onToggleRememberMe(!widget.rememberMe),
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Checkbox(
              value: widget.rememberMe,
              onChanged: (v) => widget.onToggleRememberMe(v ?? true),
              activeColor: PublicColors.green,
              side: const BorderSide(color: PublicColors.gray400),
            ),
            const SizedBox(width: 6),
            Text(context.l10n.rememberMe,
                style:
                    const TextStyle(fontSize: 13, color: PublicColors.gray700)),
          ],
        ),
      ),
    );

    final forgotLink = TextButton(
      onPressed: () => router.go('/forgot-password'),
      child: Text(
        context.l10n.forgotPassword,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: PublicColors.green,
        ),
      ),
    );

    final connectButton = PublicPrimaryButton(
      isBusy: widget.isBusy,
      onPressed: _handleSubmit,
      label: context.l10n.connectButton,
    );

    if (context.isMobile) {
      return Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [rememberMe, forgotLink],
          ),
          const SizedBox(height: 14),
          SizedBox(width: double.infinity, child: connectButton),
        ],
      );
    }

    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 16,
      runSpacing: 10,
      children: [rememberMe, connectButton, forgotLink],
    );
  }
}

class _ForgotPane extends ConsumerStatefulWidget {
  const _ForgotPane();

  @override
  ConsumerState<_ForgotPane> createState() => _ForgotPaneState();
}

class _ForgotPaneState extends ConsumerState<_ForgotPane> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _niuCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  bool _submitting = false;
  String? _error;
  String? _foundEstablishmentId;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _niuCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await ref.read(apiClientProvider).findIdentifier(
            companyName: _nameCtrl.text.trim(),
            taxNumber: _niuCtrl.text.trim(),
            phone: _phoneCtrl.text.trim(),
          );
      if (!mounted) return;
      setState(
          () => _foundEstablishmentId = result['establishmentId'] as String?);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error =
          e is ApiException ? e.message : context.l10n.genericErrorShort);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _reset() {
    setState(() {
      _foundEstablishmentId = null;
      _error = null;
      _nameCtrl.clear();
      _niuCtrl.clear();
      _phoneCtrl.clear();
    });
  }

  void _copyId() {
    final id = _foundEstablishmentId;
    if (id == null) return;
    Clipboard.setData(ClipboardData(text: id));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: PublicColors.green,
        content: Text(context.l10n.idCopiedSnackbar),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _foundEstablishmentId != null ? _buildResult() : _buildForm();
  }

  Widget _buildForm() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.l10n.forgotIntro,
            style: const TextStyle(
                fontSize: 12.5, color: PublicColors.gray500, height: 1.5),
          ),
          const SizedBox(height: 16),
          if (_error != null) PublicErrorBox(_error!),
          _FieldRow(
            label: context.l10n.organizationLabel,
            child: TextFormField(
              controller: _nameCtrl,
              textInputAction: TextInputAction.next,
              style: const TextStyle(fontSize: 14, color: PublicColors.gray900),
              decoration: _dgiInput(hint: context.l10n.organizationHint),
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? context.l10n.requiredShort
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          _FieldRow(
            label: context.l10n.niuLabel,
            child: TextFormField(
              controller: _niuCtrl,
              textInputAction: TextInputAction.next,
              style: const TextStyle(fontSize: 14, color: PublicColors.gray900),
              decoration: _dgiInput(hint: context.l10n.niuHint),
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? context.l10n.requiredShort
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          _FieldRow(
            label: context.l10n.phoneLabel,
            child: TextFormField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) {
                if (!_submitting) _submit();
              },
              style: const TextStyle(fontSize: 14, color: PublicColors.gray900),
              decoration: _dgiInput(hint: context.l10n.phoneHintShort),
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? context.l10n.requiredShort
                  : null,
            ),
          ),
          const SizedBox(height: 20),
          PublicPrimaryButton(
            isBusy: _submitting,
            onPressed: _submit,
            label: context.l10n.searchButton,
            expanded: true,
          ),
          const SizedBox(height: 16),
          Center(
            child: TextButton(
              onPressed: () => _launchSupportWhatsApp(
                context,
                context.l10n.supportWhatsappMessage,
              ),
              child: Text(
                context.l10n.supportContactLink,
                style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: PublicColors.green),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResult() {
    return Column(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: PublicColors.greenLight,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.check_circle_outline_rounded,
              color: PublicColors.green, size: 26),
        ),
        const SizedBox(height: 14),
        Text(
          context.l10n.idFoundTitle,
          style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: PublicColors.gray700),
        ),
        const SizedBox(height: 14),
        GestureDetector(
          onTap: _copyId,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: PublicColors.greenLight,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: PublicColors.greenMid),
            ),
            child: Column(
              children: [
                Text(
                  context.l10n.establishmentIdLabel,
                  style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: PublicColors.green,
                      letterSpacing: 0.5),
                ),
                const SizedBox(height: 6),
                Text(
                  _foundEstablishmentId!,
                  style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: PublicColors.greenDark,
                      letterSpacing: 1),
                ),
                const SizedBox(height: 4),
                Text(context.l10n.tapToCopy,
                    style: const TextStyle(
                        fontSize: 11, color: PublicColors.green)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        TextButton(
          onPressed: _reset,
          child: Text(
            context.l10n.newSearchButton,
            style: const TextStyle(
                color: PublicColors.gray500, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

class _FieldRow extends StatelessWidget {
  final String label;
  final Widget child;
  const _FieldRow({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    if (context.isMobile) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 6, left: 2),
            child: Text(
              label,
              style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: PublicColors.gray700),
            ),
          ),
          child,
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 110,
          child: Padding(
            padding: const EdgeInsets.only(top: 10, right: 8),
            child: Text(
              label,
              textAlign: TextAlign.right,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: PublicColors.gray700),
            ),
          ),
        ),
        Expanded(child: child),
      ],
    );
  }
}

InputDecoration _dgiInput({required String hint, Widget? suffix}) {
  return InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: PublicColors.gray400, fontSize: 14),
    suffixIcon: suffix,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
    filled: true,
    fillColor: Colors.white,
    border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: PublicColors.gray200, width: 1.5)),
    enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: PublicColors.gray200, width: 1.5)),
    focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: PublicColors.green, width: 1.5)),
    errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: PublicColors.red, width: 1.5)),
    focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: PublicColors.red, width: 2)),
  );
}
