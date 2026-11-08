# Staff console — registration and submission pages: UI/UX audit

Date: 2026-11-08 · Scope: `react-web/src/app/admin/inscriptions/**` and `react-web/src/app/admin/dossiers/**`, as they are in the working tree, uncommitted edits included.
Standard: `docs/standards/admin-layout-spec.md` (rev. 2), `src/app/admin/CLAUDE.md`, Constitution §7–§11.

**How it was done.** I read the code for each page, going through every action and layout region. I did not try the pages signed in. The only backend is production, and I don't sign in with real accounts. So every finding comes from the code and the stylesheets, and none was seen in a browser. A live pass at 1280 / 1024 / 820 / 390 px is still to do (§6).

Severity: **S1** a decision can be wrong, lost or made by the wrong person · **S2** breaks the spec or confuses the task · **S3** polish / consistency.

---

## 1. Summary

| # | Finding | Page | Sev |
|---|---|---|---|
| R-1 | Registration decisions do not need a claim, in the page or on the server. A reviewer can approve or reject a file someone else holds | `/admin/inscriptions/[id]` | S1 |
| R-2 | The verification marks are lost without warning on Précédent / Suivant, a duplicate link, or a 409 reload | `/admin/inscriptions/[id]` | S1 |
| R-3 | When Approuver is blocked, nothing becomes the primary action (spec §4C) | `/admin/inscriptions/[id]` | S2 |
| R-4 | « Hors délai » / « En retard » is shown in red (danger) on both registration pages. Spec §4B reserves red for blocking findings and wants time signals in the information tone | queue + review | S2 |
| R-5 | Suspend, reactivate and restore run straight from a menu: no confirmation and no error message | `/admin/inscriptions` (organisations) | S1 |
| R-6 | The « Déclarations » link sits inside a menu shown only to archive or lifecycle roles, so readers never see it | `/admin/inscriptions` (organisations) | S2 |
| R-7 | Claiming appears twice on every row (Affectation column link + « Réclamer et ouvrir »), and every unclaimed row has a primary button | `/admin/inscriptions` | S2 |
| R-8 | « Assigné à moi » is a filter pill, but spec §4F wants *whose* items as a quick view or tab | `/admin/inscriptions` | S2 |
| R-9 | Overdue is said four times: alert, summary line, pill count, row badge | `/admin/inscriptions` | S3 |
| R-10 | The queue's pagination sits outside its card, and differs in order, count format and announcement from the organisations view | `/admin/inscriptions` | S3 |
| N-1 | The assisted form shows one error at a time, in a banner at the top. Nothing is said under the fields and focus does not move to them | `/admin/inscriptions/nouvelle` | S2 |
| N-2 | Organisation types are boxed tiles. §9 forbids boxed radio options everywhere | `/admin/inscriptions/nouvelle` | S2 |
| N-3 | The assisted form accepts data the public form refuses: free-text function, phones optional and unchecked | `/admin/inscriptions/nouvelle` | S2 |
| D-1 | The campaign picker is in the page header. Spec §3 says filters never go there | `/admin/dossiers` | S2 |
| D-2 | The review-delay banner can never show: its condition excludes every view that reaches it | `/admin/dossiers` | S2 |
| D-3 | The overdue threshold is a hard-coded 7 days, while registrations use the server's setting; the badge is amber, not the information tone | `/admin/dossiers` | S2 |
| D-4 | Every claimable row has a primary button; « Valider » endorses from a dialog without opening the file | `/admin/dossiers` | S2 |
| D-5 | Claim, archive and reopen messages pile up as red alerts with no close button; a success shows nothing | `/admin/dossiers` | S3 |
| W-1 | The dossier workspace follows the spec; the registration review, built on the same frame, departs from it (R-1, R-3) | both workspaces | — |
| X-1 | Raw colours and inline styles in TSX (G1) | all | S3 |

---

## 2. `/admin/inscriptions` — registration queue

### Layout (spec §5: header → filters → table → pagination)

