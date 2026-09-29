# Plan: Align React VT wizard UI/UX to Flutter

**Reference:** Flutter VT wizard (`vt_wizard_shell.dart`, `vt_wizard_section_screen.dart`, `vt_wizard_fields.dart`, `vt_wizard_spreadsheet_grid.dart`, `vt_wizard_table_guided_entry.dart`).

**Do not regress:** `VtTableRenderer` 2D arrow keys + `recalculateVtRow` (`onefop-formulas.ts`). Simple/Tableur modes stay on shared `FieldControl` / `SectionRenderer`.

**Out of scope:** changing validation-back (both apps already jump to section 9); pixel-perfect Figma beyond the Flutter widgets.

## Steps

1. **Wizard chrome** — VT tokens (Manrope, `#0A6640`, 12px cards, 900px). Drop top “Section N / 9” dots on VT. Section 1 Back = **Annuler** (`onCancel` → `/home`). Bottom labels: Étape précédente / Suivant / Vérifier & Soumettre. Keep recap in the sidebar, not a duplicate mid-form button.
2. **Section layout** — card groups by subsection; category tabs on sections 4 & 8 (and 2/3/5/6/7/9 in Mode Tableur). Per-section **Mode Guidé / Mode Tableur** when the section has a table and viewport ≥ 1024.
3. **Field skin (wizard only)** — Oui/Non + sex radios as pills; number steppers (except VT2_19–22); no red input outline (error text only); Oui+dependent-number as **Nombre : [box]**; compact toggles on sections 6 & 7; presentational Signatures card on section 9.
4. **Tables** — Guidé: guided-entry cards (fixed 2-number, multi-number, progressive number/boolean, roster). Tableur: spreadsheet chrome (accent header, `#` column, row status, **Σ TOTAL AUTO**, right-aligned numbers). Keep keyboard nav + formulas on the grid.
5. **Verify** — typecheck; exercise VT wizard in the browser (Identification, a table section Guidé/Tableur, section 9 signatures, Annuler, recap).
