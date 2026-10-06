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
  icon: string;
  labelFr: string;
  labelEn: string;
  isVt?: boolean;
}

const ENTITY_OPTIONS: EntityOption[] = [
  {
    key: "enterprise",
    icon: "🏢",
    labelFr: "Entreprise",
    labelEn: "Enterprise",
  },
  {
    key: "cooperative",
    icon: "👥",
    labelFr: "Coopérative",
    labelEn: "Cooperative",
  },
  {
    key: "ctd",
    icon: "🏛️",
    labelFr: "CTD (Collectivité Territoriale Décentralisée)",
    labelEn: "RLA (Regional & Local Authorities)",
  },
  {
    key: "ong",
    icon: "🤝",
    labelFr: "ONG",
    labelEn: "NGO",
  },
  {
    key: "vocationalTraining",
    icon: "🎓",
    labelFr: "Formation professionnelle (Centre VTC)",
    labelEn: "Vocational Training Center",
    isVt: true,
  },
  {
    key: "administration",
    icon: "🏛️",
    labelFr: "Administration publique (MINFOPRA)",
    labelEn: "Public Administration (MINFOPRA)",
  },
  {
    key: "projectProgram",
    icon: "📋",
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
        padding: "16px",
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(4px)",
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
          background: "var(--cam-surface, #ffffff)",
          borderRadius: "16px",
          border: "1px solid var(--cam-border, #e2e8f0)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Step 1: Declaration type popup (DSMO vs ONEFOP) */}
        {step === "type" && (
          <div style={{ padding: "28px 24px" }}>
            <h2
              id="declaration-dialog-title"
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                color: "var(--cam-text, #0f172a)",
                letterSpacing: "-0.01em",
              }}
            >
              {t("newDeclarationDialog.dialogTitle")}
            </h2>
            <p
              style={{
                margin: "6px 0 24px",
                fontSize: 14,
                color: "var(--cam-text-muted, #64748b)",
                lineHeight: 1.4,
              }}
            >
              {t("newDeclarationDialog.dialogSubtitle")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Option 1: DSMO Declaration */}
              <button
                type="button"
                onClick={handleSelectDsmo}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1.5px solid var(--cam-border, #e2e8f0)",
                  background: "var(--cam-surface, #ffffff)",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--cam-accent)";
                  e.currentTarget.style.backgroundColor = "var(--cam-accent-soft)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--cam-border)";
                  e.currentTarget.style.backgroundColor = "var(--cam-surface)";
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "10px",
                    background: "rgba(30, 107, 58, 0.1)",
                    color: "var(--cam-accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  📋
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--cam-text, #0f172a)",
                      marginBottom: 3,
                    }}
                  >
                    {t("newDeclarationDialog.dsmoOptionTitle")}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--cam-text-muted, #64748b)",
                      lineHeight: 1.35,
                    }}
                  >
                    {t("newDeclarationDialog.dsmoOptionDescription")}
                  </div>
                </div>
                <span
                  style={{
                    color: "var(--cam-text-muted, #94a3b8)",
                    fontSize: 18,
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
                  gap: 16,
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1.5px solid var(--cam-border, #e2e8f0)",
                  background: "var(--cam-surface, #ffffff)",
                  textAlign: "left",
                  cursor: checkingCompany ? "wait" : "pointer",
                  opacity: checkingCompany ? 0.7 : 1,
                  transition: "all 0.15s ease",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2563eb";
                  e.currentTarget.style.backgroundColor = "#eff6ff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--cam-border, #e2e8f0)";
                  e.currentTarget.style.backgroundColor = "var(--cam-surface, #ffffff)";
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "10px",
                    background: "rgba(37, 99, 235, 0.1)",
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  📊
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--cam-text, #0f172a)",
                      marginBottom: 3,
                    }}
                  >
                    {t("newDeclarationDialog.onefopOptionTitle")}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--cam-text-muted, #64748b)",
                      lineHeight: 1.35,
                    }}
                  >
                    {checkingCompany
                      ? t("newDeclarationDialog.checkingEntityType")
                      : t("newDeclarationDialog.onefopOptionDescription")}
                  </div>
                </div>
                <span
                  style={{
                    color: "var(--cam-text-muted, #94a3b8)",
                    fontSize: 18,
                    alignSelf: "center",
                  }}
                >
                  {checkingCompany ? "…" : "›"}
                </span>
              </button>
            </div>

            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--cam-text-muted, #64748b)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "8px 16px",
                  borderRadius: "8px",
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
            <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid var(--cam-border, #e2e8f0)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setStep("type")}
                  style={{
                    background: "none",
                    border: "1px solid var(--cam-border, #e2e8f0)",
                    borderRadius: "8px",
                    padding: "4px 8px",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--cam-text-muted, #64748b)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title={t("newDeclarationDialog.backButtonTitle")}
                >
                  {t("newDeclarationDialog.backButtonLabel")}
                </button>
                <h2
                  id="declaration-dialog-title"
                  style={{
                    margin: 0,
                    fontSize: 19,
                    fontWeight: 700,
                    color: "var(--cam-text, #0f172a)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {t("newDeclarationDialog.entityStepTitle")}
                </h2>
              </div>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 13,
                  color: "var(--cam-text-muted, #64748b)",
                  lineHeight: 1.4,
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
                padding: "16px 24px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
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
                    gap: 14,
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: `1.5px solid ${opt.isVt ? "#9333ea" : "var(--cam-border, #e2e8f0)"}`,
                    background: opt.isVt ? "rgba(147, 51, 234, 0.04)" : "var(--cam-surface, #ffffff)",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    outline: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = opt.isVt ? "#7e22ce" : "var(--cam-accent)";
                    e.currentTarget.style.backgroundColor = opt.isVt
                      ? "rgba(147, 51, 234, 0.08)"
                      : "var(--cam-accent-soft)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = opt.isVt ? "#9333ea" : "var(--cam-border, #e2e8f0)";
                    e.currentTarget.style.backgroundColor = opt.isVt
                      ? "rgba(147, 51, 234, 0.04)"
                      : "var(--cam-surface, #ffffff)";
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{opt.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: opt.isVt ? "#7e22ce" : "var(--cam-text, #0f172a)",
                      }}
                    >
                      {t(ENTITY_LABEL_KEYS[opt.key])}
                    </div>
                  </div>
                  {opt.isVt && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        background: "#f3e8ff",
                        color: "#7e22ce",
                        borderRadius: "4px",
                        padding: "2px 6px",
                      }}
                    >
                      {t("newDeclarationDialog.vtcBadge")}
                    </span>
                  )}
                  <span
                    style={{
                      color: "var(--cam-text-muted, #94a3b8)",
                      fontSize: 16,
                    }}
                  >
                    ›
                  </span>
                </button>
              ))}
            </div>

            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid var(--cam-border, #e2e8f0)",
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
                  color: "var(--cam-text-muted, #64748b)",
                  fontSize: 13,
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
                  color: "var(--cam-text-muted, #64748b)",
                  fontSize: 13,
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
