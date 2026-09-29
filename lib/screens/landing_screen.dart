// CAMLEAP public landing page, reached at '/'.
//
// Rebuilt from the "camleap-dual-audience" Figma design (file
// ONKnAUPbBLZlp2eZYjztq2, node 16:4) to replace the earlier minimal
// front-door layout. This version leads with the ONEFOP declaration
// mission and splits its main content into a dual audience: entities that
// need to declare (economic / public) and people trying to understand what
// ONEFOP/CAMLEAP is (LMIS, Observatoire). It intentionally uses its own
// nav bar and footer (_CamleapNav / _CamleapFooter below) rather than the
// shared PublicPageHeader/PublicPageFooter from public_chrome.dart, so
// /programme, /lmis, /observatory and the ComingSoonScreen placeholders
// keep their existing chrome unchanged — only this page adopts the new
// design.
//
// Route mapping decisions (destinations the Figma file itself doesn't
// specify, since it only mocks up this one page):
//  - "À propos" submenu (ONEFOP / LMIS / Observatoire) and the two
//    "En savoir plus" links reuse the existing /programme, /lmis,
//    /observatory pages rather than new /a-propos/* routes, so this
//    doesn't duplicate content that already lives there.
//  - /declarer/{entreprise,cooperative,ctd,ong}, /registre-formations and
//    /enquetes-employeurs have no real page yet — they route to
//    ComingSoonScreen (see main.dart) so nothing 404s. "Espace déclarant"
//    goes straight to /login instead of a placeholder — there's no
//    separate declarant-portal flow yet, so a coming-soon detour in front
//    of the one working entry point was just friction.
//  - "Faire ma déclaration" scrolls to the audience card below
//    (#vous-etes in the Figma spec) rather than navigating, since that
//    section *is* the entity-declaration entry point.
//
// LandingConfig (the Super-Admin-editable CMS fields — hero, ctaTitle,
// etc.) is not used here: this page's copy is static, matching the Figma
// source directly. hero/ctaTitle join statusLine/ctaNote as dormant
// LandingConfig fields (see that class's doc comment) — editable in the
// admin panel but with no current renderer.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/i18n/l10n_ext.dart';
import '../l10n/generated/app_localizations.dart';
import '../providers/locale_provider.dart';
import '../widgets/public_chrome.dart' show PublicColors, PublicPrimaryButton, PublicOutlineButton, kCamleapLogoAsset;
import '../widgets/responsive_helpers.dart';
import '../main.dart' show router;

// Colors used in the Figma source that don't already have a PublicColors
// token (a slightly different off-white than PublicColors.bg, and the two
// status-chip greens) — kept local since they're specific to this page.
const _sectionGray = Color(0xFFF7F7F7);
const _cardOffWhite = Color(0xFFFAFAF9);
const _chipGreenBg = Color(0xFFDCFCE7);
const _chipGreenText = Color(0xFF15803D);

class LandingScreen extends ConsumerStatefulWidget {
  const LandingScreen({super.key});

  @override
  ConsumerState<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends ConsumerState<LandingScreen> {
  final _audienceKey = GlobalKey();

  void _scrollToAudience() {
    final ctx = _audienceKey.currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          _CamleapNav(),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  _Hero(onDeclareTap: _scrollToAudience),
                  _AudienceExplainerSection(sectionKey: _audienceKey),
                  const _StatusSection(),
                  const _CamleapFooter(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Section shell ─────────────────────────────────────────────
//
// Like landing_shared.dart's Band, but with per-section padding taken
// directly from the Figma spec (which varies band to band) instead of
// Band's fixed 40/64 desktop values.

class _Section extends StatelessWidget {
  static const double _maxWidth = 1120.0;
  static const double _hPad = 80.0;

  final Color color;
  final double vPadTop;
  final double vPadBottom;
  final Border? border;
  final Widget child;
  final Key? sectionKey;

  const _Section({
    this.sectionKey,
    this.color = Colors.white,
    required this.vPadTop,
    required this.vPadBottom,
    this.border,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final mobile = context.isMobile;
    return Container(
      key: sectionKey,
      width: double.infinity,
      decoration: BoxDecoration(color: color, border: border),
      padding: EdgeInsets.fromLTRB(
        mobile ? 20 : _hPad,
        mobile ? 44 : vPadTop,
        mobile ? 20 : _hPad,
        mobile ? 44 : vPadBottom,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: _maxWidth),
          child: child,
        ),
      ),
    );
  }
}

Border _grayY() => const Border.symmetric(
      horizontal: BorderSide(color: PublicColors.gray200),
    );

// ── 1. Nav bar ───────────────────────────────────────────────

class _CamleapNav extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final desktop = context.isDesktop;
    final l10n = context.l10n;

    return SafeArea(
      bottom: false,
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(bottom: BorderSide(color: PublicColors.gray200)),
        ),
        padding: EdgeInsets.symmetric(
          horizontal: desktop ? 80 : 20,
          vertical: desktop ? 0 : 12,
        ),
        height: desktop ? 72 : null,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _NavBrand(onTap: () => router.go('/')),
            if (desktop) _NavLinksGroup(l10n: l10n),
            if (desktop)
              _NavRightActions(l10n: l10n)
            else
              IconButton(
                icon: const Icon(Icons.menu, color: PublicColors.gray700),
                onPressed: () => _showMobileMenu(context, ref),
              ),
          ],
        ),
      ),
    );
  }
}

