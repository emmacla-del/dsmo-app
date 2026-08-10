import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'employee_list_screen.dart';
import '../../../data/api_client.dart';
import '../../providers/connectivity_provider.dart';
import '../../providers/sync_queue_provider.dart';
import '../../services/draft_service.dart';
import '../../widgets/drafts_drawer.dart';
import 'dsmo_form_style.dart';

// Persists chosen language across the session
final languageProvider = StateProvider<String>((ref) => 'fr');

/// FR/EN copy for the DSMO declaration wizard, keyed by translation key.
const Map<String, Map<String, String>> _kDsmoWizardStrings = {
  'appBarTitle': {'fr': 'Déclaration DSMO', 'en': 'DSMO Declaration'},
  'btnSubmit': {'fr': 'SOUMETTRE', 'en': 'SUBMIT'},
  'btnContinue': {'fr': 'CONTINUER', 'en': 'CONTINUE'},
  'btnBack': {'fr': 'RETOUR', 'en': 'BACK'},
  'step1Title': {
    'fr': "1. Identité de l'établissement",
    'en': '1. Establishment identity',
  },
  'step2Title': {
    'fr': '2. Effectifs et mouvements',
    'en': '2. Workforce and movements',
  },
  'step3Title': {
    'fr': '3. Informations supplémentaires',
    'en': '3. Additional information',
  },
  'sectionIdentification': {
    'fr': "Identification de l'établissement",
    'en': 'Establishment identification',
  },
  'sectionLocalisation': {'fr': 'Localisation', 'en': 'Location'},
  'sectionCoordonnees': {
    'fr': 'Coordonnées administratives',
    'en': 'Administrative details',
  },
  'sectionWorkforceCurrent': {
    'fr': 'Effectifs au 31 décembre — Année en cours',
    'en': 'Staff as of Dec 31 — Current year',
  },
  'sectionWorkforcePrevious': {
    'fr': 'Effectifs au 31 décembre — Année précédente',
    'en': 'Staff as of Dec 31 — Previous year',
  },
  'sectionMovements': {
    'fr': 'Mouvements par catégories de salaire',
    'en': 'Movements by salary category',
  },
  'sectionQualitative': {
    'fr': 'Informations supplémentaires',
    'en': 'Additional information',
  },
  'fieldBudgetYear': {'fr': 'Année budgétaire', 'en': 'Budget year'},
  'fieldFillingDate': {'fr': 'Date de remplissage', 'en': 'Filing date'},
  'fieldCompanyName': {'fr': 'Raison sociale', 'en': 'Company name'},
  'fieldParentCompany': {
    'fr': "Raison sociale de l'entreprise mère (si applicable)",
    'en': 'Parent company name (if applicable)',
  },
  'fieldMainActivity': {
    'fr': 'Activité principale / Secteur',
    'en': 'Main activity / Sector',
  },
  'fieldSecondaryActivity': {
    'fr': 'Activité secondaire',
    'en': 'Secondary activity',
  },
  'fieldRegion': {'fr': 'Région', 'en': 'Region'},
  'fieldDepartment': {'fr': 'Département', 'en': 'Department'},
  'fieldSubdivision': {'fr': 'Arrondissement', 'en': 'Subdivision'},
  'fieldAddress': {'fr': 'Adresse complète', 'en': 'Full address'},
  'fieldFax': {'fr': 'Fax', 'en': 'Fax'},
  'fieldTaxNumber': {
    'fr': 'N° Contribuable (NIU)',
    'en': 'Taxpayer No. (NIU)',
  },
  'fieldCapital': {
    'fr': 'Capital social (XAF)',
    'en': 'Share capital (XAF)',
  },
  'fieldCnps': {
    'fr': 'N° Affiliation CNPS',
    'en': 'CNPS Affiliation No.',
  },
  'fieldMen': {'fr': 'Hommes', 'en': 'Men'},
  'fieldWomen': {'fr': 'Femmes', 'en': 'Women'},
  'fieldTotal': {'fr': 'Total', 'en': 'Total'},
  'hintChooseRegionFirst': {
    'fr': "Choisissez d'abord une région",
    'en': 'Choose a region first',
  },
  'hintChooseDeptFirst': {
    'fr': "Choisissez d'abord un département",
    'en': 'Choose a department first',
  },
  'hintLoading': {'fr': 'Chargement...', 'en': 'Loading...'},
  'hintSelect': {'fr': 'Sélectionner', 'en': 'Select'},
  'helperCurrentWorkforce': {
    'fr': 'Saisissez Hommes et Femmes — le Total se calcule automatiquement.',
    'en': 'Enter Men and Women — the Total is calculated automatically.',
  },
  'helperOptionalTotal': {
    'fr': 'Facultatif — le Total se calcule automatiquement.',
    'en': 'Optional — the Total is calculated automatically.',
  },
  'helperMovementTable': {
    'fr':
        'Remplissez les cellules — les totaux par ligne et colonne se calculent automatiquement.',
    'en':
        'Fill in the cells — row and column totals are calculated automatically.',
  },
  'colMovement': {'fr': 'Mouvement', 'en': 'Movement'},
  'colCat13': {'fr': 'Cat. 1–3', 'en': 'Cat. 1–3'},
  'colCat46': {'fr': 'Cat. 4–6', 'en': 'Cat. 4–6'},
  'colCat79': {'fr': 'Cat. 7–9', 'en': 'Cat. 7–9'},
  'colCat1012': {'fr': 'Cat. 10–12', 'en': 'Cat. 10–12'},
  'colNd': {'fr': 'Non Déclaré', 'en': 'Not declared'},
  'colTotal': {'fr': 'TOTAL', 'en': 'TOTAL'},
  'rowRecruitment': {'fr': 'Recrutement', 'en': 'Recruitment'},
  'rowPromotion': {'fr': 'Avancement', 'en': 'Promotion'},
  'rowDismissal': {'fr': 'Licenciement', 'en': 'Dismissal'},
  'rowRetirement': {'fr': 'Retraite', 'en': 'Retirement'},
  'rowDeath': {'fr': 'Décès', 'en': 'Death'},
  'tooltipAutoCalc': {
    'fr': 'Calculé automatiquement',
    'en': 'Automatically calculated',
  },
  'errRequired': {'fr': 'Champ requis', 'en': 'Required field'},
  'errGenderSum': {'fr': 'Total ≠ H + F', 'en': 'Total ≠ M + F'},
  'errLoadRegions': {
    'fr': 'Erreur chargement régions',
    'en': 'Error loading regions',
  },
  'errLoadDepartments': {
    'fr': 'Erreur chargement départements',
    'en': 'Error loading departments',
  },
  'errLoadSubdivisions': {
    'fr': 'Erreur chargement arrondissements',
    'en': 'Error loading subdivisions',
  },
  'errLoadSectors': {
    'fr': 'Erreur chargement secteurs',
    'en': 'Error loading sectors',
  },
  'errFillRequired': {
    'fr': 'Veuillez remplir tous les champs obligatoires',
    'en': 'Please fill in all required fields',
  },
  'errSelectSector': {
    'fr': 'Veuillez sélectionner un secteur socioprofessionnel',
    'en': 'Please select a socio-professional sector',
  },
  'errSelectRegion': {
    'fr': 'Veuillez sélectionner une région',
    'en': 'Please select a region',
  },
  'errSelectDepartment': {
    'fr': 'Veuillez sélectionner un département',
    'en': 'Please select a department',
  },
  'errSelectSubdivision': {
    'fr': 'Veuillez sélectionner un arrondissement',
    'en': 'Please select a subdivision',
  },
  'errCheckWorkforce': {
    'fr': 'Veuillez vérifier les effectifs',
    'en': 'Please check the workforce figures',
  },
  'errTotalGtZero': {
    'fr': 'Le total des employés doit être supérieur à 0',
    'en': 'Total employees must be greater than 0',
  },
  'warnNoMovements': {
    'fr': 'Aucun mouvement saisi. Vérifiez vos données.',
    'en': 'No movement entered. Please check your data.',
  },
  'qTraining': {
    'fr': "Votre établissement dispose-t-il d'un centre de formation ?",
    'en': 'Does your establishment have a training center?',
  },
  'qRecruitmentNext': {
    'fr':
        "Votre établissement prévoit-il des recrutements l'année prochaine ?",
    'en': 'Does your establishment plan to recruit next year?',
  },
  'qCamerounisation': {
    'fr':
        "Votre établissement dispose-t-il d'un plan de camerounisation ?",
    'en': 'Does your establishment have a Cameroonization plan?',
  },
  'qTempAgencies': {
    'fr':
        "Votre établissement a-t-il recours aux entreprises de travail temporaire ?",
    'en': 'Does your establishment use temporary employment agencies?',
  },
  'qTempAgencyDetails': {
    'fr':
        'Précisez (nom(s) de(s) entreprise(s) de travail temporaire)',
    'en':
        'Please specify (name(s) of the temporary employment agency/agencies)',
  },
  'draftFoundTitle': {'fr': 'Brouillon trouvé', 'en': 'Draft found'},
  'draftFoundBody': {
    'fr':
        "Une déclaration inachevée a été trouvée. Voulez-vous reprendre là où vous vous étiez arrêté(e) ou recommencer ?",
    'en':
        'An unfinished declaration was found. Do you want to resume where you left off, or start over?',
  },
  'btnResumeDraft': {'fr': 'Reprendre', 'en': 'Resume'},
  'btnStartOver': {'fr': 'Recommencer', 'en': 'Start over'},
  'draftResumedMsg': {
    'fr': 'Brouillon restauré',
    'en': 'Draft restored',
  },
  'draftsDrawerTitle': {'fr': 'Brouillon', 'en': 'Draft'},
  'draftConflictTitle': {
    'fr': 'Brouillon plus récent trouvé',
    'en': 'A newer draft was found',
  },
  'draftConflictBody': {
    'fr':
        "Un autre appareil a enregistré une version plus récente de ce brouillon. Laquelle voulez-vous utiliser ?",
    'en':
        'Another device saved a newer version of this draft. Which one do you want to use?',
  },
  'draftConflictKeepThisDevice': {
    'fr': 'Garder cet appareil',
    'en': 'Keep this device',
  },
  'draftConflictUseOther': {
    'fr': "Utiliser l'autre version",
    'en': 'Use the other version',
  },
  'offlinePeriodBanner': {
    'fr':
        "Période vérifiée hors ligne — sera revalidée lors de l'envoi.",
    'en': 'Period checked offline — will be re-verified on submit.',
  },
};

