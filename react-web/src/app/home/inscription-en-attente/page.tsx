"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ENTITY_TYPE_OPTION_KEYS } from "@/lib/companies-directory";
import { useAuthStore } from "@/lib/auth-store";
import { getMyCompany, type CompanyProfile } from "@/lib/api-client";
import { resubmitRegistration, type RegistrationCorrections } from "@/lib/user-directory";
import { useEmailAvailability } from "@/lib/use-email-availability";
import { CameroonGeographySelector } from "@/components/modern-jobs/geography/CameroonGeographySelector";

// The ONEFOP entity types, in the backend's own enum spelling. The same seven
// OnefopEntityType values the register wizard offers — no DSMO-only category —
// labelled with the wizard's own labels (ENTITY_TYPE_OPTION_KEYS), no codes.
const ENTITY_TYPE_VALUES = ["ENTREPRISE", "COOPERATIVE", "CTD", "ONG", "ADMINISTRATION", "PROJECT_PROGRAM", "VOCATIONAL_TRAINING"];

// The free-text corrections. An explicit list, which is also what the diff
// below iterates: CompanyProfile has an index signature, so anything derived
// from spreading it would carry keys the route rejects. Labels:
// homeRegistrationPendingPage.field.<key>.
const TEXT_FIELDS = [
  { key: "name" },
  { key: "taxNumber" },
  { key: "mainActivity" },
  { key: "secondaryActivity" },
  { key: "parentCompany" },
  { key: "address" },
  { key: "phone" },
  { key: "cnpsNumber" },
  { key: "fax" },
] as const;

type TextKey = (typeof TEXT_FIELDS)[number]["key"];

const REGION_KEY = "region";
const DEPARTMENT_KEY = "department";
const SUBDIVISION_KEY = "subdivision";
// User.email, not a Company column: the profile does not carry it, so it is
// seeded from the signed-in user instead.
const EMAIL_KEY = "email";

type FormState = Record<string, string>;

/**
 * Everything the form edits, as plain strings: the company fields read off the
 * profile, plus the account email.
 */
function formStateFrom(profile: CompanyProfile | undefined, email: string | undefined): FormState {
  const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  const state: FormState = {};
  for (const field of TEXT_FIELDS) state[field.key] = str(profile?.[field.key]);
  state.socialCapital = str(profile?.socialCapital);
  state.entityType = str(profile?.entityType);
  state[REGION_KEY] = str(profile?.region);
  state[DEPARTMENT_KEY] = str(profile?.department);
  state[SUBDIVISION_KEY] = str(profile?.subdivision);
  state[EMAIL_KEY] = str(email);
  return state;
}