class _NavBrand extends StatelessWidget {
  final VoidCallback onTap;
  const _NavBrand({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset(
            kCamleapLogoAsset,
            width: 28,
            height: 28,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const SizedBox.shrink(),
          ),
          const SizedBox(width: 8),
          Text(
            context.l10n.platformName,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 20,
              color: PublicColors.gray900,
            ),
          ),
          const SizedBox(width: 12),
          Container(width: 1, height: 20, color: PublicColors.gray300),
          const SizedBox(width: 12),
          Text(
            context.l10n.navOnefopMinefopTag,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 11,
              color: PublicColors.gray500,
            ),
          ),
        ],
      ),
    );
  }
}

class _NavLinksGroup extends StatelessWidget {
  final AppLocalizations l10n;
  const _NavLinksGroup({required this.l10n});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        PopupMenuButton<String>(
          tooltip: '',
          offset: const Offset(0, 28),
          color: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          onSelected: (route) => router.go(route),
          itemBuilder: (context) => [
            PopupMenuItem(value: '/programme', child: Text(l10n.camleapNavOnefop)),
            PopupMenuItem(value: '/lmis', child: Text(l10n.landingNavAbout)),
            PopupMenuItem(value: '/observatory', child: Text(l10n.landingNavObservatory)),
          ],
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(l10n.camleapNavAbout,
                  style: const TextStyle(
                      fontWeight: FontWeight.w500, fontSize: 14, color: PublicColors.gray700)),
              const SizedBox(width: 4),
              const Text('▼',
                  style: TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 10, color: PublicColors.gray500)),
            ],
          ),
        ),
        const SizedBox(width: 32),
        _NavTextLink(label: l10n.camleapNavRegistre, onTap: () => router.go('/registre-formations')),
        const SizedBox(width: 32),
        _NavTextLink(label: l10n.camleapNavEnquetes, onTap: () => router.go('/enquetes-employeurs')),
      ],
    );
  }
}

class _NavTextLink extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _NavTextLink({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Text(label,
          style: const TextStyle(
              fontWeight: FontWeight.w500, fontSize: 14, color: PublicColors.gray700)),
    );
  }
}

class _NavRightActions extends StatelessWidget {
  final AppLocalizations l10n;
  const _NavRightActions({required this.l10n});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const _LangToggle(),
        const SizedBox(width: 24),
        _NavTextLink(label: l10n.camleapSignIn, onTap: () => router.go('/login')),
        const SizedBox(width: 24),
        PublicPrimaryButton(
          label: l10n.camleapEspaceDeclarant,
          onPressed: () => router.go('/login'),
        ),
      ],
    );
  }
}

class _LangToggle extends ConsumerWidget {
  const _LangToggle();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(localeProvider).languageCode;
    TextStyle style(bool active) => TextStyle(
          fontSize: 13,
          fontWeight: active ? FontWeight.w700 : FontWeight.w400,
          color: active ? PublicColors.green : PublicColors.gray500,
        );
    void setLocale(String code) => ref.read(localeProvider.notifier).setLocale(Locale(code));

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        InkWell(onTap: () => setLocale('fr'), child: Text('FR', style: style(current == 'fr'))),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 4),
          child: Text('|', style: TextStyle(color: PublicColors.gray400, fontSize: 13)),
        ),
        InkWell(onTap: () => setLocale('en'), child: Text('EN', style: style(current == 'en'))),
      ],
    );
  }
}

