// lib/screens/register_screen.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../data/api_client.dart';
import '../providers/auth_provider.dart';
import '../core/focus/utils/cameroon_phone_validator.dart';

// ─── Step indices ────────────────────────────────────────────
const int _kStepRole = 0;
const int _kStepEntityType = 1;
const int _kStepRespondent = 2;
const int _kStepEntityInfo = 3;
const int _kStepLocation = 4;
const int _kStepSecurity = 5;
const int _kStepReview = 6;

// ─── Modern input decoration ──────────────────────────────────
InputDecoration _modernInput({
  required bool hasError,
  String? labelText,
  String? hintText,
  Widget? prefixIcon,
  Widget? suffixIcon,
  String? suffixText,
  TextStyle? suffixStyle,
}) {
  return InputDecoration(
    labelText: labelText,
    hintText: hintText,
    prefixIcon: prefixIcon,
    suffixIcon: suffixIcon,
    suffixText: suffixText,
    suffixStyle: suffixStyle,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    filled: true,
    fillColor: hasError ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
    border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
    enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(
            color:
                hasError ? const Color(0xFFE24B4A) : const Color(0xFFE2E8F0))),
    focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF006B5E), width: 2)),
    errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE24B4A))),
    focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE24B4A), width: 2)),
  );
}

InputDecoration _modernDropdown({bool hasError = false}) =>
    _modernInput(hasError: hasError);

// ─── Static option lists ─────────────────────────────────────
const List<String> _kLegalStatusOptions = [
  'Société unipersonnelle',
  'SARL',
  'SA',
  'SNC',
  'Autres',
];

const List<String> _kCooperativeTypeOptions = [
  'Coopérative simplifiée',
  "Coopérative avec conseil d'administration",
  'Autre',
];

const List<String> _kCtdTypeOptions = [
  'Région',
  'Commune',
];

const List<String> _kAreaOptions = [
  'Urbain',
  'Rural',
];

const List<String> _kRespondentFunctionOptions = [
  'Directeur Général',
  'Directeur des Ressources Humaines',
  'Directeur Administratif et Financier',
  'Gérant',
  'Chef du Personnel',
  'Responsable RH',
  'Secrétaire Général',
  "Président du Conseil d'Administration",
  'Autre',
];

// ─── Entity type enum ─────────────────────────────────────────
enum EntityType {
  enterprise,
  cooperative,
  ctd,
  ong,
  vocational;

  String get displayName {
    switch (this) {
      case EntityType.enterprise:
        return 'Entreprise';
      case EntityType.cooperative:
        return 'Coopérative';
      case EntityType.ctd:
        return 'CTD';
      case EntityType.ong:
        return 'ONG';
      case EntityType.vocational:
        return 'Centre de formation professionnelle';
    }
  }

  String get apiValue {
    switch (this) {
      case EntityType.enterprise:
        return 'ENTREPRISE';
      case EntityType.cooperative:
        return 'COOPERATIVE';
      case EntityType.ctd:
        return 'CTD';
      case EntityType.ong:
        return 'ONG';
      case EntityType.vocational:
        return 'VOCATIONAL_TRAINING_CENTER';
    }
  }
}

// ─── Entity field definition ──────────────────────────────────
class EntityField {
  final String key;
  final String label;
  final String? hint;
  final bool required;
  final TextInputType? keyboardType;
  final List<String>? options;
  final bool isPhone;

  const EntityField({
    required this.key,
    required this.label,
    this.hint,
    this.required = true,
    this.keyboardType,
    this.options,
    this.isPhone = false,
  });
}

// ─── Entity configuration ─────────────────────────────────────
class EntityConfig {
  final EntityType type;
  final String title;
  final IconData icon;
  final Color color;
  final List<EntityField> fields;

  const EntityConfig({
    required this.type,
    required this.title,
    required this.icon,
    required this.color,
    required this.fields,
  });
}

