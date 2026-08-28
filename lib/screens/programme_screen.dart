// CAMLEAP "/programme" page — the institutional/governance story: why a
// Labour Market Information System, the full Components I-IV roadmap, and
// the ecosystem of stakeholders CAMLEAP is designed to serve. Assembled
// from three groups that used to be split across /lmis and the old
// standalone /roadmap page (this file is that page, renamed and
// repurposed — see the CAMLEAP site restructure): the "why LMIS" intro
// narrative and the ecosystem/stakeholders section both moved here from
// lmis_screen.dart (which narrows to just product-functional pillars +
// pipeline content), and the roadmap section is unchanged from the old
// /roadmap page. /roadmap itself now redirects here (see main.dart) for
// anyone with an old bookmark/link.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/i18n/l10n_ext.dart';
import '../models/landing_config.dart';
import '../providers/landing_config_provider.dart';
import '../widgets/public_chrome.dart';
import 'landing_shared.dart';

class ProgrammeScreen extends ConsumerWidget {
  const ProgrammeScreen({super.key});

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
          const PublicPageHeader(current: PublicPage.programme),
          Expanded(
            child: SingleChildScrollView(
              key: const Key('programme-scroll'),
              child: Column(
                children: [
                  _ProgrammeIntroSection(config: config),
                  _RoadmapSection(config: config),
                  _EcosystemSection(config: config),
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

// ── Why: the programme's purpose and institutional positioning ──
//
// Relocated from lmis_screen.dart's _DataIntelligenceSection — the
// narrative half, split out from the pillars/pipeline half that stayed on
// /lmis. The "current implementation" highlight that used to sit between
// this narrative and the pipeline on /lmis is dropped here (not
// relocated): the full roadmap list right below already conveys "Component
// I is current" via its phase chips, so a standalone highlight would only
// duplicate it.

class _ProgrammeIntroSection extends StatelessWidget {
  final LandingConfig config;
  const _ProgrammeIntroSection({required this.config});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final loc = context.loc;

    return Band(
      color: Colors.white,
      child: Column(
        children: [
          Kicker(l10n.landingKickerProgramme),
          const SizedBox(height: 10),
          SectionTitle(l10n.landingAboutTitle, align: TextAlign.center),
          const SizedBox(height: 24),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 740),
            child: Column(
              children: [
                for (var i = 0;
                    i < config.introduction.paragraphs.length;
                    i++) ...[
                  if (i > 0) const SizedBox(height: 16),
                  Text(
                    config.introduction.paragraphs[i].of(loc),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.6,
                      color: PublicColors.gray700,
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                Text(
                  l10n.landingAboutPositioningTitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: PublicColors.gray500,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  config.introduction.positioning.of(loc),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 15,
                    height: 1.45,
                    fontStyle: FontStyle.italic,
                    color: PublicColors.gray500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Components I-IV roadmap ──────────────────────────────────────

class _RoadmapSection extends StatelessWidget {
  final LandingConfig config;
  const _RoadmapSection({required this.config});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Band(
      color: Colors.white,
      maxWidth: 720,
      child: Column(
        children: [
          Kicker(l10n.landingKickerComponents),
          const SizedBox(height: 10),
          SectionTitle(l10n.landingRoadmapTitle, align: TextAlign.center),
          const SizedBox(height: 8),
          Text(
            config.roadmap.caption.of(context.loc),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 15, color: PublicColors.gray500),
          ),
          const SizedBox(height: 32),
          ComponentOverviewStrip(config: config),
          const SizedBox(height: 32),
          for (var i = 0; i < config.roadmap.milestones.length; i++) ...[
            if (i > 0)
              Container(
                margin: const EdgeInsets.only(left: 17),
                alignment: Alignment.centerLeft,
                width: 2,
                height: 18,
                color: PublicColors.gray200,
              ),
            RoadmapRow(
              roman: roman[i],
              title: config.roadmap.milestones[i].label.of(context.loc),
              body: config.roadmap.milestones[i].description.of(context.loc),
              phase: phaseOf(config, i),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Ecosystem ─────────────────────────────────────────────────
//
// Relocated verbatim from lmis_screen.dart's _EcosystemSection.

class _EcosystemSection extends StatelessWidget {
  final LandingConfig config;
  const _EcosystemSection({required this.config});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final loc = context.loc;
    final fallbackItems = [
      (l10n.landingStakeGovTitle, l10n.landingStakeGovBody),
      (l10n.landingStakeEmploymentTitle, l10n.landingStakeEmploymentBody),
      (l10n.landingStakeSkillsTitle, l10n.landingStakeSkillsBody),
      (l10n.landingStakeEmployersTitle, l10n.landingStakeEmployersBody),
      (l10n.landingStakeResearchTitle, l10n.landingStakeResearchBody),
    ];
    final items = [
      for (var i = 0; i < config.institutionalMessage.stakeholders.length; i++)
        (
          orFallback(config.institutionalMessage.stakeholders[i].title.of(loc),
              fallbackItems[i].$1),
          orFallback(config.institutionalMessage.stakeholders[i].body.of(loc),
              fallbackItems[i].$2),
        ),
    ];

    return Band(
      maxWidth: 960,
      child: Column(
        children: [
          Kicker(l10n.landingKickerEcosystem),
          const SizedBox(height: 10),
          SectionTitle(l10n.landingEcosystemTitle, align: TextAlign.center),
          const SizedBox(height: 32),
          _InstitutionalChain(
            steward: '${l10n.landingMinefopName} · ${l10n.landingOnefopName}',
            platform: l10n.platformName,
          ),
          const SizedBox(height: 32),
          LayoutBuilder(builder: (context, constraints) {
            final wide = constraints.maxWidth >= 680;

            Widget cell((String, String) item) => Container(
                  margin: const EdgeInsets.only(bottom: 20),
                  padding: const EdgeInsets.only(bottom: 20),
                  decoration: const BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: PublicColors.gray200),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.$1,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: PublicColors.gray900,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        item.$2,
                        style: const TextStyle(
                          fontSize: 15,
                          height: 1.5,
                          color: PublicColors.gray600,
                        ),
                      ),
                    ],
                  ),
                );

            if (!wide) {
              return Column(children: items.map(cell).toList());
            }
            return Column(
              children: [
                for (var i = 0; i < items.length; i += 2)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: cell(items[i])),
                      const SizedBox(width: 16),
                      Expanded(
                        child: i + 1 < items.length
                            ? cell(items[i + 1])
                            : const SizedBox(),
                      ),
                    ],
                  ),
              ],
            );
          }),
          const SizedBox(height: 8),
          Text(
            l10n.landingEcosystemNote,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              height: 1.4,
              color: PublicColors.gray500,
            ),
          ),
        ],
      ),
    );
  }
}

/// The MINEFOP/ONEFOP → CAMLEAP → stakeholders relationship, shown above
/// the stakeholder grid so the ecosystem reads as one institutional chain
/// rather than an unattributed card grid.
class _InstitutionalChain extends StatelessWidget {
  final String steward;
  final String platform;
  const _InstitutionalChain({required this.steward, required this.platform});

  @override
  Widget build(BuildContext context) {
    const connector = SizedBox(
      height: 20,
      child: Center(
        child: SizedBox(
          width: 1,
          height: 20,
          child: ColoredBox(color: PublicColors.gray300),
        ),
      ),
    );

    return Column(
      children: [
        Text(
          steward,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
            color: PublicColors.gray700,
          ),
        ),
        connector,
        Text(
          platform,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: PublicColors.green,
          ),
        ),
        connector,
      ],
    );
  }
}
