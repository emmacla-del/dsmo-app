import 'dart:io';
import 'package:excel/excel.dart' hide Border;
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';

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
  int? _seniority;
  String? _salaryCategory;

  final List<String> _diplomaOptions = [
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

  final List<String> _salaryCategories = [
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
  void dispose() {
    _fullNameController.dispose();
    _functionController.dispose();
    super.dispose();
  }

  void _addEmployee(Employee employee) {
    setState(() {
      _employees.add(employee);
    });
    _clearWizardForm();
  }

  void _deleteEmployee(int index) {
    setState(() {
      _employees.removeAt(index);
    });
  }

  void _clearWizardForm() {
    _fullNameController.clear();
    _gender = null;
    _age = null;
    _nationality = null;
    _otherCountry = null;
    _diploma = null;
    _functionController.clear();
    _seniority = null;
    _salaryCategory = null;
  }

  Future<void> _showAddEmployeeWizard() async {
    _clearWizardForm();
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
                // Handle bar
                Container(
                  margin: const EdgeInsets.only(top: 8),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                // Progress bar
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Column(
                    children: [
                      Text(
                        'Étape ${currentStep + 1} sur 8',
                        style: const TextStyle(
                          fontSize: 16,
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
                // Step content
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
                // Navigation buttons
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
                                _showConfirmationDialog(context, setSheetState);
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
          _showError('Veuillez sélectionner la catégorie salaire');
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

  void _showWarning(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.orange),
    );
  }

  void _showConfirmationDialog(
      BuildContext context, StateSetter setSheetState) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmation', style: TextStyle(color: Colors.teal)),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
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
              _addEmployee(employee);
              Navigator.pop(context); // Close dialog
              Navigator.pop(context); // Close bottom sheet
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.teal),
            child:
                const Text('Confirmer', style: TextStyle(color: Colors.white)),
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

  // ── Step widgets ──────────────────────────────────────────────────────────

  Widget _buildStep1FullName() {
    return TextFormField(
      controller: _fullNameController,
      autofocus: true,
      decoration: const InputDecoration(
        labelText: 'Noms et Prénoms',
        border: OutlineInputBorder(),
        prefixIcon: Icon(Icons.person),
      ),
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
              child: _buildToggleButton(
                  'M', _gender == 'M', () => setState(() => _gender = 'M')),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildToggleButton(
                  'F', _gender == 'F', () => setState(() => _gender = 'F')),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStep3Age() {
    return TextFormField(
      keyboardType: TextInputType.number,
      autofocus: true,
      decoration: const InputDecoration(
        labelText: 'Âge',
        border: OutlineInputBorder(),
        prefixIcon: Icon(Icons.cake),
        suffixText: 'ans',
      ),
      onChanged: (value) => _age = int.tryParse(value),
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
              labelText: 'Pays',
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
    return DropdownButtonFormField<String>(
      initialValue: _diploma,
      decoration: const InputDecoration(
        labelText: 'Diplôme',
        border: OutlineInputBorder(),
        prefixIcon: Icon(Icons.school),
      ),
      items: _diplomaOptions
          .map((d) => DropdownMenuItem(value: d, child: Text(d)))
          .toList(),
      onChanged: (value) => setState(() => _diploma = value),
    );
  }

  Widget _buildStep6Function() {
    return TextFormField(
      controller: _functionController,
      autofocus: true,
      decoration: const InputDecoration(
        labelText: 'Fonction',
        border: OutlineInputBorder(),
        prefixIcon: Icon(Icons.work),
      ),
    );
  }

  Widget _buildStep7Seniority() {
    return TextFormField(
      keyboardType: TextInputType.number,
      autofocus: true,
      decoration: const InputDecoration(
        labelText: 'Ancienneté',
        border: OutlineInputBorder(),
        prefixIcon: Icon(Icons.timeline),
        suffixText: 'ans',
      ),
      onChanged: (value) => _seniority = int.tryParse(value),
    );
  }

  Widget _buildStep8SalaryCategory(StateSetter setState) {
    return DropdownButtonFormField<String>(
      initialValue: _salaryCategory,
      decoration: const InputDecoration(
        labelText: 'Catégorie salaire',
        border: OutlineInputBorder(),
        prefixIcon: Icon(Icons.attach_money),
      ),
      items: _salaryCategories
          .map((c) => DropdownMenuItem(value: c, child: Text(c)))
          .toList(),
      onChanged: (value) => setState(() => _salaryCategory = value),
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
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isSelected ? Colors.white : Colors.black87,
            ),
          ),
        ),
      ),
    );
  }

  // ── Excel import ──────────────────────────────────────────────────────────

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
    for (var row in sheet.rows) {
      if (row[0]?.value == null) continue;
      try {
        newEmployees.add(Employee(
          fullName: row[0]?.value.toString() ?? '',
          gender: row[1]?.value.toString() ?? 'M',
          age: int.tryParse(row[2]?.value.toString() ?? '0') ?? 0,
          nationality: row[3]?.value.toString() ?? '',
          diploma: row[4]?.value.toString() ?? '',
          function: row[5]?.value.toString() ?? '',
          seniority: int.tryParse(row[6]?.value.toString() ?? '0') ?? 0,
          salaryCategory: row[7]?.value.toString() ?? '',
        ));
      } catch (_) {}
    }

    setState(() => _employees.addAll(newEmployees));

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${newEmployees.length} employés importés'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  // ── Validation against Part A ─────────────────────────────────────────────

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
                'Le nombre d\'employés saisi ne correspond pas aux effectifs déclarés :\n',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              ...mismatches.map((m) => Padding(
                    padding: const EdgeInsets.only(left: 8, bottom: 4),
                    child: Text(m, style: const TextStyle(fontSize: 14)),
                  )),
              const SizedBox(height: 16),
              const Text(
                'Voulez-vous continuer quand même ?',
                style: TextStyle(fontWeight: FontWeight.w500),
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
              style: ElevatedButton.styleFrom(backgroundColor: Colors.teal),
              child: const Text('Continuer',
                  style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
      return shouldContinue == true;
    }
    return true;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  Future<void> _submitDeclaration() async {
    if (_employees.isEmpty) {
      _showError('Ajoutez au moins un employé');
      return;
    }

    // Validate against Part A totals
    final isValid = await _validateAgainstPartA();
    if (!isValid) return;

    setState(() => _isLoading = true);
    final api = ref.read(apiClientProvider);
    final payload = {
      'company': widget.companyData,
      'year': widget.year,
      if (widget.fillingDate != null) 'fillingDate': widget.fillingDate,
      if (widget.movements != null) 'movements': widget.movements,
      if (widget.qualitative != null) 'qualitative': widget.qualitative,
      'employees': _employees.map((e) => e.toJson()).toList(),
    };

    try {
      final response = await api.post('/dsmo/declaration', data: payload);
      if (response.statusCode == 201 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Déclaration complète soumise avec succès !'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.popUntil(context, (route) => route.isFirst);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    // Get counts from Part A for display
    final totalFromPartA = widget.companyData['totalEmployees'] as int? ?? 0;
    final actualTotal = _employees.length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('PARTIE B : LISTE DES EMPLOYÉS'),
        backgroundColor: Colors.teal,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.upload_file),
            onPressed: _importEmployees,
            tooltip: 'Importer Excel',
          ),
        ],
      ),
      body: Column(
        children: [
          // Progress indicator with comparison to Part A
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: actualTotal == totalFromPartA
                ? Colors.teal.shade50
                : Colors.orange.shade50,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  actualTotal == totalFromPartA
                      ? Icons.check_circle
                      : Icons.warning,
                  color: actualTotal == totalFromPartA
                      ? Colors.teal
                      : Colors.orange,
                ),
                const SizedBox(width: 8),
                Text(
                  '${_employees.length} / ${widget.totalEmployees} employés ajoutés',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: actualTotal == totalFromPartA
                        ? Colors.teal
                        : Colors.orange,
                  ),
                ),
                if (actualTotal != totalFromPartA) ...[
                  const SizedBox(width: 8),
                  const Text(
                    '(Incohérence)',
                    style: TextStyle(fontSize: 12, color: Colors.orange),
                  ),
                ],
              ],
            ),
          ),
          // Employee list
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
                          'Aucun employé.\nAjoutez manuellement ou importez un fichier.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey),
                        ),
                      ],
                    ),
                  )
                : SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: DataTable(
                      columnSpacing: 16,
                      columns: const [
                        DataColumn(
                            label: Text('N°',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Nom complet',
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
                            label: Text('Cat. salaire',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text('Actions',
                                style: TextStyle(fontWeight: FontWeight.bold))),
                      ],
                      rows: List.generate(_employees.length, (index) {
                        final emp = _employees[index];
                        return DataRow(
                          cells: [
                            DataCell(Text('${index + 1}')),
                            DataCell(Text(emp.fullName)),
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
                              IconButton(
                                icon:
                                    const Icon(Icons.delete, color: Colors.red),
                                onPressed: () => _deleteEmployee(index),
                                tooltip: 'Supprimer',
                              ),
                            ),
                          ],
                        );
                      }),
                    ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddEmployeeWizard,
        icon: const Icon(Icons.add),
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
              blurRadius: 4,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed:
                _employees.isEmpty || _isLoading ? null : _submitDeclaration,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              disabledBackgroundColor: Colors.grey.shade300,
            ),
            child: _isLoading
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text(
                    'SOUMETTRE LA DÉCLARATION COMPLÈTE',
                    style: TextStyle(color: Colors.white),
                  ),
          ),
        ),
      ),
    );
  }
}
