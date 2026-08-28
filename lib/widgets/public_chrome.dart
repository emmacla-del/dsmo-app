// Shared chrome for the public (unauthenticated) surfaces: landing, login,
// register, and the password / email-verification screens. One palette, one
// logo, one language toggle — so a visual tweak is not a four-file copy.
//
// Brand green matches AppTheme / the CAMLEAP logo (forest green 0xFF1E6B3A),
// not the older teal used by the MINEFOP portal.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/i18n/l10n_ext.dart';
import '../providers/locale_provider.dart';

const kCamleapLogoAsset = 'assets/images/camleap_logo.png';

class PublicColors {
  PublicColors._();

  static const green = Color(0xFF1E6B3A);
  static const greenDark = Color(0xFF124023);
  static const greenLight = Color(0xFFE8F3EC);
  static const greenMid = Color(0xFFC5DCCE);
  static const gray100 = Color(0xFFF3F4F6);
  static const gray200 = Color(0xFFE5E7EB);
  static const gray300 = Color(0xFFD1D5DB);
  static const gray400 = Color(0xFF9CA3AF);
  static const gray500 = Color(0xFF6B7280);
  static const gray600 = Color(0xFF4B5563);
  static const gray700 = Color(0xFF374151);
  static const gray800 = Color(0xFF1F2937);
  static const gray900 = Color(0xFF111827);
  static const bg = Color(0xFFFAFAF7);
  static const red = Color(0xFFB91C1C);
  static const redFaint = Color(0xFFFEF2F2);
  static const redBorder = Color(0xFFFECACA);

  /// Cameroon flag red/yellow — used only as a thin institutional accent,
  /// never as a large decorative flag.
  static const flagRed = Color(0xFFCE1126);
  static const flagYellow = Color(0xFFFCD116);
}

class PublicLogo extends StatelessWidget {
  final double size;
  final bool filledFallback;
  final VoidCallback? onTap;

  const PublicLogo({
    super.key,
    this.size = 32,
    this.filledFallback = true,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final logo = Image.asset(
      kCamleapLogoAsset,
      width: size,
      height: size,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: filledFallback
              ? PublicColors.green
              : PublicColors.green.withValues(alpha: 0.1),
          shape: BoxShape.circle,
        ),
        child: Center(
          child: Text(
            'C',
            style: TextStyle(
              fontSize: size * 0.45,
              fontWeight: FontWeight.w900,
              color: filledFallback ? Colors.white : PublicColors.green,
            ),
          ),
        ),
      ),
    );

    if (onTap == null) return logo;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: logo,
    );
  }
}

/// Landing top-bar brand: logo + wordmark + full name.
class PublicWordmark extends StatelessWidget {
  final double logoSize;
  final VoidCallback? onTap;

  const PublicWordmark({super.key, this.logoSize = 32, this.onTap});

  @override
  Widget build(BuildContext context) {
    final mobile = MediaQuery.sizeOf(context).width < 600;
    final brand = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        PublicLogo(size: logoSize),
        const SizedBox(width: 10),
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
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: PublicColors.gray900,
                  letterSpacing: 0.8,
                ),
              ),
              Text(
                context.l10n.platformFullName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: mobile ? 9 : 10.5,
                  fontWeight: FontWeight.w500,
                  color: PublicColors.gray500,
                ),
              ),
            ],
          ),
        ),
      ],
    );

    if (onTap == null) return brand;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: brand,
    );
  }
}

/// Compact centered brand used above auth cards.
class PublicCompactBrandHeader extends StatelessWidget {
  final VoidCallback? onTap;

  const PublicCompactBrandHeader({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    final header = Column(
      children: [
        const PublicLogo(size: 44, filledFallback: false),
        const SizedBox(height: 10),
        Text(
          context.l10n.platformName,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.w800,
            color: PublicColors.gray900,
            letterSpacing: -0.2,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          context.l10n.platformTagline,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w400,
            color: PublicColors.gray500,
          ),
        ),
      ],
    );

    if (onTap == null) return header;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: header,
    );
  }
}

