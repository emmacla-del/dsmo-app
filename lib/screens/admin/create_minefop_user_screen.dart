// lib/screens/admin/create_minefop_user_screen.dart
//
// SUPER_ADMIN-only: creates a MINEFOP agent account directly (CENTRAL /
// REGIONAL / DIVISIONAL). Replaces the public MINEFOP self-registration
// flow that was removed from register_screen.dart — since agents can no
// longer sign themselves up, an admin creates the account and hands the
// generated temporary password to the agent out-of-band (outbound email
// from this app is unreliable, so it's shown on-screen, not emailed).
//
// Reached from UsersDirectoryScreen's toolbar ("Nouvel agent").

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dsmo_app/core/i18n/l10n_ext.dart';
import '../../data/api_client.dart';
import '../../theme/ultra_theme.dart';
import '../../widgets/admin_kit.dart';

const _roleLabels = <String, String>{
  'CENTRAL': 'Administration Centrale',
  'REGIONAL': 'Délégué Régional',
  'DIVISIONAL': 'Délégué Départemental',
};
const _roles = ['CENTRAL', 'REGIONAL', 'DIVISIONAL'];

class CreateMinefopUserScreen extends ConsumerStatefulWidget {
  const CreateMinefopUserScreen({super.key});

  @override
  ConsumerState<CreateMinefopUserScreen> createState() =>
      _CreateMinefopUserScreenState();
}

