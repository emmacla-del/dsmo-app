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

  /// No description provided for @ministryFullName.
  ///
  /// In fr, this message translates to:
  /// **'Ministère de l\'Emploi et de la Formation Professionnelle'**
  String get ministryFullName;

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
  /// **'Login'**
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

  /// No description provided for @registerPendingApprovalTitle.
  ///
  /// In fr, this message translates to:
  /// **'Demande soumise !'**
  String get registerPendingApprovalTitle;

  /// No description provided for @registerPendingApprovalBody.
  ///
  /// In fr, this message translates to:
  /// **'Votre demande d\'accès MINEFOP est en attente d\'approbation par un administrateur.'**
  String get registerPendingApprovalBody;

  /// No description provided for @registerUnderstoodButton.
  ///
  /// In fr, this message translates to:
  /// **'Compris'**
  String get registerUnderstoodButton;

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

  /// No description provided for @registerStepTitleMinefopInfo.
  ///
  /// In fr, this message translates to:
  /// **'Informations MINEFOP'**
  String get registerStepTitleMinefopInfo;

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

  /// No description provided for @registerEntitySubtitleVocational.
  ///
  /// In fr, this message translates to:
  /// **'Centre de formation technique et professionnelle agréé.'**
  String get registerEntitySubtitleVocational;

  /// No description provided for @registerServiceLevelTitle.
  ///
  /// In fr, this message translates to:
  /// **'Niveau de service'**
  String get registerServiceLevelTitle;

  /// No description provided for @registerServiceLevelSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez votre niveau hiérarchique.'**
  String get registerServiceLevelSubtitle;

  /// No description provided for @registerMinefopCentralTitle.
  ///
  /// In fr, this message translates to:
  /// **'Administration centrale'**
  String get registerMinefopCentralTitle;

  /// No description provided for @registerMinefopCentralSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Direction centrale, sous-direction ou service central à Yaoundé.'**
  String get registerMinefopCentralSubtitle;

  /// No description provided for @registerMinefopRegionalTitle.
  ///
  /// In fr, this message translates to:
  /// **'Service régional'**
  String get registerMinefopRegionalTitle;

  /// No description provided for @registerMinefopRegionalSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Délégation régionale de l\'emploi et de la formation professionnelle.'**
  String get registerMinefopRegionalSubtitle;

  /// No description provided for @registerMinefopDivisionalTitle.
  ///
  /// In fr, this message translates to:
  /// **'Service départemental'**
  String get registerMinefopDivisionalTitle;

  /// No description provided for @registerMinefopDivisionalSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Délégation départementale de l\'emploi et de la formation professionnelle.'**
  String get registerMinefopDivisionalSubtitle;

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

  /// No description provided for @registerRoleMinefopTitle.
  ///
  /// In fr, this message translates to:
  /// **'Agent MINEFOP'**
  String get registerRoleMinefopTitle;

  /// No description provided for @registerRoleMinefopSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Inspecteur ou agent du Ministère de l\'Emploi et de la Formation Professionnelle.'**
  String get registerRoleMinefopSubtitle;

  /// No description provided for @registerEntityTypeSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez le type d\'entité que vous représentez.'**
  String get registerEntityTypeSubtitle;

  /// No description provided for @registerRespondentTitlePersonal.
  ///
  /// In fr, this message translates to:
  /// **'Vos informations personnelles'**
  String get registerRespondentTitlePersonal;

  /// No description provided for @registerRespondentSubtitleMinefop.
  ///
  /// In fr, this message translates to:
  /// **'Ces informations seront associées à votre compte agent MINEFOP.'**
  String get registerRespondentSubtitleMinefop;

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

  /// No description provided for @registerMinefopLoadFunctionsError.
  ///
  /// In fr, this message translates to:
  /// **'Impossible de charger les fonctions.'**
  String get registerMinefopLoadFunctionsError;

  /// No description provided for @registerInfoAsRole.
  ///
  /// In fr, this message translates to:
  /// **'Renseignez vos informations en tant que {role}.'**
  String registerInfoAsRole(String role);

  /// No description provided for @registerMatriculeLabel.
  ///
  /// In fr, this message translates to:
  /// **'Matricule *'**
  String get registerMatriculeLabel;

  /// No description provided for @registerMatriculeHint.
  ///
  /// In fr, this message translates to:
  /// **'Votre matricule de fonctionnaire'**
  String get registerMatriculeHint;

  /// No description provided for @registerMatriculeRequired.
  ///
  /// In fr, this message translates to:
  /// **'Matricule requis'**
  String get registerMatriculeRequired;

  /// No description provided for @registerLocalisationSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Indiquez la région et le département de votre affectation.'**
  String get registerLocalisationSubtitle;

  /// No description provided for @registerRegionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Région *'**
  String get registerRegionLabel;

  /// No description provided for @registerSelectRegionHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez votre région'**
  String get registerSelectRegionHint;

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

  /// No description provided for @registerSelectDepartmentHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez votre département'**
  String get registerSelectDepartmentHint;

  /// No description provided for @registerMinefopInfoBox.
  ///
  /// In fr, this message translates to:
  /// **'Ces informations seront vérifiées lors de la validation de votre compte par un administrateur.'**
  String get registerMinefopInfoBox;

  /// No description provided for @registerLoadingFunctions.
  ///
  /// In fr, this message translates to:
  /// **'Chargement des fonctions...'**
  String get registerLoadingFunctions;

  /// No description provided for @registerNoFunctionsAvailable.
  ///
  /// In fr, this message translates to:
  /// **'Aucune fonction disponible pour votre niveau.'**
  String get registerNoFunctionsAvailable;

  /// No description provided for @registerFunctionPositionLabel.
  ///
  /// In fr, this message translates to:
  /// **'Fonction / Poste *'**
  String get registerFunctionPositionLabel;

  /// No description provided for @registerSelectYourFunction.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez votre fonction'**
  String get registerSelectYourFunction;

  /// No description provided for @registerSelectFunctionValidator.
  ///
  /// In fr, this message translates to:
  /// **'Veuillez sélectionner une fonction'**
  String get registerSelectFunctionValidator;

  /// No description provided for @registerLoadingParentUnits.
  ///
  /// In fr, this message translates to:
  /// **'Chargement des unités parentes...'**
  String get registerLoadingParentUnits;

  /// No description provided for @registerNoParentUnitsAvailable.
  ///
  /// In fr, this message translates to:
  /// **'Aucune unité parente disponible pour cette fonction.'**
  String get registerNoParentUnitsAvailable;

  /// No description provided for @registerParentUnitLabel.
  ///
  /// In fr, this message translates to:
  /// **'Unité parente *'**
  String get registerParentUnitLabel;

  /// No description provided for @registerParentUnitDirectlyAttached.
  ///
  /// In fr, this message translates to:
  /// **'Cette fonction est directement rattachée à cette unité.'**
  String get registerParentUnitDirectlyAttached;

  /// No description provided for @registerSelectDirectSupervisor.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez le service supérieur hiérarchique direct.'**
  String get registerSelectDirectSupervisor;

  /// No description provided for @registerSelectParentUnitHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez l\'unité supérieure'**
  String get registerSelectParentUnitHint;

  /// No description provided for @registerLoadingServiceUnits.
  ///
  /// In fr, this message translates to:
  /// **'Chargement de vos services...'**
  String get registerLoadingServiceUnits;

  /// No description provided for @registerNoServiceUnitsFound.
  ///
  /// In fr, this message translates to:
  /// **'Aucun service trouvé sous cette unité parente.'**
  String get registerNoServiceUnitsFound;

  /// No description provided for @registerYourServiceLabel.
  ///
  /// In fr, this message translates to:
  /// **'Votre service *'**
  String get registerYourServiceLabel;

  /// No description provided for @registerSelectYourUnit.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez l\'unité dans laquelle vous exercez.'**
  String get registerSelectYourUnit;

  /// No description provided for @registerSelectYourServiceHint.
  ///
  /// In fr, this message translates to:
  /// **'Sélectionnez votre service'**
  String get registerSelectYourServiceHint;

  /// No description provided for @registerJobTitleLabel.
  ///
  /// In fr, this message translates to:
  /// **'Intitulé du poste'**
  String get registerJobTitleLabel;

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

  /// No description provided for @registerReviewPersonalInfoTitle.
  ///
  /// In fr, this message translates to:
  /// **'Informations personnelles'**
  String get registerReviewPersonalInfoTitle;

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

  /// No description provided for @registerMinefopPendingInfoBox.
  ///
  /// In fr, this message translates to:
  /// **'Votre compte sera activé après validation par un administrateur MINEFOP.'**
  String get registerMinefopPendingInfoBox;

  /// No description provided for @registerCompanyPendingInfoBox.
  ///
  /// In fr, this message translates to:
  /// **'Ces informations pré-rempliront automatiquement les Sections 0 et 1 de vos formulaires ONEFOP et la Partie A de vos déclarations DSMO.'**
  String get registerCompanyPendingInfoBox;

  /// No description provided for @registerAgentMinefopPrefix.
  ///
  /// In fr, this message translates to:
  /// **'Agent MINEFOP — {role}'**
  String registerAgentMinefopPrefix(String role);

  /// No description provided for @registerMatriculeRowLabel.
  ///
  /// In fr, this message translates to:
  /// **'Matricule'**
  String get registerMatriculeRowLabel;

  /// No description provided for @registerHierarchicalPathLabel.
  ///
  /// In fr, this message translates to:
  /// **'Chemin hiérarchique'**
  String get registerHierarchicalPathLabel;

  /// No description provided for @registerServiceCodeRowLabel.
  ///
  /// In fr, this message translates to:
  /// **'Code service'**
  String get registerServiceCodeRowLabel;

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

  /// No description provided for @footerHelp.
  ///
  /// In fr, this message translates to:
  /// **'Aide'**
  String get footerHelp;

  /// No description provided for @footerPrivacy.
  ///
  /// In fr, this message translates to:
  /// **'Confidentialité'**
  String get footerPrivacy;

  /// No description provided for @footerContact.
  ///
  /// In fr, this message translates to:
  /// **'Contact'**
  String get footerContact;

  /// No description provided for @footerVersionLine.
  ///
  /// In fr, this message translates to:
  /// **'DSMO Digital v2.4.1-stable  ·  © 2026 MINEFOP · République du Cameroun'**
  String get footerVersionLine;

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
  /// **'Opportunités actionnables'**
  String get companyAnalyticsOpportunitiesTitle;

  /// No description provided for @companyAnalyticsOpportunitiesDescription.
  ///
  /// In fr, this message translates to:
  /// **'Formations éligibles à des subventions, candidats correspondant à vos postes vacants, et incitatifs fiscaux détectés à partir de vos données.'**
  String get companyAnalyticsOpportunitiesDescription;

  /// No description provided for @companyAnalyticsComingSoonBadge.
  ///
  /// In fr, this message translates to:
  /// **'Bientôt disponible'**
  String get companyAnalyticsComingSoonBadge;

  /// No description provided for @companyAnalyticsHeaderYear.
  ///
  /// In fr, this message translates to:
  /// **'Analytique {year}'**
  String companyAnalyticsHeaderYear(int year);

  /// No description provided for @companyAnalyticsBilanSubtitle.
  ///
  /// In fr, this message translates to:
  /// **'Données issues de vos déclarations ONEFOP approuvées'**
  String get companyAnalyticsBilanSubtitle;

  /// No description provided for @companyAnalyticsSectionMySituation.
  ///
  /// In fr, this message translates to:
  /// **'Ma Situation'**
  String get companyAnalyticsSectionMySituation;

  /// No description provided for @companyAnalyticsLoadError.
  ///
  /// In fr, this message translates to:
  /// **'Erreur chargement : {error}'**
  String companyAnalyticsLoadError(String error);

  /// No description provided for @companyAnalyticsSectionBilanDetailed.
  ///
  /// In fr, this message translates to:
  /// **'Bilan RH Détaillé'**
  String get companyAnalyticsSectionBilanDetailed;

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

  /// No description provided for @companyAnalyticsVsPreviousYearLabel.
  ///
  /// In fr, this message translates to:
  /// **'{value} vs N-1'**
  String companyAnalyticsVsPreviousYearLabel(String value);

  /// No description provided for @companyAnalyticsFemaleCountLabel.
  ///
  /// In fr, this message translates to:
  /// **'{count} employées'**
  String companyAnalyticsFemaleCountLabel(int count);

  /// No description provided for @companyAnalyticsMaleCountLabel.
  ///
  /// In fr, this message translates to:
  /// **'{count} employés'**
  String companyAnalyticsMaleCountLabel(int count);

  /// No description provided for @companyAnalyticsRecruitmentsLabel.
  ///
  /// In fr, this message translates to:
  /// **'Recrutements'**
  String get companyAnalyticsRecruitmentsLabel;

  /// No description provided for @companyAnalyticsNetLabel.
  ///
  /// In fr, this message translates to:
  /// **'Net : {value}'**
  String companyAnalyticsNetLabel(String value);

  /// No description provided for @companyAnalyticsDeparturesLabel.
  ///
  /// In fr, this message translates to:
  /// **'Départs'**
  String get companyAnalyticsDeparturesLabel;

  /// No description provided for @companyAnalyticsDismissalsRetirementsLabel.
  ///
  /// In fr, this message translates to:
  /// **'{dismissals} licenciements · {retirements} retraites'**
  String companyAnalyticsDismissalsRetirementsLabel(
      int dismissals, int retirements);

  /// No description provided for @companyAnalyticsCategoryBreakdownTitle.
  ///
  /// In fr, this message translates to:
  /// **'Répartition par catégorie'**
  String get companyAnalyticsCategoryBreakdownTitle;

  /// No description provided for @companyAnalyticsCatExecutives.
  ///
  /// In fr, this message translates to:
  /// **'Cadres (1-3)'**
  String get companyAnalyticsCatExecutives;

  /// No description provided for @companyAnalyticsCatSupervisors.
  ///
  /// In fr, this message translates to:
  /// **'Maîtrise (4-6)'**
  String get companyAnalyticsCatSupervisors;

  /// No description provided for @companyAnalyticsCatWorkers.
  ///
  /// In fr, this message translates to:
  /// **'Ouvriers (7-9)'**
  String get companyAnalyticsCatWorkers;

  /// No description provided for @companyAnalyticsCatOthers.
  ///
  /// In fr, this message translates to:
  /// **'Autres (10-12)'**
  String get companyAnalyticsCatOthers;

  /// No description provided for @companyAnalyticsCatUndeclared.
  ///
  /// In fr, this message translates to:
  /// **'Non-déclaré'**
  String get companyAnalyticsCatUndeclared;

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

  /// No description provided for @companyAnalyticsLockedUnderReview.
  ///
  /// In fr, this message translates to:
  /// **'Votre questionnaire ONEFOP est en cours de révision. Les analyses seront disponibles après approbation.'**
  String get companyAnalyticsLockedUnderReview;

  /// No description provided for @companyAnalyticsLockedDraft.
  ///
  /// In fr, this message translates to:
  /// **'Vous avez un brouillon ONEFOP en cours. Finalisez et soumettez pour accéder à vos analyses.'**
  String get companyAnalyticsLockedDraft;

  /// No description provided for @companyAnalyticsLockedDefault.
  ///
  /// In fr, this message translates to:
  /// **'Soumettez le questionnaire ONEFOP pour accéder à vos analyses personnelles.'**
  String get companyAnalyticsLockedDefault;

  /// No description provided for @companyAnalyticsBenchmarkLockedSubmitted.
  ///
  /// In fr, this message translates to:
  /// **'Votre questionnaire est en cours de révision par MINEFOP. Les comparaisons sectorielles seront débloquées après approbation.'**
  String get companyAnalyticsBenchmarkLockedSubmitted;

  /// No description provided for @companyAnalyticsBenchmarkLockedUnderReview.
  ///
  /// In fr, this message translates to:
  /// **'Votre questionnaire est en cours d\'analyse. Les benchmarks arrivent bientôt.'**
  String get companyAnalyticsBenchmarkLockedUnderReview;

  /// No description provided for @companyAnalyticsBenchmarkLockedDefault.
  ///
  /// In fr, this message translates to:
  /// **'Soumettez le questionnaire ONEFOP pour accéder aux analyses comparatives.'**
  String get companyAnalyticsBenchmarkLockedDefault;

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
  /// **'Numéro SIRET'**
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
