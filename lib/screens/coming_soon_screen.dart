// Lightweight placeholder for CAMLEAP nav destinations that don't have a
// real page yet (/declarer/*, /registre-formations, /enquetes-employeurs,
// /espace-declarant — see CamleapLandingScreen's nav/CTAs). Keeps every
// link in the new nav live instead of 404ing while those flows are built
// out one at a time. Shares the same public chrome as /programme, /lmis,
// /observatory so it reads as part of the site, not a dead end.

import 'package:flutter/material.dart';
import '../core/i18n/l10n_ext.dart';
import '../screens/landing_shared.dart';
import '../widgets/public_chrome.dart';
import '../main.dart' show router;

class ComingSoonScreen extends StatelessWidget {
  final String title;
  final String message;
  final String? ctaLabel;
  final String? ctaRoute;

  const ComingSoonScreen({
    super.key,
    required this.title,
    required this.message,
    this.ctaLabel,
    this.ctaRoute,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PublicColors.bg,
      body: Column(
        children: [
          const TricolorBar(),
          const PublicPageHeader(current: PublicPage.home),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  Band(
                    maxWidth: 640,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Kicker(context.l10n.camleapComingSoonBadge),
                        const SizedBox(height: 16),
                        SectionTitle(title, align: TextAlign.center),
                        const SizedBox(height: 16),
                        Text(
                          message,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 15.5,
                            height: 1.6,
                            color: PublicColors.gray600,
                          ),
                        ),
                        if (ctaLabel != null && ctaRoute != null) ...[
                          const SizedBox(height: 28),
                          PublicPrimaryButton(
                            label: ctaLabel!,
                            onPressed: () => router.go(ctaRoute!),
                          ),
                        ],
                      ],
                    ),
                  ),
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