class _CreateMinefopUserScreenState
    extends ConsumerState<CreateMinefopUserScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _matriculeCtrl = TextEditingController();

  String? _role;
  bool _submitting = false;

  // Position cascade
  List<Map<String, dynamic>> _positionTypes = [];
  String? _selectedPositionType;
  bool _loadingPositionTypes = false;
  String? _positionTypesError;

  List<Map<String, dynamic>> _parentUnits = [];
  Map<String, dynamic>? _selectedParentUnit;
  bool _loadingParentUnits = false;

  List<Map<String, dynamic>> _serviceUnits = [];
  Map<String, dynamic>? _selectedServiceUnit;
  bool _loadingServiceUnits = false;
  String _resolvedJobTitle = '';

  // Location
  List<Map<String, dynamic>> _regions = [];
  List<Map<String, dynamic>> _departments = [];
  String? _selectedRegionName;
  String? _selectedRegionId;
  String? _selectedDepartmentName;
  bool _loadingRegions = false;
  bool _loadingDepartments = false;

  bool get _needsLocation => _role == 'REGIONAL' || _role == 'DIVISIONAL';
  bool get _needsDepartment => _role == 'DIVISIONAL';

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _emailCtrl.dispose();
    _matriculeCtrl.dispose();
    super.dispose();
  }

  // ── Cascade loading ─────────────────────────────────────────

  void _onRoleChanged(String? role) {
    setState(() {
      _role = role;
      _positionTypes = [];
      _selectedPositionType = null;
      _parentUnits = [];
      _selectedParentUnit = null;
      _serviceUnits = [];
      _selectedServiceUnit = null;
      _resolvedJobTitle = '';
      _regions = [];
      _departments = [];
      _selectedRegionName = null;
      _selectedRegionId = null;
      _selectedDepartmentName = null;
    });
    if (role == null) return;
    _loadPositionTypes(role);
    if (_needsLocation) _loadRegions();
  }

  Future<void> _loadPositionTypes(String role) async {
    setState(() {
      _loadingPositionTypes = true;
      _positionTypesError = null;
      _positionTypes = [];
    });
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.get(
        '/minefop-services/positions/by-role',
        queryParameters: {'role': role},
      );
      final data = response.data is List ? response.data as List : [];
      if (!mounted) return;
      setState(() {
        _positionTypes = data
            .map((e) => {
                  'positionType': e['positionType'] as String,
                  'label': e['label'] as String,
                })
            .toList();
        _loadingPositionTypes = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingPositionTypes = false;
        _positionTypesError = context.l10n.createMinefopUserLoadFunctionsError;
      });
    }
  }

  void _onPositionTypeChanged(String? type) {
    setState(() {
      _selectedPositionType = type;
      _parentUnits = [];
      _selectedParentUnit = null;
      _serviceUnits = [];
      _selectedServiceUnit = null;
      _resolvedJobTitle = '';
    });
    if (type != null && _role != null) _loadParentUnits(type);
  }

  Future<void> _loadParentUnits(String positionType) async {
    setState(() {
      _loadingParentUnits = true;
      _parentUnits = [];
    });
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.get(
        '/minefop-services/parents-for-position',
        queryParameters: {'positionType': positionType, 'role': _role},
      );
      final data = response.data is List ? response.data as List : [];
      final parents = <Map<String, dynamic>>[];
      void collect(List items) {
        for (final item in items) {
          final children =
              item['children'] is List ? item['children'] as List : const [];
          final acronym = item['acronym'] as String? ?? '';
          final name = item['name'] as String? ?? '';
          parents.add({
            'code': item['code'] as String,
            'displayName': acronym.isNotEmpty ? '$acronym — $name' : name,
          });
          if (children.isNotEmpty) collect(children);
        }
      }

      collect(data);
      if (!mounted) return;
      setState(() {
        _parentUnits = parents;
        _loadingParentUnits = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingParentUnits = false);
    }
  }

  void _onParentUnitChanged(String? code) {
    final parent = code != null
        ? _parentUnits.firstWhere((u) => u['code'] == code, orElse: () => {})
        : null;
    setState(() {
      _selectedParentUnit = (parent != null && parent.isNotEmpty) ? parent : null;
      _serviceUnits = [];
      _selectedServiceUnit = null;
      _resolvedJobTitle = '';
    });
    if (_selectedParentUnit != null && _selectedPositionType != null) {
      _loadServiceUnits();
    }
  }

  Future<void> _loadServiceUnits() async {
    setState(() {
      _loadingServiceUnits = true;
      _serviceUnits = [];
    });
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.get(
        '/minefop-services/children-for-position',
        queryParameters: {
          'parentCode': _selectedParentUnit!['code'] as String,
          'positionType': _selectedPositionType!,
        },
      );
      final data = response.data is List ? response.data as List : [];
      if (!mounted) return;
      setState(() {
        _serviceUnits = data.map((e) {
          final map = e as Map<String, dynamic>;
          final acronym = map['acronym'] as String? ?? '';
          final name = map['name'] as String? ?? '';
          return {
            'code': map['code'] as String,
            'displayName': map['displayName'] as String? ??
                (acronym.isNotEmpty ? '$acronym — $name' : name),
            'positionTitle': map['positionTitle'] as String? ?? '',
          };
        }).toList();
        _loadingServiceUnits = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadingServiceUnits = false);
    }
  }

  void _onServiceUnitChanged(String? code) {
    final unit = code != null
        ? _serviceUnits.firstWhere((s) => s['code'] == code, orElse: () => {})
        : null;
    setState(() {
      _selectedServiceUnit = (unit != null && unit.isNotEmpty) ? unit : null;
      _resolvedJobTitle =
          (unit != null && unit.isNotEmpty) ? unit['positionTitle'] as String? ?? '' : '';
    });
  }

  Future<void> _loadRegions() async {
    setState(() => _loadingRegions = true);
    try {
      final api = ref.read(apiClientProvider);
      final data = await api.getRegions();
      if (!mounted) return;
      setState(() => _regions = data.cast<Map<String, dynamic>>());
    } catch (e) {
      // swallow — region dropdown just stays empty, matches old wizard
    } finally {
      if (mounted) setState(() => _loadingRegions = false);
    }
  }

  void _onRegionChanged(Map<String, dynamic>? region) {
    setState(() {
      _selectedRegionName = region?['name'] as String?;
      _selectedRegionId = region?['id'] as String?;
      _selectedDepartmentName = null;
      _departments = [];
    });
    if (region != null) _loadDepartments(region['id'] as String);
  }

  Future<void> _loadDepartments(String regionId) async {
    setState(() => _loadingDepartments = true);
    try {
      final api = ref.read(apiClientProvider);
      final data = await api.getDepartments(regionId);
      if (!mounted) return;
      setState(() => _departments = data.cast<Map<String, dynamic>>());
    } catch (e) {
      // swallow — matches old wizard behaviour
    } finally {
      if (mounted) setState(() => _loadingDepartments = false);
    }
  }

  // ── Submit ───────────────────────────────────────────────────

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_role == null) {
      showAdminToast(context, context.l10n.createMinefopUserSelectRoleError, UltraTheme.error,
          Icons.error_rounded);
      return;
    }
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiClientProvider);
      final result = await api.adminCreateMinefopUser(
        email: _emailCtrl.text.trim(),
        firstName: _firstNameCtrl.text.trim(),
        lastName: _lastNameCtrl.text.trim(),
        role: _role!,
        region: _selectedRegionName,
        department: _selectedDepartmentName,
        matricule: _matriculeCtrl.text.trim().isEmpty ? null : _matriculeCtrl.text.trim(),
        poste: _resolvedJobTitle.isEmpty ? null : _resolvedJobTitle,
        serviceCode: _selectedServiceUnit?['code'] as String?,
        positionType: _selectedPositionType,
      );
      if (!mounted) return;
      setState(() => _submitting = false);
      final user = result['user'] as Map?;
      final password = result['temporaryPassword'] as String? ?? '';
      await _showCredentialsReceipt(
        name: '${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}',
        email: user?['email'] as String? ?? _emailCtrl.text.trim(),
        password: password,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      final msg = e is ApiException ? e.message : e.toString();
      showAdminToast(context, msg, UltraTheme.error, Icons.error_rounded);
    }
  }

  Future<void> _showCredentialsReceipt({
    required String name,
    required String email,
    required String password,
  }) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _CredentialsReceiptDialog(
        name: name,
        email: email,
        password: password,
        onDone: () {
          Navigator.of(ctx).pop();
          Navigator.of(context).pop(true);
        },
      ),
    );
  }

  // ── Build ────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        backgroundColor: UltraTheme.surface,
        elevation: 0,
        foregroundColor: UltraTheme.textPrimary,
        title: Text(context.l10n.createMinefopUserAppBarTitle,
            style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 16)),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
          child: Form(
            key: _formKey,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SectionLabel(context.l10n.companiesDetailIdentitySectionTitle),
                  const SizedBox(height: 10),
                  _TextField(
                    controller: _firstNameCtrl,
                    label: context.l10n.createMinefopUserFirstNameLabel,
                    validator: (v) => (v == null || v.trim().isEmpty) ? context.l10n.requiredShort : null,
                  ),
                  const SizedBox(height: 12),
                  _TextField(
                    controller: _lastNameCtrl,
                    label: context.l10n.nameColumnHeader,
                    validator: (v) => (v == null || v.trim().isEmpty) ? context.l10n.requiredShort : null,
                  ),
                  const SizedBox(height: 12),
                  _TextField(
                    controller: _emailCtrl,
                    label: context.l10n.createMinefopUserProfessionalEmailLabel,
                    keyboardType: TextInputType.emailAddress,
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return context.l10n.requiredShort;
                      if (!v.contains('@')) return context.l10n.emailInvalidShort;
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),

                  _SectionLabel(context.l10n.createMinefopUserRoleSectionLabel),
                  const SizedBox(height: 10),
                  _Dropdown<String>(
                    hint: context.l10n.createMinefopUserSelectRoleHint,
                    value: _role,
                    items: _roles
                        .map((r) => DropdownMenuItem(value: r, child: Text(_roleLabels[r]!)))
                        .toList(),
                    onChanged: _onRoleChanged,
                  ),

                  if (_role != null) ...[
                    const SizedBox(height: 24),
                    _SectionLabel(context.l10n.createMinefopUserPositionSectionLabel),
                    const SizedBox(height: 10),
                    _buildPositionTypeDropdown(),
                    if (_selectedPositionType != null) ...[
                      const SizedBox(height: 12),
                      _buildParentUnitDropdown(),
                    ],
                    if (_selectedParentUnit != null) ...[
                      const SizedBox(height: 12),
                      _buildServiceUnitDropdown(),
                    ],
                    if (_resolvedJobTitle.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      _JobTitlePreview(title: _resolvedJobTitle),
                    ],
                    const SizedBox(height: 12),
                    _TextField(
                      controller: _matriculeCtrl,
                      label: context.l10n.createMinefopUserMatriculeLabel,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    ),
                  ],

                  if (_needsLocation) ...[
                    const SizedBox(height: 24),
                    _SectionLabel(context.l10n.registerStepTitleLocation),
                    const SizedBox(height: 10),
                    _buildRegionDropdown(),
                    if (_needsDepartment) ...[
                      const SizedBox(height: 12),
                      _buildDepartmentDropdown(),
                    ],
                  ],

                  const SizedBox(height: 28),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _submitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: UltraTheme.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _submitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2.4, valueColor: AlwaysStoppedAnimation(Colors.white)))
                          : Text(context.l10n.createMinefopUserCreateAccountButton,
                              style: const TextStyle(
                                  fontFamily: 'Inter', fontWeight: FontWeight.w600, fontSize: 15)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPositionTypeDropdown() {
    if (_loadingPositionTypes) return _LoadingField(label: context.l10n.createMinefopUserLoadingFunctions);
    if (_positionTypesError != null) return _ErrorNote(message: _positionTypesError!);
    if (_positionTypes.isEmpty) return _ErrorNote(message: context.l10n.createMinefopUserNoFunctionsAvailable);
    return _Dropdown<String>(
      hint: context.l10n.createMinefopUserSelectFunctionHint,
      value: _selectedPositionType,
      items: _positionTypes
          .map((e) => DropdownMenuItem(
              value: e['positionType'] as String, child: Text(e['label'] as String)))
          .toList(),
      onChanged: _onPositionTypeChanged,
    );
  }

  Widget _buildParentUnitDropdown() {
    if (_loadingParentUnits) return _LoadingField(label: context.l10n.createMinefopUserLoadingUnits);
    if (_parentUnits.isEmpty) return _ErrorNote(message: context.l10n.createMinefopUserNoUnitsAvailable);
    return _Dropdown<String>(
      hint: context.l10n.createMinefopUserParentUnitHint,
      value: _selectedParentUnit?['code'] as String?,
      items: _parentUnits
          .map((e) =>
              DropdownMenuItem(value: e['code'] as String, child: Text(e['displayName'] as String)))
          .toList(),
      onChanged: _onParentUnitChanged,
    );
  }

  Widget _buildServiceUnitDropdown() {
    if (_loadingServiceUnits) return _LoadingField(label: context.l10n.createMinefopUserLoadingServices);
    if (_serviceUnits.isEmpty) return _ErrorNote(message: context.l10n.createMinefopUserNoServiceFound);
    return _Dropdown<String>(
      hint: context.l10n.createMinefopUserExactServiceHint,
      value: _selectedServiceUnit?['code'] as String?,
      items: _serviceUnits
          .map((e) =>
              DropdownMenuItem(value: e['code'] as String, child: Text(e['displayName'] as String)))
          .toList(),
      onChanged: _onServiceUnitChanged,
    );
  }

  Widget _buildRegionDropdown() {
    if (_loadingRegions) return _LoadingField(label: context.l10n.createMinefopUserLoadingRegions);
    return _Dropdown<String>(
      hint: context.l10n.pdfRegionLabel,
      value: _selectedRegionId,
      items: _regions
          .map((r) => DropdownMenuItem(value: r['id'] as String, child: Text(r['name'] as String)))
          .toList(),
      onChanged: (id) => _onRegionChanged(
          id == null ? null : _regions.firstWhere((r) => r['id'] == id)),
    );
  }

  Widget _buildDepartmentDropdown() {
    if (_selectedRegionId == null) {
      return _ErrorNote(message: context.l10n.createMinefopUserSelectRegionFirstNote);
    }
    if (_loadingDepartments) return _LoadingField(label: context.l10n.createMinefopUserLoadingDepartments);
    return _Dropdown<String>(
      hint: context.l10n.pdfDepartmentLabel,
      value: _departments.any((d) => d['name'] == _selectedDepartmentName)
          ? _selectedDepartmentName
          : null,
      items: _departments
          .map((d) => DropdownMenuItem(value: d['name'] as String, child: Text(d['name'] as String)))
          .toList(),
      onChanged: (name) => setState(() => _selectedDepartmentName = name),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Shared small widgets
// ═══════════════════════════════════════════════════════════════

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(
            fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w700, color: UltraTheme.textSecondary));
  }
}

