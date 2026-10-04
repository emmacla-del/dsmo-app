"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { DIRECTORY_ROLES, NATIONAL_ROLES, hasRole } from "@/lib/roles";
import {
  ENTITY_CONFIGS,
  entityApiValue,
  isFieldVisible,
  pruneEntityDataForType,
  resolveAddress,
  resolveCompanyName,
  resolveMainActivity,
  visibleEntityDataForType,
  type EntityField,
  type EntityType,
} from "@/lib/register-constants";
import { localized } from "@/lib/register-i18n";
import {
  useTerritoryDepartments,
  useTerritoryRegions,
  useTerritorySubdivisions,
} from "@/hooks/useTerritoryStructure";
import { adminRegisterCompany, type AssistedRegistrationResult } from "@/lib/inscriptions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";

// The admin console is written in French throughout (no next-intl provider on
// /admin), so the shared EntityConfig labels are read in French rather than
// through useLocale().
const LOCALE = "fr" as const;

const ENTITY_ORDER: readonly EntityType[] = [
  "enterprise",
  "cooperative",
  "ctd",
  "ong",
  "administration",
  "projectProgram",
  "vocationalTraining",
];

/**
 * The respondent block — the person the admin actually spoke to.
 *
 * Mirrors the register wizard's "respondent" step rather than re-deriving it:
 * the backend reads respondentFirstName/LastName as the account holder's name
 * and falls back to firstName/lastName, so both are sent from these fields.
 */
interface Respondent {
  firstName: string;
  lastName: string;
  email: string;
  function: string;
  phone1: string;
  phone2: string;
}

const EMPTY_RESPONDENT: Respondent = {
  firstName: "",
  lastName: "",
  email: "",
  function: "",
  phone1: "",
  phone2: "",
};

