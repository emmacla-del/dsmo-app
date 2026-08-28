// lib/screens/onefop/onefop_form_controller.dart
// ══════════════════════════════════════════════════════════════
// BUSINESS LOGIC & STATE CONTROLLER  (extracted from v8.3)
// ══════════════════════════════════════════════════════════════

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/focus/onefop_form_loader.dart';
import '../../core/i18n/localized_text.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/schema/form_schema_v2.dart';
import '../../core/focus/schema/navigation_engine.dart';
import '../../core/focus/schema/section_schema.dart';
import '../../core/focus/unified_focus_manager_v2.dart';
import '../../core/focus/compiler/section_title_lookup.dart';
import '../../core/focus/utils/field_validator.dart';
import '../../core/focus/utils/table_response_status.dart';
import '../../data/api_client.dart';
import '../../services/sync_queue_service.dart';

import 'onefop_coherence_checker.dart';
import 'onefop_form_constants.dart';
import 'onefop_table_engine.dart';

// ── Result objects for UI-layer consumption ───────────────────
class PreviewResult {
  final bool success;
  final Uint8List? bytes;
  final String? fileName;
  final String? error;
  const PreviewResult({
    required this.success,
    this.bytes,
    this.fileName,
    this.error,
  });
}

class SubmitResult {
  final bool success;
  final String? error;
  final bool wasQueued;
  const SubmitResult(
      {required this.success, this.error, this.wasQueued = false});
}

// ══════════════════════════════════════════════════════════════
class OnefopFormController extends ChangeNotifier {
  // ── Constructor params ────────────────────────────────────
  final EntityType entityType;
  final String? establishmentId;
  final String? companyId; // ← ADD THIS
  final String? quarterCode;
  // The active campaign's data-collection window — same source (the
  // SubmissionRound behind /onefop/active-quarter) that gates whether this
  // screen can even be opened. S21Q01's question text reads these instead
  // of a hard-coded date; see _applyCampaignPeriodLabels().
  final DateTime? campaignPeriodStart;
  final DateTime? campaignPeriodEnd;
  final void Function(Map<String, dynamic>) onSave;
  final VoidCallback? onCancel;
  final String? userId;
  final VoidCallback? onSubmitSuccess;

  OnefopFormController({
    required this.entityType,
    required Map<String, dynamic> initialData,
    this.establishmentId,
    this.companyId, // ← ADD THIS
    this.quarterCode,
    this.campaignPeriodStart,
    this.campaignPeriodEnd,
    required this.onSave,
    this.onCancel,
    this.userId,
    this.onSubmitSuccess,
  }) : _data = sanitiseInitialData(Map.from(initialData));
  // ── NEW: Extract __meta fields from initialData ───────────
  String? get _metaEstablishmentId =>
      establishmentId ?? _data['__meta_establishment_id'] as String?;
  String? get _metaTaxNumber => _data['__meta_tax_number'] as String?;
  String? get _metaCnpsNumber => _data['__meta_cnps_number'] as String?;
  String? get _metaRegistrationNumber =>
      _data['__meta_registration_number'] as String?;
  String? get _metaQuarterCode =>
      quarterCode ?? _data['__meta_quarter_code'] as String?;

  // ── Resume position: which page/section and which internal table tab
  // (age band, Permanent/Temporaire, ...) the user was last on. Stored the
  // same way as the other __meta_ fields above — inside _data, so it rides
  // along for free with the existing autosave/draft round-trip — but never
  // rendered as a form field. Unlike _unitCursor (which intentionally
  // starts empty and re-derives from data presence each session, see its
  // comment below), there's no data-derived way to know which *page* the
  // user was on, so this one has to be explicitly persisted and restored.
  static const String _kNavPositionKey = '__meta_nav_position';

  // ── Schema / Engine ─────────────────────────────────────────
  NavigationEngine? _engine;
  UnifiedFocusManagerV2? _fm;
  FormSchemaV2? _schema;

  FormSchemaV2? get schema => _schema;
  UnifiedFocusManagerV2 get fm => _fm!;
  NavigationEngine? get engine => _engine;

  // ── Data stores ─────────────────────────────────────────────
  final Map<String, dynamic> _data;
  final Map<String, TextEditingController> _ctrl = {};
  final Map<String, int> _uGrid = {};
  Map<String, int> _aGrid = {};
  final Map<String, String> _tv = {};
  final Map<String, String> _htv = {};
  final Map<String, TextEditingController> _hctrl = {};

  Map<String, dynamic> get data => _data;
  Map<String, TextEditingController> get ctrl => _ctrl;
  Map<String, int> get aGrid => _aGrid;
  Map<String, int> get uGrid => _uGrid;
  Map<String, String> get tv => _tv;
  Map<String, String> get htv => _htv;
  Map<String, TextEditingController> get hctrl => _hctrl;

  // ── UI / Validation state ─────────────────────────────────────
  final Set<String> _touched = {};
  bool _dirty = false;
  bool _saving = false;
  final Set<String> _dirtyT = {};
  bool _loading = true;
  String? _err;
  int _si = 0;
  // Set once, in _restorePosition(), when a loaded draft actually had a
  // saved position to resume into — lets the screen show a one-time "you
  // left off here" toast without re-deriving whether this was a fresh
  // start vs. a resume.
  bool _resumedFromSavedPosition = false;
  bool get resumedFromSavedPosition => _resumedFromSavedPosition;
  final Map<String, bool> _valid = {};
  Map<String, dynamic>? _submissionSnapshot;
  int _sidebarMode = 2;
  final Map<String, ValidationError?> _valCache = {};
  List<String> _visibleFieldIds = [];
  final Map<String, VoidCallback> _ctrlListeners = {};

  // ── Section-unit progressive reveal (mobile + desktop) ───────
  // Which section-units (a group of simple fields, or one table-type
  // field) the user has advanced past — drives both platforms'
  // one-table-at-a-time reveal (see onefop_section_units.dart). Session-
  // only, not persisted: a unit that already has data is *also* treated
  // as advanced (see currentUnitIndex()), so a returning draft still
  // shows its real progress even though this set starts empty.
  final Set<String> _advancedUnits = {};
  bool isUnitAdvanced(String key) => _advancedUnits.contains(key);
  void advanceUnit(String key) {
    if (_advancedUnits.add(key)) notifyListeners();
  }

