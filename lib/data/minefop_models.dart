// lib/data/minefop_models.dart
//
// Canonical shared models for:
//   • EntityType          — single source of truth for both the register
//                           flow (register_constants.dart) and the ONEFOP
//                           form (onefop_form_models.dart).
//   • MinefopServiceNode  — service-tree nodes, used by StepMinefopInfo
//                           and ServicePicker.
//   • ServicePosition     — positions within a service node.
//
// No Flutter imports needed — pure Dart.

// ════════════════════════════════════════════════════════════════
// EntityType  —  unified enum, replaces the two conflicting copies
// ════════════════════════════════════════════════════════════════

enum EntityType {
  enterprise, // Entreprise commerciale
  cooperative, // Coopérative / GIE
  ctd, // Collectivité Territoriale Décentralisée
  ong, // ONG / Association
  vocational; // Centre de formation professionnelle (DSMO only, no ONEFOP S1)

  // ── Display ──────────────────────────────────────────────────

  String get displayName {
    switch (this) {
      case EntityType.enterprise:
        return 'Entreprise';
      case EntityType.cooperative:
        return 'Coopérative';
      case EntityType.ctd:
        return 'CTD';
      case EntityType.ong:
        return 'ONG';
      case EntityType.vocational:
        return 'Centre de formation professionnelle';
    }
  }

  // ── API ───────────────────────────────────────────────────────

  /// Value sent to / received from the backend.
  String get apiValue {
    switch (this) {
      case EntityType.enterprise:
        return 'ENTREPRISE';
      case EntityType.cooperative:
        return 'COOPERATIVE';
      case EntityType.ctd:
        return 'CTD';
      case EntityType.ong:
        return 'ONG';
      case EntityType.vocational:
        return 'VOCATIONAL_TRAINING_CENTER';
    }
  }

  // ── ONEFOP form ───────────────────────────────────────────────

  /// Header shown above Section 1 of the ONEFOP questionnaire.
  String get formSectionLabel {
    switch (this) {
      case EntityType.enterprise:
        return "Section 1 — Identification de l'entreprise";
      case EntityType.cooperative:
        return 'Section 1 — Identification de la coopérative';
      case EntityType.ctd:
        return 'Section 1 — Identification de la CTD';
      case EntityType.ong:
        return "Section 1 — Identification de l'ONG";
      case EntityType.vocational:
        return 'Section 1 — Identification du centre de formation';
    }
  }

  /// Vocational training centres file DSMO declarations but have no
  /// dedicated ONEFOP Section 1 model variant.
  bool get hasOnefopForm => this != EntityType.vocational;

  // ── Parsing helpers ───────────────────────────────────────────

  /// Resolves from the backend [apiValue] string (e.g. 'ENTREPRISE').
  static EntityType? fromApiValue(String? v) => v == null
      ? null
      : EntityType.values.where((e) => e.apiValue == v).firstOrNull;

  /// Resolves from [toString()] or [name] (used for draft persistence).
  static EntityType? fromString(String? v) => v == null
      ? null
      : EntityType.values
          .where((e) => e.toString() == v || e.name == v)
          .firstOrNull;
}

// ════════════════════════════════════════════════════════════════
// MinefopServiceNode
// ════════════════════════════════════════════════════════════════

class MinefopServiceNode {
  final String id;
  final String code;
  final String name;
  final String? nameEn;
  final String? acronym;
  final String category;
  final int level;
  final String? parentCode;
  final String roleMapping;
  final bool requiresRegion;
  final bool requiresDepartment;

  /// True when the backend reports this node has child services.
  /// ServicePicker also cross-checks its own runtime _children map,
  /// so this field is the API hint; the picker is the authority at
  /// render time.
  final bool hasChildren;

  const MinefopServiceNode({
    required this.id,
    required this.code,
    required this.name,
    this.nameEn,
    this.acronym,
    required this.category,
    required this.level,
    this.parentCode,
    required this.roleMapping,
    required this.requiresRegion,
    required this.requiresDepartment,
    required this.hasChildren,
  });

  factory MinefopServiceNode.fromJson(Map<String, dynamic> j) {
    // Guard against empty-string parentCode sent by some API versions.
    final rawParent = j['parentCode'];
    final parentCode = (rawParent is String && rawParent.isEmpty)
        ? null
        : rawParent as String?;
    return MinefopServiceNode(
      id: j['id'] as String? ?? '',
      code: j['code'] as String,
      name: j['name'] as String,
      nameEn: j['nameEn'] as String?,
      acronym: j['acronym'] as String?,
      category: j['category'] as String,
      level: j['level'] as int,
      parentCode: parentCode,
      roleMapping: j['roleMapping'] as String,
      requiresRegion: j['requiresRegion'] as bool? ?? false,
      requiresDepartment: j['requiresDepartment'] as bool? ?? false,
      hasChildren: j['hasChildren'] as bool? ?? false,
    );
  }

  /// Full display label — "ACRONYM — Name" when acronym is present.
  String get displayName =>
      (acronym != null && acronym!.isNotEmpty) ? '$acronym — $name' : name;

  /// Short label used in breadcrumb chips (acronym preferred).
  String get shortName => acronym ?? name;

  @override
  bool operator ==(Object other) =>
      other is MinefopServiceNode && other.code == code;

  @override
  int get hashCode => code.hashCode;
}

// ════════════════════════════════════════════════════════════════
// ServicePosition
// ════════════════════════════════════════════════════════════════

class ServicePosition {
  final String id;
  final String positionType;
  final String title;
  final String? titleEn;
  final int level;

  const ServicePosition({
    required this.id,
    required this.positionType,
    required this.title,
    this.titleEn,
    required this.level,
  });

  factory ServicePosition.fromJson(Map<String, dynamic> j) => ServicePosition(
        id: j['id'] as String,
        positionType: j['positionType'] as String,
        title: j['title'] as String,
        titleEn: j['titleEn'] as String?,
        level: j['level'] as int,
      );

  @override
  bool operator ==(Object other) => other is ServicePosition && other.id == id;

  @override
  int get hashCode => id.hashCode;
}
