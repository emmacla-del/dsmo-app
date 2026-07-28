// Shared label maps for campaign-related enums, kept in one place so the
// list screen and detail screen can't drift out of sync with each other
// or with the Prisma enums in prisma/schema.prisma.

const campaignTypes = ['QUARTERLY', 'SEMESTER', 'ANNUAL'];
const campaignTypeLabels = {
  'QUARTERLY': 'Trimestrielle',
  'SEMESTER': 'Semestrielle',
  'ANNUAL': 'Annuelle',
};

// Which form a campaign actually gates. Mirrors SubmissionModule in
// prisma/schema.prisma — activating a campaign opens the matching
// SubmissionRound for this module.
const collectionTypes = ['ONEFOP', 'DSMO'];
const collectionTypeLabels = {
  'ONEFOP': 'Questionnaire ONEFOP',
  'DSMO': 'Déclaration DSMO',
};

// The campaign name is one of these two official titles, picked via the
// collection-type dropdown rather than typed freely — avoids typos and
// keeps every campaign's name consistent with the program it actually
// gates.
const campaignNameByCollectionType = {
  'ONEFOP':
      "COLLECTE DES DONNEES SUR LES EMPLOIS CREES PAR LE SECTEUR MODERNE DE L'ECONOMIE",
  'DSMO': "DECLARATION SUR LA SITUATION DE LA MAIN D'OEUVRE",
};

/// Preview-only mirror of CampaignService.buildPeriodSuffix — the backend is
/// what actually computes and stores the final name, this just lets the
/// create-campaign form show the admin what it will end up being before
/// they submit.
String campaignPeriodSuffix(String type, DateTime startDate) {
  final year = startDate.year;
  final quarter = ((startDate.month - 1) ~/ 3) + 1; // 1..4

  if (type == 'SEMESTER') {
    const semesterOrdinals = ['PREMIER', 'DEUXIEME'];
    final semester = quarter <= 2 ? 0 : 1;
    return "POUR LE ${semesterOrdinals[semester]} SEMESTRE $year";
  }
  if (type == 'ANNUAL') {
    return "POUR L'ANNEE $year";
  }
  const quarterOrdinals = ['PREMIER', 'DEUXIEME', 'TROISIEME', 'QUATRIEME'];
  return 'POUR LE ${quarterOrdinals[quarter - 1]} TRIMESTRE $year';
}

String campaignFullNamePreview(
    String collectionType, String type, DateTime? startDate) {
  final base = campaignNameByCollectionType[collectionType] ?? collectionType;
  if (startDate == null) return base;
  return '$base ${campaignPeriodSuffix(type, startDate)}';
}

const entityTypes = ['ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG'];
const entityTypeLabels = {
  'ENTREPRISE': 'Entreprise',
  'COOPERATIVE': 'Coopérative',
  'CTD': 'CTD',
  'ONG': 'ONG',
};

// Mirrors enum CampaignStatus in prisma/schema.prisma
const campaignStatuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'ARCHIVED'];
const campaignStatusLabels = {
  'DRAFT': 'Brouillon',
  'ACTIVE': 'Active',
  'PAUSED': 'En pause',
  'CLOSED': 'Clôturée',
  'ARCHIVED': 'Archivée',
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
  'NOT_STARTED': 'Non commencée',
  'PENDING': 'En attente',
  'IN_PROGRESS': 'En cours',
  'SUBMITTED': 'Soumise',
  'VALIDATED': 'Validée',
  'LATE': 'En retard',
  'EXEMPT': 'Exemptée',
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
  'CAMPAIGN_ANNOUNCEMENT': 'Annonce de campagne',
  'DEADLINE_APPROACHING': 'Échéance approchante',
  'FINAL_REMINDER': 'Dernier rappel',
  'DEADLINE_EXTENDED': 'Prorogation',
  'CAMPAIGN_EXPIRED': 'Campagne clôturée (auto)',
};
