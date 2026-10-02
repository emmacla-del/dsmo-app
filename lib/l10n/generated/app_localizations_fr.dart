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
  String get tableResponseRequired =>
      'Indiquez si les chiffres sont déclarés, si aucun cas n\'est à signaler, ou si la question ne s\'applique pas';

  @override
  String get tableFiguresRequired =>
      'Saisissez des chiffres, ou choisissez « aucun cas à signaler »';

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
  String get tabSignIn => 'Ouvrir une session';

  @override
  String get tabCreateAccount => 'Créer un compte';

  @override
  String get landingSignUpButton => 'Demander l\'accès';

  @override
  String get landingNavProgramme => 'Programme';

  @override
  String get landingNavAbout => 'SIMT';

  @override
  String get landingNavObservatory => 'Observatoire';

  @override
  String get landingNavComponents => 'Composantes';

  @override
  String get landingKickerObservatory => 'L\'Observatoire';

  @override
  String get landingObservatoryBadge => 'Contenu en préparation';

  @override
  String get landingAboutTitle =>
      'Pourquoi un système d\'information sur le marché du travail ?';

  @override
  String get landingAboutPositioningTitle => 'Positionnement institutionnel';

  @override
  String get landingRoadmapTitle => 'Construire le système progressivement';

  @override
  String get landingValueStripTitle => 'Ce que CAMLEAP construit';

  @override
  String get landingSignInCta => 'Accéder à la plateforme';

  @override
  String get landingRequestAccountCta => 'Demander l\'accès';

  @override
  String get landingEnterLmisCta => 'Accéder au SIMT';

  @override
  String get landingHeroHeadline =>
      'Bâtir le système d\'information sur le marché du travail du Cameroun';

  @override
  String get landingProgrammeLine =>
      'Programme national pour le développement du système d\'information sur le marché du travail du Cameroun';

  @override
  String get landingHeroLead =>
      'Porté par l\'ONEFOP sous tutelle du Ministère de l\'Emploi et de la Formation Professionnelle (MINEFOP).';

  @override
  String get landingExploreProgramme => 'Découvrir le programme';

  @override
  String get landingCurrentImplementation => 'Mise en œuvre actuelle';

  @override
  String get landingPlanned => 'Planifiée';

  @override
  String get landingOperational => 'Opérationnelle';

  @override
  String landingComponentPrefix(String roman) {
    return 'Composante $roman';
  }

  @override
  String get landingArchitectureTitle =>
      'Le système d\'information sur le marché du travail';

  @override
  String get landingComponentsTitle => 'Composantes du programme CAMLEAP';

  @override
  String get landingCurrentSectionTitle => 'Mise en œuvre actuelle';

  @override
  String get landingDataToIntelTitle =>
      'Des données à l\'intelligence du marché du travail';

  @override
  String get landingEcosystemTitle =>
      'Une infrastructure d\'information pour le marché du travail';

  @override
  String get landingRepublic => 'République du Cameroun';

  @override
  String get landingMinefopName => 'MINEFOP';

  @override
  String get landingMinefopFull =>
      'Ministère de l\'Emploi et de la Formation Professionnelle';

  @override
  String get landingOnefopName => 'ONEFOP';

  @override
  String get landingOnefopFull =>
      'Observatoire National de l\'Emploi et de la Formation Professionnelle';

  @override
  String get landingKickerProgramme => 'Le programme';

  @override
  String get landingKickerLmis => 'Le SIMT';

  @override
  String get landingKickerComponents => 'Composantes';

  @override
  String get landingKickerImplementation => 'Mise en œuvre';

  @override
  String get landingKickerPlatform => 'Plateforme';

  @override
  String get landingKickerEcosystem => 'Écosystème';

  @override
  String get landingArchSources => 'Sources de données';

  @override
  String get landingArchCollection => 'Collecte';

  @override
  String get landingArchIntegration => 'Intégration';

  @override
  String get landingArchAnalysis => 'Analyse';

  @override
  String get landingArchIntelligence => 'Intelligence';

  @override
  String get landingArchDecision => 'Décision';

  @override
  String get landingFlowPaper => 'Collecte papier / fragmentée';

  @override
  String get landingFlowDigital => 'Questionnaires numériques';

  @override
  String get landingFlowValidation => 'Validation et standardisation';

  @override
  String get landingFlowCentralised => 'Données centralisées';

  @override
  String get landingFlowStructured =>
      'Information structurée sur le marché du travail';

  @override
  String get landingIntelCollect => 'Collecter';

  @override
  String get landingIntelValidate => 'Valider';

  @override
  String get landingIntelCentralise => 'Centraliser';

  @override
  String get landingIntelIntegrate => 'Intégrer';

  @override
  String get landingIntelAnalyse => 'Analyser';

  @override
  String get landingIntelIndicators => 'Produire des indicateurs';

  @override
  String get landingIntelDecisions => 'Éclairer les décisions';

  @override
  String get landingStakeGovTitle => 'Gouvernement et décideurs';

  @override
  String get landingStakeGovBody =>
      'Conçu pour appuyer les politiques d\'emploi, la planification et le suivi par des éléments de preuve.';

  @override
  String get landingStakeEmploymentTitle => 'Services de l\'emploi';

  @override
  String get landingStakeEmploymentBody =>
      'Conçu pour appuyer une meilleure compréhension de l\'offre, de la demande et des tendances de l\'emploi.';

  @override
  String get landingStakeSkillsTitle => 'Établissements de formation';

  @override
  String get landingStakeSkillsBody =>
      'Conçu pour appuyer l\'adéquation entre le développement des compétences et les besoins du marché du travail.';

  @override
  String get landingStakeEmployersTitle => 'Employeurs et partenaires sociaux';

  @override
  String get landingStakeEmployersBody =>
      'Conçu pour appuyer une information fiable sur la dynamique de l\'emploi et de la main-d\'œuvre.';

  @override
  String get landingStakeResearchTitle => 'Chercheurs et analystes';

  @override
  String get landingStakeResearchBody =>
      'Conçu pour appuyer une information structurée sur le marché du travail, pour l\'analyse et la recherche.';

  @override
  String get landingEcosystemNote =>
      'Ces usages seront appuyés progressivement, au fur et à mesure de la mise en œuvre des composantes du programme.';

  @override
  String get landingPillarCollect => 'Collecter';

  @override
  String get landingPillarIntegrate => 'Intégrer';

  @override
  String get landingPillarAnalyse => 'Analyser';

  @override
  String get landingPillarInform => 'Informer';

  @override
  String get loginHint => 'nom@entreprise.cm ou EN26000112';

  @override
  String get phoneHintShort => '6XXXXXXXX';

  @override
  String get noAccountPrompt => 'Pas encore de compte ?';

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
  String get loginLabel => 'Identifiant';

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
  String get registerSelectSubdivision =>
      'Veuillez sélectionner un arrondissement';

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
  String get registerEntitySubtitleAdministration =>
      'Administration publique ou service gouvernemental.';

  @override
  String get registerEntitySubtitleProjectProgram =>
      'Projet, programme ou structure sous tutelle d\'un ministère.';

  @override
  String get registerEntitySubtitleVocationalTraining =>
      'Centre de formation professionnelle participant à l\'enquête nationale ONEFOP.';

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
  String get registerEntityTypeSubtitle =>
      'Sélectionnez le type d\'entité que vous représentez.';

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
  String get registerRegionLabel => 'Région *';

  @override
  String get registerDepartmentLabel => 'Département *';

  @override
  String get registerSelectRegionFirst => 'Sélectionnez d\'abord une région';

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
  String get registerCompanyPendingInfoBox =>
      'Ces informations pré-rempliront automatiquement les Sections 0 et 1 de vos formulaires ONEFOP et la Partie A de vos déclarations DSMO.';

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
  String get footerVersionLine =>
      'CAMLEAP v2.4.1-stable  ·  © 2026 MINEFOP · République du Cameroun';

  @override
  String get platformName => 'CAMLEAP';

  @override
  String get platformTagline => 'Intelligence du marché du travail';

  @override
  String get platformFullName =>
      'Plateforme camerounaise d\'analyse de l\'emploi et du travail';

  @override
  String get camleapNavAbout => 'À propos';

  @override
  String get camleapNavOnefop => 'ONEFOP';

  @override
  String get camleapNavRegistre => 'Registre des formations';

  @override
  String get camleapNavEnquetes => 'Enquêtes employeurs';

  @override
  String get camleapSignIn => 'Se connecter';

  @override
  String get camleapEspaceDeclarant => 'Espace déclarant';

  @override
  String get camleapHeroHeadline =>
      'L\'infrastructure numérique de l\'ONEFOP pour l\'information et l\'observation du marché du travail';

  @override
  String get camleapHeroTagline =>
      'Déclarations · Registre des entités · Enquêtes · Analyse (à venir)';

  @override
  String get camleapHeroBody =>
      'CAMLEAP est la plateforme technique qui accompagne la mission de l\'ONEFOP. Elle structure la collecte des déclarations, organise le registre des entités de formation et prépare les outils d\'observation du marché du travail camerounais.';

  @override
  String get camleapHeroCtaPrimary => 'Faire ma déclaration';

  @override
  String get camleapHeroCtaSecondary => 'Découvrir ONEFOP';

  @override
  String get camleapAudienceTitle => 'Vous êtes...';

  @override
  String get camleapEconomicEntitiesTitle => 'Entités économiques';

  @override
  String get camleapEntreprise => 'Entreprise';

  @override
  String get camleapCooperative => 'Coopérative';

  @override
  String get camleapPublicEntitiesTitle => 'Entités publiques';

  @override
  String get camleapCtd => 'CTD';

  @override
  String get camleapOng => 'ONG';

  @override
  String get camleapVocationalTrainingTitle => 'Formation professionnelle';

  @override
  String get camleapVocationalTrainingBody =>
      'Inscription au registre national des CFP (Centres de Formation).';

  @override
  String get camleapComingSoonBadge => 'Bientôt disponible';

  @override
  String get camleapUnderstandTitle => 'Comprendre ONEFOP';

  @override
  String get camleapUnderstandBody =>
      'L\'ONEFOP est en cours de restructuration pour mieux remplir sa mission d\'observation du marché du travail. Deux composantes structurantes sont en déploiement progressif.';

  @override
  String get camleapLmisCardTitle =>
      'LMIS - Système d\'Information sur le Marché du Travail';

  @override
  String get camleapLmisCardBody =>
      'L\'infrastructure de collecte, d\'intégration et de gestion des données emploi et formation à l\'échelle nationale.';

  @override
  String get camleapLmisBadge => 'En cours de déploiement';

  @override
  String get camleapObservatoireCardTitle =>
      'Observatoire du Marché du Travail';

  @override
  String get camleapObservatoireCardBody =>
      'La composante d\'analyse et de diffusion de l\'intelligence sur le marché du travail camerounais.';

  @override
  String get camleapAVenir => 'À venir';

  @override
  String get camleapLearnMore => 'En savoir plus';

  @override
  String get camleapAvailableTodayTitle => 'Disponible aujourd\'hui';

  @override
  String get camleapAvailable1 =>
      'Déclarations des entités (entreprises, coopératives, CTD, ONG)';

  @override
  String get camleapAvailable2 => 'Documentation technique';

  @override
  String get camleapAvailable3 =>
      'Espace déclarant pour les entités (accès sur demande)';

  @override
  String get camleapComing1 =>
      'Registre national des entités de formation (CFP)';

  @override
  String get camleapComing3 => 'Observatoire — tableaux de bord et rapports';

  @override
  String get camleapComing4 => 'Portail public de données';

  @override
  String get camleapAccessRequestTitle => 'Demande d\'accès';

  @override
  String get camleapAccessRequestBody =>
      'Pour demander l\'accès à l\'espace déclarant, préciser votre fonction, entité et administration de rattachement.';

  @override
  String get camleapYaounde => 'Yaoundé, Cameroun';

  @override
  String camleapCopyright(int year) {
    return '© $year ONEFOP. Tous droits réservés.';
  }

  @override
  String get camleapComingSoonPageBody =>
      'Cette page est en cours de préparation. Revenez bientôt ou contactez-nous à contact@onefop.cm pour plus d\'informations.';

  @override
  String get camleapTitleDeclarerEntreprise => 'Déclaration — Entreprise';

  @override
  String get camleapTitleDeclarerCooperative => 'Déclaration — Coopérative';

  @override
  String get camleapTitleDeclarerCtd => 'Déclaration — CTD';

  @override
  String get camleapTitleDeclarerOng => 'Déclaration — ONG';

  @override
  String get forgotPasswordTitle => 'Mot de passe oublié';

  @override
  String get forgotPasswordResetDoneTitle => 'Mot de passe réinitialisé';

  @override
  String get forgotPasswordStep1Subtitle =>
      'Entrez l\'adresse e-mail de votre compte pour commencer.';

  @override
  String get forgotPasswordStep2Subtitle =>
      'Répondez aux deux questions et choisissez un nouveau mot de passe.';

  @override
  String get forgotPasswordDoneSubtitle =>
      'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.';

  @override
  String get accountEmailLabel => 'Email du compte';

  @override
  String get emailRequiredShort => 'Email requis';

  @override
  String get answerRequiredShort => 'Réponse requise';

  @override
  String get newPasswordLabel => 'Nouveau mot de passe';

  @override
  String get confirmNewPasswordLabel => 'Confirmer le nouveau mot de passe';

  @override
  String get resetPasswordButton => 'Réinitialiser le mot de passe';

  @override
  String get goToSignIn => 'Aller à la connexion';

  @override
  String get backLabel => 'Retour';

  @override
  String get resetPasswordTitle => 'Réinitialiser le mot de passe';

  @override
  String get resetPasswordInvalidLink =>
      'Lien de réinitialisation invalide. Veuillez refaire une demande depuis la page de connexion.';

  @override
  String get resetPasswordSuccess =>
      'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.';

  @override
  String get chooseNewPassword => 'Choisissez un nouveau mot de passe';

  @override
  String get resetButton => 'Réinitialiser';

  @override
  String get changePasswordRequiredTitle => 'Changement de mot de passe requis';

  @override
  String get changePasswordRequiredBody =>
      'Votre mot de passe a été défini par un administrateur. Choisissez-en un nouveau pour continuer.';

  @override
  String get temporaryPasswordLabel => 'Mot de passe temporaire';

  @override
  String get temporaryPasswordRequired => 'Mot de passe temporaire requis';

  @override
  String get changePasswordButton => 'Changer le mot de passe';

  @override
  String get verifyingInProgress => 'Vérification en cours…';

  @override
  String get emailVerifiedTitle => 'Adresse e-mail vérifiée';

  @override
  String get verificationFailedTitle => 'Vérification impossible';

  @override
  String get invalidVerificationLink =>
      'Lien de vérification invalide. Veuillez refaire une demande depuis votre compte.';

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
  String get welcomeHeading => 'Bienvenue';

  @override
  String get welcomeSubtitle =>
      'Directeur / Promoteur, complétez le questionnaire ci-dessous pour votre établissement.';

  @override
  String welcomeHeadingPersonalized(String name) {
    return 'Bienvenue, $name';
  }

  @override
  String welcomeSubtitlePersonalized(String function) {
    return 'En tant que $function, veuillez compléter le questionnaire ci-dessous pour votre établissement.';
  }

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
  String get entityShortVocationalTraining => 'CFP';

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
  String get estimatedTimeCaption => 'Temps estimé : 20-30 minutes';

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
  String get companyAnalyticsOpportunitiesTitle => 'Opportunités';

  @override
  String get companyAnalyticsOpportunitiesDescription =>
      'Signaux tirés de vos propres données déclarées : postes à pourvoir, écarts par rapport à votre secteur, besoins en formation et échéances à venir.';

  @override
  String get companyAnalyticsComingSoonBadge => 'Bientôt disponible';

  @override
  String get opportunitiesVacancyTitle => 'Postes à pourvoir';

  @override
  String opportunitiesVacancyDetail(int vacancies, String rate) {
    String _temp0 = intl.Intl.pluralLogic(
      vacancies,
      locale: localeName,
      other: '$vacancies postes vacants déclarés,',
      one: '1 poste vacant déclaré,',
      zero: 'Aucun poste vacant déclaré.',
    );
    return '$_temp0 soit $rate% de votre effectif permanent.';
  }

  @override
  String get opportunitiesBenchmarkGapTitle =>
      'Écarts par rapport à votre secteur';

  @override
  String opportunitiesBenchmarkGapWorkforce(int mine, int median) {
    return 'Votre effectif ($mine) est inférieur à la médiane de votre secteur ($median).';
  }

  @override
  String opportunitiesBenchmarkGapFeminization(String mine, String median) {
    return 'Votre taux de féminisation ($mine%) est inférieur à la médiane de votre secteur ($median%).';
  }

  @override
  String opportunitiesBenchmarkGapTurnover(String mine, String median) {
    return 'Votre taux de rotation ($mine%) est supérieur à la médiane de votre secteur ($median%).';
  }

  @override
  String get opportunitiesDeadlinesTitle => 'Échéances à venir';

  @override
  String opportunitiesDeadlineInDays(String date, int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days jours',
      one: '1 jour',
      zero: 'moins d\'un jour',
    );
    return '$date · dans $_temp0';
  }

  @override
  String opportunitiesDeadlinePassed(String date) {
    return '$date · échéance dépassée';
  }

  @override
  String companyAnalyticsHeaderYear(int year) {
    return 'Analytique $year';
  }

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
  String get companyAnalyticsRecruitmentsLabel => 'Recrutements';

  @override
  String get companyAnalyticsDeparturesLabel => 'Départs';

  @override
  String get companyAnalyticsUnitEmployees => 'employés';

  @override
  String get companyAnalyticsFeminizationRate => 'Taux de féminisation';

  @override
  String get companyAnalyticsBilanDeclarationSubtitle =>
      'Données issues de votre déclaration ONEFOP approuvée';

  @override
  String companyAnalyticsBilanAggregatedSubtitle(int quarterCount) {
    return 'Données cumulées sur $quarterCount déclarations ONEFOP approuvées cette année';
  }

  @override
  String get companyAnalyticsExportPdfButton => 'Exporter en PDF';

  @override
  String get companyAnalyticsBilanPdfExportError =>
      'Impossible de générer le PDF. Veuillez réessayer.';

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
  String get companyAnalyticsBenchmarkLockedDefault =>
      'Soumettez le questionnaire ONEFOP pour accéder aux analyses comparatives.';

  @override
  String get companyAnalyticsNoOwnDataTitle => 'Déclaration DSMO manquante';

  @override
  String companyAnalyticsNoOwnDataDetail(int year) {
    return 'Le benchmarking nécessite une déclaration DSMO annuelle approuvée pour $year. Votre questionnaire ONEFOP est bien approuvé — il manque la déclaration DSMO de la même année.';
  }

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
  String get settingsFieldSiret => 'Numéro d\'identifiant unique (NIU)';

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
  String get settingsProfileSaved =>
      'Les informations de votre établissement ont été mises à jour.';

  @override
  String settingsProfileSaveError(Object error) {
    return 'Impossible d\'enregistrer vos modifications : $error';
  }

  @override
  String get settingsPasswordChanged => 'Votre mot de passe a été modifié.';

  @override
  String settingsPasswordChangeError(Object error) {
    return 'Impossible de modifier le mot de passe : $error';
  }

  @override
  String get settingsPasswordFieldsRequired =>
      'Renseignez votre mot de passe actuel et le nouveau.';

  @override
  String get settingsContactEmailReadOnlyHint =>
      'Il s\'agit de votre email de connexion. Contactez un administrateur pour le modifier.';

  @override
  String get settingsRegistrationNumberReadOnlyHint =>
      'Attribué lors de l\'inscription, non modifiable ici.';

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
  String get unknownEntityTypeError =>
      'Type d\'entité non reconnu. Merci de contacter l\'administrateur.';

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

  @override
  String get adminResetPasswordTitle => 'Réinitialiser un mot de passe';

  @override
  String get adminResetPasswordInstructions =>
      'Vérifiez d\'abord l\'identité de l\'utilisateur par un canal officiel (téléphone, en personne), puis envoyez-lui un lien de réinitialisation par e-mail.';

  @override
  String get adminResetPasswordEmailFieldLabel => 'Email du compte utilisateur';

  @override
  String get emailInvalidShort => 'Email invalide';

  @override
  String get adminResetPasswordSendButton =>
      'Envoyer un lien de réinitialisation';

  @override
  String adminResetPasswordSentMessage(String email) {
    return 'Un lien de réinitialisation a été envoyé à $email.';
  }

  @override
  String get adminResetPasswordLinkExpiryNote =>
      'Le lien expire dans 45 minutes et ne peut être utilisé qu\'une seule fois.';

  @override
  String get adminResetPasswordSendAnotherButton => 'Envoyer un autre lien';

  @override
  String get annuaireUsersTabLabel => 'Utilisateurs';

  @override
  String get annuaireEntitiesTabLabel => 'Entités';

  @override
  String get companiesSearchHint =>
      'Rechercher par nom, NIU, identifiant, région...';

  @override
  String companiesTotalCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count entreprises',
      one: '1 entreprise',
      zero: 'Aucune entreprise',
    );
    return '$_temp0';
  }

  @override
  String get companiesCreatedAtColumnHeader => 'Créé le';

  @override
  String get companiesContactColumnHeader => 'Contact';

  @override
  String get companiesSuspendedBadge => 'Suspendu';

  @override
  String companiesPaginationLabel(int page, int totalPages) {
    return 'Page $page sur $totalPages';
  }

  @override
  String get companiesEmptyTitle => 'Aucune entreprise trouvée';

  @override
  String get companiesEmptySubtitle => 'Essayez une autre recherche.';

  @override
  String companiesGenderBreakdownMenCount(num count) {
    return '$count hommes';
  }

  @override
  String companiesGenderBreakdownWomenCount(num count) {
    return '$count femmes';
  }

  @override
  String get companiesDetailIdentitySectionTitle => 'Identité';

  @override
  String get companiesMainActivityLabel => 'Activité principale';

  @override
  String get companiesLegalStatusLabel => 'Statut juridique';

  @override
  String get companiesRegistrationNumberLabel => 'N° d\'enregistrement';

  @override
  String get companiesCnpsNumberLabel => 'N° CNPS';

  @override
  String get companiesYearOfCreationLabel => 'Année de création';

  @override
  String get companiesEnterpriseSizeLabel => 'Taille d\'entreprise';

  @override
  String get companiesRegisteredOnLabel => 'Enregistré le';

  @override
  String get companiesSubdivisionLabel => 'Subdivision';

  @override
  String get companiesAddressLabel => 'Adresse';

  @override
  String get companiesDetailContactSectionTitle => 'Contact entreprise';

  @override
  String get companiesAccountStatusLabel => 'Statut du compte';

  @override
  String get companiesDetailRespondentSectionTitle => 'Répondant';

  @override
  String get companiesGenderBreakdownRowLabel => 'Répartition';

  @override
  String get companiesPreviousYearWorkforceLabel => 'Effectif année précédente';

  @override
  String get companiesPreviousYearBreakdownLabel =>
      'Répartition (année précédente)';

  @override
  String get createMinefopUserLoadFunctionsError =>
      'Impossible de charger les fonctions.';

  @override
  String get createMinefopUserSelectRoleError =>
      'Veuillez sélectionner un rôle';

  @override
  String get createMinefopUserAppBarTitle => 'Nouvel agent MINEFOP';

  @override
  String get createMinefopUserFirstNameLabel => 'Prénom';

  @override
  String get createMinefopUserProfessionalEmailLabel => 'Email professionnel';

  @override
  String get createMinefopUserRoleSectionLabel => 'Rôle';

  @override
  String get createMinefopUserSelectRoleHint => 'Sélectionner un rôle';

  @override
  String get createMinefopUserPositionSectionLabel => 'Poste';

  @override
  String get createMinefopUserMatriculeLabel => 'Matricule';

  @override
  String get createMinefopUserCreateAccountButton => 'Créer le compte';

  @override
  String get createMinefopUserLoadingFunctions => 'Chargement des fonctions…';

  @override
  String get createMinefopUserNoFunctionsAvailable =>
      'Aucune fonction disponible pour ce rôle.';

  @override
  String get createMinefopUserSelectFunctionHint => 'Sélectionner la fonction';

  @override
  String get createMinefopUserLoadingUnits => 'Chargement des unités…';

  @override
  String get createMinefopUserNoUnitsAvailable => 'Aucune unité disponible.';

  @override
  String get createMinefopUserParentUnitHint => 'Unité parente';

  @override
  String get createMinefopUserLoadingServices => 'Chargement des services…';

  @override
  String get createMinefopUserNoServiceFound =>
      'Aucun service trouvé sous cette unité.';

  @override
  String get createMinefopUserExactServiceHint => 'Service exact';

  @override
  String get createMinefopUserLoadingRegions => 'Chargement des régions…';

  @override
  String get createMinefopUserSelectRegionFirstNote =>
      'Sélectionnez d\'abord une région.';

  @override
  String get createMinefopUserLoadingDepartments =>
      'Chargement des départements…';

  @override
  String createMinefopUserCopiedToast(String label) {
    return '$label copié';
  }

  @override
  String get createMinefopUserAccountCreatedTitle => 'Compte créé';

  @override
  String get createMinefopUserCredentialsWarning =>
      'Ce mot de passe temporaire ne sera plus jamais affiché. Transmettez-le à l\'agent (WhatsApp, téléphone, en personne) — il devra le changer à sa première connexion.';

  @override
  String get createMinefopUserDoneButton => 'Terminé';

  @override
  String get createMinefopUserCopyTooltip => 'Copier';

  @override
  String get landingConfigRestoreDialogTitle => 'Restaurer cette version ?';

  @override
  String get landingConfigRestoreDialogBody =>
      'La page d\'accueil publique sera immédiatement remplacée par le contenu de cette version. L\'état actuel est lui-même sauvegardé et pourra être restauré ensuite.';

  @override
  String get landingConfigRestoreButton => 'Restaurer';

  @override
  String get landingConfigVersionRestoredToast => 'Version restaurée';

  @override
  String landingConfigRestoreFailedToast(String error) {
    return 'Échec de la restauration : $error';
  }

  @override
  String get landingConfigUpdatedToast => 'Page d\'accueil mise à jour';

  @override
  String landingConfigSaveFailedToast(String error) {
    return 'Échec de l\'enregistrement : $error';
  }

  @override
  String get landingConfigAppBarTitle => 'Page d\'accueil publique';

  @override
  String get landingConfigDescriptionNote =>
      'Contenu narratif de la page d\'accueil publique (programme SIMT / CAMLEAP) : statut, phrase de soutien, composantes, piliers Collecter / Intégrer / Analyser / Informer, objet du programme, appel à l\'accès. Réservé au SUPER_ADMIN.';

  @override
  String landingConfigLastModifiedLabel(String date) {
    return 'Dernière modification : $date';
  }

  @override
  String get landingConfigStatusSectionTitle => 'Statut du programme';

  @override
  String get landingConfigStatusLineFieldLabel =>
      'Ligne de statut (sous la composante actuelle)';

  @override
  String get landingConfigHeroSectionTitle => 'Hero';

  @override
  String get landingConfigMainTitleFieldLabel => 'Titre principal';

  @override
  String get landingConfigSupportingLineFieldLabel =>
      'Phrase de soutien (sous le titre)';

  @override
  String get landingConfigComponentsSectionTitle =>
      'Composantes du programme (I–IV)';

  @override
  String get landingConfigCaptionFieldLabel => 'Légende (sous les composantes)';

  @override
  String get landingConfigPillarsSectionTitle =>
      'Piliers LMIS (Collecter / Intégrer / Analyser / Informer)';

  @override
  String landingConfigCardIndexLabel(int index) {
    return 'Carte $index';
  }

  @override
  String get landingConfigKickerFieldLabel => 'Mot-clé (au-dessus du titre)';

  @override
  String get landingConfigTitleFieldLabel => 'Titre';

  @override
  String get landingConfigTextFieldLabel => 'Texte';

  @override
  String get landingConfigArchSectionTitle => 'Pipeline architecture SIMT';

  @override
  String get landingConfigArchSectionNote =>
      'Actuellement non affiché sur la page publique — la section correspondante a été fusionnée avec le pipeline « données → intelligence » ci-dessous. Les modifications sont enregistrées mais restent invisibles.';

  @override
  String landingConfigStepIndexLabel(int index) {
    return 'Étape $index';
  }

  @override
  String get landingConfigIntelSectionTitle =>
      'Pipeline données → intelligence';

  @override
  String get landingConfigEcosystemSectionTitle => 'Écosystème institutionnel';

  @override
  String landingConfigBlockTitleFieldLabel(int index) {
    return 'Bloc $index — titre';
  }

  @override
  String landingConfigBlockTextFieldLabel(int index) {
    return 'Bloc $index — texte';
  }

  @override
  String get landingConfigAboutSectionTitle =>
      'Objet du programme (pourquoi un SIMT)';

  @override
  String landingConfigParagraphIndexLabel(int index) {
    return 'Paragraphe $index';
  }

  @override
  String get landingConfigObservatorySectionTitle =>
      'Observatoire (page publique /observatory)';

  @override
  String get landingConfigObservatoryNote =>
      'Contenu provisoire — aucun texte définitif n\'a encore été fourni pour l\'Observatoire public. La page publique affiche un badge « contenu en préparation » tant que ce texte reste la copie par défaut ci-dessous.';

  @override
  String get landingConfigDescriptionFieldLabel => 'Description';

  @override
  String landingConfigIndicatorIndexLabel(int index) {
    return 'Indicateur $index';
  }

  @override
  String get landingConfigCtaSectionTitle => 'Appel à l\'accès';

  @override
  String get landingConfigSubtextFieldLabel => 'Sous-texte';

  @override
  String get landingConfigAccessSectionTitle => 'Accès à la plateforme';

  @override
  String get landingConfigAccessNoteFieldLabel =>
      'Note d\'accès (sous les boutons)';

  @override
  String get landingConfigPreviewSectionTitle => 'Aperçu';

  @override
  String get landingConfigFrChipLabel => 'FR';

  @override
  String get landingConfigEnChipLabel => 'EN';

  @override
  String get landingConfigHistorySectionTitle => 'Historique (restauration)';

  @override
  String get landingConfigNoHistoryMessage =>
      'Aucune version antérieure enregistrée.';

  @override
  String landingConfigComponentShortNameLabel(String roman) {
    return 'Composante $roman — nom court';
  }

  @override
  String landingConfigComponentDescriptionLabel(String roman) {
    return 'Composante $roman — description';
  }

  @override
  String regionsSectorsLoadError(String error) {
    return 'Erreur de chargement : $error';
  }

  @override
  String get regionsSectorsAppBarTitle => 'Régions & Secteurs';

  @override
  String get regionsSectorsNoResultsSubtitle =>
      'Aucune région ou secteur ne correspond à votre recherche.';

  @override
  String regionsSectorsSectionHeaderWithCount(String title, int count) {
    return '$title ($count)';
  }

  @override
  String get regionsSectorsSectorsLabel => 'Secteurs';

  @override
  String get regionsSectorsOnefopSubmissionsStatLabel => 'Soumissions ONEFOP';

  @override
  String get regionsSectorsSearchHint => 'Rechercher une région ou un secteur…';

  @override
  String get regionsSectorsAllFilterChip => 'Tout';

  @override
  String get regionsSectorsActionsColumnHeader => 'Actions';

  @override
  String regionsSectorsDeleteConfirmBody(String itemName) {
    return 'Supprimer définitivement $itemName ?';
  }

  @override
  String get regionsSectorsEditRegionDialogTitle => 'Modifier la région';

  @override
  String get regionsSectorsRegionUpdatedToast => 'Région mise à jour';

  @override
  String regionsSectorsGenericErrorToast(String error) {
    return 'Erreur : $error';
  }

  @override
  String get regionsSectorsRegionDeletedToast => 'Région supprimée';

  @override
  String get regionsSectorsEditSectorDialogTitle => 'Modifier le secteur';

  @override
  String get regionsSectorsSectorUpdatedToast => 'Secteur mis à jour';

  @override
  String get regionsSectorsSectorDeletedToast => 'Secteur supprimé';

  @override
  String get settingsSavedToast => 'Paramètres enregistrés';

  @override
  String get systemSettingsScreenTitle => 'Paramètres système';

  @override
  String get systemSettingsScreenSubtitle =>
      'Configuration valable pour toute la plateforme. Réservé au SUPER_ADMIN.';

  @override
  String get securityPolicySectionTitle => 'Politique de sécurité';

  @override
  String get passwordMinLengthLabel => 'Longueur minimale du mot de passe';

  @override
  String get require2faStaffLabel =>
      'Double authentification obligatoire (personnel MINEFOP)';

  @override
  String get require2faStaffSubtitle =>
      'Empêche les comptes non-entreprise de désactiver leur 2FA.';

  @override
  String get maintenanceModeSectionTitle => 'Mode maintenance';

  @override
  String get enableMaintenanceModeLabel => 'Activer le mode maintenance';

  @override
  String get maintenanceModeSubtitle =>
      'Bloque tous les accès sauf le SUPER_ADMIN, avec le message ci-dessous.';

  @override
  String get maintenanceMessageFieldLabel => 'Message affiché aux utilisateurs';

  @override
  String get maintenanceMessageFieldHint =>
      'La plateforme est actuellement en maintenance...';

  @override
  String get referenceDataSectionTitle => 'Données de référence';

  @override
  String get referenceDataSectionDescription =>
      'Gérer la taxonomie régions/secteurs utilisée par les filtres et formulaires de toute la plateforme.';

  @override
  String get manageRegionsSectorsButton => 'Gérer les régions et secteurs';

  @override
  String get userStatusActivePluralLabel => 'Actifs';

  @override
  String get userStatusSuspendedPluralLabel => 'Suspendus';

  @override
  String get userStatusRejectedPluralLabel => 'Rejetés';

  @override
  String get approveAgentDialogTitle => 'Approuver l\'agent';

  @override
  String approveAgentConfirmBody(String name) {
    return 'Confirmer l\'approbation de $name ?';
  }

  @override
  String get approveActionLabel => 'Approuver';

  @override
  String userApprovedToast(String name) {
    return '$name approuvé avec succès';
  }

  @override
  String genericErrorToastNoSpace(String error) {
    return 'Erreur: $error';
  }

  @override
  String userRejectedToast(String name) {
    return '$name rejeté';
  }

  @override
  String userRoleUpdatedToast(String role) {
    return 'Rôle mis à jour : $role';
  }

  @override
  String get suspendAccountDialogTitle => 'Suspendre le compte';

  @override
  String get reactivateAccountDialogTitle => 'Réactiver le compte';

  @override
  String suspendAccountBody(String name) {
    return '$name ne pourra plus se connecter jusqu\'à réactivation.';
  }

  @override
  String reactivateAccountBody(String name) {
    return '$name pourra de nouveau se connecter.';
  }

  @override
  String get suspendActionLabel => 'Suspendre';

  @override
  String get reactivateActionLabel => 'Réactiver';

  @override
  String userSuspendedToast(String name) {
    return '$name suspendu';
  }

  @override
  String userReactivatedToast(String name) {
    return '$name réactivé';
  }

  @override
  String userDeletedToast(String name) {
    return '$name supprimé';
  }

  @override
  String get rejectTooltip => 'Rejeter';

  @override
  String get editRoleActionLabel => 'Modifier le rôle';

  @override
  String get usersSearchFieldHint => 'Rechercher par nom, email, matricule...';

  @override
  String userAccountsCountLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count comptes',
      one: '$count compte',
    );
    return '$_temp0';
  }

  @override
  String get allRolesFilterLabel => 'Tous les rôles';

  @override
  String get regionDepartmentColumnHeader => 'Région / Département';

  @override
  String get noUsersFoundTitle => 'Aucun compte trouvé';

  @override
  String get noUsersFoundSubtitle =>
      'Essayez une autre recherche ou un autre filtre.';

  @override
  String rejectUserSheetTitle(String name) {
    return 'Rejeter $name';
  }

  @override
  String get rejectReasonLabel => 'Motif du rejet (optionnel)';

  @override
  String get rejectReasonHint => 'Ex: Documents incomplets...';

  @override
  String get confirmRejectButton => 'Confirmer le rejet';

  @override
  String deleteUserSheetTitle(String name) {
    return 'Supprimer $name ?';
  }

  @override
  String get deleteUserIrreversibleWarning =>
      'Action irréversible. Si ce compte a des déclarations, soumissions ou notifications liées, la suppression sera refusée — suspendez-le à la place.';

  @override
  String typeEmailToConfirmLabel(String email) {
    return 'Tapez \"$email\" pour confirmer';
  }

  @override
  String get newAgentButtonLabel => 'Nouvel agent';

  @override
  String get regionDeptSelectorLoadRegionsError =>
      'Impossible de charger les régions.';

  @override
  String get allRegionsCheckboxLabel => 'Toutes les régions';

  @override
  String get noDepartmentsAvailableLabel => 'Aucun département disponible';

  @override
  String get campaignDetailStartDateLabel => 'Date de début';

  @override
  String get campaignDetailEndDateLabel => 'Date de fin';

  @override
  String get campaignDetailTargetUsersLabel => 'Utilisateurs ciblés';

  @override
  String get campaignDetailAvailableFormsLabel => 'Formulaires disponibles';

  @override
  String get openCampaignButton => 'Ouvrir la campagne';

  @override
  String get identificationTableSelectHint => 'Choisir...';

  @override
  String get identificationTableTextInputHint => 'Saisir...';

  @override
  String get companyDeclMyDeclarationsTitle => 'Mes déclarations';

  @override
  String get companyDeclMyDeclarationsSubtitle =>
      'Suivez vos déclarations d\'emploi, vos soumissions et leur statut d\'approbation';

  @override
  String companyDeclFilterAllCount(int count) {
    return 'Tous $count';
  }

  @override
  String companyDeclFilterUnderReviewCount(int count) {
    return 'En cours de révision $count';
  }

  @override
  String get companyDeclSearchHint => 'Rechercher des déclarations...';

  @override
  String get companyDeclFilterAllCampaigns => 'Toutes les campagnes';

  @override
  String get companyDeclHistoryTitle => 'Historique des déclarations';

  @override
  String get companyDeclDefaultSubtitle => 'Soumission de l\'entreprise';

  @override
  String get companyDeclViewDetailsAction => 'Voir les détails';

  @override
  String get companyDeclContinueDraftAction => 'Continuer le brouillon';

  @override
  String get companyDeclTrackStatusAction => 'Suivre le statut';

  @override
  String get companyDeclStepCreated => 'Créée';

  @override
  String get companyDeclStatusTimelineTitle => 'Chronologie du statut';

  @override
  String get companyRegGenderSumMismatchError => 'Total ≠ H + F';

  @override
  String get companyRegSubmitSuccessMsg => 'Déclaration soumise avec succès';

  @override
  String get companyRegSectionIdentificationTitle =>
      'I. IDENTIFICATION DE L\'ÉTABLISSEMENT';

  @override
  String get companyRegFieldCompanyName => 'Raison Sociale';

  @override
  String get companyRegFieldTaxNumber => 'N° Contribuable (NIU)';

  @override
  String get companyRegFieldParentCompanyLong =>
      'Raison sociale de l\'entreprise dont dépend l\'établissement';

  @override
  String get companyRegFieldSecondaryActivity => 'Activité secondaire';

  @override
  String get companyRegFieldCapital => 'Capital social (XAF)';

  @override
  String get companyRegSectionWorkforceTitle => 'II. EFFECTIFS AU 31 DÉCEMBRE';

  @override
  String get companyRegFieldTotalEmployees => 'Total Employés';

  @override
  String get companyRegFieldLastYearTotal => 'Total employés (année dernière)';

  @override
  String get companyRegSectionMovementsTitle =>
      'III. MOUVEMENTS PAR CATÉGORIES';

  @override
  String get companyRegSubmitButton => 'SOUMETTRE LA DÉCLARATION';

  @override
  String get lawComplianceNoteShort =>
      'Conformément à la loi No 91/023 du 16 déc 1991.';

  @override
  String get companyRegRequiredFieldShort => 'Champ requis';

  @override
  String get movementCategory13 => '1-3';

  @override
  String get movementCategory46 => '4-6';

  @override
  String get movementCategory79 => '7-9';

  @override
  String get movementCategory1012 => '10-12';

  @override
  String get movementRecruitmentLabel => 'Recrutement';

  @override
  String get movementDismissalLabel => 'Licenciement';

  @override
  String get movementRetirementLabel => 'Retraite';

  @override
  String get declApprovalApprovedSuccessMsg =>
      'Déclaration approuvée avec succès';

  @override
  String get declApprovalMissingRejectReasonWarning =>
      'Veuillez entrer une raison de rejet';

  @override
  String get declApprovalRejectedMsg => 'Déclaration rejetée';

  @override
  String declApprovalPdfLoadError(String error) {
    return 'Impossible de charger le PDF : $error';
  }

  @override
  String get declApprovalDraftTitle => 'Brouillon — DSMO';

  @override
  String get declApprovalValidationTitle => 'Validation DSMO';

  @override
  String get pdfCopyOriginalLabel => 'ORIGINAL (Employeur)';

  @override
  String get pdfCopyDuplicateLabel => 'DUPLICATA (Autorité)';

  @override
  String get pdfCopyTriplicateLabel => 'TRIPLICATA (Archives)';

  @override
  String get declApprovalResumeEntryButton => 'Reprendre la saisie';

  @override
  String get declApprovalNotFoundMsg => 'Déclaration introuvable';

  @override
  String get declApprovalSectionEstablishmentInfo =>
      'Informations de l\'établissement';

  @override
  String get declApprovalSectionWorkforce => 'Effectifs Main-d\'œuvre';

  @override
  String get declApprovalSectionMovements => 'Mouvements du personnel';

  @override
  String get declApprovalSectionAdditionalInfo =>
      'Informations supplémentaires';

  @override
  String get declApprovalSectionComplianceSteps => 'Étapes de conformité';

  @override
  String get declApprovalPanelApprovalTitle => 'APPROBATION';

  @override
  String get declApprovalNotesLabel => 'Notes administratives';

  @override
  String get declApprovalApproveButton => 'APPROUVER LA DÉCLARATION';

  @override
  String get declApprovalPanelRejectTitle => 'REJET';

  @override
  String get declApprovalRejectReasonLabel => 'Motif du rejet (Obligatoire)';

  @override
  String get declApprovalRejectButton => 'REJETER POUR CORRECTION';

  @override
  String declApprovalYearLine(String year) {
    return 'Exercice : $year';
  }

  @override
  String declApprovalCurrentStatusLine(String status) {
    return 'Statut Actuel : $status';
  }

  @override
  String declApprovalSubmissionDateLine(String date) {
    return 'Date de soumission : $date';
  }

  @override
  String get declApprovalLabelMainActivityShort => 'Activité princ.';

  @override
  String get declApprovalLabelSecondaryActivityShort => 'Activité second.';

  @override
  String get fieldFaxLabel => 'Fax';

  @override
  String get declApprovalLabelTaxNumberShort => 'N° Contribuable';

  @override
  String get declApprovalLabelSocialCapital => 'Capital social';

  @override
  String get declApprovalLabelParentCompany => 'Entreprise mère';

  @override
  String get declApprovalWorkforceCurrentYearTitle =>
      'Effectifs déclarés — Année en cours';

  @override
  String get declApprovalWorkforcePreviousYearTitle =>
      'Effectifs — Année précédente';

  @override
  String declApprovalNominativeListLine(int count) {
    return 'Liste nominative : $count employé(s) saisi(s)';
  }

  @override
  String get declApprovalNoMovementsMsg => 'Aucun mouvement enregistré.';

  @override
  String get movementPromotionLabel => 'Avancement';

  @override
  String get movementDeathLabel => 'Décès';

  @override
  String get colMovementHeader => 'Mouvement';

  @override
  String get colCat13Header => 'Cat. 1–3';

  @override
  String get colCat46Header => 'Cat. 4–6';

  @override
  String get colCat79Header => 'Cat. 7–9';

  @override
  String get colCat1012Header => 'Cat. 10–12';

  @override
  String get colNonDeclaredShortHeader => 'Non Décl.';

  @override
  String get colTotalHeader => 'TOTAL';

  @override
  String get declApprovalQualitativeUnavailableMsg =>
      'Informations qualitatives non disponibles.';

  @override
  String get yesLabel => 'Oui';

  @override
  String get noLabel => 'Non';

  @override
  String get qHasTrainingCenterShort =>
      'Centre de formation pour le personnel ?';

  @override
  String get qRecruitmentPlansNextShort =>
      'Prévoit des recrutements l\'année prochaine ?';

  @override
  String get qCamerounisationPlanShort =>
      'Dispose d\'un plan de camerounisation ?';

  @override
  String get qUsesTempAgenciesShort =>
      'Recours aux entreprises de travail temporaire ?';

  @override
  String get qTempAgencyDetailsLabelShort => 'Détails ETT';

  @override
  String get declApprovalNoValidationStepsMsg =>
      'Aucune étape de validation enregistrée.';

  @override
  String get declApprovalDefaultStepType => 'Contrôle automatique';

  @override
  String get statusSubmittedShort => 'Soumis';

  @override
  String get statusDivisionApprovedShort => 'Div. Approuvé';

  @override
  String get statusRegionApprovedShort => 'Rég. Approuvé';

  @override
  String get declListApprovedToastMsg => 'Déclaration approuvée';

  @override
  String get declListSearchCompanyHint => 'Rechercher une entreprise...';

  @override
  String get declListNoPendingDeclarationsTitle =>
      'Aucune déclaration en attente';

  @override
  String get tryDifferentSearchCriteria =>
      'Essayez d\'autres critères de recherche';

  @override
  String get declListSubmittedWillAppearHere =>
      'Les déclarations soumises apparaîtront ici';

  @override
  String get clearFiltersButton => 'Effacer les filtres';

  @override
  String get empListDraftLoadedFromSessionMsg =>
      'Brouillon chargé depuis la session';

  @override
  String empListDraftSavedMsg(int count) {
    return 'Brouillon sauvegardé ($count employé(s))';
  }

  @override
  String get empListEnterFullNameError => 'Veuillez entrer le nom complet';

  @override
  String get empListSelectGenderError => 'Veuillez sélectionner le sexe';

  @override
  String get empListInvalidAgeError => 'Âge invalide (16-120 ans)';

  @override
  String get empListSelectNationalityError =>
      'Veuillez sélectionner la nationalité';

  @override
  String get empListEnterCountryError => 'Veuillez entrer le pays';

  @override
  String get empListSelectDiplomaError => 'Veuillez sélectionner le diplôme';

  @override
  String get empListEnterFunctionError => 'Veuillez entrer la fonction';

  @override
  String get empListInvalidSeniorityError => 'Ancienneté invalide (0-60 ans)';

  @override
  String get empListSelectCategoryError => 'Veuillez sélectionner la catégorie';

  @override
  String get empListInvalidSalaryError =>
      'Veuillez entrer un salaire valide (> 0 FCFA)';

  @override
  String get empListDeleteEmployeeTitle => 'Supprimer l\'employé ?';

  @override
  String empListDeleteEmployeeConfirm(String name) {
    return 'Voulez-vous retirer $name de la liste ?';
  }

  @override
  String get empListEditEmployeeTitle => 'MODIFIER L\'EMPLOYÉ';

  @override
  String get empListAddEmployeeTitle => 'AJOUTER UN EMPLOYÉ';

  @override
  String empListStepProgressLabel(int step) {
    return 'Étape $step sur 9';
  }

  @override
  String get confirmButton => 'Confirmer';

  @override
  String get empListFullNameStepLabel => 'Noms et Prénoms';

  @override
  String get empListFullNameHintExample => 'Ex: TCHINDA Marc Arnold';

  @override
  String get empListGenderStepLabel => 'Sexe';

  @override
  String get genderMaleOption => 'Masculin (M)';

  @override
  String get genderFemaleOption => 'Féminin (F)';

  @override
  String get empListAgeStepLabel => 'Âge';

  @override
  String get empListAgeHintExample => 'Ex: 32';

  @override
  String get yearsUnitSuffix => 'ans';

  @override
  String get empListNationalityStepLabel => 'Nationalité';

  @override
  String get nationalityCameroonianOption => 'Camerounais';

  @override
  String get nationalityForeignOption => 'Étranger';

  @override
  String get empListSpecifyCountryLabel => 'Préciser le pays';

  @override
  String get empListCountryHintExample => 'Ex: France, Nigeria, Chine...';

  @override
  String get empListDiplomaStepLabel => 'Diplôme le plus élevé';

  @override
  String get empListSelectDiplomaHint => 'Sélectionnez un diplôme';

  @override
  String get diplomaCepe => 'CEPE';

  @override
  String get diplomaBepc => 'BEPC';

  @override
  String get diplomaCap => 'CAP';

  @override
  String get diplomaBac => 'BAC';

  @override
  String get diplomaBts => 'BTS';

  @override
  String get diplomaLicence => 'Licence';

  @override
  String get diplomaMaster => 'Master';

  @override
  String get diplomaDoctorat => 'Doctorat';

  @override
  String get empListFunctionStepLabel => 'Fonction / Poste occupé';

  @override
  String get empListFunctionHintExample =>
      'Ex: Comptable, Ingénieur, Assistant...';

  @override
  String get empListSeniorityStepLabel => 'Ancienneté dans l\'entreprise';

  @override
  String get empListSeniorityHintExample => 'Ex: 5';

  @override
  String get empListCategoryStepLabel => 'Catégorie socioprofessionnelle';

  @override
  String get empListSelectCategoryHint => 'Sélectionnez la catégorie (1-12)';

  @override
  String get nonDeclaredLabel => 'Non déclaré';

  @override
  String categoryNumberLabel(String number) {
    return 'Catégorie $number';
  }

  @override
  String get empListCategoryScaleHelper =>
      'Selon la grille officielle DSMO (1 = agent d\'exécution, 12 = cadre supérieur)';

  @override
  String get empListSalaryStepLabel => 'Salaire mensuel (FCFA) *';

  @override
  String get empListSalaryHintExample => 'Ex: 250000';

  @override
  String get fcfaCurrencySuffix => 'FCFA';

  @override
  String get mandatoryHelperText => 'Obligatoire';

  @override
  String empListImportSuccessMsg(int count) {
    return '$count employé(s) importé(s) avec succès';
  }

  @override
  String empListImportPartialMsg(int count, int errorCount) {
    return '$count importé(s), $errorCount ligne(s) ignorée(s)';
  }

  @override
  String get excelColCountry => 'Pays';

  @override
  String get excelColDiploma => 'Diplôme';

  @override
  String get excelColSeniorityYears => 'Ancienneté (ans)';

  @override
  String get excelColSalary => 'Salaire (FCFA)';

  @override
  String get empListSaveFileDialogTitle => 'Enregistrer la liste des employés';

  @override
  String get exportSuccessMsg => 'Export réussi !';

  @override
  String get movementsPromotionsPlural => 'Promotions';

  @override
  String empListPartAPreviewPageHeader(int page, int total) {
    return 'Aperçu PARTIE A — Page $page/$total';
  }

  @override
  String get empListSectionEstablishmentIdentity =>
      'Identité de l\'établissement';

  @override
  String get fieldCompanyNameFullLabel => 'Nom / Raison sociale';

  @override
  String get empListTaxNumberNiuLabel => 'N° contribuable (NIU)';

  @override
  String get empListWorkforceCurrentYearSection => 'Effectifs — Année en cours';

  @override
  String get empListDeclaredTotalLabel => 'Total déclaré';

  @override
  String get empListMovementDetailByCategory =>
      'Détail des mouvements par catégorie';

  @override
  String get catRange13Label => 'Cat. 1-3';

  @override
  String get catRange46Label => 'Cat. 4-6';

  @override
  String get catRange79Label => 'Cat. 7-9';

  @override
  String get catRange1012Label => 'Cat. 10-12';

  @override
  String get nonDeclaredCategoryLabel => 'Non Déclaré';

  @override
  String get empListQualitativeInfoSection => 'Informations qualitatives';

  @override
  String get empListTrainingCenterLabelShort => 'Centre de formation';

  @override
  String get empListRecruitmentPlansNextLabel =>
      'Plans de recrutement (année suivante)';

  @override
  String get empListCamerounisationPlanLabel => 'Plan de camerounisation';

  @override
  String get empListUsesTempAgenciesLabel => 'Recours aux agences intérimaires';

  @override
  String get empListTempAgencyDetailsLabel => 'Détails agence intérimaire';

  @override
  String get empListConfirmAndSubmitButton => 'Confirmer et soumettre';

  @override
  String empListMismatchTotalLine(int actual, int declared) {
    return '• Total employés : $actual saisi(s) vs $declared déclaré(s)';
  }

  @override
  String empListMismatchMenLine(int actual, int declared) {
    return '• Hommes : $actual saisi(s) vs $declared déclaré(s)';
  }

  @override
  String empListMismatchWomenLine(int actual, int declared) {
    return '• Femmes : $actual saisie(s) vs $declared déclarée(s)';
  }

  @override
  String get empListWorkforceInconsistencyTitle =>
      '⚠️ Incohérence des effectifs';

  @override
  String get empListWorkforceMismatchIntro =>
      'Le nombre d\'employés saisi ne correspond pas aux effectifs déclarés dans la PARTIE A :\n';

  @override
  String get empListContinueSubmissionAnywayQuestion =>
      'Voulez-vous continuer la soumission quand même ?';

  @override
  String get empListOfficialFormExactMatchNote =>
      'Note : Le formulaire officiel exige une correspondance parfaite.';

  @override
  String get empListContinueDespiteErrorButton => 'Continuer malgré l\'erreur';

  @override
  String get empListAddAtLeastOneEmployeeError =>
      'Ajoutez au moins un employé avant de soumettre';

  @override
  String get empListInvalidEmployeeDataError =>
      'Certains employés ont des données invalides (nom vide ou salaire ≤ 0)';

  @override
  String empListPreviewGenerationError(String error) {
    return 'Impossible de générer l\'aperçu : $error';
  }

  @override
  String empListSubmissionHttpError(String code, String data) {
    return 'Erreur lors de la soumission. Code HTTP : $code\n\n$data';
  }

  @override
  String empListQueuedDeclarationLabel(int year, String company) {
    return 'Déclaration DSMO $year — $company';
  }

  @override
  String empListDefaultDeadlineFallback(int year) {
    return '31 Janvier $year';
  }

  @override
  String get empListQueuedOfflineFullMsg =>
      'Votre déclaration a été enregistrée sur cet appareil et sera envoyée automatiquement dès le retour de la connexion. Vous pouvez fermer cet écran sans risque.';

  @override
  String get okButton => 'OK';

  @override
  String get empListDeclarationSavedTitle => 'Déclaration enregistrée !';

  @override
  String empListTrackingNumberLine(String trackingNumber) {
    return 'N° Suivi : $trackingNumber';
  }

  @override
  String get empListThreePdfCopiesAvailable =>
      '3 exemplaires PDF disponibles :';

  @override
  String get printDownloadTooltip => 'Imprimer / Télécharger';

  @override
  String get empListMandatoryProcedureTitle => 'PROCÉDURE OBLIGATOIRE :';

  @override
  String get empListProcStepPrintCopies => '• Imprimez les 3 exemplaires';

  @override
  String get empListProcStepSignCopies => '• Signez chaque exemplaire';

  @override
  String get empListProcStepAddCompanyStamp =>
      '• Ajoutez le cachet de l\'entreprise';

  @override
  String empListProcStepSendByRegisteredMail(String deadline) {
    return '• Envoyez par PLI RECOMMANDÉ avant le $deadline';
  }

  @override
  String get empListProcStepEmploymentOffice =>
      '• À la circonscription de l\'emploi';

  @override
  String get empListLawComplianceNoteFull =>
      'Conformément à la loi No 91/023 du 16 décembre 1991';

  @override
  String get successTitle => 'Succès';

  @override
  String get empListSimpleSuccessMsg =>
      'Déclaration soumise avec succès !\n\nLes PDF seront disponibles dans votre espace employeur.';

  @override
  String get empListSubmissionFailedTitle => 'Échec de la soumission';

  @override
  String get empListAppBarTitle =>
      'DÉCLARATION SUR LA SITUATION DE LA MAIN D\'ŒUVRE';

  @override
  String get exportExcelTooltip => 'Exporter Excel';

  @override
  String get importExcelTooltip => 'Importer Excel';

  @override
  String get previewPartATooltip => 'Aperçu PARTIE A';

  @override
  String get previewPdfTooltipLong => 'Aperçu du PDF';

  @override
  String get empListRegisteredEmployeesLabel => 'Employés enregistrés';

  @override
  String get empListInconsistencyBadge => 'INCOHÉRENCE';

  @override
  String get empListEmptyStateMsg =>
      'Aucun employé enregistré.\n\nAjoutez manuellement via le bouton +\nou importez un fichier Excel.';

  @override
  String get empListColNumero => 'N°';

  @override
  String get empListColSeniority => 'Ancienneté';

  @override
  String get notDeclaredAbbrev => 'N/D';

  @override
  String ageYearsValue(int age) {
    return '$age ans';
  }

  @override
  String seniorityYearsValue(int years) {
    String _temp0 = intl.Intl.pluralLogic(
      years,
      locale: localeName,
      other: '$years ans',
      one: '$years an',
    );
    return '$_temp0';
  }

  @override
  String get empListAddEmployeeFabLabel => 'Ajouter employé';

  @override
  String get sendNotifStatusDivisionApproved => 'Approuvé (Division)';

  @override
  String get sendNotifStatusRegionApproved => 'Approuvé (Région)';

  @override
  String get sendNotifStatusFinalApproved => 'Approuvé (Final)';

  @override
  String sendNotifSuccessMsg(int count) {
    return 'Notification envoyée à $count entreprises';
  }

  @override
  String sendNotifErrorMsg(String msg) {
    return 'Erreur : $msg';
  }

  @override
  String get sendNotifHeaderTitle => 'Envoyer une notification';

  @override
  String get sendNotifHeaderSubtitle =>
      'Ciblage multi-critères des entreprises';

  @override
  String get sendNotifEstimatedRecipientsLabel => 'Destinataires estimés';

  @override
  String sendNotifRecipientCountLine(int count) {
    return '$count entreprises';
  }

  @override
  String get sendNotifActiveBadge => 'Actives';

  @override
  String get sendNotifRecipientFiltersSection => 'Filtres des destinataires';

  @override
  String get sendNotifDivisionDepartmentLabel => 'Division / Département';

  @override
  String get sendNotifAllDivisionsHint => 'Toutes les divisions';

  @override
  String get sendNotifSubmissionStatusLabel => 'Statut de soumission';

  @override
  String get sendNotifAllStatusesHint => 'Tous les statuts';

  @override
  String get sendNotifMessageContentSection => 'Contenu du message';

  @override
  String get sendNotifSubjectLabel => 'Sujet';

  @override
  String get sendNotifSubjectHintExample => 'Ex: Rappel — Échéance DSM-O 2025';

  @override
  String get sendNotifSubjectRequiredError => 'Le sujet est requis';

  @override
  String get sendNotifMessageFieldLabel => 'Message';

  @override
  String get sendNotifMessageHintExample => 'Rédigez votre message ici...';

  @override
  String get sendNotifMessageRequiredError => 'Le message est requis';

  @override
  String get sendNotifSendButton => 'Envoyer la notification';

  @override
  String get sendNotifClearFormButton => 'Effacer le formulaire';

  @override
  String get homeTabAnalyticsDsmo => 'Analytique DSMO';

  @override
  String get homeTabReports => 'Rapports';

  @override
  String get homeTabCommunication => 'Communication';

  @override
  String get annuaireLabel => 'Annuaire';

  @override
  String get dashboardFallbackTitle => 'Tableau de bord';

  @override
  String get roleLabelDivisional => 'Division du Travail';

  @override
  String get roleLabelRegional => 'Delegation Regionale';

  @override
  String get roleLabelCentral => 'Direction Nationale';

  @override
  String get roleLabelSuperAdmin => 'Super Admin · DSMO + ONEFOP';

  @override
  String get roleLabelSuperAdminDsmo => 'Admin · Regulation MO';

  @override
  String get roleLabelSuperAdminOnefop => 'Admin · ONEFOP';

  @override
  String get filterByZoneTitle => 'Filtrer par zone';

  @override
  String get clearButton => 'Effacer';

  @override
  String get departmentDivisionLabel => 'Département / Division';

  @override
  String get allDepartmentsHint => 'Tous les départements';

  @override
  String get applyFilterButton => 'Appliquer le filtre';

  @override
  String get approvedHistoricalStatusOption => 'Approuvé (historique)';

  @override
  String get logoutDialogTitle => 'Déconnexion';

  @override
  String get logoutConfirmBody => 'Voulez-vous vraiment vous déconnecter ?';

  @override
  String get logoutButton => 'Déconnecter';

  @override
  String get drawerSectionConsultation => 'Consultation';

  @override
  String get drawerViewQuestionnairesSubtitle => 'Consulter les questionnaires';

  @override
  String get drawerSectionAdminDsmo => 'Administration DSMO';

  @override
  String get drawerDeclarationsDsmoLabel => 'Déclarations DSMO';

  @override
  String get drawerViewDeclarationsSubtitle => 'Consulter les déclarations';

  @override
  String get drawerAnnuaireSubtitle => 'Utilisateurs et entreprises';

  @override
  String get drawerResetPasswordSubtitle => 'Après vérification d\'identité';

  @override
  String get drawerSectionAdminOnefop => 'Administration ONEFOP';

  @override
  String get drawerSectionSaisieOnefop => 'Saisie ONEFOP';

  @override
  String get drawerNewQuestionnaireLabel => 'Nouveau questionnaire';

  @override
  String get drawerAssistedEntrySubtitle => 'Saisie assistée';

  @override
  String get navCollapseTooltip => 'Réduire la navigation';

  @override
  String get navExpandTooltip => 'Développer la navigation';

  @override
  String get filterByRegionTooltip => 'Filtrer par région';

  @override
  String get connectionErrorTitle => 'Erreur de connexion';

  @override
  String get navOnefopMinefopTag => 'ONEFOP · MINEFOP';

  @override
  String get onefopAutoGuidedTitle => 'Questionnaire auto-guidé';

  @override
  String get onefopContinueQuestionnaireButton => 'Continuer le questionnaire';

  @override
  String get dearDirectorGreeting => 'Cher Directeur';

  @override
  String get yourProgressHeading => 'Votre progression';

  @override
  String sectionsCompletedCount(int completed, int total) {
    return '$completed/$total sections complétées';
  }

  @override
  String get fieldsRemainingPlaceholder => '17/32 champs requis restants';

  @override
  String get completedSlashLabel => 'Complété';

  @override
  String get minefopOnefopBrandTag => 'MINEFOP / ONEFOP';

  @override
  String submissionIdEntityTypeLine(
      String establishmentId, String entityTypeLabel) {
    return 'ID $establishmentId · $entityTypeLabel';
  }

  @override
  String get mastheadCnpsLabel => 'CNPS';

  @override
  String vtWizardSectionNumberLabel(int index) {
    return 'SECTION $index';
  }

  @override
  String vtWizardFieldsFilledCount(int filled, int total) {
    return '$filled/$total champs';
  }

  @override
  String get reportApprovalApprovedSnackbar => 'Rapport approuvé';

  @override
  String get reportApprovalRejectedSnackbar => 'Rapport rejeté';

  @override
  String get reportRejectionReasonDialogTitle => 'Motif du rejet';

  @override
  String get reportRejectionReasonHint => 'Expliquez pourquoi...';

  @override
  String get reportNoPendingApprovalsTitle => 'Aucune approbation en attente';

  @override
  String get reportAllProcessedSubtitle => 'Tous les rapports ont été traités';

  @override
  String get reportAuditEmptyTitle => 'Aucune activité enregistrée';

  @override
  String get reportAuditEmptySubtitle =>
      'Les actions des utilisateurs apparaîtront ici';

  @override
  String get reportAuditSystemActionFallback => 'Action système';

  @override
  String get reportRegionLittoral => 'Littoral';

  @override
  String get reportRegionCentre => 'Centre';

  @override
  String get reportRegionNord => 'Nord';

  @override
  String get reportRegionExtremeNord => 'Extrême-Nord';

  @override
  String get reportRegionOuest => 'Ouest';

  @override
  String get reportRegionSud => 'Sud';

  @override
  String get reportRegionEst => 'Est';

  @override
  String get reportRegionAdamaoua => 'Adamaoua';

  @override
  String get reportRegionNordOuest => 'Nord-Ouest';

  @override
  String get reportRegionSudOuest => 'Sud-Ouest';

  @override
  String get reportBatchSelectRegionError => 'Sélectionnez au moins une région';

  @override
  String get reportBatchGenerationStartedMsg => 'Génération batch lancée';

  @override
  String get reportBatchJobRetryingMsg => 'Reprise en cours';

  @override
  String get reportBatchByRegionTitle => 'Génération batch par région';

  @override
  String get reportBatchLaunchButton => 'Lancer la génération batch';

  @override
  String get reportBatchRecentJobsTitle => 'Tâches récentes';

  @override
  String get reportBatchEmptyTitle => 'Aucune tâche batch';

  @override
  String reportBatchJobReportsCount(int completed, int total) {
    return '$completed/$total rapports';
  }

  @override
  String get reportSelectTwoReportsError =>
      'Sélectionnez deux rapports à comparer';

  @override
  String get reportMetricFeminizationLabel => 'Féminisation';

  @override
  String get reportSelectReportHint => 'Sélectionner un rapport';

  @override
  String get reportBaselineReportLabel => 'Rapport de référence';

  @override
  String get reportTargetReportLabel => 'Rapport à comparer';

  @override
  String get reportCompareButton => 'Comparer';

  @override
  String get reportComparisonResultsTitle => 'Résultats de la comparaison';

  @override
  String get reportBaselineColumnLabel => 'Référence';

  @override
  String get reportComparedColumnLabel => 'Comparé';

  @override
  String get reportSelectOneSectionError => 'Sélectionnez au moins une section';

  @override
  String get reportEndDateAfterStartError =>
      'La date de fin doit être postérieure à la date de début';

  @override
  String get reportPeriodMax36MonthsError =>
      'La période ne peut pas dépasser 36 mois';

  @override
  String get reportGeneratedSuccessMsg => 'Rapport généré avec succès';

  @override
  String get reportSectionLocationLabel => 'LOCALISATION';

  @override
  String get reportNationalAllOption => 'Nationale (toutes)';

  @override
  String get reportPeriod3MonthsLabel => '3 mois';

  @override
  String get reportPeriod6MonthsLabel => '6 mois';

  @override
  String get reportPeriod12MonthsLabel => '12 mois';

  @override
  String get reportPeriodYtdLabel => 'Année en cours';

  @override
  String get reportPeriodCustomLabel => 'Personnalisé';

  @override
  String get reportSectionPeriodLabel => 'PÉRIODE';

  @override
  String get reportDateFromLabel => 'Du';

  @override
  String get reportDateToLabel => 'Au';

  @override
  String get reportSectionContentLabel => 'CONTENU';

  @override
  String get reportSelectAllButton => 'Tout sélectionner';

  @override
  String get reportDeselectAllButton => 'Tout désélectionner';

  @override
  String get reportSubtitleWorkforceTrends => 'Tendances temporelles';

  @override
  String get reportSubtitleSkillsAnalysis => 'Analyse sectorielle';

  @override
  String get reportSubtitleDiversityInclusion => 'Parité & inclusion';

  @override
  String get reportSubtitleRegionalDetail => 'Détail par région';

  @override
  String get reportSectionNameLabel => 'NOM DU RAPPORT (optionnel)';

  @override
  String get reportNameHintExample => 'Briefing RH Littoral Juin 2026';

  @override
  String get reportGenerateButtonLabel => 'GÉNÉRER LE RAPPORT';

  @override
  String get reportDownloadStartedMsg => 'Téléchargement démarré';

  @override
  String get reportEmptyHistoryTitle => 'Aucun rapport généré';

  @override
  String get reportEmptyHistorySubtitle =>
      'Générez votre premier rapport dans l\'onglet \"Générer\"';

  @override
  String get reportDownloadTooltip => 'Télécharger';

  @override
  String get reportTabGenerate => 'Générer';

  @override
  String get reportTabApprovals => 'Approbations';

  @override
  String get reportTabHistory => 'Historique';

  @override
  String get reportTabBatch => 'Batch';

  @override
  String get reportTabAudit => 'Audit';

  @override
  String get reportScreenTitle => 'Générateur de rapport';

  @override
  String onefopExportExcelDownloadedMsg(String path) {
    return 'Fichier Excel téléchargé : $path';
  }

  @override
  String onefopExportErrorMsg(String error) {
    return 'Erreur lors de l\'export : $error';
  }

  @override
  String onefopExportSpssDownloadedMsg(String path) {
    return 'Fichiers SPSS téléchargés (CSV + syntaxe .sps) : $path. Placez les deux fichiers dans le même dossier puis exécutez le .sps dans SPSS.';
  }

  @override
  String onefopExportSpssErrorMsg(String error) {
    return 'Erreur lors de l\'export SPSS : $error';
  }

  @override
  String get onefopExportPanelTitle => 'Exporter les soumissions ONEFOP';

  @override
  String get onefopExportPanelDescription =>
      'Compile toutes les soumissions approuvées (Entreprises, Coopératives, CTD, ONG) : données d\'identification et sections 1 à 4 du questionnaire.';

  @override
  String get onefopExportGeneratingLabel => 'Génération…';

  @override
  String get onefopExportExcelButton => 'Exporter en Excel';

  @override
  String get onefopExportSpssButton => 'Exporter en SPSS';

  @override
  String get onefopExportPdfComingSoonMsg => 'Export PDF bientôt disponible';

  @override
  String reportExportFiltersActiveCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Filtres ($count actifs)',
      one: 'Filtres ($count actif)',
    );
    return '$_temp0';
  }

  @override
  String get reportExportFiltersOptionalLabel => 'Filtres (optionnel)';

  @override
  String get onefopExportFilterDescription =>
      'Restreint l\'export à une région, un département, une année d\'enquête et/ou une période précises.';

  @override
  String get onefopExportChooseRegionFirstHint => 'Choisir une région d\'abord';

  @override
  String get onefopExportSurveyYearLabel => 'Année d\'enquête';

  @override
  String onefopExportYearHintExample(int year) {
    return 'Ex. $year';
  }

  @override
  String get onefopExportAllPeriodOption => 'Toute la période';

  @override
  String get onefopExportSubmissionPeriodLabel => 'Période de soumission';

  @override
  String get soumissionsTypeDsmoOption => 'DSMO';

  @override
  String get draftSavedSnackbar => 'Brouillon enregistré';

  @override
  String get discardDraftDialogTitle => 'Supprimer le brouillon ?';

  @override
  String get draftRelativeTimeJustNow => 'à l\'instant';

  @override
  String draftRelativeTimeMinutesAgo(int minutes) {
    return 'il y a $minutes min';
  }

  @override
  String draftRelativeTimeHoursAgo(int hours) {
    return 'il y a $hours h';
  }

  @override
  String draftRelativeTimeDaysAgo(int days) {
    return 'il y a $days j';
  }

  @override
  String get draftSaveNowButton => 'Sauvegarder maintenant';

  @override
  String get draftLoadFailedMessage => 'Impossible de charger les brouillons';

  @override
  String get draftEmptyStateMessage => 'Aucun brouillon enregistré';

  @override
  String offlineBannerOfflineWithPendingMsg(int count) {
    return 'Hors ligne — $count élément(s) en attente';
  }

  @override
  String get offlineBannerOfflineDegradedMsg => 'Hors ligne — Mode dégradé';

  @override
  String offlineBannerOnlinePendingMsg(int count) {
    return '$count élément(s) en attente d\'envoi';
  }

  @override
  String get pdfDownloadFolderNotFoundError =>
      'Dossier de téléchargement introuvable.';

  @override
  String get pdfSavedToDownloadsMsg => 'PDF enregistré dans Téléchargements';

  @override
  String get pdfSavedToDocumentsMsg => 'PDF enregistré dans Documents';

  @override
  String pdfDownloadFailedError(String error) {
    return 'Téléchargement échoué : $error';
  }

  @override
  String get formPreviewTitle => 'Formulaire officiel ONEFOP · CAM-LEAP';

  @override
  String get pdfReviewBeforeSubmitWarning =>
      'Vérifiez les informations ci-dessous avant de soumettre définitivement.';

  @override
  String get loadingPdfEllipsis => 'Chargement du PDF…';

  @override
  String get pdfLoadFailedError => 'Impossible de charger le PDF.';

  @override
  String get submittingEllipsis => 'Soumission…';

  @override
  String get customPeriodLabel => 'Période personnalisée';

  @override
  String get periodAnalysisLabel => 'Période d\'analyse';

  @override
  String get yearLabel => 'Année';

  @override
  String get quarterLabel => 'Trimestre';

  @override
  String get semesterLabel => 'Semestre';

  @override
  String get quarterT1Label => 'T1 (Jan-Mar)';

  @override
  String get quarterT2Label => 'T2 (Avr-Jun)';

  @override
  String get quarterT3Label => 'T3 (Jul-Sep)';

  @override
  String get quarterT4Label => 'T4 (Oct-Dec)';

  @override
  String get semesterS1Label => 'S1 (Jan-Jun)';

  @override
  String get semesterS2Label => 'S2 (Jul-Dec)';

  @override
  String get selectPeriodPrompt => 'Sélectionner une période';

  @override
  String get newShortLabel => 'Nouveau';

  @override
  String get serviceCategoryDeconcentratedLabel => 'Services Déconcentrés';

  @override
  String get serviceCategoryCentralLabel => 'Administration Centrale';

  @override
  String get serviceCategoryAffiliatedLabel => 'Organismes Rattachés';

  @override
  String get selectServiceTypeAbovePrompt =>
      'Sélectionnez un type de service ci-dessus.';

  @override
  String get noServiceFoundMessage => 'Aucun service trouvé.';

  @override
  String get serviceTypeFieldLabel => 'Type de service *';

  @override
  String get selectServiceTypeHint => 'Sélectionner un type de service';

  @override
  String get serviceSelectedLabel => 'Service sélectionné';

  @override
  String get servicesLoadFailedTitle => 'Impossible de charger les services';

  @override
  String get serviceCategoryDeconcentratedShort => 'Déconcentré';

  @override
  String get serviceCategoryCentralShort => 'Centrale';

  @override
  String get serviceCategoryAffiliatedShort => 'Rattaché';

  @override
  String get registrationStatusTitle => 'Dossier d\'inscription';

  @override
  String get registrationPendingHeadline =>
      'Votre inscription a été enregistrée';

  @override
  String get registrationPendingBody =>
      'Un agent doit valider votre dossier avant que vous puissiez déclarer. Vous recevrez un e-mail dès que votre compte sera activé.';

  @override
  String get registrationPendingFollowButton => 'Suivre mon dossier';

  @override
  String get registrationAwaitingReviewMessage =>
      'Votre compte est en attente de validation par un agent. Vous pourrez déclarer dès qu\'il sera activé.';

  @override
  String get registrationComplementsHeadline => 'Compléments demandés';

  @override
  String get registrationComplementsIntro =>
      'Un agent demande des compléments pour votre dossier :';

  @override
  String get registrationComplementsFallback =>
      'Merci de compléter votre dossier.';

  @override
  String get registrationResubmitButton => 'Renvoyer le dossier';

  @override
  String get registrationResubmitDoneMessage =>
      'Dossier renvoyé pour validation.';

  @override
  String get registrationRejectedHeadline => 'Inscription rejetée';

  @override
  String get registrationRejectedNoReason => 'Aucun motif n\'a été précisé.';

  @override
  String get registrationStatusRefreshButton => 'Actualiser';

  @override
  String get registrationStatusLogoutButton => 'Se déconnecter';
}
