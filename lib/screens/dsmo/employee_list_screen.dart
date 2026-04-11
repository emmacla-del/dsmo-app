import 'dart:io';
import 'package:dio/dio.dart';
import 'package:excel/excel.dart' hide Border;
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:printing/printing.dart';
import '../../../data/api_client.dart';
import '../../../models/employee_adapter.dart';

final employeeListProvider = StateProvider<List<Employee>>((ref) => []);

class Employee {
  String fullName;
  String gender;
  int age;
  String nationality;
  String? otherCountry;
  String diploma;
  String function;
  int seniority;
  String salaryCategory;
  int salary;

  Employee({
    required this.fullName,
    required this.gender,
    required this.age,
    required this.nationality,
    this.otherCountry,
    required this.diploma,
    required this.function,
    required this.seniority,
    required this.salaryCategory,
    required this.salary,
  });

  Map<String, dynamic> toJson() => {
        'fullName': fullName,
        'gender': gender,
        'age': age,
        'nationality': nationality == 'Cameroonian'
            ? 'CAMEROON'
            : (otherCountry ?? 'OTHER'),
        if (otherCountry != null) 'otherCountry': otherCountry,
        'diploma': diploma,
        'function': function,
        'seniority': seniority,
        'salaryCategory': salaryCategory,
        'salary': salary,
      };
}

class EmployeeListScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> companyData;
  final int year;
  final String? fillingDate;
  final List<Map<String, dynamic>>? movements;
  final Map<String, dynamic>? qualitative;
  final int totalEmployees;
  final String language;

  const EmployeeListScreen({
    super.key,
    required this.companyData,
    required this.year,
    this.fillingDate,
    this.movements,
    this.qualitative,
    required this.totalEmployees,
    this.language = 'fr',
  });

  @override
  ConsumerState<EmployeeListScreen> createState() => _EmployeeListScreenState();
}

class _EmployeeListScreenState extends ConsumerState<EmployeeListScreen> {
  List<Employee> _employees = [];
  bool _isLoading = false;
  late Box<Employee> _employeeBox;
  String? _boxName;

  // Wizard controllers
  final _fullNameController = TextEditingController();
  final _functionController = TextEditingController();
  final _seniorityController = TextEditingController();
  final _ageController = TextEditingController();
  final _otherCountryController = TextEditingController();

  String? _gender;
  int? _age;
  String? _nationality;
  String? _diploma;
  int? _seniority;
  String? _salaryCategory;
  int? _salary;

  final List<String> _diplomaOptions = const [
    'Aucun',
    'CEPE',
    'BEPC',
    'CAP',
    'BAC',
    'BTS',
    'Licence',
    'Master',
    'Doctorat',
  ];

  final List<String> _salaryCategories = const [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    'non-declared',
  ];

  @override
  void initState() {
    super.initState();
    _initHive();
  }

  Future<void> _initHive() async {
    final companyId =
        widget.companyData['id'] ?? widget.companyData['name'] ?? 'unknown';
    _boxName = 'employees_${companyId}_${widget.year}';

    // ✅ Open box with Employee type directly
    _employeeBox = await Hive.openBox<Employee>(_boxName!);
    await _loadEmployeesLocally();

    final saved = ref.read(employeeListProvider);
    if (saved.isNotEmpty && _employees.isEmpty) {
      setState(() => _employees.addAll(saved));
      await _saveEmployeesLocally();
      _showSuccess('Brouillon chargé depuis la session');
    }
  }

  Future<void> _saveEmployeesLocally() async {
    await _employeeBox.clear();
    for (var emp in _employees) {
      await _employeeBox.add(emp);
    }
    ref.read(employeeListProvider.notifier).state = List.from(_employees);
    _showSuccess('Brouillon sauvegardé (${_employees.length} employé(s))');
  }

  Future<void> _loadEmployeesLocally() async {
    setState(() {
      _employees = _employeeBox.values.toList();
    });
    ref.read(employeeListProvider.notifier).state = List.from(_employees);
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _functionController.dispose();
    _seniorityController.dispose();
    _ageController.dispose();
    _otherCountryController.dispose();
    super.dispose();
  }

