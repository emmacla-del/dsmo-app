// lib/screens/onefop/onefop_form_controller.dart
// ══════════════════════════════════════════════════════════════
// BUSINESS LOGIC & STATE CONTROLLER  (extracted from v8.3)
// ══════════════════════════════════════════════════════════════

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import '../../core/focus/onefop_form_loader.dart';
import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/schema/form_schema_v2.dart';
import '../../core/focus/schema/navigation_engine.dart';
import '../../core/focus/schema/section_schema.dart';
import '../../core/focus/unified_focus_manager_v2.dart';
import '../../core/focus/compiler/section_title_lookup.dart';
import '../../core/focus/utils/field_validator.dart';
import '../../data/api_client.dart';

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
  const SubmitResult({required this.success, this.error});
}

// ══════════════════════════════════════════════════════════════
class OnefopFormController extends ChangeNotifier {
  // ── Constructor params ────────────────────────────────────
  final EntityType entityType;
  final String? establishmentId;
  final String? companyId; // ← ADD THIS
  final String? quarterCode;
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
  final Map<String, bool> _valid = {};
  Map<String, dynamic>? _submissionSnapshot;
  int _sidebarMode = 2;
  final Map<String, String?> _valCache = {};
  List<String> _visibleFieldIds = [];
  final Map<String, VoidCallback> _ctrlListeners = {};

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

  // ── Autosave ────────────────────────────────────────────────
  Timer? _asTimer;
  DateTime? _lastSaveRequest;
  bool _saveInFlight = false;

  // ── Revalidation debounce ───────────────────────────────────
  Timer? _valTimer;

  // ═══════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  Future<void> initialize() async => _loadSchema();

