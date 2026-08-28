// CAMLEAP "/lmis" page — what CAMLEAP is building: the four pillars
// (Collect / Integrate / Analyse / Inform) and the 7-step data-to-
// intelligence pipeline, plus a contextual access band. Narrowed as part
// of the CAMLEAP site restructure: the "why a LMIS?" narrative and the
// ecosystem/stakeholders content that used to live here moved to
// /programme (see programme_screen.dart) — institutional/governance
// content, not product-functional content. This page is now purely about
// what CAMLEAP does and how to get in.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/i18n/l10n_ext.dart';
import '../models/landing_config.dart';
import '../providers/landing_config_provider.dart';
import '../widgets/public_chrome.dart';
import '../widgets/responsive_helpers.dart';
import '../main.dart' show router;
import 'landing_shared.dart';

class LmisScreen extends ConsumerWidget {
  const LmisScreen({super.key});

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
          const PublicPageHeader(current: PublicPage.lmis),
          Expanded(
            child: SingleChildScrollView(
              key: const Key('lmis-scroll'),
              child: Column(
                children: [
                  _PillarsAndPipelineSection(config: config),
                  _AccessBandSection(config: config),
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

// ── What CAMLEAP is building: pillars + pipeline ────────────────

class _PillarsAndPipelineSection extends StatelessWidget {
  final LandingConfig config;
  const _PillarsAndPipelineSection({required this.config});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final loc = context.loc;
    final fallbackKickers = [
      l10n.landingPillarCollect,
      l10n.landingPillarIntegrate,
      l10n.landingPillarAnalyse,
      l10n.landingPillarInform,
    ];
    final kickers = [
      for (var i = 0; i < config.whyPillarKickers.length; i++)
        orFallback(config.whyPillarKickers[i].of(loc), fallbackKickers[i]),
    ];
    final fallbackSteps = [
      l10n.landingIntelCollect,
      l10n.landingIntelValidate,
      l10n.landingIntelCentralise,
      l10n.landingIntelIntegrate,
      l10n.landingIntelAnalyse,
      l10n.landingIntelIndicators,
      l10n.landingIntelDecisions,
    ];
    final steps = [
      for (var i = 0; i < config.platformCapabilities.items.length; i++)
        orFallback(
            config.platformCapabilities.items[i].of(loc), fallbackSteps[i]),
    ];

    return Band(
      color: Colors.white,
      child: Column(
        children: [
          Kicker(l10n.landingKickerLmis),
          const SizedBox(height: 10),
          SectionTitle(l10n.landingValueStripTitle, align: TextAlign.center),

          // What: the four pillars CAMLEAP is building.
          const SizedBox(height: 32),
          _PillarRow(config: config, kickers: kickers),

          // How: data flows into labour-market intelligence.
          const SizedBox(height: 44),
          SubHeading(l10n.landingDataToIntelTitle),
          const SizedBox(height: 28),
          Pipeline(steps: steps),
        ],
      ),
    );
  }
}

class _PillarRow extends StatelessWidget {
  final LandingConfig config;
  final List<String> kickers;
  const _PillarRow({required this.config, required this.kickers});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final narrow = constraints.maxWidth < 720;
      final items = [
        for (var i = 0; i < config.valueProposition.cards.length; i++)
          _PillarCard(
            kicker: i < kickers.length ? kickers[i] : '',
            title: config.valueProposition.cards[i].title.of(context.loc),
            body: config.valueProposition.cards[i].body.of(context.loc),
          ),
      ];

      if (narrow) {
        return Column(
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) ...[
                const SizedBox(height: 20),
                const Divider(height: 1, color: PublicColors.gray200),
                const SizedBox(height: 20),
              ],
              items[i],
            ],
          ],
        );
      }

      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20),
                child: SizedBox(
                  width: 1,
                  height: 90,
                  child: ColoredBox(color: PublicColors.gray200),
                ),
              ),
            Expanded(child: items[i]),
          ],
        ],
      );
    });
  }
}

class _PillarCard extends StatelessWidget {
  final String kicker;
  final String title;
  final String body;
  const _PillarCard({
    required this.kicker,
    required this.title,
    required this.body,
  });

  @override
  Widget build(BuildContext context) {
    final same = kicker.toLowerCase() == title.toLowerCase();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Kicker(kicker),
        if (!same) ...[
          const SizedBox(height: 8),
          Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: PublicColors.gray900,
            ),
          ),
        ],
        const SizedBox(height: 8),
        Text(
          body,
          style: const TextStyle(
            fontSize: 15,
            height: 1.5,
            color: PublicColors.gray600,
          ),
        ),
      ],
    );
  }
}

// ── Access band ───────────────────────────────────────────────
//
// "Request access" (landingSignUpButton) and "Sign in" (connectButton),
// contextual to /lmis rather than the global header (see
// landing_shared.dart's _HeaderBar). accessNote — previously dormant,
// admin-editable only — now renders here as the band's supporting text;
// its existing copy already reads as access-band guidance.

class _AccessBandSection extends StatelessWidget {
  final LandingConfig config;
  const _AccessBandSection({required this.config});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final loc = context.loc;
    final mobile = context.isMobile;

    final primary = PublicPrimaryButton(
      label: l10n.landingSignUpButton,
      onPressed: () => router.go('/register'),
      expanded: mobile,
    );
    final secondary = PublicOutlineButton(
      label: l10n.connectButton,
      onPressed: () => router.go('/login'),
      expanded: mobile,
    );

    return Band(
      color: PublicColors.greenLight,
      maxWidth: 640,
      child: Column(
        children: [
          Kicker(l10n.landingKickerPlatform),
          const SizedBox(height: 12),
          SectionTitle(l10n.landingSignInCta, align: TextAlign.center),
          const SizedBox(height: 24),
          if (mobile)
            Column(
              children: [
                primary,
                const SizedBox(height: 12),
                secondary,
              ],
            )
          else
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 14,
              runSpacing: 12,
              children: [primary, secondary],
            ),
          const SizedBox(height: 16),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Text(
              config.accessNote.of(loc),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                height: 1.45,
                color: PublicColors.gray600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
