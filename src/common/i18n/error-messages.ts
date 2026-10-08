// src/common/i18n/error-messages.ts
//
// Every message the API returns in an error, in French and in English.
//
// The ~340 `throw new XxxException(...)` sites keep their message as it is
// (most are French, some English); LocalizedHttpExceptionFilter translates
// the outgoing message to the language the client asked for with the
// X-Locale header, French by default. This file is that translation table.
//
// An entry is { fr, en }. {0}, {1}... stand for the variable parts of a
// message built with a template literal (a name, a number, a status); they
// are captured from whichever side matched and put back, untouched, in the
// other. `also` lists other forms the same message is thrown in -- the few
// sites that already send "français / English" in one string.
//
// error-messages.spec.ts reads the whole backend and fails if a thrown
// message has no entry here, so a new message cannot ship untranslated.

export type ErrorLocale = 'fr' | 'en';

export interface BilingualMessage {
  fr: string;
  en: string;
  also?: string[];
}

/** The language a request asked for: X-Locale "en", otherwise French. */
export function errorLocaleFrom(header: string | string[] | undefined): ErrorLocale {
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('en') ? 'en' : 'fr';
}

export const ERROR_MESSAGES: BilingualMessage[] = [
  // ── Authentication and accounts ──────────────────────────────────────
  { fr: 'Authentification requise.', en: 'Authentication required.' },
  { fr: 'Votre compte est en attente d\'approbation par un administrateur.', en: 'Your account is awaiting approval by an administrator.' },
  { fr: 'Votre compte a été désactivé. Contactez un administrateur.', en: 'Your account has been deactivated. Contact an administrator.' },
  {
    fr: "Votre demande d'inscription a été rejetée. Pour plus d'informations, contactez votre délégation régionale du MINEFOP ou l'ONEFOP.",
    en: 'Your registration request was rejected. For more information, contact your MINEFOP regional delegation or ONEFOP.',
  },
  { fr: 'Trop de tentatives échouées. Réessayez dans {0} minute(s).', en: 'Too many failed attempts. Try again in {0} minute(s).' },
  { fr: 'Utilisateur introuvable.', en: 'User not found.' },
  { fr: 'Utilisateur non trouvé', en: 'User not found' },
  { fr: 'Impossible d\'envoyer le code de vérification pour le moment. Réessayez.', en: 'The verification code cannot be sent right now. Try again.' },
  { fr: 'Code de vérification incorrect.', en: 'Incorrect verification code.' },
  { fr: 'Code de vérification invalide ou expiré. Reconnectez-vous.', en: 'Invalid or expired verification code. Sign in again.' },
  {
    fr: 'La double authentification est obligatoire pour les comptes MINEFOP selon la politique de sécurité en vigueur.',
    en: 'Two-factor authentication is mandatory for MINEFOP accounts under the current security policy.',
  },
  { fr: 'Informations incorrectes.', en: 'Incorrect information.' },
  { fr: 'Le mot de passe doit contenir au moins {0} caractères', en: 'The password must contain at least {0} characters' },
  { fr: 'Token et nouveau mot de passe requis', en: 'Token and new password required' },
  { fr: 'Lien de réinitialisation invalide ou expiré', en: 'Invalid or expired reset link' },
  { fr: 'Mot de passe actuel et nouveau mot de passe requis', en: 'Current password and new password required' },
  { fr: 'Mot de passe actuel incorrect.', en: 'Incorrect current password.' },
  { fr: 'Token requis', en: 'Token required' },
  { fr: 'Lien de vérification invalide ou expiré', en: 'Invalid or expired verification link' },
  { fr: 'Impossible d\'envoyer l\'e-mail pour le moment. Réessayez plus tard.', en: 'The email cannot be sent right now. Try again later.' },
  {
    fr: 'La réinitialisation par administrateur est temporairement indisponible. Utilisez le flux de questions de sécurité côté utilisateur.',
    en: 'Administrator password reset is temporarily unavailable. Use the security-questions flow on the user side.',
  },
  { fr: 'Identifiant non disponible pour ce compte. Contactez le support DSMO.', en: 'No identifier is available for this account. Contact DSMO support.' },
  { fr: 'Aucune attestation n\'est disponible pour ce compte.', en: 'No certificate is available for this account.' },

  // ── Registration, companies, establishments ──────────────────────────
  { fr: 'Rôle invalide pour la création directe', en: 'Invalid role for direct creation' },
  { fr: 'Un utilisateur avec cet email existe déjà', en: 'A user with this email already exists' },
  { fr: 'Une entreprise avec ce numéro contribuable existe déjà', en: 'A company with this taxpayer number already exists' },
  { fr: 'Type d\'entité inconnu.', en: 'Unknown entity type.' },
  { fr: 'Type d\'entité inconnu : {0}', en: 'Unknown entity type: {0}' },
  { fr: 'Email ou numéro contribuable déjà utilisé', en: 'Email or taxpayer number already in use' },
  { fr: 'Le type d\'entité est obligatoire pour générer l\'identifiant d\'établissement.', en: 'The entity type is required to generate the establishment identifier.' },
  { fr: 'L\'arrondissement est obligatoire pour générer l\'identifiant d\'établissement.', en: 'The subdivision is required to generate the establishment identifier.' },
  { fr: 'Code d\'arrondissement introuvable pour cet établissement.', en: 'Subdivision code not found for this establishment.' },
  { fr: 'Un identifiant d\'établissement existe déjà pour ce territoire.', en: 'An establishment identifier already exists for this territory.' },
  {
    fr: 'Le quota d\'identification pour ce type d\'entité cette année est épuisé. Contactez l\'ONEFOP.',
    en: 'The identifier quota for this entity type this year is exhausted. Contact ONEFOP.',
  },
  { fr: 'Entreprise non trouvée', en: 'Company not found' },
  { fr: 'Entreprise introuvable pour ce compte.', en: 'No company found for this account.' },
  { fr: 'Aucune entreprise trouvée pour cet utilisateur.', en: 'No company found for this user.' },
  { fr: 'Aucun profil entreprise trouvé.', en: 'No company profile found.', also: ['No company profile found'] },
  { fr: 'Aucun profil d\'entreprise associé à ce compte.', en: 'No company profile is linked to this account.' },
  { fr: 'Le numéro contribuable (NIU) est déjà utilisé.', en: 'The taxpayer number (NIU) is already in use.' },
  { fr: 'Cet utilisateur n\'est pas en attente d\'approbation', en: 'This user is not awaiting approval' },
  { fr: 'Le motif de rejet est obligatoire.', en: 'A reason for rejection is required.' },
  { fr: 'Le message de demande de compléments est obligatoire.', en: 'The message requesting additional information is required.' },
  { fr: 'Les demandes de compléments concernent uniquement les comptes entreprise.', en: 'Requests for additional information apply to company accounts only.' },
  { fr: 'Seul un compte entreprise peut renvoyer son dossier.', en: 'Only a company account can resubmit its file.' },
  { fr: 'Aucun complément n\'a été demandé pour ce compte.', en: 'No additional information was requested for this account.' },
  { fr: 'Ce dossier a déjà été renvoyé ou traité entre-temps. Rechargez la page.', en: 'This file has already been resubmitted or processed in the meantime. Reload the page.' },
  { fr: 'La confirmation « structure centrale » est obligatoire pour approuver une administration.', en: 'The "central structure" confirmation is required to approve an administration.' },
  { fr: 'Impossible d\'approuver : {0} est vide. Demandez une correction.', en: 'Cannot approve: {0} is empty. Request a correction.' },
  { fr: 'Impossible d\'approuver : {0} sont vides. Demandez une correction.', en: 'Cannot approve: {0} are empty. Request a correction.' },
  { fr: 'Vérifiez chaque information de l\'entité avant d\'approuver : {0}.', en: "Check each of the entity's details before approving: {0}." },
  { fr: 'Date de début invalide.', en: 'Invalid start date.' },
  { fr: 'Date de fin invalide.', en: 'Invalid end date.' },
  { fr: 'Le benchmarking sera disponible après approbation de votre questionnaire ONEFOP.', en: 'Benchmarking will be available once your ONEFOP questionnaire is approved.' },

  // ── Staff accounts, roles, territory ─────────────────────────────────
  { fr: 'Vous ne pouvez pas modifier votre propre rôle', en: 'You cannot change your own role' },
  { fr: 'Rôle invalide', en: 'Invalid role' },
  { fr: 'Rôle inconnu : {0}', en: 'Unknown role: {0}' },
  { fr: 'Le rôle des comptes entreprise ne peut pas être modifié', en: 'The role of company accounts cannot be changed' },
  { fr: 'Les utilisateurs divisionnaires doivent avoir une région et un département assignés', en: 'Divisional users must be assigned a region and a division' },
  { fr: 'Les utilisateurs régionaux doivent avoir une région assignée', en: 'Regional users must be assigned a region' },
  { fr: 'Vous ne pouvez pas modifier votre propre territoire', en: 'You cannot change your own territory' },
  { fr: 'Vous ne pouvez pas supprimer votre propre compte', en: 'You cannot delete your own account' },
  { fr: 'Vous ne pouvez pas réactiver votre propre compte', en: 'You cannot reactivate your own account' },
  { fr: 'Vous ne pouvez pas suspendre votre propre compte', en: 'You cannot suspend your own account' },
  {
    fr: 'Impossible de supprimer cet utilisateur : des données liées existent (déclarations, soumissions, notifications...). Suspendez le compte à la place.',
    en: 'This user cannot be deleted: related data exists (declarations, submissions, notifications...). Suspend the account instead.',
  },
  { fr: 'Ce compte ne relève pas de votre périmètre d\'administration.', en: 'This account is outside your administrative scope.' },
  { fr: 'Privilèges territoriaux insuffisants.', en: 'Insufficient territorial privileges.' },
  { fr: 'Action non autorisée hors de votre région d\'affectation ({0}).', en: 'Action not allowed outside your assigned region ({0}).' },
  { fr: 'Action non autorisée hors de votre département d\'affectation ({0}).', en: 'Action not allowed outside your assigned division ({0}).' },
  { fr: 'Accès refusé.', en: 'Access denied.', also: ['Access denied'] },
  { fr: 'Accès interdit.', en: 'Access forbidden.' },
  { fr: 'Privilèges insuffisants.', en: 'Insufficient privileges.' },
  { fr: 'Administrateur introuvable.', en: 'Administrator not found.' },

  // ── Staff invitations ────────────────────────────────────────────────
  { fr: 'Ce lien d\'invitation est invalide ou a expiré.', en: 'This invitation link is invalid or has expired.' },
  { fr: 'Ce lien a déjà été utilisé : un compte existe pour cette adresse. Connectez-vous.', en: 'This link has already been used: an account exists for this address. Sign in.' },
  {
    fr: 'Ce lien d\'invitation n\'est plus valable (expiré, révoqué ou complet). Demandez un nouveau lien.',
    en: 'This invitation link is no longer valid (expired, revoked or full). Ask for a new link.',
  },
  { fr: 'Vous n\'êtes pas autorisé à gérer les liens d\'invitation.', en: 'You are not allowed to manage invitation links.' },
  { fr: 'Niveau invalide.', en: 'Invalid level.' },
  { fr: 'Donnez au lien un nom (120 caractères au plus).', en: 'Give the link a name (120 characters at most).' },
  { fr: 'La durée doit être comprise entre 1 et {0} jours.', en: 'The validity must be between 1 and {0} days.' },
  { fr: 'Le nombre d\'utilisations doit être compris entre 1 et {0}.', en: 'The number of uses must be between 1 and {0}.' },
  { fr: 'Lien introuvable.', en: 'Link not found.' },
  { fr: 'Adresse e-mail invalide.', en: 'Invalid email address.' },
  { fr: 'Le prénom et le nom sont obligatoires.', en: 'First name and last name are required.' },
  { fr: 'Un compte existe déjà pour cette adresse.', en: 'An account already exists for this address.' },
  { fr: 'Ce service n\'est pas couvert par ce lien.', en: 'This service is not covered by this link.' },
  { fr: 'Ce poste n\'existe pas dans ce service.', en: 'This post does not exist in this service.' },
  { fr: 'Seul le super administrateur peut inviter un administrateur central.', en: 'Only the super administrator can invite a central administrator.' },
  { fr: 'Vous n\'êtes pas autorisé à inviter des agents.', en: 'You are not allowed to invite officers.' },
  { fr: 'Service inconnu dans l\'organigramme.', en: 'Unknown service in the organisation chart.' },
  { fr: 'Ce service ne peut pas recevoir d\'invitation.', en: 'This service cannot receive invitations.' },
  { fr: 'Le rôle d\'administrateur ONEFOP ne s\'accorde que sur un poste central.', en: 'The ONEFOP administrator role can only be granted on a central post.' },

  // ── Territory references ─────────────────────────────────────────────
  { fr: 'Région introuvable.', en: 'Region not found.' },
  { fr: 'Région introuvable (ID: \'{0}\').', en: "Region not found (ID: '{0}')." },
  { fr: 'Région inconnue : \'{0}\'.', en: "Unknown region: '{0}'." },
  { fr: 'Département introuvable (ID: \'{0}\').', en: "Division not found (ID: '{0}')." },
  { fr: 'Département inconnu : \'{0}\'.', en: "Unknown division: '{0}'." },
  { fr: 'Le département \'{0}\' n\'appartient pas à la région \'{1}\' (il appartient à la région \'{2}\').', en: "Division '{0}' does not belong to region '{1}' (it belongs to region '{2}')." },
  { fr: 'Le département \'{0}\' n\'appartient pas à la région \'{1}\'.', en: "Division '{0}' does not belong to region '{1}'." },
  { fr: 'Arrondissement introuvable (ID: \'{0}\').', en: "Subdivision not found (ID: '{0}')." },
  { fr: 'Arrondissement inconnu : \'{0}\'.', en: "Unknown subdivision: '{0}'." },
  { fr: 'L\'arrondissement \'{0}\' n\'appartient pas au département \'{1}\' (il appartient au département \'{2}\').', en: "Subdivision '{0}' does not belong to division '{1}' (it belongs to division '{2}')." },
  { fr: 'L\'arrondissement \'{0}\' n\'appartient pas au département \'{1}\'.', en: "Subdivision '{0}' does not belong to division '{1}'." },
  { fr: 'La région est obligatoire.', en: 'The region is required.' },
  { fr: 'Le département est obligatoire.', en: 'The division is required.' },
  { fr: 'L\'arrondissement est obligatoire.', en: 'The subdivision is required.' },
  { fr: 'Impossible de supprimer une région encore liée à des entreprises ou départements.', en: 'A region still linked to companies or divisions cannot be deleted.' },
  { fr: 'Secteur introuvable.', en: 'Sector not found.' },
  { fr: 'Impossible de supprimer un secteur encore lié à des entreprises.', en: 'A sector still linked to companies cannot be deleted.' },

  // ── Campaigns ────────────────────────────────────────────────────────
  { fr: 'L\'année de référence est obligatoire pour les campagnes ONEFOP (ex: 2026).', en: 'The reference year is required for ONEFOP campaigns (e.g. 2026).' },
  { fr: 'Le trimestre de référence est obligatoire pour les campagnes ONEFOP (valeur entre 1 et 4).', en: 'The reference quarter is required for ONEFOP campaigns (a value between 1 and 4).' },
  { fr: 'Le trimestre de référence doit être compris entre 1 et 4.', en: 'The reference quarter must be between 1 and 4.' },
  { fr: 'Une campagne ONEFOP{0} existe déjà pour la période {1}-T{2} (campagne {3}).', en: 'An ONEFOP{0} campaign already exists for the period {1}-Q{2} (campaign {3}).' },
  { fr: 'L\'objet de la campagne doit valoir {0}.', en: 'The campaign purpose must be {0}.' },
  { fr: 'Campagne introuvable', en: 'Campaign not found' },
  { fr: 'Campagne introuvable.', en: 'Campaign not found.' },
  { fr: 'La période de référence (année et trimestre) ne peut pas être modifiée après création.', en: 'The reference period (year and quarter) cannot be changed after creation.' },
  { fr: 'collectionType doit valoir ONEFOP ou DSMO', en: 'collectionType must be ONEFOP or DSMO' },
  { fr: 'Une campagne d\'inscription ne s\'active pas : elle porte des cibles, pas une collecte.', en: 'A registration campaign is not activated: it carries targets, not a data collection.' },
  { fr: 'Une campagne d\'inscription n\'envoie pas de relances : elle porte des cibles, pas une collecte.', en: 'A registration campaign does not send reminders: it carries targets, not a data collection.' },
  { fr: 'Une campagne d\'inscription {0} : elle porte des cibles, pas une collecte.', en: 'A registration campaign {0}: it carries targets, not a data collection.' },
  { fr: 'Seules les campagnes en brouillon ou en pause peuvent être activées', en: 'Only DRAFT or PAUSED campaigns can be activated' },
  { fr: 'La campagne est déjà archivée', en: 'The campaign is already archived' },
  {
    fr: 'Impossible de supprimer la campagne "{0}" : son statut est "{1}". Seules les campagnes à l\'état DRAFT peuvent être supprimées. Veuillez l\'archiver.',
    en: 'Campaign "{0}" cannot be deleted: its status is "{1}". Only DRAFT campaigns can be deleted. Archive it instead.',
  },
  {
    fr: 'Impossible de supprimer la campagne d\'inscription "{0}" : elle porte {1} cible(s). Supprimez d\'abord ses cibles dans Cibles et couverture.',
    en: 'Registration campaign "{0}" cannot be deleted: it carries {1} target(s). Delete its targets in Targets and coverage first.',
  },
  { fr: 'Impossible de supprimer la campagne "{0}" : des données liées existent ({1}).', en: 'Campaign "{0}" cannot be deleted: related data exists ({1}).' },

  // ── Pilotage: targets and coverage ───────────────────────────────────
  { fr: 'Le paramètre « year » est obligatoire.', en: 'The "year" parameter is required.' },
  { fr: 'Le paramètre « year » doit être une année entre 2000 et 2100.', en: 'The "year" parameter must be a year between 2000 and 2100.' },
  { fr: 'Le corps de la requête est invalide.', en: 'The request body is invalid.' },
  { fr: 'Corps de requête invalide.', en: 'Invalid request body.' },
  { fr: 'Le champ « entries » doit être un tableau.', en: 'The "entries" field must be an array.' },
  { fr: '« central » doit être un objet ou null.', en: '"central" must be an object or null.' },
  {
    fr: 'Les objectifs d\'inscription annuels sont retirés. Utilisez GET /admin/pilotage/coverage/annual ou GET /admin/pilotage/campaigns/:id/quotas.',
    en: 'Annual registration targets have been withdrawn. Use GET /admin/pilotage/coverage/annual or GET /admin/pilotage/campaigns/:id/quotas.',
  },
  {
    fr: 'La couverture annuelle a désormais sa propre route. Utilisez GET /admin/pilotage/coverage/annual?year=YYYY.',
    en: 'Annual coverage now has its own route. Use GET /admin/pilotage/coverage/annual?year=YYYY.',
  },
  {
    fr: 'Les objectifs d\'inscription annuels sont retirés. Utilisez PUT /admin/pilotage/campaigns/:id/quotas.',
    en: 'Annual registration targets have been withdrawn. Use PUT /admin/pilotage/campaigns/:id/quotas.',
  },
  { fr: 'Le paramètre « semester » est obligatoire.', en: 'The "semester" parameter is required.' },
  { fr: 'Le paramètre « semester » doit valoir 1 ou 2.', en: 'The "semester" parameter must be 1 or 2.' },
  { fr: 'Le semestre doit valoir 1 ou 2.', en: 'The semester must be 1 or 2.' },
  {
    fr: 'Le suivi des retours concerne uniquement les campagnes de collecte : une campagne d\'inscription porte des cibles, pas une collecte.',
    en: 'Return tracking applies to collection campaigns only: a registration campaign carries targets, not a data collection.',
  },
  { fr: 'Les objectifs de campagne concernent uniquement les campagnes ONEFOP.', en: 'Campaign targets apply to ONEFOP campaigns only.' },
  { fr: 'Un objectif existe déjà pour ce territoire.', en: 'A target already exists for this territory.' },
  { fr: 'Le corps contient {0} lignes, au-delà des {1} territoires connus.', en: 'The body contains {0} rows, more than the {1} known territories.' },
  { fr: 'La ligne {0} est invalide.', en: 'Row {0} is invalid.' },
  { fr: 'La ligne {0} : le champ « clear » doit valoir true.', en: 'Row {0}: the "clear" field must be true.' },
  { fr: 'La ligne {0} : l\'option « clear » s\'applique uniquement à une région entière.', en: 'Row {0}: the "clear" option applies to a whole region only.' },
  { fr: 'La ligne {0} : « clear » ne peut pas être combiné avec une valeur cible.', en: 'Row {0}: "clear" cannot be combined with a target value.' },
  { fr: 'La ligne {0} : un département vide n\'est pas un objectif régional.', en: 'Row {0}: an empty division is not a regional target.' },
  { fr: 'La ligne {0} : « {1} » doit être un entier positif ou nul.', en: 'Row {0}: "{1}" must be a non-negative integer.' },
  { fr: 'La ligne {0} répète un territoire déjà présent dans la requête.', en: 'Row {0} repeats a territory already present in the request.' },
  { fr: 'La région « {0} » mélange un objectif régional et des objectifs départementaux.', en: 'Region "{0}" mixes a regional target and divisional targets.' },
  { fr: 'La région « {0} » ne peut pas combiner « clear » avec d\'autres lignes.', en: 'Region "{0}" cannot combine "clear" with other rows.' },
  { fr: 'Aucune cible définie pour le ressort de cet administrateur.', en: "No target is defined for this administrator's jurisdiction." },

  // ── Data management, exports ────────────────────────────────────────
  {
    fr: 'L\'export Excel ONEFOP a été déplacé vers POST /data-management/export/submissions/excel (en flux).',
    en: 'ONEFOP Excel export has moved to POST /data-management/export/submissions/excel (streamed).',
  },
  { fr: 'Statut inconnu : {0}', en: 'Unknown status: {0}' },
  { fr: 'Année invalide : {0}', en: 'Invalid year: {0}' },
  { fr: 'Le type {0} ne relève pas du questionnaire formation professionnelle.', en: 'Type {0} does not fall under the vocational training questionnaire.' },
  { fr: 'Aucune déclaration approuvée trouvée pour l\'année {0}.', en: 'No approved declaration found for the year {0}.' },

  // ── DSMO declarations and notifications ─────────────────────────────
  { fr: 'PDF non disponible — numéro de suivi introuvable.', en: 'PDF not available — tracking number not found.' },
  { fr: 'Une déclaration pour l\'année {0} est déjà active.', en: 'A declaration for the year {0} is already active.' },
  { fr: 'Validation échouée: {0}', en: 'Validation failed: {0}' },
  {
    fr: 'Seuls les comptes divisionnaires, régionaux, centraux ou super administrateurs peuvent envoyer des notifications',
    en: 'Only DIVISIONAL, REGIONAL, CENTRAL, or SUPER_ADMIN users can send notifications',
  },
  {
    fr: 'Seuls les comptes divisionnaires, régionaux, centraux ou super administrateurs peuvent consulter les notifications',
    en: 'Only DIVISIONAL, REGIONAL, CENTRAL, or SUPER_ADMIN users can view notifications',
  },
  { fr: 'Aucun département n\'est affecté à cet utilisateur', en: 'User has no department assigned' },
  { fr: 'Impossible d\'envoyer à des entreprises hors de votre département', en: 'Cannot send to companies outside your department' },
  { fr: 'Aucune région n\'est affectée à cet utilisateur', en: 'User has no region assigned' },
  { fr: 'Impossible d\'envoyer à des entreprises hors de votre région', en: 'Cannot send to companies outside your region' },
  { fr: 'Aucune entreprise ne correspond aux filtres indiqués', en: 'No companies found matching the specified filters' },
  { fr: 'Notification introuvable', en: 'Notification not found' },
  { fr: 'Notification introuvable.', en: 'Notification not found.' },

  // ── MINEFOP organigramme ─────────────────────────────────────────────
  { fr: 'Le paramètre parentCode est obligatoire', en: 'parentCode query parameter is required' },
  { fr: 'Le paramètre positionType est obligatoire', en: 'positionType query parameter is required' },
  { fr: 'parentCode et positionType sont obligatoires', en: 'parentCode and positionType are required' },
  { fr: 'Le paramètre serviceCode est obligatoire', en: 'serviceCode query parameter is required' },
  { fr: 'Impossible de supprimer un service auquel des utilisateurs sont affectés.', en: 'Cannot delete service with assigned users.' },
  { fr: 'Service de code {0} introuvable', en: 'Service with code {0} not found' },
  { fr: 'Service d\'identifiant {0} introuvable', en: 'Service with id {0} not found' },
  { fr: 'Aucun service trouvé pour le rôle : {0}', en: 'No services found for role: {0}' },
  { fr: 'Service parent de code {0} introuvable', en: 'Parent service with code {0} not found' },
  { fr: 'Un service de code {0} existe déjà', en: 'Service with code {0} already exists' },
  {
    fr: 'Impossible de supprimer un service ayant {0} sous-service(s). Supprimez ou réaffectez d\'abord les sous-services.',
    en: 'Cannot delete service with {0} child(ren). Delete or reassign children first.',
  },
  { fr: 'Impossible de supprimer un service ayant {0} utilisateur(s) affecté(s). Réaffectez d\'abord les utilisateurs.', en: 'Cannot delete service with {0} assigned user(s). Reassign users first.' },
  { fr: 'Impossible de supprimer un service ayant {0} sous-service(s). Supprimez d\'abord les sous-services.', en: 'Cannot delete service with {0} child(ren). Delete children first.' },
  { fr: 'Un poste de type {0} existe déjà pour ce service', en: 'Position with type {0} already exists for this service' },
  { fr: 'Poste d\'identifiant {0} introuvable', en: 'Position with id {0} not found' },
  {
    fr: 'Le service {0} n\'a pas de parent — il ne peut pas porter un poste valide dans la cascade',
    en: 'Service {0} has no parent — it cannot be a valid position holder in the cascade',
  },

  // ── ONEFOP submissions and review ────────────────────────────────────
  { fr: 'Une soumission existe déjà pour ce trimestre', en: 'A submission already exists for this quarter' },
  {
    fr: 'Une déclaration est déjà en cours pour ce trimestre.',
    en: 'A declaration already exists for this quarter.',
    also: ['Une déclaration est déjà en cours pour ce trimestre. / A declaration already exists for this quarter.'],
  },
  {
    fr: 'Votre établissement n\'a pas encore d\'identifiant (code site). Impossible d\'enregistrer un brouillon avant son attribution.',
    en: 'Your establishment does not have an identifier (site code) yet. A draft cannot be saved before it is assigned.',
  },
  { fr: 'Soumission introuvable', en: 'Submission not found' },
  { fr: 'Type d\'entité invalide', en: 'Invalid entity type' },
  { fr: 'Type d\'entité non pris en charge : {0}', en: 'Unsupported entity type: {0}' },
  {
    fr: 'Type d\'entité non autorisé : votre compte est enregistré en tant que {0}, vous ne pouvez pas soumettre pour {1}.',
    en: 'Entity type not allowed: your account is registered as {0}, you cannot submit for {1}.',
  },
  { fr: 'Questionnaire d\'identifiant {0} introuvable', en: 'Questionnaire with id {0} not found' },
  { fr: 'La période de collecte n\'est pas ouverte aux soumissions.', en: 'The collection period is not open for submissions.' },
  { fr: 'La période de collecte « {0} » est close depuis le {1}.', en: 'The collection period "{0}" closed on {1}.' },
  { fr: 'La période de collecte « {0} » n\'est pas ouverte aux soumissions.', en: 'The collection period "{0}" is not open for submissions.' },
  {
    fr: 'Informations obligatoires manquantes : {0}. Veuillez compléter le formulaire avant de soumettre.',
    en: 'Missing required information: {0}. Please complete the form before submitting.',
    also: [
      'Informations obligatoires manquantes : {0}. Veuillez compléter le formulaire avant de soumettre. / Missing required information: {0}. Please complete the form before submitting.',
    ],
  },
  {
    fr: 'Le formulaire contient des tableaux déclarés « renseignés » avec des cellules manquantes ou non valides ({0} cellule(s) : {1}). Chaque cellule obligatoire doit être renseignée (saisissez 0 lorsqu\'il n\'y a eu aucune occurrence).',
    en: 'The form contains tables declared "reported" with missing or invalid cells ({0} cell(s): {1}). Every required cell must be completed (enter 0 when there were no occurrences).',
    also: [
      'Le formulaire contient des tableaux déclarés « renseignés » avec des cellules manquantes ou non valides ({0} cellule(s) : {1}). Chaque cellule obligatoire doit être renseignée (saisissez 0 lorsqu\'il n\'y a eu aucune occurrence). / Questionnaire contains REPORTED tables with missing or invalid cells ({0} cell(s): {1}). Every required cell must be explicitly completed (enter 0 if no occurrences).',
    ],
  },
  { fr: 'Statut de dossier inconnu.', en: 'Unknown file status.' },
  { fr: 'Type de questionnaire inconnu.', en: 'Unknown questionnaire type.' },
  { fr: 'Période inconnue.', en: 'Unknown period.' },
  { fr: 'Vous devez certifier la décision de rejet avant de confirmer.', en: 'You must certify the rejection decision before confirming.' },
  {
    fr: 'Seule la Direction Centrale ONEFOP ou le SuperAdmin National peut accorder une dispense légale (WAIVED).',
    en: 'Only the ONEFOP Central Directorate or the National SuperAdmin can grant a legal waiver (WAIVED).',
  },
  {
    fr: 'Le visa groupé requiert une certification et un engagement formel de la part de l\'officier ministériel.',
    en: 'Bulk endorsement requires a certification and a formal commitment from the ministerial officer.',
  },
  { fr: 'Aucun dossier sélectionné pour le visa groupé.', en: 'No file selected for bulk endorsement.' },
  { fr: 'Le rejet groupé requiert une certification formelle de la part de l\'officier ministériel.', en: 'Bulk rejection requires a formal certification from the ministerial officer.' },
  { fr: 'Aucun dossier sélectionné pour le rejet groupé.', en: 'No file selected for bulk rejection.' },
  { fr: 'La justification doit comporter au moins 10 caractères.', en: 'The justification must be at least 10 characters long.' },
  { fr: 'La justification de résolution doit comporter au moins 10 caractères.', en: 'The resolution justification must be at least 10 characters long.' },
  { fr: 'La justification du rejet doit comporter au moins 10 caractères.', en: 'The rejection justification must be at least 10 characters long.' },
  { fr: 'La certification est requise pour confirmer la demande de correction.', en: 'Certification is required to confirm the correction request.' },
  { fr: 'La justification de la demande de correction doit comporter au moins 10 caractères.', en: 'The correction request justification must be at least 10 characters long.' },
  {
    fr: 'Votre organisation comporte plusieurs sites déclarés. Veuillez mettre à jour votre application pour sélectionner le site concerné.',
    en: 'Your organisation has several declared sites. Please update your application to select the site concerned.',
  },
  { fr: 'Établissement introuvable ou non associé à cette entreprise.', en: 'Establishment not found or not linked to this company.' },
  { fr: 'Dossier #{0} introuvable.', en: 'File #{0} not found.' },
  {
    fr: 'Impossible d\'approuver le dossier #{0} : {1} anomalie(s) bloquante(s) non résolue(s).',
    en: 'File #{0} cannot be approved: {1} unresolved blocking anomaly(ies).',
  },
  { fr: 'Anomalie #{0} introuvable.', en: 'Anomaly #{0} not found.' },
  { fr: 'Cette anomalie a déjà été traitée ({0}).', en: 'This anomaly has already been handled ({0}).' },
  { fr: 'Impossible d\'approuver un dossier au statut {0}.', en: 'A file with status {0} cannot be approved.' },
  { fr: 'Impossible de rejeter un dossier au statut {0}.', en: 'A file with status {0} cannot be rejected.' },
  { fr: 'Impossible de demander une correction sur un dossier au statut {0}.', en: 'A correction cannot be requested on a file with status {0}.' },

  // ── Team monitoring (actor summary, nudges) ──────────────────────────
  { fr: 'Aucun dossier en attente depuis plus de {0} jours pour cet administrateur.', en: 'No file has been pending for more than {0} days for this administrator.' },
  { fr: 'Le paramètre « period » doit valoir {0}.', en: 'The "period" parameter must be {0}.' },
  { fr: 'Le paramètre « role » doit valoir {0}.', en: 'The "role" parameter must be {0}.' },
  { fr: '« userId » est requis.', en: '"userId" is required.' },
  { fr: '« template » doit valoir {0}.', en: '"template" must be {0}.' },
  { fr: '« customMessage » doit être un texte.', en: '"customMessage" must be text.' },
  { fr: '« customMessage » est limité à {0} caractères.', en: '"customMessage" is limited to {0} characters.' },

  // ── Reports ──────────────────────────────────────────────────────────
  { fr: 'Rapport {0} introuvable', en: 'Report {0} not found' },
  { fr: 'Tâche {0} introuvable', en: 'Job {0} not found' },
  {
    fr: 'Aucun instantané trouvé pour le rapport {0}. Ce rapport a été généré avant l\'introduction des instantanés. Régénérez-le pour en créer un enregistrement figé.',
    en: 'No snapshot found for report {0}. This report was generated before snapshots were introduced. Re-generate it to create a frozen record.',
  },

  // ── Platform settings ────────────────────────────────────────────────
  { fr: 'La plateforme est actuellement en maintenance. Merci de réessayer plus tard.', en: 'The platform is currently under maintenance. Please try again later.' },
  { fr: '{0} doit être une chaîne de caractères.', en: '{0} must be a character string.' },
  { fr: 'Le nom de l\'observatoire ne peut dépasser {0} caractères.', en: 'The observatory name cannot exceed {0} characters.' },
  { fr: 'Pays non pris en charge.', en: 'Unsupported country.' },
  { fr: 'Langue non prise en charge.', en: 'Unsupported language.' },
  { fr: 'Fuseau horaire inconnu.', en: 'Unknown time zone.' },
  { fr: 'Le délai doit être un nombre entier de jours entre {0} et {1}.', en: 'The delay must be a whole number of days between {0} and {1}.' },

  // ── Input validation (class-validator defaults, custom DTO messages) ─
  { fr: 'Le code ne doit contenir que des majuscules, des chiffres et des tirets', en: 'Code must contain only uppercase letters, numbers, and hyphens' },
  { fr: '{0} doit être une chaîne de caractères', en: '{0} must be a string' },
  { fr: '{0} ne doit pas être vide', en: '{0} should not be empty' },
  { fr: '{0} doit être une adresse e-mail', en: '{0} must be an email' },
  { fr: '{0} doit être un nombre', en: '{0} must be a number conforming to the specified constraints' },
  { fr: '{0} doit être un nombre entier', en: '{0} must be an integer number' },
  { fr: '{0} doit être un nombre positif', en: '{0} must be a positive number' },
  { fr: '{0} doit être un booléen', en: '{0} must be a boolean value' },
  { fr: '{0} doit être l\'une des valeurs suivantes : {1}', en: '{0} must be one of the following values: {1}' },
  { fr: '{0} ne doit pas être inférieur à {1}', en: '{0} must not be less than {1}' },
  { fr: '{0} ne doit pas être supérieur à {1}', en: '{0} must not be greater than {1}' },
  { fr: '{0} doit contenir au moins {1} caractères', en: '{0} must be longer than or equal to {1} characters' },
  { fr: '{0} doit contenir au plus {1} caractères', en: '{0} must be shorter than or equal to {1} characters' },
  { fr: '{0} doit être une date ISO 8601 valide', en: '{0} must be a valid ISO 8601 date string' },
  { fr: '{0} doit être une instance de Date', en: '{0} must be a Date instance' },
  { fr: '{0} doit être un UUID', en: '{0} must be a UUID' },
  { fr: '{0} doit être un tableau', en: '{0} must be an array' },
  { fr: '{0} doit être un objet', en: '{0} must be an object' },
  { fr: '{0} doit correspondre à l\'expression régulière {1}', en: '{0} must match {1} regular expression' },
  { fr: 'chaque valeur de {0} doit être une chaîne de caractères', en: 'each value in {0} must be a string' },
  { fr: 'la propriété {0} n\'est pas autorisée', en: 'property {0} should not exist' },

  // ── Framework defaults (NestJS guards, pipes, router, throttler) ─────
  { fr: 'Non autorisé', en: 'Unauthorized' },
  { fr: 'Accès refusé', en: 'Forbidden' },
  { fr: 'Ressource interdite', en: 'Forbidden resource' },
  { fr: 'Ressource introuvable', en: 'Not Found' },
  { fr: 'Requête invalide', en: 'Bad Request' },
  { fr: 'Erreur interne du serveur', en: 'Internal server error' },
  { fr: 'Trop de requêtes. Réessayez dans un instant.', en: 'ThrottlerException: Too Many Requests' },
  { fr: 'Validation échouée (UUID attendu)', en: 'Validation failed (uuid is expected)' },
  { fr: 'Validation échouée (nombre attendu)', en: 'Validation failed (numeric string is expected)' },
  { fr: 'Validation échouée (valeur énumérée attendue)', en: 'Validation failed (enum string is expected)' },
  { fr: 'Route introuvable : {0} /{1}', en: 'Cannot {0} /{1}' },
];

