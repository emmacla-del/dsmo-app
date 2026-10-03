import 'dart:async';
import 'dart:math' as math;
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
import 'register_state.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with WidgetsBindingObserver {
  static const String _kDraftBox = 'draftBox';
  static const String _kDraftKey = 'registration_draft';

  final ScrollController _scrollCtrl = ScrollController();
  final List<GlobalKey> _sectionKeys = List.generate(6, (_) => GlobalKey());
  final GlobalKey<FormState> _respondentKey = GlobalKey<FormState>();
  final GlobalKey<FormState> _entityKey = GlobalKey<FormState>();
  final GlobalKey<FormState> _securityKey = GlobalKey<FormState>();

  bool _draftLoaded = false;
  int _reached = 0;
  // COMPANY is the only role StepRole offers (MINEFOP self-registration was
  // removed — see StepRole), so it's set once here instead of making every
  // registrant click through a single-option screen. The wizard starts
  // directly on entity-type selection — see _visibleSteps below.
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
  bool _securityValid = false;
  bool _isSubmitting = false;
  Timer? _debounce;

  RegState get _currentState => RegState(
        entityType: _selectedEntityType,
        respondentFirstName: _respondentFirstName,
        respondentLastName: _respondentLastName,
        respondentFunction: _respondentFunction,
        respondentEmail: _respondentEmail,
        respondentPhone1: _respondentPhone1,
        respondentPhone2: _respondentPhone2,
        emailIsAvailable: _emailIsAvailable,
        entityData: _entityData,
        selectedRegion: _selectedRegion,
        selectedDepartment: _selectedDepartment,
        selectedSubdivision: _selectedSubdivision,
        selectedArea: _selectedArea,
        selectedSector: _selectedSector,
        subdivisions: _subdivisions,
        loadingSubdivisions: _loadingSubdivisions,
        password: _password,
        isSecurityValid: _securityValid,
      );

  bool _isSectionComplete(int step) => isSectionComplete(step, _currentState);

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
    _scrollCtrl.dispose();
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
    _debounce = Timer(const Duration(milliseconds: 450), () {
      _saveDraft(immediate: true);
      _revealIfComplete();
    });
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
        // SECURITY: stop persisting _password in the Hive draft.
        'step': _reached,
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
        _role = data['role'] as String? ?? 'COMPANY';
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
        // Password is never restored from draft (security rule)
        _password = '';
        _securityValid = false;

        final rawStep = data['step'];
        int savedStep = 0;
        if (rawStep is int) {
          if (_visibleSteps.contains(rawStep)) {
            savedStep = _visibleSteps.indexOf(rawStep);
          } else if (rawStep >= 0 && rawStep <= 5) {
            savedStep = rawStep;
          }
        }

        int firstIncomplete = 5;
        for (int i = 0; i < 5; i++) {
          if (!_isSectionComplete(i)) {
            firstIncomplete = i;
            break;
          }
        }

        final int candidate = math.max(savedStep, firstIncomplete - 1);
        _reached = candidate.clamp(0, 5);
        _draftLoaded = true;
      });

      if (_selectedEntityType != null) _initEntityControllers();

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _revealIfComplete();
        if (_reached > 0) {
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

  bool get _hasAnyData =>
      _selectedEntityType != null ||
      _respondentFirstName.trim().isNotEmpty ||
      _respondentLastName.trim().isNotEmpty ||
      _respondentFunction.trim().isNotEmpty ||
      _respondentEmail.trim().isNotEmpty ||
      _respondentPhone1.trim().isNotEmpty ||
      _respondentPhone2.trim().isNotEmpty ||
      _entityData.values
          .any((v) => v != null && v.toString().trim().isNotEmpty) ||
      _selectedRegion != null ||
      _password.trim().isNotEmpty;

  Future<bool> _confirmLeave() async {
    if (!_hasAnyData) return true;
    final res = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.l10n.registerLeaveTitle),
        content: Text(context.l10n.registerLeaveMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(context.l10n.registerLeaveCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              context.l10n.registerLeaveConfirm,
              style: const TextStyle(color: PublicColors.red),
            ),
          ),
        ],
      ),
    );
    return res ?? false;
  }

  Future<void> _handleBack() async {
    final shouldLeave = await _confirmLeave();
    if (shouldLeave && mounted) {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/login');
      }
    }
  }

  void _revealIfComplete() {
    if (!mounted) return;
    bool revealedAny = false;
    while (_reached < 5 && _isSectionComplete(_reached)) {
      _reached++;
      revealedAny = true;
    }
    if (revealedAny) {
      setState(() {});
      _saveDraft(immediate: true);
      final newStep = _reached;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final keyContext = _sectionKeys[newStep].currentContext;
        if (keyContext != null) {
          final renderBox = keyContext.findRenderObject() as RenderBox?;
          if (renderBox != null && renderBox.hasSize) {
            final position = renderBox.localToGlobal(Offset.zero);
            final screenHeight = MediaQuery.of(context).size.height;
            if (position.dy > screenHeight / 2) {
              Scrollable.ensureVisible(
                keyContext,
                duration: const Duration(milliseconds: 400),
                curve: Curves.easeInOut,
              );
            }
          }
        }
      });
    }
  }

  void _scrollToSection(int step) {
    if (step < 0 || step >= _sectionKeys.length) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final keyContext = _sectionKeys[step].currentContext;
      if (keyContext != null) {
        Scrollable.ensureVisible(
          keyContext,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  Future<void> _validateAllForSubmit() async {
    // Step 0: Entity Type
    if (_selectedEntityType == null) {
      _showSnack(context.l10n.registerSelectEntityType, error: true);
      _scrollToSection(0);
      return;
    }

    // Step 1: Respondent
    if (!_respondentKey.currentState!.validate()) {
      _scrollToSection(1);
      return;
    }
    if (!_emailIsAvailable) {
      _showSnack(context.l10n.registerEmailAlreadyUsed, error: true);
      _scrollToSection(1);
      return;
    }
    _respondentKey.currentState!.save();

    // Step 2: Entity Info
    if (!_entityKey.currentState!.validate()) {
      _scrollToSection(2);
      return;
    }
    _entityKey.currentState!.save();

    // Step 3: Location
    if (_selectedRegion == null) {
      _showSnack(context.l10n.registerSelectRegion, error: true);
      _scrollToSection(3);
      return;
    }
    if (_isCompany && _selectedDepartment == null) {
      _showSnack(context.l10n.registerSelectDepartment, error: true);
      _scrollToSection(3);
      return;
    }
    if (_isCompany &&
        _selectedSubdivision == null &&
        _subdivisions.isNotEmpty) {
      _showSnack(context.l10n.registerSelectSubdivision, error: true);
      _scrollToSection(3);
      return;
    }

    // Step 4: Security
    if (!_securityKey.currentState!.validate()) {
      _scrollToSection(4);
      return;
    }
    _securityKey.currentState!.save();

    await _submit();
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
      // R.1: no establishment ID is issued at self-registration any more, so
      // this is the live path for every company. The file is recorded and now
      // waits for a reviewer — say so, and send them to the status screen
      // rather than to /home, which has nothing for them yet.
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.check_circle, size: 64, color: PublicColors.green),
              const SizedBox(height: 16),
              Text(
                context.l10n.registrationPendingHeadline,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: PublicColors.gray900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                context.l10n.registrationPendingBody,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.5,
                  color: PublicColors.gray700,
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  if (mounted) context.go('/inscription-en-attente');
                },
                child: Text(context.l10n.registrationPendingFollowButton),
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
          regionId: _selectedRegion?['id'] as String?,
          departmentId: _selectedDepartment?['id'] as String?,
          subdivisionId: _selectedSubdivision?['id'] as String?,
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

    // registerCompany() stores the access token but never populates
    // authProvider, which the status screen reads. Pull /auth/me in before
    // navigating so it opens with a user instead of an empty state.
    await ref.read(authProvider.notifier).refreshUser();

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

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        await _handleBack();
      },
      child: Scaffold(
        backgroundColor: PublicColors.bg,
        body: SafeArea(
          child: Column(
            children: [
              const TopFlagStripe(),
              RegisterHeader(
                currentStep: _reached,
                totalSteps: 6,
                step: _reached,
                isStepComplete: _isSectionComplete,
                onBack: _handleBack,
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
                child: SingleChildScrollView(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 720),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (int i = 0; i <= _reached; i++) ...[
                            if (i > 0) const SizedBox(height: 20),
                            KeyedSubtree(
                              key: _sectionKeys[i],
                              child: _buildSection(i),
                            ),
                          ],
                        ],
                      ),
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

  Widget _buildSection(int index) {
    switch (index) {
      case 0:
        return StepEntityType(
          selected: _selectedEntityType,
          onSelect: (type) {
            setState(() {
              _selectedEntityType = type;
              _initEntityControllers();
            });
            _saveDraft(immediate: true);
            _revealIfComplete();
          },
        );

      case 1:
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
            _respondentFirstName = fn;
            _respondentLastName = ln;
            _respondentFunction = func;
            _respondentEmail = email;
            _respondentPhone1 = p1;
            _respondentPhone2 = p2;
            setState(() {});
            _scheduleDraftSave();
          },
          onEmailAvailabilityChanged: (isAvailable) {
            setState(() => _emailIsAvailable = isAvailable);
            _revealIfComplete();
          },
        );

      case 2:
        return StepEntityInfo(
          key: ValueKey(_selectedEntityType),
          formKey: _entityKey,
          entityType: _selectedEntityType,
          config: _currentEntityConfig,
          controllers: _entityControllers,
          entityData: _entityData,
          onChanged: () {
            setState(() {});
            _scheduleDraftSave();
          },
          onDropdownChanged: (key, value) {
            setState(() => _entityData[key] = value);
            _saveDraft(immediate: true);
            _revealIfComplete();
          },
        );

      case 3:
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
            _saveDraft(immediate: true);
            _revealIfComplete();
          },
          onDepartmentChanged: (d) {
            setState(() {
              _selectedDepartment = d;
              _selectedSubdivision = null;
              _subdivisions = [];
            });
            if (d != null) _loadSubdivisions(d['id'] as String);
            _saveDraft(immediate: true);
            _revealIfComplete();
          },
          onSubdivisionChanged: (s) {
            setState(() => _selectedSubdivision = s);
            _saveDraft(immediate: true);
            _revealIfComplete();
          },
          onAreaChanged: (a) {
            setState(() => _selectedArea = a);
            _saveDraft(immediate: true);
            _revealIfComplete();
          },
          onSectorChanged: (s) {
            setState(() => _selectedSector = s);
            _saveDraft(immediate: true);
            _revealIfComplete();
          },
          onInit: () {
            _loadRegions();
            if (_isCompany) _loadSectors();
          },
        );

      case 4:
        return StepSecurity(
          formKey: _securityKey,
          initialPassword: _password,
          onChanged: (pw) {
            _password = pw;
            _scheduleDraftSave();
          },
          onValidityChanged: (valid) {
            if (_securityValid != valid) {
              setState(() => _securityValid = valid);
              _revealIfComplete();
            }
          },
        );

      case 5:
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
          isSubmitting: _isSubmitting || ref.watch(authProvider).isLoading,
          onSubmit: _validateAllForSubmit,
        );

      default:
        return const SizedBox.shrink();
    }
  }
}