class DeclarationWizardScreen extends ConsumerStatefulWidget {
  /// True when the "is the declaration period open" check that gated
  /// entry to this screen (home_screen.dart) had to fall back to a
  /// cached/stale result instead of a live one — surfaced so the user
  /// knows the real check happens at submit, not now.
  final bool periodCheckedOffline;

  const DeclarationWizardScreen({super.key, this.periodCheckedOffline = false});

  @override
  ConsumerState<DeclarationWizardScreen> createState() =>
      _DeclarationWizardScreenState();
}

class _DeclarationWizardScreenState
    extends ConsumerState<DeclarationWizardScreen> {
  int _currentStep = 0;

  bool _isLoadingRegions = true;
  bool _isLoadingDepartments = false;
  bool _isLoadingSubdivisions = false;
  bool _isLoadingSectors = true;

  final _step1FormKey = GlobalKey<FormState>();
  final _step2FormKey = GlobalKey<FormState>();

  int _budgetYear = DateTime.now().year;
  DateTime _fillingDate = DateTime.now();

  final _nameController = TextEditingController();
  final _parentCompanyController = TextEditingController();
  final _secondaryActivityController = TextEditingController();
  final _addressController = TextEditingController();
  final _faxController = TextEditingController();
  final _taxNumberController = TextEditingController();
  final _cnpsController = TextEditingController();
  final _capitalController = TextEditingController();

  List<dynamic> _regions = [];
  List<dynamic> _departments = [];
  List<dynamic> _subdivisions = [];
  List<dynamic> _sectors = [];

  String? _selectedRegionId;
  String? _selectedRegionName;
  String? _selectedDepartmentId;
  String? _selectedDepartmentName;
  String? _selectedSubdivisionId;
  String? _selectedSubdivisionName;
  String? _selectedSectorId;
  String? _selectedSectorName;

  final _totalEmp = TextEditingController();
  final _menCount = TextEditingController();
  final _womenCount = TextEditingController();
  final _lastYearTotal = TextEditingController();
  final _lastYearMen = TextEditingController();
  final _lastYearWomen = TextEditingController();

  // 5 movement types × 5 categories (1_3, 4_6, 7_9, 10_12, nd = Non Déclaré)
  final Map<String, TextEditingController> _movements = {
    'rec_1_3': TextEditingController(text: '0'),
    'rec_4_6': TextEditingController(text: '0'),
    'rec_7_9': TextEditingController(text: '0'),
    'rec_10_12': TextEditingController(text: '0'),
    'rec_nd': TextEditingController(text: '0'),
    'pro_1_3': TextEditingController(text: '0'),
    'pro_4_6': TextEditingController(text: '0'),
    'pro_7_9': TextEditingController(text: '0'),
    'pro_10_12': TextEditingController(text: '0'),
    'pro_nd': TextEditingController(text: '0'),
    'lic_1_3': TextEditingController(text: '0'),
    'lic_4_6': TextEditingController(text: '0'),
    'lic_7_9': TextEditingController(text: '0'),
    'lic_10_12': TextEditingController(text: '0'),
    'lic_nd': TextEditingController(text: '0'),
    'ret_1_3': TextEditingController(text: '0'),
    'ret_4_6': TextEditingController(text: '0'),
    'ret_7_9': TextEditingController(text: '0'),
    'ret_10_12': TextEditingController(text: '0'),
    'ret_nd': TextEditingController(text: '0'),
    'dec_1_3': TextEditingController(text: '0'),
    'dec_4_6': TextEditingController(text: '0'),
    'dec_7_9': TextEditingController(text: '0'),
    'dec_10_12': TextEditingController(text: '0'),
    'dec_nd': TextEditingController(text: '0'),
  };

  bool _hasTrainingCenter = false;
  bool _recruitmentPlansNext = false;
  bool _camerounisationPlan = false;
  bool _usesTempAgencies = false;
  final _tempAgencyDetailsCtrl = TextEditingController();

  Map<String, dynamic>? _companyData;
  Map<String, dynamic>? _savedCompany; // profile fetched from /dsmo/company

  Timer? _autosaveTimer;
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  static const _movSuffixes = ['1_3', '4_6', '7_9', '10_12', 'nd'];

  /// Translates [key] using the currently selected form language.
  /// Safe to call from build methods and event handlers alike.
  String _t(String key) =>
      _kDsmoWizardStrings[key]?[ref.read(languageProvider)] ?? key;

  @override
  void initState() {
    super.initState();
    _fetchSectors();
    _fetchRegionsAndAutoFill();
    _menCount.addListener(_autoCalcCurrentTotal);
    _womenCount.addListener(_autoCalcCurrentTotal);
    _lastYearMen.addListener(_autoCalcLastYearTotal);
    _lastYearWomen.addListener(_autoCalcLastYearTotal);
    for (final c in _movements.values) {
      c.addListener(_onMovementChanged);
    }
    for (final c in [
      _nameController,
      _parentCompanyController,
      _secondaryActivityController,
      _addressController,
      _faxController,
      _taxNumberController,
      _cnpsController,
      _capitalController,
      _totalEmp,
      _menCount,
      _womenCount,
      _lastYearTotal,
      _lastYearMen,
      _lastYearWomen,
      _tempAgencyDetailsCtrl,
      ..._movements.values,
    ]) {
      c.addListener(_scheduleAutosave);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkForDraft());
  }

  // ── Draft autosave / resume ────────────────────────────────────────────────

  /// Debounces autosave so rapid keystrokes don't fire a request per
  /// character — mirrors OnefopFormController.schedAS().
  void _scheduleAutosave() {
    _autosaveTimer?.cancel();
    _autosaveTimer = Timer(const Duration(seconds: 2), _saveDraftNow);
  }

  Map<String, dynamic> _buildDraftSnapshot() => {
        'currentStep': _currentStep,
        'budgetYear': _budgetYear,
        'fillingDate': _fillingDate.toIso8601String(),
        'name': _nameController.text,
        'parentCompany': _parentCompanyController.text,
        'secondaryActivity': _secondaryActivityController.text,
        'address': _addressController.text,
        'fax': _faxController.text,
        'taxNumber': _taxNumberController.text,
        'cnpsNumber': _cnpsController.text,
        'socialCapital': _capitalController.text,
        'sectorId': _selectedSectorId,
        'mainActivity': _selectedSectorName,
        'regionId': _selectedRegionId,
        'region': _selectedRegionName,
        'departmentId': _selectedDepartmentId,
        'department': _selectedDepartmentName,
        'subdivisionId': _selectedSubdivisionId,
        'subdivision': _selectedSubdivisionName,
        'totalEmployees': _totalEmp.text,
        'menCount': _menCount.text,
        'womenCount': _womenCount.text,
        'lastYearTotal': _lastYearTotal.text,
        'lastYearMenCount': _lastYearMen.text,
        'lastYearWomenCount': _lastYearWomen.text,
        'movements': {for (final e in _movements.entries) e.key: e.value.text},
        'hasTrainingCenter': _hasTrainingCenter,
        'recruitmentPlansNext': _recruitmentPlansNext,
        'camerounisationPlan': _camerounisationPlan,
        'usesTempAgencies': _usesTempAgencies,
        'tempAgencyDetails': _tempAgencyDetailsCtrl.text,
      };

  /// Resolves the current company's id, which local drafts are keyed on.
  /// `_savedCompany` is usually already populated by the time this runs
  /// (fetched in `_fetchRegionsAndAutoFill`), but that call races with
  /// `_checkForDraft` at startup, so this re-fetches on a miss — cheap,
  /// since `ApiClient.getMyCompany` has its own offline cache fallback.
  Future<String?> _resolveCompanyId() async {
    final cached = _savedCompany?['id'] as String?;
    if (cached != null) return cached;
    try {
      final api = ref.read(apiClientProvider);
      final company = await api.getMyCompany();
      if (mounted && company != null) setState(() => _savedCompany = company);
      return company?['id'] as String?;
    } catch (_) {
      return null;
    }
  }

  /// Local storage is the primary draft copy (instant, works offline); the
  /// server copy (ApiClient.saveDsmoDraft) is a best-effort sync target for
  /// cross-device resume.
  Future<void> _saveDraftNow() async {
    final snapshot = _buildDraftSnapshot();
    final companyId = await _resolveCompanyId();
    if (companyId != null) {
      await DraftService.saveDraft(companyId: companyId, data: snapshot);
    }
    try {
      final api = ref.read(apiClientProvider);
      await api.saveDsmoDraft(year: _budgetYear, draftData: snapshot);
    } catch (_) {
      // Offline — local copy already saved above; the isOnlineProvider
      // listener in build() pushes it once connectivity returns.
    }
  }

  /// Feeds the drafts drawer — DSMO only ever has one slot per company,
  /// so this is a 0-1 element list, sourced locally first.
  Future<List<DraftSummary>> _fetchDraftSummaries() async {
    final companyId = await _resolveCompanyId();
    if (companyId != null) {
      final local = await DraftService.loadDraft(companyId: companyId);
      if (local != null) {
        final year = local['budgetYear'] as int?;
        final updatedAt =
            await DraftService.getSavedAt(companyId: companyId) ??
                DateTime.now();
        return [
          DraftSummary(
            key: 'current',
            label: year?.toString() ?? _t('appBarTitle'),
            updatedAt: updatedAt,
          ),
        ];
      }
    }

    try {
      final api = ref.read(apiClientProvider);
      final draft = await api.getDsmoDraft();
      if (draft == null) return const [];
      final year = draft['year'] as int?;
      final updatedAt =
          DateTime.tryParse(draft['updatedAt'] as String? ?? '') ??
              DateTime.now();
      return [
        DraftSummary(
          key: 'current',
          label: year?.toString() ?? _t('appBarTitle'),
          updatedAt: updatedAt,
        ),
      ];
    } catch (_) {
      return const [];
    }
  }

  Future<void> _discardDraft() async {
    final companyId = await _resolveCompanyId();
    if (companyId != null) {
      await DraftService.clearDraft(companyId: companyId);
    }
    try {
      final api = ref.read(apiClientProvider);
      await api.deleteDsmoDraft();
    } on ApiException catch (e) {
      // No connectivity — queue the delete so a stale draft doesn't linger
      // server-side forever; the local copy is already gone either way.
      if (e.statusCode == null) {
        await ref.read(syncQueueServiceProvider).enqueue(
              method: 'delete',
              path: '/dsmo/declaration/draft',
              payload: const {},
              label: 'Suppression brouillon DSMO',
            );
      }
    } catch (_) {
      // Best-effort — the local copy is already gone.
    }
  }

  Future<void> _checkForDraft() async {
    try {
      final companyId = await _resolveCompanyId();
      Map<String, dynamic>? draftData;
      DateTime? localSavedAt;
      if (companyId != null) {
        draftData = await DraftService.loadDraft(companyId: companyId);
        if (draftData != null) {
          localSavedAt = await DraftService.getSavedAt(companyId: companyId);
        }
      }

      Map<String, dynamic>? serverDraft;
      try {
        final api = ref.read(apiClientProvider);
        serverDraft = await api.getDsmoDraft();
      } catch (_) {
        // Offline — proceed with whatever's local.
      }

      if (serverDraft != null) {
        final serverDraftData =
            serverDraft['draftData'] as Map<String, dynamic>?;
        if (draftData == null) {
          draftData = serverDraftData;
        } else {
          // A >10s buffer so this device's own just-synced push (the
          // reconnect listener, or a background best-effort save) never
          // reads back as a "conflict" against itself.
          final serverUpdatedAt =
              DateTime.tryParse(serverDraft['updatedAt'] as String? ?? '');
          if (serverUpdatedAt != null &&
              localSavedAt != null &&
              serverUpdatedAt
                  .isAfter(localSavedAt.add(const Duration(seconds: 10)))) {
            if (!mounted) return;
            final useServer = await _showConflictDialog();
            if (useServer == true) draftData = serverDraftData;
          }
        }
      }

      if (draftData == null || draftData.isEmpty || !mounted) return;

      final resume = await _showDraftDialog();
      if (!mounted) return;
      if (resume == true) {
        await _restoreFromDraft(draftData);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(_t('draftResumedMsg')),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else if (resume == false) {
        await _discardDraft();
      }
    } catch (_) {
      // Best-effort — a failed draft lookup shouldn't block starting the form.
    }
  }

  Future<bool?> _showDraftDialog() {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(_t('draftFoundTitle')),
        content: Text(_t('draftFoundBody')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(_t('btnStartOver')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
                backgroundColor: kAccent, foregroundColor: Colors.white),
            child: Text(_t('btnResumeDraft')),
          ),
        ],
      ),
    );
  }

  /// Shown when the server has a newer draft than this device's local
  /// copy — i.e. another device saved one more recently. Returns true to
  /// use the server's version, false to keep this device's.
  Future<bool?> _showConflictDialog() {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(_t('draftConflictTitle')),
        content: Text(_t('draftConflictBody')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(_t('draftConflictKeepThisDevice')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
                backgroundColor: kAccent, foregroundColor: Colors.white),
            child: Text(_t('draftConflictUseOther')),
          ),
        ],
      ),
    );
  }

  Future<void> _restoreFromDraft(Map<String, dynamic> d) async {
    setState(() {
      _currentStep = ((d['currentStep'] as int?) ?? 0).clamp(0, 2);
      _budgetYear = d['budgetYear'] as int? ?? _budgetYear;
      final fd = d['fillingDate'] as String?;
      if (fd != null) _fillingDate = DateTime.tryParse(fd) ?? _fillingDate;
      _nameController.text = d['name'] as String? ?? '';
      _parentCompanyController.text = d['parentCompany'] as String? ?? '';
      _secondaryActivityController.text =
          d['secondaryActivity'] as String? ?? '';
      _addressController.text = d['address'] as String? ?? '';
      _faxController.text = d['fax'] as String? ?? '';
      _taxNumberController.text = d['taxNumber'] as String? ?? '';
      _cnpsController.text = d['cnpsNumber'] as String? ?? '';
      _capitalController.text = d['socialCapital']?.toString() ?? '';
      _totalEmp.text = d['totalEmployees']?.toString() ?? '';
      _menCount.text = d['menCount']?.toString() ?? '';
      _womenCount.text = d['womenCount']?.toString() ?? '';
      _lastYearTotal.text = d['lastYearTotal']?.toString() ?? '';
      _lastYearMen.text = d['lastYearMenCount']?.toString() ?? '';
      _lastYearWomen.text = d['lastYearWomenCount']?.toString() ?? '';
      final movs = d['movements'] as Map<String, dynamic>? ?? {};
      for (final key in _movements.keys) {
        _movements[key]!.text = movs[key]?.toString() ?? '0';
      }
      _hasTrainingCenter = d['hasTrainingCenter'] as bool? ?? false;
      _recruitmentPlansNext = d['recruitmentPlansNext'] as bool? ?? false;
      _camerounisationPlan = d['camerounisationPlan'] as bool? ?? false;
      _usesTempAgencies = d['usesTempAgencies'] as bool? ?? false;
      _tempAgencyDetailsCtrl.text = d['tempAgencyDetails'] as String? ?? '';
    });

    final sectorName = d['mainActivity'] as String?;
    if (sectorName != null) _autoSelectSector(sectorName);

    final regionId = d['regionId'] as String?;
    if (regionId != null && mounted) {
      setState(() {
        _selectedRegionId = regionId;
        _selectedRegionName = d['region'] as String?;
      });
      await _fetchDepartments(regionId);

      final deptId = d['departmentId'] as String?;
      if (deptId != null && mounted) {
        setState(() {
          _selectedDepartmentId = deptId;
          _selectedDepartmentName = d['department'] as String?;
        });
        await _fetchSubdivisions(deptId);

        final subId = d['subdivisionId'] as String?;
        if (subId != null && mounted) {
          setState(() {
            _selectedSubdivisionId = subId;
            _selectedSubdivisionName = d['subdivision'] as String?;
          });
        }
      }
    }
  }

  // ── Auto-calculation helpers ───────────────────────────────────────────────

  void _autoCalcCurrentTotal() {
    final men = int.tryParse(_menCount.text) ?? 0;
    final women = int.tryParse(_womenCount.text) ?? 0;
    final newTotal = (men + women).toString();
    if (_totalEmp.text != newTotal) {
      _totalEmp.text = newTotal;
      _totalEmp.selection =
          TextSelection.collapsed(offset: _totalEmp.text.length);
    }
  }

  void _autoCalcLastYearTotal() {
    if (_lastYearMen.text.isEmpty && _lastYearWomen.text.isEmpty) return;
    final men = int.tryParse(_lastYearMen.text) ?? 0;
    final women = int.tryParse(_lastYearWomen.text) ?? 0;
    final newTotal = (men + women).toString();
    if (_lastYearTotal.text != newTotal) {
      _lastYearTotal.text = newTotal;
    }
  }

  void _onMovementChanged() {
    if (mounted) setState(() {});
  }

  // ── Movement total helpers ─────────────────────────────────────────────────

  int _movRowTotal(String prefix) => ['1_3', '4_6', '7_9', '10_12', 'nd'].fold(
      0, (s, k) => s + (int.tryParse(_movements['${prefix}_$k']!.text) ?? 0));

  int _movColTotal(String suffix) => ['rec', 'pro', 'lic', 'ret', 'dec'].fold(
      0, (s, p) => s + (int.tryParse(_movements['${p}_$suffix']!.text) ?? 0));

  int _movGrandTotal() =>
      _movements.values.fold(0, (s, c) => s + (int.tryParse(c.text) ?? 0));

  /// Fetches regions and the company profile independently, then cascades
  /// auto-fill: region → department → subdivision.
  Future<void> _fetchRegionsAndAutoFill() async {
    setState(() => _isLoadingRegions = true);
    try {
      final api = ref.read(apiClientProvider);
      // Fetched independently — regions are long-lived reference data and
      // near-always cached, so a company-profile fetch that fails (e.g. no
      // connectivity and no cached profile yet) must not also block the
      // region dropdown from populating.
      final regions = await api.getRegions();
      Map<String, dynamic>? company;
      try {
        company = await api.getMyCompany();
      } catch (_) {
        company = null;
      }

      if (!mounted) return;

      setState(() {
        _regions = regions;
        _isLoadingRegions = false;
        _savedCompany = company;
      });

      if (company != null) {
        _prefillTextFields(company);
        _autoSelectSector(company['mainActivity'] as String?);
        await _autoSelectRegion(company['region'] as String?, regions);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingRegions = false);
        _showError('${_t('errLoadRegions')}: $e');
      }
    }
  }

  /// Tries to auto-select the sector. Called after both sectors and company are loaded.
  void _autoSelectSector(String? activityName) {
    if (activityName == null || activityName.isEmpty || _sectors.isEmpty) {
      return;
    }
    final match = _sectors
        .cast<Map<String, dynamic>>()
        .where(
          (s) =>
              (s['name'] as String?)?.toLowerCase() ==
              activityName.toLowerCase(),
        )
        .firstOrNull;
    if (match != null && mounted) {
      setState(() {
        _selectedSectorId = match['id'] as String?;
        _selectedSectorName = match['name'] as String?;
      });
    }
  }

  /// Pre-fills all text controllers from the saved company profile.
  void _prefillTextFields(Map<String, dynamic> c) {
    _nameController.text = c['name'] as String? ?? '';
    _parentCompanyController.text = c['parentCompany'] as String? ?? '';
    _addressController.text = c['address'] as String? ?? '';
    _faxController.text = c['fax'] as String? ?? '';
    _taxNumberController.text = c['taxNumber'] as String? ?? '';
    _cnpsController.text = c['cnpsNumber'] as String? ?? '';
    if (c['socialCapital'] != null) {
      _capitalController.text = '${c['socialCapital']}';
    }
    // Workforce from last registration — editable before submit
    if (c['totalEmployees'] != null) {
      _totalEmp.text = '${c['totalEmployees']}';
    }
    if (c['menCount'] != null) _menCount.text = '${c['menCount']}';
    if (c['womenCount'] != null) _womenCount.text = '${c['womenCount']}';
    if (c['lastYearTotal'] != null) {
      _lastYearTotal.text = '${c['lastYearTotal']}';
    }
  }

  /// Finds the region by name in the loaded list and triggers the cascade.
  Future<void> _autoSelectRegion(
      String? regionName, List<dynamic> regions) async {
    if (regionName == null || regionName.isEmpty) return;
    final match = regions
        .cast<Map<String, dynamic>>()
        .where(
          (r) =>
              (r['name'] as String?)?.toLowerCase() == regionName.toLowerCase(),
        )
        .firstOrNull;
    if (match == null) return;

    setState(() {
      _selectedRegionId = match['id'] as String?;
      _selectedRegionName = match['name'] as String?;
    });

    if (_selectedRegionId != null) {
      await _fetchDepartmentsAndAutoSelect(
        _selectedRegionId!,
        _savedCompany?['department'] as String?,
      );
    }
  }

  /// Loads departments for the region, auto-selects by name, then loads subdivisions.
  Future<void> _fetchDepartmentsAndAutoSelect(
      String regionId, String? deptName) async {
    setState(() {
      _isLoadingDepartments = true;
      _departments = [];
      _selectedDepartmentId = null;
      _selectedDepartmentName = null;
      _subdivisions = [];
      _selectedSubdivisionId = null;
      _selectedSubdivisionName = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final departments = await api.getDepartments(regionId);
      if (!mounted) return;
      setState(() {
        _departments = departments;
        _isLoadingDepartments = false;
      });

      if (deptName != null && deptName.isNotEmpty) {
        final match = departments
            .cast<Map<String, dynamic>>()
            .where(
              (d) =>
                  (d['name'] as String?)?.toLowerCase() ==
                  deptName.toLowerCase(),
            )
            .firstOrNull;
        if (match != null) {
          setState(() {
            _selectedDepartmentId = match['id'] as String?;
            _selectedDepartmentName = match['name'] as String?;
          });
          if (_selectedDepartmentId != null) {
            await _fetchSubdivisionsAndAutoSelect(
              _selectedDepartmentId!,
              _savedCompany?['subdivision'] as String?,
            );
          }
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingDepartments = false);
        _showError('${_t('errLoadDepartments')}: $e');
      }
    }
  }

  /// Loads subdivisions for the department and auto-selects by name.
  Future<void> _fetchSubdivisionsAndAutoSelect(
      String departmentId, String? subdivisionName) async {
    setState(() {
      _isLoadingSubdivisions = true;
      _subdivisions = [];
      _selectedSubdivisionId = null;
      _selectedSubdivisionName = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final subdivisions = await api.getSubdivisions(departmentId);
      if (!mounted) return;
      setState(() {
        _subdivisions = subdivisions;
        _isLoadingSubdivisions = false;
      });

      if (subdivisionName != null && subdivisionName.isNotEmpty) {
        final match = subdivisions
            .cast<Map<String, dynamic>>()
            .where(
              (s) =>
                  (s['name'] as String?)?.toLowerCase() ==
                  subdivisionName.toLowerCase(),
            )
            .firstOrNull;
        if (match != null) {
          setState(() {
            _selectedSubdivisionId = match['id'] as String?;
            _selectedSubdivisionName = match['name'] as String?;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingSubdivisions = false);
        _showError('${_t('errLoadSubdivisions')}: $e');
      }
    }
  }

  Future<void> _fetchDepartments(String regionId) async {
    setState(() {
      _isLoadingDepartments = true;
      _departments = [];
      _selectedDepartmentId = null;
      _selectedDepartmentName = null;
      _subdivisions = [];
      _selectedSubdivisionId = null;
      _selectedSubdivisionName = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final departments = await api.getDepartments(regionId);
      if (mounted) {
        setState(() {
          _departments = departments;
          _isLoadingDepartments = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingDepartments = false);
        _showError('${_t('errLoadDepartments')}: $e');
      }
    }
  }

  Future<void> _fetchSubdivisions(String departmentId) async {
    setState(() {
      _isLoadingSubdivisions = true;
      _subdivisions = [];
      _selectedSubdivisionId = null;
      _selectedSubdivisionName = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final subdivisions = await api.getSubdivisions(departmentId);
      if (mounted) {
        setState(() {
          _subdivisions = subdivisions;
          _isLoadingSubdivisions = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingSubdivisions = false);
        _showError('${_t('errLoadSubdivisions')}: $e');
      }
    }
  }

  Future<void> _fetchSectors() async {
    setState(() => _isLoadingSectors = true);
    try {
      final api = ref.read(apiClientProvider);
      final sectors = await api.getSectors();
      if (!mounted) return;
      setState(() {
        _sectors = sectors;
        _isLoadingSectors = false;
      });
      // Auto-select if company profile is already loaded (parallel race won)
      if (_savedCompany != null) {
        _autoSelectSector(_savedCompany!['mainActivity'] as String?);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingSectors = false);
        _showError('${_t('errLoadSectors')}: $e');
      }
    }
  }

  void _showError(String msg) => ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.red),
      );

  void _showWarning(String msg) => ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.orange),
      );

  String? _validateGenderSum(String? value) {
    final total = int.tryParse(_totalEmp.text) ?? 0;
    final men = int.tryParse(_menCount.text) ?? 0;
    final women = int.tryParse(_womenCount.text) ?? 0;
    if (total > 0 && total != (men + women)) return _t('errGenderSum');
    return null;
  }

  bool _validateMovements() =>
      _movements.values.any((c) => (int.tryParse(c.text) ?? 0) > 0);

  void _saveStep1() {
    if (!_step1FormKey.currentState!.validate()) {
      _showError(_t('errFillRequired'));
      return;
    }
    if (_selectedSectorId == null) {
      _showError(_t('errSelectSector'));
      return;
    }
    if (_selectedRegionId == null) {
      _showError(_t('errSelectRegion'));
      return;
    }
    if (_selectedDepartmentId == null) {
      _showError(_t('errSelectDepartment'));
      return;
    }
    if (_selectedSubdivisionId == null) {
      _showError(_t('errSelectSubdivision'));
      return;
    }

    setState(() {
      _companyData = {
        'name': _nameController.text.trim(),
        'parentCompany': _parentCompanyController.text.trim().isNotEmpty
            ? _parentCompanyController.text.trim()
            : null,
        'mainActivity': _selectedSectorName,
        'secondaryActivity': _secondaryActivityController.text.trim().isNotEmpty
            ? _secondaryActivityController.text.trim()
            : null,
        'region': _selectedRegionName,
        'department': _selectedDepartmentName,
        'subdivision': _selectedSubdivisionName,
        'address': _addressController.text.trim(),
        'fax': _faxController.text.trim().isNotEmpty
            ? _faxController.text.trim()
            : null,
        'taxNumber': _taxNumberController.text.trim(),
        'cnpsNumber': _cnpsController.text.trim().isNotEmpty
            ? _cnpsController.text.trim()
            : null,
        'socialCapital': _capitalController.text.trim().isNotEmpty
            ? int.tryParse(_capitalController.text.trim())
            : null,
      };
      _currentStep = 1;
    });
    _saveDraftNow();
  }

  void _saveStep2() {
    if (!_step2FormKey.currentState!.validate()) {
      _showError(_t('errCheckWorkforce'));
      return;
    }
    // Total is auto-calculated; guard against empty (e.g. men+women both blank)
    if ((int.tryParse(_totalEmp.text) ?? 0) <= 0) {
      _showError(_t('errTotalGtZero'));
      return;
    }
    if (!_validateMovements()) {
      _showWarning(_t('warnNoMovements'));
    }
    setState(() => _currentStep = 2);
    _saveDraftNow();
  }

  void _saveStep3AndGoToEmployees() {
    final language = ref.read(languageProvider);

    final companyData = {
      ...?_companyData,
      'totalEmployees': int.parse(_totalEmp.text),
      'menCount': _menCount.text.isNotEmpty ? int.parse(_menCount.text) : null,
      'womenCount':
          _womenCount.text.isNotEmpty ? int.parse(_womenCount.text) : null,
      'lastYearTotal': _lastYearTotal.text.isNotEmpty
          ? int.parse(_lastYearTotal.text)
          : null,
      'lastYearMenCount':
          _lastYearMen.text.isNotEmpty ? int.parse(_lastYearMen.text) : null,
      'lastYearWomenCount': _lastYearWomen.text.isNotEmpty
          ? int.parse(_lastYearWomen.text)
          : null,
    };

    // Build movement payloads including catNonDeclared
    final movements = [
      _buildMovementPayload('RECRUITMENT', 'rec'),
      _buildMovementPayload('PROMOTION', 'pro'),
      _buildMovementPayload('DISMISSAL', 'lic'),
      _buildMovementPayload('RETIREMENT', 'ret'),
      _buildMovementPayload('DEATH', 'dec'),
    ];

    final qualitative = {
      'hasTrainingCenter': _hasTrainingCenter,
      'recruitmentPlansNext': _recruitmentPlansNext,
      'camerounisationPlan': _camerounisationPlan,
      'usesTempAgencies': _usesTempAgencies,
      'tempAgencyDetails':
          _usesTempAgencies ? _tempAgencyDetailsCtrl.text.trim() : null,
    };

    _saveDraftNow();

    if (mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => EmployeeListScreen(
            companyData: companyData,
            year: _budgetYear,
            fillingDate: _fillingDate.toIso8601String(),
            movements: movements,
            qualitative: qualitative,
            language: language,
            totalEmployees: int.tryParse(_totalEmp.text) ?? 0,
          ),
        ),
      );
    }
  }

  // Builds movement payload including catNonDeclared
  Map<String, dynamic> _buildMovementPayload(String type, String prefix) => {
        'movementType': type,
        'cat1_3': int.tryParse(_movements['${prefix}_1_3']!.text) ?? 0,
        'cat4_6': int.tryParse(_movements['${prefix}_4_6']!.text) ?? 0,
        'cat7_9': int.tryParse(_movements['${prefix}_7_9']!.text) ?? 0,
        'cat10_12': int.tryParse(_movements['${prefix}_10_12']!.text) ?? 0,
        'catNonDeclared': int.tryParse(_movements['${prefix}_nd']!.text) ?? 0,
      };

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(languageProvider);

    // Local draft writes always succeed; this pushes the current one to
    // the server as soon as connectivity returns, for cross-device resume.
    ref.listen<bool>(isOnlineProvider, (previous, next) {
      if (previous == false && next == true) _saveDraftNow();
    });

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: kCanvas,
      endDrawer: DraftsDrawer(
        title: _t('draftsDrawerTitle'),
        fetchDrafts: _fetchDraftSummaries,
        onSaveNow: _saveDraftNow,
        onDelete: (_) => _discardDraft(),
      ),
      appBar: AppBar(
        title: Text(_t('appBarTitle')),
        backgroundColor: kAccent,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.drafts_outlined),
            tooltip: _t('draftsDrawerTitle'),
            onPressed: () => _scaffoldKey.currentState?.openEndDrawer(),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: ToggleButtons(
              borderRadius: BorderRadius.circular(8),
              isSelected: [language == 'fr', language == 'en'],
              onPressed: (i) => ref.read(languageProvider.notifier).state =
                  i == 0 ? 'fr' : 'en',
              color: Colors.white70,
              selectedColor: Colors.white,
              fillColor: kAccentDeep,
              borderColor: Colors.white30,
              selectedBorderColor: Colors.white,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 32),
              children: const [Text('FR'), Text('EN')],
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          if (widget.periodCheckedOffline) _offlinePeriodBanner(),
          Expanded(
            child: Theme(
              data: Theme.of(context).copyWith(
                colorScheme:
                    Theme.of(context).colorScheme.copyWith(primary: kAccent),
              ),
              child: Center(
                child: ConstrainedBox(
            // Matches the 480px form-width convention used by the ONEFOP
            // registration wizard (register_screen.dart) and MinefopPortalScreen.
            constraints: const BoxConstraints(maxWidth: 480),
            child: Stepper(
          currentStep: _currentStep,
          onStepContinue: _currentStep == 0
              ? _saveStep1
              : _currentStep == 1
                  ? _saveStep2
                  : _saveStep3AndGoToEmployees,
          onStepCancel: _currentStep == 0
              ? null
              : () => setState(() => _currentStep -= 1),
          controlsBuilder: (context, details) {
            final isLast = _currentStep == 2;
            return Padding(
              padding: const EdgeInsets.only(top: 24),
              child: Row(
                children: [
                  Expanded(
                    child: DsmoPrimaryButton(
                      label: isLast ? _t('btnSubmit') : _t('btnContinue'),
                      onPressed: details.onStepContinue,
                      icon: isLast
                          ? Icons.send_outlined
                          : Icons.arrow_forward_outlined,
                    ),
                  ),
                  if (details.onStepCancel != null) ...[
                    const SizedBox(width: 12),
                    TextButton(
                      onPressed: details.onStepCancel,
                      style: TextButton.styleFrom(foregroundColor: kInkSoft),
                      child: Text(_t('btnBack')),
                    ),
                  ],
                ],
              ),
            );
          },
          steps: [
            Step(
              title: Text(_t('step1Title')),
              content: Form(
                key: _step1FormKey,
                child: SingleChildScrollView(child: _buildIdentityStep()),
              ),
              isActive: true,
              state: _currentStep > 0 ? StepState.complete : StepState.indexed,
            ),
            Step(
              title: Text(_t('step2Title')),
              content: Form(
                key: _step2FormKey,
                child: _buildWorkforceStep(),
              ),
              isActive: _currentStep >= 1,
              state: _currentStep > 1 ? StepState.complete : StepState.indexed,
            ),
            Step(
              title: Text(_t('step3Title')),
              content: _buildQualitativeStep(),
              isActive: _currentStep >= 2,
              state: StepState.indexed,
            ),
          ],
        ),
              ),
            ),
              ),
          ),
        ],
      ),
    );
  }

  /// Shown when the entry-point period check (home_screen.dart) had to
  /// fall back to a cached result instead of a live one.
  Widget _offlinePeriodBanner() => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        color: kAccentDeep.withValues(alpha: 0.08),
        child: Row(
          children: [
            const Icon(Icons.wifi_off, color: kAccentDeep, size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                _t('offlinePeriodBanner'),
                style: const TextStyle(fontSize: 12.5, color: kAccentDeep),
              ),
            ),
          ],
        ),
      );

  Widget _buildIdentityStep() {
    final currentYear = DateTime.now().year;
    final years = List.generate(6, (i) => currentYear - 4 + i);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Row 1: Année budgétaire | Date de remplissage
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildDropdown<int>(
                label: _t('fieldBudgetYear'),
                value: _budgetYear,
                items: years,
                onChanged: (v) {
                  setState(() => _budgetYear = v ?? currentYear);
                  _scheduleAutosave();
                },
                displayName: (v) => v.toString(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: DsmoField(
                label: _t('fieldFillingDate'),
                input: InkWell(
                  borderRadius: BorderRadius.circular(kRadiusSm),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _fillingDate,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2030),
                    );
                    if (picked != null) {
                      setState(() => _fillingDate = picked);
                      _scheduleAutosave();
                    }
                  },
                  child: InputDecorator(
                    decoration: dsmoInputDecoration().copyWith(
                      suffixIcon:
                          const Icon(Icons.calendar_today, color: kInkFaint),
                    ),
                    child: Text(
                      '${_fillingDate.day.toString().padLeft(2, '0')}/'
                      '${_fillingDate.month.toString().padLeft(2, '0')}/'
                      '${_fillingDate.year}',
                      style: const TextStyle(fontSize: 14, color: kInk),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),

        // ── Section: Identification ──────────────────────────────────────────
        _sectionHeader(_t('sectionIdentification')),

        _buildTextField(
          _nameController,
          _t('fieldCompanyName'),
          isRequired: true,
          validator: (v) =>
              v == null || v.trim().isEmpty ? _t('errRequired') : null,
        ),
        _buildTextField(
          _parentCompanyController,
          _t('fieldParentCompany'),
        ),

        _buildCascadingDropdown(
          label: _t('fieldMainActivity'),
          items: _sectors,
          isLoading: _isLoadingSectors,
          selectedId: _selectedSectorId,
          displayName: (item) =>
              item['name'] ?? item['label'] ?? item.toString(),
          onChanged: (id, name) {
            setState(() {
              _selectedSectorId = id;
              _selectedSectorName = name;
            });
            _scheduleAutosave();
          },
        ),
        _buildTextField(
          _secondaryActivityController,
          _t('fieldSecondaryActivity'),
        ),

        // ── Section: Localisation ────────────────────────────────────────────
        _sectionHeader(_t('sectionLocalisation')),

        _buildCascadingDropdown(
          label: _t('fieldRegion'),
          items: _regions,
          isLoading: _isLoadingRegions,
          selectedId: _selectedRegionId,
          displayName: (item) =>
              item['name'] ?? item['label'] ?? item.toString(),
          onChanged: (id, name) {
            setState(() {
              _selectedRegionId = id;
              _selectedRegionName = name;
              _selectedDepartmentId = null;
              _selectedDepartmentName = null;
              _selectedSubdivisionId = null;
              _selectedSubdivisionName = null;
              _departments = [];
              _subdivisions = [];
            });
            if (id != null) _fetchDepartments(id);
            _scheduleAutosave();
          },
        ),
        _buildCascadingDropdown(
          label: _t('fieldDepartment'),
          items: _departments,
          isLoading: _isLoadingDepartments,
          selectedId: _selectedDepartmentId,
          displayName: (item) =>
              item['name'] ?? item['label'] ?? item.toString(),
          enabled: _selectedRegionId != null,
          hint: _selectedRegionId == null
              ? _t('hintChooseRegionFirst')
              : null,
          onChanged: (id, name) {
            setState(() {
              _selectedDepartmentId = id;
              _selectedDepartmentName = name;
              _selectedSubdivisionId = null;
              _selectedSubdivisionName = null;
              _subdivisions = [];
            });
            if (id != null) _fetchSubdivisions(id);
            _scheduleAutosave();
          },
        ),
        _buildCascadingDropdown(
          label: _t('fieldSubdivision'),
          items: _subdivisions,
          isLoading: _isLoadingSubdivisions,
          selectedId: _selectedSubdivisionId,
          displayName: (item) =>
              item['name'] ?? item['label'] ?? item.toString(),
          enabled: _selectedDepartmentId != null,
          hint: _selectedDepartmentId == null
              ? _t('hintChooseDeptFirst')
              : null,
          onChanged: (id, name) {
            setState(() {
              _selectedSubdivisionId = id;
              _selectedSubdivisionName = name;
            });
            _scheduleAutosave();
          },
        ),

        // ── Section: Coordonnées administratives ─────────────────────────────
        _sectionHeader(_t('sectionCoordonnees')),

        _buildTextField(
          _addressController,
          _t('fieldAddress'),
          isRequired: true,
          validator: (v) =>
              v == null || v.trim().isEmpty ? _t('errRequired') : null,
        ),

        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildTextField(_faxController, _t('fieldFax')),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: _buildTextField(
                _taxNumberController,
                _t('fieldTaxNumber'),
                isRequired: true,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? _t('errRequired') : null,
              ),
            ),
          ],
        ),

        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildTextField(_capitalController, _t('fieldCapital'),
                  isNumber: true),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildTextField(_cnpsController, _t('fieldCnps')),
            ),
          ],
        ),
      ],
    );
  }

  Widget _sectionHeader(String title) {
    return OnefopSubsectionHeader(title: title);
  }

  Widget _buildWorkforceStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        OnefopSubsectionHeader(title: _t('sectionWorkforceCurrent')),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(
            _t('helperCurrentWorkforce'),
            style: const TextStyle(fontSize: 11, color: kInkFaint),
          ),
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildTextField(
                _menCount,
                _t('fieldMen'),
                isNumber: true,
                isRequired: true,
                validator: _validateGenderSum,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildTextField(
                _womenCount,
                _t('fieldWomen'),
                isNumber: true,
                isRequired: true,
                validator: _validateGenderSum,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildAutoCalcField(_totalEmp, _t('fieldTotal'),
                  isRequired: true),
            ),
          ],
        ),
        const SizedBox(height: 12),
        OnefopSubsectionHeader(title: _t('sectionWorkforcePrevious')),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(
            _t('helperOptionalTotal'),
            style: const TextStyle(fontSize: 11, color: kInkFaint),
          ),
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _buildTextField(
                _lastYearMen,
                _t('fieldMen'),
                isNumber: true,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildTextField(
                _lastYearWomen,
                _t('fieldWomen'),
                isNumber: true,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildAutoCalcField(_lastYearTotal, _t('fieldTotal')),
            ),
          ],
        ),
        const SizedBox(height: 12),
        OnefopSubsectionHeader(title: _t('sectionMovements')),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(
            _t('helperMovementTable'),
            style: const TextStyle(fontSize: 11, color: kInkFaint),
          ),
        ),
        _buildMovementTable(),
      ],
    );
  }

  /// Read-only styled field for auto-calculated totals.
  Widget _buildAutoCalcField(
    TextEditingController ctrl,
    String label, {
    bool isRequired = false,
  }) {
    return DsmoField(
      label: label,
      required: isRequired,
      padding: const EdgeInsets.only(bottom: 12),
      input: TextFormField(
        controller: ctrl,
        readOnly: true,
        keyboardType: TextInputType.number,
        style: const TextStyle(fontWeight: FontWeight.bold, color: kAccent),
        decoration: dsmoInputDecoration().copyWith(
          fillColor: kAccentSoft,
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(kRadiusSm),
            borderSide: const BorderSide(color: kAccent, width: 1),
          ),
          suffixIcon: Tooltip(
            message: _t('tooltipAutoCalc'),
            child: const Icon(
              Icons.calculate_outlined,
              color: kAccent,
              size: 18,
            ),
          ),
        ),
        validator: isRequired
            ? (v) {
                if (v == null || v.trim().isEmpty || v == '0') {
                  return _t('errRequired');
                }
                return null;
              }
            : null,
      ),
    );
  }

  Widget _buildQualitativeStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        OnefopSubsectionHeader(title: _t('sectionQualitative')),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeThumbColor: kAccent,
          title: Text(
            _t('qTraining'),
            style: const TextStyle(fontSize: 14, color: kInk),
          ),
          value: _hasTrainingCenter,
          onChanged: (v) {
            setState(() => _hasTrainingCenter = v);
            _scheduleAutosave();
          },
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeThumbColor: kAccent,
          title: Text(
            _t('qRecruitmentNext'),
            style: const TextStyle(fontSize: 14, color: kInk),
          ),
          value: _recruitmentPlansNext,
          onChanged: (v) {
            setState(() => _recruitmentPlansNext = v);
            _scheduleAutosave();
          },
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeThumbColor: kAccent,
          title: Text(
            _t('qCamerounisation'),
            style: const TextStyle(fontSize: 14, color: kInk),
          ),
          value: _camerounisationPlan,
          onChanged: (v) {
            setState(() => _camerounisationPlan = v);
            _scheduleAutosave();
          },
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeThumbColor: kAccent,
          title: Text(
            _t('qTempAgencies'),
            style: const TextStyle(fontSize: 14, color: kInk),
          ),
          value: _usesTempAgencies,
          onChanged: (v) {
            setState(() => _usesTempAgencies = v);
            _scheduleAutosave();
          },
        ),
        if (_usesTempAgencies) ...[
          const SizedBox(height: 4),
          _buildTextField(
            _tempAgencyDetailsCtrl,
            _t('qTempAgencyDetails'),
          ),
        ],
      ],
    );
  }

  Widget _buildTextField(
    TextEditingController ctrl,
    String label, {
    bool isNumber = false,
    bool isRequired = false,
    String? Function(String?)? validator,
  }) {
    return DsmoField(
      label: label,
      required: isRequired,
      padding: const EdgeInsets.only(bottom: 12),
      input: TextFormField(
        controller: ctrl,
        keyboardType: isNumber ? TextInputType.number : TextInputType.text,
        inputFormatters:
            isNumber ? [FilteringTextInputFormatter.digitsOnly] : null,
        textInputAction: TextInputAction.next,
        decoration: dsmoInputDecoration(),
        validator: validator ??
            (v) => (isRequired && (v == null || v.trim().isEmpty))
                ? _t('errRequired')
                : null,
      ),
    );
  }

  Widget _buildDropdown<T>({
    required String label,
    required T? value,
    required List<T> items,
    required void Function(T?) onChanged,
    required String Function(T) displayName,
    bool enabled = true,
    bool required = true,
  }) {
    return DsmoField(
      label: label,
      required: required,
      padding: const EdgeInsets.only(bottom: 12),
      input: DropdownButtonFormField<T>(
        initialValue: value,
        decoration: dsmoInputDecoration().copyWith(enabled: enabled),
        isExpanded: true,
        items: enabled
            ? items
                .map((e) =>
                    DropdownMenuItem(value: e, child: Text(displayName(e))))
                .toList()
            : [],
        onChanged: enabled ? onChanged : null,
        validator: (v) => v == null ? _t('errRequired') : null,
      ),
    );
  }

  Widget _buildCascadingDropdown({
    required String label,
    required List<dynamic> items,
    required bool isLoading,
    required String? selectedId,
    required String Function(dynamic) displayName,
    required void Function(String? id, String? name) onChanged,
    bool enabled = true,
    String? hint,
  }) {
    final isEnabled = enabled && !isLoading;
    return DsmoField(
      label: label,
      required: true,
      padding: const EdgeInsets.only(bottom: 12),
      input: DropdownButtonFormField<String>(
        isExpanded: true,
        decoration: dsmoInputDecoration().copyWith(enabled: isEnabled),
        initialValue: selectedId,
        hint: isLoading
            ? Text(
                _t('hintLoading'),
                style: const TextStyle(color: kInkFaint),
              )
            : (hint != null
                ? Text(
                    hint,
                    style: const TextStyle(color: kInkFaint),
                  )
                : Text(
                    _t('hintSelect'),
                    style: const TextStyle(color: kInkFaint),
                  )),
        items: isLoading
            ? null
            : items.map((item) {
                final id = item['id']?.toString() ?? item['code']?.toString();
                return DropdownMenuItem<String>(
                  value: id,
                  child: Text(displayName(item)),
                );
              }).toList(),
        onChanged: isEnabled
            ? (id) {
                final sel = items.firstWhere(
                  (item) =>
                      (item['id']?.toString() ?? item['code']?.toString()) ==
                      id,
                  orElse: () => null,
                );
                onChanged(id, sel != null ? displayName(sel) : null);
              }
            : null,
        validator: (v) =>
            (isEnabled && (v == null || v.isEmpty)) ? _t('errRequired') : null,
      ),
    );
  }

  // Movement table: 5 editable columns + auto-calculated row totals + column totals row
  Widget _buildMovementTable() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(kRadiusSm),
        child: Table(
          border: TableBorder.all(color: kBorder),
          defaultColumnWidth: const IntrinsicColumnWidth(),
          children: [
            TableRow(
              decoration: const BoxDecoration(color: kFieldFill),
              children: [
                _Cell(_t('colMovement'), isHeader: true),
                _Cell(_t('colCat13'), isHeader: true),
                _Cell(_t('colCat46'), isHeader: true),
                _Cell(_t('colCat79'), isHeader: true),
                _Cell(_t('colCat1012'), isHeader: true),
                _Cell(_t('colNd'), isHeader: true),
                _Cell(_t('colTotal'), isHeader: true),
              ],
            ),
            _buildMovementRow(_t('rowRecruitment'), 'rec', isEven: true),
            _buildMovementRow(_t('rowPromotion'), 'pro', isEven: false),
            _buildMovementRow(_t('rowDismissal'), 'lic', isEven: true),
            _buildMovementRow(_t('rowRetirement'), 'ret', isEven: false),
            _buildMovementRow(_t('rowDeath'), 'dec', isEven: true),
            TableRow(
              decoration: const BoxDecoration(color: kAccentSoft),
              children: [
                _Cell(_t('colTotal'), isHeader: true),
                _TotalDisplayCell(_movColTotal('1_3')),
                _TotalDisplayCell(_movColTotal('4_6')),
                _TotalDisplayCell(_movColTotal('7_9')),
                _TotalDisplayCell(_movColTotal('10_12')),
                _TotalDisplayCell(_movColTotal('nd')),
                _TotalDisplayCell(_movGrandTotal(), isGrand: true),
              ],
            ),
          ],
        ),
      ),
    );
  }

  TableRow _buildMovementRow(String label, String prefix,
      {required bool isEven}) {
    return TableRow(
      decoration: BoxDecoration(color: isEven ? kSurface : kCanvas),
      children: [
        _Cell(label),
        ..._movSuffixes.map((suffix) {
          return _EditableCell(_movements['${prefix}_$suffix']!);
        }),
        _TotalDisplayCell(_movRowTotal(prefix)),
      ],
    );
  }

  @override
  void dispose() {
    _autosaveTimer?.cancel();
    _nameController.dispose();
    _parentCompanyController.dispose();
    _secondaryActivityController.dispose();
    _addressController.dispose();
    _faxController.dispose();
    _taxNumberController.dispose();
    _cnpsController.dispose();
    _capitalController.dispose();
    _totalEmp.dispose();
    _menCount.dispose();
    _womenCount.dispose();
    _lastYearTotal.dispose();
    _lastYearMen.dispose();
    _lastYearWomen.dispose();
    _tempAgencyDetailsCtrl.dispose();
    for (final c in _movements.values) {
      c.dispose();
    }
    super.dispose();
  }
}

