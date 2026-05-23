// lib/screens/onefop/onefop_unified_form_screen_v3.dart
//
// ══════════════════════════════════════════════════════════════
// PIXEL-PERFECT UNIFIED FORM RENDERER  (v8.1 — responsive fix)
//
// CRITICAL FIXES vs v8:
//   • _kDocW 960 → 920 (fits inside 958px containers without overflow)
//   • All fields use ConstrainedBox(maxWidth: _kDocW) instead of
//     SizedBox(width: _kDocW) — fields shrink on narrow screens
//   • Paired columns use Expanded() — never overflow, always fit
//   • Hybrid table text column is responsive via LayoutBuilder
//   • Section body uses LayoutBuilder — respects actual container width
//   • Tables stretch proportionally via GenericSpreadsheetTable fix
// ══════════════════════════════════════════════════════════════

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import '../../core/focus/onefop_form_loader.dart';
import '../../core/focus/schema/form_schema_v2.dart';
import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/schema/section_schema.dart';
import '../../core/focus/unified_focus_manager_v2.dart';
import '../../core/focus/schema/navigation_engine.dart';
import '../../core/focus/renderers/table_renderer.dart';
import '../../core/focus/compiler/section_title_lookup.dart';
import '../../core/focus/utils/table_calculator.dart';
import '../../core/focus/renderers/onefop_layout_constants.dart';
import '../../core/focus/renderers/onefop_section_renderer.dart';
import '../../core/focus/renderers/grid_theme.dart';
import '../../widgets/pdf_viewer_screen.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

const String _kBaseUrl = 'https://dsmo-app-2.onrender.com/api';

// ── Document width ────────────────────────────────────────────
// 920 px is the target max width. On smaller screens, fields shrink
// via ConstrainedBox. On larger screens, they cap at 920 px.
const double _kDocW = 920.0;
const double _kHybridNumW = GridTheme.colWidth; // 60 px
const double _kColGap = 20.0;

// Scroll child width = doc width + horizontal padding on both sides
const double _kScrollChildW = _kDocW + OL.sectionBodyPaddingH * 2;

// ── Sidebar widths ────────────────────────────────────────────
const double _kSidebarFull = 240.0;
const double _kSidebarCollapsed = 56.0;

// ── Harmonised table typography ───────────────────────────────
const TextStyle _kThStyle = TextStyle(
    fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B));
const TextStyle _kTdStyle = TextStyle(
    fontSize: 13, fontWeight: FontWeight.w400, color: Color(0xFF334155));
const TextStyle _kTotStyle = TextStyle(
    fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF2563EB));
const TextStyle _kGrandTotStyle = TextStyle(
    fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E293B));
const double _kNumCellFontSize = 14.0;

// ── Backend mappers ───────────────────────────────────────────
class _Map {
  static int area(String? v) {
    if (v == null) return 0;
    if (v.contains('Urbain')) return 1;
    if (v.contains('Rural')) return 2;
    return 0;
  }

  static int sector(String? v) {
    if (v == null) return 0;
    if (v.contains('Primaire')) return 1;
    if (v.contains('Secondaire')) return 2;
    if (v.contains('Tertiaire')) return 3;
    return 0;
  }

  static int coopType(String? v) {
    if (v == null) return 0;
    if (v.contains('simplifiée')) return 1;
    if (v.contains("conseil d'administration")) return 2;
    if (v.contains('Autre')) return 3;
    return 0;
  }

  static int legalStatus(String? v) {
    if (v == null) return 0;
    if (v.contains('unipersonnelle')) return 1;
    if (v.contains('SARL')) return 2;
    if (v.contains('SA')) return 3;
    if (v.contains('Autres')) return 4;
    return 0;
  }

  static int size(String? v) {
    if (v == null) return 0;
    if (v.contains('TPE')) return 1;
    if (v.contains('GE')) return 4;
    if (v.contains('ME')) return 3;
    if (v.contains('PE')) return 2;
    return 0;
  }

  static int ctdType(String? v) {
    if (v == null) return 0;
    if (v.contains('Commune')) return 2;
    if (v.contains('Région')) return 1;
    return 0;
  }

  static int councilType(String? v) {
    if (v == null) return 0;
    if (v.contains('Arrondissement')) return 1;
    if (v.contains('Urbaine')) return 2;
    return 0;
  }
}

enum EntityType { enterprise, cooperative, ctd, ong }

// ── Phone validation helpers ────────────────────────────────
// Cameroon format: 9 digits, must start with 2 (landline) or 6 (mobile)

bool _isPhoneField(String fieldId) {
  return fieldId.endsWith('_TEL1') || fieldId.endsWith('_TEL2');
}

bool _isValidCameroonPhone(String? value) {
  if (value == null || value.isEmpty) return false;
  // Must be exactly 9 digits
  if (value.length != 9) return false;
  // Must start with 2 or 6
  final first = value[0];
  return first == '2' || first == '6';
}

String? _phoneError(String? value) {
  if (value == null || value.isEmpty) return 'Champ obligatoire';
  if (value.length != 9) return 'Le numéro doit contenir exactement 9 chiffres';
  final first = value[0];
  if (first != '2' && first != '6') {
    return 'Le numéro doit commencer par 2 (fixe) ou 6 (mobile)';
  }
  return null;
}

class _HTDef {
  final List<String> rowKeys;
  final String textSuffix;
  final List<String> rowLabels;
  const _HTDef(
      {required this.rowKeys,
      required this.textSuffix,
      required this.rowLabels});
}

class _FG {
  final String? sub;
  final List<FieldSchema> fields;
  const _FG({required this.sub, required this.fields});
}

const Set<String> _hybridAstIds = {
  'S3Q02_REASON_1_TEXT',
  'S3Q02_REASON_2_TEXT',
  'S3Q02_REASON_3_TEXT',
  'S4Q02_DOMAIN_1_TEXT',
  'S4Q02_DOMAIN_2_TEXT',
  'S4Q02_DOMAIN_3_TEXT',
  'S4Q03_DOMAIN_1_TEXT',
  'S4Q03_DOMAIN_2_TEXT',
  'S4Q03_DOMAIN_3_TEXT',
};

const Set<String> _optionalOverrides = {
  'S0Q03_TEL2',
  'S1Q05_TEL2',
  'COOP_S1Q06_TEL2',
  'CTD_S1Q06_TEL2',
  'ONG_S1Q06_TEL2'
};

class _SM {
  final String lbl;
  final IconData icon;
  const _SM(this.lbl, this.icon);
}

const Map<String, _SM> _sm = {
  'section0': _SM('Répondant', Icons.person_outline),
  'section1': _SM('Entité', Icons.corporate_fare_outlined),
  'section1_cooperative': _SM('Coopérative', Icons.corporate_fare_outlined),
  'section1_enterprise': _SM('Entreprise', Icons.business_outlined),
  'section1_ctd': _SM('CTD', Icons.account_balance_outlined),
  'section1_ong': _SM('ONG', Icons.volunteer_activism_outlined),
  'section2': _SM('Emploi', Icons.work_outline),
  'section3': _SM('Départs', Icons.exit_to_app_outlined),
  'section4': _SM('Formation', Icons.school_outlined),
};

const Map<String, String> _div = {
  'S0Q03': 'Contacts',
  'S1Q04': 'Localisation',
  'S1Q06': 'Coordonnées',
  'S1Q07': 'Activité',
  'S1Q10': 'Structure',
};

Map<String, dynamic> _sanitiseInitialData(Map<String, dynamic> raw) {
  return Map.fromEntries(raw.entries.where((e) {
    final v = e.value;
    if (v == null) return false;
    if (v is String && v.trim().isEmpty) return false;
    return true;
  }));
}

class OnefopUnifiedFormScreenV2 extends StatefulWidget {
  final EntityType entityType;
  final Map<String, dynamic> initialData;
  final void Function(Map<String, dynamic>) onSave;
  final VoidCallback? onCancel;
  final String? userId;
  final VoidCallback? onSubmitSuccess; // ← ADD THIS

  const OnefopUnifiedFormScreenV2({
    super.key,
    required this.entityType,
    required this.initialData,
    required this.onSave,
    this.onCancel,
    this.userId,
    this.onSubmitSuccess, // ← ADD THIS
  });

  @override
  State<OnefopUnifiedFormScreenV2> createState() => _State();
}

// ══════════════════════════════════════════════════════════════
// STICKY SECTION HEADER DELEGATE  (NEW)
// ══════════════════════════════════════════════════════════════
class _StickySectionHeaderDelegate extends SliverPersistentHeaderDelegate {
  final String sectionId;
  final String title;
  final IconData? icon;
  final bool isComplete;

  _StickySectionHeaderDelegate({
    required this.sectionId,
    required this.title,
    this.icon,
    required this.isComplete,
  });

