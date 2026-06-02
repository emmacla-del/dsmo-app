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
  String? _pendingMinefopRole;

  @override
  void initState() {
    super.initState();
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
    if (_isMinefopPanelOpen) {
      return SizedBox(
        height: double.infinity,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => setState(() => _pendingMinefopRole = null),
                ),
                const SizedBox(width: 4),
                const Text('Niveau de service',
                    style:
                        TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              ]),
              const SizedBox(height: 6),
              const Text('Sélectionnez votre niveau hiérarchique.',
                  style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
              const SizedBox(height: 32),
              _MinefopLevelCard(
                value: 'CENTRAL',
                selected: _pendingMinefopRole,
                title: 'Administration centrale',
                subtitle:
                    'Direction centrale, sous-direction ou service central à Yaoundé.',
                icon: Icons.account_balance_outlined,
                onTap: (v) {
                  setState(() => _pendingMinefopRole = v);
                  widget.onSelect(v);
                },
              ),
              const SizedBox(height: 12),
              _MinefopLevelCard(
                value: 'REGIONAL',
                selected: _pendingMinefopRole,
                title: 'Service régional',
                subtitle:
                    "Délégation régionale de l'emploi et de la formation professionnelle.",
                icon: Icons.map_outlined,
                onTap: (v) {
                  setState(() => _pendingMinefopRole = v);
                  widget.onSelect(v);
                },
              ),
              const SizedBox(height: 12),
              _MinefopLevelCard(
                value: 'DIVISIONAL',
                selected: _pendingMinefopRole,
                title: 'Service départemental',
                subtitle:
                    "Délégation départementale de l'emploi et de la formation professionnelle.",
                icon: Icons.location_city_outlined,
                onTap: (v) {
                  setState(() => _pendingMinefopRole = v);
                  widget.onSelect(v);
                },
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Créer un compte',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text('Sélectionnez votre profil pour commencer.',
            style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
        const SizedBox(height: 32),
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
        RoleCard(
          value: 'MINEFOP',
          selected: '',
          icon: Icons.account_balance_outlined,
          color: Colors.indigo,
          title: 'Agent MINEFOP',
          subtitle:
              "Inspecteur ou agent du Ministère de l'Emploi et de la Formation Professionnelle.",
          onTap: (_) => setState(() => _pendingMinefopRole = ''),
        ),
      ]),
    );
  }
}

class _MinefopLevelCard extends StatelessWidget {
  final String value;
  final String? selected;
  final String title;
  final String subtitle;
  final IconData icon;
  final void Function(String) onTap;

  const _MinefopLevelCard({
    required this.value,
    required this.selected,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bool isSelected = selected == value;
    return GestureDetector(
      onTap: () => onTap(value),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? Colors.indigo.shade50 : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? Colors.indigo : Colors.grey.shade200,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.indigo.withAlpha(25),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: Colors.indigo, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title,
                  style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: isSelected
                          ? Colors.indigo.shade700
                          : const Color(0xFF1E293B))),
              const SizedBox(height: 3),
              Text(subtitle,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
            ]),
          ),
          if (isSelected)
            const Icon(Icons.check_circle, color: Colors.indigo, size: 20),
        ]),
      ),
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
        const Text("Sélectionnez le type d'entité que vous représentez.",
            style: TextStyle(color: Color(0xFF666666), fontSize: 14)),
        const SizedBox(height: 32),
        ...EntityType.values.map((type) {
          final config = entityConfigs[type];
          if (config == null) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: RoleCard(
              value: type.toString(),
              selected: selected?.toString() ?? '',
              icon: config.icon,
              color: config.color,
              title: config.title,
              subtitle: type.formSectionLabel,
              onTap: (_) => onSelect(type),
            ),
          );
        }),
      ]),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 2 — Respondent / personal info
// ════════════════════════════════════════════════════════════════

class StepRespondent extends ConsumerStatefulWidget {
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
  ConsumerState<StepRespondent> createState() => _StepRespondentState();
}