class _TextField extends StatelessWidget {
  const _TextField({
    required this.controller,
    required this.label,
    this.validator,
    this.keyboardType,
    this.inputFormatters,
  });

  final TextEditingController controller;
  final String label;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      validator: validator,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      style: const TextStyle(fontFamily: 'Inter', fontSize: 14, color: UltraTheme.textPrimary),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted),
        filled: true,
        fillColor: UltraTheme.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: UltraTheme.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: UltraTheme.error),
        ),
      ),
    );
  }
}

class _Dropdown<T> extends StatelessWidget {
  const _Dropdown({required this.hint, required this.value, required this.items, required this.onChanged});

  final String hint;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          hint: Text(hint, style: const TextStyle(fontFamily: 'Inter', fontSize: 14, color: UltraTheme.textMuted)),
          style: const TextStyle(fontFamily: 'Inter', fontSize: 14, color: UltraTheme.textPrimary),
          icon: const Icon(Icons.expand_more_rounded, size: 18, color: UltraTheme.textMuted),
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _LoadingField extends StatelessWidget {
  const _LoadingField({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.2)),
      ),
      child: Row(children: [
        const SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(UltraTheme.primary))),
        const SizedBox(width: 10),
        Text(label, style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted)),
      ]),
    );
  }
}

