// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get requiredField => 'Required field';

  @override
  String get telExactly9Digits => 'Number must be exactly 9 digits';

  @override
  String get telMustStartWith2Or6 =>
      'Number must start with 2 (landline) or 6 (mobile)';

  @override
  String get emailInvalid =>
      'Please enter a valid email address (e.g. contact@company.com)';

  @override
  String get yearInvalid => 'Please enter a valid year (e.g. 1998)';

  @override
  String get yearMin => 'Year must be ≥ 1900';

  @override
  String yearMax(int max) {
    return 'Year must be ≤ $max';
  }

  @override
  String get requiredFieldConditional => 'Required field (conditional)';

  @override
  String get tableResponseRequired =>
      'Select whether figures are reported, there is nothing to report, or the question does not apply';

  @override
  String get tableFiguresRequired =>
      'Enter figures, or choose “nothing to report”';

  @override
  String get selectAnOption => 'Please select an option';

  @override
  String get optional => 'Optional';

  @override
  String get sectionComplete => 'Complete';

  @override
  String get sectionInProgress => 'In progress';

  @override
  String get selectPlaceholder => 'Select';

  @override
  String get fillRequiredFields =>
      'Please fill in all required fields before submitting';

  @override
  String get genericSubmitError => 'Something went wrong. Please try again.';

  @override
  String get telHelper => '9 digits, no leading 0';

  @override
  String get yearHelper => '4-digit year';

  @override
  String get collapseSidebar => 'Collapse sidebar';

  @override
  String get hideSidebar => 'Hide sidebar';

  @override
  String get showSidebar => 'Show sidebar';

  @override
  String get saving => 'Saving…';

  @override
  String get unsaved => 'Unsaved';

  @override
  String get saved => 'Saved';

  @override
  String get generatingPdfPreview => 'Generating PDF preview…';

  @override
  String get loadingEllipsis => 'Loading…';

  @override
  String get retry => 'Retry';

  @override
  String get errorLabel => 'Error';

  @override
  String get previewUnavailableError => 'Internal error: preview unavailable';

  @override
  String get submittingInProgress => 'Submitting…';

  @override
  String get next => 'Next';

  @override
  String get previousButton => 'Previous';

  @override
  String get previewPdf => 'Preview PDF';

  @override
  String get inconsistencyDetectedTitle => 'Inconsistency detected';

  @override
  String inconsistenciesDetectedTitle(int count) {
    return '$count inconsistencies detected';
  }

  @override
  String get missingFieldTitle => 'Missing field';

  @override
  String missingFieldsTitle(int count) {
    return '$count missing fields';
  }

  @override
  String sectionFallback(int number) {
    return 'Section $number';
  }

  @override
  String get male => 'Male';

  @override
  String get female => 'Female';

  @override
  String get total => 'Total';

  @override
  String get languageSettingTitle => 'Language';

  @override
  String get languageSettingSubtitle => 'Choose the app\'s display language';

  @override
  String get languageFrench => 'Français';

  @override
  String get languageEnglish => 'English';

  @override
  String portalWhatsappNotFound(String phone) {
    return 'WhatsApp isn\'t available on this device. Call $phone directly.';
  }

  @override
  String get portalTwoFactorCodeError =>
      'Incorrect or expired code. Please try again.';

  @override
  String get portalCredentialsError =>
      'Incorrect credentials. Please check and try again.';

  @override
  String get tabSignIn => 'Sign in';

  @override
  String get tabCreateAccount => 'Create an account';

  @override
  String get landingSignUpButton => 'Request access';

  @override
  String get landingNavProgramme => 'Programme';

  @override
  String get landingNavAbout => 'LMIS';

  @override
  String get landingNavObservatory => 'Observatory';

  @override
  String get landingNavComponents => 'Components';

  @override
  String get landingKickerObservatory => 'The Observatory';

  @override
  String get landingObservatoryBadge => 'Content in preparation';

  @override
  String get landingAboutTitle => 'Why a Labour Market Information System?';

  @override
  String get landingAboutPositioningTitle => 'Institutional positioning';

  @override
  String get landingRoadmapTitle => 'Building the system progressively';

  @override
  String get landingValueStripTitle => 'What CAMLEAP is building';

  @override
  String get landingSignInCta => 'Access the platform';

  @override
  String get landingRequestAccountCta => 'Request access';

  @override
  String get landingEnterLmisCta => 'Enter the LMIS';

  @override
  String get landingHeroHeadline =>
      'Building Cameroon\'s Labour Market Information System';

  @override
  String get landingProgrammeLine =>
      'National programme for the development of Cameroon\'s Labour Market Information System';

  @override
  String get landingHeroLead =>
      'Led through ONEFOP under the Ministry of Employment and Vocational Training (MINEFOP).';

  @override
  String get landingExploreProgramme => 'Explore the programme';

  @override
  String get landingCurrentImplementation => 'Current implementation';

  @override
  String get landingPlanned => 'Planned';

  @override
  String get landingOperational => 'Operational';

  @override
  String landingComponentPrefix(String roman) {
    return 'Component $roman';
  }

  @override
  String get landingArchitectureTitle => 'The Labour Market Information System';

  @override
  String get landingComponentsTitle => 'CAMLEAP programme components';

  @override
  String get landingCurrentSectionTitle => 'Current implementation';

  @override
  String get landingDataToIntelTitle =>
      'From data to labour-market intelligence';

  @override
  String get landingEcosystemTitle =>
      'An information infrastructure for the labour market';

  @override
  String get landingRepublic => 'Republic of Cameroon';

  @override
  String get landingMinefopName => 'MINEFOP';

  @override
  String get landingMinefopFull =>
      'Ministry of Employment and Vocational Training';

  @override
  String get landingOnefopName => 'ONEFOP';

  @override
  String get landingOnefopFull =>
      'Observatoire National de l\'Emploi et de la Formation Professionnelle';

  @override
  String get landingKickerProgramme => 'The programme';

  @override
  String get landingKickerLmis => 'The LMIS';

  @override
  String get landingKickerComponents => 'Components';

  @override
  String get landingKickerImplementation => 'Implementation';

  @override
  String get landingKickerPlatform => 'Platform';

  @override
  String get landingKickerEcosystem => 'Ecosystem';

  @override
  String get landingArchSources => 'Data sources';

  @override
  String get landingArchCollection => 'Collection';

  @override
  String get landingArchIntegration => 'Integration';

  @override
  String get landingArchAnalysis => 'Analysis';

  @override
  String get landingArchIntelligence => 'Intelligence';

  @override
  String get landingArchDecision => 'Decision-making';

  @override
  String get landingFlowPaper => 'Paper / fragmented collection';

  @override
  String get landingFlowDigital => 'Digital questionnaires';

  @override
  String get landingFlowValidation => 'Validation & standardisation';

  @override
  String get landingFlowCentralised => 'Centralised data';

  @override
  String get landingFlowStructured => 'Structured labour-market information';

  @override
  String get landingIntelCollect => 'Collect';

  @override
  String get landingIntelValidate => 'Validate';

  @override
  String get landingIntelCentralise => 'Centralise';

  @override
  String get landingIntelIntegrate => 'Integrate';

  @override
  String get landingIntelAnalyse => 'Analyse';

  @override
  String get landingIntelIndicators => 'Generate indicators';

  @override
  String get landingIntelDecisions => 'Inform decisions';

  @override
  String get landingStakeGovTitle => 'Government & policy makers';

  @override
  String get landingStakeGovBody =>
      'Designed to support evidence for employment policy, planning and monitoring.';

  @override
  String get landingStakeEmploymentTitle => 'Employment services';

  @override
  String get landingStakeEmploymentBody =>
      'Designed to support a better understanding of labour supply, demand and employment trends.';

  @override
  String get landingStakeSkillsTitle => 'Skills & training institutions';

  @override
  String get landingStakeSkillsBody =>
      'Designed to support alignment between skills development and labour-market needs.';

  @override
  String get landingStakeEmployersTitle => 'Employers & social partners';

  @override
  String get landingStakeEmployersBody =>
      'Designed to support reliable information on workforce and employment dynamics.';

  @override
  String get landingStakeResearchTitle => 'Researchers & analysts';

  @override
  String get landingStakeResearchBody =>
      'Designed to support structured labour-market information for analysis and research.';

  @override
  String get landingEcosystemNote =>
      'These uses will be supported progressively as programme components are implemented.';

  @override
  String get landingPillarCollect => 'Collect';

  @override
  String get landingPillarIntegrate => 'Integrate';

  @override
  String get landingPillarAnalyse => 'Analyse';

  @override
  String get landingPillarInform => 'Inform';

  @override
  String get loginHint => 'name@company.cm or EN26000112';

  @override
  String get phoneHintShort => '6XXXXXXXX';

  @override
  String get noAccountPrompt => 'No account yet?';

  @override
  String get tabForgotId => 'Forgot ID';

  @override
  String get twoFactorTitle => 'Two-factor verification';

  @override
  String get twoFactorBody =>
      'A verification code has been sent to your email address. Enter it below to complete sign-in.';

  @override
  String get codeLabel => 'Code';

  @override
  String get codeRequired => '6-digit code required';

  @override
  String get verifyButton => 'Verify';

  @override
  String get backToLogin => 'Back to sign in';

  @override
  String get loginLabel => 'Login';

  @override
  String get passwordLabel => 'Password';

  @override
  String get requiredShort => 'Required';

  @override
  String get rememberMe => 'Stay signed in';

  @override
  String get forgotPassword => 'Forgot password?';

  @override
  String get connectButton => 'Sign in';

  @override
  String get registerTitle => 'Account creation';

  @override
  String get registerBody =>
      'Register your company, cooperative, NGO, or training center to access the DSMO platform and submit your ONEFOP declarations.';

  @override
  String get registerButton => 'Start registration';

  @override
  String get registerDraftRestored =>
      'Draft restored — you can resume your registration.';

  @override
  String get registerSelectAccountType => 'Please choose an account type';

  @override
  String get registerSelectEntityType => 'Please select the entity type';

  @override
  String get registerEmailAlreadyUsed => 'This email is already in use.';

  @override
  String get registerSelectRegion => 'Please select a region';

  @override
  String get registerSelectDepartment => 'Please select a department';

  @override
  String get registerSelectSubdivision => 'Please select a subdivision';

  @override
  String get registerLoadRegionsError =>
      'Unable to load regions. Please try again.';

  @override
  String get registerLoadDepartmentsError =>
      'Unable to load departments. Please try again.';

  @override
  String get registerLoadSubdivisionsError =>
      'Unable to load subdivisions. Please try again.';

  @override
  String get registerLoadSectorsError =>
      'Unable to load sectors. Please try again.';

  @override
  String get registerSuccessTitle => 'Account created successfully!';

  @override
  String get registerAccessButton => 'Continue';

  @override
  String registerReceiptCopiedSnackbar(String label) {
    return '$label copied to clipboard';
  }

  @override
  String get registerReceiptCannotOpenAttestation =>
      'Unable to open the certificate.';

  @override
  String get registerReceiptTitle => 'REGISTRATION RECEIPT';

  @override
  String get registerReceiptCompanyLabel => 'Company';

  @override
  String get registerReceiptIdCopyLabel => 'ID';

  @override
  String get registerReceiptClickToCopy => 'Click to copy';

  @override
  String get registerReceiptRegistrationDateLabel => 'Registration date';

  @override
  String get registerReceiptKeepIdNote =>
      'Keep this ID. It will be requested to access your ONEFOP forms, and can also be used instead of your email to sign in.';

  @override
  String get registerReceiptDownloadAttestation => 'Download the certificate';

  @override
  String get registerReceiptCloseButton => 'Close';

  @override
  String get registerDuplicateEmailOrNiu =>
      'This email or tax number (NIU) is already in use.';

  @override
  String registerSubmitErrorWithMessage(String error) {
    return 'Registration error: $error';
  }

  @override
  String get registerCreateAccountButton => 'Create my account';

  @override
  String get registerContinueButton => 'Continue';

  @override
  String get registerStepTitleRole => 'Account type';

  @override
  String get registerStepTitleEntityType => 'Entity type';

  @override
  String get registerStepTitleRespondent => 'Respondent information';

  @override
  String get registerStepTitleEntityInfo => 'Entity information';

  @override
  String get registerStepTitleLocation => 'Location';

  @override
  String get registerStepTitleSecurity => 'Security';

  @override
  String get registerStepTitleReview => 'Review';

  @override
  String get registerEntitySubtitleEnterprise =>
      'Commercial company, SA, SARL, for-profit establishment.';

  @override
  String get registerEntitySubtitleCooperative =>
      'Cooperative society or economic interest group.';

  @override
  String get registerEntitySubtitleCtd =>
      'Decentralized Territorial Authority (municipality, region).';

  @override
  String get registerEntitySubtitleOng =>
      'Non-Governmental Organization or association.';

  @override
  String get registerEntitySubtitleAdministration =>
      'Public administration or government service.';

  @override
  String get registerEntitySubtitleProjectProgram =>
      'Project, programme, or structure under a ministry\'s supervision.';

  @override
  String get registerEntitySubtitleVocationalTraining =>
      'Vocational training center taking part in the national ONEFOP survey.';

  @override
  String get registerCreateAccountTitle => 'Create an account';

  @override
  String get registerSelectProfileSubtitle =>
      'Select your profile to get started.';

  @override
  String get registerRoleCompanyTitle => 'Company / Organization';

  @override
  String get registerRoleCompanySubtitle =>
      'Company, cooperative, RLA, NGO or training center subject to ONEFOP / DSMO declaration.';

  @override
  String get registerEntityTypeSubtitle =>
      'Select the type of entity you represent.';

  @override
  String get registerRespondentSubtitleStandard =>
      'This information will pre-fill Section 0 (Respondent) of the ONEFOP form and Part A of your DSMO declarations.';

  @override
  String get registerFirstNameLabel => 'First name *';

  @override
  String get registerLastNameLabel => 'Last name *';

  @override
  String get registerFunctionLabel => 'Position *';

  @override
  String get registerSelectFunctionHint => 'Select your position';

  @override
  String get registerProfessionalEmailLabel => 'Professional email *';

  @override
  String get registerPhone1Label => 'Phone 1 *';

  @override
  String get registerPhone2Label => 'Phone 2';

  @override
  String get registerRespondentInfoBox =>
      'This information will be automatically pre-filled in Section 0 of your future ONEFOP forms and in Part A of your DSMO declarations.';

  @override
  String get registerSelectEntityTypeFirst => 'Please select an entity type';

  @override
  String get registerEntityInfoInfoBox =>
      'This information will be automatically pre-filled in Section 1 of your future ONEFOP forms and in Part A of your DSMO declarations.';

  @override
  String get registerRegionLabel => 'Region *';

  @override
  String get registerDepartmentLabel => 'Department *';

  @override
  String get registerSelectRegionFirst => 'First select a region';

  @override
  String get registerLocationSubtitle =>
      'This information will pre-fill the location in the ONEFOP (Section 1) and DSMO (Part A) forms.';

  @override
  String get registerSelectRegionShort => 'Select a region';

  @override
  String get registerSelectDepartmentShort => 'Select a department';

  @override
  String get registerArrondissementLabel => 'Subdivision';

  @override
  String get registerSelectDepartmentFirst => 'First select a department';

  @override
  String get registerNoSubdivisionAvailable => 'No subdivision available';

  @override
  String get registerSelectSubdivisionShort => 'Select a subdivision';

  @override
  String get registerMilieuLabel => 'Area type';

  @override
  String get registerUrbanOrRuralHint => 'Urban or Rural';

  @override
  String get registerSectorLabel => 'Business sector';

  @override
  String get registerSelectSectorHint => 'Select a sector';

  @override
  String get registerLocationInfoBox =>
      'This information will be automatically pre-filled in Section 1 of your ONEFOP forms and in Part A of your DSMO declarations.';

  @override
  String get registerSecureAccountTitle => 'Secure your account';

  @override
  String get registerChooseStrongPassword => 'Choose a strong password.';

  @override
  String get registerPasswordLabel => 'Password *';

  @override
  String get registerPasswordRequired => 'Password required';

  @override
  String get registerPasswordMinChars => 'Minimum 8 characters';

  @override
  String get registerPasswordTooWeak => 'Too weak — add numbers or symbols';

  @override
  String get registerStrengthWeak => 'Weak';

  @override
  String get registerStrengthMedium => 'Medium';

  @override
  String get registerStrengthStrong => 'Strong';

  @override
  String get registerStrengthVeryStrong => 'Very strong';

  @override
  String get registerConfirmPasswordLabel => 'Confirm password *';

  @override
  String get registerConfirmationRequired => 'Confirmation required';

  @override
  String get registerPasswordsDontMatch => 'Passwords do not match';

  @override
  String get registerTip8Chars => 'At least 8 characters';

  @override
  String get registerTipUppercase => 'One uppercase letter';

  @override
  String get registerTipDigit => 'One digit';

  @override
  String get registerTipSpecialChar => 'One special character';

  @override
  String get registerReviewSubtitle =>
      'Review your information before creating the account.';

  @override
  String get registerReviewRespondentTitle =>
      'Respondent — ONEFOP Section 0 / DSMO Part A';

  @override
  String get registerFullNameLabel => 'Full name';

  @override
  String get registerFunctionRowLabel => 'Position';

  @override
  String get registerEmailRowLabel => 'Email';

  @override
  String get registerPhone1RowLabel => 'Phone 1';

  @override
  String get registerPhone2RowLabel => 'Phone 2';

  @override
  String get registerRegionRowLabel => 'Region';

  @override
  String get registerDepartmentRowLabel => 'Department';

  @override
  String get registerSectorRowLabel => 'Sector';

  @override
  String get registerCompanyPendingInfoBox =>
      'This information will automatically pre-fill Sections 0 and 1 of your ONEFOP forms and Part A of your DSMO declarations.';

  @override
  String get forgotIntro =>
      'Enter your organization\'s name, tax number (NIU), and registered phone number to retrieve your ID.';

  @override
  String get organizationLabel => 'Organization';

  @override
  String get organizationHint => 'Organization name';

  @override
  String get niuLabel => 'NIU';

  @override
  String get niuHint => 'Tax ID number';

  @override
  String get phoneLabel => 'Phone';

  @override
  String get searchButton => 'Search';

  @override
  String get supportContactLink => 'Still can\'t find it? Contact support';

  @override
  String get supportWhatsappMessage => 'Hello, I can\'t find my DSMO ID.';

  @override
  String get genericErrorShort => 'Something went wrong.';

  @override
  String get idFoundTitle => 'ID found';

  @override
  String get establishmentIdLabel => 'ESTABLISHMENT ID';

  @override
  String get tapToCopy => 'Tap to copy';

  @override
  String get idCopiedSnackbar => 'ID copied to clipboard';

  @override
  String get newSearchButton => 'New search';

  @override
  String get footerVersionLine =>
      'CAMLEAP v2.4.1-stable  ·  © 2026 MINEFOP · Republic of Cameroon';

  @override
  String get platformName => 'CAMLEAP';

  @override
  String get platformTagline => 'Labour Market Intelligence';

  @override
  String get platformFullName =>
      'Cameroon Labour and Employment Analytical Platform';

  @override
  String get camleapNavAbout => 'About';

  @override
  String get camleapNavOnefop => 'ONEFOP';

  @override
  String get camleapNavRegistre => 'Training registry';

  @override
  String get camleapNavEnquetes => 'Employer surveys';

  @override
  String get camleapSignIn => 'Sign in';

  @override
  String get camleapEspaceDeclarant => 'Declarant portal';

  @override
  String get camleapHeroHeadline =>
      'ONEFOP\'s digital infrastructure for labour market information and observation';

  @override
  String get camleapHeroTagline =>
      'Declarations · Entity registry · Surveys · Analysis (coming soon)';

  @override
  String get camleapHeroBody =>
      'CAMLEAP is the technical platform supporting ONEFOP\'s mission. It structures declaration collection, organises the registry of training entities, and prepares the tools for observing Cameroon\'s labour market.';

  @override
  String get camleapHeroCtaPrimary => 'Start my declaration';

  @override
  String get camleapHeroCtaSecondary => 'Discover ONEFOP';

  @override
  String get camleapAudienceTitle => 'You are...';

  @override
  String get camleapEconomicEntitiesTitle => 'Economic entities';

  @override
  String get camleapEntreprise => 'Company';

  @override
  String get camleapCooperative => 'Cooperative';

  @override
  String get camleapPublicEntitiesTitle => 'Public entities';

  @override
  String get camleapCtd => 'CTD';

  @override
  String get camleapOng => 'NGO';

  @override
  String get camleapVocationalTrainingTitle => 'Vocational training';

  @override
  String get camleapVocationalTrainingBody =>
      'Registration in the national registry of training centres (CFP).';

  @override
  String get camleapComingSoonBadge => 'Coming soon';

  @override
  String get camleapUnderstandTitle => 'Understanding ONEFOP';

  @override
  String get camleapUnderstandBody =>
      'ONEFOP is being restructured to better fulfil its labour-market observation mission. Two structuring components are being progressively deployed.';

  @override
  String get camleapLmisCardTitle => 'LMIS - Labour Market Information System';

  @override
  String get camleapLmisCardBody =>
      'The infrastructure for collecting, integrating and managing employment and training data nationwide.';

  @override
  String get camleapLmisBadge => 'Being deployed';

  @override
  String get camleapObservatoireCardTitle => 'Labour Market Observatory';

  @override
  String get camleapObservatoireCardBody =>
      'The component for analysing and disseminating intelligence on Cameroon\'s labour market.';

  @override
  String get camleapAVenir => 'Coming soon';

  @override
  String get camleapLearnMore => 'Learn more';

  @override
  String get camleapAvailableTodayTitle => 'Available today';

  @override
  String get camleapAvailable1 =>
      'Entity declarations (companies, cooperatives, CTDs, NGOs)';

  @override
  String get camleapAvailable2 => 'Technical documentation';

  @override
  String get camleapAvailable3 =>
      'Declarant portal for entities (access on request)';

  @override
  String get camleapComing1 => 'National registry of training entities (CFP)';

  @override
  String get camleapComing3 => 'Observatory — dashboards and reports';

  @override
  String get camleapComing4 => 'Public data portal';

  @override
  String get camleapAccessRequestTitle => 'Request access';

  @override
  String get camleapAccessRequestBody =>
      'To request access to the declarant portal, provide your role, entity and parent administration.';

  @override
  String get camleapYaounde => 'Yaoundé, Cameroon';

  @override
  String camleapCopyright(int year) {
    return '© $year ONEFOP. All rights reserved.';
  }

  @override
  String get camleapComingSoonPageBody =>
      'This page is being prepared. Check back soon or contact us at contact@onefop.cm for more information.';

  @override
  String get camleapTitleDeclarerEntreprise => 'Declaration — Company';

  @override
  String get camleapTitleDeclarerCooperative => 'Declaration — Cooperative';

  @override
  String get camleapTitleDeclarerCtd => 'Declaration — CTD';

  @override
  String get camleapTitleDeclarerOng => 'Declaration — NGO';

  @override
  String get forgotPasswordTitle => 'Forgot password';

  @override
  String get forgotPasswordResetDoneTitle => 'Password reset';

  @override
  String get forgotPasswordStep1Subtitle =>
      'Enter your account email address to get started.';

  @override
  String get forgotPasswordStep2Subtitle =>
      'Answer both questions and choose a new password.';

  @override
  String get forgotPasswordDoneSubtitle =>
      'You can now sign in with your new password.';

  @override
  String get accountEmailLabel => 'Account email';

  @override
  String get emailRequiredShort => 'Email required';

  @override
  String get answerRequiredShort => 'Answer required';

  @override
  String get newPasswordLabel => 'New password';

  @override
  String get confirmNewPasswordLabel => 'Confirm new password';

  @override
  String get resetPasswordButton => 'Reset password';

  @override
  String get goToSignIn => 'Go to sign in';

  @override
  String get backLabel => 'Back';

  @override
  String get resetPasswordTitle => 'Reset password';

  @override
  String get resetPasswordInvalidLink =>
      'Invalid reset link. Please request a new one from the sign-in page.';

  @override
  String get resetPasswordSuccess =>
      'Your password has been reset. You can now sign in.';

  @override
  String get chooseNewPassword => 'Choose a new password';

  @override
  String get resetButton => 'Reset';

  @override
  String get changePasswordRequiredTitle => 'Password change required';

  @override
  String get changePasswordRequiredBody =>
      'Your password was set by an administrator. Choose a new one to continue.';

  @override
  String get temporaryPasswordLabel => 'Temporary password';

  @override
  String get temporaryPasswordRequired => 'Temporary password required';

  @override
  String get changePasswordButton => 'Change password';

  @override
  String get verifyingInProgress => 'Verifying…';

  @override
  String get emailVerifiedTitle => 'Email address verified';

  @override
  String get verificationFailedTitle => 'Verification failed';

  @override
  String get invalidVerificationLink =>
      'Invalid verification link. Please request a new one from your account.';

  @override
  String get activeCampaignsTitle => 'Active campaigns';

  @override
  String get updatedToday => 'Updated today';

  @override
  String get updatedYesterday => 'Updated yesterday';

  @override
  String updatedDaysAgo(int days) {
    return 'Updated $days days ago';
  }

  @override
  String get noDeclarationsYet => 'No declarations yet';

  @override
  String get workersCurrentlyDeclared => 'Workers currently declared';

  @override
  String get newDeclarationCta => 'New declaration';

  @override
  String activeDeclarationsCount(int count, String lastUpdated) {
    return '$count active declarations · $lastUpdated';
  }

  @override
  String get declarationsFiledTitle => 'Declarations filed';

  @override
  String approvedCountSubtitle(int count) {
    return '↑ $count approved';
  }

  @override
  String get awaitingApprovalTitle => 'Awaiting approval';

  @override
  String get underReview => 'Under review';

  @override
  String get allUpToDate => 'All up to date';

  @override
  String get onefopApproved => 'Approved';

  @override
  String get onefopUnderReview => 'Under review';

  @override
  String get onefopRejected => 'Rejected';

  @override
  String get onefopCorrections => 'Corrections';

  @override
  String get onefopDraft => 'Draft';

  @override
  String get onefopNotSubmitted => 'Not submitted';

  @override
  String get onefopValidatedSubtitle => '↑ Questionnaire validated';

  @override
  String get onefopPendingMinefopSubtitle => '↑ Pending MINEFOP review';

  @override
  String get onefopCorrectionsRequiredSubtitle => '↓ Corrections required';

  @override
  String get onefopModificationsRequestedSubtitle => '↓ Changes requested';

  @override
  String get onefopFinalizeSubtitle => '→ Finalize and submit';

  @override
  String get onefopRequiredSubtitle => '→ Questionnaire required';

  @override
  String establishmentIdInline(String id) {
    return 'Establishment ID: $id';
  }

  @override
  String get submissionSuccessTitle => 'Submission successful!';

  @override
  String get submissionSuccessSubtitle =>
      'Your ONEFOP form has been submitted successfully.';

  @override
  String get connectionUnavailableTitle => 'Connection unavailable';

  @override
  String get queuedOfflineSubtitle =>
      'Your form was saved on this device and will be sent automatically once you\'re back online.';

  @override
  String get doneButton => 'Done';

  @override
  String get welcomeHeading => 'Welcome';

  @override
  String get welcomeSubtitle =>
      'Director / Promoter, please complete the questionnaire below for your establishment.';

  @override
  String welcomeHeadingPersonalized(String name) {
    return 'Welcome, $name';
  }

  @override
  String welcomeSubtitlePersonalized(String function) {
    return 'As $function, please complete the questionnaire below for your establishment.';
  }

  @override
  String get legalNoticeTitle =>
      'COLLECTION OF DATA ON JOBS CREATED BY THE MODERN ECONOMY';

  @override
  String questionnaireBadge(String label) {
    return '- Questionnaire $label -';
  }

  @override
  String get entityShortOng => 'NGO';

  @override
  String get entityShortEnterprise => 'ENTERPRISE';

  @override
  String get entityShortCooperative => 'COOPERATIVE';

  @override
  String get entityShortCtd => 'TCC';

  @override
  String get entityShortVocationalTraining => 'VTC';

  @override
  String get confidentialityNoticeHeading => 'Confidential Notice';

  @override
  String get confidentialityNoticeBody =>
      'The information contained in this document is confidential and may not be used for legal proceedings, fiscal control or economic repression, in accordance with Law N° 2020/010 of 20 July 2020 on censuses and statistical surveys.';

  @override
  String get legalFooterLawReference => 'Law N° 2020/010 of 20 July 2020';

  @override
  String get acknowledgeCheckboxLabel => 'I acknowledge this notice';

  @override
  String get beginButton => 'Begin';

  @override
  String get goBackButton => 'Go Back';

  @override
  String get estimatedTimeCaption => 'Estimated time: 20-30 minutes';

  @override
  String onefopApprovedActivity(int year) {
    return 'ONEFOP $year approved';
  }

  @override
  String get validatedByMinefop => 'Validated by MINEFOP';

  @override
  String onefopSubmittedActivity(int year) {
    return 'ONEFOP $year submitted';
  }

  @override
  String get pendingMinefop => 'Pending MINEFOP';

  @override
  String onefopRejectedActivity(int year) {
    return 'ONEFOP $year rejected';
  }

  @override
  String get correctionsRequired => 'Corrections required';

  @override
  String onefopToCorrectActivity(int year) {
    return 'ONEFOP $year to correct';
  }

  @override
  String get modificationsRequested => 'Changes requested';

  @override
  String get dateUnknown => 'Date unknown';

  @override
  String dsmoApprovedTitle(int year) {
    return 'DSMO Q$year approved';
  }

  @override
  String get dsmoApprovedSubtitle => 'Validated by MINEFOP';

  @override
  String get dsmoApprovedBadge => 'Approved';

  @override
  String dsmoPendingFinalTitle(int year) {
    return 'DSMO Q$year pending';
  }

  @override
  String get dsmoPendingFinalSubtitle => 'Awaiting final validation';

  @override
  String get dsmoPendingFinalBadge => 'In progress';

  @override
  String dsmoDivisionReviewTitle(int year) {
    return 'DSMO Q$year under review';
  }

  @override
  String get dsmoDivisionReviewSubtitle => 'Awaiting regional review';

  @override
  String get dsmoDivisionReviewBadge => 'Review';

  @override
  String dsmoSubmittedTitle(int year) {
    return 'DSMO Q$year submitted';
  }

  @override
  String get dsmoSubmittedSubtitle => 'Pending review';

  @override
  String get dsmoSubmittedBadge => 'Submitted';

  @override
  String dsmoDraftTitle(int year) {
    return 'DSMO Q$year draft';
  }

  @override
  String get dsmoDraftSubtitle => 'Not finalized';

  @override
  String get dsmoDraftBadge => 'Draft';

  @override
  String dsmoRejectedTitle(int year) {
    return 'DSMO Q$year rejected';
  }

  @override
  String get dsmoRejectedSubtitle => 'Corrections needed';

  @override
  String get dsmoRejectedBadge => 'Rejected';

  @override
  String get noDeclarationsTitle => 'No declarations';

  @override
  String get noDeclarationsSubtitle => 'Start by creating a DSMO declaration';

  @override
  String get emptyBadge => 'Empty';

  @override
  String get recentActivityTitle => 'Recent activity';

  @override
  String get viewAllLink => 'View all →';

  @override
  String get menLabel => 'Men';

  @override
  String get womenLabel => 'Women';

  @override
  String get genderDistributionTitle => 'Gender distribution';

  @override
  String get employeesLabel => 'employees';

  @override
  String get genderDistributionUnavailable =>
      'Gender distribution not provided';

  @override
  String get loadingErrorTitle => 'Loading error';

  @override
  String get campaignFallbackName => 'Campaign';

  @override
  String periodLabel(String period) {
    return 'Period: $period';
  }

  @override
  String periodUntil(String date) {
    return 'until $date';
  }

  @override
  String periodSince(String date) {
    return 'since $date';
  }

  @override
  String get periodUndefined => 'not set';

  @override
  String get deadlineUndefined => 'Deadline not set';

  @override
  String get deadlinePassed => 'Deadline passed';

  @override
  String get remainingLabel => 'remaining';

  @override
  String get campaignManagementTitle => 'Campaign Management';

  @override
  String get refreshTooltip => 'Refresh';

  @override
  String get newCampaignButton => 'New campaign';

  @override
  String get allFilter => 'All';

  @override
  String get campaignColumnHeader => 'Campaign';

  @override
  String get nameColumnHeader => 'Name';

  @override
  String get statusColumnHeader => 'Status';

  @override
  String get actionColumnHeader => 'Action';

  @override
  String get unnamedCampaign => 'Unnamed';

  @override
  String get activateTooltip => 'Activate';

  @override
  String get deactivateTooltip => 'Deactivate';

  @override
  String get editTooltip => 'Edit';

  @override
  String get deleteTooltip => 'Delete';

  @override
  String get moreActionsTooltip => 'More actions';

  @override
  String get closeAction => 'Close';

  @override
  String get extendDeadlineAction => 'Extend deadline';

  @override
  String get sendReminderAction => 'Send reminder';

  @override
  String get campaignActivatedMsg => 'Campaign activated.';

  @override
  String get campaignDeactivatedMsg => 'Campaign deactivated.';

  @override
  String get campaignClosedMsg => 'Campaign closed.';

  @override
  String get deadlineExtendedMsg => 'Deadline extended.';

  @override
  String get reminderSentMsg => 'Reminder sent.';

  @override
  String get campaignDeletedMsg => 'Campaign deleted.';

  @override
  String get campaignCreatedMsg => 'Campaign created successfully';

  @override
  String get cancelButton => 'Cancel';

  @override
  String get sendButton => 'Send';

  @override
  String get deleteCampaignTitle => 'Delete campaign?';

  @override
  String get deleteCampaignBody =>
      'This action is irreversible and will also delete all associated submissions.';

  @override
  String get deleteButton => 'Delete';

  @override
  String get noCampaignsTitle => 'No campaigns';

  @override
  String get noCampaignsSubtitle => 'Click + to create a campaign';

  @override
  String get generalInfoSection => 'General information';

  @override
  String get campaignNameHelper =>
      'The official name also determines which form opens for targeted establishments once the campaign is active.';

  @override
  String get campaignNameFieldLabel => 'Campaign name *';

  @override
  String get descriptionOptionalLabel => 'Description (optional)';

  @override
  String get campaignTypeSection => 'Campaign type';

  @override
  String get periodSection => 'Period';

  @override
  String get startDateLabel => 'Start date *';

  @override
  String get deadlineFieldLabel => 'Deadline *';

  @override
  String get targetEntityTypesSection => 'Targeted entity types';

  @override
  String get targetRegionsSection => 'Targeted regions & departments';

  @override
  String get regionsHelper =>
      'Select regions. Expand a region to target specific departments.';

  @override
  String get autoRemindersSection => 'Automatic reminders';

  @override
  String get enableRemindersTitle => 'Enable reminders';

  @override
  String get enableRemindersSubtitle =>
      'Send reminders to establishments before the deadline';

  @override
  String get remindersAtLabel => 'Reminders at D-:';

  @override
  String get daySuffix => 'd';

  @override
  String get bothDatesRequiredError => 'Please select both dates.';

  @override
  String get deadlineAfterStartError =>
      'The deadline must be after the start date.';

  @override
  String get campaignAlreadyActiveTitle => 'Campaign already active';

  @override
  String campaignConflictBody(String label, String name, String deadline) {
    return 'A \"$label\" campaign is already active: \"$name\" (deadline $deadline).\n\nCreating this new campaign will close the previous one and open this one in its place. Continue?';
  }

  @override
  String get continueButton => 'Continue';

  @override
  String get createCampaignButton => 'Create campaign';

  @override
  String get campaignPausedMsg => 'Campaign paused.';

  @override
  String get typeLabel => 'Type';

  @override
  String get collectionLabel => 'Collection';

  @override
  String get startLabel => 'Start';

  @override
  String get deadlineInfoLabel => 'Deadline';

  @override
  String get extendedDeadlineLabel => 'Extended deadline';

  @override
  String get createdByLabel => 'Created by';

  @override
  String codeLabelPrefix(String code) {
    return 'Code: $code';
  }

  @override
  String get progressTitle => 'Progress';

  @override
  String completedPercent(String rate) {
    return '$rate% completed';
  }

  @override
  String get submittedLabel => 'Submitted';

  @override
  String get inProgressLabel => 'In progress';

  @override
  String get notStartedLabel => 'Not started';

  @override
  String get targetingTitle => 'Targeting';

  @override
  String get regionsLabel => 'Regions';

  @override
  String get departmentsLabel => 'Departments';

  @override
  String get entityTypesLabel => 'Entity types';

  @override
  String get allNoRestriction => 'All (no restriction)';

  @override
  String get noneLabel => 'None';

  @override
  String get allMasculine => 'All';

  @override
  String autoRemindersEnabled(String days) {
    return 'Automatic reminders enabled ($days)';
  }

  @override
  String get dayPrefix => 'D-';

  @override
  String get autoRemindersDisabled => 'Automatic reminders disabled';

  @override
  String get reminderHistoryTitle => 'Reminder history';

  @override
  String get noRemindersYet => 'No reminders sent yet.';

  @override
  String reminderStatsWithFailures(int sent, int failed, String date) {
    return '$sent recipients · $failed failures · $date';
  }

  @override
  String reminderStatsNoFailures(int sent, String date) {
    return '$sent recipients · $date';
  }

  @override
  String get submissionsTitle => 'Submissions';

  @override
  String get noSubmissions => 'No submissions.';

  @override
  String get unknownCompany => 'Unknown company';

  @override
  String get dateUndefined => 'Not set';

  @override
  String get editCampaignTitle => 'Edit campaign';

  @override
  String get editCampaignHelper =>
      'The name, campaign type, collection type, and start date cannot be changed after creation.';

  @override
  String get reminderDaysLabel => 'Reminder days (D-)';

  @override
  String get saveButton => 'Save';

  @override
  String get deadlineRequiredError => 'Please select a deadline.';

  @override
  String get exportButtonLabel => 'Export';

  @override
  String get exportDialogTitle => 'Export dashboard';

  @override
  String get exportDialogButton => 'Export';

  @override
  String get exportSectionFilters => 'Filters';

  @override
  String get exportSectionSummary => 'Summary';

  @override
  String get exportSectionBenchmarking => 'Benchmarking';

  @override
  String get exportSectionLaborMarket => 'Labor market';

  @override
  String get exportSectionWorkforceStructure => 'Recruitment structure';

  @override
  String get exportSectionRecruitmentInsertion => 'Recruitment & Placement';

  @override
  String get exportSectionMobilityRetention => 'Mobility & Retention';

  @override
  String get exportSectionInclusion => 'Inclusion';

  @override
  String get exportSectionCompetencesFormation => 'Skills & Training';

  @override
  String get exportDescFilters =>
      'Includes period, region, and sector settings.';

  @override
  String get exportDescSummary =>
      'Includes the main indicators and charts from the Summary dashboard.';

  @override
  String get exportDescBenchmarking =>
      'Export of the regional/national Benchmarking dashboard.';

  @override
  String get exportDescLaborMarket =>
      'Export of labor market tensions and recruitments.';

  @override
  String get exportDescWorkforceStructure =>
      'Export of recruitment structure and entity types.';

  @override
  String get exportDescRecruitmentInsertion =>
      'Export of first-time recruitments and the conversion rate.';

  @override
  String get exportDescMobilityRetention =>
      'Export of departures, reasons, and retention rates.';

  @override
  String get exportDescInclusion =>
      'Export of inclusion and parity indicators.';

  @override
  String get exportDescCompetencesFormation =>
      'Export of sought-after skills and the training pipeline.';

  @override
  String get chartFiltersApplied => 'Applied filters';

  @override
  String get chartSummaryKpis => 'Key indicators';

  @override
  String get chartSummaryTrend => 'Employment trend';

  @override
  String get chartSummarySector => 'Sector performance';

  @override
  String get chartSummaryBalance => 'Labor dynamics';

  @override
  String get chartSummaryGender => 'Gender (applications)';

  @override
  String get chartSummaryYoy => 'Year-over-year trend';

  @override
  String get chartBenchmarkingTable => 'Regional comparison';

  @override
  String get chartLaborIndicators => 'Labor market indicators';

  @override
  String get chartLaborCsp => 'Recruitments by occupational category';

  @override
  String get chartStructureEntity => 'Entity type breakdown';

  @override
  String get chartStructureSize => 'Company size breakdown';

  @override
  String get chartStructureCsp => 'Recruitment occupational-category pyramid';

  @override
  String get chartStructureDiploma => 'Recruitment diplomas';

  @override
  String get chartStructureSector => 'Vacancies by sector';

  @override
  String get chartRecruitmentIndicators => 'Recruitment indicators';

  @override
  String get chartRecruitmentAge => 'Age of recruits';

  @override
  String get chartMobility => 'Departure reasons';

  @override
  String get chartInclusionRegion => 'Regional breakdown';

  @override
  String get chartInclusionVulnerable => 'Vulnerable inclusion';

  @override
  String get chartInclusionYouth => 'Youth employment';

  @override
  String get chartCompetencesSkills => 'Sought-after skills';

  @override
  String get chartCompetencesTraining => 'Requested training';

  @override
  String get pdfExportTitle => 'Employment Observatory — Export';

  @override
  String pdfExportDate(String date) {
    return 'Export date: $date';
  }

  @override
  String get pdfFieldHeader => 'Field';

  @override
  String get pdfValueHeader => 'Value';

  @override
  String get pdfPeriodLabel => 'Period';

  @override
  String get pdfRegionLabel => 'Region';

  @override
  String get pdfNationalFallback => 'National';

  @override
  String get pdfDepartmentLabel => 'Division';

  @override
  String get pdfSubdivisionLabel => 'Subdivision';

  @override
  String get pdfEntityTypeLabel => 'Entity type';

  @override
  String get pdfSectorLabel => 'Sector';

  @override
  String get pdfDeclarationsLabel => 'Declarations';

  @override
  String get pdfTotalWorkforceLabel => 'Total workforce';

  @override
  String get pdfRecruitmentsLabel => 'Recruitments';

  @override
  String get pdfDeparturesLabel => 'Departures';

  @override
  String get pdfNetChangeLabel => 'Net change';

  @override
  String get pdfGrowthLabel => 'Growth';

  @override
  String get pdfLeadingSectorLabel => 'Leading sector';

  @override
  String get pdfNotApplicable => 'N/A';

  @override
  String get pdfIndicatorHeader => 'Indicator';

  @override
  String get pdfWorkforceHeader => 'Workforce';

  @override
  String get pdfEmployeesCountHeader => 'Employees';

  @override
  String get pdfDismissalsLabel => 'Dismissals';

  @override
  String get pdfResignationsLabel => 'Resignations';

  @override
  String get pdfRetirementsLabel => 'Retirements';

  @override
  String get pdfJobsCreatedLabel => 'Jobs created';

  @override
  String get pdfJobsLostLabel => 'Jobs lost';

  @override
  String get pdfDepartureDetailTitle => 'Departure detail';

  @override
  String get pdfReasonHeader => 'Reason';

  @override
  String pdfTechnicalUnemploymentNote(int count) {
    return '$count on technical unemployment (excluded from total).';
  }

  @override
  String get pdfNetBalanceLabel => 'Net balance';

  @override
  String get pdfGenderDistributionTitle => 'Male/Female breakdown';

  @override
  String pdfMenCountLine(num count, String pct) {
    return 'Men: $count ($pct%)';
  }

  @override
  String pdfWomenCountLine(num count, String pct) {
    return 'Women: $count ($pct%)';
  }

  @override
  String get pdfBenchmarkingTitle => 'Regional benchmarking';

  @override
  String get pdfBenchmarkingEmptyHint =>
      'Select a region, department, or subdivision to compare against the national level.';

  @override
  String get pdfNationalComparisonNote =>
      'The national comparison is not included in the current export.';

  @override
  String get pdfLocalValueHeader => 'Local value';

  @override
  String get pdfRemarkHeader => 'Note';

  @override
  String get pdfDeclaringCompaniesLabel => 'Declaring companies';

  @override
  String get pdfVacanciesLabel => 'Vacancies';

  @override
  String get pdfGapLabel => 'Gap';

  @override
  String get pdfAbsorptionRateLabel => 'Absorption rate';

  @override
  String get pdfCspHeader => 'Occupational category';

  @override
  String get pdfShareHeader => 'Share';

  @override
  String get pdfTypeHeader => 'Type';

  @override
  String get pdfDeclarantsHeader => 'Declarants';

  @override
  String get pdfEnterprisesLabel => 'Companies';

  @override
  String get pdfCooperativesLabel => 'Cooperatives';

  @override
  String get pdfCtdLabel => 'RLA';

  @override
  String get pdfOngLabel => 'NGO';

  @override
  String get pdfSizeHeader => 'Size';

  @override
  String get pdfCountHeader => 'Count';

  @override
  String get pdfVerySmallEnterprise => 'Micro enterprise';

  @override
  String get pdfSmallEnterprise => 'Small enterprise';

  @override
  String get pdfMediumEnterprise => 'Medium enterprise';

  @override
  String get pdfLargeEnterprise => 'Large enterprise';

  @override
  String get pdfExecutivesLabel => 'Executives';

  @override
  String get pdfForemenLabel => 'Foremen';

  @override
  String get pdfWorkersLabel => 'Workers';

  @override
  String get pdfLevelHeader => 'Level';

  @override
  String get pdfSeekersRegisteredLabel => 'Registered applications';

  @override
  String get pdfFirstRecruitsLabel => 'First-time recruits';

  @override
  String get pdfConversionRateLabel => 'Conversion rate';

  @override
  String get pdfPermanentLabel => 'Permanent';

  @override
  String get pdfTemporaryLabel => 'Temporary';

  @override
  String get pdfAgeRangeHeader => 'Age range';

  @override
  String get pdfOtherLabel => 'Other';

  @override
  String get pdfVulnerablePeopleLabel => 'Vulnerable individuals';

  @override
  String get pdfTotalRecruitmentsLabel => 'Total recruitments';

  @override
  String get pdfRecruits1534Label => 'Recruitments 15-34';

  @override
  String get pdfTotalRecruitmentsLabel2 => 'Total recruitments';

  @override
  String get pdfSkillHeader => 'Skill';

  @override
  String get pdfDemandHeader => 'Demand';

  @override
  String get pdfSupplyHeader => 'Supply';

  @override
  String get pdfTrainingHeader => 'Training';

  @override
  String get pdfNoDataAvailable => 'No data available';

  @override
  String pdfExportError(String error) {
    return 'Export failed: $error';
  }

  @override
  String get companyDeclDraftsFilter => 'Drafts';

  @override
  String get companyDeclApprovedFilter => 'Approved';

  @override
  String get companyDeclRejectedFilter => 'Rejected';

  @override
  String get companyDeclFiliereColumn => 'Category';

  @override
  String get companyDeclDeclarationColumn => 'Declaration';

  @override
  String get companyDeclDetailsColumn => 'Details';

  @override
  String get companyDeclDateColumn => 'Date';

  @override
  String get companyDeclPdfColumn => 'PDF';

  @override
  String get companyDeclNewButton => 'New';

  @override
  String get companyDeclDownloadPdfTooltip => 'Download PDF';

  @override
  String get companyDeclDownloadPdfError => 'Unable to open PDF';

  @override
  String get companyDeclNoResultsTitle => 'No results';

  @override
  String get companyDeclEmptyTitle => 'No declarations yet';

  @override
  String get companyDeclTryDifferentFilter => 'Try a different filter';

  @override
  String get companyDeclEmptySubtitle =>
      'Your DSMO declarations and ONEFOP questionnaires\nwill appear here, including drafts.';

  @override
  String get companyDeclClearFilter => 'Clear filter';

  @override
  String get companyDeclResumeDraft => 'Resume draft';

  @override
  String companyDeclDsmoTitle(String period) {
    return 'DSMO Declaration $period';
  }

  @override
  String companyDeclOnefopTitle(String period) {
    return 'ONEFOP Questionnaire $period';
  }

  @override
  String get companyDeclStatusDivisionApproved => 'Approved (division)';

  @override
  String get companyDeclStatusRegionApproved => 'Approved (region)';

  @override
  String get companyDeclStatusCorrectionRequested => 'Corrections required';

  @override
  String get companyAnalyticsTabBilanRh => 'HR Report';

  @override
  String get companyAnalyticsTabBenchmarking => 'Benchmarking';

  @override
  String get companyAnalyticsTabOpportunities => 'Opportunities';

  @override
  String get companyAnalyticsBadgeActive => 'Active';

  @override
  String get companyAnalyticsBadgePending => 'Pending';

  @override
  String get companyAnalyticsOpportunitiesTitle => 'Opportunities';

  @override
  String get companyAnalyticsOpportunitiesDescription =>
      'Signals drawn from your own reported data: open positions, gaps versus your sector, training needs, and upcoming deadlines.';

  @override
  String get companyAnalyticsComingSoonBadge => 'Coming soon';

  @override
  String get opportunitiesVacancyTitle => 'Open positions';

  @override
  String opportunitiesVacancyDetail(int vacancies, String rate) {
    String _temp0 = intl.Intl.pluralLogic(
      vacancies,
      locale: localeName,
      other: '$vacancies open positions declared,',
      one: '1 open position declared,',
      zero: 'No open positions declared.',
    );
    return '$_temp0 $rate% of your permanent workforce.';
  }

  @override
  String get opportunitiesBenchmarkGapTitle => 'Gaps versus your sector';

  @override
  String opportunitiesBenchmarkGapWorkforce(int mine, int median) {
    return 'Your workforce ($mine) is below your sector\'s median ($median).';
  }

  @override
  String opportunitiesBenchmarkGapFeminization(String mine, String median) {
    return 'Your feminization rate ($mine%) is below your sector\'s median ($median%).';
  }

  @override
  String opportunitiesBenchmarkGapTurnover(String mine, String median) {
    return 'Your turnover rate ($mine%) is higher than your sector\'s median ($median%).';
  }

  @override
  String get opportunitiesDeadlinesTitle => 'Upcoming deadlines';

  @override
  String opportunitiesDeadlineInDays(String date, int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days days',
      one: '1 day',
      zero: 'less than a day',
    );
    return '$date · in $_temp0';
  }

  @override
  String opportunitiesDeadlinePassed(String date) {
    return '$date · past due';
  }

  @override
  String companyAnalyticsHeaderYear(int year) {
    return 'Analytics $year';
  }

  @override
  String get companyAnalyticsSectionBenchmarking => 'Sector Benchmarking';

  @override
  String get companyAnalyticsBenchmarkingComingTitle => 'Sector benchmarking';

  @override
  String get companyAnalyticsBenchmarkingComingDescription =>
      'Compare your HR indicators with companies in your sector and region. Available once your file is approved and enough companies have submitted their declaration.';

  @override
  String companyAnalyticsPeerGroupCount(String count) {
    return '$count companies in your comparison group';
  }

  @override
  String companyAnalyticsBenchmarkError(String error) {
    return 'Benchmarking error: $error';
  }

  @override
  String get companyAnalyticsTotalWorkforce => 'Total workforce';

  @override
  String get companyAnalyticsRecruitmentsLabel => 'Recruitments';

  @override
  String get companyAnalyticsDeparturesLabel => 'Departures';

  @override
  String get companyAnalyticsUnitEmployees => 'employees';

  @override
  String get companyAnalyticsFeminizationRate => 'Feminization rate';

  @override
  String get companyAnalyticsBilanDeclarationSubtitle =>
      'Data drawn from your approved ONEFOP declaration';

  @override
  String companyAnalyticsBilanAggregatedSubtitle(int quarterCount) {
    return 'Data combined across $quarterCount approved ONEFOP declarations this year';
  }

  @override
  String get companyAnalyticsExportPdfButton => 'Export as PDF';

  @override
  String get companyAnalyticsBilanPdfExportError =>
      'Couldn\'t generate the PDF. Please try again.';

  @override
  String get companyAnalyticsSectionEffectifs => 'Workforce';

  @override
  String get companyAnalyticsPermanentEmployees => 'Permanent employees';

  @override
  String get companyAnalyticsVacantPositions => 'Vacant positions';

  @override
  String get companyAnalyticsTurnoverRate => 'Turnover rate';

  @override
  String get companyAnalyticsHigh => 'High';

  @override
  String get companyAnalyticsNormal => 'Normal';

  @override
  String get companyAnalyticsSectionRecruitmentsByCategory =>
      'Recruitments by category';

  @override
  String get companyAnalyticsSectionInterns => 'Interns';

  @override
  String get companyAnalyticsSectionSkillsTraining => 'Skills & Training';

  @override
  String get companyAnalyticsCategoryHeader => 'Category';

  @override
  String get companyAnalyticsExecutivesRow => 'Executives';

  @override
  String get companyAnalyticsForemenRow => 'Supervisors';

  @override
  String get companyAnalyticsWorkersFieldRow => 'Field workers';

  @override
  String get companyAnalyticsGenderColumnMale => 'M';

  @override
  String get companyAnalyticsGenderColumnFemale => 'F';

  @override
  String companyAnalyticsPercentOfTotal(String pct) {
    return '$pct% of total';
  }

  @override
  String get companyAnalyticsDismissals => 'Dismissals';

  @override
  String get companyAnalyticsResignations => 'Resignations';

  @override
  String get companyAnalyticsRetirements => 'Retirements';

  @override
  String get companyAnalyticsOthers => 'Other';

  @override
  String get companyAnalyticsNoDeparturesRecorded =>
      'No departures recorded for the period.';

  @override
  String get companyAnalyticsTotalDepartures => 'Total departures';

  @override
  String get companyAnalyticsInternshipHoliday => 'Holiday internship';

  @override
  String get companyAnalyticsInternshipAcademic => 'Academic internship';

  @override
  String get companyAnalyticsInternshipProfessional =>
      'Professional internship';

  @override
  String get companyAnalyticsInternshipPreWork => 'Pre-employment internship';

  @override
  String get companyAnalyticsTotalInterns => 'Total interns';

  @override
  String get companyAnalyticsSkillNeeds => 'Skill needs';

  @override
  String get companyAnalyticsTrainingNeeds => 'Training needs';

  @override
  String get companyAnalyticsSocialImpact => 'Social impact';

  @override
  String companyAnalyticsVulnerableWorkersRecruited(
      int count, int displaced, int refugees, int orphans) {
    return '$count vulnerable workers recruited ($displaced displaced, $refugees refugees, $orphans orphans)';
  }

  @override
  String companyAnalyticsDisabledWorkersRecruited(int count) {
    return '$count people with disabilities recruited';
  }

  @override
  String companyAnalyticsPriorityProfilesShare(String pct) {
    return '$pct% of your recruitments involve priority profiles.';
  }

  @override
  String get companyAnalyticsBenchmarkLockedDefault =>
      'Submit the ONEFOP questionnaire to access comparative analytics.';

  @override
  String get companyAnalyticsNoOwnDataTitle => 'Missing DSMO declaration';

  @override
  String companyAnalyticsNoOwnDataDetail(int year) {
    return 'Benchmarking needs an approved annual DSMO declaration for $year. Your ONEFOP questionnaire is approved — the DSMO declaration for the same year is what\'s missing.';
  }

  @override
  String get companyAnalyticsBilanLockedUnderReview =>
      'Your ONEFOP declaration is under review. Your HR report will be available after approval.';

  @override
  String get companyAnalyticsBilanLockedDraft =>
      'You have a draft in progress. Finalize and submit your declaration to access your report.';

  @override
  String get companyAnalyticsBilanLockedDefault =>
      'Submit your ONEFOP declaration to access your personalized HR report.';

  @override
  String get companyAnalyticsBilanLockedWrongYear =>
      'No approved HR report for this year. Pick another year above.';

  @override
  String get companyAnalyticsInsufficientDataTitle =>
      'Insufficient data for benchmarking';

  @override
  String companyAnalyticsInsufficientDataDetail(int count, int min) {
    return '$count companies in your group (minimum $min required).';
  }

  @override
  String companyAnalyticsPercentileTop(int percentile) {
    return 'Top $percentile%';
  }

  @override
  String get companyAnalyticsPercentileMedianPlus => 'Median+';

  @override
  String companyAnalyticsPercentileBottom(int value) {
    return 'Bottom $value%';
  }

  @override
  String get companyAnalyticsYourCompany => 'Your company';

  @override
  String get companyAnalyticsSectorMedian => 'Sector median';

  @override
  String get homeTabLabel => 'Home';

  @override
  String get onlineStatusLabel => 'Online';

  @override
  String get roleLabelCompany => 'Establishment';

  @override
  String settingsUpdatePreferenceError(String error) {
    return 'Unable to update this setting: $error';
  }

  @override
  String get settingsTabGeneral => 'General';

  @override
  String get settingsTabNotifications => 'Notifications';

  @override
  String get settingsTabSecurity => 'Security';

  @override
  String get settingsTabIntegrations => 'Integrations';

  @override
  String get settingsPageTitle => 'Settings';

  @override
  String get settingsPageSubtitle => 'Configure your organization and account';

  @override
  String get settingsGeneralCardTitle => 'General information';

  @override
  String get settingsGeneralCardSubtitle =>
      'Update your organization\'s information';

  @override
  String get settingsFieldEstablishmentName => 'Organization name';

  @override
  String get settingsFieldContactEmail => 'Contact email';

  @override
  String get settingsFieldSiret => 'Registration number';

  @override
  String get settingsFieldPhone => 'Phone';

  @override
  String get settingsFieldAddress => 'Full address';

  @override
  String get settingsNotificationsCardTitle => 'Notification preferences';

  @override
  String get settingsNotificationsCardSubtitle =>
      'Choose how you want to be notified';

  @override
  String get settingsToggleEmailTitle => 'Email notifications';

  @override
  String get settingsToggleEmailSubtitle =>
      'Receive an email for each new declaration';

  @override
  String get settingsToggleRealtimeTitle => 'Real-time alerts';

  @override
  String get settingsToggleRealtimeSubtitle =>
      'Browser push notifications (preference saved — push channel coming soon)';

  @override
  String get settingsToggleWeeklyTitle => 'Weekly reports';

  @override
  String get settingsToggleWeeklySubtitle =>
      'Receive a summary every Monday morning';

  @override
  String get settingsToggleSmsTitle => 'SMS notifications';

  @override
  String get settingsToggleSmsSubtitle =>
      'Urgent alerts by text message (preference saved — SMS channel coming soon)';

  @override
  String get settingsSecurityCardTitle => 'Account security';

  @override
  String get settingsSecurityCardSubtitle =>
      'Protect access to your DSMO workspace';

  @override
  String get settingsFieldCurrentPassword => 'Current password';

  @override
  String get settingsFieldNewPassword => 'New password';

  @override
  String get settingsPasswordHint => 'Min. 8 characters';

  @override
  String get settingsToggle2faTitle => 'Two-factor authentication (2FA)';

  @override
  String get settingsToggle2faSubtitle =>
      'Require a verification code sent by email at each sign-in';

  @override
  String get settingsPasswordRequirements =>
      'Your password must contain at least 8 characters, one uppercase letter, and one digit.';

  @override
  String get settingsIntegrationsCardSubtitle =>
      'Connect DSMO to your external tools';

  @override
  String get settingsIntegrationSlackDesc =>
      'Receive alerts in your Slack channel';

  @override
  String get settingsIntegrationTeamsDesc => 'Notifications directly in Teams';

  @override
  String get settingsIntegrationCalendarDesc => 'Sync regulatory deadlines';

  @override
  String get settingsIntegrationWebhookDesc =>
      'Send data to your custom endpoint';

  @override
  String get settingsDangerZoneTitle => 'Danger zone';

  @override
  String get settingsDangerZoneSubtitle =>
      'Irreversible actions on your account';

  @override
  String get settingsDeleteAccountTitle => 'Delete account';

  @override
  String get settingsDeleteAccountDesc =>
      'Your account will be deactivated immediately and you\'ll be logged out. You won\'t be able to log back in without an administrator. Your submitted declarations remain on file, as required for regulatory record-keeping.';

  @override
  String get settingsDeleteButton => 'Delete';

  @override
  String get settingsConfirmDeleteTitle => 'Confirm deletion';

  @override
  String get settingsConfirmDeleteBody =>
      'This action is irreversible. Your account will be deactivated and you\'ll be signed out right away. Your declarations are kept on file for compliance.';

  @override
  String settingsDeleteAccountError(Object error) {
    return 'Couldn\'t delete your account: $error';
  }

  @override
  String get settingsConnectedBadge => 'Connected';

  @override
  String get settingsConnectButton => 'Connect';

  @override
  String get settingsSaveButton => 'Save';

  @override
  String get settingsProfileSaved =>
      'Your organization\'s information has been updated.';

  @override
  String settingsProfileSaveError(Object error) {
    return 'Couldn\'t save your changes: $error';
  }

  @override
  String get settingsPasswordChanged => 'Your password has been changed.';

  @override
  String settingsPasswordChangeError(Object error) {
    return 'Couldn\'t change your password: $error';
  }

  @override
  String get settingsPasswordFieldsRequired =>
      'Enter your current password and a new one.';

  @override
  String get settingsContactEmailReadOnlyHint =>
      'This is your sign-in email. Contact an administrator to change it.';

  @override
  String get settingsRegistrationNumberReadOnlyHint =>
      'Assigned during registration — can\'t be edited here.';

  @override
  String get declarationsTabLabel => 'Declarations';

  @override
  String get analyticsTabLabel => 'Analytics';

  @override
  String get settingsTabLabel => 'Settings';

  @override
  String get draftFoundTitle => 'Draft found';

  @override
  String get draftFoundBody =>
      'You have an ONEFOP form in progress. Would you like to resume where you left off?';

  @override
  String get resumeDraftSubtitle => 'Continue with your previous data';

  @override
  String get startOverTitle => 'Start over';

  @override
  String get startOverSubtitle => 'Clear the draft and start fresh';

  @override
  String get entityTypeDialogTitle => 'Entity type';

  @override
  String get entityTypeDialogBody =>
      'Select your entity type to access the ONEFOP form.';

  @override
  String get entityTypeEnterprise => 'Enterprise';

  @override
  String get entityTypeCooperative => 'Cooperative';

  @override
  String get entityTypeCtd => 'RLA';

  @override
  String get entityTypeOng => 'NGO';

  @override
  String get newSubmissionDialogTitle => 'New submission';

  @override
  String get newSubmissionDialogBody => 'Choose the type of document to create';

  @override
  String get dsmoDeclarationOptionTitle => 'DSMO Declaration';

  @override
  String get dsmoDeclarationOptionSubtitle => 'Workforce social declaration';

  @override
  String get onefopQuestionnaireOptionTitle => 'ONEFOP Questionnaire';

  @override
  String get onefopQuestionnaireOptionSubtitle => 'Labor market information';

  @override
  String get companyProfileNotFoundError =>
      'Company profile not found. Contact the administrator.';

  @override
  String get missingEstablishmentIdError =>
      'Missing establishment ID. Please contact the administrator.';

  @override
  String get noOpenSubmissionPeriodError =>
      'No submission period is currently open.';

  @override
  String get unknownEntityTypeError =>
      'Unrecognized entity type. Please contact the administrator.';

  @override
  String profileLoadError(String error) {
    return 'Error loading profile: $error';
  }

  @override
  String get noOpenDsmoPeriodError =>
      'No DSMO declaration period is currently open.';

  @override
  String get attestationOpenError => 'Unable to open the certificate.';

  @override
  String get attestationUnavailableError =>
      'No certificate is available for this account.';

  @override
  String get attestationMenuLabel => 'My registration certificate';

  @override
  String get adminResetPasswordTitle => 'Reset a password';

  @override
  String get adminResetPasswordInstructions =>
      'First verify the user\'s identity through an official channel (phone, in person), then send them a password reset link by email.';

  @override
  String get adminResetPasswordEmailFieldLabel => 'User account email';

  @override
  String get emailInvalidShort => 'Invalid email';

  @override
  String get adminResetPasswordSendButton => 'Send a reset link';

  @override
  String adminResetPasswordSentMessage(String email) {
    return 'A reset link has been sent to $email.';
  }

  @override
  String get adminResetPasswordLinkExpiryNote =>
      'The link expires in 45 minutes and can only be used once.';

  @override
  String get adminResetPasswordSendAnotherButton => 'Send another link';

  @override
  String get annuaireUsersTabLabel => 'Users';

  @override
  String get annuaireEntitiesTabLabel => 'Entities';

  @override
  String get companiesSearchHint => 'Search by name, tax ID, ID, region...';

  @override
  String companiesTotalCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count companies',
      one: '1 company',
      zero: 'No companies',
    );
    return '$_temp0';
  }

  @override
  String get companiesCreatedAtColumnHeader => 'Created on';

  @override
  String get companiesContactColumnHeader => 'Contact';

  @override
  String get companiesSuspendedBadge => 'Suspended';

  @override
  String companiesPaginationLabel(int page, int totalPages) {
    return 'Page $page of $totalPages';
  }

  @override
  String get companiesEmptyTitle => 'No companies found';

  @override
  String get companiesEmptySubtitle => 'Try a different search.';

  @override
  String companiesGenderBreakdownMenCount(num count) {
    return '$count men';
  }

  @override
  String companiesGenderBreakdownWomenCount(num count) {
    return '$count women';
  }

  @override
  String get companiesDetailIdentitySectionTitle => 'Identity';

  @override
  String get companiesMainActivityLabel => 'Main activity';

  @override
  String get companiesLegalStatusLabel => 'Legal status';

  @override
  String get companiesRegistrationNumberLabel => 'Registration no.';

  @override
  String get companiesCnpsNumberLabel => 'CNPS no.';

  @override
  String get companiesYearOfCreationLabel => 'Year founded';

  @override
  String get companiesEnterpriseSizeLabel => 'Company size';

  @override
  String get companiesRegisteredOnLabel => 'Registered on';

  @override
  String get companiesSubdivisionLabel => 'Subdivision';

  @override
  String get companiesAddressLabel => 'Address';

  @override
  String get companiesDetailContactSectionTitle => 'Company contact';

  @override
  String get companiesAccountStatusLabel => 'Account status';

  @override
  String get companiesDetailRespondentSectionTitle => 'Respondent';

  @override
  String get companiesGenderBreakdownRowLabel => 'Breakdown';

  @override
  String get companiesPreviousYearWorkforceLabel => 'Previous year workforce';

  @override
  String get companiesPreviousYearBreakdownLabel => 'Breakdown (previous year)';

  @override
  String get createMinefopUserLoadFunctionsError => 'Unable to load functions.';

  @override
  String get createMinefopUserSelectRoleError => 'Please select a role';

  @override
  String get createMinefopUserAppBarTitle => 'New MINEFOP agent';

  @override
  String get createMinefopUserFirstNameLabel => 'First name';

  @override
  String get createMinefopUserProfessionalEmailLabel => 'Professional email';

  @override
  String get createMinefopUserRoleSectionLabel => 'Role';

  @override
  String get createMinefopUserSelectRoleHint => 'Select a role';

  @override
  String get createMinefopUserPositionSectionLabel => 'Position';

  @override
  String get createMinefopUserMatriculeLabel => 'Staff number';

  @override
  String get createMinefopUserCreateAccountButton => 'Create account';

  @override
  String get createMinefopUserLoadingFunctions => 'Loading functions…';

  @override
  String get createMinefopUserNoFunctionsAvailable =>
      'No functions available for this role.';

  @override
  String get createMinefopUserSelectFunctionHint => 'Select the function';

  @override
  String get createMinefopUserLoadingUnits => 'Loading units…';

  @override
  String get createMinefopUserNoUnitsAvailable => 'No units available.';

  @override
  String get createMinefopUserParentUnitHint => 'Parent unit';

  @override
  String get createMinefopUserLoadingServices => 'Loading services…';

  @override
  String get createMinefopUserNoServiceFound =>
      'No service found under this unit.';

  @override
  String get createMinefopUserExactServiceHint => 'Exact service';

  @override
  String get createMinefopUserLoadingRegions => 'Loading regions…';

  @override
  String get createMinefopUserSelectRegionFirstNote => 'Select a region first.';

  @override
  String get createMinefopUserLoadingDepartments => 'Loading departments…';

  @override
  String createMinefopUserCopiedToast(String label) {
    return '$label copied';
  }

  @override
  String get createMinefopUserAccountCreatedTitle => 'Account created';

  @override
  String get createMinefopUserCredentialsWarning =>
      'This temporary password will never be shown again. Pass it on to the agent (WhatsApp, phone, in person) — they will have to change it on first login.';

  @override
  String get createMinefopUserDoneButton => 'Done';

  @override
  String get createMinefopUserCopyTooltip => 'Copy';

  @override
  String get landingConfigRestoreDialogTitle => 'Restore this version?';

  @override
  String get landingConfigRestoreDialogBody =>
      'The public landing page will be immediately replaced with this version\'s content. The current state is itself saved and can be restored afterwards.';

  @override
  String get landingConfigRestoreButton => 'Restore';

  @override
  String get landingConfigVersionRestoredToast => 'Version restored';

  @override
  String landingConfigRestoreFailedToast(String error) {
    return 'Restore failed: $error';
  }

  @override
  String get landingConfigUpdatedToast => 'Landing page updated';

  @override
  String landingConfigSaveFailedToast(String error) {
    return 'Save failed: $error';
  }

  @override
  String get landingConfigAppBarTitle => 'Public landing page';

  @override
  String get landingConfigDescriptionNote =>
      'Narrative content of the public landing page (SIMT / CAMLEAP program): status, supporting line, components, Collect / Integrate / Analyse / Inform pillars, program purpose, access call-to-action. SUPER_ADMIN only.';

  @override
  String landingConfigLastModifiedLabel(String date) {
    return 'Last modified: $date';
  }

  @override
  String get landingConfigStatusSectionTitle => 'Program status';

  @override
  String get landingConfigStatusLineFieldLabel =>
      'Status line (below the current component)';

  @override
  String get landingConfigHeroSectionTitle => 'Hero';

  @override
  String get landingConfigMainTitleFieldLabel => 'Main title';

  @override
  String get landingConfigSupportingLineFieldLabel =>
      'Supporting line (below the title)';

  @override
  String get landingConfigComponentsSectionTitle => 'Program components (I-IV)';

  @override
  String get landingConfigCaptionFieldLabel => 'Caption (below the components)';

  @override
  String get landingConfigPillarsSectionTitle =>
      'LMIS pillars (Collect / Integrate / Analyse / Inform)';

  @override
  String landingConfigCardIndexLabel(int index) {
    return 'Card $index';
  }

  @override
  String get landingConfigKickerFieldLabel => 'Kicker (above the title)';

  @override
  String get landingConfigTitleFieldLabel => 'Title';

  @override
  String get landingConfigTextFieldLabel => 'Text';

  @override
  String get landingConfigArchSectionTitle => 'SIMT architecture pipeline';

  @override
  String get landingConfigArchSectionNote =>
      'Currently not shown on the public page — the corresponding section was merged with the \"data → intelligence\" pipeline below. Changes are saved but remain invisible.';

  @override
  String landingConfigStepIndexLabel(int index) {
    return 'Step $index';
  }

  @override
  String get landingConfigIntelSectionTitle => 'Data → intelligence pipeline';

  @override
  String get landingConfigEcosystemSectionTitle => 'Institutional ecosystem';

  @override
  String landingConfigBlockTitleFieldLabel(int index) {
    return 'Block $index — title';
  }

  @override
  String landingConfigBlockTextFieldLabel(int index) {
    return 'Block $index — text';
  }

  @override
  String get landingConfigAboutSectionTitle => 'Program purpose (why an LMIS)';

  @override
  String landingConfigParagraphIndexLabel(int index) {
    return 'Paragraph $index';
  }

  @override
  String get landingConfigObservatorySectionTitle =>
      'Observatory (public /observatory page)';

  @override
  String get landingConfigObservatoryNote =>
      'Provisional content — no final text has been provided yet for the public Observatory. The public page shows a \"content in preparation\" badge as long as this text remains the default copy below.';

  @override
  String get landingConfigDescriptionFieldLabel => 'Description';

  @override
  String landingConfigIndicatorIndexLabel(int index) {
    return 'Indicator $index';
  }

  @override
  String get landingConfigCtaSectionTitle => 'Access call-to-action';

  @override
  String get landingConfigSubtextFieldLabel => 'Subtext';

  @override
  String get landingConfigAccessSectionTitle => 'Platform access';

  @override
  String get landingConfigAccessNoteFieldLabel =>
      'Access note (below the buttons)';

  @override
  String get landingConfigPreviewSectionTitle => 'Preview';

  @override
  String get landingConfigFrChipLabel => 'FR';

  @override
  String get landingConfigEnChipLabel => 'EN';

  @override
  String get landingConfigHistorySectionTitle => 'History (restore)';

  @override
  String get landingConfigNoHistoryMessage => 'No earlier version saved.';

  @override
  String landingConfigComponentShortNameLabel(String roman) {
    return 'Component $roman — short name';
  }

  @override
  String landingConfigComponentDescriptionLabel(String roman) {
    return 'Component $roman — description';
  }

  @override
  String regionsSectorsLoadError(String error) {
    return 'Loading error: $error';
  }

  @override
  String get regionsSectorsAppBarTitle => 'Regions & Sectors';

  @override
  String get regionsSectorsNoResultsSubtitle =>
      'No region or sector matches your search.';

  @override
  String regionsSectorsSectionHeaderWithCount(String title, int count) {
    return '$title ($count)';
  }

  @override
  String get regionsSectorsSectorsLabel => 'Sectors';

  @override
  String get regionsSectorsOnefopSubmissionsStatLabel => 'ONEFOP submissions';

  @override
  String get regionsSectorsSearchHint => 'Search for a region or sector…';

  @override
  String get regionsSectorsAllFilterChip => 'All';

  @override
  String get regionsSectorsActionsColumnHeader => 'Actions';

  @override
  String regionsSectorsDeleteConfirmBody(String itemName) {
    return 'Permanently delete $itemName?';
  }

  @override
  String get regionsSectorsEditRegionDialogTitle => 'Edit region';

  @override
  String get regionsSectorsRegionUpdatedToast => 'Region updated';

  @override
  String regionsSectorsGenericErrorToast(String error) {
    return 'Error: $error';
  }

  @override
  String get regionsSectorsRegionDeletedToast => 'Region deleted';

  @override
  String get regionsSectorsEditSectorDialogTitle => 'Edit sector';

  @override
  String get regionsSectorsSectorUpdatedToast => 'Sector updated';

  @override
  String get regionsSectorsSectorDeletedToast => 'Sector deleted';

  @override
  String get settingsSavedToast => 'Settings saved';

  @override
  String get systemSettingsScreenTitle => 'System settings';

  @override
  String get systemSettingsScreenSubtitle =>
      'Platform-wide configuration. Restricted to SUPER_ADMIN.';

  @override
  String get securityPolicySectionTitle => 'Security policy';

  @override
  String get passwordMinLengthLabel => 'Minimum password length';

  @override
  String get require2faStaffLabel =>
      'Mandatory two-factor authentication (MINEFOP staff)';

  @override
  String get require2faStaffSubtitle =>
      'Prevents non-company accounts from disabling their 2FA.';

  @override
  String get maintenanceModeSectionTitle => 'Maintenance mode';

  @override
  String get enableMaintenanceModeLabel => 'Enable maintenance mode';

  @override
  String get maintenanceModeSubtitle =>
      'Blocks all access except SUPER_ADMIN, showing the message below.';

  @override
  String get maintenanceMessageFieldLabel => 'Message shown to users';

  @override
  String get maintenanceMessageFieldHint =>
      'The platform is currently under maintenance...';

  @override
  String get referenceDataSectionTitle => 'Reference data';

  @override
  String get referenceDataSectionDescription =>
      'Manage the regions/sectors taxonomy used by filters and forms across the platform.';

  @override
  String get manageRegionsSectorsButton => 'Manage regions and sectors';

  @override
  String get userStatusActivePluralLabel => 'Active';

  @override
  String get userStatusSuspendedPluralLabel => 'Suspended';

  @override
  String get userStatusRejectedPluralLabel => 'Rejected';

  @override
  String get approveAgentDialogTitle => 'Approve agent';

  @override
  String approveAgentConfirmBody(String name) {
    return 'Confirm approval of $name?';
  }

  @override
  String get approveActionLabel => 'Approve';

  @override
  String userApprovedToast(String name) {
    return '$name approved successfully';
  }

  @override
  String genericErrorToastNoSpace(String error) {
    return 'Error: $error';
  }

  @override
  String userRejectedToast(String name) {
    return '$name rejected';
  }

  @override
  String userRoleUpdatedToast(String role) {
    return 'Role updated: $role';
  }

  @override
  String get suspendAccountDialogTitle => 'Suspend account';

  @override
  String get reactivateAccountDialogTitle => 'Reactivate account';

  @override
  String suspendAccountBody(String name) {
    return '$name will no longer be able to sign in until reactivated.';
  }

  @override
  String reactivateAccountBody(String name) {
    return '$name will be able to sign in again.';
  }

  @override
  String get suspendActionLabel => 'Suspend';

  @override
  String get reactivateActionLabel => 'Reactivate';

  @override
  String userSuspendedToast(String name) {
    return '$name suspended';
  }

  @override
  String userReactivatedToast(String name) {
    return '$name reactivated';
  }

  @override
  String userDeletedToast(String name) {
    return '$name deleted';
  }

  @override
  String get rejectTooltip => 'Reject';

  @override
  String get editRoleActionLabel => 'Edit role';

  @override
  String get usersSearchFieldHint => 'Search by name, email, ID number...';

  @override
  String userAccountsCountLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count accounts',
      one: '$count account',
    );
    return '$_temp0';
  }

  @override
  String get allRolesFilterLabel => 'All roles';

  @override
  String get regionDepartmentColumnHeader => 'Region / Department';

  @override
  String get noUsersFoundTitle => 'No accounts found';

  @override
  String get noUsersFoundSubtitle => 'Try a different search or filter.';

  @override
  String rejectUserSheetTitle(String name) {
    return 'Reject $name';
  }

  @override
  String get rejectReasonLabel => 'Reason for rejection (optional)';

  @override
  String get rejectReasonHint => 'E.g.: Incomplete documents...';

  @override
  String get confirmRejectButton => 'Confirm rejection';

  @override
  String deleteUserSheetTitle(String name) {
    return 'Delete $name?';
  }

  @override
  String get deleteUserIrreversibleWarning =>
      'Irreversible action. If this account has related declarations, submissions, or notifications, deletion will be refused — suspend it instead.';

  @override
  String typeEmailToConfirmLabel(String email) {
    return 'Type \"$email\" to confirm';
  }

  @override
  String get newAgentButtonLabel => 'New agent';

  @override
  String get regionDeptSelectorLoadRegionsError => 'Unable to load regions.';

  @override
  String get allRegionsCheckboxLabel => 'All regions';

  @override
  String get noDepartmentsAvailableLabel => 'No departments available';

  @override
  String get campaignDetailStartDateLabel => 'Start date';

  @override
  String get campaignDetailEndDateLabel => 'End date';

  @override
  String get campaignDetailTargetUsersLabel => 'Target users';

  @override
  String get campaignDetailAvailableFormsLabel => 'Available forms';

  @override
  String get openCampaignButton => 'Open campaign';

  @override
  String get identificationTableSelectHint => 'Choose...';

  @override
  String get identificationTableTextInputHint => 'Enter...';

  @override
  String get companyDeclMyDeclarationsTitle => 'My Declarations';

  @override
  String get companyDeclMyDeclarationsSubtitle =>
      'Track your employment declarations, submissions, and approval status';

  @override
  String companyDeclFilterAllCount(int count) {
    return 'All $count';
  }

  @override
  String companyDeclFilterUnderReviewCount(int count) {
    return 'Under review $count';
  }

  @override
  String get companyDeclSearchHint => 'Search declarations...';

  @override
  String get companyDeclFilterAllCampaigns => 'All campaigns';

  @override
  String get companyDeclHistoryTitle => 'Declaration history';

  @override
  String get companyDeclDefaultSubtitle => 'Company submission';

  @override
  String get companyDeclViewDetailsAction => 'View details';

  @override
  String get companyDeclContinueDraftAction => 'Continue draft';

  @override
  String get companyDeclTrackStatusAction => 'Track status';

  @override
  String get companyDeclStepCreated => 'Created';

  @override
  String get companyDeclStatusTimelineTitle => 'Status timeline';

  @override
  String get companyRegGenderSumMismatchError => 'Total ≠ M + F';

  @override
  String get companyRegSubmitSuccessMsg => 'Declaration submitted successfully';

  @override
  String get companyRegSectionIdentificationTitle =>
      'I. ESTABLISHMENT IDENTIFICATION';

  @override
  String get companyRegFieldCompanyName => 'Company Name';

  @override
  String get companyRegFieldTaxNumber => 'Tax ID No. (NIU)';

  @override
  String get companyRegFieldParentCompanyLong =>
      'Company name the establishment depends on';

  @override
  String get companyRegFieldSecondaryActivity => 'Secondary activity';

  @override
  String get companyRegFieldCapital => 'Share capital (XAF)';

  @override
  String get companyRegSectionWorkforceTitle => 'II. STAFF AS OF DECEMBER 31';

  @override
  String get companyRegFieldTotalEmployees => 'Total Employees';

  @override
  String get companyRegFieldLastYearTotal => 'Total employees (last year)';

  @override
  String get companyRegSectionMovementsTitle => 'III. MOVEMENTS BY CATEGORY';

  @override
  String get companyRegSubmitButton => 'SUBMIT DECLARATION';

  @override
  String get lawComplianceNoteShort =>
      'In accordance with Law No. 91/023 of 16 Dec 1991.';

  @override
  String get companyRegRequiredFieldShort => 'Required field';

  @override
  String get movementCategory13 => '1-3';

  @override
  String get movementCategory46 => '4-6';

  @override
  String get movementCategory79 => '7-9';

  @override
  String get movementCategory1012 => '10-12';

  @override
  String get movementRecruitmentLabel => 'Recruitment';

  @override
  String get movementDismissalLabel => 'Dismissal';

  @override
  String get movementRetirementLabel => 'Retirement';

  @override
  String get declApprovalApprovedSuccessMsg =>
      'Declaration approved successfully';

  @override
  String get declApprovalMissingRejectReasonWarning =>
      'Please enter a rejection reason';

  @override
  String get declApprovalRejectedMsg => 'Declaration rejected';

  @override
  String declApprovalPdfLoadError(String error) {
    return 'Unable to load PDF: $error';
  }

  @override
  String get declApprovalDraftTitle => 'Draft — DSMO';

  @override
  String get declApprovalValidationTitle => 'DSMO Validation';

  @override
  String get pdfCopyOriginalLabel => 'ORIGINAL (Employer)';

  @override
  String get pdfCopyDuplicateLabel => 'DUPLICATE (Authority)';

  @override
  String get pdfCopyTriplicateLabel => 'TRIPLICATE (Archives)';

  @override
  String get declApprovalResumeEntryButton => 'Resume entry';

  @override
  String get declApprovalNotFoundMsg => 'Declaration not found';

  @override
  String get declApprovalSectionEstablishmentInfo =>
      'Establishment information';

  @override
  String get declApprovalSectionWorkforce => 'Workforce';

  @override
  String get declApprovalSectionMovements => 'Staff movements';

  @override
  String get declApprovalSectionAdditionalInfo => 'Additional information';

  @override
  String get declApprovalSectionComplianceSteps => 'Compliance steps';

  @override
  String get declApprovalPanelApprovalTitle => 'APPROVAL';

  @override
  String get declApprovalNotesLabel => 'Administrative notes';

  @override
  String get declApprovalApproveButton => 'APPROVE DECLARATION';

  @override
  String get declApprovalPanelRejectTitle => 'REJECTION';

  @override
  String get declApprovalRejectReasonLabel => 'Rejection reason (Required)';

  @override
  String get declApprovalRejectButton => 'REJECT FOR CORRECTION';

  @override
  String declApprovalYearLine(String year) {
    return 'Fiscal year: $year';
  }

  @override
  String declApprovalCurrentStatusLine(String status) {
    return 'Current Status: $status';
  }

  @override
  String declApprovalSubmissionDateLine(String date) {
    return 'Submission date: $date';
  }

  @override
  String get declApprovalLabelMainActivityShort => 'Main activity';

  @override
  String get declApprovalLabelSecondaryActivityShort => 'Secondary activity';

  @override
  String get fieldFaxLabel => 'Fax';

  @override
  String get declApprovalLabelTaxNumberShort => 'Tax ID No.';

  @override
  String get declApprovalLabelSocialCapital => 'Share capital';

  @override
  String get declApprovalLabelParentCompany => 'Parent company';

  @override
  String get declApprovalWorkforceCurrentYearTitle =>
      'Declared workforce — Current year';

  @override
  String get declApprovalWorkforcePreviousYearTitle =>
      'Workforce — Previous year';

  @override
  String declApprovalNominativeListLine(int count) {
    return 'Nominative list: $count employee(s) entered';
  }

  @override
  String get declApprovalNoMovementsMsg => 'No movement recorded.';

  @override
  String get movementPromotionLabel => 'Promotion';

  @override
  String get movementDeathLabel => 'Death';

  @override
  String get colMovementHeader => 'Movement';

  @override
  String get colCat13Header => 'Cat. 1–3';

  @override
  String get colCat46Header => 'Cat. 4–6';

  @override
  String get colCat79Header => 'Cat. 7–9';

  @override
  String get colCat1012Header => 'Cat. 10–12';

  @override
  String get colNonDeclaredShortHeader => 'Not decl.';

  @override
  String get colTotalHeader => 'TOTAL';

  @override
  String get declApprovalQualitativeUnavailableMsg =>
      'Qualitative information not available.';

  @override
  String get yesLabel => 'Yes';

  @override
  String get noLabel => 'No';

  @override
  String get qHasTrainingCenterShort => 'Training center for staff?';

  @override
  String get qRecruitmentPlansNextShort => 'Plans to recruit next year?';

  @override
  String get qCamerounisationPlanShort => 'Has a Cameroonization plan?';

  @override
  String get qUsesTempAgenciesShort => 'Uses temporary employment agencies?';

  @override
  String get qTempAgencyDetailsLabelShort => 'Temp agency details';

  @override
  String get declApprovalNoValidationStepsMsg => 'No validation step recorded.';

  @override
  String get declApprovalDefaultStepType => 'Automatic check';

  @override
  String get statusSubmittedShort => 'Submitted';

  @override
  String get statusDivisionApprovedShort => 'Div. Approved';

  @override
  String get statusRegionApprovedShort => 'Region Approved';

  @override
  String get declListApprovedToastMsg => 'Declaration approved';

  @override
  String get declListSearchCompanyHint => 'Search for a company...';

  @override
  String get declListNoPendingDeclarationsTitle => 'No pending declarations';

  @override
  String get tryDifferentSearchCriteria => 'Try different search criteria';

  @override
  String get declListSubmittedWillAppearHere =>
      'Submitted declarations will appear here';

  @override
  String get clearFiltersButton => 'Clear filters';

  @override
  String get empListDraftLoadedFromSessionMsg => 'Draft loaded from session';

  @override
  String empListDraftSavedMsg(int count) {
    return 'Draft saved ($count employee(s))';
  }

  @override
  String get empListEnterFullNameError => 'Please enter the full name';

  @override
  String get empListSelectGenderError => 'Please select gender';

  @override
  String get empListInvalidAgeError => 'Invalid age (16-120 years)';

  @override
  String get empListSelectNationalityError => 'Please select nationality';

  @override
  String get empListEnterCountryError => 'Please enter the country';

  @override
  String get empListSelectDiplomaError => 'Please select the diploma';

  @override
  String get empListEnterFunctionError => 'Please enter the position';

  @override
  String get empListInvalidSeniorityError => 'Invalid seniority (0-60 years)';

  @override
  String get empListSelectCategoryError => 'Please select the category';

  @override
  String get empListInvalidSalaryError =>
      'Please enter a valid salary (> 0 FCFA)';

  @override
  String get empListDeleteEmployeeTitle => 'Delete employee?';

  @override
  String empListDeleteEmployeeConfirm(String name) {
    return 'Do you want to remove $name from the list?';
  }

  @override
  String get empListEditEmployeeTitle => 'EDIT EMPLOYEE';

  @override
  String get empListAddEmployeeTitle => 'ADD EMPLOYEE';

  @override
  String empListStepProgressLabel(int step) {
    return 'Step $step of 9';
  }

  @override
  String get confirmButton => 'Confirm';

  @override
  String get empListFullNameStepLabel => 'Full Name';

  @override
  String get empListFullNameHintExample => 'E.g.: TCHINDA Marc Arnold';

  @override
  String get empListGenderStepLabel => 'Gender';

  @override
  String get genderMaleOption => 'Male (M)';

  @override
  String get genderFemaleOption => 'Female (F)';

  @override
  String get empListAgeStepLabel => 'Age';

  @override
  String get empListAgeHintExample => 'E.g.: 32';

  @override
  String get yearsUnitSuffix => 'years';

  @override
  String get empListNationalityStepLabel => 'Nationality';

  @override
  String get nationalityCameroonianOption => 'Cameroonian';

  @override
  String get nationalityForeignOption => 'Foreign';

  @override
  String get empListSpecifyCountryLabel => 'Specify the country';

  @override
  String get empListCountryHintExample => 'E.g.: France, Nigeria, China...';

  @override
  String get empListDiplomaStepLabel => 'Highest diploma';

  @override
  String get empListSelectDiplomaHint => 'Select a diploma';

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
  String get diplomaLicence => 'Bachelor\'s degree';

  @override
  String get diplomaMaster => 'Master\'s degree';

  @override
  String get diplomaDoctorat => 'Doctorate';

  @override
  String get empListFunctionStepLabel => 'Function / Position held';

  @override
  String get empListFunctionHintExample =>
      'E.g.: Accountant, Engineer, Assistant...';

  @override
  String get empListSeniorityStepLabel => 'Seniority in the company';

  @override
  String get empListSeniorityHintExample => 'E.g.: 5';

  @override
  String get empListCategoryStepLabel => 'Socio-professional category';

  @override
  String get empListSelectCategoryHint => 'Select the category (1-12)';

  @override
  String get nonDeclaredLabel => 'Not declared';

  @override
  String categoryNumberLabel(String number) {
    return 'Category $number';
  }

  @override
  String get empListCategoryScaleHelper =>
      'Per the official DSMO scale (1 = operational staff, 12 = senior executive)';

  @override
  String get empListSalaryStepLabel => 'Monthly salary (FCFA) *';

  @override
  String get empListSalaryHintExample => 'E.g.: 250000';

  @override
  String get fcfaCurrencySuffix => 'FCFA';

  @override
  String get mandatoryHelperText => 'Mandatory';

  @override
  String empListImportSuccessMsg(int count) {
    return '$count employee(s) imported successfully';
  }

  @override
  String empListImportPartialMsg(int count, int errorCount) {
    return '$count imported, $errorCount row(s) skipped';
  }

  @override
  String get excelColCountry => 'Country';

  @override
  String get excelColDiploma => 'Diploma';

  @override
  String get excelColSeniorityYears => 'Seniority (years)';

  @override
  String get excelColSalary => 'Salary (FCFA)';

  @override
  String get empListSaveFileDialogTitle => 'Save the employee list';

  @override
  String get exportSuccessMsg => 'Export successful!';

  @override
  String get movementsPromotionsPlural => 'Promotions';

  @override
  String empListPartAPreviewPageHeader(int page, int total) {
    return 'PART A Preview — Page $page/$total';
  }

  @override
  String get empListSectionEstablishmentIdentity => 'Establishment identity';

  @override
  String get fieldCompanyNameFullLabel => 'Name / Company name';

  @override
  String get empListTaxNumberNiuLabel => 'Tax ID No. (NIU)';

  @override
  String get empListWorkforceCurrentYearSection => 'Workforce — Current year';

  @override
  String get empListDeclaredTotalLabel => 'Declared total';

  @override
  String get empListMovementDetailByCategory => 'Movement detail by category';

  @override
  String get catRange13Label => 'Cat. 1-3';

  @override
  String get catRange46Label => 'Cat. 4-6';

  @override
  String get catRange79Label => 'Cat. 7-9';

  @override
  String get catRange1012Label => 'Cat. 10-12';

  @override
  String get nonDeclaredCategoryLabel => 'Not Declared';

  @override
  String get empListQualitativeInfoSection => 'Qualitative information';

  @override
  String get empListTrainingCenterLabelShort => 'Training center';

  @override
  String get empListRecruitmentPlansNextLabel =>
      'Recruitment plans (next year)';

  @override
  String get empListCamerounisationPlanLabel => 'Cameroonization plan';

  @override
  String get empListUsesTempAgenciesLabel =>
      'Use of temporary employment agencies';

  @override
  String get empListTempAgencyDetailsLabel => 'Temporary agency details';

  @override
  String get empListConfirmAndSubmitButton => 'Confirm and submit';

  @override
  String empListMismatchTotalLine(int actual, int declared) {
    return '• Total employees: $actual entered vs $declared declared';
  }

  @override
  String empListMismatchMenLine(int actual, int declared) {
    return '• Men: $actual entered vs $declared declared';
  }

  @override
  String empListMismatchWomenLine(int actual, int declared) {
    return '• Women: $actual entered vs $declared declared';
  }

  @override
  String get empListWorkforceInconsistencyTitle => '⚠️ Workforce inconsistency';

  @override
  String get empListWorkforceMismatchIntro =>
      'The number of employees entered does not match the workforce declared in PART A:\n';

  @override
  String get empListContinueSubmissionAnywayQuestion =>
      'Do you want to continue the submission anyway?';

  @override
  String get empListOfficialFormExactMatchNote =>
      'Note: The official form requires an exact match.';

  @override
  String get empListContinueDespiteErrorButton => 'Continue despite the error';

  @override
  String get empListAddAtLeastOneEmployeeError =>
      'Add at least one employee before submitting';

  @override
  String get empListInvalidEmployeeDataError =>
      'Some employees have invalid data (empty name or salary ≤ 0)';

  @override
  String empListPreviewGenerationError(String error) {
    return 'Unable to generate the preview: $error';
  }

  @override
  String empListSubmissionHttpError(String code, String data) {
    return 'Error during submission. HTTP code: $code\n\n$data';
  }

  @override
  String empListQueuedDeclarationLabel(int year, String company) {
    return 'DSMO Declaration $year — $company';
  }

  @override
  String empListDefaultDeadlineFallback(int year) {
    return 'January 31, $year';
  }

  @override
  String get empListQueuedOfflineFullMsg =>
      'Your declaration has been saved on this device and will be sent automatically once the connection returns. You can safely close this screen.';

  @override
  String get okButton => 'OK';

  @override
  String get empListDeclarationSavedTitle => 'Declaration saved!';

  @override
  String empListTrackingNumberLine(String trackingNumber) {
    return 'Tracking No.: $trackingNumber';
  }

  @override
  String get empListThreePdfCopiesAvailable => '3 PDF copies available:';

  @override
  String get printDownloadTooltip => 'Print / Download';

  @override
  String get empListMandatoryProcedureTitle => 'MANDATORY PROCEDURE:';

  @override
  String get empListProcStepPrintCopies => '• Print the 3 copies';

  @override
  String get empListProcStepSignCopies => '• Sign each copy';

  @override
  String get empListProcStepAddCompanyStamp => '• Add the company stamp';

  @override
  String empListProcStepSendByRegisteredMail(String deadline) {
    return '• Send by REGISTERED MAIL before $deadline';
  }

  @override
  String get empListProcStepEmploymentOffice =>
      '• To the employment district office';

  @override
  String get empListLawComplianceNoteFull =>
      'In accordance with Law No. 91/023 of 16 December 1991';

  @override
  String get successTitle => 'Success';

  @override
  String get empListSimpleSuccessMsg =>
      'Declaration submitted successfully!\n\nThe PDFs will be available in your employer portal.';

  @override
  String get empListSubmissionFailedTitle => 'Submission failed';

  @override
  String get empListAppBarTitle => 'DECLARATION ON THE WORKFORCE SITUATION';

  @override
  String get exportExcelTooltip => 'Export Excel';

  @override
  String get importExcelTooltip => 'Import Excel';

  @override
  String get previewPartATooltip => 'Preview PART A';

  @override
  String get previewPdfTooltipLong => 'Preview the PDF';

  @override
  String get empListRegisteredEmployeesLabel => 'Registered employees';

  @override
  String get empListInconsistencyBadge => 'INCONSISTENCY';

  @override
  String get empListEmptyStateMsg =>
      'No employee registered.\n\nAdd manually via the + button\nor import an Excel file.';

  @override
  String get empListColNumero => 'No.';

  @override
  String get empListColSeniority => 'Seniority';

  @override
  String get notDeclaredAbbrev => 'N/D';

  @override
  String ageYearsValue(int age) {
    return '$age years';
  }

  @override
  String seniorityYearsValue(int years) {
    String _temp0 = intl.Intl.pluralLogic(
      years,
      locale: localeName,
      other: '$years years',
      one: '$years year',
    );
    return '$_temp0';
  }

  @override
  String get empListAddEmployeeFabLabel => 'Add employee';

  @override
  String get sendNotifStatusDivisionApproved => 'Approved (Division)';

  @override
  String get sendNotifStatusRegionApproved => 'Approved (Region)';

  @override
  String get sendNotifStatusFinalApproved => 'Approved (Final)';

  @override
  String sendNotifSuccessMsg(int count) {
    return 'Notification sent to $count companies';
  }

  @override
  String sendNotifErrorMsg(String msg) {
    return 'Error: $msg';
  }

  @override
  String get sendNotifHeaderTitle => 'Send a notification';

  @override
  String get sendNotifHeaderSubtitle => 'Multi-criteria company targeting';

  @override
  String get sendNotifEstimatedRecipientsLabel => 'Estimated recipients';

  @override
  String sendNotifRecipientCountLine(int count) {
    return '$count companies';
  }

  @override
  String get sendNotifActiveBadge => 'Active';

  @override
  String get sendNotifRecipientFiltersSection => 'Recipient filters';

  @override
  String get sendNotifDivisionDepartmentLabel => 'Division / Department';

  @override
  String get sendNotifAllDivisionsHint => 'All divisions';

  @override
  String get sendNotifSubmissionStatusLabel => 'Submission status';

  @override
  String get sendNotifAllStatusesHint => 'All statuses';

  @override
  String get sendNotifMessageContentSection => 'Message content';

  @override
  String get sendNotifSubjectLabel => 'Subject';

  @override
  String get sendNotifSubjectHintExample =>
      'E.g.: Reminder — DSM-O 2025 Deadline';

  @override
  String get sendNotifSubjectRequiredError => 'Subject is required';

  @override
  String get sendNotifMessageFieldLabel => 'Message';

  @override
  String get sendNotifMessageHintExample => 'Write your message here...';

  @override
  String get sendNotifMessageRequiredError => 'Message is required';

  @override
  String get sendNotifSendButton => 'Send the notification';

  @override
  String get sendNotifClearFormButton => 'Clear the form';

  @override
  String get homeTabAnalyticsDsmo => 'DSMO Analytics';

  @override
  String get homeTabReports => 'Reports';

  @override
  String get homeTabCommunication => 'Communication';

  @override
  String get annuaireLabel => 'Directory';

  @override
  String get dashboardFallbackTitle => 'Dashboard';

  @override
  String get roleLabelDivisional => 'Labor Division';

  @override
  String get roleLabelRegional => 'Regional Delegation';

  @override
  String get roleLabelCentral => 'National Directorate';

  @override
  String get roleLabelSuperAdmin => 'Super Admin · DSMO + ONEFOP';

  @override
  String get roleLabelSuperAdminDsmo => 'Admin · Labor Regulation';

  @override
  String get roleLabelSuperAdminOnefop => 'Admin · ONEFOP';

  @override
  String get filterByZoneTitle => 'Filter by area';

  @override
  String get clearButton => 'Clear';

  @override
  String get departmentDivisionLabel => 'Department / Division';

  @override
  String get allDepartmentsHint => 'All departments';

  @override
  String get applyFilterButton => 'Apply filter';

  @override
  String get approvedHistoricalStatusOption => 'Approved (historical)';

  @override
  String get logoutDialogTitle => 'Log out';

  @override
  String get logoutConfirmBody => 'Are you sure you want to log out?';

  @override
  String get logoutButton => 'Log out';

  @override
  String get drawerSectionConsultation => 'Consultation';

  @override
  String get drawerViewQuestionnairesSubtitle => 'View questionnaires';

  @override
  String get drawerSectionAdminDsmo => 'DSMO Administration';

  @override
  String get drawerDeclarationsDsmoLabel => 'DSMO Declarations';

  @override
  String get drawerViewDeclarationsSubtitle => 'View declarations';

  @override
  String get drawerAnnuaireSubtitle => 'Users and companies';

  @override
  String get drawerResetPasswordSubtitle => 'After identity verification';

  @override
  String get drawerSectionAdminOnefop => 'ONEFOP Administration';

  @override
  String get drawerSectionSaisieOnefop => 'ONEFOP Data Entry';

  @override
  String get drawerNewQuestionnaireLabel => 'New questionnaire';

  @override
  String get drawerAssistedEntrySubtitle => 'Assisted entry';

  @override
  String get navCollapseTooltip => 'Collapse navigation';

  @override
  String get navExpandTooltip => 'Expand navigation';

  @override
  String get filterByRegionTooltip => 'Filter by region';

  @override
  String get connectionErrorTitle => 'Connection error';

  @override
  String get navOnefopMinefopTag => 'ONEFOP · MINEFOP';

  @override
  String get onefopAutoGuidedTitle => 'Self-guided questionnaire';

  @override
  String get onefopContinueQuestionnaireButton => 'Continue the questionnaire';

  @override
  String get dearDirectorGreeting => 'Dear Director';

  @override
  String get yourProgressHeading => 'Your Progress';

  @override
  String sectionsCompletedCount(int completed, int total) {
    return '$completed/$total sections completed';
  }

  @override
  String get fieldsRemainingPlaceholder => '17/32 required fields remaining';

  @override
  String get completedSlashLabel => 'Completed';

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
    return '$filled/$total fields';
  }

  @override
  String get reportApprovalApprovedSnackbar => 'Report approved';

  @override
  String get reportApprovalRejectedSnackbar => 'Report rejected';

  @override
  String get reportRejectionReasonDialogTitle => 'Reason for rejection';

  @override
  String get reportRejectionReasonHint => 'Explain why...';

  @override
  String get reportNoPendingApprovalsTitle => 'No pending approvals';

  @override
  String get reportAllProcessedSubtitle => 'All reports have been processed';

  @override
  String get reportAuditEmptyTitle => 'No activity recorded';

  @override
  String get reportAuditEmptySubtitle => 'User actions will appear here';

  @override
  String get reportAuditSystemActionFallback => 'System action';

  @override
  String get reportRegionLittoral => 'Littoral';

  @override
  String get reportRegionCentre => 'Centre';

  @override
  String get reportRegionNord => 'North';

  @override
  String get reportRegionExtremeNord => 'Far North';

  @override
  String get reportRegionOuest => 'West';

  @override
  String get reportRegionSud => 'South';

  @override
  String get reportRegionEst => 'East';

  @override
  String get reportRegionAdamaoua => 'Adamawa';

  @override
  String get reportRegionNordOuest => 'North West';

  @override
  String get reportRegionSudOuest => 'South West';

  @override
  String get reportBatchSelectRegionError => 'Select at least one region';

  @override
  String get reportBatchGenerationStartedMsg => 'Batch generation started';

  @override
  String get reportBatchJobRetryingMsg => 'Retry in progress';

  @override
  String get reportBatchByRegionTitle => 'Batch generation by region';

  @override
  String get reportBatchLaunchButton => 'Launch batch generation';

  @override
  String get reportBatchRecentJobsTitle => 'Recent jobs';

  @override
  String get reportBatchEmptyTitle => 'No batch jobs';

  @override
  String reportBatchJobReportsCount(int completed, int total) {
    return '$completed/$total reports';
  }

  @override
  String get reportSelectTwoReportsError => 'Select two reports to compare';

  @override
  String get reportMetricFeminizationLabel => 'Feminization';

  @override
  String get reportSelectReportHint => 'Select a report';

  @override
  String get reportBaselineReportLabel => 'Baseline report';

  @override
  String get reportTargetReportLabel => 'Report to compare';

  @override
  String get reportCompareButton => 'Compare';

  @override
  String get reportComparisonResultsTitle => 'Comparison results';

  @override
  String get reportBaselineColumnLabel => 'Baseline';

  @override
  String get reportComparedColumnLabel => 'Compared';

  @override
  String get reportSelectOneSectionError => 'Select at least one section';

  @override
  String get reportEndDateAfterStartError =>
      'The end date must be after the start date';

  @override
  String get reportPeriodMax36MonthsError =>
      'The period cannot exceed 36 months';

  @override
  String get reportGeneratedSuccessMsg => 'Report generated successfully';

  @override
  String get reportSectionLocationLabel => 'LOCATION';

  @override
  String get reportNationalAllOption => 'National (all)';

  @override
  String get reportPeriod3MonthsLabel => '3 months';

  @override
  String get reportPeriod6MonthsLabel => '6 months';

  @override
  String get reportPeriod12MonthsLabel => '12 months';

  @override
  String get reportPeriodYtdLabel => 'Current year';

  @override
  String get reportPeriodCustomLabel => 'Custom';

  @override
  String get reportSectionPeriodLabel => 'PERIOD';

  @override
  String get reportDateFromLabel => 'From';

  @override
  String get reportDateToLabel => 'To';

  @override
  String get reportSectionContentLabel => 'CONTENT';

  @override
  String get reportSelectAllButton => 'Select all';

  @override
  String get reportDeselectAllButton => 'Deselect all';

  @override
  String get reportSubtitleWorkforceTrends => 'Time trends';

  @override
  String get reportSubtitleSkillsAnalysis => 'Sector analysis';

  @override
  String get reportSubtitleDiversityInclusion => 'Equity & inclusion';

  @override
  String get reportSubtitleRegionalDetail => 'Regional detail';

  @override
  String get reportSectionNameLabel => 'REPORT NAME (optional)';

  @override
  String get reportNameHintExample => 'HR Briefing Littoral June 2026';

  @override
  String get reportGenerateButtonLabel => 'GENERATE REPORT';

  @override
  String get reportDownloadStartedMsg => 'Download started';

  @override
  String get reportEmptyHistoryTitle => 'No report generated';

  @override
  String get reportEmptyHistorySubtitle =>
      'Generate your first report in the \"Generate\" tab';

  @override
  String get reportDownloadTooltip => 'Download';

  @override
  String get reportTabGenerate => 'Generate';

  @override
  String get reportTabApprovals => 'Approvals';

  @override
  String get reportTabHistory => 'History';

  @override
  String get reportTabBatch => 'Batch';

  @override
  String get reportTabAudit => 'Audit';

  @override
  String get reportScreenTitle => 'Report generator';

  @override
  String onefopExportExcelDownloadedMsg(String path) {
    return 'Excel file downloaded: $path';
  }

  @override
  String onefopExportErrorMsg(String error) {
    return 'Error during export: $error';
  }

  @override
  String onefopExportSpssDownloadedMsg(String path) {
    return 'SPSS files downloaded (CSV + .sps syntax): $path. Place both files in the same folder, then run the .sps file in SPSS.';
  }

  @override
  String onefopExportSpssErrorMsg(String error) {
    return 'Error during SPSS export: $error';
  }

  @override
  String get onefopExportPanelTitle => 'Export ONEFOP submissions';

  @override
  String get onefopExportPanelDescription =>
      'Compiles all approved submissions (Enterprises, Cooperatives, Local Authorities, NGOs): identification data and sections 1 to 4 of the questionnaire.';

  @override
  String get onefopExportGeneratingLabel => 'Generating…';

  @override
  String get onefopExportExcelButton => 'Export to Excel';

  @override
  String get onefopExportSpssButton => 'Export to SPSS';

  @override
  String get onefopExportPdfComingSoonMsg => 'PDF export coming soon';

  @override
  String reportExportFiltersActiveCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Filters ($count active)',
      one: 'Filters ($count active)',
    );
    return '$_temp0';
  }

  @override
  String get reportExportFiltersOptionalLabel => 'Filters (optional)';

  @override
  String get onefopExportFilterDescription =>
      'Limits the export to a specific region, department, survey year, and/or period.';

  @override
  String get onefopExportChooseRegionFirstHint => 'Choose a region first';

  @override
  String get onefopExportSurveyYearLabel => 'Survey year';

  @override
  String onefopExportYearHintExample(int year) {
    return 'E.g. $year';
  }

  @override
  String get onefopExportAllPeriodOption => 'Entire period';

  @override
  String get onefopExportSubmissionPeriodLabel => 'Submission period';

  @override
  String get soumissionsTypeDsmoOption => 'DSMO';

  @override
  String get draftSavedSnackbar => 'Draft saved';

  @override
  String get discardDraftDialogTitle => 'Discard draft?';

  @override
  String get draftRelativeTimeJustNow => 'just now';

  @override
  String draftRelativeTimeMinutesAgo(int minutes) {
    return '$minutes min ago';
  }

  @override
  String draftRelativeTimeHoursAgo(int hours) {
    return '$hours h ago';
  }

  @override
  String draftRelativeTimeDaysAgo(int days) {
    return '$days d ago';
  }

  @override
  String get draftSaveNowButton => 'Save now';

  @override
  String get draftLoadFailedMessage => 'Failed to load drafts';

  @override
  String get draftEmptyStateMessage => 'No saved draft';

  @override
  String offlineBannerOfflineWithPendingMsg(int count) {
    return 'Offline — $count pending';
  }

  @override
  String get offlineBannerOfflineDegradedMsg => 'Offline mode';

  @override
  String offlineBannerOnlinePendingMsg(int count) {
    return '$count item(s) pending';
  }

  @override
  String get pdfDownloadFolderNotFoundError => 'Download folder not found.';

  @override
  String get pdfSavedToDownloadsMsg => 'PDF saved to Downloads';

  @override
  String get pdfSavedToDocumentsMsg => 'PDF saved to Documents';

  @override
  String pdfDownloadFailedError(String error) {
    return 'Download failed: $error';
  }

  @override
  String get formPreviewTitle => 'Official ONEFOP Form · CAM-LEAP';

  @override
  String get pdfReviewBeforeSubmitWarning =>
      'Review the information below before submitting for good.';

  @override
  String get loadingPdfEllipsis => 'Loading PDF…';

  @override
  String get pdfLoadFailedError => 'Unable to load the PDF.';

  @override
  String get submittingEllipsis => 'Submitting…';

  @override
  String get customPeriodLabel => 'Custom period';

  @override
  String get periodAnalysisLabel => 'Analysis period';

  @override
  String get yearLabel => 'Year';

  @override
  String get quarterLabel => 'Quarter';

  @override
  String get semesterLabel => 'Semester';

  @override
  String get quarterT1Label => 'Q1 (Jan-Mar)';

  @override
  String get quarterT2Label => 'Q2 (Apr-Jun)';

  @override
  String get quarterT3Label => 'Q3 (Jul-Sep)';

  @override
  String get quarterT4Label => 'Q4 (Oct-Dec)';

  @override
  String get semesterS1Label => 'S1 (Jan-Jun)';

  @override
  String get semesterS2Label => 'S2 (Jul-Dec)';

  @override
  String get selectPeriodPrompt => 'Select a period';

  @override
  String get newShortLabel => 'New';

  @override
  String get serviceCategoryDeconcentratedLabel => 'Decentralized Services';

  @override
  String get serviceCategoryCentralLabel => 'Central Administration';

  @override
  String get serviceCategoryAffiliatedLabel => 'Affiliated Bodies';

  @override
  String get selectServiceTypeAbovePrompt => 'Select a service type above.';

  @override
  String get noServiceFoundMessage => 'No service found.';

  @override
  String get serviceTypeFieldLabel => 'Service type *';

  @override
  String get selectServiceTypeHint => 'Select a service type';

  @override
  String get serviceSelectedLabel => 'Service selected';

  @override
  String get servicesLoadFailedTitle => 'Unable to load services';

  @override
  String get serviceCategoryDeconcentratedShort => 'Decentralized';

  @override
  String get serviceCategoryCentralShort => 'Central';

  @override
  String get serviceCategoryAffiliatedShort => 'Affiliated';
}
