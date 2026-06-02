// lib/widgets/responsive_helpers.dart
// ═══════════════════════════════════════════════════════════════
// Breakpoint utilities, responsive wrappers, and shared nav
// widgets extracted from HomeScreen for reuse and clarity.
// ═══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../theme/ultra_theme.dart';

// ── Breakpoints ───────────────────────────────────────────────

enum ScreenSize { mobile, tablet, desktop }

extension ScreenSizeX on BuildContext {
  double get screenWidth => MediaQuery.of(this).size.width;

  ScreenSize get screenSize {
    final w = screenWidth;
    if (w < 600) return ScreenSize.mobile;
    if (w < 1100) return ScreenSize.tablet;
    return ScreenSize.desktop;
  }

  bool get isMobile => screenSize == ScreenSize.mobile;
  bool get isTablet => screenSize == ScreenSize.tablet;
  bool get isDesktop => screenSize == ScreenSize.desktop;
  bool get usesRail => !isMobile; // tablet + desktop both use rail

  /// Padding that scales with screen width.
  double get contentPadding => (screenWidth * 0.025).clamp(12.0, 32.0);

  /// Responsive dialog width — never overflows.
  double get dialogWidth => (screenWidth - 40).clamp(0.0, 420.0);
}

// ── Responsive Dialog Wrapper ─────────────────────────────────

/// Wraps dialog content so it never overflows on small screens.
/// Usage: wrap the Column/content inside a Dialog with this.
class ResponsiveDialogBox extends StatelessWidget {
  const ResponsiveDialogBox({
    super.key,
    required this.child,
    this.maxWidth = 420,
    this.padding = const EdgeInsets.all(28),
  });

  final Widget child;
  final double maxWidth;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final w = (context.screenWidth - 40).clamp(0.0, maxWidth);
    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Container(
        width: w,
        padding: padding,
        decoration: BoxDecoration(
          color: UltraTheme.surface,
          borderRadius: BorderRadius.circular(UltraTheme.radiusXL),
          boxShadow: UltraTheme.mediumShadow,
        ),
        child: child,
      ),
    );
  }
}

// ── Nav Rail Item ─────────────────────────────────────────────

class RailNavItem extends StatelessWidget {
  const RailNavItem({
    super.key,
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.isExpanded,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isSelected;
  final bool isExpanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: isExpanded ? '' : label,
      preferBelow: false,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        child: AnimatedContainer(
          duration: UltraTheme.fast,
          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          padding: EdgeInsets.symmetric(
            horizontal: isExpanded ? 14 : 0,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            gradient: isSelected ? UltraTheme.primaryGradient : null,
            color: isSelected ? null : Colors.transparent,
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
          ),
          // When collapsed: center the icon to avoid overflow.
          // When expanded: use a Row with the label.
          child: isExpanded
              ? Row(children: [
                  Icon(icon,
                      size: 20,
                      color: isSelected ? Colors.white : UltraTheme.textMuted),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.w500,
                        color: isSelected
                            ? Colors.white
                            : UltraTheme.textSecondary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ])
              : Center(
                  child: Icon(icon,
                      size: 20,
                      color: isSelected ? Colors.white : UltraTheme.textMuted),
                ),
        ),
      ),
    );
  }
}

// ── Bottom Nav Item ───────────────────────────────────────────

class BottomNavItem extends StatelessWidget {
  const BottomNavItem({
    super.key,
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: UltraTheme.fast,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          gradient: isSelected ? UltraTheme.primaryGradient : null,
          borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          AnimatedScale(
            scale: isSelected ? 1.1 : 1.0,
            duration: UltraTheme.fast,
            child: Icon(icon,
                color: isSelected ? Colors.white : UltraTheme.textMuted,
                size: 22),
          ),
          const SizedBox(height: 4),
          Text(label,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected ? Colors.white : UltraTheme.textMuted,
              )),
        ]),
      ),
    );
  }
}

// ── User Avatar ───────────────────────────────────────────────

