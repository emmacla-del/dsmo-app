// lib/screens/register_steps.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'register_constants.dart';
import 'register_widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../widgets/email_field_with_availability.dart';
import '../data/api_client.dart';
import '../data/minefop_models.dart';

// ════════════════════════════════════════════════════════════════
// STEP 0 — Role selection
// ════════════════════════════════════════════════════════════════

class StepRole extends StatefulWidget {
  final String role;
  final ValueChanged<String> onSelect;

  const StepRole({super.key, required this.role, required this.onSelect});

  @override
  State<StepRole> createState() => _StepRoleState();
}

class _StepRoleState extends State<StepRole> {
  // null  → default view (two role cards)
  // ''    → MINEFOP drill-down open, nothing selected yet
  // 'CENTRAL' | 'REGIONAL' | 'DIVISIONAL' → user chose a level
  String? _pendingMinefopRole;

  @override
  void initState() {
    super.initState();
    // Restore a previously chosen level when the user navigates back.
    if (widget.role == 'CENTRAL' ||
        widget.role == 'REGIONAL' ||
        widget.role == 'DIVISIONAL') {
      _pendingMinefopRole = widget.role;
    }
  }

  bool get _isCompanySelected => widget.role == 'COMPANY';
  bool get _isMinefopPanelOpen => _pendingMinefopRole != null;

  @override
  Widget build(BuildContext context) {
    // ── MINEFOP drill-down: show ONLY the level picker ────────
    if (_isMinefopPanelOpen) {
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Back arrow to return to role cards
          GestureDetector(
            onTap: () => setState(() {
              _pendingMinefopRole = null;
              widget.onSelect('');
            }),
            child: const Row(children: [
              Icon(Icons.arrow_back_ios, size: 16, color: Color(0xFF666666)),
              SizedBox(width: 4),
              Text('Retour',
                  style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
            ]),
          ),
          const SizedBox(height: 24),
          const Text('Agent MINEFOP',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Précisez votre niveau hiérarchique.',
              style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
          const SizedBox(height: 32),

          ...kMinefopRoleOptions.map((roleKey) {
            final isSelected = _pendingMinefopRole == roleKey;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () {
                  setState(() => _pendingMinefopRole = roleKey);
                  widget.onSelect(roleKey);
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.indigo.shade50 : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? Colors.indigo : Colors.grey.shade300,
                      width: isSelected ? 2 : 1,
                    ),
                  ),
                  child: Row(children: [
                    Icon(
                      isSelected
                          ? Icons.radio_button_checked
                          : Icons.radio_button_off,
                      color: isSelected ? Colors.indigo : Colors.grey.shade400,
                      size: 22,
                    ),
                    const SizedBox(width: 12),
                    Text(
                      kMinefopRoleLabels[roleKey] ?? roleKey,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.normal,
                        color: isSelected
                            ? Colors.indigo.shade800
                            : Colors.black87,
                      ),
                    ),
                  ]),
                ),
              ),
            );
          }),

          const SizedBox(height: 8),
          const InfoBox(
            icon: Icons.info_outline,
            color: Colors.indigo,
            text:
                'Votre compte sera activé après validation par un administrateur.',
          ),
        ]),
      );
    }

    // ── Default view: show the two role cards ─────────────────
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Créer un compte',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text('Sélectionnez votre profil pour commencer.',
            style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
        const SizedBox(height: 32),

        // ── COMPANY card ──────────────────────────────────
        RoleCard(
          value: 'COMPANY',
          selected: _isCompanySelected ? 'COMPANY' : '',
          icon: Icons.business_outlined,
          color: Colors.teal,
          title: 'Entreprise / Organisation',
          subtitle:
              'Société, coopérative, CTD, ONG ou centre de formation soumis '
              'à la déclaration ONEFOP / DSMO.',
          onTap: (_) {
            setState(() => _pendingMinefopRole = null);
            widget.onSelect('COMPANY');
          },
        ),
        const SizedBox(height: 12),

        // ── MINEFOP card ──────────────────────────────────
        RoleCard(
          value: 'MINEFOP',
          selected: '',
          icon: Icons.account_balance_outlined,
          color: Colors.indigo,
          title: 'Agent MINEFOP',
          subtitle: "Inspecteur ou agent du Ministère de l'Emploi et de la "
              'Formation Professionnelle.',
          onTap: (_) => setState(() {
            _pendingMinefopRole ??= '';
          }),
        ),
      ]),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 1 — Entity type (COMPANY only)
// ════════════════════════════════════════════════════════════════

class StepEntityType extends StatelessWidget {
  final EntityType? selected;
  final ValueChanged<EntityType> onSelect;

