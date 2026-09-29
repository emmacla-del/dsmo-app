/**
 * Contextual tooltips providing statistical definitions for ambiguous
 * concepts. Ported 1:1 from lib/screens/onefop/wizard/vt_wizard_constants.dart
 * (kFieldTooltips) — each explains what CAM-LEAP/ONEFOP means by the term in
 * the context of this specific question, including what should be counted
 * and examples where helpful.
 */
export const VT_FIELD_TOOLTIPS: Record<string, { fr: string; en: string }> = {
  // Section 1 - Identification
  VT1_1: {
    fr: "Code d'identification officiel à 7-9 caractères délivré par le MINEFOP.",
    en: "Official 7-9 character identification code issued by MINEFOP.",
  },
  VT1_3: {
    fr: "Acronyme ou abréviation officielle de la structure (ex: CFPR, CFP-B).",
    en: "Official acronym or abbreviation of the institution (e.g., CFPR, CFP-B).",
  },
  VT1_9: {
    fr: "Urbain si situé en agglomération / périmètre communal ; Rural en zone villageoise.",
    en: "Urban if located in city/town limits; Rural for village or countryside.",
  },
  VT1_10: {
    fr: "Public si créé par l'État ou collectivité territoriale ; Privé sous agrément ministériel.",
    en: "Public if state or council founded; Private if accredited non-governmental.",
  },
  VT1_13: {
    fr: "Indique si des activités pédagogiques et des apprenants sont actifs cette année académique. Ne pas déclarer un centre temporairement fermé.",
    en: "Indicates whether training courses and trainees are currently active this academic year. Do not declare a temporarily closed center.",
  },
  VT1_17: {
    fr: "Fonction de la personne certifiant la déclaration (ex: Directeur, Promoteur, SG).",
    en: "Official title of the person certifying this census form (e.g. Director, Promoter).",
  },

  // Section 2 - Infrastructure & Agreements
  VT2_1: {
    fr: "Pour cette déclaration, inclure les conventions formelles avec l'État concernant les stages académiques, stages professionnels, stages pré-emploi ou l'insertion. Exclure les contacts informels sans convention signée.",
    en: "For this declaration, include formal agreements with the Government concerning academic internships, work placements, pre-employment internships or insertion. Exclude informal contacts without signed agreement.",
  },
  VT2_3: {
    fr: "Nombre total de bâtiments ou emplacements physiques où votre structure dispense des formations, y compris le site principal.",
    en: "Total number of buildings or physical locations where your institution provides training, including the main site.",
  },
  VT2_6: {
    fr: "Pour cette déclaration, inclure les formateurs ayant suivi une formation certifiée ou qualifiante en éducation spécialisée ou pédagogie adaptée aux besoins éducatifs spéciaux.",
    en: "For this declaration, include trainers who have completed certified or qualifying training in special education or teaching methods for special educational needs.",
  },
  VT2_10: {
    fr: "Bureau privé dédié au directeur, distinct des salles de formation et des espaces partagés.",
    en: "Private office dedicated to the director, separate from training rooms and shared spaces.",
  },
  VT2_11: {
    fr: "Dispositif formalisé et affiché d'évacuation en cas d'incendie ou de sinistre, conforme aux normes de sécurité.",
    en: "Formalized and displayed emergency evacuation procedure for fire or disaster, compliant with safety standards.",
  },
  VT2_14: {
    fr: "Agrément officiel ou autorisation d'ouverture délivré par le MINEFOP ou l'autorité compétente. Exclure les demandes en cours non encore approuvées.",
    en: "Official accreditation or opening authorization issued by MINEFOP or competent authority. Exclude pending applications not yet approved.",
  },
  VT2_24: {
    fr: "Source d'énergie actuellement en état de marche et utilisable pour les activités de formation.",
    en: "Energy source currently operational and usable for training activities.",
  },
  VT2_31: {
    fr: "Infirmerie équipée pour dispenser des premiers soins, avec personnel qualifié ou kit médical de base. Exclure un simple bureau de repos.",
    en: "Dispensary equipped to provide first aid, with qualified personnel or basic medical kit. Exclude a simple rest room.",
  },
  VT2_32: {
    fr: "Bibliothèque avec collections de livres, manuels ou ressources documentaires accessibles aux apprenants et formateurs. Doit être fonctionnelle et utilisée.",
    en: "Library with collections of books, manuals or documentary resources accessible to trainees and trainers. Must be functional and in use.",
  },
  VT2_34: {
    fr: "Conseil d'établissement qui se réunit régulièrement selon le règlement intérieur. Exclure un conseil qui existe sur papier mais ne se réunit pas.",
    en: "School council that meets regularly according to internal regulations. Exclude a council that exists on paper but does not meet.",
  },
  VT2_41: {
    fr: "Espaces extérieurs aménagés dédiés aux activités récréatives ou sportives des apprenants.",
    en: "Outdoor spaces dedicated to recreational or sports activities for trainees.",
  },
  VT2_51: {
    fr: "Structure d'hébergement au sein du centre permettant aux apprenants de résider pendant leur formation.",
    en: "Accommodation facility within the center allowing trainees to reside during their training.",
  },
  VT2_53: {
    fr: "Service de restauration offrant des repas aux apprenants pendant les heures de formation.",
    en: "Catering service offering meals to trainees during training hours.",
  },

  // Section 3 - Safety & Equipment
  VT3_7: {
    fr: "Équipements de protection individuelle appropriés aux spécialités enseignées (gants, lunettes, casques, blouses, etc.).",
    en: "Personal protective equipment appropriate to the specialties taught (gloves, goggles, helmets, coats, etc.).",
  },
  VT3_9: {
    fr: "Pharmacie ou trousse médicale contenant des produits de premiers secours pour traiter les blessures mineures survenant en atelier ou en formation.",
    en: "Pharmacy or medical kit containing first aid supplies to treat minor injuries occurring in workshops or training.",
  },
  VT3_11: {
    fr: "Dispositif de sécurité maintenu à jour, vérifié régulièrement et opérationnel pour les activités de formation en cours.",
    en: "Safety device kept up to date, checked regularly and operational for current training activities.",
  },
  VT3_12: {
    fr: "Pour cette déclaration, inclure les personnes ayant suivi une formation certifiée en secourisme ou premiers secours. Indiquer le nombre total actuellement formé.",
    en: "For this declaration, include persons who have completed certified training in first aid or emergency care. Indicate the total number currently trained.",
  },

  // Section 5 - Learning Materials
  VT5_1: {
    fr: "Manuels, guides pédagogiques ou supports didactiques officiels mis à disposition des apprenants pour l'année académique en cours.",
    en: "Manuals, educational guides or official teaching materials made available to trainees for the current academic year.",
  },
  VT5_3: {
    fr: "Manuels, référentiels ou supports pédagogiques destinés aux formateurs pour préparer et dispenser les cours de l'année en cours.",
    en: "Manuals, curricula or teaching materials for trainers to prepare and deliver courses for the current year.",
  },

  // Section 6 - Guidance & Support
  VT6_1: {
    fr: "Pour cette déclaration, inclure tout accompagnement formalisé dans le choix des filières : entretiens d'orientation, tests d'aptitude, conseils individuels ou collectifs.",
    en: "For this declaration, include any formalized support in choosing training paths: guidance interviews, aptitude tests, individual or group counseling.",
  },
  VT6_5: {
    fr: "Cellule, service ou structure dédiée à l'accompagnement des sortants dans leur recherche d'emploi ou insertion professionnelle.",
    en: "Unit, service or structure dedicated to supporting graduates in their job search or professional integration.",
  },
  VT6_7: {
    fr: "Outil ou dispositif aidant les apprenants ou sortants dans leur recherche d'emploi : plateforme d'offres, base de données d'employeurs, ateliers de techniques de recherche d'emploi.",
    en: "Tool or mechanism helping trainees or graduates in their job search: job board platform, employer database, job search technique workshops.",
  },

  // Section 7 - Cross-cutting Themes
  VT7_1: {
    fr: "Directives formellement inscrites dans le règlement intérieur concernant la prévention, la sensibilisation ou la prise en charge du VIH/SIDA au sein de l'établissement.",
    en: "Directives formally included in internal regulations concerning HIV/AIDS prevention, awareness or management within the institution.",
  },
  VT7_6: {
    fr: "Procédures disciplinaires écrites et appliquées en cas de violation des directives liées au VIH/SIDA, à la discrimination ou au harcèlement.",
    en: "Written and enforced disciplinary procedures in case of violation of directives related to HIV/AIDS, discrimination or harassment.",
  },
};
