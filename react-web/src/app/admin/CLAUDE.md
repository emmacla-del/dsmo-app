# Admin console — UI/UX rules

Applies to everything under `src/app/admin/**` and `src/components/admin/**`.
Layout map: `docs/standards/admin-layout-spec.md` (revision 2). Classes and components: `docs/standards/ui-grammar.md` (G1–G17). Values: `src/app/tokens.css`.
When this file and the spec disagree, the spec wins; fix this file.

## Before you change a screen

1. Find the route in spec §5 and its page family in §4. Keep its region order.
2. Run `npm run check:ui-grammar`, `npm run lint` and `npm test` before and after.
3. Look at the route at 1280, 1024, 820 and 390 px with long French labels.
4. A change that moves where work happens or adds a step is a **workflow change**: it needs a product decision, recorded in spec §10. Don't ship one as a "cleanup".

## Console rail

- One rail on every page (`layout.tsx`, `AdminSidebar`): from 1024px an icon strip by default; a hub's flyout shows its name and pages; « Afficher les libellés du menu » expands it, remembered per browser (`lib/admin-rail-preference.ts`). Don't add page-specific rail rules; the shell classes are `is-rail-compact` / `is-rail-expanded`.
- Below 1024px the rail is the drawer; flyouts and the expand control are hidden there.

## Page frame

- Root `.cam-admin-page`; header `AdminPageHeader` only, never a hand-built `<h1>` (G2, G3).
- Page title = its nav label. Breadcrumb on every page below a hub.
- The header holds route actions (create, export of the route). **Search and filters never go in the header**; they sit with the results they change.
- One primary button per view (G5).

## Containers

- Cards are the admin console's container (decision 2026-11-02): one card per result set, answer section, side panel or history. Use `--cam-surface`, a 1px `--cam-border` and `--cam-radius-lg`. Don't nest cards inside cards.

## Lists and queues

- Order: views/tabs → filter bar → result count + chips → table → pagination / selection toolbar.
- Filter bar (spec §4F): search, then at most four `AdminFilterPill`s chosen for the role's daily task, then « Filtres » (a panel holding every filter), then « Tout effacer » when something is active.
- Pills are single-choice and apply at once. A filter shown as a pill is never repeated as a chip. The « Filtres » count covers only filters without a pill.
- Territorial roles get an `AdminLockedFilterPill` with their scope instead of a region filter they can't really use.
- Every filter, view and page lives in the URL through `hrefWith` (G15).
- Tabs decide *whose* items are listed; filters narrow them. Don't mix the two.
- Wide tables scroll inside their own region (labelled, focusable); the first column may be sticky.

## Colour meaning

- Red (`--cam-error`, `--cam-flag-red`): blocking findings, rejection, destructive actions. Nothing else.
- Amber (`--cam-warning`, `--cam-gold-dark`): warnings to explain or correct.
- Information tone (`--cam-info`): time signals such as overdue or waiting days.
- Every colour is paired with a word. No hex in TSX (G1); no new colours outside `tokens.css`.

## Dossier review workspace (`/admin/dossiers/[id]`)

- Three columns: section index | answers | review panel (spec §4C). Keep that order; don't move decisions back under the header.
- From 1024px up the page doesn't scroll: only the centre column does. Put new content for the reviewer to read inside the centre column, never below the layout (it would be unreachable). Side columns stay short.
- The review panel, top to bottom: status + claim, Contrôles + checklist, decisions. Main action first; when blocking findings prevent a visa, « Demander une correction » is primary and « Viser » stays disabled with its reason shown.
- A finding is shown twice on purpose: as a card in « À vérifier » (figures, Expliquer) and as a notice under the flagged answer. Keep both linked.
- Sections without a finding fold; any `#` link into one must open it (the page's click/hashchange handler does this).
- Phone: the panel is a bottom sheet behind the summary bar. Anything added to the panel must work inside the sheet.
- Never weaken: the active-claim requirement, `expectedRevision` and the 409 reload path, certification checkboxes, 10-character reasons, the warning justification before a visa.

## Registration review (`/admin/inscriptions/[id]`)

- Same frame as the dossier workspace (classes `cam-dossier-*`, the layout adds `is-review-detail`): sections | what the reviewer reads and checks | claim, « À vérifier », decision.
- The four verifications have no default (native radios, unanswered = neither). « Approuver » stays disabled with the `approvalGate` reason until every applicable row is ✓ and, when required, the central structure is confirmed. The server checks the same rules.
- Rejecting or requesting complements opens an inline reason under the buttons; the text is sent to the declarant, so it is required.
- Every decision sends `expectedRevision` (`updatedAt`); a 409 shows « Recharger l'inscription », which reloads and clears the marks.
- Previous / next come from `lib/registration-trail.ts` (the queue page saved for the tab). Without it the page shows no position, which is correct.
- The queue's dialog stays until this page is approved (menu « Revue rapide (fenêtre) »). Change decision rules in both places until then.

## Lists without the dossier side panel

- Use `AdminFilterBarParts`: `AdminScopePill` for territorial roles, `territoryPillFor(role)` to choose the territory pill, `AdminFilterMore` (« Filtres » popover) with `AdminFilterField`s for everything without a pill. Export and refresh sit in the table panel's `actions`.
- Campaign pages: running campaigns are cards (`cam-campaign-card`); a table about one campaign takes the `CampaignPicker` in its card's toolbar (`/admin/cibles`). The campaign pill isn't repeated in these pages' headers.
- In ICU plurals pass the raw number (`{ count: n }`), never `count(n, locale)`: a formatted « 1 023 » is not a number and renders « NaN ».
- Record pages (`cam-record-layout`): main column of field cards (`cam-record-fields`) | side column (account, trail) that stays in view from 1100px.

## Dialogs and actions

- `AdminDialog` only (G7). Short decisions only; anything field-heavy is a route.
- Irreversible or account-affecting actions (delete, suspend, reactivate, activate or pause a campaign) need a confirmation that names the record and the consequence.
- Reasons and justifications keep their minimum length and say how many characters are still needed.
- Unanswered is not « No »: verification radios have no default.

## States

- Use `DataState` / `DataStateRow` for the six non-ready states, inside the region whose request they describe (G10).
- Never show a figure the server didn't send. While a value loads, show « — », never a hard-coded fallback.
- An empty filtered list names the active filters and offers to clear them.

## Copy

- French first, then English; every string is in `messages/fr.json` and `messages/en.json`, never hard-coded in TSX or `lib/`.
- Sentence case for headings and buttons. Formal register; dialogs state consequences (logged, notified, irreversible).
- No technical codes in labels (`WAIVED`, role enums). Rule codes appear only as secondary monospace text.

## Accessibility

- Real `<button>`, `<a href>`, `<input>` with `<label>`; icon-only buttons get `aria-label`.
- Popovers and sheets: focus moves in on open, Escape closes, focus returns to the trigger.
- Keyboard shortcuts (J / K in the workspace) are ignored while typing and while a dialog is open.
- Result counts and refreshes are announced with `AdminLiveResultCount` / `role="status"`.
- Respect `prefers-reduced-motion`.

## Known gaps (don't paper over them in the UI)

- Saved views live in the officer's browser (per device), not on the server.
- The previous period is shown for the main questionnaires; the training-centre (VT) sections don't show it yet.
- The Annuaire « Entités » search is held in the page, not the URL (it would clash with the « Utilisateurs » tab's `?q=`).
