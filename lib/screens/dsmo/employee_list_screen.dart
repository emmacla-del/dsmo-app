import 'dart:io';
import 'package:excel/excel.dart' hide Border;
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../data/api_client.dart';

// Persists the employee list across back/forward navigation within the same session.
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
  });

  Map<String, dynamic> toJson() => {
        'fullName': fullName,
        'gender': gender,
        'age': age,
        'nationality': nationality == 'Cameroonian' ? 'CAMEROON' : 'OTHER',
        if (otherCountry != null) 'otherCountry': otherCountry,
        'diploma': diploma,
        'function': function,
        'seniority': seniority,
        'salaryCategory': salaryCategory,
      };
}

class EmployeeListScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> companyData;
  final int year;
  final String? fillingDate;
  final List<Map<String, dynamic>>? movements;
  final Map<String, dynamic>? qualitative;
  final int totalEmployees;

  const EmployeeListScreen({
    super.key,
    required this.companyData,
    required this.year,
    this.fillingDate,
    this.movements,
    this.qualitative,
    required this.totalEmployees,
  });

  @override
  ConsumerState<EmployeeListScreen> createState() => _EmployeeListScreenState();
}

class _EmployeeListScreenState extends ConsumerState<EmployeeListScreen> {
  final List<Employee> _employees = [];
  bool _isLoading = false;