// ─── Entity configurations ────────────────────────────────────
const Map<EntityType, EntityConfig> entityConfigs = {
  EntityType.enterprise: EntityConfig(
    type: EntityType.enterprise,
    title: 'Entreprise',
    icon: Icons.business_outlined,
    color: Colors.teal,
    fields: [
      EntityField(
          key: 'companyName',
          label: 'Raison sociale',
          hint: "Nom légal de l'entreprise"),
      EntityField(
          key: 'legalStatus',
          label: 'Statut juridique',
          options: _kLegalStatusOptions),
      EntityField(
          key: 'taxNumber',
          label: 'N° Contribuable (NIU)',
          hint: "Numéro d'identification fiscale",
          keyboardType: TextInputType.number),
      EntityField(
          key: 'cnpsNumber',
          label: "N° d'affiliation CNPS",
          hint: 'Numéro CNPS',
          keyboardType: TextInputType.number,
          required: false),
      EntityField(
          key: 'mainActivity',
          label: 'Activité principale',
          hint: "Secteur d'activité principal"),
      EntityField(
          key: 'branch',
          label: "Branche d'activité",
          hint: 'Ex: Commerce, Industrie, Services',
          required: false),
      EntityField(
          key: 'address',
          label: 'Adresse du siège social',
          hint: 'Adresse complète'),
      EntityField(
          key: 'phone',
          label: 'Téléphone',
          hint: '6XXXXXXXX',
          keyboardType: TextInputType.phone,
          isPhone: true),
      EntityField(
          key: 'phone2',
          label: 'Téléphone secondaire',
          hint: 'Optionnel',
          keyboardType: TextInputType.phone,
          isPhone: true,
          required: false),
      EntityField(
          key: 'poBox', label: 'Boîte postale', hint: 'BP', required: false),
    ],
  ),
  EntityType.cooperative: EntityConfig(
    type: EntityType.cooperative,
    title: 'Coopérative',
    icon: Icons.groups_outlined,
    color: Colors.green,
    fields: [
      EntityField(
          key: 'cooperativeName',
          label: 'Nom de la coopérative',
          hint: 'Dénomination officielle'),
      EntityField(
          key: 'cooperativeType',
          label: 'Type de coopérative',
          options: _kCooperativeTypeOptions),
      EntityField(
          key: 'yearOfCreation',
          label: 'Année de création',
          hint: 'AAAA',
          keyboardType: TextInputType.number),
      EntityField(
          key: 'taxNumber',
          label: 'N° Contribuable (NIU)',
          hint: "Numéro d'identification fiscale",
          keyboardType: TextInputType.number),
      EntityField(key: 'mainActivity', label: 'Activité principale'),
      EntityField(
          key: 'cooperativeHeadOffice', label: 'Adresse du siège social'),
      EntityField(
          key: 'branch',
          label: "Branche d'activité",
          hint: 'Ex: Cultures vivrières, Commerce de détail',
          required: false),
      EntityField(
          key: 'phone',
          label: 'Téléphone',
          keyboardType: TextInputType.phone,
          isPhone: true),
      EntityField(
          key: 'phone2',
          label: 'Téléphone secondaire',
          keyboardType: TextInputType.phone,
          isPhone: true,
          required: false),
      EntityField(
          key: 'poBox', label: 'Boîte postale', hint: 'BP', required: false),
    ],
  ),
  EntityType.ctd: EntityConfig(
    type: EntityType.ctd,
    title: 'CTD',
    icon: Icons.account_balance_outlined,
    color: Colors.indigo,
    fields: [
      EntityField(
          key: 'ctdType', label: 'Type de CTD', options: _kCtdTypeOptions),
      EntityField(
          key: 'ctdName', label: 'Nom de la CTD', hint: 'Région ou Commune'),
      EntityField(
          key: 'yearOfCreation',
          label: 'Année de création',
          keyboardType: TextInputType.number),
      EntityField(
          key: 'taxNumber',
          label: 'N° Contribuable (NIU)',
          keyboardType: TextInputType.number),
      EntityField(key: 'address', label: 'Adresse du siège'),
      EntityField(
          key: 'phone',
          label: 'Téléphone',
          keyboardType: TextInputType.phone,
          isPhone: true),
      EntityField(
          key: 'phone2',
          label: 'Téléphone secondaire',
          keyboardType: TextInputType.phone,
          isPhone: true,
          required: false),
      EntityField(
          key: 'poBox', label: 'Boîte postale', hint: 'BP', required: false),
    ],
  ),
  EntityType.ong: EntityConfig(
    type: EntityType.ong,
    title: 'ONG',
    icon: Icons.volunteer_activism_outlined,
    color: Colors.orange,
    fields: [
      EntityField(key: 'ngoName', label: "Nom de l'ONG"),
      EntityField(
          key: 'registrationNumber',
          label: "N° d'enregistrement",
          hint: "Numéro d'agrément"),
      EntityField(
          key: 'taxNumber',
          label: 'N° Contribuable (NIU)',
          keyboardType: TextInputType.number),
      EntityField(
          key: 'yearOfCreation',
          label: 'Année de création',
          keyboardType: TextInputType.number),
      EntityField(
          key: 'mainMission',
          label: 'Mission principale',
          hint: "Objectif principal de l'ONG"),
      EntityField(key: 'address', label: 'Adresse du siège social'),
      EntityField(
          key: 'phone',
          label: 'Téléphone',
          keyboardType: TextInputType.phone,
          isPhone: true),
      EntityField(
          key: 'phone2',
          label: 'Téléphone secondaire',
          keyboardType: TextInputType.phone,
          isPhone: true,
          required: false),
      EntityField(
          key: 'poBox', label: 'Boîte postale', hint: 'BP', required: false),
    ],
  ),
  EntityType.vocational: EntityConfig(
    type: EntityType.vocational,
    title: 'Centre de formation professionnelle',
    icon: Icons.school_outlined,
    color: Colors.purple,
    fields: [
      EntityField(key: 'centerName', label: 'Nom du centre'),
      EntityField(
          key: 'registrationNumber',
          label: "N° d'agrément",
          hint: "Numéro d'agrément"),
      EntityField(
          key: 'taxNumber',
          label: 'N° Contribuable (NIU)',
          keyboardType: TextInputType.number),
      EntityField(
          key: 'yearOfCreation',
          label: 'Année de création',
          keyboardType: TextInputType.number),
      EntityField(
          key: 'trainingDomains',
          label: 'Domaines de formation',
          hint: 'Ex: Maintenance, Hotellerie, BTP'),
      EntityField(key: 'address', label: 'Adresse du centre'),
      EntityField(
          key: 'phone',
          label: 'Téléphone',
          keyboardType: TextInputType.phone,
          isPhone: true),
      EntityField(
          key: 'phone2',
          label: 'Téléphone secondaire',
          keyboardType: TextInputType.phone,
          isPhone: true,
          required: false),
      EntityField(
          key: 'poBox', label: 'Boîte postale', hint: 'BP', required: false),
    ],
  ),
};