  @override
  double get minExtent => 52.0;
  @override
  double get maxExtent => 52.0;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Center(
      // ← FIX: centre the bar
      child: ConstrainedBox(
        // ← FIX: cap its width
        constraints: const BoxConstraints(maxWidth: _kScrollChildW),
        child: Container(
          decoration: BoxDecoration(
            color: OL.sectionHeaderBg(sectionId),
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(12),
              topRight: Radius.circular(12),
            ),
            border: const Border(
              top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
              left: BorderSide(color: Color(0xFFE2E8F0), width: 1),
              right: BorderSide(color: Color(0xFFE2E8F0), width: 1),
            ),
            boxShadow: overlapsContent
                ? [
                    const BoxShadow(
                      color: Color(0x1A000000),
                      blurRadius: 8,
                      offset: Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: OL.sectionHeaderPaddingH,
            vertical: OL.sectionHeaderPaddingV,
          ),
          child: Row(
            children: [
              if (icon != null) ...[
                Icon(icon, color: Colors.white, size: 18),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Text(title, style: OL.shStyle),
              ),
              if (isComplete)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF70AD47),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check, color: Colors.white, size: 12),
                      SizedBox(width: 4),
                      Text(
                        'Complet',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(20),
                    border:
                        Border.all(color: const Color(0xFFF59E0B), width: 0.5),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.pending, color: Color(0xFFD97706), size: 12),
                      SizedBox(width: 4),
                      Text(
                        'En cours',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFB45309),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _StickySectionHeaderDelegate old) {
    return old.sectionId != sectionId ||
        old.title != title ||
        old.icon != icon ||
        old.isComplete != isComplete;
  }
}

class _State extends State<OnefopUnifiedFormScreenV2> {
  late NavigationEngine _engine;
  late UnifiedFocusManagerV2 _fm;
  FormSchemaV2? _schema;

  late final Map<String, dynamic> _data;
  final Map<String, TextEditingController> _ctrl = {};
  final Map<String, int> _uGrid = {};
  Map<String, int> _aGrid = {};
  final Map<String, String> _tv = {};
  final Map<String, String> _htv = {};
  final Map<String, TextEditingController> _hctrl = {};

  final Set<String> _touched = {};
  bool _dirty = false;
  bool _saving = false;
  Timer? _asTimer;
  final Set<String> _dirtyT = {};
  Timer? _rTimer;
  bool _loading = true;
  String? _err;
  int _si = 0;
  final Map<String, bool> _valid = {};
  Map<String, dynamic>? _submissionSnapshot;
  int _sidebarMode = 2;
  final ScrollController _mainScroll = ScrollController();
  final Map<String, GlobalKey> _blockKeys = {};

  static const Map<String, String> _htColumnHeaders = {
    's3q02': 'Motif / Reason',
    's4q02': 'Compétence / Skill',
    's4q03': 'Domaine / Domain',
  };

  static const Map<String, _HTDef> _ht = {
    's3q02': _HTDef(
      rowKeys: ['reason_1', 'reason_2', 'reason_3'],
      textSuffix: 'text',
      rowLabels: ['Motif 1/Reason 1', 'Motif 2/Reason 2', 'Motif 3/Reason 3'],
    ),
    's4q02': _HTDef(
      rowKeys: ['skill_1', 'skill_2', 'skill_3'],
      textSuffix: 'text',
      rowLabels: [
        'Compétence 1/Skill 1',
        'Compétence 2/Skill 2',
        'Compétence 3/Skill 3'
      ],
    ),
    's4q03': _HTDef(
      rowKeys: ['domain_1', 'domain_2', 'domain_3'],
      textSuffix: 'text',
      rowLabels: [
        'Domaine 1/Domain 1',
        'Domaine 2/Domain 2',
        'Domaine 3/Domain 3'
      ],
    ),
  };

  int get _pageCount => _schema?.sections.length ?? 1;

  List<int> _sectionIndicesForPage(int page) {
    if (_schema == null) return [];
    if (page >= 0 && page < _schema!.sections.length) return [page];
    return [];
  }

  SectionSchema? _primarySection(int page) {
    final idxs = _sectionIndicesForPage(page);
    if (idxs.isEmpty) return null;
    return _schema!.sections[idxs.first];
  }

  @override
  void initState() {
    super.initState();
    _data = _sanitiseInitialData(Map.from(widget.initialData));
    _loadSchema();
  }

  @override
  void dispose() {
    _rTimer?.cancel();
    _asTimer?.cancel();
    _fm.dispose();
    for (final c in _ctrl.values) {
      c.dispose();
    }
    for (final c in _hctrl.values) {
      c.dispose();
    }
    _mainScroll.dispose();
    super.dispose();
  }

  Future<void> _loadSchema() async {
    try {
      final s = await OnefopFormLoader.loadForEntity(_eStr(widget.entityType));
      _schema = s;
      _engine = NavigationEngine(s);
      _fm = UnifiedFocusManagerV2(_engine);

      // ═══════════════════════════════════════════════════════════
      // DEBUG: Log incoming initialData before any processing
      // ═══════════════════════════════════════════════════════════
      debugPrint('🔍 [ONEFOP DEBUG] ===== widget.initialData received =====');
      debugPrint('🔍 [ONEFOP DEBUG] Entity type: ${widget.entityType}');
      debugPrint('🔍 [ONEFOP DEBUG] Total keys: ${widget.initialData.length}');
      for (final entry in widget.initialData.entries.toList()
        ..sort((a, b) => a.key.compareTo(b.key))) {
        debugPrint('🔍 [ONEFOP DEBUG]   ${entry.key} = ${entry.value}');
      }
      debugPrint(
          '🔍 [ONEFOP DEBUG] =================================================');

      _initCtrl();
      _initTV();
      _initGrid();
      _initHybrid();
      _initFN();
      _initKeyH();

      // DEBUG: Log what got into controllers after _initCtrl/_initTV
      debugPrint('🔍 [ONEFOP DEBUG] ===== After _initCtrl/_initTV =====');
      for (final entry in _tv.entries.toList()
        ..sort((a, b) => a.key.compareTo(b.key))) {
        debugPrint('🔍 [ONEFOP DEBUG]   _tv[${entry.key}] = "${entry.value}"');
      }
      debugPrint(
          '🔍 [ONEFOP DEBUG] =================================================');

      for (final sec in s.sections) {
        _valid[sec.id] = false;
      }
      for (final f in s.fields) {
        _blockKeys[f.id] = GlobalKey();
      }
      WidgetsBinding.instance.addPostFrameCallback((_) => _focusFirst());
      if (mounted) setState(() => _loading = false);
    } catch (e, st) {
      debugPrint('schema error: $e\n$st');
      if (mounted) {
        setState(() {
          _err = e.toString();
          _loading = false;
        });
      }
    }
  }

  String _eStr(EntityType t) {
    switch (t) {
      case EntityType.enterprise:
        return 'enterprise';
      case EntityType.cooperative:
        return 'cooperative';
      case EntityType.ctd:
        return 'ctd';
      case EntityType.ong:
        return 'ong';
    }
  }

  void _initCtrl() {
    for (final f in _schema!.fields) {
      if (f.type == 'table' || _hybridAstIds.contains(f.id)) continue;
      final c = TextEditingController(text: _data[f.id]?.toString() ?? '');
      c.addListener(() => _onFC(f.id, c.text));
      _ctrl[f.id] = c;
    }
  }

  void _initTV() {
    for (final f in _schema!.fields) {
      if (f.type == 'table' || _hybridAstIds.contains(f.id)) continue;
      _tv[f.id] = _data[f.id]?.toString() ?? '';
    }
  }

  void _initGrid() {
    for (final f in _schema!.fields) {
      if (f.type != 'table') continue;
      for (final id in _cellIds(f)) {
        final v = _data[id] as int?;
        if (v != null && v != 0) _uGrid[id] = v;
      }
    }
    _aGrid = Map.from(_uGrid);
    if (_uGrid.isNotEmpty) _recalcAll();
  }

  void _initHybrid() {
    for (final e in _ht.entries) {
      for (final rk in e.value.rowKeys) {
        final id = '${e.key}_${rk}_${e.value.textSuffix}';
        _htv[id] = _data[id]?.toString() ?? '';
        _hc(id);
      }
    }
  }

  void _initFN() {
    for (final f in _schema!.fields) {
      _fm.node(f.id);
    }
  }

  void _initKeyH() {
    for (final f in _schema!.fields) {
      if (f.type == 'table' || _hybridAstIds.contains(f.id)) continue;
      _fm.node(f.id).onKeyEvent = (n, e) => _handleFieldKey(n, e, f);
    }
  }

  List<String> _cellIds(FieldSchema f) {
    final spec = f.tableSpec;
    if (spec == null) return [];
    final tpl = spec['template'] as String? ?? '';
    final pfx = (spec['prefix'] as String? ?? f.id).toLowerCase();
    switch (tpl) {
      case 'csp_gender_age_table':
      case 'csp_table':
        return _cGA(pfx);
      case 'diploma_gender_age_table':
      case 'diploma_table':
        return _cDip(pfx);
      case 'csp_status_gender_table':
      case 'disability_table':
      case 'vulnerable_table':
      case 'vulnerable_csp_rows_table':
        return _cSG(pfx, ['cadres', 'foremen', 'workers']);
      case 'vulnerable_named_rows_table':
        return _cSG(pfx, ['deplaces_internes', 'refugies', 'orphelins']);
      case 'departure_table':
        return _cDep(pfx);
      case 'dismissal_unemployment_table':
        return _cDU(pfx);
      case 'first_time_workers_table':
        return _cFTW(pfx);
      case 'internship_table':
        return _cInt(pfx);
      case 'reasons_table':
        return _cHN(pfx, ['reason_1', 'reason_2', 'reason_3']);
      case 'skills_table':
        return _cHN(pfx, ['skill_1', 'skill_2', 'skill_3']);
      case 'training_table':
        return _cHN(pfx, ['domain_1', 'domain_2', 'domain_3']);
      default:
        return [];
    }
  }

  List<String> _cGA(String p) {
    const r = ['cadres', 'foremen', 'workers'];
    const g = ['male', 'female'];
    const a = ['15_24', '25_34', '35_plus'];
    return [
      for (final rv in r)
        for (final gv in g)
          for (final av in a) '${p}_${rv}_${gv}_$av'
    ];
  }

  List<String> _cDip(String p) {
    const d = [
      'cep',
      'bepc',
      'probatoire',
      'bac',
      'bts',
      'licence',
      'maitrise',
      'master',
      'dqp',
      'cqp',
      'autres',
      'sans_diplome'
    ];
    const g = ['male', 'female'];
    const a = ['15_24', '25_34', '35_plus'];
    return [
      for (final dv in d)
        for (final gv in g)
          for (final av in a) '${p}_${dv}_${gv}_$av'
    ];
  }

  List<String> _cSG(String p, List<String> rows) {
    const s = ['permanent', 'temporary'];
    const g = ['male', 'female'];
    return [
      for (final r in rows)
        for (final sv in s)
          for (final gv in g) '${p}_${r}_${sv}_$gv'
    ];
  }

  List<String> _cDep(String p) {
    const r = ['cadres', 'foremen', 'workers'];
    const t = ['dismissal', 'resignation', 'retirement', 'other'];
    const g = ['male', 'female'];
    return [
      for (final rv in r)
        for (final tv in t)
          for (final gv in g) '${p}_${rv}_${tv}_$gv'
    ];
  }

  List<String> _cDU(String p) {
    const r = ['cadres', 'foremen', 'workers'];
    const t = ['dismissal', 'technical_unemployment'];
    const g = ['male', 'female'];
    return [
      for (final rv in r)
        for (final tv in t)
          for (final gv in g) '${p}_${rv}_${tv}_$gv'
    ];
  }

  List<String> _cFTW(String p) {
    const c = ['permanent', 'temporary'];
    const r = ['cadres', 'foremen', 'workers'];
    const g = ['male', 'female'];
    const a = ['15_24', '25_34', '35_plus'];
    return [
      for (final cv in c)
        for (final rv in r)
          for (final gv in g)
            for (final av in a) '${p}_${cv}_${rv}_${gv}_$av'
    ];
  }

  List<String> _cInt(String p) {
    const r = ['vacation', 'academic', 'professional', 'pre_employment'];
    const g = ['male', 'female'];
    return [
      for (final rv in r)
        for (final gv in g) '${p}_${rv}_$gv'
    ];
  }

  List<String> _cHN(String p, List<String> rks) {
    const g = ['male', 'female'];
    return [
      for (final r in rks)
        for (final gv in g) '${p}_${r}_$gv'
    ];
  }

  static const Set<String> _twoTokenPrefixes = {'s22q05_ent', 's22q05_oth'};

  String _pfx(String id) {
    for (final p in _twoTokenPrefixes) {
      if (id.startsWith('${p}_')) return p;
    }
    return id.split('_').first;
  }

  void _onGC(String id, int v) {
    // ENFORCEMENT D: Clamp table cell values to reasonable bounds
    if (v < 0) v = 0;
    if (v > 10000) v = 10000;

    if (v != 0) {
      _uGrid[id] = v;
    } else {
      _uGrid.remove(id);
    }
    _aGrid[id] = v;
    _data[id] = v;
    _schedAS();
    _dirtyT.add(_pfx(id));

    // 🔥 FIX: Immediate rebuild so totals recalc right away
    _rTimer?.cancel();
    _rTimer = Timer(Duration.zero, () {
      // ← was 40ms, now 0ms
      if (mounted) _recalcDirty();
    });
  }

  TextEditingController _hc(String id) {
    return _hctrl.putIfAbsent(id, () {
      final c = TextEditingController(text: _htv[id] ?? '');
      c.addListener(() {
        _htv[id] = c.text;
        _data[id] = c.text;
        _schedAS();
        if (mounted) setState(() {});
      });
      if (!_data.containsKey(id)) _data[id] = '';
      return c;
    });
  }

  void _schedAS() {
    if (!_dirty && mounted) setState(() => _dirty = true);
    _asTimer?.cancel();
    _asTimer = Timer(const Duration(seconds: 2), _doAS);
  }

  void _doAS() {
    if (!mounted) return;
    setState(() {
      _saving = true;
      _dirty = false;
    });
    widget.onSave(Map.from(_data));
    Future.delayed(const Duration(milliseconds: 600), () {
      if (mounted) setState(() => _saving = false);
    });
  }

  void _recalcAll() {
    if (_schema == null) return;
    for (final f in _schema!.fields) {
      if (f.type != 'table') continue;
      final sp = f.tableSpec;
      if (sp == null) continue;
      final rawPfx = (sp['prefix'] as String? ?? f.id).toLowerCase();
      _dirtyT.add(_pfx('${rawPfx}_x'));
    }
    _recalcDirty();
  }

  void _recalcDirty() {
    if (_dirtyT.isEmpty) return;
    var w = Map<String, int>.from(_aGrid);
    final tp = Set<String>.from(_dirtyT);
    _dirtyT.clear();
    for (final p in tp) {
      w = _dispatch(w, p);
    }
    for (final e in w.entries) {
      _data[e.key] = e.value;
    }
    if (mounted) setState(() => _aGrid = w);
  }

  Map<String, int> _dispatch(Map<String, int> c, String p) {
    Map<String, int> ga(String x) => TableCalculator.recalculateCspGenderAge(
        current: c,
        prefix: x,
        rows: ['cadres', 'foremen', 'workers'],
        genders: ['male', 'female', 'total'],
        ageBands: ['15_24', '25_34', '35_plus']);
    Map<String, int> sg(String x, List<String> r) =>
        TableCalculator.recalculateCspStatusGender(
            current: c,
            prefix: x,
            rows: r,
            statuses: ['permanent', 'temporary'],
            genders: ['male', 'female', 'total']);
    switch (p) {
      case 's21q01':
      case 's22q01':
      case 's22q02':
      case 's23q01':
        return ga(p);
      case 's22q03':
        return TableCalculator.recalculateCspGenderAge(
            current: c,
            prefix: p,
            rows: [
              'cep',
              'bepc',
              'probatoire',
              'bac',
              'bts',
              'licence',
              'maitrise',
              'master',
              'dqp',
              'cqp',
              'autres',
              'sans_diplome'
            ],
            genders: [
              'male',
              'female',
              'total'
            ],
            ageBands: [
              '15_24',
              '25_34',
              '35_plus'
            ]);
      case 's22q04':
        return sg(p, ['cadres', 'foremen', 'workers']);
      case 's22q05_ent':
        return sg(p, ['deplaces_internes', 'refugies', 'orphelins']);
      case 's22q05_oth':
        return sg(p, ['cadres', 'foremen', 'workers']);
      case 's23q02':
        return TableCalculator.recalculateFirstTimeWorkers(
            current: c,
            prefix: p,
            contractTypes: ['permanent', 'temporary'],
            rows: ['cadres', 'foremen', 'workers'],
            genders: ['male', 'female', 'total'],
            ageBands: ['15_24', '25_34', '35_plus']);
      case 's3q01':
        return TableCalculator.recalculateDeparture(
            current: c,
            prefix: p,
            rows: [
              'cadres',
              'foremen',
              'workers'
            ],
            departureTypes: [
              'dismissal',
              'resignation',
              'retirement',
              'other',
              'ensemble'
            ],
            genders: [
              'male',
              'female',
              'total'
            ]);
      case 's3q02':
        return TableCalculator.recalculateReasons(
            current: c,
            prefix: p,
            reasons: ['reason_1', 'reason_2', 'reason_3'],
            genders: ['male', 'female', 'total']);
      case 's3q03':
        return TableCalculator.recalculateDismissalUnemployment(
            current: c,
            prefix: p,
            rows: ['cadres', 'foremen', 'workers'],
            types: ['dismissal', 'technical_unemployment', 'total'],
            genders: ['male', 'female', 'total']);
      case 's4q01':
        return TableCalculator.recalculateInternship(
            current: c,
            prefix: p,
            rows: ['vacation', 'academic', 'professional', 'pre_employment'],
            genders: ['male', 'female', 'total']);
      case 's4q02':
        return TableCalculator.recalculateSkillsOrTraining(
            current: c,
            prefix: p,
            rows: ['skill_1', 'skill_2', 'skill_3'],
            genders: ['male', 'female', 'total']);
      case 's4q03':
        return TableCalculator.recalculateSkillsOrTraining(
            current: c,
            prefix: p,
            rows: ['domain_1', 'domain_2', 'domain_3'],
            genders: ['male', 'female', 'total']);
      default:
        return c;
    }
  }

  void _onFC(String id, String v) {
    if (_schema == null) return;
    final f = _schema!.getField(id);
    if (f == null) return;
    // Phone enforcement: strip non-digits, enforce max 9
    String cleanValue = v;
    if (f.type == 'tel') {
      cleanValue = v.replaceAll(RegExp(r'[^0-9]'), '');
      if (cleanValue.length > 9) cleanValue = cleanValue.substring(0, 9);
      // Auto-correct first digit to valid Cameroon prefix if user types wrong start
      if (cleanValue.isNotEmpty &&
          cleanValue[0] != '2' &&
          cleanValue[0] != '6') {
        // Don't auto-correct, let validation catch it
      }
    }
    _data[id] =
        f.type == 'number' ? (int.tryParse(cleanValue) ?? 0) : cleanValue;
    _tv[id] = cleanValue;
    // Update controller text if we cleaned it (so UI stays in sync)
    if (cleanValue != v && _ctrl.containsKey(id)) {
      final c = _ctrl[id]!;
      c.text = cleanValue;
      c.selection = TextSelection.collapsed(offset: cleanValue.length);
    }
    _schedAS();
    _revalidateCurrentPage();
    setState(() {});
    _scrollToBlock(id);
  }

  void _revalidateCurrentPage() {
    for (final idx in _sectionIndicesForPage(_si)) {
      final s = _schema!.sections[idx];
      _valid[s.id] = _vSec(s);
    }
  }

  void _onBlur(String id) {
    if (!_touched.contains(id)) setState(() => _touched.add(id));
  }

// ── Email validation helper ────────────────────────────────

  bool _isValidEmail(String? value) {
    if (value == null || value.isEmpty) return false;
    final emailRegex =
        RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    return emailRegex.hasMatch(value);
  }

// ── Year validation helper ──────────────────────────────────

  bool _isValidYear(String? value) {
    if (value == null || value.isEmpty) return false;
    final year = int.tryParse(value);
    if (year == null) return false;
    final currentYear = DateTime.now().year;
    return year >= 1900 && year <= currentYear;
  }

  // ← ADD THIS RIGHT HERE
  bool _isYearField(FieldSchema f) {
    return f.type == 'number' &&
        (f.id.toLowerCase().contains('year') ||
            f.id == 'COOP_S1Q03' ||
            f.id == 'CTD_S1Q03' ||
            f.id == 'ONG_S1Q03');
  }

  bool _hasErr(FieldSchema f) {
    if (_optionalOverrides.contains(f.id)) return false;
    if (!f.required || !_touched.contains(f.id)) return false;
    final v = _data[f.id];
    if (v == null || v.toString().isEmpty) return true;
    // Phone validation: Cameroon = 9 digits, starts with 2 or 6
    if (f.type == 'tel' && !_isValidCameroonPhone(v.toString())) return true;
    // Email validation
    if (f.type == 'email' && !_isValidEmail(v.toString())) return true;
    // Year validation for creation year fields
    if (_isYearField(f) && !_isValidYear(v.toString())) return true;
    // Conditional validation: if field depends on another and is visible, it must be filled
    if (f.dependsOn != null && f.dependsValue != null) {
      if (_data[f.dependsOn] == f.dependsValue &&
          (v == null || v.toString().isEmpty)) {
        return true;
      }
    }
    return false;
  }

  String _errorText(FieldSchema f) {
    final v = _data[f.id]?.toString();
    if (f.type == 'tel') {
      final err = _phoneError(v);
      if (err != null) return err;
    }
    if (f.type == 'email') {
      if (v == null || v.isEmpty) return 'Champ obligatoire';
      return 'Veuillez entrer une adresse e-mail valide (ex: contact@entreprise.com)';
    }
    // AFTER
    if (_isYearField(f)) {
      if (v == null || v.isEmpty) return 'Champ obligatoire';
      if (int.tryParse(v) == null) {
        return 'Veuillez entrer une année valide (ex: 1998)';
      }
      final year = int.parse(v);
      final currentYear = DateTime.now().year;
      if (year < 1900) return "L'année doit être ≥ 1900";
      if (year > currentYear) return "L'année doit être ≤ $currentYear";
    }
    if (f.dependsOn != null && f.dependsValue != null) {
      if (_data[f.dependsOn] == f.dependsValue && (v == null || v.isEmpty)) {
        return 'Champ obligatoire (conditionnel)';
      }
    }
    return 'Champ obligatoire';
  }

  void _scrollToBlock(String fieldId) {
    final key = _blockKeys[fieldId];
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

  bool _vSec(SectionSchema s) {
    if (_schema == null) return true;
    for (final id in s.fieldIds) {
      final f = _schema!.getField(id);
      if (f == null ||
          !f.required ||
          !_vis(f) ||
          f.type == 'table' ||
          _hybridAstIds.contains(f.id) ||
          _optionalOverrides.contains(f.id)) {
        continue;
      }
      final v = _data[id];
      if (v == null || v.toString().isEmpty) return false;
      if (f.type == 'tel' && !_isValidCameroonPhone(v.toString())) return false;
      if (_isYearField(f) && !_isValidYear(v.toString())) return false;
    }
    return true;
  }

  bool _vPage(int page) {
    return _sectionIndicesForPage(page)
        .every((i) => _vSec(_schema!.sections[i]));
  }

  List<String> _missing(SectionSchema s) {
    if (_schema == null) return [];
    final out = <String>[];
    for (final id in s.fieldIds) {
      final f = _schema!.getField(id);
      if (f == null ||
          !f.required ||
          !_vis(f) ||
          f.type == 'table' ||
          _hybridAstIds.contains(f.id) ||
          _optionalOverrides.contains(f.id)) {
        continue;
      }
      final v = _data[id];
      if (v == null || v.toString().isEmpty) out.add(_lbl(f));
    }
    return out;
  }

  bool _vAllPages() {
    if (_schema == null) return false;
    for (int p = 0; p < _pageCount; p++) {
      if (!_vPage(p)) return false;
    }
    return true;
  }

  int _firstFailingPage() {
    for (int p = 0; p < _pageCount; p++) {
      if (!_vPage(p)) return p;
    }
    return -1;
  }

  List<String> _visiblePageFieldIds() {
    if (_schema == null) return [];
    final result = <String>[];
    for (final idx in _sectionIndicesForPage(_si)) {
      for (final id in _schema!.sections[idx].fieldIds) {
        if (_hybridAstIds.contains(id)) continue;
        final f = _schema!.getField(id);
        if (f == null) continue;
        if (!_vis(f)) continue;
        result.add(id);
      }
    }
    return result;
  }

  void _focusFieldOffset(int delta) {
    if (_schema == null) return;
    final fieldIds = _visiblePageFieldIds();
    final activeId = _fm.activeId;
    if (activeId == null) return;
    String currentFieldId = activeId;
    for (final fid in fieldIds) {
      final field = _schema!.getField(fid);
      if (field != null && field.type == 'table') {
        if (_cellIds(field).contains(activeId)) {
          currentFieldId = fid;
          break;
        }
      }
    }
    final idx = fieldIds.indexOf(currentFieldId);
    if (idx < 0) return;
    final targetIdx = idx + delta;
    if (targetIdx >= 0 && targetIdx < fieldIds.length) {
      _focusFieldId(fieldIds[targetIdx], preferFirst: delta > 0);
    } else if (targetIdx >= fieldIds.length && delta > 0) {
      _next();
    } else if (targetIdx < 0 && delta < 0) {
      _prev();
    }
  }

  void _focusFieldId(String fieldId, {bool preferFirst = true}) {
    final field = _schema?.getField(fieldId);
    if (field != null && field.type == 'table') {
      final cells = _cellIds(field);
      if (cells.isNotEmpty) {
        _fm.focus(preferFirst ? cells.first : cells.last);
      } else {
        _fm.focus(fieldId);
      }
    } else {
      _fm.focus(fieldId);
    }
    _scrollToBlock(fieldId);
  }

  void _exitTable(String fieldId) {
    final fieldIds = _visiblePageFieldIds();
    final idx = fieldIds.indexOf(fieldId);
    if (idx >= 0 && idx < fieldIds.length - 1) {
      _focusFieldId(fieldIds[idx + 1], preferFirst: true);
    } else {
      _next();
    }
  }

  void _exitTablePrevious(String fieldId) {
    final fieldIds = _visiblePageFieldIds();
    final idx = fieldIds.indexOf(fieldId);
    if (idx > 0) {
      _focusFieldId(fieldIds[idx - 1], preferFirst: false);
    } else {
      _prev();
    }
  }

  KeyEventResult _handleFieldKey(FocusNode n, KeyEvent e, FieldSchema f) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    final kb = HardwareKeyboard.instance;
    if (f.type == 'radio') {
      final opts = f.options ?? [];
      if (opts.isNotEmpty) {
        final cur = _data[f.id] as String?;
        final idx = opts.indexOf(cur ?? '');
        if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowLeft)) {
          final ni = idx > 0 ? idx - 1 : opts.length - 1;
          _setRadioValue(f, opts[ni]);
          return KeyEventResult.handled;
        }
        if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowRight)) {
          final ni = idx >= 0 && idx < opts.length - 1 ? idx + 1 : 0;
          _setRadioValue(f, opts[ni]);
          return KeyEventResult.handled;
        }
      }
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowUp)) {
      _focusFieldOffset(-1);
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowDown)) {
      _focusFieldOffset(1);
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.enter)) {
      _onBlur(f.id);
      _focusFieldOffset(1);
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.tab)) {
      _onBlur(f.id);
      if (kb.isShiftPressed) {
        _focusFieldOffset(-1);
      } else {
        _focusFieldOffset(1);
      }
      return KeyEventResult.handled;
    }
    return _fm.handleKey(n, e);
  }

  void _setRadioValue(FieldSchema f, String value) {
    _data[f.id] = value;
    _tv[f.id] = value;
    _touched.add(f.id);
    _revalidateCurrentPage();
    setState(() {});
  }

  void _next() {
    if (_schema == null) return;
    if (!_vPage(_si)) {
      for (final idx in _sectionIndicesForPage(_si)) {
        for (final id in _schema!.sections[idx].fieldIds) {
          final f = _schema!.getField(id);
          if (f != null &&
              f.required &&
              _vis(f) &&
              !_optionalOverrides.contains(f.id)) {
            _touched.add(id);
          }
        }
      }
      setState(() {});
      _snack('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (_si < _pageCount - 1) {
      setState(() => _si++);
      _focusFirst();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_mainScroll.hasClients) {
          _mainScroll.animateTo(0,
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeOut);
        }
      });
    }
  }

  void _prev() {
    if (_si > 0) {
      setState(() => _si--);
      _focusFirst();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_mainScroll.hasClients) {
          _mainScroll.animateTo(0,
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeOut);
        }
      });
    }
  }

  void _goto(int page) {
    setState(() => _si = page);
    _focusFirst();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_mainScroll.hasClients) {
        _mainScroll.animateTo(0,
            duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  void _focusFirst() {
    if (_schema == null) return;
    final visible = _visiblePageFieldIds();
    if (visible.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _focusFieldId(visible.first, preferFirst: true);
      });
    }
  }

  void _snack(String m) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(m, style: const TextStyle(fontSize: 14)),
      backgroundColor: const Color(0xFFCC0000),
      behavior: SnackBarBehavior.floating,
      margin: const EdgeInsets.all(16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      duration: const Duration(seconds: 2),
    ));
  }

  bool _vis(FieldSchema f) {
    if (f.dependsOn != null && f.dependsOn!.isNotEmpty) {
      if (_data[f.dependsOn] != f.dependsValue) return false;
    }
    return true;
  }

  bool _isDesktop() => MediaQuery.of(context).size.width >= OL.pageWidth;
  bool _isSimpleSection(String sectionId) =>
      sectionId == 'section0' || sectionId.startsWith('section1_');

  bool _isBlockFocused(List<String> fieldIds) {
    final activeId = _fm.activeId;
    if (activeId == null) return false;
    for (final id in fieldIds) {
      if (id == activeId) return true;
      final f = _schema?.getField(id);
      if (f != null && f.type == 'table') {
        if (_cellIds(f).contains(activeId)) return true;
      }
    }
    return false;
  }

  // ══════════════════════════════════════════════════════════════
  // FIELD RENDERERS — MODERN UI (responsive width fixes)
  // ══════════════════════════════════════════════════════════════

  Widget _lw(FieldSchema f) {
    String label = _lbl(f);
    final currentSectionId = _primarySection(_si)?.id ?? '';
    final isSimple = _isSimpleSection(currentSectionId);
    if (isSimple &&
        f.paperCode != null &&
        f.paperCode!.isNotEmpty &&
        !label.startsWith(f.paperCode!)) {
      label = '${f.paperCode} - $label';
    }
    return OnefopFieldLabel(
        label: label,
        required: f.required,
        optional: _optionalOverrides.contains(f.id));
  }

  Widget _errRow(String m) => Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 14, color: Color(0xFFE24B4A)),
            const SizedBox(width: 6),
            Text(m,
                style: const TextStyle(fontSize: 12, color: Color(0xFFA32D2D))),
          ],
        ),
      );

  // ── CRITICAL FIX: ConstrainedBox instead of SizedBox ─────────
  // This lets fields shrink on narrow screens instead of overflowing.
  Widget _simpleF(FieldSchema f) {
    final c = _ctrl[f.id]!;
    final fn = _fm.getNode(f.id);
    final e = _hasErr(f);

    return Padding(
      padding: const EdgeInsets.only(bottom: OL.questionGapV),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _kDocW),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _lw(f),
            const SizedBox(height: OL.labelGapV),
            ListenableBuilder(
              listenable: fn,
              builder: (ctx, _) => TextFormField(
                controller: c,
                focusNode: fn,
                keyboardType: _kt(f.type),
                textInputAction: TextInputAction.next,
                inputFormatters: [
                  if (f.type == 'number')
                    FilteringTextInputFormatter.digitsOnly,
                  if (_isYearField(f)) LengthLimitingTextInputFormatter(4),
                  if (f.type == 'tel') ...[
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(9),
                  ],
                ],
                style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
                decoration: _modernInputDeco(
                    focused: fn.hasFocus,
                    hasError: e,
                    hint: f.type == 'number' ? '0' : null),
                onTapOutside: (_) => _onBlur(f.id),
                onFieldSubmitted: (_) {
                  _onBlur(f.id);
                  _focusFieldOffset(1);
                },
              ),
            ),
            if (e) _errRow(_errorText(f)),
          ],
        ),
      ),
    );
  }

  Widget _simpleFW(FieldSchema f, double w) {
    final c = _ctrl[f.id]!;
    final fn = _fm.getNode(f.id);
    final e = _hasErr(f);

    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          _lw(f),
          const SizedBox(height: OL.labelGapV),
          ListenableBuilder(
            listenable: fn,
            builder: (ctx, _) => TextFormField(
              controller: c,
              focusNode: fn,
              keyboardType: _kt(f.type),
              textInputAction: TextInputAction.next,
              inputFormatters: [
                if (f.type == 'number') FilteringTextInputFormatter.digitsOnly,
                if (f.type == 'tel') ...[
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(9),
                ],
              ],
              style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
              decoration: _modernInputDeco(
                  focused: fn.hasFocus,
                  hasError: e,
                  hint: f.type == 'number' ? '0' : null),
              onTapOutside: (_) => _onBlur(f.id),
              onFieldSubmitted: (_) {
                _onBlur(f.id);
                _focusFieldOffset(1);
              },
            ),
          ),
          if (e) _errRow(_errorText(f)),
        ],
      ),
    );
  }

  Widget _radioF(FieldSchema f) {
    final opts = f.options ?? [];
    final cur = _data[f.id] as String?;
    final e = _hasErr(f);
    final horizontal = opts.length == 2;

    return Padding(
      padding: const EdgeInsets.only(bottom: OL.questionGapV),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _kDocW),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _lw(f),
            const SizedBox(height: 10),
            Focus(
              focusNode: _fm.getNode(f.id),
              child: ListenableBuilder(
                listenable: _fm.getNode(f.id),
                builder: (context, _) {
                  final optWidgets = opts
                      .map((o) => _RadioOpt(
                            label: o,
                            isSelected: cur == o,
                            onTap: () {
                              _fm.focus(f.id);
                              _setRadioValue(f, o);
                            },
                          ))
                      .toList();

                  if (horizontal) {
                    return Row(
                      children:
                          optWidgets.map((w) => Expanded(child: w)).toList(),
                    );
                  }
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (int i = 0; i < optWidgets.length; i++) ...[
                        optWidgets[i],
                        if (i < optWidgets.length - 1)
                          const SizedBox(height: 8),
                      ],
                    ],
                  );
                },
              ),
            ),
            if (e) ...[
              const SizedBox(height: 6),
              _errRow('Veuillez sélectionner une option'),
            ],
          ],
        ),
      ),
    );
  }

  Widget _selectF(FieldSchema f) {
    final opts = f.options ?? [];
    final cur = _data[f.id] as String?;
    final e = _hasErr(f);

    return Padding(
      padding: const EdgeInsets.only(bottom: OL.questionGapV),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _kDocW),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _lw(f),
            const SizedBox(height: OL.labelGapV),
            Focus(
              focusNode: _fm.getNode(f.id),
              child: DropdownButtonFormField<String>(
                initialValue: cur,
                hint: const Text('Sélectionner',
                    style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
                isExpanded: true,
                style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
                items: opts
                    .map((o) => DropdownMenuItem(
                          value: o,
                          child: Text(o,
                              style: const TextStyle(
                                  fontSize: 14, color: Color(0xFF1E293B))),
                        ))
                    .toList(),
                onChanged: (v) {
                  _data[f.id] = v;
                  _tv[f.id] = v ?? '';
                  _touched.add(f.id);
                  _revalidateCurrentPage();
                  setState(() {});
                  _fm.focusNext();
                },
                decoration: _modernDropdownDeco(e),
              ),
            ),
            if (e && (cur == null || cur.isEmpty))
              _errRow('Veuillez sélectionner une option'),
          ],
        ),
      ),
    );
  }

  Widget _selectFW(FieldSchema f, double w) {
    final opts = f.options ?? [];
    final cur = _data[f.id] as String?;
    final e = _hasErr(f);

    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          _lw(f),
          const SizedBox(height: OL.labelGapV),
          Focus(
            focusNode: _fm.getNode(f.id),
            child: DropdownButtonFormField<String>(
              initialValue: cur,
              hint: const Text('Sélectionner',
                  style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
              isExpanded: true,
              style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
              items: opts
                  .map((o) => DropdownMenuItem(
                        value: o,
                        child: Text(o,
                            style: const TextStyle(
                                fontSize: 14, color: Color(0xFF1E293B))),
                      ))
                  .toList(),
              onChanged: (v) {
                _data[f.id] = v;
                _tv[f.id] = v ?? '';
                _touched.add(f.id);
                _revalidateCurrentPage();
                setState(() {});
                _fm.focusNext();
              },
              decoration: _modernDropdownDeco(e),
            ),
          ),
          if (e && (cur == null || cur.isEmpty))
            _errRow('Veuillez sélectionner une option'),
        ],
      ),
    );
  }

  InputDecoration _modernInputDeco(
      {required bool focused, required bool hasError, String? hint}) {
    return InputDecoration(
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      filled: true,
      fillColor: hasError ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
      hintText: hint,
      hintStyle: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
      border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1)),
      enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
              color:
                  hasError ? const Color(0xFFE24B4A) : const Color(0xFFE2E8F0),
              width: 1)),
      focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF4472C4), width: 2)),
      errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE24B4A), width: 1)),
    );
  }

  InputDecoration _modernDropdownDeco(bool hasError) => InputDecoration(
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        filled: true,
        fillColor: hasError ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(
                color: hasError
                    ? const Color(0xFFE24B4A)
                    : const Color(0xFFE2E8F0),
                width: 1)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF4472C4), width: 2)),
      );

  // ══════════════════════════════════════════════════════════════
  // HYBRID TABLE — responsive text column
  // ══════════════════════════════════════════════════════════════

  Widget _hybridT(FieldSchema f) {
    final sp = f.tableSpec!;
    final pfx = (sp['prefix'] as String).toLowerCase();
    final def = _ht[pfx];
    if (def == null) return const SizedBox.shrink();

    final allCells = [
      for (final rk in def.rowKeys) ...[
        '${pfx}_${rk}_male',
        '${pfx}_${rk}_female',
      ],
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        OnefopQuestionHeader(
          paperCode: f.paperCode,
          questionText: f.questionText ?? f.label,
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: OL.questionGapV),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final availableW = constraints.maxWidth;
              return _buildHybridTable(
                pfx,
                def,
                _htColumnHeaders[pfx] ?? '', // short column header
                allCells,
                f.id,
                availableW,
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildHybridTable(
    String pfx,
    _HTDef def,
    String tableLabel,
    List<String> allCells,
    String fieldId,
    double availableWidth,
  ) {
    const nc = _kHybridNumW; // 60
    const double outerBorder =
        1.0; // ClipRRect Container border (hardcoded below)

    // Reserve space for BOTH border layers: outer container (2px) + row borders (2px)
    final effectiveWidth =
        availableWidth - 2 * outerBorder - 2 * OL.borderWidth;
    final tc = max(200.0, effectiveWidth - 3 * nc);

    // Scroll detection must include the outer border too
    final totalTableWidth = tc + 3 * nc + 2 * OL.borderWidth + 2 * outerBorder;

    Widget headerRow = Container(
      height: OL.headerRowHeight,
      decoration: BoxDecoration(
        color: OL.tableHdrBg,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(12),
          topRight: Radius.circular(12),
        ),
        border: Border.all(color: OL.borderColor, width: OL.borderWidth),
      ),
      child: Row(children: [
        SizedBox(
          width: tc,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Text(tableLabel,
                style: _kThStyle, overflow: TextOverflow.ellipsis),
          ),
        ),
        for (final col in ['Homme / Male', 'Femme / Female', 'Total'])
          Container(
            width: nc,
            height: OL.headerRowHeight,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              border: Border(
                  left:
                      BorderSide(color: OL.borderColor, width: OL.borderWidth)),
            ),
            child: Text(col, style: _kThStyle),
          ),
      ]),
    );

    final dataRows = <Widget>[];
    for (int i = 0; i < def.rowKeys.length; i++) {
      final rk = def.rowKeys[i];
      final tid = '${pfx}_${rk}_${def.textSuffix}';
      final mid = '${pfx}_${rk}_male';
      final fid = '${pfx}_${rk}_female';
      final tot = _aGrid['${pfx}_${rk}_total'] ?? 0;
      dataRows.add(_hybridDataRow(
        index: i,
        tc: tc,
        nc: nc,
        tid: tid,
        mid: mid,
        fid: fid,
        tot: tot,
        rowLabel: def.rowLabels[i],
        isEven: i % 2 == 0,
        allCells: allCells,
        fieldId: fieldId,
      ));
    }

    int tm = 0, tf = 0, tt = 0;
    for (final k in def.rowKeys) {
      tm += _aGrid['${pfx}_${k}_male'] ?? 0;
      tf += _aGrid['${pfx}_${k}_female'] ?? 0;
      tt += _aGrid['${pfx}_${k}_total'] ?? 0;
    }

    Widget grandTotalRow = Container(
      height: OL.rowHeight,
      decoration: BoxDecoration(
        color: OL.grandTotalBg,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(12),
          bottomRight: Radius.circular(12),
        ),
        border: Border.all(color: OL.borderColor, width: OL.borderWidth),
      ),
      child: Row(children: [
        SizedBox(
          width: tc,
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Text('TOTAL', style: _kGrandTotStyle),
          ),
        ),
        for (final v in [tm, tf, tt])
          Container(
            width: nc,
            height: OL.rowHeight,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              border: Border(
                  left:
                      BorderSide(color: OL.borderColor, width: OL.borderWidth)),
            ),
            child: Text(v == 0 ? '—' : '$v', style: _kGrandTotStyle),
          ),
      ]),
    );

    final needsScroll = totalTableWidth > availableWidth;

    final tableContent = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [headerRow, ...dataRows, grandTotalRow],
    );

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
          boxShadow: const [
            BoxShadow(
                color: Color(0x0D000000), blurRadius: 12, offset: Offset(0, 4)),
          ],
        ),
        child: needsScroll
            ? SingleChildScrollView(
                scrollDirection: Axis.horizontal, child: tableContent)
            : tableContent,
      ),
    );
  }

  Widget _hybridDataRow({
    required int index,
    required double tc,
    required double nc,
    required String tid,
    required String mid,
    required String fid,
    required int tot,
    required String rowLabel,
    required bool isEven,
    required List<String> allCells,
    required String fieldId,
  }) {
    final rowBg = isEven ? OL.tableRowEven : OL.tableRowOdd;
    return Container(
      height: OL.rowHeight,
      decoration: BoxDecoration(
        color: rowBg,
        border: const Border(
          left: BorderSide(color: OL.borderColor, width: OL.borderWidth),
          right: BorderSide(color: OL.borderColor, width: OL.borderWidth),
          bottom: BorderSide(color: OL.borderColor, width: OL.borderWidth),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: tc,
            child: TextFormField(
              controller: _hc(tid),
              style: _kTdStyle,
              textAlignVertical: TextAlignVertical.center,
              decoration: InputDecoration(
                hintText: rowLabel,
                hintStyle:
                    const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: OL.cellPadH + 4, vertical: 0),
                isDense: true,
              ),
            ),
          ),
          Container(
            width: nc,
            decoration: const BoxDecoration(
              color: OL.inputCellBg,
              border: Border(
                  left:
                      BorderSide(color: OL.borderColor, width: OL.borderWidth)),
            ),
            child: _HNC(
              cellId: mid,
              value: _aGrid[mid] ?? 0,
              onChanged: _onGC,
              fm: _fm,
              tableId: 's3q02',
              allCells: allCells,
              rowWidth: 2,
              onExitTable: () => _exitTable(fieldId),
              onExitPrevious: () => _exitTablePrevious(fieldId),
            ),
          ),
          Container(
            width: nc,
            decoration: const BoxDecoration(
              color: OL.inputCellBg,
              border: Border(
                  left:
                      BorderSide(color: OL.borderColor, width: OL.borderWidth)),
            ),
            child: _HNC(
              cellId: fid,
              value: _aGrid[fid] ?? 0,
              onChanged: _onGC,
              fm: _fm,
              tableId: 's3q02',
              allCells: allCells,
              rowWidth: 2,
              onExitTable: () => _exitTable(fieldId),
              onExitPrevious: () => _exitTablePrevious(fieldId),
            ),
          ),
          Container(
            width: nc,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: tot > 0 ? OL.totalCellBg : OL.inputCellBgTotal,
              border: const Border(
                  left:
                      BorderSide(color: OL.borderColor, width: OL.borderWidth)),
            ),
            child: Text(
              tot == 0 ? '—' : '$tot',
              style: tot > 0
                  ? _kTotStyle
                  : _kTdStyle.copyWith(color: const Color(0xFF94A3B8)),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  Widget _tableF(FieldSchema f) {
    final tpl = (f.tableSpec?['template'] as String?) ?? '';
    if (tpl == 'reasons_table' ||
        tpl == 'skills_table' ||
        tpl == 'training_table') {
      return _hybridT(f);
    }
    return TableRenderer.renderTable(
      field: f,
      gridValues: _aGrid,
      onCellChanged: _onGC,
      focusManager: _fm,
      entityType: _eStr(widget.entityType),
      onExitTable: () => _exitTable(f.id),
      onExitPrevious: () => _exitTablePrevious(f.id),
    );
  }

  TextInputType _kt(String t) {
    switch (t) {
      case 'number':
        return TextInputType.number;
      case 'email':
        return TextInputType.emailAddress;
      case 'tel':
        return TextInputType.phone;
      default:
        return TextInputType.text;
    }
  }

  Widget _buildF(FieldSchema f) {
    if (!_vis(f) || _hybridAstIds.contains(f.id)) {
      return const SizedBox.shrink();
    }
    final currentSectionId = _primarySection(_si)?.id ?? '';
    final isSimple = _isSimpleSection(currentSectionId);
    final Widget? qh = (f.type != 'table' && !isSimple)
        ? OnefopQuestionHeader(
            paperCode: f.paperCode,
            questionText: f.questionText ?? f.label,
            subLabel:
                (f.label != null && (f.questionText ?? f.label) != f.label)
                    ? f.label
                    : null,
          )
        : null;

    Widget field;
    switch (f.type) {
      case 'radio':
        field = _radioF(f);
        break;
      case 'select':
        field = _selectF(f);
        break;
      case 'table':
        field = _tableF(f);
        break;
      default:
        field = _simpleF(f);
    }

    final content = qh == null
        ? field
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [qh, field]);

    return _HighlightBlock(
      key: _blockKeys[f.id],
      fieldId: f.id,
      fm: _fm,
      isTable: f.type == 'table',
      child: content,
    );
  }

  Widget _buildFW(FieldSchema f, double w) {
    if (!_vis(f) || _hybridAstIds.contains(f.id)) {
      return const SizedBox.shrink();
    }
    switch (f.type) {
      case 'select':
        return _selectFW(f, w);
      case 'table':
        return _tableF(f);
      default:
        return _simpleFW(f, w);
    }
  }

  String _lbl(FieldSchema f) {
    if (f.label != null && f.label!.isNotEmpty) return f.label!;
    if (f.instruction != null && f.instruction!.isNotEmpty) {
      return f.instruction!;
    }
    if (f.questionText != null && f.questionText!.isNotEmpty) {
      return f.questionText!;
    }
    return f.id;
  }

  Widget? _divBefore(FieldSchema f) {
    final l = _div[f.id];
    if (l == null) return null;
    return OnefopDividerLabel(label: l);
  }

  // ══════════════════════════════════════════════════════════════
  // SECTION BUILDER — CRITICAL FIX: Expanded paired columns
  // ══════════════════════════════════════════════════════════════

  Widget _buildSec(SectionSchema sec) {
    if (_schema == null) return const SizedBox.shrink();
    final title = SectionTitleLookup.getTitle(sec.id);
    final fields = sec.fieldIds
        .map((id) => _schema!.getField(id))
        .whereType<FieldSchema>()
        .toList();
    final isV = _valid[sec.id] ?? false;
    final meta = _sm[sec.id];
    final isSimple = _isSimpleSection(sec.id);

    final groups = <_FG>[];
    String? cSub;
    final cF = <FieldSchema>[];
    for (final f in fields) {
      final sub = (f.type == 'table' &&
              f.subsection != null &&
              f.subsection!.isNotEmpty)
          ? f.subsection
          : null;
      if (sub != cSub) {
        if (cF.isNotEmpty) {
          groups.add(_FG(sub: cSub, fields: List.from(cF)));
          cF.clear();
        }
        cSub = sub;
      }
      cF.add(f);
    }
    if (cF.isNotEmpty) groups.add(_FG(sub: cSub, fields: List.from(cF)));

    Widget buildGroupContent(_FG g) {
      final children = <Widget>[];
      if (g.sub != null && g.sub!.isNotEmpty) {
        children.add(OnefopSubsectionHeader(title: g.sub!));
      }

      if (isSimple) {
        final visible = g.fields.where(_vis).toList();
        int i = 0;
        while (i < visible.length) {
          final f = visible[i];
          if (_divBefore(f) != null) children.add(_divBefore(f)!);

          final canPair = f.type != 'table' &&
              f.type != 'radio' &&
              !_hybridAstIds.contains(f.id);
          final hasNext = i + 1 < visible.length;
          final next = hasNext ? visible[i + 1] : null;
          final nextCanPair = next != null &&
              next.type != 'table' &&
              next.type != 'radio' &&
              !_hybridAstIds.contains(next.id);

          if (canPair && nextCanPair) {
            // CRITICAL FIX: Expanded children with gap — never overflows
            children.add(
              Padding(
                padding: const EdgeInsets.only(bottom: OL.questionGapV),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _buildFW(f, double.infinity)),
                    const SizedBox(width: _kColGap),
                    Expanded(child: _buildFW(next, double.infinity)),
                  ],
                ),
              ),
            );
            i += 2;
          } else {
            children.add(_buildF(f));
            i++;
          }
        }
      } else {
        for (final f in g.fields) {
          if (_divBefore(f) != null) children.add(_divBefore(f)!);
          children.add(_buildF(f));
        }
      }

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: children,
      );
    }

    // CRITICAL FIX: body fills available width, never exceeds container
    final body = SizedBox(
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: groups.map(buildGroupContent).toList(),
      ),
    );

    return OnefopSectionContainer(
      sectionId: sec.id,
      title: title,
      icon: meta?.icon,
      isComplete: isV,
      body: body,
    );
  }

  Widget _buildPage(int page) {
    if (_schema == null) return const SizedBox.shrink();
    final idxs = _sectionIndicesForPage(page);
    if (idxs.isEmpty) return const SizedBox.shrink();
    return _buildSec(_schema!.sections[idxs.first]);
  }

  // ══════════════════════════════════════════════════════════════
  // STICKY SECTION SLIVERS  (NEW — extracted body + sliver builder)
  // ══════════════════════════════════════════════════════════════

  Widget _buildSectionBody(SectionSchema sec) {
    if (_schema == null) return const SizedBox.shrink();
    final fields = sec.fieldIds
        .map((id) => _schema!.getField(id))
        .whereType<FieldSchema>()
        .toList();
    final isSimple = _isSimpleSection(sec.id);

    final groups = <_FG>[];
    String? cSub;
    final cF = <FieldSchema>[];
    for (final f in fields) {
      final sub = (f.type == 'table' &&
              f.subsection != null &&
              f.subsection!.isNotEmpty)
          ? f.subsection
          : null;
      if (sub != cSub) {
        if (cF.isNotEmpty) {
          groups.add(_FG(sub: cSub, fields: List.from(cF)));
          cF.clear();
        }
        cSub = sub;
      }
      cF.add(f);
    }
    if (cF.isNotEmpty) groups.add(_FG(sub: cSub, fields: List.from(cF)));

    Widget buildGroupContent(_FG g) {
      final children = <Widget>[];
      if (g.sub != null && g.sub!.isNotEmpty) {
        children.add(OnefopSubsectionHeader(title: g.sub!));
      }

      if (isSimple) {
        final visible = g.fields.where(_vis).toList();
        int i = 0;
        while (i < visible.length) {
          final f = visible[i];
          if (_divBefore(f) != null) children.add(_divBefore(f)!);

          final canPair = f.type != 'table' &&
              f.type != 'radio' &&
              !_hybridAstIds.contains(f.id);
          final hasNext = i + 1 < visible.length;
          final next = hasNext ? visible[i + 1] : null;
          final nextCanPair = next != null &&
              next.type != 'table' &&
              next.type != 'radio' &&
              !_hybridAstIds.contains(next.id);

          if (canPair && nextCanPair) {
            children.add(
              Padding(
                padding: const EdgeInsets.only(bottom: OL.questionGapV),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _buildFW(f, double.infinity)),
                    const SizedBox(width: _kColGap),
                    Expanded(child: _buildFW(next, double.infinity)),
                  ],
                ),
              ),
            );
            i += 2;
          } else {
            children.add(_buildF(f));
            i++;
          }
        }
      } else {
        for (final f in g.fields) {
          if (_divBefore(f) != null) children.add(_divBefore(f)!);
          children.add(_buildF(f));
        }
      }

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: children,
      );
    }

    return SizedBox(
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: groups.map(buildGroupContent).toList(),
      ),
    );
  }

  List<Widget> _buildSectionSlivers(SectionSchema sec) {
    final title = SectionTitleLookup.getTitle(sec.id);
    final isV = _valid[sec.id] ?? false;
    final meta = _sm[sec.id];
    final body = _buildSectionBody(sec);

    return [
      SliverPersistentHeader(
        pinned: true,
        delegate: _StickySectionHeaderDelegate(
          sectionId: sec.id,
          title: title,
          icon: meta?.icon,
          isComplete: isV,
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.only(
          bottom: OL.sectionBodyPaddingH,
        ),
        sliver: SliverToBoxAdapter(
          child: Center(
            // ← FIX: centre the card
            child: ConstrainedBox(
              // ← FIX: cap card width
              constraints: const BoxConstraints(maxWidth: _kScrollChildW),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(12),
                    bottomRight: Radius.circular(12),
                  ),
                  border: Border(
                    left: BorderSide(color: Color(0xFFE2E8F0), width: 1),
                    right: BorderSide(color: Color(0xFFE2E8F0), width: 1),
                    bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x0D000000),
                      blurRadius: 12,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                // No horizontal scroll wrapper needed — the body already
                // constrains itself to _kDocW via ConstrainedBox on each field.
                // If individual tables are wider than the card, they scroll
                // internally via their own SingleChildScrollView.
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: OL.sectionBodyPaddingH,
                    vertical: OL.sectionBodyPaddingV,
                  ),
                  child: body,
                ),
              ),
            ),
          ),
        ),
      ),
    ];
  }

  // ══════════════════════════════════════════════════════════════
  // SIDEBAR
  // ══════════════════════════════════════════════════════════════
  double get _sidebarWidth {
    switch (_sidebarMode) {
      case 0:
        return 0;
      case 1:
        return _kSidebarCollapsed;
      default:
        return _kSidebarFull;
    }
  }

  Widget _sidebar() {
    if (_schema == null) return const SizedBox(width: 0);

    final secs = _schema!.sections;
    final done = _valid.values.where((v) => v).length;
    final ratio = done / secs.length.clamp(1, 999);

    // Determine icon based on current mode
    IconData toggleIcon;
    String toggleTooltip;
    switch (_sidebarMode) {
      case 2:
        toggleIcon = Icons.chevron_left;
        toggleTooltip = 'Réduire la barre';
        break;
      case 1:
        toggleIcon = Icons.last_page;
        toggleTooltip = 'Masquer la barre';
        break;
      default:
        toggleIcon = Icons.menu;
        toggleTooltip = 'Afficher la barre';
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
      width: _sidebarWidth,
      color: const Color(0xFFF8FAFC),
      child: ClipRect(
        child: OverflowBox(
          alignment: Alignment.topLeft,
          maxWidth: _kSidebarFull,
          child: SizedBox(
            width: _kSidebarFull,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Toggle button row pinned to top-right of sidebar ──
                Align(
                  alignment: Alignment.topRight,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 6, right: 6),
                    child: Tooltip(
                      message: toggleTooltip,
                      child: InkWell(
                        onTap: () => setState(() {
                          _sidebarMode = (_sidebarMode + 1) % 3;
                        }),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: const Color(0xFFE2E8F0),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(toggleIcon,
                              size: 18, color: const Color(0xFF475569)),
                        ),
                      ),
                    ),
                  ),
                ),
                if (_sidebarMode == 2) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                    child: Row(children: [
                      Text('$done/${secs.length}',
                          style: const TextStyle(
                              fontSize: 12, color: Color(0xFF64748B))),
                      const Spacer(),
                      Text('${(ratio * 100).round()}%',
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF4472C4))),
                    ]),
                  ),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: ratio,
                        backgroundColor: const Color(0xFFE2E8F0),
                        valueColor: const AlwaysStoppedAnimation<Color>(
                            Color(0xFF70AD47)),
                        minHeight: 6,
                      ),
                    ),
                  ),
                  const Divider(height: 1, color: Color(0xFFE2E8F0)),
                  const SizedBox(height: 8),
                ],
                Expanded(
                  child: ListView.builder(
                    padding: EdgeInsets.symmetric(
                        horizontal: _sidebarMode == 2 ? 8 : 4, vertical: 4),
                    itemCount: _pageCount,
                    itemBuilder: (ctx, page) => _sidebarPageItem(page),
                  ),
                ),
                if (_sidebarMode == 2) _asIndicator(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _sidebarPageItem(int page) {
    final idxs = _sectionIndicesForPage(page);
    final allDone = idxs.every((i) => _valid[_schema!.sections[i].id] ?? false);
    final isActive = page == _si;
    int missingCount = 0;
    for (final i in idxs) {
      missingCount += _missing(_schema!.sections[i]).length;
    }
    final firstSec = idxs.isNotEmpty ? _schema!.sections[idxs.first] : null;
    final meta = firstSec != null ? _sm[firstSec.id] : null;
    final label = meta?.lbl ?? 'Section ${page + 1}';
    final subtitle = idxs.isNotEmpty
        ? SectionTitleLookup.getTitle(_schema!.sections[idxs.first].id)
        : '';

    return InkWell(
      onTap: () => _goto(page),
      borderRadius: BorderRadius.circular(10),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        margin: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
        padding: EdgeInsets.symmetric(
            horizontal: _sidebarMode == 2 ? 12 : 8,
            vertical: _sidebarMode == 2 ? 12 : 8),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFFEEF2FF) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: isActive
              ? Border.all(
                  color: const Color(0xFF4472C4).withValues(alpha: 0.3),
                  width: 1)
              : null,
        ),
        child: Row(children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: allDone
                  ? const Color(0xFF70AD47)
                  : isActive
                      ? const Color(0xFF4472C4)
                      : const Color(0xFFE2E8F0),
            ),
            alignment: Alignment.center,
            child: allDone
                ? const Icon(Icons.check, color: Colors.white, size: 14)
                : (isActive && meta != null)
                    ? Icon(meta.icon, color: Colors.white, size: 14)
                    : Text('${page + 1}',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: isActive
                                ? Colors.white
                                : const Color(0xFF94A3B8))),
          ),
          if (_sidebarMode == 2) ...[
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight:
                              isActive ? FontWeight.w700 : FontWeight.w500,
                          color: isActive
                              ? const Color(0xFF1E293B)
                              : const Color(0xFF475569)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  if (subtitle.isNotEmpty)
                    Text(subtitle,
                        style: const TextStyle(
                            fontSize: 11, color: Color(0xFF94A3B8)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  if (!allDone && missingCount > 0)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: const Color(0xFFFDBA74), width: 0.5)),
                      child: Text(
                          '$missingCount manquant${missingCount > 1 ? 's' : ''}',
                          style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFFEA580C),
                              fontWeight: FontWeight.w600)),
                    ),
                ],
              ),
            ),
            if (allDone)
              const Icon(Icons.check_circle,
                  size: 16, color: Color(0xFF70AD47)),
          ],
        ]),
      ),
    );
  }

  Widget _asIndicator() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: const BoxDecoration(
            border:
                Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1))),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          transitionBuilder: (child, anim) =>
              FadeTransition(opacity: anim, child: child),
          child: _saving
              ? const Row(
                  key: ValueKey('s'),
                  mainAxisSize: MainAxisSize.min,
                  children: [
                      SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Color(0xFF94A3B8))),
                      SizedBox(width: 8),
                      Text('Sauvegarde…',
                          style: TextStyle(
                              fontSize: 12, color: Color(0xFF94A3B8))),
                    ])
              : _dirty
                  ? const Row(
                      key: ValueKey('d'),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                          Icon(Icons.circle, size: 8, color: Color(0xFFF97316)),
                          SizedBox(width: 8),
                          Text('Non sauvegardé',
                              style: TextStyle(
                                  fontSize: 12, color: Color(0xFFF97316))),
                        ])
                  : const Row(
                      key: ValueKey('ok'),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                          Icon(Icons.check_circle_outline,
                              size: 14, color: Color(0xFF70AD47)),
                          SizedBox(width: 8),
                          Text('Sauvegardé',
                              style: TextStyle(
                                  fontSize: 12, color: Color(0xFF70AD47))),
                        ]),
        ),
      );

  Widget _navBar() {
    if (_schema == null) return const SizedBox.shrink();
    final isLast = _si == _pageCount - 1;
    final pageValid = _vPage(_si);
    final allValid = _vAllPages();
    final canProceed = isLast ? allValid : pageValid;
    final idxs = _sectionIndicesForPage(_si);
    final pageMeta =
        idxs.isNotEmpty ? _sm[_schema!.sections[idxs.first].id] : null;
    final pageLabel = pageMeta?.lbl ?? '';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
        boxShadow: [
          BoxShadow(
              color: Color(0x0A000000), blurRadius: 12, offset: Offset(0, -2))
        ],
      ),
      child: SafeArea(
        child: Row(children: [
          if (_si > 0)
            _NavBtn(label: '← Précédent', primary: false, onPressed: _prev)
          else
            const SizedBox(width: 100),
          const Spacer(),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('${_si + 1} / $_pageCount  —  $pageLabel',
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF4472C4))),
              const SizedBox(height: 6),
              SizedBox(
                width: 160,
                height: 4,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (_si + 1) / _pageCount,
                    backgroundColor: const Color(0xFFE2E8F0),
                    valueColor: AlwaysStoppedAnimation<Color>(allValid
                        ? const Color(0xFF70AD47)
                        : const Color(0xFF4472C4)),
                  ),
                ),
              ),
            ],
          ),
          const Spacer(),
          _NavBtn(
            label: isLast ? 'Aperçu PDF →' : 'Suivant →',
            primary: canProceed,
            onPressed: canProceed ? (isLast ? _previewSubmit : _next) : null,
          ),
        ]),
      ),
    );
  }

  void _collect() {
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
      w = _dispatch(w, p);
    }
    _aGrid = w;

    // DEBUG
    print('\n🔍 s21q01 keys in _aGrid after redispatch:');
    _aGrid.keys.where((k) => k.startsWith('s21q01')).toList()
      ..sort()
      ..forEach((k) => print('   $k = ${_aGrid[k]}'));

    for (final e in _aGrid.entries) {
      _data[e.key] = e.value;
    }
    for (final e in _htv.entries) {
      if (e.value.isNotEmpty) _data[e.key] = e.value;
    }
    if (_schema != null) {
      for (final f in _schema!.fields) {
        if (f.type != 'table') continue;
        for (final id in _cellIds(f)) {
          if (!_data.containsKey(id)) _data[id] = 0;
        }
      }
    }
    for (final e in _ctrl.entries) {
      if (e.value.text.isNotEmpty) _data[e.key] = e.value.text;
    }

    for (final e in _ctrl.entries) {
      if (e.value.text.isNotEmpty) _data[e.key] = e.value.text;
    }
  }

  Map<String, dynamic> _mapped(Map<String, dynamic> d) {
    final m = Map<String, dynamic>.from(d);
    if (m['area'] is String) m['area'] = _Map.area(m['area'] as String?);
    if (m['businessSector'] is String) {
      m['businessSector'] = _Map.sector(m['businessSector'] as String?);
    }
    if (m['cooperativeType'] is String) {
      m['cooperativeType'] = _Map.coopType(m['cooperativeType'] as String?);
    }
    if (m['legalStatus'] is String) {
      m['legalStatus'] = _Map.legalStatus(m['legalStatus'] as String?);
    }
    if (m['enterpriseSize'] is String) {
      m['enterpriseSize'] = _Map.size(m['enterpriseSize'] as String?);
    }
    if (m['ctdType'] is String) {
      m['ctdType'] = _Map.ctdType(m['ctdType'] as String?);
    }
    if (m['councilType'] is String) {
      m['councilType'] = _Map.councilType(m['councilType'] as String?);
    }
    return m;
  }

  Future<void> _previewSubmit() async {
    if (!_vAllPages()) {
      if (_schema != null) {
        for (final s in _schema!.sections) {
          for (final id in s.fieldIds) {
            final f = _schema!.getField(id);
            if (f != null &&
                f.required &&
                _vis(f) &&
                !_optionalOverrides.contains(f.id)) {
              _touched.add(id);
            }
          }
        }
      }
      final failPage = _firstFailingPage();
      if (failPage >= 0) setState(() => _si = failPage);
      setState(() {});
      _snack(
          'Veuillez remplir tous les champs obligatoires avant de soumettre');
      return;
    }
    _collect();
    final snapshot = _mapped(Map.from(_data));
    _submissionSnapshot = snapshot;

    _showProgress("Génération de l'aperçu PDF…");
    try {
      final r = await http
          .post(
            Uri.parse('$_kBaseUrl/onefop/preview'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'data': snapshot,
              'entityType': _eStr(widget.entityType),
              'userId': widget.userId ?? 'unknown',
              'formId': 'PREVIEW_${DateTime.now().millisecondsSinceEpoch}',
              'isDraft': true,
            }),
          )
          .timeout(const Duration(seconds: 60));

      if (!mounted) return;
      Navigator.of(context).pop();

      if (r.statusCode == 200 || r.statusCode == 201) {
        final fn =
            'onefop_preview_${DateTime.now().millisecondsSinceEpoch}.pdf';
        if (kIsWeb) {
          PdfCache.currentPdfBytes = r.bodyBytes;
          PdfCache.currentPdfName = fn;
          if (!mounted) return;
          Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) =>
                    PdfViewerScreen(pdfPath: fn, onConfirm: _submitForm),
              ));
        } else {
          final td = await getTemporaryDirectory();
          if (!mounted) return;
          final ff = File('${td.path}/$fn');
          await ff.writeAsBytes(r.bodyBytes);
          if (!mounted) return;
          Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) =>
                    PdfViewerScreen(pdfPath: ff.path, onConfirm: _submitForm),
              ));
        }
      } else {
        _snack('Erreur aperçu (${r.statusCode})');
      }
    } catch (e) {
      if (!mounted) return;
      Navigator.of(context).pop();
      _snack('Erreur réseau : $e');
    }
  }

  Future<void> _submitForm() async {
    if (!mounted) return;
    final snapshot = _submissionSnapshot;
    if (snapshot == null) {
      _snack('Erreur interne : aperçu non disponible');
      return;
    }

    _showProgress('Soumission en cours…');
    try {
      final r = await http
          .post(
            Uri.parse('$_kBaseUrl/onefop/submit'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'data': snapshot,
              'entityType': _eStr(widget.entityType),
              'userId': widget.userId ?? 'unknown',
              'formId': 'ONEFOP_${DateTime.now().millisecondsSinceEpoch}',
              'isDraft': true,
            }),
          )
          .timeout(const Duration(seconds: 60));

      if (!mounted) return;
      Navigator.of(context).pop();

      if (r.statusCode == 200 || r.statusCode == 201) {
        _submissionSnapshot = null;
        widget.onSave({}); // clear in-memory state
        widget.onSubmitSuccess?.call(); // ← CLEAR PERSISTED DRAFT
        if (mounted) _successDialog();
      } else {
        final body = r.body.isNotEmpty ? r.body : '(pas de détail)';
        _snack('Erreur soumission (${r.statusCode}) : $body');
      }
    } on TimeoutException {
      if (!mounted) return;
      Navigator.of(context).pop();
      _snack("Délai d'attente dépassé — veuillez réessayer");
    } catch (e) {
      if (!mounted) return;
      Navigator.of(context).pop();
      _snack('Erreur réseau : $e');
    }
  }

  void _showProgress(String msg) => showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => Center(
          child: Card(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 4,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(color: Color(0xFF4472C4)),
                  const SizedBox(height: 16),
                  Text(msg, style: const TextStyle(fontSize: 14)),
                ],
              ),
            ),
          ),
        ),
      );

  void _successDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        contentPadding: const EdgeInsets.all(28),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 500),
              curve: Curves.elasticOut,
              builder: (context, value, child) => Transform.scale(
                scale: value,
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                      color: const Color(0xFF70AD47).withValues(alpha: 0.1),
                      shape: BoxShape.circle),
                  child: const Icon(Icons.check_circle,
                      color: Color(0xFF70AD47), size: 40),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Soumission réussie !',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1E293B))),
            const SizedBox(height: 8),
            const Text('Votre formulaire ONEFOP a été soumis avec succès.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Color(0xFF64748B))),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  Navigator.of(context).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4472C4),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Terminer',
                    style:
                        TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════
  // BUILD
  // ══════════════════════════════════════════════════════════════
  @override
  Widget build(BuildContext context) {
    final title = 'ONEFOP — ${_eTitle()}';
    final desktop = _isDesktop();

    if (_loading) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: _appBar(title),
        body: _skeletonScreen(),
      );
    }

    if (_err != null || _schema == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: _appBar(title),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  size: 56, color: Color(0xFFCC0000)),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text('Erreur : $_err',
                    style:
                        const TextStyle(color: Color(0xFFCC0000), fontSize: 14),
                    textAlign: TextAlign.center),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loadSchema,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4472C4),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                child: const Text('Réessayer',
                    style: TextStyle(color: Colors.white, fontSize: 14)),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: _appBar(title),
      body: desktop ? _desktopLayout() : _mobileLayout(),
    );
  }

  // ══════════════════════════════════════════════════════════════
  // DESKTOP LAYOUT  (FIXED — SliverPadding instead of padding:)
  // ══════════════════════════════════════════════════════════════

  Widget _desktopLayout() => Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _sidebar(),
          AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            width: _sidebarMode > 0 ? 1 : 0,
            child: const VerticalDivider(
                width: 1, thickness: 1, color: Color(0xFFE2E8F0)),
          ),
          Expanded(
            child: Column(children: [
              Expanded(
                child: Stack(
                  children: [
                    CustomScrollView(
                      controller: _mainScroll,
                      slivers: [
                        const SliverToBoxAdapter(
                          child: SizedBox(height: OL.sectionBodyPaddingH),
                        ),
                        ...() {
                          final idxs = _sectionIndicesForPage(_si);
                          if (idxs.isEmpty) return const <Widget>[];
                          return _buildSectionSlivers(
                              _schema!.sections[idxs.first]);
                        }(),
                        const SliverToBoxAdapter(
                          child: SizedBox(height: 40),
                        ),
                      ],
                    ),
                    if (_sidebarMode == 0)
                      Positioned(
                        top: 12,
                        left: 12,
                        child: Tooltip(
                          message: 'Afficher la barre',
                          child: InkWell(
                            onTap: () => setState(() => _sidebarMode = 2),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                    color: const Color(0xFFE2E8F0), width: 1),
                                boxShadow: const [
                                  BoxShadow(
                                      color: Color(0x1A000000),
                                      blurRadius: 6,
                                      offset: Offset(0, 2)),
                                ],
                              ),
                              child: const Icon(Icons.menu,
                                  size: 16, color: Color(0xFF475569)),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              _navBar(),
            ]),
          ),
        ],
      );
// ══════════════════════════════════════════════════════════════
  // MOBILE LAYOUT  (FIXED — SliverPadding instead of padding:)
  // ══════════════════════════════════════════════════════════════
  Widget _mobileLayout() {
    final idxs = _sectionIndicesForPage(_si);
    final sectionSlivers = idxs.isNotEmpty
        ? _buildSectionSlivers(_schema!.sections[idxs.first])
        : const <Widget>[];

    return Column(children: [
      Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border:
              Border(bottom: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
        ),
        child: _stepperStrip(),
      ),
      Expanded(
        child: CustomScrollView(
          controller: _mainScroll,
          slivers: [
            const SliverToBoxAdapter(
              child: SizedBox(height: OL.sectionBodyPaddingH),
            ),
            ...sectionSlivers,
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
      _navBar(),
    ]);
  }

  Widget _stepperStrip() {
    if (_schema == null) return const SizedBox.shrink();
    return Container(
      height: 68,
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          for (int p = 0; p < _pageCount; p++) ...[
            Expanded(
              child: _StepperItem(
                index: p,
                label: _pageLabel(p),
                isActive: p == _si,
                isCompleted: _vPage(p),
                onTap: () => _goto(p),
              ),
            ),
            if (p < _pageCount - 1) _StepConnector(isCompleted: _vPage(p)),
          ],
        ],
      ),
    );
  }

  String _pageLabel(int page) {
    final idxs = _sectionIndicesForPage(page);
    if (idxs.isNotEmpty) {
      return _sm[_schema!.sections[idxs.first].id]?.lbl ?? 'Pg ${page + 1}';
    }
    return 'Pg ${page + 1}';
  }

  AppBar _appBar(String title) => AppBar(
        title: Text(title,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        backgroundColor: const Color(0xFF4472C4),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          if (!_loading)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: _saving
                      ? const SizedBox(
                          key: ValueKey('s'),
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white70))
                      : _dirty
                          ? Icon(
                              key: const ValueKey('d'),
                              Icons.circle,
                              size: 8,
                              color: Colors.orange.shade300)
                          : const Icon(
                              key: ValueKey('ok'),
                              Icons.cloud_done_outlined,
                              size: 18,
                              color: Colors.white70),
                ),
              ),
            ),
          if (widget.onCancel != null)
            TextButton(
              onPressed: widget.onCancel,
              child: const Text('ANNULER',
                  style: TextStyle(color: Colors.white70, fontSize: 12)),
            ),
          const SizedBox(width: 8),
        ],
      );

  Widget _sidebarModeButton() {
    IconData icon;
    String tooltip;
    switch (_sidebarMode) {
      case 2:
        icon = Icons.chevron_left;
        tooltip = 'Réduire la barre';
        break;
      case 1:
        icon = Icons.last_page;
        tooltip = 'Masquer la barre';
        break;
      default:
        icon = Icons.menu;
        tooltip = 'Afficher la barre';
    }
    return IconButton(
      icon: Icon(icon, size: 20),
      tooltip: tooltip,
      color: Colors.white,
      onPressed: () => setState(() {
        _sidebarMode = (_sidebarMode + 1) % 3;
      }),
    );
  }

  String _eTitle() {
    switch (widget.entityType) {
      case EntityType.enterprise:
        return 'ENTREPRISE';
      case EntityType.cooperative:
        return 'COOPÉRATIVE';
      case EntityType.ctd:
        return 'CTD';
      case EntityType.ong:
        return 'ONG';
    }
  }

  Widget _skeletonScreen() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Row(
            children: [
              for (int i = 0; i < 4; i++) ...[
                const Expanded(
                  child: Column(children: [
                    _SkeletonCircle(size: 28),
                    SizedBox(height: 4),
                    _SkeletonLine(width: 48, height: 10),
                  ]),
                ),
                if (i < 3)
                  const Expanded(child: _SkeletonLine(width: 24, height: 2)),
              ],
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                  color: Colors.white, borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SkeletonLine(width: 160, height: 20),
                  const SizedBox(height: 16),
                  for (int i = 0; i < 6; i++) ...[
                    const _SkeletonLine(width: double.infinity, height: 48),
                    const SizedBox(height: 12),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// _HighlightBlock
// ══════════════════════════════════════════════════════════════
class _HighlightBlock extends StatefulWidget {
  final String fieldId;
  final UnifiedFocusManagerV2 fm;
  final bool isTable;
  final Widget child;

  const _HighlightBlock({
    super.key,
    required this.fieldId,
    required this.fm,
    required this.isTable,
    required this.child,
  });

  @override
  State<_HighlightBlock> createState() => _HighlightBlockState();
}

class _HighlightBlockState extends State<_HighlightBlock> {
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    widget.fm.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(_HighlightBlock old) {
    super.didUpdateWidget(old);
    if (old.fm != widget.fm) {
      old.fm.removeListener(_onFocusChange);
      widget.fm.addListener(_onFocusChange);
    }
  }

  @override
  void dispose() {
    widget.fm.removeListener(_onFocusChange);
    super.dispose();
  }

  void _onFocusChange() {
    final active = widget.fm.activeId;
    final isFocused = active == widget.fieldId;
    if (isFocused != _focused) {
      setState(() => _focused = isFocused);
      if (isFocused && mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (context.mounted) {
            Scrollable.ensureVisible(
              context,
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeOut,
              alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
            );
          }
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      margin: EdgeInsets.only(bottom: widget.isTable ? 0 : 4),
      padding: EdgeInsets.only(
        left: 12,
        right: 12,
        top: 8,
        bottom: widget.isTable ? 0 : 8,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: _focused
            ? (widget.isTable
                ? const Color(0xFFF0F6FF)
                : const Color(0xFFF5F8FF))
            : Colors.transparent,
        border: _focused
            ? Border(
                left: BorderSide(
                    color: const Color(0xFF4472C4).withValues(alpha: 0.7),
                    width: 3))
            : null,
      ),
      child: widget.child,
    );
  }
}

// ══════════════════════════════════════════════════════════════
// _RadioOpt
// ══════════════════════════════════════════════════════════════
class _RadioOpt extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _RadioOpt(
      {required this.label, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFEEF2FF) : Colors.transparent,
            border: Border.all(
              color: isSelected
                  ? const Color(0xFF4472C4)
                  : const Color(0xFFE2E8F0),
              width: isSelected ? 1.5 : 1,
            ),
            borderRadius: BorderRadius.circular(10),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                        color: const Color(0xFF4472C4).withValues(alpha: 0.1),
                        blurRadius: 8,
                        offset: const Offset(0, 2)),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                        color: isSelected
                            ? const Color(0xFF4472C4)
                            : const Color(0xFF94A3B8),
                        width: 2),
                  ),
                  padding: const EdgeInsets.all(4),
                  child: isSelected
                      ? Container(
                          decoration: const BoxDecoration(
                              shape: BoxShape.circle, color: Color(0xFF4472C4)))
                      : const SizedBox.shrink(),
                ),
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Text(label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.w400,
                      color: isSelected
                          ? const Color(0xFF1E293B)
                          : const Color(0xFF475569),
                    )),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// STANDALONE WIDGETS
