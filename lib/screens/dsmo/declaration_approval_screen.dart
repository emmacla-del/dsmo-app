import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';
import '../../../data/api_client.dart';
import '../../../theme/app_colors.dart';
import 'declaration_wizard_screen.dart'; // for languageProvider
import 'employee_list_screen.dart';

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
      _showErrorSnackBar('Erreur de chargement: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> _approveDeclaration() async {
    setState(() => isSubmitting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/dsmo/declarations/${widget.declarationId}/approve',
          data: {'notes': _notesController.text});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Déclaration approuvée avec succès'),
          backgroundColor: Colors.green));
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      _showErrorSnackBar(e.toString());
    } finally {
      if (mounted) setState(() => isSubmitting = false);
    }
  }

  Future<void> _rejectDeclaration() async {
    if (_rejectionReasonController.text.trim().isEmpty) {
      _showWarningSnackBar('Veuillez entrer une raison de rejet');
      return;
    }
    setState(() => isSubmitting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/dsmo/declarations/${widget.declarationId}/reject',
          data: {'reason': _rejectionReasonController.text.trim()});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Déclaration rejetée'),
          backgroundColor: Colors.orange));
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      _showErrorSnackBar(e.toString());
    } finally {
      if (mounted) setState(() => isSubmitting = false);
    }
  }

  Future<void> _printPdf(int copyNumber) async {
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.dio.get<List<int>>(
        '/dsmo/declarations/${widget.declarationId}/pdf/$copyNumber',
        options: Options(responseType: ResponseType.bytes),
      );
      if (response.data != null) {
        final bytes = Uint8List.fromList(response.data!);
        await Printing.layoutPdf(onLayout: (_) => bytes);
      }
    } catch (e) {
      if (mounted) _showErrorSnackBar('Impossible de charger le PDF: $e');
    }
  }

  String _normalizeSalaryCategory(String? raw) {
    const valid = {'1-3', '4-6', '7-9', '10-12', 'non-declared'};
    if (raw == null || raw.isEmpty) return 'non-declared';
    if (valid.contains(raw)) return raw;

    final n = int.tryParse(raw);
    if (n != null) {
      if (n <= 3) return '1-3';
      if (n <= 6) return '4-6';
      if (n <= 9) return '7-9';
      return '10-12';
    }
    return 'non-declared';
  }

  Future<void> _resumeDraft() async {
    if (declaration == null) return;

    final company = (declaration!['company'] as Map<String, dynamic>?) ?? {};
    final rawEmployees = (declaration!['employees'] as List?) ?? [];
    final rawMovements = (declaration!['movements'] as List?) ?? [];
    final rawQualitative =
        ((declaration!['qualitativeQuestions'] as List?)?.isNotEmpty == true
            ? declaration!['qualitativeQuestions'][0] as Map<String, dynamic>
            : <String, dynamic>{});

    final companyData = {
      ...company,
      'totalEmployees': company['totalEmployees'] ?? rawEmployees.length,
    };

    // ✅ FIXED: Employee creation with ALL required fields including salary
    final employees = rawEmployees.map((e) {
      final emp = e as Map<String, dynamic>;
      return Employee(
        fullName: emp['fullName'] ?? '',
        gender: emp['gender'] ?? 'M',
        age: (emp['age'] as num?)?.toInt() ?? 0,
        nationality:
            emp['nationality'] == 'CAMEROON' ? 'Camerounais' : 'Étranger',
        otherCountry: emp['otherCountry'],
        diploma: emp['diploma'] ?? 'Aucun',
        function: emp['function'] ?? '',
        seniority: (emp['seniority'] as num?)?.toInt() ?? 0,
        salaryCategory: _normalizeSalaryCategory(emp['salaryCategory']),
        salary: (emp['salary'] as num?)?.toInt() ?? 0,
      );
    }).toList();

    ref.read(employeeListProvider.notifier).state = employees;

    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => EmployeeListScreen(
          companyData: companyData,
          year: (declaration!['year'] as num?)?.toInt() ?? DateTime.now().year,
          fillingDate: declaration!['fillingDate'],
          movements: List<Map<String, dynamic>>.from(rawMovements),
          qualitative: rawQualitative,
          totalEmployees: (companyData['totalEmployees'] as num?)?.toInt() ?? 0,
          language: ref.read(languageProvider),
        ),
      ),
    );
  }

  void _showErrorSnackBar(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.red));
  }

  void _showWarningSnackBar(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.orange));
  }

  @override
  Widget build(BuildContext context) {
    final status = declaration?['status'] ?? '';
    final isDraft = status == 'DRAFT';

    return Scaffold(
      appBar: AppBar(
        title: Text(isDraft ? 'Brouillon — DSMO' : 'Validation DSMO'),
        backgroundColor: AppColors.deepEmerald,
        actions: [
          if (!isLoading && !isDraft)
            PopupMenuButton<int>(
              icon: const Icon(Icons.print, color: Colors.white),
              onSelected: _printPdf,
              itemBuilder: (_) => [
                const PopupMenuItem(
                    value: 1, child: Text('ORIGINAL (Employeur)')),
                const PopupMenuItem(
                    value: 2, child: Text('DUPLICATA (Autorité)')),
                const PopupMenuItem(
                    value: 3, child: Text('TRIPLICATA (Archives)')),
              ],
            ),
        ],
      ),
      floatingActionButton: (widget.isReadOnly && !isLoading && isDraft)
          ? FloatingActionButton.extended(
              onPressed: _resumeDraft,
              backgroundColor: Colors.teal,
              icon: const Icon(Icons.edit, color: Colors.white),
              label: const Text('Reprendre la saisie',
                  style: TextStyle(color: Colors.white)),
            )
          : null,
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : declaration == null
              ? const Center(child: Text('Déclaration introuvable'))
              : _buildMainContent(),
    );
  }

  Widget _buildMainContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _buildHeaderCard(),
        const SizedBox(height: 16),
        _buildSectionTitle("Informations de l'établissement"),
        _buildCompanyInfoCard(),
        const SizedBox(height: 16),
        _buildSectionTitle("Effectifs Main-d'œuvre"),
        _buildWorkforceTable(),
        const SizedBox(height: 16),
        _buildSectionTitle("Mouvements du personnel"),
        _buildMovementsCard(),
        const SizedBox(height: 16),
        _buildSectionTitle("Informations supplémentaires"),
        _buildQualitativeCard(),
        const SizedBox(height: 16),
        _buildSectionTitle("Étapes de conformité"),
        _buildValidationSteps(),
        const SizedBox(height: 32),
        if (!widget.isReadOnly && !isLoading) ...[
          _buildActionPanel(
            title: 'APPROBATION',
            color: Colors.green,
            controller: _notesController,
            label: 'Notes administratives',
            btnLabel: 'APPROUVER LA DÉCLARATION',
            onPressed: _approveDeclaration,
          ),
          const SizedBox(height: 16),
          _buildActionPanel(
            title: 'REJET',
            color: Colors.red,
            controller: _rejectionReasonController,
            label: 'Motif du rejet (Obligatoire)',
            btnLabel: 'REJETER POUR CORRECTION',
            onPressed: _rejectDeclaration,
          ),
        ],
      ]),
    );
  }

  Widget _buildHeaderCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.lightEmerald.withValues(alpha: 0.1),
        border: Border.all(color: AppColors.deepEmerald),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(declaration!['company']?['name'] ?? 'Entreprise',
            style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppColors.deepEmerald)),
        const Divider(),
        Text('Exercice: ${declaration!['year']}'),
        Text('Statut Actuel: ${declaration!['status']}'),
        if (declaration!['submittedAt'] != null)
          Text('Date de soumission: ${declaration!['submittedAt']}'),
      ]),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(title,
          style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.deepEmerald)),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
            width: 120,
            child: Text('$label:',
                style: const TextStyle(
                    fontWeight: FontWeight.w600, color: Colors.grey))),
        Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w500))),
      ]),
    );
  }

  Widget _buildCompanyInfoCard() {
    final c = declaration!['company'] as Map<String, dynamic>? ?? {};
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          side: BorderSide(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          _buildInfoRow('Activité princ.', c['mainActivity'] ?? 'N/A'),
          if ((c['secondaryActivity'] as String?)?.isNotEmpty == true)
            _buildInfoRow('Activité second.', c['secondaryActivity']),
          _buildInfoRow(
              'Localisation',
              [c['region'], c['department'], c['district']]
                  .where((v) => v != null && v.toString().isNotEmpty)
                  .join(' / ')),
          _buildInfoRow('Adresse', c['address'] ?? 'N/A'),
          if ((c['fax'] as String?)?.isNotEmpty == true)
            _buildInfoRow('Fax', c['fax']),
          _buildInfoRow('N° Contribuable', c['taxNumber'] ?? 'N/A'),
          if ((c['cnpsNumber'] as String?)?.isNotEmpty == true)
            _buildInfoRow('N° CNPS', c['cnpsNumber']),
          if (c['socialCapital'] != null)
            _buildInfoRow('Capital social', '${c['socialCapital']} XAF'),
          if ((c['parentCompany'] as String?)?.isNotEmpty == true)
            _buildInfoRow('Entreprise mère', c['parentCompany']),
        ]),
      ),
    );
  }

  Widget _buildWorkforceTable() {
    final c = declaration!['company'] as Map<String, dynamic>? ?? {};
    final employees = declaration!['employees'] as List? ?? [];
    final listedMale = employees.where((e) => e['gender'] == 'M').length;
    final listedFemale = employees.where((e) => e['gender'] == 'F').length;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          side: BorderSide(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Container(
            padding: const EdgeInsets.all(8),
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              color: Colors.teal.shade50,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Column(children: [
              Text('Effectifs déclarés — Année en cours',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.teal.shade700)),
              const SizedBox(height: 6),
              _buildStatRow(
                  'Total', '${c['totalEmployees'] ?? employees.length}',
                  isBold: true),
              _buildStatRow('Hommes', '${c['menCount'] ?? listedMale}'),
              _buildStatRow('Femmes', '${c['womenCount'] ?? listedFemale}'),
            ]),
          ),
          if (c['lastYearTotal'] != null ||
              c['lastYearMenCount'] != null ||
              c['lastYearWomenCount'] != null) ...[
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Column(children: [
                Text('Effectifs — Année précédente',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey.shade700)),
                const SizedBox(height: 6),
                _buildStatRow('Total', '${c['lastYearTotal'] ?? '—'}',
                    isBold: true),
                _buildStatRow('Hommes', '${c['lastYearMenCount'] ?? '—'}'),
                _buildStatRow('Femmes', '${c['lastYearWomenCount'] ?? '—'}'),
              ]),
            ),
            const SizedBox(height: 8),
          ],
          const Divider(),
          Text('Liste nominative: ${employees.length} employé(s) saisi(s)',
              style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ]),
      ),
    );
  }

  Widget _buildMovementsCard() {
    final movements = declaration!['movements'] as List? ?? [];
    if (movements.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('Aucun mouvement enregistré.',
              style: TextStyle(color: Colors.grey)),
        ),
      );
    }

    const typeLabels = {
      'RECRUITMENT': 'Recrutement',
      'PROMOTION': 'Avancement',
      'DISMISSAL': 'Licenciement',
      'RETIREMENT': 'Retraite',
      'DEATH': 'Décès',
    };

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          side: BorderSide(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowHeight: 36,
            dataRowMinHeight: 28,
            dataRowMaxHeight: 36,
            columnSpacing: 16,
            headingTextStyle: const TextStyle(
                fontWeight: FontWeight.bold, fontSize: 11, color: Colors.teal),
            dataTextStyle: const TextStyle(fontSize: 11),
            columns: const [
              DataColumn(label: Text('Mouvement')),
              DataColumn(label: Text('Cat. 1–3'), numeric: true),
              DataColumn(label: Text('Cat. 4–6'), numeric: true),
              DataColumn(label: Text('Cat. 7–9'), numeric: true),
              DataColumn(label: Text('Cat. 10–12'), numeric: true),
              DataColumn(label: Text('Non Décl.'), numeric: true),
              DataColumn(label: Text('TOTAL'), numeric: true),
            ],
            rows: movements.map((m) {
              final mv = m as Map<String, dynamic>;
              final c1 = (mv['cat1_3'] as num?)?.toInt() ?? 0;
              final c2 = (mv['cat4_6'] as num?)?.toInt() ?? 0;
              final c3 = (mv['cat7_9'] as num?)?.toInt() ?? 0;
              final c4 = (mv['cat10_12'] as num?)?.toInt() ?? 0;
              final nd = (mv['catNonDeclared'] as num?)?.toInt() ?? 0;
              final tot = c1 + c2 + c3 + c4 + nd;
              final label =
                  typeLabels[mv['movementType']] ?? mv['movementType'];
              return DataRow(cells: [
                DataCell(Text(label,
                    style: const TextStyle(fontWeight: FontWeight.w600))),
                DataCell(Text('$c1')),
                DataCell(Text('$c2')),
                DataCell(Text('$c3')),
                DataCell(Text('$c4')),
                DataCell(Text('$nd')),
                DataCell(Text('$tot',
                    style: const TextStyle(fontWeight: FontWeight.bold))),
              ]);
            }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildQualitativeCard() {
    final questions = declaration!['qualitativeQuestions'] as List? ?? [];
    if (questions.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text('Informations qualitatives non disponibles.',
              style: TextStyle(color: Colors.grey)),
        ),
      );
    }
    final q = questions.first as Map<String, dynamic>;

    Widget yesNo(bool? v) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: v == true ? Colors.green.shade50 : Colors.red.shade50,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(
                color: v == true ? Colors.green.shade300 : Colors.red.shade300),
          ),
          child: Text(
            v == true ? 'Oui' : 'Non',
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: v == true ? Colors.green.shade700 : Colors.red.shade700),
          ),
        );

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          side: BorderSide(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          _buildQRow("Centre de formation pour le personnel ?",
              yesNo(q['hasTrainingCenter'] as bool?)),
          _buildQRow("Prévoit des recrutements l'année prochaine ?",
              yesNo(q['recruitmentPlansNext'] as bool?)),
          _buildQRow("Dispose d'un plan de camerounisation ?",
              yesNo(q['camerounisationPlan'] as bool?)),
          _buildQRow("Recours aux entreprises de travail temporaire ?",
              yesNo(q['usesTempAgencies'] as bool?)),
          if (q['usesTempAgencies'] == true &&
              (q['tempAgencyDetails'] as String?)?.isNotEmpty == true)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: _buildInfoRow('Détails ETT', q['tempAgencyDetails']),
            ),
        ]),
      ),
    );
  }

  Widget _buildQRow(String question, Widget answer) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: Text(question, style: const TextStyle(fontSize: 12))),
        const SizedBox(width: 8),
        answer,
      ]),
    );
  }

  Widget _buildStatRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label,
            style: TextStyle(
                fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
        Text(value,
            style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isBold ? AppColors.deepEmerald : Colors.black)),
      ]),
    );
  }

  Widget _buildValidationSteps() {
    final steps = declaration!['validationSteps'] as List?;
    if (steps == null || steps.isEmpty) {
      return const Text('Aucune étape de validation enregistrée.');
    }

    return Column(
      children: steps.map((step) {
        final isValid = step['isValid'] ?? false;
        return ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(isValid ? Icons.check_circle : Icons.error_outline,
              color: isValid ? Colors.green : Colors.red),
          title: Text(step['stepType'] ?? 'Contrôle automatique',
              style: const TextStyle(fontSize: 14)),
        );
      }).toList(),
    );
  }

  Widget _buildActionPanel({
    required String title,
    required Color color,
    required TextEditingController controller,
    required String label,
    required String btnLabel,
    required VoidCallback onPressed,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          border: Border.all(color: color.withValues(alpha: 0.5)),
          borderRadius: BorderRadius.circular(12),
          color: color.withValues(alpha: 0.05)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: TextStyle(fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 12),
        TextField(
          controller: controller,
          decoration: InputDecoration(
              labelText: label,
              border: const OutlineInputBorder(),
              fillColor: Colors.white,
              filled: true),
          maxLines: 2,
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          height: 45,
          child: ElevatedButton(
            onPressed: isSubmitting ? null : onPressed,
            style: ElevatedButton.styleFrom(
                backgroundColor: color, foregroundColor: Colors.white),
            child: isSubmitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : Text(btnLabel),
          ),
        ),
      ]),
    );
  }

  @override
  void dispose() {
    _notesController.dispose();
    _rejectionReasonController.dispose();
    super.dispose();
  }
}
