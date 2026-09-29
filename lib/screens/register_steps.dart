// lib/screens/register_steps.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'register_constants.dart';
import 'register_widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../widgets/email_field_with_availability.dart';
import '../core/i18n/l10n_ext.dart';
import '../core/i18n/localized_text.dart';
import '../data/minefop_models.dart';
import '../widgets/public_chrome.dart';

// ════════════════════════════════════════════════════════════════
// STEP 0 — Role selection
// ════════════════════════════════════════════════════════════════

class StepRole extends StatelessWidget {
  final String role;
  final ValueChanged<String> onSelect;

  const StepRole({super.key, required this.role, required this.onSelect});

  bool get _isCompanySelected => role == 'COMPANY';

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(context.l10n.registerCreateAccountTitle,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Text(context.l10n.registerSelectProfileSubtitle,
            style: const TextStyle(color: Color(0xFF666666), fontSize: 14)),
        const SizedBox(height: 32),
        RoleCard(
          value: 'COMPANY',
          selected: _isCompanySelected ? 'COMPANY' : '',
          icon: Icons.business_outlined,
          color: PublicColors.green,
          title: context.l10n.registerRoleCompanyTitle,
          subtitle: context.l10n.registerRoleCompanySubtitle,
          onTap: (_) => onSelect('COMPANY'),
        ),
        // MINEFOP self-registration removed — Central/Regional/Divisional
        // staff accounts are now created by a Super Admin, not through this
        // public wizard.
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
        Text(context.l10n.registerStepTitleEntityType,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Text(context.l10n.registerEntityTypeSubtitle,
            style: const TextStyle(color: Color(0xFF666666), fontSize: 14)),
        const SizedBox(height: 32),
        ...EntityType.values.map((type) {
          final config = entityConfigs[type];
          if (config == null) return const SizedBox.shrink();
          final isEn = context.loc.languageCode == 'en';
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: RoleCard(
              value: type.toString(),
              selected: selected?.toString() ?? '',
              icon: config.icon,
              color: config.color,
              title: config.title.of(context.loc),
              subtitle:
                  isEn ? type.formSectionLabelEn : type.formSectionLabel,
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
            context.l10n.registerStepTitleRespondent,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(
            context.l10n.registerRespondentSubtitleStandard,
            style: const TextStyle(color: Color(0xFF666666), fontSize: 14),
          ),
          const SizedBox(height: 28),
          Row(children: [
            Expanded(
                child: Field(
                    controller: _firstNameCtrl,
                    label: context.l10n.registerFirstNameLabel,
                    icon: Icons.person_outline,
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? context.l10n.requiredShort
                        : null)),
            const SizedBox(width: 12),
            Expanded(
                child: Field(
                    controller: _lastNameCtrl,
                    label: context.l10n.registerLastNameLabel,
                    icon: Icons.badge_outlined,
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? context.l10n.requiredShort
                        : null)),
          ]),
          const SizedBox(height: 14),
          FieldLabel(label: context.l10n.registerFunctionLabel),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _function.isNotEmpty ? _function : null,
              isExpanded: true,
              decoration: modernDropdown(),
              hint: Text(context.l10n.registerSelectFunctionHint,
                  style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
              items: kRespondentFunctionOptions
                  .map((o) => DropdownMenuItem(
                      value: o.value, child: Text(o.text.of(context.loc))))
                  .toList(),
              onChanged: (v) {
                setState(() => _function = v ?? '');
                _notify();
              },
              validator: (v) =>
                  (v == null || v.isEmpty) ? context.l10n.requiredShort : null,
            ),
          const SizedBox(height: 14),
          EmailFieldWithAvailability(
            controller: _emailCtrl,
            label: context.l10n.registerProfessionalEmailLabel,
            isRequired: true,
            onEmailValidated: _notify,
            onEmailAvailabilityChanged: widget.onEmailAvailabilityChanged,
          ),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(
                child: PhoneField(
                    controller: _phone1Ctrl,
                    label: context.l10n.registerPhone1Label,
                    isRequired: true)),
            const SizedBox(width: 12),
            Expanded(
                child: PhoneField(
                    controller: _phone2Ctrl,
                    label: context.l10n.registerPhone2Label,
                    isRequired: false)),
          ]),
          const SizedBox(height: 16),
          InfoBox(
            icon: Icons.auto_fix_high_outlined,
            color: Colors.teal,
            text: context.l10n.registerRespondentInfoBox,
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
      return Center(
          child: Text(context.l10n.registerSelectEntityTypeFirst));
    }
    final config = widget.config!;
    final isEn = context.loc.languageCode == 'en';
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Form(
        key: widget.formKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(config.title.of(context.loc),
              style:
                  const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text(
              isEn
                  ? widget.entityType!.formSectionLabelEn
                  : widget.entityType!.formSectionLabel,
              style: const TextStyle(color: Color(0xFF666666), fontSize: 14)),
          const SizedBox(height: 28),
          ...config.fields.map(_buildField),
          const SizedBox(height: 16),
          InfoBox(
            icon: Icons.auto_fix_high_outlined,
            color: Colors.teal,
            text: context.l10n.registerEntityInfoInfoBox,
          ),
        ]),
      ),
    );
  }

