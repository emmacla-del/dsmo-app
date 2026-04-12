import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../data/api_client.dart';
import '../providers/auth_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/service_picker.dart';

// ─── Step indices ───────────────────────────────────────────────
const _kStepRole = 0;
const _kStepIdentity = 1;
const _kStepCompanyInfo = 2;
const _kStepService = 3;
const _kStepPosition = 4;
const _kStepAssignment = 5;
const _kStepSecurity = 6;
const _kStepReview = 7;

// ─── Lightweight position model ─────────────────────────────────
class _ServicePosition {
  final String id;
  final String title;
  final String? titleEn;
  final String positionType;
  const _ServicePosition(
      {required this.id,
      required this.title,
      this.titleEn,
      required this.positionType});
  factory _ServicePosition.fromJson(Map<String, dynamic> j) => _ServicePosition(
        id: j['id'] as String,
        title: j['title'] as String,
        titleEn: j['titleEn'] as String?,
        positionType: j['positionType'] as String,
      );
  @override
  bool operator ==(Object other) => other is _ServicePosition && other.id == id;
  @override
  int get hashCode => id.hashCode;
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with WidgetsBindingObserver {
  static const _kDraftBox = 'draftBox';
  static const _kDraftKey = 'registration_draft';
  final PageController _pageCtrl = PageController();
  final _identityKey = GlobalKey<FormState>();
  final _companyKey = GlobalKey<FormState>();
  final _securityKey = GlobalKey<FormState>();
  final FocusNode _globalFocusNode = FocusNode();
  final List<ScrollController> _stepScrollControllers =
      List.generate(8, (_) => ScrollController());

  bool _draftLoaded = false;
  String _role = '';
  bool _isMinefopUser = false;
  String _email = '';
  String _firstName = '';
  String _lastName = '';
  String _matricule = '';
  List<_ServicePosition> _positions = [];
  bool _loadingPositions = false;
  _ServicePosition? _selectedPosition;
  String _taxNumber = '';
  String _cnpsNumber = '';
  String _fax = '';
  String _address = '';
  String? _parentCompany;
  String _secondaryActivity = '';
  int? _socialCapital;
  Map<String, dynamic>? _selectedSector;
  MinefopServiceNode? _selectedMinefopService;
  Map<String, dynamic>? _selectedRegion;
  Map<String, dynamic>? _selectedDepartment;
  List<dynamic> _regions = [];
  List<dynamic> _departments = [];
  List<dynamic> _sectors = [];
  bool _loadingLocations = false;
  bool _loadingSectors = false;
  String _password = '';
  bool _obscurePw = true;
  bool _obscureConfirm = true;
  int _step = _kStepRole;
  bool _isSubmitting = false;
  Timer? _debounce;

  bool get _isCompany => _role == 'COMPANY';
  bool get _isMinefop => _isMinefopUser;

  bool get _needsAssignment {
    if (_isCompany) return true;
    if (_selectedMinefopService != null) {
      return _selectedMinefopService!.requiresRegion ||
          _selectedMinefopService!.requiresDepartment;
    }
    return false;
  }

  List<int> get _visibleSteps {
    if (_role.isEmpty && !_isMinefopUser) return [_kStepRole];
    return [
      _kStepRole,
      _kStepIdentity,
      if (_isCompany) _kStepCompanyInfo,
      if (_isMinefop) _kStepService,
      if (_isMinefop) _kStepPosition,
      if (_needsAssignment) _kStepAssignment,
      _kStepSecurity,
      _kStepReview,
    ];
  }

  int get _visibleCount => _visibleSteps.length;
  int get _currentVisibleIdx => _visibleSteps.indexOf(_step);

  // ── Lifecycle ─────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadDraft();
    _globalFocusNode.requestFocus();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _debounce?.cancel();
    _globalFocusNode.dispose();
    for (var ctrl in _stepScrollControllers) {
      ctrl.dispose();
    }
    _pageCtrl.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _saveDraft(immediate: true);
    }
  }

  // ── Draft persistence ─────────────────────────────────────────
  void _scheduleDraftSave() {
    if (_debounce?.isActive ?? false) _debounce?.cancel();
    _debounce = Timer(
        const Duration(milliseconds: 500), () => _saveDraft(immediate: true));
  }

  Future<void> _saveDraft({bool immediate = false}) async {
    if (!immediate && _debounce?.isActive == true) return;
    try {
      final box = await Hive.openBox(_kDraftBox);
      await box.put(_kDraftKey, {
        'role': _role,
        'isMinefopUser': _isMinefopUser,
        'email': _email,
        'firstName': _firstName,
        'lastName': _lastName,
        'matricule': _matricule,
        'taxNumber': _taxNumber,
        'cnpsNumber': _cnpsNumber,
        'fax': _fax,
        'address': _address,
        'parentCompany': _parentCompany,
        'secondaryActivity': _secondaryActivity,
        'socialCapital': _socialCapital,
        'selectedSector': _selectedSector,
        'selectedRegion': _selectedRegion,
        'selectedDepartment': _selectedDepartment,
        'selectedMinefopService': _selectedMinefopService != null
            ? {
                'id': _selectedMinefopService!.id,
                'code': _selectedMinefopService!.code,
                'category': _selectedMinefopService!.category,
                'level': _selectedMinefopService!.level,
                'parentCode': _selectedMinefopService!.parentCode,
                'name': _selectedMinefopService!.name,
                'nameEn': _selectedMinefopService!.nameEn,
                'acronym': _selectedMinefopService!.acronym,
                'roleMapping': _selectedMinefopService!.roleMapping,
                'requiresRegion': _selectedMinefopService!.requiresRegion,
                'requiresDepartment':
                    _selectedMinefopService!.requiresDepartment,
              }
            : null,
        'step': _step,
      });
    } catch (e) {
      debugPrint('Draft save failed: $e');
    }
  }

  Future<void> _loadDraft() async {
    try {
      final box = await Hive.openBox(_kDraftBox);
      final raw = box.get(_kDraftKey);
      if (raw == null || !mounted) return;
      final data = Map<String, dynamic>.from(raw as Map);
      if ((data['role'] as String? ?? '').isEmpty) return;
      setState(() {
        _role = data['role'] as String? ?? '';
        _isMinefopUser = data['isMinefopUser'] as bool? ?? false;
        _email = data['email'] as String? ?? '';
        _firstName = data['firstName'] as String? ?? '';
        _lastName = data['lastName'] as String? ?? '';
        _matricule = data['matricule'] as String? ?? '';
        _taxNumber = data['taxNumber'] as String? ?? '';
        _cnpsNumber = data['cnpsNumber'] as String? ?? '';
        _fax = data['fax'] as String? ?? '';
        _address = data['address'] as String? ?? '';
        _parentCompany = data['parentCompany'] as String?;
        _secondaryActivity = data['secondaryActivity'] as String? ?? '';
        _socialCapital = data['socialCapital'] as int?;
        if (data['selectedSector'] != null) {
          _selectedSector =
              Map<String, dynamic>.from(data['selectedSector'] as Map);
        }
        if (data['selectedRegion'] != null) {
          _selectedRegion =
              Map<String, dynamic>.from(data['selectedRegion'] as Map);
        }
        if (data['selectedDepartment'] != null) {
          _selectedDepartment =
              Map<String, dynamic>.from(data['selectedDepartment'] as Map);
        }
        if (data['selectedMinefopService'] != null) {
          _selectedMinefopService = MinefopServiceNode.fromJson(
              Map<String, dynamic>.from(data['selectedMinefopService'] as Map));
        }
        _step = data['step'] as int? ?? _kStepRole;
        _draftLoaded = true;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _step > _kStepRole) {
          _pageCtrl.jumpToPage(_step);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text(
                    'Brouillon restauré — vous pouvez continuer votre inscription.'),
                backgroundColor: Colors.teal,
                duration: Duration(seconds: 3)),
          );
        }
      });
    } catch (e) {
      debugPrint('Draft load failed: $e');
    }
  }

  Future<void> _clearDraft() async {
    try {
      final box = await Hive.openBox(_kDraftBox);
      await box.delete(_kDraftKey);
    } catch (e) {
      debugPrint('Draft clear failed: $e');
    }
  }

  // ── Navigation ────────────────────────────────────────────────
  void _goToStep(int step) {
    setState(() => _step = step);
    _pageCtrl.animateToPage(step,
        duration: const Duration(milliseconds: 320), curve: Curves.easeInOut);
    Future.delayed(const Duration(milliseconds: 350), () {
      if (_stepScrollControllers[step].hasClients) {
        _stepScrollControllers[step].animateTo(0,
            duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  void _next() {
    final idx = _visibleSteps.indexOf(_step);
    if (idx < _visibleSteps.length - 1) _goToStep(_visibleSteps[idx + 1]);
  }

  void _back() {
    final idx = _visibleSteps.indexOf(_step);
    if (idx > 0) {
      _goToStep(_visibleSteps[idx - 1]);
    } else {
      Navigator.pop(context);
    }
  }

  Future<void> _advance() async {
    switch (_step) {
      case _kStepRole:
        if (_role.isEmpty && !_isMinefopUser) {
          _snack('Veuillez choisir un type de compte', error: true);
          return;
        }
        _next();
        _saveDraft(immediate: true);
        break;
      case _kStepIdentity:
        if (!_identityKey.currentState!.validate()) return;
        _identityKey.currentState!.save();
        _next();
        _saveDraft(immediate: true);
        break;
      case _kStepCompanyInfo:
        if (!_companyKey.currentState!.validate()) return;
        if (_selectedSector == null) {
          _snack('Veuillez sélectionner une activité principale', error: true);
          return;
        }
        _companyKey.currentState!.save();
        _next();
        _saveDraft(immediate: true);
        break;
      case _kStepService:
        if (_selectedMinefopService == null) {
          _snack('Veuillez sélectionner votre service d\'affectation',
              error: true);
          return;
        }
        _next();
        _saveDraft(immediate: true);
        break;
      case _kStepPosition:
        if (_selectedPosition == null) {
          _snack('Veuillez sélectionner votre fonction dans ce service',
              error: true);
          return;
        }
        _next();
        _saveDraft(immediate: true);
        break;
      case _kStepAssignment:
        if (_selectedRegion == null) {
          _snack('Veuillez sélectionner une région', error: true);
          return;
        }
        if ((_isCompany || _role == 'DIVISIONAL') &&
            _selectedDepartment == null) {
          _snack('Veuillez sélectionner un département', error: true);
          return;
        }
        _next();
        _saveDraft(immediate: true);
        break;
      case _kStepSecurity:
        if (!_securityKey.currentState!.validate()) return;
        _securityKey.currentState!.save();
        _next();
        break;
      case _kStepReview:
        await _submit();
        break;
    }
  }

  // ── Data loaders ──────────────────────────────────────────────
  Future<void> _loadPositions(String serviceCode) async {
    setState(() {
      _loadingPositions = true;
      _positions = [];
      _selectedPosition = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final resp = await api.get('/minefop-services/$serviceCode/positions');
      final list = (resp.data as List)
          .map((j) => _ServicePosition.fromJson(j as Map<String, dynamic>))
          .toList();
      if (mounted) {
        setState(() {
          _positions = list;
          _loadingPositions = false;
        });
      }
    } catch (e) {
      debugPrint('❌ loadPositions error: $e');
      if (mounted) setState(() => _loadingPositions = false);
    }
  }

  Future<void> _loadRegions() async {
    if (_regions.isNotEmpty) return;
    setState(() => _loadingLocations = true);
    try {
      final data = await ref.read(apiClientProvider).getRegions();
      if (mounted) {
        setState(() {
          _regions = data;
          _loadingLocations = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingLocations = false);
    }
  }

  Future<void> _loadDepartments(String regionId) async {
    setState(() {
      _departments = [];
      _loadingLocations = true;
    });
    try {
      final data = await ref.read(apiClientProvider).getDepartments(regionId);
      if (mounted) {
        setState(() {
          _departments = data;
          _loadingLocations = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingLocations = false);
    }
  }

  Future<void> _loadSectors() async {
    if (_sectors.isNotEmpty) return;
    setState(() => _loadingSectors = true);
    try {
      final data = await ref.read(apiClientProvider).getSectors();
      if (mounted) {
        setState(() {
          _sectors = data;
          _loadingSectors = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingSectors = false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────
  Future<void> _submit() async {
    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);
    try {
      final regionName = _selectedRegion?['name'] as String?;
      final effectiveRole = _isCompany
          ? 'COMPANY'
          : (_selectedMinefopService?.roleMapping ?? 'CENTRAL');
      final needsDept = _isCompany || effectiveRole == 'DIVISIONAL';
      final deptName =
          needsDept ? (_selectedDepartment?['name'] as String?) : null;
      final poste = _isMinefop ? _selectedPosition?.title : null;

      await ref.read(authProvider.notifier).register(
            _email,
            _password,
            _firstName,
            _isCompany ? '' : _lastName,
            effectiveRole,
            region: regionName,
            department: deptName,
            matricule: _isMinefop && _matricule.isNotEmpty ? _matricule : null,
            poste: poste,
            serviceCode: _isMinefop ? _selectedMinefopService?.code : null,
          );

      final authState = ref.read(authProvider);
      if (authState is AsyncError || authState.valueOrNull == null) return;

      await _clearDraft();

      if (_isCompany && mounted) {
        try {
          await ref.read(apiClientProvider).saveCompanyProfile({
            'name': _firstName,
            'taxNumber': _taxNumber,
            'mainActivity': _selectedSector?['name'] ?? '',
            'region': regionName ?? '',
            'department': deptName ?? '',
            'address': _address,
            if (_cnpsNumber.isNotEmpty) 'cnpsNumber': _cnpsNumber,
            if (_fax.isNotEmpty) 'fax': _fax,
            if (_secondaryActivity.isNotEmpty)
              'secondaryActivity': _secondaryActivity,
            if (_parentCompany != null && _parentCompany!.isNotEmpty)
              'parentCompany': _parentCompany,
            if (_socialCapital != null) 'socialCapital': _socialCapital,
          });
        } catch (e) {
          debugPrint('Company profile save failed: $e');
        }
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _snack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? Colors.red : Colors.green));
  }

  // ── Password helpers ─────────────────────────────────────────
  double _pwStrength(String pw) {
    if (pw.isEmpty) return 0;
    double s = 0;
    if (pw.length >= 8) s += 0.25;
    if (pw.length >= 12) s += 0.15;
    if (pw.contains(RegExp(r'[A-Z]'))) s += 0.2;
    if (pw.contains(RegExp(r'[0-9]'))) s += 0.2;
    if (pw.contains(RegExp(r'[!@#\$%^&*]'))) s += 0.2;
    return s.clamp(0, 1);
  }

  Color _pwColor(double s) {
    if (s < 0.35) return Colors.red;
    if (s < 0.65) return Colors.orange;
    return Colors.green;
  }

  String _pwLabel(double s) {
    if (s < 0.35) return 'Faible';
    if (s < 0.65) return 'Moyen';
    if (s < 0.9) return 'Fort';
    return 'Très fort';
  }

  // ── Build ─────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<dynamic>>(authProvider, (_, next) {
      if (next is AsyncData && next.value != null) {
        Navigator.pushReplacementNamed(context, '/home');
      }
    });
    final authState = ref.watch(authProvider);
    final bool isBusy = _isSubmitting || authState.isLoading;

    return KeyboardListener(
      focusNode: _globalFocusNode,
      onKeyEvent: (event) {
        if (event is KeyDownEvent &&
            HardwareKeyboard.instance
                .isLogicalKeyPressed(LogicalKeyboardKey.enter) &&
            !_isSubmitting) {
          _advance();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.grey.shade50,
        body: SafeArea(
          child: Column(
            children: [
              _Header(
                currentStep: _currentVisibleIdx,
                totalSteps: _visibleCount,
                step: _step,
                isCompany: _isCompany,
                onBack: _back,
              ),
              if (authState.hasError && !isBusy)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      border: Border.all(color: Colors.red.shade200),
                      borderRadius: BorderRadius.circular(10)),
                  child: Row(children: [
                    const Icon(Icons.error_outline,
                        color: Colors.red, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(authState.error.toString(),
                            style: const TextStyle(
                                color: Colors.red, fontSize: 13))),
                  ]),
                ),
              Expanded(
                child: PageView(
                  controller: _pageCtrl,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    // 0 – Role
                    Visibility(
                      visible: _visibleSteps.contains(_kStepRole),
                      maintainState: true,
                      child: _StepRole(
                        isCompany: _isCompany,
                        isMinefop: _isMinefopUser,
                        onSelect: (isCompany) {
                          setState(() {
                            _isMinefopUser = !isCompany;
                            _role = isCompany ? 'COMPANY' : '';
                            _selectedRegion = null;
                            _selectedDepartment = null;
                            _selectedMinefopService = null;
                            _selectedPosition = null;
                            _positions = [];
                          });
                          _saveDraft(immediate: true);
                          _advance(); // <-- ONLY ADDED LINE
                        },
                        scrollController: _stepScrollControllers[_kStepRole],
                      ),
                    ),
                    // 1 – Identity
                    Visibility(
                      visible: _visibleSteps.contains(_kStepIdentity),
                      maintainState: true,
                      child: _StepIdentity(
                        key: ValueKey(_draftLoaded),
                        formKey: _identityKey,
                        isCompany: _isCompany,
                        initialFirstName: _firstName,
                        initialLastName: _lastName,
                        initialEmail: _email,
                        initialMatricule: _matricule,
                        onFirstNameChanged: (val) {
                          _firstName = val;
                          _scheduleDraftSave();
                        },
                        onLastNameChanged: (val) {
                          _lastName = val;
                          _scheduleDraftSave();
                        },
                        onEmailChanged: (val) {
                          _email = val;
                          _scheduleDraftSave();
                        },
                        onMatriculeChanged: (val) {
                          _matricule = val;
                          _scheduleDraftSave();
                        },
                        onSave: (fn, ln, em, mat) {
                          _firstName = fn;
                          _lastName = ln;
                          _email = em;
                          _matricule = mat;
                        },
                        scrollController:
                            _stepScrollControllers[_kStepIdentity],
                      ),
                    ),
                    // 2 – Company info
                    Visibility(
                      visible: _visibleSteps.contains(_kStepCompanyInfo),
                      maintainState: true,
                      child: _StepCompanyInfo(
                        key: ValueKey(_draftLoaded),
                        formKey: _companyKey,
                        sectors: _sectors,
                        loadingSectors: _loadingSectors,
                        selectedSector: _selectedSector,
                        onSectorChanged: (s) {
                          setState(() => _selectedSector = s);
                          _scheduleDraftSave();
                        },
                        initialTaxNumber: _taxNumber,
                        initialCnps: _cnpsNumber,
                        initialFax: _fax,
                        initialAddress: _address,
                        initialParentCompany: _parentCompany ?? '',
                        initialSecondaryActivity: _secondaryActivity,
                        initialCapital: _socialCapital,
                        onInit: _loadSectors,
                        onSave: (niu, cnps, fax, addr, parent, sec, cap) {
                          _taxNumber = niu;
                          _cnpsNumber = cnps;
                          _fax = fax;
                          _address = addr;
                          _parentCompany = parent.isNotEmpty ? parent : null;
                          _secondaryActivity = sec;
                          _socialCapital = cap;
                          _scheduleDraftSave();
                        },
                        scrollController:
                            _stepScrollControllers[_kStepCompanyInfo],
                      ),
                    ),
                    // 3 – Service picker (MINEFOP) – NO extra SingleChildScrollView
                    Visibility(
                      visible: _visibleSteps.contains(_kStepService),
                      maintainState: true,
                      child: ServicePicker(
                        initialValue: _selectedMinefopService,
                        onSelected: (node) {
                          setState(() {
                            _selectedMinefopService = node;
                            _role = node.roleMapping;
                            _selectedPosition = null;
                            _positions = [];
                            if (!node.requiresRegion &&
                                !node.requiresDepartment) {
                              _selectedRegion = null;
                              _selectedDepartment = null;
                            }
                          });
                          _loadPositions(node.code);
                          _saveDraft(immediate: true);
                        },
                      ),
                    ),
                    // 4 – Position (MINEFOP)
                    Visibility(
                      visible: _visibleSteps.contains(_kStepPosition),
                      maintainState: true,
                      child: _StepPosition(
                        positions: _positions,
                        loading: _loadingPositions,
                        selected: _selectedPosition,
                        serviceName: _selectedMinefopService?.name,
                        onChanged: (p) {
                          setState(() => _selectedPosition = p);
                          _scheduleDraftSave();
                        },
                        scrollController:
                            _stepScrollControllers[_kStepPosition],
                      ),
                    ),
                    // 5 – Assignment
                    Visibility(
                      visible: _visibleSteps.contains(_kStepAssignment),
                      maintainState: true,
                      child: _StepAssignment(
                        role: _role,
                        regions: _regions,
                        departments: _departments,
                        loadingLocations: _loadingLocations,
                        selectedRegion: _selectedRegion,
                        selectedDepartment: _selectedDepartment,
                        onRegionChanged: (r) {
                          setState(() {
                            _selectedRegion = r;
                            _selectedDepartment = null;
                            _departments = [];
                          });
                          if (r != null) _loadDepartments(r['id'] as String);
                          _scheduleDraftSave();
                        },
                        onDepartmentChanged: (d) {
                          setState(() => _selectedDepartment = d);
                          _scheduleDraftSave();
                        },
                        onInit: _loadRegions,
                        scrollController:
                            _stepScrollControllers[_kStepAssignment],
                      ),
                    ),
                    // 6 – Security
                    Visibility(
                      visible: _visibleSteps.contains(_kStepSecurity),
                      maintainState: true,
                      child: _StepSecurity(
                        formKey: _securityKey,
                        initialPassword: _password,
                        obscurePw: _obscurePw,
                        obscureConfirm: _obscureConfirm,
                        onTogglePw: () =>
                            setState(() => _obscurePw = !_obscurePw),
                        onToggleConfirm: () =>
                            setState(() => _obscureConfirm = !_obscureConfirm),
                        onSave: (pw, _) {
                          _password = pw;
                          _scheduleDraftSave();
                        },
                        strengthOf: _pwStrength,
                        strengthColor: _pwColor,
                        strengthLabel: _pwLabel,
                        scrollController:
                            _stepScrollControllers[_kStepSecurity],
                      ),
                    ),
                    // 7 – Review
                    Visibility(
                      visible: _visibleSteps.contains(_kStepReview),
                      maintainState: true,
                      child: _StepReview(
                        role: _role,
                        isMinefop: _isMinefopUser,
                        firstName: _firstName,
                        lastName: _lastName,
                        email: _email,
                        taxNumber: _taxNumber,
                        cnpsNumber: _cnpsNumber,
                        mainActivity: _selectedSector?['name'] as String? ?? '',
                        secondaryActivity: _secondaryActivity,
                        address: _address,
                        selectedRegion: _selectedRegion,
                        selectedDepartment: _selectedDepartment,
                        serviceName: _selectedMinefopService?.name,
                        positionTitle: _selectedPosition?.title,
                        scrollController: _stepScrollControllers[_kStepReview],
                      ),
                    ),
                  ],
                ),
              ),
              // Sticky button
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                child: SafeArea(
                  top: false,
                  child: SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton(
                      onPressed: isBusy ? null : _advance,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.deepEmerald,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                        elevation: 2,
                      ),
                      child: Text(
                          _step == _kStepReview
                              ? 'Créer mon compte'
                              : 'Continuer',
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Header
// ═══════════════════════════════════════════════════════════════════════════

class _Header extends StatelessWidget {
  final int currentStep;
  final int totalSteps;
  final int step;
  final bool isCompany;
  final VoidCallback onBack;

  const _Header({
    required this.currentStep,
    required this.totalSteps,
    required this.step,
    required this.isCompany,
    required this.onBack,
  });

  String get _title {
    switch (step) {
      case _kStepRole:
        return 'Type de compte';
      case _kStepIdentity:
        return isCompany ? 'Identification' : 'Informations personnelles';
      case _kStepCompanyInfo:
        return 'Informations de l\'entreprise';
      case _kStepService:
        return 'Service d\'affectation';
      case _kStepPosition:
        return 'Fonction / Rôle';
      case _kStepAssignment:
        return isCompany ? 'Localisation' : 'Zone d\'affectation';
      case _kStepSecurity:
        return 'Sécurité';
      case _kStepReview:
        return 'Récapitulatif';
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final progress = totalSteps > 1 ? currentStep / (totalSteps - 1) : 1.0;
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(8, 12, 20, 16),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, size: 18),
            onPressed: onBack,
            color: AppColors.deepEmerald,
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(_title,
                        style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: AppColors.deepEmerald)),
                    Text('${currentStep + 1} / $totalSteps',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.slate)),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 5,
                    backgroundColor: Colors.grey.shade200,
                    color: AppColors.deepEmerald,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 0 — Role selection
// ═══════════════════════════════════════════════════════════════════════════

class _StepRole extends StatelessWidget {
  final bool isCompany;
  final bool isMinefop;
  final ValueChanged<bool> onSelect;
  final ScrollController? scrollController;

  const _StepRole({
    required this.isCompany,
    required this.isMinefop,
    required this.onSelect,
    this.scrollController,
  });

  @override
  Widget build(BuildContext context) {
    final companySelected = isCompany;
    final minefopSelected = isMinefop;

    return SingleChildScrollView(
      controller: scrollController,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Créer un compte',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text(
            'Sélectionnez votre profil pour commencer.',
            style: TextStyle(color: AppColors.slate, fontSize: 14),
          ),
          const SizedBox(height: 32),
          _RoleCard(
            value: 'COMPANY',
            selected: companySelected ? 'COMPANY' : '',
            icon: Icons.business_outlined,
            color: Colors.teal,
            title: 'Entreprise',
            subtitle:
                'Société soumise à la déclaration annuelle des mouvements d\'emploi (DSMO).',
            onTap: (_) => onSelect(true),
          ),
          const SizedBox(height: 16),
          _RoleCard(
            value: 'MINEFOP',
            selected: minefopSelected ? 'MINEFOP' : '',
            icon: Icons.account_balance_outlined,
            color: Colors.deepPurple,
            title: 'Personnel MINEFOP',
            subtitle:
                'Agent du Ministère de l\'Emploi et de la Formation Professionnelle.',
            onTap: (_) => onSelect(false),
          ),
        ],
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final String value, selected, title, subtitle;
  final IconData icon;
  final Color color;
  final ValueChanged<String> onTap;

  const _RoleCard({
    required this.value,
    required this.selected,
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isSelected = selected == value;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: isSelected ? color.withAlpha(18) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isSelected ? color : Colors.grey.shade300,
            width: isSelected ? 2 : 1),
        boxShadow: [
          BoxShadow(
            color: isSelected ? color.withAlpha(40) : Colors.black.withAlpha(8),
            blurRadius: isSelected ? 12 : 4,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => onTap(value),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                  color: color.withAlpha(25),
                  borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: isSelected ? color : Colors.black87)),
                    const SizedBox(height: 3),
                    Text(subtitle,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.slate, height: 1.4)),
                  ]),
            ),
            const SizedBox(width: 6),
            Icon(
              isSelected ? Icons.check_circle : Icons.circle_outlined,
              color: isSelected ? color : Colors.grey.shade300,
            ),
          ]),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 1 — Identity (Nom first, then Prénom)
// ═══════════════════════════════════════════════════════════════════════════

class _StepIdentity extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final bool isCompany;
  final String initialFirstName,
      initialLastName,
      initialEmail,
      initialMatricule;
  final void Function(String fn, String ln, String em, String mat) onSave;
  final void Function(String)? onFirstNameChanged,
      onLastNameChanged,
      onEmailChanged,
      onMatriculeChanged;
  final ScrollController? scrollController;

  const _StepIdentity({
    super.key,
    required this.formKey,
    required this.isCompany,
    required this.initialFirstName,
    required this.initialLastName,
    required this.initialEmail,
    required this.initialMatricule,
    required this.onSave,
    this.onFirstNameChanged,
    this.onLastNameChanged,
    this.onEmailChanged,
    this.onMatriculeChanged,
    this.scrollController,
  });

  @override
  State<_StepIdentity> createState() => _StepIdentityState();
}

class _StepIdentityState extends State<_StepIdentity> {
  late final TextEditingController _nomCtrl,
      _prenomCtrl,
      _emailCtrl,
      _matriculeCtrl;

  @override
  void initState() {
    super.initState();
    _nomCtrl = TextEditingController(text: widget.initialLastName);
    _prenomCtrl = TextEditingController(text: widget.initialFirstName);
    _emailCtrl = TextEditingController(text: widget.initialEmail);
    _matriculeCtrl = TextEditingController(text: widget.initialMatricule);
    _nomCtrl.addListener(() => widget.onLastNameChanged?.call(_nomCtrl.text));
    _prenomCtrl
        .addListener(() => widget.onFirstNameChanged?.call(_prenomCtrl.text));
    _emailCtrl.addListener(() => widget.onEmailChanged?.call(_emailCtrl.text));
    _matriculeCtrl.addListener(
        () => widget.onMatriculeChanged?.call(_matriculeCtrl.text));
  }

  @override
  void dispose() {
    _nomCtrl.dispose();
    _prenomCtrl.dispose();
    _emailCtrl.dispose();
    _matriculeCtrl.dispose();
    super.dispose();
  }

  void _notify() => widget.onSave(_prenomCtrl.text.trim(), _nomCtrl.text.trim(),
      _emailCtrl.text.trim(), _matriculeCtrl.text.trim());

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      controller: widget.scrollController,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Form(
        key: widget.formKey,
        onChanged: _notify,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            widget.isCompany
                ? 'Identification de l\'entreprise'
                : 'Informations personnelles',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(
            widget.isCompany
                ? 'Renseignez la dénomination sociale et l\'email de contact de l\'entreprise.'
                : 'Ces informations identifient votre compte au sein du MINEFOP.',
            style: const TextStyle(color: AppColors.slate, fontSize: 14),
          ),
          const SizedBox(height: 28),
          if (widget.isCompany) ...[
            _Field(
              controller: _prenomCtrl,
              label: 'Raison sociale *',
              icon: Icons.business_outlined,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Requis' : null,
            ),
          ] else ...[
            // Nom (surname) first, then Prénom
            Row(children: [
              Expanded(
                child: _Field(
                  controller: _nomCtrl,
                  label: 'Nom *',
                  icon: Icons.badge_outlined,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Requis' : null,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _Field(
                  controller: _prenomCtrl,
                  label: 'Prénom *',
                  icon: Icons.person_outline,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Requis' : null,
                ),
              ),
            ]),
            const SizedBox(height: 14),
            _Field(
              controller: _matriculeCtrl,
              label: 'Matricule *',
              icon: Icons.numbers_outlined,
              textInputAction: TextInputAction.next,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Requis' : null,
            ),
          ],
          const SizedBox(height: 14),
          _Field(
            controller: _emailCtrl,
            label: widget.isCompany
                ? 'Email de contact professionnel *'
                : 'Adresse e-mail professionnelle *',
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Email requis';
              if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim())) {
                return 'Email invalide';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          _InfoBox(
            icon: Icons.info_outline,
            color: Colors.blue,
            text: widget.isCompany
                ? 'L\'email servira d\'identifiant de connexion pour votre compte entreprise.'
                : 'Utilisez votre e-mail professionnel officiel. Il servira d\'identifiant de connexion.',
          ),
        ]),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 2 — Company info (unchanged except scrollController)
// ═══════════════════════════════════════════════════════════════════════════

class _StepCompanyInfo extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final List<dynamic> sectors;
  final bool loadingSectors;
  final Map<String, dynamic>? selectedSector;
  final ValueChanged<Map<String, dynamic>?> onSectorChanged;
  final String initialTaxNumber, initialCnps, initialFax, initialAddress;
  final String initialParentCompany, initialSecondaryActivity;
  final int? initialCapital;
  final VoidCallback onInit;
  final void Function(String niu, String cnps, String fax, String addr,
      String parent, String sec, int? cap) onSave;
  final ScrollController? scrollController;

  const _StepCompanyInfo({
    super.key,
    required this.formKey,
    required this.sectors,
    required this.loadingSectors,
    required this.selectedSector,
    required this.onSectorChanged,
    required this.initialTaxNumber,
    required this.initialCnps,
    required this.initialFax,
    required this.initialAddress,
    required this.initialParentCompany,
    required this.initialSecondaryActivity,
    required this.initialCapital,
    required this.onInit,
    required this.onSave,
    this.scrollController,
  });

  @override
  State<_StepCompanyInfo> createState() => _StepCompanyInfoState();
}

class _StepCompanyInfoState extends State<_StepCompanyInfo> {
  late final TextEditingController _niuCtrl,
      _cnpsCtrl,
      _faxCtrl,
      _addrCtrl,
      _parentCtrl,
      _secActCtrl,
      _capitalCtrl;

  @override
  void initState() {
    super.initState();
    _niuCtrl = TextEditingController(text: widget.initialTaxNumber);
    _cnpsCtrl = TextEditingController(text: widget.initialCnps);
    _faxCtrl = TextEditingController(text: widget.initialFax);
    _addrCtrl = TextEditingController(text: widget.initialAddress);
    _parentCtrl = TextEditingController(text: widget.initialParentCompany);
    _secActCtrl = TextEditingController(text: widget.initialSecondaryActivity);
    _capitalCtrl = TextEditingController(
        text: widget.initialCapital != null ? '${widget.initialCapital}' : '');
    WidgetsBinding.instance.addPostFrameCallback((_) => widget.onInit());
  }

  @override
  void dispose() {
    _niuCtrl.dispose();
    _cnpsCtrl.dispose();
    _faxCtrl.dispose();
    _addrCtrl.dispose();
    _parentCtrl.dispose();
    _secActCtrl.dispose();
    _capitalCtrl.dispose();
    super.dispose();
  }

  void _notify() {
    widget.onSave(
      _niuCtrl.text.trim(),
      _cnpsCtrl.text.trim(),
      _faxCtrl.text.trim(),
      _addrCtrl.text.trim(),
      _parentCtrl.text.trim(),
      _secActCtrl.text.trim(),
      int.tryParse(_capitalCtrl.text.trim()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      controller: widget.scrollController,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Form(
        key: widget.formKey,
        onChanged: _notify,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Informations de l\'entreprise',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text(
              'Ces données seront pré-remplies automatiquement dans vos déclarations DSMO.',
              style: TextStyle(color: AppColors.slate, fontSize: 14)),
          const SizedBox(height: 20),
          const _SectionLabel('Identification fiscale'),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
                flex: 3,
                child: _Field(
                    controller: _niuCtrl,
                    label: 'N° Contribuable (NIU) *',
                    icon: Icons.tag,
                    textInputAction: TextInputAction.next,
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'NIU requis' : null)),
            const SizedBox(width: 12),
            Expanded(
                flex: 2,
                child: _Field(
                    controller: _cnpsCtrl,
                    label: 'N° CNPS',
                    icon: Icons.shield_outlined,
                    textInputAction: TextInputAction.next)),
          ]),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
                child: _Field(
                    controller: _faxCtrl,
                    label: 'Fax',
                    icon: Icons.print_outlined,
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next)),
            const SizedBox(width: 12),
            Expanded(
                flex: 2,
                child: _Field(
                    controller: _capitalCtrl,
                    label: 'Capital social (XAF)',
                    icon: Icons.account_balance_outlined,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: false),
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    textInputAction: TextInputAction.next)),
          ]),
          const _SectionLabel('Activité'),
          if (widget.loadingSectors)
            const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(child: CircularProgressIndicator()))
          else
            DropdownButtonFormField<Map<String, dynamic>>(
              initialValue: widget.selectedSector,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'Activité principale / Secteur *',
                prefixIcon: const Icon(Icons.work_outline, size: 20),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
              items: widget.sectors
                  .map((s) => DropdownMenuItem<Map<String, dynamic>>(
                        value: s as Map<String, dynamic>,
                        child: Text(s['name'] as String? ?? '',
                            overflow: TextOverflow.ellipsis),
                      ))
                  .toList(),
              onChanged: (v) {
                widget.onSectorChanged(v);
                _notify();
              },
              validator: (_) => widget.selectedSector == null ? 'Requis' : null,
            ),
          const SizedBox(height: 14),
          _Field(
              controller: _secActCtrl,
              label: 'Activité secondaire (optionnel)',
              icon: Icons.work_history_outlined,
              textInputAction: TextInputAction.next),
          const _SectionLabel('Coordonnées'),
          _Field(
              controller: _addrCtrl,
              label: 'Adresse complète *',
              icon: Icons.location_on_outlined,
              textInputAction: TextInputAction.next,
              maxLines: 2,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Adresse requise' : null),
          _Field(
              controller: _parentCtrl,
              label: 'Maison mère / Groupe (optionnel)',
              icon: Icons.corporate_fare_outlined,
              textInputAction: TextInputAction.done),
          const SizedBox(height: 8),
          const _InfoBox(
              icon: Icons.auto_fix_high_outlined,
              color: Colors.teal,
              text:
                  'Ces informations seront automatiquement pré-remplies dans la Partie A de vos futures déclarations DSMO.'),
        ]),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 4 — Position within service
// ═══════════════════════════════════════════════════════════════════════════

class _StepPosition extends StatelessWidget {
  final List<_ServicePosition> positions;
  final bool loading;
  final _ServicePosition? selected;
  final String? serviceName;
  final ValueChanged<_ServicePosition?> onChanged;
  final ScrollController? scrollController;

  const _StepPosition({
    required this.positions,
    required this.loading,
    required this.selected,
    required this.serviceName,
    required this.onChanged,
    this.scrollController,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      controller: scrollController,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Fonction / Rôle',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text(
            serviceName != null
                ? 'Sélectionnez votre fonction au sein de : $serviceName'
                : 'Sélectionnez votre fonction dans ce service.',
            style: const TextStyle(color: AppColors.slate, fontSize: 14),
          ),
          const SizedBox(height: 28),
          if (loading)
            const Center(child: CircularProgressIndicator())
          else if (positions.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.orange.shade200)),
              child: Row(children: [
                Icon(Icons.info_outline,
                    color: Colors.orange.shade700, size: 20),
                const SizedBox(width: 10),
                const Expanded(
                    child: Text(
                        'Aucune fonction définie pour ce service. Veuillez contacter l\'administrateur ou sélectionner un autre service.',
                        style: TextStyle(fontSize: 13))),
              ]),
            )
          else
            DropdownButtonFormField<_ServicePosition>(
              initialValue: selected,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: 'Fonction *',
                prefixIcon: const Icon(Icons.work_outline, size: 20),
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.white,
              ),
              items: positions
                  .map((p) => DropdownMenuItem(
                        value: p,
                        child: Text(
                            p.titleEn != null
                                ? '${p.title} / ${p.titleEn}'
                                : p.title,
                            overflow: TextOverflow.ellipsis),
                      ))
                  .toList(),
              onChanged: onChanged,
            ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 5 — Assignment / Location
// ═══════════════════════════════════════════════════════════════════════════

class _StepAssignment extends StatefulWidget {
  final String role;
  final List<dynamic> regions, departments;
  final bool loadingLocations;
  final Map<String, dynamic>? selectedRegion, selectedDepartment;
  final ValueChanged<Map<String, dynamic>?> onRegionChanged;
  final ValueChanged<Map<String, dynamic>?> onDepartmentChanged;
  final VoidCallback onInit;
  final ScrollController? scrollController;

  const _StepAssignment({
    required this.role,
    required this.regions,
    required this.departments,
    required this.loadingLocations,
    required this.selectedRegion,
    required this.selectedDepartment,
    required this.onRegionChanged,
    required this.onDepartmentChanged,
    required this.onInit,
    this.scrollController,
  });

  @override
  State<_StepAssignment> createState() => _StepAssignmentState();
}

class _StepAssignmentState extends State<_StepAssignment> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => widget.onInit());
  }

  bool get _isCompany => widget.role == 'COMPANY';
  bool get _showDept => _isCompany || widget.role == 'DIVISIONAL';

  @override
  Widget build(BuildContext context) {
    final color = _isCompany ? Colors.teal : Colors.indigo;
    return SingleChildScrollView(
      controller: widget.scrollController,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(
            _isCompany
                ? 'Localisation de l\'établissement'
                : 'Zone d\'affectation',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Text(
          _isCompany
              ? 'Indiquez la région et le département de l\'entreprise. Ces informations pré-rempliront vos déclarations.'
              : widget.role == 'REGIONAL'
                  ? 'Sélectionnez la région dont vous êtes responsable.'
                  : 'Sélectionnez votre région puis département d\'affectation.',
          style: const TextStyle(color: AppColors.slate, fontSize: 14),
        ),
        const SizedBox(height: 28),
        if (widget.loadingLocations)
          const Center(
              child: Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator()))
        else ...[
          _LocationDropdown(
            label: 'Région *',
            icon: Icons.map_outlined,
            hint: 'Sélectionner une région',
            items: widget.regions,
            selected: widget.selectedRegion,
            onChanged: widget.onRegionChanged,
          ),
          if (_showDept) ...[
            const SizedBox(height: 16),
            _LocationDropdown(
              label: 'Département *',
              icon: Icons.location_city_outlined,
              hint: widget.selectedRegion == null
                  ? 'Sélectionnez d\'abord une région'
                  : 'Sélectionner un département',
              items: widget.departments,
              selected: widget.selectedDepartment,
              onChanged: widget.selectedRegion == null
                  ? null
                  : widget.onDepartmentChanged,
            ),
          ],
          const SizedBox(height: 20),
          _InfoBox(
            icon: _isCompany
                ? Icons.auto_fix_high_outlined
                : Icons.shield_outlined,
            color: color,
            text: _isCompany
                ? 'Ces informations seront automatiquement pré-remplies dans vos déclarations DSMO.'
                : 'Votre accès sera limité aux déclarations de votre zone d\'affectation.',
          ),
        ],
      ]),
    );
  }
}

class _LocationDropdown extends StatelessWidget {
  final String label, hint;
  final IconData icon;
  final List<dynamic> items;
  final Map<String, dynamic>? selected;
  final ValueChanged<Map<String, dynamic>?>? onChanged;

  const _LocationDropdown({
    required this.label,
    required this.hint,
    required this.icon,
    required this.items,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label,
          style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.slate)),
      const SizedBox(height: 6),
      DropdownButtonFormField<Map<String, dynamic>>(
        initialValue: selected,
        isExpanded: true,
        decoration: InputDecoration(
          hintText: hint,
          prefixIcon: Icon(icon, size: 20),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          filled: true,
          fillColor: onChanged == null ? Colors.grey.shade100 : Colors.white,
        ),
        items: items
            .map((item) => DropdownMenuItem<Map<String, dynamic>>(
                  value: item as Map<String, dynamic>,
                  child: Text(item['name'] as String? ?? '',
                      overflow: TextOverflow.ellipsis),
                ))
            .toList(),
        onChanged: onChanged,
      ),
    ]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 6 — Security
// ═══════════════════════════════════════════════════════════════════════════

class _StepSecurity extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final String initialPassword;
  final bool obscurePw, obscureConfirm;
  final VoidCallback onTogglePw, onToggleConfirm;
  final void Function(String pw, String confirm) onSave;
  final double Function(String) strengthOf;
  final Color Function(double) strengthColor;
  final String Function(double) strengthLabel;
  final ScrollController? scrollController;

  const _StepSecurity({
    required this.formKey,
    required this.initialPassword,
    required this.obscurePw,
    required this.obscureConfirm,
    required this.onTogglePw,
    required this.onToggleConfirm,
    required this.onSave,
    required this.strengthOf,
    required this.strengthColor,
    required this.strengthLabel,
    this.scrollController,
  });

  @override
  State<_StepSecurity> createState() => _StepSecurityState();
}

class _StepSecurityState extends State<_StepSecurity> {
  late final TextEditingController _pwCtrl, _confirmCtrl;
  double _strength = 0;

  @override
  void initState() {
    super.initState();
    _pwCtrl = TextEditingController(text: widget.initialPassword);
    _confirmCtrl = TextEditingController();
    _strength = widget.strengthOf(_pwCtrl.text);
    _pwCtrl.addListener(() {
      setState(() => _strength = widget.strengthOf(_pwCtrl.text));
      widget.onSave(_pwCtrl.text, _confirmCtrl.text);
    });
    _confirmCtrl
        .addListener(() => widget.onSave(_pwCtrl.text, _confirmCtrl.text));
  }

  @override
  void dispose() {
    _pwCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sc = widget.strengthColor(_strength);
    return SingleChildScrollView(
      controller: widget.scrollController,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Form(
        key: widget.formKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Sécurisez votre compte',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Choisissez un mot de passe robuste.',
              style: TextStyle(color: AppColors.slate, fontSize: 14)),
          const SizedBox(height: 28),
          TextFormField(
            controller: _pwCtrl,
            obscureText: widget.obscurePw,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              labelText: 'Mot de passe',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                icon: Icon(widget.obscurePw
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined),
                onPressed: widget.onTogglePw,
              ),
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Mot de passe requis';
              if (v.length < 8) return 'Minimum 8 caractères';
              if (widget.strengthOf(v) < 0.35) {
                return 'Trop faible — ajoutez des chiffres ou symboles';
              }
              return null;
            },
          ),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
                child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                        value: _strength,
                        minHeight: 5,
                        backgroundColor: Colors.grey.shade200,
                        color: sc))),
            const SizedBox(width: 10),
            Text(_pwCtrl.text.isEmpty ? '' : widget.strengthLabel(_strength),
                style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600, color: sc)),
          ]),
          const SizedBox(height: 8),
          _PasswordTips(password: _pwCtrl.text),
          const SizedBox(height: 20),
          TextFormField(
            controller: _confirmCtrl,
            obscureText: widget.obscureConfirm,
            textInputAction: TextInputAction.done,
            decoration: InputDecoration(
              labelText: 'Confirmer le mot de passe',
              prefixIcon: const Icon(Icons.lock_clock_outlined),
              suffixIcon: IconButton(
                icon: Icon(widget.obscureConfirm
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined),
                onPressed: widget.onToggleConfirm,
              ),
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true,
              fillColor: Colors.white,
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Confirmation requise';
              if (v != _pwCtrl.text) {
                return 'Les mots de passe ne correspondent pas';
              }
              return null;
            },
          ),
        ]),
      ),
    );
  }
}

