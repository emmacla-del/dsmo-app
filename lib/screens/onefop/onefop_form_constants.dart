// lib/screens/onefop/onefop_form_constants.dart
// ══════════════════════════════════════════════════════════════
// CONSTANTS, ENUMS & BACKEND MAPPERS
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../core/i18n/localized_text.dart';
import '../../theme/app_colors.dart';

const String kOnefopBaseUrl = 'https://dsmo-app-2.onrender.com/api';

// ── Document width ────────────────────────────────────────────
const double kDocWidth = 920.0;
const double kHybridNumWidth = 60.0; // GridTheme.colWidth
const double kColumnGap = 20.0;
const double kScrollChildWidth = kDocWidth + 40.0; // OL.sectionBodyPaddingH*2

// ── Sidebar widths ────────────────────────────────────────────
const double kSidebarFullWidth = 240.0;
const double kSidebarCollapsedWidth = 56.0;

// ══════════════════════════════════════════════════════════════
// DESIGN TOKENS — one brand color throughout: AppColors.deepEmerald,
// the same green already used on login/password/approval screens.
// Restrained neutral ink + surfaces around it, soft long shadows
// instead of heavy borders. Every color the ONEFOP form uses
// should come from this palette — no ad-hoc hex literals, and no
// second brand hue (no navy, no blue) competing with the green.
// ══════════════════════════════════════════════════════════════

// Ink (text) — three steps of emphasis, never pure black. Neutral,
// not part of the brand color — this is about legibility only.
const Color kInk = Color(0xFF1A1A1A); // headings, primary text
const Color kInkSoft = Color(0xFF4A4A4A); // body / secondary text
const Color kInkFaint = Color(0xFF9A9A9A); // placeholder / tertiary / hints

// Surfaces
const Color kCanvas = Color(0xFFF5F7F5); // page background
const Color kSurface = Color(0xFFFFFFFF); // cards
const Color kFieldFill = Color(0xFFF7F9F8); // input fill, idle
const Color kFieldFillHover = Color(0xFFEFF4F1);

// Hairlines
const Color kBorder = Color(0xFFE4E9E6);
const Color kBorderStrong = Color(0xFFD3DBD7);

// The one brand color — app bar / primary chrome, CTAs, focus rings,
// progress, links, selection, and "complete/done" states all share
// this single green. kAccentDeep is only for pressed/hover states —
// it's a shade of the same color, not a second hue.
const Color kAccent = AppColors.deepEmerald; // #0A6640
const Color kAccentDeep = Color(0xFF063F27);
const Color kAccentSoft = Color(0xFFE1F0E8);

// "Chrome" is an alias for the brand color — the app bar and other
// large structural surfaces use it directly rather than a separate hue.
const Color kNavy = kAccent;
const Color kNavyDeep = kAccentDeep;

// Status — success reuses the brand color itself (it already reads as
// "good"); danger/warning stay distinct since they carry real meaning.
const Color kSuccess = kAccent;
const Color kSuccessSoft = kAccentSoft;
const Color kDanger = Color(0xFFCF4433);
const Color kDangerSoft = Color(0xFFFBEDEB);
const Color kWarning = Color(0xFFAC7A26);
const Color kWarningSoft = Color(0xFFF8F0E1);

// Radii — one step larger than the old scale for a calmer, less
// "boxy" feel; still restrained (no pill-everything).
const double kRadiusSm = 8.0;
const double kRadiusMd = 12.0;
const double kRadiusLg = 16.0;

// Elevation via soft long shadows rather than borders-only cards.
List<BoxShadow> get kShadowCard => [
      BoxShadow(
          color: kInk.withValues(alpha: 0.05),
          blurRadius: 1,
          offset: const Offset(0, 1)),
      BoxShadow(
          color: kInk.withValues(alpha: 0.06),
          blurRadius: 28,
          offset: const Offset(0, 10)),
    ];

List<BoxShadow> get kShadowFloating => [
      BoxShadow(
          color: kInk.withValues(alpha: 0.10),
          blurRadius: 20,
          offset: const Offset(0, 6)),
    ];

// ── Harmonised table typography ───────────────────────────────
const TextStyle kTableHeaderStyle =
    TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kInk);
const TextStyle kTableDataStyle =
    TextStyle(fontSize: 13, fontWeight: FontWeight.w400, color: kInkSoft);
const TextStyle kTotalStyle =
    TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kAccent);
// White text — this sits on the brand-green grand-total row background.
const TextStyle kGrandTotalStyle =
    TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white);
const double kNumCellFontSize = 14.0;

// ── Entity type ─────────────────────────────────────────────
enum EntityType { enterprise, cooperative, ctd, ong }

