import 'package:flutter/material.dart';
import '../shared/tab_container.dart';
import 'users_directory_screen.dart';
import 'companies_screen.dart';

// ══════════════════════════════════════════════════════════════
// AnnuaireScreen — merges the user directory and the company
// directory behind one "Annuaire" nav entry. Each tab is a single
// searchable/filterable table — no nested tabs inside a tab.
// ══════════════════════════════════════════════════════════════

class AnnuaireScreen extends StatelessWidget {
  const AnnuaireScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const TabContainer(tabs: [
      (label: 'Utilisateurs', child: UsersDirectoryScreen()),
      (label: 'Entités', child: CompaniesScreen()),
    ]);
  }
}
