// lib/screens/registration_status_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/i18n/l10n_ext.dart';
import '../data/api_client.dart';
import '../data/minefop_models.dart' show EntityType;
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../widgets/public_chrome.dart';

/// Where a company lands after self-registration, and after every login,
/// until a reviewer activates the account (R.1).
///
/// A company in PENDING_APPROVAL or COMPLEMENTS_REQUESTED holds a real
/// session — it just has no operational screens yet — so this is the only
/// place it can go. In COMPLEMENTS_REQUESTED it also shows the reviewer's
/// message and offers the correction form below.
///
/// There is no REJECTED branch. A rejected registration gets a fixed login
/// message carrying no reviewer reason, and a rejected account that still
/// holds a token is signed out the moment /auth/me refuses it (see
/// ApiClient.onCompanyNotActive), so it never arrives here.
class RegistrationStatusScreen extends ConsumerStatefulWidget {
  const RegistrationStatusScreen({super.key});

  @override
  ConsumerState<RegistrationStatusScreen> createState() =>
      _RegistrationStatusScreenState();
}

/// The free-text corrections, paired with the label each one shows.
/// An explicit list, which is also what the diff iterates: the route
/// validates with forbidNonWhitelisted, so the body is assembled key by key
/// and never from a whole company profile.
typedef _FieldLabel = String Function(BuildContext);

class _CorrectableField {
  final String key;
  final _FieldLabel label;
  const _CorrectableField(this.key, this.label);
}

final List<_CorrectableField> _textFields = [
  _CorrectableField('name', (c) => c.l10n.registrationCorrectionNameLabel),
  _CorrectableField(
      'taxNumber', (c) => c.l10n.registrationCorrectionTaxNumberLabel),
  _CorrectableField(
      'mainActivity', (c) => c.l10n.registrationCorrectionMainActivityLabel),
  _CorrectableField('secondaryActivity',
      (c) => c.l10n.registrationCorrectionSecondaryActivityLabel),
  _CorrectableField(
      'parentCompany', (c) => c.l10n.registrationCorrectionParentCompanyLabel),
  _CorrectableField(
      'address', (c) => c.l10n.registrationCorrectionAddressLabel),
  _CorrectableField(
      'cnpsNumber', (c) => c.l10n.registrationCorrectionCnpsNumberLabel),
  _CorrectableField('fax', (c) => c.l10n.registrationCorrectionFaxLabel),
  _CorrectableField(
      'socialCapital', (c) => c.l10n.registrationCorrectionSocialCapitalLabel),
];

