// lib/screens/minefop_portal_screen.dart
//
// MINEFOP DSMO Digital — Portal Login Screen
// Matches the HTML DGI-style design exactly:
//   • Full-page coat-of-arms watermark (cover, 12% opacity)
//   • Dark teal banner with crest + flag strip
//   • Quick-links row (centered, max width 480)
//   • Two action buttons (centered, max width 480)
//   • Login card with tab bar (max width 480)
//   • DGI-style label | field inline rows
//
// Wires into: authProvider, router (go_router)

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../main.dart' show router;

// ─── Palette ─────────────────────────────────────────────
class _C {
  static const green = Color(0xFF005F54);
  static const greenDark = Color(0xFF003D35);
  static const greenLight = Color(0xFFEAF6F4);
  static const greenMid = Color(0xFFD0EDE9);
  static const gray100 = Color(0xFFF3F4F6);
  static const gray200 = Color(0xFFE5E7EB);
  static const gray400 = Color(0xFF9CA3AF);
  static const gray500 = Color(0xFF6B7280);
  static const gray700 = Color(0xFF374151);
  static const gray900 = Color(0xFF111827);
  static const bg = Color(0xFFF9FAFB);
  static const red = Color(0xFFB91C1C);
  static const redFaint = Color(0xFFFEF2F2);
  static const redBorder = Color(0xFFFECACA);
}

// ═══════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════

class MinefopPortalScreen extends ConsumerStatefulWidget {
  const MinefopPortalScreen({super.key});

  @override
  ConsumerState<MinefopPortalScreen> createState() =>
      _MinefopPortalScreenState();
}