  const StepEntityType(
      {super.key, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text("Type d'entité",
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text(
          "Sélectionnez la catégorie juridique de votre organisation. "
          "Cela déterminera quels champs sont demandés et pré-remplis dans "
          "vos formulaires ONEFOP / DSMO.",
          style: TextStyle(color: Color(0xFF666666), fontSize: 14),
        ),
        const SizedBox(height: 24),
        ...EntityType.values.map((type) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: EntityTypeCard(
                  type: type, selected: selected, onTap: onSelect),
            )),
      ]),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 2 — Respondent / personal info  (Section 0 of ONEFOP)
// ════════════════════════════════════════════════════════════════

class StepRespondent extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final String initialFirstName,
      initialLastName,
      initialFunction,
      initialEmail,
      initialPhone1,
      initialPhone2;
  final bool isMinefop;
  final void Function(
          String fn, String ln, String func, String email, String p1, String p2)
      onChanged;
  final void Function(bool)? onEmailAvailabilityChanged;

  const StepRespondent({
    super.key,
    required this.formKey,
    required this.initialFirstName,
    required this.initialLastName,
    required this.initialFunction,
    required this.initialEmail,
    required this.initialPhone1,
    required this.initialPhone2,
    required this.isMinefop,
    required this.onChanged,
    this.onEmailAvailabilityChanged,
  });

  @override
  State<StepRespondent> createState() => _StepRespondentState();
}

