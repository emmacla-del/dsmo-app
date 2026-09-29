"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getCachedUser, getMe, getMyCompany, getToken } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { checkCoherence } from "@/lib/onefop-coherence";
import { getActiveQuarter, saveDraftToBackend } from "@/lib/onefop-submission";
import { validateEntityData } from "@/lib/onefop-validation";
import { useOnefopSchema } from "@/lib/use-onefop-schema";
import { useOnefopDraft } from "@/lib/use-onefop-draft";
import { companyToInitialData } from "@/lib/onefop-autofill";
import { parseCompanyEntityType } from "@/lib/register-constants";
import { CoherenceProvider } from "@/components/onefop/coherence/Coherence";
import { WizardShell } from "@/components/onefop/WizardShell";
import { OnefopLegalAcknowledgment } from "@/components/onefop/OnefopLegalAcknowledgment";

// ── Auth gate ─────────────────────────────────────────────────────────────

function subscribeNoop() { return () => {}; }
type AuthState = "checking" | "authed" | "anon";

function useAuthState(): AuthState {
  return useSyncExternalStore(
    subscribeNoop,
    () => (getToken() ? "authed" : "anon"),
    () => "checking",
  );
}

function useRequireAuth(): AuthState {
  const router = useRouter();
  const authState = useAuthState();
  // Navigation is a side effect and must not run during render (it was
  // here, guarded only by `typeof window !== "undefined"` — that avoids an
  // SSR crash but not the render-purity violation; React/Next.js can end up
  // updating router state while this component's own render is still in
  // flight). Same fix already applied in lib/use-require-auth.ts.
  useEffect(() => {
    if (authState === "anon") router.replace("/");
  }, [authState, router]);
  return authState;
}

// ── Main page with Suspense wrapper ───────────────────────────────────────

export default function OnefopDeclarationPage() {
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", padding: 48, textAlign: "center", color: "var(--cam-text-muted)" }}>
        {t("common.loading")}
      </div>
    );
  }

  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", padding: 48, textAlign: "center", color: "var(--cam-text-muted)" }}>{t("common.loading")}</div>}>
      <OnefopDeclarationContent />
    </Suspense>
  );
}