  @override
  void dispose() {
    _valTimer?.cancel();
    _asTimer?.cancel();
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
      final s =
          await OnefopFormLoader.loadForEntity(entityTypeForSchema(entityType));
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
        final v = _data[id] as int?;
        if (v != null && v != 0) _uGrid[id] = v;
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
  // GRID / TABLE RECALCULATION
  // ═══════════════════════════════════════════════════════════

  void onGridCellChanged(String id, int v) {
    v = v.clamp(0, 10000);
    if (v != 0) {
      _uGrid[id] = v;
    } else {
      _uGrid.remove(id);
    }
    _aGrid[id] = v;
    _data[id] = v;
    schedAS();
    _dirtyT.add(fieldPrefix(id));
    _recalcDirty();
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

  void _recalcDirty() {
    if (_dirtyT.isEmpty) return;
    var w = Map<String, int>.from(_aGrid);
    final tp = Set<String>.from(_dirtyT);
    _dirtyT.clear();
    for (final p in tp) {
      w = TableCellEngine.dispatch(w, p);
    }
    for (final e in w.entries) {
      _data[e.key] = e.value;
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
    scrollToField(id);
  }

  // ═══════════════════════════════════════════════════════════
  // AUTO-SAVE
  // ═══════════════════════════════════════════════════════════

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

  String? errorText(FieldSchema f) {
    return _valCache.putIfAbsent(
          f.id,
          () => FieldValidator.validate(f, _data, touched: _touched),
        ) ??
        'Champ obligatoire';
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

  List<String> missingLabels(SectionSchema s) {
    if (_schema == null) return [];
    return FieldValidator.missingLabels(
      s,
      _schema!,
      _data,
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
    return result;
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
      next();
    } else if (targetIdx < 0 && delta < 0) {
      prev();
    }
  }

  void focusFieldId(String fieldId, {bool preferFirst = true}) {
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
    scrollToField(fieldId);
  }

  void exitTable(String fieldId) {
    if (_visibleFieldIds.isEmpty || !_visibleFieldIds.contains(fieldId)) {
      _visibleFieldIds = computeVisibleFieldIds();
    }
    final fieldIds = _visibleFieldIds;
    final idx = fieldIds.indexOf(fieldId);
    if (idx >= 0 && idx < fieldIds.length - 1) {
      focusFieldId(fieldIds[idx + 1], preferFirst: true);
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

  void scrollToField(String fieldId) {
    final key = blockKeys[fieldId];
    if (key == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = key.currentContext;
      if (ctx == null) return;
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
        alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
      );
    });
  }

  void next() {
    if (_schema == null) return;
    if (!validatePage(_si)) {
      touchAllRequired();
      notifyListeners();
      return;
    }
    if (_si < pageCount - 1) {
      _si++;
      _visibleFieldIds = computeVisibleFieldIds();
      notifyListeners();
      focusFirst();
      _scrollToTop();
    }
  }

  void prev() {
    if (_si > 0) {
      _si--;
      _visibleFieldIds = computeVisibleFieldIds();
      notifyListeners();
      focusFirst();
      _scrollToTop();
    }
  }

  void goto(int page) {
    _si = page;
    _visibleFieldIds = computeVisibleFieldIds();
    notifyListeners();
    focusFirst();
    _scrollToTop();
  }

  void focusFirst() {
    if (_schema == null) return;
    _visibleFieldIds = computeVisibleFieldIds();
    if (_visibleFieldIds.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        focusFieldId(_visibleFieldIds.first, preferFirst: true);
      });
    }
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
      w = TableCellEngine.dispatch(w, p);
    }
    _aGrid = w;

    for (final e in _aGrid.entries) {
      _data[e.key] = e.value;
    }
    for (final e in _htv.entries) {
      if (e.value.isNotEmpty) _data[e.key] = e.value;
    }
    if (_schema != null) {
      for (final f in _schema!.fields) {
        if (f.type != 'table') continue;
        for (final id in TableCellEngine.cellIds(f)) {
          if (!_data.containsKey(id)) _data[id] = 0;
        }
      }
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
  Future<PreviewResult> preview() async {
    final snapshot = collectAndMapData();
    _submissionSnapshot = snapshot;

    try {
      final apiClient = ApiClient();
      final pdfBytes = await apiClient.previewQuestionnaire({
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
      });

      final fn = 'onefop_preview_${DateTime.now().millisecondsSinceEpoch}.pdf';
      return PreviewResult(
          success: true, bytes: Uint8List.fromList(pdfBytes), fileName: fn);
    } catch (e) {
      print('❌ Preview error: $e');
      return PreviewResult(success: false, error: 'Erreur réseau : $e');
    }
  }

// ─────────────────────────────────────────────────────────────
// REPLACE the submit() method with this:
// ─────────────────────────────────────────────────────────────
  Future<SubmitResult> submit() async {
    final snapshot = _submissionSnapshot;
    if (snapshot == null) {
      return const SubmitResult(
          success: false, error: 'Erreur interne : aperçu non disponible');
    }

    try {
      final apiClient = ApiClient();

      // Debug: Check if token exists
      final token = await apiClient.getStoredToken();
      print('🔑 Submit - Token present: ${token != null}');

      await apiClient.submitQuestionnaire({
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
      });

      _submissionSnapshot = null;
      onSave({});
      onSubmitSuccess?.call();
      return const SubmitResult(success: true);
    } catch (e) {
      print('❌ Submit error: $e');
      return SubmitResult(success: false, error: 'Erreur réseau : $e');
    }
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

  String pageLabel(int page) {
    final idxs = sectionIndicesForPage(page);
    if (idxs.isNotEmpty) {
      return kSidebarMeta[_schema!.sections[idxs.first].id]?.label ??
          'Pg ${page + 1}';
    }
    return 'Pg ${page + 1}';
  }

  String sectionTitle(int page) {
    final idxs = sectionIndicesForPage(page);
    if (idxs.isNotEmpty) {
      return SectionTitleLookup.getTitle(_schema!.sections[idxs.first].id);
    }
    return '';
  }

  String fieldLabel(FieldSchema f) {
    if (f.label != null && f.label!.isNotEmpty) return f.label!;
    if (f.instruction != null && f.instruction!.isNotEmpty) {
      return f.instruction!;
    }
    if (f.questionText != null && f.questionText!.isNotEmpty) {
      return f.questionText!;
    }
    return f.id;
  }

  String? dividerLabel(String fieldId) => kDividers[fieldId];
}