// ══════════════════════════════════════════════════════════════

class _StepperItem extends StatelessWidget {
  final int index;
  final String label;
  final bool isActive;
  final bool isCompleted;
  final VoidCallback onTap;

  const _StepperItem(
      {required this.index,
      required this.label,
      required this.isActive,
      required this.isCompleted,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isCompleted
                  ? const Color(0xFF70AD47)
                  : isActive
                      ? const Color(0xFF4472C4)
                      : const Color(0xFFE2E8F0),
            ),
            alignment: Alignment.center,
            child: isCompleted
                ? const Icon(Icons.check, color: Colors.white, size: 14)
                : Text('${index + 1}',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color:
                            isActive ? Colors.white : const Color(0xFF94A3B8))),
          ),
          const SizedBox(height: 4),
          Text(label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                color: isActive
                    ? const Color(0xFF4472C4)
                    : const Color(0xFF64748B),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

class _StepConnector extends StatelessWidget {
  final bool isCompleted;
  const _StepConnector({required this.isCompleted});

  @override
  Widget build(BuildContext context) => Container(
        width: 24,
        height: 2,
        decoration: BoxDecoration(
          color:
              isCompleted ? const Color(0xFF70AD47) : const Color(0xFFE2E8F0),
          borderRadius: BorderRadius.circular(1),
        ),
      );
}

class _NavBtn extends StatelessWidget {
  final String label;
  final bool primary;
  final VoidCallback? onPressed;

  const _NavBtn({required this.label, required this.primary, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor:
            primary ? const Color(0xFF4472C4) : const Color(0xFFF1F5F9),
        foregroundColor: primary ? Colors.white : const Color(0xFF475569),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      ),
      child: Text(label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: primary ? Colors.white : const Color(0xFF475569),
          )),
    );
  }
}

