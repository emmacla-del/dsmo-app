import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dsmo_app/core/i18n/l10n_ext.dart';
import '../../../data/api_client.dart';
import '../../../providers/auth_provider.dart';
import 'employee_list_screen.dart';
import 'dsmo_form_style.dart';

class CompanyRegistrationScreen extends ConsumerStatefulWidget {
  const CompanyRegistrationScreen({super.key});

  @override
  ConsumerState<CompanyRegistrationScreen> createState() =>
      _CompanyRegistrationScreenState();
}

class _CompanyRegistrationScreenState
    extends ConsumerState<CompanyRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nameController = TextEditingController();
  final _parentCompanyController = TextEditingController();
  final _mainActivityController = TextEditingController();
  final _secondaryActivityController = TextEditingController();
  final _regionController = TextEditingController();
  final _deptController = TextEditingController();
  final _subdivisionController = TextEditingController();
  final _addressController = TextEditingController();
  final _taxNumberController = TextEditingController();
  final _cnpsController = TextEditingController();
  final _capitalController = TextEditingController();

  final _totalEmp = TextEditingController();
  final _menCount = TextEditingController();
  final _womenCount = TextEditingController();
  final _lastYearTotal = TextEditingController();

  final Map<String, TextEditingController> _movements = {
    'rec_1_3': TextEditingController(text: '0'),
    'rec_4_6': TextEditingController(text: '0'),
    'rec_7_9': TextEditingController(text: '0'),
    'rec_10_12': TextEditingController(text: '0'),
    'lic_1_3': TextEditingController(text: '0'),
    'lic_4_6': TextEditingController(text: '0'),
    'lic_7_9': TextEditingController(text: '0'),
    'lic_10_12': TextEditingController(text: '0'),
    'ret_1_3': TextEditingController(text: '0'),
    'ret_4_6': TextEditingController(text: '0'),
    'ret_7_9': TextEditingController(text: '0'),
    'ret_10_12': TextEditingController(text: '0'),
  };

  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    // Pre-fill region and department from the logged-in user's account data
    final user = ref.read(authProvider).valueOrNull;
    if (user?.region != null && user!.region!.isNotEmpty) {
      _regionController.text = user.region!;
    }
    if (user?.department != null && user!.department!.isNotEmpty) {
      _deptController.text = user.department!;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _parentCompanyController.dispose();
    _mainActivityController.dispose();
    _secondaryActivityController.dispose();
    _regionController.dispose();
    _deptController.dispose();
    _subdivisionController.dispose();
    _addressController.dispose();
    _taxNumberController.dispose();
    _cnpsController.dispose();
    _capitalController.dispose();
    _totalEmp.dispose();
    _menCount.dispose();
    _womenCount.dispose();
    _lastYearTotal.dispose();
    for (final ctrl in _movements.values) {
      ctrl.dispose();
    }
    super.dispose();
  }

  String? _validateGenderSum(String? value) {
    final total = int.tryParse(_totalEmp.text) ?? 0;
    final men = int.tryParse(_menCount.text) ?? 0;
    final women = int.tryParse(_womenCount.text) ?? 0;
    if (total != (men + women)) return context.l10n.companyRegGenderSumMismatchError;
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    final api = ref.read(apiClientProvider);
    final data = {
      'company': {
        'name': _nameController.text,
        'parentCompany': _parentCompanyController.text.isNotEmpty
            ? _parentCompanyController.text
            : null,
        'mainActivity': _mainActivityController.text,
        'secondaryActivity': _secondaryActivityController.text.isNotEmpty
            ? _secondaryActivityController.text
            : null,
        'region': _regionController.text,
        'department': _deptController.text,
        'subdivision': _subdivisionController.text,
        'address': _addressController.text,
        'taxNumber': _taxNumberController.text,
        'cnpsNumber':
            _cnpsController.text.isNotEmpty ? _cnpsController.text : null,
        'socialCapital': _capitalController.text.isNotEmpty
            ? int.parse(_capitalController.text)
            : null,
      },
      'year': DateTime.now().year,
      'currentWorkforce': {
        'total': int.parse(_totalEmp.text),
        'men': int.parse(_menCount.text),
        'women': int.parse(_womenCount.text),
      },
      'lastYearTotal': _lastYearTotal.text.isNotEmpty
          ? int.parse(_lastYearTotal.text)
          : null,
      'movements': {
        for (var entry in _movements.entries)
          entry.key: int.parse(entry.value.text),
      },
    };

    try {
      final response = await api.post('/dsmo/declaration', data: data);
      if (response.statusCode == 201 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.companyRegSubmitSuccessMsg),
            backgroundColor: Colors.green,
          ),
        );
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => EmployeeListScreen(
                companyData: response.data['company'] ?? data['company'],
                year: DateTime.now().year,
                // ✅ FIX: pass totalEmployees from the form
                totalEmployees: int.tryParse(_totalEmp.text) ?? 0,
              ),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.regionsSectorsGenericErrorToast(e.toString())),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kCanvas,
      appBar: AppBar(
        title: const Text('DSM-O Digital'),
        backgroundColor: kAccent,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            DsmoSectionCard(
              title: context.l10n.companyRegSectionIdentificationTitle,
              icon: Icons.business_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildField(_nameController, context.l10n.companyRegFieldCompanyName,
                      isRequired: true),
                  _buildField(_taxNumberController, context.l10n.companyRegFieldTaxNumber,
                      isRequired: true),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                          child: _buildField(_regionController, context.l10n.pdfRegionLabel,
                              isRequired: true)),
                      const SizedBox(width: 12),
                      Expanded(
                          child:
                              _buildField(_cnpsController, context.l10n.companiesCnpsNumberLabel)),
                    ],
                  ),
                  _buildField(_parentCompanyController,
                      context.l10n.companyRegFieldParentCompanyLong),
                  _buildField(
                      _mainActivityController, context.l10n.companiesMainActivityLabel,
                      isRequired: true),
                  _buildField(
                      _secondaryActivityController, context.l10n.companyRegFieldSecondaryActivity),
                  _buildField(_deptController, context.l10n.pdfDepartmentLabel,
                      isRequired: true),
                  _buildField(_subdivisionController, context.l10n.registerArrondissementLabel,
                      isRequired: true),
                  _buildField(_addressController, context.l10n.companiesAddressLabel,
                      isRequired: true),
                  _buildField(_capitalController, context.l10n.companyRegFieldCapital,
                      isNumber: true, isLast: true),
                ],
              ),
            ),
            DsmoSectionCard(
              title: context.l10n.companyRegSectionWorkforceTitle,
              icon: Icons.groups_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                          child: _buildField(_totalEmp, context.l10n.companyRegFieldTotalEmployees,
                              isNumber: true, isRequired: true)),
                      const SizedBox(width: 12),
                      Expanded(
                          child: _buildField(_menCount, context.l10n.menLabel,
                              isNumber: true,
                              isRequired: true,
                              validator: _validateGenderSum)),
                      const SizedBox(width: 12),
                      Expanded(
                          child: _buildField(_womenCount, context.l10n.womenLabel,
                              isNumber: true,
                              isRequired: true,
                              validator: _validateGenderSum)),
                    ],
                  ),
                  _buildField(
                      _lastYearTotal, context.l10n.companyRegFieldLastYearTotal,
                      isNumber: true, isLast: true),
                ],
              ),
            ),
            DsmoSectionCard(
              title: context.l10n.companyRegSectionMovementsTitle,
              icon: Icons.swap_horiz_outlined,
              child: _buildMovementTable(),
            ),
            const SizedBox(height: 8),
            DsmoPrimaryButton(
              label: context.l10n.companyRegSubmitButton,
              onPressed: _submit,
              loading: _isLoading,
              icon: Icons.send_outlined,
            ),
            const SizedBox(height: 16),
            Text(
              context.l10n.lawComplianceNoteShort,
              style: const TextStyle(
                  fontSize: 11, fontStyle: FontStyle.italic, color: kInkFaint),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField(
    TextEditingController ctrl,
    String label, {
    bool isNumber = false,
    bool isRequired = false,
    bool isLast = false,
    String? Function(String?)? validator,
  }) {
    return DsmoField(
      label: label,
      required: isRequired,
      padding: isLast
          ? EdgeInsets.zero
          : const EdgeInsets.only(bottom: 20),
      input: TextFormField(
        controller: ctrl,
        keyboardType: isNumber ? TextInputType.number : TextInputType.text,
        decoration: dsmoInputDecoration(),
        validator: validator ??
            (value) {
              if (isRequired && (value == null || value.isEmpty)) {
                return context.l10n.companyRegRequiredFieldShort;
              }
              return null;
            },
      ),
    );
  }

  Widget _buildMovementTable() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(kRadiusSm),
      child: Table(
        border: TableBorder.all(color: kBorder),
        columnWidths: const {0: FlexColumnWidth(2)},
        children: [
          TableRow(
            decoration: const BoxDecoration(color: kFieldFill),
            children: [
              _Cell(context.l10n.actionColumnHeader, isHeader: true),
              _Cell(context.l10n.movementCategory13, isHeader: true),
              _Cell(context.l10n.movementCategory46, isHeader: true),
              _Cell(context.l10n.movementCategory79, isHeader: true),
              _Cell(context.l10n.movementCategory1012, isHeader: true),
            ],
          ),
          _buildMovementRow(context.l10n.movementRecruitmentLabel, 'rec', isEven: true),
          _buildMovementRow(context.l10n.movementDismissalLabel, 'lic', isEven: false),
          _buildMovementRow(context.l10n.movementRetirementLabel, 'ret', isEven: true),
        ],
      ),
    );
  }

  TableRow _buildMovementRow(String label, String keyPrefix,
      {required bool isEven}) {
    return TableRow(
      decoration: BoxDecoration(color: isEven ? kSurface : kCanvas),
      children: [
        _Cell(label),
        _EditableCell(_movements['${keyPrefix}_1_3']!),
        _EditableCell(_movements['${keyPrefix}_4_6']!),
        _EditableCell(_movements['${keyPrefix}_7_9']!),
        _EditableCell(_movements['${keyPrefix}_10_12']!),
      ],
    );
  }
}

class _Cell extends StatelessWidget {
  final String text;
  final bool isHeader;
  const _Cell(this.text, {this.isHeader = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontWeight: isHeader ? FontWeight.w600 : FontWeight.w500,
          fontSize: 13,
          color: isHeader ? kInk : kInkSoft,
        ),
      ),
    );
  }
}

class _EditableCell extends StatelessWidget {
  final TextEditingController ctrl;
  const _EditableCell(this.ctrl);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 4),
      child: TextField(
        controller: ctrl,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        cursorColor: kAccent,
        style: const TextStyle(fontSize: 13, color: kInk),
        decoration: const InputDecoration(
          isDense: true,
          border: InputBorder.none,
        ),
      ),
    );
  }
}
