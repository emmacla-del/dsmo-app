// Shared label maps for campaign-related enums, kept in one place so the
// list screen and detail screen can't drift out of sync with each other
// or with the Prisma enums in prisma/schema.prisma.

import 'package:flutter/widgets.dart' show Locale;

import '../../core/i18n/localized_text.dart';

const campaignTypes = ['QUARTERLY', 'SEMESTER', 'ANNUAL'];
const campaignTypeLabels = {
  'QUARTERLY': LocalizedText(fr: 'Trimestrielle', en: 'Quarterly'),
  'SEMESTER': LocalizedText(fr: 'Semestrielle', en: 'Semi-annual'),
  'ANNUAL': LocalizedText(fr: 'Annuelle', en: 'Annual'),
};

// Which form a campaign actually gates. Mirrors SubmissionModule in
// prisma/schema.prisma — activating a campaign opens the matching
// SubmissionRound for this module.
const collectionTypes = ['ONEFOP', 'DSMO'];
const collectionTypeLabels = {
  'ONEFOP': LocalizedText(fr: 'Questionnaire ONEFOP', en: 'ONEFOP Questionnaire'),
  'DSMO': LocalizedText(fr: 'Déclaration DSMO', en: 'DSMO Declaration'),
};

// The campaign name is one of these two official titles, picked via the
// collection-type dropdown rather than typed freely — avoids typos and
// keeps every campaign's name consistent with the program it actually
// gates. This is a PREVIEW only: the backend independently computes and
// stores the final name (see campaignFullNamePreview below), so localizing
// this display text does not change what gets submitted/stored.
const campaignNameByCollectionType = {
  'ONEFOP': LocalizedText(
    fr: "COLLECTE DES DONNEES SUR LES EMPLOIS CREES PAR LE SECTEUR MODERNE DE L'ECONOMIE",
    en: "DATA COLLECTION ON JOBS CREATED BY THE MODERN SECTOR OF THE ECONOMY",
  ),
  'DSMO': LocalizedText(
    fr: "DECLARATION SUR LA SITUATION DE LA MAIN D'OEUVRE",
    en: "DECLARATION ON THE LABOUR FORCE SITUATION",
  ),
};

/// Preview-only mirror of CampaignService.buildPeriodSuffix — the backend is
/// what actually computes and stores the final name, this just lets the
/// create-campaign form show the admin what it will end up being before
/// they submit.
String campaignPeriodSuffix(String type, DateTime startDate, Locale locale) {
  final year = startDate.year;
  final quarter = ((startDate.month - 1) ~/ 3) + 1; // 1..4
  final isEn = locale.languageCode == 'en';

  if (type == 'SEMESTER') {
    const semesterOrdinalsFr = ['PREMIER', 'DEUXIEME'];
    const semesterOrdinalsEn = ['FIRST', 'SECOND'];
    final semester = quarter <= 2 ? 0 : 1;
    final ordinal =
        isEn ? semesterOrdinalsEn[semester] : semesterOrdinalsFr[semester];
    return isEn
        ? 'FOR THE $ordinal HALF-YEAR $year'
        : "POUR LE $ordinal SEMESTRE $year";
  }
  if (type == 'ANNUAL') {
    return isEn ? 'FOR THE YEAR $year' : "POUR L'ANNEE $year";
  }
  const quarterOrdinalsFr = ['PREMIER', 'DEUXIEME', 'TROISIEME', 'QUATRIEME'];
  const quarterOrdinalsEn = ['FIRST', 'SECOND', 'THIRD', 'FOURTH'];
  final ordinal =
      isEn ? quarterOrdinalsEn[quarter - 1] : quarterOrdinalsFr[quarter - 1];
  return isEn
      ? 'FOR THE $ordinal QUARTER $year'
      : 'POUR LE $ordinal TRIMESTRE $year';
}

String campaignFullNamePreview(
    String collectionType, String type, DateTime? startDate, Locale locale) {
  final base =
      campaignNameByCollectionType[collectionType]?.of(locale) ?? collectionType;
  if (startDate == null) return base;
  return '$base ${campaignPeriodSuffix(type, startDate, locale)}';
}

const entityTypes = ['ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG'];
const entityTypeLabels = {
  'ENTREPRISE': LocalizedText(fr: 'Entreprise', en: 'Company'),
  'COOPERATIVE': LocalizedText(fr: 'Coopérative', en: 'Cooperative'),
  'CTD': LocalizedText.same('CTD'),
  'ONG': LocalizedText(fr: 'ONG', en: 'NGO'),
};

// Mirrors enum CampaignStatus in prisma/schema.prisma
const campaignStatuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'ARCHIVED'];
const campaignStatusLabels = {
  'DRAFT': LocalizedText(fr: 'Brouillon', en: 'Draft'),
  'ACTIVE': LocalizedText.same('Active'),
  'PAUSED': LocalizedText(fr: 'En pause', en: 'Paused'),
  'CLOSED': LocalizedText(fr: 'Clôturée', en: 'Closed'),
  'ARCHIVED': LocalizedText(fr: 'Archivée', en: 'Archived'),
};

// Mirrors enum SubmissionStatus in prisma/schema.prisma
const submissionStatuses = [
  'NOT_STARTED',
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'VALIDATED',
  'LATE',
  'EXEMPT',
];
const submissionStatusLabels = {
  'NOT_STARTED': LocalizedText(fr: 'Non commencée', en: 'Not started'),
  'PENDING': LocalizedText(fr: 'En attente', en: 'Pending'),
  'IN_PROGRESS': LocalizedText(fr: 'En cours', en: 'In progress'),
  'SUBMITTED': LocalizedText(fr: 'Soumise', en: 'Submitted'),
  'VALIDATED': LocalizedText(fr: 'Validée', en: 'Validated'),
  'LATE': LocalizedText(fr: 'En retard', en: 'Late'),
  'EXEMPT': LocalizedText(fr: 'Exemptée', en: 'Exempt'),
};

// Reminder types an admin can manually trigger via the "send reminder" dialog.
// CAMPAIGN_EXPIRED is deliberately excluded — it's only ever sent automatically
// by CampaignSchedulerService when a deadline passes, never picked by an admin.
const reminderTypes = [
  'CAMPAIGN_ANNOUNCEMENT',
  'DEADLINE_APPROACHING',
  'FINAL_REMINDER',
  'DEADLINE_EXTENDED',
];

// All reminder types, including automatic ones, for displaying history.
// Mirrors CampaignService.getReminderSubject/Message.
const reminderTypeLabels = {
  'CAMPAIGN_ANNOUNCEMENT': LocalizedText(fr: 'Annonce de campagne', en: 'Campaign announcement'),
  'DEADLINE_APPROACHING': LocalizedText(fr: 'Échéance approchante', en: 'Deadline approaching'),
  'FINAL_REMINDER': LocalizedText(fr: 'Dernier rappel', en: 'Final reminder'),
  'DEADLINE_EXTENDED': LocalizedText(fr: 'Prorogation', en: 'Deadline extended'),
  'CAMPAIGN_EXPIRED': LocalizedText(fr: 'Campagne clôturée (auto)', en: 'Campaign closed (auto)'),
};
