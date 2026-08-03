// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

  @override
  String get requiredField => 'Champ obligatoire';

  @override
  String get telExactly9Digits =>
      'Le numéro doit contenir exactement 9 chiffres';

  @override
  String get telMustStartWith2Or6 =>
      'Le numéro doit commencer par 2 (fixe) ou 6 (mobile)';

  @override
  String get emailInvalid =>
      'Veuillez entrer une adresse e-mail valide (ex: contact@entreprise.com)';

  @override
  String get yearInvalid => 'Veuillez entrer une année valide (ex: 1998)';

  @override
  String get yearMin => 'L\'année doit être ≥ 1900';

  @override
  String yearMax(int max) {
    return 'L\'année doit être ≤ $max';
  }

  @override
  String get requiredFieldConditional => 'Champ obligatoire (conditionnel)';

  @override
  String get selectAnOption => 'Veuillez sélectionner une option';

  @override
  String get optional => 'Optionnel';

  @override
  String get sectionComplete => 'Complet';

  @override
  String get sectionInProgress => 'En cours';

  @override
  String get selectPlaceholder => 'Sélectionner';

  @override
  String get fillRequiredFields =>
      'Veuillez remplir tous les champs obligatoires avant de soumettre';

  @override
  String get genericSubmitError =>
      'Une erreur est survenue. Veuillez réessayer.';

  @override
  String get telHelper => '9 chiffres, sans le 0 initial';

  @override
  String get yearHelper => '4 chiffres';

  @override
  String get collapseSidebar => 'Réduire la barre';

  @override
  String get hideSidebar => 'Masquer la barre';

  @override
  String get showSidebar => 'Afficher la barre';

  @override
  String get saving => 'Sauvegarde…';

  @override
  String get unsaved => 'Non sauvegardé';

  @override
  String get saved => 'Sauvegardé';

  @override
  String get generatingPdfPreview => 'Génération de l\'aperçu PDF…';

  @override
  String get loadingEllipsis => 'Chargement…';

  @override
  String get retry => 'Réessayer';

  @override
  String get errorLabel => 'Erreur';

  @override
  String get previewUnavailableError =>
      'Erreur interne : aperçu non disponible';

  @override
  String get submittingInProgress => 'Soumission en cours…';

  @override
  String get next => 'Suivant';

  @override
  String get previousButton => 'Précédent';

  @override
  String get previewPdf => 'Aperçu PDF';

  @override
  String get inconsistencyDetectedTitle => 'Incohérence détectée';

  @override
  String inconsistenciesDetectedTitle(int count) {
    return '$count incohérences détectées';
  }

  @override
  String get missingFieldTitle => 'Champ manquant';

  @override
  String missingFieldsTitle(int count) {
    return '$count champs manquants';
  }

  @override
  String sectionFallback(int number) {
    return 'Section $number';
  }

  @override
  String get male => 'Homme';

  @override
  String get female => 'Femme';

  @override
  String get total => 'Total';

  @override
  String get languageSettingTitle => 'Langue';

  @override
  String get languageSettingSubtitle =>
      'Choisissez la langue d\'affichage de l\'application';

  @override
  String get languageFrench => 'Français';

  @override
  String get languageEnglish => 'English';

  @override
  String portalWhatsappNotFound(String phone) {
    return 'WhatsApp est introuvable sur cet appareil. Composez directement le $phone.';
  }

  @override
  String get portalTwoFactorCodeError => 'Code incorrect ou expiré. Réessayez.';

  @override
  String get portalCredentialsError =>
      'Identifiants incorrects. Vérifiez et réessayez.';

  @override
  String get ministryFullName =>
      'Ministère de l\'Emploi et de la Formation Professionnelle';

  @override
  String get tabSignIn => 'Ouvrir une session';

  @override
  String get tabCreateAccount => 'Créer un compte';

  @override
  String get tabForgotId => 'Identifiant oublié';

  @override
  String get twoFactorTitle => 'Vérification en deux étapes';

  @override
  String get twoFactorBody =>
      'Un code de vérification a été envoyé à votre adresse e-mail. Saisissez-le ci-dessous pour terminer la connexion.';

  @override
  String get codeLabel => 'Code';

  @override
  String get codeRequired => 'Code à 6 chiffres requis';

  @override
  String get verifyButton => 'Vérifier';

  @override
  String get backToLogin => 'Retour à la connexion';

  @override
  String get loginLabel => 'Login';

  @override
  String get passwordLabel => 'Mot de passe';

  @override
  String get requiredShort => 'Requis';

  @override
  String get rememberMe => 'Rester connecté';

  @override
  String get forgotPassword => 'Mot de passe oublié ?';

  @override
  String get connectButton => 'Connexion';

  @override
  String get registerTitle => 'Création de compte';

  @override
  String get registerBody =>
      'Inscrivez votre entreprise, coopérative, ONG ou centre de formation pour accéder à la plateforme DSMO et soumettre vos déclarations ONEFOP.';

  @override
  String get registerButton => 'Commencer l\'inscription';

  @override
  String get registerDraftRestored =>
      'Brouillon restauré — vous pouvez reprendre votre inscription.';

  @override
  String get registerSelectAccountType => 'Veuillez choisir un type de compte';

  @override
  String get registerSelectEntityType =>
      'Veuillez sélectionner le type d\'entité';

  @override
  String get registerEmailAlreadyUsed => 'Cet email est déjà utilisé.';

  @override
  String get registerSelectRegion => 'Veuillez sélectionner une région';

  @override
  String get registerSelectDepartment => 'Veuillez sélectionner un département';

  @override
  String get registerLoadRegionsError =>
      'Impossible de charger les régions. Réessayez.';

  @override
  String get registerLoadDepartmentsError =>
      'Impossible de charger les départements. Réessayez.';

  @override
  String get registerLoadSubdivisionsError =>
      'Impossible de charger les arrondissements. Réessayez.';

  @override
  String get registerLoadSectorsError =>
      'Impossible de charger les secteurs. Réessayez.';

  @override
  String get registerPendingApprovalTitle => 'Demande soumise !';

  @override
  String get registerPendingApprovalBody =>
      'Votre demande d\'accès MINEFOP est en attente d\'approbation par un administrateur.';

  @override
  String get registerUnderstoodButton => 'Compris';

  @override
  String get registerSuccessTitle => 'Compte créé avec succès !';

  @override
  String get registerAccessButton => 'Accéder';

  @override
  String registerReceiptCopiedSnackbar(String label) {
    return '$label copié dans le presse-papier';
  }

  @override
  String get registerReceiptCannotOpenAttestation =>
      'Impossible d\'ouvrir l\'attestation.';

  @override
  String get registerReceiptTitle => 'REÇU D\'ENREGISTREMENT';

  @override
  String get registerReceiptCompanyLabel => 'Entreprise';

  @override
  String get registerReceiptIdCopyLabel => 'Identifiant';

  @override
  String get registerReceiptClickToCopy => 'Cliquer pour copier';

  @override
  String get registerReceiptRegistrationDateLabel => 'Date d\'enregistrement';

  @override
  String get registerReceiptKeepIdNote =>
      'Conservez cet identifiant. Il vous sera demandé pour accéder à vos formulaires ONEFOP, et peut aussi être utilisé à la place de votre e-mail pour vous connecter.';

  @override
  String get registerReceiptDownloadAttestation => 'Télécharger l\'attestation';

  @override
  String get registerReceiptCloseButton => 'Fermer';

  @override
  String get registerDuplicateEmailOrNiu =>
      'Cet email ou ce numéro NIU est déjà utilisé.';

  @override
  String registerSubmitErrorWithMessage(String error) {
    return 'Erreur lors de l\'inscription : $error';
  }

  @override
  String get registerCreateAccountButton => 'Créer mon compte';

  @override
  String get registerContinueButton => 'Continuer';

  @override
  String get registerStepTitleRole => 'Type de compte';

  @override
  String get registerStepTitleEntityType => 'Type d\'entité';

  @override
  String get registerStepTitleRespondent => 'Informations du répondant';

  @override
  String get registerStepTitleEntityInfo => 'Informations de l\'entité';

  @override
  String get registerStepTitleLocation => 'Localisation';

  @override
  String get registerStepTitleMinefopInfo => 'Informations MINEFOP';

  @override
  String get registerStepTitleSecurity => 'Sécurité';

  @override
  String get registerStepTitleReview => 'Récapitulatif';

  @override
  String get registerEntitySubtitleEnterprise =>
      'Société commerciale, SA, SARL, établissement à but lucratif.';

  @override
  String get registerEntitySubtitleCooperative =>
      'Société coopérative ou groupement d\'intérêt économique.';

  @override
  String get registerEntitySubtitleCtd =>
      'Collectivité Territoriale Décentralisée (commune, région).';

  @override
  String get registerEntitySubtitleOng =>
      'Organisation Non Gouvernementale ou association.';

  @override
  String get registerEntitySubtitleVocational =>
      'Centre de formation technique et professionnelle agréé.';

  @override
  String get registerServiceLevelTitle => 'Niveau de service';

  @override
  String get registerServiceLevelSubtitle =>
      'Sélectionnez votre niveau hiérarchique.';

  @override
  String get registerMinefopCentralTitle => 'Administration centrale';

  @override
  String get registerMinefopCentralSubtitle =>
      'Direction centrale, sous-direction ou service central à Yaoundé.';

  @override
  String get registerMinefopRegionalTitle => 'Service régional';

  @override
  String get registerMinefopRegionalSubtitle =>
      'Délégation régionale de l\'emploi et de la formation professionnelle.';

  @override
  String get registerMinefopDivisionalTitle => 'Service départemental';

  @override
  String get registerMinefopDivisionalSubtitle =>
      'Délégation départementale de l\'emploi et de la formation professionnelle.';

  @override
  String get registerCreateAccountTitle => 'Créer un compte';

  @override
  String get registerSelectProfileSubtitle =>
      'Sélectionnez votre profil pour commencer.';

  @override
  String get registerRoleCompanyTitle => 'Entreprise / Organisation';

  @override
  String get registerRoleCompanySubtitle =>
      'Société, coopérative, CTD, ONG ou centre de formation soumis à la déclaration ONEFOP / DSMO.';

  @override
  String get registerRoleMinefopTitle => 'Agent MINEFOP';

  @override
  String get registerRoleMinefopSubtitle =>
      'Inspecteur ou agent du Ministère de l\'Emploi et de la Formation Professionnelle.';

  @override
  String get registerEntityTypeSubtitle =>
      'Sélectionnez le type d\'entité que vous représentez.';

  @override
  String get registerRespondentTitlePersonal => 'Vos informations personnelles';

  @override
  String get registerRespondentSubtitleMinefop =>
      'Ces informations seront associées à votre compte agent MINEFOP.';

  @override
  String get registerRespondentSubtitleStandard =>
      'Ces informations pré-rempliront la Section 0 (Répondant) du formulaire ONEFOP et la Partie A de vos déclarations DSMO.';

  @override
  String get registerFirstNameLabel => 'Prénom *';

  @override
  String get registerLastNameLabel => 'Nom *';

  @override
  String get registerFunctionLabel => 'Fonction *';

  @override
  String get registerSelectFunctionHint => 'Sélectionner votre fonction';

  @override
  String get registerProfessionalEmailLabel => 'E-mail professionnel *';

  @override
  String get registerPhone1Label => 'Téléphone 1 *';

  @override
  String get registerPhone2Label => 'Téléphone 2';

  @override
  String get registerRespondentInfoBox =>
      'Ces informations seront automatiquement pré-remplies dans la Section 0 de vos futurs formulaires ONEFOP et dans la Partie A de vos déclarations DSMO.';

  @override
  String get registerSelectEntityTypeFirst =>
      'Veuillez sélectionner un type d\'entité';

  @override
  String get registerEntityInfoInfoBox =>
      'Ces informations seront automatiquement pré-remplies dans la Section 1 de vos futurs formulaires ONEFOP et dans la Partie A de vos déclarations DSMO.';

  @override
  String get registerMinefopLoadFunctionsError =>
      'Impossible de charger les fonctions.';

  @override
  String registerInfoAsRole(String role) {
    return 'Renseignez vos informations en tant que $role.';
  }

  @override
  String get registerMatriculeLabel => 'Matricule *';

  @override
  String get registerMatriculeHint => 'Votre matricule de fonctionnaire';

  @override
  String get registerMatriculeRequired => 'Matricule requis';

  @override
  String get registerLocalisationSubtitle =>
      'Indiquez la région et le département de votre affectation.';

  @override
  String get registerRegionLabel => 'Région *';

  @override
  String get registerSelectRegionHint => 'Sélectionnez votre région';

  @override
  String get registerDepartmentLabel => 'Département *';

  @override
  String get registerSelectRegionFirst => 'Sélectionnez d\'abord une région';

  @override
  String get registerSelectDepartmentHint => 'Sélectionnez votre département';

  @override
  String get registerMinefopInfoBox =>
      'Ces informations seront vérifiées lors de la validation de votre compte par un administrateur.';

  @override
  String get registerLoadingFunctions => 'Chargement des fonctions...';

  @override
  String get registerNoFunctionsAvailable =>
      'Aucune fonction disponible pour votre niveau.';

  @override
  String get registerFunctionPositionLabel => 'Fonction / Poste *';

  @override
  String get registerSelectYourFunction => 'Sélectionnez votre fonction';

  @override
  String get registerSelectFunctionValidator =>
      'Veuillez sélectionner une fonction';

  @override
  String get registerLoadingParentUnits => 'Chargement des unités parentes...';

  @override
  String get registerNoParentUnitsAvailable =>
      'Aucune unité parente disponible pour cette fonction.';

  @override
  String get registerParentUnitLabel => 'Unité parente *';

  @override
  String get registerParentUnitDirectlyAttached =>
      'Cette fonction est directement rattachée à cette unité.';

  @override
  String get registerSelectDirectSupervisor =>
      'Sélectionnez le service supérieur hiérarchique direct.';

  @override
  String get registerSelectParentUnitHint => 'Sélectionnez l\'unité supérieure';

  @override
  String get registerLoadingServiceUnits => 'Chargement de vos services...';

  @override
  String get registerNoServiceUnitsFound =>
      'Aucun service trouvé sous cette unité parente.';

  @override
  String get registerYourServiceLabel => 'Votre service *';

  @override
  String get registerSelectYourUnit =>
      'Sélectionnez l\'unité dans laquelle vous exercez.';

  @override
  String get registerSelectYourServiceHint => 'Sélectionnez votre service';

  @override
  String get registerJobTitleLabel => 'Intitulé du poste';

  @override
  String get registerLocationSubtitle =>
      'Ces informations pré-rempliront la localisation dans les formulaires ONEFOP (Section 1) et DSMO (Partie A).';

  @override
  String get registerSelectRegionShort => 'Sélectionner une région';

  @override
  String get registerSelectDepartmentShort => 'Sélectionner un département';

  @override
  String get registerArrondissementLabel => 'Arrondissement';

  @override
  String get registerSelectDepartmentFirst =>
      'Sélectionnez d\'abord un département';

  @override
  String get registerNoSubdivisionAvailable =>
      'Aucun arrondissement disponible';

  @override
  String get registerSelectSubdivisionShort => 'Sélectionner un arrondissement';

  @override
  String get registerMilieuLabel => 'Milieu';

  @override
  String get registerUrbanOrRuralHint => 'Urbain ou Rural';

  @override
  String get registerSectorLabel => 'Secteur d\'activité';

  @override
  String get registerSelectSectorHint => 'Sélectionner un secteur';

  @override
  String get registerLocationInfoBox =>
      'Ces informations seront automatiquement pré-remplies dans la Section 1 de vos formulaires ONEFOP et dans la Partie A de vos déclarations DSMO.';

  @override
  String get registerSecureAccountTitle => 'Sécurisez votre compte';

  @override
  String get registerChooseStrongPassword =>
      'Choisissez un mot de passe robuste.';

  @override
  String get registerPasswordLabel => 'Mot de passe *';

  @override
  String get registerPasswordRequired => 'Mot de passe requis';

  @override
  String get registerPasswordMinChars => 'Minimum 8 caractères';

  @override
  String get registerPasswordTooWeak =>
      'Trop faible — ajoutez des chiffres ou symboles';

  @override
  String get registerStrengthWeak => 'Faible';

  @override
  String get registerStrengthMedium => 'Moyen';

  @override
  String get registerStrengthStrong => 'Fort';

  @override
  String get registerStrengthVeryStrong => 'Très fort';

  @override
  String get registerConfirmPasswordLabel => 'Confirmer le mot de passe *';

  @override
  String get registerConfirmationRequired => 'Confirmation requise';

  @override
  String get registerPasswordsDontMatch =>
      'Les mots de passe ne correspondent pas';

  @override
  String get registerTip8Chars => '8 caractères minimum';

  @override
  String get registerTipUppercase => 'Une lettre majuscule';

  @override
  String get registerTipDigit => 'Un chiffre';

  @override
  String get registerTipSpecialChar => 'Un caractère spécial';

  @override
  String get registerReviewSubtitle =>
      'Vérifiez vos informations avant de créer le compte.';

  @override
  String get registerReviewPersonalInfoTitle => 'Informations personnelles';

  @override
  String get registerReviewRespondentTitle =>
      'Répondant — Section 0 ONEFOP / Partie A DSMO';

  @override
  String get registerFullNameLabel => 'Nom complet';

  @override
  String get registerFunctionRowLabel => 'Fonction';

  @override
  String get registerEmailRowLabel => 'Email';

  @override
  String get registerPhone1RowLabel => 'Téléphone 1';

  @override
  String get registerPhone2RowLabel => 'Téléphone 2';

  @override
  String get registerRegionRowLabel => 'Région';

  @override
  String get registerDepartmentRowLabel => 'Département';

  @override
  String get registerSectorRowLabel => 'Secteur';

  @override
  String get registerMinefopPendingInfoBox =>
      'Votre compte sera activé après validation par un administrateur MINEFOP.';

  @override
  String get registerCompanyPendingInfoBox =>
      'Ces informations pré-rempliront automatiquement les Sections 0 et 1 de vos formulaires ONEFOP et la Partie A de vos déclarations DSMO.';

  @override
  String registerAgentMinefopPrefix(String role) {
    return 'Agent MINEFOP — $role';
  }

  @override
  String get registerMatriculeRowLabel => 'Matricule';

  @override
  String get registerHierarchicalPathLabel => 'Chemin hiérarchique';

  @override
  String get registerServiceCodeRowLabel => 'Code service';

  @override
  String get forgotIntro =>
      'Indiquez le nom de votre organisation, son numéro contribuable (NIU) et le numéro de téléphone enregistré pour retrouver votre identifiant.';

  @override
  String get organizationLabel => 'Organisation';

  @override
  String get organizationHint => 'Nom de l\'organisation';

  @override
  String get niuLabel => 'NIU';

  @override
  String get niuHint => 'Numéro contribuable';

  @override
  String get phoneLabel => 'Téléphone';

  @override
  String get searchButton => 'Rechercher';

  @override
  String get supportContactLink =>
      'Toujours introuvable ? Contactez le support';

  @override
  String get supportWhatsappMessage =>
      'Bonjour, je n\'arrive pas à retrouver mon identifiant DSMO.';

  @override
  String get genericErrorShort => 'Une erreur est survenue.';

  @override
  String get idFoundTitle => 'Identifiant retrouvé';

  @override
  String get establishmentIdLabel => 'IDENTIFIANT ÉTABLISSEMENT';

  @override
  String get tapToCopy => 'Touchez pour copier';

  @override
  String get idCopiedSnackbar => 'Identifiant copié dans le presse-papier';

  @override
  String get newSearchButton => 'Nouvelle recherche';

  @override
  String get footerHelp => 'Aide';

  @override
  String get footerPrivacy => 'Confidentialité';

  @override
  String get footerContact => 'Contact';

  @override
  String get footerVersionLine =>
      'DSMO Digital v2.4.1-stable  ·  © 2026 MINEFOP · République du Cameroun';

  @override
  String get activeCampaignsTitle => 'Campagnes en cours';

  @override
  String get updatedToday => 'Mis à jour aujourd\'hui';

  @override
  String get updatedYesterday => 'Mis à jour hier';

  @override
  String updatedDaysAgo(int days) {
    return 'Mis à jour il y a $days jours';
  }

  @override
  String get noDeclarationsYet => 'Aucune déclaration';

  @override
  String get workersCurrentlyDeclared => 'Travailleurs actuellement déclarés';

  @override
  String get newDeclarationCta => 'Nouvelle déclaration';

  @override
  String activeDeclarationsCount(int count, String lastUpdated) {
    return '$count déclarations actives · $lastUpdated';
  }

  @override
  String get declarationsFiledTitle => 'Déclarations déposées';

  @override
  String approvedCountSubtitle(int count) {
    return '↑ $count approuvées';
  }

  @override
  String get awaitingApprovalTitle => 'En attente d\'approbation';

  @override
  String get underReview => 'En cours de révision';

  @override
  String get allUpToDate => 'Tout est à jour';

  @override
  String get onefopApproved => 'Approuvé';

  @override
  String get onefopUnderReview => 'En révision';

  @override
  String get onefopRejected => 'Rejeté';

  @override
  String get onefopCorrections => 'Corrections';

  @override
  String get onefopDraft => 'Brouillon';

  @override
  String get onefopNotSubmitted => 'Non soumis';

  @override
  String get onefopValidatedSubtitle => '↑ Questionnaire validé';

  @override
  String get onefopPendingMinefopSubtitle => '↑ En attente MINEFOP';

  @override
  String get onefopCorrectionsRequiredSubtitle => '↓ Corrections requises';

  @override
  String get onefopModificationsRequestedSubtitle =>
      '↓ Modifications demandées';

  @override
  String get onefopFinalizeSubtitle => '→ Finalisez et soumettez';

  @override
  String get onefopRequiredSubtitle => '→ Questionnaire requis';

  @override
  String establishmentIdInline(String id) {
    return 'ID Établissement : $id';
  }

  @override
  String get submissionSuccessTitle => 'Soumission réussie !';

  @override
  String get submissionSuccessSubtitle =>
      'Votre formulaire ONEFOP a été soumis avec succès.';

  @override
  String get connectionUnavailableTitle => 'Connexion indisponible';

  @override
  String get queuedOfflineSubtitle =>
      'Votre formulaire a été enregistré sur cet appareil et sera envoyé automatiquement dès le retour de la connexion.';

  @override
  String get doneButton => 'Terminer';

  @override
  String get legalNoticeTitle =>
      'COLLECTE DES DONNÉES SUR LES EMPLOIS CRÉÉS PAR LE SECTEUR MODERNE DE L\'ÉCONOMIE';

  @override
  String questionnaireBadge(String label) {
    return '- Questionnaire $label -';
  }

  @override
  String get entityShortOng => 'ONG';

  @override
  String get entityShortEnterprise => 'ENTREPRISE';

  @override
  String get entityShortCooperative => 'COOPÉRATIVE';

  @override
  String get entityShortCtd => 'CTD';

  @override
  String get confidentialityNoticeHeading => 'Avis de confidentialité';

  @override
  String get confidentialityNoticeBody =>
      'Les informations contenues dans ce document sont confidentielles et ne pourront être utilisées à des fins de poursuites judiciaires, de contrôle fiscal ou de répression économique, conformément à la Loi N° 2020/010 du 20 juillet 2020 relative aux recensements et enquêtes Statistiques.';

  @override
  String get legalFooterLawReference => 'Loi N° 2020/010 du 20 juillet 2020';

  @override
  String get acknowledgeCheckboxLabel => 'J\'ai pris connaissance de cet avis';

  @override
  String get beginButton => 'Commencer';

  @override
  String get goBackButton => 'Retour';

  @override
  String onefopApprovedActivity(int year) {
    return 'ONEFOP $year approuvé';
  }

  @override
  String get validatedByMinefop => 'Validé par MINEFOP';

  @override
  String onefopSubmittedActivity(int year) {
    return 'ONEFOP $year soumis';
  }

  @override
  String get pendingMinefop => 'En attente MINEFOP';

  @override
  String onefopRejectedActivity(int year) {
    return 'ONEFOP $year rejeté';
  }

  @override
  String get correctionsRequired => 'Corrections requises';

  @override
  String onefopToCorrectActivity(int year) {
    return 'ONEFOP $year à corriger';
  }

  @override
  String get modificationsRequested => 'Modifications demandées';

  @override
  String get dateUnknown => 'Date inconnue';

  @override
  String dsmoApprovedTitle(int year) {
    return 'DSMO Q$year approuvée';
  }

  @override
  String get dsmoApprovedSubtitle => 'Validée par MINEFOP';

  @override
  String get dsmoApprovedBadge => 'Approuvée';

  @override
  String dsmoPendingFinalTitle(int year) {
    return 'DSMO Q$year en attente';
  }

  @override
  String get dsmoPendingFinalSubtitle => 'En attente validation finale';

  @override
  String get dsmoPendingFinalBadge => 'En cours';

  @override
  String dsmoDivisionReviewTitle(int year) {
    return 'DSMO Q$year en révision';
  }

  @override
  String get dsmoDivisionReviewSubtitle => 'En attente régionale';

  @override
  String get dsmoDivisionReviewBadge => 'Révision';

  @override
  String dsmoSubmittedTitle(int year) {
    return 'DSMO Q$year soumise';
  }

  @override
  String get dsmoSubmittedSubtitle => 'En attente de révision';

  @override
  String get dsmoSubmittedBadge => 'Soumise';

  @override
  String dsmoDraftTitle(int year) {
    return 'DSMO Q$year brouillon';
  }

  @override
  String get dsmoDraftSubtitle => 'Non finalisée';

  @override
  String get dsmoDraftBadge => 'Brouillon';

  @override
  String dsmoRejectedTitle(int year) {
    return 'DSMO Q$year rejetée';
  }

  @override
  String get dsmoRejectedSubtitle => 'Corrections nécessaires';

  @override
  String get dsmoRejectedBadge => 'Rejetée';

  @override
  String get noDeclarationsTitle => 'Aucune déclaration';

  @override
  String get noDeclarationsSubtitle =>
      'Commencez par créer une déclaration DSMO';

  @override
  String get emptyBadge => 'Vide';

  @override
  String get recentActivityTitle => 'Activité récente';

  @override
  String get viewAllLink => 'Voir tout →';

  @override
  String get menLabel => 'Hommes';

  @override
  String get womenLabel => 'Femmes';

  @override
  String get genderDistributionTitle => 'Répartition par genre';

  @override
  String get employeesLabel => 'employés';

  @override
  String get genderDistributionUnavailable =>
      'Répartition par genre non renseignée';

  @override
  String get loadingErrorTitle => 'Erreur de chargement';

  @override
  String get campaignFallbackName => 'Campagne';

  @override
  String periodLabel(String period) {
    return 'Période : $period';
  }

  @override
  String periodUntil(String date) {
    return 'jusqu\'au $date';
  }

  @override
  String periodSince(String date) {
    return 'depuis $date';
  }

  @override
  String get periodUndefined => 'non définie';

  @override
  String get deadlineUndefined => 'Échéance non définie';

  @override
  String get deadlinePassed => 'Échéance dépassée';

  @override
  String get remainingLabel => 'restant';

  @override
  String get campaignManagementTitle => 'Gestion des Campagnes';

  @override
  String get refreshTooltip => 'Actualiser';

  @override
  String get newCampaignButton => 'Nouvelle campagne';

  @override
  String get allFilter => 'Toutes';

  @override
  String get campaignColumnHeader => 'Campagne';

  @override
  String get nameColumnHeader => 'Nom';

  @override
  String get statusColumnHeader => 'Statut';

  @override
  String get actionColumnHeader => 'Action';

  @override
  String get unnamedCampaign => 'Sans nom';

  @override
  String get activateTooltip => 'Activer';

  @override
  String get deactivateTooltip => 'Désactiver';

  @override
  String get editTooltip => 'Modifier';

  @override
  String get deleteTooltip => 'Supprimer';

  @override
  String get moreActionsTooltip => 'Plus d\'actions';

  @override
  String get closeAction => 'Clôturer';

  @override
  String get extendDeadlineAction => 'Prolonger l\'échéance';

  @override
  String get sendReminderAction => 'Envoyer un rappel';

  @override
  String get campaignActivatedMsg => 'Campagne activée.';

  @override
  String get campaignDeactivatedMsg => 'Campagne désactivée.';

  @override
  String get campaignClosedMsg => 'Campagne clôturée.';

  @override
  String get deadlineExtendedMsg => 'Échéance prolongée.';

  @override
  String get reminderSentMsg => 'Rappel envoyé.';

  @override
  String get campaignDeletedMsg => 'Campagne supprimée.';

  @override
  String get campaignCreatedMsg => 'Campagne créée avec succès';

  @override
  String get cancelButton => 'Annuler';

  @override
  String get sendButton => 'Envoyer';

  @override
  String get deleteCampaignTitle => 'Supprimer la campagne ?';

  @override
  String get deleteCampaignBody =>
      'Cette action est irréversible et supprimera également toutes les soumissions associées.';

  @override
  String get deleteButton => 'Supprimer';

  @override
  String get noCampaignsTitle => 'Aucune campagne';

  @override
  String get noCampaignsSubtitle => 'Cliquez sur + pour créer une campagne';

  @override
  String get generalInfoSection => 'Informations générales';

  @override
  String get campaignNameHelper =>
      'Le nom officiel détermine aussi quel formulaire s\'ouvre pour les établissements ciblés une fois la campagne active.';

  @override
  String get campaignNameFieldLabel => 'Nom de la campagne *';

  @override
  String get descriptionOptionalLabel => 'Description (optionnel)';

  @override
  String get campaignTypeSection => 'Type de campagne';

  @override
  String get periodSection => 'Période';

  @override
  String get startDateLabel => 'Date de début *';

  @override
  String get deadlineFieldLabel => 'Échéance *';

  @override
  String get targetEntityTypesSection => 'Types d\'entités ciblées';

  @override
  String get targetRegionsSection => 'Régions & Départements ciblés';

  @override
  String get regionsHelper =>
      'Sélectionnez des régions. Développez une région pour cibler des départements spécifiques.';

  @override
  String get autoRemindersSection => 'Rappels automatiques';

  @override
  String get enableRemindersTitle => 'Activer les rappels';

  @override
  String get enableRemindersSubtitle =>
      'Envoyer des rappels aux établissements avant l\'échéance';

  @override
  String get remindersAtLabel => 'Rappels à J-:';

  @override
  String get daySuffix => 'j';

  @override
  String get bothDatesRequiredError => 'Veuillez sélectionner les deux dates.';

  @override
  String get deadlineAfterStartError =>
      'L\'échéance doit être après la date de début.';

  @override
  String get campaignAlreadyActiveTitle => 'Campagne déjà active';

  @override
  String campaignConflictBody(String label, String name, String deadline) {
    return 'Une campagne \"$label\" est déjà active : \"$name\" (échéance $deadline).\n\nCréer cette nouvelle campagne clôturera la précédente et ouvrira celle-ci à sa place. Continuer ?';
  }

  @override
  String get continueButton => 'Continuer';

  @override
  String get createCampaignButton => 'Créer la campagne';

  @override
  String get campaignPausedMsg => 'Campagne mise en pause.';

  @override
  String get typeLabel => 'Type';

  @override
  String get collectionLabel => 'Collecte';

  @override
  String get startLabel => 'Début';

  @override
  String get deadlineInfoLabel => 'Échéance';

  @override
  String get extendedDeadlineLabel => 'Échéance prolongée';

  @override
  String get createdByLabel => 'Créée par';

  @override
  String codeLabelPrefix(String code) {
    return 'Code: $code';
  }

  @override
  String get progressTitle => 'Progression';

  @override
  String completedPercent(String rate) {
    return '$rate% complété';
  }

  @override
  String get submittedLabel => 'Soumises';

  @override
  String get inProgressLabel => 'En cours';

  @override
  String get notStartedLabel => 'Non commencées';

  @override
  String get targetingTitle => 'Ciblage';

  @override
  String get regionsLabel => 'Régions';

  @override
  String get departmentsLabel => 'Départements';

  @override
  String get entityTypesLabel => 'Types d\'entités';

  @override
  String get allNoRestriction => 'Toutes (aucune restriction)';

  @override
  String get noneLabel => 'Aucun';

  @override
  String get allMasculine => 'Tous';

  @override
  String autoRemindersEnabled(String days) {
    return 'Rappels automatiques activés ($days)';
  }

  @override
  String get dayPrefix => 'J-';

  @override
  String get autoRemindersDisabled => 'Rappels automatiques désactivés';

  @override
  String get reminderHistoryTitle => 'Historique des rappels';

  @override
  String get noRemindersYet => 'Aucun rappel envoyé pour le moment.';

  @override
  String reminderStatsWithFailures(int sent, int failed, String date) {
    return '$sent destinataires · $failed échecs · $date';
  }

  @override
  String reminderStatsNoFailures(int sent, String date) {
    return '$sent destinataires · $date';
  }

  @override
  String get submissionsTitle => 'Soumissions';

  @override
  String get noSubmissions => 'Aucune soumission.';

  @override
  String get unknownCompany => 'Entreprise inconnue';

  @override
  String get dateUndefined => 'Non définie';

  @override
  String get editCampaignTitle => 'Modifier la campagne';

  @override
  String get editCampaignHelper =>
      'Le nom, le type de campagne, le type de collecte et la date de début ne sont pas modifiables après création.';

  @override
  String get reminderDaysLabel => 'Jours de rappel (J-)';

  @override
  String get saveButton => 'Enregistrer';

  @override
  String get deadlineRequiredError => 'Veuillez sélectionner une échéance.';

  @override
  String get exportButtonLabel => 'Export';

  @override
  String get exportDialogTitle => 'Exporter le tableau de bord';

  @override
  String get exportDialogButton => 'Exporter';

  @override
  String get exportSectionFilters => 'Filtres';

  @override
  String get exportSectionSummary => 'Synthèse';

  @override
  String get exportSectionBenchmarking => 'Benchmarking';

  @override
  String get exportSectionLaborMarket => 'Marché du travail';

  @override
  String get exportSectionWorkforceStructure => 'Structure des recrutements';

  @override
  String get exportSectionRecruitmentInsertion => 'Recrutement & Insertion';

  @override
  String get exportSectionMobilityRetention => 'Mobilité & Rétention';

  @override
  String get exportSectionInclusion => 'Inclusion';

  @override
  String get exportSectionCompetencesFormation => 'Compétences & Formation';

  @override
  String get exportDescFilters =>
      'Inclut les paramètres de période, région et secteur.';

  @override
  String get exportDescSummary =>
      'Inclut les principaux indicateurs et graphiques du tableau de bord Synthèse.';

  @override
  String get exportDescBenchmarking =>
      'Export du tableau de bord Benchmarking régional / national.';

  @override
  String get exportDescLaborMarket =>
      'Export des tensions et des recrutements sur le marché du travail.';

  @override
  String get exportDescWorkforceStructure =>
      'Export de la structure des recrutements et des types d\'entités.';

  @override
  String get exportDescRecruitmentInsertion =>
      'Export des premiers recrutements et du taux de conversion.';

  @override
  String get exportDescMobilityRetention =>
      'Export des départs, des motifs et des taux de rétention.';

  @override
  String get exportDescInclusion =>
      'Export des indicateurs d\'inclusion et de parité.';

  @override
  String get exportDescCompetencesFormation =>
      'Export des compétences recherchées et du pipeline de formation.';

  @override
  String get chartFiltersApplied => 'Filtres appliqués';

  @override
  String get chartSummaryKpis => 'Indicateurs clés';

  @override
  String get chartSummaryTrend => 'Évolution de l\'emploi';

  @override
  String get chartSummarySector => 'Performance sectorielle';

  @override
  String get chartSummaryBalance => 'Dynamique du travail';

  @override
  String get chartSummaryGender => 'Genre (candidatures)';

  @override
  String get chartSummaryYoy => 'Évolution annuelle';

  @override
  String get chartBenchmarkingTable => 'Comparatif régional';

  @override
  String get chartLaborIndicators => 'Indicateurs du marché du travail';

  @override
  String get chartLaborCsp => 'Recrutements par CSP';

  @override
  String get chartStructureEntity => 'Répartition des types d\'entité';

  @override
  String get chartStructureSize => 'Répartition par taille d\'entreprise';

  @override
  String get chartStructureCsp => 'Pyramide des CSP des recrutements';

  @override
  String get chartStructureDiploma => 'Diplômes des recrutements';

  @override
  String get chartStructureSector => 'Postes vacants par secteur';

  @override
  String get chartRecruitmentIndicators => 'Indicateurs de recrutement';

  @override
  String get chartRecruitmentAge => 'Âge des recrutés';

  @override
  String get chartMobility => 'Motifs de départ';

  @override
  String get chartInclusionRegion => 'Répartition régionale';

  @override
  String get chartInclusionVulnerable => 'Inclusion vulnérable';

  @override
  String get chartInclusionYouth => 'Emploi jeunes';

  @override
  String get chartCompetencesSkills => 'Compétences recherchées';

  @override
  String get chartCompetencesTraining => 'Formations demandées';

  @override
  String get pdfExportTitle => 'Observatoire de l\'Emploi — Export';

  @override
  String pdfExportDate(String date) {
    return 'Date d\'export : $date';
  }

  @override
  String get pdfFieldHeader => 'Champ';

  @override
  String get pdfValueHeader => 'Valeur';

  @override
  String get pdfPeriodLabel => 'Période';

  @override
  String get pdfRegionLabel => 'Région';

  @override
  String get pdfNationalFallback => 'National';

  @override
  String get pdfDepartmentLabel => 'Département';

  @override
  String get pdfSubdivisionLabel => 'Sous-division';

  @override
  String get pdfEntityTypeLabel => 'Type d\'entité';

  @override
  String get pdfSectorLabel => 'Secteur';

  @override
  String get pdfDeclarationsLabel => 'Déclarations';

  @override
  String get pdfTotalWorkforceLabel => 'Effectif total';

  @override
  String get pdfRecruitmentsLabel => 'Recrutements';

  @override
  String get pdfDeparturesLabel => 'Départs';

  @override
  String get pdfNetChangeLabel => 'Variation nette';

  @override
  String get pdfGrowthLabel => 'Croissance';

  @override
  String get pdfLeadingSectorLabel => 'Secteur leader';

  @override
  String get pdfNotApplicable => 'N/A';

  @override
  String get pdfIndicatorHeader => 'Indicateur';

  @override
  String get pdfWorkforceHeader => 'Effectif';

  @override
  String get pdfEmployeesCountHeader => 'Effectifs';

  @override
  String get pdfDismissalsLabel => 'Licenciements';

  @override
  String get pdfResignationsLabel => 'Démissions';

  @override
  String get pdfRetirementsLabel => 'Retraites';

  @override
  String get pdfJobsCreatedLabel => 'Emplois créés';

  @override
  String get pdfJobsLostLabel => 'Emplois supprimés';

  @override
  String get pdfDepartureDetailTitle => 'Détail des départs';

  @override
  String get pdfReasonHeader => 'Motif';

  @override
  String pdfTechnicalUnemploymentNote(int count) {
    return '$count en chômage technique (hors total).';
  }

  @override
  String get pdfNetBalanceLabel => 'Solde net';

  @override
  String get pdfGenderDistributionTitle => 'Répartition Femmes / Hommes';

  @override
  String pdfMenCountLine(num count, String pct) {
    return 'Hommes : $count ($pct%)';
  }

  @override
  String pdfWomenCountLine(num count, String pct) {
    return 'Femmes : $count ($pct%)';
  }

  @override
  String get pdfBenchmarkingTitle => 'Benchmarking régional';

  @override
  String get pdfBenchmarkingEmptyHint =>
      'Sélectionnez une région, un département ou un arrondissement pour comparer au national.';

  @override
  String get pdfNationalComparisonNote =>
      'La comparaison nationale n\'est pas incluse dans l\'export actuel.';

  @override
  String get pdfLocalValueHeader => 'Valeur locale';

  @override
  String get pdfRemarkHeader => 'Remarque';

  @override
  String get pdfDeclaringCompaniesLabel => 'Entreprises déclarantes';

  @override
  String get pdfVacanciesLabel => 'Postes vacants';

  @override
  String get pdfGapLabel => 'Écart';

  @override
  String get pdfAbsorptionRateLabel => 'Taux d\'absorption';

  @override
  String get pdfCspHeader => 'CSP';

  @override
  String get pdfShareHeader => 'Part';

  @override
  String get pdfTypeHeader => 'Type';

  @override
  String get pdfDeclarantsHeader => 'Déclarants';

  @override
  String get pdfEnterprisesLabel => 'Entreprises';

  @override
  String get pdfCooperativesLabel => 'Coopératives';

  @override
  String get pdfCtdLabel => 'CTD';

  @override
  String get pdfOngLabel => 'ONG';

  @override
  String get pdfSizeHeader => 'Taille';

  @override
  String get pdfCountHeader => 'Nombre';

  @override
  String get pdfVerySmallEnterprise => 'Très petite entreprise';

  @override
  String get pdfSmallEnterprise => 'Petite entreprise';

  @override
  String get pdfMediumEnterprise => 'Moyenne entreprise';

  @override
  String get pdfLargeEnterprise => 'Grande entreprise';

  @override
  String get pdfExecutivesLabel => 'Cadres';

  @override
  String get pdfForemenLabel => 'Agents de maîtrise';

  @override
  String get pdfWorkersLabel => 'Ouvriers';

  @override
  String get pdfLevelHeader => 'Niveau';

  @override
  String get pdfSeekersRegisteredLabel => 'Demandes enregistrées';

  @override
  String get pdfFirstRecruitsLabel => 'Primo-recrutés';

  @override
  String get pdfConversionRateLabel => 'Taux de conversion';

  @override
  String get pdfPermanentLabel => 'CDI / permanent';

  @override
  String get pdfTemporaryLabel => 'Temporaire';

  @override
  String get pdfAgeRangeHeader => 'Tranche';

  @override
  String get pdfOtherLabel => 'Autres';

  @override
  String get pdfVulnerablePeopleLabel => 'Personnes vulnérables';

  @override
  String get pdfTotalRecruitmentsLabel => 'Recrutements totaux';

  @override
  String get pdfRecruits1534Label => 'Recrutements 15-34';

  @override
  String get pdfTotalRecruitmentsLabel2 => 'Total recrutements';

  @override
  String get pdfSkillHeader => 'Compétence';

  @override
  String get pdfDemandHeader => 'Demande';

  @override
  String get pdfSupplyHeader => 'Offre';

  @override
  String get pdfTrainingHeader => 'Formation';

  @override
  String get pdfNoDataAvailable => 'Aucune donnée disponible';

  @override
  String pdfExportError(String error) {
    return 'Export impossible : $error';
  }

  @override
  String get companyDeclDraftsFilter => 'Brouillons';

  @override
  String get companyDeclApprovedFilter => 'Approuvées';

  @override
  String get companyDeclRejectedFilter => 'Rejetées';

  @override
  String get companyDeclFiliereColumn => 'Filière';

  @override
  String get companyDeclDeclarationColumn => 'Déclaration';

  @override
  String get companyDeclDetailsColumn => 'Détails';

  @override
  String get companyDeclDateColumn => 'Date';

  @override
  String get companyDeclPdfColumn => 'PDF';

  @override
  String get companyDeclNewButton => 'Nouvelle';

  @override
  String get companyDeclDownloadPdfTooltip => 'Télécharger le PDF';

  @override
  String get companyDeclDownloadPdfError => 'Impossible d\'ouvrir le PDF';

  @override
  String get companyDeclNoResultsTitle => 'Aucun résultat';

  @override
  String get companyDeclEmptyTitle => 'Aucune déclaration pour le moment';

  @override
  String get companyDeclTryDifferentFilter => 'Essayez un autre filtre';

  @override
  String get companyDeclEmptySubtitle =>
      'Vos déclarations DSMO et questionnaires ONEFOP\napparaîtront ici, y compris les brouillons.';

  @override
  String get companyDeclClearFilter => 'Effacer le filtre';

  @override
  String get companyDeclResumeDraft => 'Reprendre le brouillon';

  @override
  String companyDeclDsmoTitle(String period) {
    return 'Déclaration DSMO $period';
  }

  @override
  String companyDeclOnefopTitle(String period) {
    return 'Questionnaire ONEFOP $period';
  }

  @override
  String get companyDeclStatusDivisionApproved => 'Approuvée (division)';

  @override
  String get companyDeclStatusRegionApproved => 'Approuvée (région)';

  @override
  String get companyDeclStatusCorrectionRequested => 'Corrections requises';

  @override
  String get companyAnalyticsTabBilanRh => 'Bilan RH';

  @override
  String get companyAnalyticsTabBenchmarking => 'Benchmarking';

  @override
  String get companyAnalyticsTabOpportunities => 'Opportunités';

  @override
  String get companyAnalyticsBadgeActive => 'Actif';

  @override
  String get companyAnalyticsBadgePending => 'En attente';

  @override
  String get companyAnalyticsOpportunitiesTitle => 'Opportunités actionnables';

  @override
  String get companyAnalyticsOpportunitiesDescription =>
      'Formations éligibles à des subventions, candidats correspondant à vos postes vacants, et incitatifs fiscaux détectés à partir de vos données.';

  @override
  String get companyAnalyticsComingSoonBadge => 'Bientôt disponible';

  @override
  String companyAnalyticsHeaderYear(int year) {
    return 'Analytique $year';
  }

  @override
  String get companyAnalyticsBilanSubtitle =>
      'Données issues de vos déclarations ONEFOP approuvées';

  @override
  String get companyAnalyticsSectionMySituation => 'Ma Situation';

  @override
  String companyAnalyticsLoadError(String error) {
    return 'Erreur chargement : $error';
  }

  @override
  String get companyAnalyticsSectionBilanDetailed => 'Bilan RH Détaillé';

  @override
  String get companyAnalyticsSectionBenchmarking => 'Benchmarking Sectoriel';

  @override
  String get companyAnalyticsBenchmarkingComingTitle =>
      'Benchmarking sectoriel';

  @override
  String get companyAnalyticsBenchmarkingComingDescription =>
      'Comparez vos indicateurs RH avec les entreprises de votre secteur et région. Disponible dès que votre dossier est approuvé et que suffisamment d\'entreprises ont soumis leur déclaration.';

  @override
  String companyAnalyticsPeerGroupCount(String count) {
    return '$count entreprises dans votre groupe de comparaison';
  }

  @override
  String companyAnalyticsBenchmarkError(String error) {
    return 'Erreur benchmarking : $error';
  }

  @override
  String get companyAnalyticsTotalWorkforce => 'Effectif total';

  @override
  String companyAnalyticsVsPreviousYearLabel(String value) {
    return '$value vs N-1';
  }

  @override
  String companyAnalyticsFemaleCountLabel(int count) {
    return '$count employées';
  }

  @override
  String companyAnalyticsMaleCountLabel(int count) {
    return '$count employés';
  }

  @override
  String get companyAnalyticsRecruitmentsLabel => 'Recrutements';

  @override
  String companyAnalyticsNetLabel(String value) {
    return 'Net : $value';
  }

  @override
  String get companyAnalyticsDeparturesLabel => 'Départs';

  @override
  String companyAnalyticsDismissalsRetirementsLabel(
      int dismissals, int retirements) {
    return '$dismissals licenciements · $retirements retraites';
  }

  @override
  String get companyAnalyticsCategoryBreakdownTitle =>
      'Répartition par catégorie';

  @override
  String get companyAnalyticsCatExecutives => 'Cadres (1-3)';

  @override
  String get companyAnalyticsCatSupervisors => 'Maîtrise (4-6)';

  @override
  String get companyAnalyticsCatWorkers => 'Ouvriers (7-9)';

  @override
  String get companyAnalyticsCatOthers => 'Autres (10-12)';

  @override
  String get companyAnalyticsCatUndeclared => 'Non-déclaré';

  @override
  String get companyAnalyticsUnitEmployees => 'employés';

  @override
  String get companyAnalyticsFeminizationRate => 'Taux de féminisation';

  @override
  String get companyAnalyticsBilanDeclarationSubtitle =>
      'Données issues de votre déclaration ONEFOP approuvée';

  @override
  String get companyAnalyticsSectionEffectifs => 'Effectifs';

  @override
  String get companyAnalyticsPermanentEmployees => 'Employés permanents';

  @override
  String get companyAnalyticsVacantPositions => 'Postes vacants';

  @override
  String get companyAnalyticsTurnoverRate => 'Taux de rotation';

  @override
  String get companyAnalyticsHigh => 'Élevé';

  @override
  String get companyAnalyticsNormal => 'Normal';

  @override
  String get companyAnalyticsSectionRecruitmentsByCategory =>
      'Recrutements par catégorie';

  @override
  String get companyAnalyticsSectionInterns => 'Stagiaires';

  @override
  String get companyAnalyticsSectionSkillsTraining => 'Compétences & Formation';

  @override
  String get companyAnalyticsCategoryHeader => 'Catégorie';

  @override
  String get companyAnalyticsExecutivesRow => 'Cadres';

  @override
  String get companyAnalyticsForemenRow => 'Agents de maîtrise';

  @override
  String get companyAnalyticsWorkersFieldRow => 'Ouvriers / terrain';

  @override
  String get companyAnalyticsGenderColumnMale => 'H';

  @override
  String get companyAnalyticsGenderColumnFemale => 'F';

  @override
  String companyAnalyticsPercentOfTotal(String pct) {
    return '$pct% du total';
  }

  @override
  String get companyAnalyticsDismissals => 'Licenciements';

  @override
  String get companyAnalyticsResignations => 'Démissions';

  @override
  String get companyAnalyticsRetirements => 'Retraites';

  @override
  String get companyAnalyticsOthers => 'Autres';

  @override
  String get companyAnalyticsNoDeparturesRecorded =>
      'Aucun départ enregistré sur la période.';

  @override
  String get companyAnalyticsTotalDepartures => 'Total départs';

  @override
  String get companyAnalyticsInternshipHoliday => 'Stage de vacances';

  @override
  String get companyAnalyticsInternshipAcademic => 'Stage académique';

  @override
  String get companyAnalyticsInternshipProfessional => 'Stage professionnel';

  @override
  String get companyAnalyticsInternshipPreWork => 'Stage pré-emploi';

  @override
  String get companyAnalyticsTotalInterns => 'Total stagiaires';

  @override
  String get companyAnalyticsSkillNeeds => 'Besoins en compétences';

  @override
  String get companyAnalyticsTrainingNeeds => 'Besoins en formation';

  @override
  String get companyAnalyticsSocialImpact => 'Impact social';

  @override
  String companyAnalyticsVulnerableWorkersRecruited(
      int count, int displaced, int refugees, int orphans) {
    return '$count travailleur(s) vulnérable(s) recruté(s) ($displaced déplacés, $refugees réfugiés, $orphans orphelins)';
  }

  @override
  String companyAnalyticsDisabledWorkersRecruited(int count) {
    return '$count personne(s) en situation de handicap recrutée(s)';
  }

  @override
  String companyAnalyticsPriorityProfilesShare(String pct) {
    return '$pct% de vos recrutements concernent des profils prioritaires.';
  }

  @override
  String get companyAnalyticsLockedUnderReview =>
      'Votre questionnaire ONEFOP est en cours de révision. Les analyses seront disponibles après approbation.';

  @override
  String get companyAnalyticsLockedDraft =>
      'Vous avez un brouillon ONEFOP en cours. Finalisez et soumettez pour accéder à vos analyses.';

  @override
  String get companyAnalyticsLockedDefault =>
      'Soumettez le questionnaire ONEFOP pour accéder à vos analyses personnelles.';

  @override
  String get companyAnalyticsBenchmarkLockedSubmitted =>
      'Votre questionnaire est en cours de révision par MINEFOP. Les comparaisons sectorielles seront débloquées après approbation.';

  @override
  String get companyAnalyticsBenchmarkLockedUnderReview =>
      'Votre questionnaire est en cours d\'analyse. Les benchmarks arrivent bientôt.';

  @override
  String get companyAnalyticsBenchmarkLockedDefault =>
      'Soumettez le questionnaire ONEFOP pour accéder aux analyses comparatives.';

  @override
  String get companyAnalyticsBilanLockedUnderReview =>
      'Votre déclaration ONEFOP est en cours de révision. Votre bilan RH sera disponible après approbation.';

  @override
  String get companyAnalyticsBilanLockedDraft =>
      'Vous avez un brouillon en cours. Finalisez et soumettez votre déclaration pour accéder à votre bilan.';

  @override
  String get companyAnalyticsBilanLockedDefault =>
      'Soumettez votre déclaration ONEFOP pour accéder à votre bilan RH personnalisé.';

  @override
  String get companyAnalyticsBilanLockedWrongYear =>
      'Aucun bilan RH approuvé pour cette année. Choisissez une autre année ci-dessus.';

  @override
  String get companyAnalyticsInsufficientDataTitle =>
      'Données insuffisantes pour le benchmarking';

  @override
  String companyAnalyticsInsufficientDataDetail(int count, int min) {
    return '$count entreprise(s) dans votre groupe (minimum $min requis).';
  }

  @override
  String companyAnalyticsPercentileTop(int percentile) {
    return 'Top $percentile%';
  }

  @override
  String get companyAnalyticsPercentileMedianPlus => 'Médian+';

  @override
  String companyAnalyticsPercentileBottom(int value) {
    return 'Bottom $value%';
  }

  @override
  String get companyAnalyticsYourCompany => 'Votre entreprise';

  @override
  String get companyAnalyticsSectorMedian => 'Médiane secteur';

  @override
  String get homeTabLabel => 'Accueil';

  @override
  String get onlineStatusLabel => 'En ligne';

  @override
  String get roleLabelCompany => 'Établissement';

  @override
  String settingsUpdatePreferenceError(String error) {
    return 'Impossible de mettre à jour ce paramètre : $error';
  }

  @override
  String get settingsTabGeneral => 'Général';

  @override
  String get settingsTabNotifications => 'Notifications';

  @override
  String get settingsTabSecurity => 'Sécurité';

  @override
  String get settingsTabIntegrations => 'Intégrations';

  @override
  String get settingsPageTitle => 'Paramètres';

  @override
  String get settingsPageSubtitle =>
      'Configurez votre établissement et votre compte';

  @override
  String get settingsGeneralCardTitle => 'Informations générales';

  @override
  String get settingsGeneralCardSubtitle =>
      'Mettez à jour les informations de votre établissement';

  @override
  String get settingsFieldEstablishmentName => 'Nom de l\'établissement';

  @override
  String get settingsFieldContactEmail => 'Email de contact';

  @override
  String get settingsFieldSiret => 'Numéro SIRET';

  @override
  String get settingsFieldPhone => 'Téléphone';

  @override
  String get settingsFieldAddress => 'Adresse complète';

  @override
  String get settingsNotificationsCardTitle => 'Préférences de notification';

  @override
  String get settingsNotificationsCardSubtitle =>
      'Choisissez comment vous souhaitez être alerté';

  @override
  String get settingsToggleEmailTitle => 'Notifications email';

  @override
  String get settingsToggleEmailSubtitle =>
      'Recevez un email pour chaque nouvelle déclaration';

  @override
  String get settingsToggleRealtimeTitle => 'Alertes en temps réel';

  @override
  String get settingsToggleRealtimeSubtitle =>
      'Notifications push dans le navigateur (préférence enregistrée — canal push à venir)';

  @override
  String get settingsToggleWeeklyTitle => 'Rapports hebdomadaires';

  @override
  String get settingsToggleWeeklySubtitle =>
      'Recevez un récapitulatif chaque lundi matin';

  @override
  String get settingsToggleSmsTitle => 'Notifications SMS';

  @override
  String get settingsToggleSmsSubtitle =>
      'Alertes urgentes par message texte (préférence enregistrée — canal SMS à venir)';

  @override
  String get settingsSecurityCardTitle => 'Sécurité du compte';

  @override
  String get settingsSecurityCardSubtitle =>
      'Protégez l\'accès à votre espace DSMO';

  @override
  String get settingsFieldCurrentPassword => 'Mot de passe actuel';

  @override
  String get settingsFieldNewPassword => 'Nouveau mot de passe';

  @override
  String get settingsPasswordHint => 'Min. 8 caractères';

  @override
  String get settingsToggle2faTitle => 'Authentification à deux facteurs (2FA)';

  @override
  String get settingsToggle2faSubtitle =>
      'Exiger un code de vérification envoyé par email à chaque connexion';

  @override
  String get settingsPasswordRequirements =>
      'Votre mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.';

  @override
  String get settingsIntegrationsCardSubtitle =>
      'Connectez DSMO à vos outils externes';

  @override
  String get settingsIntegrationSlackDesc =>
      'Recevez les alertes dans votre canal Slack';

  @override
  String get settingsIntegrationTeamsDesc =>
      'Notifications directement dans Teams';

  @override
  String get settingsIntegrationCalendarDesc =>
      'Synchronisez les échéances réglementaires';

  @override
  String get settingsIntegrationWebhookDesc =>
      'Envoyez les données à votre endpoint custom';

  @override
  String get settingsDangerZoneTitle => 'Zone de danger';

  @override
  String get settingsDangerZoneSubtitle =>
      'Actions irréversibles sur votre compte';

  @override
  String get settingsDeleteAccountTitle => 'Supprimer le compte';

  @override
  String get settingsDeleteAccountDesc =>
      'Votre compte sera désactivé immédiatement et vous serez déconnecté. Vous ne pourrez plus vous reconnecter sans l\'intervention d\'un administrateur. Vos déclarations soumises restent conservées, conformément aux obligations réglementaires.';

  @override
  String get settingsDeleteButton => 'Supprimer';

  @override
  String get settingsConfirmDeleteTitle => 'Confirmer la suppression';

  @override
  String get settingsConfirmDeleteBody =>
      'Cette action est irréversible. Votre compte sera désactivé et vous serez déconnecté immédiatement. Vos déclarations restent conservées à des fins de conformité.';

  @override
  String settingsDeleteAccountError(Object error) {
    return 'Impossible de supprimer votre compte : $error';
  }

  @override
  String get settingsConnectedBadge => 'Connecté';

  @override
  String get settingsConnectButton => 'Connecter';

  @override
  String get settingsSaveButton => 'Enregistrer';

  @override
  String get declarationsTabLabel => 'Déclarations';

  @override
  String get analyticsTabLabel => 'Analytique';

  @override
  String get settingsTabLabel => 'Paramètres';

  @override
  String get draftFoundTitle => 'Brouillon trouvé';

  @override
  String get draftFoundBody =>
      'Vous avez un formulaire ONEFOP en cours de saisie. Voulez-vous reprendre ou vous vous êtes arrêté ?';

  @override
  String get resumeDraftSubtitle => 'Continuer avec vos données précédentes';

  @override
  String get startOverTitle => 'Recommencer';

  @override
  String get startOverSubtitle => 'Effacer le brouillon et partir à zéro';

  @override
  String get entityTypeDialogTitle => 'Type d\'entité';

  @override
  String get entityTypeDialogBody =>
      'Sélectionnez le type de votre entité pour accéder au formulaire ONEFOP.';

  @override
  String get entityTypeEnterprise => 'Entreprise';

  @override
  String get entityTypeCooperative => 'Coopérative';

  @override
  String get entityTypeCtd => 'CTD';

  @override
  String get entityTypeOng => 'ONG';

  @override
  String get newSubmissionDialogTitle => 'Nouvelle soumission';

  @override
  String get newSubmissionDialogBody =>
      'Choisissez le type de document à créer';

  @override
  String get dsmoDeclarationOptionTitle => 'Déclaration DSMO';

  @override
  String get dsmoDeclarationOptionSubtitle =>
      'Déclaration sociale des main-d\'œuvre';

  @override
  String get onefopQuestionnaireOptionTitle => 'Questionnaire ONEFOP';

  @override
  String get onefopQuestionnaireOptionSubtitle =>
      'Information sur le marché du travail';

  @override
  String get companyProfileNotFoundError =>
      'Profil entreprise introuvable. Contactez l\'administrateur.';

  @override
  String get missingEstablishmentIdError =>
      'ID établissement manquant. Veuillez contacter l\'administrateur.';

  @override
  String get noOpenSubmissionPeriodError =>
      'Aucune période de soumission n\'est actuellement ouverte.';

  @override
  String profileLoadError(String error) {
    return 'Erreur lors du chargement du profil : $error';
  }

  @override
  String get noOpenDsmoPeriodError =>
      'Aucune période de déclaration DSMO n\'est actuellement ouverte.';

  @override
  String get attestationOpenError => 'Impossible d\'ouvrir l\'attestation.';

  @override
  String get attestationUnavailableError =>
      'Aucune attestation n\'est disponible pour ce compte.';

  @override
  String get attestationMenuLabel => 'Mon attestation d\'inscription';
}