class _StepRespondentState extends State<StepRespondent> {
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
    for (final ctrl in [
      _firstNameCtrl,
      _lastNameCtrl,
      _emailCtrl,
      _phone1Ctrl,
      _phone2Ctrl
    ]) {
      ctrl.addListener(_notify);
    }
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
    for (final ctrl in [
      _firstNameCtrl,
      _lastNameCtrl,
      _emailCtrl,
      _phone1Ctrl,
      _phone2Ctrl
    ]) {
      ctrl.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Form(
        key: widget.formKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            widget.isMinefop
                ? 'Vos informations personnelles'
                : 'Informations du répondant',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(
            widget.isMinefop
                ? 'Ces informations seront associées à votre compte agent MINEFOP.'
                : 'Ces informations pré-rempliront la Section 0 (Répondant) '
                    'du formulaire ONEFOP et la Partie A de vos déclarations DSMO.',
            style: const TextStyle(color: Color(0xFF666666), fontSize: 14),
          ),
          const SizedBox(height: 28),

          Row(children: [
            Expanded(
                child: Field(
                    controller: _firstNameCtrl,
                    label: 'Prénom *',
                    icon: Icons.person_outline,
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Requis' : null)),
            const SizedBox(width: 12),
            Expanded(
                child: Field(
                    controller: _lastNameCtrl,
                    label: 'Nom *',
                    icon: Icons.badge_outlined,
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Requis' : null)),
          ]),
          const SizedBox(height: 14),

          // Function dropdown (company only — ONEFOP Section 0 Q4)
          if (!widget.isMinefop) ...[
            const FieldLabel(label: 'Fonction *'),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _function.isNotEmpty ? _function : null,
              isExpanded: true,
              decoration: modernDropdown(),
              hint: const Text('Sélectionner votre fonction',
                  style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
              items: kRespondentFunctionOptions
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
          ],

          EmailFieldWithAvailability(
            controller: _emailCtrl,
            label: 'E-mail professionnel *',
            isRequired: true,
            onEmailValidated: _notify,
            onEmailAvailabilityChanged: widget.onEmailAvailabilityChanged,
          ),
          const SizedBox(height: 14),

          Row(children: [
            Expanded(
                child: PhoneField(
                    controller: _phone1Ctrl,
                    label: 'Téléphone 1 *',
                    isRequired: true)),
            const SizedBox(width: 12),
            Expanded(
                child: PhoneField(
                    controller: _phone2Ctrl,
                    label: 'Téléphone 2',
                    isRequired: false)),
          ]),
          const SizedBox(height: 16),

          if (!widget.isMinefop)
            const InfoBox(
              icon: Icons.auto_fix_high_outlined,
              color: Colors.teal,
              text: 'Ces informations seront automatiquement pré-remplies dans '
                  'la Section 0 de vos futurs formulaires ONEFOP et dans '
                  'la Partie A de vos déclarations DSMO.',
            ),
        ]),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 3 — Entity info  (Section 1 of ONEFOP / Part A of DSMO)
// ════════════════════════════════════════════════════════════════

class StepEntityInfo extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final EntityType? entityType;
  final EntityConfig? config;
  final Map<String, TextEditingController> controllers;
  final Map<String, dynamic> entityData;
  final VoidCallback onChanged;
  final void Function(String key, String? value) onDropdownChanged;

  const StepEntityInfo({
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
  State<StepEntityInfo> createState() => _StepEntityInfoState();
}

class _StepEntityInfoState extends State<StepEntityInfo> {
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
          Text(
            widget.entityType!.formSectionLabel,
            style: const TextStyle(color: Color(0xFF666666), fontSize: 14),
          ),
          const SizedBox(height: 28),
          ...config.fields.map(_buildField),
          const SizedBox(height: 16),
          const InfoBox(
            icon: Icons.auto_fix_high_outlined,
            color: Colors.teal,
            text: 'Ces informations seront automatiquement pré-remplies dans '
                'la Section 1 de vos futurs formulaires ONEFOP et dans '
                'la Partie A de vos déclarations DSMO.',
          ),
        ]),
      ),
    );
  }

  Widget _buildField(EntityField field) {
    // ── Dropdown field ──────────────────────────────────────
    if (field.options != null) {
      final cur = widget.entityData[field.key] as String?;
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          FieldLabel(label: '${field.label}${field.required ? ' *' : ''}'),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue:
                (cur != null && field.options!.contains(cur)) ? cur : null,
            isExpanded: true,
            decoration: modernDropdown(),
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

    // ── Phone field ─────────────────────────────────────────
    if (field.isPhone) {
      final ctrl = widget.controllers[field.key] ??
          TextEditingController(text: widget.entityData[field.key]?.toString());
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: PhoneField(
          controller: ctrl,
          label: '${field.label}${field.required ? ' *' : ''}',
          isRequired: field.required,
        ),
      );
    }

    // ── Text field ──────────────────────────────────────────
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
        decoration: modernInput(
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
      case 'mainMission':
        return Icons.flag_outlined;
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
      case 'socialCapital':
        return Icons.account_balance_outlined;
      case 'parentCompany':
        return Icons.corporate_fare_outlined;
      case 'branch':
      case 'secondaryActivity':
        return Icons.work_history_outlined;
      default:
        return Icons.edit_outlined;
    }
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 4 (MINEFOP) — Service, position, location
// ════════════════════════════════════════════════════════════════

class StepMinefopInfo extends ConsumerStatefulWidget {
  final GlobalKey<FormState> formKey;
  final String role;
  final String initialMatricule;
  final String initialPoste;
  final String initialServiceCode;
  final String initialPositionType;
  final String? initialRegion;
  final String? initialDepartment;
  final void Function({
    required String matricule,
    required String poste,
    required String serviceCode,
    required String positionType,
    String? region,
    String? department,
  }) onChanged;

  const StepMinefopInfo({
    super.key,
    required this.formKey,
    required this.role,
    required this.initialMatricule,
    required this.initialPoste,
    required this.initialServiceCode,
    required this.initialPositionType,
    this.initialRegion,
    this.initialDepartment,
    required this.onChanged,
  });

  @override
  ConsumerState<StepMinefopInfo> createState() => _StepMinefopInfoState();
}

class _StepMinefopInfoState extends ConsumerState<StepMinefopInfo> {
  late final TextEditingController _matriculeCtrl;
  late final TextEditingController _posteCtrl;

  // Cascading service tree
  MinefopServiceNode? _selectedL1;
  MinefopServiceNode? _selectedL2;
  MinefopServiceNode? _selectedL3;
  MinefopServiceNode? _selectedL4;
  ServicePosition? _selectedPosition;

  List<MinefopServiceNode> _servicesL1 = [];
  List<MinefopServiceNode> _servicesL2 = [];
  List<MinefopServiceNode> _servicesL3 = [];
  List<MinefopServiceNode> _servicesL4 = [];
  List<ServicePosition> _positions = [];

  bool _loadingL1 = false;
  bool _loadingL2 = false;
  bool _loadingL3 = false;
  bool _loadingL4 = false;
  bool _loadingPositions = false;

  // Location (for REGIONAL / DIVISIONAL)
  String? _selectedRegion;
  String? _selectedDepartment;
  List<Map<String, dynamic>> _regions = [];
  List<Map<String, dynamic>> _departments = [];
  bool _loadingRegions = false;
  bool _loadingDepartments = false;

  bool get _isCentral => widget.role == 'CENTRAL';
  bool get _isRegional => widget.role == 'REGIONAL';
  bool get _isDivisional => widget.role == 'DIVISIONAL';
  bool get _needsLocation => _isRegional || _isDivisional;
  bool get _needsDepartment => _isDivisional;

  String get _roleLabel => kMinefopRoleLabels[widget.role] ?? widget.role;

  @override
  void initState() {
    super.initState();
    _matriculeCtrl = TextEditingController(text: widget.initialMatricule);
    _posteCtrl = TextEditingController(text: widget.initialPoste);
    _matriculeCtrl.addListener(_notify);
    _posteCtrl.addListener(_notify);
    _selectedRegion = widget.initialRegion;
    _selectedDepartment = widget.initialDepartment;
    _loadServicesL1();
    if (_needsLocation) _loadRegions();
  }

  @override
  void dispose() {
    _matriculeCtrl.dispose();
    _posteCtrl.dispose();
    super.dispose();
  }

  // ── API calls ───────────────────────────────────────────
  Future<void> _loadServicesL1() async {
    setState(() => _loadingL1 = true);
    try {
      final category = _isCentral ? 'CENTRALE' : 'DECONCENTRE';
      final data = await ref
          .read(apiClientProvider)
          .getMinefopServices(category: category, level: 1);
      if (mounted) {
        setState(() => _servicesL1 = data
            .map((e) => MinefopServiceNode.fromJson(e as Map<String, dynamic>))
            .toList());
      }
    } catch (e) {
      debugPrint('L1 services error: $e');
    } finally {
      if (mounted) setState(() => _loadingL1 = false);
    }
  }

  Future<void> _loadChildren(MinefopServiceNode parent, int level) async {
    void setLoading(bool v) => setState(() {
          if (level == 2) _loadingL2 = v;
          if (level == 3) _loadingL3 = v;
          if (level == 4) _loadingL4 = v;
        });

    void setList(List<MinefopServiceNode> list) => setState(() {
          if (level == 2) _servicesL2 = list;
          if (level == 3) _servicesL3 = list;
          if (level == 4) _servicesL4 = list;
        });

    setLoading(true);
    try {
      final data = await ref
          .read(apiClientProvider)
          .getMinefopServiceChildren(parent.code);
      if (mounted) {
        setList(data
            .map((e) => MinefopServiceNode.fromJson(e as Map<String, dynamic>))
            .toList());
      }
    } catch (e) {
      debugPrint('L$level children error: $e');
    } finally {
      if (mounted) setLoading(false);
    }
  }

  Future<void> _loadPositions(String serviceCode) async {
    setState(() {
      _loadingPositions = true;
      _positions = [];
      _selectedPosition = null;
    });
    try {
      final data = await ref
          .read(apiClientProvider)
          .getMinefopServicePositions(serviceCode);
      if (mounted) {
        setState(() => _positions = data
            .map((e) => ServicePosition.fromJson(e as Map<String, dynamic>))
            .toList());
      }
    } catch (e) {
      debugPrint('Positions error: $e');
    } finally {
      if (mounted) setState(() => _loadingPositions = false);
    }
  }

  Future<void> _loadRegions() async {
    setState(() => _loadingRegions = true);
    try {
      final data = await ref.read(apiClientProvider).getRegions();
      if (mounted) {
        setState(() => _regions = data.cast<Map<String, dynamic>>());
      }
    } catch (e) {
      debugPrint('Regions error: $e');
    } finally {
      if (mounted) setState(() => _loadingRegions = false);
    }
  }

  Future<void> _loadDepartments(String regionId) async {
    setState(() {
      _loadingDepartments = true;
      _departments = [];
      _selectedDepartment = null;
    });
    try {
      final data = await ref.read(apiClientProvider).getDepartments(regionId);
      if (mounted) {
        setState(() => _departments = data.cast<Map<String, dynamic>>());
      }
    } catch (e) {
      debugPrint('Departments error: $e');
    } finally {
      if (mounted) setState(() => _loadingDepartments = false);
    }
  }

  // ── Selection handlers ──────────────────────────────────
  void _onL1Changed(MinefopServiceNode? v) {
    setState(() {
      _selectedL1 = v;
      _selectedL2 = null;
      _selectedL3 = null;
      _selectedL4 = null;
      _selectedPosition = null;
      _servicesL2 = [];
      _servicesL3 = [];
      _servicesL4 = [];
      _positions = [];
    });
    if (v != null) {
      if (v.hasChildren) {
        _loadChildren(v, 2);
      } else {
        _loadPositions(v.code);
      }
    }
    _notify();
  }

  void _onL2Changed(MinefopServiceNode? v) {
    setState(() {
      _selectedL2 = v;
      _selectedL3 = null;
      _selectedL4 = null;
      _selectedPosition = null;
      _servicesL3 = [];
      _servicesL4 = [];
      _positions = [];
    });
    if (v != null) {
      if (v.hasChildren) {
        _loadChildren(v, 3);
      } else {
        _loadPositions(v.code);
      }
    }
    _notify();
  }

  void _onL3Changed(MinefopServiceNode? v) {
    setState(() {
      _selectedL3 = v;
      _selectedL4 = null;
      _selectedPosition = null;
      _servicesL4 = [];
      _positions = [];
    });
    if (v != null) {
      if (v.hasChildren) {
        _loadChildren(v, 4);
      } else {
        _loadPositions(v.code);
      }
    }
    _notify();
  }

  void _onL4Changed(MinefopServiceNode? v) {
    setState(() {
      _selectedL4 = v;
      _selectedPosition = null;
      _positions = [];
    });
    if (v != null) _loadPositions(v.code);
    _notify();
  }

  void _onPositionChanged(ServicePosition? v) {
    setState(() => _selectedPosition = v);
    _notify();
  }

  void _onRegionChanged(Map<String, dynamic>? v) {
    setState(() {
      _selectedRegion = v?['name'] as String?;
      _selectedDepartment = null;
      _departments = [];
    });
    if (v != null && _needsDepartment) {
      _loadDepartments(v['id'] as String);
    }
    _notify();
  }

  void _onDepartmentChanged(Map<String, dynamic>? v) {
    setState(() => _selectedDepartment = v?['name'] as String?);
    _notify();
  }

  void _notify() {
    final serviceCode = _selectedL4?.code ??
        _selectedL3?.code ??
        _selectedL2?.code ??
        _selectedL1?.code ??
        '';

    widget.onChanged(
      matricule: _matriculeCtrl.text.trim(),
      poste: _posteCtrl.text.trim(),
      serviceCode: serviceCode,
      positionType: _selectedPosition?.positionType ?? '',
      region: _selectedRegion,
      department: _selectedDepartment,
    );
  }

  // ── Build ────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Form(
        key: widget.formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Informations MINEFOP',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Text(
              'Renseignez vos informations en tant que $_roleLabel.',
              style: const TextStyle(color: Color(0xFF666666), fontSize: 14),
            ),
            const SizedBox(height: 28),

            // Role badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.indigo.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.indigo.shade200),
              ),
              child: Row(children: [
                const Icon(Icons.account_balance_outlined,
                    color: Colors.indigo, size: 18),
                const SizedBox(width: 8),
                Text(_roleLabel,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: Colors.indigo)),
              ]),
            ),
            const SizedBox(height: 24),