class _RegistrationStatusScreenState
    extends ConsumerState<RegistrationStatusScreen> {
  bool _busy = false;

  // The correction form, live only in COMPLEMENTS_REQUESTED.
  bool _loadingCompany = false;
  bool _companyLoadFailed = false;
  Map<String, dynamic>? _company;
  final Map<String, TextEditingController> _controllers = {};
  EntityType? _entityType;

  List<dynamic> _regions = [];
  List<dynamic> _departments = [];
  List<dynamic> _subdivisions = [];
  Map<String, dynamic>? _selectedRegion;
  Map<String, dynamic>? _selectedDepartment;
  Map<String, dynamic>? _selectedSubdivision;
  bool _territoryTouched = false;

  @override
  void initState() {
    super.initState();
    for (final field in _textFields) {
      _controllers[field.key] = TextEditingController();
    }
    // The decision may have been taken while the app was closed, so the
    // cached user can be stale on arrival. refreshUser() is best-effort and
    // keeps the cached user on failure.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await ref.read(authProvider.notifier).refreshUser();
      if (!mounted) return;
      final user = ref.read(authProvider).value;
      if (user?.status == 'COMPLEMENTS_REQUESTED') _loadCompany();
    });
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  /// Prefills the form. GET /dsmo/company is exempted for exactly this status
  /// (and PENDING_APPROVAL) precisely so it can prefill this form.
  Future<void> _loadCompany() async {
    if (_company != null || _loadingCompany) return;
    setState(() {
      _loadingCompany = true;
      _companyLoadFailed = false;
    });
    try {
      final company = await ref.read(apiClientProvider).getMyCompany();
      if (!mounted) return;
      setState(() {
        _company = company;
        for (final field in _textFields) {
          _controllers[field.key]!.text = _initial(field.key);
        }
        _entityType = _entityTypeFrom(company?['entityType'] as String?);
      });
      await _loadRegions();
    } catch (_) {
      if (mounted) setState(() => _companyLoadFailed = true);
    } finally {
      if (mounted) setState(() => _loadingCompany = false);
    }
  }

  String _initial(String key) {
    final value = _company?[key];
    return value == null ? '' : value.toString();
  }

  EntityType? _entityTypeFrom(String? apiValue) {
    if (apiValue == null) return null;
    for (final type in EntityType.values) {
      if (type.apiValue == apiValue) return type;
    }
    return null;
  }

  Future<void> _loadRegions() async {
    try {
      final data = await ref.read(apiClientProvider).getRegions();
      if (!mounted) return;
      setState(() {
        _regions = data;
        _selectedRegion = _matchByName(data, _initial('region'));
      });
      final regionId = _selectedRegion?['id'] as String?;
      if (regionId != null) await _loadDepartments(regionId, preselect: true);
    } catch (_) {
      if (mounted) _snack(context.l10n.registerLoadRegionsError, error: true);
    }
  }

  Future<void> _loadDepartments(String regionId,
      {bool preselect = false}) async {
    try {
      final data = await ref.read(apiClientProvider).getDepartments(regionId);
      if (!mounted) return;
      setState(() {
        _departments = data;
        _selectedDepartment =
            preselect ? _matchByName(data, _initial('department')) : null;
        _subdivisions = [];
        if (!preselect) _selectedSubdivision = null;
      });
      final departmentId = _selectedDepartment?['id'] as String?;
      if (preselect && departmentId != null) {
        await _loadSubdivisions(departmentId, preselect: true);
      }
    } catch (_) {
      if (mounted) {
        _snack(context.l10n.registerLoadDepartmentsError, error: true);
      }
    }
  }

  Future<void> _loadSubdivisions(String departmentId,
      {bool preselect = false}) async {
    try {
      final data =
          await ref.read(apiClientProvider).getSubdivisions(departmentId);
      if (!mounted) return;
      setState(() {
        _subdivisions = data;
        _selectedSubdivision =
            preselect ? _matchByName(data, _initial('subdivision')) : null;
      });
    } catch (_) {
      if (mounted) {
        _snack(context.l10n.registerLoadSubdivisionsError, error: true);
      }
    }
  }

  Map<String, dynamic>? _matchByName(List<dynamic> items, String name) {
    if (name.isEmpty) return null;
    for (final item in items) {
      if (item is Map && item['name'] == name) {
        return item.cast<String, dynamic>();
      }
    }
    return null;
  }

  void _snack(String message, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? PublicColors.red : PublicColors.green,
    ));
  }

  /// The changed fields, built key by key against the loaded profile.
  ///
  /// An unchanged field is left out entirely, so the audit diff records
  /// corrections and not noise. Nothing is spread in: an extra key would turn
  /// the request into a 400.
  Map<String, dynamic> _buildCorrections() {
    final out = <String, dynamic>{};
    if (_company == null) return out;

    for (final field in _textFields) {
      final current = _controllers[field.key]!.text.trim();
      if (current == _initial(field.key).trim()) continue;
      if (field.key == 'socialCapital') {
        // Left out when cleared: the field is optional and @IsInt would
        // refuse an empty string.
        final parsed = int.tryParse(current);
        if (parsed != null) out['socialCapital'] = parsed;
        continue;
      }
      out[field.key] = current;
    }

    final entityApiValue = _entityType?.apiValue;
    if (entityApiValue != null &&
        entityApiValue != (_company?['entityType'] as String?)) {
      out['entityType'] = entityApiValue;
    }

    // Territory resolves as a chain server-side and requires a subdivision,
    // so the three ids travel together or not at all.
    if (_territoryTouched) {
      out['regionId'] = _selectedRegion?['id'];
      out['departmentId'] = _selectedDepartment?['id'];
      out['subdivisionId'] = _selectedSubdivision?['id'];
    }
    return out;
  }

  Future<void> _resubmit() async {
    final corrections = _buildCorrections();
    if (corrections.containsKey('regionId') &&
        corrections['subdivisionId'] == null) {
      _snack(context.l10n.registrationCorrectionSubdivisionRequired,
          error: true);
      return;
    }

    setState(() => _busy = true);
    try {
      // An empty map is a resubmission with no corrections — still allowed,
      // for a company that was asked for a document rather than an edit.
      await ref
          .read(apiClientProvider)
          .resubmitRegistration(data: corrections);
      await ref.read(authProvider.notifier).refreshUser();
      if (mounted) _snack(context.l10n.registrationResubmitDoneMessage);
    } on ApiException catch (e) {
      if (mounted) _snack(e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refresh() async {
    setState(() => _busy = true);
    try {
      await ref.read(authProvider.notifier).refreshUser();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _logout() async {
    await ref.read(authProvider.notifier).logout();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;

    // An activated account has nothing to read here any more.
    ref.listen<AsyncValue<User?>>(authProvider, (_, next) {
      final updated = next.value;
      if (updated != null &&
          updated.role == 'COMPANY' &&
          updated.status == 'ACTIVE') {
        context.go('/home');
      }
    });

    final complements = user?.status == 'COMPLEMENTS_REQUESTED';

    return Scaffold(
      backgroundColor: PublicColors.bg,
      appBar: AppBar(
        title: Text(context.l10n.registrationStatusTitle),
        backgroundColor: PublicColors.green,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  complements
                      ? Icons.edit_note_outlined
                      : Icons.hourglass_top_outlined,
                  size: 48,
                  color: PublicColors.green,
                ),
                const SizedBox(height: 16),
                Text(
                  complements
                      ? context.l10n.registrationComplementsHeadline
                      : context.l10n.registrationPendingHeadline,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: PublicColors.gray900,
                  ),
                ),
                const SizedBox(height: 12),
                if (complements) ...[
                  Text(
                    context.l10n.registrationComplementsIntro,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.5,
                      color: PublicColors.gray700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    user?.approvalComment?.trim().isNotEmpty == true
                        ? user!.approvalComment!
                        : context.l10n.registrationComplementsFallback,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.5,
                      fontWeight: FontWeight.w600,
                      color: PublicColors.gray900,
                    ),
                  ),
                  const SizedBox(height: 20),
                  ..._buildCorrectionForm(),
                ] else
                  Text(
                    context.l10n.registrationAwaitingReviewMessage,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.5,
                      color: PublicColors.gray700,
                    ),
                  ),
                const SizedBox(height: 24),
                // One primary action per screen: resubmitting when that is
                // what the reviewer asked for, refreshing otherwise.
                if (complements)
                  FilledButton(
                    onPressed: _busy ? null : _resubmit,
                    style: FilledButton.styleFrom(
                      backgroundColor: PublicColors.green,
                    ),
                    child: Text(context.l10n.registrationResubmitButton),
                  )
                else
                  FilledButton(
                    onPressed: _busy ? null : _refresh,
                    style: FilledButton.styleFrom(
                      backgroundColor: PublicColors.green,
                    ),
                    child: Text(context.l10n.registrationStatusRefreshButton),
                  ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: _busy ? null : _logout,
                  child: Text(context.l10n.registrationStatusLogoutButton),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildCorrectionForm() {
    if (_loadingCompany) {
      return const [Center(child: CircularProgressIndicator())];
    }
    if (_companyLoadFailed) {
      return [
        Text(
          context.l10n.registrationCorrectionLoadError,
          style: const TextStyle(fontSize: 14, color: PublicColors.red),
        ),
      ];
    }
    if (_company == null) return const [];

    return [
      Text(
        context.l10n.registrationCorrectionIntro,
        style: const TextStyle(
          fontSize: 14,
          height: 1.5,
          color: PublicColors.gray700,
        ),
      ),
      const SizedBox(height: 16),
      for (final field in _textFields) ...[
        TextField(
          controller: _controllers[field.key],
          keyboardType: field.key == 'socialCapital'
              ? TextInputType.number
              : TextInputType.text,
          decoration: InputDecoration(
            labelText: field.label(context),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
      ],
      DropdownButtonFormField<EntityType>(
        initialValue: _entityType,
        decoration: InputDecoration(
          labelText: context.l10n.registrationCorrectionEntityTypeLabel,
          border: const OutlineInputBorder(),
        ),
        hint: Text(context.l10n.registrationCorrectionEntityTypeUnset),
        items: [
          for (final type in EntityType.values)
            DropdownMenuItem(value: type, child: Text(type.displayName)),
        ],
        onChanged: (value) => setState(() => _entityType = value),
      ),
      const SizedBox(height: 12),
      _territoryDropdown(
        label: context.l10n.registrationCorrectionRegionLabel,
        hint: context.l10n.registerSelectRegionShort,
        items: _regions,
        selected: _selectedRegion,
        onChanged: (value) {
          setState(() {
            _territoryTouched = true;
            _selectedRegion = value;
            _selectedDepartment = null;
            _selectedSubdivision = null;
            _departments = [];
            _subdivisions = [];
          });
          final id = value?['id'] as String?;
          if (id != null) _loadDepartments(id);
        },
      ),
      const SizedBox(height: 12),
      _territoryDropdown(
        label: context.l10n.registrationCorrectionDepartmentLabel,
        hint: _selectedRegion == null
            ? context.l10n.registerSelectRegionFirst
            : context.l10n.registerSelectDepartmentShort,
        items: _departments,
        selected: _selectedDepartment,
        onChanged: (value) {
          setState(() {
            _territoryTouched = true;
            _selectedDepartment = value;
            _selectedSubdivision = null;
            _subdivisions = [];
          });
          final id = value?['id'] as String?;
          if (id != null) _loadSubdivisions(id);
        },
      ),
      const SizedBox(height: 12),
      _territoryDropdown(
        label: context.l10n.registrationCorrectionSubdivisionLabel,
        hint: _selectedDepartment == null
            ? context.l10n.registerSelectDepartmentFirst
            : context.l10n.registerSelectSubdivisionShort,
        items: _subdivisions,
        selected: _selectedSubdivision,
        onChanged: (value) => setState(() {
          _territoryTouched = true;
          _selectedSubdivision = value;
        }),
      ),
    ];
  }

  Widget _territoryDropdown({
    required String label,
    required String hint,
    required List<dynamic> items,
    required Map<String, dynamic>? selected,
    required ValueChanged<Map<String, dynamic>?> onChanged,
  }) {
    // Matched by id rather than by identity: the preselected map comes from a
    // different list instance than the items rebuilt on each setState.
    final selectedId = selected?['id'] as String?;
    final options = <DropdownMenuItem<String>>[
      for (final item in items)
        if (item is Map)
          DropdownMenuItem(
            value: item['id'] as String,
            child: Text(item['name']?.toString() ?? ''),
          ),
    ];
    return DropdownButtonFormField<String>(
      initialValue:
          options.any((o) => o.value == selectedId) ? selectedId : null,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      hint: Text(hint),
      items: options,
      onChanged: items.isEmpty
          ? null
          : (id) {
              for (final item in items) {
                if (item is Map && item['id'] == id) {
                  onChanged(item.cast<String, dynamic>());
                  return;
                }
              }
              onChanged(null);
            },
    );
  }
}
