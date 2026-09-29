import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../data/minefop_models.dart';
import '../data/api_client.dart';
import '../providers/auth_provider.dart';
import '../core/i18n/l10n_ext.dart';
import '../widgets/public_chrome.dart';
import 'register_constants.dart';
import 'register_widgets.dart';
import 'register_receipt.dart';
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
  final GlobalKey<FormState> _securityKey = GlobalKey<FormState>();

  bool _draftLoaded = false;
  // COMPANY is the only role StepRole offers (MINEFOP self-registration was
  // removed — see StepRole), so it's set once here instead of making every
  // registrant click through a single-option screen. The wizard starts
  // directly on entity-type selection — see _step and _visibleSteps below.
  String _role = 'COMPANY';
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
  int _step = kStepEntityType;
  bool _isSubmitting = false;
  Timer? _debounce;

  bool get _isCompany => _role == 'COMPANY';

  List<int> get _visibleSteps => const [
        kStepEntityType,
        kStepRespondent,
        kStepEntityInfo,
        kStepLocation,
        kStepSecurity,
        kStepReview,
      ];

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
    // Flush any pending debounced save so an in-flight edit isn't lost when
    // the screen is torn down (e.g. a back gesture interrupts registration).
    _debounce?.cancel();
    _saveDraft(immediate: true);
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
        // A draft saved before the role step was removed could have step
        // 0 (kStepRole) persisted — that step no longer exists, so treat
        // it the same as "no step saved yet".
        final loadedStep = data['step'] as int? ?? kStepEntityType;
        _step = _visibleSteps.contains(loadedStep) ? loadedStep : kStepEntityType;
        _draftLoaded = true;
      });

      if (_selectedEntityType != null) _initEntityControllers();

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _step > kStepEntityType) {
          _pageCtrl.jumpToPage(_pageIndexForStep(_step));
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(context.l10n.registerDraftRestored),
              backgroundColor: PublicColors.green,
              duration: const Duration(seconds: 3),
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
        context.go('/login');
      }
    }
  }

  Future<void> _advance() async {
    switch (_step) {
      case kStepRole:
        if (_role.isEmpty) {
          _showSnack(context.l10n.registerSelectAccountType, error: true);
          return;
        }
        _next();
        break;

      case kStepEntityType:
        if (_selectedEntityType == null) {
          _showSnack(context.l10n.registerSelectEntityType, error: true);
          return;
        }
        _initEntityControllers();
        _next();
        break;

      case kStepRespondent:
        if (!_respondentKey.currentState!.validate()) return;
        if (!_emailIsAvailable) {
          _showSnack(context.l10n.registerEmailAlreadyUsed, error: true);
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

      case kStepLocation:
        if (_selectedRegion == null) {
          _showSnack(context.l10n.registerSelectRegion, error: true);
          return;
        }
        if (_isCompany && _selectedDepartment == null) {
          _showSnack(context.l10n.registerSelectDepartment, error: true);
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
    } catch (e) {
      debugPrint('getRegions failed: $e');
      if (mounted) {
        _showSnack(context.l10n.registerLoadRegionsError, error: true);
      }
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
    } catch (e) {
      debugPrint('getDepartments failed: $e');
      if (mounted) {
        _showSnack(context.l10n.registerLoadDepartmentsError, error: true);
      }
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
    } catch (e) {
      debugPrint('getSubdivisions failed: $e');
      if (mounted) {
        _showSnack(context.l10n.registerLoadSubdivisionsError, error: true);
      }
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
    } catch (e) {
      debugPrint('getSectors failed: $e');
      if (mounted) {
        _showSnack(context.l10n.registerLoadSectorsError, error: true);
      }
    } finally {
      if (mounted) setState(() => _loadingSectors = false);
    }
  }

  Future<void> _showRegistrationSuccess({
    String? establishmentId,
    String? companyName,
    String? attestationUrl,
  }) async {
    if (establishmentId != null) {
      // Show the beautiful receipt
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => RegistrationReceipt(
          establishmentId: establishmentId,
          companyName: companyName ?? '',
          email: _respondentEmail,
          registrationDate: DateTime.now(),
          attestationUrl: attestationUrl,
        ),
      );
      // Receipt handles navigation internally
    } else {
      // Fallback simple dialog
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle, size: 64, color: PublicColors.green),
              const SizedBox(height: 16),
              Text(context.l10n.registerSuccessTitle),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  if (mounted) context.go('/home');
                },
                child: Text(context.l10n.registerAccessButton),
              ),
            ],
          ),
        ),
      );
    }
  }

  Future<void> _submit() async {
    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);
    try {
      await _submitCompany();
    } catch (e) {
      if (!mounted) return;
      if (e is ApiException) {
        _showSnack(e.message, error: true);
      } else {
        _showSnack(context.l10n.registerSubmitErrorWithMessage('$e'),
            error: true);
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

    final response = await ref.read(apiClientProvider).registerCompany(
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
          sigle: _entityData['sigle'] as String?,
          cfpType: _entityData['cfpType'] as String?,
          educationSystem: _entityData['educationSystem'] as String?,
          functionalStatus: _entityData['functionalStatus'] as String?,
          nonFunctionalReason: _entityData['nonFunctionalReason'] as String?,
          nonFunctionalReasonOther:
              _entityData['nonFunctionalReasonOther'] as String?,
          promoterName: _entityData['promoterName'] as String?,
          promoterSex: _entityData['promoterSex'] as String?,
          promoterPhone1: _entityData['promoterPhone1'] as String?,
          promoterPhone2: _entityData['promoterPhone2'] as String?,
          sectorId: _selectedSector?['id'] as String?,
          respondentFunction: _respondentFunction,
          respondentPhone: _respondentPhone1,
          respondentPhone2:
              _respondentPhone2.isNotEmpty ? _respondentPhone2 : null,
        );

    // Extract establishmentId, company name and attestation URL from response
    final establishmentId = response['company']?['establishmentId'] as String?;
    final registeredCompanyName =
        response['company']?['name'] as String? ?? companyName;
    final attestationUrl = response['company']?['attestationUrl'] as String?;

    await _clearDraft();

    if (mounted) {
      await _showRegistrationSuccess(
        establishmentId: establishmentId,
        companyName: registeredCompanyName,
        attestationUrl: attestationUrl,
      );
    }
  }

  void _showSnack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? PublicColors.red : PublicColors.green));
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
            onChanged: (fn, ln, func, email, p1, p2) {
              // No setState: nothing on screen reads these fields back while
              // the user is on this step (the text fields already reflect
              // their own controllers), so rebuilding the whole registration
              // tree on every keystroke would just be wasted work.
              _respondentFirstName = fn;
              _respondentLastName = ln;
              _respondentFunction = func;
              _respondentEmail = email;
              _respondentPhone1 = p1;
              _respondentPhone2 = p2;
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
            entityType: _selectedEntityType,
            respondentFirstName: _respondentFirstName,
            respondentLastName: _respondentLastName,
            respondentFunction: _respondentFunction,
            respondentEmail: _respondentEmail,
            respondentPhone1: _respondentPhone1,
            respondentPhone2: _respondentPhone2,
            entityData: _entityData,
            selectedRegion: _selectedRegion,
            selectedDepartment: _selectedDepartment,
            selectedSubdivision: _selectedSubdivision,
            selectedArea: _selectedArea,
            selectedSector: _selectedSector,
          );

        default:
          return const SizedBox.shrink();
      }
    }).map((page) {
      // Cap each step to a conventional form width and center it — on
      // mobile the screen is already narrower than the cap so this is a
      // no-op, on desktop/web it stops fields from stretching edge-to-edge.
      // Matches the 480px convention used by LoginPortalScreen.
      return Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: page,
        ),
      );
    }).toList();

    return PopScope(
      // Only let a back gesture/button leave the screen entirely on the
      // first step. On every other step it steps back within the form
      // instead, so a stray swipe can't dump the user out to the home
      // screen mid-registration.
      canPop: _currentVisibleIdx == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _back();
      },
      child: Scaffold(
        backgroundColor: PublicColors.bg,
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
                    color: PublicColors.redFaint,
                    border: Border.all(color: PublicColors.redBorder),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(children: [
                    const Icon(Icons.error_outline,
                        color: PublicColors.red, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(authState.error.toString(),
                            style: const TextStyle(
                                color: PublicColors.red, fontSize: 13))),
                  ]),
                ),
              Expanded(
                child: PageView(
                  controller: _pageCtrl,
                  physics: const NeverScrollableScrollPhysics(),
                  children: pages,
                ),
              ),
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: _BottomNav(
                    isBusy: isBusy,
                    step: _step,
                    onPrevious: _back,
                    onNext: _advance,
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

class _BottomNav extends StatelessWidget {
  final bool isBusy;
  final int step;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  const _BottomNav({
    required this.isBusy,
    required this.step,
    required this.onPrevious,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 54,
                child: OutlinedButton(
                  onPressed: isBusy ? null : onPrevious,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: PublicColors.green,
                    side: const BorderSide(color: PublicColors.green),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.arrow_back_rounded, size: 18),
                      const SizedBox(width: 8),
                      Text(context.l10n.previousButton,
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SizedBox(
                height: 54,
                child: ElevatedButton(
                  onPressed: isBusy ? null : onNext,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: PublicColors.green,
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
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Flexible(
                              child: Text(
                                step == kStepReview
                                    ? context.l10n.registerCreateAccountButton
                                    : context.l10n.registerContinueButton,
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
                                softWrap: false,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    fontSize: 15, fontWeight: FontWeight.w600),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Icon(
                                step == kStepReview
                                    ? Icons.check_rounded
                                    : Icons.arrow_forward_rounded,
                                size: 18),
                          ],
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