// ═══════════════════════════════════════════════════════════════
// RegisterScreen
// ═══════════════════════════════════════════════════════════════

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
  String _role = '';
  EntityType? _selectedEntityType;

  // Respondent fields
  String _respondentFirstName = '';
  String _respondentLastName = '';
  String _respondentFunction = '';
  String _respondentEmail = '';
  String _respondentPhone1 = '';
  String _respondentPhone2 = '';

  // Entity data
  final Map<String, dynamic> _entityData = {};
  final Map<String, TextEditingController> _entityControllers = {};

  // Location
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

  // Sector
  List<dynamic> _sectors = [];
  Map<String, dynamic>? _selectedSector;
  bool _loadingSectors = false;

  // Security
  String _password = '';

  int _step = _kStepRole;
  bool _isSubmitting = false;
  Timer? _debounce;

  bool get _isCompany => _role == 'COMPANY';
  bool get _needsLocation => _isCompany;

  List<int> get _visibleSteps {
    if (_role.isEmpty) return [_kStepRole];
    return [
      _kStepRole,
      if (_isCompany) _kStepEntityType,
      _kStepRespondent,
      if (_isCompany) _kStepEntityInfo,
      if (_needsLocation) _kStepLocation,
      _kStepSecurity,
      _kStepReview,
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
    for (var ctrl in _entityControllers.values) {
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
        'entityData': _entityData,
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
        _step = data['step'] as int? ?? _kStepRole;
        _draftLoaded = true;
      });

      if (_selectedEntityType != null) _initEntityControllers();

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _step > _kStepRole) {
          _pageCtrl.jumpToPage(_step);
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
      if (field.options != null) continue;
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

  void _goToStep(int step) {
    setState(() => _step = step);
    _pageCtrl.animateToPage(step,
        duration: const Duration(milliseconds: 320), curve: Curves.easeInOut);
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
      Navigator.pop(context);
    }
  }

  Future<void> _advance() async {
    switch (_step) {
      case _kStepRole:
        if (_role.isEmpty) {
          _showSnack('Veuillez choisir un type de compte', error: true);
          return;
        }
        _next();
        break;

      case _kStepEntityType:
        if (_selectedEntityType == null) {
          _showSnack("Veuillez sélectionner le type d'entité", error: true);
          return;
        }
        _initEntityControllers();
        _next();
        break;

      case _kStepRespondent:
        if (!_respondentKey.currentState!.validate()) return;
        _respondentKey.currentState!.save();
        _next();
        break;

      case _kStepEntityInfo:
        if (!_entityKey.currentState!.validate()) return;
        _entityKey.currentState!.save();
        _next();
        break;

      case _kStepLocation:
        if (_selectedRegion == null) {
          _showSnack('Veuillez sélectionner une région', error: true);
          return;
        }
        if (_selectedDepartment == null) {
          _showSnack('Veuillez sélectionner un département', error: true);
          return;
        }
        _next();
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

  // ── Success dialog shown after account creation ───────────────
  Future<void> _showRegistrationSuccess() async {
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
                    color: Colors.green.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.check_circle_rounded,
                    color: Colors.green.shade600,
                    size: 44,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Compte créé avec succès !',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Bienvenue sur la plateforme DSMO.\n'
                'Vous pouvez maintenant soumettre vos déclarations.',
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
                    backgroundColor: const Color(0xFF006B5E),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Accéder à mon espace',
                    style: TextStyle(
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
    // Navigate only after the user taps the button
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }

  // ── Submit registration ───────────────────────────────────────
  Future<void> _submit() async {
    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);
    try {
      final String? regionName = _selectedRegion?['name'] as String?;
      final String? deptName = _selectedDepartment?['name'] as String?;
      final String? subdivisionName = _selectedSubdivision?['name'] as String?;
      final String fullName = '$_respondentFirstName $_respondentLastName';

      await ref.read(authProvider.notifier).registerCompany(
            email: _respondentEmail,
            password: _password,
            // Store first and last name split so the backend can return
            // them separately via getMyCompany() for ONEFOP prefill.
            firstName: _respondentFirstName,
            lastName: _respondentLastName,
            role: 'COMPANY',
            region: regionName,
            department: deptName,
            subdivision: subdivisionName,
            companyName: _entityData['companyName'] ??
                _entityData['cooperativeName'] ??
                _entityData['ctdName'] ??
                _entityData['ngoName'] ??
                _entityData['centerName'] ??
                fullName,
            taxNumber: _entityData['taxNumber'] ?? '',
            mainActivity: _entityData['mainActivity'] ?? '',
            address: _entityData['address'] ??
                _entityData['cooperativeHeadOffice'] ??
                '',
            parentCompany: _entityData['parentCompany'],
            secondaryActivity: _entityData['secondaryActivity'],
            cnpsNumber: _entityData['cnpsNumber'],
            fax: _entityData['fax'],
            socialCapital: _entityData['socialCapital'],
            entityType: _selectedEntityType?.apiValue,
            area: _selectedArea,
            sectorId: _selectedSector?['id'] as String?,
            phone: _entityData['phone'],
            phone2: _entityData['phone2'],
            poBox: _entityData['poBox'],
            legalStatus: _entityData['legalStatus'],
            cooperativeType: _entityData['cooperativeType'],
            yearOfCreation: _entityData['yearOfCreation'],
            ctdType: _entityData['ctdType'],
            mainMission: _entityData['mainMission'],
            registrationNumber: _entityData['registrationNumber'],
            trainingDomains: _entityData['trainingDomains'],
            // Respondent contact details — stored separately from entity phone
            respondentPhone: _respondentPhone1,
            respondentPhone2:
                _respondentPhone2.isNotEmpty ? _respondentPhone2 : null,
            respondentFunction: _respondentFunction,
            // Split names forwarded explicitly so backend stores them and
            // returns them via getMyCompany() for ONEFOP Section 0 prefill
            respondentFirstName: _respondentFirstName,
            respondentLastName: _respondentLastName,
            // Branch of activity (cooperative, ctd, ong)
            branch: _entityData['branch'],
          );

      await _clearDraft();
      if (mounted) {
        await _showRegistrationSuccess();
      }
    } catch (e) {
      _showSnack("Erreur lors de l'inscription: $e", error: true);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showSnack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? Colors.red : Colors.green));
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final bool isBusy = _isSubmitting || authState.isLoading;

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      body: SafeArea(
        child: Column(
          children: [
            _Header(
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
                children: [
                  _StepRole(
                    isCompany: _isCompany,
                    onSelect: (isCompany) {
                      setState(() => _role = isCompany ? 'COMPANY' : '');
                      _saveDraft(immediate: true);
                      _advance();
                    },
                  ),
                  if (_visibleSteps.contains(_kStepEntityType))
                    _StepEntityType(
                      selected: _selectedEntityType,
                      onSelect: (type) {
                        setState(() => _selectedEntityType = type);
                        _saveDraft(immediate: true);
                        _advance();
                      },
                    ),
                  if (_visibleSteps.contains(_kStepRespondent))
                    _StepRespondent(
                      key: ValueKey(_draftLoaded),
                      formKey: _respondentKey,
                      initialFirstName: _respondentFirstName,
                      initialLastName: _respondentLastName,
                      initialFunction: _respondentFunction,
                      initialEmail: _respondentEmail,
                      initialPhone1: _respondentPhone1,
                      initialPhone2: _respondentPhone2,
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
                    ),
                  if (_visibleSteps.contains(_kStepEntityInfo))
                    _StepEntityInfo(
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
                    ),
                  if (_visibleSteps.contains(_kStepLocation))
                    _StepLocation(
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
                        _loadSectors();
                      },
                    ),
                  if (_visibleSteps.contains(_kStepSecurity))
                    _StepSecurity(
                      formKey: _securityKey,
                      initialPassword: _password,
                      onChanged: (pw) {
                        _password = pw;
                        _scheduleDraftSave();
                      },
                    ),
                  if (_visibleSteps.contains(_kStepReview))
                    _StepReview(
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
                    ),
                ],
              ),
            ),
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
                                strokeWidth: 2, color: Colors.white))
                        : Text(
                            _step == _kStepReview
                                ? 'Créer mon compte'
                                : 'Continuer',
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w600),
                          ),
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