// ============================================================
// SIMPLIFIED HELPER WIDGETS (No focus management)
// ============================================================

class _Cell extends StatelessWidget {
  final String text;
  final bool isHeader;
  const _Cell(this.text, {this.isHeader = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontWeight: isHeader ? FontWeight.w600 : FontWeight.w500,
          fontSize: 13,
          color: isHeader ? kInk : kInkSoft,
        ),
      ),
    );
  }
}

class _EditableCell extends StatelessWidget {
  final TextEditingController ctrl;

  const _EditableCell(this.ctrl);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(2),
      child: TextField(
        controller: ctrl,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        textAlign: TextAlign.center,
        textInputAction: TextInputAction.next,
        cursorColor: kAccent,
        style: const TextStyle(fontSize: 13, color: kInk),
        decoration: const InputDecoration(
          isDense: true,
          border: InputBorder.none,
        ),
      ),
    );
  }
}

/// Read-only cell showing an auto-calculated total (brand green = grand total).
class _TotalDisplayCell extends StatelessWidget {
  final int value;
  final bool isGrand;
  const _TotalDisplayCell(this.value, {this.isGrand = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
      color: isGrand ? kAccent : kAccentSoft,
      child: Text(
        '$value',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 13,
          color: isGrand ? Colors.white : kAccent,
        ),
      ),
    );
  }
}