  String _formatSalary(int amount) {
    final s = amount.toString();
    final buffer = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buffer.write(' ');
      buffer.write(s[i]);
    }
    return buffer.toString();
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
    );
  }

  String _getCurrentDate() {
    final now = DateTime.now();
    return '${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year}';
  }

  void _clearWizardForm() {
    _fullNameController.clear();
    _functionController.clear();
    _seniorityController.clear();
    _ageController.clear();
    _otherCountryController.clear();
    _gender = null;
    _age = null;
    _nationality = null;
    _diploma = null;
    _seniority = null;
    _salaryCategory = null;
    _salary = null;
  }

  bool _validateStep(int step) {
    switch (step) {
      case 0:
        if (_fullNameController.text.trim().isEmpty) {
          _showError('Veuillez entrer le nom complet');
          return false;
        }
        return true;
      case 1:
        if (_gender == null) {
          _showError('Veuillez sélectionner le sexe');
          return false;
        }
        return true;
      case 2:
        if (_age == null || _age! < 16 || _age! > 120) {
          _showError('Âge invalide (16-120 ans)');
          return false;
        }
        return true;
      case 3:
        if (_nationality == null) {
          _showError('Veuillez sélectionner la nationalité');
          return false;
        }
        if (_nationality == 'Étranger' &&
            _otherCountryController.text.trim().isEmpty) {
          _showError('Veuillez entrer le pays');
          return false;
        }
        return true;
      case 4:
        if (_diploma == null) {
          _showError('Veuillez sélectionner le diplôme');
          return false;
        }
        return true;
      case 5:
        if (_functionController.text.trim().isEmpty) {
          _showError('Veuillez entrer la fonction');
          return false;
        }
        return true;
      case 6:
        if (_seniority == null || _seniority! < 0 || _seniority! > 60) {
          _showError('Ancienneté invalide (0-60 ans)');
          return false;
        }
        return true;
      case 7:
        if (_salaryCategory == null) {
          _showError('Veuillez sélectionner la catégorie');
          return false;
        }
        return true;
      case 8:
        if (_salary == null || _salary! <= 0) {
          _showError('Veuillez entrer un salaire valide (> 0 FCFA)');
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  void _confirmAdd(int? editIndex) {
    final emp = Employee(
      fullName: _fullNameController.text.trim(),
      gender: _gender!,
      age: _age!,
      nationality: _nationality == 'Camerounais' ? 'Cameroonian' : 'Other',
      otherCountry: _nationality == 'Étranger'
          ? _otherCountryController.text.trim()
          : null,
      diploma: _diploma!,
      function: _functionController.text.trim(),
      seniority: _seniority ?? 0,
      salaryCategory: _salaryCategory!,
      salary: _salary ?? 0,
    );

    Navigator.pop(context);
    setState(() {
      if (editIndex != null) {
        _employees[editIndex] = emp;
      } else {
        _employees.add(emp);
      }
    });
    _saveEmployeesLocally();
  }

  Future<void> _deleteEmployee(int index) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Supprimer l'employé ?"),
        content: Text(
            "Voulez-vous retirer ${_employees[index].fullName} de la liste ?"),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child:
                const Text('Supprimer', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _employees.removeAt(index));
    _saveEmployeesLocally();
  }

  Future<void> _showAddEmployeeWizard({int? editIndex}) async {
    _clearWizardForm();

    if (editIndex != null) {
      final emp = _employees[editIndex];
      _fullNameController.text = emp.fullName;
      _gender = emp.gender;
      _age = emp.age;
      _ageController.text = emp.age.toString();
      _nationality =
          emp.nationality == 'Cameroonian' ? 'Camerounais' : 'Étranger';
      if (_nationality == 'Étranger') {
        _otherCountryController.text = emp.otherCountry ?? '';
      }
      _diploma = emp.diploma;
      _functionController.text = emp.function;
      _seniority = emp.seniority;
      _seniorityController.text = emp.seniority.toString();
      _salaryCategory = emp.salaryCategory;
      _salary = emp.salary;
    }

    int currentStep = 0;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => DraggableScrollableSheet(
          initialChildSize: 0.9,
          maxChildSize: 0.95,
          minChildSize: 0.5,
          builder: (context, scrollController) => Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 8),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Text(
                    editIndex != null
                        ? 'MODIFIER L\'EMPLOYÉ'
                        : 'AJOUTER UN EMPLOYÉ',
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.teal),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                  child: Column(children: [
                    Text('Étape ${currentStep + 1} sur 9',
                        style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Colors.teal)),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: (currentStep + 1) / 9,
                      backgroundColor: Colors.grey.shade200,
                      color: Colors.teal,
                      minHeight: 6,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ]),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    controller: scrollController,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (currentStep == 0) _buildStep1FullName(),
                          if (currentStep == 1)
                            _buildStep2Gender(setSheetState),
                          if (currentStep == 2) _buildStep3Age(),
                          if (currentStep == 3)
                            _buildStep4Nationality(setSheetState),
                          if (currentStep == 4)
                            _buildStep5Diploma(setSheetState),
                          if (currentStep == 5) _buildStep6Function(),
                          if (currentStep == 6) _buildStep7Seniority(),
                          if (currentStep == 7)
                            _buildStep8SalaryCategory(setSheetState),
                          if (currentStep == 8) _buildStep9Salary(),
                        ]),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(
                      16, 8, 16, MediaQuery.of(context).viewInsets.bottom + 16),
                  child: Row(children: [
                    if (currentStep > 0) ...[
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setSheetState(() => currentStep--),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            side: const BorderSide(color: Colors.teal),
                          ),
                          child: const Text('Retour',
                              style: TextStyle(color: Colors.teal)),
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () {
                          if (_validateStep(currentStep)) {
                            if (currentStep < 8) {
                              setSheetState(() => currentStep++);
                            } else {
                              _confirmAdd(editIndex);
                            }
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.teal,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: Text(currentStep < 8 ? 'Suivant' : 'Confirmer',
                            style: const TextStyle(color: Colors.white)),
                      ),
                    ),
                  ]),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStep1FullName() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Noms et Prénoms',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      TextFormField(
        controller: _fullNameController,
        autofocus: true,
        decoration: const InputDecoration(
          hintText: 'Ex: TCHINDA Marc Arnold',
          border: OutlineInputBorder(),
          prefixIcon: Icon(Icons.person),
        ),
      ),
    ]);
  }

  Widget _buildStep2Gender(StateSetter setState) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Sexe',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(
            child: _buildGenderButton('Masculin (M)', _gender == 'M',
                () => setState(() => _gender = 'M'))),
        const SizedBox(width: 16),
        Expanded(
            child: _buildGenderButton('Féminin (F)', _gender == 'F',
                () => setState(() => _gender = 'F'))),
      ]),
    ]);
  }

  Widget _buildGenderButton(String label, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          color: isSelected ? Colors.teal : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isSelected ? Colors.teal : Colors.grey.shade300,
              width: isSelected ? 2 : 1),
        ),
        child: Center(
            child: Text(label,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? Colors.white : Colors.black87,
                ))),
      ),
    );
  }

  Widget _buildStep3Age() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Âge',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      TextFormField(
        controller: _ageController,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        autofocus: true,
        decoration: const InputDecoration(
          hintText: 'Ex: 32',
          border: OutlineInputBorder(),
          prefixIcon: Icon(Icons.cake),
          suffixText: 'ans',
        ),
        onChanged: (value) => _age = int.tryParse(value),
      ),
    ]);
  }

  Widget _buildStep4Nationality(StateSetter setState) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Nationalité',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(
            child: _buildNationalityButton(
                'Camerounais',
                _nationality == 'Camerounais',
                () => setState(() {
                      _nationality = 'Camerounais';
                      _otherCountryController.clear();
                    }))),
        const SizedBox(width: 16),
        Expanded(
            child: _buildNationalityButton(
                'Étranger',
                _nationality == 'Étranger',
                () => setState(() => _nationality = 'Étranger'))),
      ]),
      if (_nationality == 'Étranger') ...[
        const SizedBox(height: 16),
        TextFormField(
          controller: _otherCountryController,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Préciser le pays',
            hintText: 'Ex: France, Nigeria, Chine...',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.flag),
          ),
        ),
      ],
    ]);
  }

  Widget _buildNationalityButton(
      String label, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          color: isSelected ? Colors.teal : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isSelected ? Colors.teal : Colors.grey.shade300,
              width: isSelected ? 2 : 1),
        ),
        child: Center(
            child: Text(label,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? Colors.white : Colors.black87,
                ))),
      ),
    );
  }

  Widget _buildStep5Diploma(StateSetter setState) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Diplôme le plus élevé',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      DropdownButtonFormField<String>(
        initialValue: _diploma,
        hint: const Text('Sélectionnez un diplôme'),
        decoration: const InputDecoration(
            border: OutlineInputBorder(), prefixIcon: Icon(Icons.school)),
        items: _diplomaOptions
            .map((d) => DropdownMenuItem(value: d, child: Text(d)))
            .toList(),
        onChanged: (value) => setState(() => _diploma = value),
      ),
    ]);
  }

  Widget _buildStep6Function() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Fonction / Poste occupé',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      TextFormField(
        controller: _functionController,
        autofocus: true,
        decoration: const InputDecoration(
          hintText: 'Ex: Comptable, Ingénieur, Assistant...',
          border: OutlineInputBorder(),
          prefixIcon: Icon(Icons.work),
        ),
      ),
    ]);
  }

  Widget _buildStep7Seniority() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text("Ancienneté dans l'entreprise",
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      TextFormField(
        controller: _seniorityController,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        autofocus: true,
        decoration: const InputDecoration(
          hintText: 'Ex: 5',
          border: OutlineInputBorder(),
          prefixIcon: Icon(Icons.timeline),
          suffixText: 'ans',
        ),
        onChanged: (value) => _seniority = int.tryParse(value),
      ),
    ]);
  }

  Widget _buildStep8SalaryCategory(StateSetter setState) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Catégorie socioprofessionnelle',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      DropdownButtonFormField<String>(
        initialValue: _salaryCategory,
        hint: const Text('Sélectionnez la catégorie (1-12)'),
        decoration: const InputDecoration(
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.business_center)),
        items: _salaryCategories.map((c) {
          final display = c == 'non-declared' ? 'Non déclaré' : 'Catégorie $c';
          return DropdownMenuItem(value: c, child: Text(display));
        }).toList(),
        onChanged: (value) => setState(() => _salaryCategory = value),
      ),
      const SizedBox(height: 8),
      const Text(
        'Selon la grille officielle DSMO (1 = agent d\'exécution, 12 = cadre supérieur)',
        style: TextStyle(fontSize: 12, color: Colors.grey),
      ),
    ]);
  }

  Widget _buildStep9Salary() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Salaire mensuel (FCFA) *',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      TextFormField(
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        autofocus: true,
        decoration: const InputDecoration(
          hintText: 'Ex: 250000',
          border: OutlineInputBorder(),
          prefixIcon: Icon(Icons.attach_money),
          suffixText: 'FCFA',
          helperText: 'Obligatoire',
          helperStyle: TextStyle(color: Colors.red),
        ),
        onChanged: (value) => _salary = int.tryParse(value),
      ),
    ]);
  }

  Future<void> _importEmployees() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'xls'],
    );
    if (result == null) return;

    final file = File(result.files.single.path!);
    final bytes = await file.readAsBytes();
    final excel = Excel.decodeBytes(bytes);
    final sheet = excel.tables[excel.tables.keys.first];
    if (sheet == null) return;

    final newEmployees = <Employee>[];
    int errorCount = 0;

    for (int i = 1; i < sheet.rows.length; i++) {
      final row = sheet.rows[i];
      if (row[0]?.value == null) continue;
      try {
        final fullName = row[0]?.value.toString() ?? '';
        final salaryValue = int.tryParse(row[9]?.value.toString() ?? '0') ?? 0;

        if (fullName.trim().isEmpty || salaryValue <= 0) {
          errorCount++;
          continue;
        }

        newEmployees.add(Employee(
          fullName: fullName,
          gender: row[1]?.value.toString() == 'F' ? 'F' : 'M',
          age: int.tryParse(row[2]?.value.toString() ?? '0') ?? 0,
          nationality: row[3]?.value.toString() == 'Cameroonian'
              ? 'Cameroonian'
              : 'Other',
          otherCountry: row[4]?.value.toString(),
          diploma: row[5]?.value.toString() ?? '',
          function: row[6]?.value.toString() ?? '',
          seniority: int.tryParse(row[7]?.value.toString() ?? '0') ?? 0,
          salaryCategory: row[8]?.value.toString() ?? 'non-declared',
          salary: salaryValue,
        ));
      } catch (e) {
        errorCount++;
        debugPrint('Import row error: $e');
      }
    }

    setState(() => _employees.addAll(newEmployees));
    await _saveEmployeesLocally();

    if (mounted) {
      final msg = errorCount == 0
          ? '${newEmployees.length} employé(s) importé(s) avec succès'
          : '${newEmployees.length} importé(s), $errorCount ligne(s) ignorée(s)';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(msg),
            backgroundColor: errorCount == 0 ? Colors.green : Colors.orange),
      );
    }
  }

  Future<void> _exportToExcel() async {
    final excel = Excel.createExcel();
    final sheet = excel['Employés'];

    sheet.appendRow([
      TextCellValue('Noms et Prénoms'),
      TextCellValue('Sexe'),
      TextCellValue('Âge'),
      TextCellValue('Nationalité'),
      TextCellValue('Pays'),
      TextCellValue('Diplôme'),
      TextCellValue('Fonction'),
      TextCellValue('Ancienneté (ans)'),
      TextCellValue('Catégorie'),
      TextCellValue('Salaire (FCFA)')
    ]);

    for (var emp in _employees) {
      sheet.appendRow([
        TextCellValue(emp.fullName),
        TextCellValue(emp.gender),
        IntCellValue(emp.age),
        TextCellValue(
            emp.nationality == 'Cameroonian' ? 'Camerounais' : 'Étranger'),
        TextCellValue(emp.otherCountry ?? 'N/A'),
        TextCellValue(emp.diploma),
        TextCellValue(emp.function),
        IntCellValue(emp.seniority),
        TextCellValue(emp.salaryCategory),
        IntCellValue(emp.salary),
      ]);
    }

    final fileBytes = excel.encode();
    if (fileBytes != null) {
      final String? savePath = await FilePicker.platform.saveFile(
        dialogTitle: 'Enregistrer la liste des employés',
        fileName: 'employes_${widget.year}.xlsx',
      );
      if (savePath != null) {
        await File(savePath).writeAsBytes(fileBytes);
        if (mounted) _showSuccess('Export réussi !');
      }
    }
  }

  Future<void> _previewPdf() async {
    await _showPartAPreview();
  }

  Future<bool> _showPartAPreview() async {
    final company = widget.companyData;
    final movements = widget.movements ?? [];
    final qualitative = widget.qualitative ?? {};

    String yesNo(dynamic v) => v == true ? 'Oui' : (v == false ? 'Non' : 'N/A');

    Widget infoRow(String label, dynamic value) => Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(
                width: 160,
                child: Text('$label :',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13))),
            Expanded(
                child: Text('${value ?? 'N/A'}',
                    style: const TextStyle(fontSize: 13))),
          ]),
        );

    Widget sectionTitle(String title) => Padding(
          padding: const EdgeInsets.only(top: 16, bottom: 8),
          child: Text(title,
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Colors.teal)),
        );

    String movLabel(String type) {
      switch (type) {
        case 'RECRUITMENT':
          return 'Recrutements';
        case 'PROMOTION':
          return 'Promotions';
        case 'DISMISSAL':
          return 'Licenciements';
        case 'RETIREMENT':
          return 'Retraites';
        case 'DEATH':
          return 'Décès';
        default:
          return type;
      }
    }

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        final pageController = PageController();
        int currentPage = 0;
        const totalPages = 2;

        return StatefulBuilder(
          builder: (ctx, setS) => Dialog(
            insetPadding: const EdgeInsets.all(16),
            child: SizedBox(
              height: MediaQuery.of(ctx).size.height * 0.82,
              child: Column(children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  color: Colors.teal,
                  child: Row(children: [
                    const Icon(Icons.preview, color: Colors.white),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(
                            'Aperçu PARTIE A — Page ${currentPage + 1}/$totalPages',
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 15))),
                    IconButton(
                        icon: const Icon(Icons.close, color: Colors.white),
                        onPressed: () => Navigator.pop(ctx, false)),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                        totalPages,
                        (i) => Container(
                              width: i == currentPage ? 16 : 8,
                              height: 8,
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              decoration: BoxDecoration(
                                color: i == currentPage
                                    ? Colors.teal
                                    : Colors.grey,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            )),
                  ),
                ),
                Expanded(
                  child: PageView(
                    controller: pageController,
                    onPageChanged: (i) => setS(() => currentPage = i),
                    children: [
                      SingleChildScrollView(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              sectionTitle("Identité de l'établissement"),
                              infoRow('Nom / Raison sociale', company['name']),
                              infoRow('Activité principale',
                                  company['mainActivity']),
                              infoRow('Région', company['region']),
                              infoRow('Département', company['department']),
                              infoRow('Arrondissement', company['district']),
                              infoRow('Adresse', company['address']),
                              infoRow('Fax', company['fax']),
                              infoRow('N° contribuable (NIU)',
                                  company['taxNumber']),
                              infoRow('N° CNPS', company['cnpsNumber']),
                              infoRow(
                                  'Capital social', company['socialCapital']),
                              const Divider(height: 24),
                              sectionTitle('Effectifs — Année en cours'),
                              infoRow(
                                  'Total déclaré', company['totalEmployees']),
                              infoRow('Hommes', company['menCount']),
                              infoRow('Femmes', company['womenCount']),
                              sectionTitle('Effectifs — Année précédente'),
                              infoRow('Total', company['lastYearTotal']),
                              infoRow('Hommes', company['lastYearMenCount']),
                              infoRow('Femmes', company['lastYearWomenCount']),
                            ]),
                      ),
                      SingleChildScrollView(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              sectionTitle(
                                  'Détail des mouvements par catégorie'),
                              ...movements.map((m) {
                                final type = m['movementType'] as String? ?? '';
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(movLabel(type),
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                                color: Colors.teal)),
                                        const SizedBox(height: 4),
                                        Row(children: [
                                          Expanded(
                                              child: infoRow(
                                                  'Cat. 1-3', m['cat1_3'])),
                                          Expanded(
                                              child: infoRow(
                                                  'Cat. 4-6', m['cat4_6'])),
                                        ]),
                                        Row(children: [
                                          Expanded(
                                              child: infoRow(
                                                  'Cat. 7-9', m['cat7_9'])),
                                          Expanded(
                                              child: infoRow(
                                                  'Cat. 10-12', m['cat10_12'])),
                                        ]),
                                        infoRow(
                                            'Non Déclaré', m['catNonDeclared']),
                                      ]),
                                );
                              }),
                              const Divider(height: 24),
                              sectionTitle('Informations qualitatives'),
                              infoRow('Centre de formation',
                                  yesNo(qualitative['hasTrainingCenter'])),
                              infoRow('Plans de recrutement (année suivante)',
                                  yesNo(qualitative['recruitmentPlansNext'])),
                              infoRow('Plan de camerounisation',
                                  yesNo(qualitative['camerounisationPlan'])),
                              infoRow('Recours aux agences intérimaires',
                                  yesNo(qualitative['usesTempAgencies'])),
                              if (qualitative['tempAgencyDetails'] != null)
                                infoRow('Détails agence intérimaire',
                                    qualitative['tempAgencyDetails']),
                            ]),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(children: [
                    if (currentPage > 0)
                      OutlinedButton.icon(
                        onPressed: () => pageController.previousPage(
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut),
                        icon: const Icon(Icons.arrow_back),
                        label: const Text('Précédent'),
                      ),
                    const Spacer(),
                    if (currentPage < totalPages - 1)
                      ElevatedButton.icon(
                        onPressed: () => pageController.nextPage(
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut),
                        style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.teal),
                        icon: const Icon(Icons.arrow_forward,
                            color: Colors.white),
                        label: const Text('Suivant',
                            style: TextStyle(color: Colors.white)),
                      )
                    else
                      ElevatedButton.icon(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.teal),
                        icon: const Icon(Icons.check, color: Colors.white),
                        label: const Text('Confirmer et soumettre',
                            style: TextStyle(color: Colors.white)),
                      ),
                  ]),
                ),
              ]),
            ),
          ),
        );
      },
    );
    return result == true;
  }

  Future<bool> _validateAgainstPartA() async {
    final totalFromPartA = widget.companyData['totalEmployees'] as int? ?? 0;
    final menFromPartA = widget.companyData['menCount'] as int? ?? 0;
    final womenFromPartA = widget.companyData['womenCount'] as int? ?? 0;
    final actualMen = _employees.where((e) => e.gender == 'M').length;
    final actualWomen = _employees.where((e) => e.gender == 'F').length;
    final actualTotal = _employees.length;
    final mismatches = <String>[];

    if (actualTotal != totalFromPartA) {
      mismatches.add(
          '• Total employés: $actualTotal saisi(s) vs $totalFromPartA déclaré(s)');
    }
    if (actualMen != menFromPartA) {
      mismatches
          .add('• Hommes: $actualMen saisi(s) vs $menFromPartA déclaré(s)');
    }
    if (actualWomen != womenFromPartA) {
      mismatches.add(
          '• Femmes: $actualWomen saisie(s) vs $womenFromPartA déclarée(s)');
    }

    if (mismatches.isNotEmpty) {
      final shouldContinue = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('⚠️ Incohérence des effectifs',
              style: TextStyle(color: Colors.orange)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Le nombre d\'employés saisi ne correspond pas aux effectifs déclarés dans la PARTIE A :\n',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              ...mismatches.map((m) => Padding(
                    padding: const EdgeInsets.only(left: 8, bottom: 4),
                    child: Text(m, style: const TextStyle(fontSize: 14)),
                  )),
              const SizedBox(height: 16),
              const Divider(),
              const Text('Voulez-vous continuer la soumission quand même ?',
                  style: TextStyle(fontWeight: FontWeight.w500)),
              const SizedBox(height: 8),
              const Text(
                'Note: Le formulaire officiel exige une correspondance parfaite.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Retour', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
              child: const Text("Continuer malgré l'erreur",
                  style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
      return shouldContinue == true;
    }
    return true;
  }

  Future<void> _submitDeclaration() async {
    if (_employees.isEmpty) {
      _showError('Ajoutez au moins un employé avant de soumettre');
      return;
    }

    final invalidEmployees = _employees
        .where((e) => e.fullName.trim().isEmpty || e.salary <= 0)
        .toList();

    if (invalidEmployees.isNotEmpty) {
      _showError(
          'Certains employés ont des données invalides (nom vide ou salaire ≤ 0)');
      return;
    }

    final isValid = await _validateAgainstPartA();
    if (!isValid) return;
    if (!mounted) return;

    final previewConfirmed = await _showPartAPreview();
    if (!previewConfirmed || !mounted) return;

    setState(() => _isLoading = true);

    try {
      final api = ref.read(apiClientProvider);
      final payload = {
        'company': widget.companyData,
        'year': widget.year,
        'fillingDate': widget.fillingDate ?? _getCurrentDate(),
        'movements': widget.movements,
        'qualitative': widget.qualitative,
        'employees': _employees.map((e) => e.toJson()).toList(),
        'employeeCount': _employees.length,
        'language': widget.language,
      };

      final response = await api.post('/dsmo/declaration', data: payload);

      if (response.statusCode == 201 && mounted) {
        final responseData = response.data;
        await _employeeBox.clear();
        ref.read(employeeListProvider.notifier).state = [];

        final declarationId =
            responseData['declaration']?['id'] as String? ?? '';
        final hasPdfs = declarationId.isNotEmpty &&
            (responseData['pdfUrls'] as List?)?.isNotEmpty == true;

        if (hasPdfs) {
          await _showPdfSuccessDialog(
            declarationId: declarationId,
            trackingNumber: responseData['trackingNumber'] ?? 'N/A',
            deadline: responseData['submissionDeadline'] ??
                '31 Janvier ${widget.year + 1}',
          );
        } else {
          await _showSimpleSuccessDialog();
        }
        if (mounted) Navigator.popUntil(context, (route) => route.isFirst);
      } else if (response.statusCode != 201 && mounted) {
        await _showSubmissionError(
            'Erreur lors de la soumission. Code HTTP: ${response.statusCode}\n\n${response.data ?? ''}');
      }
    } catch (e) {
      if (mounted) await _showSubmissionError(e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _showPdfSuccessDialog({
    required String declarationId,
    required String trackingNumber,
    required String deadline,
  }) async {
    final copyNames = [
      'ORIGINAL (Employeur)',
      'DUPLICATA (Autorité)',
      'TRIPLICATA (Archives)'
    ];

    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(children: [
          Icon(Icons.check_circle, color: Colors.green),
          SizedBox(width: 8),
          Text('Déclaration enregistrée !',
              style: TextStyle(color: Colors.green)),
        ]),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.teal.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(children: [
                  const Icon(Icons.numbers, size: 16, color: Colors.teal),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('N° Suivi: $trackingNumber',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ]),
              ),
              const SizedBox(height: 16),
              const Text('3 exemplaires PDF disponibles :'),
              const SizedBox(height: 12),
              ...List.generate(
                3,
                (i) => Card(
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  child: ListTile(
                    leading:
                        const Icon(Icons.picture_as_pdf, color: Colors.red),
                    title: Text(copyNames[i]),
                    trailing: IconButton(
                      icon: const Icon(Icons.print, size: 20),
                      tooltip: 'Imprimer / Télécharger',
                      onPressed: () =>
                          _downloadAndPrintPdf(declarationId, i + 1),
                    ),
                    onTap: () => _downloadAndPrintPdf(declarationId, i + 1),
                  ),
                ),
              ),
              const Divider(height: 24),
              const Text('PROCÉDURE OBLIGATOIRE :',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text('• Imprimez les 3 exemplaires'),
              const Text('• Signez chaque exemplaire'),
              const Text("• Ajoutez le cachet de l'entreprise"),
              Text('• Envoyez par PLI RECOMMANDÉ avant le $deadline'),
              const Text("• À la circonscription de l'emploi"),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Row(children: [
                  Icon(Icons.info, size: 16, color: Colors.amber.shade700),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Conformément à la loi No 91/023 du 16 décembre 1991',
                      style: TextStyle(fontSize: 11),
                    ),
                  ),
                ]),
              ),
            ],
          ),
        ),
        actions: [
          TextButton.icon(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.check),
            label: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<void> _downloadAndPrintPdf(
      String declarationId, int copyNumber) async {
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.dio.get<List<int>>(
        '/dsmo/declarations/$declarationId/pdf/$copyNumber',
        options: Options(responseType: ResponseType.bytes),
      );
      final bytes = Uint8List.fromList(response.data!);
      await Printing.layoutPdf(onLayout: (_) => bytes);
    } catch (e) {
      if (mounted) _showError('Impossible de charger le PDF: $e');
    }
  }

  Future<void> _showSimpleSuccessDialog() async {
    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Succès', style: TextStyle(color: Colors.green)),
        content: const Text(
          'Déclaration soumise avec succès !\n\nLes PDF seront disponibles dans votre espace employeur.',
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.teal),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<void> _showSubmissionError(String message) async {
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(children: [
          Icon(Icons.error_outline, color: Colors.red),
          SizedBox(width: 8),
          Text('Échec de la soumission', style: TextStyle(color: Colors.red)),
        ]),
        content: SingleChildScrollView(child: Text(message)),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('OK', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalFromPartA = widget.companyData['totalEmployees'] as int? ?? 0;
    final actualTotal = _employees.length;
    final isMatching = actualTotal == totalFromPartA;

    return Scaffold(
      appBar: AppBar(
        title: const Text("DÉCLARATION SUR LA SITUATION DE LA MAIN D'ŒUVRE"),
        backgroundColor: Colors.teal,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.download),
            onPressed: _employees.isEmpty ? null : _exportToExcel,
            tooltip: 'Exporter Excel',
          ),
          IconButton(
            icon: const Icon(Icons.upload_file),
            onPressed: _importEmployees,
            tooltip: 'Importer Excel',
          ),
          IconButton(
            icon: const Icon(Icons.picture_as_pdf),
            onPressed: _previewPdf,
            tooltip: 'Aperçu PARTIE A',
          ),
        ],
      ),
      body: Column(children: [
        Container(
          margin: const EdgeInsets.all(12),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: isMatching ? Colors.teal.shade50 : Colors.orange.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color:
                    isMatching ? Colors.teal.shade200 : Colors.orange.shade200),
          ),
          child: Row(children: [
            Icon(isMatching ? Icons.check_circle : Icons.warning_amber_rounded,
                color: isMatching ? Colors.teal : Colors.orange, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Employés enregistrés',
                        style: TextStyle(
                            fontSize: 12,
                            color: isMatching
                                ? Colors.teal.shade700
                                : Colors.orange.shade700)),
                    Text('${_employees.length} / $totalFromPartA',
                        style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: isMatching ? Colors.teal : Colors.orange)),
                  ]),
            ),
            if (!isMatching)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                    color: Colors.orange,
                    borderRadius: BorderRadius.circular(20)),
                child: const Text('INCOHÉRENCE',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Colors.white)),
              ),
          ]),
        ),
        Expanded(
          child: _employees.isEmpty
              ? const Center(
                  child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.people_outline,
                            size: 80, color: Colors.grey),
                        SizedBox(height: 16),
                        Text(
                            'Aucun employé enregistré.\n\nAjoutez manuellement via le bouton +\nou importez un fichier Excel.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.grey)),
                      ]),
                )
              : SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: DataTable(
                      columnSpacing: 16,
                      headingRowColor: WidgetStateProperty.resolveWith(
                          (states) => Colors.teal.shade50),
                      columns: const [
                        DataColumn(
                            label: Text('N°',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Noms et Prénoms',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Sexe',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Âge',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Nationalité',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Diplôme',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Fonction',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Ancienneté',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Catégorie',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Salaire (FCFA)',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Actions',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                      ],
                      rows: List.generate(_employees.length, (index) {
                        final emp = _employees[index];
                        final catDisplay = emp.salaryCategory == 'non-declared'
                            ? 'N/D'
                            : 'Catégorie ${emp.salaryCategory}';
                        return DataRow(
                          color: WidgetStateProperty.resolveWith((states) {
                            if (index.isOdd) return Colors.grey.shade50;
                            return null;
                          }),
                          cells: [
                            DataCell(Text('${index + 1}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Colors.teal))),
                            DataCell(ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 160),
                              child: Text(emp.fullName,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                            )),
                            DataCell(Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: emp.gender == 'M'
                                    ? Colors.blue.shade50
                                    : Colors.pink.shade50,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(emp.gender,
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: emp.gender == 'M'
                                        ? Colors.blue.shade700
                                        : Colors.pink.shade700,
                                  )),
                            )),
                            DataCell(Text('${emp.age} ans')),
                            DataCell(Text(emp.nationality == 'Cameroonian'
                                ? 'Camerounais'
                                : emp.otherCountry ?? 'Étranger')),
                            DataCell(ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 72),
                              child: Text(emp.diploma,
                                  overflow: TextOverflow.ellipsis),
                            )),
                            DataCell(ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 110),
                              child: Text(emp.function,
                                  overflow: TextOverflow.ellipsis),
                            )),
                            DataCell(Text(
                                '${emp.seniority} an${emp.seniority > 1 ? 's' : ''}')),
                            DataCell(Text(catDisplay,
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold))),
                            DataCell(Text(_formatSalary(emp.salary),
                                style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: Colors.teal.shade700))),
                            DataCell(
                                Row(mainAxisSize: MainAxisSize.min, children: [
                              InkWell(
                                onTap: () =>
                                    _showAddEmployeeWizard(editIndex: index),
                                borderRadius: BorderRadius.circular(4),
                                child: const Padding(
                                    padding: EdgeInsets.all(6),
                                    child: Icon(Icons.edit_outlined,
                                        size: 18, color: Colors.teal)),
                              ),
                              const SizedBox(width: 4),
                              InkWell(
                                onTap: () => _deleteEmployee(index),
                                borderRadius: BorderRadius.circular(4),
                                child: const Padding(
                                    padding: EdgeInsets.all(6),
                                    child: Icon(Icons.delete_outline,
                                        size: 18, color: Colors.red)),
                              ),
                            ])),
                          ],
                        );
                      }),
                    ),
                  ),
                ),
        ),
      ]),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddEmployeeWizard(),
        icon: const Icon(Icons.person_add),
        label: const Text('Ajouter employé'),
        backgroundColor: Colors.teal,
        foregroundColor: Colors.white,
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, boxShadow: [
          BoxShadow(
              color: Colors.grey.shade300,
              blurRadius: 8,
              offset: const Offset(0, -2)),
        ]),
        child: SafeArea(
          child: SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed:
                  _employees.isEmpty || _isLoading ? null : _submitDeclaration,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                disabledBackgroundColor: Colors.grey.shade300,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: _isLoading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('SOUMETTRE LA DÉCLARATION',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold)),
            ),
          ),
        ),
      ),
    );
  }
}