void _showMobileMenu(BuildContext context, WidgetRef ref) {
  final l10n = context.l10n;
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
    ),
    builder: (sheetContext) {
      void go(String route) {
        Navigator.of(sheetContext).pop();
        router.go(route);
      }

      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(title: Text(l10n.camleapNavOnefop), onTap: () => go('/programme')),
              ListTile(title: Text(l10n.landingNavAbout), onTap: () => go('/lmis')),
              ListTile(title: Text(l10n.landingNavObservatory), onTap: () => go('/observatory')),
              const Divider(height: 1, color: PublicColors.gray200),
              ListTile(title: Text(l10n.camleapNavRegistre), onTap: () => go('/registre-formations')),
              ListTile(title: Text(l10n.camleapNavEnquetes), onTap: () => go('/enquetes-employeurs')),
              const Divider(height: 1, color: PublicColors.gray200),
              const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: _LangToggle()),
              ListTile(title: Text(l10n.camleapSignIn), onTap: () => go('/login')),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: PublicPrimaryButton(
                  label: l10n.camleapEspaceDeclarant,
                  expanded: true,
                  onPressed: () => go('/login'),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

// ── 2. Hero ──────────────────────────────────────────────────

class _Hero extends StatelessWidget {
  final VoidCallback onDeclareTap;
  const _Hero({required this.onDeclareTap});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final mobile = context.isMobile;

    return _Section(
      vPadTop: 88,
      vPadBottom: 88,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: mobile ? double.infinity : 720),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.camleapHeroHeadline,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: mobile ? 30 : 44,
                    height: 1.2,
                    color: PublicColors.gray900,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  l10n.camleapHeroTagline,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 18,
                    height: 1.4,
                    color: PublicColors.green,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  l10n.camleapHeroBody,
                  style: const TextStyle(
                    fontSize: 16,
                    height: 1.6,
                    color: PublicColors.gray700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Wrap(
            spacing: 16,
            runSpacing: 12,
            children: [
              PublicPrimaryButton(label: l10n.camleapHeroCtaPrimary, onPressed: onDeclareTap),
              PublicOutlineButton(
                label: '${l10n.camleapHeroCtaSecondary} →',
                onPressed: () => router.go('/programme'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── 3. Audience + explainer row ─────────────────────────────

class _AudienceExplainerSection extends StatelessWidget {
  final Key sectionKey;
  const _AudienceExplainerSection({required this.sectionKey});

  @override
  Widget build(BuildContext context) {
    final mobile = context.isMobile;

    return _Section(
      sectionKey: sectionKey,
      color: _sectionGray,
      border: _grayY(),
      vPadTop: 64,
      vPadBottom: 72,
      child: mobile
          // Plain stacked children, no Expanded: this section sits in a
          // SingleChildScrollView, so a Column here gets unbounded height —
          // Expanded (a flex child) would throw ("non-zero flex but
          // incoming height constraints are unbounded"). Expanded only
          // makes sense in the desktop Row branch below, where the two
          // cards actually need to share finite horizontal space.
          ? const Column(children: [_AudienceCard(), SizedBox(height: 24), _ExplainerCard()])
          // IntrinsicHeight, not a bare Row(crossAxisAlignment: stretch):
          // stretch alone would try to give each card a tight *infinite*
          // height (same unbounded-height issue as above, just cross-axis)
          // and throw ("BoxConstraints forces an infinite height").
          // IntrinsicHeight measures the cards' natural heights first so
          // stretch has a finite height to match them to.
          : const IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: _AudienceCard()),
                  SizedBox(width: 24),
                  Expanded(child: _ExplainerCard()),
                ],
              ),
            ),
    );
  }
}

class _AudienceCard extends StatelessWidget {
  const _AudienceCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: PublicColors.gray200),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.camleapAudienceTitle,
              style: const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 24, color: PublicColors.gray900)),
          const SizedBox(height: 24),
          _EntityGroupCard(
            title: l10n.camleapEconomicEntitiesTitle,
            links: [
              (l10n.camleapEntreprise, '/declarer/entreprise'),
              (l10n.camleapCooperative, '/declarer/cooperative'),
            ],
          ),
          const SizedBox(height: 16),
          _EntityGroupCard(
            title: l10n.camleapPublicEntitiesTitle,
            links: [
              (l10n.camleapCtd, '/declarer/ctd'),
              (l10n.camleapOng, '/declarer/ong'),
            ],
          ),
          const SizedBox(height: 16),
          _MutedFormationCard(
            title: l10n.camleapVocationalTrainingTitle,
            body: l10n.camleapVocationalTrainingBody,
            badge: l10n.camleapComingSoonBadge,
          ),
        ],
      ),
    );
  }
}

