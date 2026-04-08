import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../theme/app_colors.dart';

class DeclarationApprovalScreen extends ConsumerStatefulWidget {
  final String declarationId;
  final bool isReadOnly;

  const DeclarationApprovalScreen({
    super.key,
    required this.declarationId,
    this.isReadOnly = false,
  });

  @override
  ConsumerState<DeclarationApprovalScreen> createState() =>
      _DeclarationApprovalScreenState();
}

class _DeclarationApprovalScreenState
    extends ConsumerState<DeclarationApprovalScreen> {
  Map<String, dynamic>? declaration;
  bool isLoading = true;
  bool isSubmitting = false;
  final _notesController = TextEditingController();
  final _rejectionReasonController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadDeclaration();
  }

  Future<void> _loadDeclaration() async {
    try {
      final api = ref.read(apiClientProvider);
      final response =
          await api.get('/dsmo/declarations/${widget.declarationId}');
      if (!mounted) return;
      setState(() {
        declaration = response.data;
        isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
      );
      setState(() => isLoading = false);
    }
  }

  Future<void> _approveDeclaration() async {
    setState(() => isSubmitting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.patch(
        '/dsmo/declarations/${widget.declarationId}/approve',
        data: {'notes': _notesController.text},
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Déclaration approuvée'),
            backgroundColor: Colors.green),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => isSubmitting = false);
    }
  }

  Future<void> _rejectDeclaration() async {
    if (_rejectionReasonController.text.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Veuillez entrer une raison de rejet'),
            backgroundColor: Colors.orange),
      );
      return;
    }

    setState(() => isSubmitting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.patch(
        '/dsmo/declarations/${widget.declarationId}/reject',
        data: {'reason': _rejectionReasonController.text},
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Déclaration rejetée'),
            backgroundColor: Colors.orange),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Approbation de déclaration'),
        backgroundColor: AppColors.deepEmerald,
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : declaration == null
              ? const Center(child: Text('Déclaration non trouvée'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Declaration header
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.lightEmerald.withAlpha(50),
                          border: Border.all(color: AppColors.deepEmerald),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              declaration!['company']?['name'] ??
                                  'Entreprise inconnue',
                              style: const TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            Text('Année: ${declaration!['year']}'),
                            Text('Statut: ${declaration!['status']}'),
                            Text('Région: ${declaration!['region']}'),
                            Text('Soumise le: ${declaration!['submittedAt']}'),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Company information
                      Text(
                        'Informations de l\'entreprise',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: AppColors.deepEmerald,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(height: 12),
                      _buildInfoRow('Activité principale',
                          declaration!['company']?['mainActivity'] ?? 'N/A'),
                      _buildInfoRow('Région',
                          declaration!['company']?['region'] ?? 'N/A'),
                      _buildInfoRow('Département',
                          declaration!['company']?['department'] ?? 'N/A'),
                      _buildInfoRow('Adresse',
                          declaration!['company']?['address'] ?? 'N/A'),
                      const SizedBox(height: 24),

                      // Workforce information
                      Text(
                        'Informations sur la main-d\'œuvre',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: AppColors.deepEmerald,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(height: 12),
                      _buildWorkforceTable(),
                      const SizedBox(height: 24),

                      // Validation steps
                      Text(
                        'Étapes de validation',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: AppColors.deepEmerald,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(height: 12),
                      if (declaration!['validationSteps'] != null)
                        ...List<Widget>.from(
                          declaration!['validationSteps'].map<Widget>(
                            (step) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(
                                children: [
                                  Icon(
                                    step['isValid']
                                        ? Icons.check_circle
                                        : Icons.dangerous,
                                    color: step['isValid']
                                        ? Colors.green
                                        : Colors.red,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      step['stepType'] ?? 'Unknown',
                                      style: TextStyle(
                                        color: step['isValid']
                                            ? Colors.green
                                            : Colors.red,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        )
                      else
                        const Text('Pas de données de validation disponibles'),
                      const SizedBox(height: 24),

                      // Approval / rejection actions — hidden for company users
                      if (!widget.isReadOnly) ...[

                      // Approval section
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.green),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Approuver',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.green),
                            ),
                            const SizedBox(height: 8),
                            TextFormField(
                              controller: _notesController,
                              decoration: const InputDecoration(
                                labelText: 'Notes supplémentaires (optionnel)',
                                border: OutlineInputBorder(),
                              ),
                              maxLines: 3,
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed:
                                    isSubmitting ? null : _approveDeclaration,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.green,
                                ),
                                child: isSubmitting
                                    ? const CircularProgressIndicator(
                                        color: Colors.white)
                                    : const Text('APPROUVER LA DÉCLARATION'),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Rejection section
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.red),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Rejeter',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.red),
                            ),
                            const SizedBox(height: 8),
                            TextFormField(
                              controller: _rejectionReasonController,
                              decoration: const InputDecoration(
                                labelText: 'Raison du rejet *',
                                border: OutlineInputBorder(),
                              ),
                              maxLines: 3,
                              validator: (value) =>
                                  (value == null || value.isEmpty)
                                      ? 'Raison requise'
                                      : null,
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed:
                                    isSubmitting ? null : _rejectDeclaration,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.red,
                                ),
                                child: isSubmitting
                                    ? const CircularProgressIndicator(
                                        color: Colors.white)
                                    : const Text('REJETER LA DÉCLARATION'),
                              ),
                            ),
                          ],
                        ),
                      ),

                      ], // end if (!widget.isReadOnly)
                    ],
                  ),
                ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 150,
            child: Text('$label:',
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  Widget _buildWorkforceTable() {
    final employees = declaration!['employees'] ?? [];
    final maleCount = employees.where((e) => e['gender'] == 'M').length;
    final femaleCount = employees.where((e) => e['gender'] == 'F').length;

    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total des employés',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              Text('${employees.length}',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
          const Divider(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Hommes'),
              Text('$maleCount'),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Femmes'),
              Text('$femaleCount'),
            ],
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _notesController.dispose();
    _rejectionReasonController.dispose();
    super.dispose();
  }
}
