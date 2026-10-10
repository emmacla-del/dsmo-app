# UI polish pass — route checklist

Started 2026-10-10. A route is ticked only after its rendered page has been
inspected (desktop + mobile width) and its main interactions exercised.
Systemic fixes go into shared components / tokens and are listed once under
"Shared fixes", then referenced from each route they affect.

Legend: `[ ]` not inspected · `[~]` inspected, issues open · `[x]` done

## Public / auth

- [x] `/` — landing + sign-in. 9fd8c69f: notices are a ruled list. Advisory: 2 off-scale inline spacings in `app/page.tsx` (:343, :360)
- [x] `/login` — redirects to `/`
- [x] `/register` — 8b201155 one column + page scroll; layout script 155/155 (desktop + mobile, no submission)
- [x] `/inscription-agent` — 9fd8c69f: back-to-sign-in footer link (invalid state checked; form state needs a valid invitation token)
- [x] `/forgot-password` — 58fdd865
- [x] `/reset-password` — 58fdd865 (no-token + form states, eye toggle, 375px)
- [x] `/verify-email` — 58fdd865

## Respondent

- [ ] `/home`
- [ ] `/home/[slug]`
- [ ] `/home/annuaire`
- [ ] `/home/declarations`
- [ ] `/home/declarations/new` — ONEFOP / VT wizard
- [ ] `/home/inscription-en-attente`
- [ ] `/onefop/preview`

## Staff console — supervision

- [ ] `/admin/pilotage`
- [ ] `/admin/dossiers`
- [ ] `/admin/dossiers/[id]` — review workflow
- [ ] `/admin/centre-qualite`
- [ ] `/admin/equipe`

## Staff console — collection

- [ ] `/admin/campagnes` (grammar reference page)
- [ ] `/admin/cibles`
- [ ] `/admin/questionnaires`
- [ ] `/admin/diffusion`
- [ ] `/admin/notifications`

## Staff console — directory

- [ ] `/admin/annuaire`
- [ ] `/admin/etablissements`
- [ ] `/admin/etablissement-detail`
- [ ] `/admin/inscriptions`
- [ ] `/admin/inscriptions/nouvelle`
- [ ] `/admin/utilisateurs`
- [ ] `/admin/sectors`

## Staff console — system

- [ ] `/admin/journal-audit`
- [ ] `/admin/parametres`

## Shared fixes

- b161783a — admin page rhythm: `.cam-admin-page` gap is the only vertical spacing between page blocks.
- 58fdd865 — auth card title recipe (`receipt-title` / `receipt-subtitle`) shared by the whole auth family; lede spacing fixed once in `globals.css`.

## Known systemic signals (from `npm run check:ui-grammar`, 2026-10-10)

Advisory `respondent-spacing-off-scale` regressions above baseline in the
wizard: `VtWizardSidebar.tsx` (20→21), `OnefopPdfPreviewModal.tsx` (12→16),
`VtValidationScreen.tsx` (9→11), `VtScopeQuiz.tsx` (0→5), `app/page.tsx` (0→2).