class _EntityGroupCard extends StatelessWidget {
  final String title;
  final List<(String, String)> links;
  const _EntityGroupCard({required this.title, required this.links});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(left: BorderSide(color: PublicColors.green, width: 4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 18, color: PublicColors.gray900)),
          const SizedBox(height: 8),
          for (final link in links) _SubLinkRow(label: link.$1, route: link.$2),
        ],
      ),
    );
  }
}

class _SubLinkRow extends StatelessWidget {
  final String label;
  final String route;
  const _SubLinkRow({required this.label, required this.route});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => router.go(route),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 14, color: PublicColors.gray700)),
            ),
            const Text('→',
                style: TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14, color: PublicColors.green)),
          ],
        ),
      ),
    );
  }
}

class _MutedFormationCard extends StatelessWidget {
  final String title;
  final String body;
  final String badge;
  const _MutedFormationCard({required this.title, required this.body, required this.badge});

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: 0.7,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(left: BorderSide(color: PublicColors.gray300, width: 4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 18, color: PublicColors.gray500)),
            const SizedBox(height: 8),
            Text(body,
                style: const TextStyle(fontSize: 13, height: 1.5, color: PublicColors.gray500)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: PublicColors.gray200,
                borderRadius: BorderRadius.circular(2),
              ),
              child: Text(badge,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 11, color: PublicColors.gray600)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExplainerCard extends StatelessWidget {
  const _ExplainerCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: PublicColors.gray200),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.camleapUnderstandTitle,
              style: const TextStyle(
                  fontWeight: FontWeight.w800, fontSize: 32, color: PublicColors.gray900)),
          const SizedBox(height: 12),
          Text(l10n.camleapUnderstandBody,
              style: const TextStyle(fontSize: 16, height: 1.6, color: PublicColors.gray700)),
          const SizedBox(height: 16),
          _ExplainerSubCard(
            title: l10n.camleapLmisCardTitle,
            body: l10n.camleapLmisCardBody,
            badge: l10n.camleapLmisBadge,
            badgeBg: _chipGreenBg,
            badgeText: _chipGreenText,
            onLearnMore: () => router.go('/lmis'),
          ),
          const SizedBox(height: 16),
          _ExplainerSubCard(
            title: l10n.camleapObservatoireCardTitle,
            body: l10n.camleapObservatoireCardBody,
            badge: l10n.camleapAVenir,
            badgeBg: PublicColors.gray200,
            badgeText: PublicColors.gray600,
            onLearnMore: () => router.go('/observatory'),
          ),
        ],
      ),
    );
  }
}

class _ExplainerSubCard extends StatelessWidget {
  final String title;
  final String body;
  final String badge;
  final Color badgeBg;
  final Color badgeText;
  final VoidCallback onLearnMore;

  const _ExplainerSubCard({
    required this.title,
    required this.body,
    required this.badge,
    required this.badgeBg,
    required this.badgeText,
    required this.onLearnMore,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: _cardOffWhite,
        border: Border.all(color: PublicColors.gray200),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 20, color: PublicColors.gray900)),
          const SizedBox(height: 12),
          Text(body,
              style: const TextStyle(fontSize: 15, height: 1.6, color: PublicColors.gray700)),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(2)),
                child: Text(badge,
                    style: TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 12, color: badgeText)),
              ),
              InkWell(
                onTap: onLearnMore,
                child: Text('${l10n.camleapLearnMore} →',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14, color: PublicColors.green)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── 4. Status section ────────────────────────────────────────

class _StatusSection extends StatelessWidget {
  const _StatusSection();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final mobile = context.isMobile;
    final available = _StatusColumn(
      title: l10n.camleapAvailableTodayTitle,
      items: [l10n.camleapAvailable1, l10n.camleapAvailable2, l10n.camleapAvailable3],
      icon: Icons.check,
      iconColor: PublicColors.green,
    );
    final upcoming = _StatusColumn(
      title: l10n.camleapAVenir,
      items: [
        l10n.camleapComing1,
        l10n.camleapNavEnquetes,
        l10n.camleapComing3,
        l10n.camleapComing4,
      ],
      icon: Icons.schedule,
      iconColor: PublicColors.gray500,
    );

    return _Section(
      color: _sectionGray,
      border: _grayY(),
      vPadTop: 80,
      vPadBottom: 80,
      child: mobile
          ? Column(children: [
              available,
              const SizedBox(height: 32),
              upcoming,
            ])
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: available),
                const SizedBox(width: 48),
                Expanded(child: upcoming),
              ],
            ),
    );
  }
}