class _ErrorNote extends StatelessWidget {
  const _ErrorNote({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: UltraTheme.warning.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: UltraTheme.warning.withValues(alpha: 0.25)),
      ),
      child: Row(children: [
        const Icon(Icons.info_outline_rounded, size: 16, color: UltraTheme.warning),
        const SizedBox(width: 8),
        Expanded(
            child: Text(message,
                style: const TextStyle(fontFamily: 'Inter', fontSize: 12, color: UltraTheme.warning))),
      ]),
    );
  }
}

class _JobTitlePreview extends StatelessWidget {
  const _JobTitlePreview({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: UltraTheme.success.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: UltraTheme.success.withValues(alpha: 0.25)),
      ),
      child: Row(children: [
        const Icon(Icons.badge_outlined, size: 16, color: UltraTheme.success),
        const SizedBox(width: 8),
        Expanded(
            child: Text(title,
                style: const TextStyle(
                    fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w600, color: UltraTheme.success))),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Credentials receipt dialog — shown once, immediately after creation.
// ═══════════════════════════════════════════════════════════════

class _CredentialsReceiptDialog extends StatelessWidget {
  const _CredentialsReceiptDialog({
    required this.name,
    required this.email,
    required this.password,
    required this.onDone,
  });

  final String name;
  final String email;
  final String password;
  final VoidCallback onDone;

  void _copy(BuildContext context, String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    showAdminToast(context, context.l10n.createMinefopUserCopiedToast(label), UltraTheme.success, Icons.check_circle_rounded);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: UltraTheme.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                  color: UltraTheme.success.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14)),
              child: const Icon(Icons.check_circle_rounded, color: UltraTheme.success, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(context.l10n.createMinefopUserAccountCreatedTitle,
                    style: const TextStyle(fontFamily: 'Inter', fontSize: 16, fontWeight: FontWeight.w700)),
                Text(name,
                    style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: UltraTheme.textMuted)),
              ]),
            ),
          ]),
          const SizedBox(height: 20),
          Text(
            context.l10n.createMinefopUserCredentialsWarning,
            style: const TextStyle(fontFamily: 'Inter', fontSize: 12.5, color: UltraTheme.textMuted, height: 1.4),
          ),
          const SizedBox(height: 16),
          _CredentialRow(label: context.l10n.registerEmailRowLabel, value: email, onCopy: () => _copy(context, email, 'Email')),
          const SizedBox(height: 10),
          _CredentialRow(
              label: context.l10n.temporaryPasswordLabel, value: password, onCopy: () => _copy(context, password, 'Mot de passe')),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onDone,
              style: ElevatedButton.styleFrom(
                backgroundColor: UltraTheme.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(context.l10n.createMinefopUserDoneButton, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w600)),
            ),
          ),
        ]),
      ),
    );
  }
}

class _CredentialRow extends StatelessWidget {
  const _CredentialRow({required this.label, required this.value, required this.onCopy});
  final String label;
  final String value;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: UltraTheme.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: UltraTheme.textMuted.withValues(alpha: 0.15)),
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label,
                style: const TextStyle(
                    fontFamily: 'Inter', fontSize: 11, fontWeight: FontWeight.w600, color: UltraTheme.textMuted)),
            const SizedBox(height: 3),
            SelectableText(value,
                style: const TextStyle(
                    fontFamily: 'Inter', fontSize: 14, fontWeight: FontWeight.w700, color: UltraTheme.textPrimary)),
          ]),
        ),
        IconButton(
          onPressed: onCopy,
          icon: const Icon(Icons.copy_rounded, size: 18, color: UltraTheme.primary),
          tooltip: context.l10n.createMinefopUserCopyTooltip,
        ),
      ]),
    );
  }
}
