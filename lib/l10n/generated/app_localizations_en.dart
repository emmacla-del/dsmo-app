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
  String get ministryFullName =>
      'Ministry of Employment and Vocational Training';

  @override
  String get tabSignIn => 'Sign in';

  @override
  String get tabCreateAccount => 'Create an account';

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
  String get registerPendingApprovalTitle => 'Request submitted!';

  @override
  String get registerPendingApprovalBody =>
      'Your MINEFOP access request is pending approval by an administrator.';

  @override
  String get registerUnderstoodButton => 'Got it';

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
  String get registerStepTitleMinefopInfo => 'MINEFOP information';

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
  String get registerEntitySubtitleVocational =>
      'Accredited technical and vocational training center.';

  @override
  String get registerServiceLevelTitle => 'Service level';

  @override
  String get registerServiceLevelSubtitle => 'Select your hierarchical level.';

  @override
  String get registerMinefopCentralTitle => 'Central Administration';

  @override
  String get registerMinefopCentralSubtitle =>
      'Central directorate, sub-directorate or central department in Yaoundé.';

  @override
  String get registerMinefopRegionalTitle => 'Regional service';

  @override
  String get registerMinefopRegionalSubtitle =>
      'Regional Delegation for Employment and Vocational Training.';

  @override
  String get registerMinefopDivisionalTitle => 'Divisional service';

  @override
  String get registerMinefopDivisionalSubtitle =>
      'Divisional Delegation for Employment and Vocational Training.';

  @override
  String get registerCreateAccountTitle => 'Create an account';

  @override
  String get registerSelectProfileSubtitle =>
      'Select your profile to get started.';

  @override
  String get registerRoleCompanyTitle => 'Company / Organization';

  @override
  String get registerRoleCompanySubtitle =>
      'Company, cooperative, CTD, NGO or training center subject to ONEFOP / DSMO declaration.';

  @override
  String get registerRoleMinefopTitle => 'MINEFOP Agent';

  @override
  String get registerRoleMinefopSubtitle =>
      'Inspector or agent of the Ministry of Employment and Vocational Training.';

  @override
  String get registerEntityTypeSubtitle =>
      'Select the type of entity you represent.';

  @override
  String get registerRespondentTitlePersonal => 'Your personal information';

  @override
  String get registerRespondentSubtitleMinefop =>
      'This information will be linked to your MINEFOP agent account.';

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
  String get registerMinefopLoadFunctionsError => 'Unable to load positions.';

  @override
  String registerInfoAsRole(String role) {
    return 'Enter your information as $role.';
  }

  @override
  String get registerMatriculeLabel => 'Staff Number *';

  @override
  String get registerMatriculeHint => 'Your civil servant staff number';

  @override
  String get registerMatriculeRequired => 'Staff number required';

  @override
  String get registerLocalisationSubtitle =>
      'Indicate the region and department of your assignment.';

  @override
  String get registerRegionLabel => 'Region *';

  @override
  String get registerSelectRegionHint => 'Select your region';

  @override
  String get registerDepartmentLabel => 'Department *';

  @override
  String get registerSelectRegionFirst => 'First select a region';

  @override
  String get registerSelectDepartmentHint => 'Select your department';

  @override
  String get registerMinefopInfoBox =>
      'This information will be verified when your account is validated by an administrator.';

  @override
  String get registerLoadingFunctions => 'Loading positions...';

  @override
  String get registerNoFunctionsAvailable =>
      'No positions available for your level.';

  @override
  String get registerFunctionPositionLabel => 'Function / Position *';

  @override
  String get registerSelectYourFunction => 'Select your position';

  @override
  String get registerSelectFunctionValidator => 'Please select a position';

  @override
  String get registerLoadingParentUnits => 'Loading parent units...';

  @override
  String get registerNoParentUnitsAvailable =>
      'No parent unit available for this position.';

  @override
  String get registerParentUnitLabel => 'Parent unit *';

  @override
  String get registerParentUnitDirectlyAttached =>
      'This position is directly attached to this unit.';

  @override
  String get registerSelectDirectSupervisor =>
      'Select the immediate hierarchical superior department.';

  @override
  String get registerSelectParentUnitHint => 'Select the parent unit';

  @override
  String get registerLoadingServiceUnits => 'Loading your services...';

  @override
  String get registerNoServiceUnitsFound =>
      'No service found under this parent unit.';

  @override
  String get registerYourServiceLabel => 'Your service *';

  @override
  String get registerSelectYourUnit => 'Select the unit in which you work.';

  @override
  String get registerSelectYourServiceHint => 'Select your service';

  @override
  String get registerJobTitleLabel => 'Job title';

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
  String get registerReviewPersonalInfoTitle => 'Personal information';

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
  String get registerMinefopPendingInfoBox =>
      'Your account will be activated after validation by a MINEFOP administrator.';

  @override
  String get registerCompanyPendingInfoBox =>
      'This information will automatically pre-fill Sections 0 and 1 of your ONEFOP forms and Part A of your DSMO declarations.';

  @override
  String registerAgentMinefopPrefix(String role) {
    return 'MINEFOP Agent — $role';
  }

  @override
  String get registerMatriculeRowLabel => 'Staff Number';

  @override
  String get registerHierarchicalPathLabel => 'Hierarchical path';

  @override
  String get registerServiceCodeRowLabel => 'Service code';

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
  String get footerHelp => 'Help';

  @override
  String get footerPrivacy => 'Privacy';

  @override
  String get footerContact => 'Contact';

  @override
  String get footerVersionLine =>
      'DSMO Digital v2.4.1-stable  ·  © 2026 MINEFOP · Republic of Cameroon';

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
  String get pdfCtdLabel => 'CTD';

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
  String get companyAnalyticsOpportunitiesTitle => 'Actionable opportunities';

  @override
  String get companyAnalyticsOpportunitiesDescription =>
      'Subsidized training programs, candidates matching your open positions, and tax incentives detected from your data.';

  @override
  String get companyAnalyticsComingSoonBadge => 'Coming soon';

  @override
  String companyAnalyticsHeaderYear(int year) {
    return 'Analytics $year';
  }

  @override
  String get companyAnalyticsBilanSubtitle =>
      'Data drawn from your approved ONEFOP declarations';

  @override
  String get companyAnalyticsSectionMySituation => 'My Situation';

  @override
  String companyAnalyticsLoadError(String error) {
    return 'Loading error: $error';
  }

  @override
  String get companyAnalyticsSectionBilanDetailed => 'Detailed HR Report';

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
  String companyAnalyticsVsPreviousYearLabel(String value) {
    return '$value vs previous year';
  }

  @override
  String companyAnalyticsFemaleCountLabel(int count) {
    return '$count female employees';
  }

  @override
  String companyAnalyticsMaleCountLabel(int count) {
    return '$count male employees';
  }

  @override
  String get companyAnalyticsRecruitmentsLabel => 'Recruitments';

  @override
  String companyAnalyticsNetLabel(String value) {
    return 'Net: $value';
  }

  @override
  String get companyAnalyticsDeparturesLabel => 'Departures';

  @override
  String companyAnalyticsDismissalsRetirementsLabel(
      int dismissals, int retirements) {
    return '$dismissals dismissals · $retirements retirements';
  }

  @override
  String get companyAnalyticsCategoryBreakdownTitle => 'Breakdown by category';

  @override
  String get companyAnalyticsCatExecutives => 'Executives (1-3)';

  @override
  String get companyAnalyticsCatSupervisors => 'Supervisors (4-6)';

  @override
  String get companyAnalyticsCatWorkers => 'Workers (7-9)';

  @override
  String get companyAnalyticsCatOthers => 'Others (10-12)';

  @override
  String get companyAnalyticsCatUndeclared => 'Undeclared';

  @override
  String get companyAnalyticsUnitEmployees => 'employees';

  @override
  String get companyAnalyticsFeminizationRate => 'Feminization rate';

  @override
  String get companyAnalyticsBilanDeclarationSubtitle =>
      'Data drawn from your approved ONEFOP declaration';

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
  String get companyAnalyticsLockedUnderReview =>
      'Your ONEFOP questionnaire is under review. Analytics will be available after approval.';

  @override
  String get companyAnalyticsLockedDraft =>
      'You have an ONEFOP draft in progress. Finalize and submit it to access your analytics.';

  @override
  String get companyAnalyticsLockedDefault =>
      'Submit the ONEFOP questionnaire to access your personal analytics.';

  @override
  String get companyAnalyticsBenchmarkLockedSubmitted =>
      'Your questionnaire is under review by MINEFOP. Sector comparisons will be unlocked after approval.';

  @override
  String get companyAnalyticsBenchmarkLockedUnderReview =>
      'Your questionnaire is being analyzed. Benchmarks are coming soon.';

  @override
  String get companyAnalyticsBenchmarkLockedDefault =>
      'Submit the ONEFOP questionnaire to access comparative analytics.';

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
  String get entityTypeCtd => 'CTD';

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
}
