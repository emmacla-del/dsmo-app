// lib/screens/register_constants.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/i18n/localized_text.dart';
import '../data/minefop_models.dart'; // EntityType lives here — single source of truth

// ─── Step indices ────────────────────────────────────────────
const int kStepRole = 0;
const int kStepEntityType = 1;
const int kStepRespondent = 2;
const int kStepEntityInfo = 3;
const int kStepLocation = 4;
const int kStepMinefopInfo = 5;
const int kStepSecurity = 6;
const int kStepReview = 7;

// ─── Modern input decoration ──────────────────────────────────
InputDecoration modernInput({
  required bool hasError,
  String? labelText,
  String? hintText,
  Widget? prefixIcon,
  Widget? suffixIcon,
  String? suffixText,
  TextStyle? suffixStyle,
}) {
  return InputDecoration(
    labelText: labelText,
    hintText: hintText,
    prefixIcon: prefixIcon,
    suffixIcon: suffixIcon,
    suffixText: suffixText,
    suffixStyle: suffixStyle,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    filled: true,
    fillColor: hasError ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
    border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
    enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(
            color:
                hasError ? const Color(0xFFE24B4A) : const Color(0xFFE2E8F0))),
    focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF006B5E), width: 2)),
    errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE24B4A))),
    focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE24B4A), width: 2)),
  );
}

InputDecoration modernDropdown({bool hasError = false}) =>
    modernInput(hasError: hasError);

// ─── Static option lists ─────────────────────────────────────
// `value` is the canonical string stored in form data / submitted to the
// backend and MUST NOT change with locale — only `text` (the displayed
// label) is bilingual. See LocalizedOption in core/i18n/localized_text.dart.
const List<LocalizedOption> kLegalStatusOptions = [
  LocalizedOption('Société unipersonnelle',
      LocalizedText(fr: 'Société unipersonnelle', en: 'Sole proprietorship')),
  LocalizedOption('SARL', LocalizedText.same('SARL')),
  LocalizedOption('SA', LocalizedText.same('SA')),
  LocalizedOption('SNC', LocalizedText.same('SNC')),
  LocalizedOption('Autres', LocalizedText(fr: 'Autres', en: 'Other')),
];

const List<LocalizedOption> kCooperativeTypeOptions = [
  LocalizedOption(
      'Coopérative simplifiée',
      LocalizedText(
          fr: 'Coopérative simplifiée', en: 'Simplified cooperative')),
  LocalizedOption(
      "Coopérative avec conseil d'administration",
      LocalizedText(
          fr: "Coopérative avec conseil d'administration",
          en: 'Cooperative with board of directors')),
  LocalizedOption('Autre', LocalizedText(fr: 'Autre', en: 'Other')),
];

const List<LocalizedOption> kCtdTypeOptions = [
  LocalizedOption('Région', LocalizedText(fr: 'Région', en: 'Region')),
  LocalizedOption('Commune', LocalizedText(fr: 'Commune', en: 'Municipality')),
];

const List<LocalizedOption> kAreaOptions = [
  LocalizedOption('Urbain', LocalizedText(fr: 'Urbain', en: 'Urban')),
  LocalizedOption('Rural', LocalizedText.same('Rural')),
];

final List<TextInputFormatter> kPhoneFormatters = [
  FilteringTextInputFormatter.digitsOnly,
];

