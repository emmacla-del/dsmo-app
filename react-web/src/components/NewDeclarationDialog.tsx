"use client";

// Port of lib/screens/home_screen.dart:
// - _openNewSubmissionDialog (Step 1: DSMO vs ONEFOP)
// - _pickEntityType (Step 2: Entity/Form selection: Enterprise, Cooperative, CTD, ONG, VT, Admin, Project)
//
// Critically, Step 2 is a ONE-TIME FALLBACK in Flutter, not the normal
// path: _openOnefopFormForCompany reads company['entityType'] directly and
// only calls _pickEntityType() when that's null (an account that predates
// entity-type tracking), then immediately persists the choice via
// saveCompanyProfile so it's never asked again (home_screen.dart lines
// ~621-651). An earlier version of this component skipped that check
// entirely and always showed the picker — meaning a company could
// self-select a different entity type than the one it registered under on
// every single declaration. Fixed below to match: check first, only show
// the picker when there's genuinely nothing to auto-route to, and persist
// the result when there was a picker.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ApiError, getMyCompany, saveCompanyProfile, type CompanyProfile } from "@/lib/api-client";
import { entityApiValue, parseCompanyEntityType, type EntityType } from "@/lib/register-constants";

export interface NewDeclarationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type DialogStep = "type" | "entity";

interface EntityOption {
  key: EntityType;
  labelFr: string;
  labelEn: string;
  isVt?: boolean;
}

const ENTITY_OPTIONS: EntityOption[] = [
  {
    key: "enterprise",
    labelFr: "Entreprise",
    labelEn: "Enterprise",
  },
  {
    key: "cooperative",
    labelFr: "Coopérative",
    labelEn: "Cooperative",
  },
  {
    key: "ctd",
    labelFr: "CTD (Collectivité Territoriale Décentralisée)",
    labelEn: "RLA (Regional & Local Authorities)",
  },
  {
    key: "ong",
    labelFr: "ONG",
    labelEn: "NGO",
  },
  {
    key: "vocationalTraining",
    labelFr: "Formation professionnelle (Centre VTC)",
    labelEn: "Vocational Training Center",
    isVt: true,
  },
  {
    key: "administration",
    labelFr: "Administration publique (MINFOPRA)",
    labelEn: "Public Administration (MINFOPRA)",
  },
  {
    key: "projectProgram",
    labelFr: "Projet / Programme",
    labelEn: "Project / Program",
  },
];

const ENTITY_LABEL_KEYS: Record<EntityType, string> = {
  enterprise: "newDeclarationDialog.entityEnterprise",
  cooperative: "newDeclarationDialog.entityCooperative",
  ctd: "newDeclarationDialog.entityCtd",
  ong: "newDeclarationDialog.entityOng",
  vocationalTraining: "newDeclarationDialog.entityVocationalTraining",
  administration: "newDeclarationDialog.entityAdministration",
  projectProgram: "newDeclarationDialog.entityProjectProgram",
};