class PublicLanguageToggle extends ConsumerWidget {
  final bool compact;

  const PublicLanguageToggle({super.key, this.compact = false});

  static const _shortLabels = {'fr': 'FR', 'en': 'EN'};
  static const _fullLabels = {'fr': 'Français', 'en': 'English'};

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(localeProvider);
    final label = _shortLabels[current.languageCode] ?? 'FR';

    return PopupMenuButton<Locale>(
      initialValue: current,
      onSelected: (l) => ref.read(localeProvider.notifier).setLocale(l),
      tooltip: '',
      color: Colors.white,
      offset: const Offset(0, 36),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      itemBuilder: (context) => _shortLabels.keys
          .map(
            (code) => PopupMenuItem<Locale>(
              value: Locale(code),
              child: Text(
                '${_fullLabels[code]} (${_shortLabels[code]})',
                style: TextStyle(
                  fontWeight: code == current.languageCode
                      ? FontWeight.w800
                      : FontWeight.w500,
                  color: PublicColors.greenDark,
                ),
              ),
            ),
          )
          .toList(),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 8 : 10,
          vertical: compact ? 5 : 7,
        ),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: PublicColors.gray200),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.language,
                size: compact ? 13 : 15, color: PublicColors.gray500),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: compact ? 12 : 13,
                fontWeight: FontWeight.w800,
                color: PublicColors.gray700,
              ),
            ),
            Icon(Icons.arrow_drop_down,
                size: compact ? 16 : 18, color: PublicColors.gray500),
          ],
        ),
      ),
    );
  }
}

class PublicCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final bool clip;

  const PublicCard({
    super.key,
    required this.child,
    this.padding,
    this.clip = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: PublicColors.gray200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: clip ? Clip.antiAlias : Clip.none,
      child: padding == null ? child : Padding(padding: padding!, child: child),
    );
  }
}

class PublicPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isBusy;
  final bool expanded;

  const PublicPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isBusy = false,
    this.expanded = false,
  });

  @override
  Widget build(BuildContext context) {
    final button = ElevatedButton(
      onPressed: isBusy ? null : onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: PublicColors.green,
        foregroundColor: Colors.white,
        disabledBackgroundColor: PublicColors.green.withValues(alpha: 0.6),
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: isBusy
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: Colors.white),
            )
          : Text(
              label,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
            ),
    );
    if (expanded) return SizedBox(width: double.infinity, child: button);
    return button;
  }
}

class PublicOutlineButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool expanded;

  const PublicOutlineButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.expanded = false,
  });

  @override
  Widget build(BuildContext context) {
    final button = OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: PublicColors.green,
        side: const BorderSide(color: PublicColors.green),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
      ),
    );
    if (expanded) return SizedBox(width: double.infinity, child: button);
    return button;
  }
}

class PublicErrorBox extends StatelessWidget {
  final String message;

  const PublicErrorBox(this.message, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: PublicColors.redFaint,
        border: Border.all(color: PublicColors.redBorder),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        message,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: PublicColors.red,
        ),
      ),
    );
  }
}

/// Language toggle + optional brand header + centered card. Used by login
/// and the password / email-verification screens.
class PublicAuthScaffold extends StatelessWidget {
  final Widget child;
  final VoidCallback? onLogoTap;
  final bool showBrandHeader;
  final double maxWidth;

  const PublicAuthScaffold({
    super.key,
    required this.child,
    this.onLogoTap,
    this.showBrandHeader = true,
    this.maxWidth = 480,
  });

  @override
  Widget build(BuildContext context) {
    final mobile = MediaQuery.sizeOf(context).width < 600;
    return Scaffold(
      backgroundColor: PublicColors.bg,
      body: Column(
        children: [
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: Align(
                alignment: Alignment.topRight,
                child: PublicLanguageToggle(compact: mobile),
              ),
            ),
          ),
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: maxWidth),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 16),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (showBrandHeader) ...[
                              PublicCompactBrandHeader(onTap: onLogoTap),
                              const SizedBox(height: 24),
                            ],
                            child,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