class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.email,
    this.size = 38,
    this.fontSize = 14,
  });

  final String email;
  final double size;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: UltraTheme.heroGradient,
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
      ),
      child: Center(
        child: Text(
          email.isNotEmpty ? email[0].toUpperCase() : '?',
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

// ── Role Badge ────────────────────────────────────────────────

class RoleBadge extends StatelessWidget {
  const RoleBadge({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
      ),
      child: Text(label,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Colors.white.withValues(alpha: 0.9),
          )),
    );
  }
}

// ── Section Header (drawer) ───────────────────────────────────

class DrawerSectionHeader extends StatelessWidget {
  const DrawerSectionHeader(this.title, {super.key});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
      child: Text(title,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: UltraTheme.textMuted,
            letterSpacing: 1.2,
          )),
    );
  }
}

// ── Drawer Item ───────────────────────────────────────────────

class DrawerNavItem extends StatelessWidget {
  const DrawerNavItem({
    super.key,
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        splashColor: UltraTheme.primary.withValues(alpha: 0.05),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Row(children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: UltraTheme.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
              ),
              child: Icon(icon, size: 20, color: UltraTheme.primary),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text(label,
                          style: const TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: UltraTheme.textPrimary,
                          )),
                      if (badge != null) ...[
                        const SizedBox(width: 8),
                        _BadgePill(badge!),
                      ],
                    ]),
                    const SizedBox(height: 2),
                    Text(subtitle,
                        style: const TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          color: UltraTheme.textMuted,
                        )),
                  ]),
            ),
            Icon(Icons.chevron_right,
                size: 18, color: UltraTheme.textMuted.withValues(alpha: 0.5)),
          ]),
        ),
      ),
    );
  }
}

class _BadgePill extends StatelessWidget {
  const _BadgePill(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: UltraTheme.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
      ),
      child: Text(text,
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: UltraTheme.error,
          )),
    );
  }
}

// ── Logout Button (drawer footer) ─────────────────────────────

class DrawerLogoutButton extends StatelessWidget {
  const DrawerLogoutButton({super.key, required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          decoration: BoxDecoration(
            color: UltraTheme.error.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            border: Border.all(color: UltraTheme.error.withValues(alpha: 0.1)),
          ),
          child: Row(children: [
            const Icon(Icons.logout_rounded, size: 20, color: UltraTheme.error),
            const SizedBox(width: 12),
            const Text('Déconnexion',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: UltraTheme.error,
                )),
            const Spacer(),
            Icon(Icons.arrow_forward_ios,
                size: 14, color: UltraTheme.error.withValues(alpha: 0.5)),
          ]),
        ),
      ),
    );
  }
}

// ── Nav Rail Logo ─────────────────────────────────────────────

class RailLogo extends StatelessWidget {
  const RailLogo({super.key, required this.isExpanded});
  final bool isExpanded;

  @override
  Widget build(BuildContext context) {
    final icon = Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        gradient: UltraTheme.primaryGradient,
        borderRadius: BorderRadius.circular(10),
      ),
      child: const Icon(Icons.analytics, color: Colors.white, size: 22),
    );

    if (!isExpanded) return icon;

    return Row(children: [
      icon,
      const SizedBox(width: 12),
      const Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('DSMO',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: UltraTheme.textPrimary,
                letterSpacing: -0.5,
              )),
          Text('Intelligence du travail',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                color: UltraTheme.textMuted,
              )),
        ]),
      ),
    ]);
  }
}

// ── Rail User Footer ──────────────────────────────────────────

class RailUserFooter extends StatelessWidget {
  const RailUserFooter({
    super.key,
    required this.email,
    required this.roleLabel,
    required this.isExpanded,
    required this.onLogout,
  });

  final String email;
  final String roleLabel;
  final bool isExpanded;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    if (!isExpanded) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Center(
          child: IconButton(
            icon:
                const Icon(Icons.logout_outlined, color: UltraTheme.textMuted),
            onPressed: onLogout,
            tooltip: 'Déconnexion',
          ),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: UltraTheme.background,
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
      ),
      child: Row(children: [
        UserAvatar(email: email, size: 36, fontSize: 14),
        const SizedBox(width: 10),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(email,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: UltraTheme.textPrimary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
            Text(roleLabel,
                style: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  color: UltraTheme.textMuted,
                )),
          ]),
        ),
        IconButton(
          icon: const Icon(Icons.logout_outlined,
              size: 18, color: UltraTheme.textMuted),
          onPressed: onLogout,
          tooltip: 'Déconnexion',
        ),
      ]),
    );
  }
}