// ═══════════════════════════════════════════════════════════════
// Header
// ═══════════════════════════════════════════════════════════════

class _Header extends StatelessWidget {
  final int currentStep, totalSteps, step;
  final VoidCallback onBack;

  const _Header({
    required this.currentStep,
    required this.totalSteps,
    required this.step,
    required this.onBack,
  });

  String get _title {
    switch (step) {
      case _kStepRole:
        return 'Type de compte';
      case _kStepEntityType:
        return "Type d'entité";
      case _kStepRespondent:
        return 'Informations du répondant';
      case _kStepEntityInfo:
        return "Informations de l'entité";
      case _kStepLocation:
        return 'Localisation';
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
    final double progress =
        totalSteps > 1 ? currentStep / (totalSteps - 1) : 1.0;
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(8, 12, 20, 16),
      child: Row(children: [
        IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: onBack,
          color: const Color(0xFF006B5E),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Text(_title,
                        style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF006B5E))),
                  ),
                  Text('${currentStep + 1} / $totalSteps',
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF666666))),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 5,
                  backgroundColor: Colors.grey.shade200,
                  color: const Color(0xFF006B5E),
                ),
              ),
            ],
          ),
        ),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Step 0 – Role
// ═══════════════════════════════════════════════════════════════

class _StepRole extends StatelessWidget {
  final bool isCompany;
  final ValueChanged<bool> onSelect;

  const _StepRole({required this.isCompany, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Créer un compte',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text('Sélectionnez votre profil pour commencer.',
            style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
        const SizedBox(height: 32),
        _RoleCard(
          value: 'COMPANY',
          selected: isCompany ? 'COMPANY' : '',
          icon: Icons.business_outlined,
          color: Colors.teal,
          title: 'Entreprise / Organisation',
          subtitle:
              'Société, coopérative, CTD, ONG ou centre de formation soumis à la déclaration DSMO.',
          onTap: (_) => onSelect(true),
        ),
      ]),
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
                            fontSize: 12,
                            color: Color(0xFF666666),
                            height: 1.4)),
                  ]),
            ),
            const SizedBox(width: 6),
            Icon(isSelected ? Icons.check_circle : Icons.circle_outlined,
                color: isSelected ? color : Colors.grey.shade300),
          ]),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Step 1 – Entity type
// ═══════════════════════════════════════════════════════════════

class _StepEntityType extends StatelessWidget {
  final EntityType? selected;
  final ValueChanged<EntityType> onSelect;

  const _StepEntityType({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text("Type d'entité",
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text('Sélectionnez la catégorie juridique de votre organisation.',
            style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
        const SizedBox(height: 24),
        ...EntityType.values.map((type) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _EntityTypeCard(
                  type: type, selected: selected, onTap: onSelect),
            )),
      ]),
    );
  }
}

class _EntityTypeCard extends StatelessWidget {
  final EntityType type;
  final EntityType? selected;
  final ValueChanged<EntityType> onTap;