class _PasswordTips extends StatelessWidget {
  final String password;
  const _PasswordTips({required this.password});

  @override
  Widget build(BuildContext context) {
    final tips = [
      ('8 caractères minimum', password.length >= 8),
      ('Une lettre majuscule', password.contains(RegExp(r'[A-Z]'))),
      ('Un chiffre', password.contains(RegExp(r'[0-9]'))),
      ('Un caractère spécial', password.contains(RegExp(r'[!@#\$%^&*]'))),
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      children: tips.map((t) {
        final (label, ok) = t;
        return Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(ok ? Icons.check_circle : Icons.radio_button_unchecked,
              size: 14, color: ok ? Colors.green : Colors.grey.shade400),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(
                  fontSize: 11,
                  color: ok ? Colors.green.shade700 : Colors.grey.shade500)),
        ]);
      }).toList(),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 7 — Review
// ═══════════════════════════════════════════════════════════════════════════

class _StepReview extends StatelessWidget {
  final String role, firstName, lastName, email;
  final String taxNumber, cnpsNumber, mainActivity, secondaryActivity, address;
  final Map<String, dynamic>? selectedRegion, selectedDepartment;
  final String? serviceName;
  final String? positionTitle;
  final bool isMinefop;
  final ScrollController? scrollController;

  const _StepReview({
    required this.role,
    required this.isMinefop,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.taxNumber,
    required this.cnpsNumber,
    required this.mainActivity,
    required this.secondaryActivity,
    required this.address,
    required this.selectedRegion,
    required this.selectedDepartment,
    this.serviceName,
    this.positionTitle,
    this.scrollController,
  });

