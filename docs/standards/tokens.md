# CAM-LEAP design tokens

**Status:** normative. The values live in `react-web/src/app/tokens.css`. This file lists every custom property that file defines.
**Scope:** both registration surfaces and the admin console. The wizard keeps its 600px reading measure. Admin keeps its 1360px console. They read this list.

How those tokens are used on an administrative screen is `docs/standards/ui-grammar.md`.

The weight, line-height, letter-spacing, field-width, choice-size, and alpha purpose tokens are defined here so both surfaces can read one value. The registration wizard's classes in `react-web/src/app/globals.css` read them.

## Rules

1. **Rule.** `rgba()` inside `tokens.css` is prohibited except for `--cam-shadow-sm`. In the rest of the codebase, `rgba()` is discouraged but not yet eliminated. Known remaining uses (measured 2026-10-07):

   - `admin-console.css` — 38 uses
   - `globals.css` — 4 uses: three in `@keyframes onefopPulse`, one on `.sovereign-text-input.has-error:focus`

   These predate the alpha convention. A follow-up will convert them. A new `rgba()` outside `tokens.css` should be a `color-mix` purpose token or a new token.

   **Exception.** `--cam-shadow-sm` remains `rgba(20, 30, 20, 0.04)`. Its base colour is not a token, so it cannot be expressed as a color-mix of a defined solid colour. It is the only exception inside `tokens.css`; a second one is a signal that a shadow-base colour needs to be named.

2. **Off-ladder values.** A length, size, weight, radius, or line-height that is not on its ladder is a purpose token, named for the job, and has a row below. The ladders are:

   - Space: 4, 8, 12, 16, 24, 32, 48 (`--cam-space-1` through `--cam-space-7`).
   - Font size: 9, 11, 12, 13, 14, 15, 18, 24, 25, 32. There is no 10, 16, or 20 step.
   - Radius: 2, 4, 6, 10, pill.
   - Font weight: 400, 500, 600, 700.
   - Line height: 1.2, 1.25, 1.3, 1.4, 1.5.
   - Letter spacing: 0.01em, −0.01em, 0.02em, 0.03em.

   `--cam-field-radius` (8px), `--cam-section-radius` (12px), `--cam-step-title-size` (20px), `--cam-step-subtitle-size` (13.5px), and `--cam-table-lh` (1.35) are purpose values. They are not new ladder steps.

A `var(--cam-*)` names a row in this table. `--cam-surface-card`, `--cam-font-display`, `--cam-highlight-bg`, and `--cam-space-8` are not tokens.

## Catalogue

One row per token, in the order `tokens.css` defines them. A second value is the phone override in the same file. The `.vt-wizard` rule repeats the `--vt-*` values; it does not define a second set.

