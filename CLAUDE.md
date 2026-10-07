# CAM-LEAP Engineering Constitution

## 1. PROJECT IDENTITY

CAM-LEAP is the Cameroon Labour Market Information System and
Employment Observatory Platform developed for ONEFOP/MINEFOP.

The current platform digitizes two principal reporting streams:

1. ONEFOP statistical questionnaires
2. DSMO manpower declarations

CAM-LEAP is a statistical information system, not merely a generic
CRUD application.

Every engineering decision must therefore preserve:

- statistical integrity
- data traceability
- administrative accountability
- geographic data isolation
- questionnaire semantics
- reliable exports
- official reporting workflows

---

# 2. REPOSITORY ARCHITECTURE

This repository contains three principal application layers.

## Backend

NestJS + TypeScript + Prisma + PostgreSQL.

Primary location:

`src/`

Important domains:

- auth
- questionnaires
- onefop
- dsmo
- analytics
- data-management
- pdf
- campaign
- email
- onefop-schema-validation

Database:

`prisma/schema.prisma`

---

## Modern Web Frontend

Next.js 16 + React 19 + TypeScript.

Location:

`react-web/`

This is the primary modern web frontend and the migration target
from the legacy Flutter Web interface.

---

## Flutter Client

Flutter/Dart application.

Location:

`lib/`

The Flutter application remains important because it contains
the canonical ONEFOP AST/schema compiler.

---

# 3. CANONICAL QUESTIONNAIRE SOURCE

The canonical questionnaire/schema source is:

`lib/core/focus/compiler/onefop_ast.dart`

The generated schema artifacts are:

`assets/schemas/onefop.schema.json`

and

`react-web/public/schemas/onefop.schema.json`

NEVER manually edit the generated JSON schema artifacts.

If questionnaire structure or statistical semantics must change,
inspect and modify the canonical AST source first.

After changing the canonical source, regenerate the schema using
the established project tooling.

---

# 4. LMIS VS OBSERVATORY

CAM-LEAP must preserve the distinction between:

## LMIS

The Labour Market Information System is primarily responsible for:

- data collection
- validation
- storage
- administrative processing
- data preparation
- export

## Observatory

The Observatory operates above the LMIS.

It is responsible for:

- statistical analysis
- indicators
- trends
- forecasting
- labour-market intelligence
- public statistical dissemination

Do not collapse the LMIS and Observatory into one conceptual layer.

---

# 5. STATISTICAL INTEGRITY

Statistical variables are more important than UI convenience.

A developer must NEVER:

- remove a statistical variable merely because its UI is difficult
- change the meaning of a variable without domain review
- alter category definitions casually
- change table dimensions without understanding downstream effects
- replace normalized statistical data with arbitrary JSON storage
- silently change calculation formulas
- change export semantics merely to simplify frontend implementation

When a UI problem conflicts with the questionnaire model:

PREFER improving the UI.

Do not alter statistical semantics unless explicitly authorized.

---

# 6. DATABASE INTEGRITY

ONEFOP statistical tables must remain relationally structured.

Do not introduce generic JSON storage as a replacement for
normalized statistical tables simply because it is easier to implement.

Before modifying Prisma models, inspect:

- questionnaire submission logic
- exports
- PDF generation
- analytics
- existing migrations
- administrative review
- existing tests

Database migrations require explicit architectural review.

---

# 7. COHERENCE RULES

Arithmetic coherence checks are currently advisory.

`onefop-coherence.ts`

and related backend coherence checks must NOT become
submission-blocking merely because an AI agent believes
the data should be mathematically perfect.

Real establishments may have legitimate statistical exceptions.

Coherence warnings should remain distinguishable from
structural validation errors.

---

# 8. UX PRINCIPLES

CAM-LEAP should feel like a modern government statistical
declaration portal.

Priorities:

1. clarity
2. simplicity
3. low cognitive load
4. accessibility
5. responsiveness
6. statistical usability

Avoid:

- unnecessary cards
- decorative containers
- excessive borders
- unnecessary grey field fills
- excessive visual decoration
- boxed radio/checkbox options
- nested scrollbars
- unnecessarily long instructions
- duplicated headings
- technical codes exposed to respondents

---

# 9. FORM CONTROL RULES

Use:

- radio buttons for exactly one choice
- checkboxes for multiple choices
- entire option labels should be clickable

Do not visually enclose radio/checkbox options in unnecessary
cards or decorative containers.

"Not answered" must be distinguishable from:

- Yes
- No

Do not silently interpret an unanswered value as "No".

---

# 10. PROGRESSIVE DISCLOSURE