class _StatusColumn extends StatelessWidget {
  final String title;
  final List<String> items;
  final IconData icon;
  final Color iconColor;
  const _StatusColumn({
    required this.title,
    required this.items,
    required this.icon,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: const TextStyle(
                fontWeight: FontWeight.w700, fontSize: 20, color: PublicColors.gray900)),
        const SizedBox(height: 24),
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 16, color: iconColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(item,
                      style: const TextStyle(
                          fontSize: 15, height: 1.3, color: PublicColors.gray700)),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

// ── 5. Footer ────────────────────────────────────────────────

class _CamleapFooter extends StatelessWidget {
  const _CamleapFooter();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final mobile = context.isMobile;

    final access = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.camleapAccessRequestTitle,
            style: const TextStyle(
                fontWeight: FontWeight.w700, fontSize: 16, color: PublicColors.gray900)),
        const SizedBox(height: 16),
        ConstrainedBox(
          constraints: BoxConstraints(maxWidth: mobile ? double.infinity : 480),
          child: Text(l10n.camleapAccessRequestBody,
              style: const TextStyle(fontSize: 14, height: 1.5, color: PublicColors.gray700)),
        ),
        const SizedBox(height: 16),
        InkWell(
          onTap: () => launchUrl(Uri.parse('mailto:contact@onefop.cm')),
          child: const Text('contact@onefop.cm',
              style: TextStyle(
                  fontWeight: FontWeight.w600, fontSize: 14, color: PublicColors.green)),
        ),
        const SizedBox(height: 4),
        Text(l10n.camleapYaounde,
            style: const TextStyle(fontSize: 13, color: PublicColors.gray500)),
      ],
    );

    final admin = Column(
      crossAxisAlignment: mobile ? CrossAxisAlignment.start : CrossAxisAlignment.end,
      children: [
        Text(l10n.platformName,
            style: const TextStyle(
                fontWeight: FontWeight.w800, fontSize: 18, color: PublicColors.gray900)),
        const SizedBox(height: 16),
        Column(
          crossAxisAlignment: mobile ? CrossAxisAlignment.start : CrossAxisAlignment.end,
          children: [
            Text(l10n.landingOnefopFull,
                textAlign: mobile ? TextAlign.left : TextAlign.right,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 13, color: PublicColors.gray700)),
            const SizedBox(height: 4),
            Text('${l10n.landingOnefopName} · ${l10n.landingMinefopName}',
                style: const TextStyle(fontSize: 13, color: PublicColors.gray500)),
            const SizedBox(height: 4),
            Text(l10n.landingRepublic.toUpperCase(),
                style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 11,
                    letterSpacing: 0.5,
                    color: PublicColors.gray500)),
          ],
        ),
      ],
    );

    return _Section(
      border: const Border(top: BorderSide(color: PublicColors.gray200)),
      vPadTop: 64,
      vPadBottom: 40,
      child: Column(
        children: [
          mobile
              ? Column(children: [access, const SizedBox(height: 32), admin])
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [access, const Spacer(), admin],
                ),
          const SizedBox(height: 48),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.only(top: 24),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: PublicColors.gray200)),
            ),
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              runSpacing: 12,
              children: [
                Text(
                  l10n.camleapCopyright(DateTime.now().year),
                  style: const TextStyle(fontSize: 13, color: PublicColors.gray500),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _sectionGray,
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: const Text('v0.1.0-alpha',
                      style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 11,
                          color: PublicColors.gray500)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
