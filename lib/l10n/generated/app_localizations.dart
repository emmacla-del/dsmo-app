import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_fr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('fr')
  ];

  /// No description provided for @requiredField.
  ///
  /// In fr, this message translates to:
  /// **'Champ obligatoire'**
  String get requiredField;

  /// No description provided for @telExactly9Digits.
  ///
  /// In fr, this message translates to:
  /// **'Le numéro doit contenir exactement 9 chiffres'**
  String get telExactly9Digits;

  /// No description provided for @telMustStartWith2Or6.
  ///
  /// In fr, this message translates to:
  /// **'Le numéro doit commencer par 2 (fixe) ou 6 (mobile)'**
  String get telMustStartWith2Or6;

  /// No description provided for @emailInvalid.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez entrer une adresse e-mail valide (ex: contact@entreprise.com)'**
  String get emailInvalid;

  /// No description provided for @yearInvalid.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez entrer une année valide (ex: 1998)'**
  String get yearInvalid;

  /// No description provided for @yearMin.
  ///
  /// In fr, this message translates to:
  /// **'L\'année doit être ≥ 1900'**
  String get yearMin;

  /// No description provided for @yearMax.
  ///
  /// In fr, this message translates to:
  /// **'L\'année doit être ≤ {max}'**
  String yearMax(int max);

  /// No description provided for @requiredFieldConditional.
  ///
  /// In fr, this message translates to:
  /// **'Champ obligatoire (conditionnel)'**
  String get requiredFieldConditional;

  /// No description provided for @tableResponseRequired.
  ///
  /// In fr, this message translates to:
  /// **'Indiquez si les chiffres sont déclarés, si aucun cas n\'est à signaler, ou si la question ne s\'applique pas'**
  String get tableResponseRequired;

  /// No description provided for @tableFiguresRequired.
  ///
  /// In fr, this message translates to:
  /// **'Saisissez des chiffres, ou choisissez « aucun cas à signaler »'**
  String get tableFiguresRequired;

  /// No description provided for @selectAnOption.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner une option'**
  String get selectAnOption;

  /// No description provided for @optional.
  ///
  /// In fr, this message translates to:
  /// **'Optionnel'**
  String get optional;

  /// No description provided for @sectionComplete.
  ///
  /// In fr, this message translates to:
  /// **'Complet'**
  String get sectionComplete;

  /// No description provided for @sectionInProgress.
  ///
  /// In fr, this message translates to:
  /// **'En cours'**
  String get sectionInProgress;

  /// No description provided for @selectPlaceholder.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionner'**
  String get selectPlaceholder;

  /// No description provided for @fillRequiredFields.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez remplir tous les champs obligatoires avant de soumettre'**
  String get fillRequiredFields;

  /// No description provided for @genericSubmitError.
  ///
  /// In fr, this message translates to:
  /// **'Une erreur est survenue. Veuillez réessayer.'**
  String get genericSubmitError;

  /// No description provided for @telHelper.
  ///
  /// In fr, this message translates to:
  /// **'9 chiffres, sans le 0 initial'**
  String get telHelper;

  /// No description provided for @yearHelper.
  ///
  /// In fr, this message translates to:
  /// **'4 chiffres'**
  String get yearHelper;

  /// No description provided for @collapseSidebar.
  ///
  /// In fr, this message translates to:
  /// **'Réduire la barre'**
  String get collapseSidebar;

  /// No description provided for @hideSidebar.
  ///
  /// In fr, this message translates to:
  /// **'Masquer la barre'**
  String get hideSidebar;

  /// No description provided for @showSidebar.
  ///
  /// In fr, this message translates to:
  /// **'Afficher la barre'**
  String get showSidebar;

  /// No description provided for @saving.
  ///
  /// In fr, this message translates to:
  /// **'Sauvegarde…'**
  String get saving;

  /// No description provided for @unsaved.
  ///
  /// In fr, this message translates to:
  /// **'Non sauvegardé'**
  String get unsaved;

  /// No description provided for @saved.
  ///
  /// In fr, this message translates to:
  /// **'Sauvegardé'**
  String get saved;

  /// No description provided for @generatingPdfPreview.
  ///
  /// In fr, this message translates to:
  /// **'Génération de l\'aperçu PDF…'**
  String get generatingPdfPreview;

  /// No description provided for @loadingEllipsis.
  ///
  /// In fr, this message translates to:
  /// **'Chargement…'**
  String get loadingEllipsis;

  /// No description provided for @retry.
  ///
  /// In fr, this message translates to:
  /// **'Réessayer'**
  String get retry;

  /// No description provided for @errorLabel.
  ///
  /// In fr, this message translates to:
  /// **'Erreur'**
  String get errorLabel;

  /// No description provided for @previewUnavailableError.
  ///
  /// In fr, this message translates to:
  /// **'Erreur interne : aperçu non disponible'**
  String get previewUnavailableError;

  /// No description provided for @submittingInProgress.
  ///
  /// In fr, this message translates to:
  /// **'Soumission en cours…'**
  String get submittingInProgress;

  /// No description provided for @next.
  ///
  /// In fr, this message translates to:
  /// **'Suivant'**
  String get next;

  /// No description provided for @previousButton.
  ///
  /// In fr, this message translates to:
  /// **'Précédent'**
  String get previousButton;

  /// No description provided for @previewPdf.
  ///
  /// In fr, this message translates to:
  /// **'Aperçu PDF'**
  String get previewPdf;

  /// No description provided for @inconsistencyDetectedTitle.
  ///
  /// In fr, this message translates to:
  /// **'Incohérence détectée'**
  String get inconsistencyDetectedTitle;

  /// No description provided for @inconsistenciesDetectedTitle.
  ///
  /// In fr, this message translates to:
  /// **'{count} incohérences détectées'**
  String inconsistenciesDetectedTitle(int count);

  /// No description provided for @missingFieldTitle.
  ///
  /// In fr, this message translates to:
  /// **'Champ manquant'**
  String get missingFieldTitle;

  /// No description provided for @missingFieldsTitle.
  ///
  /// In fr, this message translates to:
  /// **'{count} champs manquants'**
  String missingFieldsTitle(int count);

  /// No description provided for @sectionFallback.
  ///
  /// In fr, this message translates to:
  /// **'Section {number}'**
  String sectionFallback(int number);

  /// No description provided for @male.
  ///
  /// In fr, this message translates to:
  /// **'Homme'**
  String get male;

  /// No description provided for @female.
  ///
  /// In fr, this message translates to:
  /// **'Femme'**
  String get female;

  /// No description provided for @total.
  ///
  /// In fr, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @languageSettingTitle.
  ///
  /// In fr, this message translates to:
  /// **'Langue'**
  String get languageSettingTitle;

  /// No description provided for @languageSettingSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Choisissez la langue d\'affichage de l\'application'**
  String get languageSettingSubtitle;

  /// No description provided for @languageFrench.
  ///
  /// In fr, this message translates to:
  /// **'Français'**
  String get languageFrench;

  /// No description provided for @languageEnglish.
  ///
  /// In fr, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @portalWhatsappNotFound.
  ///
  /// In fr, this message translates to:
  /// **'WhatsApp est introuvable sur cet appareil. Composez directement le {phone}.'**
  String portalWhatsappNotFound(String phone);

  /// No description provided for @portalTwoFactorCodeError.
  ///
  /// In fr, this message translates to:
  /// **'Code incorrect ou expiré. Réessayez.'**
  String get portalTwoFactorCodeError;

  /// No description provided for @portalCredentialsError.
  ///
  /// In fr, this message translates to:
  /// **'Identifiants incorrects. Vérifiez et réessayez.'**
  String get portalCredentialsError;

  /// No description provided for @tabSignIn.
  ///
  /// In fr, this message translates to:
  /// **'Ouvrir une session'**
  String get tabSignIn;

  /// No description provided for @tabCreateAccount.
  ///
  /// In fr, this message translates to:
  /// **'Créer un compte'**
  String get tabCreateAccount;

  /// No description provided for @landingSignUpButton.
  ///
  /// In fr, this message translates to:
  /// **'Demander l\'accès'**
  String get landingSignUpButton;

  /// No description provided for @landingNavProgramme.
  ///
  /// In fr, this message translates to:
  /// **'Programme'**
  String get landingNavProgramme;

  /// No description provided for @landingNavAbout.
  ///
  /// In fr, this message translates to:
  /// **'SIMT'**
  String get landingNavAbout;

  /// No description provided for @landingNavObservatory.
  ///
  /// In fr, this message translates to:
  /// **'Observatoire'**
  String get landingNavObservatory;

  /// No description provided for @landingNavComponents.
  ///
  /// In fr, this message translates to:
  /// **'Composantes'**
  String get landingNavComponents;

  /// No description provided for @landingKickerObservatory.
  ///
  /// In fr, this message translates to:
  /// **'L\'Observatoire'**
  String get landingKickerObservatory;

  /// No description provided for @landingObservatoryBadge.
  ///
  /// In fr, this message translates to:
  /// **'Contenu en préparation'**
  String get landingObservatoryBadge;

  /// No description provided for @landingAboutTitle.
  ///
  /// In fr, this message translates to:
  /// **'Pourquoi un système d\'information sur le marché du travail ?'**
  String get landingAboutTitle;

  /// No description provided for @landingAboutPositioningTitle.
  ///
  /// In fr, this message translates to:
  /// **'Positionnement institutionnel'**
  String get landingAboutPositioningTitle;

  /// No description provided for @landingRoadmapTitle.
  ///
  /// In fr, this message translates to:
  /// **'Construire le système progressivement'**
  String get landingRoadmapTitle;

  /// No description provided for @landingValueStripTitle.
  ///
  /// In fr, this message translates to:
  /// **'Ce que CAMLEAP construit'**
  String get landingValueStripTitle;

  /// No description provided for @landingSignInCta.
  ///
  /// In fr, this message translates to:
  /// **'Accéder à la plateforme'**
  String get landingSignInCta;

  /// No description provided for @landingRequestAccountCta.
  ///
  /// In fr, this message translates to:
  /// **'Demander l\'accès'**
  String get landingRequestAccountCta;

  /// No description provided for @landingEnterLmisCta.
  ///
  /// In fr, this message translates to:
  /// **'Accéder au SIMT'**
  String get landingEnterLmisCta;

  /// No description provided for @landingHeroHeadline.
  ///
  /// In fr, this message translates to:
  /// **'Bâtir le système d\'information sur le marché du travail du Cameroun'**
  String get landingHeroHeadline;

  /// No description provided for @landingProgrammeLine.
  ///
  /// In fr, this message translates to:
  /// **'Programme national pour le développement du système d\'information sur le marché du travail du Cameroun'**
  String get landingProgrammeLine;

  /// No description provided for @landingHeroLead.
  ///
  /// In fr, this message translates to:
  /// **'Porté par l\'ONEFOP sous tutelle du Ministère de l\'Emploi et de la Formation Professionnelle (MINEFOP).'**
  String get landingHeroLead;

  /// No description provided for @landingExploreProgramme.
  ///
  /// In fr, this message translates to:
  /// **'Découvrir le programme'**
  String get landingExploreProgramme;

  /// No description provided for @landingCurrentImplementation.
  ///
  /// In fr, this message translates to:
  /// **'Mise en œuvre actuelle'**
  String get landingCurrentImplementation;

  /// No description provided for @landingPlanned.
  ///
  /// In fr, this message translates to:
  /// **'Planifiée'**
  String get landingPlanned;

  /// No description provided for @landingOperational.
  ///
  /// In fr, this message translates to:
  /// **'Opérationnelle'**
  String get landingOperational;

  /// No description provided for @landingComponentPrefix.
  ///
  /// In fr, this message translates to:
  /// **'Composante {roman}'**
  String landingComponentPrefix(String roman);

  /// No description provided for @landingArchitectureTitle.
  ///
  /// In fr, this message translates to:
  /// **'Le système d\'information sur le marché du travail'**
  String get landingArchitectureTitle;

  /// No description provided for @landingComponentsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Composantes du programme CAMLEAP'**
  String get landingComponentsTitle;

  /// No description provided for @landingCurrentSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Mise en œuvre actuelle'**
  String get landingCurrentSectionTitle;

  /// No description provided for @landingDataToIntelTitle.
  ///
  /// In fr, this message translates to:
  /// **'Des données à l\'intelligence du marché du travail'**
  String get landingDataToIntelTitle;

  /// No description provided for @landingEcosystemTitle.
  ///
  /// In fr, this message translates to:
  /// **'Une infrastructure d\'information pour le marché du travail'**
  String get landingEcosystemTitle;

  /// No description provided for @landingRepublic.
  ///
  /// In fr, this message translates to:
  /// **'République du Cameroun'**
  String get landingRepublic;

  /// No description provided for @landingMinefopName.
  ///
  /// In fr, this message translates to:
  /// **'MINEFOP'**
  String get landingMinefopName;

  /// No description provided for @landingMinefopFull.
  ///
  /// In fr, this message translates to:
  /// **'Ministère de l\'Emploi et de la Formation Professionnelle'**
  String get landingMinefopFull;

  /// No description provided for @landingOnefopName.
  ///
  /// In fr, this message translates to:
  /// **'ONEFOP'**
  String get landingOnefopName;

  /// No description provided for @landingOnefopFull.
  ///
  /// In fr, this message translates to:
  /// **'Observatoire National de l\'Emploi et de la Formation Professionnelle'**
  String get landingOnefopFull;

  /// No description provided for @landingKickerProgramme.
  ///
  /// In fr, this message translates to:
  /// **'Le programme'**
  String get landingKickerProgramme;

  /// No description provided for @landingKickerLmis.
  ///
  /// In fr, this message translates to:
  /// **'Le SIMT'**
  String get landingKickerLmis;

  /// No description provided for @landingKickerComponents.
  ///
  /// In fr, this message translates to:
  /// **'Composantes'**
  String get landingKickerComponents;

  /// No description provided for @landingKickerImplementation.
  ///
  /// In fr, this message translates to:
  /// **'Mise en œuvre'**
  String get landingKickerImplementation;

  /// No description provided for @landingKickerPlatform.
  ///
  /// In fr, this message translates to:
  /// **'Plateforme'**
  String get landingKickerPlatform;

  /// No description provided for @landingKickerEcosystem.
  ///
  /// In fr, this message translates to:
  /// **'Écosystème'**
  String get landingKickerEcosystem;

  /// No description provided for @landingArchSources.
  ///
  /// In fr, this message translates to:
  /// **'Sources de données'**
  String get landingArchSources;

  /// No description provided for @landingArchCollection.
  ///
  /// In fr, this message translates to:
  /// **'Collecte'**
  String get landingArchCollection;

  /// No description provided for @landingArchIntegration.
  ///
  /// In fr, this message translates to:
  /// **'Intégration'**
  String get landingArchIntegration;

  /// No description provided for @landingArchAnalysis.
  ///
  /// In fr, this message translates to:
  /// **'Analyse'**
  String get landingArchAnalysis;

  /// No description provided for @landingArchIntelligence.
  ///
  /// In fr, this message translates to:
  /// **'Intelligence'**
  String get landingArchIntelligence;

  /// No description provided for @landingArchDecision.
  ///
  /// In fr, this message translates to:
  /// **'Décision'**
  String get landingArchDecision;

  /// No description provided for @landingFlowPaper.
  ///
  /// In fr, this message translates to:
  /// **'Collecte papier / fragmentée'**
  String get landingFlowPaper;

  /// No description provided for @landingFlowDigital.
  ///
  /// In fr, this message translates to:
  /// **'Questionnaires numériques'**
  String get landingFlowDigital;

  /// No description provided for @landingFlowValidation.
  ///
  /// In fr, this message translates to:
  /// **'Validation et standardisation'**
  String get landingFlowValidation;

  /// No description provided for @landingFlowCentralised.
  ///
  /// In fr, this message translates to:
  /// **'Données centralisées'**
  String get landingFlowCentralised;

  /// No description provided for @landingFlowStructured.
  ///
  /// In fr, this message translates to:
  /// **'Information structurée sur le marché du travail'**
  String get landingFlowStructured;

  /// No description provided for @landingIntelCollect.
  ///
  /// In fr, this message translates to:
  /// **'Collecter'**
  String get landingIntelCollect;

  /// No description provided for @landingIntelValidate.
  ///
  /// In fr, this message translates to:
  /// **'Valider'**
  String get landingIntelValidate;

  /// No description provided for @landingIntelCentralise.
  ///
  /// In fr, this message translates to:
  /// **'Centraliser'**
  String get landingIntelCentralise;

  /// No description provided for @landingIntelIntegrate.
  ///
  /// In fr, this message translates to:
  /// **'Intégrer'**
  String get landingIntelIntegrate;

  /// No description provided for @landingIntelAnalyse.
  ///
  /// In fr, this message translates to:
  /// **'Analyser'**
  String get landingIntelAnalyse;

  /// No description provided for @landingIntelIndicators.
  ///
  /// In fr, this message translates to:
  /// **'Produire des indicateurs'**
  String get landingIntelIndicators;

  /// No description provided for @landingIntelDecisions.
  ///
  /// In fr, this message translates to:
  /// **'Éclairer les décisions'**
  String get landingIntelDecisions;

  /// No description provided for @landingStakeGovTitle.
  ///
  /// In fr, this message translates to:
  /// **'Gouvernement et décideurs'**
  String get landingStakeGovTitle;

  /// No description provided for @landingStakeGovBody.
  ///
  /// In fr, this message translates to:
  /// **'Conçu pour appuyer les politiques d\'emploi, la planification et le suivi par des éléments de preuve.'**
  String get landingStakeGovBody;

  /// No description provided for @landingStakeEmploymentTitle.
  ///
  /// In fr, this message translates to:
  /// **'Services de l\'emploi'**
  String get landingStakeEmploymentTitle;

  /// No description provided for @landingStakeEmploymentBody.
  ///
  /// In fr, this message translates to:
  /// **'Conçu pour appuyer une meilleure compréhension de l\'offre, de la demande et des tendances de l\'emploi.'**
  String get landingStakeEmploymentBody;

  /// No description provided for @landingStakeSkillsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Établissements de formation'**
  String get landingStakeSkillsTitle;

  /// No description provided for @landingStakeSkillsBody.
  ///
  /// In fr, this message translates to:
  /// **'Conçu pour appuyer l\'adéquation entre le développement des compétences et les besoins du marché du travail.'**
  String get landingStakeSkillsBody;

  /// No description provided for @landingStakeEmployersTitle.
  ///
  /// In fr, this message translates to:
  /// **'Employeurs et partenaires sociaux'**
  String get landingStakeEmployersTitle;

  /// No description provided for @landingStakeEmployersBody.
  ///
  /// In fr, this message translates to:
  /// **'Conçu pour appuyer une information fiable sur la dynamique de l\'emploi et de la main-d\'œuvre.'**
  String get landingStakeEmployersBody;

  /// No description provided for @landingStakeResearchTitle.
  ///
  /// In fr, this message translates to:
  /// **'Chercheurs et analystes'**
  String get landingStakeResearchTitle;

  /// No description provided for @landingStakeResearchBody.
  ///
  /// In fr, this message translates to:
  /// **'Conçu pour appuyer une information structurée sur le marché du travail, pour l\'analyse et la recherche.'**
  String get landingStakeResearchBody;

  /// No description provided for @landingEcosystemNote.
  ///
  /// In fr, this message translates to:
  /// **'Ces usages seront appuyés progressivement, au fur et à mesure de la mise en œuvre des composantes du programme.'**
  String get landingEcosystemNote;

  /// No description provided for @landingPillarCollect.
  ///
  /// In fr, this message translates to:
  /// **'Collecter'**
  String get landingPillarCollect;

  /// No description provided for @landingPillarIntegrate.
  ///
  /// In fr, this message translates to:
  /// **'Intégrer'**
  String get landingPillarIntegrate;

  /// No description provided for @landingPillarAnalyse.
  ///
  /// In fr, this message translates to:
  /// **'Analyser'**
  String get landingPillarAnalyse;

  /// No description provided for @landingPillarInform.
  ///
  /// In fr, this message translates to:
  /// **'Informer'**
  String get landingPillarInform;

  /// No description provided for @loginHint.
  ///
  /// In fr, this message translates to:
  /// **'nom@entreprise.cm ou EN26000112'**
  String get loginHint;

  /// No description provided for @phoneHintShort.
  ///
  /// In fr, this message translates to:
  /// **'6XXXXXXXX'**
  String get phoneHintShort;

  /// No description provided for @noAccountPrompt.
  ///
  /// In fr, this message translates to:
  /// **'Pas encore de compte ?'**
  String get noAccountPrompt;

  /// No description provided for @tabForgotId.
  ///
  /// In fr, this message translates to:
  /// **'Identifiant oublié'**
  String get tabForgotId;

  /// No description provided for @twoFactorTitle.
  ///
  /// In fr, this message translates to:
  /// **'Vérification en deux étapes'**
  String get twoFactorTitle;

  /// No description provided for @twoFactorBody.
  ///
  /// In fr, this message translates to:
  /// **'Un code de vérification a été envoyé à votre adresse e-mail. Saisissez-le ci-dessous pour terminer la connexion.'**
  String get twoFactorBody;

  /// No description provided for @codeLabel.
  ///
  /// In fr, this message translates to:
  /// **'Code'**
  String get codeLabel;

  /// No description provided for @codeRequired.
  ///
  /// In fr, this message translates to:
  /// **'Code à 6 chiffres requis'**
  String get codeRequired;

  /// No description provided for @verifyButton.
  ///
  /// In fr, this message translates to:
  /// **'Vérifier'**
  String get verifyButton;

  /// No description provided for @backToLogin.
  ///
  /// In fr, this message translates to:
  /// **'Retour à la connexion'**
  String get backToLogin;

  /// No description provided for @loginLabel.
  ///
  /// In fr, this message translates to:
  /// **'Identifiant'**
  String get loginLabel;

  /// No description provided for @passwordLabel.
  ///
  /// In fr, this message translates to:
  /// **'Mot de passe'**
  String get passwordLabel;

  /// No description provided for @requiredShort.
  ///
  /// In fr, this message translates to:
  /// **'Requis'**
  String get requiredShort;

  /// No description provided for @rememberMe.
  ///
  /// In fr, this message translates to:
  /// **'Rester connecté'**
  String get rememberMe;

  /// No description provided for @forgotPassword.
  ///
  /// In fr, this message translates to:
  /// **'Mot de passe oublié ?'**
  String get forgotPassword;

  /// No description provided for @connectButton.
  ///
  /// In fr, this message translates to:
  /// **'Connexion'**
  String get connectButton;

  /// No description provided for @registerTitle.
  ///
  /// In fr, this message translates to:
  /// **'Création de compte'**
  String get registerTitle;

  /// No description provided for @registerBody.
  ///
  /// In fr, this message translates to:
  /// **'Inscrivez votre entreprise, coopérative, ONG ou centre de formation pour accéder à la plateforme DSMO et soumettre vos déclarations ONEFOP.'**
  String get registerBody;

  /// No description provided for @registerButton.
  ///
  /// In fr, this message translates to:
  /// **'Commencer l\'inscription'**
  String get registerButton;

  /// No description provided for @registerDraftRestored.
  ///
  /// In fr, this message translates to:
  /// **'Brouillon restauré — vous pouvez reprendre votre inscription.'**
  String get registerDraftRestored;

  /// No description provided for @registerSelectAccountType.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez choisir un type de compte'**
  String get registerSelectAccountType;

  /// No description provided for @registerSelectEntityType.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner le type d\'entité'**
  String get registerSelectEntityType;

  /// No description provided for @registerEmailAlreadyUsed.
  ///
  /// In fr, this message translates to:
  /// **'Cet email est déjà utilisé.'**
  String get registerEmailAlreadyUsed;

  /// No description provided for @registerSelectRegion.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner une région'**
  String get registerSelectRegion;

  /// No description provided for @registerSelectDepartment.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner un département'**
  String get registerSelectDepartment;

  /// No description provided for @registerSelectSubdivision.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner un arrondissement'**
  String get registerSelectSubdivision;

  /// No description provided for @registerLoadRegionsError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de charger les régions. Réessayez.'**
  String get registerLoadRegionsError;

  /// No description provided for @registerLoadDepartmentsError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de charger les départements. Réessayez.'**
  String get registerLoadDepartmentsError;

  /// No description provided for @registerLoadSubdivisionsError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de charger les arrondissements. Réessayez.'**
  String get registerLoadSubdivisionsError;

  /// No description provided for @registerLoadSectorsError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de charger les secteurs. Réessayez.'**
  String get registerLoadSectorsError;

  /// No description provided for @registerSuccessTitle.
  ///
  /// In fr, this message translates to:
  /// **'Compte créé avec succès !'**
  String get registerSuccessTitle;

  /// No description provided for @registerAccessButton.
  ///
  /// In fr, this message translates to:
  /// **'Accéder'**
  String get registerAccessButton;

  /// No description provided for @registerReceiptCopiedSnackbar.
  ///
  /// In fr, this message translates to:
  /// **'{label} copié dans le presse-papier'**
  String registerReceiptCopiedSnackbar(String label);

  /// No description provided for @registerReceiptCannotOpenAttestation.
  ///
  /// In fr, this message translates to:
  /// **'Impossible d\'ouvrir l\'attestation.'**
  String get registerReceiptCannotOpenAttestation;

  /// No description provided for @registerReceiptTitle.
  ///
  /// In fr, this message translates to:
  /// **'REÇU D\'ENREGISTREMENT'**
  String get registerReceiptTitle;

  /// No description provided for @registerReceiptCompanyLabel.
  ///
  /// In fr, this message translates to:
  /// **'Entreprise'**
  String get registerReceiptCompanyLabel;

  /// No description provided for @registerReceiptIdCopyLabel.
  ///
  /// In fr, this message translates to:
  /// **'Identifiant'**
  String get registerReceiptIdCopyLabel;

  /// No description provided for @registerReceiptClickToCopy.
  ///
  /// In fr, this message translates to:
  /// **'Cliquer pour copier'**
  String get registerReceiptClickToCopy;

  /// No description provided for @registerReceiptRegistrationDateLabel.
  ///
  /// In fr, this message translates to:
  /// **'Date d\'enregistrement'**
  String get registerReceiptRegistrationDateLabel;

  /// No description provided for @registerReceiptKeepIdNote.
  ///
  /// In fr, this message translates to:
  /// **'Conservez cet identifiant. Il vous sera demandé pour accéder à vos formulaires ONEFOP, et peut aussi être utilisé à la place de votre e-mail pour vous connecter.'**
  String get registerReceiptKeepIdNote;

  /// No description provided for @registerReceiptDownloadAttestation.
  ///
  /// In fr, this message translates to:
  /// **'Télécharger l\'attestation'**
  String get registerReceiptDownloadAttestation;

  /// No description provided for @registerReceiptCloseButton.
  ///
  /// In fr, this message translates to:
  /// **'Fermer'**
  String get registerReceiptCloseButton;

  /// No description provided for @registerDuplicateEmailOrNiu.
  ///
  /// In fr, this message translates to:
  /// **'Cet email ou ce numéro NIU est déjà utilisé.'**
  String get registerDuplicateEmailOrNiu;

  /// No description provided for @registerSubmitErrorWithMessage.
  ///
  /// In fr, this message translates to:
  /// **'Erreur lors de l\'inscription : {error}'**
  String registerSubmitErrorWithMessage(String error);

  /// No description provided for @registerCreateAccountButton.
  ///
  /// In fr, this message translates to:
  /// **'Créer mon compte'**
  String get registerCreateAccountButton;

  /// No description provided for @registerContinueButton.
  ///
  /// In fr, this message translates to:
  /// **'Continuer'**
  String get registerContinueButton;

  /// No description provided for @registerStepTitleRole.
  ///
  /// In fr, this message translates to:
  /// **'Type de compte'**
  String get registerStepTitleRole;

  /// No description provided for @registerStepTitleEntityType.
  ///
  /// In fr, this message translates to:
  /// **'Type d\'entité'**
  String get registerStepTitleEntityType;

  /// No description provided for @registerStepTitleRespondent.
  ///
  /// In fr, this message translates to:
  /// **'Informations du répondant'**
  String get registerStepTitleRespondent;

  /// No description provided for @registerStepTitleEntityInfo.
  ///
  /// In fr, this message translates to:
  /// **'Informations de l\'entité'**
  String get registerStepTitleEntityInfo;

  /// No description provided for @registerStepTitleLocation.
  ///
  /// In fr, this message translates to:
  /// **'Localisation'**
  String get registerStepTitleLocation;

  /// No description provided for @registerStepTitleSecurity.
  ///
  /// In fr, this message translates to:
  /// **'Sécurité'**
  String get registerStepTitleSecurity;

  /// No description provided for @registerStepTitleReview.
  ///
  /// In fr, this message translates to:
  /// **'Récapitulatif'**
  String get registerStepTitleReview;

  /// No description provided for @registerEntitySubtitleEnterprise.
  ///
  /// In fr, this message translates to:
  /// **'Société commerciale, SA, SARL, établissement à but lucratif.'**
  String get registerEntitySubtitleEnterprise;

  /// No description provided for @registerEntitySubtitleCooperative.
  ///
  /// In fr, this message translates to:
  /// **'Société coopérative ou groupement d\'intérêt économique.'**
  String get registerEntitySubtitleCooperative;

  /// No description provided for @registerEntitySubtitleCtd.
  ///
  /// In fr, this message translates to:
  /// **'Collectivité Territoriale Décentralisée (commune, région).'**
  String get registerEntitySubtitleCtd;

  /// No description provided for @registerEntitySubtitleOng.
  ///
  /// In fr, this message translates to:
  /// **'Organisation Non Gouvernementale ou association.'**
  String get registerEntitySubtitleOng;

  /// No description provided for @registerEntitySubtitleAdministration.
  ///
  /// In fr, this message translates to:
  /// **'Administration publique ou service gouvernemental.'**
  String get registerEntitySubtitleAdministration;

  /// No description provided for @registerEntitySubtitleProjectProgram.
  ///
  /// In fr, this message translates to:
  /// **'Projet, programme ou structure sous tutelle d\'un ministère.'**
  String get registerEntitySubtitleProjectProgram;

  /// No description provided for @registerEntitySubtitleVocationalTraining.
  ///
  /// In fr, this message translates to:
  /// **'Centre de formation professionnelle participant à l\'enquête nationale ONEFOP.'**
  String get registerEntitySubtitleVocationalTraining;

  /// No description provided for @registerCreateAccountTitle.
  ///
  /// In fr, this message translates to:
  /// **'Créer un compte'**
  String get registerCreateAccountTitle;

  /// No description provided for @registerSelectProfileSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez votre profil pour commencer.'**
  String get registerSelectProfileSubtitle;

  /// No description provided for @registerRoleCompanyTitle.
  ///
  /// In fr, this message translates to:
  /// **'Entreprise / Organisation'**
  String get registerRoleCompanyTitle;

  /// No description provided for @registerRoleCompanySubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Société, coopérative, CTD, ONG ou centre de formation soumis à la déclaration ONEFOP / DSMO.'**
  String get registerRoleCompanySubtitle;

  /// No description provided for @registerEntityTypeSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez le type d\'entité que vous représentez.'**
  String get registerEntityTypeSubtitle;

  /// No description provided for @registerRespondentSubtitleStandard.
  ///
  /// In fr, this message translates to:
  /// **'Ces informations pré-rempliront la Section 0 (Répondant) du formulaire ONEFOP et la Partie A de vos déclarations DSMO.'**
  String get registerRespondentSubtitleStandard;

  /// No description provided for @registerFirstNameLabel.
  ///
  /// In fr, this message translates to:
  /// **'Prénom *'**
  String get registerFirstNameLabel;

  /// No description provided for @registerLastNameLabel.
  ///
  /// In fr, this message translates to:
  /// **'Nom *'**
  String get registerLastNameLabel;

  /// No description provided for @registerFunctionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Fonction *'**
  String get registerFunctionLabel;

  /// No description provided for @registerSelectFunctionHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionner votre fonction'**
  String get registerSelectFunctionHint;

  /// No description provided for @registerProfessionalEmailLabel.
  ///
  /// In fr, this message translates to:
  /// **'E-mail professionnel *'**
  String get registerProfessionalEmailLabel;

  /// No description provided for @registerPhone1Label.
  ///
  /// In fr, this message translates to:
  /// **'Téléphone 1 *'**
  String get registerPhone1Label;

  /// No description provided for @registerPhone2Label.
  ///
  /// In fr, this message translates to:
  /// **'Téléphone 2'**
  String get registerPhone2Label;

  /// No description provided for @registerRespondentInfoBox.
  ///
  /// In fr, this message translates to:
  /// **'Ces informations seront automatiquement pré-remplies dans la Section 0 de vos futurs formulaires ONEFOP et dans la Partie A de vos déclarations DSMO.'**
  String get registerRespondentInfoBox;

  /// No description provided for @registerSelectEntityTypeFirst.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner un type d\'entité'**
  String get registerSelectEntityTypeFirst;

  /// No description provided for @registerEntityInfoInfoBox.
  ///
  /// In fr, this message translates to:
  /// **'Ces informations seront automatiquement pré-remplies dans la Section 1 de vos futurs formulaires ONEFOP et dans la Partie A de vos déclarations DSMO.'**
  String get registerEntityInfoInfoBox;

  /// No description provided for @registerRegionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Région *'**
  String get registerRegionLabel;

  /// No description provided for @registerDepartmentLabel.
  ///
  /// In fr, this message translates to:
  /// **'Département *'**
  String get registerDepartmentLabel;

  /// No description provided for @registerSelectRegionFirst.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez d\'abord une région'**
  String get registerSelectRegionFirst;

  /// No description provided for @registerLocationSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Ces informations pré-rempliront la localisation dans les formulaires ONEFOP (Section 1) et DSMO (Partie A).'**
  String get registerLocationSubtitle;

  /// No description provided for @registerSelectRegionShort.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionner une région'**
  String get registerSelectRegionShort;

  /// No description provided for @registerSelectDepartmentShort.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionner un département'**
  String get registerSelectDepartmentShort;

  /// No description provided for @registerArrondissementLabel.
  ///
  /// In fr, this message translates to:
  /// **'Arrondissement'**
  String get registerArrondissementLabel;

  /// No description provided for @registerSelectDepartmentFirst.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez d\'abord un département'**
  String get registerSelectDepartmentFirst;

  /// No description provided for @registerNoSubdivisionAvailable.
  ///
  /// In fr, this message translates to:
  /// **'Aucun arrondissement disponible'**
  String get registerNoSubdivisionAvailable;

  /// No description provided for @registerSelectSubdivisionShort.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionner un arrondissement'**
  String get registerSelectSubdivisionShort;

  /// No description provided for @registerMilieuLabel.
  ///
  /// In fr, this message translates to:
  /// **'Milieu'**
  String get registerMilieuLabel;

  /// No description provided for @registerUrbanOrRuralHint.
  ///
  /// In fr, this message translates to:
  /// **'Urbain ou Rural'**
  String get registerUrbanOrRuralHint;

  /// No description provided for @registerSectorLabel.
  ///
  /// In fr, this message translates to:
  /// **'Secteur d\'activité'**
  String get registerSectorLabel;

  /// No description provided for @registerSelectSectorHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionner un secteur'**
  String get registerSelectSectorHint;

  /// No description provided for @registerLocationInfoBox.
  ///
  /// In fr, this message translates to:
  /// **'Ces informations seront automatiquement pré-remplies dans la Section 1 de vos formulaires ONEFOP et dans la Partie A de vos déclarations DSMO.'**
  String get registerLocationInfoBox;

  /// No description provided for @registerSecureAccountTitle.
  ///
  /// In fr, this message translates to:
  /// **'Sécurisez votre compte'**
  String get registerSecureAccountTitle;

  /// No description provided for @registerChooseStrongPassword.
  ///
  /// In fr, this message translates to:
  /// **'Choisissez un mot de passe robuste.'**
  String get registerChooseStrongPassword;

  /// No description provided for @registerPasswordLabel.
  ///
  /// In fr, this message translates to:
  /// **'Mot de passe *'**
  String get registerPasswordLabel;

  /// No description provided for @registerPasswordRequired.
  ///
  /// In fr, this message translates to:
  /// **'Mot de passe requis'**
  String get registerPasswordRequired;

  /// No description provided for @registerPasswordMinChars.
  ///
  /// In fr, this message translates to:
  /// **'Minimum 8 caractères'**
  String get registerPasswordMinChars;

  /// No description provided for @registerPasswordTooWeak.
  ///
  /// In fr, this message translates to:
  /// **'Trop faible — ajoutez des chiffres ou symboles'**
  String get registerPasswordTooWeak;

  /// No description provided for @registerStrengthWeak.
  ///
  /// In fr, this message translates to:
  /// **'Faible'**
  String get registerStrengthWeak;

  /// No description provided for @registerStrengthMedium.
  ///
  /// In fr, this message translates to:
  /// **'Moyen'**
  String get registerStrengthMedium;

  /// No description provided for @registerStrengthStrong.
  ///
  /// In fr, this message translates to:
  /// **'Fort'**
  String get registerStrengthStrong;

  /// No description provided for @registerStrengthVeryStrong.
  ///
  /// In fr, this message translates to:
  /// **'Très fort'**
  String get registerStrengthVeryStrong;

  /// No description provided for @registerConfirmPasswordLabel.
  ///
  /// In fr, this message translates to:
  /// **'Confirmer le mot de passe *'**
  String get registerConfirmPasswordLabel;

  /// No description provided for @registerConfirmationRequired.
  ///
  /// In fr, this message translates to:
  /// **'Confirmation requise'**
  String get registerConfirmationRequired;

  /// No description provided for @registerPasswordsDontMatch.
  ///
  /// In fr, this message translates to:
  /// **'Les mots de passe ne correspondent pas'**
  String get registerPasswordsDontMatch;

  /// No description provided for @registerTip8Chars.
  ///
  /// In fr, this message translates to:
  /// **'8 caractères minimum'**
  String get registerTip8Chars;

  /// No description provided for @registerTipUppercase.
  ///
  /// In fr, this message translates to:
  /// **'Une lettre majuscule'**
  String get registerTipUppercase;

  /// No description provided for @registerTipDigit.
  ///
  /// In fr, this message translates to:
  /// **'Un chiffre'**
  String get registerTipDigit;

  /// No description provided for @registerTipSpecialChar.
  ///
  /// In fr, this message translates to:
  /// **'Un caractère spécial'**
  String get registerTipSpecialChar;

  /// No description provided for @registerReviewSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Vérifiez vos informations avant de créer le compte.'**
  String get registerReviewSubtitle;

  /// No description provided for @registerReviewRespondentTitle.
  ///
  /// In fr, this message translates to:
  /// **'Répondant — Section 0 ONEFOP / Partie A DSMO'**
  String get registerReviewRespondentTitle;

  /// No description provided for @registerFullNameLabel.
  ///
  /// In fr, this message translates to:
  /// **'Nom complet'**
  String get registerFullNameLabel;

  /// No description provided for @registerFunctionRowLabel.
  ///
  /// In fr, this message translates to:
  /// **'Fonction'**
  String get registerFunctionRowLabel;

  /// No description provided for @registerEmailRowLabel.
  ///
  /// In fr, this message translates to:
  /// **'Email'**
  String get registerEmailRowLabel;

  /// No description provided for @registerPhone1RowLabel.
  ///
  /// In fr, this message translates to:
  /// **'Téléphone 1'**
  String get registerPhone1RowLabel;

  /// No description provided for @registerPhone2RowLabel.
  ///
  /// In fr, this message translates to:
  /// **'Téléphone 2'**
  String get registerPhone2RowLabel;

  /// No description provided for @registerRegionRowLabel.
  ///
  /// In fr, this message translates to:
  /// **'Région'**
  String get registerRegionRowLabel;

  /// No description provided for @registerDepartmentRowLabel.
  ///
  /// In fr, this message translates to:
  /// **'Département'**
  String get registerDepartmentRowLabel;

  /// No description provided for @registerSectorRowLabel.
  ///
  /// In fr, this message translates to:
  /// **'Secteur'**
  String get registerSectorRowLabel;

  /// No description provided for @registerCompanyPendingInfoBox.
  ///
  /// In fr, this message translates to:
  /// **'Ces informations pré-rempliront automatiquement les Sections 0 et 1 de vos formulaires ONEFOP et la Partie A de vos déclarations DSMO.'**
  String get registerCompanyPendingInfoBox;

  /// No description provided for @forgotIntro.
  ///
  /// In fr, this message translates to:
  /// **'Indiquez le nom de votre organisation, son numéro contribuable (NIU) et le numéro de téléphone enregistré pour retrouver votre identifiant.'**
  String get forgotIntro;

  /// No description provided for @organizationLabel.
  ///
  /// In fr, this message translates to:
  /// **'Organisation'**
  String get organizationLabel;

  /// No description provided for @organizationHint.
  ///
  /// In fr, this message translates to:
  /// **'Nom de l\'organisation'**
  String get organizationHint;

  /// No description provided for @niuLabel.
  ///
  /// In fr, this message translates to:
  /// **'NIU'**
  String get niuLabel;

  /// No description provided for @niuHint.
  ///
  /// In fr, this message translates to:
  /// **'Numéro contribuable'**
  String get niuHint;

  /// No description provided for @phoneLabel.
  ///
  /// In fr, this message translates to:
  /// **'Téléphone'**
  String get phoneLabel;

  /// No description provided for @searchButton.
  ///
  /// In fr, this message translates to:
  /// **'Rechercher'**
  String get searchButton;

  /// No description provided for @supportContactLink.
  ///
  /// In fr, this message translates to:
  /// **'Toujours introuvable ? Contactez le support'**
  String get supportContactLink;

  /// No description provided for @supportWhatsappMessage.
  ///
  /// In fr, this message translates to:
  /// **'Bonjour, je n\'arrive pas à retrouver mon identifiant DSMO.'**
  String get supportWhatsappMessage;

  /// No description provided for @genericErrorShort.
  ///
  /// In fr, this message translates to:
  /// **'Une erreur est survenue.'**
  String get genericErrorShort;

  /// No description provided for @idFoundTitle.
  ///
  /// In fr, this message translates to:
  /// **'Identifiant retrouvé'**
  String get idFoundTitle;

  /// No description provided for @establishmentIdLabel.
  ///
  /// In fr, this message translates to:
  /// **'IDENTIFIANT ÉTABLISSEMENT'**
  String get establishmentIdLabel;

  /// No description provided for @tapToCopy.
  ///
  /// In fr, this message translates to:
  /// **'Touchez pour copier'**
  String get tapToCopy;

  /// No description provided for @idCopiedSnackbar.
  ///
  /// In fr, this message translates to:
  /// **'Identifiant copié dans le presse-papier'**
  String get idCopiedSnackbar;

  /// No description provided for @newSearchButton.
  ///
  /// In fr, this message translates to:
  /// **'Nouvelle recherche'**
  String get newSearchButton;

  /// No description provided for @footerVersionLine.
  ///
  /// In fr, this message translates to:
  /// **'CAMLEAP v2.4.1-stable  ·  © 2026 MINEFOP · République du Cameroun'**
  String get footerVersionLine;

  /// No description provided for @platformName.
  ///
  /// In fr, this message translates to:
  /// **'CAMLEAP'**
  String get platformName;

  /// No description provided for @platformTagline.
  ///
  /// In fr, this message translates to:
  /// **'Intelligence du marché du travail'**
  String get platformTagline;

  /// No description provided for @platformFullName.
  ///
  /// In fr, this message translates to:
  /// **'Plateforme camerounaise d\'analyse de l\'emploi et du travail'**
  String get platformFullName;

  /// No description provided for @camleapNavAbout.
  ///
  /// In fr, this message translates to:
  /// **'À propos'**
  String get camleapNavAbout;

  /// No description provided for @camleapNavOnefop.
  ///
  /// In fr, this message translates to:
  /// **'ONEFOP'**
  String get camleapNavOnefop;

  /// No description provided for @camleapNavRegistre.
  ///
  /// In fr, this message translates to:
  /// **'Registre des formations'**
  String get camleapNavRegistre;

  /// No description provided for @camleapNavEnquetes.
  ///
  /// In fr, this message translates to:
  /// **'Enquêtes employeurs'**
  String get camleapNavEnquetes;

  /// No description provided for @camleapSignIn.
  ///
  /// In fr, this message translates to:
  /// **'Se connecter'**
  String get camleapSignIn;

  /// No description provided for @camleapEspaceDeclarant.
  ///
  /// In fr, this message translates to:
  /// **'Espace déclarant'**
  String get camleapEspaceDeclarant;

  /// No description provided for @camleapHeroHeadline.
  ///
  /// In fr, this message translates to:
  /// **'L\'infrastructure numérique de l\'ONEFOP pour l\'information et l\'observation du marché du travail'**
  String get camleapHeroHeadline;

  /// No description provided for @camleapHeroTagline.
  ///
  /// In fr, this message translates to:
  /// **'Déclarations · Registre des entités · Enquêtes · Analyse (à venir)'**
  String get camleapHeroTagline;

  /// No description provided for @camleapHeroBody.
  ///
  /// In fr, this message translates to:
  /// **'CAMLEAP est la plateforme technique qui accompagne la mission de l\'ONEFOP. Elle structure la collecte des déclarations, organise le registre des entités de formation et prépare les outils d\'observation du marché du travail camerounais.'**
  String get camleapHeroBody;

  /// No description provided for @camleapHeroCtaPrimary.
  ///
  /// In fr, this message translates to:
  /// **'Faire ma déclaration'**
  String get camleapHeroCtaPrimary;

  /// No description provided for @camleapHeroCtaSecondary.
  ///
  /// In fr, this message translates to:
  /// **'Découvrir ONEFOP'**
  String get camleapHeroCtaSecondary;

  /// No description provided for @camleapAudienceTitle.
  ///
  /// In fr, this message translates to:
  /// **'Vous êtes...'**
  String get camleapAudienceTitle;

  /// No description provided for @camleapEconomicEntitiesTitle.
  ///
  /// In fr, this message translates to:
  /// **'Entités économiques'**
  String get camleapEconomicEntitiesTitle;

  /// No description provided for @camleapEntreprise.
  ///
  /// In fr, this message translates to:
  /// **'Entreprise'**
  String get camleapEntreprise;

  /// No description provided for @camleapCooperative.
  ///
  /// In fr, this message translates to:
  /// **'Coopérative'**
  String get camleapCooperative;

  /// No description provided for @camleapPublicEntitiesTitle.
  ///
  /// In fr, this message translates to:
  /// **'Entités publiques'**
  String get camleapPublicEntitiesTitle;

  /// No description provided for @camleapCtd.
  ///
  /// In fr, this message translates to:
  /// **'CTD'**
  String get camleapCtd;

  /// No description provided for @camleapOng.
  ///
  /// In fr, this message translates to:
  /// **'ONG'**
  String get camleapOng;

  /// No description provided for @camleapVocationalTrainingTitle.
  ///
  /// In fr, this message translates to:
  /// **'Formation professionnelle'**
  String get camleapVocationalTrainingTitle;

  /// No description provided for @camleapVocationalTrainingBody.
  ///
  /// In fr, this message translates to:
  /// **'Inscription au registre national des CFP (Centres de Formation).'**
  String get camleapVocationalTrainingBody;

  /// No description provided for @camleapComingSoonBadge.
  ///
  /// In fr, this message translates to:
  /// **'Bientôt disponible'**
  String get camleapComingSoonBadge;

  /// No description provided for @camleapUnderstandTitle.
  ///
  /// In fr, this message translates to:
  /// **'Comprendre ONEFOP'**
  String get camleapUnderstandTitle;

  /// No description provided for @camleapUnderstandBody.
  ///
  /// In fr, this message translates to:
  /// **'L\'ONEFOP est en cours de restructuration pour mieux remplir sa mission d\'observation du marché du travail. Deux composantes structurantes sont en déploiement progressif.'**
  String get camleapUnderstandBody;

  /// No description provided for @camleapLmisCardTitle.
  ///
  /// In fr, this message translates to:
  /// **'LMIS - Système d\'Information sur le Marché du Travail'**
  String get camleapLmisCardTitle;

  /// No description provided for @camleapLmisCardBody.
  ///
  /// In fr, this message translates to:
  /// **'L\'infrastructure de collecte, d\'intégration et de gestion des données emploi et formation à l\'échelle nationale.'**
  String get camleapLmisCardBody;

  /// No description provided for @camleapLmisBadge.
  ///
  /// In fr, this message translates to:
  /// **'En cours de déploiement'**
  String get camleapLmisBadge;

  /// No description provided for @camleapObservatoireCardTitle.
  ///
  /// In fr, this message translates to:
  /// **'Observatoire du Marché du Travail'**
  String get camleapObservatoireCardTitle;

  /// No description provided for @camleapObservatoireCardBody.
  ///
  /// In fr, this message translates to:
  /// **'La composante d\'analyse et de diffusion de l\'intelligence sur le marché du travail camerounais.'**
  String get camleapObservatoireCardBody;

  /// No description provided for @camleapAVenir.
  ///
  /// In fr, this message translates to:
  /// **'À venir'**
  String get camleapAVenir;

  /// No description provided for @camleapLearnMore.
  ///
  /// In fr, this message translates to:
  /// **'En savoir plus'**
  String get camleapLearnMore;

  /// No description provided for @camleapAvailableTodayTitle.
  ///
  /// In fr, this message translates to:
  /// **'Disponible aujourd\'hui'**
  String get camleapAvailableTodayTitle;

  /// No description provided for @camleapAvailable1.
  ///
  /// In fr, this message translates to:
  /// **'Déclarations des entités (entreprises, coopératives, CTD, ONG)'**
  String get camleapAvailable1;

  /// No description provided for @camleapAvailable2.
  ///
  /// In fr, this message translates to:
  /// **'Documentation technique'**
  String get camleapAvailable2;

  /// No description provided for @camleapAvailable3.
  ///
  /// In fr, this message translates to:
  /// **'Espace déclarant pour les entités (accès sur demande)'**
  String get camleapAvailable3;

  /// No description provided for @camleapComing1.
  ///
  /// In fr, this message translates to:
  /// **'Registre national des entités de formation (CFP)'**
  String get camleapComing1;

  /// No description provided for @camleapComing3.
  ///
  /// In fr, this message translates to:
  /// **'Observatoire — tableaux de bord et rapports'**
  String get camleapComing3;

  /// No description provided for @camleapComing4.
  ///
  /// In fr, this message translates to:
  /// **'Portail public de données'**
  String get camleapComing4;

  /// No description provided for @camleapAccessRequestTitle.
  ///
  /// In fr, this message translates to:
  /// **'Demande d\'accès'**
  String get camleapAccessRequestTitle;

  /// No description provided for @camleapAccessRequestBody.
  ///
  /// In fr, this message translates to:
  /// **'Pour demander l\'accès à l\'espace déclarant, préciser votre fonction, entité et administration de rattachement.'**
  String get camleapAccessRequestBody;

  /// No description provided for @camleapYaounde.
  ///
  /// In fr, this message translates to:
  /// **'Yaoundé, Cameroun'**
  String get camleapYaounde;

  /// No description provided for @camleapCopyright.
  ///
  /// In fr, this message translates to:
  /// **'© {year} ONEFOP. Tous droits réservés.'**
  String camleapCopyright(int year);

  /// No description provided for @camleapComingSoonPageBody.
  ///
  /// In fr, this message translates to:
  /// **'Cette page est en cours de préparation. Revenez bientôt ou contactez-nous à contact@onefop.cm pour plus d\'informations.'**
  String get camleapComingSoonPageBody;

  /// No description provided for @camleapTitleDeclarerEntreprise.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration — Entreprise'**
  String get camleapTitleDeclarerEntreprise;

  /// No description provided for @camleapTitleDeclarerCooperative.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration — Coopérative'**
  String get camleapTitleDeclarerCooperative;

  /// No description provided for @camleapTitleDeclarerCtd.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration — CTD'**
  String get camleapTitleDeclarerCtd;

  /// No description provided for @camleapTitleDeclarerOng.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration — ONG'**
  String get camleapTitleDeclarerOng;

  /// No description provided for @forgotPasswordTitle.
  ///
  /// In fr, this message translates to:
  /// **'Mot de passe oublié'**
  String get forgotPasswordTitle;

  /// No description provided for @forgotPasswordResetDoneTitle.
  ///
  /// In fr, this message translates to:
  /// **'Mot de passe réinitialisé'**
  String get forgotPasswordResetDoneTitle;

  /// No description provided for @forgotPasswordStep1Subtitle.
  ///
  /// In fr, this message translates to:
  /// **'Entrez l\'adresse e-mail de votre compte pour commencer.'**
  String get forgotPasswordStep1Subtitle;

  /// No description provided for @forgotPasswordStep2Subtitle.
  ///
  /// In fr, this message translates to:
  /// **'Répondez aux deux questions et choisissez un nouveau mot de passe.'**
  String get forgotPasswordStep2Subtitle;

  /// No description provided for @forgotPasswordDoneSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.'**
  String get forgotPasswordDoneSubtitle;

  /// No description provided for @accountEmailLabel.
  ///
  /// In fr, this message translates to:
  /// **'Email du compte'**
  String get accountEmailLabel;

  /// No description provided for @emailRequiredShort.
  ///
  /// In fr, this message translates to:
  /// **'Email requis'**
  String get emailRequiredShort;

  /// No description provided for @answerRequiredShort.
  ///
  /// In fr, this message translates to:
  /// **'Réponse requise'**
  String get answerRequiredShort;

  /// No description provided for @newPasswordLabel.
  ///
  /// In fr, this message translates to:
  /// **'Nouveau mot de passe'**
  String get newPasswordLabel;

  /// No description provided for @confirmNewPasswordLabel.
  ///
  /// In fr, this message translates to:
  /// **'Confirmer le nouveau mot de passe'**
  String get confirmNewPasswordLabel;

  /// No description provided for @resetPasswordButton.
  ///
  /// In fr, this message translates to:
  /// **'Réinitialiser le mot de passe'**
  String get resetPasswordButton;

  /// No description provided for @goToSignIn.
  ///
  /// In fr, this message translates to:
  /// **'Aller à la connexion'**
  String get goToSignIn;

  /// No description provided for @backLabel.
  ///
  /// In fr, this message translates to:
  /// **'Retour'**
  String get backLabel;

  /// No description provided for @resetPasswordTitle.
  ///
  /// In fr, this message translates to:
  /// **'Réinitialiser le mot de passe'**
  String get resetPasswordTitle;

  /// No description provided for @resetPasswordInvalidLink.
  ///
  /// In fr, this message translates to:
  /// **'Lien de réinitialisation invalide. Veuillez refaire une demande depuis la page de connexion.'**
  String get resetPasswordInvalidLink;

  /// No description provided for @resetPasswordSuccess.
  ///
  /// In fr, this message translates to:
  /// **'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.'**
  String get resetPasswordSuccess;

  /// No description provided for @chooseNewPassword.
  ///
  /// In fr, this message translates to:
  /// **'Choisissez un nouveau mot de passe'**
  String get chooseNewPassword;

  /// No description provided for @resetButton.
  ///
  /// In fr, this message translates to:
  /// **'Réinitialiser'**
  String get resetButton;

  /// No description provided for @changePasswordRequiredTitle.
  ///
  /// In fr, this message translates to:
  /// **'Changement de mot de passe requis'**
  String get changePasswordRequiredTitle;

  /// No description provided for @changePasswordRequiredBody.
  ///
  /// In fr, this message translates to:
  /// **'Votre mot de passe a été défini par un administrateur. Choisissez-en un nouveau pour continuer.'**
  String get changePasswordRequiredBody;

  /// No description provided for @temporaryPasswordLabel.
  ///
  /// In fr, this message translates to:
  /// **'Mot de passe temporaire'**
  String get temporaryPasswordLabel;

  /// No description provided for @temporaryPasswordRequired.
  ///
  /// In fr, this message translates to:
  /// **'Mot de passe temporaire requis'**
  String get temporaryPasswordRequired;

  /// No description provided for @changePasswordButton.
  ///
  /// In fr, this message translates to:
  /// **'Changer le mot de passe'**
  String get changePasswordButton;

  /// No description provided for @verifyingInProgress.
  ///
  /// In fr, this message translates to:
  /// **'Vérification en cours…'**
  String get verifyingInProgress;

  /// No description provided for @emailVerifiedTitle.
  ///
  /// In fr, this message translates to:
  /// **'Adresse e-mail vérifiée'**
  String get emailVerifiedTitle;

  /// No description provided for @verificationFailedTitle.
  ///
  /// In fr, this message translates to:
  /// **'Vérification impossible'**
  String get verificationFailedTitle;

  /// No description provided for @invalidVerificationLink.
  ///
  /// In fr, this message translates to:
  /// **'Lien de vérification invalide. Veuillez refaire une demande depuis votre compte.'**
  String get invalidVerificationLink;

  /// No description provided for @activeCampaignsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Campagnes en cours'**
  String get activeCampaignsTitle;

  /// No description provided for @updatedToday.
  ///
  /// In fr, this message translates to:
  /// **'Mis à jour aujourd\'hui'**
  String get updatedToday;

  /// No description provided for @updatedYesterday.
  ///
  /// In fr, this message translates to:
  /// **'Mis à jour hier'**
  String get updatedYesterday;

  /// No description provided for @updatedDaysAgo.
  ///
  /// In fr, this message translates to:
  /// **'Mis à jour il y a {days} jours'**
  String updatedDaysAgo(int days);

  /// No description provided for @noDeclarationsYet.
  ///
  /// In fr, this message translates to:
  /// **'Aucune déclaration'**
  String get noDeclarationsYet;

  /// No description provided for @workersCurrentlyDeclared.
  ///
  /// In fr, this message translates to:
  /// **'Travailleurs actuellement déclarés'**
  String get workersCurrentlyDeclared;

  /// No description provided for @newDeclarationCta.
  ///
  /// In fr, this message translates to:
  /// **'Nouvelle déclaration'**
  String get newDeclarationCta;

  /// No description provided for @activeDeclarationsCount.
  ///
  /// In fr, this message translates to:
  /// **'{count} déclarations actives · {lastUpdated}'**
  String activeDeclarationsCount(int count, String lastUpdated);

  /// No description provided for @declarationsFiledTitle.
  ///
  /// In fr, this message translates to:
  /// **'Déclarations déposées'**
  String get declarationsFiledTitle;

  /// No description provided for @approvedCountSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'↑ {count} approuvées'**
  String approvedCountSubtitle(int count);

  /// No description provided for @awaitingApprovalTitle.
  ///
  /// In fr, this message translates to:
  /// **'En attente d\'approbation'**
  String get awaitingApprovalTitle;

  /// No description provided for @underReview.
  ///
  /// In fr, this message translates to:
  /// **'En cours de révision'**
  String get underReview;

  /// No description provided for @allUpToDate.
  ///
  /// In fr, this message translates to:
  /// **'Tout est à jour'**
  String get allUpToDate;

  /// No description provided for @onefopApproved.
  ///
  /// In fr, this message translates to:
  /// **'Approuvé'**
  String get onefopApproved;

  /// No description provided for @onefopUnderReview.
  ///
  /// In fr, this message translates to:
  /// **'En révision'**
  String get onefopUnderReview;

  /// No description provided for @onefopRejected.
  ///
  /// In fr, this message translates to:
  /// **'Rejeté'**
  String get onefopRejected;

  /// No description provided for @onefopCorrections.
  ///
  /// In fr, this message translates to:
  /// **'Corrections'**
  String get onefopCorrections;

  /// No description provided for @onefopDraft.
  ///
  /// In fr, this message translates to:
  /// **'Brouillon'**
  String get onefopDraft;

  /// No description provided for @onefopNotSubmitted.
  ///
  /// In fr, this message translates to:
  /// **'Non soumis'**
  String get onefopNotSubmitted;

  /// No description provided for @onefopValidatedSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'↑ Questionnaire validé'**
  String get onefopValidatedSubtitle;

  /// No description provided for @onefopPendingMinefopSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'↑ En attente MINEFOP'**
  String get onefopPendingMinefopSubtitle;

  /// No description provided for @onefopCorrectionsRequiredSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'↓ Corrections requises'**
  String get onefopCorrectionsRequiredSubtitle;

  /// No description provided for @onefopModificationsRequestedSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'↓ Modifications demandées'**
  String get onefopModificationsRequestedSubtitle;

  /// No description provided for @onefopFinalizeSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'→ Finalisez et soumettez'**
  String get onefopFinalizeSubtitle;

  /// No description provided for @onefopRequiredSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'→ Questionnaire requis'**
  String get onefopRequiredSubtitle;

  /// No description provided for @establishmentIdInline.
  ///
  /// In fr, this message translates to:
  /// **'ID Établissement : {id}'**
  String establishmentIdInline(String id);

  /// No description provided for @submissionSuccessTitle.
  ///
  /// In fr, this message translates to:
  /// **'Soumission réussie !'**
  String get submissionSuccessTitle;

  /// No description provided for @submissionSuccessSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Votre formulaire ONEFOP a été soumis avec succès.'**
  String get submissionSuccessSubtitle;

  /// No description provided for @connectionUnavailableTitle.
  ///
  /// In fr, this message translates to:
  /// **'Connexion indisponible'**
  String get connectionUnavailableTitle;

  /// No description provided for @queuedOfflineSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Votre formulaire a été enregistré sur cet appareil et sera envoyé automatiquement dès le retour de la connexion.'**
  String get queuedOfflineSubtitle;

  /// No description provided for @doneButton.
  ///
  /// In fr, this message translates to:
  /// **'Terminer'**
  String get doneButton;

  /// No description provided for @welcomeHeading.
  ///
  /// In fr, this message translates to:
  /// **'Bienvenue'**
  String get welcomeHeading;

  /// No description provided for @welcomeSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Directeur / Promoteur, complétez le questionnaire ci-dessous pour votre établissement.'**
  String get welcomeSubtitle;

  /// No description provided for @welcomeHeadingPersonalized.
  ///
  /// In fr, this message translates to:
  /// **'Bienvenue, {name}'**
  String welcomeHeadingPersonalized(String name);

  /// No description provided for @welcomeSubtitlePersonalized.
  ///
  /// In fr, this message translates to:
  /// **'En tant que {function}, veuillez compléter le questionnaire ci-dessous pour votre établissement.'**
  String welcomeSubtitlePersonalized(String function);

  /// No description provided for @legalNoticeTitle.
  ///
  /// In fr, this message translates to:
  /// **'COLLECTE DES DONNÉES SUR LES EMPLOIS CRÉÉS PAR LE SECTEUR MODERNE DE L\'ÉCONOMIE'**
  String get legalNoticeTitle;

  /// No description provided for @questionnaireBadge.
  ///
  /// In fr, this message translates to:
  /// **'- Questionnaire {label} -'**
  String questionnaireBadge(String label);

  /// No description provided for @entityShortOng.
  ///
  /// In fr, this message translates to:
  /// **'ONG'**
  String get entityShortOng;

  /// No description provided for @entityShortEnterprise.
  ///
  /// In fr, this message translates to:
  /// **'ENTREPRISE'**
  String get entityShortEnterprise;

  /// No description provided for @entityShortCooperative.
  ///
  /// In fr, this message translates to:
  /// **'COOPÉRATIVE'**
  String get entityShortCooperative;

  /// No description provided for @entityShortCtd.
  ///
  /// In fr, this message translates to:
  /// **'CTD'**
  String get entityShortCtd;

  /// No description provided for @entityShortVocationalTraining.
  ///
  /// In fr, this message translates to:
  /// **'CFP'**
  String get entityShortVocationalTraining;

  /// No description provided for @confidentialityNoticeHeading.
  ///
  /// In fr, this message translates to:
  /// **'Avis de confidentialité'**
  String get confidentialityNoticeHeading;

  /// No description provided for @confidentialityNoticeBody.
  ///
  /// In fr, this message translates to:
  /// **'Les informations contenues dans ce document sont confidentielles et ne pourront être utilisées à des fins de poursuites judiciaires, de contrôle fiscal ou de répression économique, conformément à la Loi N° 2020/010 du 20 juillet 2020 relative aux recensements et enquêtes Statistiques.'**
  String get confidentialityNoticeBody;

  /// No description provided for @legalFooterLawReference.
  ///
  /// In fr, this message translates to:
  /// **'Loi N° 2020/010 du 20 juillet 2020'**
  String get legalFooterLawReference;

  /// No description provided for @acknowledgeCheckboxLabel.
  ///
  /// In fr, this message translates to:
  /// **'J\'ai pris connaissance de cet avis'**
  String get acknowledgeCheckboxLabel;

  /// No description provided for @beginButton.
  ///
  /// In fr, this message translates to:
  /// **'Commencer'**
  String get beginButton;

  /// No description provided for @goBackButton.
  ///
  /// In fr, this message translates to:
  /// **'Retour'**
  String get goBackButton;

  /// No description provided for @estimatedTimeCaption.
  ///
  /// In fr, this message translates to:
  /// **'Temps estimé : 20-30 minutes'**
  String get estimatedTimeCaption;

  /// No description provided for @onefopApprovedActivity.
  ///
  /// In fr, this message translates to:
  /// **'ONEFOP {year} approuvé'**
  String onefopApprovedActivity(int year);

  /// No description provided for @validatedByMinefop.
  ///
  /// In fr, this message translates to:
  /// **'Validé par MINEFOP'**
  String get validatedByMinefop;

  /// No description provided for @onefopSubmittedActivity.
  ///
  /// In fr, this message translates to:
  /// **'ONEFOP {year} soumis'**
  String onefopSubmittedActivity(int year);

  /// No description provided for @pendingMinefop.
  ///
  /// In fr, this message translates to:
  /// **'En attente MINEFOP'**
  String get pendingMinefop;

  /// No description provided for @onefopRejectedActivity.
  ///
  /// In fr, this message translates to:
  /// **'ONEFOP {year} rejeté'**
  String onefopRejectedActivity(int year);

  /// No description provided for @correctionsRequired.
  ///
  /// In fr, this message translates to:
  /// **'Corrections requises'**
  String get correctionsRequired;

  /// No description provided for @onefopToCorrectActivity.
  ///
  /// In fr, this message translates to:
  /// **'ONEFOP {year} à corriger'**
  String onefopToCorrectActivity(int year);

  /// No description provided for @modificationsRequested.
  ///
  /// In fr, this message translates to:
  /// **'Modifications demandées'**
  String get modificationsRequested;

  /// No description provided for @dateUnknown.
  ///
  /// In fr, this message translates to:
  /// **'Date inconnue'**
  String get dateUnknown;

  /// No description provided for @dsmoApprovedTitle.
  ///
  /// In fr, this message translates to:
  /// **'DSMO Q{year} approuvée'**
  String dsmoApprovedTitle(int year);

  /// No description provided for @dsmoApprovedSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Validée par MINEFOP'**
  String get dsmoApprovedSubtitle;

  /// No description provided for @dsmoApprovedBadge.
  ///
  /// In fr, this message translates to:
  /// **'Approuvée'**
  String get dsmoApprovedBadge;

  /// No description provided for @dsmoPendingFinalTitle.
  ///
  /// In fr, this message translates to:
  /// **'DSMO Q{year} en attente'**
  String dsmoPendingFinalTitle(int year);

  /// No description provided for @dsmoPendingFinalSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'En attente validation finale'**
  String get dsmoPendingFinalSubtitle;

  /// No description provided for @dsmoPendingFinalBadge.
  ///
  /// In fr, this message translates to:
  /// **'En cours'**
  String get dsmoPendingFinalBadge;

  /// No description provided for @dsmoDivisionReviewTitle.
  ///
  /// In fr, this message translates to:
  /// **'DSMO Q{year} en révision'**
  String dsmoDivisionReviewTitle(int year);

  /// No description provided for @dsmoDivisionReviewSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'En attente régionale'**
  String get dsmoDivisionReviewSubtitle;

  /// No description provided for @dsmoDivisionReviewBadge.
  ///
  /// In fr, this message translates to:
  /// **'Révision'**
  String get dsmoDivisionReviewBadge;

  /// No description provided for @dsmoSubmittedTitle.
  ///
  /// In fr, this message translates to:
  /// **'DSMO Q{year} soumise'**
  String dsmoSubmittedTitle(int year);

  /// No description provided for @dsmoSubmittedSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'En attente de révision'**
  String get dsmoSubmittedSubtitle;

  /// No description provided for @dsmoSubmittedBadge.
  ///
  /// In fr, this message translates to:
  /// **'Soumise'**
  String get dsmoSubmittedBadge;

  /// No description provided for @dsmoDraftTitle.
  ///
  /// In fr, this message translates to:
  /// **'DSMO Q{year} brouillon'**
  String dsmoDraftTitle(int year);

  /// No description provided for @dsmoDraftSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Non finalisée'**
  String get dsmoDraftSubtitle;

  /// No description provided for @dsmoDraftBadge.
  ///
  /// In fr, this message translates to:
  /// **'Brouillon'**
  String get dsmoDraftBadge;

  /// No description provided for @dsmoRejectedTitle.
  ///
  /// In fr, this message translates to:
  /// **'DSMO Q{year} rejetée'**
  String dsmoRejectedTitle(int year);

  /// No description provided for @dsmoRejectedSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Corrections nécessaires'**
  String get dsmoRejectedSubtitle;

  /// No description provided for @dsmoRejectedBadge.
  ///
  /// In fr, this message translates to:
  /// **'Rejetée'**
  String get dsmoRejectedBadge;

  /// No description provided for @noDeclarationsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucune déclaration'**
  String get noDeclarationsTitle;

  /// No description provided for @noDeclarationsSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Commencez par créer une déclaration DSMO'**
  String get noDeclarationsSubtitle;

  /// No description provided for @emptyBadge.
  ///
  /// In fr, this message translates to:
  /// **'Vide'**
  String get emptyBadge;

  /// No description provided for @recentActivityTitle.
  ///
  /// In fr, this message translates to:
  /// **'Activité récente'**
  String get recentActivityTitle;

  /// No description provided for @viewAllLink.
  ///
  /// In fr, this message translates to:
  /// **'Voir tout →'**
  String get viewAllLink;

  /// No description provided for @menLabel.
  ///
  /// In fr, this message translates to:
  /// **'Hommes'**
  String get menLabel;

  /// No description provided for @womenLabel.
  ///
  /// In fr, this message translates to:
  /// **'Femmes'**
  String get womenLabel;

  /// No description provided for @genderDistributionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Répartition par genre'**
  String get genderDistributionTitle;

  /// No description provided for @employeesLabel.
  ///
  /// In fr, this message translates to:
  /// **'employés'**
  String get employeesLabel;

  /// No description provided for @genderDistributionUnavailable.
  ///
  /// In fr, this message translates to:
  /// **'Répartition par genre non renseignée'**
  String get genderDistributionUnavailable;

  /// No description provided for @loadingErrorTitle.
  ///
  /// In fr, this message translates to:
  /// **'Erreur de chargement'**
  String get loadingErrorTitle;

  /// No description provided for @campaignFallbackName.
  ///
  /// In fr, this message translates to:
  /// **'Campagne'**
  String get campaignFallbackName;

  /// No description provided for @periodLabel.
  ///
  /// In fr, this message translates to:
  /// **'Période : {period}'**
  String periodLabel(String period);

  /// No description provided for @periodUntil.
  ///
  /// In fr, this message translates to:
  /// **'jusqu\'au {date}'**
  String periodUntil(String date);

  /// No description provided for @periodSince.
  ///
  /// In fr, this message translates to:
  /// **'depuis {date}'**
  String periodSince(String date);

  /// No description provided for @periodUndefined.
  ///
  /// In fr, this message translates to:
  /// **'non définie'**
  String get periodUndefined;

  /// No description provided for @deadlineUndefined.
  ///
  /// In fr, this message translates to:
  /// **'Échéance non définie'**
  String get deadlineUndefined;

  /// No description provided for @deadlinePassed.
  ///
  /// In fr, this message translates to:
  /// **'Échéance dépassée'**
  String get deadlinePassed;

  /// No description provided for @remainingLabel.
  ///
  /// In fr, this message translates to:
  /// **'restant'**
  String get remainingLabel;

  /// No description provided for @campaignManagementTitle.
  ///
  /// In fr, this message translates to:
  /// **'Gestion des Campagnes'**
  String get campaignManagementTitle;

  /// No description provided for @refreshTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Actualiser'**
  String get refreshTooltip;

  /// No description provided for @newCampaignButton.
  ///
  /// In fr, this message translates to:
  /// **'Nouvelle campagne'**
  String get newCampaignButton;

  /// No description provided for @allFilter.
  ///
  /// In fr, this message translates to:
  /// **'Toutes'**
  String get allFilter;

  /// No description provided for @campaignColumnHeader.
  ///
  /// In fr, this message translates to:
  /// **'Campagne'**
  String get campaignColumnHeader;

  /// No description provided for @nameColumnHeader.
  ///
  /// In fr, this message translates to:
  /// **'Nom'**
  String get nameColumnHeader;

  /// No description provided for @statusColumnHeader.
  ///
  /// In fr, this message translates to:
  /// **'Statut'**
  String get statusColumnHeader;

  /// No description provided for @actionColumnHeader.
  ///
  /// In fr, this message translates to:
  /// **'Action'**
  String get actionColumnHeader;

  /// No description provided for @unnamedCampaign.
  ///
  /// In fr, this message translates to:
  /// **'Sans nom'**
  String get unnamedCampaign;

  /// No description provided for @activateTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Activer'**
  String get activateTooltip;

  /// No description provided for @deactivateTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Désactiver'**
  String get deactivateTooltip;

  /// No description provided for @editTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Modifier'**
  String get editTooltip;

  /// No description provided for @deleteTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Supprimer'**
  String get deleteTooltip;

  /// No description provided for @moreActionsTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Plus d\'actions'**
  String get moreActionsTooltip;

  /// No description provided for @closeAction.
  ///
  /// In fr, this message translates to:
  /// **'Clôturer'**
  String get closeAction;

  /// No description provided for @extendDeadlineAction.
  ///
  /// In fr, this message translates to:
  /// **'Prolonger l\'échéance'**
  String get extendDeadlineAction;

  /// No description provided for @sendReminderAction.
  ///
  /// In fr, this message translates to:
  /// **'Envoyer un rappel'**
  String get sendReminderAction;

  /// No description provided for @campaignActivatedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Campagne activée.'**
  String get campaignActivatedMsg;

  /// No description provided for @campaignDeactivatedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Campagne désactivée.'**
  String get campaignDeactivatedMsg;

  /// No description provided for @campaignClosedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Campagne clôturée.'**
  String get campaignClosedMsg;

  /// No description provided for @deadlineExtendedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Échéance prolongée.'**
  String get deadlineExtendedMsg;

  /// No description provided for @reminderSentMsg.
  ///
  /// In fr, this message translates to:
  /// **'Rappel envoyé.'**
  String get reminderSentMsg;

  /// No description provided for @campaignDeletedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Campagne supprimée.'**
  String get campaignDeletedMsg;

  /// No description provided for @campaignCreatedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Campagne créée avec succès'**
  String get campaignCreatedMsg;

  /// No description provided for @cancelButton.
  ///
  /// In fr, this message translates to:
  /// **'Annuler'**
  String get cancelButton;

  /// No description provided for @sendButton.
  ///
  /// In fr, this message translates to:
  /// **'Envoyer'**
  String get sendButton;

  /// No description provided for @deleteCampaignTitle.
  ///
  /// In fr, this message translates to:
  /// **'Supprimer la campagne ?'**
  String get deleteCampaignTitle;

  /// No description provided for @deleteCampaignBody.
  ///
  /// In fr, this message translates to:
  /// **'Cette action est irréversible et supprimera également toutes les soumissions associées.'**
  String get deleteCampaignBody;

  /// No description provided for @deleteButton.
  ///
  /// In fr, this message translates to:
  /// **'Supprimer'**
  String get deleteButton;

  /// No description provided for @noCampaignsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucune campagne'**
  String get noCampaignsTitle;

  /// No description provided for @noCampaignsSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Cliquez sur + pour créer une campagne'**
  String get noCampaignsSubtitle;

  /// No description provided for @generalInfoSection.
  ///
  /// In fr, this message translates to:
  /// **'Informations générales'**
  String get generalInfoSection;

  /// No description provided for @campaignNameHelper.
  ///
  /// In fr, this message translates to:
  /// **'Le nom officiel détermine aussi quel formulaire s\'ouvre pour les établissements ciblés une fois la campagne active.'**
  String get campaignNameHelper;

  /// No description provided for @campaignNameFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Nom de la campagne *'**
  String get campaignNameFieldLabel;

  /// No description provided for @descriptionOptionalLabel.
  ///
  /// In fr, this message translates to:
  /// **'Description (optionnel)'**
  String get descriptionOptionalLabel;

  /// No description provided for @campaignTypeSection.
  ///
  /// In fr, this message translates to:
  /// **'Type de campagne'**
  String get campaignTypeSection;

  /// No description provided for @periodSection.
  ///
  /// In fr, this message translates to:
  /// **'Période'**
  String get periodSection;

  /// No description provided for @startDateLabel.
  ///
  /// In fr, this message translates to:
  /// **'Date de début *'**
  String get startDateLabel;

  /// No description provided for @deadlineFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Échéance *'**
  String get deadlineFieldLabel;

  /// No description provided for @targetEntityTypesSection.
  ///
  /// In fr, this message translates to:
  /// **'Types d\'entités ciblées'**
  String get targetEntityTypesSection;

  /// No description provided for @targetRegionsSection.
  ///
  /// In fr, this message translates to:
  /// **'Régions & Départements ciblés'**
  String get targetRegionsSection;

  /// No description provided for @regionsHelper.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez des régions. Développez une région pour cibler des départements spécifiques.'**
  String get regionsHelper;

  /// No description provided for @autoRemindersSection.
  ///
  /// In fr, this message translates to:
  /// **'Rappels automatiques'**
  String get autoRemindersSection;

  /// No description provided for @enableRemindersTitle.
  ///
  /// In fr, this message translates to:
  /// **'Activer les rappels'**
  String get enableRemindersTitle;

  /// No description provided for @enableRemindersSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Envoyer des rappels aux établissements avant l\'échéance'**
  String get enableRemindersSubtitle;

  /// No description provided for @remindersAtLabel.
  ///
  /// In fr, this message translates to:
  /// **'Rappels à J-:'**
  String get remindersAtLabel;

  /// No description provided for @daySuffix.
  ///
  /// In fr, this message translates to:
  /// **'j'**
  String get daySuffix;

  /// No description provided for @bothDatesRequiredError.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner les deux dates.'**
  String get bothDatesRequiredError;

  /// No description provided for @deadlineAfterStartError.
  ///
  /// In fr, this message translates to:
  /// **'L\'échéance doit être après la date de début.'**
  String get deadlineAfterStartError;

  /// No description provided for @campaignAlreadyActiveTitle.
  ///
  /// In fr, this message translates to:
  /// **'Campagne déjà active'**
  String get campaignAlreadyActiveTitle;

  /// No description provided for @campaignConflictBody.
  ///
  /// In fr, this message translates to:
  /// **'Une campagne \"{label}\" est déjà active : \"{name}\" (échéance {deadline}).\n\nCréer cette nouvelle campagne clôturera la précédente et ouvrira celle-ci à sa place. Continuer ?'**
  String campaignConflictBody(String label, String name, String deadline);

  /// No description provided for @continueButton.
  ///
  /// In fr, this message translates to:
  /// **'Continuer'**
  String get continueButton;

  /// No description provided for @createCampaignButton.
  ///
  /// In fr, this message translates to:
  /// **'Créer la campagne'**
  String get createCampaignButton;

  /// No description provided for @campaignPausedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Campagne mise en pause.'**
  String get campaignPausedMsg;

  /// No description provided for @typeLabel.
  ///
  /// In fr, this message translates to:
  /// **'Type'**
  String get typeLabel;

  /// No description provided for @collectionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Collecte'**
  String get collectionLabel;

  /// No description provided for @startLabel.
  ///
  /// In fr, this message translates to:
  /// **'Début'**
  String get startLabel;

  /// No description provided for @deadlineInfoLabel.
  ///
  /// In fr, this message translates to:
  /// **'Échéance'**
  String get deadlineInfoLabel;

  /// No description provided for @extendedDeadlineLabel.
  ///
  /// In fr, this message translates to:
  /// **'Échéance prolongée'**
  String get extendedDeadlineLabel;

  /// No description provided for @createdByLabel.
  ///
  /// In fr, this message translates to:
  /// **'Créée par'**
  String get createdByLabel;

  /// No description provided for @codeLabelPrefix.
  ///
  /// In fr, this message translates to:
  /// **'Code: {code}'**
  String codeLabelPrefix(String code);

  /// No description provided for @progressTitle.
  ///
  /// In fr, this message translates to:
  /// **'Progression'**
  String get progressTitle;

  /// No description provided for @completedPercent.
  ///
  /// In fr, this message translates to:
  /// **'{rate}% complété'**
  String completedPercent(String rate);

  /// No description provided for @submittedLabel.
  ///
  /// In fr, this message translates to:
  /// **'Soumises'**
  String get submittedLabel;

  /// No description provided for @inProgressLabel.
  ///
  /// In fr, this message translates to:
  /// **'En cours'**
  String get inProgressLabel;

  /// No description provided for @notStartedLabel.
  ///
  /// In fr, this message translates to:
  /// **'Non commencées'**
  String get notStartedLabel;

  /// No description provided for @targetingTitle.
  ///
  /// In fr, this message translates to:
  /// **'Ciblage'**
  String get targetingTitle;

  /// No description provided for @regionsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Régions'**
  String get regionsLabel;

  /// No description provided for @departmentsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Départements'**
  String get departmentsLabel;

  /// No description provided for @entityTypesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Types d\'entités'**
  String get entityTypesLabel;

  /// No description provided for @allNoRestriction.
  ///
  /// In fr, this message translates to:
  /// **'Toutes (aucune restriction)'**
  String get allNoRestriction;

  /// No description provided for @noneLabel.
  ///
  /// In fr, this message translates to:
  /// **'Aucun'**
  String get noneLabel;

  /// No description provided for @allMasculine.
  ///
  /// In fr, this message translates to:
  /// **'Tous'**
  String get allMasculine;

  /// No description provided for @autoRemindersEnabled.
  ///
  /// In fr, this message translates to:
  /// **'Rappels automatiques activés ({days})'**
  String autoRemindersEnabled(String days);

  /// No description provided for @dayPrefix.
  ///
  /// In fr, this message translates to:
  /// **'J-'**
  String get dayPrefix;

  /// No description provided for @autoRemindersDisabled.
  ///
  /// In fr, this message translates to:
  /// **'Rappels automatiques désactivés'**
  String get autoRemindersDisabled;

  /// No description provided for @reminderHistoryTitle.
  ///
  /// In fr, this message translates to:
  /// **'Historique des rappels'**
  String get reminderHistoryTitle;

  /// No description provided for @noRemindersYet.
  ///
  /// In fr, this message translates to:
  /// **'Aucun rappel envoyé pour le moment.'**
  String get noRemindersYet;

  /// No description provided for @reminderStatsWithFailures.
  ///
  /// In fr, this message translates to:
  /// **'{sent} destinataires · {failed} échecs · {date}'**
  String reminderStatsWithFailures(int sent, int failed, String date);

  /// No description provided for @reminderStatsNoFailures.
  ///
  /// In fr, this message translates to:
  /// **'{sent} destinataires · {date}'**
  String reminderStatsNoFailures(int sent, String date);

  /// No description provided for @submissionsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Soumissions'**
  String get submissionsTitle;

  /// No description provided for @noSubmissions.
  ///
  /// In fr, this message translates to:
  /// **'Aucune soumission.'**
  String get noSubmissions;

  /// No description provided for @unknownCompany.
  ///
  /// In fr, this message translates to:
  /// **'Entreprise inconnue'**
  String get unknownCompany;

  /// No description provided for @dateUndefined.
  ///
  /// In fr, this message translates to:
  /// **'Non définie'**
  String get dateUndefined;

  /// No description provided for @editCampaignTitle.
  ///
  /// In fr, this message translates to:
  /// **'Modifier la campagne'**
  String get editCampaignTitle;

  /// No description provided for @editCampaignHelper.
  ///
  /// In fr, this message translates to:
  /// **'Le nom, le type de campagne, le type de collecte et la date de début ne sont pas modifiables après création.'**
  String get editCampaignHelper;

  /// No description provided for @reminderDaysLabel.
  ///
  /// In fr, this message translates to:
  /// **'Jours de rappel (J-)'**
  String get reminderDaysLabel;

  /// No description provided for @saveButton.
  ///
  /// In fr, this message translates to:
  /// **'Enregistrer'**
  String get saveButton;

  /// No description provided for @deadlineRequiredError.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner une échéance.'**
  String get deadlineRequiredError;

  /// No description provided for @exportButtonLabel.
  ///
  /// In fr, this message translates to:
  /// **'Export'**
  String get exportButtonLabel;

  /// No description provided for @exportDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Exporter le tableau de bord'**
  String get exportDialogTitle;

  /// No description provided for @exportDialogButton.
  ///
  /// In fr, this message translates to:
  /// **'Exporter'**
  String get exportDialogButton;

  /// No description provided for @exportSectionFilters.
  ///
  /// In fr, this message translates to:
  /// **'Filtres'**
  String get exportSectionFilters;

  /// No description provided for @exportSectionSummary.
  ///
  /// In fr, this message translates to:
  /// **'Synthèse'**
  String get exportSectionSummary;

  /// No description provided for @exportSectionBenchmarking.
  ///
  /// In fr, this message translates to:
  /// **'Benchmarking'**
  String get exportSectionBenchmarking;

  /// No description provided for @exportSectionLaborMarket.
  ///
  /// In fr, this message translates to:
  /// **'Marché du travail'**
  String get exportSectionLaborMarket;

  /// No description provided for @exportSectionWorkforceStructure.
  ///
  /// In fr, this message translates to:
  /// **'Structure des recrutements'**
  String get exportSectionWorkforceStructure;

  /// No description provided for @exportSectionRecruitmentInsertion.
  ///
  /// In fr, this message translates to:
  /// **'Recrutement & Insertion'**
  String get exportSectionRecruitmentInsertion;

  /// No description provided for @exportSectionMobilityRetention.
  ///
  /// In fr, this message translates to:
  /// **'Mobilité & Rétention'**
  String get exportSectionMobilityRetention;

  /// No description provided for @exportSectionInclusion.
  ///
  /// In fr, this message translates to:
  /// **'Inclusion'**
  String get exportSectionInclusion;

  /// No description provided for @exportSectionCompetencesFormation.
  ///
  /// In fr, this message translates to:
  /// **'Compétences & Formation'**
  String get exportSectionCompetencesFormation;

  /// No description provided for @exportDescFilters.
  ///
  /// In fr, this message translates to:
  /// **'Inclut les paramètres de période, région et secteur.'**
  String get exportDescFilters;

  /// No description provided for @exportDescSummary.
  ///
  /// In fr, this message translates to:
  /// **'Inclut les principaux indicateurs et graphiques du tableau de bord Synthèse.'**
  String get exportDescSummary;

  /// No description provided for @exportDescBenchmarking.
  ///
  /// In fr, this message translates to:
  /// **'Export du tableau de bord Benchmarking régional / national.'**
  String get exportDescBenchmarking;

  /// No description provided for @exportDescLaborMarket.
  ///
  /// In fr, this message translates to:
  /// **'Export des tensions et des recrutements sur le marché du travail.'**
  String get exportDescLaborMarket;

  /// No description provided for @exportDescWorkforceStructure.
  ///
  /// In fr, this message translates to:
  /// **'Export de la structure des recrutements et des types d\'entités.'**
  String get exportDescWorkforceStructure;

  /// No description provided for @exportDescRecruitmentInsertion.
  ///
  /// In fr, this message translates to:
  /// **'Export des premiers recrutements et du taux de conversion.'**
  String get exportDescRecruitmentInsertion;

  /// No description provided for @exportDescMobilityRetention.
  ///
  /// In fr, this message translates to:
  /// **'Export des départs, des motifs et des taux de rétention.'**
  String get exportDescMobilityRetention;

  /// No description provided for @exportDescInclusion.
  ///
  /// In fr, this message translates to:
  /// **'Export des indicateurs d\'inclusion et de parité.'**
  String get exportDescInclusion;

  /// No description provided for @exportDescCompetencesFormation.
  ///
  /// In fr, this message translates to:
  /// **'Export des compétences recherchées et du pipeline de formation.'**
  String get exportDescCompetencesFormation;

  /// No description provided for @chartFiltersApplied.
  ///
  /// In fr, this message translates to:
  /// **'Filtres appliqués'**
  String get chartFiltersApplied;

  /// No description provided for @chartSummaryKpis.
  ///
  /// In fr, this message translates to:
  /// **'Indicateurs clés'**
  String get chartSummaryKpis;

  /// No description provided for @chartSummaryTrend.
  ///
  /// In fr, this message translates to:
  /// **'Évolution de l\'emploi'**
  String get chartSummaryTrend;

  /// No description provided for @chartSummarySector.
  ///
  /// In fr, this message translates to:
  /// **'Performance sectorielle'**
  String get chartSummarySector;

  /// No description provided for @chartSummaryBalance.
  ///
  /// In fr, this message translates to:
  /// **'Dynamique du travail'**
  String get chartSummaryBalance;

  /// No description provided for @chartSummaryGender.
  ///
  /// In fr, this message translates to:
  /// **'Genre (candidatures)'**
  String get chartSummaryGender;

  /// No description provided for @chartSummaryYoy.
  ///
  /// In fr, this message translates to:
  /// **'Évolution annuelle'**
  String get chartSummaryYoy;

  /// No description provided for @chartBenchmarkingTable.
  ///
  /// In fr, this message translates to:
  /// **'Comparatif régional'**
  String get chartBenchmarkingTable;

  /// No description provided for @chartLaborIndicators.
  ///
  /// In fr, this message translates to:
  /// **'Indicateurs du marché du travail'**
  String get chartLaborIndicators;

  /// No description provided for @chartLaborCsp.
  ///
  /// In fr, this message translates to:
  /// **'Recrutements par CSP'**
  String get chartLaborCsp;

  /// No description provided for @chartStructureEntity.
  ///
  /// In fr, this message translates to:
  /// **'Répartition des types d\'entité'**
  String get chartStructureEntity;

  /// No description provided for @chartStructureSize.
  ///
  /// In fr, this message translates to:
  /// **'Répartition par taille d\'entreprise'**
  String get chartStructureSize;

  /// No description provided for @chartStructureCsp.
  ///
  /// In fr, this message translates to:
  /// **'Pyramide des CSP des recrutements'**
  String get chartStructureCsp;

  /// No description provided for @chartStructureDiploma.
  ///
  /// In fr, this message translates to:
  /// **'Diplômes des recrutements'**
  String get chartStructureDiploma;

  /// No description provided for @chartStructureSector.
  ///
  /// In fr, this message translates to:
  /// **'Postes vacants par secteur'**
  String get chartStructureSector;

  /// No description provided for @chartRecruitmentIndicators.
  ///
  /// In fr, this message translates to:
  /// **'Indicateurs de recrutement'**
  String get chartRecruitmentIndicators;

  /// No description provided for @chartRecruitmentAge.
  ///
  /// In fr, this message translates to:
  /// **'Âge des recrutés'**
  String get chartRecruitmentAge;

  /// No description provided for @chartMobility.
  ///
  /// In fr, this message translates to:
  /// **'Motifs de départ'**
  String get chartMobility;

  /// No description provided for @chartInclusionRegion.
  ///
  /// In fr, this message translates to:
  /// **'Répartition régionale'**
  String get chartInclusionRegion;

  /// No description provided for @chartInclusionVulnerable.
  ///
  /// In fr, this message translates to:
  /// **'Inclusion vulnérable'**
  String get chartInclusionVulnerable;

  /// No description provided for @chartInclusionYouth.
  ///
  /// In fr, this message translates to:
  /// **'Emploi jeunes'**
  String get chartInclusionYouth;

  /// No description provided for @chartCompetencesSkills.
  ///
  /// In fr, this message translates to:
  /// **'Compétences recherchées'**
  String get chartCompetencesSkills;

  /// No description provided for @chartCompetencesTraining.
  ///
  /// In fr, this message translates to:
  /// **'Formations demandées'**
  String get chartCompetencesTraining;

  /// No description provided for @pdfExportTitle.
  ///
  /// In fr, this message translates to:
  /// **'Observatoire de l\'Emploi — Export'**
  String get pdfExportTitle;

  /// No description provided for @pdfExportDate.
  ///
  /// In fr, this message translates to:
  /// **'Date d\'export : {date}'**
  String pdfExportDate(String date);

  /// No description provided for @pdfFieldHeader.
  ///
  /// In fr, this message translates to:
  /// **'Champ'**
  String get pdfFieldHeader;

  /// No description provided for @pdfValueHeader.
  ///
  /// In fr, this message translates to:
  /// **'Valeur'**
  String get pdfValueHeader;

  /// No description provided for @pdfPeriodLabel.
  ///
  /// In fr, this message translates to:
  /// **'Période'**
  String get pdfPeriodLabel;

  /// No description provided for @pdfRegionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Région'**
  String get pdfRegionLabel;

  /// No description provided for @pdfNationalFallback.
  ///
  /// In fr, this message translates to:
  /// **'National'**
  String get pdfNationalFallback;

  /// No description provided for @pdfDepartmentLabel.
  ///
  /// In fr, this message translates to:
  /// **'Département'**
  String get pdfDepartmentLabel;

  /// No description provided for @pdfSubdivisionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Sous-division'**
  String get pdfSubdivisionLabel;

  /// No description provided for @pdfEntityTypeLabel.
  ///
  /// In fr, this message translates to:
  /// **'Type d\'entité'**
  String get pdfEntityTypeLabel;

  /// No description provided for @pdfSectorLabel.
  ///
  /// In fr, this message translates to:
  /// **'Secteur'**
  String get pdfSectorLabel;

  /// No description provided for @pdfDeclarationsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Déclarations'**
  String get pdfDeclarationsLabel;

  /// No description provided for @pdfTotalWorkforceLabel.
  ///
  /// In fr, this message translates to:
  /// **'Effectif total'**
  String get pdfTotalWorkforceLabel;

  /// No description provided for @pdfRecruitmentsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Recrutements'**
  String get pdfRecruitmentsLabel;

  /// No description provided for @pdfDeparturesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Départs'**
  String get pdfDeparturesLabel;

  /// No description provided for @pdfNetChangeLabel.
  ///
  /// In fr, this message translates to:
  /// **'Variation nette'**
  String get pdfNetChangeLabel;

  /// No description provided for @pdfGrowthLabel.
  ///
  /// In fr, this message translates to:
  /// **'Croissance'**
  String get pdfGrowthLabel;

  /// No description provided for @pdfLeadingSectorLabel.
  ///
  /// In fr, this message translates to:
  /// **'Secteur leader'**
  String get pdfLeadingSectorLabel;

  /// No description provided for @pdfNotApplicable.
  ///
  /// In fr, this message translates to:
  /// **'N/A'**
  String get pdfNotApplicable;

  /// No description provided for @pdfIndicatorHeader.
  ///
  /// In fr, this message translates to:
  /// **'Indicateur'**
  String get pdfIndicatorHeader;

  /// No description provided for @pdfWorkforceHeader.
  ///
  /// In fr, this message translates to:
  /// **'Effectif'**
  String get pdfWorkforceHeader;

  /// No description provided for @pdfEmployeesCountHeader.
  ///
  /// In fr, this message translates to:
  /// **'Effectifs'**
  String get pdfEmployeesCountHeader;

  /// No description provided for @pdfDismissalsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Licenciements'**
  String get pdfDismissalsLabel;

  /// No description provided for @pdfResignationsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Démissions'**
  String get pdfResignationsLabel;

  /// No description provided for @pdfRetirementsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Retraites'**
  String get pdfRetirementsLabel;

  /// No description provided for @pdfJobsCreatedLabel.
  ///
  /// In fr, this message translates to:
  /// **'Emplois créés'**
  String get pdfJobsCreatedLabel;

  /// No description provided for @pdfJobsLostLabel.
  ///
  /// In fr, this message translates to:
  /// **'Emplois supprimés'**
  String get pdfJobsLostLabel;

  /// No description provided for @pdfDepartureDetailTitle.
  ///
  /// In fr, this message translates to:
  /// **'Détail des départs'**
  String get pdfDepartureDetailTitle;

  /// No description provided for @pdfReasonHeader.
  ///
  /// In fr, this message translates to:
  /// **'Motif'**
  String get pdfReasonHeader;

  /// No description provided for @pdfTechnicalUnemploymentNote.
  ///
  /// In fr, this message translates to:
  /// **'{count} en chômage technique (hors total).'**
  String pdfTechnicalUnemploymentNote(int count);

  /// No description provided for @pdfNetBalanceLabel.
  ///
  /// In fr, this message translates to:
  /// **'Solde net'**
  String get pdfNetBalanceLabel;

  /// No description provided for @pdfGenderDistributionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Répartition Femmes / Hommes'**
  String get pdfGenderDistributionTitle;

  /// No description provided for @pdfMenCountLine.
  ///
  /// In fr, this message translates to:
  /// **'Hommes : {count} ({pct}%)'**
  String pdfMenCountLine(num count, String pct);

  /// No description provided for @pdfWomenCountLine.
  ///
  /// In fr, this message translates to:
  /// **'Femmes : {count} ({pct}%)'**
  String pdfWomenCountLine(num count, String pct);

  /// No description provided for @pdfBenchmarkingTitle.
  ///
  /// In fr, this message translates to:
  /// **'Benchmarking régional'**
  String get pdfBenchmarkingTitle;

  /// No description provided for @pdfBenchmarkingEmptyHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez une région, un département ou un arrondissement pour comparer au national.'**
  String get pdfBenchmarkingEmptyHint;

  /// No description provided for @pdfNationalComparisonNote.
  ///
  /// In fr, this message translates to:
  /// **'La comparaison nationale n\'est pas incluse dans l\'export actuel.'**
  String get pdfNationalComparisonNote;

  /// No description provided for @pdfLocalValueHeader.
  ///
  /// In fr, this message translates to:
  /// **'Valeur locale'**
  String get pdfLocalValueHeader;

  /// No description provided for @pdfRemarkHeader.
  ///
  /// In fr, this message translates to:
  /// **'Remarque'**
  String get pdfRemarkHeader;

  /// No description provided for @pdfDeclaringCompaniesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Entreprises déclarantes'**
  String get pdfDeclaringCompaniesLabel;

  /// No description provided for @pdfVacanciesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Postes vacants'**
  String get pdfVacanciesLabel;

  /// No description provided for @pdfGapLabel.
  ///
  /// In fr, this message translates to:
  /// **'Écart'**
  String get pdfGapLabel;

  /// No description provided for @pdfAbsorptionRateLabel.
  ///
  /// In fr, this message translates to:
  /// **'Taux d\'absorption'**
  String get pdfAbsorptionRateLabel;

  /// No description provided for @pdfCspHeader.
  ///
  /// In fr, this message translates to:
  /// **'CSP'**
  String get pdfCspHeader;

  /// No description provided for @pdfShareHeader.
  ///
  /// In fr, this message translates to:
  /// **'Part'**
  String get pdfShareHeader;

  /// No description provided for @pdfTypeHeader.
  ///
  /// In fr, this message translates to:
  /// **'Type'**
  String get pdfTypeHeader;

  /// No description provided for @pdfDeclarantsHeader.
  ///
  /// In fr, this message translates to:
  /// **'Déclarants'**
  String get pdfDeclarantsHeader;

  /// No description provided for @pdfEnterprisesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Entreprises'**
  String get pdfEnterprisesLabel;

  /// No description provided for @pdfCooperativesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Coopératives'**
  String get pdfCooperativesLabel;

  /// No description provided for @pdfCtdLabel.
  ///
  /// In fr, this message translates to:
  /// **'CTD'**
  String get pdfCtdLabel;

  /// No description provided for @pdfOngLabel.
  ///
  /// In fr, this message translates to:
  /// **'ONG'**
  String get pdfOngLabel;

  /// No description provided for @pdfSizeHeader.
  ///
  /// In fr, this message translates to:
  /// **'Taille'**
  String get pdfSizeHeader;

  /// No description provided for @pdfCountHeader.
  ///
  /// In fr, this message translates to:
  /// **'Nombre'**
  String get pdfCountHeader;

  /// No description provided for @pdfVerySmallEnterprise.
  ///
  /// In fr, this message translates to:
  /// **'Très petite entreprise'**
  String get pdfVerySmallEnterprise;

  /// No description provided for @pdfSmallEnterprise.
  ///
  /// In fr, this message translates to:
  /// **'Petite entreprise'**
  String get pdfSmallEnterprise;

  /// No description provided for @pdfMediumEnterprise.
  ///
  /// In fr, this message translates to:
  /// **'Moyenne entreprise'**
  String get pdfMediumEnterprise;

  /// No description provided for @pdfLargeEnterprise.
  ///
  /// In fr, this message translates to:
  /// **'Grande entreprise'**
  String get pdfLargeEnterprise;

  /// No description provided for @pdfExecutivesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Cadres'**
  String get pdfExecutivesLabel;

  /// No description provided for @pdfForemenLabel.
  ///
  /// In fr, this message translates to:
  /// **'Agents de maîtrise'**
  String get pdfForemenLabel;

  /// No description provided for @pdfWorkersLabel.
  ///
  /// In fr, this message translates to:
  /// **'Ouvriers'**
  String get pdfWorkersLabel;

  /// No description provided for @pdfLevelHeader.
  ///
  /// In fr, this message translates to:
  /// **'Niveau'**
  String get pdfLevelHeader;

  /// No description provided for @pdfSeekersRegisteredLabel.
  ///
  /// In fr, this message translates to:
  /// **'Demandes enregistrées'**
  String get pdfSeekersRegisteredLabel;

  /// No description provided for @pdfFirstRecruitsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Primo-recrutés'**
  String get pdfFirstRecruitsLabel;

  /// No description provided for @pdfConversionRateLabel.
  ///
  /// In fr, this message translates to:
  /// **'Taux de conversion'**
  String get pdfConversionRateLabel;

  /// No description provided for @pdfPermanentLabel.
  ///
  /// In fr, this message translates to:
  /// **'CDI / permanent'**
  String get pdfPermanentLabel;

  /// No description provided for @pdfTemporaryLabel.
  ///
  /// In fr, this message translates to:
  /// **'Temporaire'**
  String get pdfTemporaryLabel;

  /// No description provided for @pdfAgeRangeHeader.
  ///
  /// In fr, this message translates to:
  /// **'Tranche'**
  String get pdfAgeRangeHeader;

  /// No description provided for @pdfOtherLabel.
  ///
  /// In fr, this message translates to:
  /// **'Autres'**
  String get pdfOtherLabel;

  /// No description provided for @pdfVulnerablePeopleLabel.
  ///
  /// In fr, this message translates to:
  /// **'Personnes vulnérables'**
  String get pdfVulnerablePeopleLabel;

  /// No description provided for @pdfTotalRecruitmentsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Recrutements totaux'**
  String get pdfTotalRecruitmentsLabel;

  /// No description provided for @pdfRecruits1534Label.
  ///
  /// In fr, this message translates to:
  /// **'Recrutements 15-34'**
  String get pdfRecruits1534Label;

  /// No description provided for @pdfTotalRecruitmentsLabel2.
  ///
  /// In fr, this message translates to:
  /// **'Total recrutements'**
  String get pdfTotalRecruitmentsLabel2;

  /// No description provided for @pdfSkillHeader.
  ///
  /// In fr, this message translates to:
  /// **'Compétence'**
  String get pdfSkillHeader;

  /// No description provided for @pdfDemandHeader.
  ///
  /// In fr, this message translates to:
  /// **'Demande'**
  String get pdfDemandHeader;

  /// No description provided for @pdfSupplyHeader.
  ///
  /// In fr, this message translates to:
  /// **'Offre'**
  String get pdfSupplyHeader;

  /// No description provided for @pdfTrainingHeader.
  ///
  /// In fr, this message translates to:
  /// **'Formation'**
  String get pdfTrainingHeader;

  /// No description provided for @pdfNoDataAvailable.
  ///
  /// In fr, this message translates to:
  /// **'Aucune donnée disponible'**
  String get pdfNoDataAvailable;

  /// No description provided for @pdfExportError.
  ///
  /// In fr, this message translates to:
  /// **'Export impossible : {error}'**
  String pdfExportError(String error);

  /// No description provided for @companyDeclDraftsFilter.
  ///
  /// In fr, this message translates to:
  /// **'Brouillons'**
  String get companyDeclDraftsFilter;

  /// No description provided for @companyDeclApprovedFilter.
  ///
  /// In fr, this message translates to:
  /// **'Approuvées'**
  String get companyDeclApprovedFilter;

  /// No description provided for @companyDeclRejectedFilter.
  ///
  /// In fr, this message translates to:
  /// **'Rejetées'**
  String get companyDeclRejectedFilter;

  /// No description provided for @companyDeclFiliereColumn.
  ///
  /// In fr, this message translates to:
  /// **'Filière'**
  String get companyDeclFiliereColumn;

  /// No description provided for @companyDeclDeclarationColumn.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration'**
  String get companyDeclDeclarationColumn;

  /// No description provided for @companyDeclDetailsColumn.
  ///
  /// In fr, this message translates to:
  /// **'Détails'**
  String get companyDeclDetailsColumn;

  /// No description provided for @companyDeclDateColumn.
  ///
  /// In fr, this message translates to:
  /// **'Date'**
  String get companyDeclDateColumn;

  /// No description provided for @companyDeclPdfColumn.
  ///
  /// In fr, this message translates to:
  /// **'PDF'**
  String get companyDeclPdfColumn;

  /// No description provided for @companyDeclNewButton.
  ///
  /// In fr, this message translates to:
  /// **'Nouvelle'**
  String get companyDeclNewButton;

  /// No description provided for @companyDeclDownloadPdfTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Télécharger le PDF'**
  String get companyDeclDownloadPdfTooltip;

  /// No description provided for @companyDeclDownloadPdfError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible d\'ouvrir le PDF'**
  String get companyDeclDownloadPdfError;

  /// No description provided for @companyDeclNoResultsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucun résultat'**
  String get companyDeclNoResultsTitle;

  /// No description provided for @companyDeclEmptyTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucune déclaration pour le moment'**
  String get companyDeclEmptyTitle;

  /// No description provided for @companyDeclTryDifferentFilter.
  ///
  /// In fr, this message translates to:
  /// **'Essayez un autre filtre'**
  String get companyDeclTryDifferentFilter;

  /// No description provided for @companyDeclEmptySubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Vos déclarations DSMO et questionnaires ONEFOP\napparaîtront ici, y compris les brouillons.'**
  String get companyDeclEmptySubtitle;

  /// No description provided for @companyDeclClearFilter.
  ///
  /// In fr, this message translates to:
  /// **'Effacer le filtre'**
  String get companyDeclClearFilter;

  /// No description provided for @companyDeclResumeDraft.
  ///
  /// In fr, this message translates to:
  /// **'Reprendre le brouillon'**
  String get companyDeclResumeDraft;

  /// No description provided for @companyDeclDsmoTitle.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration DSMO {period}'**
  String companyDeclDsmoTitle(String period);

  /// No description provided for @companyDeclOnefopTitle.
  ///
  /// In fr, this message translates to:
  /// **'Questionnaire ONEFOP {period}'**
  String companyDeclOnefopTitle(String period);

  /// No description provided for @companyDeclStatusDivisionApproved.
  ///
  /// In fr, this message translates to:
  /// **'Approuvée (division)'**
  String get companyDeclStatusDivisionApproved;

  /// No description provided for @companyDeclStatusRegionApproved.
  ///
  /// In fr, this message translates to:
  /// **'Approuvée (région)'**
  String get companyDeclStatusRegionApproved;

  /// No description provided for @companyDeclStatusCorrectionRequested.
  ///
  /// In fr, this message translates to:
  /// **'Corrections requises'**
  String get companyDeclStatusCorrectionRequested;

  /// No description provided for @companyAnalyticsTabBilanRh.
  ///
  /// In fr, this message translates to:
  /// **'Bilan RH'**
  String get companyAnalyticsTabBilanRh;

  /// No description provided for @companyAnalyticsTabBenchmarking.
  ///
  /// In fr, this message translates to:
  /// **'Benchmarking'**
  String get companyAnalyticsTabBenchmarking;

  /// No description provided for @companyAnalyticsTabOpportunities.
  ///
  /// In fr, this message translates to:
  /// **'Opportunités'**
  String get companyAnalyticsTabOpportunities;

  /// No description provided for @companyAnalyticsBadgeActive.
  ///
  /// In fr, this message translates to:
  /// **'Actif'**
  String get companyAnalyticsBadgeActive;

  /// No description provided for @companyAnalyticsBadgePending.
  ///
  /// In fr, this message translates to:
  /// **'En attente'**
  String get companyAnalyticsBadgePending;

  /// No description provided for @companyAnalyticsOpportunitiesTitle.
  ///
  /// In fr, this message translates to:
  /// **'Opportunités'**
  String get companyAnalyticsOpportunitiesTitle;

  /// No description provided for @companyAnalyticsOpportunitiesDescription.
  ///
  /// In fr, this message translates to:
  /// **'Signaux tirés de vos propres données déclarées : postes à pourvoir, écarts par rapport à votre secteur, besoins en formation et échéances à venir.'**
  String get companyAnalyticsOpportunitiesDescription;

  /// No description provided for @companyAnalyticsComingSoonBadge.
  ///
  /// In fr, this message translates to:
  /// **'Bientôt disponible'**
  String get companyAnalyticsComingSoonBadge;

  /// No description provided for @opportunitiesVacancyTitle.
  ///
  /// In fr, this message translates to:
  /// **'Postes à pourvoir'**
  String get opportunitiesVacancyTitle;

  /// No description provided for @opportunitiesVacancyDetail.
  ///
  /// In fr, this message translates to:
  /// **'{vacancies, plural, =0{Aucun poste vacant déclaré.} =1{1 poste vacant déclaré,} other{{vacancies} postes vacants déclarés,}} soit {rate}% de votre effectif permanent.'**
  String opportunitiesVacancyDetail(int vacancies, String rate);

  /// No description provided for @opportunitiesBenchmarkGapTitle.
  ///
  /// In fr, this message translates to:
  /// **'Écarts par rapport à votre secteur'**
  String get opportunitiesBenchmarkGapTitle;

  /// No description provided for @opportunitiesBenchmarkGapWorkforce.
  ///
  /// In fr, this message translates to:
  /// **'Votre effectif ({mine}) est inférieur à la médiane de votre secteur ({median}).'**
  String opportunitiesBenchmarkGapWorkforce(int mine, int median);

  /// No description provided for @opportunitiesBenchmarkGapFeminization.
  ///
  /// In fr, this message translates to:
  /// **'Votre taux de féminisation ({mine}%) est inférieur à la médiane de votre secteur ({median}%).'**
  String opportunitiesBenchmarkGapFeminization(String mine, String median);

  /// No description provided for @opportunitiesBenchmarkGapTurnover.
  ///
  /// In fr, this message translates to:
  /// **'Votre taux de rotation ({mine}%) est supérieur à la médiane de votre secteur ({median}%).'**
  String opportunitiesBenchmarkGapTurnover(String mine, String median);

  /// No description provided for @opportunitiesDeadlinesTitle.
  ///
  /// In fr, this message translates to:
  /// **'Échéances à venir'**
  String get opportunitiesDeadlinesTitle;

  /// No description provided for @opportunitiesDeadlineInDays.
  ///
  /// In fr, this message translates to:
  /// **'{date} · dans {days, plural, =0{moins d\'un jour} =1{1 jour} other{{days} jours}}'**
  String opportunitiesDeadlineInDays(String date, int days);

  /// No description provided for @opportunitiesDeadlinePassed.
  ///
  /// In fr, this message translates to:
  /// **'{date} · échéance dépassée'**
  String opportunitiesDeadlinePassed(String date);

  /// No description provided for @companyAnalyticsHeaderYear.
  ///
  /// In fr, this message translates to:
  /// **'Analytique {year}'**
  String companyAnalyticsHeaderYear(int year);

  /// No description provided for @companyAnalyticsSectionBenchmarking.
  ///
  /// In fr, this message translates to:
  /// **'Benchmarking Sectoriel'**
  String get companyAnalyticsSectionBenchmarking;

  /// No description provided for @companyAnalyticsBenchmarkingComingTitle.
  ///
  /// In fr, this message translates to:
  /// **'Benchmarking sectoriel'**
  String get companyAnalyticsBenchmarkingComingTitle;

  /// No description provided for @companyAnalyticsBenchmarkingComingDescription.
  ///
  /// In fr, this message translates to:
  /// **'Comparez vos indicateurs RH avec les entreprises de votre secteur et région. Disponible dès que votre dossier est approuvé et que suffisamment d\'entreprises ont soumis leur déclaration.'**
  String get companyAnalyticsBenchmarkingComingDescription;

  /// No description provided for @companyAnalyticsPeerGroupCount.
  ///
  /// In fr, this message translates to:
  /// **'{count} entreprises dans votre groupe de comparaison'**
  String companyAnalyticsPeerGroupCount(String count);

  /// No description provided for @companyAnalyticsBenchmarkError.
  ///
  /// In fr, this message translates to:
  /// **'Erreur benchmarking : {error}'**
  String companyAnalyticsBenchmarkError(String error);

  /// No description provided for @companyAnalyticsTotalWorkforce.
  ///
  /// In fr, this message translates to:
  /// **'Effectif total'**
  String get companyAnalyticsTotalWorkforce;

  /// No description provided for @companyAnalyticsRecruitmentsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Recrutements'**
  String get companyAnalyticsRecruitmentsLabel;

  /// No description provided for @companyAnalyticsDeparturesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Départs'**
  String get companyAnalyticsDeparturesLabel;

  /// No description provided for @companyAnalyticsUnitEmployees.
  ///
  /// In fr, this message translates to:
  /// **'employés'**
  String get companyAnalyticsUnitEmployees;

  /// No description provided for @companyAnalyticsFeminizationRate.
  ///
  /// In fr, this message translates to:
  /// **'Taux de féminisation'**
  String get companyAnalyticsFeminizationRate;

  /// No description provided for @companyAnalyticsBilanDeclarationSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Données issues de votre déclaration ONEFOP approuvée'**
  String get companyAnalyticsBilanDeclarationSubtitle;

  /// No description provided for @companyAnalyticsBilanAggregatedSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Données cumulées sur {quarterCount} déclarations ONEFOP approuvées cette année'**
  String companyAnalyticsBilanAggregatedSubtitle(int quarterCount);

  /// No description provided for @companyAnalyticsExportPdfButton.
  ///
  /// In fr, this message translates to:
  /// **'Exporter en PDF'**
  String get companyAnalyticsExportPdfButton;

  /// No description provided for @companyAnalyticsBilanPdfExportError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de générer le PDF. Veuillez réessayer.'**
  String get companyAnalyticsBilanPdfExportError;

  /// No description provided for @companyAnalyticsSectionEffectifs.
  ///
  /// In fr, this message translates to:
  /// **'Effectifs'**
  String get companyAnalyticsSectionEffectifs;

  /// No description provided for @companyAnalyticsPermanentEmployees.
  ///
  /// In fr, this message translates to:
  /// **'Employés permanents'**
  String get companyAnalyticsPermanentEmployees;

  /// No description provided for @companyAnalyticsVacantPositions.
  ///
  /// In fr, this message translates to:
  /// **'Postes vacants'**
  String get companyAnalyticsVacantPositions;

  /// No description provided for @companyAnalyticsTurnoverRate.
  ///
  /// In fr, this message translates to:
  /// **'Taux de rotation'**
  String get companyAnalyticsTurnoverRate;

  /// No description provided for @companyAnalyticsHigh.
  ///
  /// In fr, this message translates to:
  /// **'Élevé'**
  String get companyAnalyticsHigh;

  /// No description provided for @companyAnalyticsNormal.
  ///
  /// In fr, this message translates to:
  /// **'Normal'**
  String get companyAnalyticsNormal;

  /// No description provided for @companyAnalyticsSectionRecruitmentsByCategory.
  ///
  /// In fr, this message translates to:
  /// **'Recrutements par catégorie'**
  String get companyAnalyticsSectionRecruitmentsByCategory;

  /// No description provided for @companyAnalyticsSectionInterns.
  ///
  /// In fr, this message translates to:
  /// **'Stagiaires'**
  String get companyAnalyticsSectionInterns;

  /// No description provided for @companyAnalyticsSectionSkillsTraining.
  ///
  /// In fr, this message translates to:
  /// **'Compétences & Formation'**
  String get companyAnalyticsSectionSkillsTraining;

  /// No description provided for @companyAnalyticsCategoryHeader.
  ///
  /// In fr, this message translates to:
  /// **'Catégorie'**
  String get companyAnalyticsCategoryHeader;

  /// No description provided for @companyAnalyticsExecutivesRow.
  ///
  /// In fr, this message translates to:
  /// **'Cadres'**
  String get companyAnalyticsExecutivesRow;

  /// No description provided for @companyAnalyticsForemenRow.
  ///
  /// In fr, this message translates to:
  /// **'Agents de maîtrise'**
  String get companyAnalyticsForemenRow;

  /// No description provided for @companyAnalyticsWorkersFieldRow.
  ///
  /// In fr, this message translates to:
  /// **'Ouvriers / terrain'**
  String get companyAnalyticsWorkersFieldRow;

  /// No description provided for @companyAnalyticsGenderColumnMale.
  ///
  /// In fr, this message translates to:
  /// **'H'**
  String get companyAnalyticsGenderColumnMale;

  /// No description provided for @companyAnalyticsGenderColumnFemale.
  ///
  /// In fr, this message translates to:
  /// **'F'**
  String get companyAnalyticsGenderColumnFemale;

  /// No description provided for @companyAnalyticsPercentOfTotal.
  ///
  /// In fr, this message translates to:
  /// **'{pct}% du total'**
  String companyAnalyticsPercentOfTotal(String pct);

  /// No description provided for @companyAnalyticsDismissals.
  ///
  /// In fr, this message translates to:
  /// **'Licenciements'**
  String get companyAnalyticsDismissals;

  /// No description provided for @companyAnalyticsResignations.
  ///
  /// In fr, this message translates to:
  /// **'Démissions'**
  String get companyAnalyticsResignations;

  /// No description provided for @companyAnalyticsRetirements.
  ///
  /// In fr, this message translates to:
  /// **'Retraites'**
  String get companyAnalyticsRetirements;

  /// No description provided for @companyAnalyticsOthers.
  ///
  /// In fr, this message translates to:
  /// **'Autres'**
  String get companyAnalyticsOthers;

  /// No description provided for @companyAnalyticsNoDeparturesRecorded.
  ///
  /// In fr, this message translates to:
  /// **'Aucun départ enregistré sur la période.'**
  String get companyAnalyticsNoDeparturesRecorded;

  /// No description provided for @companyAnalyticsTotalDepartures.
  ///
  /// In fr, this message translates to:
  /// **'Total départs'**
  String get companyAnalyticsTotalDepartures;

  /// No description provided for @companyAnalyticsInternshipHoliday.
  ///
  /// In fr, this message translates to:
  /// **'Stage de vacances'**
  String get companyAnalyticsInternshipHoliday;

  /// No description provided for @companyAnalyticsInternshipAcademic.
  ///
  /// In fr, this message translates to:
  /// **'Stage académique'**
  String get companyAnalyticsInternshipAcademic;

  /// No description provided for @companyAnalyticsInternshipProfessional.
  ///
  /// In fr, this message translates to:
  /// **'Stage professionnel'**
  String get companyAnalyticsInternshipProfessional;

  /// No description provided for @companyAnalyticsInternshipPreWork.
  ///
  /// In fr, this message translates to:
  /// **'Stage pré-emploi'**
  String get companyAnalyticsInternshipPreWork;

  /// No description provided for @companyAnalyticsTotalInterns.
  ///
  /// In fr, this message translates to:
  /// **'Total stagiaires'**
  String get companyAnalyticsTotalInterns;

  /// No description provided for @companyAnalyticsSkillNeeds.
  ///
  /// In fr, this message translates to:
  /// **'Besoins en compétences'**
  String get companyAnalyticsSkillNeeds;

  /// No description provided for @companyAnalyticsTrainingNeeds.
  ///
  /// In fr, this message translates to:
  /// **'Besoins en formation'**
  String get companyAnalyticsTrainingNeeds;

  /// No description provided for @companyAnalyticsSocialImpact.
  ///
  /// In fr, this message translates to:
  /// **'Impact social'**
  String get companyAnalyticsSocialImpact;

  /// No description provided for @companyAnalyticsVulnerableWorkersRecruited.
  ///
  /// In fr, this message translates to:
  /// **'{count} travailleur(s) vulnérable(s) recruté(s) ({displaced} déplacés, {refugees} réfugiés, {orphans} orphelins)'**
  String companyAnalyticsVulnerableWorkersRecruited(
      int count, int displaced, int refugees, int orphans);

  /// No description provided for @companyAnalyticsDisabledWorkersRecruited.
  ///
  /// In fr, this message translates to:
  /// **'{count} personne(s) en situation de handicap recrutée(s)'**
  String companyAnalyticsDisabledWorkersRecruited(int count);

  /// No description provided for @companyAnalyticsPriorityProfilesShare.
  ///
  /// In fr, this message translates to:
  /// **'{pct}% de vos recrutements concernent des profils prioritaires.'**
  String companyAnalyticsPriorityProfilesShare(String pct);

  /// No description provided for @companyAnalyticsBenchmarkLockedDefault.
  ///
  /// In fr, this message translates to:
  /// **'Soumettez le questionnaire ONEFOP pour accéder aux analyses comparatives.'**
  String get companyAnalyticsBenchmarkLockedDefault;

  /// No description provided for @companyAnalyticsNoOwnDataTitle.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration DSMO manquante'**
  String get companyAnalyticsNoOwnDataTitle;

  /// No description provided for @companyAnalyticsNoOwnDataDetail.
  ///
  /// In fr, this message translates to:
  /// **'Le benchmarking nécessite une déclaration DSMO annuelle approuvée pour {year}. Votre questionnaire ONEFOP est bien approuvé — il manque la déclaration DSMO de la même année.'**
  String companyAnalyticsNoOwnDataDetail(int year);

  /// No description provided for @companyAnalyticsBilanLockedUnderReview.
  ///
  /// In fr, this message translates to:
  /// **'Votre déclaration ONEFOP est en cours de révision. Votre bilan RH sera disponible après approbation.'**
  String get companyAnalyticsBilanLockedUnderReview;

  /// No description provided for @companyAnalyticsBilanLockedDraft.
  ///
  /// In fr, this message translates to:
  /// **'Vous avez un brouillon en cours. Finalisez et soumettez votre déclaration pour accéder à votre bilan.'**
  String get companyAnalyticsBilanLockedDraft;

  /// No description provided for @companyAnalyticsBilanLockedDefault.
  ///
  /// In fr, this message translates to:
  /// **'Soumettez votre déclaration ONEFOP pour accéder à votre bilan RH personnalisé.'**
  String get companyAnalyticsBilanLockedDefault;

  /// No description provided for @companyAnalyticsBilanLockedWrongYear.
  ///
  /// In fr, this message translates to:
  /// **'Aucun bilan RH approuvé pour cette année. Choisissez une autre année ci-dessus.'**
  String get companyAnalyticsBilanLockedWrongYear;

  /// No description provided for @companyAnalyticsInsufficientDataTitle.
  ///
  /// In fr, this message translates to:
  /// **'Données insuffisantes pour le benchmarking'**
  String get companyAnalyticsInsufficientDataTitle;

  /// No description provided for @companyAnalyticsInsufficientDataDetail.
  ///
  /// In fr, this message translates to:
  /// **'{count} entreprise(s) dans votre groupe (minimum {min} requis).'**
  String companyAnalyticsInsufficientDataDetail(int count, int min);

  /// No description provided for @companyAnalyticsPercentileTop.
  ///
  /// In fr, this message translates to:
  /// **'Top {percentile}%'**
  String companyAnalyticsPercentileTop(int percentile);

  /// No description provided for @companyAnalyticsPercentileMedianPlus.
  ///
  /// In fr, this message translates to:
  /// **'Médian+'**
  String get companyAnalyticsPercentileMedianPlus;

  /// No description provided for @companyAnalyticsPercentileBottom.
  ///
  /// In fr, this message translates to:
  /// **'Bottom {value}%'**
  String companyAnalyticsPercentileBottom(int value);

  /// No description provided for @companyAnalyticsYourCompany.
  ///
  /// In fr, this message translates to:
  /// **'Votre entreprise'**
  String get companyAnalyticsYourCompany;

  /// No description provided for @companyAnalyticsSectorMedian.
  ///
  /// In fr, this message translates to:
  /// **'Médiane secteur'**
  String get companyAnalyticsSectorMedian;

  /// No description provided for @homeTabLabel.
  ///
  /// In fr, this message translates to:
  /// **'Accueil'**
  String get homeTabLabel;

  /// No description provided for @onlineStatusLabel.
  ///
  /// In fr, this message translates to:
  /// **'En ligne'**
  String get onlineStatusLabel;

  /// No description provided for @roleLabelCompany.
  ///
  /// In fr, this message translates to:
  /// **'Établissement'**
  String get roleLabelCompany;

  /// No description provided for @settingsUpdatePreferenceError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de mettre à jour ce paramètre : {error}'**
  String settingsUpdatePreferenceError(String error);

  /// No description provided for @settingsTabGeneral.
  ///
  /// In fr, this message translates to:
  /// **'Général'**
  String get settingsTabGeneral;

  /// No description provided for @settingsTabNotifications.
  ///
  /// In fr, this message translates to:
  /// **'Notifications'**
  String get settingsTabNotifications;

  /// No description provided for @settingsTabSecurity.
  ///
  /// In fr, this message translates to:
  /// **'Sécurité'**
  String get settingsTabSecurity;

  /// No description provided for @settingsTabIntegrations.
  ///
  /// In fr, this message translates to:
  /// **'Intégrations'**
  String get settingsTabIntegrations;

  /// No description provided for @settingsPageTitle.
  ///
  /// In fr, this message translates to:
  /// **'Paramètres'**
  String get settingsPageTitle;

  /// No description provided for @settingsPageSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Configurez votre établissement et votre compte'**
  String get settingsPageSubtitle;

  /// No description provided for @settingsGeneralCardTitle.
  ///
  /// In fr, this message translates to:
  /// **'Informations générales'**
  String get settingsGeneralCardTitle;

  /// No description provided for @settingsGeneralCardSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Mettez à jour les informations de votre établissement'**
  String get settingsGeneralCardSubtitle;

  /// No description provided for @settingsFieldEstablishmentName.
  ///
  /// In fr, this message translates to:
  /// **'Nom de l\'établissement'**
  String get settingsFieldEstablishmentName;

  /// No description provided for @settingsFieldContactEmail.
  ///
  /// In fr, this message translates to:
  /// **'Email de contact'**
  String get settingsFieldContactEmail;

  /// No description provided for @settingsFieldSiret.
  ///
  /// In fr, this message translates to:
  /// **'Numéro d\'identifiant unique (NIU)'**
  String get settingsFieldSiret;

  /// No description provided for @settingsFieldPhone.
  ///
  /// In fr, this message translates to:
  /// **'Téléphone'**
  String get settingsFieldPhone;

  /// No description provided for @settingsFieldAddress.
  ///
  /// In fr, this message translates to:
  /// **'Adresse complète'**
  String get settingsFieldAddress;

  /// No description provided for @settingsNotificationsCardTitle.
  ///
  /// In fr, this message translates to:
  /// **'Préférences de notification'**
  String get settingsNotificationsCardTitle;

  /// No description provided for @settingsNotificationsCardSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Choisissez comment vous souhaitez être alerté'**
  String get settingsNotificationsCardSubtitle;

  /// No description provided for @settingsToggleEmailTitle.
  ///
  /// In fr, this message translates to:
  /// **'Notifications email'**
  String get settingsToggleEmailTitle;

  /// No description provided for @settingsToggleEmailSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Recevez un email pour chaque nouvelle déclaration'**
  String get settingsToggleEmailSubtitle;

  /// No description provided for @settingsToggleRealtimeTitle.
  ///
  /// In fr, this message translates to:
  /// **'Alertes en temps réel'**
  String get settingsToggleRealtimeTitle;

  /// No description provided for @settingsToggleRealtimeSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Notifications push dans le navigateur (préférence enregistrée — canal push à venir)'**
  String get settingsToggleRealtimeSubtitle;

  /// No description provided for @settingsToggleWeeklyTitle.
  ///
  /// In fr, this message translates to:
  /// **'Rapports hebdomadaires'**
  String get settingsToggleWeeklyTitle;

  /// No description provided for @settingsToggleWeeklySubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Recevez un récapitulatif chaque lundi matin'**
  String get settingsToggleWeeklySubtitle;

  /// No description provided for @settingsToggleSmsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Notifications SMS'**
  String get settingsToggleSmsTitle;

  /// No description provided for @settingsToggleSmsSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Alertes urgentes par message texte (préférence enregistrée — canal SMS à venir)'**
  String get settingsToggleSmsSubtitle;

  /// No description provided for @settingsSecurityCardTitle.
  ///
  /// In fr, this message translates to:
  /// **'Sécurité du compte'**
  String get settingsSecurityCardTitle;

  /// No description provided for @settingsSecurityCardSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Protégez l\'accès à votre espace DSMO'**
  String get settingsSecurityCardSubtitle;

  /// No description provided for @settingsFieldCurrentPassword.
  ///
  /// In fr, this message translates to:
  /// **'Mot de passe actuel'**
  String get settingsFieldCurrentPassword;

  /// No description provided for @settingsFieldNewPassword.
  ///
  /// In fr, this message translates to:
  /// **'Nouveau mot de passe'**
  String get settingsFieldNewPassword;

  /// No description provided for @settingsPasswordHint.
  ///
  /// In fr, this message translates to:
  /// **'Min. 8 caractères'**
  String get settingsPasswordHint;

  /// No description provided for @settingsToggle2faTitle.
  ///
  /// In fr, this message translates to:
  /// **'Authentification à deux facteurs (2FA)'**
  String get settingsToggle2faTitle;

  /// No description provided for @settingsToggle2faSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Exiger un code de vérification envoyé par email à chaque connexion'**
  String get settingsToggle2faSubtitle;

  /// No description provided for @settingsPasswordRequirements.
  ///
  /// In fr, this message translates to:
  /// **'Votre mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.'**
  String get settingsPasswordRequirements;

  /// No description provided for @settingsIntegrationsCardSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Connectez DSMO à vos outils externes'**
  String get settingsIntegrationsCardSubtitle;

  /// No description provided for @settingsIntegrationSlackDesc.
  ///
  /// In fr, this message translates to:
  /// **'Recevez les alertes dans votre canal Slack'**
  String get settingsIntegrationSlackDesc;

  /// No description provided for @settingsIntegrationTeamsDesc.
  ///
  /// In fr, this message translates to:
  /// **'Notifications directement dans Teams'**
  String get settingsIntegrationTeamsDesc;

  /// No description provided for @settingsIntegrationCalendarDesc.
  ///
  /// In fr, this message translates to:
  /// **'Synchronisez les échéances réglementaires'**
  String get settingsIntegrationCalendarDesc;

  /// No description provided for @settingsIntegrationWebhookDesc.
  ///
  /// In fr, this message translates to:
  /// **'Envoyez les données à votre endpoint custom'**
  String get settingsIntegrationWebhookDesc;

  /// No description provided for @settingsDangerZoneTitle.
  ///
  /// In fr, this message translates to:
  /// **'Zone de danger'**
  String get settingsDangerZoneTitle;

  /// No description provided for @settingsDangerZoneSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Actions irréversibles sur votre compte'**
  String get settingsDangerZoneSubtitle;

  /// No description provided for @settingsDeleteAccountTitle.
  ///
  /// In fr, this message translates to:
  /// **'Supprimer le compte'**
  String get settingsDeleteAccountTitle;

  /// No description provided for @settingsDeleteAccountDesc.
  ///
  /// In fr, this message translates to:
  /// **'Votre compte sera désactivé immédiatement et vous serez déconnecté. Vous ne pourrez plus vous reconnecter sans l\'intervention d\'un administrateur. Vos déclarations soumises restent conservées, conformément aux obligations réglementaires.'**
  String get settingsDeleteAccountDesc;

  /// No description provided for @settingsDeleteButton.
  ///
  /// In fr, this message translates to:
  /// **'Supprimer'**
  String get settingsDeleteButton;

  /// No description provided for @settingsConfirmDeleteTitle.
  ///
  /// In fr, this message translates to:
  /// **'Confirmer la suppression'**
  String get settingsConfirmDeleteTitle;

  /// No description provided for @settingsConfirmDeleteBody.
  ///
  /// In fr, this message translates to:
  /// **'Cette action est irréversible. Votre compte sera désactivé et vous serez déconnecté immédiatement. Vos déclarations restent conservées à des fins de conformité.'**
  String get settingsConfirmDeleteBody;

  /// No description provided for @settingsDeleteAccountError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de supprimer votre compte : {error}'**
  String settingsDeleteAccountError(Object error);

  /// No description provided for @settingsConnectedBadge.
  ///
  /// In fr, this message translates to:
  /// **'Connecté'**
  String get settingsConnectedBadge;

  /// No description provided for @settingsConnectButton.
  ///
  /// In fr, this message translates to:
  /// **'Connecter'**
  String get settingsConnectButton;

  /// No description provided for @settingsSaveButton.
  ///
  /// In fr, this message translates to:
  /// **'Enregistrer'**
  String get settingsSaveButton;

  /// No description provided for @settingsProfileSaved.
  ///
  /// In fr, this message translates to:
  /// **'Les informations de votre établissement ont été mises à jour.'**
  String get settingsProfileSaved;

  /// No description provided for @settingsProfileSaveError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible d\'enregistrer vos modifications : {error}'**
  String settingsProfileSaveError(Object error);

  /// No description provided for @settingsPasswordChanged.
  ///
  /// In fr, this message translates to:
  /// **'Votre mot de passe a été modifié.'**
  String get settingsPasswordChanged;

  /// No description provided for @settingsPasswordChangeError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de modifier le mot de passe : {error}'**
  String settingsPasswordChangeError(Object error);

  /// No description provided for @settingsPasswordFieldsRequired.
  ///
  /// In fr, this message translates to:
  /// **'Renseignez votre mot de passe actuel et le nouveau.'**
  String get settingsPasswordFieldsRequired;

  /// No description provided for @settingsContactEmailReadOnlyHint.
  ///
  /// In fr, this message translates to:
  /// **'Il s\'agit de votre email de connexion. Contactez un administrateur pour le modifier.'**
  String get settingsContactEmailReadOnlyHint;

  /// No description provided for @settingsRegistrationNumberReadOnlyHint.
  ///
  /// In fr, this message translates to:
  /// **'Attribué lors de l\'inscription, non modifiable ici.'**
  String get settingsRegistrationNumberReadOnlyHint;

  /// No description provided for @declarationsTabLabel.
  ///
  /// In fr, this message translates to:
  /// **'Déclarations'**
  String get declarationsTabLabel;

  /// No description provided for @analyticsTabLabel.
  ///
  /// In fr, this message translates to:
  /// **'Analytique'**
  String get analyticsTabLabel;

  /// No description provided for @settingsTabLabel.
  ///
  /// In fr, this message translates to:
  /// **'Paramètres'**
  String get settingsTabLabel;

  /// No description provided for @draftFoundTitle.
  ///
  /// In fr, this message translates to:
  /// **'Brouillon trouvé'**
  String get draftFoundTitle;

  /// No description provided for @draftFoundBody.
  ///
  /// In fr, this message translates to:
  /// **'Vous avez un formulaire ONEFOP en cours de saisie. Voulez-vous reprendre ou vous vous êtes arrêté ?'**
  String get draftFoundBody;

  /// No description provided for @resumeDraftSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Continuer avec vos données précédentes'**
  String get resumeDraftSubtitle;

  /// No description provided for @startOverTitle.
  ///
  /// In fr, this message translates to:
  /// **'Recommencer'**
  String get startOverTitle;

  /// No description provided for @startOverSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Effacer le brouillon et partir à zéro'**
  String get startOverSubtitle;

  /// No description provided for @entityTypeDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Type d\'entité'**
  String get entityTypeDialogTitle;

  /// No description provided for @entityTypeDialogBody.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez le type de votre entité pour accéder au formulaire ONEFOP.'**
  String get entityTypeDialogBody;

  /// No description provided for @entityTypeEnterprise.
  ///
  /// In fr, this message translates to:
  /// **'Entreprise'**
  String get entityTypeEnterprise;

  /// No description provided for @entityTypeCooperative.
  ///
  /// In fr, this message translates to:
  /// **'Coopérative'**
  String get entityTypeCooperative;

  /// No description provided for @entityTypeCtd.
  ///
  /// In fr, this message translates to:
  /// **'CTD'**
  String get entityTypeCtd;

  /// No description provided for @entityTypeOng.
  ///
  /// In fr, this message translates to:
  /// **'ONG'**
  String get entityTypeOng;

  /// No description provided for @newSubmissionDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Nouvelle soumission'**
  String get newSubmissionDialogTitle;

  /// No description provided for @newSubmissionDialogBody.
  ///
  /// In fr, this message translates to:
  /// **'Choisissez le type de document à créer'**
  String get newSubmissionDialogBody;

  /// No description provided for @dsmoDeclarationOptionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration DSMO'**
  String get dsmoDeclarationOptionTitle;

  /// No description provided for @dsmoDeclarationOptionSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration sociale des main-d\'œuvre'**
  String get dsmoDeclarationOptionSubtitle;

  /// No description provided for @onefopQuestionnaireOptionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Questionnaire ONEFOP'**
  String get onefopQuestionnaireOptionTitle;

  /// No description provided for @onefopQuestionnaireOptionSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Information sur le marché du travail'**
  String get onefopQuestionnaireOptionSubtitle;

  /// No description provided for @companyProfileNotFoundError.
  ///
  /// In fr, this message translates to:
  /// **'Profil entreprise introuvable. Contactez l\'administrateur.'**
  String get companyProfileNotFoundError;

  /// No description provided for @missingEstablishmentIdError.
  ///
  /// In fr, this message translates to:
  /// **'ID établissement manquant. Veuillez contacter l\'administrateur.'**
  String get missingEstablishmentIdError;

  /// No description provided for @noOpenSubmissionPeriodError.
  ///
  /// In fr, this message translates to:
  /// **'Aucune période de soumission n\'est actuellement ouverte.'**
  String get noOpenSubmissionPeriodError;

  /// No description provided for @unknownEntityTypeError.
  ///
  /// In fr, this message translates to:
  /// **'Type d\'entité non reconnu. Merci de contacter l\'administrateur.'**
  String get unknownEntityTypeError;

  /// No description provided for @profileLoadError.
  ///
  /// In fr, this message translates to:
  /// **'Erreur lors du chargement du profil : {error}'**
  String profileLoadError(String error);

  /// No description provided for @noOpenDsmoPeriodError.
  ///
  /// In fr, this message translates to:
  /// **'Aucune période de déclaration DSMO n\'est actuellement ouverte.'**
  String get noOpenDsmoPeriodError;

  /// No description provided for @attestationOpenError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible d\'ouvrir l\'attestation.'**
  String get attestationOpenError;

  /// No description provided for @attestationUnavailableError.
  ///
  /// In fr, this message translates to:
  /// **'Aucune attestation n\'est disponible pour ce compte.'**
  String get attestationUnavailableError;

  /// No description provided for @attestationMenuLabel.
  ///
  /// In fr, this message translates to:
  /// **'Mon attestation d\'inscription'**
  String get attestationMenuLabel;

  /// No description provided for @adminResetPasswordTitle.
  ///
  /// In fr, this message translates to:
  /// **'Réinitialiser un mot de passe'**
  String get adminResetPasswordTitle;

  /// No description provided for @adminResetPasswordInstructions.
  ///
  /// In fr, this message translates to:
  /// **'Vérifiez d\'abord l\'identité de l\'utilisateur par un canal officiel (téléphone, en personne), puis envoyez-lui un lien de réinitialisation par e-mail.'**
  String get adminResetPasswordInstructions;

  /// No description provided for @adminResetPasswordEmailFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Email du compte utilisateur'**
  String get adminResetPasswordEmailFieldLabel;

  /// No description provided for @emailInvalidShort.
  ///
  /// In fr, this message translates to:
  /// **'Email invalide'**
  String get emailInvalidShort;

  /// No description provided for @adminResetPasswordSendButton.
  ///
  /// In fr, this message translates to:
  /// **'Envoyer un lien de réinitialisation'**
  String get adminResetPasswordSendButton;

  /// No description provided for @adminResetPasswordSentMessage.
  ///
  /// In fr, this message translates to:
  /// **'Un lien de réinitialisation a été envoyé à {email}.'**
  String adminResetPasswordSentMessage(String email);

  /// No description provided for @adminResetPasswordLinkExpiryNote.
  ///
  /// In fr, this message translates to:
  /// **'Le lien expire dans 45 minutes et ne peut être utilisé qu\'une seule fois.'**
  String get adminResetPasswordLinkExpiryNote;

  /// No description provided for @adminResetPasswordSendAnotherButton.
  ///
  /// In fr, this message translates to:
  /// **'Envoyer un autre lien'**
  String get adminResetPasswordSendAnotherButton;

  /// No description provided for @annuaireUsersTabLabel.
  ///
  /// In fr, this message translates to:
  /// **'Utilisateurs'**
  String get annuaireUsersTabLabel;

  /// No description provided for @annuaireEntitiesTabLabel.
  ///
  /// In fr, this message translates to:
  /// **'Entités'**
  String get annuaireEntitiesTabLabel;

  /// No description provided for @companiesSearchHint.
  ///
  /// In fr, this message translates to:
  /// **'Rechercher par nom, NIU, identifiant, région...'**
  String get companiesSearchHint;

  /// No description provided for @companiesTotalCount.
  ///
  /// In fr, this message translates to:
  /// **'{count, plural, =0{Aucune entreprise} =1{1 entreprise} other{{count} entreprises}}'**
  String companiesTotalCount(int count);

  /// No description provided for @companiesCreatedAtColumnHeader.
  ///
  /// In fr, this message translates to:
  /// **'Créé le'**
  String get companiesCreatedAtColumnHeader;

  /// No description provided for @companiesContactColumnHeader.
  ///
  /// In fr, this message translates to:
  /// **'Contact'**
  String get companiesContactColumnHeader;

  /// No description provided for @companiesSuspendedBadge.
  ///
  /// In fr, this message translates to:
  /// **'Suspendu'**
  String get companiesSuspendedBadge;

  /// No description provided for @companiesPaginationLabel.
  ///
  /// In fr, this message translates to:
  /// **'Page {page} sur {totalPages}'**
  String companiesPaginationLabel(int page, int totalPages);

  /// No description provided for @companiesEmptyTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucune entreprise trouvée'**
  String get companiesEmptyTitle;

  /// No description provided for @companiesEmptySubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Essayez une autre recherche.'**
  String get companiesEmptySubtitle;

  /// No description provided for @companiesGenderBreakdownMenCount.
  ///
  /// In fr, this message translates to:
  /// **'{count} hommes'**
  String companiesGenderBreakdownMenCount(num count);

  /// No description provided for @companiesGenderBreakdownWomenCount.
  ///
  /// In fr, this message translates to:
  /// **'{count} femmes'**
  String companiesGenderBreakdownWomenCount(num count);

  /// No description provided for @companiesDetailIdentitySectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Identité'**
  String get companiesDetailIdentitySectionTitle;

  /// No description provided for @companiesMainActivityLabel.
  ///
  /// In fr, this message translates to:
  /// **'Activité principale'**
  String get companiesMainActivityLabel;

  /// No description provided for @companiesLegalStatusLabel.
  ///
  /// In fr, this message translates to:
  /// **'Statut juridique'**
  String get companiesLegalStatusLabel;

  /// No description provided for @companiesRegistrationNumberLabel.
  ///
  /// In fr, this message translates to:
  /// **'N° d\'enregistrement'**
  String get companiesRegistrationNumberLabel;

  /// No description provided for @companiesCnpsNumberLabel.
  ///
  /// In fr, this message translates to:
  /// **'N° CNPS'**
  String get companiesCnpsNumberLabel;

  /// No description provided for @companiesYearOfCreationLabel.
  ///
  /// In fr, this message translates to:
  /// **'Année de création'**
  String get companiesYearOfCreationLabel;

  /// No description provided for @companiesEnterpriseSizeLabel.
  ///
  /// In fr, this message translates to:
  /// **'Taille d\'entreprise'**
  String get companiesEnterpriseSizeLabel;

  /// No description provided for @companiesRegisteredOnLabel.
  ///
  /// In fr, this message translates to:
  /// **'Enregistré le'**
  String get companiesRegisteredOnLabel;

  /// No description provided for @companiesSubdivisionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Subdivision'**
  String get companiesSubdivisionLabel;

  /// No description provided for @companiesAddressLabel.
  ///
  /// In fr, this message translates to:
  /// **'Adresse'**
  String get companiesAddressLabel;

  /// No description provided for @companiesDetailContactSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Contact entreprise'**
  String get companiesDetailContactSectionTitle;

  /// No description provided for @companiesAccountStatusLabel.
  ///
  /// In fr, this message translates to:
  /// **'Statut du compte'**
  String get companiesAccountStatusLabel;

  /// No description provided for @companiesDetailRespondentSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Répondant'**
  String get companiesDetailRespondentSectionTitle;

  /// No description provided for @companiesGenderBreakdownRowLabel.
  ///
  /// In fr, this message translates to:
  /// **'Répartition'**
  String get companiesGenderBreakdownRowLabel;

  /// No description provided for @companiesPreviousYearWorkforceLabel.
  ///
  /// In fr, this message translates to:
  /// **'Effectif année précédente'**
  String get companiesPreviousYearWorkforceLabel;

  /// No description provided for @companiesPreviousYearBreakdownLabel.
  ///
  /// In fr, this message translates to:
  /// **'Répartition (année précédente)'**
  String get companiesPreviousYearBreakdownLabel;

  /// No description provided for @createMinefopUserLoadFunctionsError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de charger les fonctions.'**
  String get createMinefopUserLoadFunctionsError;

  /// No description provided for @createMinefopUserSelectRoleError.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner un rôle'**
  String get createMinefopUserSelectRoleError;

  /// No description provided for @createMinefopUserAppBarTitle.
  ///
  /// In fr, this message translates to:
  /// **'Nouvel agent MINEFOP'**
  String get createMinefopUserAppBarTitle;

  /// No description provided for @createMinefopUserFirstNameLabel.
  ///
  /// In fr, this message translates to:
  /// **'Prénom'**
  String get createMinefopUserFirstNameLabel;

  /// No description provided for @createMinefopUserProfessionalEmailLabel.
  ///
  /// In fr, this message translates to:
  /// **'Email professionnel'**
  String get createMinefopUserProfessionalEmailLabel;

  /// No description provided for @createMinefopUserRoleSectionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Rôle'**
  String get createMinefopUserRoleSectionLabel;

  /// No description provided for @createMinefopUserSelectRoleHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionner un rôle'**
  String get createMinefopUserSelectRoleHint;

  /// No description provided for @createMinefopUserPositionSectionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Poste'**
  String get createMinefopUserPositionSectionLabel;

  /// No description provided for @createMinefopUserMatriculeLabel.
  ///
  /// In fr, this message translates to:
  /// **'Matricule'**
  String get createMinefopUserMatriculeLabel;

  /// No description provided for @createMinefopUserCreateAccountButton.
  ///
  /// In fr, this message translates to:
  /// **'Créer le compte'**
  String get createMinefopUserCreateAccountButton;

  /// No description provided for @createMinefopUserLoadingFunctions.
  ///
  /// In fr, this message translates to:
  /// **'Chargement des fonctions…'**
  String get createMinefopUserLoadingFunctions;

  /// No description provided for @createMinefopUserNoFunctionsAvailable.
  ///
  /// In fr, this message translates to:
  /// **'Aucune fonction disponible pour ce rôle.'**
  String get createMinefopUserNoFunctionsAvailable;

  /// No description provided for @createMinefopUserSelectFunctionHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionner la fonction'**
  String get createMinefopUserSelectFunctionHint;

  /// No description provided for @createMinefopUserLoadingUnits.
  ///
  /// In fr, this message translates to:
  /// **'Chargement des unités…'**
  String get createMinefopUserLoadingUnits;

  /// No description provided for @createMinefopUserNoUnitsAvailable.
  ///
  /// In fr, this message translates to:
  /// **'Aucune unité disponible.'**
  String get createMinefopUserNoUnitsAvailable;

  /// No description provided for @createMinefopUserParentUnitHint.
  ///
  /// In fr, this message translates to:
  /// **'Unité parente'**
  String get createMinefopUserParentUnitHint;

  /// No description provided for @createMinefopUserLoadingServices.
  ///
  /// In fr, this message translates to:
  /// **'Chargement des services…'**
  String get createMinefopUserLoadingServices;

  /// No description provided for @createMinefopUserNoServiceFound.
  ///
  /// In fr, this message translates to:
  /// **'Aucun service trouvé sous cette unité.'**
  String get createMinefopUserNoServiceFound;

  /// No description provided for @createMinefopUserExactServiceHint.
  ///
  /// In fr, this message translates to:
  /// **'Service exact'**
  String get createMinefopUserExactServiceHint;

  /// No description provided for @createMinefopUserLoadingRegions.
  ///
  /// In fr, this message translates to:
  /// **'Chargement des régions…'**
  String get createMinefopUserLoadingRegions;

  /// No description provided for @createMinefopUserSelectRegionFirstNote.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez d\'abord une région.'**
  String get createMinefopUserSelectRegionFirstNote;

  /// No description provided for @createMinefopUserLoadingDepartments.
  ///
  /// In fr, this message translates to:
  /// **'Chargement des départements…'**
  String get createMinefopUserLoadingDepartments;

  /// No description provided for @createMinefopUserCopiedToast.
  ///
  /// In fr, this message translates to:
  /// **'{label} copié'**
  String createMinefopUserCopiedToast(String label);

  /// No description provided for @createMinefopUserAccountCreatedTitle.
  ///
  /// In fr, this message translates to:
  /// **'Compte créé'**
  String get createMinefopUserAccountCreatedTitle;

  /// No description provided for @createMinefopUserCredentialsWarning.
  ///
  /// In fr, this message translates to:
  /// **'Ce mot de passe temporaire ne sera plus jamais affiché. Transmettez-le à l\'agent (WhatsApp, téléphone, en personne) — il devra le changer à sa première connexion.'**
  String get createMinefopUserCredentialsWarning;

  /// No description provided for @createMinefopUserDoneButton.
  ///
  /// In fr, this message translates to:
  /// **'Terminé'**
  String get createMinefopUserDoneButton;

  /// No description provided for @createMinefopUserCopyTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Copier'**
  String get createMinefopUserCopyTooltip;

  /// No description provided for @landingConfigRestoreDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Restaurer cette version ?'**
  String get landingConfigRestoreDialogTitle;

  /// No description provided for @landingConfigRestoreDialogBody.
  ///
  /// In fr, this message translates to:
  /// **'La page d\'accueil publique sera immédiatement remplacée par le contenu de cette version. L\'état actuel est lui-même sauvegardé et pourra être restauré ensuite.'**
  String get landingConfigRestoreDialogBody;

  /// No description provided for @landingConfigRestoreButton.
  ///
  /// In fr, this message translates to:
  /// **'Restaurer'**
  String get landingConfigRestoreButton;

  /// No description provided for @landingConfigVersionRestoredToast.
  ///
  /// In fr, this message translates to:
  /// **'Version restaurée'**
  String get landingConfigVersionRestoredToast;

  /// No description provided for @landingConfigRestoreFailedToast.
  ///
  /// In fr, this message translates to:
  /// **'Échec de la restauration : {error}'**
  String landingConfigRestoreFailedToast(String error);

  /// No description provided for @landingConfigUpdatedToast.
  ///
  /// In fr, this message translates to:
  /// **'Page d\'accueil mise à jour'**
  String get landingConfigUpdatedToast;

  /// No description provided for @landingConfigSaveFailedToast.
  ///
  /// In fr, this message translates to:
  /// **'Échec de l\'enregistrement : {error}'**
  String landingConfigSaveFailedToast(String error);

  /// No description provided for @landingConfigAppBarTitle.
  ///
  /// In fr, this message translates to:
  /// **'Page d\'accueil publique'**
  String get landingConfigAppBarTitle;

  /// No description provided for @landingConfigDescriptionNote.
  ///
  /// In fr, this message translates to:
  /// **'Contenu narratif de la page d\'accueil publique (programme SIMT / CAMLEAP) : statut, phrase de soutien, composantes, piliers Collecter / Intégrer / Analyser / Informer, objet du programme, appel à l\'accès. Réservé au SUPER_ADMIN.'**
  String get landingConfigDescriptionNote;

  /// No description provided for @landingConfigLastModifiedLabel.
  ///
  /// In fr, this message translates to:
  /// **'Dernière modification : {date}'**
  String landingConfigLastModifiedLabel(String date);

  /// No description provided for @landingConfigStatusSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Statut du programme'**
  String get landingConfigStatusSectionTitle;

  /// No description provided for @landingConfigStatusLineFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Ligne de statut (sous la composante actuelle)'**
  String get landingConfigStatusLineFieldLabel;

  /// No description provided for @landingConfigHeroSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Hero'**
  String get landingConfigHeroSectionTitle;

  /// No description provided for @landingConfigMainTitleFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Titre principal'**
  String get landingConfigMainTitleFieldLabel;

  /// No description provided for @landingConfigSupportingLineFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Phrase de soutien (sous le titre)'**
  String get landingConfigSupportingLineFieldLabel;

  /// No description provided for @landingConfigComponentsSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Composantes du programme (I–IV)'**
  String get landingConfigComponentsSectionTitle;

  /// No description provided for @landingConfigCaptionFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Légende (sous les composantes)'**
  String get landingConfigCaptionFieldLabel;

  /// No description provided for @landingConfigPillarsSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Piliers LMIS (Collecter / Intégrer / Analyser / Informer)'**
  String get landingConfigPillarsSectionTitle;

  /// No description provided for @landingConfigCardIndexLabel.
  ///
  /// In fr, this message translates to:
  /// **'Carte {index}'**
  String landingConfigCardIndexLabel(int index);

  /// No description provided for @landingConfigKickerFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Mot-clé (au-dessus du titre)'**
  String get landingConfigKickerFieldLabel;

  /// No description provided for @landingConfigTitleFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Titre'**
  String get landingConfigTitleFieldLabel;

  /// No description provided for @landingConfigTextFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Texte'**
  String get landingConfigTextFieldLabel;

  /// No description provided for @landingConfigArchSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Pipeline architecture SIMT'**
  String get landingConfigArchSectionTitle;

  /// No description provided for @landingConfigArchSectionNote.
  ///
  /// In fr, this message translates to:
  /// **'Actuellement non affiché sur la page publique — la section correspondante a été fusionnée avec le pipeline « données → intelligence » ci-dessous. Les modifications sont enregistrées mais restent invisibles.'**
  String get landingConfigArchSectionNote;

  /// No description provided for @landingConfigStepIndexLabel.
  ///
  /// In fr, this message translates to:
  /// **'Étape {index}'**
  String landingConfigStepIndexLabel(int index);

  /// No description provided for @landingConfigIntelSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Pipeline données → intelligence'**
  String get landingConfigIntelSectionTitle;

  /// No description provided for @landingConfigEcosystemSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Écosystème institutionnel'**
  String get landingConfigEcosystemSectionTitle;

  /// No description provided for @landingConfigBlockTitleFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Bloc {index} — titre'**
  String landingConfigBlockTitleFieldLabel(int index);

  /// No description provided for @landingConfigBlockTextFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Bloc {index} — texte'**
  String landingConfigBlockTextFieldLabel(int index);

  /// No description provided for @landingConfigAboutSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Objet du programme (pourquoi un SIMT)'**
  String get landingConfigAboutSectionTitle;

  /// No description provided for @landingConfigParagraphIndexLabel.
  ///
  /// In fr, this message translates to:
  /// **'Paragraphe {index}'**
  String landingConfigParagraphIndexLabel(int index);

  /// No description provided for @landingConfigObservatorySectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Observatoire (page publique /observatory)'**
  String get landingConfigObservatorySectionTitle;

  /// No description provided for @landingConfigObservatoryNote.
  ///
  /// In fr, this message translates to:
  /// **'Contenu provisoire — aucun texte définitif n\'a encore été fourni pour l\'Observatoire public. La page publique affiche un badge « contenu en préparation » tant que ce texte reste la copie par défaut ci-dessous.'**
  String get landingConfigObservatoryNote;

  /// No description provided for @landingConfigDescriptionFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Description'**
  String get landingConfigDescriptionFieldLabel;

  /// No description provided for @landingConfigIndicatorIndexLabel.
  ///
  /// In fr, this message translates to:
  /// **'Indicateur {index}'**
  String landingConfigIndicatorIndexLabel(int index);

  /// No description provided for @landingConfigCtaSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Appel à l\'accès'**
  String get landingConfigCtaSectionTitle;

  /// No description provided for @landingConfigSubtextFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Sous-texte'**
  String get landingConfigSubtextFieldLabel;

  /// No description provided for @landingConfigAccessSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Accès à la plateforme'**
  String get landingConfigAccessSectionTitle;

  /// No description provided for @landingConfigAccessNoteFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Note d\'accès (sous les boutons)'**
  String get landingConfigAccessNoteFieldLabel;

  /// No description provided for @landingConfigPreviewSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aperçu'**
  String get landingConfigPreviewSectionTitle;

  /// No description provided for @landingConfigFrChipLabel.
  ///
  /// In fr, this message translates to:
  /// **'FR'**
  String get landingConfigFrChipLabel;

  /// No description provided for @landingConfigEnChipLabel.
  ///
  /// In fr, this message translates to:
  /// **'EN'**
  String get landingConfigEnChipLabel;

  /// No description provided for @landingConfigHistorySectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Historique (restauration)'**
  String get landingConfigHistorySectionTitle;

  /// No description provided for @landingConfigNoHistoryMessage.
  ///
  /// In fr, this message translates to:
  /// **'Aucune version antérieure enregistrée.'**
  String get landingConfigNoHistoryMessage;

  /// No description provided for @landingConfigComponentShortNameLabel.
  ///
  /// In fr, this message translates to:
  /// **'Composante {roman} — nom court'**
  String landingConfigComponentShortNameLabel(String roman);

  /// No description provided for @landingConfigComponentDescriptionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Composante {roman} — description'**
  String landingConfigComponentDescriptionLabel(String roman);

  /// No description provided for @regionsSectorsLoadError.
  ///
  /// In fr, this message translates to:
  /// **'Erreur de chargement : {error}'**
  String regionsSectorsLoadError(String error);

  /// No description provided for @regionsSectorsAppBarTitle.
  ///
  /// In fr, this message translates to:
  /// **'Régions & Secteurs'**
  String get regionsSectorsAppBarTitle;

  /// No description provided for @regionsSectorsNoResultsSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucune région ou secteur ne correspond à votre recherche.'**
  String get regionsSectorsNoResultsSubtitle;

  /// No description provided for @regionsSectorsSectionHeaderWithCount.
  ///
  /// In fr, this message translates to:
  /// **'{title} ({count})'**
  String regionsSectorsSectionHeaderWithCount(String title, int count);

  /// No description provided for @regionsSectorsSectorsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Secteurs'**
  String get regionsSectorsSectorsLabel;

  /// No description provided for @regionsSectorsOnefopSubmissionsStatLabel.
  ///
  /// In fr, this message translates to:
  /// **'Soumissions ONEFOP'**
  String get regionsSectorsOnefopSubmissionsStatLabel;

  /// No description provided for @regionsSectorsSearchHint.
  ///
  /// In fr, this message translates to:
  /// **'Rechercher une région ou un secteur…'**
  String get regionsSectorsSearchHint;

  /// No description provided for @regionsSectorsAllFilterChip.
  ///
  /// In fr, this message translates to:
  /// **'Tout'**
  String get regionsSectorsAllFilterChip;

  /// No description provided for @regionsSectorsActionsColumnHeader.
  ///
  /// In fr, this message translates to:
  /// **'Actions'**
  String get regionsSectorsActionsColumnHeader;

  /// No description provided for @regionsSectorsDeleteConfirmBody.
  ///
  /// In fr, this message translates to:
  /// **'Supprimer définitivement {itemName} ?'**
  String regionsSectorsDeleteConfirmBody(String itemName);

  /// No description provided for @regionsSectorsEditRegionDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Modifier la région'**
  String get regionsSectorsEditRegionDialogTitle;

  /// No description provided for @regionsSectorsRegionUpdatedToast.
  ///
  /// In fr, this message translates to:
  /// **'Région mise à jour'**
  String get regionsSectorsRegionUpdatedToast;

  /// No description provided for @regionsSectorsGenericErrorToast.
  ///
  /// In fr, this message translates to:
  /// **'Erreur : {error}'**
  String regionsSectorsGenericErrorToast(String error);

  /// No description provided for @regionsSectorsRegionDeletedToast.
  ///
  /// In fr, this message translates to:
  /// **'Région supprimée'**
  String get regionsSectorsRegionDeletedToast;

  /// No description provided for @regionsSectorsEditSectorDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Modifier le secteur'**
  String get regionsSectorsEditSectorDialogTitle;

  /// No description provided for @regionsSectorsSectorUpdatedToast.
  ///
  /// In fr, this message translates to:
  /// **'Secteur mis à jour'**
  String get regionsSectorsSectorUpdatedToast;

  /// No description provided for @regionsSectorsSectorDeletedToast.
  ///
  /// In fr, this message translates to:
  /// **'Secteur supprimé'**
  String get regionsSectorsSectorDeletedToast;

  /// No description provided for @settingsSavedToast.
  ///
  /// In fr, this message translates to:
  /// **'Paramètres enregistrés'**
  String get settingsSavedToast;

  /// No description provided for @systemSettingsScreenTitle.
  ///
  /// In fr, this message translates to:
  /// **'Paramètres système'**
  String get systemSettingsScreenTitle;

  /// No description provided for @systemSettingsScreenSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Configuration valable pour toute la plateforme. Réservé au SUPER_ADMIN.'**
  String get systemSettingsScreenSubtitle;

  /// No description provided for @securityPolicySectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Politique de sécurité'**
  String get securityPolicySectionTitle;

  /// No description provided for @passwordMinLengthLabel.
  ///
  /// In fr, this message translates to:
  /// **'Longueur minimale du mot de passe'**
  String get passwordMinLengthLabel;

  /// No description provided for @require2faStaffLabel.
  ///
  /// In fr, this message translates to:
  /// **'Double authentification obligatoire (personnel MINEFOP)'**
  String get require2faStaffLabel;

  /// No description provided for @require2faStaffSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Empêche les comptes non-entreprise de désactiver leur 2FA.'**
  String get require2faStaffSubtitle;

  /// No description provided for @maintenanceModeSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Mode maintenance'**
  String get maintenanceModeSectionTitle;

  /// No description provided for @enableMaintenanceModeLabel.
  ///
  /// In fr, this message translates to:
  /// **'Activer le mode maintenance'**
  String get enableMaintenanceModeLabel;

  /// No description provided for @maintenanceModeSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Bloque tous les accès sauf le SUPER_ADMIN, avec le message ci-dessous.'**
  String get maintenanceModeSubtitle;

  /// No description provided for @maintenanceMessageFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Message affiché aux utilisateurs'**
  String get maintenanceMessageFieldLabel;

  /// No description provided for @maintenanceMessageFieldHint.
  ///
  /// In fr, this message translates to:
  /// **'La plateforme est actuellement en maintenance...'**
  String get maintenanceMessageFieldHint;

  /// No description provided for @referenceDataSectionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Données de référence'**
  String get referenceDataSectionTitle;

  /// No description provided for @referenceDataSectionDescription.
  ///
  /// In fr, this message translates to:
  /// **'Gérer la taxonomie régions/secteurs utilisée par les filtres et formulaires de toute la plateforme.'**
  String get referenceDataSectionDescription;

  /// No description provided for @manageRegionsSectorsButton.
  ///
  /// In fr, this message translates to:
  /// **'Gérer les régions et secteurs'**
  String get manageRegionsSectorsButton;

  /// No description provided for @userStatusActivePluralLabel.
  ///
  /// In fr, this message translates to:
  /// **'Actifs'**
  String get userStatusActivePluralLabel;

  /// No description provided for @userStatusSuspendedPluralLabel.
  ///
  /// In fr, this message translates to:
  /// **'Suspendus'**
  String get userStatusSuspendedPluralLabel;

  /// No description provided for @userStatusRejectedPluralLabel.
  ///
  /// In fr, this message translates to:
  /// **'Rejetés'**
  String get userStatusRejectedPluralLabel;

  /// No description provided for @approveAgentDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Approuver l\'agent'**
  String get approveAgentDialogTitle;

  /// No description provided for @approveAgentConfirmBody.
  ///
  /// In fr, this message translates to:
  /// **'Confirmer l\'approbation de {name} ?'**
  String approveAgentConfirmBody(String name);

  /// No description provided for @approveActionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Approuver'**
  String get approveActionLabel;

  /// No description provided for @userApprovedToast.
  ///
  /// In fr, this message translates to:
  /// **'{name} approuvé avec succès'**
  String userApprovedToast(String name);

  /// No description provided for @genericErrorToastNoSpace.
  ///
  /// In fr, this message translates to:
  /// **'Erreur: {error}'**
  String genericErrorToastNoSpace(String error);

  /// No description provided for @userRejectedToast.
  ///
  /// In fr, this message translates to:
  /// **'{name} rejeté'**
  String userRejectedToast(String name);

  /// No description provided for @userRoleUpdatedToast.
  ///
  /// In fr, this message translates to:
  /// **'Rôle mis à jour : {role}'**
  String userRoleUpdatedToast(String role);

  /// No description provided for @suspendAccountDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Suspendre le compte'**
  String get suspendAccountDialogTitle;

  /// No description provided for @reactivateAccountDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Réactiver le compte'**
  String get reactivateAccountDialogTitle;

  /// No description provided for @suspendAccountBody.
  ///
  /// In fr, this message translates to:
  /// **'{name} ne pourra plus se connecter jusqu\'à réactivation.'**
  String suspendAccountBody(String name);

  /// No description provided for @reactivateAccountBody.
  ///
  /// In fr, this message translates to:
  /// **'{name} pourra de nouveau se connecter.'**
  String reactivateAccountBody(String name);

  /// No description provided for @suspendActionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Suspendre'**
  String get suspendActionLabel;

  /// No description provided for @reactivateActionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Réactiver'**
  String get reactivateActionLabel;

  /// No description provided for @userSuspendedToast.
  ///
  /// In fr, this message translates to:
  /// **'{name} suspendu'**
  String userSuspendedToast(String name);

  /// No description provided for @userReactivatedToast.
  ///
  /// In fr, this message translates to:
  /// **'{name} réactivé'**
  String userReactivatedToast(String name);

  /// No description provided for @userDeletedToast.
  ///
  /// In fr, this message translates to:
  /// **'{name} supprimé'**
  String userDeletedToast(String name);

  /// No description provided for @rejectTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Rejeter'**
  String get rejectTooltip;

  /// No description provided for @editRoleActionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Modifier le rôle'**
  String get editRoleActionLabel;

  /// No description provided for @usersSearchFieldHint.
  ///
  /// In fr, this message translates to:
  /// **'Rechercher par nom, email, matricule...'**
  String get usersSearchFieldHint;

  /// No description provided for @userAccountsCountLabel.
  ///
  /// In fr, this message translates to:
  /// **'{count, plural, =1{{count} compte} other{{count} comptes}}'**
  String userAccountsCountLabel(int count);

  /// No description provided for @allRolesFilterLabel.
  ///
  /// In fr, this message translates to:
  /// **'Tous les rôles'**
  String get allRolesFilterLabel;

  /// No description provided for @regionDepartmentColumnHeader.
  ///
  /// In fr, this message translates to:
  /// **'Région / Département'**
  String get regionDepartmentColumnHeader;

  /// No description provided for @noUsersFoundTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucun compte trouvé'**
  String get noUsersFoundTitle;

  /// No description provided for @noUsersFoundSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Essayez une autre recherche ou un autre filtre.'**
  String get noUsersFoundSubtitle;

  /// No description provided for @rejectUserSheetTitle.
  ///
  /// In fr, this message translates to:
  /// **'Rejeter {name}'**
  String rejectUserSheetTitle(String name);

  /// No description provided for @rejectReasonLabel.
  ///
  /// In fr, this message translates to:
  /// **'Motif du rejet (optionnel)'**
  String get rejectReasonLabel;

  /// No description provided for @rejectReasonHint.
  ///
  /// In fr, this message translates to:
  /// **'Ex: Documents incomplets...'**
  String get rejectReasonHint;

  /// No description provided for @confirmRejectButton.
  ///
  /// In fr, this message translates to:
  /// **'Confirmer le rejet'**
  String get confirmRejectButton;

  /// No description provided for @deleteUserSheetTitle.
  ///
  /// In fr, this message translates to:
  /// **'Supprimer {name} ?'**
  String deleteUserSheetTitle(String name);

  /// No description provided for @deleteUserIrreversibleWarning.
  ///
  /// In fr, this message translates to:
  /// **'Action irréversible. Si ce compte a des déclarations, soumissions ou notifications liées, la suppression sera refusée — suspendez-le à la place.'**
  String get deleteUserIrreversibleWarning;

  /// No description provided for @typeEmailToConfirmLabel.
  ///
  /// In fr, this message translates to:
  /// **'Tapez \"{email}\" pour confirmer'**
  String typeEmailToConfirmLabel(String email);

  /// No description provided for @newAgentButtonLabel.
  ///
  /// In fr, this message translates to:
  /// **'Nouvel agent'**
  String get newAgentButtonLabel;

  /// No description provided for @regionDeptSelectorLoadRegionsError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de charger les régions.'**
  String get regionDeptSelectorLoadRegionsError;

  /// No description provided for @allRegionsCheckboxLabel.
  ///
  /// In fr, this message translates to:
  /// **'Toutes les régions'**
  String get allRegionsCheckboxLabel;

  /// No description provided for @noDepartmentsAvailableLabel.
  ///
  /// In fr, this message translates to:
  /// **'Aucun département disponible'**
  String get noDepartmentsAvailableLabel;

  /// No description provided for @campaignDetailStartDateLabel.
  ///
  /// In fr, this message translates to:
  /// **'Date de début'**
  String get campaignDetailStartDateLabel;

  /// No description provided for @campaignDetailEndDateLabel.
  ///
  /// In fr, this message translates to:
  /// **'Date de fin'**
  String get campaignDetailEndDateLabel;

  /// No description provided for @campaignDetailTargetUsersLabel.
  ///
  /// In fr, this message translates to:
  /// **'Utilisateurs ciblés'**
  String get campaignDetailTargetUsersLabel;

  /// No description provided for @campaignDetailAvailableFormsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Formulaires disponibles'**
  String get campaignDetailAvailableFormsLabel;

  /// No description provided for @openCampaignButton.
  ///
  /// In fr, this message translates to:
  /// **'Ouvrir la campagne'**
  String get openCampaignButton;

  /// No description provided for @identificationTableSelectHint.
  ///
  /// In fr, this message translates to:
  /// **'Choisir...'**
  String get identificationTableSelectHint;

  /// No description provided for @identificationTableTextInputHint.
  ///
  /// In fr, this message translates to:
  /// **'Saisir...'**
  String get identificationTableTextInputHint;

  /// No description provided for @companyDeclMyDeclarationsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Mes déclarations'**
  String get companyDeclMyDeclarationsTitle;

  /// No description provided for @companyDeclMyDeclarationsSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Suivez vos déclarations d\'emploi, vos soumissions et leur statut d\'approbation'**
  String get companyDeclMyDeclarationsSubtitle;

  /// No description provided for @companyDeclFilterAllCount.
  ///
  /// In fr, this message translates to:
  /// **'Tous {count}'**
  String companyDeclFilterAllCount(int count);

  /// No description provided for @companyDeclFilterUnderReviewCount.
  ///
  /// In fr, this message translates to:
  /// **'En cours de révision {count}'**
  String companyDeclFilterUnderReviewCount(int count);

  /// No description provided for @companyDeclSearchHint.
  ///
  /// In fr, this message translates to:
  /// **'Rechercher des déclarations...'**
  String get companyDeclSearchHint;

  /// No description provided for @companyDeclFilterAllCampaigns.
  ///
  /// In fr, this message translates to:
  /// **'Toutes les campagnes'**
  String get companyDeclFilterAllCampaigns;

  /// No description provided for @companyDeclHistoryTitle.
  ///
  /// In fr, this message translates to:
  /// **'Historique des déclarations'**
  String get companyDeclHistoryTitle;

  /// No description provided for @companyDeclDefaultSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Soumission de l\'entreprise'**
  String get companyDeclDefaultSubtitle;

  /// No description provided for @companyDeclViewDetailsAction.
  ///
  /// In fr, this message translates to:
  /// **'Voir les détails'**
  String get companyDeclViewDetailsAction;

  /// No description provided for @companyDeclContinueDraftAction.
  ///
  /// In fr, this message translates to:
  /// **'Continuer le brouillon'**
  String get companyDeclContinueDraftAction;

  /// No description provided for @companyDeclTrackStatusAction.
  ///
  /// In fr, this message translates to:
  /// **'Suivre le statut'**
  String get companyDeclTrackStatusAction;

  /// No description provided for @companyDeclStepCreated.
  ///
  /// In fr, this message translates to:
  /// **'Créée'**
  String get companyDeclStepCreated;

  /// No description provided for @companyDeclStatusTimelineTitle.
  ///
  /// In fr, this message translates to:
  /// **'Chronologie du statut'**
  String get companyDeclStatusTimelineTitle;

  /// No description provided for @companyRegGenderSumMismatchError.
  ///
  /// In fr, this message translates to:
  /// **'Total ≠ H + F'**
  String get companyRegGenderSumMismatchError;

  /// No description provided for @companyRegSubmitSuccessMsg.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration soumise avec succès'**
  String get companyRegSubmitSuccessMsg;

  /// No description provided for @companyRegSectionIdentificationTitle.
  ///
  /// In fr, this message translates to:
  /// **'I. IDENTIFICATION DE L\'ÉTABLISSEMENT'**
  String get companyRegSectionIdentificationTitle;

  /// No description provided for @companyRegFieldCompanyName.
  ///
  /// In fr, this message translates to:
  /// **'Raison Sociale'**
  String get companyRegFieldCompanyName;

  /// No description provided for @companyRegFieldTaxNumber.
  ///
  /// In fr, this message translates to:
  /// **'N° Contribuable (NIU)'**
  String get companyRegFieldTaxNumber;

  /// No description provided for @companyRegFieldParentCompanyLong.
  ///
  /// In fr, this message translates to:
  /// **'Raison sociale de l\'entreprise dont dépend l\'établissement'**
  String get companyRegFieldParentCompanyLong;

  /// No description provided for @companyRegFieldSecondaryActivity.
  ///
  /// In fr, this message translates to:
  /// **'Activité secondaire'**
  String get companyRegFieldSecondaryActivity;

  /// No description provided for @companyRegFieldCapital.
  ///
  /// In fr, this message translates to:
  /// **'Capital social (XAF)'**
  String get companyRegFieldCapital;

  /// No description provided for @companyRegSectionWorkforceTitle.
  ///
  /// In fr, this message translates to:
  /// **'II. EFFECTIFS AU 31 DÉCEMBRE'**
  String get companyRegSectionWorkforceTitle;

  /// No description provided for @companyRegFieldTotalEmployees.
  ///
  /// In fr, this message translates to:
  /// **'Total Employés'**
  String get companyRegFieldTotalEmployees;

  /// No description provided for @companyRegFieldLastYearTotal.
  ///
  /// In fr, this message translates to:
  /// **'Total employés (année dernière)'**
  String get companyRegFieldLastYearTotal;

  /// No description provided for @companyRegSectionMovementsTitle.
  ///
  /// In fr, this message translates to:
  /// **'III. MOUVEMENTS PAR CATÉGORIES'**
  String get companyRegSectionMovementsTitle;

  /// No description provided for @companyRegSubmitButton.
  ///
  /// In fr, this message translates to:
  /// **'SOUMETTRE LA DÉCLARATION'**
  String get companyRegSubmitButton;

  /// No description provided for @lawComplianceNoteShort.
  ///
  /// In fr, this message translates to:
  /// **'Conformément à la loi No 91/023 du 16 déc 1991.'**
  String get lawComplianceNoteShort;

  /// No description provided for @companyRegRequiredFieldShort.
  ///
  /// In fr, this message translates to:
  /// **'Champ requis'**
  String get companyRegRequiredFieldShort;

  /// No description provided for @movementCategory13.
  ///
  /// In fr, this message translates to:
  /// **'1-3'**
  String get movementCategory13;

  /// No description provided for @movementCategory46.
  ///
  /// In fr, this message translates to:
  /// **'4-6'**
  String get movementCategory46;

  /// No description provided for @movementCategory79.
  ///
  /// In fr, this message translates to:
  /// **'7-9'**
  String get movementCategory79;

  /// No description provided for @movementCategory1012.
  ///
  /// In fr, this message translates to:
  /// **'10-12'**
  String get movementCategory1012;

  /// No description provided for @movementRecruitmentLabel.
  ///
  /// In fr, this message translates to:
  /// **'Recrutement'**
  String get movementRecruitmentLabel;

  /// No description provided for @movementDismissalLabel.
  ///
  /// In fr, this message translates to:
  /// **'Licenciement'**
  String get movementDismissalLabel;

  /// No description provided for @movementRetirementLabel.
  ///
  /// In fr, this message translates to:
  /// **'Retraite'**
  String get movementRetirementLabel;

  /// No description provided for @declApprovalApprovedSuccessMsg.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration approuvée avec succès'**
  String get declApprovalApprovedSuccessMsg;

  /// No description provided for @declApprovalMissingRejectReasonWarning.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez entrer une raison de rejet'**
  String get declApprovalMissingRejectReasonWarning;

  /// No description provided for @declApprovalRejectedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration rejetée'**
  String get declApprovalRejectedMsg;

  /// No description provided for @declApprovalPdfLoadError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de charger le PDF : {error}'**
  String declApprovalPdfLoadError(String error);

  /// No description provided for @declApprovalDraftTitle.
  ///
  /// In fr, this message translates to:
  /// **'Brouillon — DSMO'**
  String get declApprovalDraftTitle;

  /// No description provided for @declApprovalValidationTitle.
  ///
  /// In fr, this message translates to:
  /// **'Validation DSMO'**
  String get declApprovalValidationTitle;

  /// No description provided for @pdfCopyOriginalLabel.
  ///
  /// In fr, this message translates to:
  /// **'ORIGINAL (Employeur)'**
  String get pdfCopyOriginalLabel;

  /// No description provided for @pdfCopyDuplicateLabel.
  ///
  /// In fr, this message translates to:
  /// **'DUPLICATA (Autorité)'**
  String get pdfCopyDuplicateLabel;

  /// No description provided for @pdfCopyTriplicateLabel.
  ///
  /// In fr, this message translates to:
  /// **'TRIPLICATA (Archives)'**
  String get pdfCopyTriplicateLabel;

  /// No description provided for @declApprovalResumeEntryButton.
  ///
  /// In fr, this message translates to:
  /// **'Reprendre la saisie'**
  String get declApprovalResumeEntryButton;

  /// No description provided for @declApprovalNotFoundMsg.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration introuvable'**
  String get declApprovalNotFoundMsg;

  /// No description provided for @declApprovalSectionEstablishmentInfo.
  ///
  /// In fr, this message translates to:
  /// **'Informations de l\'établissement'**
  String get declApprovalSectionEstablishmentInfo;

  /// No description provided for @declApprovalSectionWorkforce.
  ///
  /// In fr, this message translates to:
  /// **'Effectifs Main-d\'œuvre'**
  String get declApprovalSectionWorkforce;

  /// No description provided for @declApprovalSectionMovements.
  ///
  /// In fr, this message translates to:
  /// **'Mouvements du personnel'**
  String get declApprovalSectionMovements;

  /// No description provided for @declApprovalSectionAdditionalInfo.
  ///
  /// In fr, this message translates to:
  /// **'Informations supplémentaires'**
  String get declApprovalSectionAdditionalInfo;

  /// No description provided for @declApprovalSectionComplianceSteps.
  ///
  /// In fr, this message translates to:
  /// **'Étapes de conformité'**
  String get declApprovalSectionComplianceSteps;

  /// No description provided for @declApprovalPanelApprovalTitle.
  ///
  /// In fr, this message translates to:
  /// **'APPROBATION'**
  String get declApprovalPanelApprovalTitle;

  /// No description provided for @declApprovalNotesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Notes administratives'**
  String get declApprovalNotesLabel;

  /// No description provided for @declApprovalApproveButton.
  ///
  /// In fr, this message translates to:
  /// **'APPROUVER LA DÉCLARATION'**
  String get declApprovalApproveButton;

  /// No description provided for @declApprovalPanelRejectTitle.
  ///
  /// In fr, this message translates to:
  /// **'REJET'**
  String get declApprovalPanelRejectTitle;

  /// No description provided for @declApprovalRejectReasonLabel.
  ///
  /// In fr, this message translates to:
  /// **'Motif du rejet (Obligatoire)'**
  String get declApprovalRejectReasonLabel;

  /// No description provided for @declApprovalRejectButton.
  ///
  /// In fr, this message translates to:
  /// **'REJETER POUR CORRECTION'**
  String get declApprovalRejectButton;

  /// No description provided for @declApprovalYearLine.
  ///
  /// In fr, this message translates to:
  /// **'Exercice : {year}'**
  String declApprovalYearLine(String year);

  /// No description provided for @declApprovalCurrentStatusLine.
  ///
  /// In fr, this message translates to:
  /// **'Statut Actuel : {status}'**
  String declApprovalCurrentStatusLine(String status);

  /// No description provided for @declApprovalSubmissionDateLine.
  ///
  /// In fr, this message translates to:
  /// **'Date de soumission : {date}'**
  String declApprovalSubmissionDateLine(String date);

  /// No description provided for @declApprovalLabelMainActivityShort.
  ///
  /// In fr, this message translates to:
  /// **'Activité princ.'**
  String get declApprovalLabelMainActivityShort;

  /// No description provided for @declApprovalLabelSecondaryActivityShort.
  ///
  /// In fr, this message translates to:
  /// **'Activité second.'**
  String get declApprovalLabelSecondaryActivityShort;

  /// No description provided for @fieldFaxLabel.
  ///
  /// In fr, this message translates to:
  /// **'Fax'**
  String get fieldFaxLabel;

  /// No description provided for @declApprovalLabelTaxNumberShort.
  ///
  /// In fr, this message translates to:
  /// **'N° Contribuable'**
  String get declApprovalLabelTaxNumberShort;

  /// No description provided for @declApprovalLabelSocialCapital.
  ///
  /// In fr, this message translates to:
  /// **'Capital social'**
  String get declApprovalLabelSocialCapital;

  /// No description provided for @declApprovalLabelParentCompany.
  ///
  /// In fr, this message translates to:
  /// **'Entreprise mère'**
  String get declApprovalLabelParentCompany;

  /// No description provided for @declApprovalWorkforceCurrentYearTitle.
  ///
  /// In fr, this message translates to:
  /// **'Effectifs déclarés — Année en cours'**
  String get declApprovalWorkforceCurrentYearTitle;

  /// No description provided for @declApprovalWorkforcePreviousYearTitle.
  ///
  /// In fr, this message translates to:
  /// **'Effectifs — Année précédente'**
  String get declApprovalWorkforcePreviousYearTitle;

  /// No description provided for @declApprovalNominativeListLine.
  ///
  /// In fr, this message translates to:
  /// **'Liste nominative : {count} employé(s) saisi(s)'**
  String declApprovalNominativeListLine(int count);

  /// No description provided for @declApprovalNoMovementsMsg.
  ///
  /// In fr, this message translates to:
  /// **'Aucun mouvement enregistré.'**
  String get declApprovalNoMovementsMsg;

  /// No description provided for @movementPromotionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Avancement'**
  String get movementPromotionLabel;

  /// No description provided for @movementDeathLabel.
  ///
  /// In fr, this message translates to:
  /// **'Décès'**
  String get movementDeathLabel;

  /// No description provided for @colMovementHeader.
  ///
  /// In fr, this message translates to:
  /// **'Mouvement'**
  String get colMovementHeader;

  /// No description provided for @colCat13Header.
  ///
  /// In fr, this message translates to:
  /// **'Cat. 1–3'**
  String get colCat13Header;

  /// No description provided for @colCat46Header.
  ///
  /// In fr, this message translates to:
  /// **'Cat. 4–6'**
  String get colCat46Header;

  /// No description provided for @colCat79Header.
  ///
  /// In fr, this message translates to:
  /// **'Cat. 7–9'**
  String get colCat79Header;

  /// No description provided for @colCat1012Header.
  ///
  /// In fr, this message translates to:
  /// **'Cat. 10–12'**
  String get colCat1012Header;

  /// No description provided for @colNonDeclaredShortHeader.
  ///
  /// In fr, this message translates to:
  /// **'Non Décl.'**
  String get colNonDeclaredShortHeader;

  /// No description provided for @colTotalHeader.
  ///
  /// In fr, this message translates to:
  /// **'TOTAL'**
  String get colTotalHeader;

  /// No description provided for @declApprovalQualitativeUnavailableMsg.
  ///
  /// In fr, this message translates to:
  /// **'Informations qualitatives non disponibles.'**
  String get declApprovalQualitativeUnavailableMsg;

  /// No description provided for @yesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Oui'**
  String get yesLabel;

  /// No description provided for @noLabel.
  ///
  /// In fr, this message translates to:
  /// **'Non'**
  String get noLabel;

  /// No description provided for @qHasTrainingCenterShort.
  ///
  /// In fr, this message translates to:
  /// **'Centre de formation pour le personnel ?'**
  String get qHasTrainingCenterShort;

  /// No description provided for @qRecruitmentPlansNextShort.
  ///
  /// In fr, this message translates to:
  /// **'Prévoit des recrutements l\'année prochaine ?'**
  String get qRecruitmentPlansNextShort;

  /// No description provided for @qCamerounisationPlanShort.
  ///
  /// In fr, this message translates to:
  /// **'Dispose d\'un plan de camerounisation ?'**
  String get qCamerounisationPlanShort;

  /// No description provided for @qUsesTempAgenciesShort.
  ///
  /// In fr, this message translates to:
  /// **'Recours aux entreprises de travail temporaire ?'**
  String get qUsesTempAgenciesShort;

  /// No description provided for @qTempAgencyDetailsLabelShort.
  ///
  /// In fr, this message translates to:
  /// **'Détails ETT'**
  String get qTempAgencyDetailsLabelShort;

  /// No description provided for @declApprovalNoValidationStepsMsg.
  ///
  /// In fr, this message translates to:
  /// **'Aucune étape de validation enregistrée.'**
  String get declApprovalNoValidationStepsMsg;

  /// No description provided for @declApprovalDefaultStepType.
  ///
  /// In fr, this message translates to:
  /// **'Contrôle automatique'**
  String get declApprovalDefaultStepType;

  /// No description provided for @statusSubmittedShort.
  ///
  /// In fr, this message translates to:
  /// **'Soumis'**
  String get statusSubmittedShort;

  /// No description provided for @statusDivisionApprovedShort.
  ///
  /// In fr, this message translates to:
  /// **'Div. Approuvé'**
  String get statusDivisionApprovedShort;

  /// No description provided for @statusRegionApprovedShort.
  ///
  /// In fr, this message translates to:
  /// **'Rég. Approuvé'**
  String get statusRegionApprovedShort;

  /// No description provided for @declListApprovedToastMsg.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration approuvée'**
  String get declListApprovedToastMsg;

  /// No description provided for @declListSearchCompanyHint.
  ///
  /// In fr, this message translates to:
  /// **'Rechercher une entreprise...'**
  String get declListSearchCompanyHint;

  /// No description provided for @declListNoPendingDeclarationsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucune déclaration en attente'**
  String get declListNoPendingDeclarationsTitle;

  /// No description provided for @tryDifferentSearchCriteria.
  ///
  /// In fr, this message translates to:
  /// **'Essayez d\'autres critères de recherche'**
  String get tryDifferentSearchCriteria;

  /// No description provided for @declListSubmittedWillAppearHere.
  ///
  /// In fr, this message translates to:
  /// **'Les déclarations soumises apparaîtront ici'**
  String get declListSubmittedWillAppearHere;

  /// No description provided for @clearFiltersButton.
  ///
  /// In fr, this message translates to:
  /// **'Effacer les filtres'**
  String get clearFiltersButton;

  /// No description provided for @empListDraftLoadedFromSessionMsg.
  ///
  /// In fr, this message translates to:
  /// **'Brouillon chargé depuis la session'**
  String get empListDraftLoadedFromSessionMsg;

  /// No description provided for @empListDraftSavedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Brouillon sauvegardé ({count} employé(s))'**
  String empListDraftSavedMsg(int count);

  /// No description provided for @empListEnterFullNameError.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez entrer le nom complet'**
  String get empListEnterFullNameError;

  /// No description provided for @empListSelectGenderError.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner le sexe'**
  String get empListSelectGenderError;

  /// No description provided for @empListInvalidAgeError.
  ///
  /// In fr, this message translates to:
  /// **'Âge invalide (16-120 ans)'**
  String get empListInvalidAgeError;

  /// No description provided for @empListSelectNationalityError.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner la nationalité'**
  String get empListSelectNationalityError;

  /// No description provided for @empListEnterCountryError.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez entrer le pays'**
  String get empListEnterCountryError;

  /// No description provided for @empListSelectDiplomaError.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner le diplôme'**
  String get empListSelectDiplomaError;

  /// No description provided for @empListEnterFunctionError.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez entrer la fonction'**
  String get empListEnterFunctionError;

  /// No description provided for @empListInvalidSeniorityError.
  ///
  /// In fr, this message translates to:
  /// **'Ancienneté invalide (0-60 ans)'**
  String get empListInvalidSeniorityError;

  /// No description provided for @empListSelectCategoryError.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner la catégorie'**
  String get empListSelectCategoryError;

  /// No description provided for @empListInvalidSalaryError.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez entrer un salaire valide (> 0 FCFA)'**
  String get empListInvalidSalaryError;

  /// No description provided for @empListDeleteEmployeeTitle.
  ///
  /// In fr, this message translates to:
  /// **'Supprimer l\'employé ?'**
  String get empListDeleteEmployeeTitle;

  /// No description provided for @empListDeleteEmployeeConfirm.
  ///
  /// In fr, this message translates to:
  /// **'Voulez-vous retirer {name} de la liste ?'**
  String empListDeleteEmployeeConfirm(String name);

  /// No description provided for @empListEditEmployeeTitle.
  ///
  /// In fr, this message translates to:
  /// **'MODIFIER L\'EMPLOYÉ'**
  String get empListEditEmployeeTitle;

  /// No description provided for @empListAddEmployeeTitle.
  ///
  /// In fr, this message translates to:
  /// **'AJOUTER UN EMPLOYÉ'**
  String get empListAddEmployeeTitle;

  /// No description provided for @empListStepProgressLabel.
  ///
  /// In fr, this message translates to:
  /// **'Étape {step} sur 9'**
  String empListStepProgressLabel(int step);

  /// No description provided for @confirmButton.
  ///
  /// In fr, this message translates to:
  /// **'Confirmer'**
  String get confirmButton;

  /// No description provided for @empListFullNameStepLabel.
  ///
  /// In fr, this message translates to:
  /// **'Noms et Prénoms'**
  String get empListFullNameStepLabel;

  /// No description provided for @empListFullNameHintExample.
  ///
  /// In fr, this message translates to:
  /// **'Ex: TCHINDA Marc Arnold'**
  String get empListFullNameHintExample;

  /// No description provided for @empListGenderStepLabel.
  ///
  /// In fr, this message translates to:
  /// **'Sexe'**
  String get empListGenderStepLabel;

  /// No description provided for @genderMaleOption.
  ///
  /// In fr, this message translates to:
  /// **'Masculin (M)'**
  String get genderMaleOption;

  /// No description provided for @genderFemaleOption.
  ///
  /// In fr, this message translates to:
  /// **'Féminin (F)'**
  String get genderFemaleOption;

  /// No description provided for @empListAgeStepLabel.
  ///
  /// In fr, this message translates to:
  /// **'Âge'**
  String get empListAgeStepLabel;

  /// No description provided for @empListAgeHintExample.
  ///
  /// In fr, this message translates to:
  /// **'Ex: 32'**
  String get empListAgeHintExample;

  /// No description provided for @yearsUnitSuffix.
  ///
  /// In fr, this message translates to:
  /// **'ans'**
  String get yearsUnitSuffix;

  /// No description provided for @empListNationalityStepLabel.
  ///
  /// In fr, this message translates to:
  /// **'Nationalité'**
  String get empListNationalityStepLabel;

  /// No description provided for @nationalityCameroonianOption.
  ///
  /// In fr, this message translates to:
  /// **'Camerounais'**
  String get nationalityCameroonianOption;

  /// No description provided for @nationalityForeignOption.
  ///
  /// In fr, this message translates to:
  /// **'Étranger'**
  String get nationalityForeignOption;

  /// No description provided for @empListSpecifyCountryLabel.
  ///
  /// In fr, this message translates to:
  /// **'Préciser le pays'**
  String get empListSpecifyCountryLabel;

  /// No description provided for @empListCountryHintExample.
  ///
  /// In fr, this message translates to:
  /// **'Ex: France, Nigeria, Chine...'**
  String get empListCountryHintExample;

  /// No description provided for @empListDiplomaStepLabel.
  ///
  /// In fr, this message translates to:
  /// **'Diplôme le plus élevé'**
  String get empListDiplomaStepLabel;

  /// No description provided for @empListSelectDiplomaHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez un diplôme'**
  String get empListSelectDiplomaHint;

  /// No description provided for @diplomaCepe.
  ///
  /// In fr, this message translates to:
  /// **'CEPE'**
  String get diplomaCepe;

  /// No description provided for @diplomaBepc.
  ///
  /// In fr, this message translates to:
  /// **'BEPC'**
  String get diplomaBepc;

  /// No description provided for @diplomaCap.
  ///
  /// In fr, this message translates to:
  /// **'CAP'**
  String get diplomaCap;

  /// No description provided for @diplomaBac.
  ///
  /// In fr, this message translates to:
  /// **'BAC'**
  String get diplomaBac;

  /// No description provided for @diplomaBts.
  ///
  /// In fr, this message translates to:
  /// **'BTS'**
  String get diplomaBts;

  /// No description provided for @diplomaLicence.
  ///
  /// In fr, this message translates to:
  /// **'Licence'**
  String get diplomaLicence;

  /// No description provided for @diplomaMaster.
  ///
  /// In fr, this message translates to:
  /// **'Master'**
  String get diplomaMaster;

  /// No description provided for @diplomaDoctorat.
  ///
  /// In fr, this message translates to:
  /// **'Doctorat'**
  String get diplomaDoctorat;

  /// No description provided for @empListFunctionStepLabel.
  ///
  /// In fr, this message translates to:
  /// **'Fonction / Poste occupé'**
  String get empListFunctionStepLabel;

  /// No description provided for @empListFunctionHintExample.
  ///
  /// In fr, this message translates to:
  /// **'Ex: Comptable, Ingénieur, Assistant...'**
  String get empListFunctionHintExample;

  /// No description provided for @empListSeniorityStepLabel.
  ///
  /// In fr, this message translates to:
  /// **'Ancienneté dans l\'entreprise'**
  String get empListSeniorityStepLabel;

  /// No description provided for @empListSeniorityHintExample.
  ///
  /// In fr, this message translates to:
  /// **'Ex: 5'**
  String get empListSeniorityHintExample;

  /// No description provided for @empListCategoryStepLabel.
  ///
  /// In fr, this message translates to:
  /// **'Catégorie socioprofessionnelle'**
  String get empListCategoryStepLabel;

  /// No description provided for @empListSelectCategoryHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez la catégorie (1-12)'**
  String get empListSelectCategoryHint;

  /// No description provided for @nonDeclaredLabel.
  ///
  /// In fr, this message translates to:
  /// **'Non déclaré'**
  String get nonDeclaredLabel;

  /// No description provided for @categoryNumberLabel.
  ///
  /// In fr, this message translates to:
  /// **'Catégorie {number}'**
  String categoryNumberLabel(String number);

  /// No description provided for @empListCategoryScaleHelper.
  ///
  /// In fr, this message translates to:
  /// **'Selon la grille officielle DSMO (1 = agent d\'exécution, 12 = cadre supérieur)'**
  String get empListCategoryScaleHelper;

  /// No description provided for @empListSalaryStepLabel.
  ///
  /// In fr, this message translates to:
  /// **'Salaire mensuel (FCFA) *'**
  String get empListSalaryStepLabel;

  /// No description provided for @empListSalaryHintExample.
  ///
  /// In fr, this message translates to:
  /// **'Ex: 250000'**
  String get empListSalaryHintExample;

  /// No description provided for @fcfaCurrencySuffix.
  ///
  /// In fr, this message translates to:
  /// **'FCFA'**
  String get fcfaCurrencySuffix;

  /// No description provided for @mandatoryHelperText.
  ///
  /// In fr, this message translates to:
  /// **'Obligatoire'**
  String get mandatoryHelperText;

  /// No description provided for @empListImportSuccessMsg.
  ///
  /// In fr, this message translates to:
  /// **'{count} employé(s) importé(s) avec succès'**
  String empListImportSuccessMsg(int count);

  /// No description provided for @empListImportPartialMsg.
  ///
  /// In fr, this message translates to:
  /// **'{count} importé(s), {errorCount} ligne(s) ignorée(s)'**
  String empListImportPartialMsg(int count, int errorCount);

  /// No description provided for @excelColCountry.
  ///
  /// In fr, this message translates to:
  /// **'Pays'**
  String get excelColCountry;

  /// No description provided for @excelColDiploma.
  ///
  /// In fr, this message translates to:
  /// **'Diplôme'**
  String get excelColDiploma;

  /// No description provided for @excelColSeniorityYears.
  ///
  /// In fr, this message translates to:
  /// **'Ancienneté (ans)'**
  String get excelColSeniorityYears;

  /// No description provided for @excelColSalary.
  ///
  /// In fr, this message translates to:
  /// **'Salaire (FCFA)'**
  String get excelColSalary;

  /// No description provided for @empListSaveFileDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Enregistrer la liste des employés'**
  String get empListSaveFileDialogTitle;

  /// No description provided for @exportSuccessMsg.
  ///
  /// In fr, this message translates to:
  /// **'Export réussi !'**
  String get exportSuccessMsg;

  /// No description provided for @movementsPromotionsPlural.
  ///
  /// In fr, this message translates to:
  /// **'Promotions'**
  String get movementsPromotionsPlural;

  /// No description provided for @empListPartAPreviewPageHeader.
  ///
  /// In fr, this message translates to:
  /// **'Aperçu PARTIE A — Page {page}/{total}'**
  String empListPartAPreviewPageHeader(int page, int total);

  /// No description provided for @empListSectionEstablishmentIdentity.
  ///
  /// In fr, this message translates to:
  /// **'Identité de l\'établissement'**
  String get empListSectionEstablishmentIdentity;

  /// No description provided for @fieldCompanyNameFullLabel.
  ///
  /// In fr, this message translates to:
  /// **'Nom / Raison sociale'**
  String get fieldCompanyNameFullLabel;

  /// No description provided for @empListTaxNumberNiuLabel.
  ///
  /// In fr, this message translates to:
  /// **'N° contribuable (NIU)'**
  String get empListTaxNumberNiuLabel;

  /// No description provided for @empListWorkforceCurrentYearSection.
  ///
  /// In fr, this message translates to:
  /// **'Effectifs — Année en cours'**
  String get empListWorkforceCurrentYearSection;

  /// No description provided for @empListDeclaredTotalLabel.
  ///
  /// In fr, this message translates to:
  /// **'Total déclaré'**
  String get empListDeclaredTotalLabel;

  /// No description provided for @empListMovementDetailByCategory.
  ///
  /// In fr, this message translates to:
  /// **'Détail des mouvements par catégorie'**
  String get empListMovementDetailByCategory;

  /// No description provided for @catRange13Label.
  ///
  /// In fr, this message translates to:
  /// **'Cat. 1-3'**
  String get catRange13Label;

  /// No description provided for @catRange46Label.
  ///
  /// In fr, this message translates to:
  /// **'Cat. 4-6'**
  String get catRange46Label;

  /// No description provided for @catRange79Label.
  ///
  /// In fr, this message translates to:
  /// **'Cat. 7-9'**
  String get catRange79Label;

  /// No description provided for @catRange1012Label.
  ///
  /// In fr, this message translates to:
  /// **'Cat. 10-12'**
  String get catRange1012Label;

  /// No description provided for @nonDeclaredCategoryLabel.
  ///
  /// In fr, this message translates to:
  /// **'Non Déclaré'**
  String get nonDeclaredCategoryLabel;

  /// No description provided for @empListQualitativeInfoSection.
  ///
  /// In fr, this message translates to:
  /// **'Informations qualitatives'**
  String get empListQualitativeInfoSection;

  /// No description provided for @empListTrainingCenterLabelShort.
  ///
  /// In fr, this message translates to:
  /// **'Centre de formation'**
  String get empListTrainingCenterLabelShort;

  /// No description provided for @empListRecruitmentPlansNextLabel.
  ///
  /// In fr, this message translates to:
  /// **'Plans de recrutement (année suivante)'**
  String get empListRecruitmentPlansNextLabel;

  /// No description provided for @empListCamerounisationPlanLabel.
  ///
  /// In fr, this message translates to:
  /// **'Plan de camerounisation'**
  String get empListCamerounisationPlanLabel;

  /// No description provided for @empListUsesTempAgenciesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Recours aux agences intérimaires'**
  String get empListUsesTempAgenciesLabel;

  /// No description provided for @empListTempAgencyDetailsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Détails agence intérimaire'**
  String get empListTempAgencyDetailsLabel;

  /// No description provided for @empListConfirmAndSubmitButton.
  ///
  /// In fr, this message translates to:
  /// **'Confirmer et soumettre'**
  String get empListConfirmAndSubmitButton;

  /// No description provided for @empListMismatchTotalLine.
  ///
  /// In fr, this message translates to:
  /// **'• Total employés : {actual} saisi(s) vs {declared} déclaré(s)'**
  String empListMismatchTotalLine(int actual, int declared);

  /// No description provided for @empListMismatchMenLine.
  ///
  /// In fr, this message translates to:
  /// **'• Hommes : {actual} saisi(s) vs {declared} déclaré(s)'**
  String empListMismatchMenLine(int actual, int declared);

  /// No description provided for @empListMismatchWomenLine.
  ///
  /// In fr, this message translates to:
  /// **'• Femmes : {actual} saisie(s) vs {declared} déclarée(s)'**
  String empListMismatchWomenLine(int actual, int declared);

  /// No description provided for @empListWorkforceInconsistencyTitle.
  ///
  /// In fr, this message translates to:
  /// **'⚠️ Incohérence des effectifs'**
  String get empListWorkforceInconsistencyTitle;

  /// No description provided for @empListWorkforceMismatchIntro.
  ///
  /// In fr, this message translates to:
  /// **'Le nombre d\'employés saisi ne correspond pas aux effectifs déclarés dans la PARTIE A :\n'**
  String get empListWorkforceMismatchIntro;

  /// No description provided for @empListContinueSubmissionAnywayQuestion.
  ///
  /// In fr, this message translates to:
  /// **'Voulez-vous continuer la soumission quand même ?'**
  String get empListContinueSubmissionAnywayQuestion;

  /// No description provided for @empListOfficialFormExactMatchNote.
  ///
  /// In fr, this message translates to:
  /// **'Note : Le formulaire officiel exige une correspondance parfaite.'**
  String get empListOfficialFormExactMatchNote;

  /// No description provided for @empListContinueDespiteErrorButton.
  ///
  /// In fr, this message translates to:
  /// **'Continuer malgré l\'erreur'**
  String get empListContinueDespiteErrorButton;

  /// No description provided for @empListAddAtLeastOneEmployeeError.
  ///
  /// In fr, this message translates to:
  /// **'Ajoutez au moins un employé avant de soumettre'**
  String get empListAddAtLeastOneEmployeeError;

  /// No description provided for @empListInvalidEmployeeDataError.
  ///
  /// In fr, this message translates to:
  /// **'Certains employés ont des données invalides (nom vide ou salaire ≤ 0)'**
  String get empListInvalidEmployeeDataError;

  /// No description provided for @empListPreviewGenerationError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de générer l\'aperçu : {error}'**
  String empListPreviewGenerationError(String error);

  /// No description provided for @empListSubmissionHttpError.
  ///
  /// In fr, this message translates to:
  /// **'Erreur lors de la soumission. Code HTTP : {code}\n\n{data}'**
  String empListSubmissionHttpError(String code, String data);

  /// No description provided for @empListQueuedDeclarationLabel.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration DSMO {year} — {company}'**
  String empListQueuedDeclarationLabel(int year, String company);

  /// No description provided for @empListDefaultDeadlineFallback.
  ///
  /// In fr, this message translates to:
  /// **'31 Janvier {year}'**
  String empListDefaultDeadlineFallback(int year);

  /// No description provided for @empListQueuedOfflineFullMsg.
  ///
  /// In fr, this message translates to:
  /// **'Votre déclaration a été enregistrée sur cet appareil et sera envoyée automatiquement dès le retour de la connexion. Vous pouvez fermer cet écran sans risque.'**
  String get empListQueuedOfflineFullMsg;

  /// No description provided for @okButton.
  ///
  /// In fr, this message translates to:
  /// **'OK'**
  String get okButton;

  /// No description provided for @empListDeclarationSavedTitle.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration enregistrée !'**
  String get empListDeclarationSavedTitle;

  /// No description provided for @empListTrackingNumberLine.
  ///
  /// In fr, this message translates to:
  /// **'N° Suivi : {trackingNumber}'**
  String empListTrackingNumberLine(String trackingNumber);

  /// No description provided for @empListThreePdfCopiesAvailable.
  ///
  /// In fr, this message translates to:
  /// **'3 exemplaires PDF disponibles :'**
  String get empListThreePdfCopiesAvailable;

  /// No description provided for @printDownloadTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Imprimer / Télécharger'**
  String get printDownloadTooltip;

  /// No description provided for @empListMandatoryProcedureTitle.
  ///
  /// In fr, this message translates to:
  /// **'PROCÉDURE OBLIGATOIRE :'**
  String get empListMandatoryProcedureTitle;

  /// No description provided for @empListProcStepPrintCopies.
  ///
  /// In fr, this message translates to:
  /// **'• Imprimez les 3 exemplaires'**
  String get empListProcStepPrintCopies;

  /// No description provided for @empListProcStepSignCopies.
  ///
  /// In fr, this message translates to:
  /// **'• Signez chaque exemplaire'**
  String get empListProcStepSignCopies;

  /// No description provided for @empListProcStepAddCompanyStamp.
  ///
  /// In fr, this message translates to:
  /// **'• Ajoutez le cachet de l\'entreprise'**
  String get empListProcStepAddCompanyStamp;

  /// No description provided for @empListProcStepSendByRegisteredMail.
  ///
  /// In fr, this message translates to:
  /// **'• Envoyez par PLI RECOMMANDÉ avant le {deadline}'**
  String empListProcStepSendByRegisteredMail(String deadline);

  /// No description provided for @empListProcStepEmploymentOffice.
  ///
  /// In fr, this message translates to:
  /// **'• À la circonscription de l\'emploi'**
  String get empListProcStepEmploymentOffice;

  /// No description provided for @empListLawComplianceNoteFull.
  ///
  /// In fr, this message translates to:
  /// **'Conformément à la loi No 91/023 du 16 décembre 1991'**
  String get empListLawComplianceNoteFull;

  /// No description provided for @successTitle.
  ///
  /// In fr, this message translates to:
  /// **'Succès'**
  String get successTitle;

  /// No description provided for @empListSimpleSuccessMsg.
  ///
  /// In fr, this message translates to:
  /// **'Déclaration soumise avec succès !\n\nLes PDF seront disponibles dans votre espace employeur.'**
  String get empListSimpleSuccessMsg;

  /// No description provided for @empListSubmissionFailedTitle.
  ///
  /// In fr, this message translates to:
  /// **'Échec de la soumission'**
  String get empListSubmissionFailedTitle;

  /// No description provided for @empListAppBarTitle.
  ///
  /// In fr, this message translates to:
  /// **'DÉCLARATION SUR LA SITUATION DE LA MAIN D\'ŒUVRE'**
  String get empListAppBarTitle;

  /// No description provided for @exportExcelTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Exporter Excel'**
  String get exportExcelTooltip;

  /// No description provided for @importExcelTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Importer Excel'**
  String get importExcelTooltip;

  /// No description provided for @previewPartATooltip.
  ///
  /// In fr, this message translates to:
  /// **'Aperçu PARTIE A'**
  String get previewPartATooltip;

  /// No description provided for @previewPdfTooltipLong.
  ///
  /// In fr, this message translates to:
  /// **'Aperçu du PDF'**
  String get previewPdfTooltipLong;

  /// No description provided for @empListRegisteredEmployeesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Employés enregistrés'**
  String get empListRegisteredEmployeesLabel;

  /// No description provided for @empListInconsistencyBadge.
  ///
  /// In fr, this message translates to:
  /// **'INCOHÉRENCE'**
  String get empListInconsistencyBadge;

  /// No description provided for @empListEmptyStateMsg.
  ///
  /// In fr, this message translates to:
  /// **'Aucun employé enregistré.\n\nAjoutez manuellement via le bouton +\nou importez un fichier Excel.'**
  String get empListEmptyStateMsg;

  /// No description provided for @empListColNumero.
  ///
  /// In fr, this message translates to:
  /// **'N°'**
  String get empListColNumero;

  /// No description provided for @empListColSeniority.
  ///
  /// In fr, this message translates to:
  /// **'Ancienneté'**
  String get empListColSeniority;

  /// No description provided for @notDeclaredAbbrev.
  ///
  /// In fr, this message translates to:
  /// **'N/D'**
  String get notDeclaredAbbrev;

  /// No description provided for @ageYearsValue.
  ///
  /// In fr, this message translates to:
  /// **'{age} ans'**
  String ageYearsValue(int age);

  /// No description provided for @seniorityYearsValue.
  ///
  /// In fr, this message translates to:
  /// **'{years, plural, one{{years} an} other{{years} ans}}'**
  String seniorityYearsValue(int years);

  /// No description provided for @empListAddEmployeeFabLabel.
  ///
  /// In fr, this message translates to:
  /// **'Ajouter employé'**
  String get empListAddEmployeeFabLabel;

  /// No description provided for @sendNotifStatusDivisionApproved.
  ///
  /// In fr, this message translates to:
  /// **'Approuvé (Division)'**
  String get sendNotifStatusDivisionApproved;

  /// No description provided for @sendNotifStatusRegionApproved.
  ///
  /// In fr, this message translates to:
  /// **'Approuvé (Région)'**
  String get sendNotifStatusRegionApproved;

  /// No description provided for @sendNotifStatusFinalApproved.
  ///
  /// In fr, this message translates to:
  /// **'Approuvé (Final)'**
  String get sendNotifStatusFinalApproved;

  /// No description provided for @sendNotifSuccessMsg.
  ///
  /// In fr, this message translates to:
  /// **'Notification envoyée à {count} entreprises'**
  String sendNotifSuccessMsg(int count);

  /// No description provided for @sendNotifErrorMsg.
  ///
  /// In fr, this message translates to:
  /// **'Erreur : {msg}'**
  String sendNotifErrorMsg(String msg);

  /// No description provided for @sendNotifHeaderTitle.
  ///
  /// In fr, this message translates to:
  /// **'Envoyer une notification'**
  String get sendNotifHeaderTitle;

  /// No description provided for @sendNotifHeaderSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Ciblage multi-critères des entreprises'**
  String get sendNotifHeaderSubtitle;

  /// No description provided for @sendNotifEstimatedRecipientsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Destinataires estimés'**
  String get sendNotifEstimatedRecipientsLabel;

  /// No description provided for @sendNotifRecipientCountLine.
  ///
  /// In fr, this message translates to:
  /// **'{count} entreprises'**
  String sendNotifRecipientCountLine(int count);

  /// No description provided for @sendNotifActiveBadge.
  ///
  /// In fr, this message translates to:
  /// **'Actives'**
  String get sendNotifActiveBadge;

  /// No description provided for @sendNotifRecipientFiltersSection.
  ///
  /// In fr, this message translates to:
  /// **'Filtres des destinataires'**
  String get sendNotifRecipientFiltersSection;

  /// No description provided for @sendNotifDivisionDepartmentLabel.
  ///
  /// In fr, this message translates to:
  /// **'Division / Département'**
  String get sendNotifDivisionDepartmentLabel;

  /// No description provided for @sendNotifAllDivisionsHint.
  ///
  /// In fr, this message translates to:
  /// **'Toutes les divisions'**
  String get sendNotifAllDivisionsHint;

  /// No description provided for @sendNotifSubmissionStatusLabel.
  ///
  /// In fr, this message translates to:
  /// **'Statut de soumission'**
  String get sendNotifSubmissionStatusLabel;

  /// No description provided for @sendNotifAllStatusesHint.
  ///
  /// In fr, this message translates to:
  /// **'Tous les statuts'**
  String get sendNotifAllStatusesHint;

  /// No description provided for @sendNotifMessageContentSection.
  ///
  /// In fr, this message translates to:
  /// **'Contenu du message'**
  String get sendNotifMessageContentSection;

  /// No description provided for @sendNotifSubjectLabel.
  ///
  /// In fr, this message translates to:
  /// **'Sujet'**
  String get sendNotifSubjectLabel;

  /// No description provided for @sendNotifSubjectHintExample.
  ///
  /// In fr, this message translates to:
  /// **'Ex: Rappel — Échéance DSM-O 2025'**
  String get sendNotifSubjectHintExample;

  /// No description provided for @sendNotifSubjectRequiredError.
  ///
  /// In fr, this message translates to:
  /// **'Le sujet est requis'**
  String get sendNotifSubjectRequiredError;

  /// No description provided for @sendNotifMessageFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Message'**
  String get sendNotifMessageFieldLabel;

  /// No description provided for @sendNotifMessageHintExample.
  ///
  /// In fr, this message translates to:
  /// **'Rédigez votre message ici...'**
  String get sendNotifMessageHintExample;

  /// No description provided for @sendNotifMessageRequiredError.
  ///
  /// In fr, this message translates to:
  /// **'Le message est requis'**
  String get sendNotifMessageRequiredError;

  /// No description provided for @sendNotifSendButton.
  ///
  /// In fr, this message translates to:
  /// **'Envoyer la notification'**
  String get sendNotifSendButton;

  /// No description provided for @sendNotifClearFormButton.
  ///
  /// In fr, this message translates to:
  /// **'Effacer le formulaire'**
  String get sendNotifClearFormButton;

  /// No description provided for @homeTabAnalyticsDsmo.
  ///
  /// In fr, this message translates to:
  /// **'Analytique DSMO'**
  String get homeTabAnalyticsDsmo;

  /// No description provided for @homeTabReports.
  ///
  /// In fr, this message translates to:
  /// **'Rapports'**
  String get homeTabReports;

  /// No description provided for @homeTabCommunication.
  ///
  /// In fr, this message translates to:
  /// **'Communication'**
  String get homeTabCommunication;

  /// No description provided for @annuaireLabel.
  ///
  /// In fr, this message translates to:
  /// **'Annuaire'**
  String get annuaireLabel;

  /// No description provided for @dashboardFallbackTitle.
  ///
  /// In fr, this message translates to:
  /// **'Tableau de bord'**
  String get dashboardFallbackTitle;

  /// No description provided for @roleLabelDivisional.
  ///
  /// In fr, this message translates to:
  /// **'Division du Travail'**
  String get roleLabelDivisional;

  /// No description provided for @roleLabelRegional.
  ///
  /// In fr, this message translates to:
  /// **'Delegation Regionale'**
  String get roleLabelRegional;

  /// No description provided for @roleLabelCentral.
  ///
  /// In fr, this message translates to:
  /// **'Direction Nationale'**
  String get roleLabelCentral;

  /// No description provided for @roleLabelSuperAdmin.
  ///
  /// In fr, this message translates to:
  /// **'Super Admin · DSMO + ONEFOP'**
  String get roleLabelSuperAdmin;

  /// No description provided for @roleLabelSuperAdminDsmo.
  ///
  /// In fr, this message translates to:
  /// **'Admin · Regulation MO'**
  String get roleLabelSuperAdminDsmo;

  /// No description provided for @roleLabelSuperAdminOnefop.
  ///
  /// In fr, this message translates to:
  /// **'Admin · ONEFOP'**
  String get roleLabelSuperAdminOnefop;

  /// No description provided for @filterByZoneTitle.
  ///
  /// In fr, this message translates to:
  /// **'Filtrer par zone'**
  String get filterByZoneTitle;

  /// No description provided for @clearButton.
  ///
  /// In fr, this message translates to:
  /// **'Effacer'**
  String get clearButton;

  /// No description provided for @departmentDivisionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Département / Division'**
  String get departmentDivisionLabel;

  /// No description provided for @allDepartmentsHint.
  ///
  /// In fr, this message translates to:
  /// **'Tous les départements'**
  String get allDepartmentsHint;

  /// No description provided for @applyFilterButton.
  ///
  /// In fr, this message translates to:
  /// **'Appliquer le filtre'**
  String get applyFilterButton;

  /// No description provided for @approvedHistoricalStatusOption.
  ///
  /// In fr, this message translates to:
  /// **'Approuvé (historique)'**
  String get approvedHistoricalStatusOption;

  /// No description provided for @logoutDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Déconnexion'**
  String get logoutDialogTitle;

  /// No description provided for @logoutConfirmBody.
  ///
  /// In fr, this message translates to:
  /// **'Voulez-vous vraiment vous déconnecter ?'**
  String get logoutConfirmBody;

  /// No description provided for @logoutButton.
  ///
  /// In fr, this message translates to:
  /// **'Déconnecter'**
  String get logoutButton;

  /// No description provided for @drawerSectionConsultation.
  ///
  /// In fr, this message translates to:
  /// **'Consultation'**
  String get drawerSectionConsultation;

  /// No description provided for @drawerViewQuestionnairesSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Consulter les questionnaires'**
  String get drawerViewQuestionnairesSubtitle;

  /// No description provided for @drawerSectionAdminDsmo.
  ///
  /// In fr, this message translates to:
  /// **'Administration DSMO'**
  String get drawerSectionAdminDsmo;

  /// No description provided for @drawerDeclarationsDsmoLabel.
  ///
  /// In fr, this message translates to:
  /// **'Déclarations DSMO'**
  String get drawerDeclarationsDsmoLabel;

  /// No description provided for @drawerViewDeclarationsSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Consulter les déclarations'**
  String get drawerViewDeclarationsSubtitle;

  /// No description provided for @drawerAnnuaireSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Utilisateurs et entreprises'**
  String get drawerAnnuaireSubtitle;

  /// No description provided for @drawerResetPasswordSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Après vérification d\'identité'**
  String get drawerResetPasswordSubtitle;

  /// No description provided for @drawerSectionAdminOnefop.
  ///
  /// In fr, this message translates to:
  /// **'Administration ONEFOP'**
  String get drawerSectionAdminOnefop;

  /// No description provided for @drawerSectionSaisieOnefop.
  ///
  /// In fr, this message translates to:
  /// **'Saisie ONEFOP'**
  String get drawerSectionSaisieOnefop;

  /// No description provided for @drawerNewQuestionnaireLabel.
  ///
  /// In fr, this message translates to:
  /// **'Nouveau questionnaire'**
  String get drawerNewQuestionnaireLabel;

  /// No description provided for @drawerAssistedEntrySubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Saisie assistée'**
  String get drawerAssistedEntrySubtitle;

  /// No description provided for @navCollapseTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Réduire la navigation'**
  String get navCollapseTooltip;

  /// No description provided for @navExpandTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Développer la navigation'**
  String get navExpandTooltip;

  /// No description provided for @filterByRegionTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Filtrer par région'**
  String get filterByRegionTooltip;

  /// No description provided for @connectionErrorTitle.
  ///
  /// In fr, this message translates to:
  /// **'Erreur de connexion'**
  String get connectionErrorTitle;

  /// No description provided for @navOnefopMinefopTag.
  ///
  /// In fr, this message translates to:
  /// **'ONEFOP · MINEFOP'**
  String get navOnefopMinefopTag;

  /// No description provided for @onefopAutoGuidedTitle.
  ///
  /// In fr, this message translates to:
  /// **'Questionnaire auto-guidé'**
  String get onefopAutoGuidedTitle;

  /// No description provided for @onefopContinueQuestionnaireButton.
  ///
  /// In fr, this message translates to:
  /// **'Continuer le questionnaire'**
  String get onefopContinueQuestionnaireButton;

  /// No description provided for @dearDirectorGreeting.
  ///
  /// In fr, this message translates to:
  /// **'Cher Directeur'**
  String get dearDirectorGreeting;

  /// No description provided for @yourProgressHeading.
  ///
  /// In fr, this message translates to:
  /// **'Votre progression'**
  String get yourProgressHeading;

  /// No description provided for @sectionsCompletedCount.
  ///
  /// In fr, this message translates to:
  /// **'{completed}/{total} sections complétées'**
  String sectionsCompletedCount(int completed, int total);

  /// No description provided for @fieldsRemainingPlaceholder.
  ///
  /// In fr, this message translates to:
  /// **'17/32 champs requis restants'**
  String get fieldsRemainingPlaceholder;

  /// No description provided for @completedSlashLabel.
  ///
  /// In fr, this message translates to:
  /// **'Complété'**
  String get completedSlashLabel;

  /// No description provided for @minefopOnefopBrandTag.
  ///
  /// In fr, this message translates to:
  /// **'MINEFOP / ONEFOP'**
  String get minefopOnefopBrandTag;

  /// No description provided for @submissionIdEntityTypeLine.
  ///
  /// In fr, this message translates to:
  /// **'ID {establishmentId} · {entityTypeLabel}'**
  String submissionIdEntityTypeLine(
      String establishmentId, String entityTypeLabel);

  /// No description provided for @mastheadCnpsLabel.
  ///
  /// In fr, this message translates to:
  /// **'CNPS'**
  String get mastheadCnpsLabel;

  /// No description provided for @vtWizardSectionNumberLabel.
  ///
  /// In fr, this message translates to:
  /// **'SECTION {index}'**
  String vtWizardSectionNumberLabel(int index);

  /// No description provided for @vtWizardFieldsFilledCount.
  ///
  /// In fr, this message translates to:
  /// **'{filled}/{total} champs'**
  String vtWizardFieldsFilledCount(int filled, int total);

  /// No description provided for @reportApprovalApprovedSnackbar.
  ///
  /// In fr, this message translates to:
  /// **'Rapport approuvé'**
  String get reportApprovalApprovedSnackbar;

  /// No description provided for @reportApprovalRejectedSnackbar.
  ///
  /// In fr, this message translates to:
  /// **'Rapport rejeté'**
  String get reportApprovalRejectedSnackbar;

  /// No description provided for @reportRejectionReasonDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Motif du rejet'**
  String get reportRejectionReasonDialogTitle;

  /// No description provided for @reportRejectionReasonHint.
  ///
  /// In fr, this message translates to:
  /// **'Expliquez pourquoi...'**
  String get reportRejectionReasonHint;

  /// No description provided for @reportNoPendingApprovalsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucune approbation en attente'**
  String get reportNoPendingApprovalsTitle;

  /// No description provided for @reportAllProcessedSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Tous les rapports ont été traités'**
  String get reportAllProcessedSubtitle;

  /// No description provided for @reportAuditEmptyTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucune activité enregistrée'**
  String get reportAuditEmptyTitle;

  /// No description provided for @reportAuditEmptySubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Les actions des utilisateurs apparaîtront ici'**
  String get reportAuditEmptySubtitle;

  /// No description provided for @reportAuditSystemActionFallback.
  ///
  /// In fr, this message translates to:
  /// **'Action système'**
  String get reportAuditSystemActionFallback;

  /// No description provided for @reportRegionLittoral.
  ///
  /// In fr, this message translates to:
  /// **'Littoral'**
  String get reportRegionLittoral;

  /// No description provided for @reportRegionCentre.
  ///
  /// In fr, this message translates to:
  /// **'Centre'**
  String get reportRegionCentre;

  /// No description provided for @reportRegionNord.
  ///
  /// In fr, this message translates to:
  /// **'Nord'**
  String get reportRegionNord;

  /// No description provided for @reportRegionExtremeNord.
  ///
  /// In fr, this message translates to:
  /// **'Extrême-Nord'**
  String get reportRegionExtremeNord;

  /// No description provided for @reportRegionOuest.
  ///
  /// In fr, this message translates to:
  /// **'Ouest'**
  String get reportRegionOuest;

  /// No description provided for @reportRegionSud.
  ///
  /// In fr, this message translates to:
  /// **'Sud'**
  String get reportRegionSud;

  /// No description provided for @reportRegionEst.
  ///
  /// In fr, this message translates to:
  /// **'Est'**
  String get reportRegionEst;

  /// No description provided for @reportRegionAdamaoua.
  ///
  /// In fr, this message translates to:
  /// **'Adamaoua'**
  String get reportRegionAdamaoua;

  /// No description provided for @reportRegionNordOuest.
  ///
  /// In fr, this message translates to:
  /// **'Nord-Ouest'**
  String get reportRegionNordOuest;

  /// No description provided for @reportRegionSudOuest.
  ///
  /// In fr, this message translates to:
  /// **'Sud-Ouest'**
  String get reportRegionSudOuest;

  /// No description provided for @reportBatchSelectRegionError.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez au moins une région'**
  String get reportBatchSelectRegionError;

  /// No description provided for @reportBatchGenerationStartedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Génération batch lancée'**
  String get reportBatchGenerationStartedMsg;

  /// No description provided for @reportBatchJobRetryingMsg.
  ///
  /// In fr, this message translates to:
  /// **'Reprise en cours'**
  String get reportBatchJobRetryingMsg;

  /// No description provided for @reportBatchByRegionTitle.
  ///
  /// In fr, this message translates to:
  /// **'Génération batch par région'**
  String get reportBatchByRegionTitle;

  /// No description provided for @reportBatchLaunchButton.
  ///
  /// In fr, this message translates to:
  /// **'Lancer la génération batch'**
  String get reportBatchLaunchButton;

  /// No description provided for @reportBatchRecentJobsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Tâches récentes'**
  String get reportBatchRecentJobsTitle;

  /// No description provided for @reportBatchEmptyTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucune tâche batch'**
  String get reportBatchEmptyTitle;

  /// No description provided for @reportBatchJobReportsCount.
  ///
  /// In fr, this message translates to:
  /// **'{completed}/{total} rapports'**
  String reportBatchJobReportsCount(int completed, int total);

  /// No description provided for @reportSelectTwoReportsError.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez deux rapports à comparer'**
  String get reportSelectTwoReportsError;

  /// No description provided for @reportMetricFeminizationLabel.
  ///
  /// In fr, this message translates to:
  /// **'Féminisation'**
  String get reportMetricFeminizationLabel;

  /// No description provided for @reportSelectReportHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionner un rapport'**
  String get reportSelectReportHint;

  /// No description provided for @reportBaselineReportLabel.
  ///
  /// In fr, this message translates to:
  /// **'Rapport de référence'**
  String get reportBaselineReportLabel;

  /// No description provided for @reportTargetReportLabel.
  ///
  /// In fr, this message translates to:
  /// **'Rapport à comparer'**
  String get reportTargetReportLabel;

  /// No description provided for @reportCompareButton.
  ///
  /// In fr, this message translates to:
  /// **'Comparer'**
  String get reportCompareButton;

  /// No description provided for @reportComparisonResultsTitle.
  ///
  /// In fr, this message translates to:
  /// **'Résultats de la comparaison'**
  String get reportComparisonResultsTitle;

  /// No description provided for @reportBaselineColumnLabel.
  ///
  /// In fr, this message translates to:
  /// **'Référence'**
  String get reportBaselineColumnLabel;

  /// No description provided for @reportComparedColumnLabel.
  ///
  /// In fr, this message translates to:
  /// **'Comparé'**
  String get reportComparedColumnLabel;

  /// No description provided for @reportSelectOneSectionError.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez au moins une section'**
  String get reportSelectOneSectionError;

  /// No description provided for @reportEndDateAfterStartError.
  ///
  /// In fr, this message translates to:
  /// **'La date de fin doit être postérieure à la date de début'**
  String get reportEndDateAfterStartError;

  /// No description provided for @reportPeriodMax36MonthsError.
  ///
  /// In fr, this message translates to:
  /// **'La période ne peut pas dépasser 36 mois'**
  String get reportPeriodMax36MonthsError;

  /// No description provided for @reportGeneratedSuccessMsg.
  ///
  /// In fr, this message translates to:
  /// **'Rapport généré avec succès'**
  String get reportGeneratedSuccessMsg;

  /// No description provided for @reportSectionLocationLabel.
  ///
  /// In fr, this message translates to:
  /// **'LOCALISATION'**
  String get reportSectionLocationLabel;

  /// No description provided for @reportNationalAllOption.
  ///
  /// In fr, this message translates to:
  /// **'Nationale (toutes)'**
  String get reportNationalAllOption;

  /// No description provided for @reportPeriod3MonthsLabel.
  ///
  /// In fr, this message translates to:
  /// **'3 mois'**
  String get reportPeriod3MonthsLabel;

  /// No description provided for @reportPeriod6MonthsLabel.
  ///
  /// In fr, this message translates to:
  /// **'6 mois'**
  String get reportPeriod6MonthsLabel;

  /// No description provided for @reportPeriod12MonthsLabel.
  ///
  /// In fr, this message translates to:
  /// **'12 mois'**
  String get reportPeriod12MonthsLabel;

  /// No description provided for @reportPeriodYtdLabel.
  ///
  /// In fr, this message translates to:
  /// **'Année en cours'**
  String get reportPeriodYtdLabel;

  /// No description provided for @reportPeriodCustomLabel.
  ///
  /// In fr, this message translates to:
  /// **'Personnalisé'**
  String get reportPeriodCustomLabel;

  /// No description provided for @reportSectionPeriodLabel.
  ///
  /// In fr, this message translates to:
  /// **'PÉRIODE'**
  String get reportSectionPeriodLabel;

  /// No description provided for @reportDateFromLabel.
  ///
  /// In fr, this message translates to:
  /// **'Du'**
  String get reportDateFromLabel;

  /// No description provided for @reportDateToLabel.
  ///
  /// In fr, this message translates to:
  /// **'Au'**
  String get reportDateToLabel;

  /// No description provided for @reportSectionContentLabel.
  ///
  /// In fr, this message translates to:
  /// **'CONTENU'**
  String get reportSectionContentLabel;

  /// No description provided for @reportSelectAllButton.
  ///
  /// In fr, this message translates to:
  /// **'Tout sélectionner'**
  String get reportSelectAllButton;

  /// No description provided for @reportDeselectAllButton.
  ///
  /// In fr, this message translates to:
  /// **'Tout désélectionner'**
  String get reportDeselectAllButton;

  /// No description provided for @reportSubtitleWorkforceTrends.
  ///
  /// In fr, this message translates to:
  /// **'Tendances temporelles'**
  String get reportSubtitleWorkforceTrends;

  /// No description provided for @reportSubtitleSkillsAnalysis.
  ///
  /// In fr, this message translates to:
  /// **'Analyse sectorielle'**
  String get reportSubtitleSkillsAnalysis;

  /// No description provided for @reportSubtitleDiversityInclusion.
  ///
  /// In fr, this message translates to:
  /// **'Parité & inclusion'**
  String get reportSubtitleDiversityInclusion;

  /// No description provided for @reportSubtitleRegionalDetail.
  ///
  /// In fr, this message translates to:
  /// **'Détail par région'**
  String get reportSubtitleRegionalDetail;

  /// No description provided for @reportSectionNameLabel.
  ///
  /// In fr, this message translates to:
  /// **'NOM DU RAPPORT (optionnel)'**
  String get reportSectionNameLabel;

  /// No description provided for @reportNameHintExample.
  ///
  /// In fr, this message translates to:
  /// **'Briefing RH Littoral Juin 2026'**
  String get reportNameHintExample;

  /// No description provided for @reportGenerateButtonLabel.
  ///
  /// In fr, this message translates to:
  /// **'GÉNÉRER LE RAPPORT'**
  String get reportGenerateButtonLabel;

  /// No description provided for @reportDownloadStartedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Téléchargement démarré'**
  String get reportDownloadStartedMsg;

  /// No description provided for @reportEmptyHistoryTitle.
  ///
  /// In fr, this message translates to:
  /// **'Aucun rapport généré'**
  String get reportEmptyHistoryTitle;

  /// No description provided for @reportEmptyHistorySubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Générez votre premier rapport dans l\'onglet \"Générer\"'**
  String get reportEmptyHistorySubtitle;

  /// No description provided for @reportDownloadTooltip.
  ///
  /// In fr, this message translates to:
  /// **'Télécharger'**
  String get reportDownloadTooltip;

  /// No description provided for @reportTabGenerate.
  ///
  /// In fr, this message translates to:
  /// **'Générer'**
  String get reportTabGenerate;

  /// No description provided for @reportTabApprovals.
  ///
  /// In fr, this message translates to:
  /// **'Approbations'**
  String get reportTabApprovals;

  /// No description provided for @reportTabHistory.
  ///
  /// In fr, this message translates to:
  /// **'Historique'**
  String get reportTabHistory;

  /// No description provided for @reportTabBatch.
  ///
  /// In fr, this message translates to:
  /// **'Batch'**
  String get reportTabBatch;

  /// No description provided for @reportTabAudit.
  ///
  /// In fr, this message translates to:
  /// **'Audit'**
  String get reportTabAudit;

  /// No description provided for @reportScreenTitle.
  ///
  /// In fr, this message translates to:
  /// **'Générateur de rapport'**
  String get reportScreenTitle;

  /// No description provided for @onefopExportExcelDownloadedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Fichier Excel téléchargé : {path}'**
  String onefopExportExcelDownloadedMsg(String path);

  /// No description provided for @onefopExportErrorMsg.
  ///
  /// In fr, this message translates to:
  /// **'Erreur lors de l\'export : {error}'**
  String onefopExportErrorMsg(String error);

  /// No description provided for @onefopExportSpssDownloadedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Fichiers SPSS téléchargés (CSV + syntaxe .sps) : {path}. Placez les deux fichiers dans le même dossier puis exécutez le .sps dans SPSS.'**
  String onefopExportSpssDownloadedMsg(String path);

  /// No description provided for @onefopExportSpssErrorMsg.
  ///
  /// In fr, this message translates to:
  /// **'Erreur lors de l\'export SPSS : {error}'**
  String onefopExportSpssErrorMsg(String error);

  /// No description provided for @onefopExportPanelTitle.
  ///
  /// In fr, this message translates to:
  /// **'Exporter les soumissions ONEFOP'**
  String get onefopExportPanelTitle;

  /// No description provided for @onefopExportPanelDescription.
  ///
  /// In fr, this message translates to:
  /// **'Compile toutes les soumissions approuvées (Entreprises, Coopératives, CTD, ONG) : données d\'identification et sections 1 à 4 du questionnaire.'**
  String get onefopExportPanelDescription;

  /// No description provided for @onefopExportGeneratingLabel.
  ///
  /// In fr, this message translates to:
  /// **'Génération…'**
  String get onefopExportGeneratingLabel;

  /// No description provided for @onefopExportExcelButton.
  ///
  /// In fr, this message translates to:
  /// **'Exporter en Excel'**
  String get onefopExportExcelButton;

  /// No description provided for @onefopExportSpssButton.
  ///
  /// In fr, this message translates to:
  /// **'Exporter en SPSS'**
  String get onefopExportSpssButton;

  /// No description provided for @onefopExportPdfComingSoonMsg.
  ///
  /// In fr, this message translates to:
  /// **'Export PDF bientôt disponible'**
  String get onefopExportPdfComingSoonMsg;

  /// No description provided for @reportExportFiltersActiveCount.
  ///
  /// In fr, this message translates to:
  /// **'{count, plural, =1{Filtres ({count} actif)} other{Filtres ({count} actifs)}}'**
  String reportExportFiltersActiveCount(int count);

  /// No description provided for @reportExportFiltersOptionalLabel.
  ///
  /// In fr, this message translates to:
  /// **'Filtres (optionnel)'**
  String get reportExportFiltersOptionalLabel;

  /// No description provided for @onefopExportFilterDescription.
  ///
  /// In fr, this message translates to:
  /// **'Restreint l\'export à une région, un département, une année d\'enquête et/ou une période précises.'**
  String get onefopExportFilterDescription;

  /// No description provided for @onefopExportChooseRegionFirstHint.
  ///
  /// In fr, this message translates to:
  /// **'Choisir une région d\'abord'**
  String get onefopExportChooseRegionFirstHint;

  /// No description provided for @onefopExportSurveyYearLabel.
  ///
  /// In fr, this message translates to:
  /// **'Année d\'enquête'**
  String get onefopExportSurveyYearLabel;

  /// No description provided for @onefopExportYearHintExample.
  ///
  /// In fr, this message translates to:
  /// **'Ex. {year}'**
  String onefopExportYearHintExample(int year);

  /// No description provided for @onefopExportAllPeriodOption.
  ///
  /// In fr, this message translates to:
  /// **'Toute la période'**
  String get onefopExportAllPeriodOption;

  /// No description provided for @onefopExportSubmissionPeriodLabel.
  ///
  /// In fr, this message translates to:
  /// **'Période de soumission'**
  String get onefopExportSubmissionPeriodLabel;

  /// No description provided for @soumissionsTypeDsmoOption.
  ///
  /// In fr, this message translates to:
  /// **'DSMO'**
  String get soumissionsTypeDsmoOption;

  /// No description provided for @draftSavedSnackbar.
  ///
  /// In fr, this message translates to:
  /// **'Brouillon enregistré'**
  String get draftSavedSnackbar;

  /// No description provided for @discardDraftDialogTitle.
  ///
  /// In fr, this message translates to:
  /// **'Supprimer le brouillon ?'**
  String get discardDraftDialogTitle;

  /// No description provided for @draftRelativeTimeJustNow.
  ///
  /// In fr, this message translates to:
  /// **'à l\'instant'**
  String get draftRelativeTimeJustNow;

  /// No description provided for @draftRelativeTimeMinutesAgo.
  ///
  /// In fr, this message translates to:
  /// **'il y a {minutes} min'**
  String draftRelativeTimeMinutesAgo(int minutes);

  /// No description provided for @draftRelativeTimeHoursAgo.
  ///
  /// In fr, this message translates to:
  /// **'il y a {hours} h'**
  String draftRelativeTimeHoursAgo(int hours);

  /// No description provided for @draftRelativeTimeDaysAgo.
  ///
  /// In fr, this message translates to:
  /// **'il y a {days} j'**
  String draftRelativeTimeDaysAgo(int days);

  /// No description provided for @draftSaveNowButton.
  ///
  /// In fr, this message translates to:
  /// **'Sauvegarder maintenant'**
  String get draftSaveNowButton;

  /// No description provided for @draftLoadFailedMessage.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de charger les brouillons'**
  String get draftLoadFailedMessage;

  /// No description provided for @draftEmptyStateMessage.
  ///
  /// In fr, this message translates to:
  /// **'Aucun brouillon enregistré'**
  String get draftEmptyStateMessage;

  /// No description provided for @offlineBannerOfflineWithPendingMsg.
  ///
  /// In fr, this message translates to:
  /// **'Hors ligne — {count} élément(s) en attente'**
  String offlineBannerOfflineWithPendingMsg(int count);

  /// No description provided for @offlineBannerOfflineDegradedMsg.
  ///
  /// In fr, this message translates to:
  /// **'Hors ligne — Mode dégradé'**
  String get offlineBannerOfflineDegradedMsg;

  /// No description provided for @offlineBannerOnlinePendingMsg.
  ///
  /// In fr, this message translates to:
  /// **'{count} élément(s) en attente d\'envoi'**
  String offlineBannerOnlinePendingMsg(int count);

  /// No description provided for @pdfDownloadFolderNotFoundError.
  ///
  /// In fr, this message translates to:
  /// **'Dossier de téléchargement introuvable.'**
  String get pdfDownloadFolderNotFoundError;

  /// No description provided for @pdfSavedToDownloadsMsg.
  ///
  /// In fr, this message translates to:
  /// **'PDF enregistré dans Téléchargements'**
  String get pdfSavedToDownloadsMsg;

  /// No description provided for @pdfSavedToDocumentsMsg.
  ///
  /// In fr, this message translates to:
  /// **'PDF enregistré dans Documents'**
  String get pdfSavedToDocumentsMsg;

  /// No description provided for @pdfDownloadFailedError.
  ///
  /// In fr, this message translates to:
  /// **'Téléchargement échoué : {error}'**
  String pdfDownloadFailedError(String error);

  /// No description provided for @formPreviewTitle.
  ///
  /// In fr, this message translates to:
  /// **'Formulaire officiel ONEFOP · CAM-LEAP'**
  String get formPreviewTitle;

  /// No description provided for @pdfReviewBeforeSubmitWarning.
  ///
  /// In fr, this message translates to:
  /// **'Vérifiez les informations ci-dessous avant de soumettre définitivement.'**
  String get pdfReviewBeforeSubmitWarning;

  /// No description provided for @loadingPdfEllipsis.
  ///
  /// In fr, this message translates to:
  /// **'Chargement du PDF…'**
  String get loadingPdfEllipsis;

  /// No description provided for @pdfLoadFailedError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de charger le PDF.'**
  String get pdfLoadFailedError;

  /// No description provided for @submittingEllipsis.
  ///
  /// In fr, this message translates to:
  /// **'Soumission…'**
  String get submittingEllipsis;

  /// No description provided for @customPeriodLabel.
  ///
  /// In fr, this message translates to:
  /// **'Période personnalisée'**
  String get customPeriodLabel;

  /// No description provided for @periodAnalysisLabel.
  ///
  /// In fr, this message translates to:
  /// **'Période d\'analyse'**
  String get periodAnalysisLabel;

  /// No description provided for @yearLabel.
  ///
  /// In fr, this message translates to:
  /// **'Année'**
  String get yearLabel;

  /// No description provided for @quarterLabel.
  ///
  /// In fr, this message translates to:
  /// **'Trimestre'**
  String get quarterLabel;

  /// No description provided for @semesterLabel.
  ///
  /// In fr, this message translates to:
  /// **'Semestre'**
  String get semesterLabel;

  /// No description provided for @quarterT1Label.
  ///
  /// In fr, this message translates to:
  /// **'T1 (Jan-Mar)'**
  String get quarterT1Label;

  /// No description provided for @quarterT2Label.
  ///
  /// In fr, this message translates to:
  /// **'T2 (Avr-Jun)'**
  String get quarterT2Label;

  /// No description provided for @quarterT3Label.
  ///
  /// In fr, this message translates to:
  /// **'T3 (Jul-Sep)'**
  String get quarterT3Label;

  /// No description provided for @quarterT4Label.
  ///
  /// In fr, this message translates to:
  /// **'T4 (Oct-Dec)'**
  String get quarterT4Label;

  /// No description provided for @semesterS1Label.
  ///
  /// In fr, this message translates to:
  /// **'S1 (Jan-Jun)'**
  String get semesterS1Label;

  /// No description provided for @semesterS2Label.
  ///
  /// In fr, this message translates to:
  /// **'S2 (Jul-Dec)'**
  String get semesterS2Label;

  /// No description provided for @selectPeriodPrompt.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionner une période'**
  String get selectPeriodPrompt;

  /// No description provided for @newShortLabel.
  ///
  /// In fr, this message translates to:
  /// **'Nouveau'**
  String get newShortLabel;

  /// No description provided for @serviceCategoryDeconcentratedLabel.
  ///
  /// In fr, this message translates to:
  /// **'Services Déconcentrés'**
  String get serviceCategoryDeconcentratedLabel;

  /// No description provided for @serviceCategoryCentralLabel.
  ///
  /// In fr, this message translates to:
  /// **'Administration Centrale'**
  String get serviceCategoryCentralLabel;

  /// No description provided for @serviceCategoryAffiliatedLabel.
  ///
  /// In fr, this message translates to:
  /// **'Organismes Rattachés'**
  String get serviceCategoryAffiliatedLabel;

  /// No description provided for @selectServiceTypeAbovePrompt.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez un type de service ci-dessus.'**
  String get selectServiceTypeAbovePrompt;

  /// No description provided for @noServiceFoundMessage.
  ///
  /// In fr, this message translates to:
  /// **'Aucun service trouvé.'**
  String get noServiceFoundMessage;

  /// No description provided for @serviceTypeFieldLabel.
  ///
  /// In fr, this message translates to:
  /// **'Type de service *'**
  String get serviceTypeFieldLabel;

  /// No description provided for @selectServiceTypeHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionner un type de service'**
  String get selectServiceTypeHint;

  /// No description provided for @serviceSelectedLabel.
  ///
  /// In fr, this message translates to:
  /// **'Service sélectionné'**
  String get serviceSelectedLabel;

  /// No description provided for @servicesLoadFailedTitle.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de charger les services'**
  String get servicesLoadFailedTitle;

  /// No description provided for @serviceCategoryDeconcentratedShort.
  ///
  /// In fr, this message translates to:
  /// **'Déconcentré'**
  String get serviceCategoryDeconcentratedShort;

  /// No description provided for @serviceCategoryCentralShort.
  ///
  /// In fr, this message translates to:
  /// **'Centrale'**
  String get serviceCategoryCentralShort;

  /// No description provided for @serviceCategoryAffiliatedShort.
  ///
  /// In fr, this message translates to:
  /// **'Rattaché'**
  String get serviceCategoryAffiliatedShort;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'fr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'fr':
      return AppLocalizationsFr();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