export default function InscriptionEnAttentePage() {
  const router = useRouter();
  const tRoot = useTranslations();
  const t = useTranslations("homeRegistrationPendingPage");
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const logout = useAuthStore((s) => s.logout);

  const pending = user?.status === "PENDING_APPROVAL";
  const complements = user?.status === "COMPLEMENTS_REQUESTED";

  // The correction form belongs to COMPLEMENTS_REQUESTED only, so the profile
  // is fetched only then. GET /dsmo/company is exempted for exactly this
  // status (and PENDING_APPROVAL) precisely so it can prefill this form.
  const companyQuery = useQuery({
    queryKey: ["dsmo", "company", "registration-correction"],
    queryFn: getMyCompany,
    enabled: complements,
  });

  const initial = useMemo(
    () => formStateFrom(companyQuery.data, user?.email),
    [companyQuery.data, user?.email]
  );
  const [form, setForm] = useState<FormState>({});
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The public wizard's debounced check. The account's own address is not a
  // conflict, so it is passed as ownEmail and never checked.
  const emailAvailable = useEmailAvailability(form[EMAIL_KEY] ?? "", initial[EMAIL_KEY]);

  // Prefill once the profile lands, and leave the reviewer's own edits alone
  // on any later refetch.
  useEffect(() => {
    if (companyQuery.data && !touched) setForm(initial);
  }, [companyQuery.data, initial, touched]);

  const set = (key: string, value: string) => {
    setTouched(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const mutation = useMutation({
    mutationFn: (data: RegistrationCorrections) => resubmitRegistration(data),
    onSuccess: async () => {
      setError(null);
      setTouched(false);
      await refreshUser();
    },
    onError: (e: Error) => setError(e.message),
  });

  // Once a reviewer approves the account, refreshUser() below brings back
  // status ACTIVE and this page has nothing left to say. Redirect from an
  // effect, not from the render body.
  useEffect(() => {
    if (user?.role === "COMPANY" && user.status === "ACTIVE") {
      router.replace("/home");
    }
  }, [user?.role, user?.status, router]);

  /**
   * The changed fields, built key by key against the loaded profile.
   *
   * Deliberately not a spread of either the profile or the form: the route
   * validates with forbidNonWhitelisted, and CompanyProfile's index signature
   * would smuggle in keys that turn the request into a 400. An unchanged field
   * is left out entirely, so the audit diff records corrections and not noise.
   */
  const buildCorrections = (): RegistrationCorrections => {
    const out: RegistrationCorrections = {};
    const changed = (key: string) => (form[key] ?? "") !== (initial[key] ?? "");

    for (const field of TEXT_FIELDS) {
      if (changed(field.key)) out[field.key as TextKey] = form[field.key] ?? "";
    }
    if (changed("socialCapital")) {
      const raw = (form.socialCapital ?? "").trim();
      // Left out when cleared: the field is optional and @IsInt would refuse
      // an empty string.
      if (raw !== "") out.socialCapital = Number(raw);
    }
    if (changed("entityType") && (form.entityType ?? "") !== "") {
      out.entityType = form.entityType;
    }
    // Compared trimmed and case-insensitively (the server stores it
    // lowercased), and left out when cleared: the route validates it as an
    // email, and an empty one would only be a 400.
    const email = (form[EMAIL_KEY] ?? "").trim();
    if (email !== "" && email.toLowerCase() !== (initial[EMAIL_KEY] ?? "").trim().toLowerCase()) {
      out.email = email;
    }
    // Territory resolves as a chain server-side and requires a subdivision,
    // so the three names travel together or not at all.
    if (changed(REGION_KEY) || changed(DEPARTMENT_KEY) || changed(SUBDIVISION_KEY)) {
      out.region = form[REGION_KEY] ?? "";
      out.department = form[DEPARTMENT_KEY] ?? "";
      out.subdivision = form[SUBDIVISION_KEY] ?? "";
    }
    return out;
  };

  const submit = () => {
    const corrections = buildCorrections();
    const movingTerritory = corrections.region !== undefined;
    if (movingTerritory && !(corrections.subdivision ?? "").trim()) {
      setError(t("errorSubdivisionRequired"));
      return;
    }
    if (corrections.email !== undefined && emailAvailable === false) {
      setError(t("errorEmailInUse"));
      return;
    }
    setError(null);
    // An empty object is a resubmission with no corrections — still allowed,
    // for a company that was asked for a document rather than an edit.
    mutation.mutate(corrections);
  };

  return (
    <div className="cam-admin-page">
      <h1 style={{ fontFamily: "var(--cam-font-serif)", fontSize: "var(--cam-font-size-xl)" }}>
        {t("title")}
      </h1>
      {pending && (
        <p className="cam-admin-lede">
          {t("pendingBody")}
        </p>
      )}
      {complements && (
        <>
          <p className="cam-admin-lede">{t("complementsIntro")}</p>
          <div className="cam-admin-notice cam-admin-notice--warn" role="status">
            {user?.approvalComment || t("complementsFallback")}
          </div>

          {companyQuery.isPending && <p>{t("loading")}</p>}
          {companyQuery.isError && (
            <div className="cam-admin-notice cam-admin-notice--error" role="alert">
              {t("loadError")}
            </div>
          )}

          {companyQuery.data && (
            <>
              <p>
                {t("correctionIntro")}
              </p>

              {TEXT_FIELDS.map((field) => (
                <div className="cam-field" key={field.key}>
                  <label className="cam-label" htmlFor={`correction-${field.key}`}>
                    {t(`field.${field.key}`)}
                  </label>
                  <input
                    id={`correction-${field.key}`}
                    className="cam-input"
                    value={form[field.key] ?? ""}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                </div>
              ))}

              <div className="cam-field">
                <label className="cam-label" htmlFor="correction-email">
                  {t("emailLabel")}
                </label>
                <input
                  id="correction-email"
                  className="cam-input"
                  type="email"
                  autoComplete="email"
                  aria-describedby="correction-email-hint"
                  value={form[EMAIL_KEY] ?? ""}
                  onChange={(e) => set(EMAIL_KEY, e.target.value)}
                />
                <span aria-live="polite" aria-atomic="true">
                  {emailAvailable === false && <span className="field-status is-error">⚠ {tRoot("registerPage.emailUnavailable")}</span>}
                  {emailAvailable === true && <span className="field-status is-ok">✓ {tRoot("registerPage.emailAvailable")}</span>}
                </span>
                <span id="correction-email-hint" className="cam-admin-choice-hint">
                  {t("emailHint")}
                </span>
              </div>

              <div className="cam-field">
                <label className="cam-label" htmlFor="correction-socialCapital">
                  {t("socialCapitalLabel")}
                </label>
                <input
                  id="correction-socialCapital"
                  className="cam-input"
                  type="number"
                  min={0}
                  value={form.socialCapital ?? ""}
                  onChange={(e) => set("socialCapital", e.target.value)}
                />
              </div>

              <div className="cam-field">
                <label className="cam-label" htmlFor="correction-entityType">
                  {t("entityTypeLabel")}
                </label>
                <select
                  id="correction-entityType"
                  className="cam-select"
                  value={form.entityType ?? ""}
                  onChange={(e) => set("entityType", e.target.value)}
                >
                  <option value="">{t("notRecorded")}</option>
                  {ENTITY_TYPE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {tRoot(ENTITY_TYPE_OPTION_KEYS[value])}
                    </option>
                  ))}
                </select>
              </div>

              <CameroonGeographySelector
                regionFieldId={REGION_KEY}
                departmentFieldId={DEPARTMENT_KEY}
                subdivisionFieldId={SUBDIVISION_KEY}
                data={form}
                onChange={(fieldId, value) => set(fieldId, value === null || value === undefined ? "" : String(value))}
                required={false}
              />
            </>
          )}

          {error && (
            <div className="cam-admin-notice cam-admin-notice--error" role="alert">
              {error}
            </div>
          )}

          <button
            type="button"
            className="cam-button cam-button-primary"
            disabled={mutation.isPending}
            onClick={submit}
          >
            {mutation.isPending ? "…" : t("resubmit")}
          </button>
        </>
      )}
      <p>
        <button type="button" className="cam-button cam-button-secondary" onClick={() => logout()}>
          {t("signOut")}
        </button>
      </p>
    </div>
  );
}
