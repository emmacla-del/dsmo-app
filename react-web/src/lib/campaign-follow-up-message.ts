export type FollowUpMessageLanguage = "en" | "fr";

export interface FollowUpMessageFields {
  establishment: string;
  establishmentId: string;
  campaign: string;
  period: string;
  deadline: string | null;
  portalUrl: string | null;
  supportContact: string | null;
  agentName: string | null;
  agentTitle: string | null;
  office: string | null;
}

const COPY = {
  en: {
    opening: "Hello. ONEFOP is following up with {establishment} (Establishment ID {establishmentId}) about the {campaign} collection campaign ({period}).",
    submitBy: "Please submit your declaration by {deadline} through the official CAMLEAP portal: {portalUrl}.",
    submit: "Please submit your declaration through the official CAMLEAP portal: {portalUrl}.",
    submitWithoutUrl: "Please submit your declaration through CAMLEAP. Open the portal using the official address you already use; do not follow unfamiliar links.",
    verifyContact: "To verify this request, contact ONEFOP using its published contact: {contact}.",
    verifyPortal: "To verify this request, open CAMLEAP using the official address above.",
    verifyKnownAddress: "To verify this request, sign in to CAMLEAP using the address you normally use, or contact ONEFOP through its published channels.",
    safety: "ONEFOP will never ask for your password, one-time code, or payment over WhatsApp.",
    signature: "Officer: {agent}, {post}{office}. ONEFOP | CAMLEAP",
    genericAgent: "ONEFOP follow-up team",
    genericPost: "Follow-up officer",
  },
  fr: {
    opening: "Bonjour. ONEFOP assure le suivi de la déclaration de {establishment} (identifiant établissement {establishmentId}) pour la campagne de collecte {campaign} ({period}).",
    submitBy: "Veuillez soumettre votre déclaration avant le {deadline} sur le portail officiel CAMLEAP : {portalUrl}.",
    submit: "Veuillez soumettre votre déclaration sur le portail officiel CAMLEAP : {portalUrl}.",
    submitWithoutUrl: "Veuillez soumettre votre déclaration sur CAMLEAP. Ouvrez le portail à l’adresse officielle que vous utilisez habituellement ; ne suivez pas de lien inconnu.",
    verifyContact: "Pour vérifier cette demande, contactez ONEFOP au moyen de ses coordonnées publiées : {contact}.",
    verifyPortal: "Pour vérifier cette demande, ouvrez CAMLEAP à l’adresse officielle indiquée ci-dessus.",
    verifyKnownAddress: "Pour vérifier cette demande, connectez-vous à CAMLEAP avec l’adresse que vous utilisez habituellement ou contactez ONEFOP par ses canaux publiés.",
    safety: "ONEFOP ne vous demandera jamais votre mot de passe, votre code à usage unique ni un paiement sur WhatsApp.",
    signature: "Agent : {agent}, {post}{office}. ONEFOP | CAMLEAP",
    genericAgent: "Équipe de suivi ONEFOP",
    genericPost: "Agent de suivi",
  },
} as const;

function singleLine(value: string | null | undefined): string {
  return (value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (_match, key: string) => values[key] ?? "");
}

export function buildCampaignFollowUpMessage(
  language: FollowUpMessageLanguage,
  fields: FollowUpMessageFields,
): string {
  const copy = COPY[language];
  const values = {
    establishment: singleLine(fields.establishment),
    establishmentId: singleLine(fields.establishmentId),
    campaign: singleLine(fields.campaign),
    period: singleLine(fields.period),
    deadline: singleLine(fields.deadline),
    portalUrl: singleLine(fields.portalUrl),
    contact: singleLine(fields.supportContact),
    agent: singleLine(fields.agentName) || copy.genericAgent,
    post: singleLine(fields.agentTitle) || copy.genericPost,
    office: singleLine(fields.office) ? `, ${singleLine(fields.office)}` : "",
  };

  const lines = [interpolate(copy.opening, values)];
  if (fields.portalUrl) {
    lines.push(
      interpolate(fields.deadline ? copy.submitBy : copy.submit, values),
    );
  } else {
    lines.push(copy.submitWithoutUrl);
  }
  if (fields.supportContact) lines.push(interpolate(copy.verifyContact, values));
  else if (fields.portalUrl) lines.push(copy.verifyPortal);
  else lines.push(copy.verifyKnownAddress);
  lines.push(copy.safety, interpolate(copy.signature, values));
  return lines.join("\n\n");
}