  const _EntityTypeCard(
      {required this.type, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final config = entityConfigs[type]!;
    final bool isSelected = selected == type;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: isSelected ? config.color.withAlpha(18) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isSelected ? config.color : Colors.grey.shade300,
            width: isSelected ? 2 : 1),
        boxShadow: [
          BoxShadow(
            color: isSelected
                ? config.color.withAlpha(40)
                : Colors.black.withAlpha(8),
            blurRadius: isSelected ? 12 : 4,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => onTap(type),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                  color: config.color.withAlpha(25),
                  borderRadius: BorderRadius.circular(12)),
              child: Icon(config.icon, color: config.color, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(config.title,
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: isSelected ? config.color : Colors.black87)),
                    const SizedBox(height: 3),
                    Text(_subtitle(type),
                        style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF666666),
                            height: 1.4)),
                  ]),
            ),
            const SizedBox(width: 6),
            Icon(isSelected ? Icons.check_circle : Icons.circle_outlined,
                color: isSelected ? config.color : Colors.grey.shade300),
          ]),
        ),
      ),
    );
  }

  String _subtitle(EntityType type) {
    switch (type) {
      case EntityType.enterprise:
        return 'Société commerciale, SA, SARL, établissement à but lucratif.';
      case EntityType.cooperative:
        return "Société coopérative ou groupement d'intérêt économique.";
      case EntityType.ctd:
        return 'Collectivité Territoriale Décentralisée (commune, région).';
      case EntityType.ong:
        return 'Organisation Non Gouvernementale ou association.';
      case EntityType.vocational:
        return 'Centre de formation technique et professionnelle.';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Step 2 – Respondent
// ═══════════════════════════════════════════════════════════════

class _StepRespondent extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final String initialFirstName, initialLastName, initialFunction;
  final String initialEmail, initialPhone1, initialPhone2;
  final void Function(String, String, String, String, String, String) onChanged;

  const _StepRespondent({
    super.key,
    required this.formKey,
    required this.initialFirstName,
    required this.initialLastName,
    required this.initialFunction,
    required this.initialEmail,
    required this.initialPhone1,
    required this.initialPhone2,
    required this.onChanged,
  });

  @override
  State<_StepRespondent> createState() => _StepRespondentState();
}

class _StepRespondentState extends State<_StepRespondent> {
  late final TextEditingController _firstNameCtrl,
      _lastNameCtrl,
      _emailCtrl,
      _phone1Ctrl,
      _phone2Ctrl;
  String _function = '';

  @override
  void initState() {
    super.initState();
    _function = widget.initialFunction;
    _firstNameCtrl = TextEditingController(text: widget.initialFirstName);
    _lastNameCtrl = TextEditingController(text: widget.initialLastName);
    _emailCtrl = TextEditingController(text: widget.initialEmail);
    _phone1Ctrl = TextEditingController(text: widget.initialPhone1);
    _phone2Ctrl = TextEditingController(text: widget.initialPhone2);
    _firstNameCtrl.addListener(_notify);
    _lastNameCtrl.addListener(_notify);
    _emailCtrl.addListener(_notify);
    _phone1Ctrl.addListener(_notify);
    _phone2Ctrl.addListener(_notify);
  }

  void _notify() {
    widget.onChanged(
      _firstNameCtrl.text.trim(),
      _lastNameCtrl.text.trim(),
      _function,
      _emailCtrl.text.trim(),
      _phone1Ctrl.text.trim(),
      _phone2Ctrl.text.trim(),
    );
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _emailCtrl.dispose();
    _phone1Ctrl.dispose();
    _phone2Ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Form(
        key: widget.formKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Informations du répondant',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text(
              'Ces informations pré-rempliront la Section 0 du formulaire ONEFOP.',
              style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
          const SizedBox(height: 28),
          Row(children: [
            Expanded(
                child: _Field(
                    controller: _firstNameCtrl,
                    label: 'Prénom *',
                    icon: Icons.person_outline,
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Requis' : null)),
            const SizedBox(width: 12),
            Expanded(
                child: _Field(
                    controller: _lastNameCtrl,
                    label: 'Nom *',
                    icon: Icons.badge_outlined,
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Requis' : null)),
          ]),
          const SizedBox(height: 14),
          const _FieldLabel(label: 'Fonction *'),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: _function.isNotEmpty ? _function : null,
            isExpanded: true,
            decoration: _modernDropdown(),
            hint: const Text('Sélectionner votre fonction',
                style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
            items: _kRespondentFunctionOptions
                .map((o) => DropdownMenuItem(
                    value: o,
                    child: Text(o,
                        style: const TextStyle(
                            fontSize: 14, color: Color(0xFF1E293B)))))
                .toList(),
            onChanged: (v) {
              setState(() => _function = v ?? '');
              _notify();
            },
            validator: (v) => (v == null || v.isEmpty) ? 'Requis' : null,
          ),
          const SizedBox(height: 14),
          _Field(
              controller: _emailCtrl,
              label: 'E-mail professionnel *',
              icon: Icons.email_outlined,
              keyboardType: TextInputType.emailAddress,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Email requis';
                if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim()))
                  return 'Email invalide';
                return null;
              }),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(
                child: _PhoneField(
                    controller: _phone1Ctrl,
                    label: 'Téléphone 1 *',
                    isRequired: true)),
            const SizedBox(width: 12),
            Expanded(
                child: _PhoneField(
                    controller: _phone2Ctrl,
                    label: 'Téléphone 2',
                    isRequired: false)),
          ]),
          const SizedBox(height: 16),
          const _InfoBox(
            icon: Icons.auto_fix_high_outlined,
            color: Colors.teal,
            text:
                'Ces informations seront automatiquement pré-remplies dans la Section 0 de vos futures déclarations ONEFOP.',
          ),
        ]),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Step 3 – Entity info
// ═══════════════════════════════════════════════════════════════

class _StepEntityInfo extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final EntityType? entityType;
  final EntityConfig? config;
  final Map<String, TextEditingController> controllers;
  final Map<String, dynamic> entityData;
  final VoidCallback onChanged;
  final void Function(String key, String? value) onDropdownChanged;

  const _StepEntityInfo({
    super.key,
    required this.formKey,
    required this.entityType,
    required this.config,
    required this.controllers,
    required this.entityData,
    required this.onChanged,
    required this.onDropdownChanged,
  });

  @override
  State<_StepEntityInfo> createState() => _StepEntityInfoState();
}

