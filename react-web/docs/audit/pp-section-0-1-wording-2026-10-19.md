# Project / Programme — Sections 0 and 1: wording and tooltips

Audit, 2026-10-19. Read-only; nothing changed. Scope: what a Projet /
Programme respondent reads on the first two screens of the wizard, and the
tooltips attached to them. The tooltip finding turned out not to be a project
problem at all — it reaches five of the six Modern Jobs forms — so the other
forms are audited with it, as asked.

Sources: `lib/core/focus/compiler/onefop_ast.dart` (canonical), the generated
`react-web/public/schemas/onefop.schema.json`, `src/pdf/i18n/{fr,en}.json` and
`src/pdf/templates/dynamic/projectProgram.hbs` (the official output),
`react-web/src/components/onefop/FieldRenderer.tsx` and
`modern-jobs-tooltips.ts`.

---

## Summary

Section 0 is in good shape: its opening line, its question labels and its
placeholders all have a project wording of their own, and the generic
`« établissement »` fallback never reaches a project. Two small gaps remain,
both affecting the other forms rather than the project.

Section 1 is where the enterprise still shows through — in one card title and
in roughly half the question labels, which are terser and less specific than
the wording the platform's own official PDF already prints for the same
questions.

The tooltips are the serious finding. `FieldRenderer` falls back to the
**paper code** when a field id has no tooltip of its own, and every form
numbers its Section 1 questions `S1Q01`, `S1Q10`, `S1Q11`. So the three
definitions written for the *enterprise* are served to five other forms on
whatever question happens to carry the same number. **13 questions currently
show a tooltip that defines a different question**, and the four questions
those definitions were written for show none.

---

## A. Tooltips — wrong definitions served by paper-code collision

`react-web/src/components/onefop/FieldRenderer.tsx:236-238`

```ts
getModernJobsTooltip(field.id) ??
(field.paperCode ? getModernJobsTooltip(field.paperCode) : null);
```

`MODERN_JOBS_TOOLTIPS` holds `S1Q01`, `S1Q10`, `S1Q11`, `S3Q01` — all written
from the enterprise form, where `S1Q01` is « Régime/statut juridique »,
`S1Q10` is the permanent headcount and `S1Q11` the vacancies. On every other
form those numbers sit on different questions, and the id lookup misses
(`PP_S1Q01`, `COOP_S1Q10`, …), so the paper-code fallback fires.

### A.1 What a respondent actually sees today

| Form | Field | Question asked | Tooltip shown | |
|---|---|---|---|---|
| projectProgram | `PP_S1Q01` | Nature de la structure | *Régime juridique principal déclaré au registre de commerce ou décret de création.* | ✗ |
| projectProgram | `PP_S1Q10` | Objectif ou mission principale | *Effectif total des salariés sous contrat permanent… au dernier jour du trimestre.* | ✗ |
| projectProgram | `PP_S1Q11` | Siège social | *Nombre de postes ouverts et non pourvus… à la fin du trimestre.* | ✗ |
| cooperative | `COOP_S1Q01` | Nom de la coopérative | legal status | ✗ |
| cooperative | `COOP_S1Q10` | Type de la coopérative | permanent headcount | ✗ |
| cooperative | `COOP_S1Q10_OTHER` | Précisez | permanent headcount | ✗ |
| cooperative | `COOP_S1Q11` | Nombre d'employés permanents | **vacancies** definition | ✗ |
| ctd | `CTD_S1Q01` | Type de CTD | legal status | ✗ |
| ctd | `CTD_S1Q10` | Nombre de poste vacant | **permanent headcount** definition | ✗ |
| ong | `ONG_S1Q01` | Nom de l'ONG | legal status | ✗ |
| administration | `ADMIN_S1Q01` | Nom de l'administration | legal status | ✗ |
| administration | `ADMIN_S1Q10` | Combien de projets ? | permanent headcount | ✗ |
| administration | `ADMIN_S1Q11` | Existence de structures sous tutelle ? | vacancies | ✗ |
| ong | `ONG_S1Q10` | Nombre d'employé permanent | permanent headcount | ✓ by luck |
| ong | `ONG_S1Q11` | Nombre de poste vacant | vacancies | ✓ by luck |
| enterprise | `S1Q01` / `S1Q10` / `S1Q11` | — | — | ✓ intended |

The two worst are `COOP_S1Q11` and `CTD_S1Q10`: the question *is* about
staffing, so the definition reads plausibly, and it is off by one. A
cooperative reading « nombre de postes ouverts et non pourvus » under
« Nombre d'employés permanents » has been told to enter the wrong number.
That is a statistical risk, not just a copy problem.