  // Which unit within a section is currently displayed — explicit so
  // Back/Next can move deterministically instead of re-deriving "current"
  // from _advancedUnits (which only ever grows). Keyed by section id;
  // absent means "not yet visited this session", so the unit-rendering
  // widget falls back to currentUnitIndex()'s live computation.
  final Map<String, int> _unitCursor = {};
  int? unitCursor(String sectionId) => _unitCursor[sectionId];
  void setUnitCursor(String sectionId, int index) {
    _unitCursor[sectionId] = index;
    notifyListeners();
  }

  // Which horizontal tab (age band, Permanent/Temporaire, ...) is active
  // within a multi-option table — keyed by the table's cell-id prefix, so
  // it survives navigating to a different section and back within the
  // same session. _tabPeak is the furthest tab index ever reached for
  // that key, independent of where the cursor currently sits (e.g. after
  // stepping back to review an earlier tab) — used to show a completion
  // checkmark on every tab up to the peak except the one currently active.
  final Map<String, int> _tabCursor = {};
  final Map<String, int> _tabPeak = {};
  int tabCursor(String key) => _tabCursor[key] ?? 0;
  int tabPeak(String key) => _tabPeak[key] ?? 0;
  void setTabCursor(String key, int index) {
    _tabCursor[key] = index;
    if (index > (_tabPeak[key] ?? 0)) _tabPeak[key] = index;
    _persistPosition();
    notifyListeners();
  }

  // computeVisibleFieldIds()/focusFieldOffset() walk every field in the
  // current section regardless of what's actually on screen — fine when
  // everything renders at once, but both platforms now hide not-yet-
  // revealed units, so Tab/Enter could otherwise try to focus a field
  // with no mounted widget. The unit-rendering widget restates this on
  // every build (a plain field write, not a notifyListeners() call — safe
  // to do from within build()).
  List<String>? _revealedFieldIds;
  void setRevealedFieldIds(List<String> ids) => _revealedFieldIds = ids;
  void clearRevealScope() => _revealedFieldIds = null;

  // What to do instead of falling through to next()/prev() when Tab/Enter
  // walks off the edge of the currently revealed unit — set by the unit-
  // rendering widget each build so exitTable()/exitTablePrevious() can
  // advance to the next/previous unit *within the section* first, only
  // falling through to the page-level next()/prev() once there's no more
  // unit to advance/retreat into.
  VoidCallback? _onRevealForwardBoundary;
  VoidCallback? _onRevealBackwardBoundary;
  void setRevealBoundaryActions(
      {VoidCallback? forward, VoidCallback? backward}) {
    _onRevealForwardBoundary = forward;
    _onRevealBackwardBoundary = backward;
  }