export default function NouvelleInscriptionPage() {
  const { isLoading, forbidden, user } = useAdminScreenGuard(DIRECTORY_ROLES);

  // A territorial admin registers inside its own ressort, so its assignment is
  // the starting point. A national role starts empty and picks. The server
  // refuses anything outside the actor's ressort regardless of what these
  // pickers allow (assertTerritorialAuthority), so this is convenience only.
  const isNational = hasRole(user?.role, NATIONAL_ROLES);
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [entityData, setEntityData] = useState<Record<string, string>>({});
  const [respondent, setRespondent] = useState<Respondent>(EMPTY_RESPONDENT);
  const [region, setRegion] = useState(isNational ? "" : user?.region ?? "");
  const [department, setDepartment] = useState(isNational ? "" : user?.department ?? "");
  const [subdivision, setSubdivision] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistedRegistrationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { regions } = useTerritoryRegions();
  const { departments } = useTerritoryDepartments(region || null);
  const { subdivisions } = useTerritorySubdivisions(department || null, region || null);

  const config = entityType ? ENTITY_CONFIGS[entityType] : null;
  const visibleFields = useMemo(
    () => (config ? config.fields.filter((f) => isFieldVisible(f, entityData, config.fields)) : []),
    [config, entityData],
  );

  const mutation = useMutation({
    mutationFn: adminRegisterCompany,
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      setCopied(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  function chooseEntityType(next: EntityType) {
    setEntityType(next);
    // Fields the new type does not declare are dropped, so a half-filled form
    // cannot smuggle another type's answers into the payload.
    setEntityData((current) => pruneEntityDataForType(current, next));
  }

  function setField(key: string, value: string) {
    setEntityData((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEntityType(null);
    setEntityData({});
    setRespondent(EMPTY_RESPONDENT);
    setRegion(isNational ? "" : user?.region ?? "");
    setDepartment(isNational ? "" : user?.department ?? "");
    setSubdivision("");
    setError(null);
    setResult(null);
    setCopied(false);
  }

  /** The first unmet requirement, or null when the form may be sent. */
  function firstProblem(): string | null {
    if (!entityType || !config) return "Choisissez le type de déclarant.";
    if (!respondent.firstName.trim() || !respondent.lastName.trim()) {
      return "Le nom et le prénom du répondant sont obligatoires.";
    }
    if (!respondent.email.trim()) return "L'adresse e-mail du déclarant est obligatoire.";
    if (!region || !department || !subdivision) {
      return "Région, département et arrondissement sont obligatoires.";
    }
    for (const field of visibleFields) {
      if (field.required && !entityData[field.key]?.trim()) {
        return `« ${localized(field.label, LOCALE)} » est obligatoire.`;
      }
    }
    return null;
  }

  function submit() {
    const problem = firstProblem();
    if (problem || !entityType) {
      setError(problem);
      return;
    }
    // Hidden dependent fields must not reach the payload — the same gate the
    // public wizard applies (visibleEntityDataForType).
    const data = visibleEntityDataForType(entityData, entityType);
    const fallbackName = `${respondent.firstName} ${respondent.lastName}`.trim();

    mutation.mutate({
      email: respondent.email.trim(),
      firstName: respondent.firstName.trim(),
      lastName: respondent.lastName.trim(),
      companyName: resolveCompanyName(data, fallbackName),
      address: resolveAddress(data),
      mainActivity: resolveMainActivity(data),
      region,
      department,
      subdivision,
      entityType: entityApiValue(entityType),
      taxNumber: data.taxNumber,
      parentCompany: data.parentCompany,
      secondaryActivity: data.secondaryActivity,
      cnpsNumber: data.cnpsNumber,
      socialCapital: data.socialCapital ? Number(data.socialCapital) : undefined,
      legalStatus: data.legalStatus,
      cooperativeType: data.cooperativeType,
      yearOfCreation: data.yearOfCreation,
      ctdType: data.ctdType,
      mainMission: data.mainMission,
      registrationNumber: data.registrationNumber,
      branch: data.branch,
      poBox: data.poBox,
      phone: data.phone,
      phone2: data.phone2,
      sigle: data.sigle,
      cfpType: data.cfpType,
      educationSystem: data.educationSystem,
      functionalStatus: data.functionalStatus,
      nonFunctionalReason: data.nonFunctionalReason,
      nonFunctionalReasonOther: data.nonFunctionalReasonOther,
      promoterName: data.promoterName,
      promoterSex: data.promoterSex,
      promoterPhone1: data.promoterPhone1,
      promoterPhone2: data.promoterPhone2,
      respondentFirstName: respondent.firstName.trim(),
      respondentLastName: respondent.lastName.trim(),
      respondentFunction: respondent.function || undefined,
      respondentPhone: respondent.phone1 || undefined,
      respondentPhone2: respondent.phone2 || undefined,
    });
  }

  async function copyPassword() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
    } catch {
      // Clipboard is unavailable over plain HTTP and in some locked-down
      // browsers. The password stays on screen to be read out, so this is a
      // missing convenience, not a failure worth an alert.
      setCopied(false);
    }
  }

  if (isLoading) return <p className="cam-admin-lede">Chargement…</p>;
  if (forbidden) return <p className="cam-admin-lede">Vous n&apos;avez pas accès à cette page.</p>;

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Déclarants" }, { label: "Inscriptions" }, { label: "Nouvelle inscription" }]}
        title="Nouvelle inscription assistée"
        hideTabs={true}
        actions={<AdminHeaderActions showCampaignPill={false} />}
      />

      <div style={{ display: "flex", gap: 10, margin: "20px 0 24px" }}>
        <Link href="/admin/inscriptions" className="cam-admin-tab">Inscriptions</Link>
        <Link href="/admin/inscriptions/nouvelle" className="cam-admin-tab" aria-current="page">Nouvelle inscription</Link>
      </div>

      <p className="cam-admin-lede">
        Enregistrez un déclarant rencontré sur le terrain, par téléphone ou au guichet. Cette
        inscription sera soumise à validation comme une inscription auto-service. Le demandeur
        pourra se connecter une fois approuvé.
      </p>

      {error && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setError(null)}>×</button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Section title="Type de déclarant">
          <div role="radiogroup" aria-label="Type de déclarant" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {ENTITY_ORDER.map((type) => (
              <label key={type} className="cam-admin-choice">
                <input
                  type="radio"
                  name="entityType"
                  checked={entityType === type}
                  onChange={() => chooseEntityType(type)}
                />
                {localized(ENTITY_CONFIGS[type].title, LOCALE)}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Répondant">
          <FieldGrid>
            <Text label="Prénom" required value={respondent.firstName} onChange={(v) => setRespondent((r) => ({ ...r, firstName: v }))} />
            <Text label="Nom" required value={respondent.lastName} onChange={(v) => setRespondent((r) => ({ ...r, lastName: v }))} />
            <Text label="Adresse e-mail" required type="email" value={respondent.email} onChange={(v) => setRespondent((r) => ({ ...r, email: v }))} hint="Identifiant de connexion du déclarant." />
            <Text label="Fonction" value={respondent.function} onChange={(v) => setRespondent((r) => ({ ...r, function: v }))} />
            <Text label="Téléphone" type="tel" value={respondent.phone1} onChange={(v) => setRespondent((r) => ({ ...r, phone1: v }))} />
            <Text label="Téléphone 2" type="tel" value={respondent.phone2} onChange={(v) => setRespondent((r) => ({ ...r, phone2: v }))} />
          </FieldGrid>
        </Section>

        {config && (
          <Section title={`Identification — ${localized(config.title, LOCALE)}`}>
            <FieldGrid>
              {visibleFields.map((field) => (
                <EntityFieldInput
                  key={field.key}
                  field={field}
                  value={entityData[field.key] ?? ""}
                  onChange={(v) => setField(field.key, v)}
                />
              ))}
            </FieldGrid>
          </Section>
        )}

        <Section title="Localisation">
          {!isNational && (
            <p className="cam-admin-lede" style={{ marginTop: 0 }}>
              Pré-rempli avec votre ressort. Une inscription hors de votre ressort est refusée.
            </p>
          )}
          <FieldGrid>
            <Select
              label="Région"
              required
              value={region}
              options={regions}
              onChange={(v) => {
                setRegion(v);
                setDepartment("");
                setSubdivision("");
              }}
            />
            <Select
              label="Département"
              required
              value={department}
              options={departments}
              onChange={(v) => {
                setDepartment(v);
                setSubdivision("");
              }}
            />
            <Select label="Arrondissement" required value={subdivision} options={subdivisions} onChange={setSubdivision} />
          </FieldGrid>
        </Section>

        <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "8px 0 32px" }}>
          <button type="submit" className="cam-button cam-button-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement…" : "Enregistrer l'inscription"}
          </button>
          <Link href="/admin/inscriptions" className="cam-button cam-button-secondary">Annuler</Link>
        </div>
      </form>

      <AdminDialog
        open={!!result}
        onClose={resetForm}
        eyebrow="Inscription enregistrée"
        title={result?.company.name ?? ""}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary" onClick={resetForm}>Nouvelle inscription</button>
            <Link href="/admin/inscriptions" className="cam-button cam-button-primary">Voir la file</Link>
          </>
        }
      >
        {result && (
          <div>
            <p>
              Le dossier est en attente de validation. Transmettez ces identifiants au déclarant :
              il pourra se connecter une fois le dossier approuvé.
            </p>
            <FieldGrid>
              <div className="cam-target-year">
                Identifiant
                <span style={{ fontWeight: 400, fontFamily: "ui-monospace, monospace" }}>{result.user.email}</span>
              </div>
              <div className="cam-target-year">
                Mot de passe temporaire
                <span style={{ fontWeight: 400, fontFamily: "ui-monospace, monospace", fontSize: 16 }}>
                  {result.temporaryPassword}
                </span>
              </div>
            </FieldGrid>
            <p style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={copyPassword}>
                Copier le mot de passe
              </button>
              {copied && <span className="cam-admin-lede" style={{ margin: 0 }}>Copié.</span>}
            </p>
            <div className="cam-admin-notice cam-admin-notice--warn" role="status">
              Ce mot de passe ne sera plus affiché. Notez-le avant de fermer cette fenêtre.
            </div>
          </div>
        )}
      </AdminDialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 className="cam-admin-h2" style={{ marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
      {children}
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  required,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "text" | "email" | "tel" | "number";
  hint?: string;
}) {
  return (
    <label className="cam-target-year">
      {label}
      {required && <span aria-hidden="true"> *</span>}
      <input
        className="cam-input"
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="cam-admin-choice-hint">{hint}</span>}
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="cam-target-year">
      {label}
      {required && <span aria-hidden="true"> *</span>}
      <select className="cam-select" value={value} required={required} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sélectionner…</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

/** One EntityConfig field, rendered by its declared `kind`. */
function EntityFieldInput({
  field,
  value,
  onChange,
}: {
  field: EntityField;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = localized(field.label, LOCALE);
  const hint = field.hint ? localized(field.hint, LOCALE) : undefined;

  if (field.kind === "select") {
    return (
      <label className="cam-target-year">
        {label}
        {field.required && <span aria-hidden="true"> *</span>}
        <select className="cam-select" value={value} required={field.required} onChange={(e) => onChange(e.target.value)}>
          <option value="">Sélectionner…</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{localized(option.label, LOCALE)}</option>
          ))}
        </select>
        {hint && <span className="cam-admin-choice-hint">{hint}</span>}
      </label>
    );
  }

  return (
    <Text
      label={label}
      value={value}
      onChange={onChange}
      required={field.required}
      type={field.kind === "number" ? "number" : field.kind === "tel" ? "tel" : "text"}
      hint={hint}
    />
  );
}