// ── Lookup ───────────────────────────────────────────────────────────────

interface CompiledForm {
  regex: RegExp;
  entry: BilingualMessage;
  // The order of the placeholders as they appear in this form, so captures
  // can be put back by number even when the other language orders them
  // differently.
  slots: number[];
}

const exact = new Map<string, BilingualMessage>();
const patterns: CompiledForm[] = [];
const PLACEHOLDER = /\{(\d+)\}/g;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compile(form: string, entry: BilingualMessage) {
  if (!PLACEHOLDER.test(form)) {
    PLACEHOLDER.lastIndex = 0;
    if (!exact.has(form)) exact.set(form, entry);
    return;
  }
  PLACEHOLDER.lastIndex = 0;
  const slots: number[] = [];
  let source = '';
  let last = 0;
  for (const m of form.matchAll(PLACEHOLDER)) {
    source += escapeRegex(form.slice(last, m.index));
    source += '([\\s\\S]+?)';
    slots.push(Number(m[1]));
    last = (m.index ?? 0) + m[0].length;
  }
  source += escapeRegex(form.slice(last));
  patterns.push({ regex: new RegExp(`^${source}$`), entry, slots });
}

for (const entry of ERROR_MESSAGES) {
  for (const form of [entry.fr, entry.en, ...(entry.also ?? [])]) compile(form, entry);
}
// Most specific first: the longest literal part wins when two patterns
// could both match (e.g. "... (il appartient à la région '{2}')." before
// "... à la région '{1}'.").
patterns.sort((a, b) => b.regex.source.length - a.regex.source.length);

/** The catalogue entry a thrown message belongs to, with its captured values. */
export function findErrorMessage(message: string): { entry: BilingualMessage; values: string[] } | null {
  const hit = exact.get(message);
  if (hit) return { entry: hit, values: [] };
  for (const p of patterns) {
    const m = p.regex.exec(message);
    if (!m) continue;
    const values: string[] = [];
    p.slots.forEach((slot, i) => {
      values[slot] = m[i + 1];
    });
    return { entry: p.entry, values };
  }
  return null;
}

/** `message` in `locale`; unchanged when the catalogue does not know it. */
export function translateErrorMessage(message: string, locale: ErrorLocale): string {
  const found = findErrorMessage(message.trim());
  if (!found) return message;
  return found.entry[locale].replace(PLACEHOLDER, (_, n: string) => found.values[Number(n)] ?? '');
}