Order on screen, « File d'attente » view:

1. `AdminPageHeader`: « Inscriptions », primary action « Nouvelle inscription ».
2. `RegistrationsHubTabs` (File / Organisations).
3. Up to four notices, stacked: officer filter (info), decision or error notice, « Mise à jour… » line, overdue alert (warning).
4. Table card: status distribution → filter bar → chips → table.
5. Pagination, **outside** the card.

- **R-10.** In the queue, pagination sits under the card as a free row: range, then Précédent / Suivant. Its numbers go through `count()`, and it has no `AdminLiveResultCount`, so screen readers are not told the result count. In the organisations view it is inside the card: Précédent, range, Suivant, announced. Spec §3.6: pagination is attached to the region it controls. Use the organisations version in both.
- **Page size is 8** (`PAGE_SIZE`). The dossier queue uses 10. Eight rows is little for a work queue, and the review page's « n sur N » trail is rebuilt from that page size.
- **R-9.** « Hors délai » appears four times: the warning alert above the card (`overdueNotice`), the line under the distribution (`overdueSummary`), the count in the Statut pill, and the badge on each row. Keep the pill count and the row badge. The alert and the summary line say the same thing.
- The status distribution (Pending, Complements, Approved, Rejected) repeats the counts the Statut pill already shows. It also sits *inside* the result card, above the filters that change it. Spec §3.4 allows a summary strip only « when it helps the route's main task ». Here it pushes the table down by one block.

### Filter bar (spec §4F)

Search · scope · Statut · Doublons · territory · Affectation · saved views · Filtres · Tout effacer.

- **R-8.** « Affectation : Assigné à moi » is a pill. §4F: « Views that decide *whose* items are listed (Toute la file, Mes dossiers, Non réclamés…) are tabs or quick views above the bar, not filters ». The dossier queue does this right. That leaves four pills for a national admin (Statut, Doublons, Région, Affectation), with no room for Type, which the coverage page links here with `?type=`.
- The Statut pill offers Approuvé, Rejeté and Tous inside « File d'attente », while the Organisations tab exists for decided files. The queue tab can therefore show approved files, which blurs the line between tabs and filters (§4F).
- The sort order shows as an active-filter chip (« Date de soumission : plus ancien ») and is reset by « Tout effacer ». A sort is not a filter.

### Row actions

- **R-7.** An unclaimed row offers « Réclamer » (link, Affectation column) and « Réclamer et ouvrir » (primary button, Actions column). Both claim, but only the second opens the file. A reviewer who presses the first stays on the list holding a file they have not opened. Keep one claim action, in the Actions column. Show the assignee's name in the Affectation column, without an action.
- One primary button per view (G5): every unclaimed row's « Réclamer et ouvrir » is `variant="default"` (primary), and the header's « Nouvelle inscription » is primary too. With eight unclaimed rows, the screen has nine green buttons.
- Every row's main button is disabled while `queueUpdating` is true. That is every background refetch (staleTime 15 s), so buttons go grey for a moment while the reviewer reaches for them.
- **R-4.** The row's overdue badge is `variant="danger"` (red). Spec §4B: « a time signal (overdue, waiting) uses the information tone, so lateness never reads as an error ». The overdue alert above uses `warning` (amber), so the same fact appears in two colours, neither of them right.
- The duplicate column prints every hint as a list. A file with several matches makes its row several lines tall. The badge and count are enough; the review page has the list.

### Organisations view — row menu

- **R-5.** « Suspendre », « Réactiver » and « Restaurer » run when chosen in the menu. `src/app/admin/CLAUDE.md`: « Irreversible or account-affecting actions (delete, suspend, reactivate…) need a confirmation that names the record and the consequence ». `lifecycleMutation` has no `onError`, so a failed suspension says nothing. After an archive, the notice is cleared instead of confirming it.
- **R-6.** The menu is rendered only for `USER_ARCHIVE_ROLES` or `USER_LIFECYCLE_ROLES`, and it holds the read-only « Déclarations » link. Any other reader can never reach that link.
- When a row has no identifier, « Ouvrir » is a greyed `<span>` that cannot get focus, so nobody is told why it can't be opened.

