// CAMLEAP public landing page, reached at '/'.
//
// A minimal front door — one calm homepage, no self-referencing nav tab
// (the header logo/identity already serves that role, World Bank/UN
// institutional-site pattern). "Why LMIS" narrative, the full Components
// I-IV roadmap and the ecosystem/stakeholders content live on /programme
// (see programme_screen.dart); LMIS pillars and the data-to-intelligence
// pipeline live on /lmis (see lmis_screen.dart). This page's job is
// orientation + two doors out, not the whole story.
//
// Design goals: calm institutional authority, clear hierarchy, generous
// whitespace, subtle depth, and consistent Cameroon / ONEFOP branding.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/i18n/l10n_ext.dart';
import '../models/landing_config.dart';
import '../providers/landing_config_provider.dart';
import '../widgets/public_chrome.dart';
import '../widgets/responsive_helpers.dart';
import '../main.dart' show router;
import 'landing_shared.dart';

class LandingScreen extends ConsumerWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(landingConfigProvider).valueOrNull ??
        peekCachedLandingConfig() ??
        LandingConfig.defaults();

    return Scaffold(
      backgroundColor: PublicColors.bg,
      body: Column(
        children: [
          const TricolorBar(),
          const PublicPageHeader(current: PublicPage.home),
          Expanded(
            child: SingleChildScrollView(
              key: const Key('landing-scroll'),
              child: Column(
                children: [
                  _Hero(config: config),
                  _VisualStatement(config: config),
                  _Closing(config: config),
                  const PublicPageFooter(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────

String _orFallback(String value, String fallback) =>
    value.trim().isEmpty ? fallback : value;

// ── 1. Hero ───────────────────────────────────────────────────
//
// Minimal: identity line, headline, ONE supporting statement (hero.
// description — the only Super-Admin-editable field of the three
// candidates {landingProgrammeLine, hero.description, landingHeroLead},
// so this is the choice that keeps the hero's message CMS-editable; the
// other two were static institutional chrome duplicating the header/
// footer's ONEFOP/MINEFOP identity). No roadmap-status pill — that
// belongs on /roadmap and /lmis now, not the front door.

class _Hero extends StatelessWidget {
  final LandingConfig config;
  const _Hero({required this.config});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final mobile = context.isMobile;
    final loc = context.loc;

    return Band(
      color: Colors.white,
      maxWidth: 800,
      child: Column(
        children: [
          Text(
            l10n.platformFullName,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.3,
              color: PublicColors.gray500,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            _orFallback(config.hero.title.of(loc), l10n.landingHeroHeadline),
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: mobile ? 28 : 36,
              fontWeight: FontWeight.w800,
              height: 1.15,
              letterSpacing: -0.5,
              color: PublicColors.gray900,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            config.hero.description.of(loc),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15.5,
              height: 1.55,
              color: PublicColors.gray600,
            ),
          ),
          const SizedBox(height: 32),
          _HeroActions(mobile: mobile),
        ],
      ),
    );
  }
}

class _HeroActions extends StatelessWidget {
  final bool mobile;
  const _HeroActions({required this.mobile});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final primary = PublicPrimaryButton(
      label: l10n.landingExploreProgramme,
      onPressed: () => router.go('/lmis'),
      expanded: mobile,
    );
    final secondary = PublicOutlineButton(
      label: l10n.landingSignInCta,
      onPressed: () => router.go('/login'),
      expanded: mobile,
    );

    if (mobile) {
      return Column(
        children: [
          primary,
          const SizedBox(height: 12),
          secondary,
        ],
      );
    }
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 14,
      runSpacing: 12,
      children: [primary, secondary],
    );
  }
}

// ── 2. One visual statement ──────────────────────────────────
//
// A compact "how CAMLEAP works" glyph built from bookend + midpoint
// entries of lmisArchitecture.steps (data sources / intelligence /
// decision-making), with the platform name standing in for the
// collection-integration-analysis work in between.
//
// Phase 3 audit: showing all 6 lmisArchitecture steps here read as a
// near word-for-word restatement of /lmis's 7-step platformCapabilities
// pipeline (Collection/Collect, Integration/Integrate, Analysis/Analyse,
// Decision-making/Inform decisions — 4 of 6 nodes are the same concept
// in noun vs. verb form). That's a duplicate, not a teaser. Using only
// the first, middle and last entries — with "CAMLEAP" standing in for
// the collect/validate/centralise/integrate/analyse cluster that
// platformCapabilities covers in full — keeps this a genuine high-level
// glyph instead of previewing /lmis's detail almost verbatim, while
// staying entirely config/l10n-backed (steps[0], steps[4], steps[5] are
// real LandingConfig content; platformName is existing chrome).

class _VisualStatement extends StatelessWidget {
  final LandingConfig config;
  const _VisualStatement({required this.config});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final loc = context.loc;
    final archSteps = config.lmisArchitecture.steps;
    final fallbackSteps = [
      l10n.landingArchSources,
      l10n.landingArchIntelligence,
      l10n.landingArchDecision,
    ];
    final steps = [
      _orFallback(archSteps[0].of(loc), fallbackSteps[0]),
      l10n.platformName,
      _orFallback(archSteps[4].of(loc), fallbackSteps[1]),
      _orFallback(archSteps[5].of(loc), fallbackSteps[2]),
    ];

    return Band(
      maxWidth: 900,
      child: Column(
        children: [
          Kicker(l10n.landingKickerLmis),
          const SizedBox(height: 28),
          Pipeline(steps: steps),
        ],
      ),
    );
  }
}

// ── 3. Access / closing ──────────────────────────────────────
//
// Minimal closing per the approved brief: heading, one primary door
// (/lmis), one lighter link (/programme). ctaTitle is kept — repurposed
// as this heading, so it stays Super-Admin-editable and rendered rather
// than going dark. ctaNote has no slot in this minimal closing (a
// supporting paragraph here would reintroduce the density this
// restructure removes) — still dormant, same as statusLine (its only use
// was the hero pill, dropped in an earlier phase). accessNote is no
// longer dormant as of this restructure — it now renders on /lmis's
// access band instead (see LmisScreen's _AccessBandSection).

class _Closing extends StatelessWidget {
  final LandingConfig config;
  const _Closing({required this.config});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final loc = context.loc;
    final mobile = context.isMobile;

    return Band(
      color: PublicColors.greenLight,
      maxWidth: 680,
      child: Column(
        children: [
          Kicker(l10n.landingKickerPlatform),
          const SizedBox(height: 12),
          SectionTitle(
            config.ctaTitle.of(loc),
            align: TextAlign.center,
          ),
          const SizedBox(height: 28),
          Column(
            children: [
              PublicPrimaryButton(
                label: l10n.landingEnterLmisCta,
                onPressed: () => router.go('/lmis'),
                expanded: mobile,
              ),
              const SizedBox(height: 16),
              const _RoadmapLink(),
            ],
          ),
        ],
      ),
    );
  }
}

class _RoadmapLink extends StatelessWidget {
  const _RoadmapLink();

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => router.go('/programme'),
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              context.l10n.landingNavProgramme,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: PublicColors.green,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_forward, size: 16, color: PublicColors.green),
          ],
        ),
      ),
    );
  }
}