// ── Notification Bell ─────────────────────────────────────────

class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key, this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Stack(children: [
      IconButton(
        icon: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: UltraTheme.primary.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
          ),
          child: const Icon(Icons.notifications_outlined,
              color: UltraTheme.textSecondary, size: 20),
        ),
        onPressed: onTap ?? () {},
      ),
      Positioned(
        top: 8,
        right: 8,
        child: Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: UltraTheme.error,
            shape: BoxShape.circle,
            border: Border.all(color: UltraTheme.surface, width: 1.5),
          ),
        ),
      ),
    ]);
  }
}

// ── Content Shell ─────────────────────────────────────────────

/// Card shell that wraps the active tab's screen content.
class ContentShell extends StatelessWidget {
  const ContentShell({super.key, required this.child, this.margin});
  final Widget child;
  final EdgeInsets? margin;

  @override
  Widget build(BuildContext context) {
    final pad = context.contentPadding;
    return Container(
      margin: margin ?? EdgeInsets.all(pad),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        boxShadow: UltraTheme.softShadow,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        child: child,
      ),
    );
  }
}

// ── Bottom Nav Bar ────────────────────────────────────────────

class UltraBottomNavBar extends StatelessWidget {
  const UltraBottomNavBar({
    super.key,
    required this.tabs,
    required this.selectedIndex,
    required this.onTap,
  });

  final List<({IconData icon, String label})> tabs;
  final int selectedIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: UltraTheme.surface, boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.05),
          blurRadius: 20,
          offset: const Offset(0, -4),
        )
      ]),
      child: SafeArea(
        child: SizedBox(
          height: 72,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: tabs.asMap().entries.map((e) {
                return BottomNavItem(
                  icon: e.value.icon,
                  label: e.value.label,
                  isSelected: selectedIndex == e.key,
                  onTap: () => onTap(e.key),
                );
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }
}

// ── New Submission FAB ────────────────────────────────────────

class SubmissionFab extends StatelessWidget {
  const SubmissionFab({
    super.key,
    required this.animation,
    required this.onTap,
    this.compact = false,
  });

  final Animation<double> animation;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: animation,
      child: FloatingActionButton.extended(
        onPressed: onTap,
        backgroundColor: UltraTheme.primary,
        elevation: 4,
        highlightElevation: 8,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(UltraTheme.radiusFull),
        ),
        icon: const Icon(Icons.add, color: Colors.white, size: 22),
        label: Text(
          compact ? 'Nouveau' : 'Nouvelle soumission',
          style: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

// ── Responsive Scaffold ───────────────────────────────────────

class ResponsiveScaffold extends StatelessWidget {
  const ResponsiveScaffold({
    super.key,
    required this.appBar,
    required this.body,
    this.drawer,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.railNav,
  });

  final PreferredSizeWidget appBar;
  final Widget body;
  final Widget? drawer;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;

  /// Left rail widget, shown only on tablet/desktop.
  final Widget? railNav;

  @override
  Widget build(BuildContext context) {
    if (context.isMobile) {
      return Scaffold(
        backgroundColor: UltraTheme.background,
        appBar: appBar,
        drawer: drawer,
        body: body,
        bottomNavigationBar: bottomNavigationBar,
        floatingActionButton: floatingActionButton,
      );
    }

    // Tablet + Desktop: inline rail instead of drawer/bottom nav
    return Scaffold(
      backgroundColor: UltraTheme.background,
      floatingActionButton: floatingActionButton,
      body: Row(children: [
        if (railNav != null) railNav!,
        Expanded(
          child: Column(children: [
            appBar,
            Expanded(child: body),
          ]),
        ),
      ]),
    );
  }
}
