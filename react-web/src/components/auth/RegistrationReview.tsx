"use client";

import { isFieldVisible, type EntityConfig, type EntityType } from "@/lib/register-constants";
import { AREA_OPTIONS, RESPONDENT_FUNCTION_OPTIONS } from "@/lib/register-options";

interface RespondentInfo {
  firstName: string;
  lastName: string;
  function: string;
  email: string;
  phone1: string;
  phone2: string;
}

interface RegistrationReviewProps {
  entityType: EntityType;
  config: EntityConfig;
  respondent: RespondentInfo;
  entityData: Record<string, string>;
  regionName?: string;
  departmentName?: string;
  subdivisionName?: string;
  area: string;
  sectorName?: string;
  onEdit: (step: "respondent" | "entityInfo" | "location" | "security") => void;
}

export function RegistrationReview({
  config,
  respondent,
  entityData,
  regionName,
  departmentName,
  subdivisionName,
  area,
  sectorName,
  onEdit,
}: RegistrationReviewProps) {
  const functionLabel =
    RESPONDENT_FUNCTION_OPTIONS.find((o) => o.value === respondent.function)?.label ??
    respondent.function;

  const areaLabel =
    AREA_OPTIONS.find((o) => o.value === area)?.label ?? (area || "—");

  return (
    <div style={{ marginTop: "12px" }}>
      {/* 1. Respondent */}
      <div className="review-header-row">
        <span className="review-section-title">1. Informations du déclarant / Respondent</span>
        <button
          type="button"
          className="btn-edit-section"
          onClick={() => onEdit("respondent")}
          aria-label="Modifier les informations du déclarant"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Modifier
        </button>
      </div>
      <table className="table-official">
        <tbody>
          <tr>
            <td className="label-cell">Nom et prénom / Full name</td>
            <td className="value-cell">{respondent.firstName} {respondent.lastName}</td>
          </tr>
          <tr>
            <td className="label-cell">Fonction / Function</td>
            <td className="value-cell">{functionLabel}</td>
          </tr>
          <tr>
            <td className="label-cell">Courriel / Email</td>
            <td className="value-cell">{respondent.email}</td>
          </tr>
          <tr>
            <td className="label-cell">Téléphone principal / Phone 1</td>
            <td className="value-cell">{respondent.phone1}</td>
          </tr>
          {respondent.phone2 ? (
            <tr>
              <td className="label-cell">Téléphone secondaire / Phone 2</td>
              <td className="value-cell">{respondent.phone2}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* 2. Entity Information */}
      <div className="review-header-row">
        <span className="review-section-title">2. Informations de l&apos;entité / Entity Data</span>
        <button
          type="button"
          className="btn-edit-section"
          onClick={() => onEdit("entityInfo")}
          aria-label="Modifier les informations de l'entité"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Modifier
        </button>
      </div>
      <table className="table-official">
        <tbody>
          <tr>
            <td className="label-cell">Type d&apos;organisation / Entity type</td>
            <td className="value-cell">{config.title}</td>
          </tr>
          {config.fields.map((field) => {
            const rawVal = entityData[field.key]?.trim();
            if (!rawVal) return null;
            if (!isFieldVisible(field, entityData, config.fields)) return null;

            // Resolve select label if applicable
            let displayVal = rawVal;
            if (field.options) {
              const matched = field.options.find((o) => o.value === rawVal);
              if (matched) displayVal = matched.label;
            }

            return (
              <tr key={field.key}>
                <td className="label-cell">{field.label}</td>
                <td className="value-cell">{displayVal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 3. Location */}
      <div className="review-header-row">
        <span className="review-section-title">3. Localisation administrative / Location</span>
        <button
          type="button"
          className="btn-edit-section"
          onClick={() => onEdit("location")}
          aria-label="Modifier la localisation administrative"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Modifier
        </button>
      </div>
      <table className="table-official">
        <tbody>
          <tr>
            <td className="label-cell">Région / Region</td>
            <td className="value-cell">{regionName || "—"}</td>
          </tr>
          <tr>
            <td className="label-cell">Département / Department</td>
            <td className="value-cell">{departmentName || "—"}</td>
          </tr>
          <tr>
            <td className="label-cell">Arrondissement / Subdivision</td>
            <td className="value-cell">{subdivisionName || "—"}</td>
          </tr>
          <tr>
            <td className="label-cell">Milieu / Area</td>
            <td className="value-cell">{areaLabel}</td>
          </tr>
          {sectorName ? (
            <tr>
              <td className="label-cell">Secteur d&apos;activité / Sector</td>
              <td className="value-cell">{sectorName}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* 4. Security */}
      <div className="review-header-row">
        <span className="review-section-title">4. Sécurité &amp; Accès / Account Security</span>
        <button
          type="button"
          className="btn-edit-section"
          onClick={() => onEdit("security")}
          aria-label="Modifier la sécurité du compte"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Modifier
        </button>
      </div>
      <table className="table-official">
        <tbody>
          <tr>
            <td className="label-cell">Identifiant de connexion / Login</td>
            <td className="value-cell">{respondent.email}</td>
          </tr>
          <tr>
            <td className="label-cell">Statut de validation / Status</td>
            <td className="value-cell" style={{ color: "var(--cam-green-dark)", fontWeight: 600 }}>
              Prêt pour soumission / Ready for submission
            </td>
          </tr>
        </tbody>
      </table>

      {/* Official administrative declaration notice */}
      <div
        style={{
          borderLeft: "3px solid var(--cam-green)",
          background: "rgba(30, 107, 58, 0.04)",
          padding: "10px 14px",
          fontSize: "12px",
          lineHeight: "1.5",
          color: "var(--cam-text)",
          borderRadius: "0 var(--cam-radius-sm) var(--cam-radius-sm) 0",
          marginTop: "16px",
          marginBottom: "16px",
        }}
      >
        <strong>Déclaration sur l&apos;honneur :</strong> En soumettant ce formulaire, vous certifiez l&apos;exactitude des informations fournies pour l&apos;enregistrement de votre établissement auprès du MINEFOP.
      </div>
    </div>
  );
}
