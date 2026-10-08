// lib/screens/onefop/onefop_form_controller.dart
// ══════════════════════════════════════════════════════════════
// BUSINESS LOGIC & STATE CONTROLLER  (extracted from v8.3)
// ══════════════════════════════════════════════════════════════

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/focus/campaign_period.dart';
import '../../core/focus/onefop_form_loader.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/schema/form_schema_v2.dart';
import '../../core/focus/schema/navigation_engine.dart';
import '../../core/focus/schema/section_schema.dart';
import '../../core/focus/unified_focus_manager_v2.dart';
import '../../core/focus/compiler/section_title_lookup.dart';
import '../../core/focus/utils/field_validator.dart';
import '../../core/focus/utils/table_response_status.dart';
import '../../core/focus/renderers/activities_table.dart'
    show kActivitiesTableRowCount, kActivitiesTableFieldSuffixes;
import '../../core/focus/renderers/vt_routing.dart' show isVtTableTemplate;
import '../../core/focus/renderers/vt_table_defs.dart' show vtTableDefFor;
import '../../core/focus/renderers/vt_table_types.dart';
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
  // FutureOr, not void: callers persisting to DraftService/the backend
  // return a real Future, and it must be awaited so a rejected save can be
  // caught instead of vanishing as an unhandled async error — see
  // _lastSavedAt/_saveFailed's own doc comments for why that mattered.
  // Still callable with a plain synchronous void callback (e.g. tests),
  // since a non-Future return also satisfies FutureOr<void>.
  final FutureOr<void> Function(Map<String, dynamic>) onSave;
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
  final Map<String, TextEditingController> _gctrl = {};

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
  // Wall-clock time of the last CONFIRMED-persisted save (onSave resolved
  // without throwing) — shown in the shell title bar as "Enregistré à
  // HH:MM"/"Saved at HH:MM" rather than a bare, timeless "Saved" label
  // (VTC-UX-BENCHMARK "Saving": header status must be Saving…/Saved at
  // 14:32/Could not save — retry, not a transient toast alone). Null until
  // the first successful save this session.
  DateTime? _lastSavedAt;
  // True when the most recent save attempt (autosave or the interactive
  // Save button) threw — onSave now returns/may return a Future, and a
  // rejected one used to vanish as an unhandled async error while the
  // title bar still reported "Enregistré"/"Saved". A respondent must never
  // be told their statistical declaration is saved when it silently
  // wasn't. Cleared by the next save attempt that succeeds; _dirty stays
  // true on failure so the data is not mistaken for confirmed-persisted.
  bool _saveFailed = false;
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
  DateTime? get lastSavedAt => _lastSavedAt;
  bool get saveFailed => _saveFailed;
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

  // ── Coherence hints — see onefop_coherence_checker.dart. Non-blocking;
  // purely informational. Recomputed on a debounce (_schedCoherenceCheck,
  // called from the same explicit answer-mutation sites as
  // _schedRevalidate) rather than from every notifyListeners() call —
  // notifyListeners() also fires on schema load, page navigation, and
  // focus changes, none of which change _data, so hooking the recompute
  // there reran this full-form check far more often than any answer
  // actually changed. ──
  List<CoherenceFlag> _coherenceFlags = const [];
  List<CoherenceFlag> get coherenceFlags => _coherenceFlags;
  Timer? _coherenceTimer;

  void _schedCoherenceCheck() {
    _coherenceTimer?.cancel();
    _coherenceTimer = Timer(const Duration(milliseconds: 300), () {
      if (_disposed) return;
      _coherenceFlags = OnefopCoherenceChecker.check(_data, entityType);
      notifyListeners();
    });
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
    _coherenceTimer?.cancel();
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
      // Synchronous, one-time: a resumed draft can already carry
      // incoherent data, so the banner shouldn't wait for the first edit's
      // debounce. Subsequent recomputation goes through
      // _schedCoherenceCheck() instead.
      _coherenceFlags = OnefopCoherenceChecker.check(_data, entityType);

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

  // Every question whose wording refers to the questionnaire's
  // data-collection period carries a placeholder date phrase in the AST
  // (« du 1er Janvier 2026 à ce jour », « from 1st January 2026 to date », …);
  // each is replaced by the active round's period, by pattern
  // (core/focus/campaign_period.dart) rather than a list of question ids, so
  // every period-based question is covered — including the project-programme
  // PP_S4Q01-06 and the « to date » English variant an id/phrase list missed.
  // The project-programme KPI table's column headers (S3 outcomes) get the
  // same period through their tableSpec (TableSpecBuilder._buildKpiPeriod).
  // campaignPeriodStart/End come from the same SubmissionRound
  // (/onefop/active-quarter) that already gates entry to this screen (see
  // home_screen.dart's _openOnefopFormForCompany/_navigateToBlankForm), so
  // there is no second campaign-period source to keep in sync. With no
  // period the wording reads « non définie » / « not set » (the app's
  // periodUndefined convention), never a made-up date.
  void _applyCampaignPeriodLabels(FormSchemaV2 s) {
    for (var i = 0; i < s.fields.length; i++) {
      final field = s.fields[i];
      final label = field.label == null
          ? null
          : withCampaignPeriod(field.label!, campaignPeriodStart, campaignPeriodEnd);
      final spec = field.tableSpec;
      final isKpi = (spec?['template'] as String?)?.trim() == 'kpi_period_table';
      if (identical(label, field.label) && !isKpi) continue;
      s.fields[i] = field.copyWith(
        label: label,
        tableSpec: isKpi
            ? {
                ...spec!,
                kKpiPeriodLabelsKey: kpiPeriodLabels(campaignPeriodStart, campaignPeriodEnd),
              }
            : null,
      );
    }
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
    // Projects & Programs — Section 2's activities table: every cell
    // (including the coded dropdowns) is hybrid-controller-backed, same
    // mechanism as kHybridTables above, just 6 fields x up to 13 rows
    // instead of 1 field x 3 rows — see ActivitiesTable. Run
    // unconditionally like the loop above (harmless no-op for every
    // other entity type, whose schema never renders these cells).
    for (var n = 1; n <= kActivitiesTableRowCount; n++) {
      for (final suffix in kActivitiesTableFieldSuffixes) {
        final id = 's2_row${n}_$suffix';
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
      // _htv[id] is only pre-populated for the fixed id sets _initHybrid()
      // walks (kHybridTables, ActivitiesTable) — VT's row-editor text cells
      // (specialtyText, roster names) span too many prefix/row
      // combinations across 8+ tables to enumerate the same way, and are
      // never pre-seeded. Falling back to _data[id] here (the real loaded
      // value on a reopened draft/submission) instead of defaulting
      // straight to '' avoids a first-open blank field silently
      // overwriting real data on this cell's very first keystroke.
      final c =
          TextEditingController(text: _htv[id] ?? _data[id]?.toString() ?? '');
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

  /// Same lazy, id-keyed controller pattern as [hybridController], but for
  /// a VT grid cell's numeric value — writes go through [onGridCellChanged]
  /// (int-or-absent, same convention as every other numeric table cell)
  /// rather than storing raw text, so a VT spreadsheet cell (see
  /// VtSpreadsheetTable) behaves identically to the bottom-sheet row
  /// editor's own numeric fields, just without the sheet's local
  /// TextEditingController rebuilt per row-open.
  TextEditingController gridNumberController(String id) {
    return _gctrl.putIfAbsent(id, () {
      final c = TextEditingController(text: _data[id]?.toString() ?? '');
      c.addListener(() {
        final t = c.text.trim();
        onGridCellChanged(id, t.isEmpty ? null : int.tryParse(t));
      });
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
  // RAW VALUE (arbitrary per-id string/bool cells outside the AST field
  // list — e.g. VT's row-editor picker/toggle cells, synthesized from a
  // VtTableDef rather than declared one-by-one as FormQuestionAst entries,
  // so setRadioValue's FieldSchema-keyed API doesn't apply)
  // ═══════════════════════════════════════════════════════════

  // No input validation/coercion — caller must pass only well-formed values
  // (fixed VtOption strings or real bools). Safe for current VtRowEditor
  // callers; do not reuse for free-text or user-typed input without adding
  // validation first.
  void setRawValue(String id, dynamic value) {
    if (value == null || (value is String && value.isEmpty)) {
      _data.remove(id);
    } else {
      _data[id] = value;
    }
    schedAS();
    _bump();
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
    // Empty and zero are distinct declaration states. Removing a numeric
    // answer must not manufacture a reported zero; an explicitly entered
    // "0" still parses and persists as the numeric value 0.
    if (cleanValue.isEmpty) {
      _data.remove(id);
    } else if (f.type == 'number') {
      // A malformed value is not a reported value either. This is normally
      // prevented by the numeric input formatter, but keeping the controller
      // defensive also protects pasted/programmatic changes.
      final parsed = int.tryParse(cleanValue);
      if (parsed == null) {
        _data.remove(id);
      } else {
        _data[id] = parsed;
      }
    } else {
      _data[id] = cleanValue;
    }
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
    _schedCoherenceCheck();
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
    notifyListeners();
    try {
      // Awaited even though onSave is declared FutureOr<void> — awaiting a
      // non-Future value is a no-op, so this is safe either way. Awaiting
      // is what lets a thrown/rejected save be caught below instead of
      // becoming an unhandled async error while the title bar still
      // claimed "Enregistré"/"Saved".
      await onSave(Map.from(_data));
      _dirty = false;
      _saveFailed = false;
      _lastSavedAt = DateTime.now();
    } catch (e, st) {
      debugPrint('onSave failed: $e\n$st');
      // _dirty stays true: the data was never confirmed persisted, so it
      // must keep reading as unsaved work rather than silently-lost work.
      _saveFailed = true;
    }
    _saveInFlight = false;
    _saving = false;
    notifyListeners();
  }

  /// Synchronously persist any edits still waiting on the debounce timer.
  /// Must run before [dispose] — Cancel/back-navigation tear down the
  /// widget well inside the 3s autosave window otherwise, dropping the
  /// user's last edits silently. Fire-and-forget by necessity (the
  /// controller is being torn down, so there is no UI left to report a
  /// failure to), but still guarded so a rejected save can't surface as an
  /// unhandled exception during dispose.
  void flushPendingSave() {
    _asTimer?.cancel();
    _asTimer = null;
    if (!_dirty) return;
    _dirty = false;
    Future.sync(() => onSave(Map.from(_data)))
        .catchError((e, st) => debugPrint('onSave (flush) failed: $e\n$st'));
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

  bool isFieldVisible(FieldSchema f) => f.isVisibleGiven(_data);

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

  // "Simple" here means: buildFieldLabel should prefix each individual
  // question with its own paperCode. Written for the original ONEFOP
  // entities, where every section past section0/section1_* is almost
  // entirely tables (whose own header/RowNum column already carries the
  // code, so an inline prefix on the field label would be redundant) —
  // section0/section1_* are their one genuinely flat, question-by-
  // question section. VT's questionnaire doesn't follow that shape: most
  // of its sections (2, 3, 6, 7, 9, plus the simple fields interspersed
  // between VT's own tables in 4/5/8) are flat individual questions
  // outside any table, with no other place their own code would ever
  // show — live-reported: "not all questions in the VT simple forms are
  // having question codes" (VT's section2_vocationalTraining and later
  // never matched section1_*, only VT's own Section 1 did). Every VT
  // section id ends in "_vocationalTraining" (see onefop_ast.dart) — none
  // of any other entity's section ids do, so this is scoped to VT alone
  // and changes nothing for section0/section1_*/every other entity's
  // sections. Shared by both desktop Simple Mode and mobile (see
  // simple_mode_shell.dart's own doc comment: "buildField is supplied by
  // the caller... so simple-field rendering can never drift" between
  // them) — deliberately, since the same completeness gap exists on both.
  bool isSimpleSection(String sectionId) =>
      sectionId == 'section0' ||
      sectionId.startsWith('section1_') ||
      sectionId.endsWith('_vocationalTraining');

  List<String> computeVisibleFieldIds() {
    if (_schema == null) return [];
    // Callers that already track their own current-section/page state and
    // hand it here via setRevealedFieldIds (already ordered, already
    // scoped to what's actually mounted) don't need — and, critically,
    // can't correctly get — a second scoping pass through _si: Simple
    // Mode's page navigation keeps ctrl.currentPage/_si in sync with its
    // own section cursor, so intersecting with the _si-based walk below
    // was a no-op there, but VT Wizard mode's own section navigation
    // (VtWizardShell._goToSection) is a plain local setState with no
    // link to _si at all — _si can sit on whatever section it started on
    // while the wizard shows a completely different one, so intersecting
    // revealedFieldIds against sectionIndicesForPage(_si)'s field list
    // could yield nothing (fields from the wrong section) and silently
    // break focusFieldOffset. Trust the caller's own scoping instead.
    final revealed = _revealedFieldIds;
    if (revealed != null) {
      return revealed.where((id) {
        final f = _schema!.getField(id);
        return f != null && isFieldVisible(f);
      }).toList();
    }
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
    return result;
  }

  void focusFieldOffset(int delta) {
    if (_schema == null) return;
    // Always recompute rather than trusting the cached _visibleFieldIds —
    // a value-changing mutator just before this call (e.g. setRadioValue
    // answering a conditional-reveal trigger) already eagerly recomputes
    // and caches _visibleFieldIds itself, but at that instant the widget
    // tree hasn't rebuilt yet, so setRevealedFieldIds still holds the
    // OLD, pre-reveal list — that stale cache satisfies both staleness
    // checks below (non-empty, still contains activeId) and was never
    // invalidated again, so a later Tab off the trigger field silently
    // skipped straight past the field it had just revealed. Recomputing
    // fresh here (well after that rebuild has actually happened) is cheap
    // for section-sized field lists and removes the staleness window.
    _visibleFieldIds = computeVisibleFieldIds();
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
    final vtCell = field == null
        ? null
        : _firstFocusableVtCellId(field, preferFirst: preferFirst);
    if (vtCell != null) {
      _fm!.focus(vtCell);
    } else if (field != null && field.type == 'table') {
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

  // VT tables (both `type: table` and `type: repeatingTable` — see
  // vt_routing.dart's isVtTableTemplate) render through VtSpreadsheetTable/
  // VtRowEditor, whose cells use VtTableDef-synthesized ids (e.g.
  // "s4q1_doctorat_male") — never the field's own schema id, and
  // TableCellEngine (built for ordinary ONEFOP tables) has no vt_* case
  // and returns an empty cell list for every one of them. Landing focus on
  // the raw field id (this function's old fallback for a "table"-typed
  // field with no known cells) attaches to no real widget at all — no VT
  // cell's FocusNode is ever keyed by the bare field id — so crossing a
  // section boundary onto a VT table's first/last unit left the
  // controller's activeId pointing at a node nothing in the tree uses:
  // the page changed correctly, but nothing was actually focused/
  // typeable. Live-reported as "pressing Enter from the last cell of
  // section 3 doesn't reach section 4" (VT4_1, a `type: table` diploma
  // grid) — the same gap exists for every VT table anywhere in the form,
  // both `type: table` and `type: repeatingTable`, in both directions.
  //
  // Resolves to the first (or, entering backward, last) visible cell of
  // the table's first (or last) row — row 0 is always shown regardless of
  // isRoster/progressiveRows (only trailing rows past the last filled one
  // are ever hidden — see vtVisibleRows), so this never needs that full
  // dependency chain, just the same dependsOnKey check vtCellVisible
  // itself uses (duplicated here, not imported, to avoid pulling
  // vt_row_editor.dart's own import of this controller into a cycle —
  // see vt_table_types.dart's own doc comment on why it stays
  // controller-free).
  String? _firstFocusableVtCellId(FieldSchema field,
      {required bool preferFirst}) {
    final spec = field.tableSpec;
    final template = spec?['template'] as String?;
    if (!isVtTableTemplate(template)) return null;
    final def = vtTableDefFor(template!, spec!);
    if (def == null || def.rows.isEmpty || def.cells.isEmpty) return null;
    final row = preferFirst ? def.rows.first : def.rows.last;
    final cellsInOrder = preferFirst ? def.cells : def.cells.reversed.toList();

    bool visible(VtCellDef c) {
      if (c.dependsOnKey == null) return true;
      final sibling = def.cells.firstWhere((o) => o.key == c.dependsOnKey);
      final siblingId = def.cellId(row, sibling);
      final decoded = sibling.decodeBoolean != null
          ? sibling.decodeBoolean!(_data[siblingId])
          : _data[siblingId] as bool?;
      return decoded == true;
    }

    // Prefer a cell kind that actually has a real attached FocusNode
    // (number/text — the only VT cell kinds VtSpreadsheetTable/
    // VtRowEditor ever wire to ctrl.fm.getNode); fall back to any
    // visible, non-computed cell so focus still lands somewhere sane on
    // an all-boolean/radioCode table rather than returning null.
    for (final c in cellsInOrder) {
      if (c.kind != VtCellKind.number && c.kind != VtCellKind.text) continue;
      if (!visible(c)) continue;
      return def.cellId(row, c);
    }
    for (final c in cellsInOrder) {
      if (c.kind == VtCellKind.computed) continue;
      if (!visible(c)) continue;
      return def.cellId(row, c);
    }
    return null;
  }

  void exitTable(String fieldId) {
    // See focusFieldOffset's own comment on why this is unconditional.
    _visibleFieldIds = computeVisibleFieldIds();
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
    // See focusFieldOffset's own comment on why this is unconditional.
    _visibleFieldIds = computeVisibleFieldIds();
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

  void _pruneInvisibleFields() {
    if (_schema == null) return;
    bool changed = false;
    for (final sec in _schema!.sections) {
      for (final fid in sec.fieldIds) {
        final f = _schema!.getField(fid);
        if (f != null && f.dependsOn != null && !f.isVisibleGiven(_data)) {
          if (_data.containsKey(fid) ||
              _tv.containsKey(fid) ||
              _touched.contains(fid)) {
            _data.remove(fid);
            _tv.remove(fid);
            _touched.remove(fid);
            _valCache.remove(fid);
            final c = _ctrl[fid];
            if (c != null && c.text.isNotEmpty) {
              c.text = '';
            }
            changed = true;
          }
        }
      }
    }
    if (changed) {
      _schedRevalidate();
    }
  }

  void setRadioValue(FieldSchema f, String value) {
    _data[f.id] = value;
    _tv[f.id] = value;
    _touched.add(f.id);
    _valCache.remove(f.id);
    _pruneInvisibleFields();
    _visibleFieldIds = computeVisibleFieldIds();
    _schedRevalidate();
    _schedCoherenceCheck();
    notifyListeners();
  }

  // Same bookkeeping as setRadioValue, adapted for a checkbox field's
  // List<String> value — setRawValue (used by both this method's callers
  // before this fix) only writes _data and schedules autosave, so a
  // dependsOn/"contains" field gated on a checkbox answer (e.g. VT6_6
  // depends on VT6_5 contains "Autres/ Others") could go stale after the
  // session's first edit: no touched-state, no validation-cache
  // invalidation, no _visibleFieldIds recompute, and no reliable
  // notifyListeners() to trigger a rebuild at all.
  void setCheckboxValues(FieldSchema f, List<String>? values) {
    if (values == null || values.isEmpty) {
      _data.remove(f.id);
      _tv[f.id] = '';
    } else {
      _data[f.id] = values;
      _tv[f.id] = values.join(', ');
    }
    _touched.add(f.id);
    _valCache.remove(f.id);
    _pruneInvisibleFields();
    _visibleFieldIds = computeVisibleFieldIds();
    _schedRevalidate();
    _schedCoherenceCheck();
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
      // Reset scroll BEFORE the page swap — see _resetScrollBeforePageChange's
      // own doc comment for why this can't be deferred until after
      // notifyListeners() the way it used to be.
      _resetScrollBeforePageChange();
      _si++;
      _visibleFieldIds = computeVisibleFieldIds();
      _persistPosition();
      notifyListeners();
      // Focus only; don't scroll again — the reset above already put the
      // viewport at the new page's top.
      focusFirst(scroll: false);
    }
  }

  void prev() {
    if (_si > 0) {
      _resetScrollBeforePageChange();
      _si--;
      _visibleFieldIds = computeVisibleFieldIds();
      _persistPosition();
      notifyListeners();
      focusFirst(scroll: false);
    }
  }

  // focus/scroll default true so the two existing call sites (submit's
  // jump to a failed page, and the pre-outline-nav Sidebar tap) keep their
  // original behavior unchanged. The vertical navigation's section/
  // subsection jumps (see onefop_section_units.dart's navigateToSection)
  // pass both false: they browse the outline without focusing a field,
  // and do their own single scroll via scrollToUnit afterwards.
  void goto(int page, {bool focus = true, bool scroll = true}) {
    // Leaving the page that failed validation clears the banner; landing
    // on it (e.g. the jump _previewSubmit() does via flagBlockedPage())
    // keeps it, so it shows exactly where the failure happened.
    if (page != _advanceBlockedPage) _advanceBlockedPage = null;
    if (scroll) _resetScrollBeforePageChange();
    _si = page;
    _visibleFieldIds = computeVisibleFieldIds();
    _persistPosition();
    notifyListeners();
    if (focus) focusFirst(scroll: false);
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

  // Called synchronously, BEFORE _si changes and notifyListeners() swaps in
  // the next/previous page's content — not after, and not animated, unlike
  // the old _scrollToTop() this replaces. That old version deferred an
  // animateTo(0) to a postFrameCallback, which only ran *after* the page
  // swap's own frame had already laid out the new page's content. If that
  // new page was shorter than wherever the user had scrolled to in the old
  // one, Flutter's ScrollPosition clamps the still-nonzero offset down to
  // the new (smaller) maxScrollExtent immediately, with no animation, as
  // part of that same layout pass — so the deferred animateTo(0) ended up
  // animating from THAT clamped point, not from where the user actually
  // was. Net effect: an instant jump followed by a short animated scroll
  // on any transition into a shorter page, but a single clean animated
  // scroll on any transition into a page tall enough to keep the old
  // offset valid — the same Suivant/Précédent action looking different
  // depending on the two sections' relative lengths (VT-UX bug report:
  // "inconsistent page animation... between sections" in the VTC wizard).
  //
  // Resetting here instead, while the CURRENT page's own (still-mounted)
  // content is still what the scroll extent is measured against, means 0
  // is already a valid, already-settled position by the time the next
  // page's content lays out — nothing left to clamp, regardless of that
  // page's height, so every transition behaves identically. jumpTo (not
  // animateTo) because there's no next-frame gap left to animate across:
  // this runs in the same synchronous call as the page-index change.
  // Called synchronously, BEFORE _si changes and notifyListeners() swaps in
  // the next/previous page's content — not after, and not animated, unlike
  // the old _scrollToTop() this replaces. That old version deferred an
  // animateTo(0) to a postFrameCallback, which only ran *after* the page
  // swap's own frame had already laid out the new page's content. If that
  // new page was shorter than wherever the user had scrolled to in the old
  // one, Flutter's ScrollPosition clamps the still-nonzero offset down to
  // the new (smaller) maxScrollExtent immediately, with no animation, as
  // part of that same layout pass — so the deferred animateTo(0) ended up
  // animating from THAT clamped point, not from where the user actually
  // was. Net effect: an instant jump followed by a short animated scroll
  // on any transition into a shorter page, but a single clean animated
  // scroll on any transition into a page tall enough to keep the old
  // offset valid — the same Suivant/Précédent action looking different
  // depending on the two sections' relative lengths (VT-UX bug report:
  // "inconsistent page animation... between sections" in the VTC wizard).
  //
  // Resetting here instead, while the CURRENT page's own (still-mounted)
  // content is still what the scroll extent is measured against, means 0
  // is already a valid, already-settled position by the time the next
  // page's content lays out — nothing left to clamp, regardless of that
  // page's height, so every transition behaves identically. jumpTo (not
  // animateTo) because there's no next-frame gap left to animate across:
  // this runs in the same synchronous call as the page-index change.
  void _resetScrollBeforePageChange() {
    if (mainScroll.hasClients) {
      mainScroll.jumpTo(0);
    }
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
      's21q02',
      's21q03',
      's21q04',
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
      's4q03',
      'pp_s4q01',
      'pp_s4q02',
      'pp_s4q03',
      'pp_s4q04',
      'pp_s4q05',
      'pp_s4q06',
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
    _pruneInvisibleFields();
    _visibleFieldIds = computeVisibleFieldIds();
    _schedRevalidate();
    _schedCoherenceCheck();
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