            // ── Cascading service tree ────────────────────
            _ServiceDropdown(
              label: 'Direction / Service principal *',
              hint: 'Sélectionnez votre direction',
              value: _selectedL1,
              items: _servicesL1,
              loading: _loadingL1,
              onChanged: _onL1Changed,
              validator: (v) => v == null ? 'Requis' : null,
            ),
            const SizedBox(height: 16),

            if (_selectedL1 != null && _selectedL1!.hasChildren) ...[
              _ServiceDropdown(
                label: 'Sous-direction / Cellule *',
                hint: 'Sélectionnez la sous-direction',
                value: _selectedL2,
                items: _servicesL2,
                loading: _loadingL2,
                onChanged: _onL2Changed,
                validator: (v) => v == null ? 'Requis' : null,
              ),
              const SizedBox(height: 16),
            ],

            if (_selectedL2 != null && _selectedL2!.hasChildren) ...[
              _ServiceDropdown(
                label: 'Service *',
                hint: 'Sélectionnez le service',
                value: _selectedL3,
                items: _servicesL3,
                loading: _loadingL3,
                onChanged: _onL3Changed,
                validator: (v) => v == null ? 'Requis' : null,
              ),
              const SizedBox(height: 16),
            ],

            if (_selectedL3 != null && _selectedL3!.hasChildren) ...[
              _ServiceDropdown(
                label: 'Bureau *',
                hint: 'Sélectionnez le bureau',
                value: _selectedL4,
                items: _servicesL4,
                loading: _loadingL4,
                onChanged: _onL4Changed,
                validator: (v) => v == null ? 'Requis' : null,
              ),
              const SizedBox(height: 16),
            ],

