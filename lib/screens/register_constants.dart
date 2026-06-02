// lib/screens/register_constants.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
const List<String> kLegalStatusOptions = [
  'Société unipersonnelle',
  'SARL',
  'SA',
  'SNC',
  'Autres',
];

const List<String> kCooperativeTypeOptions = [
  'Coopérative simplifiée',
  "Coopérative avec conseil d'administration",
  'Autre',
];

const List<String> kCtdTypeOptions = ['Région', 'Commune'];

const List<String> kAreaOptions = ['Urbain', 'Rural'];

final List<TextInputFormatter> kPhoneFormatters = [
  FilteringTextInputFormatter.digitsOnly,
];

const List<String> kRespondentFunctionOptions = [
  'Directeur Général',
  'Directeur des Ressources Humaines',
  'Directeur Administratif et Financier',
  'Gérant',
  'Chef du Personnel',
  'Responsable RH',
  'Secrétaire Général',
  "Président du Conseil d'Administration",
  'Autre',
];

// ─── MINEFOP role options ─────────────────────────────────────
const List<String> kMinefopRoleOptions = [
  'CENTRAL',
  'REGIONAL',
  'DIVISIONAL',
];

const Map<String, String> kMinefopRoleLabels = {
  'DIVISIONAL': 'Délégué Départemental',
  'REGIONAL': 'Délégué Régional',
  'CENTRAL': 'Administration Centrale',
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
  final String label;

  /// Optional hint text.
  final String? hint;

  /// Whether the field is mandatory.
  final bool required;

  final TextInputType? keyboardType;

  /// If non-null the field renders as a dropdown with these choices.
  final List<String>? options;

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
  final String title;
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
    title: 'Entreprise',
    icon: Icons.business_outlined,
    color: Colors.teal,
    fields: [
      EntityField(
        key: 'companyName',
        label: 'Raison sociale',
        hint: "Nom légal de l'entreprise",
        onefopSection: 'S1.Q1',
        dsmoField: 'raisonSociale',
      ),
      EntityField(
        key: 'legalStatus',
        label: 'Statut juridique',
        options: kLegalStatusOptions,
        onefopSection: 'S1.Q2',
        dsmoField: 'formeJuridique',
      ),
      EntityField(
        key: 'taxNumber',
        label: 'N° Contribuable (NIU)',
        hint: "Numéro d'identification fiscale",
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q3',
        dsmoField: 'niu',
      ),
      EntityField(
        key: 'cnpsNumber',
        label: "N° d'affiliation CNPS",
        hint: 'Numéro CNPS',
        keyboardType: TextInputType.number,
        required: false,
        onefopSection: 'S1.Q4',
        dsmoField: 'numeroCnps',
      ),
      EntityField(
        key: 'mainActivity',
        label: 'Activité principale',
        hint: "Secteur d'activité principal",
        onefopSection: 'S1.Q5',
        dsmoField: 'activitePrincipale',
      ),
      EntityField(
        key: 'branch',
        label: "Branche d'activité",
        hint: 'Ex: Commerce, Industrie, Services',
        required: false,
        onefopSection: 'S1.Q6',
        dsmoField: 'brancheActivite',
      ),
      EntityField(
        key: 'address',
        label: 'Adresse du siège social',
        hint: 'Adresse complète',
        onefopSection: 'S1.Q7',
        dsmoField: 'adresseSiege',
      ),
      EntityField(
        key: 'phone',
        label: 'Téléphone',
        hint: '6XXXXXXXX',
        keyboardType: TextInputType.phone,
        isPhone: true,
        onefopSection: 'S0.Q5',
        dsmoField: 'telephone',
      ),
      EntityField(
        key: 'phone2',
        label: 'Téléphone secondaire',
        hint: 'Optionnel',
        keyboardType: TextInputType.phone,
        isPhone: true,
        required: false,
        dsmoField: 'telephone2',
      ),
      EntityField(
        key: 'poBox',
        label: 'Boîte postale',
        hint: 'BP',
        required: false,
        onefopSection: 'S1.Q8',
        dsmoField: 'boitePostale',
      ),
      EntityField(
        key: 'socialCapital',
        label: 'Capital social (XAF)',
        hint: 'Montant en chiffres',
        keyboardType: TextInputType.number,
        required: false,
        onefopSection: 'S1.Q9',
        dsmoField: 'capitalSocial',
      ),
      EntityField(
        key: 'parentCompany',
        label: 'Maison mère / Groupe',
        hint: 'Optionnel',
        required: false,
        onefopSection: 'S1.Q10',
        dsmoField: 'maisonMere',
      ),
      EntityField(
        key: 'secondaryActivity',
        label: 'Activité secondaire',
        hint: 'Optionnel',
        required: false,
        onefopSection: 'S1.Q11',
        dsmoField: 'activiteSecondaire',
      ),
    ],
  ),

  // ── COOPERATIVE ─────────────────────────────────────────────
  EntityType.cooperative: EntityConfig(
    type: EntityType.cooperative,
    title: 'Coopérative',
    icon: Icons.groups_outlined,
    color: Colors.green,
    fields: [
      EntityField(
        key: 'cooperativeName',
        label: 'Nom de la coopérative',
        hint: 'Dénomination officielle',
        onefopSection: 'S1.Q1',
        dsmoField: 'raisonSociale',
      ),
      EntityField(
        key: 'cooperativeType',
        label: 'Type de coopérative',
        options: kCooperativeTypeOptions,
        onefopSection: 'S1.Q2',
        dsmoField: 'typeCooperative',
      ),
      EntityField(
        key: 'yearOfCreation',
        label: 'Année de création',
        hint: 'AAAA',
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q3',
        dsmoField: 'anneeCreation',
      ),
      EntityField(
        key: 'taxNumber',
        label: 'N° Contribuable (NIU)',
        hint: "Numéro d'identification fiscale",
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q4',
        dsmoField: 'niu',
      ),
      EntityField(
        key: 'mainActivity',
        label: 'Activité principale',
        onefopSection: 'S1.Q5',
        dsmoField: 'activitePrincipale',
      ),
      EntityField(
        key: 'cooperativeHeadOffice',
        label: 'Adresse du siège social',
        onefopSection: 'S1.Q6',
        dsmoField: 'adresseSiege',
      ),
      EntityField(
        key: 'branch',
        label: "Branche d'activité",
        hint: 'Ex: Cultures vivrières, Commerce de détail',
        required: false,
        onefopSection: 'S1.Q7',
        dsmoField: 'brancheActivite',
      ),
      EntityField(
        key: 'phone',
        label: 'Téléphone',
        keyboardType: TextInputType.phone,
        isPhone: true,
        onefopSection: 'S0.Q5',
        dsmoField: 'telephone',
      ),
      EntityField(
        key: 'phone2',
        label: 'Téléphone secondaire',
        keyboardType: TextInputType.phone,
        isPhone: true,
        required: false,
        dsmoField: 'telephone2',
      ),
      EntityField(
        key: 'poBox',
        label: 'Boîte postale',
        hint: 'BP',
        required: false,
        dsmoField: 'boitePostale',
      ),
    ],
  ),

  // ── CTD ─────────────────────────────────────────────────────
  EntityType.ctd: EntityConfig(
    type: EntityType.ctd,
    title: 'CTD',
    icon: Icons.account_balance_outlined,
    color: Colors.indigo,
    fields: [
      EntityField(
        key: 'ctdType',
        label: 'Type de CTD',
        options: kCtdTypeOptions,
        onefopSection: 'S1.Q1',
        dsmoField: 'typeCtd',
      ),
      EntityField(
        key: 'ctdName',
        label: 'Nom de la CTD',
        hint: 'Région ou Commune',
        onefopSection: 'S1.Q2',
        dsmoField: 'raisonSociale',
      ),
      EntityField(
        key: 'yearOfCreation',
        label: 'Année de création',
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q3',
        dsmoField: 'anneeCreation',
      ),
      EntityField(
        key: 'taxNumber',
        label: 'N° Contribuable (NIU)',
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q4',
        dsmoField: 'niu',
      ),
      EntityField(
        key: 'address',
        label: 'Adresse du siège',
        onefopSection: 'S1.Q5',
        dsmoField: 'adresseSiege',
      ),
      EntityField(
        key: 'phone',
        label: 'Téléphone',
        keyboardType: TextInputType.phone,
        isPhone: true,
        onefopSection: 'S0.Q5',
        dsmoField: 'telephone',
      ),
      EntityField(
        key: 'phone2',
        label: 'Téléphone secondaire',
        keyboardType: TextInputType.phone,
        isPhone: true,
        required: false,
        dsmoField: 'telephone2',
      ),
      EntityField(
        key: 'poBox',
        label: 'Boîte postale',
        hint: 'BP',
        required: false,
        dsmoField: 'boitePostale',
      ),
    ],
  ),

  // ── ONG ─────────────────────────────────────────────────────
  EntityType.ong: EntityConfig(
    type: EntityType.ong,
    title: 'ONG',
    icon: Icons.volunteer_activism_outlined,
    color: Colors.orange,
    fields: [
      EntityField(
        key: 'ngoName',
        label: "Nom de l'ONG",
        onefopSection: 'S1.Q1',
        dsmoField: 'raisonSociale',
      ),
      EntityField(
        key: 'registrationNumber',
        label: "N° d'enregistrement",
        hint: "Numéro d'agrément",
        onefopSection: 'S1.Q2',
        dsmoField: 'numeroEnregistrement',
      ),
      EntityField(
        key: 'taxNumber',
        label: 'N° Contribuable (NIU)',
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q3',
        dsmoField: 'niu',
      ),
      EntityField(
        key: 'yearOfCreation',
        label: 'Année de création',
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q4',
        dsmoField: 'anneeCreation',
      ),
      EntityField(
        key: 'mainMission',
        label: 'Mission principale',
        hint: "Objectif principal de l'ONG",
        onefopSection: 'S1.Q5',
        dsmoField: 'activitePrincipale',
      ),
      EntityField(
        key: 'address',
        label: 'Adresse du siège social',
        onefopSection: 'S1.Q6',
        dsmoField: 'adresseSiege',
      ),
      EntityField(
        key: 'phone',
        label: 'Téléphone',
        keyboardType: TextInputType.phone,
        isPhone: true,
        onefopSection: 'S0.Q5',
        dsmoField: 'telephone',
      ),
      EntityField(
        key: 'phone2',
        label: 'Téléphone secondaire',
        keyboardType: TextInputType.phone,
        isPhone: true,
        required: false,
        dsmoField: 'telephone2',
      ),
      EntityField(
        key: 'poBox',
        label: 'Boîte postale',
        hint: 'BP',
        required: false,
        dsmoField: 'boitePostale',
      ),
    ],
  ),

  // ── VOCATIONAL ───────────────────────────────────────────────
  EntityType.vocational: EntityConfig(
    type: EntityType.vocational,
    title: 'Centre de formation professionnelle',
    icon: Icons.school_outlined,
    color: Colors.purple,
    fields: [
      EntityField(
        key: 'centerName',
        label: 'Nom du centre',
        onefopSection: 'S1.Q1',
        dsmoField: 'raisonSociale',
      ),
      EntityField(
        key: 'registrationNumber',
        label: "N° d'agrément",
        hint: "Numéro d'agrément ministériel",
        onefopSection: 'S1.Q2',
        dsmoField: 'numeroAgrement',
      ),
      EntityField(
        key: 'taxNumber',
        label: 'N° Contribuable (NIU)',
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q3',
        dsmoField: 'niu',
      ),
      EntityField(
        key: 'yearOfCreation',
        label: 'Année de création',
        keyboardType: TextInputType.number,
        onefopSection: 'S1.Q4',
        dsmoField: 'anneeCreation',
      ),
      EntityField(
        key: 'trainingDomains',
        label: 'Domaines de formation',
        hint: 'Ex: Maintenance, Hôtellerie, BTP',
        onefopSection: 'S1.Q5',
        dsmoField: 'domainesFormation',
      ),
      EntityField(
        key: 'address',
        label: 'Adresse du centre',
        onefopSection: 'S1.Q6',
        dsmoField: 'adresseSiege',
      ),
      EntityField(
        key: 'phone',
        label: 'Téléphone',
        keyboardType: TextInputType.phone,
        isPhone: true,
        onefopSection: 'S0.Q5',
        dsmoField: 'telephone',
      ),
      EntityField(
        key: 'phone2',
        label: 'Téléphone secondaire',
        keyboardType: TextInputType.phone,
        isPhone: true,
        required: false,
        dsmoField: 'telephone2',
      ),
      EntityField(
        key: 'poBox',
        label: 'Boîte postale',
        hint: 'BP',
        required: false,
        dsmoField: 'boitePostale',
      ),
    ],
  ),
};
