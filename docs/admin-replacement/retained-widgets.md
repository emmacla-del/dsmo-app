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
| /admin/utilisateurs | Filter row: search, role scope (Régionaux et divisionnaires / Tous les rôles ONEFOP / per role), region | Agents ONEFOP: Filters / search | Only way to narrow the roster by role and territory | IMPLEMENTED |
| /admin/utilisateurs | Account-status chips (Tous / En attente / Actifs / Suspendus / Rejetés) | Agents ONEFOP: Filters / search (status) | Pending accounts must be reachable for approve/reject | IMPLEMENTED |
| /admin/utilisateurs | "Rôle" column | Agents ONEFOP: Tables (Role badge) | The frame shows no role; the roster mixes regional and divisional agents | IMPLEMENTED |
| /admin/utilisateurs | Row actions Approuver / Rejeter / Rôle / Suspendre–Réactiver / Supprimer (Figma shows only Profil \| Réassigner) | Agents ONEFOP: Actions | Existing account-lifecycle actions; restyled as the frame's text links | IMPLEMENTED |
| /admin/utilisateurs | "N départements sans divisionnaire actif" warning | Agents ONEFOP: warning for departments with no active Divisional agent | Coverage gap the national supervisor must act on | IMPLEMENTED |
| /admin/utilisateurs | Pagination (20 per page) | Agents ONEFOP: Tables (paginated, 20 per page) | Roster exceeds one page nationally | IMPLEMENTED |
| /admin/utilisateurs | Account count + "Actualiser" button above the table | — (no matrix entry) | Kept pending a decision; calls only GET /auth/users | OPEN |
| /admin/campagnes | History columns Code (under the name), Type, Ouverture, Clôture with the "Prorogée (était …)" indicator — the frame shows Période / Soumissions / Taux complétion instead | Gestion des campagnes: Tables | Live campaign fields; the frame's submission columns have no data source (see deferred.md) | IMPLEMENTED |
| /admin/campagnes | "Activer" button on DRAFT / PAUSED history rows | Gestion des campagnes: Actions ("Activer") | Only way to open a collection round from this screen | IMPLEMENTED |
| /admin/campagnes | "Envoyer un rappel" button + reminder-type dialog on the active campaign card (replaces the per-row "Rappel", since active campaigns now sit in the card) | Gestion des campagnes: Actions ("Envoyer un rappel", "Rappel") | Manual reminders to establishments that have not submitted | IMPLEMENTED |
| /admin/campagnes | "Mettre en pause" button on the active campaign card | Gestion des campagnes: Actions ("Mettre en pause") | Pausing is distinct from closing and has no Figma control | IMPLEMENTED |

`/admin/journal-audit` was a new screen (the sidebar entry had no page), so
no widgets are retained from it. The one control beyond the Figma frame, the
"Type d'objet" filter, comes from the matrix capability (object filters →
`resourceType`) and is not a retained widget.

| Screen | Widget | Matrix capability | Why retained | Status |
|---|---|---|---|---|
| /admin/diffusion | Scope "Données officielles" vs "Sélection personnalisée des statuts" (with per-status checkboxes) | Données et exports: scope mode radio | Preserves the official statistical base as the default export scope | IMPLEMENTED |
| /admin/diffusion | Filters questionnaire/entity type, année, région, département (were under "Filtres avancés") | Données et exports: advanced filters | Only way to narrow an official export; Figma shows campagne/région/statut only | IMPLEMENTED |
| /admin/diffusion | Scope summary line ("Périmètre : …") | Données et exports: export actions | Confirms exactly what will be exported before launching | IMPLEMENTED |
| /admin/diffusion | .sps syntax-only download (was the ".sps" format radio) — now "Codebook principal" in Codebooks disponibles | Données et exports: "Lancer l'export .sps" | Figma's formats are .SAV/.CSV/.XLSX; the syntax file stays downloadable on its own | IMPLEMENTED |
| /admin/diffusion | Error / success notices for exports | Données et exports: export actions | Export failures must be visible | IMPLEMENTED |
| /admin/diffusion | "Sections à inclure" checkboxes (UI-only, never sent) | Données et exports: sections checkboxes (UI only) | Not rebuilt: no effect on the file; filtering sections needs a §21 ruling (deferred.md) | OPEN |
| /admin/parametres | Read-only "Informations de l'observatoire" display for SUPER_ADMIN_ONEFOP / SUPER_ADMIN_DSMO (the editable form is SUPER_ADMIN only) | Paramètres: read-only reference display | GET/PATCH /system-settings are @Roles(SUPER_ADMIN); the other two page roles would get a 403 | IMPLEMENTED |