            // Position dropdown — shown when leaf node reached
            if (_leafReached()) ...[
              _PositionDropdown(
                positions: _positions,
                loading: _loadingPositions,
                selected: _selectedPosition,
                onChanged: _onPositionChanged,
              ),
              const SizedBox(height: 16),
            ],

            // ── Location (REGIONAL / DIVISIONAL) ──────────
            if (_needsLocation) ...[
              const Divider(height: 32),
              Text('Localisation',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.indigo.shade700)),
              const SizedBox(height: 16),
              _LocationFormDropdown(
                label: 'Région *',
                hint: 'Sélectionnez votre région',
                icon: Icons.location_on_outlined,
                items: _regions,
                selectedName: _selectedRegion,
                loading: _loadingRegions,
                onChanged: _onRegionChanged,
                validator: (v) => v == null ? 'Requis' : null,
              ),
              const SizedBox(height: 16),
              if (_needsDepartment) ...[
                _LocationFormDropdown(
                  label: 'Département *',
                  hint: _selectedRegion == null
                      ? "Sélectionnez d'abord une région"
                      : 'Sélectionnez votre département',
                  icon: Icons.location_city_outlined,
                  items: _selectedRegion != null ? _departments : [],
                  selectedName: _selectedDepartment,
                  loading: _loadingDepartments,
                  onChanged:
                      _selectedRegion != null ? _onDepartmentChanged : null,
                  validator: (v) => v == null ? 'Requis' : null,
                ),
                const SizedBox(height: 16),
              ],
            ],

            // ── Matricule & Poste ──────────────────────────
            const Divider(height: 32),
            Field(
              controller: _matriculeCtrl,
              label: 'Matricule *',
              icon: Icons.badge_outlined,
              hint: 'Votre matricule de fonctionnaire',
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Matricule requis' : null,
            ),
            Field(
              controller: _posteCtrl,
              label: 'Poste occupé *',
              icon: Icons.work_outline,
              hint: 'Ex: Inspecteur du travail',
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Poste requis' : null,
            ),
            const SizedBox(height: 16),

            const InfoBox(
              icon: Icons.info_outline,
              color: Colors.indigo,
              text: 'Ces informations seront vérifiées lors de la validation '
                  'de votre compte par un administrateur.',
            ),
          ],
        ),
      ),
    );
  }

  bool _leafReached() {
    if (_selectedL4 != null) return true;
    if (_selectedL3 != null && !_selectedL3!.hasChildren) return true;
    if (_selectedL2 != null && !_selectedL2!.hasChildren) return true;
    if (_selectedL1 != null && !_selectedL1!.hasChildren) return true;
    return false;
  }
}

// ── Private sub-widgets for StepMinefopInfo ───────────────────