### A.2 A tooltip on an internal control

`S3Q01_RESPONSE_STATUS` (« Statut de réponse ») carries `paperCode: "S3Q01"`
on all five employer forms, so the departures definition — *« Indiquez Oui
uniquement si des employés ont quitté l'organisation… »* — is attached to the
reported / not-reported selector rather than to the table it governs.

### A.3 Definitions that exist and are shown nowhere

Twelve of the eighteen entries in `modern-jobs-tooltips.ts` are concept keys
(`SFP`, `CSS`, `FOREMEN`, `WORKERS`, `SCOOPS`, `COOP_CA`,
`CHOMAGE_TECHNIQUE`, `LICENCIEMENT_ECONOMIQUE`, the three `STAGE_*`, and
`S2Q01`). `FieldRenderer` is the registry's only consumer and it looks up a
field id or a paper code, so none of them can ever match. The four CSP
definitions in particular (CSS / agent de maîtrise / agent d'exécution /
SFP) are exactly what a respondent needs on the Section 4 tables, and they
are inert.

Meanwhile `PP_S1Q15`, `PP_S1Q16`, `CTD_S1Q09` and `COOP_S1Q12` — the real
headcount and vacancy questions on their forms — have no tooltip at all,
although the correct text for them is sitting in the file.

### A.4 Proposed fix

Key the registry by **field id only** and drop the paper-code fallback; add
explicit entries per form where a definition applies. The paper code is an
internal id (§8 keeps it off the respondent's screen in the label; it should
not be steering content either). Concept keys either get wired to the tables
that use them or are removed.

No statistical semantics, no cell key, no variable, no dataset version —
help text only.

---

## B. Section 0 — respondent identification

Already entity-aware, and correctly so:

- the opening line has `section0IntroProject` (`SectionRenderer.tsx:74`);
- S0Q02's label becomes « Fonction / Titre dans le projet »;
- the placeholders become « ex. Coordonnateur de projet » and
  « ex. contact@projet.cm »;
- S0Q02 gets a project-specific tooltip, inline in `FieldRenderer.tsx:230`.

Two gaps, neither of them the project's:

**B.1 — the project is the only form with its own placeholders.** The
administration, the NGO, the cooperative and the CTD all get a label of their
own (« Fonction / Titre dans l'ONG »…) and then the enterprise placeholders
underneath: *« ex. Directeur des Ressources Humaines »* and
*« ex. contact@entreprise.com »*. A town council has no DRH. Either give the
four remaining forms their own example, or make the generic one neutral
(« ex. Secrétaire général », « ex. contact@structure.cm »).

**B.2 — the canonical hints are enterprise-flavoured.** In the AST, S0Q02's
hint is `"Ex: DRH"` and S0Q03_EMAIL's is `"Ex: contact@entreprise.com"`
(`onefop_ast.dart:106,146`), shared by all six forms. They are dead in
react-web — the Section 0 branch computes its own placeholder and suppresses
the hint — but they are the canonical text and the Flutter client renders
hints. Low priority while react-web is the focus; worth correcting when the
AST is next touched.

**B.3 — the project's S0Q02 tooltip is hard-coded inside `FieldRenderer`**
rather than in the tooltip registry beside every other one. It works; it is
the wrong place for it, and it will be the thing someone misses when A.4 is
done.

---

## C. Section 1 — « should we call it nom de la structure? »

### C.1 The direct answer: no — « Nom du projet / programme »

The platform's own official PDF already prints this. `src/pdf/i18n/fr.json`
`projectProgram.s1q02` = **« Nom du projet / programme : »**, EN *"Name of the
project / program:"*, rendered at `projectProgram.hbs:460`. The wizard shows a
bare « Nom » for the same question.

Three reasons to take the PDF's wording rather than « Nom de la structure »:

1. **Every sibling form names its entity.** « Nom de l'entreprise », « Nom de
   la coopérative », « Nom de l'ONG », « Nom de l'administration ». The
   project form is the only one that says just « Nom », sandwiched between
   « Nature de la structure » and « Nom du Responsable » — so the respondent
   has to work out whose name is being asked for.
2. **« structure » is already taken, as a deliberate umbrella.**
   `PP_S1Q01` is « Nature de la structure » precisely because one of its four
   answers is « Structure sous-tutelle ». Using « structure » for the name as
   well puts two abstract questions in a row and tells the respondent nothing
   new.
3. **The respondent is reading the paper form next to the screen.** Matching
   the printed label is the cheapest way to make the two line up.

**Better still, if you want it:** the label can follow the answer just given
one line above, which is a pattern the app already uses (Section 0's intro
line, S0Q02's label). `PP_S1Q01` is answered on the same card, immediately
before:

| PP_S1Q01 answer | PP_S1Q02 label |
|---|---|
| Projet | Nom du projet |
| Programme | Nom du programme |
| Structure sous-tutelle | Nom de la structure |
| Autres, or not yet answered | Nom du projet / programme |

That removes the one weakness of the flat PDF wording — a « structure
sous-tutelle » respondent being asked for the name of a project. It is a
display label only: no cell key, no variable, no export change.

### C.2 The wizard against its own official PDF

Same questions, two wordings. The PDF column is what ONEFOP prints and
archives; the wizard column is what the respondent types into.

| | Wizard (AST) | Official PDF | |
|---|---|---|---|
| Section title | SECTION 1. IDENTIFICATION DE **LA STRUCTURE** | SECTION 1. IDENTIFICATION DU **PROJET / PROGRAMME** | generic |
| S1Q02 | **Nom** | Nom du projet / programme | under-specified |
| S1Q04 | Nom du **R**esponsable | Nom et prénom du responsable | stray capital; S0Q01 asks « Noms, prénoms » |
| S1Q05 | Milieu de **résidence** | Milieu d'**implantation** | a project is sited, not resident |
| S1Q12 | Ministère/ Organisme tutelle | Ministère de tutelle | missing « de »: « Ministère / organisme **de** tutelle » |
| S1Q13 | **Situation** du **P**rojet / **P**rogramme | **Statut** du projet / programme | mid-sentence capitals; EN is Title Case, unlike every other label |
| S1Q15 | Nombre d'employé permanent | — | singular; enterprise and cooperative say « Nombre d'employés permanents » |
| S1Q16 | Nombre de poste vacant | — | singular; same |

S1Q15/S1Q16 are shared with the CTD and the NGO, which also carry the
singular. The enterprise and the cooperative carry the plural. Worth settling
in one pass across the four rather than for the project alone.

### C.3 The card title still says « Identité légale »

`react-web/messages/fr.json` `modernJobs.section1.cards.identity.title`.

The commit of 2026-10-19 (`3700f521`) gave the project its own *description*
for this card — « Nature, nom, sigle, responsable et ministère ou organisme
de tutelle » — because the enterprise one named a « statut juridique » and an
« immatriculation » that the project form never asks for. The **title** was
not given the same treatment, so the card is still headed « Identité légale »
over content that contains no legal identity at all. A project is not a legal
person; the thing on that card is its identity, not its legal identity.

Proposed, by the same `_projectProgram` key mechanism already in place
(`cardDescriptionKey`): **« Identification du projet »** / *"Project details"*
— or simply « Identité », if you would rather keep one word across the forms.

### C.4 The rail

`SECTION_NAV_TITLES` (`src/lib/onefop-section-title.ts`) gives the project's
Sections 2, 3 and 4 short names, but not Section 1, which therefore reads
« Identification de la structure » from the AST title. If C.2's first row is
taken, this follows automatically; if not, the rail is the cheap place to say
« Identification du projet ».

---

## D. Loose ends found on the way (not Sections 0–1)

- **`projectProgram.s1q11` in the PDF i18n is an orphan.** It reads « Date de
  démarrage effectif : » in FR and the template never uses it — row S1Q11
  renders `common.s1.head_office` against `{{headOffice}}`, which is correct
  and matches the wizard. The dead key is confusing and reads like a
  contradiction; it should go. **No live defect** — the PDF prints « Siège
  social ».
- **The gateway copy is still the enterprise's.**
  `modernJobs.gateway.options.notApplicable` reads « Sans objet pour cet
  établissement » / « Cette rubrique ne concerne pas le statut de votre
  établissement », and `modernJobs.event.q.*` ask about « votre
  établissement ». Out of this audit's scope, but it is the same class of
  problem and it is respondent-facing.

---

## Proposed order of work

1. **A** — the tooltips. The only finding with a statistical consequence
   (`COOP_S1Q11`, `CTD_S1Q10`), and it affects five forms. Help text only.
2. **C.1 + C.3** — « Nom du projet / programme » and the card title. Two
   respondent-facing labels, both already answered by the PDF.
3. **C.2** — the remaining label tidy-up (capitals, « de tutelle », plurals),
   as one pass across the forms that share each label.
4. **B.1** — placeholders for the administration, NGO, cooperative and CTD.
5. **B.2 / B.3 / D** — canonical hints, the hard-coded tooltip, the orphan
   PDF key.

Steps 2 and 3 change labels in `onefop_ast.dart` and so need the schema
regenerated and the §21 record updated. None of them touches a cell key, a
variable, an option value, the dataset version or any export.
