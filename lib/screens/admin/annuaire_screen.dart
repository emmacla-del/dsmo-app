import 'package:flutter/material.dart';
import '../shared/tab_container.dart';
import 'users_directory_screen.dart';
import 'companies_screen.dart';

// ══════════════════════════════════════════════════════════════
// AnnuaireScreen — merges the user directory and the company
// directory behind one "Annuaire" nav entry. Each tab is a single
// searchable/filterable table — no nested tabs inside a tab.
//
// User account administration (roster, role assignment, password
// reset) is a SUPER_ADMIN-only privilege on the backend — the
// stream-scoped SUPER_ADMIN_DSMO/SUPER_ADMIN_ONEFOP roles would get
// 403s from UsersDirectoryScreen, so they're routed here with
// showUsersTab: false and only ever see the Entités tab.
// ══════════════════════════════════════════════════════════════

class AnnuaireScreen extends StatelessWidget {
  const AnnuaireScreen({super.key, this.showUsersTab = true});

  final bool showUsersTab;

  @override
  Widget build(BuildContext context) {
    if (!showUsersTab) return const CompaniesScreen();
    return const TabContainer(tabs: [
      (label: 'Utilisateurs', child: UsersDirectoryScreen()),
      (label: 'Entités', child: CompaniesScreen()),
    ]);
  }
}