class _ServiceDropdown extends StatelessWidget {
  final String label, hint;
  final MinefopServiceNode? value;
  final List<MinefopServiceNode> items;
  final bool loading;
  final void Function(MinefopServiceNode?) onChanged;
  final String? Function(MinefopServiceNode?)? validator;

  const _ServiceDropdown({
    required this.label,
    required this.hint,
    required this.value,
    required this.items,
    required this.loading,
    required this.onChanged,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      FieldLabel(label: label),
      const SizedBox(height: 6),
      if (loading)
        _buildLoadingField()
      else
        DropdownButtonFormField<MinefopServiceNode>(
          initialValue: value,
          isExpanded: true,
          decoration: modernDropdown().copyWith(
              prefixIcon: const Icon(Icons.account_balance_outlined, size: 20)),
          hint: Text(hint,
              style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
          items: items
              .map((s) => DropdownMenuItem(
                    value: s,
                    child: Text(s.displayName,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 14, color: Color(0xFF1E293B))),
                  ))
              .toList(),
          onChanged: onChanged,
          validator: validator,
        ),
    ]);
  }

  Widget _buildLoadingField() => Container(
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
      );
}

class _PositionDropdown extends StatelessWidget {
  final List<ServicePosition> positions;
  final bool loading;
  final ServicePosition? selected;
  final void Function(ServicePosition?) onChanged;

  const _PositionDropdown({
    required this.positions,
    required this.loading,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const FieldLabel(label: 'Fonction / Poste *'),
      const SizedBox(height: 6),
      if (loading)
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
        )
      else
        DropdownButtonFormField<ServicePosition>(
          initialValue: selected,
          isExpanded: true,
          decoration: modernDropdown()
              .copyWith(prefixIcon: const Icon(Icons.work_outline, size: 20)),
          hint: const Text('Sélectionnez votre fonction',
              style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
          items: positions
              .map((p) => DropdownMenuItem(
                    value: p,
                    child: Text(
                      p.titleEn != null ? '${p.title} / ${p.titleEn}' : p.title,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF1E293B)),
                    ),
                  ))
              .toList(),
          onChanged: onChanged,
          validator: (v) => v == null ? 'Fonction requise' : null,
        ),
    ]);
  }
}

class _LocationFormDropdown extends StatelessWidget {
  final String label, hint;
  final IconData icon;
  final List<Map<String, dynamic>> items;
  final String? selectedName;
  final bool loading;
  final void Function(Map<String, dynamic>?)? onChanged;
  final String? Function(Map<String, dynamic>?)? validator;

  const _LocationFormDropdown({
    required this.label,
    required this.hint,
    required this.icon,
    required this.items,
    required this.selectedName,
    required this.loading,
    required this.onChanged,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    final selected = items.isNotEmpty && selectedName != null
        ? items.firstWhere((r) => r['name'] == selectedName,
            orElse: () => <String, dynamic>{})
        : null;
    final resolvedSelected =
        (selected != null && selected.isNotEmpty) ? selected : null;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      FieldLabel(label: label),
      const SizedBox(height: 6),
      if (loading)
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
        )
      else
        DropdownButtonFormField<Map<String, dynamic>>(
          initialValue: resolvedSelected,
          isExpanded: true,
          decoration:
              modernDropdown().copyWith(prefixIcon: Icon(icon, size: 20)),
          hint: Text(hint,
              style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
          items: items
              .map((item) => DropdownMenuItem<Map<String, dynamic>>(
                    value: item,
                    child: Text(item['name'] as String? ?? '',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 14, color: Color(0xFF1E293B))),
                  ))
              .toList(),
          onChanged: onChanged,
          validator: validator,
        ),
    ]);
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 5 — Location (COMPANY flow)
// ════════════════════════════════════════════════════════════════

class StepLocation extends StatefulWidget {
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
  final bool isMinefop;
  final ValueChanged<Map<String, dynamic>?> onRegionChanged;
  final ValueChanged<Map<String, dynamic>?> onDepartmentChanged;
  final ValueChanged<Map<String, dynamic>?> onSubdivisionChanged;
  final ValueChanged<String?> onAreaChanged;
  final ValueChanged<Map<String, dynamic>?> onSectorChanged;
  final VoidCallback onInit;

  const StepLocation({
    super.key,
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
    required this.isMinefop,
    required this.onRegionChanged,
    required this.onDepartmentChanged,
    required this.onSubdivisionChanged,
    required this.onAreaChanged,
    required this.onSectorChanged,
    required this.onInit,
  });

  @override
  State<StepLocation> createState() => _StepLocationState();
}