class _StepRespondentState extends ConsumerState<StepRespondent> {
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
                  .map((o) => DropdownMenuItem(value: o, child: Text(o)))
                  .toList(),
              onChanged: (v) {
                setState(() => _function = v ?? '');
                _notify();
              },
              validator: (v) => (v == null || v.isEmpty) ? 'Requis' : null,
            ),
          ],
          const SizedBox(height: 14),
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
// STEP 3 — Entity info (COMPANY only)
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
          Text(widget.entityType!.formSectionLabel,
              style: const TextStyle(color: Color(0xFF666666), fontSize: 14)),
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
// STEP 4 — MINEFOP info
// 3-step cascade:
//   Step 1: pick position type (e.g. CHEF_SERVICE)
//   Step 2: pick immediate parent unit (e.g. the Sous-Direction)
//   Step 3: pick exact service unit (e.g. the Service itself)
//   → job title resolved from ServicePosition.title in database
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
    required String servicePath,
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

  // ── Step 1: position types ──
  List<Map<String, dynamic>> _availablePositionTypes = [];
  String? _selectedPositionType;
  bool _loadingPositionTypes = false;
  String? _positionTypesError;

  // ── Step 2: immediate parent units ──
  List<Map<String, dynamic>> _parentUnits = [];
  Map<String, dynamic>? _selectedParentUnit;
  bool _loadingParentUnits = false;

  // ── Step 3: exact service units under selected parent ──
  List<Map<String, dynamic>> _serviceUnits = [];
  Map<String, dynamic>? _selectedServiceUnit;
  bool _loadingServiceUnits = false;

  // Resolved job title from ServicePosition.title in the database
  String _resolvedJobTitle = '';

  // ── Location fields (REGIONAL / DIVISIONAL only) ──
  String? _selectedRegion;
  String? _selectedDepartment;
  List<Map<String, dynamic>> _regions = [];
  List<Map<String, dynamic>> _departments = [];
  bool _loadingRegions = false;
  bool _loadingDepartments = false;

  bool get _needsLocation =>
      widget.role == 'REGIONAL' || widget.role == 'DIVISIONAL';
  bool get _needsDepartment => widget.role == 'DIVISIONAL';
  String get _roleLabel => kMinefopRoleLabels[widget.role] ?? widget.role;

  @override
  void initState() {
    super.initState();
    _matriculeCtrl = TextEditingController(text: widget.initialMatricule);
    _matriculeCtrl.addListener(_notify);
    _selectedRegion = widget.initialRegion;
    _selectedDepartment = widget.initialDepartment;
    _loadPositionTypes();
    if (_needsLocation) _loadRegions();
  }

  @override
  void dispose() {
    _matriculeCtrl.dispose();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 1 — load position types for this role
  // ─────────────────────────────────────────────────────────────
  Future<void> _loadPositionTypes() async {
    setState(() {
      _loadingPositionTypes = true;
      _positionTypesError = null;
      _availablePositionTypes = [];
    });
    try {
      final response = await ref.read(apiClientProvider).get(
        '/minefop-services/positions/by-role',
        queryParameters: {'role': widget.role},
      );
      final List<dynamic> data = response.data is List ? response.data : [];
      if (mounted) {
        setState(() {
          _availablePositionTypes = data
              .map((e) => {
                    'positionType': e['positionType'] as String,
                    'label': e['label'] as String,
                  })
              .toList();
          _loadingPositionTypes = false;
        });
        // Restore draft
        if (widget.initialPositionType.isNotEmpty) {
          final match = _availablePositionTypes.firstWhere(
              (t) => t['positionType'] == widget.initialPositionType,
              orElse: () => {});
          if (match.isNotEmpty) {
            _selectedPositionType = match['positionType'] as String;
            await _loadParentUnits();
          }
        }
      }
    } catch (e) {
      debugPrint('Error loading position types: $e');
      if (mounted) {
        setState(() {
          _loadingPositionTypes = false;
          _positionTypesError = 'Impossible de charger les fonctions.';
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 2 — load immediate parent units for the chosen position
  // ─────────────────────────────────────────────────────────────
  Future<void> _loadParentUnits() async {
    if (_selectedPositionType == null) return;
    setState(() {
      _loadingParentUnits = true;
      _parentUnits = [];
      _selectedParentUnit = null;
      _serviceUnits = [];
      _selectedServiceUnit = null;
      _resolvedJobTitle = '';
    });
    try {
      final response = await ref.read(apiClientProvider).get(
        '/minefop-services/parents-for-position',
        queryParameters: {
          'positionType': _selectedPositionType!,
          'role': widget.role,
        },
      );
      final List<dynamic> data = response.data is List ? response.data : [];

      final List<Map<String, dynamic>> parents = [];

      void collectParents(List<dynamic> items) {
        for (final item in items) {
          final children =
              item['children'] is List ? item['children'] as List : <dynamic>[];
          final acronym = item['acronym'] as String? ?? '';
          final name = item['name'] as String? ?? '';
          final level = item['level'] as int? ?? 1;
          parents.add({
            'code': item['code'] as String,
            'name': name,
            'acronym': acronym,
            'displayName': acronym.isNotEmpty ? '$acronym — $name' : name,
            'level': level,
          });
          if (children.isNotEmpty) {
            collectParents(children);
          }
        }
      }

      collectParents(data);

      if (mounted) {
        setState(() {
          _parentUnits = parents;
          _loadingParentUnits = false;
        });
        if (widget.initialServiceCode.isNotEmpty && parents.isNotEmpty) {
          await _restoreSelectionFromDraft();
        }
      }
    } catch (e, st) {
      debugPrint('Error loading parent units: $e\n$st');
      if (mounted) setState(() => _loadingParentUnits = false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 3 — load exact service units under selected parent
  // ─────────────────────────────────────────────────────────────
  Future<void> _loadServiceUnits() async {
    if (_selectedParentUnit == null || _selectedPositionType == null) return;
    setState(() {
      _loadingServiceUnits = true;
      _serviceUnits = [];
      _selectedServiceUnit = null;
      _resolvedJobTitle = '';
    });
    try {
      final response = await ref.read(apiClientProvider).get(
        '/minefop-services/children-for-position',
        queryParameters: {
          'parentCode': _selectedParentUnit!['code'] as String,
          'positionType': _selectedPositionType!,
        },
      );
      final List<dynamic> data = response.data is List ? response.data : [];
      if (mounted) {
        setState(() {
          _serviceUnits = data.map((e) => _parseServiceUnit(e)).toList();
          _loadingServiceUnits = false;
        });
        // Restore draft after loading service units (if not already restored)
        if (widget.initialServiceCode.isNotEmpty) {
          final match = _serviceUnits.firstWhere(
              (s) => s['code'] == widget.initialServiceCode,
              orElse: () => {});
          if (match.isNotEmpty) {
            _selectedServiceUnit = match;
            _resolvedJobTitle = match['positionTitle'] as String? ?? '';
            _notify();
          }
        }
      }
    } catch (e, st) {
      debugPrint('Error loading service units: $e\n$st');
      if (mounted) setState(() => _loadingServiceUnits = false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DRAFT RESTORATION – fast path + fallback
  // ─────────────────────────────────────────────────────────────
  Future<void> _restoreSelectionFromDraft() async {
    // Fast path: resolve-position endpoint (1 call)
    final (parentCode, serviceUnit) =
        await _resolvePositionFast(widget.initialServiceCode);
    if (parentCode != null && serviceUnit != null) {
      final parent = _parentUnits.firstWhere(
        (p) => p['code'] == parentCode,
        orElse: () => {},
      );
      if (parent.isNotEmpty) {
        setState(() {
          _selectedParentUnit = parent;
          final unit = _parseServiceUnit(serviceUnit);
          _serviceUnits = [unit];
          _selectedServiceUnit = unit;
          _resolvedJobTitle = unit['positionTitle'] as String? ?? '';
        });
        _notify();
        // Optionally load full sibling list in background
        _loadServiceUnits();
        return;
      }
    }

    // Fallback: linear scan over parents
    for (final parent in _parentUnits) {
      try {
        final response = await ref.read(apiClientProvider).get(
          '/minefop-services/children-for-position',
          queryParameters: {
            'parentCode': parent['code'] as String,
            'positionType': _selectedPositionType!,
          },
        );
        final List<dynamic> data = response.data is List ? response.data : [];
        final match = data.firstWhere(
            (e) => e['code'] == widget.initialServiceCode,
            orElse: () => null);
        if (match != null && mounted) {
          setState(() {
            _selectedParentUnit = parent;
            _serviceUnits = data.map((e) => _parseServiceUnit(e)).toList();
            _selectedServiceUnit = _serviceUnits.firstWhere(
                (s) => s['code'] == widget.initialServiceCode,
                orElse: () => {});
            if (_selectedServiceUnit != null &&
                (_selectedServiceUnit as Map).isNotEmpty) {
              _resolvedJobTitle =
                  _selectedServiceUnit!['positionTitle'] as String? ?? '';
            }
          });
          _notify();
          return;
        }
      } catch (e, st) {
        debugPrint(
            'Draft restore scan error for parent ${parent['code']}: $e\n$st');
        continue;
      }
    }
  }

  /// Try to resolve the saved service code via the dedicated endpoint.
  /// Returns (parentCode, serviceUnit) if successful, else (null, null).
  Future<(String?, Map<String, dynamic>?)> _resolvePositionFast(
      String serviceCode) async {
    try {
      final response = await ref.read(apiClientProvider).get(
        '/minefop-services/resolve-position',
        queryParameters: {'serviceCode': serviceCode},
      );
      final data = response.data as Map<String, dynamic>?;
      if (data != null &&
          data['parentCode'] != null &&
          data['serviceUnit'] != null) {
        final parentCode = data['parentCode'] as String;
        final serviceUnit = data['serviceUnit'] as Map<String, dynamic>;
        return (parentCode, serviceUnit);
      }
      return (null, null);
    } catch (e) {
      debugPrint('resolve-position failed, will fallback to scan: $e');
      return (null, null);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS – parse service unit from backend response
  // ─────────────────────────────────────────────────────────────
  Map<String, dynamic> _parseServiceUnit(dynamic e) {
    final map = e as Map<String, dynamic>;
    final acronym = map['acronym'] as String? ?? '';
    final name = map['name'] as String? ?? '';
    return {
      'code': map['code'] as String,
      'name': name,
      'acronym': acronym,
      'displayName': map['displayName'] as String? ??
          (acronym.isNotEmpty ? '$acronym — $name' : name),
      'positionTitle': map['positionTitle'] as String? ?? '',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // LOCATION
  // ─────────────────────────────────────────────────────────────
  Future<void> _loadRegions() async {
    setState(() {
      _loadingRegions = true;
      _regions = [];
    });
    try {
      final data = await ref.read(apiClientProvider).getRegions();
      if (mounted) setState(() => _regions = data.cast<Map<String, dynamic>>());
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

  // ─────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────
  void _onPositionTypeChanged(String? type) {
    setState(() {
      _selectedPositionType = type;
      _parentUnits = [];
      _selectedParentUnit = null;
      _serviceUnits = [];
      _selectedServiceUnit = null;
      _resolvedJobTitle = '';
    });
    if (type != null) {
      _loadParentUnits();
    } else {
      _notify();
    }
  }

  void _onParentUnitChanged(String? parentCode) {
    final parent = parentCode != null
        ? _parentUnits.firstWhere((u) => u['code'] == parentCode,
            orElse: () => {})
        : null;
    setState(() {
      _selectedParentUnit =
          parent != null && (parent as Map).isNotEmpty ? parent : null;
      _serviceUnits = [];
      _selectedServiceUnit = null;
      _resolvedJobTitle = '';
    });
    if (parent != null && (parent as Map).isNotEmpty) {
      _loadServiceUnits();
    } else {
      _notify();
    }
  }

  void _onServiceUnitChanged(String? unitCode) {
    final unit = unitCode != null
        ? _serviceUnits.firstWhere((s) => s['code'] == unitCode,
            orElse: () => {})
        : null;
    setState(() {
      _selectedServiceUnit =
          unit != null && (unit as Map).isNotEmpty ? unit : null;
      _resolvedJobTitle = unit != null && (unit as Map).isNotEmpty
          ? unit['positionTitle'] as String? ?? ''
          : '';
    });
    _notify();
  }

  void _onRegionChanged(Map<String, dynamic>? v) {
    setState(() => _selectedRegion = v?['name'] as String?);
    if (v != null) _loadDepartments(v['id'] as String);
    _notify();
  }

  void _onDepartmentChanged(Map<String, dynamic>? v) {
    setState(() => _selectedDepartment = v?['name'] as String?);
    _notify();
  }

  // ─────────────────────────────────────────────────────────────
  // NOTIFY — sends final resolved values upward
  // ─────────────────────────────────────────────────────────────
  void _notify() {
    widget.onChanged(
      matricule: _matriculeCtrl.text.trim(),
      poste: _resolvedJobTitle,
      serviceCode: _selectedServiceUnit?['code'] as String? ?? '',
      positionType: _selectedPositionType ?? '',
      servicePath: _buildServicePath(),
      region: _selectedRegion,
      department: _selectedDepartment,
    );
  }

  String _buildServicePath() {
    final parts = <String>[];
    if (_selectedParentUnit != null) {
      parts.add(_selectedParentUnit!['displayName'] as String);
    }
    if (_selectedServiceUnit != null &&
        (_selectedServiceUnit as Map).isNotEmpty) {
      parts.add(_selectedServiceUnit!['displayName'] as String);
    }
    return parts.join(' › ');
  }

  // ─────────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────────
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
            Text('Renseignez vos informations en tant que $_roleLabel.',
                style: const TextStyle(color: Color(0xFF666666), fontSize: 14)),
            const SizedBox(height: 28),
            _roleBadge(),
            const SizedBox(height: 24),
            // Matricule
            Field(
              controller: _matriculeCtrl,
              label: 'Matricule *',
              icon: Icons.badge_outlined,
              hint: 'Votre matricule de fonctionnaire',
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Matricule requis' : null,
            ),
            const SizedBox(height: 24),
            const Divider(height: 1),
            const SizedBox(height: 24),

            // STEP 1 — position type
            _buildPositionTypeDropdown(),

            // STEP 2 — immediate parent unit
            if (_selectedPositionType != null) ...[
              const SizedBox(height: 20),
              _buildParentUnitDropdown(),
            ],

            // STEP 3 — exact service unit
            if (_selectedParentUnit != null) ...[
              const SizedBox(height: 20),
              _buildServiceUnitDropdown(),
            ],

            // Resolved job title preview
            if (_resolvedJobTitle.isNotEmpty) ...[
              const SizedBox(height: 20),
              _buildJobTitlePreview(),
            ],

            // Location fields (REGIONAL / DIVISIONAL)
            if (_needsLocation) ...[
              const SizedBox(height: 24),
              const Divider(height: 1),
              const SizedBox(height: 24),
              Text('Localisation',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.indigo.shade700)),
              const SizedBox(height: 4),
              Text('Indiquez la région et le département de votre affectation.',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
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
              if (_needsDepartment) ...[
                const SizedBox(height: 16),
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
              ],
            ],

            const SizedBox(height: 24),
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

  Widget _roleBadge() {
    return Container(
      width: double.infinity,
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
    );
  }

  // ── Step 1 widget ──
  Widget _buildPositionTypeDropdown() {
    if (_loadingPositionTypes) {
      return const LoadingField(label: 'Chargement des fonctions...');
    }
    if (_positionTypesError != null) {
      return _errorBox(_positionTypesError!);
    }
    if (_availablePositionTypes.isEmpty) {
      return _infoBox('Aucune fonction disponible pour votre niveau.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const FieldLabel(label: 'Fonction / Poste *'),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: _selectedPositionType,
          isExpanded: true,
          decoration: modernDropdown(),
          hint: const Text('Sélectionnez votre fonction',
              style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
          items: _availablePositionTypes
              .map((e) => DropdownMenuItem<String>(
                    value: e['positionType'] as String,
                    child: Text(e['label'] as String,
                        style: const TextStyle(
                            fontSize: 14, color: Color(0xFF1E293B))),
                  ))
              .toList(),
          onChanged: _onPositionTypeChanged,
          validator: (v) =>
              v == null ? 'Veuillez sélectionner une fonction' : null,
        ),
      ],
    );
  }

  // ── Step 2 widget ──
  Widget _buildParentUnitDropdown() {
    if (_loadingParentUnits) {
      return const LoadingField(label: 'Chargement des unités parentes...');
    }
    if (_parentUnits.isEmpty) {
      return _infoBox('Aucune unité parente disponible pour cette fonction.');
    }
    // Auto-select root-level parent (level 1) when it's the only option
    if (_parentUnits.length == 1 &&
        _parentUnits[0]['level'] == 1 &&
        _selectedParentUnit == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _onParentUnitChanged(_parentUnits[0]['code'] as String);
      });
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const FieldLabel(label: 'Unité parente *'),
        const SizedBox(height: 4),
        Text(
          _parentUnits.length == 1 && _parentUnits[0]['level'] == 1
              ? 'Cette fonction est directement rattachée à cette unité.'
              : 'Sélectionnez le service supérieur hiérarchique direct.',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _selectedParentUnit != null &&
                  (_selectedParentUnit as Map).isNotEmpty
              ? _selectedParentUnit!['code'] as String?
              : null,
          isExpanded: true,
          decoration: modernDropdown(),
          hint: const Text("Sélectionnez l'unité supérieure",
              style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
          items: _parentUnits
              .map((e) => DropdownMenuItem<String>(
                    value: e['code'] as String,
                    child: Text(
                      e['displayName'] as String,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF1E293B)),
                    ),
                  ))
              .toList(),
          onChanged: _onParentUnitChanged,
          validator: (v) => v == null ? 'Requis' : null,
        ),
      ],
    );
  }

  // ── Step 3 widget ──
  Widget _buildServiceUnitDropdown() {
    if (_loadingServiceUnits) {
      return const LoadingField(label: 'Chargement de vos services...');
    }
    if (_serviceUnits.isEmpty) {
      return _infoBox('Aucun service trouvé sous cette unité parente.');
    }
    // Auto-select when only one service unit is available
    if (_serviceUnits.length == 1 && _selectedServiceUnit == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _onServiceUnitChanged(_serviceUnits[0]['code'] as String);
      });
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const FieldLabel(label: 'Votre service *'),
        const SizedBox(height: 4),
        Text(
          "Sélectionnez l'unité dans laquelle vous exercez.",
          style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _selectedServiceUnit != null &&
                  (_selectedServiceUnit as Map).isNotEmpty
              ? _selectedServiceUnit!['code'] as String?
              : null,
          isExpanded: true,
          decoration: modernDropdown(),
          hint: const Text('Sélectionnez votre service',
              style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
          items: _serviceUnits
              .map((e) => DropdownMenuItem<String>(
                    value: e['code'] as String,
                    child: Text(
                      e['displayName'] as String,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF1E293B)),
                    ),
                  ))
              .toList(),
          onChanged: _onServiceUnitChanged,
          validator: (v) => v == null ? 'Requis' : null,
        ),
      ],
    );
  }

  Widget _buildJobTitlePreview() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.teal.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.teal.shade200),
      ),
      child: Row(children: [
        const Icon(Icons.work_outline, color: Colors.teal, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Intitulé du poste',
                  style: TextStyle(
                      fontSize: 11,
                      color: Colors.teal,
                      fontWeight: FontWeight.w500)),
              const SizedBox(height: 4),
              Text(
                _resolvedJobTitle,
                style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Color(0xFF1E293B)),
              ),
            ],
          ),
        ),
        const Icon(Icons.check_circle, color: Colors.teal, size: 18),
      ]),
    );
  }

  Widget _errorBox(String message) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(children: [
        const Icon(Icons.error_outline, color: Colors.red, size: 18),
        const SizedBox(width: 8),
        Expanded(
            child: Text(message, style: const TextStyle(color: Colors.red))),
      ]),
    );
  }

  Widget _infoBox(String message) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.amber.shade200),
      ),
      child: Text(message, style: const TextStyle(fontSize: 13)),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// Location form dropdown (MINEFOP regional/divisional)