  bool get _isCompany => role == 'COMPANY';
  String get _roleLabel =>
      _isCompany ? 'Entreprise' : (isMinefop ? 'Personnel MINEFOP' : role);
  Color get _roleColor => _isCompany ? Colors.teal : Colors.deepPurple;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      controller: scrollController,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Récapitulatif',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text('Vérifiez vos informations avant de créer le compte.',
            style: TextStyle(color: AppColors.slate, fontSize: 14)),
        const SizedBox(height: 24),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
              color: _roleColor.withAlpha(20),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _roleColor.withAlpha(80))),
          child: Row(children: [
            Icon(Icons.verified_user_outlined, color: _roleColor),
            const SizedBox(width: 10),
            Text(_roleLabel,
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: _roleColor)),
          ]),
        ),
        const SizedBox(height: 16),
        _ReviewCard(
          title: _isCompany ? 'Entreprise' : 'Identité',
          icon: _isCompany ? Icons.business_outlined : Icons.person_outline,
          rows: [
            if (_isCompany) ('Raison sociale', firstName),
            if (!_isCompany) ('Prénom', firstName),
            if (!_isCompany) ('Nom', lastName),
            ('E-mail', email),
          ],
        ),
        if (_isCompany) ...[
          const SizedBox(height: 12),
          _ReviewCard(
            title: 'Informations légales',
            icon: Icons.tag,
            rows: [
              ('NIU', taxNumber),
              if (cnpsNumber.isNotEmpty) ('N° CNPS', cnpsNumber),
              ('Activité principale', mainActivity),
              if (secondaryActivity.isNotEmpty)
                ('Activité secondaire', secondaryActivity),
              if (address.isNotEmpty) ('Adresse', address),
            ],
          ),
        ],
        if (!_isCompany && serviceName != null) ...[
          const SizedBox(height: 12),
          _ReviewCard(
            title: 'Service d\'affectation',
            icon: Icons.account_balance_outlined,
            rows: [
              ('Service', serviceName!),
              if (positionTitle != null) ('Fonction', positionTitle!),
            ],
          ),
        ],
        if (selectedRegion != null || selectedDepartment != null) ...[
          const SizedBox(height: 12),
          _ReviewCard(
            title: _isCompany ? 'Localisation' : 'Zone d\'affectation',
            icon: Icons.map_outlined,
            rows: [
              if (selectedRegion != null)
                ('Région', selectedRegion!['name'] as String? ?? ''),
              if (selectedDepartment != null)
                ('Département', selectedDepartment!['name'] as String? ?? ''),
            ],
          ),
        ],
        const SizedBox(height: 16),
        const _InfoBox(
            icon: Icons.check_circle_outline,
            color: Colors.green,
            text:
                'Votre mot de passe est sécurisé et ne sera jamais affiché en clair.'),
        if (_isCompany) ...[
          const SizedBox(height: 10),
          const _InfoBox(
              icon: Icons.auto_fix_high_outlined,
              color: Colors.teal,
              text:
                  'Les informations de votre entreprise seront automatiquement pré-remplies dans la Partie A de chaque déclaration DSMO.'),
        ],
      ]),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<(String, String)> rows;

  const _ReviewCard(
      {required this.title, required this.icon, required this.rows});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withAlpha(8),
              blurRadius: 8,
              offset: const Offset(0, 2))
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Row(children: [
            Icon(icon, size: 16, color: AppColors.deepEmerald),
            const SizedBox(width: 8),
            Text(title,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.deepEmerald)),
          ]),
        ),
        const Divider(height: 1),
        ...rows.map((row) {
          final (label, value) = row;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
            child: Row(children: [
              SizedBox(
                  width: 120,
                  child: Text(label,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.slate))),
              Expanded(
                  child: Text(value.isEmpty ? '—' : value,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w500))),
            ]),
          );
        }),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 10),
      child: Row(children: [
        Expanded(child: Divider(color: Colors.teal.shade200)),
        Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Text(text,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.teal.shade700))),
        Expanded(child: Divider(color: Colors.teal.shade200)),
      ]),
    );
  }
}

class _InfoBox extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;
  const _InfoBox({required this.icon, required this.color, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withAlpha(60))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 8),
        Expanded(
            child: Text(text,
                style: TextStyle(fontSize: 12, color: color, height: 1.5))),
      ]),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final String? Function(String?)? validator;
  final int maxLines;
  final List<TextInputFormatter>? inputFormatters;

  const _Field({
    required this.controller,
    required this.label,
    required this.icon,
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.validator,
    this.maxLines = 1,
    this.inputFormatters,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        textInputAction: textInputAction,
        textCapitalization: textCapitalization,
        maxLines: maxLines,
        inputFormatters: inputFormatters,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, size: 20),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          filled: true,
          fillColor: Colors.white,
        ),
        validator: validator,
      ),
    );
  }
}