const List<LocalizedOption> kRespondentFunctionOptions = [
  LocalizedOption('Directeur Général',
      LocalizedText(fr: 'Directeur Général', en: 'Chief Executive Officer')),
  LocalizedOption(
      'Directeur des Ressources Humaines',
      LocalizedText(
          fr: 'Directeur des Ressources Humaines',
          en: 'Human Resources Director')),
  LocalizedOption(
      'Directeur Administratif et Financier',
      LocalizedText(
          fr: 'Directeur Administratif et Financier',
          en: 'Administrative and Financial Director')),
  LocalizedOption('Gérant', LocalizedText(fr: 'Gérant', en: 'Manager')),
  LocalizedOption('Chef du Personnel',
      LocalizedText(fr: 'Chef du Personnel', en: 'Head of Personnel')),
  LocalizedOption('Responsable RH',
      LocalizedText(fr: 'Responsable RH', en: 'HR Manager')),
  LocalizedOption('Secrétaire Général',
      LocalizedText(fr: 'Secrétaire Général', en: 'Secretary General')),
  LocalizedOption(
      "Président du Conseil d'Administration",
      LocalizedText(
          fr: "Président du Conseil d'Administration",
          en: 'Chairman of the Board')),
  LocalizedOption('Autre', LocalizedText(fr: 'Autre', en: 'Other')),
];

// ─── MINEFOP role options ─────────────────────────────────────
const List<String> kMinefopRoleOptions = [
  'CENTRAL',
  'REGIONAL',
  'DIVISIONAL',
];

const Map<String, LocalizedText> kMinefopRoleLabels = {
  'DIVISIONAL':
      LocalizedText(fr: 'Délégué Départemental', en: 'Divisional Delegate'),
  'REGIONAL':
      LocalizedText(fr: 'Délégué Régional', en: 'Regional Delegate'),
  'CENTRAL':
      LocalizedText(fr: 'Administration Centrale', en: 'Central Administration'),
};

// NOTE: EntityType enum has been removed from this file.
// It is defined once in lib/data/minefop_models.dart and imported above.

// ─── Entity field definition ──────────────────────────────────
/// Each [EntityField] maps directly to a backend payload key and a
/// corresponding ONEFOP / DSMO form field for pre-filling.
class EntityField {
  /// Backend payload key (also used as the pre-fill key).
  final String key;

  /// Label shown to the user during registration.
  final LocalizedText label;

  /// Optional hint text.
  final LocalizedText? hint;

  /// Whether the field is mandatory.
  final bool required;

  final TextInputType? keyboardType;

  /// If non-null the field renders as a dropdown with these choices.
  final List<LocalizedOption>? options;

  /// True when the field should use the phone-specific widget.
  final bool isPhone;

  /// The ONEFOP form section this field pre-fills (informational).
  final String? onefopSection;

  /// The DSMO form field this field pre-fills (informational).
  final String? dsmoField;

  const EntityField({
    required this.key,
    required this.label,
    this.hint,
    this.required = true,
    this.keyboardType,
    this.options,
    this.isPhone = false,
    this.onefopSection,
    this.dsmoField,
  });
}

// ─── Entity configuration ─────────────────────────────────────
class EntityConfig {
  final EntityType type;
  final LocalizedText title;
  final IconData icon;
  final Color color;
  final List<EntityField> fields;

  const EntityConfig({
    required this.type,
    required this.title,
    required this.icon,
    required this.color,
    required this.fields,
  });

  /// Returns the canonical company name from [data] regardless of entity type.
  String resolveCompanyName(Map<String, dynamic> data, String fallback) {
    final candidates = [
      data['companyName'],
      data['cooperativeName'],
      data['ctdName'],
      data['ngoName'],
      data['centerName'],
    ];
    for (final c in candidates) {
      if (c != null && (c as String).trim().isNotEmpty) return c;
    }
    return fallback;
  }

  /// Returns the canonical address from [data].
  String resolveAddress(Map<String, dynamic> data) {
    final candidates = [
      data['address'],
      data['cooperativeHeadOffice'],
    ];
    for (final c in candidates) {
      if (c != null && (c as String).trim().isNotEmpty) return c;
    }
    return '';
  }

  /// Returns the canonical main-activity from [data].
  String resolveMainActivity(Map<String, dynamic> data) {
    final candidates = [
      data['mainActivity'],
      data['mainMission'],
      data['trainingDomains'],
    ];
    for (final c in candidates) {
      if (c != null && (c as String).trim().isNotEmpty) return c;
    }
    return '';
  }
}