// ════════════════════════════════════════════════════════════════

class _LocationFormDropdown extends StatelessWidget {
  final String label;
  final String hint;
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
    final match = items.isNotEmpty && selectedName != null
        ? items.firstWhere((r) => r['name'] == selectedName,
            orElse: () => <String, dynamic>{})
        : null;
    final resolved = (match != null && match.isNotEmpty) ? match : null;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      FieldLabel(label: label),
      const SizedBox(height: 6),
      if (loading)
        const _LoadingBox()
      else
        DropdownButtonFormField<String>(
          initialValue: resolved != null
              ? resolved['id'] as String? ?? resolved['name'] as String?
              : null,
          isExpanded: true,
          decoration:
              modernDropdown().copyWith(prefixIcon: Icon(icon, size: 20)),
          hint: Text(hint,
              style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
          items: items
              .map((item) => DropdownMenuItem<String>(
                    value:
                        item['id'] as String? ?? item['name'] as String? ?? '',
                    child: Text(item['name'] as String? ?? '',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 14, color: Color(0xFF1E293B))),
                  ))
              .toList(),
          onChanged: (code) {
            final selected = code != null
                ? items.firstWhere((i) => (i['id'] ?? i['name']) == code,
                    orElse: () => {})
                : null;
            onChanged?.call(selected != null && (selected as Map).isNotEmpty
                ? selected
                : null);
          },
          validator: (v) => validator?.call(v != null
              ? items.firstWhere((i) => (i['id'] ?? i['name']) == v,
                  orElse: () => {})
              : null),
        ),
    ]);
  }
}