class _SkeletonLine extends StatelessWidget {
  final double width;
  final double height;
  const _SkeletonLine({required this.width, required this.height});

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
            color: const Color(0xFFE2E8F0),
            borderRadius: BorderRadius.circular(6)),
      );
}

class _SkeletonCircle extends StatelessWidget {
  final double size;
  const _SkeletonCircle({required this.size});

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
            color: Color(0xFFE2E8F0), shape: BoxShape.circle),
      );
}

// ══════════════════════════════════════════════════════════════
// _HNC — Hybrid Numeric Cell
// ══════════════════════════════════════════════════════════════
class _HNC extends StatefulWidget {
  final String cellId;
  final int value;
  final void Function(String, int) onChanged;
  final UnifiedFocusManagerV2 fm;
  final String tableId;
  final List<String> allCells;
  final int rowWidth;
  final VoidCallback onExitTable;
  final VoidCallback onExitPrevious;

  const _HNC({
    required this.cellId,
    required this.value,
    required this.onChanged,
    required this.fm,
    required this.tableId,
    required this.allCells,
    required this.rowWidth,
    required this.onExitTable,
    required this.onExitPrevious,
  });

  @override
  State<_HNC> createState() => _HNCSt();
}

class _HNCSt extends State<_HNC> {
  late final TextEditingController _c;
  FocusNode get _n => widget.fm.node(widget.cellId);
  String _t(int v) => v == 0 ? '' : '$v';

