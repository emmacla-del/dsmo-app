// Content-agnostic layout primitives shared by all four CAMLEAP public
// content pages ('/', '/programme', '/lmis', '/observatory'), including
// PublicPageHeader — the one shared header every page renders. '/roadmap'
// no longer exists as a page; it redirects to '/programme' (see
// main.dart) for anyone with an old bookmark/link.

import 'package:flutter/material.dart';

import '../core/i18n/l10n_ext.dart';
import '../l10n/generated/app_localizations.dart';
import '../models/landing_config.dart';
import '../widgets/public_chrome.dart';
import '../widgets/responsive_helpers.dart';
import '../main.dart' show router;

const roman = ['I', 'II', 'III', 'IV'];

String orFallback(String value, String fallback) =>
    value.trim().isEmpty ? fallback : value;

int currentMilestoneIndex(LandingConfig config) {
  var last = 0;
  for (var i = 0; i < config.roadmap.milestones.length; i++) {
    if (config.roadmap.milestones[i].done) last = i;
  }
  return last;
}

enum Phase { current, operational, planned }

Phase phaseOf(LandingConfig config, int i) {
  if (!config.roadmap.milestones[i].done) return Phase.planned;
  return i == currentMilestoneIndex(config) ? Phase.current : Phase.operational;
}

String phaseLabel(AppLocalizations l10n, Phase phase) {
  switch (phase) {
    case Phase.current:
      return l10n.landingCurrentImplementation;
    case Phase.operational:
      return l10n.landingOperational;
    case Phase.planned:
      return l10n.landingPlanned;
  }
}

// ── Layout primitives ─────────────────────────────────────────

class Band extends StatelessWidget {
  final GlobalKey? sectionKey;
  final Color color;
  final double maxWidth;
  final Widget child;

  const Band({
    super.key,
    this.sectionKey,
    this.color = PublicColors.bg,
    this.maxWidth = 1120,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final mobile = context.isMobile;
    return Container(
      key: sectionKey,
      width: double.infinity,
      color: color,
      padding: EdgeInsets.symmetric(
        horizontal: mobile ? 20 : 40,
        vertical: mobile ? 44 : 64,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: child,
        ),
      ),
    );
  }
}

class Kicker extends StatelessWidget {
  final String text;
  const Kicker(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 11.5,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.0,
        color: PublicColors.green,
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String text;
  final TextAlign align;
  const SectionTitle(this.text, {super.key, this.align = TextAlign.left});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: align,
      style: TextStyle(
        fontSize: context.isMobile ? 24 : 28,
        fontWeight: FontWeight.w800,
        height: 1.2,
        color: PublicColors.gray900,
        letterSpacing: -0.3,
      ),
    );
  }
}

/// A lighter-weight heading for a subsection within an already-titled
/// band — plain bold text, not an uppercase label.
class SubHeading extends StatelessWidget {
  final String text;
  const SubHeading(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w700,
        height: 1.3,
        color: PublicColors.gray900,
      ),
    );
  }
}

class PhaseChip extends StatelessWidget {
  final Phase phase;
  const PhaseChip(this.phase, {super.key});

  @override
  Widget build(BuildContext context) {
    final planned = phase == Phase.planned;

    return Text(
      phaseLabel(context.l10n, phase).toUpperCase(),
      style: TextStyle(
        fontSize: 10.5,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.6,
        color: planned ? PublicColors.gray400 : PublicColors.greenDark,
      ),
    );
  }
}

class RomanMark extends StatelessWidget {
  final String roman;
  final Phase phase;
  const RomanMark({super.key, required this.roman, required this.phase});

  @override
  Widget build(BuildContext context) {
    final current = phase == Phase.current;
    final planned = phase == Phase.planned;

    return Container(
      width: 36,
      height: 36,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: current ? PublicColors.green : Colors.white,
        border: Border.all(
          color: planned ? PublicColors.gray300 : PublicColors.green,
          width: 1.8,
        ),
        boxShadow: current
            ? [
                BoxShadow(
                  color: PublicColors.green.withValues(alpha: 0.25),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                )
              ]
            : null,
      ),
      child: Text(
        roman,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: current
              ? Colors.white
              : planned
                  ? PublicColors.gray400
                  : PublicColors.greenDark,
        ),
      ),
    );
  }
}

// ── Pipeline ──────────────────────────────────────────────────