class _StepEntityInfoState extends State<_StepEntityInfo> {
  @override
  Widget build(BuildContext context) {
    if (widget.entityType == null || widget.config == null) {
      return const Center(
          child: Text("Veuillez sélectionner un type d'entité"));
    }
    final config = widget.config!;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Form(
        key: widget.formKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(config.title,
              style:
                  const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text(
              'Ces informations pré-rempliront la Section 1 du formulaire ONEFOP.',
              style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
          const SizedBox(height: 28),
          ...config.fields.map(_buildField),
          const SizedBox(height: 16),
          const _InfoBox(
            icon: Icons.auto_fix_high_outlined,
            color: Colors.teal,
            text:
                'Ces informations seront automatiquement pré-remplies dans la Section 1 de vos futures déclarations ONEFOP.',
          ),
        ]),
      ),
    );
  }

  Widget _buildField(EntityField field) {
    if (field.options != null) {
      final cur = widget.entityData[field.key] as String?;
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _FieldLabel(label: '${field.label}${field.required ? ' *' : ''}'),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: (cur != null && field.options!.contains(cur)) ? cur : null,
            isExpanded: true,
            decoration: _modernDropdown(),
            hint: const Text('Sélectionner',
                style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
            items: field.options!
                .map((o) => DropdownMenuItem(
                    value: o,
                    child: Text(o,
                        style: const TextStyle(
                            fontSize: 14, color: Color(0xFF1E293B)))))
                .toList(),
            onChanged: (v) {
              widget.onDropdownChanged(field.key, v);
              setState(() {});
            },
            validator: field.required
                ? (v) => (v == null || v.isEmpty) ? 'Requis' : null
                : null,
          ),
        ]),
      );
    }

    if (field.isPhone) {
      final ctrl = widget.controllers[field.key] ?? TextEditingController();
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: _PhoneField(
          controller: ctrl,
          label: '${field.label}${field.required ? ' *' : ''}',
          isRequired: field.required,
        ),
      );
    }

    final controller = widget.controllers[field.key];
    if (controller == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: controller,
        keyboardType: field.keyboardType,
        textInputAction: TextInputAction.next,
        inputFormatters: field.keyboardType == TextInputType.number
            ? [FilteringTextInputFormatter.digitsOnly]
            : null,
        style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
        decoration: _modernInput(
          hasError: false,
          labelText: '${field.label}${field.required ? ' *' : ''}',
          hintText: field.hint,
          prefixIcon: Icon(_iconForKey(field.key), size: 20),
        ),
        validator: field.required
            ? (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null
            : null,
        onChanged: (_) => widget.onChanged(),
      ),
    );
  }

  IconData _iconForKey(String key) {
    switch (key) {
      case 'companyName':
      case 'cooperativeName':
      case 'ctdName':
      case 'ngoName':
      case 'centerName':
        return Icons.business_outlined;
      case 'taxNumber':
      case 'registrationNumber':
        return Icons.numbers_outlined;
      case 'cnpsNumber':
        return Icons.shield_outlined;
      case 'legalStatus':
        return Icons.gavel_outlined;
      case 'mainActivity':
      case 'trainingDomains':
        return Icons.work_outline;
      case 'address':
      case 'cooperativeHeadOffice':
        return Icons.location_on_outlined;
      case 'phone':
      case 'phone2':
        return Icons.phone_outlined;
      case 'poBox':
        return Icons.markunread_mailbox_outlined;
      case 'cooperativeType':
      case 'ctdType':
        return Icons.category_outlined;
      case 'yearOfCreation':
        return Icons.calendar_today_outlined;
      case 'mainMission':
        return Icons.flag_outlined;
      default:
        return Icons.edit_outlined;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Step 4 – Location
// ═══════════════════════════════════════════════════════════════

class _StepLocation extends StatefulWidget {
  final List<dynamic> regions, departments, subdivisions, sectors;
  final bool loadingRegions,
      loadingDepartments,
      loadingSubdivisions,
      loadingSectors;
  final Map<String, dynamic>? selectedRegion,
      selectedDepartment,
      selectedSubdivision,
      selectedSector;
  final String? selectedArea;
  final ValueChanged<Map<String, dynamic>?> onRegionChanged;
  final ValueChanged<Map<String, dynamic>?> onDepartmentChanged;
  final ValueChanged<Map<String, dynamic>?> onSubdivisionChanged;
  final ValueChanged<String?> onAreaChanged;
  final ValueChanged<Map<String, dynamic>?> onSectorChanged;
  final VoidCallback onInit;

  const _StepLocation({
    required this.regions,
    required this.departments,
    required this.subdivisions,
    required this.sectors,
    required this.loadingRegions,
    required this.loadingDepartments,
    required this.loadingSubdivisions,
    required this.loadingSectors,
    required this.selectedRegion,
    required this.selectedDepartment,
    required this.selectedSubdivision,
    required this.selectedArea,
    required this.selectedSector,
    required this.onRegionChanged,
    required this.onDepartmentChanged,
    required this.onSubdivisionChanged,
    required this.onAreaChanged,
    required this.onSectorChanged,
    required this.onInit,
  });

  @override
  State<_StepLocation> createState() => _StepLocationState();
}

class _StepLocationState extends State<_StepLocation> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => widget.onInit());
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Localisation',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text(
            'Ces informations pré-rempliront la localisation dans le formulaire ONEFOP.',
            style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
        const SizedBox(height: 28),
        widget.loadingRegions
            ? const _LoadingField(label: 'Région *')
            : _LocationDropdown(
                label: 'Région *',
                icon: Icons.map_outlined,
                hint: 'Sélectionner une région',
                items: widget.regions,
                selected: widget.selectedRegion,
                onChanged: widget.onRegionChanged,
              ),
        const SizedBox(height: 16),
        widget.loadingDepartments
            ? const _LoadingField(label: 'Département *')
            : _LocationDropdown(
                label: 'Département *',
                icon: Icons.location_city_outlined,
                hint: widget.selectedRegion == null
                    ? "Sélectionnez d'abord une région"
                    : 'Sélectionner un département',
                items: widget.departments,
                selected: widget.selectedDepartment,
                onChanged: widget.selectedRegion == null
                    ? null
                    : widget.onDepartmentChanged,
              ),
        const SizedBox(height: 16),
        widget.loadingSubdivisions
            ? const _LoadingField(label: 'Arrondissement')
            : _LocationDropdown(
                label: 'Arrondissement',
                icon: Icons.place_outlined,
                hint: widget.selectedDepartment == null
                    ? "Sélectionnez d'abord un département"
                    : widget.subdivisions.isEmpty
                        ? 'Aucun arrondissement disponible'
                        : 'Sélectionner un arrondissement',
                items: widget.subdivisions,
                selected: widget.selectedSubdivision,
                onChanged: widget.selectedDepartment == null
                    ? null
                    : widget.onSubdivisionChanged,
                required: false,
              ),
        const SizedBox(height: 16),
        const _FieldLabel(label: 'Milieu de résidence'),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: widget.selectedArea,
          isExpanded: true,
          decoration: _modernDropdown(),
          hint: const Text('Urbain ou Rural',
              style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
          items: _kAreaOptions
              .map((o) => DropdownMenuItem(
                  value: o,
                  child: Text(o,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF1E293B)))))
              .toList(),
          onChanged: widget.onAreaChanged,
        ),
        const SizedBox(height: 16),
        widget.loadingSectors
            ? const _LoadingField(label: "Secteur d'activité")
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _FieldLabel(label: "Secteur d'activité"),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<Map<String, dynamic>>(
                    value: widget.selectedSector,
                    isExpanded: true,
                    decoration: _modernDropdown(),
                    hint: const Text('Sélectionner un secteur',
                        style:
                            TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
                    items: widget.sectors
                        .map((s) => DropdownMenuItem<Map<String, dynamic>>(
                            value: s as Map<String, dynamic>,
                            child: Text(s['name'] as String? ?? '',
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 13, color: Color(0xFF1E293B)))))
                        .toList(),
                    onChanged: widget.onSectorChanged,
                  ),
                ],
              ),
        const SizedBox(height: 20),
        const _InfoBox(
          icon: Icons.auto_fix_high_outlined,
          color: Colors.teal,
          text:
              'Ces informations seront automatiquement pré-remplies dans la Section 1 de vos déclarations ONEFOP.',
        ),
      ]),
    );
  }
}