  /// Whether [field] should render at all right now, per its
  /// dependsOn/dependsValue (see EntityField doc comment). Fields that
  /// return false here are simply omitted from the tree — Flutter's
  /// Form.validate() only validates FormFields that are actually mounted,
  /// so an omitted required field is never validated either.
  bool _isFieldVisible(EntityField field) {
    if (field.dependsOn == null) return true;
    return widget.entityData[field.dependsOn] == field.dependsValue;
  }

  Widget _buildField(EntityField field) {
    if (!_isFieldVisible(field)) return const SizedBox.shrink();
    final label = field.label.of(context.loc);
    if (field.options != null) {
      final cur = widget.entityData[field.key] as String?;
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          FieldLabel(label: '$label${field.required ? ' *' : ''}'),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue: (cur != null &&
                    field.options!.any((o) => o.value == cur))
                ? cur
                : null,
            isExpanded: true,
            decoration: modernDropdown(),
            hint: Text(context.l10n.selectPlaceholder,
                style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
            items: field.options!
                .map((o) => DropdownMenuItem(
                    value: o.value,
                    child: Text(o.text.of(context.loc),
                        style: const TextStyle(
                            fontSize: 14, color: Color(0xFF1E293B)))))
                .toList(),
            onChanged: (v) {
              widget.onDropdownChanged(field.key, v);
              setState(() {});
            },
            validator: field.required
                ? (v) =>
                    (v == null || v.isEmpty) ? context.l10n.requiredShort : null
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
          label: '$label${field.required ? ' *' : ''}',
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
          labelText: '$label${field.required ? ' *' : ''}',
          hintText: field.hint?.of(context.loc),
          prefixIcon: Icon(_iconForKey(field.key), size: 20),
        ),
        validator: field.required
            ? (v) => (v == null || v.trim().isEmpty)
                ? context.l10n.requiredShort
                : null
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
      case 'sigle':
        return Icons.short_text_outlined;
      case 'nonFunctionalReasonOther':
        return Icons.report_problem_outlined;
      case 'promoterName':
        return Icons.person_outline;
      default:
        return Icons.edit_outlined;
    }
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
        Text(context.l10n.registerStepTitleLocation,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Text(
          context.l10n.registerLocationSubtitle,
          style: const TextStyle(color: Color(0xFF666666), fontSize: 14),
        ),
        const SizedBox(height: 28),
        widget.loadingRegions
            ? LoadingField(label: context.l10n.registerRegionLabel)
            : LocationDropdown(
                label: context.l10n.registerRegionLabel,
                icon: Icons.map_outlined,
                hint: context.l10n.registerSelectRegionShort,
                items: widget.regions,
                selected: widget.selectedRegion,
                onChanged: widget.onRegionChanged,
              ),
        const SizedBox(height: 16),
        widget.loadingDepartments
            ? LoadingField(label: context.l10n.registerDepartmentLabel)
            : LocationDropdown(
                label: context.l10n.registerDepartmentLabel,
                icon: Icons.location_city_outlined,
                hint: widget.selectedRegion == null
                    ? context.l10n.registerSelectRegionFirst
                    : context.l10n.registerSelectDepartmentShort,
                items: widget.departments,
                selected: widget.selectedDepartment,
                onChanged: widget.selectedRegion == null
                    ? null
                    : widget.onDepartmentChanged,
              ),
        const SizedBox(height: 16),
        widget.loadingSubdivisions
            ? LoadingField(label: context.l10n.registerArrondissementLabel)
            : LocationDropdown(
                label: context.l10n.registerArrondissementLabel,
                icon: Icons.place_outlined,
                hint: widget.selectedDepartment == null
                    ? context.l10n.registerSelectDepartmentFirst
                    : widget.subdivisions.isEmpty
                        ? context.l10n.registerNoSubdivisionAvailable
                        : context.l10n.registerSelectSubdivisionShort,
                items: widget.subdivisions,
                selected: widget.selectedSubdivision,
                onChanged: widget.selectedDepartment == null
                    ? null
                    : widget.onSubdivisionChanged,
                required: false,
              ),
        const SizedBox(height: 16),
        FieldLabel(label: context.l10n.registerMilieuLabel),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: widget.selectedArea,
          isExpanded: true,
          decoration: modernDropdown(),
          hint: Text(context.l10n.registerUrbanOrRuralHint,
              style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
          items: kAreaOptions
              .map((o) => DropdownMenuItem(
                  value: o.value,
                  child: Text(o.text.of(context.loc),
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF1E293B)))))
              .toList(),
          onChanged: widget.onAreaChanged,
        ),
        const SizedBox(height: 16),
        widget.loadingSectors
            ? LoadingField(label: context.l10n.registerSectorLabel)
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FieldLabel(label: context.l10n.registerSectorLabel),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<Map<String, dynamic>>(
                    initialValue: widget.selectedSector,
                    isExpanded: true,
                    decoration: modernDropdown().copyWith(
                        prefixIcon: const Icon(Icons.work_outline, size: 20)),
                    hint: Text(context.l10n.registerSelectSectorHint,
                        style:
                            const TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
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
        InfoBox(
          icon: Icons.auto_fix_high_outlined,
          color: Colors.teal,
          text: context.l10n.registerLocationInfoBox,
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
  bool _confirmDirty = false;

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
    // Once the user has started confirming, keep the mismatch check live as
    // either field changes — matches PhoneField's live-validation pattern.
    _confirmCtrl.addListener(() {
      if (!_confirmDirty && _confirmCtrl.text.isNotEmpty) {
        setState(() => _confirmDirty = true);
      } else if (_confirmDirty) {
        setState(() {});
      }
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
      ? context.l10n.registerStrengthWeak
      : s < 0.65
          ? context.l10n.registerStrengthMedium
          : s < 0.9
              ? context.l10n.registerStrengthStrong
              : context.l10n.registerStrengthVeryStrong;

  String? _confirmError(String? v) {
    if (v == null || v.isEmpty) {
      return context.l10n.registerConfirmationRequired;
    }
    if (v != _pwCtrl.text) {
      return context.l10n.registerPasswordsDontMatch;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final sc = _strengthColor(_strength);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Form(
        key: widget.formKey,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(context.l10n.registerSecureAccountTitle,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text(context.l10n.registerChooseStrongPassword,
              style: const TextStyle(color: Color(0xFF666666), fontSize: 14)),
          const SizedBox(height: 28),
          TextFormField(
            controller: _pwCtrl,
            obscureText: _obscurePw,
            textInputAction: TextInputAction.next,
            style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
            decoration: modernInput(
              hasError: false,
              labelText: context.l10n.registerPasswordLabel,
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                icon: Icon(_obscurePw
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined),
                onPressed: () => setState(() => _obscurePw = !_obscurePw),
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) {
                return context.l10n.registerPasswordRequired;
              }
              if (v.length < 8) return context.l10n.registerPasswordMinChars;
              if (_calcStrength(v) < 0.35) {
                return context.l10n.registerPasswordTooWeak;
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
            autovalidateMode: _confirmDirty
                ? AutovalidateMode.always
                : AutovalidateMode.disabled,
            style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
            decoration: modernInput(
              hasError: _confirmDirty && _confirmError(_confirmCtrl.text) != null,
              labelText: context.l10n.registerConfirmPasswordLabel,
              prefixIcon: Icon(
                _confirmDirty && _confirmError(_confirmCtrl.text) == null
                    ? Icons.check_circle_outline
                    : Icons.lock_clock_outlined,
                color: _confirmDirty && _confirmError(_confirmCtrl.text) == null
                    ? PublicColors.green
                    : null,
              ),
              suffixIcon: IconButton(
                icon: Icon(_obscureConfirm
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined),
                onPressed: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
              ),
            ),
            validator: _confirmError,
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
      (context.l10n.registerTip8Chars, password.length >= 8),
      (context.l10n.registerTipUppercase,
          password.contains(RegExp(r'[A-Z]'))),
      (context.l10n.registerTipDigit, password.contains(RegExp(r'[0-9]'))),
      (context.l10n.registerTipSpecialChar,
          password.contains(RegExp(r'[!@#\$%^&*]'))),
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
            color: ok ? PublicColors.green : PublicColors.gray400,
          ),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(
                  fontSize: 11,
                  color: ok ? PublicColors.greenDark : PublicColors.gray500)),
        ]);
      }).toList(),
    );
  }
}

// ════════════════════════════════════════════════════════════════
// STEP 7 — Review / Summary
// ════════════════════════════════════════════════════════════════

class StepReview extends StatelessWidget {
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

  const StepReview({
    super.key,
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

  EntityConfig? get _entityConfig =>
      entityType != null ? entityConfigs[entityType] : null;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(context.l10n.registerStepTitleReview,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Text(context.l10n.registerReviewSubtitle,
            style: const TextStyle(color: Color(0xFF666666), fontSize: 14)),
        const SizedBox(height: 24),
        _roleBadge(context),
        const SizedBox(height: 16),
        ReviewCard(
          title: context.l10n.registerReviewRespondentTitle,
          icon: Icons.person_outline,
          rows: [
            (context.l10n.registerFullNameLabel,
                '$respondentFirstName $respondentLastName'),
            if (respondentFunction.isNotEmpty)
              (context.l10n.registerFunctionRowLabel, respondentFunction),
            (context.l10n.registerEmailRowLabel, respondentEmail),
            (context.l10n.registerPhone1RowLabel, respondentPhone1),
            if (respondentPhone2.isNotEmpty)
              (context.l10n.registerPhone2RowLabel, respondentPhone2),
          ],
        ),
        if (_entityConfig != null) ...[
          const SizedBox(height: 12),
          ReviewCard(
            title: context.loc.languageCode == 'en'
                ? entityType!.formSectionLabelEn
                : entityType!.formSectionLabel,
            icon: _entityConfig!.icon,
            rows: _buildEntityRows(context),
          ),
        ],
        if (selectedRegion != null || selectedDepartment != null) ...[
          const SizedBox(height: 12),
          ReviewCard(
            title: context.l10n.registerStepTitleLocation,
            icon: Icons.map_outlined,
            rows: [
              if (selectedRegion != null)
                (context.l10n.registerRegionRowLabel,
                    selectedRegion!['name'] as String? ?? ''),
              if (selectedDepartment != null)
                (context.l10n.registerDepartmentRowLabel,
                    selectedDepartment!['name'] as String? ?? ''),
              if (selectedSubdivision != null)
                (
                  context.l10n.registerArrondissementLabel,
                  selectedSubdivision!['name'] as String? ?? ''
                ),
              if (selectedArea != null)
                (
                  context.l10n.registerMilieuLabel,
                  kAreaOptions
                      .firstWhere((o) => o.value == selectedArea,
                          orElse: () => LocalizedOption(
                              selectedArea!, LocalizedText.same(selectedArea!)))
                      .text
                      .of(context.loc)
                ),
              if (selectedSector != null)
                (context.l10n.registerSectorRowLabel,
                    selectedSector!['name'] as String? ?? ''),
            ],
          ),
        ],
        const SizedBox(height: 16),
        InfoBox(
          icon: Icons.check_circle_outline,
          color: PublicColors.green,
          text: context.l10n.registerCompanyPendingInfoBox,
        ),
      ]),
    );
  }

  Widget _roleBadge(BuildContext context) {
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
          Expanded(
            child: Text(_entityConfig!.title.of(context.loc),
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: _entityConfig!.color)),
          ),
        ]),
      );
    }
    return const SizedBox.shrink();
  }

  List<(String, String)> _buildEntityRows(BuildContext context) {
    if (_entityConfig == null) return [];
    final rows = <(String, String)>[];
    for (final field in _entityConfig!.fields) {
      final raw = entityData[field.key];
      final value = raw?.toString().trim() ?? '';
      if (value.isEmpty) continue;
      rows.add((field.label.of(context.loc), value));
    }
    return rows;
  }
}
