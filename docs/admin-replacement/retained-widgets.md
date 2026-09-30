# Retained widgets

Widgets present on a screen before its Figma rebuild but absent from the
Figma frame. They are kept, restyled in `cam-admin-*`, and logged here as
the design handoff. Figma is not edited.

Status: IMPLEMENTED = retained and rebuilt; OPEN = no matrix entry, kept
pending a decision.

| Screen | Widget | Matrix capability | Why retained | Status |
|---|---|---|---|---|
| /admin/parametres | "Intégration" section-nav entry (API backend, Formats d'export statistique, Observatoire — analyses) | Paramètres: read-only reference display | Only place the export formats and API stack are documented for admins | IMPLEMENTED |
| /admin/parametres | Contrôle d'accès (RBAC) block (model, levels, server-side isolation) — under "Utilisateurs & Rôles" | Paramètres: read-only reference display | States that geographic boundaries are enforced server-side | IMPLEMENTED |
| /admin/parametres | Authentification block + localStorage JWT warning — under "Sécurité & Audit" | Paramètres: read-only reference display | Records the known JWT-storage risk (CLAUDE.md §15) | IMPLEMENTED |
| /admin/parametres | Courriel transactionnel block + delivery warning — under "Notifications" | Paramètres: read-only reference display | Email delivery is currently unreliable; admins need to know | IMPLEMENTED |
| /admin/parametres | Rappels automatiques block — under "Notifications" | Paramètres: read-only reference display | Explains where reminders are triggered (Campagnes) | IMPLEMENTED |
| /admin/parametres | Collecte statistique + Exercice statistique values (questionnaire, visa flow, coherence mode, reference year, period) — shown as "Paramètres de collecte" | Paramètres: read-only reference display | Figma's collecte fields have no persisted source; these are the real values | IMPLEMENTED |
| /admin/parametres | Organisation value in "Informations de l'observatoire" | Paramètres: read-only reference display | Existing identity field not in Figma | IMPLEMENTED |

`/admin/journal-audit` was a new screen (the sidebar entry had no page), so
no widgets are retained from it. The one control beyond the Figma frame, the
"Type d'objet" filter, comes from the matrix capability (object filters →
`resourceType`) and is not a retained widget.
