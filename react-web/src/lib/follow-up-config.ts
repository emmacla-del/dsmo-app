export interface FollowUpPublicConfig {
  portalUrl: string | null;
  supportPhone: string | null;
  supportEmail: string | null;
}

/** Public, verified contact details used in the WhatsApp follow-up draft. */
export function getFollowUpPublicConfig(): FollowUpPublicConfig {
  const rawPortalUrl = process.env.NEXT_PUBLIC_CAMLEAP_OFFICIAL_URL?.trim();
  let portalUrl: string | null = null;
  if (rawPortalUrl) {
    try {
      const parsed = new URL(rawPortalUrl);
      if (parsed.protocol === "https:" && parsed.hostname) {
        portalUrl = parsed.toString().replace(/\/$/, "");
      }
    } catch {
      portalUrl = null;
    }
  }

  const rawPhone = process.env.NEXT_PUBLIC_ONEFOP_SUPPORT_PHONE?.trim();
  const rawEmail = process.env.NEXT_PUBLIC_ONEFOP_SUPPORT_EMAIL?.trim();
  const supportEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;

  return {
    portalUrl,
    supportPhone: rawPhone || null,
    supportEmail,
  };
}