class _LoadingField extends StatelessWidget {
  final String label;
  const _LoadingField({required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _FieldLabel(label: label),
      const SizedBox(height: 6),
      Container(
        height: 52,
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Center(
            child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2))),
      ),
    ]);
  }
}

class _LocationDropdown extends StatelessWidget {
  final String label, hint;
  final IconData icon;
  final List<dynamic> items;
  final Map<String, dynamic>? selected;
  final ValueChanged<Map<String, dynamic>?>? onChanged;
  final bool required;

  const _LocationDropdown({
    required this.label,
    required this.hint,
    required this.icon,
    required this.items,
    required this.selected,
    required this.onChanged,
    this.required = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _FieldLabel(label: label),
      const SizedBox(height: 6),
      DropdownButtonFormField<Map<String, dynamic>>(
        value: selected,
        isExpanded: true,
        decoration: _modernDropdown().copyWith(
          prefixIcon: Icon(icon, size: 20),
        ),
        hint: Text(hint,
            style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
        items: items
            .map((item) => DropdownMenuItem<Map<String, dynamic>>(
                  value: item as Map<String, dynamic>,
                  child: Text(item['name'] as String? ?? '',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF1E293B))),
                ))
            .toList(),
        onChanged: onChanged,
        validator: required ? (v) => v == null ? 'Requis' : null : null,
      ),
    ]);
  }
}

// ═══════════════════════════════════════════════════════════════
// Step 5 – Security
// ═══════════════════════════════════════════════════════════════

class _StepSecurity extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final String initialPassword;
  final void Function(String) onChanged;

  const _StepSecurity({
    required this.formKey,
    required this.initialPassword,
    required this.onChanged,
  });

  @override
  State<_StepSecurity> createState() => _StepSecurityState();
}

class _StepSecurityState extends State<_StepSecurity> {
  late final TextEditingController _pwCtrl, _confirmCtrl;
  bool _obscurePw = true;
  bool _obscureConfirm = true;

  @override
  void initState() {
    super.initState();
    _pwCtrl = TextEditingController(text: widget.initialPassword);
    _confirmCtrl = TextEditingController();
    _pwCtrl.addListener(() => widget.onChanged(_pwCtrl.text));
  }

  @override
  void dispose() {
    _pwCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Form(
        key: widget.formKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Sécurisez votre compte',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Choisissez un mot de passe robuste.',
              style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
          const SizedBox(height: 28),
          TextFormField(
            controller: _pwCtrl,
            obscureText: _obscurePw,
            textInputAction: TextInputAction.next,
            style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
            decoration: _modernInput(
              hasError: false,
              labelText: 'Mot de passe *',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                  icon: Icon(_obscurePw
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined),
                  onPressed: () => setState(() => _obscurePw = !_obscurePw)),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Mot de passe requis';
              if (v.length < 8) return 'Minimum 8 caractères';
              return null;
            },
          ),
          const SizedBox(height: 20),
          TextFormField(
            controller: _confirmCtrl,
            obscureText: _obscureConfirm,
            textInputAction: TextInputAction.done,
            style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
            decoration: _modernInput(
              hasError: false,
              labelText: 'Confirmer le mot de passe *',
              prefixIcon: const Icon(Icons.lock_clock_outlined),
              suffixIcon: IconButton(
                  icon: Icon(_obscureConfirm
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined),
                  onPressed: () =>
                      setState(() => _obscureConfirm = !_obscureConfirm)),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Confirmation requise';
              if (v != _pwCtrl.text)
                return 'Les mots de passe ne correspondent pas';
              return null;
            },
          ),
        ]),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Step 6 – Review
// ═══════════════════════════════════════════════════════════════

class _StepReview extends StatelessWidget {
  final EntityType? entityType;
  final String respondentFirstName, respondentLastName, respondentFunction;
  final String respondentEmail, respondentPhone1, respondentPhone2;
  final Map<String, dynamic> entityData;
  final Map<String, dynamic>? selectedRegion,
      selectedDepartment,
      selectedSubdivision,
      selectedSector;
  final String? selectedArea;