class _LoadingBox extends StatelessWidget {
  const _LoadingBox();

  @override
  Widget build(BuildContext context) {
    return Container(
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
            child: CircularProgressIndicator(strokeWidth: 2)),
      ),
    );
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
                              child: Text(
                                s['name'] as String? ?? '',
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 13, color: Color(0xFF1E293B)),
                              ),
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

  Color _strengthColor(double s) => s < 0.35
      ? Colors.red
      : s < 0.65
          ? Colors.orange
          : Colors.green;

  String _strengthLabel(double s) => s < 0.35
      ? 'Faible'
      : s < 0.65
          ? 'Moyen'
          : s < 0.9
              ? 'Fort'
              : 'Très fort';

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
                  color: sc,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              _pwCtrl.text.isEmpty ? '' : _strengthLabel(_strength),
              style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: sc),
            ),
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
          Icon(
            ok ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 14,
            color: ok ? Colors.green : Colors.grey.shade400,
          ),
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
  final String minefopServicePath;

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
    this.minefopServicePath = '',
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
          _MinefopReviewCard(
            matricule: minefopMatricule,
            poste: minefopPoste,
            servicePath: minefopServicePath,
            serviceCode: minefopServiceCode,
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
              ? 'Votre compte sera activé après validation par un administrateur MINEFOP.'
              : 'Ces informations pré-rempliront automatiquement les Sections 0 et 1 '
                  'de vos formulaires ONEFOP et la Partie A de vos déclarations DSMO.',
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
          border: Border.all(color: _entityConfig!.color.withAlpha(80)),
        ),
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
          border: Border.all(color: Colors.indigo.withAlpha(80)),
        ),
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