| Token | Value | Category | Sanctioned use |
|---|---|---|---|
| `--cam-green` | `#1e6b3a` | Brand | Brand green. Primary actions, links, and the success hue. |
| `--cam-green-dark` | `#144a28` | Brand | Dark brand green. Rail, pressed text, section kickers. |
| `--cam-gold` | `#e8a020` | Brand | Institutional gold. Current-step ring and the warning hue. |
| `--cam-gold-dark` | `#b87c14` | Brand | Dark gold text. Warning text. |
| `--cam-accent` | `var(--cam-green)` | Brand | Accent alias of brand green. |
| `--cam-flag-green` | `#0e5c2b` | Flag | Flag ribbon and wordmark stripe. |
| `--cam-flag-red` | `#b3202c` | Flag | Flag ribbon and wordmark stripe. |
| `--cam-flag-yellow` | `#f0b429` | Flag | Flag ribbon and wordmark stripe. |
| `--cam-bg` | `#fafaf7` | Surface | Page background. |
| `--cam-surface` | `#ffffff` | Surface | Cards, inputs, dialogs, table cells. |
| `--cam-surface-subtle` | `#fbfbf9` | Surface | Quiet fill on a surface: seal, table head. |
| `--cam-text` | `#0b1f14` | Text | Body ink and the page title. |
| `--cam-text-muted` | `#4a5a50` | Text | Secondary text. |
| `--cam-border` | `#d8ddd3` | Border | Default hairline. |
| `--cam-border-strong` | `#aab5a3` | Border | Stronger rule. Upcoming-step circle. |
| `--cam-shadow-sm` | `0 1px 2px rgba(20, 30, 20, 0.04)` | Shadow | Resting elevation. The one `rgba()` exception: `rgb(20, 30, 20)` is not a token. A second exception means that base needs a name. |
| `--cam-focus` | `#e8a020` | State | Page-wide gold focus colour. |
| `--cam-focus-ring` | `var(--cam-green)` | State | Focus ring on a custom radio or checkbox. |
| `--cam-focus-shadow` | `0 0 0 3px color-mix(in srgb, var(--cam-green) 15%, transparent)` | Alpha | Input focus ring. Same colour as `rgba(30, 107, 58, 0.15)`. |
| `--cam-focus-shadow-error` | `0 0 0 3px color-mix(in srgb, var(--cam-error) 15%, transparent)` | Alpha | Invalid-field focus ring. |
| `--cam-focus-shadow-gold` | `0 0 0 3px color-mix(in srgb, var(--cam-gold) 18%, transparent)` | Alpha | Current-step ring on the wizard rail. |
| `--cam-scrim` | `color-mix(in srgb, var(--cam-text) 45%, transparent)` | Alpha | Leave-dialog and admin-dialog backdrop. `--cam-text` is `#0b1f14`, so this is `rgba(11, 31, 20, 0.45)`. |
| `--cam-green-wash` | `color-mix(in srgb, var(--cam-green) 10%, transparent)` | Alpha | Selected or confirmed green fill. |
| `--cam-green-wash-hover` | `color-mix(in srgb, var(--cam-green) 5%, transparent)` | Alpha | Hover fill on a green-outlined control. |
| `--cam-green-wash-soft` | `color-mix(in srgb, var(--cam-green) 8%, transparent)` | Alpha | Establishment-ID chip. Same colour as `rgba(30, 107, 58, 0.08)`. |
| `--cam-error` | `#b3261e` | State | Error text and invalid borders. |
| `--cam-error-bg` | `#fbeceb` | State | Error notice fill. |
| `--cam-error-border` | `#f2b8b5` | State | Error notice border. |
| `--cam-success` | `#1e6b3a` | State | Success text. Same hue as brand green. |
| `--cam-success-bg` | `#eaf3ec` | State | Success notice fill. Current-and-complete step. |
| `--cam-success-border` | `#c3e0cb` | State | Success notice border. |
| `--cam-warning` | `var(--cam-gold-dark)` | State | Warning text, on the institutional gold hue. |
| `--cam-warning-bg` | `#fdf3dc` | State | Warning fill. |
| `--cam-warning-border` | `#f0d999` | State | Warning border. |
| `--cam-info` | `#1a6896` | State | Info text. |
| `--cam-info-bg` | `#ebf4f9` | State | Info fill. |
| `--cam-info-border` | `#b6d7ea` | State | Info border. |
| `--cam-ink` | `var(--cam-text)` | Alias | Admin name for ink. |
| `--cam-line` | `var(--cam-border)` | Alias | Admin name for the hairline. |
| `--cam-muted` | `var(--cam-text-muted)` | Alias | Admin name for muted text. |
| `--cam-red` | `var(--cam-error)` | Alias | Admin name for the error colour. |
| `--cam-blue` | `var(--cam-info)` | Alias | Admin name for the info colour. |
| `--cam-accent-soft` | `var(--cam-success-bg)` | Alias | Soft brand fill. |
| `--cam-space-1` | `4px` | Spacing | Smallest space step. |
| `--cam-space-2` | `8px` | Spacing | Space step. |
| `--cam-space-3` | `12px` | Spacing | Space step. |
| `--cam-space-4` | `16px` | Spacing | Space step. Default form gap. |
| `--cam-space-5` | `24px` | Spacing | Space step. |
| `--cam-space-6` | `32px` | Spacing | Space step. Admin page padding. |
| `--cam-space-7` | `48px` | Spacing | Largest space step. |
| `--cam-font-sans` | `var(--font-inter), "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif` | Font family | UI text. |
| `--cam-font-serif` | `var(--font-zilla-slab), "Zilla Slab", Georgia, "Times New Roman", serif` | Font family | Serif display, where a screen already uses it. |
| `--cam-font-mono` | `ui-monospace, "Cascadia Mono", Consolas, "SF Mono", Menlo, "Roboto Mono", "Liberation Mono", monospace` | Font family | Codes and identifiers only: NIU, CNPS, row codes. Table numbers use the UI font with tabular figures. |
| `--cam-font-size-4xs` | `0.5625rem` (9px) | Font size | The star in the flag circle. The admin rail's brand sub-label left it for 12px on 2026-10-10. Nothing new uses it. |
| `--cam-font-size-3xs` | `0.6875rem` (11px) | Font size | Smallest body step above the sidebar micro-copy. |
| `--cam-font-size-2xs` | `0.75rem` (12px) | Font size | Compact UI text. The most-used raw size. |
| `--cam-font-size-xs` | `0.8125rem` (13px) | Font size | Hints, kickers, compact labels. |
| `--cam-font-size-sm` | `0.875rem` (14px) | Font size | Field labels and secondary body. |
| `--cam-font-size-base` | `0.9375rem` (15px) | Font size | Body copy. |
| `--cam-font-size-input-ios` | `16px` | Font size | Wizard controls on a phone. Stops iOS zooming a focused field. Not a ladder step. |
| `--cam-font-size-lg` | `1.125rem` (18px) | Font size | Dialog titles and large body. |
| `--cam-font-size-xl` | `1.5rem` (24px) | Font size | Large heading. |
| `--cam-font-size-2xl` | `1.5625rem` (25px) | Font size | Auth brand name. Panel KPIs. |
| `--cam-font-size-3xl` | `2rem` (32px) | Font size | Dashboard KPI value. |
| `--cam-line-height-base` | `1.5` | Line height | Body copy. |
| `--cam-line-height-tight` | `1.2` | Line height | Headings. |
| `--cam-line-height-title` | `1.25` | Line height | Section titles. |
| `--cam-line-height-label` | `1.3` | Line height | Field labels. The wizard label rule and the side-by-side alignment calc both read this token. |
| `--cam-line-height-ui` | `1.4` | Line height | Buttons, chips, hints, and compact UI text. |
| `--cam-line-height-copy` | `1.45` | Line height | Multi-line wizard copy: option labels, the certify line, section notes, dialog body. |
| `--cam-font-weight-regular` | `400` | Font weight | Body, table leaves, and typed values. |
| `--cam-font-weight-medium` | `500` | Font weight | Supporting emphasis: links, review values. |
| `--cam-font-weight-semibold` | `600` | Font weight | Section labels and group headers. |
| `--cam-font-weight-bold` | `700` | Font weight | Titles, required marks, and totals. |
| `--cam-tracking-caption` | `0.01em` | Letter spacing | Captions and the seal note. |
| `--cam-tracking-tight` | `-0.01em` | Letter spacing | Brand name. |
| `--cam-tracking-label` | `0.02em` | Letter spacing | Badges, table heads, and question codes. |
| `--cam-tracking-kicker` | `0.03em` | Letter spacing | Uppercase section kickers. |
| `--cam-microcopy-size` | `var(--cam-font-size-2xs)` | Microcopy | Questionnaire hints, "select all", option captions: 12px (owner, 2026-10-10). Questions are 15px bold, answers 14px. |
| `--cam-microcopy-color` | `var(--cam-text-muted)` | Microcopy | Microcopy colour. |
| `--cam-microcopy-margin-top` | `4px` | Microcopy | Gap above helper text. Matches `--cam-space-1` and stays its own token. |
| `--cam-question-size` | `var(--cam-font-size-base)` (15px) | Question | Question label on every respondent form: registration, Modern Jobs, VT (owner, 2026-10-10). |
| `--cam-question-weight` | `var(--cam-font-weight-bold)` | Question | Bold, so the question reads apart from its answer. |
| `--cam-question-line-height` | `var(--cam-line-height-label)` (1.3) | Question | Question label line-height. The gap under it is `--cam-field-stack-gap`. |
| `--cam-answer-size` | `var(--cam-font-size-sm)` (14px) | Answer | Typed answers and radio/checkbox option text on respondent forms. Phones raise typed controls to `--cam-font-size-input-ios`. |
| `--cam-radius-sm` | `2px` | Radius | Smallest radius. |
| `--cam-radius-md` | `4px` | Radius | Default small radius. |
| `--cam-radius-control` | `6px` | Radius | Controls on the radius ladder. |
| `--cam-radius-lg` | `10px` | Radius | Largest ladder radius before the pill. |
| `--cam-radius-full` | `9999px` | Radius | Pills and circles. |
| `--cam-row-height` | `40px` | Density | List and table row. |
| `--cam-form-field-height` | `40px` | Density | Admin and shared control height. Source of `--cam-field-height`. |
| `--cam-button-height` | `44px` | Density | Button height. |
| `--cam-form-gap` | `var(--cam-space-4)` | Density | Gap between form fields. |
| `--cam-container-compact` | `380px` | Container | Narrow dialogs and compact auth. |
| `--cam-side-rail-width` | `280px` | Side rail | Every side navigation: the respondent wizards' `.cam-wizard-rail` and the staff console's `.cam-admin-rail` (shell grid and phone drawer). |
| `--cam-step-marker-size` | `30px` | Wizard rail | Step circle on the wide and phone rails. Connectors and the outline indent are computed from it. |
| `--cam-wizard-rail-bar-height` | `6px` | Wizard rail | Progress bar height on the rail and in the VT section outline. |
| `--cam-container-form` | `640px` | Container | Auth card width. |
| `--cam-border-width` | `1px` | Border | Default border thickness. |
| `--cam-table-grid` | `#171a18` | Table | Official review-table rule. |
| `--cam-card-frame-width` | `2px` | Wizard frame | Wizard card border thickness. |
| `--cam-card-shadow` | `0 6px 20px -4px color-mix(in srgb, var(--cam-green) 22%, transparent), 0 2px 6px color-mix(in srgb, var(--cam-green) 10%, transparent)` | Shadow | Wizard card at rest. Same colours as `rgba(30, 107, 58, 0.22)` and `rgba(30, 107, 58, 0.1)`. |
| `--cam-card-shadow-focus` | `0 0 0 4px color-mix(in srgb, var(--cam-green) 14%, transparent), 0 6px 20px -4px color-mix(in srgb, var(--cam-green) 26%, transparent)` | Shadow | Wizard card when focused. Same colours as `rgba(30, 107, 58, 0.14)` and `rgba(30, 107, 58, 0.26)`. |
| `--cam-card-pad-x` | `26px`; `16px` at ≤640px | Wizard frame | Horizontal padding of the wizard card chrome. |
| `--cam-card-head-pad-top` | `20px`; `14px` at ≤640px | Wizard frame | Card header padding, top. |
| `--cam-card-head-pad-bottom` | `14px`; `10px` at ≤640px | Wizard frame | Card header padding, bottom. |
| `--cam-card-body-pad-y` | `20px`; `14px` at ≤640px | Wizard frame | Card body padding, block axis. |
| `--cam-card-foot-pad-y` | `14px`; `12px` at ≤640px | Wizard frame | Card footer padding, block axis. |
| `--cam-card-shell-pad-y` | `var(--cam-space-5)`; `var(--cam-space-3)` at ≤640px | Wizard frame | Page padding around the wizard shell, block axis. |
| `--cam-card-shell-pad-x` | `var(--cam-space-4)`; `var(--cam-space-2)` at ≤640px | Wizard frame | Page padding around the wizard shell, inline axis. |
| `--cam-container-wizard` | `600px` | Container | Wizard reading measure. Caps width only. |
| `--cam-field-row-gap` | `16px` | Wizard field | Gap between field rows. Matches `--cam-space-4`. |
| `--cam-field-stack-gap` | `6px` | Wizard field | Gap between a stacked label and its input. Also the shared auth label gap and the password-meter offset. Purpose value, off the space ladder. |
| `--cam-field-height` | `var(--cam-form-field-height)` | Wizard field | Wizard control height. Aliases the density token, so one change moves both surfaces. |
| `--cam-field-radius` | `8px` | Radius | Wizard input radius. Purpose value, off the radius ladder, so the focus ring does not hug the border. |
| `--cam-field-border-width` | `1.5px` | Wizard field | Wizard input border. Purpose value. |
| `--cam-choice-size` | `18px` | Wizard field | Radio and checkbox control size. The login checkbox moves from 15px to 18px. The certify checkbox was already 18px. |
| `--cam-auth-card-pad` | `26px` | Spacing | Auth card body, top and inline. Not `--cam-card-pad-x`: that one shrinks on a phone, and this card does not. |
| `--cam-auth-card-pad-bottom` | `22px` | Spacing | Auth card body, bottom. |
| `--cam-auth-tab-gap` | `22px` | Spacing | Gap and block margin of the login tabs. |
| `--cam-auth-inset-10` | `10px` | Spacing | Inset on auth controls, notices, the tab rule, the status pill, and the in-flow button. |
| `--cam-auth-eye-pad` | `40px` | Spacing | Inline end padding so the password eye does not cover the value. |
| `--cam-auth-check-gap` | `7px` | Spacing | Gap between the login checkbox and its label. |
| `--cam-auth-footer-pad-y` | `14px` | Spacing | Auth card footer, block axis. |
| `--cam-auth-block-gap` | `20px` | Spacing | Space under the auth sub-row, the help line, and the receipt hero. |
| `--cam-frame-scroll-pad-top` | `20px` | Spacing | Padding at the top of the wizard frame's content (`.flow-frame-content`). |
| `--cam-frame-scroll-pad-x` | `22px` | Spacing | Inline padding of the wizard frame's content and dock. |
| `--cam-inline-button-pad-x` | `22px` | Spacing | Inline padding of `.btn-primary--inline`. |
| `--cam-honour-pad-x` | `14px` | Spacing | Inline padding of the review honour notice. |
| `--cam-edit-pad-y` | `3px` | Spacing | Block padding of the review edit button. |
| `--cam-space-hairline` | `2px` | Spacing | Optical nudge below the 4px step: certify checkbox, collapsed title stack, establishment-ID chip. |
| `--cam-sr-offset` | `-1px` | Spacing | Clip offset for visually-hidden text. Not a space step. |
| `--cam-field-width-full` | `100%` | Wizard field | Default FormRow width. |
| `--cam-field-width-medium` | `280px` | Wizard field | FormRow `medium`: NIU, CNPS, registration numbers. |
| `--cam-field-width-short` | `220px` | Wizard field | FormRow `short`: phone, year, counts. |
| `--cam-field-hint-size` | `var(--cam-font-size-xs)` | Wizard field | Helper text under an input. |
| `--cam-placeholder` | `#7d8981` | Text | Placeholder. Lighter than the label, over 4.5:1 on `--cam-surface`. |
| `--cam-rail-upcoming` | `#6b776f` | Text | Name of a wizard step the respondent has not reached. |
| `--cam-section-radius` | `12px` | Radius | Wizard section frame. Purpose value, off the radius ladder. |
| `--cam-section-pad` | `20px`; `16px` at ≤640px | Wizard frame | Padding inside the wizard section frame. |
| `--cam-section-gap` | `20px` | Wizard frame | Gap inside the wizard section. Purpose value, off the space ladder. |
| `--cam-step-title-size` | `1.25rem` (20px) | Font size | Wizard step title. Purpose size, off the font-size ladder. |
| `--cam-step-subtitle-size` | `0.84375rem` (13.5px) | Font size | Wizard step description. Purpose size, off the font-size ladder. |
| `--cam-step-header-gap` | `var(--cam-space-1)` | Wizard frame | Gap between the step title and its description. |
| `--cam-step-header-space-after` | `var(--cam-space-5)` | Wizard frame | Space after the step header, before the fields. |
| `--cam-card-body-pad-end` | `calc(var(--cam-card-pad-x) + var(--cam-space-2))` | Wizard frame | Extra inline-end padding so the input column clears the scrollbar gutter. |
| `--cam-table-frame` | `#475569` | Table | Outer frame, header rules, and the label-column rule. |
| `--cam-table-line` | `#64748b` | Table | Cell grid lines. |
| `--cam-table-strong` | `#334155` | Table | Total-row rule and sub-header text. |
| `--cam-table-group-line` | `#1e293b` | Table | Separator between column blocks. |
| `--cam-table-head-bg` | `#ffffff` | Table | Statistical table header fill. |
| `--cam-table-text` | `#0f172a` | Table | Statistical table text. |
| `--cam-table-muted` | `#94a3b8` | Table | Empty-cell dash and placeholder. |
| `--cam-table-fs` | `0.875rem` (14px); `0.8125rem` (13px) at ≤639px | Table | One size for every statistical table cell. |
| `--cam-table-lh` | `1.35` | Table | Statistical table line-height. Purpose value, off the line-height ladder. |
| `--cam-table-w-group` | `600` | Table | Column-group header. Same weight as `--cam-font-weight-semibold`. |
| `--cam-table-w-leaf` | `400` | Table | Leaf column header. Same weight as `--cam-font-weight-regular`. |
| `--cam-table-w-label` | `400` | Table | Row label. Same weight as `--cam-font-weight-regular`. |
| `--cam-table-w-value` | `400` | Table | Typed number. Same weight as `--cam-font-weight-regular`. |
| `--cam-table-w-computed` | `600` | Table | Calculated total. Same weight as `--cam-font-weight-semibold`. |
| `--cam-table-w-total` | `700` | Table | Grand-total row. Same weight as `--cam-font-weight-bold`. |
| `--cam-table-hover` | `#f8fafc` | Table | Row hover fill. |
| `--cam-table-focus` | `#1a5c3a` | Table | Focus colour inside a statistical table. |
| `--cam-table-readonly-bg` | `var(--cam-success-bg)` | Table | Calculated cells and total rows. |
| `--cam-table-readonly-text` | `var(--cam-success)` | Table | Text on a calculated cell. |
| `--cam-z-nav` | `100` | Z-index | Navigation. |
| `--cam-z-dropdown` | `200` | Z-index | Dropdowns. |
| `--cam-z-dialog` | `300` | Z-index | Dialogs. |
| `--cam-z-toast` | `400` | Z-index | Toasts. |
| `--vt-yellow` | `#fcd116` | VT | VT status yellow. |
| `--vt-red` | `#ce1126` | VT | VT status red. |
| `--vt-bg` | `var(--cam-bg)` | VT | VT page background. |
| `--vt-card-border` | `var(--cam-border)` | VT | VT card border. |
| `--vt-ink` | `var(--cam-text)` | VT | VT text. |
| `--vt-ink-soft` | `var(--cam-text-muted)` | VT | VT secondary text. |
| `--vt-ink-faint` | `#7a827f` | VT | VT faint text. |
| `--vt-accent` | `var(--cam-green)` | VT | VT accent. |
| `--vt-accent-soft` | `var(--cam-success-bg)` | VT | VT soft accent fill. |
| `--vt-card-radius` | `var(--cam-radius-md)` | VT | VT card radius. |
| `--vt-sidebar-width` | `var(--cam-side-rail-width)` | VT | Alias, kept for `ModernJobsNavigation`'s footer grid. |
| `--vt-content-max` | `760px` | VT | Respondent reading width: questionnaire form sections, their footer, the declarations list (600px answers + padding). |
| `--vt-content-max-wide` | `1100px` | VT | VT sections holding a statistical table (sections 4, 5, 6, 8). |
| `--vt-font` | `var(--cam-font-sans)` | VT | VT font. |
| `--cam-border-subtle` | `#eef0eb` | Respondent record | Faint divider recorded from the live fallback. |
| `--cam-surface-2` | `#f1f5f9` | Respondent record | Second surface recorded from the live fallback. |
| `--cam-bg-subtle` | `#f8fafc` | Respondent record | Subtle page fill recorded from the live fallback. |
| `--cam-primary` | `#1d4ed8` | Respondent record | Locale-switcher blue recorded from the live fallback. |
| `--cam-amber-bg` | `#fff8e6` | Respondent record | Amber fill recorded from the live fallback. |
| `--cam-amber-border` | `#fcd34d` | Respondent record | Amber border recorded from the live fallback. |
| `--cam-amber-badge` | `#fef3c7` | Respondent record | Amber badge fill recorded from the live fallback. |
| `--cam-amber-text` | `#92400e` | Respondent record | Amber text recorded from the live fallback. |

Class parameters are not palette entries and are not listed. `--cam-status-dot` is set next to the class that reads it. (`--cam-admin-rail-width` was one too, until the admin rail took `--cam-side-rail-width` on 2026-10-10.)
