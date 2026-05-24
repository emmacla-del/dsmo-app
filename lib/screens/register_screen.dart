import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:dio/dio.dart';
import '../data/minefop_models.dart';
import '../data/api_client.dart';
import '../providers/auth_provider.dart';
import 'register_constants.dart';
import 'register_widgets.dart';
import 'register_steps.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with WidgetsBindingObserver {
  static const String _kDraftBox = 'draftBox';
  static const String _kDraftKey = 'registration_draft';

  final PageController _pageCtrl = PageController();
  final GlobalKey<FormState> _respondentKey = GlobalKey<FormState>();
  final GlobalKey<FormState> _entityKey = GlobalKey<FormState>();
  final GlobalKey<FormState> _minefopKey = GlobalKey<FormState>();
  final GlobalKey<FormState> _securityKey = GlobalKey<FormState>();

  bool _draftLoaded = false;
  String _role = '';
  EntityType? _selectedEntityType;

  // Respondent fields
  String _respondentFirstName = '';
  String _respondentLastName = '';
  String _respondentFunction = '';
  String _respondentEmail = '';
  String _respondentPhone1 = '';
  String _respondentPhone2 = '';
  bool _emailIsAvailable = true;

  // Entity data (company)
  final Map<String, dynamic> _entityData = {};
  final Map<String, TextEditingController> _entityControllers = {};

  // MINEFOP fields
  String _minefopMatricule = '';
  String _minefopPoste = '';
  String _minefopServiceCode = '';
  String _minefopPositionType = '';
  String? _minefopRegionName;
  String? _minefopDepartmentName;
  String _minefopServicePath = '';
  // _minefopTargetLevel removed – no longer needed

  // Location (company flow)
  Map<String, dynamic>? _selectedRegion;
  Map<String, dynamic>? _selectedDepartment;
  Map<String, dynamic>? _selectedSubdivision;
  String? _selectedArea;
  List<dynamic> _regions = [];
  List<dynamic> _departments = [];
  List<dynamic> _subdivisions = [];
  bool _loadingRegions = false;
  bool _loadingDepartments = false;
  bool _loadingSubdivisions = false;

  // Sector (company)
  List<dynamic> _sectors = [];
  Map<String, dynamic>? _selectedSector;
  bool _loadingSectors = false;

  String _password = '';
  int _step = kStepRole;
  bool _isSubmitting = false;
  Timer? _debounce;

  bool get _isCompany => _role == 'COMPANY';
  bool get _isMinefop =>
      _role == 'DIVISIONAL' || _role == 'REGIONAL' || _role == 'CENTRAL';

  List<int> get _visibleSteps {
    if (_role.isEmpty) return [kStepRole];
    if (_isCompany) {
      return [
        kStepRole,
        kStepEntityType,
        kStepRespondent,
        kStepEntityInfo,
        kStepLocation,
        kStepSecurity,
        kStepReview,
      ];
    }
    // MINEFOP flow: skip entity type step
    return [
      kStepRole,
      kStepRespondent,
      kStepMinefopInfo,
      kStepSecurity,
      kStepReview,
    ];
  }

  int get _visibleCount => _visibleSteps.length;
  int get _currentVisibleIdx => _visibleSteps.indexOf(_step);

  EntityConfig? get _currentEntityConfig =>
      _selectedEntityType != null ? entityConfigs[_selectedEntityType] : null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadDraft();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _debounce?.cancel();
    for (final ctrl in _entityControllers.values) {
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

  void _scheduleDraftSave() {
    _debounce?.cancel();
    _debounce = Timer(
        const Duration(milliseconds: 500), () => _saveDraft(immediate: true));
  }

  Future<void> _saveDraft({bool immediate = false}) async {
    if (!immediate && (_debounce?.isActive ?? false)) return;
    try {
      final box = await Hive.openBox(_kDraftBox);
      await box.put(_kDraftKey, {
        'role': _role,
        'selectedEntityType': _selectedEntityType?.toString(),
        'respondentFirstName': _respondentFirstName,
        'respondentLastName': _respondentLastName,
        'respondentFunction': _respondentFunction,
        'respondentEmail': _respondentEmail,
        'respondentPhone1': _respondentPhone1,
        'respondentPhone2': _respondentPhone2,
        'entityData': Map<String, dynamic>.from(_entityData),
        'selectedRegion': _selectedRegion,
        'selectedDepartment': _selectedDepartment,
        'selectedSubdivision': _selectedSubdivision,
        'selectedArea': _selectedArea,
        'selectedSector': _selectedSector,
        'password': _password,
        'step': _step,
        'minefopMatricule': _minefopMatricule,
        'minefopServiceCode': _minefopServiceCode,
        'minefopPositionType': _minefopPositionType,
        'minefopRegionName': _minefopRegionName,
        'minefopDepartmentName': _minefopDepartmentName,
        'minefopServicePath': _minefopServicePath,
        // 'minefopTargetLevel' removed
      });
    } catch (e) {
      debugPrint('Draft save failed: $e');
    }
  }

  Future<void> _loadDraft() async {
    try {
      final box = await Hive.openBox(_kDraftBox);
      final dynamic raw = box.get(_kDraftKey);
      if (raw == null || !mounted) return;
      final Map<String, dynamic> data = Map<String, dynamic>.from(raw as Map);
      if ((data['role'] as String? ?? '').isEmpty) return;

      setState(() {
        _role = data['role'] as String? ?? '';
        if (data['selectedEntityType'] != null) {
          _selectedEntityType =
              _parseEntityType(data['selectedEntityType'] as String);
        }
        _respondentFirstName = data['respondentFirstName'] as String? ?? '';
        _respondentLastName = data['respondentLastName'] as String? ?? '';
        _respondentFunction = data['respondentFunction'] as String? ?? '';
        _respondentEmail = data['respondentEmail'] as String? ?? '';
        _respondentPhone1 = data['respondentPhone1'] as String? ?? '';
        _respondentPhone2 = data['respondentPhone2'] as String? ?? '';
        if (data['entityData'] != null) {
          _entityData
              .addAll(Map<String, dynamic>.from(data['entityData'] as Map));
        }
        if (data['selectedRegion'] != null) {
          _selectedRegion =
              Map<String, dynamic>.from(data['selectedRegion'] as Map);
        }
        if (data['selectedDepartment'] != null) {
          _selectedDepartment =
              Map<String, dynamic>.from(data['selectedDepartment'] as Map);
        }
        if (data['selectedSubdivision'] != null) {
          _selectedSubdivision =
              Map<String, dynamic>.from(data['selectedSubdivision'] as Map);
        }
        _selectedArea = data['selectedArea'] as String?;
        if (data['selectedSector'] != null) {
          _selectedSector =
              Map<String, dynamic>.from(data['selectedSector'] as Map);
        }
        _password = data['password'] as String? ?? '';
        _step = data['step'] as int? ?? kStepRole;
        _minefopMatricule = data['minefopMatricule'] as String? ?? '';
        _minefopServiceCode = data['minefopServiceCode'] as String? ?? '';
        _minefopPositionType = data['minefopPositionType'] as String? ?? '';
        _minefopRegionName = data['minefopRegionName'] as String?;
        _minefopDepartmentName = data['minefopDepartmentName'] as String?;
        _minefopServicePath = data['minefopServicePath'] as String? ?? '';
        // _minefopTargetLevel removed
        _draftLoaded = true;
      });

      if (_selectedEntityType != null) _initEntityControllers();

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _step > kStepRole) {
          _pageCtrl.jumpToPage(_pageIndexForStep(_step));
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                  'Brouillon restauré — vous pouvez reprendre votre inscription.'),
              backgroundColor: Colors.teal,
              duration: Duration(seconds: 3),
            ),
          );
        }
      });
    } catch (e) {
      debugPrint('Draft load failed: $e');
    }
  }

  EntityType? _parseEntityType(String str) {
    for (final type in EntityType.values) {
      if (type.toString() == str) return type;
    }
    return null;
  }

  Future<void> _clearDraft() async {
    try {
      final box = await Hive.openBox(_kDraftBox);
      await box.delete(_kDraftKey);
    } catch (e) {
      debugPrint('Draft clear failed: $e');
    }
  }

  void _initEntityControllers() {
    final config = _currentEntityConfig;
    if (config == null) return;
    for (final field in config.fields) {
      if (field.options != null || field.isPhone) continue;
      if (_entityControllers.containsKey(field.key)) continue;
      final controller =
          TextEditingController(text: _entityData[field.key]?.toString() ?? '');
      controller.addListener(() {
        _entityData[field.key] = controller.text;
        _scheduleDraftSave();
      });
      _entityControllers[field.key] = controller;
    }
  }

  int _pageIndexForStep(int step) {
    final idx = _visibleSteps.indexOf(step);
    return idx < 0 ? 0 : idx;
  }

  void _goToStep(int step) {
    setState(() => _step = step);
    _pageCtrl.animateToPage(
      _pageIndexForStep(step),
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeInOut,
    );
    _saveDraft(immediate: true);
  }

  void _next() {
    final int idx = _visibleSteps.indexOf(_step);
    if (idx < _visibleSteps.length - 1) _goToStep(_visibleSteps[idx + 1]);
  }

  void _back() {
    final int idx = _visibleSteps.indexOf(_step);
    if (idx > 0) {
      _goToStep(_visibleSteps[idx - 1]);
    } else {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/');
      }
    }
  }

  Future<void> _advance() async {
    switch (_step) {
      case kStepRole:
        if (_role.isEmpty) {
          _showSnack('Veuillez choisir un type de compte', error: true);
          return;
        }
        _next();
        break;

      case kStepEntityType:
        if (_selectedEntityType == null) {
          _showSnack("Veuillez sélectionner le type d'entité", error: true);
          return;
        }
        _initEntityControllers();
        _next();
        break;

      case kStepRespondent:
        if (!_respondentKey.currentState!.validate()) return;
        if (!_emailIsAvailable) {
          _showSnack('Cet email est déjà utilisé.', error: true);
          return;
        }
        _respondentKey.currentState!.save();
        _next();
        break;

      case kStepEntityInfo:
        if (!_entityKey.currentState!.validate()) return;
        _entityKey.currentState!.save();
        _next();
        break;

      case kStepMinefopInfo:
        if (!_minefopKey.currentState!.validate()) return;
        _minefopKey.currentState!.save();
        _next();
        break;

      case kStepLocation:
        if (_selectedRegion == null) {
          _showSnack('Veuillez sélectionner une région', error: true);
          return;
        }
        if (_isCompany && _selectedDepartment == null) {
          _showSnack('Veuillez sélectionner un département', error: true);
          return;
        }
        _next();
        break;

      case kStepSecurity:
        if (!_securityKey.currentState!.validate()) return;
        _securityKey.currentState!.save();
        _next();
        break;

      case kStepReview:
        await _submit();
        break;
    }
  }

  // Location data loaders (unchanged)
  Future<void> _loadRegions() async {
    if (_regions.isNotEmpty) return;
    setState(() => _loadingRegions = true);
    try {
      final data = await ref.read(apiClientProvider).getRegions();
      if (mounted) setState(() => _regions = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingRegions = false);
    }
  }

  Future<void> _loadDepartments(String regionId) async {
    setState(() {
      _departments = [];
      _subdivisions = [];
      _selectedDepartment = null;
      _selectedSubdivision = null;
      _loadingDepartments = true;
    });
    try {
      final data = await ref.read(apiClientProvider).getDepartments(regionId);
      if (mounted) setState(() => _departments = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingDepartments = false);
    }
  }

  Future<void> _loadSubdivisions(String departmentId) async {
    setState(() {
      _subdivisions = [];
      _selectedSubdivision = null;
      _loadingSubdivisions = true;
    });
    try {
      final data =
          await ref.read(apiClientProvider).getSubdivisions(departmentId);
      if (mounted) setState(() => _subdivisions = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingSubdivisions = false);
    }
  }

  Future<void> _loadSectors() async {
    if (_sectors.isNotEmpty) return;
    setState(() => _loadingSectors = true);
    try {
      final data = await ref.read(apiClientProvider).getSectors();
      if (mounted) setState(() => _sectors = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingSectors = false);
    }
  }

  Future<void> _showRegistrationSuccess({bool pendingApproval = false}) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: Container(
          width: 380,
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 32,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.0, end: 1.0),
                duration: const Duration(milliseconds: 500),
                curve: Curves.elasticOut,
                builder: (_, scale, child) =>
                    Transform.scale(scale: scale, child: child),
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: pendingApproval
                        ? Colors.orange.shade50
                        : Colors.green.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    pendingApproval
                        ? Icons.hourglass_top_rounded
                        : Icons.check_circle_rounded,
                    color: pendingApproval
                        ? Colors.orange.shade600
                        : Colors.green.shade600,
                    size: 44,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                pendingApproval
                    ? 'Demande soumise !'
                    : 'Compte créé avec succès !',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                pendingApproval
                    ? "Votre demande d'accès MINEFOP est en attente d'approbation "
                        'par un administrateur. Vous serez notifié(e) par e-mail.'
                    : 'Bienvenue sur la plateforme ONEFOP / DSMO.\n'
                        'Vos informations sont pré-remplies dans les formulaires.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey.shade600,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: pendingApproval
                        ? Colors.orange.shade600
                        : const Color(0xFF006B5E),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    pendingApproval ? 'Compris' : 'Accéder à mon espace',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (mounted) {
      if (pendingApproval) {
        context.go('/');
      } else {
        context.go('/home');
      }
    }
  }

  Future<void> _submit() async {
    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);
    try {
      if (_isCompany) {
        await _submitCompany();
      } else if (_isMinefop) {
        await _submitMinefop();
      }
    } catch (e) {
      if (!mounted) return;
      if (e is DioException) {
        if (e.response?.statusCode == 409) {
          String msg = 'Cet email ou ce numéro NIU est déjà utilisé.';
          try {
            final data = e.response?.data;
            if (data is Map && data['message'] != null) {
              msg = data['message'].toString();
            }
          } catch (_) {}
          _showSnack(msg, error: true);
        } else {
          _showSnack("Erreur lors de l'inscription: ${e.message}", error: true);
        }
      } else if (e is ApiException) {
        _showSnack(e.message, error: true);
      } else {
        _showSnack("Erreur lors de l'inscription: $e", error: true);
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _submitCompany() async {
    final config = _currentEntityConfig;
    final String companyName = config?.resolveCompanyName(
          _entityData,
          '$_respondentFirstName $_respondentLastName',
        ) ??
        '$_respondentFirstName $_respondentLastName';
    final String address = config?.resolveAddress(_entityData) ?? '';
    final String mainActivity = config?.resolveMainActivity(_entityData) ?? '';

    await ref.read(apiClientProvider).registerCompany(
          email: _respondentEmail,
          password: _password,
          firstName: _respondentFirstName,
          lastName: _respondentLastName,
          role: 'COMPANY',
          region: _selectedRegion?['name'] as String?,
          department: _selectedDepartment?['name'] as String?,
          subdivision: _selectedSubdivision?['name'] as String?,
          area: _selectedArea,
          entityType: _selectedEntityType?.apiValue,
          companyName: companyName,
          taxNumber: (_entityData['taxNumber'] ?? '').toString(),
          mainActivity: mainActivity,
          address: address,
          parentCompany: _entityData['parentCompany'] as String?,
          secondaryActivity: _entityData['secondaryActivity'] as String?,
          cnpsNumber: _entityData['cnpsNumber'] as String?,
          fax: _entityData['fax'] as String?,
          socialCapital: _entityData['socialCapital'] != null
              ? int.tryParse(_entityData['socialCapital'].toString())
              : null,
          legalStatus: _entityData['legalStatus'] as String?,
          cooperativeType: _entityData['cooperativeType'] as String?,
          yearOfCreation: _entityData['yearOfCreation'],
          ctdType: _entityData['ctdType'] as String?,
          mainMission: _entityData['mainMission'] as String?,
          registrationNumber: _entityData['registrationNumber'] as String?,
          trainingDomains: _entityData['trainingDomains'] as String?,
          branch: _entityData['branch'] as String?,
          poBox: _entityData['poBox'] as String?,
          phone: _entityData['phone'] as String?,
          phone2: _entityData['phone2'] as String?,
          sectorId: _selectedSector?['id'] as String?,
          respondentFunction: _respondentFunction,
          respondentPhone: _respondentPhone1,
          respondentPhone2:
              _respondentPhone2.isNotEmpty ? _respondentPhone2 : null,
        );

    await _clearDraft();
    if (mounted) await _showRegistrationSuccess(pendingApproval: false);
  }

  Future<void> _submitMinefop() async {
    await ref.read(apiClientProvider).registerMinefopUser(
          email: _respondentEmail,
          password: _password,
          firstName: _respondentFirstName,
          lastName: _respondentLastName,
          role: _role,
          region: _minefopRegionName,
          department: _minefopDepartmentName,
          matricule: _minefopMatricule.isNotEmpty ? _minefopMatricule : null,
          poste: _minefopPoste.isNotEmpty ? _minefopPoste : null,
          serviceCode:
              _minefopServiceCode.isNotEmpty ? _minefopServiceCode : null,
          positionType:
              _minefopPositionType.isNotEmpty ? _minefopPositionType : null,
        );

    await _clearDraft();
    if (mounted) await _showRegistrationSuccess(pendingApproval: true);
  }

  void _showSnack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? Colors.red : Colors.green));
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final bool isBusy = _isSubmitting || authState.isLoading;

    final List<Widget> pages = _visibleSteps.map((step) {
      switch (step) {
        case kStepRole:
          return StepRole(
            role: _role,
            onSelect: (role) {
              setState(() {
                _role = role;
                _selectedEntityType = null;
                _minefopMatricule = '';
                _minefopPoste = '';
                _minefopServiceCode = '';
                _minefopRegionName = null;
                _minefopDepartmentName = null;
                _minefopServicePath = '';
                // _minefopTargetLevel removed
              });
              _saveDraft(immediate: true);
              if (role.isNotEmpty) {
                _next();
              }
            },
          );

        case kStepEntityType:
          return StepEntityType(
            selected: _selectedEntityType,
            onSelect: (type) {
              setState(() {
                _selectedEntityType = type;
                for (final c in _entityControllers.values) {
                  c.dispose();
                }
                _entityControllers.clear();
                _entityData.clear();
              });
              _saveDraft(immediate: true);
              _advance();
            },
          );

        case kStepRespondent:
          return StepRespondent(
            key: ValueKey(_draftLoaded),
            formKey: _respondentKey,
            initialFirstName: _respondentFirstName,
            initialLastName: _respondentLastName,
            initialFunction: _respondentFunction,
            initialEmail: _respondentEmail,
            initialPhone1: _respondentPhone1,
            initialPhone2: _respondentPhone2,
            isMinefop: _isMinefop,
            // removed initialTargetLevel
            onChanged: (fn, ln, func, email, p1, p2) {
              setState(() {
                _respondentFirstName = fn;
                _respondentLastName = ln;
                _respondentFunction = func;
                _respondentEmail = email;
                _respondentPhone1 = p1;
                _respondentPhone2 = p2;
              });
              _scheduleDraftSave();
            },
            onEmailAvailabilityChanged: (isAvailable) {
              setState(() => _emailIsAvailable = isAvailable);
            },
            // removed onTargetLevelChanged
          );

        case kStepEntityInfo:
          return StepEntityInfo(
            key: ValueKey(_selectedEntityType),
            formKey: _entityKey,
            entityType: _selectedEntityType,
            config: _currentEntityConfig,
            controllers: _entityControllers,
            entityData: _entityData,
            onChanged: () => _scheduleDraftSave(),
            onDropdownChanged: (key, value) {
              setState(() => _entityData[key] = value);
              _scheduleDraftSave();
            },
          );

        case kStepMinefopInfo:
          return StepMinefopInfo(
            key: ValueKey(_role),
            formKey: _minefopKey,
            role: _role,
            // removed targetLevel parameter
            initialMatricule: _minefopMatricule,
            initialPoste: _minefopPoste,
            initialServiceCode: _minefopServiceCode,
            initialPositionType: _minefopPositionType,
            initialRegion: _minefopRegionName,
            initialDepartment: _minefopDepartmentName,
            onChanged: ({
              required matricule,
              required poste,
              required serviceCode,
              required positionType,
              required servicePath,
              region,
              department,
            }) {
              setState(() {
                _minefopMatricule = matricule;
                _minefopPoste = poste;
                _minefopServiceCode = serviceCode;
                _minefopPositionType = positionType;
                _minefopServicePath = servicePath;
                if (region != null) _minefopRegionName = region;
                if (department != null) _minefopDepartmentName = department;
              });
              _scheduleDraftSave();
            },
          );

        case kStepLocation:
          return StepLocation(
            regions: _regions,
            departments: _departments,
            subdivisions: _subdivisions,
            sectors: _sectors,
            loadingRegions: _loadingRegions,
            loadingDepartments: _loadingDepartments,
            loadingSubdivisions: _loadingSubdivisions,
            loadingSectors: _loadingSectors,
            selectedRegion: _selectedRegion,
            selectedDepartment: _selectedDepartment,
            selectedSubdivision: _selectedSubdivision,
            selectedArea: _selectedArea,
            selectedSector: _selectedSector,
            isMinefop: _isMinefop,
            onRegionChanged: (r) {
              setState(() {
                _selectedRegion = r;
                _selectedDepartment = null;
                _selectedSubdivision = null;
                _departments = [];
                _subdivisions = [];
              });
              if (r != null) _loadDepartments(r['id'] as String);
              _scheduleDraftSave();
            },
            onDepartmentChanged: (d) {
              setState(() {
                _selectedDepartment = d;
                _selectedSubdivision = null;
                _subdivisions = [];
              });
              if (d != null) _loadSubdivisions(d['id'] as String);
              _scheduleDraftSave();
            },
            onSubdivisionChanged: (s) {
              setState(() => _selectedSubdivision = s);
              _scheduleDraftSave();
            },
            onAreaChanged: (a) {
              setState(() => _selectedArea = a);
              _scheduleDraftSave();
            },
            onSectorChanged: (s) {
              setState(() => _selectedSector = s);
              _scheduleDraftSave();
            },
            onInit: () {
              _loadRegions();
              if (_isCompany) _loadSectors();
            },
          );

        case kStepSecurity:
          return StepSecurity(
            formKey: _securityKey,
            initialPassword: _password,
            onChanged: (pw) {
              _password = pw;
              _scheduleDraftSave();
            },
          );

        case kStepReview:
          return StepReview(
            isMinefop: _isMinefop,
            role: _role,
            entityType: _selectedEntityType,
            respondentFirstName: _respondentFirstName,
            respondentLastName: _respondentLastName,
            respondentFunction: _respondentFunction,
            respondentEmail: _respondentEmail,
            respondentPhone1: _respondentPhone1,
            respondentPhone2: _respondentPhone2,
            entityData: _entityData,
            selectedRegion: _isMinefop
                ? (_minefopRegionName != null
                    ? {'name': _minefopRegionName}
                    : null)
                : _selectedRegion,
            selectedDepartment: _isMinefop
                ? (_minefopDepartmentName != null
                    ? {'name': _minefopDepartmentName}
                    : null)
                : _selectedDepartment,
            selectedSubdivision: _isMinefop ? null : _selectedSubdivision,
            selectedArea: _isMinefop ? null : _selectedArea,
            selectedSector: _isMinefop ? null : _selectedSector,
            minefopMatricule: _minefopMatricule,
            minefopPoste: _minefopPoste,
            minefopServiceCode: _minefopServiceCode,
            minefopPositionType: _minefopPositionType,
            minefopServicePath: _minefopServicePath,
          );

        default:
          return const SizedBox.shrink();
      }
    }).toList();

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      body: SafeArea(
        child: Column(
          children: [
            RegisterHeader(
              currentStep: _currentVisibleIdx,
              totalSteps: _visibleCount,
              step: _step,
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
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 18),
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
                children: pages,
              ),
            ),
            _BottomButton(isBusy: isBusy, step: _step, onPressed: _advance),
          ],
        ),
      ),
    );
  }
}

class _BottomButton extends StatelessWidget {
  final bool isBusy;
  final int step;
  final VoidCallback onPressed;

  const _BottomButton({
    required this.isBusy,
    required this.step,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: SafeArea(
        top: false,
        child: SizedBox(
          width: double.infinity,
          height: 54,
          child: ElevatedButton(
            onPressed: isBusy ? null : onPressed,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF006B5E),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
              elevation: 2,
            ),
            child: isBusy
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : Text(
                    step == kStepReview ? 'Créer mon compte' : 'Continuer',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
          ),
        ),
      ),
    );
  }
}
