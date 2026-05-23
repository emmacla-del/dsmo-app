// lib/screens/onefop/onefop_legal_acknowledgment_screen.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'onefop_form_constants.dart' show EntityType;

enum _FlowState {
  logoLoading, // pulsing logo while form schema loads
  acknowledgment, // legal card shown
  exiting, // reverse animation before handing off
}

class OnefopLegalAcknowledgmentScreen extends StatefulWidget {
  final EntityType entityType;
  final bool isReturningUser;
  // Called when the screen is ready to hand off — caller pushes the form
  final VoidCallback onAcknowledged;
  // Future that resolves when the form schema is ready
  final Future<void> Function() onPreload;

  const OnefopLegalAcknowledgmentScreen({
    super.key,
    required this.entityType,
    required this.isReturningUser,
    required this.onAcknowledged,
    required this.onPreload,
  });

  @override
  State<OnefopLegalAcknowledgmentScreen> createState() =>
      _OnefopLegalAcknowledgmentScreenState();
}

class _OnefopLegalAcknowledgmentScreenState
    extends State<OnefopLegalAcknowledgmentScreen>
    with TickerProviderStateMixin {
  _FlowState _flowState = _FlowState.logoLoading;
  bool _isAcknowledged = false;
  bool _preloadDone = false;
  bool _minPulseElapsed = false;

  // Logo pulse controller — runs the entire time
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseScale;
  late final Animation<double> _pulseGlow;

  // Card reveal controller
  late final AnimationController _cardCtrl;
  late final Animation<double> _cardOpacity;
  late final Animation<Offset> _cardSlide;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _startFlow();
  }

  void _setupAnimations() {
    // Continuous pulse — never stops until exit
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _pulseScale = Tween<double>(begin: 0.92, end: 1.08).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    _pulseGlow = Tween<double>(begin: 0.2, end: 0.55).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    // Card reveal
    _cardCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _cardOpacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
          parent: _cardCtrl,
          curve: const Interval(0, 0.6, curve: Curves.easeOut)),
    );

    _cardSlide = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _cardCtrl, curve: Curves.easeOutCubic),
    );
  }

  void _startFlow() {
    // Start preload
    widget.onPreload().then((_) {
      if (!mounted) return;
      _preloadDone = true;
      _maybeAdvance();
    }).catchError((e) {
      if (!mounted) return;
      // Even on error, advance — the form screen will show its own error state
      _preloadDone = true;
      _maybeAdvance();
    });

    // Minimum pulse duration so the logo animation is always visible
    Future.delayed(const Duration(milliseconds: 4000), () {
      if (!mounted) return;
      _minPulseElapsed = true;
      _maybeAdvance();
    });
  }

  void _maybeAdvance() {
    if (!_preloadDone || !_minPulseElapsed) return;
    if (_flowState != _FlowState.logoLoading) return;

    if (widget.isReturningUser) {
      // Skip acknowledgment, go straight to form after a brief hold
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) _handOff();
      });
    } else {
      setState(() => _flowState = _FlowState.acknowledgment);
      _cardCtrl.forward();
    }
  }

  void _handOff() {
    if (_flowState == _FlowState.exiting) return;
    setState(() => _flowState = _FlowState.exiting);
    _cardCtrl.reverse().then((_) {
      if (mounted) widget.onAcknowledged();
    });
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _cardCtrl.dispose();
    super.dispose();
  }

  // FIX: return switch (Dart 3) — exhaustiveness guaranteed, no analyzer warning
  String get _entityShortLabel {
    return switch (widget.entityType) {
      EntityType.ong => 'ONG / NGO',
      EntityType.enterprise => 'ENTREPRISE / ENTERPRISE',
      EntityType.cooperative => 'COOPÉRATIVE / COOPERATIVE',
      EntityType.ctd => 'CTD / TCC',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo + loading text — only during schema load
                if (_flowState == _FlowState.logoLoading) ...[
                  _buildPulsingLogo(),
                  const SizedBox(height: 24),
                  FadeTransition(
                    opacity: _pulseGlow,
                    child: Text(
                      'Chargement…',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: const Color(0xFF94A3B8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],

                // Acknowledgment card — no logo
                if (_flowState == _FlowState.acknowledgment ||
                    _flowState == _FlowState.exiting)
                  SlideTransition(
                    position: _cardSlide,
                    child: FadeTransition(
                      opacity: _cardOpacity,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 580),
                        child: _buildAcknowledgmentCard(),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPulsingLogo() {
    return AnimatedBuilder(
      animation: _pulseCtrl,
      builder: (_, __) => Transform.scale(
        scale: _pulseScale.value,
        child: Container(
          width: 110,
          height: 110,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                // FIX: withOpacity → withValues(alpha: ...)
                color:
                    const Color(0xFF4472C4).withValues(alpha: _pulseGlow.value),
                blurRadius: 48,
                spreadRadius: 12,
              ),
            ],
          ),
          child: ClipOval(
            child: Image.asset(
              'assets/images/onefop_logo.png',
              width: 110,
              height: 110,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF4472C4), Color(0xFF5B8BD4)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.analytics_rounded,
                    size: 52, color: Colors.white),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAcknowledgmentCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            // FIX: withOpacity → withValues(alpha: ...)
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 32,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Animated blue accent bar
            AnimatedBuilder(
              animation: _cardCtrl,
              builder: (_, __) => FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: _cardCtrl.value.clamp(0.0, 1.0),
                child: Container(
                  height: 4,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF4472C4), Color(0xFF5B8BD4)],
                    ),
                  ),
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'COLLECTE DES DONNÉES SUR LES EMPLOIS CRÉÉS PAR LE SECTEUR MODERNE DE L\'ÉCONOMIE',
                              style: GoogleFonts.inter(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF1E293B),
                                height: 1.35,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'COLLECTION OF DATA ON JOBS CREATED BY THE MODERN ECONOMY',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF64748B),
                                height: 1.35,
                              ),
                            ),
                            const SizedBox(height: 10),
                            _EntityBadge(label: _entityShortLabel),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => Navigator.of(context).maybePop(),
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.close,
                                size: 18, color: Color(0xFF64748B)),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),
                  const _ConfidentialityCard(),
                  const SizedBox(height: 16),
                  const _LegalFooter(),
                  const SizedBox(height: 24),

                  // Acknowledgment toggle
                  InkWell(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      setState(() => _isAcknowledged = !_isAcknowledged);
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            curve: Curves.easeOut,
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: _isAcknowledged
                                  ? const Color(0xFF4472C4)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(5),
                              border: Border.all(
                                color: _isAcknowledged
                                    ? const Color(0xFF4472C4)
                                    : const Color(0xFFCBD5E1),
                                width: 2,
                              ),
                            ),
                            child: _isAcknowledged
                                ? const Icon(Icons.check,
                                    size: 14, color: Colors.white)
                                : null,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'J\'ai pris connaissance de cet avis',
                                  style: GoogleFonts.inter(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFF1E293B),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text('I acknowledge this notice',
                                    style: GoogleFonts.inter(
                                        fontSize: 11,
                                        color: const Color(0xFF64748B))),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 18),

                  // Begin button
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeOut,
                    transform: _isAcknowledged
                        ? Matrix4.identity()
                        : (Matrix4.identity()..scale(0.98)),
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isAcknowledged ? _handOff : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4472C4),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: const Color(0xFFE2E8F0),
                          disabledForegroundColor: const Color(0xFF94A3B8),
                          elevation: _isAcknowledged ? 3 : 0,
                          // FIX: withOpacity → withValues(alpha: ...)
                          shadowColor:
                              const Color(0xFF4472C4).withValues(alpha: 0.35),
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text('Commencer / Begin',
                            style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.3)),
                      ),
                    ),
                  ),

                  const SizedBox(height: 6),
                  Center(
                    child: TextButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF94A3B8),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                      ),
                      child: Text('Retour / Go Back',
                          style: GoogleFonts.inter(
                              fontSize: 12, fontWeight: FontWeight.w500)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EntityBadge extends StatelessWidget {
  final String label;
  const _EntityBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFEEF2FF),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF4472C4).withValues(alpha: 0.15),
        ),
      ),
      child: Text(
        '- Questionnaire $label -',
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF4472C4),
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

