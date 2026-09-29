import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';
import 'package:dsmo_app/core/i18n/l10n_ext.dart';
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
      _showErrorSnackBar(context.l10n.regionsSectorsLoadError(e.toString()));
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
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(context.l10n.declApprovalApprovedSuccessMsg),
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
      _showWarningSnackBar(context.l10n.declApprovalMissingRejectReasonWarning);
      return;
    }
    setState(() => isSubmitting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/dsmo/declarations/${widget.declarationId}/reject',
          data: {'reason': _rejectionReasonController.text.trim()});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(context.l10n.declApprovalRejectedMsg),
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
      if (mounted) _showErrorSnackBar(context.l10n.declApprovalPdfLoadError(e.toString()));
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
        title: Text(isDraft ? context.l10n.declApprovalDraftTitle : context.l10n.declApprovalValidationTitle),
        backgroundColor: AppColors.deepEmerald,
        actions: [
          if (!isLoading && !isDraft)
            PopupMenuButton<int>(
              icon: const Icon(Icons.print, color: Colors.white),
              onSelected: _printPdf,
              itemBuilder: (_) => [
                PopupMenuItem(
                    value: 1, child: Text(context.l10n.pdfCopyOriginalLabel)),
                PopupMenuItem(
                    value: 2, child: Text(context.l10n.pdfCopyDuplicateLabel)),
                PopupMenuItem(
                    value: 3, child: Text(context.l10n.pdfCopyTriplicateLabel)),
              ],
            ),
        ],
      ),
      floatingActionButton: (widget.isReadOnly && !isLoading && isDraft)
          ? FloatingActionButton.extended(
              onPressed: _resumeDraft,
              backgroundColor: Colors.teal,
              icon: const Icon(Icons.edit, color: Colors.white),
              label: Text(context.l10n.declApprovalResumeEntryButton,
                  style: const TextStyle(color: Colors.white)),
            )
          : null,
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : declaration == null
              ? Center(child: Text(context.l10n.declApprovalNotFoundMsg))
              : _buildMainContent(),
    );
  }

  Widget _buildMainContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _buildHeaderCard(),
        const SizedBox(height: 16),
        _buildSectionTitle(context.l10n.declApprovalSectionEstablishmentInfo),
        _buildCompanyInfoCard(),
        const SizedBox(height: 16),
        _buildSectionTitle(context.l10n.declApprovalSectionWorkforce),
        _buildWorkforceTable(),
        const SizedBox(height: 16),
        _buildSectionTitle(context.l10n.declApprovalSectionMovements),
        _buildMovementsCard(),
        const SizedBox(height: 16),
        _buildSectionTitle(context.l10n.declApprovalSectionAdditionalInfo),
        _buildQualitativeCard(),
        const SizedBox(height: 16),
        _buildSectionTitle(context.l10n.declApprovalSectionComplianceSteps),
        _buildValidationSteps(),
        const SizedBox(height: 32),
        if (!widget.isReadOnly && !isLoading) ...[
          _buildActionPanel(
            title: context.l10n.declApprovalPanelApprovalTitle,
            color: Colors.green,
            controller: _notesController,
            label: context.l10n.declApprovalNotesLabel,
            btnLabel: context.l10n.declApprovalApproveButton,
            onPressed: _approveDeclaration,
          ),
          const SizedBox(height: 16),
          _buildActionPanel(
            title: context.l10n.declApprovalPanelRejectTitle,
            color: Colors.red,
            controller: _rejectionReasonController,
            label: context.l10n.declApprovalRejectReasonLabel,
            btnLabel: context.l10n.declApprovalRejectButton,
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
        Text(declaration!['company']?['name'] ?? context.l10n.entityTypeEnterprise,
            style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppColors.deepEmerald)),
        const Divider(),
        Text(context.l10n.declApprovalYearLine('${declaration!['year']}')),
        Text(context.l10n.declApprovalCurrentStatusLine('${declaration!['status']}')),
        if (declaration!['submittedAt'] != null)
          Text(context.l10n.declApprovalSubmissionDateLine('${declaration!['submittedAt']}')),
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
          _buildInfoRow(context.l10n.declApprovalLabelMainActivityShort, c['mainActivity'] ?? context.l10n.pdfNotApplicable),
          if ((c['secondaryActivity'] as String?)?.isNotEmpty == true)
            _buildInfoRow(context.l10n.declApprovalLabelSecondaryActivityShort, c['secondaryActivity']),
          _buildInfoRow(
              context.l10n.registerStepTitleLocation,
              [c['region'], c['department'], c['subdivision']]
                  .where((v) => v != null && v.toString().isNotEmpty)
                  .join(' / ')),
          _buildInfoRow(context.l10n.companiesAddressLabel, c['address'] ?? context.l10n.pdfNotApplicable),
          if ((c['fax'] as String?)?.isNotEmpty == true)
            _buildInfoRow(context.l10n.fieldFaxLabel, c['fax']),
          _buildInfoRow(context.l10n.declApprovalLabelTaxNumberShort, c['taxNumber'] ?? context.l10n.pdfNotApplicable),
          if ((c['cnpsNumber'] as String?)?.isNotEmpty == true)
            _buildInfoRow(context.l10n.companiesCnpsNumberLabel, c['cnpsNumber']),
          if (c['socialCapital'] != null)
            _buildInfoRow(context.l10n.declApprovalLabelSocialCapital, '${c['socialCapital']} XAF'),
          if ((c['parentCompany'] as String?)?.isNotEmpty == true)
            _buildInfoRow(context.l10n.declApprovalLabelParentCompany, c['parentCompany']),
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
              Text(context.l10n.declApprovalWorkforceCurrentYearTitle,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.teal.shade700)),
              const SizedBox(height: 6),
              _buildStatRow(
                  context.l10n.total, '${c['totalEmployees'] ?? employees.length}',
                  isBold: true),
              _buildStatRow(context.l10n.menLabel, '${c['menCount'] ?? listedMale}'),
              _buildStatRow(context.l10n.womenLabel, '${c['womenCount'] ?? listedFemale}'),
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
                Text(context.l10n.declApprovalWorkforcePreviousYearTitle,
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
          Text(context.l10n.declApprovalNominativeListLine(employees.length),
              style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ]),
      ),
    );
  }

  Widget _buildMovementsCard() {
    final movements = declaration!['movements'] as List? ?? [];
    if (movements.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(context.l10n.declApprovalNoMovementsMsg,
              style: const TextStyle(color: Colors.grey)),
        ),
      );
    }

    final typeLabels = {
      'RECRUITMENT': context.l10n.movementRecruitmentLabel,
      'PROMOTION': context.l10n.movementPromotionLabel,
      'DISMISSAL': context.l10n.movementDismissalLabel,
      'RETIREMENT': context.l10n.movementRetirementLabel,
      'DEATH': context.l10n.movementDeathLabel,
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
            columns: [
              DataColumn(label: Text(context.l10n.colMovementHeader)),
              DataColumn(label: Text(context.l10n.colCat13Header), numeric: true),
              DataColumn(label: Text(context.l10n.colCat46Header), numeric: true),
              DataColumn(label: Text(context.l10n.colCat79Header), numeric: true),
              DataColumn(label: Text(context.l10n.colCat1012Header), numeric: true),
              DataColumn(label: Text(context.l10n.colNonDeclaredShortHeader), numeric: true),
              DataColumn(label: Text(context.l10n.colTotalHeader), numeric: true),
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
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(context.l10n.declApprovalQualitativeUnavailableMsg,
              style: const TextStyle(color: Colors.grey)),
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
            v == true ? context.l10n.yesLabel : context.l10n.noLabel,
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
          _buildQRow(context.l10n.qHasTrainingCenterShort,
              yesNo(q['hasTrainingCenter'] as bool?)),
          _buildQRow(context.l10n.qRecruitmentPlansNextShort,
              yesNo(q['recruitmentPlansNext'] as bool?)),
          _buildQRow(context.l10n.qCamerounisationPlanShort,
              yesNo(q['camerounisationPlan'] as bool?)),
          _buildQRow(context.l10n.qUsesTempAgenciesShort,
              yesNo(q['usesTempAgencies'] as bool?)),
          if (q['usesTempAgencies'] == true &&
              (q['tempAgencyDetails'] as String?)?.isNotEmpty == true)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: _buildInfoRow(context.l10n.qTempAgencyDetailsLabelShort, q['tempAgencyDetails']),
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
      return Text(context.l10n.declApprovalNoValidationStepsMsg);
    }

    return Column(
      children: steps.map((step) {
        final isValid = step['isValid'] ?? false;
        return ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(isValid ? Icons.check_circle : Icons.error_outline,
              color: isValid ? Colors.green : Colors.red),
          title: Text(step['stepType'] ?? context.l10n.declApprovalDefaultStepType,
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