class _MinefopPortalScreenState extends ConsumerState<MinefopPortalScreen>
    with SingleTickerProviderStateMixin {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  bool _obscure = true;
  bool _submitting = false;
  int _tab = 0; // 0=login 1=register 2=forgot

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
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(authProvider.notifier)
          .login(_emailCtrl.text.trim(), _passwordCtrl.text);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
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
      if (next is AsyncData && next.value != null) router.go('/home');
    });

    final authState = ref.watch(authProvider);
    final bool isBusy = _submitting || authState.isLoading;
    final String? authError = authState.hasError && !isBusy
        ? 'Identifiants incorrects. Vérifiez et réessayez.'
        : null;

    return Scaffold(
      backgroundColor: _C.bg,
      body: Stack(
        children: [
          // ── Full-page watermark (covers entire screen) ──────────
          Positioned.fill(
            child: Align(
              alignment: Alignment.center,
              child: Opacity(
                opacity: 0.07, // lower — more tasteful
                child: Image.asset(
                  'assets/images/coat_of_arms.png',
                  width: 700, // fixed natural size, no cover/crop
                  height: 600,
                  fit: BoxFit.contain, // never distorts
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
            ),
          ),

          // ── Page content ─────────────────────────────────
          Column(
            children: [
              // Banner (always full width)
              _Banner(),

              // Scrollable body
              Expanded(
                child: SingleChildScrollView(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 480),
                      child: Column(
                        children: [
                          // Action buttons
                          _ActionButtons(onTabChange: _switchTab),

                          // Login card
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
                            child: _LoginCard(
                              tab: _tab,
                              onTabChange: _switchTab,
                              emailCtrl: _emailCtrl,
                              passwordCtrl: _passwordCtrl,
                              obscure: _obscure,
                              onToggleObscure: () =>
                                  setState(() => _obscure = !_obscure),
                              isBusy: isBusy,
                              authError: authError,
                              onSubmit: _submit,
                              fadeAnim: _fadeAnim,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // Footer (full width)
              _Footer(),
            ],
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// BANNER (full width, fixed height)
// ═══════════════════════════════════════════════════════════

class _Banner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 960),
        child: Container(
          height: 85,
          margin: const EdgeInsets.fromLTRB(16, 16, 16, 20),
          clipBehavior: Clip.hardEdge,
          decoration: const BoxDecoration(
            color: Color(0xFF003D35),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Full‑width coat of arms (stretched across entire banner)
              Image.asset(
                'assets/images/coat_of_arms.png',
                fit: BoxFit.cover,
                alignment: const Alignment(0, 0.05), // ← tweak the vertical offset
                errorBuilder: (_, __, ___) =>
                    Container(color: const Color(0xFF004D43)),
              ),

              // Gradient fade: solid left → transparent right
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(0xFF003D35),
                      Color(0xCC003D35),
                      Colors.transparent,
                    ],
                    stops: [0.0, 0.45, 0.75],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                ),
              ),

              // Content row: MINEFOP logo left + text left-aligned (unchanged)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(
                  children: [
                    // MINEFOP logo — extreme left
                    Image.asset(
                      'assets/images/minefop-logo.png',
                      width: 60,
                      height: 60,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Text('M',
                              style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Text — left aligned
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Ministère de l'Emploi et de la Formation Professionnelle",
                            style: TextStyle(
                              fontSize: 16, // increased from 9
                              fontWeight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.9),
                              letterSpacing: 0.6,
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'DSMO  DIGITAL',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: 1.8,
                              height: 1.1,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════ // ═══════════════════════════════════════════════════════════
// ACTION BUTTONS (centered, constrained width)
// ═══════════════════════════════════════════════════════════

class _ActionButtons extends StatelessWidget {
  final ValueChanged<int> onTabChange;
  const _ActionButtons({required this.onTabChange});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        children: [
          _GreenButton(
            label: 'Je ne suis pas encore inscrit',
            onTap: () => onTabChange(1),
          ),
          const SizedBox(height: 10),
          _GreenOutlineButton(
            label: 'Retrouver mon identifiant',
            onTap: () => onTabChange(2),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// LOGIN CARD
// ═══════════════════════════════════════════════════════════

class _LoginCard extends StatelessWidget {
  final int tab;
  final ValueChanged<int> onTabChange;
  final TextEditingController emailCtrl, passwordCtrl;
  final bool obscure, isBusy;
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
    required this.authError,
    required this.onToggleObscure,
    required this.onSubmit,
    required this.fadeAnim,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.92),
        border: Border.all(color: _C.gray200),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 14,
              offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Tab bar
          _DgiTabBar(current: tab, onTap: onTabChange),

          // Tab content
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 20, 28, 28),
            child: FadeTransition(
              opacity: fadeAnim,
              child: tab == 0
                  ? _LoginPane(
                      emailCtrl: emailCtrl,
                      passwordCtrl: passwordCtrl,
                      obscure: obscure,
                      onToggleObscure: onToggleObscure,
                      isBusy: isBusy,
                      authError: authError,
                      onSubmit: onSubmit,
                      onRegisterTap: () => onTabChange(1),
                    )
                  : tab == 1
                      ? _RegisterPane()
                      : _ForgotPane(),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── DGI Tab bar ─────────────────────────────────────────

class _DgiTabBar extends StatelessWidget {
  final int current;
  final ValueChanged<int> onTap;
  const _DgiTabBar({required this.current, required this.onTap});

  @override
  Widget build(BuildContext context) {
    const labels = [
      'Ouvrir une session',
      'Créer un compte',
      'Identifiant oublié'
    ];
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: _C.gray200)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: List.generate(labels.length, (i) {
          final active = current == i;
          return GestureDetector(
            onTap: () => onTap(i),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.fromLTRB(6, 13, 6, 10),
              margin: const EdgeInsets.only(right: 6),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: active ? _C.green : Colors.transparent,
                    width: 3,
                  ),
                ),
              ),
              child: Text(
                labels[i],
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: active ? _C.greenDark : _C.green,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ─── Login pane ──────────────────────────────────────────

class _LoginPane extends StatefulWidget {
  final TextEditingController emailCtrl, passwordCtrl;
  final bool obscure, isBusy;
  final String? authError;
  final VoidCallback onToggleObscure, onSubmit, onRegisterTap;

  const _LoginPane({
    required this.emailCtrl,
    required this.passwordCtrl,
    required this.obscure,
    required this.isBusy,
    required this.authError,
    required this.onToggleObscure,
    required this.onSubmit,
    required this.onRegisterTap,
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
          // Error box
          if (widget.authError != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                color: _C.redFaint,
                border: Border.all(color: _C.redBorder),
                borderRadius: BorderRadius.circular(5),
              ),
              child: Text(
                widget.authError!,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600, color: _C.red),
              ),
            ),
          ],

          // Login field (label | input)
          _FieldRow(
            label: 'Login',
            child: TextFormField(
              controller: widget.emailCtrl,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              style: const TextStyle(fontSize: 14, color: _C.gray900),
              decoration: _dgiInput(hint: 'nom@entreprise.cm'),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Requis';
                return null;
              },
            ),
          ),
          const SizedBox(height: 12),

          // Password field
          _FieldRow(
            label: 'Mot de passe',
            child: TextFormField(
              controller: widget.passwordCtrl,
              obscureText: widget.obscure,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _handleSubmit(),
              style: const TextStyle(fontSize: 14, color: _C.gray900),
              decoration: _dgiInput(
                hint: '••••••••',
                suffix: IconButton(
                  icon: Icon(
                    widget.obscure
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    size: 15,
                    color: _C.gray400,
                  ),
                  onPressed: widget.onToggleObscure,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ),
              validator: (v) => (v == null || v.isEmpty) ? 'Requis' : null,
            ),
          ),
          const SizedBox(height: 18),

          // Submit row: checkbox + button + forgot link
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 16,
            runSpacing: 10,
            children: [
              // Remember me
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: Checkbox(
                      value: true,
                      onChanged: (_) {},
                      activeColor: _C.green,
                      side: const BorderSide(color: _C.gray400),
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text('Rester connecté',
                      style: TextStyle(fontSize: 13, color: _C.gray700)),
                ],
              ),

              // Connect button
              _ConnectButton(isBusy: widget.isBusy, onTap: _handleSubmit),

              // Forgot password
              GestureDetector(
                onTap: () {},
                child: const Text(
                  'Mot de passe oublié ?',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _C.green,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Register pane ────────────────────────────────────────

class _RegisterPane extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return _SoonPane(
      icon: Icons.person_add_outlined,
      title: 'Création de compte',
      body:
          'Inscrivez votre entreprise, coopérative, ONG ou centre de formation '
          'pour accéder à la plateforme DSMO et soumettre vos déclarations ONEFOP.',
      buttonLabel: "Commencer l'inscription",
      onTap: () => router.go('/register'),
    );
  }
}

// ─── Forgot pane ─────────────────────────────────────────

class _ForgotPane extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return _SoonPane(
      icon: Icons.help_outline,
      title: 'Identifiant oublié',
      body:
          'Contactez le support DSMO en précisant le nom de votre organisation '
          "et votre numéro d'immatriculation au registre du commerce (RCCM).",
      buttonLabel: 'Contacter le support',
      onTap: () {},
    );
  }
}

// ─── Soon pane (shared) ───────────────────────────────────

class _SoonPane extends StatelessWidget {
  final IconData icon;
  final String title, body, buttonLabel;
  final VoidCallback onTap;

  const _SoonPane({
    required this.icon,
    required this.title,
    required this.body,
    required this.buttonLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: _C.greenLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: _C.green, size: 26),
          ),
          const SizedBox(height: 14),
          Text(title,
              style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: _C.gray700)),
          const SizedBox(height: 8),
          Text(
            body,
            textAlign: TextAlign.center,
            style:
                const TextStyle(fontSize: 13, color: _C.gray500, height: 1.65),
          ),
          const SizedBox(height: 20),
          _GreenButton(label: buttonLabel, onTap: onTap),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// FOOTER (full width)
// ═══════════════════════════════════════════════════════════

class _Footer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _C.gray200)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 11),
      child: Row(
        children: [
          const Expanded(
            child: Text(
              'DSMO Digital v2.4.1-stable  ·  © 2026 MINEFOP · République du Cameroun',
              style: TextStyle(
                  fontSize: 11, color: _C.gray400, fontFamily: 'monospace'),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 16),
          Row(
            children: ['Aide', 'Confidentialité', 'Contact']
                .map((l) => Padding(
                      padding: const EdgeInsets.only(left: 14),
                      child: GestureDetector(
                        onTap: () {},
                        child: Text(l,
                            style: const TextStyle(
                                fontSize: 11.5, color: _C.gray400)),
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// SHARED SMALL WIDGETS
// ═══════════════════════════════════════════════════════════

/// DGI-style label | input row
class _FieldRow extends StatelessWidget {
  final String label;
  final Widget child;
  const _FieldRow({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
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
              style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: _C.gray700),
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
    hintStyle: const TextStyle(color: _C.gray400, fontSize: 14),
    suffixIcon: suffix,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
    filled: true,
    fillColor: Colors.white,
    border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: _C.gray200, width: 1.5)),
    enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: _C.gray200, width: 1.5)),
    focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: _C.green, width: 1.5)),
    errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: _C.red, width: 1.5)),
    focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: const BorderSide(color: _C.red, width: 2)),
  );
}

class _ConnectButton extends StatelessWidget {
  final bool isBusy;
  final VoidCallback onTap;
  const _ConnectButton({required this.isBusy, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: isBusy ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 9),
        decoration: BoxDecoration(
          color: isBusy ? _C.green.withValues(alpha: 0.6) : _C.green,
          borderRadius: BorderRadius.circular(5),
        ),
        child: isBusy
            ? const SizedBox(
                width: 15,
                height: 15,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Text(
                'Connexion',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Colors.white),
              ),
      ),
    );
  }
}

class _GreenButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _GreenButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 24),
        decoration: BoxDecoration(
          color: _C.green,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: 0.2),
        ),
      ),
    );
  }
}

class _GreenOutlineButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _GreenOutlineButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 24),
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: _C.green, width: 2),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: _C.green,
              letterSpacing: 0.2),
        ),
      ),
    );
  }
}