function OnefopDeclarationContent() {
  const t = useTranslations();
  const locale: "fr" | "en" = useLocale().startsWith("en") ? "en" : "fr";
  const router = useRouter();
  const searchParams = useSearchParams();
  const authState = useRequireAuth();
  const authUser = useAuthStore((s) => s.user);
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    enabled: authState === "authed",
    initialData: authUser ?? getCachedUser() ?? undefined,
  });

  const companyQuery = useQuery({
    queryKey: ["company", "me"],
    queryFn: getMyCompany,
    enabled: authState === "authed",
  });

  const paramEntity = searchParams.get("entity") || searchParams.get("entityType");
  const companyEntityType = companyQuery.data?.entityType;
  const resolvedInitialEntity = useMemo(() => {
    if (!paramEntity) {
      if (companyEntityType) {
        const parsed = parseCompanyEntityType(companyEntityType);
        if (parsed) return parsed;
      }
      return "enterprise";
    }
    const lower = paramEntity.toLowerCase();
    if (lower === "enterprise" || lower === "entreprise") return "enterprise";
    if (lower === "cooperative") return "cooperative";
    if (lower === "ctd") return "ctd";
    if (lower === "ong" || lower === "ngo") return "ong";
    if (lower === "administration") return "administration";
    if (lower === "projectprogram" || lower === "project_program" || lower === "project") return "projectProgram";
    if (lower === "vocationaltraining" || lower === "vocational_training" || lower === "vtc" || lower === "vt") return "vocationalTraining";
    return "enterprise";
  }, [paramEntity, companyEntityType]);

  const { data: schema, isLoading, isError, error } = useOnefopSchema();
  const [selectedEntity] = useState<string | null>(null);
  const entityType = selectedEntity ?? resolvedInitialEntity;

  // Compute autofill data from account registration info
  const autofillData = useMemo(() => {
    if (!companyQuery.data && !meQuery.data) return undefined;
    return companyToInitialData(companyQuery.data, entityType, meQuery.data);
  }, [companyQuery.data, meQuery.data, entityType]);

  // Legal acknowledgment gate (matches Flutter's OnefopLegalAcknowledgmentScreen)
  const [acknowledged, setAcknowledged] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // Quarter resolves before the draft loads — useOnefopDraft defers its
  // IndexedDB load until quarterCode is non-null so a Q1 draft is never
  // attributed to Q2 (D1 fix).
  const quarterQuery = useQuery({ queryKey: ["onefop", "active-quarter"], queryFn: getActiveQuarter });

  // Hoisted so callbacks (handleSaveNow) and the WizardShell both use the
  // same resolved value regardless of which render phase we're in.
  const quarterCode = quarterQuery.data?.code ?? undefined;

  const { data: formData, onChange: handleChange, status: draftStatus, formId, lastSavedAt, saveFailed } =
    useOnefopDraft(entityType, quarterQuery.data?.code ?? null, autofillData);

  const entity = schema?.entities[entityType];
  const coherenceFlags = useMemo(
    () => checkCoherence(formData, entityType),
    [formData, entityType],
  );
  const validationIssues = useMemo(
    () => (entity ? validateEntityData(entity, formData, locale) : []),
    [entity, formData, locale],
  );

  // VT-S: wire backend draft save so "Save & Exit" is available for all
  // entity types (especially VT, which has multi-session forms with no other
  // recovery path if the respondent clears browser data or switches device).
  const handleSaveNow = useCallback(async () => {
    if (!quarterCode) return;
    await saveDraftToBackend(entityType, quarterCode, formData, entity ?? undefined);
  }, [entityType, quarterCode, formData, entity]);

  // Role guard: only COMPANY accounts may fill ONEFOP questionnaires.
  // Redirect once the user record is resolved — meQuery may still be loading
  // on first render, so check only when data is present.
  useEffect(() => {
    if (meQuery.data && meQuery.data.role !== "COMPANY") {
      router.replace("/home");
    }
  }, [meQuery.data, router]);

  if (authState !== "authed") {
    return (
      <div style={{ minHeight: "100vh", padding: 48, textAlign: "center", color: "var(--cam-text-muted)" }}>
        {t("common.loading")}
      </div>
    );
  }

  // While a non-COMPANY redirect is pending, render nothing.
  if (meQuery.data && meQuery.data.role !== "COMPANY") {
    return null;
  }

  // ── Step 1 & 2: Legal Acknowledgment (Image 2 pulsing logo & Image 3 legal notice) ──
  if (!acknowledged) {
    const respondentName =
      (formData["S0Q01"] as string) ||
      (formData["VT1_15_NAME"] as string) ||
      (companyQuery.data?.respondentFirstName
        ? `${companyQuery.data.respondentFirstName} ${companyQuery.data.respondentLastName || ""}`.trim()
        : "") ||
      (meQuery.data?.firstName ? `${meQuery.data.firstName} ${meQuery.data.lastName || ""}`.trim() : "") ||
      meQuery.data?.email?.split("@")[0] ||
      t("onefopPreviewPage.respondentFallbackName");

    const respondentFunction: string =
      (formData["S0Q02"] as string) ||
      (formData["VT1_15_FUNCTION"] as string) ||
      (companyQuery.data?.respondentFunction as string | undefined) ||
      (meQuery.data as { positionTitle?: string })?.positionTitle ||
      (t("onefopPreviewPage.respondentFallbackFunction") as string);

    return (
      <OnefopLegalAcknowledgment
        entityType={entityType}
        respondentName={respondentName}
        respondentFunction={respondentFunction}
        onAcknowledged={() => setAcknowledged(true)}
        onCancel={() => router.push("/home")}
      />
    );
  }

  const establishmentName =
    companyQuery.data?.name ||
    (formData["VT1_2"] as string) ||
    (formData["S1Q02"] as string) ||
    (formData["COOP_S1Q01"] as string) ||
    (formData["CTD_S1Q01_NAME"] as string) ||
    (formData["ONG_S1Q01"] as string) ||
    (formData["ADMIN_S1Q01"] as string) ||
    (formData["PP_S1Q02"] as string) ||
    undefined;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--cam-bg, #fafaf7)",
        color: "var(--cam-text, #0b1f14)",
        fontFamily: "var(--cam-font-sans, sans-serif)",
        paddingBottom: 0,
      }}
    >
      {/* ── Content Area ── */}
      {isLoading && (
        <p style={{ color: "var(--cam-text-muted)", padding: "24px 0", textAlign: "center" }}>
          {t("onefopPreviewPage.loadingQuestionnaire")}
        </p>
      )}
      {isError && (
        <p role="alert" style={{ color: "var(--cam-error)", padding: "24px 0", textAlign: "center" }}>
          {(error as Error).message}
        </p>
      )}

      {entity && (
        <div style={{ width: "100%", margin: 0, padding: 0, minHeight: "100vh" }}>
          {/* Anomalies are shown on the table cells themselves and listed at
              the review step (see components/onefop/coherence). */}
          <CoherenceProvider flags={coherenceFlags}>
          <WizardShell
            entity={entity}
            data={formData}
            onChange={handleChange}
            validationIssues={validationIssues}
            attemptedSubmit={attemptedSubmit}
            onAttemptSubmit={() => setAttemptedSubmit(true)}
            saving={draftStatus === "saving"}
            saveFailed={saveFailed}
            lastSavedAt={lastSavedAt}
            establishmentName={establishmentName}
            quarterCode={quarterCode}
            formId={formId}
            onSaveNow={handleSaveNow}
            onCancel={() => router.push("/home")}
          />
          </CoherenceProvider>
        </div>
      )}
    </main>
  );
}