class Pipeline extends StatelessWidget {
  final List<String> steps;
  const Pipeline({super.key, required this.steps});

  @override
  Widget build(BuildContext context) {
    final vertical = MediaQuery.sizeOf(context).width < 820;

    if (vertical) {
      return Column(
        children: [
          for (var i = 0; i < steps.length; i++) ...[
            if (i > 0) const SizedBox(height: 20),
            PipeNode(index: i + 1, label: steps[i], wide: true),
          ],
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(child: PipeNode(index: i + 1, label: steps[i])),
        ],
      ],
    );
  }
}

class PipeNode extends StatelessWidget {
  final int index;
  final String label;
  final bool wide;
  const PipeNode({
    super.key,
    required this.index,
    required this.label,
    this.wide = false,
  });

  @override
  Widget build(BuildContext context) {
    final node = Column(
      children: [
        Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: PublicColors.green.withValues(alpha: 0.08),
            border: Border.all(color: PublicColors.green, width: 1.6),
          ),
          child: Text(
            '$index',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: PublicColors.greenDark,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            height: 1.3,
            color: PublicColors.gray700,
          ),
        ),
      ],
    );
    if (!wide) return node;
    return SizedBox(width: double.infinity, child: node);
  }
}

// ── Roadmap row + overview strip ────────────────────────────────

/// Horizontal I — II — III — IV overview of the roadmap's component
/// relationship, shown above the detailed per-component list.
class ComponentOverviewStrip extends StatelessWidget {
  final LandingConfig config;
  const ComponentOverviewStrip({super.key, required this.config});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        for (var i = 0; i < config.roadmap.milestones.length; i++) ...[
          if (i > 0)
            const Expanded(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 4),
                child: Divider(color: PublicColors.gray300, height: 1),
              ),
            ),
          RomanMark(roman: roman[i], phase: phaseOf(config, i)),
        ],
      ],
    );
  }
}

class RoadmapRow extends StatelessWidget {
  final String roman;
  final String title;
  final String body;
  final Phase phase;

  const RoadmapRow({
    super.key,
    required this.roman,
    required this.title,
    required this.body,
    required this.phase,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RomanMark(roman: roman, phase: phase),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 10,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w700,
                      color: PublicColors.gray900,
                    ),
                  ),
                  PhaseChip(phase),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                body,
                style: const TextStyle(
                  fontSize: 15,
                  height: 1.5,
                  color: PublicColors.gray600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Subpage chrome (route-based header/footer for /programme, /lmis,
// /observatory) ──

enum PublicPage { home, programme, lmis, observatory }

class TricolorBar extends StatelessWidget {
  const TricolorBar({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 4,
      child: Row(
        children: [
          Expanded(child: ColoredBox(color: PublicColors.green)),
          Expanded(child: ColoredBox(color: PublicColors.flagRed)),
          Expanded(child: ColoredBox(color: PublicColors.flagYellow)),
        ],
      ),
    );
  }
}

/// Shared header for all four public routes ('/', '/programme', '/lmis',
/// '/observatory') — each nav item navigates to its own route rather than
/// scrolling to an anchor within one long page. '/' itself has no nav
/// entry (the logo/identity click already serves as the way home, per the
/// World Bank/UN institutional-site pattern this restructure follows), so
/// `current: PublicPage.home` simply renders with no tab active.
class PublicPageHeader extends StatelessWidget {
  final PublicPage current;
  const PublicPageHeader({super.key, required this.current});

  @override
  Widget build(BuildContext context) {
    final desktop = context.isDesktop;
    return Column(
      children: [
        SafeArea(
          bottom: false,
          child: _HeaderBar(current: current, showInlineNav: desktop),
        ),
        if (!desktop) _SubNavRow(current: current),
      ],
    );
  }
}

class _NavDestination {
  final String Function(AppLocalizations) label;
  final String path;
  final PublicPage page;
  const _NavDestination(this.label, this.path, this.page);
}

// No entry for '/' — the logo/identity click already serves as the way
// home (World Bank/UN institutional-site pattern), so home is never a tab.
const _navDestinations = [
  _NavDestination(_labelProgramme, '/programme', PublicPage.programme),
  _NavDestination(_labelLmis, '/lmis', PublicPage.lmis),
  _NavDestination(_labelObservatory, '/observatory', PublicPage.observatory),
];

String _labelProgramme(AppLocalizations l10n) => l10n.landingNavProgramme;
String _labelLmis(AppLocalizations l10n) => l10n.landingNavAbout;
String _labelObservatory(AppLocalizations l10n) => l10n.landingNavObservatory;

class _HeaderBar extends StatelessWidget {
  final PublicPage current;
  final bool showInlineNav;
  const _HeaderBar({required this.current, required this.showInlineNav});

  @override
  Widget build(BuildContext context) {
    final mobile = context.isMobile;
    final l10n = context.l10n;

    // "Request access" (landingSignUpButton) deliberately stays OFF this
    // global header — it's contextual to /lmis's access band instead (see
    // LmisScreen's _AccessBandSection). Header actions are just language +
    // sign in, on every route.
    final actions = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const PublicLanguageToggle(compact: true),
        const SizedBox(width: 10),
        PublicPrimaryButton(
          label: l10n.connectButton,
          onPressed: () => router.go('/login'),
        ),
      ],
    );

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: mobile ? 16 : 32,
        vertical: mobile ? 12 : 14,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: _HeaderIdentity(onTap: () => router.go('/')),
          ),
          if (showInlineNav)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final dest in _navDestinations)
                    _NavLink(
                      label: dest.label(l10n),
                      active: dest.page == current,
                      onTap: () => router.go(dest.path),
                    ),
                ],
              ),
            ),
          actions,
        ],
      ),
    );
  }
}

