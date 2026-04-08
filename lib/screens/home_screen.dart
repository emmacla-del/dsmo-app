import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../theme/app_colors.dart';
import 'dsmo/declaration_wizard_screen.dart';
import 'dsmo/declarations_list_screen.dart';
import 'dsmo/analytics_dashboard_screen.dart';
import 'dsmo/send_notification_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).valueOrNull;
    if (user == null) return const SizedBox.shrink();

    final tabs = _buildTabs(user.role);

    // Guard selected index in case tabs change after role switch
    final safeIndex = _selectedIndex.clamp(0, tabs.length - 1);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'DSMO — Intelligence du travail',
          style: TextStyle(
              color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16),
        ),
        backgroundColor: AppColors.deepEmerald,
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.account_circle, color: Colors.white),
            onSelected: (value) {
              if (value == 'logout') _confirmLogout(context);
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.email,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _roleLabel(user.role),
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.slate),
                    ),
                    if (user.region != null)
                      Text(
                        user.region!,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.silver),
                      ),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, color: Colors.red),
                    SizedBox(width: 8),
                    Text('Déconnexion',
                        style: TextStyle(color: Colors.red)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: tabs[safeIndex].screen,
      bottomNavigationBar: tabs.length >= 2
          ? BottomNavigationBar(
              currentIndex: safeIndex,
              onTap: (i) => setState(() => _selectedIndex = i),
              selectedItemColor: AppColors.deepEmerald,
              unselectedItemColor: AppColors.silver,
              type: BottomNavigationBarType.fixed,
              items: tabs
                  .map((t) => BottomNavigationBarItem(
                        icon: Icon(t.icon),
                        label: t.label,
                      ))
                  .toList(),
            )
          : null,
      floatingActionButton: user.role == 'COMPANY'
          ? FloatingActionButton.extended(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => const DeclarationWizardScreen()),
              ),
              backgroundColor: AppColors.deepEmerald,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text(
                'Nouvelle déclaration',
                style: TextStyle(color: Colors.white),
              ),
            )
          : null,
    );
  }

  List<_Tab> _buildTabs(String role) {
    switch (role) {
      case 'COMPANY':
        return [
          _Tab(
            'Mes déclarations',
            Icons.description_outlined,
            const DeclarationsListScreen(),
          ),
        ];
      case 'DIVISIONAL':
      case 'REGIONAL':
        return [
          _Tab(
            'En attente',
            Icons.pending_actions_outlined,
            const DeclarationsListScreen(),
          ),
          _Tab(
            'Notifications',
            Icons.notifications_outlined,
            const SendNotificationScreen(),
          ),
        ];
      case 'CENTRAL':
      default:
        return [
          _Tab(
            'Tableau de bord',
            Icons.dashboard_outlined,
            const AnalyticsDashboardScreen(),
          ),
          _Tab(
            'En attente',
            Icons.pending_actions_outlined,
            const DeclarationsListScreen(),
          ),
          _Tab(
            'Notifications',
            Icons.notifications_outlined,
            const SendNotificationScreen(),
          ),
        ];
    }
  }

  String _roleLabel(String role) {
    switch (role) {
      case 'COMPANY':
        return 'Établissement';
      case 'DIVISIONAL':
        return 'Division du Travail';
      case 'REGIONAL':
        return 'Délégation Régionale';
      case 'CENTRAL':
        return 'Direction Nationale';
      default:
        return role;
    }
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Déconnexion'),
        content: const Text('Voulez-vous vraiment vous déconnecter ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style:
                ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Déconnecter',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm == true && mounted) {
      ref.read(authProvider.notifier).logout();
    }
  }
}

class _Tab {
  final String label;
  final IconData icon;
  final Widget screen;
  const _Tab(this.label, this.icon, this.screen);
}