  const _StepReview({
    required this.entityType,
    required this.respondentFirstName,
    required this.respondentLastName,
    required this.respondentFunction,
    required this.respondentEmail,
    required this.respondentPhone1,
    required this.respondentPhone2,
    required this.entityData,
    required this.selectedRegion,
    required this.selectedDepartment,
    required this.selectedSubdivision,
    required this.selectedArea,
    required this.selectedSector,
  });

  @override
  Widget build(BuildContext context) {
    final entityConfig = entityType != null ? entityConfigs[entityType] : null;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Récapitulatif',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text('Vérifiez vos informations avant de créer le compte.',
            style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
        const SizedBox(height: 24),
        if (entityConfig != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
                color: entityConfig.color.withAlpha(20),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: entityConfig.color.withAlpha(80))),
            child: Row(children: [
              Icon(entityConfig.icon, color: entityConfig.color),
              const SizedBox(width: 10),
              Text(entityConfig.title,
                  style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: entityConfig.color)),
            ]),
          ),
        const SizedBox(height: 16),
        _ReviewCard(
          title: 'Répondant (Section 0)',
          icon: Icons.person_outline,
          rows: [
            ('Nom complet', '$respondentFirstName $respondentLastName'),
            ('Fonction', respondentFunction),
            ('Email', respondentEmail),
            ('Téléphone 1', respondentPhone1),
            if (respondentPhone2.isNotEmpty) ('Téléphone 2', respondentPhone2),
          ],
        ),
        const SizedBox(height: 12),
        if (entityConfig != null && entityData.isNotEmpty)
          _ReviewCard(
            title: "Information de l'entité (Section 1)",
            icon: Icons.business_outlined,
            rows: entityConfig.fields
                .where((f) =>
                    entityData[f.key] != null &&
                    entityData[f.key].toString().isNotEmpty)
                .map((f) => (f.label, entityData[f.key].toString()))
                .toList(),
          ),
        const SizedBox(height: 12),
        _ReviewCard(
          title: 'Localisation',
          icon: Icons.map_outlined,
          rows: [
            if (selectedRegion != null)
              ('Région', selectedRegion!['name'] as String? ?? ''),
            if (selectedDepartment != null)
              ('Département', selectedDepartment!['name'] as String? ?? ''),
            if (selectedSubdivision != null)
              ('Arrondissement', selectedSubdivision!['name'] as String? ?? ''),
            if (selectedArea != null) ('Milieu', selectedArea!),
            if (selectedSector != null)
              ('Secteur', selectedSector!['name'] as String? ?? ''),
          ],
        ),
        const SizedBox(height: 16),
        const _InfoBox(
          icon: Icons.check_circle_outline,
          color: Colors.green,
          text:
              'Ces informations pré-rempliront automatiquement les Sections 0 et 1 de vos formulaires ONEFOP.',
        ),
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
    if (rows.isEmpty) return const SizedBox.shrink();
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
            Icon(icon, size: 16, color: const Color(0xFF006B5E)),
            const SizedBox(width: 8),
            Text(title,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF006B5E))),
          ]),
        ),
        const Divider(height: 1),
        ...rows.map((row) {
          final (label, value) = row;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
            child: Row(children: [
              SizedBox(
                  width: 140,
                  child: Text(label,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF666666)))),
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

// ═══════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════

class _FieldLabel extends StatelessWidget {
  final String label;
  const _FieldLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(label,
        style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Color(0xFF475569)));
  }
}

class _PhoneField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final bool isRequired;

  const _PhoneField({
    required this.controller,
    required this.label,
    required this.isRequired,
  });

  @override
  State<_PhoneField> createState() => _PhoneFieldState();
}

class _PhoneFieldState extends State<_PhoneField> {
  bool _dirty = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void didUpdateWidget(_PhoneField old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller.removeListener(_onTextChanged);
      widget.controller.addListener(_onTextChanged);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    super.dispose();
  }

  void _onTextChanged() {
    if (!_dirty && widget.controller.text.isNotEmpty) {
      setState(() => _dirty = true);
    } else if (_dirty) {
      setState(() {});
    }
  }

  bool get _hasError =>
      _dirty &&
      cameroonPhoneError(widget.controller.text, required: widget.isRequired) !=
          null;

  @override
  Widget build(BuildContext context) {
    final length = widget.controller.text.length;

    return TextFormField(
      controller: widget.controller,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.next,
      inputFormatters: kPhoneFormatters,
      autovalidateMode:
          _dirty ? AutovalidateMode.always : AutovalidateMode.disabled,
      style: const TextStyle(
        fontSize: 14,
        color: Color(0xFF1E293B),
        letterSpacing: 1.2,
      ),
      decoration: _modernInput(
        hasError: _hasError,
        labelText: widget.label,
        hintText: widget.isRequired ? '6XXXXXXXX' : 'Optionnel',
        prefixIcon: Icon(
          Icons.phone_outlined,
          size: 20,
          color: _hasError ? const Color(0xFFE24B4A) : null,
        ),
        suffixText: _dirty ? '$length / 9' : null,
        suffixStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: length == 9
              ? const Color(0xFF006B5E)
              : _hasError
                  ? const Color(0xFFE24B4A)
                  : const Color(0xFF94A3B8),
        ),
      ),
      validator: (v) => cameroonPhoneError(v, required: widget.isRequired),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final String? hint;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final bool required;

  const _Field({
    required this.controller,
    required this.label,
    required this.icon,
    this.hint,
    this.keyboardType,
    this.validator,
    this.required = true,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        textInputAction: TextInputAction.next,
        style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
        decoration: _modernInput(
          hasError: false,
          labelText: label,
          hintText: hint,
          prefixIcon: Icon(icon, size: 20),
        ),
        validator: required
            ? validator ??
                (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null
            : validator,
      ),
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