export function NewDeclarationDialog({ isOpen, onClose }: NewDeclarationDialogProps) {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState<DialogStep>("type");
  const [checkingCompany, setCheckingCompany] = useState(false);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  function handleClose() {
    setStep("type");
    setCheckError(null);
    onClose();
  }

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  function handleSelectDsmo() {
    handleClose();
    router.push("/home/declarations/new");
  }

  function goToEntityForm(entityKey: EntityType) {
    handleClose();
    // For vocationalTraining, this loads the dedicated 9-section VT wizard.
    router.push(`/onefop/preview?entity=${encodeURIComponent(entityKey)}`);
  }

  async function handleSelectOnefop() {
    setCheckError(null);
    setCheckingCompany(true);
    try {
      const profile = await getMyCompany();
      const existing = parseCompanyEntityType(profile.entityType);
      if (existing) {
        // Normal path (Flutter's company['entityType'] != null branch):
        // go straight to the account's own registered entity type — never
        // ask, since asking every time is exactly the bug this fixes.
        goToEntityForm(existing);
        return;
      }
      // Fallback path: no entity type on record yet. Keep the fetched
      // profile so handleSelectEntity below can resend it unchanged
      // (RegisterCompanyProfileDto requires the whole profile, not just
      // entityType) alongside the newly picked type.
      setCompany(profile);
      setStep("entity");
    } catch (e) {
      // Can't confirm the account's own entity type (network error, or a
      // non-COMPANY role somehow reaching this dialog) — fall back to the
      // picker rather than silently blocking declaration entirely.
      setCheckError(e instanceof ApiError ? e.message : String(e));
      setStep("entity");
    } finally {
      setCheckingCompany(false);
    }
  }

  async function handleSelectEntity(entityKey: EntityType) {
    if (company) {
      // Persist the choice (mirrors Flutter's saveCompanyProfile call in
      // the same fallback branch) so this account is never asked again —
      // resends the profile's own required fields unchanged, entityType
      // added. Best-effort: a save failure shouldn't block opening the
      // form the user just chose, only the "don't ask again" behavior.
      saveCompanyProfile({
        name: company.name ?? "",
        taxNumber: company.taxNumber ?? "",
        mainActivity: company.mainActivity ?? "",
        region: company.region ?? "",
        department: company.department ?? "",
        address: company.address ?? "",
        parentCompany: company.parentCompany,
        secondaryActivity: company.secondaryActivity,
        cnpsNumber: company.cnpsNumber,
        fax: company.fax,
        socialCapital: company.socialCapital,
        subdivision: company.subdivision,
        entityType: entityApiValue(entityKey),
      }).catch(() => {});
    }
    goToEntityForm(entityKey);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="declaration-dialog-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--cam-space-4)",
        backgroundColor: "var(--cam-scrim)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--cam-surface)",
          borderRadius: "var(--cam-radius-md)",
          border: "var(--cam-border-width) solid var(--cam-border)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Step 1: Declaration type popup (DSMO vs ONEFOP) */}
        {step === "type" && (
          <div style={{ padding: "var(--cam-space-5)" }}>
            <h2
              id="declaration-dialog-title"
              style={{
                margin: 0,
                fontSize: "var(--cam-font-size-xl)",
                fontWeight: 700,
                color: "var(--cam-text)",
              }}
            >
              {t("newDeclarationDialog.dialogTitle")}
            </h2>
            <p
              style={{
                margin: "var(--cam-space-1) 0 var(--cam-space-5)",
                fontSize: "var(--cam-font-size-sm)",
                color: "var(--cam-text-muted)",
              }}
            >
              {t("newDeclarationDialog.dialogSubtitle")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
              {/* Option 1: DSMO Declaration */}
              <button
                type="button"
                onClick={handleSelectDsmo}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--cam-space-4)",
                  padding: "var(--cam-space-4)",
                  borderRadius: "var(--cam-radius-md)",
                  border: "var(--cam-border-width) solid var(--cam-border-strong)",
                  background: "var(--cam-surface)",
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--cam-accent)";
                  e.currentTarget.style.backgroundColor = "var(--cam-accent-soft)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--cam-border-strong)";
                  e.currentTarget.style.backgroundColor = "var(--cam-surface)";
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--cam-font-size-base)",
                      fontWeight: 700,
                      color: "var(--cam-text)",
                    }}
                  >
                    {t("newDeclarationDialog.dsmoOptionTitle")}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--cam-font-size-xs)",
                      color: "var(--cam-text-muted)",
                    }}
                  >
                    {t("newDeclarationDialog.dsmoOptionDescription")}
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  style={{
                    color: "var(--cam-text-muted)",
                    fontSize: "var(--cam-font-size-lg)",
                    alignSelf: "center",
                  }}
                >
                  ›
                </span>
              </button>

              {/* Option 2: ONEFOP Questionnaire */}
              <button
                type="button"
                onClick={handleSelectOnefop}
                disabled={checkingCompany}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--cam-space-4)",
                  padding: "var(--cam-space-4)",
                  borderRadius: "var(--cam-radius-md)",
                  border: "var(--cam-border-width) solid var(--cam-border-strong)",
                  background: "var(--cam-surface)",
                  textAlign: "left",
                  cursor: checkingCompany ? "wait" : "pointer",
                  opacity: checkingCompany ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--cam-accent)";
                  e.currentTarget.style.backgroundColor = "var(--cam-accent-soft)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--cam-border-strong)";
                  e.currentTarget.style.backgroundColor = "var(--cam-surface)";
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--cam-font-size-base)",
                      fontWeight: 700,
                      color: "var(--cam-text)",
                    }}
                  >
                    {t("newDeclarationDialog.onefopOptionTitle")}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--cam-font-size-xs)",
                      color: "var(--cam-text-muted)",
                    }}
                  >
                    {checkingCompany
                      ? t("newDeclarationDialog.checkingEntityType")
                      : t("newDeclarationDialog.onefopOptionDescription")}
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  style={{
                    color: "var(--cam-text-muted)",
                    fontSize: "var(--cam-font-size-lg)",
                    alignSelf: "center",
                  }}
                >
                  {checkingCompany ? "…" : "›"}
                </span>
              </button>
            </div>

            <div style={{ marginTop: "var(--cam-space-5)", textAlign: "center" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--cam-text-muted)",
                  fontSize: "var(--cam-font-size-sm)",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "var(--cam-space-2) var(--cam-space-4)",
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Entity/Form selection (matches Flutter's _pickEntityType) */}
        {step === "entity" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <div style={{ padding: "var(--cam-space-5) var(--cam-space-5) var(--cam-space-4)", borderBottom: "var(--cam-border-width) solid var(--cam-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)" }}>
                <button
                  type="button"
                  onClick={() => setStep("type")}
                  style={{
                    background: "none",
                    border: "var(--cam-border-width) solid var(--cam-border-strong)",
                    borderRadius: "var(--cam-radius-sm)",
                    padding: "var(--cam-space-1) var(--cam-space-2)",
                    cursor: "pointer",
                    fontSize: "var(--cam-font-size-xs)",
                    color: "var(--cam-text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cam-space-1)",
                  }}
                  title={t("newDeclarationDialog.backButtonTitle")}
                >
                  {t("newDeclarationDialog.backButtonLabel")}
                </button>
                <h2
                  id="declaration-dialog-title"
                  style={{
                    margin: 0,
                    fontSize: "var(--cam-font-size-lg)",
                    fontWeight: 700,
                    color: "var(--cam-text)",
                  }}
                >
                  {t("newDeclarationDialog.entityStepTitle")}
                </h2>
              </div>
              <p
                style={{
                  margin: "var(--cam-space-2) 0 0",
                  fontSize: "var(--cam-font-size-xs)",
                  color: "var(--cam-text-muted)",
                }}
              >
                {checkError
                  ? t("newDeclarationDialog.checkFailedHint")
                  : t("newDeclarationDialog.noEntityTypeHint")}
              </p>
            </div>

            {/* Scrollable list of entities */}
            <div
              style={{
                padding: "var(--cam-space-4) var(--cam-space-5)",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "var(--cam-space-2)",
                maxHeight: "420px",
              }}
            >
              {ENTITY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectEntity(opt.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cam-space-3)",
                    padding: "var(--cam-space-3)",
                    borderRadius: "var(--cam-radius-md)",
                    border: "var(--cam-border-width) solid var(--cam-border-strong)",
                    background: "var(--cam-surface)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--cam-accent)";
                    e.currentTarget.style.backgroundColor = "var(--cam-accent-soft)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--cam-border-strong)";
                    e.currentTarget.style.backgroundColor = "var(--cam-surface)";
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "var(--cam-font-size-sm)",
                        fontWeight: 600,
                        color: "var(--cam-text)",
                      }}
                    >
                      {t(ENTITY_LABEL_KEYS[opt.key])}
                    </div>
                  </div>
                  {opt.isVt && (
                    <span className="cam-badge cam-badge-neutral">
                      {t("newDeclarationDialog.vtcBadge")}
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    style={{
                      color: "var(--cam-text-muted)",
                      fontSize: "var(--cam-font-size-lg)",
                    }}
                  >
                    ›
                  </span>
                </button>
              ))}
            </div>

            <div
              style={{
                padding: "var(--cam-space-3) var(--cam-space-5)",
                borderTop: "var(--cam-border-width) solid var(--cam-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => setStep("type")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--cam-text-muted)",
                  fontSize: "var(--cam-font-size-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("newDeclarationDialog.footerBackButton")}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--cam-text-muted)",
                  fontSize: "var(--cam-font-size-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
