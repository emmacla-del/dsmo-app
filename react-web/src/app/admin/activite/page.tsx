"use client";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { listAdminQuestionnaires, getPilotageQueues } from "@/lib/api-client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";

// Mock activity events matching Figma styling
const DEFAULT_ACTIVITIES = [
  {
    id: "act-1",
    time: "09:42",
    date: "Aujourd'hui",
    actor: "SABC S.A.",
    role: "Déclarant (Littoral)",
    action: "Déclaration soumise",
    actionType: "submission",
    targetId: "ENT-2026-04521",
    details: "Questionnaire Entreprises soumis pour validation ministérielle.",
    region: "Littoral",
  },
  {
    id: "act-2",
    time: "09:37",
    date: "Aujourd'hui",
    actor: "Agent Ndongo",
    role: "Instructeur Régional",
    action: "Déclaration retournée",
    actionType: "return",
    targetId: "ADM-2026-01042",
    details: "Retour pour correction : pièces justificatives d'effectifs manquantes.",
    region: "Centre",
  },
  {
    id: "act-3",
    time: "09:31",
    date: "Aujourd'hui",
    actor: "Coop. Cacaoyère du Sud",
    role: "Déclarant (Sud)",
    action: "Inscription validée",
    actionType: "validation",
    targetId: "COP-2026-00214",
    details: "Nouvel établissement enregistré dans le répertoire national.",
    region: "Sud",
  },
  {
    id: "act-4",
    time: "09:15",
    date: "Aujourd'hui",
    actor: "M. Ewane",
    role: "Superviseur National",
    action: "Visa en lot (3 dossiers)",
    actionType: "visa",
    targetId: "ENT-2026-04522",
    details: "Visa administratif accordé avec succès sans anomalie bloquante.",
    region: "National",
  },
  {
    id: "act-5",
    time: "08:58",
    date: "Aujourd'hui",
    actor: "GIC Espoir",
    role: "Déclarant (Nord-Ouest)",
    action: "Documents téléversés",
    actionType: "upload",
    targetId: "COP-2026-00215",
    details: "Fichiers bilans financiers et registre du personnel ajoutés.",
    region: "Nord-Ouest",
  },
  {
    id: "act-6",
    time: "08:42",
    date: "Aujourd'hui",
    actor: "Système Automatisé",
    role: "Contrôle Qualité",
    action: "Alerte de cohérence",
    actionType: "alert",
    targetId: "ENT-2026-04521",
    details: "Écart détecté : effectif déclaré (1 245) ≠ somme des postes (1 189).",
    region: "Littoral",
  },
  {
    id: "act-7",
    time: "08:30",
    date: "Aujourd'hui",
    actor: "Nexttel Cameroun",
    role: "Déclarant (Centre)",
    action: "Déclaration initiée",
    actionType: "draft",
    targetId: "ENT-2026-04523",
    details: "Brouillon de déclaration trimestrielle créé par l'établissement.",
    region: "Centre",
  },
];

const SUPERVISION_ALERTS = [
  {
    id: "alt-1",
    level: "bloquante",
    title: "Incohérence arithmétique d'effectif",
    targetId: "ENT-2026-04521",
    company: "SABC S.A. (Brasseries du Cameroun)",
    region: "Littoral",
    description: "Écart de 56 postes non ventilés dans la grille des catégories socio-professionnelles.",
    delay: "En attente depuis 14h",
  },
  {
    id: "alt-2",
    level: "delai",
    title: "Délai d'instruction régional dépassé",
    targetId: "ADM-2026-01042",
    company: "MINSANTE Délégués",
    region: "Centre",
    description: "Fiche reçue il y a 76h sans décision de visa ou de renvoi pour correction.",
    delay: "Dépassé de +28h",
  },
  {
    id: "alt-3",
    level: "retour",
    title: "Correction déclarant en attente",
    targetId: "COP-2026-00215",
    company: "COOP-CA Ouest",
    region: "Ouest",
    description: "Demande de correction envoyée il y a 5 jours ouvrables. Aucun retour soumis.",
    delay: "Échéance dans 2 jours",
  },
  {
    id: "alt-4",
    level: "qualite",
    title: "Ratio masse salariale hors norme",
    targetId: "PRJ-2026-00896",
    company: "PNDP Littoral",
    region: "Littoral",
    description: "Masse salariale par employé supérieure de 35% à la moyenne sectorielle.",
    delay: "Avis requis",
  },
];