// ─── Entity configurations ────────────────────────────────────
/// Fields annotated with [onefopSection] and [dsmoField] control which
/// form fields are pre-filled when the user submits declarations later.
const Map<EntityType, EntityConfig> entityConfigs = {
  // ── ENTERPRISE ──────────────────────────────────────────────
  EntityType.enterprise: EntityConfig(
    type: EntityType.enterprise,
    title: LocalizedText(fr: 'Entreprise', en: 'Company'),
    icon: Icons.business_outlined,
    color: Colors.teal,
    fields: [
      EntityField(
        key: 'companyName',
        label: LocalizedText(fr: 'Raison sociale', en: 'Company name'),
        hint: LocalizedText(
            fr: "Nom légal de l'entreprise", en: "Company's legal name"),
        onefopSection: 'S1.Q1',
        dsmoField: 'raisonSociale',
      ),
      EntityField(
        key: 'legalStatus',
        label: LocalizedText(fr: 'Statut juridique', en: 'Legal status'),
        options: kLegalStatusOptions,
        onefopSection: 'S1.Q2',
        dsmoField: 'formeJuridique',
      ),
      EntityField(
        key: 'taxNumber',
        label: LocalizedText(fr: 'N° Contribuable (NIU)', en: 'Taxpayer No. (NIU)'),
        hint: LocalizedText(
            fr: "Numéro d'identification fiscale",
            en: 'Tax identification number'),
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q3',
        dsmoField: 'niu',
      ),
      EntityField(
        key: 'cnpsNumber',
        label: LocalizedText(
            fr: "N° d'affiliation CNPS", en: 'CNPS affiliation No.'),
        hint: LocalizedText(fr: 'Numéro CNPS', en: 'CNPS number'),
        keyboardType: TextInputType.number,
        required: false,
        onefopSection: 'S1.Q4',
        dsmoField: 'numeroCnps',
      ),
      EntityField(
        key: 'mainActivity',
        label: LocalizedText(fr: 'Activité principale', en: 'Main activity'),
        hint: LocalizedText(
            fr: "Secteur d'activité principal", en: 'Main business sector'),
        onefopSection: 'S1.Q5',
        dsmoField: 'activitePrincipale',
      ),
      EntityField(
        key: 'branch',
        label: LocalizedText(fr: "Branche d'activité", en: 'Business branch'),
        hint: LocalizedText(
            fr: 'Ex: Commerce, Industrie, Services',
            en: 'E.g.: Trade, Industry, Services'),
        required: false,
        onefopSection: 'S1.Q6',
        dsmoField: 'brancheActivite',
      ),
      EntityField(
        key: 'address',
        label: LocalizedText(
            fr: 'Adresse du siège social', en: 'Registered office address'),
        hint: LocalizedText(fr: 'Adresse complète', en: 'Full address'),
        onefopSection: 'S1.Q7',
        dsmoField: 'adresseSiege',
      ),
      EntityField(
        key: 'phone',
        label: LocalizedText(fr: 'Téléphone', en: 'Phone'),
        hint: LocalizedText.same('6XXXXXXXX'),
        keyboardType: TextInputType.phone,
        isPhone: true,
        onefopSection: 'S0.Q5',
        dsmoField: 'telephone',
      ),
      EntityField(
        key: 'phone2',
        label: LocalizedText(fr: 'Téléphone secondaire', en: 'Secondary phone'),
        hint: LocalizedText(fr: 'Optionnel', en: 'Optional'),
        keyboardType: TextInputType.phone,
        isPhone: true,
        required: false,
        dsmoField: 'telephone2',
      ),
      EntityField(
        key: 'poBox',
        label: LocalizedText(fr: 'Boîte postale', en: 'P.O. Box'),
        hint: LocalizedText(fr: 'BP', en: 'P.O. Box'),
        required: false,
        onefopSection: 'S1.Q8',
        dsmoField: 'boitePostale',
      ),
      EntityField(
        key: 'socialCapital',
        label: LocalizedText(fr: 'Capital social (XAF)', en: 'Share capital (XAF)'),
        hint: LocalizedText(fr: 'Montant en chiffres', en: 'Amount in figures'),
        keyboardType: TextInputType.number,
        required: false,
        onefopSection: 'S1.Q9',
        dsmoField: 'capitalSocial',
      ),
      EntityField(
        key: 'parentCompany',
        label: LocalizedText(
            fr: 'Maison mère / Groupe', en: 'Parent company / Group'),
        hint: LocalizedText(fr: 'Optionnel', en: 'Optional'),
        required: false,
        onefopSection: 'S1.Q10',
        dsmoField: 'maisonMere',
      ),
      EntityField(
        key: 'secondaryActivity',
        label: LocalizedText(
            fr: 'Activité secondaire', en: 'Secondary activity'),
        hint: LocalizedText(fr: 'Optionnel', en: 'Optional'),
        required: false,
        onefopSection: 'S1.Q11',
        dsmoField: 'activiteSecondaire',
      ),
    ],
  ),

  // ── COOPERATIVE ─────────────────────────────────────────────
  EntityType.cooperative: EntityConfig(
    type: EntityType.cooperative,
    title: LocalizedText(fr: 'Coopérative', en: 'Cooperative'),
    icon: Icons.groups_outlined,
    color: Colors.green,
    fields: [
      EntityField(
        key: 'cooperativeName',
        label: LocalizedText(
            fr: 'Nom de la coopérative', en: 'Cooperative name'),
        hint: LocalizedText(
            fr: 'Dénomination officielle', en: 'Official name'),
        onefopSection: 'S1.Q1',
        dsmoField: 'raisonSociale',
      ),
      EntityField(
        key: 'cooperativeType',
        label: LocalizedText(
            fr: 'Type de coopérative', en: 'Cooperative type'),
        options: kCooperativeTypeOptions,
        onefopSection: 'S1.Q2',
        dsmoField: 'typeCooperative',
      ),
      EntityField(
        key: 'yearOfCreation',
        label: LocalizedText(fr: 'Année de création', en: 'Year established'),
        hint: LocalizedText(fr: 'AAAA', en: 'YYYY'),
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q3',
        dsmoField: 'anneeCreation',
      ),
      EntityField(
        key: 'taxNumber',
        label: LocalizedText(fr: 'N° Contribuable (NIU)', en: 'Taxpayer No. (NIU)'),
        hint: LocalizedText(
            fr: "Numéro d'identification fiscale",
            en: 'Tax identification number'),
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q4',
        dsmoField: 'niu',
      ),
      EntityField(
        key: 'mainActivity',
        label: LocalizedText(fr: 'Activité principale', en: 'Main activity'),
        onefopSection: 'S1.Q5',
        dsmoField: 'activitePrincipale',
      ),
      EntityField(
        key: 'cooperativeHeadOffice',
        label: LocalizedText(
            fr: 'Adresse du siège social', en: 'Registered office address'),
        onefopSection: 'S1.Q6',
        dsmoField: 'adresseSiege',
      ),
      EntityField(
        key: 'branch',
        label: LocalizedText(fr: "Branche d'activité", en: 'Business branch'),
        hint: LocalizedText(
            fr: 'Ex: Cultures vivrières, Commerce de détail',
            en: 'E.g.: Food crops, Retail trade'),
        required: false,
        onefopSection: 'S1.Q7',
        dsmoField: 'brancheActivite',
      ),
      EntityField(
        key: 'phone',
        label: LocalizedText(fr: 'Téléphone', en: 'Phone'),
        keyboardType: TextInputType.phone,
        isPhone: true,
        onefopSection: 'S0.Q5',
        dsmoField: 'telephone',
      ),
      EntityField(
        key: 'phone2',
        label: LocalizedText(fr: 'Téléphone secondaire', en: 'Secondary phone'),
        keyboardType: TextInputType.phone,
        isPhone: true,
        required: false,
        dsmoField: 'telephone2',
      ),
      EntityField(
        key: 'poBox',
        label: LocalizedText(fr: 'Boîte postale', en: 'P.O. Box'),
        hint: LocalizedText(fr: 'BP', en: 'P.O. Box'),
        required: false,
        dsmoField: 'boitePostale',
      ),
    ],
  ),

  // ── CTD ─────────────────────────────────────────────────────
  EntityType.ctd: EntityConfig(
    type: EntityType.ctd,
    title: LocalizedText.same('CTD'),
    icon: Icons.account_balance_outlined,
    color: Colors.indigo,
    fields: [
      EntityField(
        key: 'ctdType',
        label: LocalizedText(fr: 'Type de CTD', en: 'CTD type'),
        options: kCtdTypeOptions,
        onefopSection: 'S1.Q1',
        dsmoField: 'typeCtd',
      ),
      EntityField(
        key: 'ctdName',
        label: LocalizedText(fr: 'Nom de la CTD', en: 'CTD name'),
        hint: LocalizedText(fr: 'Région ou Commune', en: 'Region or Municipality'),
        onefopSection: 'S1.Q2',
        dsmoField: 'raisonSociale',
      ),
      EntityField(
        key: 'yearOfCreation',
        label: LocalizedText(fr: 'Année de création', en: 'Year established'),
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q3',
        dsmoField: 'anneeCreation',
      ),
      EntityField(
        key: 'taxNumber',
        label: LocalizedText(fr: 'N° Contribuable (NIU)', en: 'Taxpayer No. (NIU)'),
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q4',
        dsmoField: 'niu',
      ),
      EntityField(
        key: 'address',
        label: LocalizedText(fr: 'Adresse du siège', en: 'Head office address'),
        onefopSection: 'S1.Q5',
        dsmoField: 'adresseSiege',
      ),
      EntityField(
        key: 'phone',
        label: LocalizedText(fr: 'Téléphone', en: 'Phone'),
        keyboardType: TextInputType.phone,
        isPhone: true,
        onefopSection: 'S0.Q5',
        dsmoField: 'telephone',
      ),
      EntityField(
        key: 'phone2',
        label: LocalizedText(fr: 'Téléphone secondaire', en: 'Secondary phone'),
        keyboardType: TextInputType.phone,
        isPhone: true,
        required: false,
        dsmoField: 'telephone2',
      ),
      EntityField(
        key: 'poBox',
        label: LocalizedText(fr: 'Boîte postale', en: 'P.O. Box'),
        hint: LocalizedText(fr: 'BP', en: 'P.O. Box'),
        required: false,
        dsmoField: 'boitePostale',
      ),
    ],
  ),

  // ── ONG ─────────────────────────────────────────────────────
  EntityType.ong: EntityConfig(
    type: EntityType.ong,
    title: LocalizedText(fr: 'ONG', en: 'NGO'),
    icon: Icons.volunteer_activism_outlined,
    color: Colors.orange,
    fields: [
      EntityField(
        key: 'ngoName',
        label: LocalizedText(fr: "Nom de l'ONG", en: 'NGO name'),
        onefopSection: 'S1.Q1',
        dsmoField: 'raisonSociale',
      ),
      EntityField(
        key: 'registrationNumber',
        label: LocalizedText(fr: "N° d'enregistrement", en: 'Registration No.'),
        hint: LocalizedText(fr: "Numéro d'agrément", en: 'Approval number'),
        onefopSection: 'S1.Q2',
        dsmoField: 'numeroEnregistrement',
      ),
      EntityField(
        key: 'taxNumber',
        label: LocalizedText(fr: 'N° Contribuable (NIU)', en: 'Taxpayer No. (NIU)'),
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q3',
        dsmoField: 'niu',
      ),
      EntityField(
        key: 'yearOfCreation',
        label: LocalizedText(fr: 'Année de création', en: 'Year established'),
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q4',
        dsmoField: 'anneeCreation',
      ),
      EntityField(
        key: 'mainMission',
        label: LocalizedText(fr: 'Mission principale', en: 'Main mission'),
        hint: LocalizedText(
            fr: "Objectif principal de l'ONG", en: "NGO's main objective"),
        onefopSection: 'S1.Q5',
        dsmoField: 'activitePrincipale',
      ),
      EntityField(
        key: 'address',
        label: LocalizedText(
            fr: 'Adresse du siège social', en: 'Registered office address'),
        onefopSection: 'S1.Q6',
        dsmoField: 'adresseSiege',
      ),
      EntityField(
        key: 'phone',
        label: LocalizedText(fr: 'Téléphone', en: 'Phone'),
        keyboardType: TextInputType.phone,
        isPhone: true,
        onefopSection: 'S0.Q5',
        dsmoField: 'telephone',
      ),
      EntityField(
        key: 'phone2',
        label: LocalizedText(fr: 'Téléphone secondaire', en: 'Secondary phone'),
        keyboardType: TextInputType.phone,
        isPhone: true,
        required: false,
        dsmoField: 'telephone2',
      ),
      EntityField(
        key: 'poBox',
        label: LocalizedText(fr: 'Boîte postale', en: 'P.O. Box'),
        hint: LocalizedText(fr: 'BP', en: 'P.O. Box'),
        required: false,
        dsmoField: 'boitePostale',
      ),
    ],
  ),

  // ── VOCATIONAL ───────────────────────────────────────────────
  EntityType.vocational: EntityConfig(
    type: EntityType.vocational,
    title: LocalizedText(
        fr: 'Centre de formation professionnelle',
        en: 'Vocational Training Center'),
    icon: Icons.school_outlined,
    color: Colors.purple,
    fields: [
      EntityField(
        key: 'centerName',
        label: LocalizedText(fr: 'Nom du centre', en: 'Center name'),
        onefopSection: 'S1.Q1',
        dsmoField: 'raisonSociale',
      ),
      EntityField(
        key: 'registrationNumber',
        label: LocalizedText(fr: "N° d'agrément", en: 'Approval No.'),
        hint: LocalizedText(
            fr: "Numéro d'agrément ministériel",
            en: 'Ministerial approval number'),
        onefopSection: 'S1.Q2',
        dsmoField: 'numeroAgrement',
      ),
      EntityField(
        key: 'taxNumber',
        label: LocalizedText(fr: 'N° Contribuable (NIU)', en: 'Taxpayer No. (NIU)'),
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q3',
        dsmoField: 'niu',
      ),
      EntityField(
        key: 'yearOfCreation',
        label: LocalizedText(fr: 'Année de création', en: 'Year established'),
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q4',
        dsmoField: 'anneeCreation',
      ),
      EntityField(
        key: 'trainingDomains',
        label: LocalizedText(
            fr: 'Domaines de formation', en: 'Training fields'),
        hint: LocalizedText(
            fr: 'Ex: Maintenance, Hôtellerie, BTP',
            en: 'E.g.: Maintenance, Hospitality, Construction'),
        onefopSection: 'S1.Q5',
        dsmoField: 'domainesFormation',
      ),
      EntityField(
        key: 'address',
        label: LocalizedText(fr: 'Adresse du centre', en: "Center's address"),
        onefopSection: 'S1.Q6',
        dsmoField: 'adresseSiege',
      ),
      EntityField(
        key: 'phone',
        label: LocalizedText(fr: 'Téléphone', en: 'Phone'),
        keyboardType: TextInputType.phone,
        isPhone: true,
        onefopSection: 'S0.Q5',
        dsmoField: 'telephone',
      ),
      EntityField(
        key: 'phone2',
        label: LocalizedText(fr: 'Téléphone secondaire', en: 'Secondary phone'),
        keyboardType: TextInputType.phone,
        isPhone: true,
        required: false,
        dsmoField: 'telephone2',
      ),
      EntityField(
        key: 'poBox',
        label: LocalizedText(fr: 'Boîte postale', en: 'P.O. Box'),
        hint: LocalizedText(fr: 'BP', en: 'P.O. Box'),
        required: false,
        dsmoField: 'boitePostale',
      ),
    ],
  ),
};
