import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'employee_list_screen.dart';

class DeclarationWizardScreen extends ConsumerStatefulWidget {
  const DeclarationWizardScreen({super.key});

  @override
  ConsumerState<DeclarationWizardScreen> createState() =>
      _DeclarationWizardScreenState();
}

class _DeclarationWizardScreenState
    extends ConsumerState<DeclarationWizardScreen> {
  int _currentStep = 0;
  final _formKey = GlobalKey<FormState>();

  // Step 1: Company Identity
  final _nameController = TextEditingController();
  final _parentCompanyController = TextEditingController();
  final _mainActivityController = TextEditingController();
  final _secondaryActivityController = TextEditingController();
  final _regionController = TextEditingController();
  final _deptController = TextEditingController();
  final _districtController = TextEditingController();
  final _addressController = TextEditingController();
  final _taxNumberController = TextEditingController();
  final _cnpsController = TextEditingController();
  final _capitalController = TextEditingController();

  // Step 2: Workforce & Movements
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

  // Step 3: Employee list (will be stored after navigation)
  Map<String, dynamic>? _companyData;

  String? _validateGenderSum(String? value) {
    final total = int.tryParse(_totalEmp.text) ?? 0;
    final men = int.tryParse(_menCount.text) ?? 0;
    final women = int.tryParse(_womenCount.text) ?? 0;
    if (total != (men + women)) return 'Total ≠ M + F';
    return null;
  }

  void _saveStep1() {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _companyData = {
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
        'district': _districtController.text,
        'address': _addressController.text,
        'taxNumber': _taxNumberController.text,
        'cnpsNumber':
            _cnpsController.text.isNotEmpty ? _cnpsController.text : null,
        'socialCapital': _capitalController.text.isNotEmpty
            ? int.parse(_capitalController.text)
            : null,
      };
      _currentStep = 1;
    });
  }

  Future<void> _saveStep2AndGoToEmployees() async {
    if (!_formKey.currentState!.validate()) return;
    final companyData = {
      ...?_companyData,
      'totalEmployees': int.parse(_totalEmp.text),
      'menCount': int.parse(_menCount.text),
      'womenCount': int.parse(_womenCount.text),
      'lastYearTotal': _lastYearTotal.text.isNotEmpty
          ? int.parse(_lastYearTotal.text)
          : null,
      'recruitments': int.parse(_movements['rec_1_3']!.text) +
          int.parse(_movements['rec_4_6']!.text) +
          int.parse(_movements['rec_7_9']!.text) +
          int.parse(_movements['rec_10_12']!.text),
      'promotions': int.parse(_movements['lic_1_3']!.text) +
          int.parse(_movements['lic_4_6']!.text) +
          int.parse(_movements['lic_7_9']!.text) +
          int.parse(_movements['lic_10_12']!.text),
      'dismissals': int.parse(_movements['ret_1_3']!.text) +
          int.parse(_movements['ret_4_6']!.text) +
          int.parse(_movements['ret_7_9']!.text) +
          int.parse(_movements['ret_10_12']!.text),
    };
    if (mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => EmployeeListScreen(
            companyData: companyData,
            year: DateTime.now().year,
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: const Text('Déclaration DSMO'), backgroundColor: Colors.teal),
      body: Form(
        key: _formKey,
        child: Stepper(
          currentStep: _currentStep,
          onStepContinue:
              _currentStep == 0 ? _saveStep1 : _saveStep2AndGoToEmployees,
          onStepCancel:
              _currentStep == 0 ? null : () => setState(() => _currentStep = 0),
          steps: [
            Step(
              title: const Text('1. Identité de l\'établissement'),
              content: _buildIdentityStep(),
              isActive: true,
              state: _currentStep > 0 ? StepState.complete : StepState.indexed,
            ),
            Step(
              title: const Text('2. Effectifs et mouvements'),
              content: _buildWorkforceStep(),
              isActive: _currentStep >= 1,
              state: _currentStep > 1 ? StepState.complete : StepState.indexed,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIdentityStep() {
    return Column(
      children: [
        _buildField(_nameController, 'Raison Sociale *', isRequired: true),
        _buildField(_taxNumberController, 'N° Contribuable (NIU) *',
            isRequired: true),
        Row(children: [
          Expanded(
              child:
                  _buildField(_regionController, 'Région *', isRequired: true)),
          const SizedBox(width: 10),
          Expanded(child: _buildField(_cnpsController, 'N° CNPS')),
        ]),
        _buildField(_parentCompanyController,
            'Raison sociale de l\'entreprise dont dépend l\'établissement'),
        _buildField(_mainActivityController, 'Activité principale *',
            isRequired: true),
        _buildField(_secondaryActivityController, 'Activité secondaire'),
        _buildField(_deptController, 'Département *', isRequired: true),
        _buildField(_districtController, 'Arrondissement *', isRequired: true),
        _buildField(_addressController, 'Adresse *', isRequired: true),
        _buildField(_capitalController, 'Capital social (XAF)', isNumber: true),
      ],
    );
  }

  Widget _buildWorkforceStep() {
    return Column(
      children: [
        const Text('Effectifs au 31 décembre',
            style: TextStyle(fontWeight: FontWeight.bold)),
        Row(children: [
          Expanded(
              child: _buildField(_totalEmp, 'Total Employés *',
                  isNumber: true, isRequired: true)),
          const SizedBox(width: 10),
          Expanded(
              child: _buildField(_menCount, 'Hommes *',
                  isNumber: true, validator: _validateGenderSum)),
          const SizedBox(width: 10),
          Expanded(
              child: _buildField(_womenCount, 'Femmes *',
                  isNumber: true, validator: _validateGenderSum)),
        ]),
        _buildField(_lastYearTotal, 'Total employés (année dernière)',
            isNumber: true),
        const SizedBox(height: 20),
        const Text('Mouvements par catégories',
            style: TextStyle(fontWeight: FontWeight.bold)),
        _buildMovementTable(),
      ],
    );
  }

  Widget _buildField(TextEditingController ctrl, String label,
      {bool isNumber = false,
      bool isRequired = false,
      String? Function(String?)? validator}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: isNumber ? TextInputType.number : TextInputType.text,
        decoration: InputDecoration(
            labelText: label, border: const OutlineInputBorder()),
        validator: validator ??
            (value) => (isRequired && (value == null || value.isEmpty))
                ? 'Champ requis'
                : null,
      ),
    );
  }

  Widget _buildMovementTable() {
    return Table(
      border: TableBorder.all(color: Colors.grey.shade300),
      columnWidths: const {0: FlexColumnWidth(2)},
      children: [
        const TableRow(children: [
          _Cell('Action', isHeader: true),
          _Cell('1-3', isHeader: true),
          _Cell('4-6', isHeader: true),
          _Cell('7-9', isHeader: true),
          _Cell('10-12', isHeader: true),
        ]),
        _buildMovementRow('Recrutement', 'rec'),
        _buildMovementRow('Licenciement', 'lic'),
        _buildMovementRow('Retraite', 'ret'),
      ],
    );
  }

  TableRow _buildMovementRow(String label, String keyPrefix) {
    return TableRow(children: [
      _Cell(label),
      _EditableCell(_movements['${keyPrefix}_1_3']!),
      _EditableCell(_movements['${keyPrefix}_4_6']!),
      _EditableCell(_movements['${keyPrefix}_7_9']!),
      _EditableCell(_movements['${keyPrefix}_10_12']!),
    ]);
  }
}

class _Cell extends StatelessWidget {
  final String text;
  final bool isHeader;
  const _Cell(this.text, {this.isHeader = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(4),
      child: Text(text,
          textAlign: TextAlign.center,
          style: TextStyle(
              fontWeight: isHeader ? FontWeight.bold : FontWeight.normal)),
    );
  }
}

class _EditableCell extends StatelessWidget {
  final TextEditingController ctrl;
  const _EditableCell(this.ctrl);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(2),
      child: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          decoration:
              const InputDecoration(isDense: true, border: InputBorder.none)),
    );
  }
}