class _StepLocationState extends State<StepLocation> {
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
          'Ces informations pré-rempliront la localisation dans les formulaires '
          'ONEFOP (Section 1) et DSMO (Partie A).',
          style: TextStyle(color: Color(0xFF666666), fontSize: 14),
        ),
        const SizedBox(height: 28),

        // Région
        widget.loadingRegions
            ? const LoadingField(label: 'Région *')
            : LocationDropdown(
                label: 'Région *',
                icon: Icons.map_outlined,
                hint: 'Sélectionner une région',
                items: widget.regions,
                selected: widget.selectedRegion,
                onChanged: widget.onRegionChanged,
              ),
        const SizedBox(height: 16),

        // Département
        widget.loadingDepartments
            ? const LoadingField(label: 'Département *')
            : LocationDropdown(
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

        // Arrondissement
        widget.loadingSubdivisions
            ? const LoadingField(label: 'Arrondissement')
            : LocationDropdown(
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

        // Milieu de résidence
        const FieldLabel(label: 'Milieu'),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: widget.selectedArea,
          isExpanded: true,
          decoration: modernDropdown(),
          hint: const Text('Urbain ou Rural',
              style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
          items: kAreaOptions
              .map((o) => DropdownMenuItem(
                  value: o,
                  child: Text(o,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF1E293B)))))
              .toList(),
          onChanged: widget.onAreaChanged,
        ),
        const SizedBox(height: 16),

        // Secteur d'activité
        widget.loadingSectors
            ? const LoadingField(label: "Secteur d'activité")
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const FieldLabel(label: "Secteur d'activité"),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<Map<String, dynamic>>(
                    initialValue: widget.selectedSector,
                    isExpanded: true,
                    decoration: modernDropdown().copyWith(
                        prefixIcon: const Icon(Icons.work_outline, size: 20)),
                    hint: const Text('Sélectionner un secteur',
                        style:
                            TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
                    items: widget.sectors
                        .map((s) => DropdownMenuItem<Map<String, dynamic>>(
                              value: s as Map<String, dynamic>,
                              child: Text(s['name'] as String? ?? '',
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontSize: 13, color: Color(0xFF1E293B))),
                            ))
                        .toList(),
                    onChanged: widget.onSectorChanged,
                  ),
                ],
              ),

        const SizedBox(height: 20),
        const InfoBox(
          icon: Icons.auto_fix_high_outlined,
          color: Colors.teal,
          text: 'Ces informations seront automatiquement pré-remplies dans la '
              'Section 1 de vos formulaires ONEFOP et dans la Partie A de '
              'vos déclarations DSMO.',
        ),
      ]),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 6 — Security
// ════════════════════════════════════════════════════════════════

class StepSecurity extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final String initialPassword;
  final void Function(String) onChanged;

  const StepSecurity({
    super.key,
    required this.formKey,
    required this.initialPassword,
    required this.onChanged,
  });

  @override
  State<StepSecurity> createState() => _StepSecurityState();
}

class _StepSecurityState extends State<StepSecurity> {
  late final TextEditingController _pwCtrl, _confirmCtrl;
  bool _obscurePw = true;
  bool _obscureConfirm = true;
  double _strength = 0;

  @override
  void initState() {
    super.initState();
    _pwCtrl = TextEditingController(text: widget.initialPassword);
    _confirmCtrl = TextEditingController();
    _strength = _calcStrength(_pwCtrl.text);
    _pwCtrl.addListener(() {
      setState(() => _strength = _calcStrength(_pwCtrl.text));
      widget.onChanged(_pwCtrl.text);
    });
  }