  // Wizard state
  final _fullNameController = TextEditingController();
  String? _gender;
  int? _age;
  String? _nationality;
  String? _otherCountry;
  String? _diploma;
  final _functionController = TextEditingController();
  final _seniorityController = TextEditingController();
  int? _seniority;
  String? _salaryCategory;

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
    '12'
  ];

  @override
  void initState() {
    super.initState();
    // Restore any employees saved before the user navigated back.
    final saved = ref.read(employeeListProvider);
    if (saved.isNotEmpty) {
      _employees.addAll(saved);
    }
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _functionController.dispose();
    _seniorityController.dispose();
    super.dispose();
  }

  void _addEmployee(Employee employee) {
    setState(() {
      _employees.add(employee);
    });
    ref.read(employeeListProvider.notifier).state = List.from(_employees);
    _clearWizardForm();
  }

  void _deleteEmployee(int index) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer l\'employé ?'),
        content: Text(
          'Voulez-vous retirer ${_employees[index].fullName} de la liste ?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Supprimer', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() {
      _employees.removeAt(index);
    });
    ref.read(employeeListProvider.notifier).state = List.from(_employees);
  }

  void _clearWizardForm() {
    _fullNameController.clear();
    _gender = null;
    _age = null;
    _nationality = null;
    _otherCountry = null;
    _diploma = null;
    _functionController.clear();
    _seniorityController.clear();
    _seniority = null;
    _salaryCategory = null;
  }

  Future<void> _showAddEmployeeWizard({int? editIndex}) async {
    _clearWizardForm();

    // Pre-fill the form when editing an existing employee
    if (editIndex != null) {
      final emp = _employees[editIndex];
      _fullNameController.text = emp.fullName;
      _gender = emp.gender;
      _age = emp.age;
      _nationality = emp.nationality == 'Cameroonian' ? 'Camerounais' : 'Étranger';
      _otherCountry = emp.otherCountry;
      _diploma = emp.diploma;
      _functionController.text = emp.function;
      _seniorityController.text = emp.seniority.toString();
      _seniority = emp.seniority;
      _salaryCategory = emp.salaryCategory;
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
                    editIndex != null ? 'MODIFIER L\'EMPLOYÉ' : 'AJOUTER UN EMPLOYÉ',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.teal,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                  child: Column(
                    children: [
                      Text(
                        'Étape ${currentStep + 1} sur 8',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.teal,
                        ),
                      ),
                      const SizedBox(height: 8),
                      LinearProgressIndicator(
                        value: (currentStep + 1) / 8,
                        backgroundColor: Colors.grey.shade200,
                        color: Colors.teal,
                        minHeight: 6,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    controller: scrollController,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (currentStep == 0) _buildStep1FullName(),
                        if (currentStep == 1) _buildStep2Gender(setSheetState),
                        if (currentStep == 2) _buildStep3Age(),
                        if (currentStep == 3)
                          _buildStep4Nationality(setSheetState),
                        if (currentStep == 4) _buildStep5Diploma(setSheetState),
                        if (currentStep == 5) _buildStep6Function(),
                        if (currentStep == 6) _buildStep7Seniority(),
                        if (currentStep == 7)
                          _buildStep8SalaryCategory(setSheetState),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(
                      16, 8, 16, MediaQuery.of(context).viewInsets.bottom + 16),
                  child: Row(
                    children: [
                      if (currentStep > 0)
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
                      if (currentStep > 0) const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {
                            if (_validateStep(currentStep)) {
                              if (currentStep < 7) {
                                setSheetState(() => currentStep++);
                              } else {
                                _showConfirmationDialog(context, setSheetState,
                                    editIndex: editIndex);
                              }
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.teal,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                            currentStep < 7 ? 'Suivant' : 'Confirmer',
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
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
            (_otherCountry == null || _otherCountry!.trim().isEmpty)) {
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
          _showError('Veuillez sélectionner la catégorie salaire (1-12)');
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  void _showConfirmationDialog(
      BuildContext context, StateSetter setSheetState, {int? editIndex}) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          editIndex != null ? 'Modifier l\'employé' : 'Confirmation',
          style: const TextStyle(color: Colors.teal),
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Vérifiez les informations :',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const Divider(),
              _buildSummaryTile('Noms et Prénoms', _fullNameController.text),
              _buildSummaryTile(
                  'Sexe', _gender == 'M' ? 'Masculin' : 'Féminin'),
              _buildSummaryTile('Âge', '$_age ans'),
              _buildSummaryTile('Nationalité',
                  _nationality == 'Étranger' ? _otherCountry! : 'Camerounais'),
              _buildSummaryTile('Diplôme', _diploma!),
              _buildSummaryTile('Fonction', _functionController.text),
              _buildSummaryTile('Ancienneté', '$_seniority ans'),
              _buildSummaryTile('Catégorie salaire', _salaryCategory!),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Modifier', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () {
              final employee = Employee(
                fullName: _fullNameController.text.trim(),
                gender: _gender!,
                age: _age!,
                nationality:
                    _nationality == 'Camerounais' ? 'Cameroonian' : 'Other',
                otherCountry: _nationality == 'Étranger' ? _otherCountry : null,
                diploma: _diploma!,
                function: _functionController.text.trim(),
                seniority: _seniority!,
                salaryCategory: _salaryCategory!,
              );
              Navigator.pop(context); // close confirm dialog
              Navigator.pop(context); // close bottom sheet
              if (editIndex != null) {
                // Replace existing employee in-place
                setState(() {
                  _employees[editIndex] = employee;
                });
                ref.read(employeeListProvider.notifier).state =
                    List.from(_employees);
              } else {
                _addEmployee(employee);
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.teal),
            child: Text(
              editIndex != null ? 'Enregistrer' : 'Confirmer',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryTile(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(label,
                style: const TextStyle(fontWeight: FontWeight.w500)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  Widget _buildStep1FullName() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
      ],
    );
  }

  Widget _buildStep2Gender(StateSetter setState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Sexe',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _buildToggleButton('Masculin (M)', _gender == 'M',
                  () => setState(() => _gender = 'M')),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildToggleButton('Féminin (F)', _gender == 'F',
                  () => setState(() => _gender = 'F')),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStep3Age() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Âge',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
        const SizedBox(height: 8),
        TextFormField(
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
      ],
    );
  }

  Widget _buildStep4Nationality(StateSetter setState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Nationalité',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _buildToggleButton(
                'Camerounais',
                _nationality == 'Camerounais',
                () => setState(() {
                  _nationality = 'Camerounais';
                  _otherCountry = null;
                }),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildToggleButton(
                'Étranger',
                _nationality == 'Étranger',
                () => setState(() => _nationality = 'Étranger'),
              ),
            ),
          ],
        ),
        if (_nationality == 'Étranger') ...[
          const SizedBox(height: 16),
          TextFormField(
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Préciser le pays',
              hintText: 'Ex: France, Nigeria, Chine...',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.flag),
            ),
            onChanged: (value) => _otherCountry = value,
          ),
        ],
      ],
    );
  }

  Widget _buildStep5Diploma(StateSetter setState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Diplôme le plus élevé',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _diploma,
          hint: const Text('Sélectionnez un diplôme'),
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.school),
          ),
          items: _diplomaOptions
              .map((d) => DropdownMenuItem(value: d, child: Text(d)))
              .toList(),
          onChanged: (value) => setState(() => _diploma = value),
        ),
      ],
    );
  }

  Widget _buildStep6Function() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
      ],
    );
  }

  Widget _buildStep7Seniority() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Ancienneté dans l\'entreprise',
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
      ],
    );
  }

  Widget _buildStep8SalaryCategory(StateSetter setState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Catégorie socio-professionnelle (Salaire)',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _salaryCategory,
          hint: const Text('Sélectionnez la catégorie 1-12'),
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.attach_money),
          ),
          items: _salaryCategories
              .map((c) =>
                  DropdownMenuItem(value: c, child: Text('Catégorie $c')))
              .toList(),
          onChanged: (value) => setState(() => _salaryCategory = value),
        ),
        const SizedBox(height: 8),
        const Text(
          'Correspond à la classification des salaires selon la grille officielle (1 = plus bas, 12 = plus haut)',
          style: TextStyle(fontSize: 12, color: Colors.grey),
        ),
      ],
    );
  }

  Widget _buildToggleButton(String label, bool isSelected, VoidCallback onTap) {
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
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isSelected ? Colors.white : Colors.black87,
            ),
          ),
        ),
      ),
    );
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
    for (var row in sheet.rows) {
      if (row[0]?.value == null) continue;
      try {
        newEmployees.add(Employee(
          fullName: row[0]?.value.toString() ?? '',
          gender: row[1]?.value.toString() == 'F' ? 'F' : 'M',
          age: int.tryParse(row[2]?.value.toString() ?? '0') ?? 0,
          nationality: row[3]?.value.toString() == 'Cameroonian'
              ? 'Cameroonian'
              : 'Other',
          otherCountry: row[4]?.value.toString(),
          diploma: row[5]?.value.toString() ?? '',
          function: row[6]?.value.toString() ?? '',
          seniority: int.tryParse(row[7]?.value.toString() ?? '0') ?? 0,
          salaryCategory: row[8]?.value.toString() ?? '',
        ));
      } catch (e) {
        errorCount++;
        debugPrint('Import row error: $e');
      }
    }

    setState(() {
      _employees.addAll(newEmployees);
    });
    ref.read(employeeListProvider.notifier).state = List.from(_employees);

    if (mounted) {
      final msg = errorCount == 0
          ? '${newEmployees.length} employé(s) importé(s) avec succès'
          : '${newEmployees.length} importé(s), $errorCount ligne(s) ignorée(s) (format invalide)';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg),
          backgroundColor: errorCount == 0 ? Colors.green : Colors.orange,
        ),
      );
    }
  }

  Future<void> _exportToExcel() async {
    final excel = Excel.createExcel();
    final sheet = excel['Employés'];

    final headers = [
      'N°',
      'Noms et Prénoms',
      'Sexe',
      'Âge',
      'Nationalité',
      'Diplôme',
      'Fonction',
      'Ancienneté (ans)',
      'Catégorie salaire'
    ];

    sheet.appendRow(headers);

    for (var i = 0; i < _employees.length; i++) {
      final emp = _employees[i];
      sheet.appendRow([
        (i + 1).toString(),
        emp.fullName,
        emp.gender,
        emp.age,
        emp.nationality == 'Cameroonian'
            ? 'Camerounais'
            : (emp.otherCountry ?? 'Étranger'),
        emp.diploma,
        emp.function,
        emp.seniority,
        emp.salaryCategory,
      ]);
    }

    final fileBytes = excel.encode(); // encode() is synchronous
    if (fileBytes != null) {
      final String? savePath = await FilePicker.platform.saveFile(
        dialogTitle: 'Enregistrer la liste des employés',
        fileName: 'employes_${widget.year}.xlsx',
      );
      if (savePath != null) {
        await File(savePath).writeAsBytes(fileBytes);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Export réussi !'),
              backgroundColor: Colors.green,
            ),
          );
        }
      }
    }
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
              const Text(
                'Voulez-vous continuer la soumission quand même ?',
                style: TextStyle(fontWeight: FontWeight.w500),
              ),
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
              child: const Text('Continuer malgré l\'erreur',
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

    final isValid = await _validateAgainstPartA();
    if (!isValid) return;
    if (!mounted) return;

    // Confirmation before irreversible submission
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirmer la soumission'),
        content: Text(
          'Vous êtes sur le point de soumettre la déclaration DSMO ${widget.year} '
          'avec ${_employees.length} employé(s). Cette action est irréversible.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.teal),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Soumettre', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

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
      };

      final response = await api.post('/dsmo/declaration', data: payload);

      if (response.statusCode == 201 && mounted) {
        final responseData = response.data;

        // Clear persisted employee list now that submission succeeded
        ref.read(employeeListProvider.notifier).state = [];

        if (responseData['pdfUrls'] != null &&
            responseData['pdfUrls'].isNotEmpty) {
          await _showPdfSuccessDialog(
            pdfUrls: List<String>.from(responseData['pdfUrls']),
            trackingNumber: responseData['trackingNumber'] ?? 'N/A',
            deadline: responseData['submissionDeadline'] ??
                '31 Janvier ${widget.year + 1}',
          );
        } else {
          await _showSimpleSuccessDialog();
        }

        if (mounted) {
          Navigator.popUntil(context, (route) => route.isFirst);
        }
      } else if (response.statusCode != 201 && mounted) {
        _showError(
            'Erreur lors de la soumission. Code: ${response.statusCode}');
      }
    } catch (e) {
      if (mounted) {
        _showError('Erreur réseau: ${e.toString()}');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _showPdfSuccessDialog({
    required List<String> pdfUrls,
    required String trackingNumber,
    required String deadline,
  }) async {
    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: Colors.green),
            SizedBox(width: 8),
            Text('Déclaration enregistrée !',
                style: TextStyle(color: Colors.green)),
          ],
        ),
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
                child: Row(
                  children: [
                    const Icon(Icons.numbers, size: 16, color: Colors.teal),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'N° Suivi: $trackingNumber',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text('📄 3 exemplaires PDF générés :'),
              const SizedBox(height: 12),
              ...pdfUrls.asMap().entries.map((entry) {
                final copyNames = [
                  '📋 ORIGINAL (Employeur)',
                  '📋 DUPLICATA (Autorité)',
                  '📋 TRIPLICATA (Archives)'
                ];
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  child: ListTile(
                    leading:
                        const Icon(Icons.picture_as_pdf, color: Colors.red),
                    title: Text(copyNames[entry.key]),
                    trailing: IconButton(
                      icon: const Icon(Icons.open_in_new, size: 18),
                      onPressed: () => _openPdfUrl(entry.value),
                      tooltip: 'Ouvrir',
                    ),
                    onTap: () => _openPdfUrl(entry.value),
                  ),
                );
              }),
              const Divider(height: 24),
              const Text(
                '📋 PROCÉDURE OBLIGATOIRE :',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text('• Imprimez les 3 exemplaires'),
              const Text('• Signez chaque exemplaire'),
              const Text('• Ajoutez le cachet de l\'entreprise'),
              Text('• Envoyez par PLI RECOMMANDÉ avant le $deadline'),
              const Text('• À la circonscription de l\'emploi'),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info, size: 16, color: Colors.amber.shade700),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Conformément à la loi No 91/023 du 16 décembre 1991',
                        style: TextStyle(fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton.icon(
            onPressed: () {
              Navigator.pop(context);
            },
            icon: const Icon(Icons.check),
            label: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<void> _showSimpleSuccessDialog() async {
    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Succès', style: TextStyle(color: Colors.green)),
        content: const Text(
          'Déclaration soumise avec succès !\n\n'
          'Les PDF seront disponibles dans votre espace employeur.',
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

  Future<void> _openPdfUrl(String url) async {
    final Uri uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      _showError('Impossible d\'ouvrir le PDF');
    }
  }

  String _getCurrentDate() {
    final now = DateTime.now();
    return '${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year}';
  }

  @override
  Widget build(BuildContext context) {
    final totalFromPartA = widget.companyData['totalEmployees'] as int? ?? 0;
    final actualTotal = _employees.length;
    final isMatching = actualTotal == totalFromPartA;

    return Scaffold(
      appBar: AppBar(
        title: const Text('DÉCLARATION SUR LA SITUATION DE LA MAIN D\'ŒUVRE'),
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
        ],
      ),
      body: Column(
        children: [
          Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isMatching ? Colors.teal.shade50 : Colors.orange.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color:
                    isMatching ? Colors.teal.shade200 : Colors.orange.shade200,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  isMatching ? Icons.check_circle : Icons.warning_amber_rounded,
                  color: isMatching ? Colors.teal : Colors.orange,
                  size: 24,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Employés enregistrés',
                        style: TextStyle(
                          fontSize: 12,
                          color: isMatching
                              ? Colors.teal.shade700
                              : Colors.orange.shade700,
                        ),
                      ),
                      Text(
                        '$_employees.length / $totalFromPartA',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: isMatching ? Colors.teal : Colors.orange,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!isMatching)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.orange,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'INCOHÉRENCE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
              ],
            ),
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
                          style: TextStyle(color: Colors.grey),
                        ),
                      ],
                    ),
                  )
                : SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: DataTable(
                        columnSpacing: 16,
                        headingRowColor: WidgetStateProperty.resolveWith(
                          (states) => Colors.teal.shade50,
                        ),
                        columns: const [
                          DataColumn(
                              label: Text('N°',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold))),
                          DataColumn(
                              label: Text('Noms et Prénoms',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold))),
                          DataColumn(
                              label: Text('Sexe',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold))),
                          DataColumn(
                              label: Text('Âge',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold))),
                          DataColumn(
                              label: Text('Nationalité',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold))),
                          DataColumn(
                              label: Text('Diplôme',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold))),
                          DataColumn(
                              label: Text('Fonction',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold))),
                          DataColumn(
                              label: Text('Ancienneté',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold))),
                          DataColumn(
                              label: Text('Cat. salaire',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold))),
                          DataColumn(
                              label: Text('Actions',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold))),
                        ],
                        rows: List.generate(_employees.length, (index) {
                          final emp = _employees[index];
                          return DataRow(
                            cells: [
                              DataCell(Text('${index + 1}')),
                              DataCell(Text(emp.fullName,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w500))),
                              DataCell(Text(emp.gender)),
                              DataCell(Text('${emp.age} ans')),
                              DataCell(Text(emp.nationality == 'Cameroonian'
                                  ? 'Camerounais'
                                  : emp.otherCountry ?? 'Étranger')),
                              DataCell(Text(emp.diploma)),
                              DataCell(Text(emp.function)),
                              DataCell(Text('${emp.seniority} ans')),
                              DataCell(Text(emp.salaryCategory)),
                              DataCell(
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.edit_outlined,
                                          color: Colors.teal),
                                      onPressed: () =>
                                          _showAddEmployeeWizard(editIndex: index),
                                      tooltip: 'Modifier',
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline,
                                          color: Colors.red),
                                      onPressed: () => _deleteEmployee(index),
                                      tooltip: 'Supprimer',
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          );
                        }),
                      ),
                    ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddEmployeeWizard,
        icon: const Icon(Icons.person_add),
        label: const Text('Ajouter employé'),
        backgroundColor: Colors.teal,
        foregroundColor: Colors.white,
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.grey.shade300,
              blurRadius: 8,
              offset: const Offset(0, -2),
            ),
          ],
        ),
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
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _isLoading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text(
                      'SOUMETTRE LA DÉCLARATION',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