### Export

- The « Exporter » button shows nothing while the CSV is built, and can be pressed again. An error goes to the shared notice. It works, but it gives no feedback.

---

## 3. `/admin/inscriptions/[id]` — registration review

### Layout (spec §5, §4C: three columns)

Header (name, status, waiting time, overdue badge; reference, type, territory, date, NIU; « n sur N » + Précédent / Suivant) → sections index | duplicates, changes, the four checks, respondent, identification, history | claim, « À vérifier », decision. Phone: summary bar + sheet. This matches the spec.

- **R-4.** The header shows two time signals side by side: « En attente depuis n jours » (information tone, as specified) and a red « En retard · n j » badge. Keep the first, add « · en retard » to it as the dossier queue does, and drop the red badge.

### Actions, one by one

**Claim (panel, top)**
- **R-1 (S1).** Claiming is a small text button, and **the decision buttons appear whether or not the reviewer holds the claim**, including when « Réclamé par X » is shown. Spec §4C (which `CLAUDE.md` says this page follows): « While the file is not claimed, the claim action is the panel's main button and the decision area says « Réclamez ce dossier pour décider »; decision buttons appear once the claim is held. » The server does not check either: `AuthService.approveUser`, `rejectUser` and `requestComplements` never read `assigneeId`. Two reviewers can therefore decide the same file. `expectedRevision` refuses the second decision only when the first changed `updatedAt` before it was sent. Requiring the claim is a workflow and RBAC change, so it needs your decision (§21) before anyone builds it.

**The four verifications (centre)**
- The native radios have no default, and « Conforme » is disabled when nothing was recorded: correct (§9, `CLAUDE.md`).
- **R-2 (S1).** The marks live only in page state. Précédent / Suivant (`moveTo`), the « Ouvrir le dossier … » links in the duplicates section and in each row's notes, and « Recharger » after a 409 all discard them without asking. A reviewer who has checked three of four rows and opens the suspected duplicate to compare comes back to nothing. Suggested: a guard naming what will be lost (`UnsavedNavigationGuard` exists), or open the duplicate in a new tab.

**Decision (panel, bottom)**
- **R-3.** When Approuver is blocked (a row marked non-compliant, an empty field, the central check unticked), it stays the first button: disabled, styled as primary. « Demander des compléments » stays secondary. The screen then has no enabled primary action. Spec §4C, applied in the dossier workspace: when the visa is impossible, the correction request becomes primary. Do the same here.
- The reason box is shared by Rejeter and Demander des compléments. Text typed for one stays when switching to the other, so a rejection reason can go out as a complements message. Clear it on switch, or keep one text per choice.
- The reason needs only to be non-empty. The dossier dialogs require 10 characters and say how many are still needed (`CLAUDE.md`: « Reasons and justifications keep their minimum length and say how many characters are still needed »). Since this text is sent to the declarant, a one-character « . » should not pass.
- The confirmation is inline under the buttons, as the spec wants. Approuver has no confirmation step; that is acceptable, because the four checks are its confirmation.

**Sections index**
- The active section is tracked by an `IntersectionObserver` whose root is chosen once, when the page loads, from `min-width: 1024px`. If the window is resized across 1024 px, the highlight stops following.

---

## 4. `/admin/inscriptions/nouvelle` — assisted registration

### Layout (spec §4D: header → grouped fields → actions at the end)

Header with breadcrumb → lede → step links (1–4 with ✓) → error banner → four numbered sections → status line + Enregistrer + Annuler → success dialog. The order is right.

