/**
 * Where a company is told to turn once a registration decision has left it
 * without a usable account. Shared between the login refusal
 * (AuthService.validateUser) and the rejection email
 * (NotificationService.sendRegistrationRejectedEmail) so the two cannot
 * drift apart.
 */
export const REGISTRATION_CONTACT_SENTENCE =
  "Pour plus d'informations, contactez votre délégation régionale du MINEFOP ou l'ONEFOP.";

/**
 * Shown at login to a company whose registration was rejected. It carries no
 * reviewer reason on purpose: the reason is reviewer-facing and reaches the
 * company only in the decision email, so the login screen cannot be used to
 * read it back.
 */
export const REGISTRATION_REJECTED_LOGIN_MESSAGE =
  `Votre demande d'inscription a été rejetée. ${REGISTRATION_CONTACT_SENTENCE}`;