class _MinefopReviewCard extends StatelessWidget {
  final String matricule;
  final String poste;
  final String servicePath;
  final String serviceCode;

  const _MinefopReviewCard({
    required this.matricule,
    required this.poste,
    required this.servicePath,
    required this.serviceCode,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: Row(children: [
            Icon(Icons.badge_outlined, size: 18, color: Colors.indigo.shade400),
            const SizedBox(width: 8),
            Text('Informations MINEFOP',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey.shade700)),
          ]),
        ),
        const SizedBox(height: 12),
        const Divider(height: 1, indent: 16, endIndent: 16),
        const SizedBox(height: 12),
        if (matricule.isNotEmpty)
          _ReviewRow(label: 'Matricule', value: matricule),
        if (poste.isNotEmpty)
          _ReviewRow(label: 'Intitulé du poste', value: poste),
        if (servicePath.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 4),
            child: Text('Chemin hiérarchique',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade500)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.indigo.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 4,
                runSpacing: 4,
                children: [
                  for (final (i, part) in servicePath.split(' › ').indexed) ...[
                    if (i > 0)
                      Icon(Icons.chevron_right,
                          size: 13, color: Colors.indigo.shade300),
                    Text(
                      part,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: i == servicePath.split(' › ').length - 1
                            ? FontWeight.w600
                            : FontWeight.normal,
                        color: i == servicePath.split(' › ').length - 1
                            ? Colors.indigo.shade700
                            : Colors.indigo.shade400,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ] else if (serviceCode.isNotEmpty)
          _ReviewRow(label: 'Code service', value: serviceCode),
        const SizedBox(height: 4),
      ]),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  final String label;
  final String value;
  const _ReviewRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          width: 130,
          child: Text(label,
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: Colors.grey.shade500)),
        ),
        Expanded(
          child: Text(value,
              style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B))),
        ),
      ]),
    );
  }
}
