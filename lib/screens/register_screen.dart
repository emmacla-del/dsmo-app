import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/api_client.dart';
import '../providers/auth_provider.dart';
import '../theme/app_colors.dart';

// ─── Step indices (page positions in PageView) ───────────────────────────────
const _kStepRole          = 0;
const _kStepIdentity      = 1; // company name + email  OR  first/last name + email
const _kStepCompanyInfo   = 2; // COMPANY ONLY: NIU, CNPS, activity, address, fax, capital
const _kStepAssignment    = 3; // region + department
const _kStepSecurity      = 4;
const _kStepReview        = 5;

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final PageController _pageCtrl = PageController();

  final _identityKey  = GlobalKey<FormState>();
  final _companyKey   = GlobalKey<FormState>();
  final _securityKey  = GlobalKey<FormState>();

  // ── Role
  String _role = '';

  // ── Identity (all roles)
  String _email     = '';
  String _firstName = ''; // used by gov roles; for COMPANY holds raison sociale
  String _lastName  = ''; // gov only

  // ── Company details (COMPANY only)
  String  _taxNumber         = '';
  String  _cnpsNumber        = '';
  String  _fax               = '';
  String  _address           = '';
  String? _parentCompany;
  String  _secondaryActivity = '';
  int?    _socialCapital;
  Map<String, dynamic>? _selectedSector; // mainActivity

  // ── Assignment / location
  Map<String, dynamic>? _selectedRegion;
  Map<String, dynamic>? _selectedDepartment;

  // ── Location data from API
  List<dynamic> _regions     = [];
  List<dynamic> _departments = [];
  List<dynamic> _sectors     = [];
  bool _loadingLocations = false;
  bool _loadingSectors   = false;

  // ── Security
  String _password     = '';
  bool   _obscurePw      = true;
  bool   _obscureConfirm = true;

  // ── UI state
  int  _step         = _kStepRole;
  bool _isSubmitting = false;

  // ── Computed: which pages are visible for the current role
  bool get _isCompany => _role == 'COMPANY';
  bool get _needsAssignment =>
      _role == 'COMPANY' || _role == 'DIVISIONAL' || _role == 'REGIONAL';

  List<int> get _visibleSteps {
    if (_role.isEmpty) return [_kStepRole];
    return [
      _kStepRole,
      _kStepIdentity,
      if (_isCompany) _kStepCompanyInfo,
      if (_needsAssignment) _kStepAssignment,
      _kStepSecurity,
      _kStepReview,
    ];
  }

  int get _visibleCount     => _visibleSteps.length;
  int get _currentVisibleIdx => _visibleSteps.indexOf(_step);

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  void _goToStep(int step) {
    setState(() => _step = step);
    _pageCtrl.animateToPage(step,
        duration: const Duration(milliseconds: 320), curve: Curves.easeInOut);
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

  // ── Advance with validation ─────────────────────────────────────────────────

  Future<void> _advance() async {
    switch (_step) {
      case _kStepRole:
        if (_role.isEmpty) {
          _snack('Veuillez choisir un type de compte', error: true);
          return;
        }
        _next();

      case _kStepIdentity:
        if (!_identityKey.currentState!.validate()) return;
        _identityKey.currentState!.save();
        _next();

      case _kStepCompanyInfo:
        if (!_companyKey.currentState!.validate()) return;
        if (_selectedSector == null) {
          _snack('Veuillez sélectionner une activité principale', error: true);
          return;
        }
        _companyKey.currentState!.save();
        _next();

      case _kStepAssignment:
        if (_selectedRegion == null) {
          _snack('Veuillez sélectionner une région', error: true);
          return;
        }
        if ((_isCompany || _role == 'DIVISIONAL') && _selectedDepartment == null) {
          _snack('Veuillez sélectionner un département', error: true);
          return;
        }
        _next();

      case _kStepSecurity:
        if (!_securityKey.currentState!.validate()) return;
        _securityKey.currentState!.save();
        _next();

      case _kStepReview:
        await _submit();
    }
  }

  // ── Data loaders ────────────────────────────────────────────────────────────

  Future<void> _loadRegions() async {
    if (_regions.isNotEmpty) return;
    setState(() => _loadingLocations = true);
    try {
      final data = await ref.read(apiClientProvider).getRegions();
      if (mounted) setState(() { _regions = data; _loadingLocations = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingLocations = false);
    }
  }

  Future<void> _loadDepartments(String regionId) async {
    setState(() { _departments = []; _loadingLocations = true; });
    try {
      final data = await ref.read(apiClientProvider).getDepartments(regionId);
      if (mounted) setState(() { _departments = data; _loadingLocations = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingLocations = false);
    }
  }

  Future<void> _loadSectors() async {
    if (_sectors.isNotEmpty) return;
    setState(() => _loadingSectors = true);
    try {
      final data = await ref.read(apiClientProvider).getSectors();
      if (mounted) setState(() { _sectors = data; _loadingSectors = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingSectors = false);
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  Future<void> _submit() async {
    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);
    try {
      final regionName = (_selectedRegion?['name'] as String?);
      final deptName   = (_isCompany || _role == 'DIVISIONAL')
          ? (_selectedDepartment?['name'] as String?)
          : null;

      // Register user account + auto-login (sets JWT token)
      await ref.read(authProvider.notifier).register(
        _email,
        _password,
        _isCompany ? _firstName : _firstName, // raison sociale OR first name
        _isCompany ? '' : _lastName,
        _role,
        region: regionName,
        department: deptName,
      );

      // For COMPANY: save the full profile now that the token is set
      if (_isCompany && mounted) {
        try {
          await ref.read(apiClientProvider).saveCompanyProfile({
            'name': _firstName,       // raison sociale stored in _firstName
            'taxNumber': _taxNumber,
            'mainActivity': _selectedSector?['name'] ?? '',
            'region': regionName ?? '',
            'department': deptName ?? '',
            'address': _address,
            if (_cnpsNumber.isNotEmpty) 'cnpsNumber': _cnpsNumber,
            if (_fax.isNotEmpty) 'fax': _fax,
            if (_secondaryActivity.isNotEmpty) 'secondaryActivity': _secondaryActivity,
            if (_parentCompany != null && _parentCompany!.isNotEmpty)
              'parentCompany': _parentCompany,
            if (_socialCapital != null) 'socialCapital': _socialCapital,
          });
        } catch (e) {
          // Non-fatal — user can update the profile later
          debugPrint('Company profile save failed: $e');
        }
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _snack(String msg, {bool error = false}) =>
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg),
          backgroundColor: error ? Colors.red : Colors.green,
        ),
      );

  // ── Password helpers ────────────────────────────────────────────────────────

  double _pwStrength(String pw) {
    if (pw.isEmpty) return 0;
    double s = 0;
    if (pw.length >= 8)  s += 0.25;
    if (pw.length >= 12) s += 0.15;
    if (pw.contains(RegExp(r'[A-Z]'))) s += 0.2;
    if (pw.contains(RegExp(r'[0-9]'))) s += 0.2;
    if (pw.contains(RegExp(r'[!@#\$%^&*]'))) s += 0.2;
    return s.clamp(0, 1);
  }

  Color _pwColor(double s) =>
      s < 0.35 ? Colors.red : s < 0.65 ? Colors.orange : Colors.green;

  String _pwLabel(double s) =>
      s < 0.35 ? 'Faible' : s < 0.65 ? 'Moyen' : s < 0.9 ? 'Fort' : 'Très fort';

  // ── Build ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<dynamic>>(authProvider, (_, next) {
      if (next is AsyncData && next.value != null) {
        Navigator.pushReplacementNamed(context, '/home');
      }
    });

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
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(authState.error.toString(),
                        style: const TextStyle(color: Colors.red, fontSize: 13)),
                  ),
                ]),
              ),

            Expanded(
              child: PageView(
                controller: _pageCtrl,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  // 0 — Role
                  _StepRole(selected: _role, onSelect: (r) {
                    setState(() {
                      _role = r;
                      _selectedRegion = null;
                      _selectedDepartment = null;
                    });
                  }),

                  // 1 — Identity
                  _StepIdentity(
                    formKey: _identityKey,
                    isCompany: _isCompany,
                    initialFirstName: _firstName,
                    initialLastName: _lastName,
                    initialEmail: _email,
                    onSave: (fn, ln, em) {
                      _firstName = fn;
                      _lastName  = ln;
                      _email     = em;
                    },
                  ),

                  // 2 — Company info (COMPANY only page)
                  _StepCompanyInfo(
                    formKey: _companyKey,
                    sectors: _sectors,
                    loadingSectors: _loadingSectors,
                    selectedSector: _selectedSector,
                    onSectorChanged: (s) => setState(() => _selectedSector = s),
                    initialTaxNumber: _taxNumber,
                    initialCnps: _cnpsNumber,
                    initialFax: _fax,
                    initialAddress: _address,
                    initialParentCompany: _parentCompany ?? '',
                    initialSecondaryActivity: _secondaryActivity,
                    initialCapital: _socialCapital,
                    onInit: _loadSectors,
                    onSave: (niu, cnps, fax, addr, parent, sec, cap) {
                      _taxNumber          = niu;
                      _cnpsNumber         = cnps;
                      _fax                = fax;
                      _address            = addr;
                      _parentCompany      = parent.isNotEmpty ? parent : null;
                      _secondaryActivity  = sec;
                      _socialCapital      = cap;
                    },
                  ),

                  // 3 — Assignment / Location
                  _StepAssignment(
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
                    },
                    onDepartmentChanged: (d) => setState(() => _selectedDepartment = d),
                    onInit: _loadRegions,
                  ),

                  // 4 — Security
                  _StepSecurity(
                    formKey: _securityKey,
                    initialPassword: _password,
                    obscurePw: _obscurePw,
                    obscureConfirm: _obscureConfirm,
                    onTogglePw: () => setState(() => _obscurePw = !_obscurePw),
                    onToggleConfirm: () => setState(() => _obscureConfirm = !_obscureConfirm),
                    onSave: (pw, _) { _password = pw; },
                    strengthOf: _pwStrength,
                    strengthColor: _pwColor,
                    strengthLabel: _pwLabel,
                  ),

                  // 5 — Review
                  _StepReview(
                    role: _role,
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
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: Column(
                children: [
                  if (isBusy)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 10),
                      child: LinearProgressIndicator(),
                    ),
                  SizedBox(
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
                        _step == _kStepReview ? 'Créer mon compte' : 'Continuer',
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
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
      case _kStepRole:        return 'Type de compte';
      case _kStepIdentity:    return isCompany ? 'Identification' : 'Informations personnelles';
      case _kStepCompanyInfo: return 'Informations de l\'entreprise';
      case _kStepAssignment:  return isCompany ? 'Localisation' : 'Zone d\'affectation';
      case _kStepSecurity:    return 'Sécurité';
      case _kStepReview:      return 'Récapitulatif';
      default:                return '';
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
  final String selected;
  final ValueChanged<String> onSelect;
  const _StepRole({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Quel est votre type de compte ?',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text('Choisissez le profil correspondant à votre organisation.',
              style: TextStyle(color: AppColors.slate, fontSize: 14)),
          const SizedBox(height: 28),
          _RoleCard(
            value: 'COMPANY', selected: selected,
            icon: Icons.business_outlined, color: Colors.teal,
            title: 'Entreprise',
            subtitle: 'Société soumise à la déclaration annuelle des mouvements d\'emploi (DSMO).',
            onTap: onSelect,
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(children: [
              const Expanded(child: Divider()),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Text('Services de l\'État',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ),
              const Expanded(child: Divider()),
            ]),
          ),
          _RoleCard(
            value: 'DIVISIONAL', selected: selected,
            icon: Icons.location_city_outlined, color: Colors.indigo,
            title: 'Délégation Divisionnaire',
            subtitle: 'Valide les déclarations au niveau départemental.',
            onTap: onSelect,
          ),
          const SizedBox(height: 12),
          _RoleCard(
            value: 'REGIONAL', selected: selected,
            icon: Icons.map_outlined, color: Colors.blue.shade700,
            title: 'Délégation Régionale',
            subtitle: 'Supervise et valide après approbation divisionnaire.',
            onTap: onSelect,
          ),
          const SizedBox(height: 12),
          _RoleCard(
            value: 'CENTRAL', selected: selected,
            icon: Icons.account_balance_outlined, color: Colors.deepPurple,
            title: 'Direction Nationale (MINTSS)',
            subtitle: 'Administration centrale. Approbation finale nationale.',
            onTap: onSelect,
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
    required this.value, required this.selected,
    required this.icon, required this.color,
    required this.title, required this.subtitle,
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
              width: 48, height: 48,
              decoration: BoxDecoration(
                  color: color.withAlpha(25),
                  borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
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
// Step 1 — Identity (role-aware)
// ═══════════════════════════════════════════════════════════════════════════

class _StepIdentity extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final bool isCompany;
  final String initialFirstName, initialLastName, initialEmail;
  final void Function(String fn, String ln, String em) onSave;

  const _StepIdentity({
    required this.formKey,
    required this.isCompany,
    required this.initialFirstName,
    required this.initialLastName,
    required this.initialEmail,
    required this.onSave,
  });

  @override
  State<_StepIdentity> createState() => _StepIdentityState();
}

class _StepIdentityState extends State<_StepIdentity> {
  late final TextEditingController _c1; // company name OR first name
  late final TextEditingController _c2; // last name (gov only)
  late final TextEditingController _emailCtrl;

  @override
  void initState() {
    super.initState();
    _c1 = TextEditingController(text: widget.initialFirstName);
    _c2 = TextEditingController(text: widget.initialLastName);
    _emailCtrl = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _c1.dispose(); _c2.dispose(); _emailCtrl.dispose();
    super.dispose();
  }

  void _notify() =>
      widget.onSave(_c1.text.trim(), _c2.text.trim(), _emailCtrl.text.trim());

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Form(
        key: widget.formKey,
        onChanged: _notify,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            widget.isCompany
                ? 'Identification de l\'entreprise'
                : 'Vos informations personnelles',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(
            widget.isCompany
                ? 'Renseignez la dénomination sociale et l\'email de contact de l\'entreprise.'
                : 'Ces informations identifient votre compte.',
            style: const TextStyle(color: AppColors.slate, fontSize: 14),
          ),
          const SizedBox(height: 28),

          if (widget.isCompany) ...[
            _Field(
              controller: _c1,
              label: 'Raison sociale *',
              icon: Icons.business_outlined,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
            ),
          ] else ...[
            Row(children: [
              Expanded(
                child: _Field(
                  controller: _c1,
                  label: 'Prénom *',
                  icon: Icons.person_outline,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _Field(
                  controller: _c2,
                  label: 'Nom *',
                  icon: Icons.badge_outlined,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
                ),
              ),
            ]),
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
// Step 2 — Company info (COMPANY only)
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

  const _StepCompanyInfo({
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
  });

  @override
  State<_StepCompanyInfo> createState() => _StepCompanyInfoState();
}

class _StepCompanyInfoState extends State<_StepCompanyInfo> {
  late final TextEditingController _niuCtrl;
  late final TextEditingController _cnpsCtrl;
  late final TextEditingController _faxCtrl;
  late final TextEditingController _addrCtrl;
  late final TextEditingController _parentCtrl;
  late final TextEditingController _secActCtrl;
  late final TextEditingController _capitalCtrl;

  @override
  void initState() {
    super.initState();
    _niuCtrl    = TextEditingController(text: widget.initialTaxNumber);
    _cnpsCtrl   = TextEditingController(text: widget.initialCnps);
    _faxCtrl    = TextEditingController(text: widget.initialFax);
    _addrCtrl   = TextEditingController(text: widget.initialAddress);
    _parentCtrl = TextEditingController(text: widget.initialParentCompany);
    _secActCtrl = TextEditingController(text: widget.initialSecondaryActivity);
    _capitalCtrl = TextEditingController(
        text: widget.initialCapital != null ? '${widget.initialCapital}' : '');
    WidgetsBinding.instance.addPostFrameCallback((_) => widget.onInit());
  }

  @override
  void dispose() {
    _niuCtrl.dispose(); _cnpsCtrl.dispose(); _faxCtrl.dispose();
    _addrCtrl.dispose(); _parentCtrl.dispose(); _secActCtrl.dispose();
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

          // ── Identification fiscale ────────────────────────────────────────
          _SectionLabel('Identification fiscale'),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              flex: 3,
              child: _Field(
                controller: _niuCtrl,
                label: 'N° Contribuable (NIU) *',
                icon: Icons.tag,
                textInputAction: TextInputAction.next,
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'NIU requis' : null,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: _Field(
                controller: _cnpsCtrl,
                label: 'N° CNPS',
                icon: Icons.shield_outlined,
                textInputAction: TextInputAction.next,
              ),
            ),
          ]),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: _Field(
                controller: _faxCtrl,
                label: 'Fax',
                icon: Icons.print_outlined,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: _Field(
                controller: _capitalCtrl,
                label: 'Capital social (XAF)',
                icon: Icons.account_balance_outlined,
                keyboardType: const TextInputType.numberWithOptions(decimal: false),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                textInputAction: TextInputAction.next,
              ),
            ),
          ]),

          // ── Activité ──────────────────────────────────────────────────────
          _SectionLabel('Activité'),
          if (widget.loadingSectors)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            )
          else
            DropdownButtonFormField<Map<String, dynamic>>(
              value: widget.selectedSector,
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
              validator: (_) =>
                  widget.selectedSector == null ? 'Requis' : null,
            ),
          const SizedBox(height: 14),
          _Field(
            controller: _secActCtrl,
            label: 'Activité secondaire (optionnel)',
            icon: Icons.work_history_outlined,
            textInputAction: TextInputAction.next,
          ),

          // ── Coordonnées ───────────────────────────────────────────────────
          _SectionLabel('Coordonnées'),
          _Field(
            controller: _addrCtrl,
            label: 'Adresse complète *',
            icon: Icons.location_on_outlined,
            textInputAction: TextInputAction.next,
            maxLines: 2,
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Adresse requise' : null,
          ),
          _Field(
            controller: _parentCtrl,
            label: 'Maison mère / Groupe (optionnel)',
            icon: Icons.corporate_fare_outlined,
            textInputAction: TextInputAction.done,
          ),

          const SizedBox(height: 8),
          _InfoBox(
            icon: Icons.auto_fix_high_outlined,
            color: Colors.teal,
            text:
                'Ces informations seront automatiquement pré-remplies dans la Partie A de vos futures déclarations DSMO.',
          ),
        ]),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 3 — Assignment / Location
// ═══════════════════════════════════════════════════════════════════════════

class _StepAssignment extends StatefulWidget {
  final String role;
  final List<dynamic> regions, departments;
  final bool loadingLocations;
  final Map<String, dynamic>? selectedRegion, selectedDepartment;
  final ValueChanged<Map<String, dynamic>?> onRegionChanged;
  final ValueChanged<Map<String, dynamic>?> onDepartmentChanged;
  final VoidCallback onInit;

  const _StepAssignment({
    required this.role,
    required this.regions, required this.departments,
    required this.loadingLocations,
    required this.selectedRegion, required this.selectedDepartment,
    required this.onRegionChanged, required this.onDepartmentChanged,
    required this.onInit,
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
  bool get _showDept  => _isCompany || widget.role == 'DIVISIONAL';

  @override
  Widget build(BuildContext context) {
    final color = _isCompany ? Colors.teal : Colors.indigo;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(
          _isCompany ? 'Localisation de l\'établissement' : 'Zone d\'affectation',
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
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
          const Center(child: Padding(
            padding: EdgeInsets.all(32),
            child: CircularProgressIndicator(),
          ))
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
              onChanged: widget.selectedRegion == null ? null : widget.onDepartmentChanged,
            ),
          ],
          const SizedBox(height: 20),
          _InfoBox(
            icon: _isCompany ? Icons.auto_fix_high_outlined : Icons.shield_outlined,
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
    required this.label, required this.hint, required this.icon,
    required this.items, required this.selected, required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label,
          style: const TextStyle(
              fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.slate)),
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
// Step 4 — Security
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

  const _StepSecurity({
    required this.formKey,
    required this.initialPassword,
    required this.obscurePw, required this.obscureConfirm,
    required this.onTogglePw, required this.onToggleConfirm,
    required this.onSave,
    required this.strengthOf, required this.strengthColor,
    required this.strengthLabel,
  });

  @override
  State<_StepSecurity> createState() => _StepSecurityState();
}

class _StepSecurityState extends State<_StepSecurity> {
  late final TextEditingController _pwCtrl;
  late final TextEditingController _confirmCtrl;
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
    _confirmCtrl.addListener(() => widget.onSave(_pwCtrl.text, _confirmCtrl.text));
  }

  @override
  void dispose() { _pwCtrl.dispose(); _confirmCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final sc = widget.strengthColor(_strength);
    return SingleChildScrollView(
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
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true, fillColor: Colors.white,
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
                    color: sc),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              _pwCtrl.text.isEmpty ? '' : widget.strengthLabel(_strength),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: sc),
            ),
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
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              filled: true, fillColor: Colors.white,
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Confirmation requise';
              if (v != _pwCtrl.text) return 'Les mots de passe ne correspondent pas';
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
      spacing: 8, runSpacing: 4,
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
// Step 5 — Review
// ═══════════════════════════════════════════════════════════════════════════

class _StepReview extends StatelessWidget {
  final String role, firstName, lastName, email;
  final String taxNumber, cnpsNumber, mainActivity, secondaryActivity, address;
  final Map<String, dynamic>? selectedRegion, selectedDepartment;

  const _StepReview({
    required this.role, required this.firstName, required this.lastName,
    required this.email, required this.taxNumber, required this.cnpsNumber,
    required this.mainActivity, required this.secondaryActivity,
    required this.address,
    required this.selectedRegion, required this.selectedDepartment,
  });

  bool get _isCompany => role == 'COMPANY';

  String get _roleLabel {
    switch (role) {
      case 'COMPANY':    return 'Entreprise';
      case 'DIVISIONAL': return 'Délégation Divisionnaire';
      case 'REGIONAL':   return 'Délégation Régionale';
      case 'CENTRAL':    return 'Direction Nationale (MINTSS)';
      default:           return role;
    }
  }

  Color get _roleColor {
    switch (role) {
      case 'COMPANY':    return Colors.teal;
      case 'DIVISIONAL': return Colors.indigo;
      case 'REGIONAL':   return Colors.blue.shade700;
      default:           return Colors.deepPurple;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Récapitulatif',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text('Vérifiez vos informations avant de créer le compte.',
            style: TextStyle(color: AppColors.slate, fontSize: 14)),
        const SizedBox(height: 24),

        // Role badge
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _roleColor.withAlpha(20),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _roleColor.withAlpha(80)),
          ),
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

        // Identity card
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
              if (secondaryActivity.isNotEmpty) ('Activité secondaire', secondaryActivity),
              if (address.isNotEmpty) ('Adresse', address),
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
        _InfoBox(
          icon: Icons.check_circle_outline,
          color: Colors.green,
          text: 'Votre mot de passe est sécurisé et ne sera jamais affiché en clair.',
        ),

        if (_isCompany) ...[
          const SizedBox(height: 10),
          _InfoBox(
            icon: Icons.auto_fix_high_outlined,
            color: Colors.teal,
            text:
                'Les informations de votre entreprise seront automatiquement pré-remplies dans la Partie A de chaque déclaration DSMO.',
          ),
        ],
      ]),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<(String, String)> rows;

  const _ReviewCard({required this.title, required this.icon, required this.rows});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [BoxShadow(color: Colors.black.withAlpha(8), blurRadius: 8, offset: const Offset(0, 2))],
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
                    style: const TextStyle(fontSize: 12, color: AppColors.slate)),
              ),
              Expanded(
                child: Text(value.isEmpty ? '—' : value,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              ),
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
                  color: Colors.teal.shade700)),
        ),
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
        border: Border.all(color: color.withAlpha(60)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text,
              style: TextStyle(fontSize: 12, color: color, height: 1.5)),
        ),
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
