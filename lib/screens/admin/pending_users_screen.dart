import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../theme/app_colors.dart';

class PendingUsersScreen extends ConsumerStatefulWidget {
  const PendingUsersScreen({super.key});

  @override
  ConsumerState<PendingUsersScreen> createState() => _PendingUsersScreenState();
}

class _PendingUsersScreenState extends ConsumerState<PendingUsersScreen> {
  List<dynamic> _users = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPendingUsers();
  }

  Future<void> _loadPendingUsers() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.get('/auth/pending-minefop');
      setState(() {
        _users = resp.data as List;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _approveUser(String id) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/auth/approve-user/$id');
      _loadPendingUsers(); // refresh list
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Utilisateur approuvé'),
            backgroundColor: Colors.green),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _rejectUser(String id) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Motif du rejet'),
        content: TextField(
          decoration: const InputDecoration(hintText: 'Raison (optionnel)'),
          onChanged: (value) {},
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, null),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(context, 'Rejeté'),
              child: const Text('Rejeter')),
        ],
      ),
    );
    if (reason == null) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/auth/reject-user/$id', data: {'reason': reason});
      _loadPendingUsers();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Utilisateur rejeté'),
            backgroundColor: Colors.orange),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Approbation des agents MINEFOP'),
        backgroundColor: AppColors.deepEmerald,
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Erreur: $_error'))
              : _users.isEmpty
                  ? const Center(child: Text('Aucune demande en attente'))
                  : ListView.builder(
                      itemCount: _users.length,
                      itemBuilder: (ctx, i) {
                        final u = _users[i];
                        return Card(
                          margin: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          child: ListTile(
                            title: Text('${u['firstName']} ${u['lastName']}'),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Email: ${u['email']}'),
                                if (u['matricule'] != null)
                                  Text('Matricule: ${u['matricule']}'),
                                if (u['serviceCode'] != null)
                                  Text('Service: ${u['serviceCode']}'),
                                Text('Rôle: ${u['role']}'),
                                Text(
                                    'Demandé le: ${_formatDate(u['createdAt'])}'),
                              ],
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.check_circle,
                                      color: Colors.green),
                                  onPressed: () => _approveUser(u['id']),
                                  tooltip: 'Approuver',
                                ),
                                IconButton(
                                  icon: const Icon(Icons.cancel,
                                      color: Colors.red),
                                  onPressed: () => _rejectUser(u['id']),
                                  tooltip: 'Rejeter',
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
    );
  }

  String _formatDate(String iso) {
    final d = DateTime.parse(iso);
    return '${d.day}/${d.month}/${d.year}';
  }
}