// ── Backend mappers ───────────────────────────────────────────
class BackendMappers {
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

// ── Hybrid-table definition ───────────────────────────────────
class HTDef {
  final List<String> rowKeys;
  final String textSuffix;
  final List<LocalizedText> rowLabels;
  const HTDef(
      {required this.rowKeys,
      required this.textSuffix,
      required this.rowLabels});
}

// ── Sidebar metadata ──────────────────────────────────────────
class SidebarMeta {
  final LocalizedText label;
  final IconData icon;
  const SidebarMeta(this.label, this.icon);
}

// ── Static maps ─────────────────────────────────────────────
const Map<String, SidebarMeta> kSidebarMeta = {
  'section0': SidebarMeta(
      LocalizedText(fr: 'Répondant', en: 'Respondent'), Icons.person_outline),
  'section1': SidebarMeta(
      LocalizedText(fr: 'Entité', en: 'Entity'), Icons.corporate_fare_outlined),
  'section1_cooperative': SidebarMeta(
      LocalizedText(fr: 'Coopérative', en: 'Cooperative'),
      Icons.corporate_fare_outlined),
  'section1_entreprise': SidebarMeta(
      LocalizedText(fr: 'Entreprise', en: 'Company'), Icons.business_outlined),
  'section1_ctd': SidebarMeta(
      LocalizedText.same('CTD'), Icons.account_balance_outlined),
  'section1_ong': SidebarMeta(
      LocalizedText(fr: 'ONG', en: 'NGO'), Icons.volunteer_activism_outlined),
  'section2': SidebarMeta(
      LocalizedText(fr: 'Emploi', en: 'Employment'), Icons.work_outline),
  'section3': SidebarMeta(
      LocalizedText(fr: 'Départs', en: 'Departures'), Icons.exit_to_app_outlined),
  'section4': SidebarMeta(
      LocalizedText(fr: 'Formation', en: 'Training'), Icons.school_outlined),
};

const Map<String, LocalizedText> kDividers = {
  'S0Q03': LocalizedText(fr: 'Contacts', en: 'Contacts'),
  'S1Q04': LocalizedText(fr: 'Localisation', en: 'Location'),
  'S1Q06': LocalizedText(fr: 'Coordonnées', en: 'Contact details'),
  'S1Q07': LocalizedText(fr: 'Activité', en: 'Activity'),
  'S1Q10': LocalizedText(fr: 'Structure', en: 'Structure'),
};

const Set<String> kHybridAstIds = {
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

const Map<String, LocalizedText> kHybridColumnHeaders = {
  's3q02': LocalizedText(fr: 'Motif', en: 'Reason'),
  's4q02': LocalizedText(fr: 'Compétence', en: 'Skill'),
  's4q03': LocalizedText(fr: 'Domaine', en: 'Domain'),
};

const Map<String, HTDef> kHybridTables = {
  's3q02': HTDef(
    rowKeys: ['reason_1', 'reason_2', 'reason_3'],
    textSuffix: 'text',
    rowLabels: [
      LocalizedText(fr: 'Motif 1', en: 'Reason 1'),
      LocalizedText(fr: 'Motif 2', en: 'Reason 2'),
      LocalizedText(fr: 'Motif 3', en: 'Reason 3'),
    ],
  ),
  's4q02': HTDef(
    rowKeys: ['skill_1', 'skill_2', 'skill_3'],
    textSuffix: 'text',
    rowLabels: [
      LocalizedText(fr: 'Compétence 1', en: 'Skill 1'),
      LocalizedText(fr: 'Compétence 2', en: 'Skill 2'),
      LocalizedText(fr: 'Compétence 3', en: 'Skill 3'),
    ],
  ),
  's4q03': HTDef(
    rowKeys: ['domain_1', 'domain_2', 'domain_3'],
    textSuffix: 'text',
    rowLabels: [
      LocalizedText(fr: 'Domaine 1', en: 'Domain 1'),
      LocalizedText(fr: 'Domaine 2', en: 'Domain 2'),
      LocalizedText(fr: 'Domaine 3', en: 'Domain 3'),
    ],
  ),
};

const Set<String> kTwoTokenPrefixes = {'s22q05_ent', 's22q05_oth'};

// ── Helpers ───────────────────────────────────────────────────
Map<String, dynamic> sanitiseInitialData(Map<String, dynamic> raw) {
  return Map.fromEntries(raw.entries.where((e) {
    final v = e.value;
    if (v == null) return false;
    if (v is String && v.trim().isEmpty) return false;
    return true;
  }));
}

/// Returns the string value for API calls (UPPERCASE for database compatibility)
String entityTypeString(EntityType t) {
  switch (t) {
    case EntityType.enterprise:
      return 'ENTREPRISE';
    case EntityType.cooperative:
      return 'COOPERATIVE';
    case EntityType.ctd:
      return 'CTD';
    case EntityType.ong:
      return 'ONG';
  }
}

/// Returns the string value for schema loading (lowercase to match AST)
String entityTypeForSchema(EntityType t) {
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

/// Returns the display title for UI (human readable)
LocalizedText entityTypeTitle(EntityType t) {
  switch (t) {
    case EntityType.enterprise:
      return const LocalizedText(fr: 'ENTREPRISE', en: 'COMPANY');
    case EntityType.cooperative:
      return const LocalizedText(fr: 'COOPÉRATIVE', en: 'COOPERATIVE');
    case EntityType.ctd:
      return const LocalizedText.same('CTD');
    case EntityType.ong:
      return const LocalizedText(fr: 'ONG', en: 'NGO');
  }
}

String fieldPrefix(String id) {
  for (final p in kTwoTokenPrefixes) {
    if (id.startsWith('${p}_')) return p;
  }
  return id.split('_').first;
}