  // Per-unit scroll anchor, mirroring blockKeys/scrollToField below but
  // keyed by the synthetic SectionUnit.key instead of a schema field id —
  // a "simple fields" unit has no single field id of its own to anchor to.
  final Map<String, GlobalKey> unitKeys = {};
  GlobalKey keyForUnit(String key) =>
      unitKeys.putIfAbsent(key, () => GlobalKey());
  void scrollToUnit(String key) {
    final gk = unitKeys[key];
    if (gk == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = gk.currentContext;
      if (ctx == null) return;
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
        alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtStart,
      );
    });
  }

  Set<String> get touched => _touched;
  bool get dirty => _dirty;
  bool get saving => _saving;
  bool get loading => _loading;
  String? get error => _err;
  int get currentPage => _si;
  Map<String, bool> get valid => _valid;
  int get sidebarMode => _sidebarMode;
  List<String> get visibleFieldIds => _visibleFieldIds;

  // ── Scrolling / Keys ────────────────────────────────────────
  final ScrollController mainScroll = ScrollController();
  final Map<String, GlobalKey> blockKeys = {};

  // ── Performance notifiers ───────────────────────────────────
  final ValueNotifier<int> version = ValueNotifier<int>(0);
  void _bump() => version.value++;

  // ── Coherence hints — recomputed on every change, see
  // onefop_coherence_checker.dart. Non-blocking; purely informational. ──
  List<CoherenceFlag> _coherenceFlags = const [];
  List<CoherenceFlag> get coherenceFlags => _coherenceFlags;

  @override
  void notifyListeners() {
    _coherenceFlags = OnefopCoherenceChecker.check(_data, entityType);
    super.notifyListeners();
  }

  // ── Autosave ────────────────────────────────────────────────
  Timer? _asTimer;
  DateTime? _lastSaveRequest;
  bool _saveInFlight = false;

  // ── Revalidation debounce ───────────────────────────────────
  Timer? _valTimer;

  // ── Grid-total recalculation debounce ───────────────────────
  Timer? _gridRecalcTimer;
  bool _disposed = false;

  // ═══════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  Future<void> initialize() async => _loadSchema();

  @override
  void dispose() {
    _disposed = true;
    _valTimer?.cancel();
    _asTimer?.cancel();
    _gridRecalcTimer?.cancel();
    version.dispose();
    _fm?.dispose();
    for (final e in _ctrl.entries) {
      final listener = _ctrlListeners[e.key];
      if (listener != null) e.value.removeListener(listener);
      e.value.dispose();
    }
    _ctrlListeners.clear();
    for (final c in _hctrl.values) {
      c.dispose();
    }
    mainScroll.dispose();
    super.dispose();
  }

  Future<void> _loadSchema() async {
    try {
      // No `await` here: loadForEntity is now synchronous, and skipping the
      // await keeps this whole method running synchronously through to
      // `notifyListeners()` below, so `initialize()` (called from initState)
      // completes before the widget's first build — the form renders
      // directly, without a loading-skeleton flash first.
      final s = OnefopFormLoader.loadForEntity(entityTypeForSchema(entityType));
      _applyCampaignPeriodLabels(s);
      _schema = s;
      _engine = NavigationEngine(s);
      _fm = UnifiedFocusManagerV2(_engine!);

      _initCtrl();
      _initTV();
      _initGrid();
      _initHybrid();
      _initFN();
      _initKeyH();

      for (final sec in s.sections) {
        _valid[sec.id] = false;
      }
      for (final f in s.fields) {
        blockKeys[f.id] = GlobalKey();
      }

      _restorePosition();

      _loading = false;
      notifyListeners();
      WidgetsBinding.instance.addPostFrameCallback((_) => focusFirst());
    } catch (e, st) {
      debugPrint('schema error: $e\n$st');
      _err = e.toString();
      _loading = false;
      notifyListeners();
    }
  }

  // Every question whose wording refers to the questionnaire's active
  // data-collection period rather than a fixed date — S21Q01
  // ("...du [X] au [Y]?") plus every sibling question sharing the same
  // "...du premier Janvier 2025 à ce jour?" / "...du 1er Janvier 2025 à ce
  // jour?" / "...from the 1st of January 2025 to the present day?"
  // boilerplate (S22Q01-05, S23Q01-02, S3Q01, S3Q03, S4Q01). One resolver,
  // reused by every question below — not a per-question mechanism.
  // campaignPeriodStart/End come from the same SubmissionRound
  // (/onefop/active-quarter) that already gates entry to this screen (see
  // home_screen.dart's _openOnefopFormForCompany/_navigateToBlankForm), so
  // there is no second campaign-period source to keep in sync.
  static const List<String> kPeriodBasedQuestionIds = [
    'S21Q01',
    'S22Q01',
    'S22Q02',
    'S22Q03',
    'S22Q04',
    'S22Q05_ENTERPRISE',
    'S22Q05_OTHER',
    'S23Q01',
    'S23Q02',
    'S3Q01',
    'S3Q03',
    'S4Q01',
  ];

  // The compile-time placeholder date-phrases these questions carry in the
  // AST (see onefop_ast.dart) — swapped in place for the resolved campaign
  // period. Two French variants exist for the same "1st of January" date;
  // both are replaced. Missing here would mean a period-based question was
  // added to the AST without being wired into kPeriodBasedQuestionIds, not
  // that it's exempt from dynamic dates.
  static const List<String> _kFrPeriodPhrases = [
    "du premier Janvier 2025 à ce jour",
    "du 1er Janvier 2025 à ce jour",
  ];
  static const String _kEnPeriodPhrase =
      "from the 1st of January 2025 to the present day";

  void _applyCampaignPeriodLabels(FormSchemaV2 s) {
    final periodFr = _periodPhraseFr(campaignPeriodStart, campaignPeriodEnd);
    final periodEn = _periodPhraseEn(campaignPeriodStart, campaignPeriodEnd);
    for (final id in kPeriodBasedQuestionIds) {
      final idx = s.fields.indexWhere((f) => f.id == id);
      // -1 is expected for the S22Q05 entity-type variant that doesn't
      // apply to this schema's entityType (e.g. S22Q05_ENTERPRISE is
      // filtered out for a cooperative/CTD/ONG schema).
      if (idx == -1) continue;
      final label = s.fields[idx].label;
      if (label == null) continue;
      var fr = label.fr;
      for (final phrase in _kFrPeriodPhrases) {
        fr = fr.replaceAll(phrase, periodFr);
      }
      final en = label.en.replaceAll(_kEnPeriodPhrase, periodEn);
      s.fields[idx] =
          s.fields[idx].copyWith(label: LocalizedText(fr: fr, en: en));
    }
  }

  static String _fmtCampaignDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  // Matches the fallback wording used elsewhere for an unset campaign date
  // (see app_fr.arb/app_en.arb's periodUndefined) — reached only if this
  // controller is ever constructed with no campaign period in context.
  // Both real entry points (home_screen.dart's _openOnefopFormForCompany
  // and _navigateToBlankForm) fetch and gate on the active campaign before
  // constructing this controller, so in normal use this is unreachable —
  // it exists so a future/offline caller fails visibly with the app's own
  // "period undefined" convention rather than a fabricated date.
  static const _undefined = LocalizedText(fr: 'non définie', en: 'not set');

  static String _periodPhraseFr(DateTime? start, DateTime? end) {
    final startText = start == null ? _undefined.fr : _fmtCampaignDate(start);
    final endText = end == null ? _undefined.fr : _fmtCampaignDate(end);
    return 'du $startText au $endText';
  }

  static String _periodPhraseEn(DateTime? start, DateTime? end) {
    final startText = start == null ? _undefined.en : _fmtCampaignDate(start);
    final endText = end == null ? _undefined.en : _fmtCampaignDate(end);
    return 'from $startText to $endText';
  }

  // ═══════════════════════════════════════════════════════════
  // INIT HELPERS
  // ═══════════════════════════════════════════════════════════

  void _initCtrl() {
    for (final f in _schema!.fields) {
      if (f.type == 'table' || kHybridAstIds.contains(f.id)) continue;
      final c = TextEditingController(text: _data[f.id]?.toString() ?? '');
      void listener() => onFieldChanged(f.id, c.text, f);
      _ctrlListeners[f.id] = listener;
      c.addListener(listener);
      _ctrl[f.id] = c;
    }
  }

  void _initTV() {
    for (final f in _schema!.fields) {
      if (f.type == 'table' || kHybridAstIds.contains(f.id)) continue;
      _tv[f.id] = _data[f.id]?.toString() ?? '';
    }
  }

  void _initGrid() {
    for (final f in _schema!.fields) {
      if (f.type != 'table') continue;
      for (final id in TableCellEngine.cellIds(f)) {
        final v = _data[id];
        if (v is int) _uGrid[id] = v;
      }
    }
    _aGrid = Map.from(_uGrid);
    if (_uGrid.isNotEmpty) recalcAll();
  }

  void _initHybrid() {
    for (final e in kHybridTables.entries) {
      for (final rk in e.value.rowKeys) {
        final id = '${e.key}_${rk}_${e.value.textSuffix}';
        _htv[id] = _data[id]?.toString() ?? '';
        hybridController(id);
      }
    }
  }

  void _initFN() {
    for (final f in _schema!.fields) {
      _fm!.node(f.id);
    }
  }

  void _initKeyH() {
    for (final f in _schema!.fields) {
      if (f.type == 'table' || kHybridAstIds.contains(f.id)) continue;
      _fm!.node(f.id).onKeyEvent = (n, e) => handleFieldKey(n, e, f);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HYBRID TEXT CONTROLLER
  // ═══════════════════════════════════════════════════════════

  TextEditingController hybridController(String id) {
    return _hctrl.putIfAbsent(id, () {
      final c = TextEditingController(text: _htv[id] ?? '');
      c.addListener(() {
        _htv[id] = c.text;
        _data[id] = c.text;
        schedAS();
        _bump();
      });
      if (!_data.containsKey(id)) _data[id] = '';
      return c;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CATEGORY SKIP STATE (Simple Mode / mobile category cards)
  // ═══════════════════════════════════════════════════════════
  // "None to report for this category" is a distinct, explicit answer —
  // not the same as a cell nobody has typed into — because downstream
  // statistical use needs to tell "confirmed zero" apart from "unknown".
  // Stored as a plain boolean in _data under the category's own spec id
  // (e.g. "s23q02_permanent_cadres_skipped", stable across rebuilds and
  // included in collectAndMapData()'s submission payload like any other
  // _data entry) rather than as UI-only state, so it survives navigating
  // away/back, autosaves, and round-trips through drafts.

  bool isCategorySkipped(String categoryKey) =>
      _data['${categoryKey}_skipped'] == true;

  /// Toggling on clears [cellIds] back to a confirmed zero (rather than
  /// leaving stray numbers the skip flag would otherwise contradict);
  /// toggling off just drops the flag and leaves the (already-zero) cells
  /// for the user to fill in.
  void setCategorySkipped(
      String categoryKey, bool value, List<String> cellIds) {
    _data['${categoryKey}_skipped'] = value;
    if (value) {
      for (final id in cellIds) {
        _uGrid[id] = 0;
        _aGrid[id] = 0;
        _data[id] = 0;
      }
      _dirtyT.add(fieldPrefix(cellIds.isEmpty ? categoryKey : cellIds.first));
      _schedRecalc();
    }
    schedAS();
    notifyListeners();
  }

  // ═══════════════════════════════════════════════════════════
  // GRID / TABLE RECALCULATION
  // ═══════════════════════════════════════════════════════════

  void onGridCellChanged(String id, int? v) {
    if (v == null) {
      _uGrid.remove(id);
      _aGrid.remove(id);
      _data.remove(id);
    } else {
      final n = v.clamp(0, 10000);
      _uGrid[id] = n;
      _aGrid[id] = n;
      _data[id] = n;
    }
    schedAS();
    _dirtyT.add(fieldPrefix(id));
    _schedRecalc();
    _bump();
  }

  void recalcAll() {
    if (_schema == null) return;
    for (final f in _schema!.fields) {
      if (f.type != 'table') continue;
      final sp = f.tableSpec;
      if (sp == null) continue;
      final rawPfx = (sp['prefix'] as String? ?? f.id).toLowerCase();
      _dirtyT.add(fieldPrefix('${rawPfx}_x'));
    }
    _recalcDirty();
  }

  /// Debounces subtotal/total recomputation so a fast typist doesn't force
  /// a full-page rebuild (every GenericSpreadsheetTable on the page relayouts
  /// on [notifyListeners]) on every single keystroke — only once typing
  /// pauses. The just-typed digit itself renders immediately regardless,
  /// since it lives in the cell's own TextEditingController, not in this
  /// recompute; only the *other* dependent cells (subtotal/total columns)
  /// wait for the debounce.
  void _schedRecalc() {
    _gridRecalcTimer?.cancel();
    _gridRecalcTimer = Timer(const Duration(milliseconds: 220), _recalcDirty);
  }

  /// tableSpec['rows'] for the table field whose prefix is [prefix] (e.g.
  /// Administration's SFP rows for s21q01/s22q01/s3q01), or null to let
  /// TableCellEngine.dispatch fall back to the default CSP rows — used so
  /// recalculation agrees with whatever row set TableSpecBuilder actually
  /// rendered for the current entity type.
  List<String>? _tableRowsForPrefix(String prefix) {
    if (_schema == null) return null;
    for (final f in _schema!.fields) {
      if (f.type != 'table') continue;
      final sp = f.tableSpec;
      if (sp == null) continue;
      final pfx = (sp['prefix'] as String? ?? f.id).toLowerCase();
      if (pfx != prefix) continue;
      final rawRows = sp['rows'];
      return rawRows is List ? rawRows.cast<String>() : null;
    }
    return null;
  }

  void _recalcDirty() {
    if (_dirtyT.isEmpty) return;
    var w = Map<String, int>.from(_aGrid);
    final tp = Set<String>.from(_dirtyT);
    _dirtyT.clear();
    for (final p in tp) {
      w = TableCellEngine.dispatch(w, p, rows: _tableRowsForPrefix(p));
    }
    final userCellIds = <String>{};
    for (final f in _schema!.fields) {
      if (f.type != 'table') continue;
      userCellIds.addAll(TableCellEngine.cellIds(f));
    }
    for (final e in w.entries) {
      if (userCellIds.contains(e.key)) {
        if (_uGrid.containsKey(e.key)) {
          _data[e.key] = _uGrid[e.key];
        } else {
          _data.remove(e.key);
        }
      } else {
        _data[e.key] = e.value;
      }
    }
    _aGrid = w;
    notifyListeners();
  }

  // ═══════════════════════════════════════════════════════════
  // FIELD CHANGE HANDLERS
  // ═══════════════════════════════════════════════════════════

  void onFieldChanged(String id, String v, FieldSchema f) {
    if (_schema == null) return;
    String cleanValue = v;
    if (f.type == 'tel') {
      cleanValue = v.replaceAll(RegExp(r'[^0-9]'), '');
      if (cleanValue.length > 9) cleanValue = cleanValue.substring(0, 9);
    }
    _data[id] =
        f.type == 'number' ? (int.tryParse(cleanValue) ?? 0) : cleanValue;
    _tv[id] = cleanValue;
    if (cleanValue != v && _ctrl.containsKey(id)) {
      final c = _ctrl[id]!;
      final listener = _ctrlListeners[id];
      if (listener != null) c.removeListener(listener);
      c.value = TextEditingValue(
        text: cleanValue,
        selection: TextSelection.collapsed(offset: cleanValue.length),
      );
      if (listener != null) c.addListener(listener);
    }
    schedAS();
    _valCache.remove(id);
    _schedRevalidate();
    _bump();
  }

  // ═══════════════════════════════════════════════════════════
  // AUTO-SAVE
  // ═══════════════════════════════════════════════════════════

  /// Records where the user currently is (page + any table tab cursors)
  /// into _data and marks the draft dirty — called on every
  /// next()/prev()/goto()/setTabCursor(), not just on answer edits, so a
  /// draft closed mid-navigation (no field touched since the last save)
  /// still resumes in the right place. Deliberately doesn't route through
  /// [schedAS] the way an answer edit does: schedAS's first-call-in-a-
  /// while branch fires [_doAS] (and its unstructured, uncancellable
  /// `Future.delayed`) synchronously, which is fine for an actual edit but
  /// far too eager for a mere navigation step — repeated taps (e.g.
  /// stepping through a tabbed table's internal tabs) would otherwise
  /// queue up saves for no reason. Setting _dirty directly still gets the
  /// position written for real once *something* actually triggers a save
  /// — a later edit's schedAS(), an explicit saveNow(), or the
  /// flushPendingSave() every screen already runs from dispose() (the
  /// "app closed" case this exists for).
  void _persistPosition() {
    _data[_kNavPositionKey] = {
      'section': _si,
      'tabs': Map<String, int>.from(_tabCursor),
    };
    if (!_dirty) {
      _dirty = true;
      notifyListeners();
    }
  }

  /// Restores _si and _tabCursor/_tabPeak from a loaded draft's stored
  /// position, if present and still in range for the current schema.
  /// Called once from [_loadSchema], after _schema/pageCount are known.
  void _restorePosition() {
    final nav = _data[_kNavPositionKey];
    if (nav is! Map) return;
    _resumedFromSavedPosition = true;
    final section = nav['section'];
    if (section is int && section >= 0 && section < pageCount) {
      _si = section;
    }
    final tabs = nav['tabs'];
    if (tabs is Map) {
      for (final entry in tabs.entries) {
        final v = entry.value;
        if (v is int) {
          final key = entry.key.toString();
          _tabCursor[key] = v;
          _tabPeak[key] = v;
        }
      }
    }
  }

  void schedAS() {
    final now = DateTime.now();
    if (!_dirty) {
      _dirty = true;
      notifyListeners();
    }

    if (_lastSaveRequest == null ||
        now.difference(_lastSaveRequest!) > const Duration(seconds: 3)) {
      _lastSaveRequest = now;
      _asTimer?.cancel();
      _doAS();
      return;
    }

    _lastSaveRequest = now;
    _asTimer?.cancel();
    _asTimer = Timer(const Duration(seconds: 3), _doAS);
  }

  Future<void> _doAS() async {
    if (_saveInFlight) return;
    _saveInFlight = true;
    _saving = true;
    _dirty = false;
    notifyListeners();
    onSave(Map.from(_data));
    await Future.delayed(const Duration(milliseconds: 600));
    _saveInFlight = false;
    _saving = false;
    notifyListeners();
  }

  /// Synchronously persist any edits still waiting on the debounce timer.
  /// Must run before [dispose] — Cancel/back-navigation tear down the
  /// widget well inside the 3s autosave window otherwise, dropping the
  /// user's last edits silently.
  void flushPendingSave() {
    _asTimer?.cancel();
    _asTimer = null;
    if (!_dirty) return;
    _dirty = false;
    onSave(Map.from(_data));
  }

  /// Same as [flushPendingSave] but for an interactive "Save" button click:
  /// runs through [_doAS] so saving/dirty flip and notify listeners,
  /// driving the title bar's status indicator. Safe to call anytime the
  /// controller is still mounted — unlike [flushPendingSave], never call
  /// this from dispose().
  Future<void> saveNow() async {
    _asTimer?.cancel();
    _asTimer = null;
    if (!_dirty) return;
    await _doAS();
  }

  // ═══════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════

  void _schedRevalidate() {
    _valTimer?.cancel();
    _valTimer = Timer(const Duration(milliseconds: 300), () {
      _revalidateCurrentPage();
      _bump();
    });
  }

  void _revalidateCurrentPage() {
    for (final idx in sectionIndicesForPage(_si)) {
      final s = _schema!.sections[idx];
      _valid[s.id] = validateSection(s);
    }
    notifyListeners();
  }

  void onBlur(String id) {
    if (!_touched.contains(id)) {
      _touched.add(id);
      _valCache.remove(id);
      notifyListeners();
    }
  }

  bool hasError(FieldSchema f) {
    return (_valCache.putIfAbsent(
          f.id,
          () => FieldValidator.validate(f, _data, touched: _touched),
        )) !=
        null;
  }

  /// Unconditional (ignores touched-state) required-field check — unlike
  /// [hasError], which only flags a field once the user has reached it.
  /// Used to gate the excel shell's per-unit "next" button: a unit should
  /// be advanceable once its required fields are actually filled, not
  /// once the user has merely clicked into them.
  bool isFieldFilled(FieldSchema f) =>
      FieldValidator.validate(f, _data) == null;

  String errorText(FieldSchema f, AppLocalizations l10n) {
    final error = _valCache.putIfAbsent(
          f.id,
          () => FieldValidator.validate(f, _data, touched: _touched),
        ) ??
        const ValidationError(ValidationErrorCode.required);
    return validationErrorMessage(l10n, error);
  }

  bool validateSection(SectionSchema s) {
    if (_schema == null) return true;
    return FieldValidator.isSectionComplete(
      s,
      _schema!,
      _data,
      hybridIds: kHybridAstIds,
    );
  }

  List<String> missingLabels(SectionSchema s, Locale locale) {
    if (_schema == null) return [];
    return FieldValidator.missingLabels(
      s,
      _schema!,
      _data,
      locale,
      hybridIds: kHybridAstIds,
    );
  }

  bool validatePage(int page) {
    return sectionIndicesForPage(page)
        .every((i) => validateSection(_schema!.sections[i]));
  }

  bool validateAllPages() {
    if (_schema == null) return false;
    for (int p = 0; p < pageCount; p++) {
      if (!validatePage(p)) return false;
    }
    return true;
  }

  int? get firstFailingPage {
    for (int p = 0; p < pageCount; p++) {
      if (!validatePage(p)) return p;
    }
    return null;
  }

  // ── Mobile validation banner state ──────────────────────────
  // Which page (if any) just failed to advance/submit — drives
  // MobilePageValidationBanner. Deliberately narrower than "some page
  // somewhere is incomplete" (true for most of a session): only set
  // right when a Next/Submit attempt was blocked, and cleared once the
  // user navigates to a different page.
  int? _advanceBlockedPage;
  int? get advanceBlockedPage => _advanceBlockedPage;

  void flagBlockedPage(int page) => _advanceBlockedPage = page;

  void touchAllRequired() {
    if (_schema == null) return;
    for (final s in _schema!.sections) {
      for (final id in s.fieldIds) {
        final f = _schema!.getField(id);
        if (f != null &&
            f.required &&
            isFieldVisible(f) &&
            !FieldValidator.kOptionalOverrides.contains(f.id)) {
          _touched.add(id);
        }
      }
    }
    _valCache.clear();
    _revalidateCurrentPage();
  }

  // ═══════════════════════════════════════════════════════════
  // VISIBILITY & NAVIGATION
  // ═══════════════════════════════════════════════════════════

  bool isFieldVisible(FieldSchema f) {
    if (f.dependsOn != null && f.dependsOn!.isNotEmpty) {
      if (_data[f.dependsOn] != f.dependsValue) return false;
    }
    return true;
  }

  int get pageCount => _schema?.sections.length ?? 1;

  List<int> sectionIndicesForPage(int page) {
    if (_schema == null) return [];
    if (page >= 0 && page < _schema!.sections.length) return [page];
    return [];
  }

  SectionSchema? primarySection(int page) {
    final idxs = sectionIndicesForPage(page);
    if (idxs.isEmpty) return null;
    return _schema!.sections[idxs.first];
  }

  bool isSimpleSection(String sectionId) =>
      sectionId == 'section0' || sectionId.startsWith('section1_');

  List<String> computeVisibleFieldIds() {
    if (_schema == null) return [];
    final result = <String>[];
    for (final idx in sectionIndicesForPage(_si)) {
      for (final id in _schema!.sections[idx].fieldIds) {
        if (kHybridAstIds.contains(id)) continue;
        final f = _schema!.getField(id);
        if (f == null) continue;
        if (!isFieldVisible(f)) continue;
        result.add(id);
      }
    }
    final revealed = _revealedFieldIds;
    if (revealed == null) return result;
    final revealedSet = revealed.toSet();
    return result.where(revealedSet.contains).toList();
  }

  void focusFieldOffset(int delta) {
    if (_schema == null) return;
    if (_visibleFieldIds.isEmpty ||
        (_fm!.activeId != null && !_visibleFieldIds.contains(_fm!.activeId))) {
      _visibleFieldIds = computeVisibleFieldIds();
    }
    final fieldIds = _visibleFieldIds;
    final activeId = _fm!.activeId;
    if (activeId == null) return;
    String currentFieldId = activeId;
    for (final fid in fieldIds) {
      final field = _schema!.getField(fid);
      if (field != null && field.type == 'table') {
        if (TableCellEngine.cellIds(field).contains(activeId)) {
          currentFieldId = fid;
          break;
        }
      }
    }
    final idx = fieldIds.indexOf(currentFieldId);
    if (idx < 0) return;
    final targetIdx = idx + delta;
    if (targetIdx >= 0 && targetIdx < fieldIds.length) {
      focusFieldId(fieldIds[targetIdx], preferFirst: delta > 0);
    } else if (targetIdx >= fieldIds.length && delta > 0) {
      if (_onRevealForwardBoundary != null) {
        _onRevealForwardBoundary!();
      } else {
        next();
      }
    } else if (targetIdx < 0 && delta < 0) {
      if (_onRevealBackwardBoundary != null) {
        _onRevealBackwardBoundary!();
      } else {
        prev();
      }
    }
  }

  void focusFieldId(String fieldId,
      {bool preferFirst = true, bool scroll = true}) {
    final field = _schema?.getField(fieldId);
    if (field != null && field.type == 'table') {
      final cells = TableCellEngine.cellIds(field);
      if (cells.isNotEmpty) {
        _fm!.focus(preferFirst ? cells.first : cells.last);
      } else {
        _fm!.focus(fieldId);
      }
    } else {
      _fm!.focus(fieldId);
    }
    // Entering a field forward (preferFirst) should reveal it starting from
    // its top — e.g. a new table's header, not some mid/bottom slice of it —
    // so the whole thing is visible to fill out. Entering backward (Shift+Tab
    // into the previous table) aligns to its end instead, landing near the
    // last cell the user would naturally continue editing from.
    if (scroll) scrollToField(fieldId, alignEnd: !preferFirst);
  }

  void exitTable(String fieldId) {
    if (_visibleFieldIds.isEmpty || !_visibleFieldIds.contains(fieldId)) {
      _visibleFieldIds = computeVisibleFieldIds();
    }
    final fieldIds = _visibleFieldIds;
    final idx = fieldIds.indexOf(fieldId);
    if (idx >= 0 && idx < fieldIds.length - 1) {
      focusFieldId(fieldIds[idx + 1], preferFirst: true);
    } else if (_onRevealForwardBoundary != null) {
      _onRevealForwardBoundary!();
    } else {
      next();
    }
  }

  void exitTablePrevious(String fieldId) {
    if (_visibleFieldIds.isEmpty || !_visibleFieldIds.contains(fieldId)) {
      _visibleFieldIds = computeVisibleFieldIds();
    }
    final fieldIds = _visibleFieldIds;
    final idx = fieldIds.indexOf(fieldId);
    if (idx > 0) {
      focusFieldId(fieldIds[idx - 1], preferFirst: false);
    } else if (_onRevealBackwardBoundary != null) {
      _onRevealBackwardBoundary!();
    } else {
      prev();
    }
  }

  KeyEventResult handleFieldKey(FocusNode n, KeyEvent e, FieldSchema f) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    final kb = HardwareKeyboard.instance;
    if (f.type == 'radio') {
      final opts = f.options ?? [];
      if (opts.isNotEmpty) {
        final cur = _data[f.id] as String?;
        final idx = opts.indexOf(cur ?? '');
        if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowLeft)) {
          final ni = idx > 0 ? idx - 1 : opts.length - 1;
          setRadioValue(f, opts[ni]);
          return KeyEventResult.handled;
        }
        if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowRight)) {
          final ni = idx >= 0 && idx < opts.length - 1 ? idx + 1 : 0;
          setRadioValue(f, opts[ni]);
          return KeyEventResult.handled;
        }
      }
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowUp)) {
      focusFieldOffset(-1);
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowDown)) {
      focusFieldOffset(1);
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.enter)) {
      onBlur(f.id);
      focusFieldOffset(1);
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.tab)) {
      onBlur(f.id);
      if (kb.isShiftPressed) {
        focusFieldOffset(-1);
      } else {
        focusFieldOffset(1);
      }
      return KeyEventResult.handled;
    }
    return _fm!.handleKey(n, e);
  }

  void setRadioValue(FieldSchema f, String value) {
    _data[f.id] = value;
    _tv[f.id] = value;
    _touched.add(f.id);
    _valCache.remove(f.id);
    _visibleFieldIds = computeVisibleFieldIds();
    _schedRevalidate();
    notifyListeners();
  }

  // alignEnd=false (default) aligns the target's top to the viewport's top —
  // right for landing on a new table/page, so it's pushed fully into view
  // from its header rather than showing some mid/bottom slice of it when the
  // block is taller than the viewport. alignEnd=true aligns to the bottom,
  // for backward navigation into a table's tail end.
  void scrollToField(String fieldId, {bool alignEnd = false}) {
    final key = blockKeys[fieldId];
    if (key == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = key.currentContext;
      if (ctx == null) return;
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
        alignmentPolicy: alignEnd
            ? ScrollPositionAlignmentPolicy.keepVisibleAtEnd
            : ScrollPositionAlignmentPolicy.keepVisibleAtStart,
      );
    });
  }

  void next() {
    if (_schema == null) return;
    if (!validatePage(_si)) {
      _advanceBlockedPage = _si;
      touchAllRequired();
      notifyListeners();
      return;
    }
    if (_si < pageCount - 1) {
      _si++;
      _visibleFieldIds = computeVisibleFieldIds();
      _persistPosition();
      notifyListeners();
      // _scrollToTop() already handles the scroll for a page change —
      // also animating focusFirst()'s own scroll-into-view at the same
      // time fights it on the same controller (two competing animations
      // racing for the scroll position), which is what made page/sidebar
      // navigation feel sluggish. Focus only; don't scroll twice.
      focusFirst(scroll: false);
      _scrollToTop();
    }
  }

  void prev() {
    if (_si > 0) {
      _si--;
      _visibleFieldIds = computeVisibleFieldIds();
      _persistPosition();
      notifyListeners();
      focusFirst(scroll: false);
      _scrollToTop();
    }
  }

  // focus/scroll default true so the two existing call sites (submit's
  // jump to a failed page, and the pre-outline-nav Sidebar tap) keep their
  // original behavior unchanged. The vertical navigation's section/
  // subsection jumps (see onefop_section_units.dart's navigateToSection)
  // pass both false: they browse the outline without focusing a field,
  // and do their own single scroll via scrollToUnit afterwards — animating
  // _scrollToTop() at the same time would race it on the same
  // ScrollController (see focusFirst's own doc comment on that race).
  void goto(int page, {bool focus = true, bool scroll = true}) {
    // Leaving the page that failed validation clears the banner; landing
    // on it (e.g. the jump _previewSubmit() does via flagBlockedPage())
    // keeps it, so it shows exactly where the failure happened.
    if (page != _advanceBlockedPage) _advanceBlockedPage = null;
    _si = page;
    _visibleFieldIds = computeVisibleFieldIds();
    _persistPosition();
    notifyListeners();
    if (focus) focusFirst(scroll: false);
    if (scroll) _scrollToTop();
  }

  // Recomputes _visibleFieldIds *inside* the post-frame callback rather
  // than before scheduling it — next()/prev()/goto() call this
  // synchronously, right after bumping _si, which is before the unit-body
  // widget's rebuild has run setRevealedFieldIds() for the new page's
  // first unit. Computing eagerly here used to still see the *previous*
  // unit's reveal scope, intersect it against the new page's field ids,
  // get an empty list, and silently skip focusing anything — landing on
  // a new section (via Suivant, or a table's Enter/Tab running off its
  // last cell) never actually moved the cursor into it. Deferring the
  // whole computation to the post-frame callback — which runs after that
  // rebuild has already set the new unit's reveal scope — fixes that.
  void focusFirst({bool scroll = true}) {
    if (_disposed || _schema == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_disposed) return;
      _visibleFieldIds = computeVisibleFieldIds();
      if (_visibleFieldIds.isNotEmpty) {
        focusFieldId(_visibleFieldIds.first, preferFirst: true, scroll: scroll);
      }
    });
  }

  void _scrollToTop() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mainScroll.hasClients) {
        mainScroll.animateTo(0,
            duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  void setSidebarMode(int mode) {
    _sidebarMode = mode;
    notifyListeners();
  }

  // ═══════════════════════════════════════════════════════════
  // DATA COLLECTION & MAPPING
  // ═══════════════════════════════════════════════════════════

  Map<String, dynamic> collectAndMapData() {
    // 1. Recalc all tables
    var w = Map<String, int>.from(_aGrid);
    for (final p in [
      's21q01',
      's22q01',
      's22q02',
      's22q03',
      's22q04',
      's22q05_ent',
      's22q05_oth',
      's23q01',
      's23q02',
      's3q01',
      's3q02',
      's3q03',
      's4q01',
      's4q02',
      's4q03'
    ]) {
      w = TableCellEngine.dispatch(w, p, rows: _tableRowsForPrefix(p));
    }
    _aGrid = w;

    final userCellIds = <String>{};
    if (_schema != null) {
      for (final f in _schema!.fields) {
        if (f.type != 'table') continue;
        userCellIds.addAll(TableCellEngine.cellIds(f));
        final paper = f.paperCode;
        final status = paper == null
            ? null
            : _data[TableResponseStatus.fieldId(paper)]?.toString();
        for (final id in TableCellEngine.cellIds(f)) {
          if (status == TableResponseStatus.none) {
            _data[id] = 0;
          } else if (status == TableResponseStatus.notApplicable) {
            _data.remove(id);
          } else if (_uGrid.containsKey(id)) {
            _data[id] = _uGrid[id];
          } else {
            _data.remove(id);
          }
        }
      }
    }
    for (final e in _aGrid.entries) {
      if (!userCellIds.contains(e.key)) _data[e.key] = e.value;
    }
    for (final e in _htv.entries) {
      if (e.value.isNotEmpty) _data[e.key] = e.value;
    }
    for (final e in _ctrl.entries) {
      if (e.value.text.isNotEmpty) _data[e.key] = e.value.text;
    }

    return applyBackendMappers(Map.from(_data));
  }

  Map<String, dynamic> applyBackendMappers(Map<String, dynamic> d) {
    final m = Map<String, dynamic>.from(d);
    if (m['area'] is String) {
      m['area'] = BackendMappers.area(m['area'] as String?);
    }
    if (m['businessSector'] is String) {
      m['businessSector'] =
          BackendMappers.sector(m['businessSector'] as String?);
    }
    if (m['cooperativeType'] is String) {
      m['cooperativeType'] =
          BackendMappers.coopType(m['cooperativeType'] as String?);
    }
    if (m['legalStatus'] is String) {
      m['legalStatus'] =
          BackendMappers.legalStatus(m['legalStatus'] as String?);
    }
    if (m['enterpriseSize'] is String) {
      m['enterpriseSize'] = BackendMappers.size(m['enterpriseSize'] as String?);
    }
    if (m['ctdType'] is String) {
      m['ctdType'] = BackendMappers.ctdType(m['ctdType'] as String?);
    }
    if (m['councilType'] is String) {
      m['councilType'] =
          BackendMappers.councilType(m['councilType'] as String?);
    }
    return m;
  }

  // ═══════════════════════════════════════════════════════════
  // REMOTE CALLS
  // ═══════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// REPLACE the preview() method with this:
// ─────────────────────────────────────────────────────────────
  Future<PreviewResult> preview(AppLocalizations l10n) async {
    final snapshot = collectAndMapData();
    _submissionSnapshot = snapshot;

    try {
      final apiClient = ApiClient();
      final pdfBytes = await apiClient.previewQuestionnaire(
        {
          'data': snapshot,
          'entityType': entityTypeString(entityType),
          'userId': userId ?? 'unknown',
          'companyId': companyId,
          'establishmentId': _metaEstablishmentId,
          'quarterCode': _metaQuarterCode,
          'formId':
              'PREVIEW_${_metaEstablishmentId}_${DateTime.now().millisecondsSinceEpoch}',
          '__meta': {
            'establishmentId': _metaEstablishmentId,
            'taxNumber': _metaTaxNumber,
            'cnpsNumber': _metaCnpsNumber,
            'registrationNumber': _metaRegistrationNumber,
          },
          'isDraft': true,
        },
        languageCode: l10n.localeName,
      );

      final fn = 'onefop_preview_${DateTime.now().millisecondsSinceEpoch}.pdf';
      return PreviewResult(
          success: true, bytes: Uint8List.fromList(pdfBytes), fileName: fn);
    } catch (e) {
      debugPrint('❌ Preview error: $e');
      return PreviewResult(success: false, error: friendlySubmitError(e, l10n));
    }
  }

// ─────────────────────────────────────────────────────────────
// REPLACE the submit() method with this:
// ─────────────────────────────────────────────────────────────
  Future<SubmitResult> submit(AppLocalizations l10n) async {
    final snapshot = _submissionSnapshot;
    if (snapshot == null) {
      return SubmitResult(success: false, error: l10n.previewUnavailableError);
    }

    final apiClient = ApiClient();
    final payload = {
      'data': snapshot,
      'entityType': entityTypeString(entityType),
      'userId': userId ?? 'unknown',
      'companyId': companyId,
      'establishmentId': _metaEstablishmentId,
      'quarterCode': _metaQuarterCode,
      'formId':
          'ONEFOP_${_metaEstablishmentId}_${_metaQuarterCode}_${DateTime.now().millisecondsSinceEpoch}',
      '__meta': {
        'establishmentId': _metaEstablishmentId,
        'taxNumber': _metaTaxNumber,
        'cnpsNumber': _metaCnpsNumber,
        'registrationNumber': _metaRegistrationNumber,
      },
      'isDraft': false,
    };

    try {
      // Debug: Check if token exists
      final token = await apiClient.getStoredToken();
      debugPrint('🔑 Submit - Token present: ${token != null}');

      await apiClient.submitQuestionnaire(payload);

      _submissionSnapshot = null;
      onSave({});
      onSubmitSuccess?.call();
      return const SubmitResult(success: true);
    } on ApiException catch (e) {
      // A null statusCode means the request never reached the server
      // (connection timeout/error), not a rejection — queue it durably
      // instead of losing the snapshot, which otherwise only lives in
      // memory and would be lost on an app kill.
      if (e.statusCode == null) {
        await SyncQueueService(apiClient).enqueue(
          method: 'post',
          path: '/onefop/submit',
          payload: payload,
          label:
              'Questionnaire ONEFOP — ${_metaEstablishmentId ?? userId ?? ''}',
        );
        _submissionSnapshot = null;
        onSave({});
        onSubmitSuccess?.call();
        return const SubmitResult(success: true, wasQueued: true);
      }
      debugPrint('❌ Submit error: $e');
      return SubmitResult(success: false, error: friendlySubmitError(e, l10n));
    } catch (e) {
      debugPrint('❌ Submit error: $e');
      return SubmitResult(success: false, error: friendlySubmitError(e, l10n));
    }
  }

  /// [ApiException] already carries a short, bounded, user-facing message
  /// from [ApiClient]'s error handling. Anything else (a codec error, a
  /// dropped connection Dio didn't wrap, etc.) falls back to a generic
  /// sentence instead of surfacing the raw exception/stack-trace text.
  String friendlySubmitError(Object e, AppLocalizations l10n) {
    if (e is ApiException) return e.message;
    return l10n.genericSubmitError;
  }

  void onSelectChanged(FieldSchema f, String? value) {
    _data[f.id] = value;
    _tv[f.id] = value ?? '';
    _touched.add(f.id);
    _valCache.remove(f.id);
    _visibleFieldIds = computeVisibleFieldIds();
    _schedRevalidate();
    notifyListeners();
    _fm!.focusNext();
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  String pageLabel(int page, Locale locale) {
    final idxs = sectionIndicesForPage(page);
    if (idxs.isNotEmpty) {
      return kSidebarMeta[_schema!.sections[idxs.first].id]?.label.of(locale) ??
          '${page + 1}';
    }
    return '${page + 1}';
  }

  String sectionTitle(int page, Locale locale) {
    final idxs = sectionIndicesForPage(page);
    if (idxs.isNotEmpty) {
      return SectionTitleLookup.getTitle(
          _schema!.sections[idxs.first].id, locale);
    }
    return '';
  }

  String fieldLabel(FieldSchema f, Locale locale) {
    if (f.label != null) return f.label!.of(locale);
    if (f.instruction != null) return f.instruction!.of(locale);
    if (f.questionText != null && f.questionText!.isNotEmpty) {
      return f.questionText!;
    }
    return f.id;
  }

  String? dividerLabel(String fieldId, Locale locale) =>
      kDividers[fieldId]?.of(locale);

  // Currently focused field — drives the mobile compact header's question-
  // code chip. Table cells report the individual cell id (e.g. "s21q01_r0_c1"),
  // not the parent table field, so this walks the current page's fields the
  // same way focusFieldOffset() does to find the cell's owning table.
  FieldSchema? get activeField {
    if (_schema == null) return null;
    final activeId = _fm?.activeId;
    if (activeId == null) return null;
    final direct = _schema!.getField(activeId);
    if (direct != null) return direct;
    for (final idx in sectionIndicesForPage(_si)) {
      for (final fid in _schema!.sections[idx].fieldIds) {
        final f = _schema!.getField(fid);
        if (f != null &&
            f.type == 'table' &&
            TableCellEngine.cellIds(f).contains(activeId)) {
          return f;
        }
      }
    }
    return null;
  }
}
