import 'dart:io';
import 'package:dio/dio.dart';
import 'package:excel/excel.dart' hide Border;
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:dsmo_app/core/i18n/l10n_ext.dart';
import '../../../data/api_client.dart';
import '../../../providers/sync_queue_provider.dart';
import '../../widgets/pdf_viewer_screen.dart';

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

  List<String> _diplomaOptions(BuildContext context) => [
    context.l10n.noneLabel,
    context.l10n.diplomaCepe,
    context.l10n.diplomaBepc,
    context.l10n.diplomaCap,
    context.l10n.diplomaBac,
    context.l10n.diplomaBts,
    context.l10n.diplomaLicence,
    context.l10n.diplomaMaster,
    context.l10n.diplomaDoctorat,
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
      _showSuccess(context.l10n.empListDraftLoadedFromSessionMsg);
    }
  }

  Future<void> _saveEmployeesLocally() async {
    await _employeeBox.clear();
    for (var emp in _employees) {
      await _employeeBox.add(emp);
    }
    ref.read(employeeListProvider.notifier).state = List.from(_employees);
    _showSuccess(context.l10n.empListDraftSavedMsg(_employees.length));
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
          _showError(context.l10n.empListEnterFullNameError);
          return false;
        }
        return true;
      case 1:
        if (_gender == null) {
          _showError(context.l10n.empListSelectGenderError);
          return false;
        }
        return true;
      case 2:
        if (_age == null || _age! < 16 || _age! > 120) {
          _showError(context.l10n.empListInvalidAgeError);
          return false;
        }
        return true;
      case 3:
        if (_nationality == null) {
          _showError(context.l10n.empListSelectNationalityError);
          return false;
        }
        if (_nationality == 'Étranger' &&
            _otherCountryController.text.trim().isEmpty) {
          _showError(context.l10n.empListEnterCountryError);
          return false;
        }
        return true;
      case 4:
        if (_diploma == null) {
          _showError(context.l10n.empListSelectDiplomaError);
          return false;
        }
        return true;
      case 5:
        if (_functionController.text.trim().isEmpty) {
          _showError(context.l10n.empListEnterFunctionError);
          return false;
        }
        return true;
      case 6:
        if (_seniority == null || _seniority! < 0 || _seniority! > 60) {
          _showError(context.l10n.empListInvalidSeniorityError);
          return false;
        }
        return true;
      case 7:
        if (_salaryCategory == null) {
          _showError(context.l10n.empListSelectCategoryError);
          return false;
        }
        return true;
      case 8:
        if (_salary == null || _salary! <= 0) {
          _showError(context.l10n.empListInvalidSalaryError);
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
        title: Text(context.l10n.empListDeleteEmployeeTitle),
        content: Text(
            context.l10n.empListDeleteEmployeeConfirm(_employees[index].fullName)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(context.l10n.cancelButton)),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child:
                Text(context.l10n.settingsDeleteButton, style: const TextStyle(color: Colors.white)),
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
                        ? context.l10n.empListEditEmployeeTitle
                        : context.l10n.empListAddEmployeeTitle,
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.teal),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                  child: Column(children: [
                    Text(context.l10n.empListStepProgressLabel(currentStep + 1),
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
                          child: Text(context.l10n.goBackButton,
                              style: const TextStyle(color: Colors.teal)),
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
                        child: Text(currentStep < 8 ? context.l10n.next : context.l10n.confirmButton,
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
      Text(context.l10n.empListFullNameStepLabel,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      TextFormField(
        controller: _fullNameController,
        autofocus: true,
        decoration: InputDecoration(
          hintText: context.l10n.empListFullNameHintExample,
          border: OutlineInputBorder(),
          prefixIcon: Icon(Icons.person),
        ),
      ),
    ]);
  }

  Widget _buildStep2Gender(StateSetter setState) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(context.l10n.empListGenderStepLabel,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(
            child: _buildGenderButton(context.l10n.genderMaleOption, _gender == 'M',
                () => setState(() => _gender = 'M'))),
        const SizedBox(width: 16),
        Expanded(
            child: _buildGenderButton(context.l10n.genderFemaleOption, _gender == 'F',
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
      Text(context.l10n.empListAgeStepLabel,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      TextFormField(
        controller: _ageController,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        autofocus: true,
        decoration: InputDecoration(
          hintText: context.l10n.empListAgeHintExample,
          border: const OutlineInputBorder(),
          prefixIcon: const Icon(Icons.cake),
          suffixText: context.l10n.yearsUnitSuffix,
        ),
        onChanged: (value) => _age = int.tryParse(value),
      ),
    ]);
  }

  Widget _buildStep4Nationality(StateSetter setState) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(context.l10n.empListNationalityStepLabel,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(
            child: _buildNationalityButton(
                context.l10n.nationalityCameroonianOption,
                _nationality == 'Camerounais',
                () => setState(() {
                      _nationality = 'Camerounais';
                      _otherCountryController.clear();
                    }))),
        const SizedBox(width: 16),
        Expanded(
            child: _buildNationalityButton(
                context.l10n.nationalityForeignOption,
                _nationality == 'Étranger',
                () => setState(() => _nationality = 'Étranger'))),
      ]),
      if (_nationality == 'Étranger') ...[
        const SizedBox(height: 16),
        TextFormField(
          controller: _otherCountryController,
          autofocus: true,
          decoration: InputDecoration(
            labelText: context.l10n.empListSpecifyCountryLabel,
            hintText: context.l10n.empListCountryHintExample,
            border: const OutlineInputBorder(),
            prefixIcon: const Icon(Icons.flag),
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
      Text(context.l10n.empListDiplomaStepLabel,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      DropdownButtonFormField<String>(
        initialValue: _diploma,
        hint: Text(context.l10n.empListSelectDiplomaHint),
        decoration: const InputDecoration(
            border: OutlineInputBorder(), prefixIcon: Icon(Icons.school)),
        items: _diplomaOptions(context)
            .map((d) => DropdownMenuItem(value: d, child: Text(d)))
            .toList(),
        onChanged: (value) => setState(() => _diploma = value),
      ),
    ]);
  }

  Widget _buildStep6Function() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(context.l10n.empListFunctionStepLabel,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      TextFormField(
        controller: _functionController,
        autofocus: true,
        decoration: InputDecoration(
          hintText: context.l10n.empListFunctionHintExample,
          border: OutlineInputBorder(),
          prefixIcon: Icon(Icons.work),
        ),
      ),
    ]);
  }

  Widget _buildStep7Seniority() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(context.l10n.empListSeniorityStepLabel,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      TextFormField(
        controller: _seniorityController,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        autofocus: true,
        decoration: InputDecoration(
          hintText: context.l10n.empListSeniorityHintExample,
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
      Text(context.l10n.empListCategoryStepLabel,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      DropdownButtonFormField<String>(
        initialValue: _salaryCategory,
        hint: Text(context.l10n.empListSelectCategoryHint),
        decoration: const InputDecoration(
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.business_center)),
        items: _salaryCategories.map((c) {
          final display = c == 'non-declared' ? context.l10n.nonDeclaredLabel : context.l10n.categoryNumberLabel(c);
          return DropdownMenuItem(value: c, child: Text(display));
        }).toList(),
        onChanged: (value) => setState(() => _salaryCategory = value),
      ),
      const SizedBox(height: 8),
      Text(
        context.l10n.empListCategoryScaleHelper,
        style: const TextStyle(fontSize: 12, color: Colors.grey),
      ),
    ]);
  }

  Widget _buildStep9Salary() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(context.l10n.empListSalaryStepLabel,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      const SizedBox(height: 8),
      TextFormField(
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        autofocus: true,
        decoration: InputDecoration(
          hintText: context.l10n.empListSalaryHintExample,
          border: const OutlineInputBorder(),
          prefixIcon: const Icon(Icons.attach_money),
          suffixText: context.l10n.fcfaCurrencySuffix,
          helperText: context.l10n.mandatoryHelperText,
          helperStyle: const TextStyle(color: Colors.red),
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
          ? context.l10n.empListImportSuccessMsg(newEmployees.length)
          : context.l10n.empListImportPartialMsg(newEmployees.length, errorCount);
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
      TextCellValue(context.l10n.empListFullNameStepLabel),
      TextCellValue(context.l10n.empListGenderStepLabel),
      TextCellValue(context.l10n.empListAgeStepLabel),
      TextCellValue(context.l10n.empListNationalityStepLabel),
      TextCellValue(context.l10n.excelColCountry),
      TextCellValue(context.l10n.excelColDiploma),
      TextCellValue(context.l10n.registerFunctionRowLabel),
      TextCellValue(context.l10n.excelColSeniorityYears),
      TextCellValue(context.l10n.companyAnalyticsCategoryHeader),
      TextCellValue(context.l10n.excelColSalary)
    ]);

    for (var emp in _employees) {
      sheet.appendRow([
        TextCellValue(emp.fullName),
        TextCellValue(emp.gender),
        IntCellValue(emp.age),
        TextCellValue(
            emp.nationality == 'Cameroonian' ? context.l10n.nationalityCameroonianOption : context.l10n.nationalityForeignOption),
        TextCellValue(emp.otherCountry ?? context.l10n.pdfNotApplicable),
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
        dialogTitle: context.l10n.empListSaveFileDialogTitle,
        fileName: 'employes_${widget.year}.xlsx',
      );
      if (savePath != null) {
        await File(savePath).writeAsBytes(fileBytes);
        if (mounted) _showSuccess(context.l10n.exportSuccessMsg);
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

    String yesNo(dynamic v) => v == true ? context.l10n.yesLabel : (v == false ? context.l10n.noLabel : context.l10n.pdfNotApplicable);

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
          return context.l10n.companyAnalyticsRecruitmentsLabel;
        case 'PROMOTION':
          return context.l10n.movementsPromotionsPlural;
        case 'DISMISSAL':
          return context.l10n.companyAnalyticsDismissals;
        case 'RETIREMENT':
          return context.l10n.companyAnalyticsRetirements;
        case 'DEATH':
          return context.l10n.movementDeathLabel;
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
                            context.l10n.empListPartAPreviewPageHeader(currentPage + 1, totalPages),
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
                              sectionTitle(context.l10n.empListSectionEstablishmentIdentity),
                              infoRow(context.l10n.fieldCompanyNameFullLabel, company['name']),
                              infoRow(context.l10n.companiesMainActivityLabel,
                                  company['mainActivity']),
                              infoRow(context.l10n.pdfRegionLabel, company['region']),
                              infoRow(context.l10n.pdfDepartmentLabel, company['department']),
                              infoRow(context.l10n.registerArrondissementLabel, company['subdivision']),
                              infoRow(context.l10n.companiesAddressLabel, company['address']),
                              infoRow(context.l10n.fieldFaxLabel, company['fax']),
                              infoRow(context.l10n.empListTaxNumberNiuLabel,
                                  company['taxNumber']),
                              infoRow(context.l10n.companiesCnpsNumberLabel, company['cnpsNumber']),
                              infoRow(
                                  context.l10n.declApprovalLabelSocialCapital, company['socialCapital']),
                              const Divider(height: 24),
                              sectionTitle(context.l10n.empListWorkforceCurrentYearSection),
                              infoRow(
                                  context.l10n.empListDeclaredTotalLabel, company['totalEmployees']),
                              infoRow(context.l10n.menLabel, company['menCount']),
                              infoRow(context.l10n.womenLabel, company['womenCount']),
                              sectionTitle(context.l10n.declApprovalWorkforcePreviousYearTitle),
                              infoRow(context.l10n.total, company['lastYearTotal']),
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
                                  context.l10n.empListMovementDetailByCategory),
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
                                                  context.l10n.catRange13Label, m['cat1_3'])),
                                          Expanded(
                                              child: infoRow(
                                                  context.l10n.catRange46Label, m['cat4_6'])),
                                        ]),
                                        Row(children: [
                                          Expanded(
                                              child: infoRow(
                                                  context.l10n.catRange79Label, m['cat7_9'])),
                                          Expanded(
                                              child: infoRow(
                                                  context.l10n.catRange1012Label, m['cat10_12'])),
                                        ]),
                                        infoRow(
                                            context.l10n.nonDeclaredCategoryLabel, m['catNonDeclared']),
                                      ]),
                                );
                              }),
                              const Divider(height: 24),
                              sectionTitle(context.l10n.empListQualitativeInfoSection),
                              infoRow(context.l10n.empListTrainingCenterLabelShort,
                                  yesNo(qualitative['hasTrainingCenter'])),
                              infoRow(context.l10n.empListRecruitmentPlansNextLabel,
                                  yesNo(qualitative['recruitmentPlansNext'])),
                              infoRow(context.l10n.empListCamerounisationPlanLabel,
                                  yesNo(qualitative['camerounisationPlan'])),
                              infoRow(context.l10n.empListUsesTempAgenciesLabel,
                                  yesNo(qualitative['usesTempAgencies'])),
                              if (qualitative['tempAgencyDetails'] != null)
                                infoRow(context.l10n.empListTempAgencyDetailsLabel,
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
                        label: Text(context.l10n.previousButton),
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
                        label: Text(context.l10n.next,
                            style: const TextStyle(color: Colors.white)),
                      )
                    else
                      ElevatedButton.icon(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.teal),
                        icon: const Icon(Icons.check, color: Colors.white),
                        label: Text(context.l10n.empListConfirmAndSubmitButton,
                            style: const TextStyle(color: Colors.white)),
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
          context.l10n.empListMismatchTotalLine(actualTotal, totalFromPartA));
    }
    if (actualMen != menFromPartA) {
      mismatches
          .add(context.l10n.empListMismatchMenLine(actualMen, menFromPartA));
    }
    if (actualWomen != womenFromPartA) {
      mismatches.add(
          context.l10n.empListMismatchWomenLine(actualWomen, womenFromPartA));
    }

    if (mismatches.isNotEmpty) {
      final shouldContinue = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(context.l10n.empListWorkforceInconsistencyTitle,
              style: const TextStyle(color: Colors.orange)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.l10n.empListWorkforceMismatchIntro,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              ...mismatches.map((m) => Padding(
                    padding: const EdgeInsets.only(left: 8, bottom: 4),
                    child: Text(m, style: const TextStyle(fontSize: 14)),
                  )),
              const SizedBox(height: 16),
              const Divider(),
              Text(context.l10n.empListContinueSubmissionAnywayQuestion,
                  style: const TextStyle(fontWeight: FontWeight.w500)),
              const SizedBox(height: 8),
              Text(
                context.l10n.empListOfficialFormExactMatchNote,
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(context.l10n.goBackButton, style: const TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
              child: Text(context.l10n.empListContinueDespiteErrorButton,
                  style: const TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
      return shouldContinue == true;
    }
    return true;
  }

  /// Shared employee/effectifs checks that gate both the plain submit
  /// flow and the "preview then confirm" flow — neither should be able
  /// to skip these by taking the other path.
  Future<bool> _validateEmployeesForSubmission() async {
    if (_employees.isEmpty) {
      _showError(context.l10n.empListAddAtLeastOneEmployeeError);
      return false;
    }

    final invalidEmployees = _employees
        .where((e) => e.fullName.trim().isEmpty || e.salary <= 0)
        .toList();

    if (invalidEmployees.isNotEmpty) {
      _showError(
          context.l10n.empListInvalidEmployeeDataError);
      return false;
    }

    final isValid = await _validateAgainstPartA();
    return isValid && mounted;
  }

  Map<String, dynamic> _buildDeclarationPayload() => {
        'company': widget.companyData,
        'year': widget.year,
        'fillingDate': widget.fillingDate ?? _getCurrentDate(),
        'movements': widget.movements,
        'qualitative': widget.qualitative,
        'employees': _employees.map((e) => e.toJson()).toList(),
        'employeeCount': _employees.length,
        'language': widget.language,
      };

  Future<void> _submitDeclaration() async {
    if (!await _validateEmployeesForSubmission()) return;
    if (!mounted) return;

    final previewConfirmed = await _showPartAPreview();
    if (!previewConfirmed || !mounted) return;

    await _postDeclaration(_buildDeclarationPayload());
  }

  /// Fetches a real, rendered preview of the declaration PDF (no data is
  /// persisted server-side yet) and shows it in the same PDF viewer used
  /// by ONEFOP, so the company can see the actual document — not just a
  /// textual summary — before deciding to submit.
  Future<void> _previewGeneratedPdf() async {
    if (!await _validateEmployeesForSubmission()) return;
    if (!mounted) return;

    final payload = _buildDeclarationPayload();
    setState(() => _isLoading = true);
    Uint8List bytes;
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.dio.post<List<int>>(
        '/dsmo/declaration/preview',
        data: payload,
        options: Options(responseType: ResponseType.bytes),
      );
      bytes = Uint8List.fromList(response.data!);
    } catch (e) {
      if (mounted) _showError(context.l10n.empListPreviewGenerationError(e.toString()));
      return;
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
    if (!mounted) return;

    final fileName = 'dsmo_apercu_${DateTime.now().millisecondsSinceEpoch}.pdf';
    Future<void> onConfirm() async {
      Navigator.pop(context);
      await _postDeclaration(payload);
    }

    if (kIsWeb) {
      PdfCache.currentPdfBytes = bytes;
      PdfCache.currentPdfName = fileName;
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => PdfViewerScreen(pdfPath: fileName, onConfirm: onConfirm),
        ),
      );
    } else {
      final tempDir = await getTemporaryDirectory();
      final file = File('${tempDir.path}/$fileName');
      await file.writeAsBytes(bytes);
      if (!mounted) return;
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => PdfViewerScreen(pdfPath: file.path, onConfirm: onConfirm),
        ),
      );
    }
  }

  Future<void> _postDeclaration(Map<String, dynamic> payload) async {
    setState(() => _isLoading = true);

    try {
      final api = ref.read(apiClientProvider);
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
                context.l10n.empListDefaultDeadlineFallback(widget.year + 1),
          );
        } else {
          await _showSimpleSuccessDialog();
        }
        if (mounted) Navigator.popUntil(context, (route) => route.isFirst);
      } else if (response.statusCode != 201 && mounted) {
        await _showSubmissionError(
            context.l10n.empListSubmissionHttpError('${response.statusCode}', '${response.data ?? ''}'));
      }
    } on ApiException catch (e) {
      // A null statusCode means the request never reached the server
      // (connection timeout/error) — a genuine connectivity problem, not a
      // rejection. Queue it durably instead of discarding the user's data.
      if (e.statusCode == null) {
        await ref.read(syncQueueServiceProvider).enqueue(
              method: 'post',
              path: '/dsmo/declaration',
              payload: payload,
              label:
                  context.l10n.empListQueuedDeclarationLabel(widget.year, '${widget.companyData['companyName'] ?? widget.companyData['name'] ?? ''}'),
            );
        final count = await ref.read(syncQueueServiceProvider).pendingCount();
        if (mounted) {
          ref.read(pendingSubmissionCountProvider.notifier).state = count;
          await _employeeBox.clear();
          ref.read(employeeListProvider.notifier).state = [];
          await _showQueuedDialog();
          if (mounted) Navigator.popUntil(context, (route) => route.isFirst);
        }
      } else if (mounted) {
        await _showSubmissionError(e.message);
      }
    } catch (e) {
      if (mounted) await _showSubmissionError(e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _showQueuedDialog() async {
    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(children: [
          const Icon(Icons.cloud_off, color: Colors.orange),
          const SizedBox(width: 8),
          Text(context.l10n.connectionUnavailableTitle, style: const TextStyle(color: Colors.orange)),
        ]),
        content: Text(
          context.l10n.empListQueuedOfflineFullMsg,
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.teal),
            child: Text(context.l10n.okButton),
          ),
        ],
      ),
    );
  }

  Future<void> _showPdfSuccessDialog({
    required String declarationId,
    required String trackingNumber,
    required String deadline,
  }) async {
    final copyNames = [
      context.l10n.pdfCopyOriginalLabel,
      context.l10n.pdfCopyDuplicateLabel,
      context.l10n.pdfCopyTriplicateLabel
    ];

    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(children: [
          const Icon(Icons.check_circle, color: Colors.green),
          const SizedBox(width: 8),
          Text(context.l10n.empListDeclarationSavedTitle,
              style: const TextStyle(color: Colors.green)),
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
                    child: Text(context.l10n.empListTrackingNumberLine(trackingNumber),
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ]),
              ),
              const SizedBox(height: 16),
              Text(context.l10n.empListThreePdfCopiesAvailable),
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
                      tooltip: context.l10n.printDownloadTooltip,
                      onPressed: () =>
                          _downloadAndPrintPdf(declarationId, i + 1),
                    ),
                    onTap: () => _downloadAndPrintPdf(declarationId, i + 1),
                  ),
                ),
              ),
              const Divider(height: 24),
              Text(context.l10n.empListMandatoryProcedureTitle,
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(context.l10n.empListProcStepPrintCopies),
              Text(context.l10n.empListProcStepSignCopies),
              Text(context.l10n.empListProcStepAddCompanyStamp),
              Text(context.l10n.empListProcStepSendByRegisteredMail(deadline)),
              Text(context.l10n.empListProcStepEmploymentOffice),
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
                  Expanded(
                    child: Text(
                      context.l10n.empListLawComplianceNoteFull,
                      style: const TextStyle(fontSize: 11),
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
        title: Text(context.l10n.successTitle, style: const TextStyle(color: Colors.green)),
        content: Text(
          context.l10n.empListSimpleSuccessMsg,
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
        title: Row(children: [
          const Icon(Icons.error_outline, color: Colors.red),
          const SizedBox(width: 8),
          Text(context.l10n.empListSubmissionFailedTitle, style: const TextStyle(color: Colors.red)),
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
        title: Text(context.l10n.empListAppBarTitle),
        backgroundColor: Colors.teal,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.download),
            onPressed: _employees.isEmpty ? null : _exportToExcel,
            tooltip: context.l10n.exportExcelTooltip,
          ),
          IconButton(
            icon: const Icon(Icons.upload_file),
            onPressed: _importEmployees,
            tooltip: context.l10n.importExcelTooltip,
          ),
          IconButton(
            icon: const Icon(Icons.fact_check_outlined),
            onPressed: _previewPdf,
            tooltip: context.l10n.previewPartATooltip,
          ),
          IconButton(
            icon: const Icon(Icons.picture_as_pdf),
            onPressed: _employees.isEmpty || _isLoading
                ? null
                : _previewGeneratedPdf,
            tooltip: context.l10n.previewPdfTooltipLong,
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
                    Text(context.l10n.empListRegisteredEmployeesLabel,
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
                child: Text(context.l10n.empListInconsistencyBadge,
                    style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Colors.white)),
              ),
          ]),
        ),
        Expanded(
          child: _employees.isEmpty
              ? Center(
                  child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.people_outline,
                            size: 80, color: Colors.grey),
                        const SizedBox(height: 16),
                        Text(
                            context.l10n.empListEmptyStateMsg,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.grey)),
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
                      columns: [
                        DataColumn(
                            label: Text(context.l10n.empListColNumero,
                                style: const TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text(context.l10n.empListFullNameStepLabel,
                                style: const TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text(context.l10n.empListGenderStepLabel,
                                style: const TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text(context.l10n.empListAgeStepLabel,
                                style: const TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text(context.l10n.empListNationalityStepLabel,
                                style: const TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text(context.l10n.excelColDiploma,
                                style: const TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text(context.l10n.registerFunctionRowLabel,
                                style: const TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text(context.l10n.empListColSeniority,
                                style: const TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text(context.l10n.companyAnalyticsCategoryHeader,
                                style: const TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text(context.l10n.excelColSalary,
                                style: const TextStyle(fontWeight: FontWeight.bold))),
                        DataColumn(
                            label: Text(context.l10n.regionsSectorsActionsColumnHeader,
                                style: const TextStyle(fontWeight: FontWeight.bold))),
                      ],
                      rows: List.generate(_employees.length, (index) {
                        final emp = _employees[index];
                        final catDisplay = emp.salaryCategory == 'non-declared'
                            ? context.l10n.notDeclaredAbbrev
                            : context.l10n.categoryNumberLabel(emp.salaryCategory);
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
                            DataCell(Text(context.l10n.ageYearsValue(emp.age))),
                            DataCell(Text(emp.nationality == 'Cameroonian'
                                ? context.l10n.nationalityCameroonianOption
                                : emp.otherCountry ?? context.l10n.nationalityForeignOption)),
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
                                context.l10n.seniorityYearsValue(emp.seniority))),
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
        label: Text(context.l10n.empListAddEmployeeFabLabel),
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
                  : Text(context.l10n.companyRegSubmitButton,
                      style: const TextStyle(
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
