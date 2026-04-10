import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'employee_list_screen.dart';
import '../../../data/api_client.dart';

// Persists chosen language across the session
final languageProvider = StateProvider<String>((ref) => 'fr');

class DeclarationWizardScreen extends ConsumerStatefulWidget {
  const DeclarationWizardScreen({super.key});

  @override
  ConsumerState<DeclarationWizardScreen> createState() =>
      _DeclarationWizardScreenState();
}

class _DeclarationWizardScreenState
    extends ConsumerState<DeclarationWizardScreen> {
  int _currentStep = 0;

  bool _isLoadingRegions = true;
  bool _isLoadingDepartments = false;
  bool _isLoadingSubdivisions = false;
  bool _isLoadingSectors = true;

  final _step1FormKey = GlobalKey<FormState>();
  final _step2FormKey = GlobalKey<FormState>();

  int _budgetYear = DateTime.now().year;
  DateTime _fillingDate = DateTime.now();

  final _nameController = TextEditingController();
  final _parentCompanyController = TextEditingController();
  final _secondaryActivityController = TextEditingController();
  final _addressController = TextEditingController();
  final _faxController = TextEditingController();
  final _taxNumberController = TextEditingController();
  final _cnpsController = TextEditingController();
  final _capitalController = TextEditingController();

  List<dynamic> _regions = [];
  List<dynamic> _departments = [];
  List<dynamic> _subdivisions = [];
  List<dynamic> _sectors = [];

  String? _selectedRegionId;
  String? _selectedRegionName;
  String? _selectedDepartmentId;
  String? _selectedDepartmentName;
  String? _selectedSubdivisionId;
  String? _selectedSubdivisionName;
  String? _selectedSectorId;
  String? _selectedSectorName;

  final _totalEmp = TextEditingController();
  final _menCount = TextEditingController();
  final _womenCount = TextEditingController();
  final _lastYearTotal = TextEditingController();
  final _lastYearMen = TextEditingController();
  final _lastYearWomen = TextEditingController();

  // 5 movement types × 5 categories (1_3, 4_6, 7_9, 10_12, nd = Non Déclaré)
  final Map<String, TextEditingController> _movements = {
    'rec_1_3': TextEditingController(text: '0'),
    'rec_4_6': TextEditingController(text: '0'),
    'rec_7_9': TextEditingController(text: '0'),
    'rec_10_12': TextEditingController(text: '0'),
    'rec_nd': TextEditingController(text: '0'),
    'pro_1_3': TextEditingController(text: '0'),
    'pro_4_6': TextEditingController(text: '0'),
    'pro_7_9': TextEditingController(text: '0'),
    'pro_10_12': TextEditingController(text: '0'),
    'pro_nd': TextEditingController(text: '0'),
    'lic_1_3': TextEditingController(text: '0'),
    'lic_4_6': TextEditingController(text: '0'),
    'lic_7_9': TextEditingController(text: '0'),
    'lic_10_12': TextEditingController(text: '0'),
    'lic_nd': TextEditingController(text: '0'),
    'ret_1_3': TextEditingController(text: '0'),
    'ret_4_6': TextEditingController(text: '0'),
    'ret_7_9': TextEditingController(text: '0'),
    'ret_10_12': TextEditingController(text: '0'),
    'ret_nd': TextEditingController(text: '0'),
    'dec_1_3': TextEditingController(text: '0'),
    'dec_4_6': TextEditingController(text: '0'),
    'dec_7_9': TextEditingController(text: '0'),
    'dec_10_12': TextEditingController(text: '0'),
    'dec_nd': TextEditingController(text: '0'),
  };

  bool _hasTrainingCenter = false;
  bool _recruitmentPlansNext = false;
  bool _camerounisationPlan = false;
  bool _usesTempAgencies = false;
  final _tempAgencyDetailsCtrl = TextEditingController();

  Map<String, dynamic>? _companyData;
  Map<String, dynamic>? _savedCompany; // profile fetched from /dsmo/company

  @override
  void initState() {
    super.initState();
    _fetchSectors();
    _fetchRegionsAndAutoFill(); // loads regions then cascades auto-fill
    _menCount.addListener(_autoCalcCurrentTotal);
    _womenCount.addListener(_autoCalcCurrentTotal);
    _lastYearMen.addListener(_autoCalcLastYearTotal);
    _lastYearWomen.addListener(_autoCalcLastYearTotal);
    for (final c in _movements.values) {
      c.addListener(_onMovementChanged);
    }
  }

  // ── Auto-calculation helpers ───────────────────────────────────────────────

  void _autoCalcCurrentTotal() {
    final men = int.tryParse(_menCount.text) ?? 0;
    final women = int.tryParse(_womenCount.text) ?? 0;
    final newTotal = (men + women).toString();
    if (_totalEmp.text != newTotal) {
      _totalEmp.text = newTotal;
      _totalEmp.selection =
          TextSelection.collapsed(offset: _totalEmp.text.length);
    }
  }

  void _autoCalcLastYearTotal() {
    if (_lastYearMen.text.isEmpty && _lastYearWomen.text.isEmpty) return;
    final men = int.tryParse(_lastYearMen.text) ?? 0;
    final women = int.tryParse(_lastYearWomen.text) ?? 0;
    final newTotal = (men + women).toString();
    if (_lastYearTotal.text != newTotal) {
      _lastYearTotal.text = newTotal;
    }
  }

  void _onMovementChanged() {
    if (mounted) setState(() {});
  }

  // ── Movement total helpers ─────────────────────────────────────────────────

  int _movRowTotal(String prefix) => ['1_3', '4_6', '7_9', '10_12', 'nd'].fold(
      0, (s, k) => s + (int.tryParse(_movements['${prefix}_$k']!.text) ?? 0));

  int _movColTotal(String suffix) => ['rec', 'pro', 'lic', 'ret', 'dec'].fold(
      0, (s, p) => s + (int.tryParse(_movements['${p}_$suffix']!.text) ?? 0));

  int _movGrandTotal() =>
      _movements.values.fold(0, (s, c) => s + (int.tryParse(c.text) ?? 0));

  /// Fetches regions and the company profile in parallel, then cascades
  /// auto-fill: region → department → subdivision.
  Future<void> _fetchRegionsAndAutoFill() async {
    setState(() => _isLoadingRegions = true);
    try {
      final api = ref.read(apiClientProvider);
      final results = await Future.wait([
        api.getRegions(),
        api.getMyCompany(),
      ]);

      final regions = results[0] as List<dynamic>;
      final company = results[1] as Map<String, dynamic>?;

      if (!mounted) return;

      setState(() {
        _regions = regions;
        _isLoadingRegions = false;
        _savedCompany = company;
      });

      if (company != null) {
        _prefillTextFields(company);
        _autoSelectSector(company['mainActivity'] as String?);
        await _autoSelectRegion(company['region'] as String?, regions);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingRegions = false);
        _showError('Erreur chargement régions: $e');
      }
    }
  }

  /// Tries to auto-select the sector. Called after both sectors and company are loaded.
  void _autoSelectSector(String? activityName) {
    if (activityName == null || activityName.isEmpty || _sectors.isEmpty) return;
    final match = _sectors.cast<Map<String, dynamic>>().where(
      (s) => (s['name'] as String?)?.toLowerCase() == activityName.toLowerCase(),
    ).firstOrNull;
    if (match != null && mounted) {
      setState(() {
        _selectedSectorId   = match['id'] as String?;
        _selectedSectorName = match['name'] as String?;
      });
    }
  }

  /// Pre-fills all text controllers from the saved company profile.
  void _prefillTextFields(Map<String, dynamic> c) {
    _nameController.text        = c['name'] as String? ?? '';
    _parentCompanyController.text = c['parentCompany'] as String? ?? '';
    _addressController.text     = c['address'] as String? ?? '';
    _faxController.text         = c['fax'] as String? ?? '';
    _taxNumberController.text   = c['taxNumber'] as String? ?? '';
    _cnpsController.text        = c['cnpsNumber'] as String? ?? '';
    if (c['socialCapital'] != null) {
      _capitalController.text   = '${c['socialCapital']}';
    }
    // Workforce from last registration — editable before submit
    if (c['totalEmployees'] != null) {
      _totalEmp.text  = '${c['totalEmployees']}';
    }
    if (c['menCount'] != null)   _menCount.text   = '${c['menCount']}';
    if (c['womenCount'] != null) _womenCount.text = '${c['womenCount']}';
    if (c['lastYearTotal'] != null) {
      _lastYearTotal.text = '${c['lastYearTotal']}';
    }
  }

  /// Finds the region by name in the loaded list and triggers the cascade.
  Future<void> _autoSelectRegion(String? regionName, List<dynamic> regions) async {
    if (regionName == null || regionName.isEmpty) return;
    final match = regions.cast<Map<String, dynamic>>().where(
      (r) => (r['name'] as String?)?.toLowerCase() == regionName.toLowerCase(),
    ).firstOrNull;
    if (match == null) return;

    setState(() {
      _selectedRegionId   = match['id'] as String?;
      _selectedRegionName = match['name'] as String?;
    });

    if (_selectedRegionId != null) {
      await _fetchDepartmentsAndAutoSelect(
        _selectedRegionId!,
        _savedCompany?['department'] as String?,
      );
    }
  }

  /// Loads departments for the region, auto-selects by name, then loads subdivisions.
  Future<void> _fetchDepartmentsAndAutoSelect(
      String regionId, String? deptName) async {
    setState(() {
      _isLoadingDepartments = true;
      _departments = [];
      _selectedDepartmentId = null;
      _selectedDepartmentName = null;
      _subdivisions = [];
      _selectedSubdivisionId = null;
      _selectedSubdivisionName = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final departments = await api.getDepartments(regionId);
      if (!mounted) return;
      setState(() {
        _departments = departments;
        _isLoadingDepartments = false;
      });

      if (deptName != null && deptName.isNotEmpty) {
        final match = departments.cast<Map<String, dynamic>>().where(
          (d) => (d['name'] as String?)?.toLowerCase() == deptName.toLowerCase(),
        ).firstOrNull;
        if (match != null) {
          setState(() {
            _selectedDepartmentId   = match['id'] as String?;
            _selectedDepartmentName = match['name'] as String?;
          });
          if (_selectedDepartmentId != null) {
            await _fetchSubdivisionsAndAutoSelect(
              _selectedDepartmentId!,
              _savedCompany?['district'] as String?,
            );
          }
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingDepartments = false);
        _showError('Erreur chargement départements: $e');
      }
    }
  }

  /// Loads subdivisions for the department and auto-selects by name.
  Future<void> _fetchSubdivisionsAndAutoSelect(
      String departmentId, String? districtName) async {
    setState(() {
      _isLoadingSubdivisions = true;
      _subdivisions = [];
      _selectedSubdivisionId = null;
      _selectedSubdivisionName = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final subdivisions = await api.getSubdivisions(departmentId);
      if (!mounted) return;
      setState(() {
        _subdivisions = subdivisions;
        _isLoadingSubdivisions = false;
      });

      if (districtName != null && districtName.isNotEmpty) {
        final match = subdivisions.cast<Map<String, dynamic>>().where(
          (s) => (s['name'] as String?)?.toLowerCase() == districtName.toLowerCase(),
        ).firstOrNull;
        if (match != null) {
          setState(() {
            _selectedSubdivisionId   = match['id'] as String?;
            _selectedSubdivisionName = match['name'] as String?;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingSubdivisions = false);
        _showError('Erreur chargement arrondissements: $e');
      }
    }
  }

  Future<void> _fetchDepartments(String regionId) async {
    setState(() {
      _isLoadingDepartments = true;
      _departments = [];
      _selectedDepartmentId = null;
      _selectedDepartmentName = null;
      _subdivisions = [];
      _selectedSubdivisionId = null;
      _selectedSubdivisionName = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final departments = await api.getDepartments(regionId);
      if (mounted) {
        setState(() {
          _departments = departments;
          _isLoadingDepartments = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingDepartments = false);
        _showError('Erreur chargement départements: $e');
      }
    }
  }

  Future<void> _fetchSubdivisions(String departmentId) async {
    setState(() {
      _isLoadingSubdivisions = true;
      _subdivisions = [];
      _selectedSubdivisionId = null;
      _selectedSubdivisionName = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final subdivisions = await api.getSubdivisions(departmentId);
      if (mounted) {
        setState(() {
          _subdivisions = subdivisions;
          _isLoadingSubdivisions = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingSubdivisions = false);
        _showError('Erreur chargement arrondissements: $e');
      }
    }
  }

  Future<void> _fetchSectors() async {
    setState(() => _isLoadingSectors = true);
    try {
      final api = ref.read(apiClientProvider);
      final sectors = await api.getSectors();
      if (!mounted) return;
      setState(() {
        _sectors = sectors;
        _isLoadingSectors = false;
      });
      // Auto-select if company profile is already loaded (parallel race won)
      if (_savedCompany != null) {
        _autoSelectSector(_savedCompany!['mainActivity'] as String?);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingSectors = false);
        _showError('Erreur chargement secteurs: $e');
      }
    }
  }

  void _showError(String msg) => ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.red),
      );

  void _showWarning(String msg) => ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.orange),
      );

  String? _validateGenderSum(String? value) {
    final total = int.tryParse(_totalEmp.text) ?? 0;
    final men = int.tryParse(_menCount.text) ?? 0;
    final women = int.tryParse(_womenCount.text) ?? 0;
    if (total > 0 && total != (men + women)) return 'Total ≠ H + F';
    return null;
  }

  bool _validateMovements() =>
      _movements.values.any((c) => (int.tryParse(c.text) ?? 0) > 0);

  void _saveStep1() {
    if (!_step1FormKey.currentState!.validate()) {
      _showError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (_selectedSectorId == null) {
      _showError('Veuillez sélectionner un secteur socioprofessionnel');
      return;
    }
    if (_selectedRegionId == null) {
      _showError('Veuillez sélectionner une région');
      return;
    }
    if (_selectedDepartmentId == null) {
      _showError('Veuillez sélectionner un département');
      return;
    }
    if (_selectedSubdivisionId == null) {
      _showError('Veuillez sélectionner un arrondissement');
      return;
    }

    setState(() {
      _companyData = {
        'name': _nameController.text.trim(),
        'parentCompany': _parentCompanyController.text.trim().isNotEmpty
            ? _parentCompanyController.text.trim()
            : null,
        'mainActivity': _selectedSectorName,
        'secondaryActivity': _secondaryActivityController.text.trim().isNotEmpty
            ? _secondaryActivityController.text.trim()
            : null,
        'region': _selectedRegionName,
        'department': _selectedDepartmentName,
        'district': _selectedSubdivisionName,
        'address': _addressController.text.trim(),
        'fax': _faxController.text.trim().isNotEmpty
            ? _faxController.text.trim()
            : null,
        'taxNumber': _taxNumberController.text.trim(),
        'cnpsNumber': _cnpsController.text.trim().isNotEmpty
            ? _cnpsController.text.trim()
            : null,
        'socialCapital': _capitalController.text.trim().isNotEmpty
            ? int.tryParse(_capitalController.text.trim())
            : null,
      };
      _currentStep = 1;
    });
  }

  void _saveStep2() {
    if (!_step2FormKey.currentState!.validate()) {
      _showError('Veuillez vérifier les effectifs');
      return;
    }
    // Total is auto-calculated; guard against empty (e.g. men+women both blank)
    if ((int.tryParse(_totalEmp.text) ?? 0) <= 0) {
      _showError('Le total des employés doit être supérieur à 0');
      return;
    }
    if (!_validateMovements()) {
      _showWarning('Aucun mouvement saisi. Vérifiez vos données.');
    }
    setState(() => _currentStep = 2);
  }

  void _saveStep3AndGoToEmployees() {
    final language = ref.read(languageProvider);

    final companyData = {
      ...?_companyData,
      'totalEmployees': int.parse(_totalEmp.text),
      'menCount': _menCount.text.isNotEmpty ? int.parse(_menCount.text) : null,
      'womenCount':
          _womenCount.text.isNotEmpty ? int.parse(_womenCount.text) : null,
      'lastYearTotal': _lastYearTotal.text.isNotEmpty
          ? int.parse(_lastYearTotal.text)
          : null,
      'lastYearMenCount':
          _lastYearMen.text.isNotEmpty ? int.parse(_lastYearMen.text) : null,
      'lastYearWomenCount': _lastYearWomen.text.isNotEmpty
          ? int.parse(_lastYearWomen.text)
          : null,
    };

    // Build movement payloads including catNonDeclared
    final movements = [
      _buildMovementPayload('RECRUITMENT', 'rec'),
      _buildMovementPayload('PROMOTION', 'pro'),
      _buildMovementPayload('DISMISSAL', 'lic'),
      _buildMovementPayload('RETIREMENT', 'ret'),
      _buildMovementPayload('DEATH', 'dec'),
    ];

    final qualitative = {
      'hasTrainingCenter': _hasTrainingCenter,
      'recruitmentPlansNext': _recruitmentPlansNext,
      'camerounisationPlan': _camerounisationPlan,
      'usesTempAgencies': _usesTempAgencies,
      'tempAgencyDetails':
          _usesTempAgencies ? _tempAgencyDetailsCtrl.text.trim() : null,
    };

    if (mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => EmployeeListScreen(
            companyData: companyData,
            year: _budgetYear,
            fillingDate: _fillingDate.toIso8601String(),
            movements: movements,
            qualitative: qualitative,
            language: language,
            totalEmployees: int.tryParse(_totalEmp.text) ?? 0,
          ),
        ),
      );
    }
  }

  // Builds movement payload including catNonDeclared
  Map<String, dynamic> _buildMovementPayload(String type, String prefix) => {
        'movementType': type,
        'cat1_3': int.tryParse(_movements['${prefix}_1_3']!.text) ?? 0,
        'cat4_6': int.tryParse(_movements['${prefix}_4_6']!.text) ?? 0,
        'cat7_9': int.tryParse(_movements['${prefix}_7_9']!.text) ?? 0,
        'cat10_12': int.tryParse(_movements['${prefix}_10_12']!.text) ?? 0,
        'catNonDeclared': int.tryParse(_movements['${prefix}_nd']!.text) ?? 0,
      };

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(languageProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Déclaration DSMO'),
        backgroundColor: Colors.teal,
        foregroundColor: Colors.white,
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: ToggleButtons(
              borderRadius: BorderRadius.circular(8),
              isSelected: [language == 'fr', language == 'en'],
              onPressed: (i) => ref.read(languageProvider.notifier).state =
                  i == 0 ? 'fr' : 'en',
              color: Colors.white70,
              selectedColor: Colors.white,
              fillColor: Colors.teal.shade700,
              borderColor: Colors.white30,
              selectedBorderColor: Colors.white,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 32),
              children: const [Text('FR'), Text('EN')],
            ),
          ),
        ],
      ),
      body: Stepper(
        currentStep: _currentStep,
        onStepContinue: _currentStep == 0
            ? _saveStep1
            : _currentStep == 1
                ? _saveStep2
                : _saveStep3AndGoToEmployees,
        onStepCancel:
            _currentStep == 0 ? null : () => setState(() => _currentStep -= 1),
        steps: [
          Step(
            title: const Text("1. Identité de l'établissement"),
            content: Form(
              key: _step1FormKey,
              child: SingleChildScrollView(child: _buildIdentityStep()),
            ),
            isActive: true,
            state: _currentStep > 0 ? StepState.complete : StepState.indexed,
          ),
          Step(
            title: const Text('2. Effectifs et mouvements'),
            content: Form(
              key: _step2FormKey,
              child: _buildWorkforceStep(),
            ),
            isActive: _currentStep >= 1,
            state: _currentStep > 1 ? StepState.complete : StepState.indexed,
          ),
          Step(
            title: const Text('3. Informations supplémentaires'),
            content: _buildQualitativeStep(),
            isActive: _currentStep >= 2,
            state: StepState.indexed,
          ),
        ],
      ),
    );
  }

  Widget _buildIdentityStep() {
    final currentYear = DateTime.now().year;
    final years = List.generate(6, (i) => currentYear - 4 + i);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Row 1: Année budgétaire | Date de remplissage
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildDropdown<int>(
                label: 'Année budgétaire *',
                value: _budgetYear,
                items: years,
                onChanged: (v) =>
                    setState(() => _budgetYear = v ?? currentYear),
                displayName: (v) => v.toString(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _fillingDate,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2030),
                    );
                    if (picked != null) {
                      setState(() => _fillingDate = picked);
                    }
                  },
                  child: InputDecorator(
                    decoration: const InputDecoration(
                      labelText: 'Date de remplissage',
                      border: OutlineInputBorder(),
                      suffixIcon: Icon(Icons.calendar_today),
                    ),
                    child: Text(
                      '${_fillingDate.day.toString().padLeft(2, '0')}/'
                      '${_fillingDate.month.toString().padLeft(2, '0')}/'
                      '${_fillingDate.year}',
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),

        // Section: Identification
        _sectionHeader("Identification de l'établissement"),

        _buildTextField(
          _nameController,
          'Raison sociale *',
          isRequired: true,
          validator: (v) =>
              v == null || v.trim().isEmpty ? 'Champ requis' : null,
        ),
        _buildTextField(
          _parentCompanyController,
          "Raison sociale de l'entreprise mère (si applicable)",
        ),

        _buildCascadingDropdown(
          label: 'Activité principale / Secteur *',
          items: _sectors,
          isLoading: _isLoadingSectors,
          selectedId: _selectedSectorId,
          displayName: (item) =>
              item['name'] ?? item['label'] ?? item.toString(),
          onChanged: (id, name) => setState(() {
            _selectedSectorId = id;
            _selectedSectorName = name;
          }),
        ),
        _buildTextField(
          _secondaryActivityController,
          'Activité secondaire',
        ),

        // Section: Localisation
        _sectionHeader('Localisation'),

        _buildCascadingDropdown(
          label: 'Région *',
          items: _regions,
          isLoading: _isLoadingRegions,
          selectedId: _selectedRegionId,
          displayName: (item) =>
              item['name'] ?? item['label'] ?? item.toString(),
          onChanged: (id, name) {
            setState(() {
              _selectedRegionId = id;
              _selectedRegionName = name;
              _selectedDepartmentId = null;
              _selectedDepartmentName = null;
              _selectedSubdivisionId = null;
              _selectedSubdivisionName = null;
              _departments = [];
              _subdivisions = [];
            });
            if (id != null) _fetchDepartments(id);
          },
        ),
        _buildCascadingDropdown(
          label: 'Département *',
          items: _departments,
          isLoading: _isLoadingDepartments,
          selectedId: _selectedDepartmentId,
          displayName: (item) =>
              item['name'] ?? item['label'] ?? item.toString(),
          enabled: _selectedRegionId != null,
          hint: _selectedRegionId == null
              ? "Choisissez d'abord une région"
              : null,
          onChanged: (id, name) {
            setState(() {
              _selectedDepartmentId = id;
              _selectedDepartmentName = name;
              _selectedSubdivisionId = null;
              _selectedSubdivisionName = null;
              _subdivisions = [];
            });
            if (id != null) _fetchSubdivisions(id);
          },
        ),
        _buildCascadingDropdown(
          label: 'Arrondissement *',
          items: _subdivisions,
          isLoading: _isLoadingSubdivisions,
          selectedId: _selectedSubdivisionId,
          displayName: (item) =>
              item['name'] ?? item['label'] ?? item.toString(),
          enabled: _selectedDepartmentId != null,
          hint: _selectedDepartmentId == null
              ? "Choisissez d'abord un département"
              : null,
          onChanged: (id, name) => setState(() {
            _selectedSubdivisionId = id;
            _selectedSubdivisionName = name;
          }),
        ),

        // Section: Coordonnées administratives
        _sectionHeader('Coordonnées administratives'),

        _buildTextField(
          _addressController,
          'Adresse complète *',
          isRequired: true,
          validator: (v) =>
              v == null || v.trim().isEmpty ? 'Champ requis' : null,
        ),

        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _buildTextField(_faxController, 'Fax')),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: _buildTextField(
                _taxNumberController,
                'N° Contribuable (NIU) *',
                isRequired: true,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Champ requis' : null,
              ),
            ),
          ],
        ),

        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildTextField(
                _capitalController,
                'Capital social (XAF)',
                isNumber: true,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildTextField(
                _cnpsController,
                'N° Affiliation CNPS',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 10),
      child: Row(
        children: [
          Expanded(child: Divider(color: Colors.teal.shade200)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 12,
                color: Colors.teal.shade700,
              ),
            ),
          ),
          Expanded(child: Divider(color: Colors.teal.shade200)),
        ],
      ),
    );
  }

  Widget _buildWorkforceStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Effectifs au 31 décembre — Année en cours',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 2),
        Text(
          'Saisissez Hommes et Femmes — le Total se calcule automatiquement.',
          style: TextStyle(fontSize: 11, color: Colors.grey),
        ),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildTextField(
                _menCount,
                'Hommes *',
                isNumber: true,
                isRequired: true,
                validator: _validateGenderSum,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildTextField(
                _womenCount,
                'Femmes *',
                isNumber: true,
                isRequired: true,
                validator: _validateGenderSum,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child:
                  _buildAutoCalcField(_totalEmp, 'Total *', isRequired: true),
            ),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          'Effectifs au 31 décembre — Année précédente',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 2),
        Text(
          'Facultatif — le Total se calcule automatiquement.',
          style: TextStyle(fontSize: 11, color: Colors.grey),
        ),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildTextField(
                _lastYearMen,
                'Hommes',
                isNumber: true,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildTextField(
                _lastYearWomen,
                'Femmes',
                isNumber: true,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildAutoCalcField(_lastYearTotal, 'Total'),
            ),
          ],
        ),
        const SizedBox(height: 20),
        const Text(
          'Mouvements par catégories de salaire',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 2),
        Text(
          'Remplissez les cellules — les totaux par ligne et colonne se calculent automatiquement.',
          style: TextStyle(fontSize: 11, color: Colors.grey),
        ),
        const SizedBox(height: 10),
        _buildMovementTable(),
      ],
    );
  }

  /// Read-only styled field for auto-calculated totals.
  Widget _buildAutoCalcField(
    TextEditingController ctrl,
    String label, {
    bool isRequired = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        readOnly: true,
        keyboardType: TextInputType.number,
        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.teal),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: Colors.teal),
          border: const OutlineInputBorder(),
          enabledBorder: OutlineInputBorder(
            borderSide: BorderSide(color: Colors.teal.shade300),
          ),
          filled: true,
          fillColor: Colors.teal.shade50,
          suffixIcon: const Tooltip(
            message: 'Calculé automatiquement',
            child: Icon(
              Icons.calculate_outlined,
              color: Colors.teal,
              size: 18,
            ),
          ),
        ),
        validator: isRequired
            ? (v) {
                if (v == null || v.trim().isEmpty || v == '0') {
                  return 'Champ requis';
                }
                return null;
              }
            : null,
      ),
    );
  }

  Widget _buildQualitativeStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Informations supplémentaires',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text(
            "Votre établissement dispose-t-il d'un centre de formation ?",
            style: TextStyle(fontSize: 14),
          ),
          value: _hasTrainingCenter,
          onChanged: (v) => setState(() => _hasTrainingCenter = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text(
            "Votre établissement prévoit-il des recrutements l'année prochaine ?",
            style: TextStyle(fontSize: 14),
          ),
          value: _recruitmentPlansNext,
          onChanged: (v) => setState(() => _recruitmentPlansNext = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text(
            "Votre établissement dispose-t-il d'un plan de camerounisation ?",
            style: TextStyle(fontSize: 14),
          ),
          value: _camerounisationPlan,
          onChanged: (v) => setState(() => _camerounisationPlan = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text(
            "Votre établissement a-t-il recours aux entreprises de travail temporaire ?",
            style: TextStyle(fontSize: 14),
          ),
          value: _usesTempAgencies,
          onChanged: (v) => setState(() => _usesTempAgencies = v),
        ),
        if (_usesTempAgencies) ...[
          const SizedBox(height: 4),
          _buildTextField(
            _tempAgencyDetailsCtrl,
            "Précisez (nom(s) de(s) entreprise(s) de travail temporaire)",
          ),
        ],
      ],
    );
  }

  Widget _buildTextField(
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
        inputFormatters:
            isNumber ? [FilteringTextInputFormatter.digitsOnly] : null,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        validator: validator ??
            (v) => (isRequired && (v == null || v.trim().isEmpty))
                ? 'Champ requis'
                : null,
      ),
    );
  }

  Widget _buildDropdown<T>({
    required String label,
    required T? value,
    required List<T> items,
    required void Function(T?) onChanged,
    required String Function(T) displayName,
    bool enabled = true,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<T>(
        initialValue: value,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          enabled: enabled,
        ),
        isExpanded: true,
        items: enabled
            ? items
                .map((e) =>
                    DropdownMenuItem(value: e, child: Text(displayName(e))))
                .toList()
            : [],
        onChanged: enabled ? onChanged : null,
        validator: (v) => v == null ? 'Champ requis' : null,
      ),
    );
  }

  Widget _buildCascadingDropdown({
    required String label,
    required List<dynamic> items,
    required bool isLoading,
    required String? selectedId,
    required String Function(dynamic) displayName,
    required void Function(String? id, String? name) onChanged,
    bool enabled = true,
    String? hint,
  }) {
    final isEnabled = enabled && !isLoading;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        isExpanded: true,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          enabled: isEnabled,
        ),
        initialValue: selectedId,
        hint: isLoading
            ? const Text(
                'Chargement...',
                style: TextStyle(color: Colors.grey),
              )
            : (hint != null
                ? Text(
                    hint,
                    style: const TextStyle(color: Colors.grey),
                  )
                : const Text(
                    'Sélectionner',
                    style: TextStyle(color: Colors.grey),
                  )),
        items: isLoading
            ? null
            : items.map((item) {
                final id = item['id']?.toString() ?? item['code']?.toString();
                return DropdownMenuItem<String>(
                  value: id,
                  child: Text(displayName(item)),
                );
              }).toList(),
        onChanged: isEnabled
            ? (id) {
                final sel = items.firstWhere(
                  (item) =>
                      (item['id']?.toString() ?? item['code']?.toString()) ==
                      id,
                  orElse: () => null,
                );
                onChanged(id, sel != null ? displayName(sel) : null);
              }
            : null,
        validator: (v) =>
            (isEnabled && (v == null || v.isEmpty)) ? 'Champ requis' : null,
      ),
    );
  }

  // Movement table: 5 editable columns + auto-calculated row totals + column totals row
  Widget _buildMovementTable() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Table(
        border: TableBorder.all(color: Colors.grey.shade300),
        defaultColumnWidth: const IntrinsicColumnWidth(),
        children: [
          const TableRow(
            children: [
              _Cell('Mouvement', isHeader: true),
              _Cell('Cat. 1–3', isHeader: true),
              _Cell('Cat. 4–6', isHeader: true),
              _Cell('Cat. 7–9', isHeader: true),
              _Cell('Cat. 10–12', isHeader: true),
              _Cell('Non Déclaré', isHeader: true),
              _Cell('TOTAL', isHeader: true),
            ],
          ),
          _buildMovementRow('Recrutement', 'rec'),
          _buildMovementRow('Avancement', 'pro'),
          _buildMovementRow('Licenciement', 'lic'),
          _buildMovementRow('Retraite', 'ret'),
          _buildMovementRow('Décès', 'dec'),
          TableRow(
            children: [
              const _Cell('TOTAL', isHeader: true),
              _TotalDisplayCell(_movColTotal('1_3')),
              _TotalDisplayCell(_movColTotal('4_6')),
              _TotalDisplayCell(_movColTotal('7_9')),
              _TotalDisplayCell(_movColTotal('10_12')),
              _TotalDisplayCell(_movColTotal('nd')),
              _TotalDisplayCell(_movGrandTotal(), isGrand: true),
            ],
          ),
        ],
      ),
    );
  }

  TableRow _buildMovementRow(String label, String prefix) {
    return TableRow(
      children: [
        _Cell(label),
        _EditableCell(_movements['${prefix}_1_3']!),
        _EditableCell(_movements['${prefix}_4_6']!),
        _EditableCell(_movements['${prefix}_7_9']!),
        _EditableCell(_movements['${prefix}_10_12']!),
        _EditableCell(_movements['${prefix}_nd']!),
        _TotalDisplayCell(_movRowTotal(prefix)),
      ],
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _parentCompanyController.dispose();
    _secondaryActivityController.dispose();
    _addressController.dispose();
    _faxController.dispose();
    _taxNumberController.dispose();
    _cnpsController.dispose();
    _capitalController.dispose();
    _totalEmp.dispose();
    _menCount.dispose();
    _womenCount.dispose();
    _lastYearTotal.dispose();
    _lastYearMen.dispose();
    _lastYearWomen.dispose();
    _tempAgencyDetailsCtrl.dispose();
    for (final c in _movements.values) {
      c.dispose();
    }
    super.dispose();
  }
}

class _Cell extends StatelessWidget {
  final String text;
  final bool isHeader;
  const _Cell(this.text, {this.isHeader = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(6),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontWeight: isHeader ? FontWeight.bold : FontWeight.normal,
          fontSize: isHeader ? 12 : 13,
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
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        textAlign: TextAlign.center,
        decoration: const InputDecoration(
          isDense: true,
          border: InputBorder.none,
        ),
      ),
    );
  }
}

/// Read-only cell showing an auto-calculated total (teal = grand total).
class _TotalDisplayCell extends StatelessWidget {
  final int value;
  final bool isGrand;
  const _TotalDisplayCell(this.value, {this.isGrand = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      color: isGrand ? Colors.teal.shade100 : Colors.grey.shade100,
      child: Text(
        '$value',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontWeight: FontWeight.bold,
          fontSize: 12,
          color: isGrand ? Colors.teal.shade800 : Colors.grey.shade700,
        ),
      ),
    );
  }
}
