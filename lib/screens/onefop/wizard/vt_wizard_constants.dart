// lib/screens/onefop/wizard/vt_wizard_constants.dart
// ══════════════════════════════════════════════════════════════
// VT WIZARD MODE — design tokens, scoped to this directory only.
//
// These mirror the "MINEFOP Collect" Figma file's own palette/type scale.
// Deliberately NOT the shared onefop_form_constants.dart tokens: Spreadsheet
// Mode and Simple Mode depend on those, and the Figma redesign uses a
// visibly different, more rounded (12px, see kVtWizardCardRadius below)
// card language than the rest of the app. Keeping these separate means
// this mode can look like the Figma prototype without nudging the other
// two modes' shared tokens.
//
// Corrected 2026-09 against a systematic hex-count across every
// get_design_context dump fetched this session (4 independent screens,
// 100+ occurrences each of ink/border/background) — the ink/border/
// background/yellow/red values below had drifted to a generic Tailwind
// "slate" palette (0F172A/475569/94A3B8/E2E8F0) early in the session and
// were never reconciled against the real Figma hex values despite dozens
// of later reads showing them in plain text. Every one of these is now
// the exact, most-frequent hex Figma actually uses — not a rounded
// approximation.
//
// Brand green intentionally reuses the app's existing kAccent
// (AppColors.deepEmerald, #0A6640) rather than Figma's literal #006643 —
// see onefop_form_constants.dart's own doc comment: one brand color across
// the whole ONEFOP form, no second green competing with it. This is the
// one deliberate deviation from Figma's literal palette; every other
// token below is a direct match.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../../../core/i18n/localized_text.dart';

const Color kVtWizardYellow = Color(0xFFFCD116);
const Color kVtWizardRed = Color(0xFFCE1126);
const Color kVtWizardBackground = Color(0xFFF4F6F5);
const Color kVtWizardCardBorder = Color(0xFFE5EAE7);
const Color kVtWizardInk = Color(0xFF1C1F1D);
const Color kVtWizardInkSoft = Color(0xFF4E5451);
const Color kVtWizardInkFaint = Color(0xFF7A827F);
const Color kVtWizardAccentSoft = Color(0xFFE6F2ED);
const Color kVtWizardYellowSoft = Color(0xFFFFFCEB);
const Color kVtWizardRedSoft = Color(0xFFFFF5F5);

// The recurring "form-card" (sections 1-9, validation) is 12px per
// get_design_context on nodes 11:228/11:677.
const double kVtWizardCardRadius = 12.0;
const double kVtWizardSidebarWidth = 280.0;
const double kVtWizardContentMaxWidth = 900.0;

const String kVtWizardFontFamily = 'Manrope';

const TextStyle kVtWizardTitle = TextStyle(
  fontFamily: kVtWizardFontFamily,
  fontWeight: FontWeight.w800,
  fontSize: 22,
  color: kVtWizardInk,
);
const TextStyle kVtWizardSectionTitle = TextStyle(
  fontFamily: kVtWizardFontFamily,
  fontWeight: FontWeight.w800,
  fontSize: 22,
  color: kVtWizardInk,
);
const TextStyle kVtWizardQuestionTitle = TextStyle(
  fontFamily: kVtWizardFontFamily,
  fontWeight: FontWeight.w800,
  fontSize: 16,
  color: kVtWizardInk,
);
const TextStyle kVtWizardFieldLabelStyle = TextStyle(
  fontFamily: kVtWizardFontFamily,
  fontWeight: FontWeight.w700,
  fontSize: 15,
  color: kVtWizardInk,
);
const TextStyle kVtWizardBody = TextStyle(
  fontFamily: kVtWizardFontFamily,
  fontWeight: FontWeight.w500,
  fontSize: 15,
  color: kVtWizardInk,
);
const TextStyle kVtWizardCaption = TextStyle(
  fontFamily: kVtWizardFontFamily,
  fontWeight: FontWeight.w600,
  fontSize: 12,
  color: kVtWizardInkSoft,
);

/// Card container matching Figma's white/#E5EAE7-border/12px-radius shape,
/// used by every wizard screen instead of each redeclaring the same
/// BoxDecoration.
BoxDecoration vtWizardCardDecoration({Color? fill}) => BoxDecoration(
      color: fill ?? Colors.white,
      border: Border.all(color: kVtWizardCardBorder),
      borderRadius: BorderRadius.circular(kVtWizardCardRadius),
    );

