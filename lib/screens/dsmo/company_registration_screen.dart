import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import 'employee_list_screen.dart'; // ✅ import at top

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
  final _districtController = TextEditingController();
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

  String? _validateGenderSum(String? value) {
    final total = int.tryParse(_totalEmp.text) ?? 0;
    final men = int.tryParse(_menCount.text) ?? 0;
    final women = int.tryParse(_womenCount.text) ?? 0;
    if (total != (men + women)) return 'Total ≠ M + F';
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
        'district': _districtController.text,
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
          const SnackBar(
            content: Text('Déclaration soumise avec succès'),
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
              ),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: $e'),
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
      appBar: AppBar(
        title: const Text('DSM-O Digital'),
        backgroundColor: Colors.teal,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildSectionHeader('I. IDENTIFICATION DE L\'ETABLISSEMENT'),
            _buildField(_nameController, 'Raison Sociale *', isRequired: true),
            _buildField(_taxNumberController, 'N° Contribuable (NIU) *',
                isRequired: true),
            Row(
              children: [
                Expanded(
                    child: _buildField(_regionController, 'Région *',
                        isRequired: true)),
                const SizedBox(width: 10),
                Expanded(child: _buildField(_cnpsController, 'N° CNPS')),
              ],
            ),
            _buildField(_parentCompanyController,
                'Raison sociale de l\'entreprise dont dépend l\'établissement'),
            _buildField(_mainActivityController, 'Activité principale *',
                isRequired: true),
            _buildField(_secondaryActivityController, 'Activité secondaire'),
            _buildField(_deptController, 'Département *', isRequired: true),
            _buildField(_districtController, 'Arrondissement *',
                isRequired: true),
            _buildField(_addressController, 'Adresse *', isRequired: true),
            _buildField(_capitalController, 'Capital social (XAF)',
                isNumber: true),
            const SizedBox(height: 20),
            _buildSectionHeader('II. EFFECTIFS AU 31 DÉCEMBRE'),
            Row(
              children: [
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
              ],
            ),
            _buildField(_lastYearTotal, 'Total employés (année dernière)',
                isNumber: true),
            const SizedBox(height: 20),
            _buildSectionHeader('III. MOUVEMENTS PAR CATÉGORIES'),
            _buildMovementTable(),
            const SizedBox(height: 30),
            ElevatedButton(
              onPressed: _isLoading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.teal,
                minimumSize: const Size(double.infinity, 50),
              ),
              child: _isLoading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('SOUMETTRE LA DÉCLARATION'),
            ),
            const Text(
              '\nConformément à la loi No 91/023 du 16 déc 1991.',
              style: TextStyle(fontSize: 10, fontStyle: FontStyle.italic),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Text(
        title,
        style: const TextStyle(
            fontWeight: FontWeight.bold, color: Colors.teal, fontSize: 14),
      ),
    );
  }

  Widget _buildField(
    TextEditingController ctrl,
    String label, {
    bool isNumber = false,
    bool isRequired = false,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: isNumber ? TextInputType.number : TextInputType.text,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        validator: validator ??
            (value) {
              if (isRequired && (value == null || value.isEmpty)) {
                return 'Champ requis';
              }
              return null;
            },
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
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontWeight: isHeader ? FontWeight.bold : FontWeight.normal,
          fontSize: 12,
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
      padding: const EdgeInsets.all(2),
      child: TextField(
        controller: ctrl,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        decoration: const InputDecoration(
          isDense: true,
          border: InputBorder.none,
        ),
      ),
    );
  }
}