class _HeaderIdentity extends StatelessWidget {
  final VoidCallback onTap;
  const _HeaderIdentity({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final mobile = context.isMobile;
    return InkWell(
      onTap: onTap,
      child: Row(
        children: [
          PublicLogo(size: mobile ? 30 : 36),
          const SizedBox(width: 12),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  context.l10n.platformName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: PublicColors.gray900,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  mobile
                      ? '${context.l10n.landingOnefopName} · ${context.l10n.landingMinefopName}'
                      : '${context.l10n.landingOnefopName}  ·  ${context.l10n.landingMinefopName}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: mobile ? 10 : 11.5,
                    fontWeight: FontWeight.w500,
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

class _SubNavRow extends StatelessWidget {
  final PublicPage current;
  const _SubNavRow({required this.current});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      width: double.infinity,
      color: Colors.white,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          children: [
            for (final dest in _navDestinations)
              _NavLink(
                label: dest.label(l10n),
                active: dest.page == current,
                onTap: () => router.go(dest.path),
              ),
          ],
        ),
      ),
    );
  }
}

class _NavLink extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _NavLink({required this.label, required this.onTap, this.active = false});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
            color: active ? PublicColors.green : PublicColors.gray700,
          ),
        ),
      ),
    );
  }
}

class PublicPageFooter extends StatelessWidget {
  const PublicPageFooter({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final mobile = context.isMobile;
    final blocks = [
      (l10n.landingOnefopName, l10n.landingOnefopFull),
      (l10n.platformName, l10n.platformFullName),
      (l10n.landingMinefopName, l10n.landingMinefopFull),
    ];

    Widget block((String, String) b) => Column(
          crossAxisAlignment:
              mobile ? CrossAxisAlignment.center : CrossAxisAlignment.start,
          children: [
            Text(
              b.$1,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color: PublicColors.gray900,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              b.$2,
              textAlign: mobile ? TextAlign.center : TextAlign.left,
              style: const TextStyle(
                fontSize: 12,
                height: 1.4,
                color: PublicColors.gray500,
              ),
            ),
          ],
        );

    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: EdgeInsets.fromLTRB(24, 36, 24, mobile ? 28 : 24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1120),
          child: Column(
            children: [
              if (mobile)
                Column(
                  children: [
                    for (var i = 0; i < blocks.length; i++) ...[
                      if (i > 0) const SizedBox(height: 20),
                      block(blocks[i]),
                    ],
                  ],
                )
              else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (var i = 0; i < blocks.length; i++) ...[
                      if (i > 0) const SizedBox(width: 40),
                      Expanded(child: block(blocks[i])),
                    ],
                  ],
                ),
              const SizedBox(height: 28),
              const Divider(height: 1, color: PublicColors.gray200),
              const SizedBox(height: 20),
              Text(
                l10n.landingRepublic,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.9,
                  color: PublicColors.gray500,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                l10n.footerVersionLine,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 11,
                  color: PublicColors.gray400,
                  fontFamily: 'monospace',
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
