// CAMLEAP "/observatory" page — describes what the future public labour-
// market observatory will provide. Publicly accessible and purely
// informational (no login/portal gating) — this page is about what the
// observatory will do, not the observatory itself.
//
// Content is genuinely new (LandingConfig.observatory — see
// lib/models/landing_config.dart) and currently placeholder: no real copy
// exists yet, so the page carries a visible "content in preparation"
// badge alongside the Super-Admin-editable title/description/indicators,
// rather than reading as finished copy about a feature that doesn't exist
// yet. The admin editor carries the matching internal note (see
// landing_config_screen.dart).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/i18n/l10n_ext.dart';
import '../models/landing_config.dart';
import '../providers/landing_config_provider.dart';
import '../widgets/public_chrome.dart';
import 'landing_shared.dart';

class ObservatoryScreen extends ConsumerWidget {
  const ObservatoryScreen({super.key});

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
          const PublicPageHeader(current: PublicPage.observatory),
          Expanded(
            child: SingleChildScrollView(
              key: const Key('observatory-scroll'),
              child: Column(
                children: [
                  _ObservatorySection(config: config),
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

class _ObservatorySection extends StatelessWidget {
  final LandingConfig config;
  const _ObservatorySection({required this.config});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final loc = context.loc;

    return Band(
      color: Colors.white,
      maxWidth: 720,
      child: Column(
        children: [
          Kicker(l10n.landingKickerObservatory),
          const SizedBox(height: 10),
          SectionTitle(config.observatory.title.of(loc), align: TextAlign.center),
          const SizedBox(height: 14),
          _InPreparationBadge(label: l10n.landingObservatoryBadge),
          const SizedBox(height: 24),
          Text(
            config.observatory.description.of(loc),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              height: 1.6,
              color: PublicColors.gray700,
            ),
          ),
          const SizedBox(height: 36),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final indicator in config.observatory.indicators)
                _IndicatorChip(label: indicator.of(loc)),
            ],
          ),
        ],
      ),
    );
  }
}

/// Small visible flag that this page's content is provisional — distinct
/// from the admin editor's internal note (_FormSection's `note` field in
/// landing_config_screen.dart), since here it's a public-facing signal,
/// not just an editorial reminder.
class _InPreparationBadge extends StatelessWidget {
  final String label;
  const _InPreparationBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: PublicColors.gray100,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: PublicColors.gray300),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.hourglass_empty_rounded,
              size: 13, color: PublicColors.gray500),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
              color: PublicColors.gray600,
            ),
          ),
        ],
      ),
    );
  }
}

class _IndicatorChip extends StatelessWidget {
  final String label;
  const _IndicatorChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: PublicColors.greenLight,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 13.5,
          fontWeight: FontWeight.w600,
          color: PublicColors.greenDark,
        ),
      ),
    );
  }
}