function ActiviteContent() {
  const user = useAuthStore((s) => s.user);

  // Filters
  const [periodFilter, setPeriodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState(user?.region || "all");
  const [searchQuery, setSearchQuery] = useState("");

  const queuesQuery = useQuery({
    queryKey: ["admin", "pilotage", "queues"],
    queryFn: getPilotageQueues,
  });

  const queues = queuesQuery.data;

  // Filter activities
  const filteredActivities = useMemo(() => {
    return DEFAULT_ACTIVITIES.filter((act) => {
      if (regionFilter !== "all" && act.region.toLowerCase() !== regionFilter.toLowerCase() && act.region !== "National") {
        return false;
      }
      if (typeFilter !== "all") {
        if (typeFilter === "alert" && act.actionType !== "alert") return false;
        if (typeFilter === "visa" && act.actionType !== "visa") return false;
        if (typeFilter === "return" && act.actionType !== "return") return false;
        if (typeFilter === "submission" && act.actionType !== "submission") return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          act.actor.toLowerCase().includes(q) ||
          act.targetId.toLowerCase().includes(q) ||
          act.details.toLowerCase().includes(q) ||
          act.action.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [regionFilter, typeFilter, searchQuery]);

  return (
    <div className="cam-admin-page" style={{ maxWidth: 1440, margin: "0 auto" }}>
      {/* ── Page Header ── */}
      <AdminPageHeader
        breadcrumb={[{ label: "Supervision" }, { label: "Activité & alertes" }]}
        title="Activité Récente & Alertes"
        subtitle="Traçabilité des opérations d'instruction, journal d'événements et alertes de contrôle"
        actions={<AdminHeaderActions />}
        hideTabs={true}
      />

      {/* ── In-Page Sub-navigation Pills matching Figma ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <Link
          href="/admin/pilotage"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 16px",
            borderRadius: 6,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            color: "#374151",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
          }}
        >
          Tableau de bord
        </Link>
        <Link
          href="/admin/dossiers"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 16px",
            borderRadius: 6,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            color: "#374151",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
          }}
        >
          Dossiers en instance
        </Link>
        <Link
          href="/admin/activite"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 16px",
            borderRadius: 6,
            background: "#1e6b3a",
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "0 1px 3px rgba(30, 107, 58, 0.2)",
          }}
        >
          Activité & alertes
        </Link>
      </div>

      {/* ── KPI Counter Strip ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderLeft: "4px solid #dc2626", borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Alertes actives</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginTop: 4 }}>
            {queues?.blockingAnomaliesCount || 14}
          </div>
          <div style={{ fontSize: 12, color: "#dc2626", marginTop: 2, fontWeight: 500 }}>
            4 prioritaires à traiter
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderLeft: "4px solid #f59e0b", borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Dossiers en instance</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginTop: 4 }}>
            {queues?.totalSubmissionsCount || 38}
          </div>
          <div style={{ fontSize: 12, color: "#d97706", marginTop: 2, fontWeight: 500 }}>
            En attente de visa administratif
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderLeft: "4px solid #3b82f6", borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Retours pour correction</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginTop: 4 }}>
            {queues?.correctionsUnderReviewCount || 7}
          </div>
          <div style={{ fontSize: 12, color: "#2563eb", marginTop: 2, fontWeight: 500 }}>
            En cours chez les déclarants
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderLeft: "4px solid #1e6b3a", borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Visas délivrés (Total)</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginTop: 4 }}>
            {queues?.approvedCount || 6983}
          </div>
          <div style={{ fontSize: 12, color: "#16a34a", marginTop: 2, fontWeight: 500 }}>
            Intégrés dans la base statistique
          </div>
        </div>
      </div>

      {/* ── Filters Card matching Figma style ── */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "16px 20px",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>
              Période
            </label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff" }}
            >
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd&apos;hui</option>
              <option value="24h">Dernières 24 heures</option>
              <option value="7d">Derniers 7 jours</option>
              <option value="30d">Derniers 30 jours</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>
              Type d&apos;événement
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff" }}
            >
              <option value="all">Tous les types</option>
              <option value="alert">Alertes de cohérence</option>
              <option value="visa">Visas accordés</option>
              <option value="return">Retours pour correction</option>
              <option value="submission">Soumissions reçues</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>
              Région
            </label>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff" }}
            >
              <option value="all">Toutes les Régions</option>
              <option value="Littoral">Littoral</option>
              <option value="Centre">Centre</option>
              <option value="Ouest">Ouest</option>
              <option value="Sud-Ouest">Sud-Ouest</option>
              <option value="Nord">Nord</option>
              <option value="Extrême-Nord">Extrême-Nord</option>
              <option value="Sud">Sud</option>
              <option value="Adamaoua">Adamaoua</option>
              <option value="Est">Est</option>
              <option value="Nord-Ouest">Nord-Ouest</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>
              Recherche libre
            </label>
            <input
              type="text"
              placeholder="Rechercher par ID, acteur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#ffffff" }}
            />
          </div>
        </div>
      </section>

      {/* ── Main Two Column Layout: Activity Stream (Left) & Alerts (Right) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Left Column: Chronological Activity Feed */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
              Journal des Événements Récents ({filteredActivities.length})
            </h2>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Mise à jour en temps réel</span>
          </div>

          <div style={{ padding: "8px 0" }}>
            {filteredActivities.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#6b7280", fontSize: 14 }}>
                Aucun événement d&apos;activité ne correspond aux filtres sélectionnés.
              </div>
            ) : (
              filteredActivities.map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                    padding: "14px 20px",
                    borderBottom: "1px solid #f3f4f6",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ textAlign: "center", width: 44, flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{act.time}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{act.date}</div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                        {act.actor}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background: "#f3f4f6",
                          color: "#4b5563",
                          fontWeight: 500,
                        }}
                      >
                        {act.role}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          background:
                            act.actionType === "alert"
                              ? "#fef2f2"
                              : act.actionType === "visa"
                              ? "#ecfdf5"
                              : act.actionType === "return"
                              ? "#fffbeb"
                              : "#eff6ff",
                          color:
                            act.actionType === "alert"
                              ? "#dc2626"
                              : act.actionType === "visa"
                              ? "#16a34a"
                              : act.actionType === "return"
                              ? "#d97706"
                              : "#2563eb",
                        }}
                      >
                        {act.action}
                      </span>
                    </div>

                    <p style={{ margin: "2px 0 6px", fontSize: 13, color: "#4b5563", lineHeight: 1.4 }}>
                      {act.details}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Link
                        href={`/admin/dossiers/${act.targetId}`}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#1e6b3a",
                          textDecoration: "none",
                        }}
                      >
                        Dossier #{act.targetId} →
                      </Link>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>•</span>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>Région {act.region}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Column: Active Alerts Panel */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "18px 20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
                  Alertes de Contrôle Prioritaires
                </h2>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: "#fee2e2",
                  color: "#dc2626",
                  padding: "2px 8px",
                  borderRadius: 9999,
                }}
              >
                {SUPERVISION_ALERTS.length} en cours
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {SUPERVISION_ALERTS.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 8,
                    background: alert.level === "bloquante" ? "#fef2f2" : "#fefce8",
                    border: alert.level === "bloquante" ? "1px solid #fecaca" : "1px solid #fef08a",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <strong style={{ fontSize: 13, color: alert.level === "bloquante" ? "#991b1b" : "#854d0e" }}>
                      {alert.title}
                    </strong>
                    <span style={{ fontSize: 11, fontWeight: 600, color: alert.level === "bloquante" ? "#dc2626" : "#b45309" }}>
                      {alert.delay}
                    </span>
                  </div>

                  <p style={{ margin: "2px 0 8px", fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
                    {alert.company} — {alert.description}
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
                      Région : {alert.region}
                    </span>
                    <Link
                      href={`/admin/dossiers/${alert.targetId}`}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: alert.level === "bloquante" ? "#b91c1c" : "#b45309",
                        textDecoration: "none",
                        background: "#ffffff",
                        padding: "3px 10px",
                        borderRadius: 4,
                        border: "1px solid rgba(0,0,0,0.1)",
                      }}
                    >
                      Examiner la fiche →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quality Engine Sync Status */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "16px 20px",
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
              Moteur de Contrôle Statistique
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>
              Les règles arithmétiques et seuils de complétude s&apos;exécutent à chaque soumission de fiche.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#4b5563" }}>Dernière exécution :</span>
                <strong style={{ color: "#111827" }}>Il y a 3 minutes</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#4b5563" }}>Règles actives :</span>
                <strong style={{ color: "#16a34a" }}>32 règles de contrôle</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#4b5563" }}>Statut du service :</span>
                <strong style={{ color: "#16a34a" }}>● Opérationnel</strong>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ActivitePage() {
  return (
    <Suspense fallback={null}>
      <ActiviteContent />
    </Suspense>
  );
}
