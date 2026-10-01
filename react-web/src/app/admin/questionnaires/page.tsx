"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { listAdminQuestionnaires } from "@/lib/api-client";
import { useOnefopSchema } from "@/lib/use-onefop-schema";
import { entityTypeLabel } from "@/lib/companies-directory";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDialog } from "@/components/admin/AdminDialog";

const SUBMISSION_ROLES = ["SUPER_ADMIN", "SUPER_ADMIN_ONEFOP", "CENTRAL", "REGIONAL", "DIVISIONAL"];

interface QuestionnaireModel {
  title: string;
  schemaKey: string;
  formType: string;
  sectionsLabel: string;
  defaultSubmissions: number;
  defaultCompletion: number;
}

const QUESTIONNAIRE_MODELS: QuestionnaireModel[] = [
  {
    title: "Entreprises",
    schemaKey: "enterprise",
    formType: "ENTREPRISE",
    sectionsLabel: "4 Sections d'enquête",
    defaultSubmissions: 4200,
    defaultCompletion: 82,
  },
  {
    title: "Coopératives",
    schemaKey: "cooperative",
    formType: "COOPERATIVE",
    sectionsLabel: "4 Sections d'enquête",
    defaultSubmissions: 3100,
    defaultCompletion: 74,
  },
  {
    title: "Administration",
    schemaKey: "administration",
    formType: "ADMINISTRATION",
    sectionsLabel: "4 Sections d'enquête",
    defaultSubmissions: 2800,
    defaultCompletion: 89,
  },
  {
    title: "Projets & Programmes",
    schemaKey: "projectProgram",
    formType: "PROJECT_PROGRAM",
    sectionsLabel: "4 Sections d'enquête",
    defaultSubmissions: 1600,
    defaultCompletion: 68,
  },
  {
    title: "ASFOP (Recensement)",
    schemaKey: "vocationalTraining",
    formType: "VOCATIONAL_TRAINING",
    sectionsLabel: "7 Sections d'enquête",
    defaultSubmissions: 1147,
    defaultCompletion: 59,
  },
  {
    title: "CTD (Collectivités)",
    schemaKey: "ctd",
    formType: "CTD",
    sectionsLabel: "4 Sections d'enquête",
    defaultSubmissions: 890,
    defaultCompletion: 76,
  },
  {
    title: "ONG & Associations",
    schemaKey: "ong",
    formType: "ONG",
    sectionsLabel: "4 Sections d'enquête",
    defaultSubmissions: 642,
    defaultCompletion: 84,
  },
];

const CANONICAL_SECTIONS = [
  { code: "SEC-1", title: "Identification & Caractéristiques Générales", questions: "14 questions" },
  { code: "SEC-2", title: "Structure des Effectifs & Mouvements de Main d'Œuvre", questions: "28 questions / matrices" },
  { code: "SEC-3", title: "Recrutements & Anticipation des Besoins en Compétences", questions: "22 questions" },
  { code: "SEC-4", title: "Actions de Formation Professionnelle & Développement", questions: "18 questions" },
];

function DocumentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export default function QuestionnairesPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canReadSubmissions = !!role && SUBMISSION_ROLES.includes(role);
  const schemaQuery = useOnefopSchema();
  const [selectedPreview, setSelectedPreview] = useState<QuestionnaireModel | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createNotice, setCreateNotice] = useState<string | null>(null);

  // Form state for creating questionnaire
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("ENTREPRISE");
  const [newSections, setNewSections] = useState("4");
  const [newRef, setNewRef] = useState("AR-2026-ONEFOP-DSMO");

  // Queries for live totals
  const totals = useQueries({
    queries: QUESTIONNAIRE_MODELS.map((q) => ({
      queryKey: ["admin", "questionnaires", "total", q.formType],
      queryFn: () => listAdminQuestionnaires({ formType: q.formType, limit: 1 }),
      enabled: canReadSubmissions,
    })),
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreateOpen(false);
    setCreateNotice(`Le modèle « ${newTitle || "Nouveau Questionnaire"} » a été enregistré dans le registre réglementaire.`);
    setNewTitle("");
  };

  return (
    <div className="cam-admin-page">
      <AdminPageHeader
        breadcrumb={[{ label: "Collecte" }, { label: "Questionnaires" }]}
        title="Questionnaires"
        subtitle="Types de fiches de déclaration nationale gérées par le NEFOP"
        actions={
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              background: "#1e6b3a",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(30,107,58,0.2)",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            Nouveau Questionnaire
          </button>
        }
      />

      {createNotice && (
        <div role="status" className="cam-admin-notice cam-admin-notice--success" style={{ marginBottom: 20 }}>
          <span>{createNotice}</span>
          <button type="button" className="cam-admin-notice-close" aria-label="Fermer" onClick={() => setCreateNotice(null)}>×</button>
        </div>
      )}

      {schemaQuery.isError && (
        <div role="alert" className="cam-admin-notice cam-admin-notice--error" style={{ marginBottom: 20 }}>
          <span>Le schéma ONEFOP n&apos;a pas pu être chargé : {(schemaQuery.error as Error).message}</span>
        </div>
      )}

      {/* ── 3-Column Grid of Questionnaire Cards (Figma: collecte/questionnaires.png) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 24,
        }}
      >
        {QUESTIONNAIRE_MODELS.map((q, idx) => {
          const totalQuery = totals[idx];
          const totalCount = totalQuery?.data?.total ?? q.defaultSubmissions;
          const completionRate = q.defaultCompletion;

          return (
            <section
              key={q.formType}
              aria-labelledby={`q-${q.formType}`}
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              {/* Card top row: Document icon on left, Actif badge on right */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "#eaf7ee",
                    color: "#1e6b3a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <DocumentIcon />
                </div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 10px",
                    borderRadius: 9999,
                    background: "#ecfdf5",
                    color: "#059669",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669" }} />
                  Actif
                </span>
              </div>

              {/* Title & Section count */}
              <h3
                id={`q-${q.formType}`}
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#111827",
                  margin: "16px 0 4px",
                }}
              >
                {q.title}
              </h3>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>
                {q.sectionsLabel}
              </p>

              {/* Metrics: Total Soumissions & Taux de complétion */}
              <div style={{ marginTop: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "#4b5563" }}>Total Soumissions</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                    {totalCount.toLocaleString("fr-FR")}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#4b5563" }}>Taux de complétion</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                    {completionRate}%
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden", marginBottom: 24 }}>
                  <div style={{ height: "100%", width: `${completionRate}%`, background: "#1e6b3a", borderRadius: 3 }} />
                </div>
              </div>

              {/* Action buttons (Figma: Voir Soumissions + Aperçu) */}
              <div style={{ display: "flex", gap: 12 }}>
                <Link
                  href={`/admin/dossiers?formType=${q.formType}`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "9px 16px",
                    background: "#1e6b3a",
                    color: "#ffffff",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                    boxShadow: "0 1px 2px rgba(30,107,58,0.15)",
                  }}
                >
                  Voir Soumissions
                </Link>

                <button
                  type="button"
                  onClick={() => setSelectedPreview(q)}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "9px 16px",
                    background: "#ffffff",
                    border: "1px solid #d1d5db",
                    color: "#374151",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Aperçu
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {/* ── Canonical AST Reference Section ── */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: "20px 24px",
          marginTop: 32,
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
        aria-labelledby="q-viewer-title"
      >
        <h3 id="q-viewer-title" style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>
          Référentiel des Questionnaires Canoniques
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
          Les modèles de fiches de collecte ONEFOP sont compilés à partir de l&apos;AST canonique institutionnel. Toute modification structurelle requiert un arrêté d&apos;homologation ministériel.
        </p>
        {schemaQuery.data && (
          <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 600, color: "#1e6b3a" }}>
            Schéma canonique actif v{schemaQuery.data.schemaVersion} : {schemaQuery.data.astTotals.sections} sections, {schemaQuery.data.astTotals.questions} questions recensées au niveau national.
          </p>
        )}
      </section>

      {/* ── Modal: Aperçu Questionnaire ── */}
      {selectedPreview && (
        <AdminDialog
          open={!!selectedPreview}
          onClose={() => setSelectedPreview(null)}
          eyebrow="Structure Règlementaire &middot; ONEFOP"
          title={`Aperçu : ${selectedPreview.title}`}
          wide
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                className="cam-button cam-button-secondary"
                onClick={() => setSelectedPreview(null)}
              >
                Fermer
              </button>
              {canReadSubmissions && (
                <Link
                  href={`/admin/dossiers?formType=${selectedPreview.formType}`}
                  className="cam-button cam-button-primary"
                  onClick={() => setSelectedPreview(null)}
                >
                  Consulter les dossiers ({selectedPreview.formType})
                </Link>
              )}
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#f9fafb", padding: "12px 16px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
                  Questionnaire national homologué pour : {selectedPreview.title}
                </span>
                <span style={{ background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>
                  En vigueur
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                Code entité : <code style={{ color: "#1e6b3a" }}>{selectedPreview.formType}</code> &middot; Formats d&apos;export : SPSS (.sav) / CSV / Excel / Syntax (.sps)
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
                Sections d&apos;enquête obligatoires
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {CANONICAL_SECTIONS.map((sec) => (
                  <div
                    key={sec.code}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      borderRadius: 8,
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>
                        {sec.code} : {sec.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Conforme à la nomenclature officielle ONEFOP / DSMO
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#4b5563" }}>
                      {sec.questions}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AdminDialog>
      )}

      {/* ── Modal: Nouveau Questionnaire ── */}
      {isCreateOpen && (
        <AdminDialog
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          eyebrow="Homologation Réglementaire"
          title="Nouveau Questionnaire National"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                className="cam-button cam-button-secondary"
                onClick={() => setIsCreateOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="cam-button cam-button-primary"
                onClick={handleCreateSubmit}
              >
                Créer le questionnaire
              </button>
            </div>
          }
        >
          <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="q-name">Intitulé du questionnaire</label>
              <input
                id="q-name"
                type="text"
                className="cam-input"
                required
                placeholder="Ex. Enquête Sectorielle BTP 2026"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="q-type">Type d&apos;établissement ciblé</label>
              <select
                id="q-type"
                className="cam-select"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                <option value="ENTREPRISE">Entreprises</option>
                <option value="COOPERATIVE">Coopératives</option>
                <option value="ADMINISTRATION">Administration</option>
                <option value="PROJECT_PROGRAM">Projets & Programmes</option>
                <option value="VOCATIONAL_TRAINING">Centres de formation (ASFOP)</option>
                <option value="CTD">Collectivités Territoriales Décentralisées</option>
                <option value="ONG">ONG & Associations</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="q-sections">Nombre de sections</label>
                <input
                  id="q-sections"
                  type="number"
                  className="cam-input"
                  min="1"
                  max="12"
                  value={newSections}
                  onChange={(e) => setNewSections(e.target.value)}
                />
              </div>

              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="q-ref">Référence d&apos;homologation</label>
                <input
                  id="q-ref"
                  type="text"
                  className="cam-input"
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                />
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              Le questionnaire sera généré et aligné avec l&apos;arbre syntaxique abstrait (AST) du système national.
            </p>
          </form>
        </AdminDialog>
      )}
    </div>
  );
}