/// Contextual tooltips providing statistical definitions for ambiguous concepts.
/// Each tooltip explains what CAM-LEAP/ONEFOP means by the term in the context
/// of this specific question, including what should be counted and examples where helpful.
const Map<String, LocalizedText> kFieldTooltips = {
  // Section 1 - Identification
  'VT1_1': LocalizedText(
    fr: "Code d'identification officiel à 7-9 caractères délivré par le MINEFOP.",
    en: 'Official 7-9 character identification code issued by MINEFOP.',
  ),
  'VT1_3': LocalizedText(
    fr: 'Acronyme ou abréviation officielle de la structure (ex: CFPR, CFP-B).',
    en: 'Official acronym or abbreviation of the institution (e.g., CFPR, CFP-B).',
  ),
  'VT1_9': LocalizedText(
    fr: 'Urbain si situé en agglomération / périmètre communal ; Rural en zone villageoise.',
    en: 'Urban if located in city/town limits; Rural for village or countryside.',
  ),
  'VT1_10': LocalizedText(
    fr: "Public si créé par l'État ou collectivité territoriale ; Privé sous agrément ministériel.",
    en: 'Public if state or council founded; Private if accredited non-governmental.',
  ),
  'VT1_13': LocalizedText(
    fr: 'Indique si des activités pédagogiques et des apprenants sont actifs cette année académique. Ne pas déclarer un centre temporairement fermé.',
    en: 'Indicates whether training courses and trainees are currently active this academic year. Do not declare a temporarily closed center.',
  ),
  'VT1_17': LocalizedText(
    fr: 'Fonction de la personne certifiant la déclaration (ex: Directeur, Promoteur, SG).',
    en: 'Official title of the person certifying this census form (e.g. Director, Promoter).',
  ),

  // Section 2 - Infrastructure & Agreements
  'VT2_1': LocalizedText(
    fr: "Pour cette déclaration, inclure les conventions formelles avec l'État concernant les stages académiques, stages professionnels, stages pré-emploi ou l'insertion. Exclure les contacts informels sans convention signée.",
    en: 'For this declaration, include formal agreements with the Government concerning academic internships, work placements, pre-employment internships or insertion. Exclude informal contacts without signed agreement.',
  ),
  'VT2_3': LocalizedText(
    fr: "Nombre total de bâtiments ou emplacements physiques où votre structure dispense des formations, y compris le site principal.",
    en: 'Total number of buildings or physical locations where your institution provides training, including the main site.',
  ),
  'VT2_6': LocalizedText(
    fr: "Pour cette déclaration, inclure les formateurs ayant suivi une formation certifiée ou qualifiante en éducation spécialisée ou pédagogie adaptée aux besoins éducatifs spéciaux.",
    en: 'For this declaration, include trainers who have completed certified or qualifying training in special education or teaching methods for special educational needs.',
  ),
  'VT2_10': LocalizedText(
    fr: "Bureau privé dédié au directeur, distinct des salles de formation et des espaces partagés.",
    en: 'Private office dedicated to the director, separate from training rooms and shared spaces.',
  ),
  'VT2_11': LocalizedText(
    fr: "Dispositif formalisé et affiché d'évacuation en cas d'incendie ou de sinistre, conforme aux normes de sécurité.",
    en: 'Formalized and displayed emergency evacuation procedure for fire or disaster, compliant with safety standards.',
  ),
  'VT2_14': LocalizedText(
    fr: "Agrément officiel ou autorisation d'ouverture délivré par le MINEFOP ou l'autorité compétente. Exclure les demandes en cours non encore approuvées.",
    en: 'Official accreditation or opening authorization issued by MINEFOP or competent authority. Exclude pending applications not yet approved.',
  ),
  'VT2_24': LocalizedText(
    fr: "Source d'énergie actuellement en état de marche et utilisable pour les activités de formation.",
    en: 'Energy source currently operational and usable for training activities.',
  ),
  'VT2_31': LocalizedText(
    fr: "Infirmerie équipée pour dispenser des premiers soins, avec personnel qualifié ou kit médical de base. Exclure un simple bureau de repos.",
    en: 'Dispensary equipped to provide first aid, with qualified personnel or basic medical kit. Exclude a simple rest room.',
  ),
  'VT2_32': LocalizedText(
    fr: "Bibliothèque avec collections de livres, manuels ou ressources documentaires accessibles aux apprenants et formateurs. Doit être fonctionnelle et utilisée.",
    en: 'Library with collections of books, manuals or documentary resources accessible to trainees and trainers. Must be functional and in use.',
  ),
  'VT2_34': LocalizedText(
    fr: "Conseil d'établissement qui se réunit régulièrement selon le règlement intérieur. Exclure un conseil qui existe sur papier mais ne se réunit pas.",
    en: 'School council that meets regularly according to internal regulations. Exclude a council that exists on paper but does not meet.',
  ),
  'VT2_41': LocalizedText(
    fr: "Espaces extérieurs aménagés dédiés aux activités récréatives ou sportives des apprenants.",
    en: 'Outdoor spaces dedicated to recreational or sports activities for trainees.',
  ),
  'VT2_51': LocalizedText(
    fr: "Structure d'hébergement au sein du centre permettant aux apprenants de résider pendant leur formation.",
    en: 'Accommodation facility within the center allowing trainees to reside during their training.',
  ),
  'VT2_53': LocalizedText(
    fr: "Service de restauration offrant des repas aux apprenants pendant les heures de formation.",
    en: 'Catering service offering meals to trainees during training hours.',
  ),

  // Section 3 - Safety & Equipment
  'VT3_7': LocalizedText(
    fr: "Équipements de protection individuelle appropriés aux spécialités enseignées (gants, lunettes, casques, blouses, etc.).",
    en: 'Personal protective equipment appropriate to the specialties taught (gloves, goggles, helmets, coats, etc.).',
  ),
  'VT3_9': LocalizedText(
    fr: "Pharmacie ou trousse médicale contenant des produits de premiers secours pour traiter les blessures mineures survenant en atelier ou en formation.",
    en: 'Pharmacy or medical kit containing first aid supplies to treat minor injuries occurring in workshops or training.',
  ),
  'VT3_11': LocalizedText(
    fr: "Dispositif de sécurité maintenu à jour, vérifié régulièrement et opérationnel pour les activités de formation en cours.",
    en: 'Safety device kept up to date, checked regularly and operational for current training activities.',
  ),
  'VT3_12': LocalizedText(
    fr: "Pour cette déclaration, inclure les personnes ayant suivi une formation certifiée en secourisme ou premiers secours. Indiquer le nombre total actuellement formé.",
    en: 'For this declaration, include persons who have completed certified training in first aid or emergency care. Indicate the total number currently trained.',
  ),

  // Section 5 - Learning Materials
  'VT5_1': LocalizedText(
    fr: "Manuels, guides pédagogiques ou supports didactiques officiels mis à disposition des apprenants pour l'année académique en cours.",
    en: 'Manuals, educational guides or official teaching materials made available to trainees for the current academic year.',
  ),
  'VT5_3': LocalizedText(
    fr: "Manuels, référentiels ou supports pédagogiques destinés aux formateurs pour préparer et dispenser les cours de l'année en cours.",
    en: 'Manuals, curricula or teaching materials for trainers to prepare and deliver courses for the current year.',
  ),

  // Section 6 - Guidance & Support
  'VT6_1': LocalizedText(
    fr: "Pour cette déclaration, inclure tout accompagnement formalisé dans le choix des filières : entretiens d'orientation, tests d'aptitude, conseils individuels ou collectifs.",
    en: 'For this declaration, include any formalized support in choosing training paths: guidance interviews, aptitude tests, individual or group counseling.',
  ),
  'VT6_5': LocalizedText(
    fr: "Cellule, service ou structure dédiée à l'accompagnement des sortants dans leur recherche d'emploi ou insertion professionnelle.",
    en: 'Unit, service or structure dedicated to supporting graduates in their job search or professional integration.',
  ),
  'VT6_7': LocalizedText(
    fr: "Outil ou dispositif aidant les apprenants ou sortants dans leur recherche d'emploi : plateforme d'offres, base de données d'employeurs, ateliers de techniques de recherche d'emploi.",
    en: 'Tool or mechanism helping trainees or graduates in their job search: job board platform, employer database, job search technique workshops.',
  ),

  // Section 7 - Cross-cutting Themes
  'VT7_1': LocalizedText(
    fr: "Directives formellement inscrites dans le règlement intérieur concernant la prévention, la sensibilisation ou la prise en charge du VIH/SIDA au sein de l'établissement.",
    en: 'Directives formally included in internal regulations concerning HIV/AIDS prevention, awareness or management within the institution.',
  ),
  'VT7_6': LocalizedText(
    fr: "Procédures disciplinaires écrites et appliquées en cas de violation des directives liées au VIH/SIDA, à la discrimination ou au harcèlement.",
    en: 'Written and enforced disciplinary procedures in case of violation of directives related to HIV/AIDS, discrimination or harassment.',
  ),
};