Respondents should not be confronted with irrelevant
statistical tables.

Gateway questions and the EventFactInterview mechanism
are intentional parts of the questionnaire UX.

Do not remove gateway logic without understanding its
effect on table applicability and zero-filling.

---

# 11. WIZARD NAVIGATION

The declaration wizard should maintain:

- clear section hierarchy
- visible progress
- one primary action
- predictable previous/next navigation
- appropriate responsive behaviour

There should normally be one primary green action per wizard screen.

---

# 12. DESIGN TOKENS

In React Web, visual values should use the established
CAM-LEAP design-token system.

Primary location:

`react-web/src/app/tokens.css`

How to use those tokens on an administrative screen - the class
vocabulary, the colour, typography and spacing rules, and the
reference page - is specified in:

`docs/standards/admin-ui-grammar.md`

Do not introduce arbitrary colors, spacing systems, typography,
or competing design systems without architectural review.

---

# 13. RESPONSIVE DESIGN

CAM-LEAP must work across:

- desktop
- laptop
- tablet
- mobile

Wide statistical tables may use horizontal scrolling.

Do not create nested scrolling structures unnecessarily.

The sidebar must not create competing internal scroll systems.

---

# 14. AUTHORIZATION

Administrative geographic boundaries are security boundaries.

The following hierarchy is fundamental:

DIVISIONAL
â†’ Department

REGIONAL
â†’ Region

CENTRAL
â†’ National

SUPER ADMIN
â†’ Platform-wide

Never assume that frontend hiding of information is sufficient
for authorization.

Authorization must be enforced server-side.

---

# 15. SECURITY

Current JWT storage in browser storage is recognized as
a security concern.

Do not spontaneously redesign authentication.

Any authentication architecture change must first be reviewed
by the CTO/architecture and security agents.

Potential future direction:

secure httpOnly SameSite cookies with appropriate CSRF protection.

---

# 16. TESTING

Production functionality must be tested.

The React Web application currently has a major testing gap.

Priority areas include:

- onefop-validation.ts
- onefop-coherence.ts
- gateway logic
- AdaptiveStatisticalTable
- draft persistence
- declaration submission
- authentication
- administrative authorization

Do not consider a feature complete merely because it compiles.

---

# 17. GENERATED ARTIFACTS

Before editing any generated artifact, identify its source.

Never manually modify generated files when a canonical source
exists elsewhere.

---

# 18. AI AGENT BEHAVIOUR

AI agents must:

1. inspect before modifying
2. understand dependencies before changing shared code
3. prefer minimal changes
4. avoid unrelated refactoring
5. preserve existing behaviour unless change is intentional
6. explain risky changes
7. run appropriate tests
8. report failures honestly
9. never fabricate successful test results
10. stop and request architectural review when a change crosses
   specialist boundaries
11. run `npm run check:ui-grammar` in `react-web/` after any change
   under `app/admin/**` or `components/admin/**`, and never raise a
   baseline in `scripts/ui-grammar-baseline.json` to make a change
   pass

---

# 19. SPECIALIST DELEGATION

Use the following specialist boundaries.

## ONEFOP Domain Agent

Questionnaire semantics, AST, statistical variables,
coherence, SPSS, statistical exports.

## UX Agent

User experience, information architecture, interaction design,
accessibility, form usability.

## Frontend Agent

Next.js/React implementation.

## Backend Agent

NestJS/API/business logic.

## QA Agent

Testing and regression detection.

## Security Agent

Authentication, authorization, geographic isolation,
security auditing.

## CTO

Architecture, cross-domain decisions, delegation,
integration and final review.

---

# 20. CHANGE DISCIPLINE

Do not make large unrelated changes in a single task.

For every meaningful change:

1. identify affected modules
2. identify risks
3. define the smallest viable change
4. implement
5. test
6. review
7. report

Prefer small, reversible changes.

---

# 21. HUMAN APPROVAL REQUIRED

The following require explicit human review before implementation
or merging:

- database schema changes
- authentication architecture changes
- RBAC changes
- changes to statistical definitions
- changes to questionnaire structure
- changes to canonical AST semantics
- changes affecting official exports
- changes affecting official PDF output
- major infrastructure changes
- deletion of production functionality

---

# 22. DEFAULT OPERATING PRINCIPLE

When uncertain:

DO NOT GUESS.

Inspect the repository.

If the question is statistical, consult the ONEFOP domain rules.

If the question is architectural, consult the CTO.

If the question is UX-related, audit the interface before coding.

If the change affects multiple domains, escalate to the CTO.

CAM-LEAP correctness is more important than coding speed.