  @override
  void dispose() {
    _pwCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  double _calcStrength(String pw) {
    if (pw.isEmpty) return 0;
    double s = 0;
    if (pw.length >= 8) s += 0.25;
    if (pw.length >= 12) s += 0.15;
    if (pw.contains(RegExp(r'[A-Z]'))) s += 0.2;
    if (pw.contains(RegExp(r'[0-9]'))) s += 0.2;
    if (pw.contains(RegExp(r'[!@#\$%^&*]'))) s += 0.2;
    return s.clamp(0, 1);
  }

  Color _strengthColor(double s) {
    if (s < 0.35) return Colors.red;
    if (s < 0.65) return Colors.orange;
    return Colors.green;
  }

  String _strengthLabel(double s) {
    if (s < 0.35) return 'Faible';
    if (s < 0.65) return 'Moyen';
    if (s < 0.9) return 'Fort';
    return 'Très fort';
  }

  @override
  Widget build(BuildContext context) {
    final sc = _strengthColor(_strength);
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
            decoration: modernInput(
              hasError: false,
              labelText: 'Mot de passe *',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                icon: Icon(_obscurePw
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined),
                onPressed: () => setState(() => _obscurePw = !_obscurePw),
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Mot de passe requis';
              if (v.length < 8) return 'Minimum 8 caractères';
              if (_calcStrength(v) < 0.35) {
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
            Text(_pwCtrl.text.isEmpty ? '' : _strengthLabel(_strength),
                style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600, color: sc)),
          ]),
          const SizedBox(height: 8),
          _PasswordTips(password: _pwCtrl.text),
          const SizedBox(height: 20),
          TextFormField(
            controller: _confirmCtrl,
            obscureText: _obscureConfirm,
            textInputAction: TextInputAction.done,
            style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
            decoration: modernInput(
              hasError: false,
              labelText: 'Confirmer le mot de passe *',
              prefixIcon: const Icon(Icons.lock_clock_outlined),
              suffixIcon: IconButton(
                icon: Icon(_obscureConfirm
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined),
                onPressed: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
              ),
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

// ════════════════════════════════════════════════════════════════
// STEP 7 — Review / Summary
// ════════════════════════════════════════════════════════════════

class StepReview extends StatelessWidget {
  final bool isMinefop;
  final String role;
  final EntityType? entityType;
  final String respondentFirstName,
      respondentLastName,
      respondentFunction,
      respondentEmail,
      respondentPhone1,
      respondentPhone2;
  final Map<String, dynamic> entityData;
  final Map<String, dynamic>? selectedRegion,
      selectedDepartment,
      selectedSubdivision,
      selectedSector;
  final String? selectedArea;
  final String minefopMatricule,
      minefopPoste,
      minefopServiceCode,
      minefopPositionType;

  const StepReview({
    super.key,
    required this.isMinefop,
    required this.role,
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
    required this.minefopMatricule,
    required this.minefopPoste,
    required this.minefopServiceCode,
    required this.minefopPositionType,
  });

  EntityConfig? get _entityConfig =>
      entityType != null ? entityConfigs[entityType] : null;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Récapitulatif',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text('Vérifiez vos informations avant de créer le compte.',
            style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
        const SizedBox(height: 24),
        _roleBadge(),
        const SizedBox(height: 16),
        ReviewCard(
          title: isMinefop
              ? 'Informations personnelles'
              : 'Répondant — Section 0 ONEFOP / Partie A DSMO',
          icon: Icons.person_outline,
          rows: [
            ('Nom complet', '$respondentFirstName $respondentLastName'),
            if (!isMinefop && respondentFunction.isNotEmpty)
              ('Fonction', respondentFunction),
            ('Email', respondentEmail),
            ('Téléphone 1', respondentPhone1),
            if (respondentPhone2.isNotEmpty) ('Téléphone 2', respondentPhone2),
          ],
        ),
        if (!isMinefop && _entityConfig != null) ...[
          const SizedBox(height: 12),
          ReviewCard(
            title: entityType!.formSectionLabel,
            icon: _entityConfig!.icon,
            rows: _buildEntityRows(),
          ),
        ],
        if (isMinefop) ...[
          const SizedBox(height: 12),
          ReviewCard(
            title: 'Informations MINEFOP',
            icon: Icons.badge_outlined,
            rows: [
              if (minefopMatricule.isNotEmpty) ('Matricule', minefopMatricule),
              if (minefopPoste.isNotEmpty) ('Poste', minefopPoste),
              if (minefopServiceCode.isNotEmpty)
                ('Code service', minefopServiceCode),
            ],
          ),
        ],
        if (selectedRegion != null || selectedDepartment != null) ...[
          const SizedBox(height: 12),
          ReviewCard(
            title: 'Localisation',
            icon: Icons.map_outlined,
            rows: [
              if (selectedRegion != null)
                ('Région', selectedRegion!['name'] as String? ?? ''),
              if (selectedDepartment != null)
                ('Département', selectedDepartment!['name'] as String? ?? ''),
              if (!isMinefop && selectedSubdivision != null)
                (
                  'Arrondissement',
                  selectedSubdivision!['name'] as String? ?? ''
                ),
              if (!isMinefop && selectedArea != null) ('Milieu', selectedArea!),
              if (!isMinefop && selectedSector != null)
                ('Secteur', selectedSector!['name'] as String? ?? ''),
            ],
          ),
        ],
        const SizedBox(height: 16),
        InfoBox(
          icon: isMinefop
              ? Icons.hourglass_top_outlined
              : Icons.check_circle_outline,
          color: isMinefop ? Colors.orange : Colors.green,
          text: isMinefop
              ? 'Votre compte sera activé après validation par un '
                  'administrateur MINEFOP.'
              : 'Ces informations pré-rempliront automatiquement les '
                  'Sections 0 et 1 de vos formulaires ONEFOP et la '
                  'Partie A de vos déclarations DSMO.',
        ),
      ]),
    );
  }

  Widget _roleBadge() {
    if (_entityConfig != null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: _entityConfig!.color.withAlpha(20),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _entityConfig!.color.withAlpha(80))),
        child: Row(children: [
          Icon(_entityConfig!.icon, color: _entityConfig!.color),
          const SizedBox(width: 10),
          Text(_entityConfig!.title,
              style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                  color: _entityConfig!.color)),
        ]),
      );
    }
    if (isMinefop) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: Colors.indigo.withAlpha(20),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.indigo.withAlpha(80))),
        child: Row(children: [
          const Icon(Icons.account_balance_outlined, color: Colors.indigo),
          const SizedBox(width: 10),
          Text(
            'Agent MINEFOP — ${kMinefopRoleLabels[role] ?? role}',
            style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 15,
                color: Colors.indigo),
          ),
        ]),
      );
    }
    return const SizedBox.shrink();
  }

  List<(String, String)> _buildEntityRows() {
    if (_entityConfig == null) return [];
    final rows = <(String, String)>[];
    for (final field in _entityConfig!.fields) {
      final raw = entityData[field.key];
      final value = raw?.toString().trim() ?? '';
      if (value.isEmpty) continue;
      rows.add((field.label, value));
    }
    return rows;
  }
}
