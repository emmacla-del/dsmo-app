/**
 * The reviewer's attestation that accompanies a company-registration approval.
 *
 * The Inscriptions review dialog lists the entity's identifying values and the
 * reviewer marks each one as checked. The marks live in the dialog only; they
 * reach the server with the approve call, which refuses the approval unless
 * every row that applies to the file's entity type is strictly `true`, and
 * records them in the COMPANY_REGISTRATION_APPROVED audit entry together with
 * the values they attest.
 *
 * The flag names avoid `emailVerified`, which is User.emailVerified (the
 * email-verification-link flag), a different thing.
 */

// The entity types whose registration must carry a CNPS number. Administration
// and project/programme do not collect one, so their review has no CNPS row.
export const CNPS_REQUIRED_ENTITY_TYPES: readonly string[] = [
  'ENTREPRISE',
  'COOPERATIVE',
  'CTD',
  'ONG',
  'VOCATIONAL_TRAINING',
];

export type VerificationFlag = 'nameVerified' | 'phoneVerified' | 'contactEmailVerified' | 'cnpsVerified';

export type VerificationFlags = Partial<Record<VerificationFlag, boolean>>;

// Row labels as the review dialog shows them, used in the refusal message so
// the reviewer reads which row is missing in the dialog's own words.
const FLAG_LABELS: Record<VerificationFlag, string> = {
  nameVerified: "Nom de l'entité",
  phoneVerified: "Téléphone / WhatsApp de l'entité",
  contactEmailVerified: 'Email de contact',
  cnpsVerified: 'N° CNPS',
};

/** The flags an approval of this entity type must carry, in dialog order. */
export function requiredVerificationFlags(entityType: string | null): VerificationFlag[] {
  const flags: VerificationFlag[] = ['nameVerified', 'phoneVerified', 'contactEmailVerified'];
  if (entityType && CNPS_REQUIRED_ENTITY_TYPES.includes(entityType)) flags.push('cnpsVerified');
  return flags;
}

/**
 * The required flags that are not strictly `true`. Strictly, like
 * centralStructureConfirmed: a missing, null or merely truthy value ("true",
 * 1) counts as unchecked, so an attestation cannot arrive by accident.
 */
export function missingVerificationFlags(entityType: string | null, flags: VerificationFlags | undefined): VerificationFlag[] {
  return requiredVerificationFlags(entityType).filter((flag) => flags?.[flag] !== true);
}

export interface VerifiedValues {
  name: string;
  phone: string | null;
  contactEmail: string;
  cnpsNumber: string | null;
}

const FLAG_VALUE: Record<VerificationFlag, keyof VerifiedValues> = {
  nameVerified: 'name',
  phoneVerified: 'phone',
  contactEmailVerified: 'contactEmail',
  cnpsVerified: 'cnpsNumber',
};

// The same rows as a sentence subject, for the empty-value refusal.
const FLAG_SUBJECTS: Record<VerificationFlag, string> = {
  nameVerified: "le nom de l'entité",
  phoneVerified: "le téléphone / WhatsApp de l'entité",
  contactEmailVerified: "l'email de contact",
  cnpsVerified: 'le N° CNPS',
};

/**
 * The required rows whose value is empty. Such a row cannot be attested, so
 * the approval is refused whatever its flag says: a file registered before a
 * field became required (a pre-Track B file with no CNPS, say) needs a
 * correction first. The review dialog disables ✓ on an empty row; this is the
 * server-side copy of that rule.
 */
export function emptyVerificationRows(entityType: string | null, values: VerifiedValues): VerificationFlag[] {
  return requiredVerificationFlags(entityType).filter((flag) => !values[FLAG_VALUE[flag]]?.trim());
}

export function emptyValueRefusalMessage(empty: VerificationFlag[]): string {
  const subjects = empty.map((flag) => FLAG_SUBJECTS[flag]);
  const subject = subjects.length === 1 ? subjects[0] : `${subjects.slice(0, -1).join(', ')} et ${subjects[subjects.length - 1]}`;
  return `Impossible d'approuver : ${subject} ${subjects.length === 1 ? 'est vide' : 'sont vides'}. Demandez une correction.`;
}

export function verificationRefusalMessage(missing: VerificationFlag[]): string {
  return `Vérifiez chaque information de l'entité avant d'approuver : ${missing.map((flag) => FLAG_LABELS[flag]).join(', ')}.`;
}

/**
 * The audit `details.verification` block: the flags the approval carried for
 * the rows that apply, and those rows' values as the database held them at
 * approval (not as the dialog displayed them; a correction sent mid-review
 * could differ, and the approval commits to the database state). A later
 * correction can change the Company row; this keeps what was attested.
 */
export function verificationAuditDetails(entityType: string | null, values: VerifiedValues) {
  const required = requiredVerificationFlags(entityType);
  const flags = Object.fromEntries(required.map((flag) => [flag, true])) as VerificationFlags;
  const attested: Record<string, string | null> = {
    name: values.name,
    phone: values.phone,
    contactEmail: values.contactEmail,
  };
  if (required.includes('cnpsVerified')) attested.cnpsNumber = values.cnpsNumber;
  return { ...flags, attested };
}