- **N-1.** `firstProblem()` returns the **first** problem only. It is shown in a banner above the form, which receives focus, and nothing marks the field itself. Example: last name missing and region missing. The officer reads « nom requis », scrolls down, fixes it, submits, gets « localisation requise », and scrolls again. Errors should appear under each field, with a summary at the top whose links go to each field, as the public form does.
- **N-2.** The seven organisation types are tiles: border, 76 px tall, hover fill, a ring when selected (`.cam-entity-type-option`). The Constitution §8 says « §9's rule on radio and checkbox options applies everywhere », and §9 forbids enclosing options in decorative containers. Make it a plain list of radios, as on the public form.
- **N-3.** The same organisation is held to different rules depending on who registers it:
  - Function: a list on the public form, free text here.
  - Respondent phone: required and checked as a Cameroonian number on the public form; optional and unchecked here.
  - Order: public = type → respondent → organisation → location; here = type → organisation → respondent → location.

  An officer entering a paper form gets no help with the format the respondent's own form would have required, so the officer's records come out less clean than self-registrations.
- The selects are shadcn `Select` (a custom listbox); the public form and the queue's filters use native `<select>`. On a phone this means no native picker, and typing to jump to an option works differently.
- Enregistrer is disabled while the region and sector lists load, without saying why.
- In the success dialog, the secondary button is labelled with the page title (« Nouvelle inscription ») and means « register another ». The temporary password is shown once, and the dialog can't be closed until the officer ticks that they have noted it. Both are right.

---

## 5. `/admin/dossiers` — dossier queue

### Layout (spec §5: header + sub-nav → views → quick views → filter bar → selection toolbar → table → pagination)

- **D-1.** In the Complétés and Suivi views, the campaign `<select>` is in the header's actions (`cam-dossier-campaign`). Spec §3 [v2]: « Search and filters are never header actions ». It narrows the table, so it belongs in the table card's toolbar, as `/admin/cibles` does with `CampaignPicker`.
- **D-2.** The review-delay banner (`reviewDelayBanner`) renders only when `vue !== "submissions" && vue !== "completed"`. The other two views, `followup` and `coverage`, return before it is reached, so the banner can never show. The same condition guards the per-status notes (`STATUS_VIEWS … vue !== "submissions"`), which show only on Complétés. Either remove the banner or show it on the queue, where it was meant to be.
- **D-5.** `reopenNotice`, `assignNotice` and `archiveNotice` stack as alerts with no close button. The claim and archive notices are always red, including for messages that are not failures. A successful archive or restore shows nothing.

### Rows and actions

- **D-3.** « En retard » is computed against a fixed **7 days** (`elapsedMoreThanDays(…, 7)`). The registration queue uses the threshold set in `/admin/parametres`, as the server returns it. The badge is amber (`warning`), where §4B asks for the information tone.
- **D-4.** Each row's main action is chosen by `selectDossierQueuePrimaryAction`: Réclamer, Examiner les points, Valider, Historique, or Ouvrir. The first three are primary on every row, so a screen of unclaimed files has ten green buttons. « Valider » opens a quick-validation dialog from the list, so a file can be endorsed without opening the workspace. That is a deliberate shortcut for files with no findings. Even so, the queue's main action should not be the one that skips reading the file.
- The « Contrôles » column's explanation is in a `title` attribute only. It can't be read on a touch screen and is not announced reliably.
- Bulk toolbar: « Viser la sélection » (primary) and « Rejeter la sélection » (solid red) sit side by side. Both open confirmation dialogs, and ineligible files are listed with the reason (« Pourquoi exclus »). Good. Consider making the reject button outlined: as it stands, two filled buttons of equal weight sit side by side.

---

## 6. `/admin/dossiers/[id]` — dossier workspace (for comparison)

This page meets the spec where the registration review does not:

- `canReviewDossier` requires an active claim. Without it, the panel says « Réclamez ce dossier pour décider » and shows no decision buttons.
- With blocking findings, « Demander une correction » is primary and shows the count, and « Viser » is disabled with its reason above.
- Rejection and reopening require 10 characters, say what is missing, and need the certification box ticked; the visa asks for a justification when warnings are open.
- J / K work only while focus is on a finding.