  @override
  void initState() {
    super.initState();
    _c = TextEditingController(text: _t(widget.value));
    _n.onKeyEvent = _key;
  }

  KeyEventResult _key(FocusNode n, KeyEvent e) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    final kb = HardwareKeyboard.instance;
    final idx = widget.allCells.indexOf(widget.cellId);
    if (idx < 0) return widget.fm.handleKey(n, e, gridId: widget.tableId);

    final row = idx ~/ widget.rowWidth;
    final col = idx % widget.rowWidth;
    final totalRows = (widget.allCells.length / widget.rowWidth).ceil();

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowRight)) {
      if (col < widget.rowWidth - 1 && idx < widget.allCells.length - 1) {
        widget.fm.focus(widget.allCells[idx + 1]);
      } else if (row < totalRows - 1) {
        widget.fm.focus(widget.allCells[(row + 1) * widget.rowWidth]);
      } else {
        widget.onExitTable();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowLeft)) {
      if (col > 0) {
        widget.fm.focus(widget.allCells[idx - 1]);
      } else if (row > 0) {
        widget.fm.focus(widget.allCells[row * widget.rowWidth - 1]);
      } else {
        widget.onExitPrevious();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowDown)) {
      final nextIdx = (row + 1) * widget.rowWidth + col;
      if (nextIdx < widget.allCells.length) {
        widget.fm.focus(widget.allCells[nextIdx]);
      } else {
        widget.onExitTable();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowUp)) {
      final prevIdx = (row - 1) * widget.rowWidth + col;
      if (prevIdx >= 0) {
        widget.fm.focus(widget.allCells[prevIdx]);
      } else {
        widget.onExitPrevious();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.enter) ||
        kb.isLogicalKeyPressed(LogicalKeyboardKey.tab)) {
      if (kb.isShiftPressed) {
        if (idx > 0) {
          widget.fm.focus(widget.allCells[idx - 1]);
        } else {
          widget.onExitPrevious();
        }
      } else {
        if (idx < widget.allCells.length - 1) {
          widget.fm.focus(widget.allCells[idx + 1]);
        } else {
          widget.onExitTable();
        }
      }
      return KeyEventResult.handled;
    }
    return widget.fm.handleKey(n, e, gridId: widget.tableId);
  }

  @override
  void didUpdateWidget(_HNC old) {
    super.didUpdateWidget(old);
    if (old.tableId != widget.tableId || old.fm != widget.fm) {
      _n.onKeyEvent = _key;
    }
    if (old.value != widget.value) {
      final t = _t(widget.value);
      if (_c.text != t) _c.text = t;
    }
  }

  @override
  void dispose() {
    _n.onKeyEvent = null;
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: _n,
        builder: (ctx, _) {
          final focused = _n.hasFocus;
          return ColoredBox(
            color: focused ? const Color(0xFFEBF3FF) : Colors.transparent,
            child: TextField(
              controller: _c,
              focusNode: _n,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              textAlignVertical: TextAlignVertical.center,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(
                  fontSize: _kNumCellFontSize,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF000000)),
              decoration: InputDecoration(
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
                hintText: focused ? '0' : null,
                hintStyle: const TextStyle(
                    fontSize: _kNumCellFontSize, color: Color(0xFFCBD5E1)),
              ),
              onChanged: (v) =>
                  widget.onChanged(widget.cellId, int.tryParse(v) ?? 0),
              onSubmitted: (_) => _key(
                  _n,
                  const KeyDownEvent(
                    physicalKey: PhysicalKeyboardKey.enter,
                    logicalKey: LogicalKeyboardKey.enter,
                    timeStamp: Duration.zero,
                  )),
            ),
          );
        },
      );
}