class _ConfidentialityCard extends StatelessWidget {
  const _ConfidentialityCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: const Color(0xFF4472C4).withValues(alpha: 0.10),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.shield_outlined,
                    size: 16, color: Color(0xFF4472C4)),
              ),
              const SizedBox(width: 10),
              Text(
                'Avis de confidentialité / Confidential Notice',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF4472C4),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Les informations contenues dans ce document sont confidentielles '
            'et ne pourront être utilisées à des fins de poursuites judiciaires, '
            'de contrôle fiscal ou de répression économique, conformément à la '
            'Loi N° 2020/010 du 20 juillet 2020 relative aux recensements et '
            'enquêtes Statistiques.',
            style: GoogleFonts.inter(
              fontSize: 12,
              color: const Color(0xFF475569),
              height: 1.6,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'The information contained in this document is confidential and may '
            'not be used for legal proceedings, fiscal control or economic '
            'repression, in accordance with Law N° 2020/010 of 20 July 2020 '
            'on censuses and statistical surveys.',
            style: GoogleFonts.inter(
              fontSize: 11,
              color: const Color(0xFF64748B),
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}

class _LegalFooter extends StatelessWidget {
  const _LegalFooter();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.gavel_outlined, size: 13, color: Color(0xFF94A3B8)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'Loi N° 2020/010 du 20 juillet 2020 / Law N° 2020/010 of 20 July 2020',
            style: GoogleFonts.inter(
              fontSize: 10,
              color: const Color(0xFF94A3B8),
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}