What is left to improve: 15 inline `style={{…}}` objects (for example the correction dialog's footer), which go around the class vocabulary (G1).

**W-1.** The registration review copies this frame but not these rules. Bringing R-1, R-3 and the 10-character reason across would make the two review screens work the same way. Reviewers often handle both.

---

## 7. Cross-cutting

- **X-1.** Raw colours in TSX: the sticky first column's `shadow-[2px_0_3px_-3px_rgba(15,23,42,0.45)]` is repeated in both queues. G1: « No hex in TSX ». An rgba value is the same problem. Put it in a token or class.
- **Time signals** use three tones across the four pages: red (registrations), amber (dossier queue, registration alert), information (workspace waiting badge). The spec wants information everywhere.
- **Page size**: 8 for registrations, 10 for dossiers.
- **Confirmations**: dossier archive, reopen, reject and bulk actions all confirm; registration suspend, reactivate and restore do not.

## 8. Not covered, to do next

1. A signed-in pass at 1280 / 1024 / 820 / 390 px with long French labels (`CLAUDE.md` « Before you change a screen »). In particular: the phone sheet on both review pages, the sticky columns of the queues at 820 px, and the filter bar wrapping.
2. The quick-validation dialog and the bulk dialogs, which I read only at the call sites.
3. Keyboard-only runs through claim → check → decide on both review pages.

## 9. Suggested order

1. **Decide R-1** (claim required to decide a registration): RBAC/workflow, owner's decision.
2. R-2, R-5: guard the marks; confirm and report account actions.
3. R-3, R-4, D-3: primary swap; one information tone and one server threshold for every time signal.
4. N-1, N-2, N-3: error presentation and data rules of the assisted form.
5. D-1, D-2, R-6, R-7, R-8: placement and dead UI.
6. S3 items.

---

## 10. Outcome (2026-11-08, afternoon)

Decisions by the owner: **R-1** — deciding a registration requires holding the claim, as for declarations. **D-4** — the « Valider » shortcut stays; rows lose their primary buttons.

| # | Status | What changed |
|---|---|---|
| R-1 | Done in the page; server part open | The decision area asks to claim first. `dsmo_server` already refuses a decision on a file held by someone else; it must also refuse one on a **free** file (`AuthService.approveUser`, `rejectUser`, `requestComplements`: require `assigneeId === actor`). |
| R-2 | Done | Précédent / Suivant and every link ask before marks or a reason are lost. « Recharger » after a 409 still clears them: the file changed, so they no longer apply. |
| R-3 | Already done | « Demander des compléments » becomes primary when approval is impossible. Reasons: one text per choice, 10 characters minimum with the count left. |
| R-4 | Done | Information tone everywhere; one time signal in the review header. |
| R-5, R-6 | Done | Account actions confirmed and reported; the menu and its « Déclarations » link reach every reader. |
| R-7 | Done | One claim action (Actions column); the Affectation column shows who holds the file. Row buttons secondary; no greying during background refreshes. |
| R-8 | Done | Quick views « Toute la file / Mes inscriptions »; Type is a pill. The order is no longer a chip. |
| R-9, R-10 | Done earlier today | Overdue said once (pill count + row badge, key figure); numbered pager in the card. |
| N-1 | Done | Errors under each field and in a linked summary; browser bubbles off. |
| N-2 | Done | Plain radio list. |
| N-3 | Done | Public form's order and rules; native selects. |
| D-1 | Done | Campaign selector with the list. |
| D-2 | Done | Dead banner removed. |
| D-3 | Done | Server threshold, information tone. |
| D-4 | Done | Row buttons secondary; shortcut kept. |
| D-5 | Done | One closable notice; successes shown. |
| X-1 | Done earlier today | Sticky-column shadow and its raw rgba removed with the sticky column. |

Still open: the server half of R-1; the signed-in pass at 1280 / 1024 / 820 / 390 px (§8); page size 8 vs 10.
