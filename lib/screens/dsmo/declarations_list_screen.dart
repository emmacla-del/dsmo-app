import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../providers/auth_provider.dart';
import '../../../theme/app_colors.dart';
import 'declaration_approval_screen.dart';

class DeclarationsListScreen extends ConsumerStatefulWidget {
  const DeclarationsListScreen({super.key});

  @override
  ConsumerState<DeclarationsListScreen> createState() =>
      _DeclarationsListScreenState();
}

class _DeclarationsListScreenState
    extends ConsumerState<DeclarationsListScreen> {
  List<dynamic> _declarations = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final user = ref.read(authProvider).valueOrNull;
      final isCompany = user?.role == 'COMPANY';
      final path =
          isCompany ? '/dsmo/declarations' : '/dsmo/declarations/pending';
      final resp = await api.get(path);
      if (!mounted) return;
      setState(() {
        _declarations = resp.data is List ? resp.data as List : [];
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'SUBMITTED':
        return Colors.orange;
      case 'DIVISION_APPROVED':
        return Colors.blue;
      case 'REGION_APPROVED':
        return Colors.indigo;
      case 'FINAL_APPROVED':
        return Colors.green;
      case 'REJECTED':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'SUBMITTED':
        return 'Soumise';
      case 'DIVISION_APPROVED':
        return 'Approuvée — Division';
      case 'REGION_APPROVED':
        return 'Approuvée — Région';
      case 'FINAL_APPROVED':
        return 'Approuvée — Finale';
      case 'REJECTED':
        return 'Rejetée';
      case 'DRAFT':
        return 'Brouillon';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).valueOrNull;
    final isCompany = user?.role == 'COMPANY';

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 56),
              const SizedBox(height: 16),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Réessayer'),
              ),
            ],
          ),
        ),
      );
    }

    if (_declarations.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inbox_outlined, size: 72, color: AppColors.ghost),
            const SizedBox(height: 16),
            Text(
              isCompany
                  ? 'Aucune déclaration soumise'
                  : 'Aucune déclaration en attente',
              style:
                  const TextStyle(fontSize: 16, color: AppColors.slate),
            ),
            const SizedBox(height: 8),
            if (isCompany)
              const Text(
                'Utilisez le bouton + pour soumettre votre première déclaration.',
                style: TextStyle(fontSize: 13, color: AppColors.silver),
                textAlign: TextAlign.center,
              ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _declarations.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final d = _declarations[index] as Map<String, dynamic>;
          final company =
              (d['company'] as Map<String, dynamic>?) ?? {};
          final status = d['status'] as String? ?? '';
          final employees = (d['employees'] as List?) ?? [];

          return Card(
            elevation: 2,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10)),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () async {
                final result = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => DeclarationApprovalScreen(
                      declarationId: d['id'] as String,
                      isReadOnly: isCompany,
                    ),
                  ),
                );
                if (result == true) _load();
              },
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.deepEmerald.withAlpha(25),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.business,
                          color: AppColors.deepEmerald),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            company['name'] as String? ??
                                'Entreprise inconnue',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Année ${d['year']}'
                            '  •  ${company['region'] ?? d['region'] ?? ''}'
                            '${employees.isNotEmpty ? '  •  ${employees.length} employés' : ''}',
                            style: const TextStyle(
                                color: AppColors.slate, fontSize: 12),
                          ),
                          const SizedBox(height: 6),
                          _StatusBadge(
                            label: _statusLabel(status),
                            color: _statusColor(status),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right,
                        color: AppColors.silver),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _StatusBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(30),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(150)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
