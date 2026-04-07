import 'dart:io';
import 'package:excel/excel.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';

class Employee {
  String fullName;
  String gender;
  int age;
  String nationality;
  String diploma;
  String function;
  int seniority;
  String salaryCategory;

  Employee({
    required this.fullName,
    required this.gender,
    required this.age,
    required this.nationality,
    required this.diploma,
    required this.function,
    required this.seniority,
    required this.salaryCategory,
  });

  Map<String, dynamic> toJson() => {
        'fullName': fullName,
        'gender': gender,
        'age': age,
        'nationality': nationality,
        'diploma': diploma,
        'function': function,
        'seniority': seniority,
        'salaryCategory': salaryCategory,
      };
}

class EmployeeListScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> companyData;
  final int year;
  const EmployeeListScreen(
      {super.key, required this.companyData, required this.year});

  @override
  ConsumerState<EmployeeListScreen> createState() => _EmployeeListScreenState();
}

class _EmployeeListScreenState extends ConsumerState<EmployeeListScreen> {
  final List<Employee> _employees = [];
  bool _isLoading = false;

  final _nameCtrl = TextEditingController();
  String _gender = 'M';
  final _ageCtrl = TextEditingController();
  final _nationalityCtrl = TextEditingController();
  final _diplomaCtrl = TextEditingController();
  final _functionCtrl = TextEditingController();
  final _seniorityCtrl = TextEditingController();
  final _salaryCategoryCtrl = TextEditingController();

  void _addEmployee() {
    if (_nameCtrl.text.isEmpty ||
        _ageCtrl.text.isEmpty ||
        _nationalityCtrl.text.isEmpty ||
        _functionCtrl.text.isEmpty ||
        _seniorityCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Veuillez remplir tous les champs obligatoires'),
            backgroundColor: Colors.orange),
      );
      return;
    }

    setState(() {
      _employees.add(Employee(
        fullName: _nameCtrl.text,
        gender: _gender,
        age: int.parse(_ageCtrl.text),
        nationality: _nationalityCtrl.text,
        diploma: _diplomaCtrl.text,
        function: _functionCtrl.text,
        seniority: int.parse(_seniorityCtrl.text),
        salaryCategory: _salaryCategoryCtrl.text,
      ));
      _nameCtrl.clear();
      _ageCtrl.clear();
      _nationalityCtrl.clear();
      _diplomaCtrl.clear();
      _functionCtrl.clear();
      _seniorityCtrl.clear();
      _salaryCategoryCtrl.clear();
      _gender = 'M';
    });
  }

  Future<void> _importEmployees() async {
    FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'xls', 'csv'],
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
    setState(() {
      _employees.addAll(newEmployees);
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('${newEmployees.length} employés importés'),
            backgroundColor: Colors.green),
      );
    }
  }

  Future<void> _submitDeclaration() async {
    if (_employees.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Ajoutez au moins un employé'),
            backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isLoading = true);
    final api = ref.read(apiClientProvider);
    final payload = {
      'company': widget.companyData,
      'year': widget.year,
      'employees': _employees.map((e) => e.toJson()).toList(),
    };

    try {
      final response = await api.post('/dsmo/declaration', data: payload);
      if (response.statusCode == 201 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Déclaration complète soumise avec succès !'),
              backgroundColor: Colors.green),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('PARTIE B : LISTE DES EMPLOYÉS'),
        backgroundColor: Colors.teal,
      ),
      body: Column(
        children: [
          Card(
            margin: const EdgeInsets.all(8),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  const Text('Ajouter un employé manuellement',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  Row(children: [
                    Expanded(
                        child: TextFormField(
                            controller: _nameCtrl,
                            decoration: const InputDecoration(
                                labelText: 'Noms et Prénoms'))),
                    const SizedBox(width: 8),
                    Expanded(
                        child: DropdownButtonFormField<String>(
                      initialValue: _gender, // ✅ fixed
                      items: const [
                        DropdownMenuItem(value: 'M', child: Text('M')),
                        DropdownMenuItem(value: 'F', child: Text('F')),
                      ],
                      onChanged: (v) => setState(() => _gender = v!),
                      decoration: const InputDecoration(labelText: 'Sexe'),
                    )),
                  ]),
                  Row(children: [
                    Expanded(
                        child: TextFormField(
                            controller: _ageCtrl,
                            keyboardType: TextInputType.number,
                            decoration:
                                const InputDecoration(labelText: 'Âge'))),
                    const SizedBox(width: 8),
                    Expanded(
                        child: TextFormField(
                            controller: _nationalityCtrl,
                            decoration: const InputDecoration(
                                labelText: 'Nationalité'))),
                  ]),
                  Row(children: [
                    Expanded(
                        child: TextFormField(
                            controller: _diplomaCtrl,
                            decoration:
                                const InputDecoration(labelText: 'Diplôme'))),
                    const SizedBox(width: 8),
                    Expanded(
                        child: TextFormField(
                            controller: _functionCtrl,
                            decoration:
                                const InputDecoration(labelText: 'Fonction'))),
                  ]),
                  Row(children: [
                    Expanded(
                        child: TextFormField(
                            controller: _seniorityCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                                labelText: 'Ancienneté (ans)'))),
                    const SizedBox(width: 8),
                    Expanded(
                        child: TextFormField(
                            controller: _salaryCategoryCtrl,
                            decoration: const InputDecoration(
                                labelText: 'Catégorie salaire'))),
                  ]),
                  const SizedBox(height: 8),
                  ElevatedButton.icon(
                    onPressed: _addEmployee,
                    icon: const Icon(Icons.add),
                    label: const Text('Ajouter'),
                    style:
                        ElevatedButton.styleFrom(backgroundColor: Colors.teal),
                  ),
                ],
              ),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              ElevatedButton.icon(
                onPressed: _importEmployees,
                icon: const Icon(Icons.upload_file),
                label: const Text('Importer Excel/CSV'),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
              ),
            ],
          ),
          const Divider(),
          Expanded(
            child: _employees.isEmpty
                ? const Center(
                    child: Text(
                        'Aucun employé. Ajoutez manuellement ou importez un fichier.'))
                : SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: DataTable(
                      columns: const [
                        DataColumn(label: Text('Nom complet')),
                        DataColumn(label: Text('Sexe')),
                        DataColumn(label: Text('Âge')),
                        DataColumn(label: Text('Nationalité')),
                        DataColumn(label: Text('Diplôme')),
                        DataColumn(label: Text('Fonction')),
                        DataColumn(label: Text('Ancienneté')),
                        DataColumn(label: Text('Cat. salaire')),
                      ],
                      rows: _employees
                          .map((e) => DataRow(cells: [
                                DataCell(Text(e.fullName)),
                                DataCell(Text(e.gender)),
                                DataCell(Text(e.age.toString())),
                                DataCell(Text(e.nationality)),
                                DataCell(Text(e.diploma)),
                                DataCell(Text(e.function)),
                                DataCell(Text(e.seniority.toString())),
                                DataCell(Text(e.salaryCategory)),
                              ]))
                          .toList(),
                    ),
                  ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _isLoading ? null : _submitDeclaration,
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                minimumSize: const Size(double.infinity, 50)),
            child: _isLoading
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text('SOUMETTRE LA DÉCLARATION COMPLÈTE'),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
