import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // ── Table typography guard ──────────────────────────────────────────
  // Data tables must be built from components/onefop/table/DataTable.tsx so
  // every header ("Homme", "Femme", …), label and value gets its font from
  // one place. In the table renderers: no raw <table>/<th>/<td>/<input>/
  // <select>, and no Tailwind font-size / font-weight / font-family or
  // text-alignment classes. (DataTable's `style` type already makes inline
  // fontSize/fontWeight/textAlign a compile error.) New table renderers should be added to `files`.
  {
    files: [
      "src/components/onefop/TableRenderer.tsx",
      "src/components/onefop/VtTableRenderer.tsx",
      "src/components/onefop/ActivitiesTableRenderer.tsx",
      "src/components/onefop/tables/StatisticalGridRenderer.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name=/^(table|th|td|input|select|textarea)$/]",
          message:
            "Use the DataTable pieces (DataTable, CornerHeader, GroupHeader, LeafHeader, RowHeader, Cell, NumberInput, TextInput, SelectInput, CellValue) from components/onefop/table/DataTable.tsx so table typography stays consistent.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] :matches(Literal[value=/(^|\\s)(text-(left|right|center|start|end|justify|xs|sm|base|lg|xl|2xl|\\[\\d)|font-(thin|light|normal|medium|semibold|bold|extrabold|black|mono|sans|serif|\\[))/], TemplateElement[value.raw=/(^|\\s)(text-(left|right|center|start|end|justify|xs|sm|base|lg|xl|2xl|\\[\\d)|font-(thin|light|normal|medium|semibold|bold|extrabold|black|mono|sans|serif|\\[))/])",
          message:
            "Table typography and alignment come from DataTable + the --cam-table-* tokens (tokens.css). Don't set font size/weight/family or text-align classes in a table renderer.",
        },
      ],
    },
  },
  // ── Administrative data-integrity guard + UI grammar (AST-shaped) ───
  // Administrative code must never import or declare fabricated mock datasets
  // or fallbacks.
  //
  // The UI-grammar selectors below enforce the AST-shaped rules of
  // docs/standards/admin-ui-grammar.md. They share one `no-restricted-syntax`
  // entry with the integrity guard on purpose: in flat config, a second config
  // object setting the same rule for the same files REPLACES this array rather
  // than extending it, which would silently drop the integrity guard. Add new
  // selectors here, never in a new block for these globs.
  //
  // The text-shaped and cross-file rules (hex literals, phantom tokens, bare
  // tables, off-scale spacing) live in scripts/check-admin-ui-grammar.mjs,
  // which ratchets them against scripts/ui-grammar-baseline.json.
  {
    files: [
      "src/app/admin/**/*.{ts,tsx}",
      "src/components/admin/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Identifier[name=/^(FIGMA_|CANONICAL_FALLBACK|DEFAULT_SAMPLE_|DEFAULT_AGENTS|DEFAULT_ACTIVITIES|SABC_DEFAULT_|DEFAULT_GIC|INITIAL_RECENT_AUDIT|CANONICAL_SECTIONS)/]",
          message:
            "Fabricated administrative mock datasets and fallbacks are strictly forbidden in production administrative code.",
        },
        // G13 — a page sets no font size. Matches any literal `fontSize`,
        // number or unit string, and allows `var(--cam-font-size-*)`.
        {
          selector:
            "Property[key.name='fontSize'][value.type='Literal'][value.value=/^(?!var\\().+$/]",
          message:
            "G13: font size comes from the class, or from a --cam-font-size-* token. Don't put a literal fontSize in a style object (tokens.css has the ladder: 4xs 9, 3xs 11, 2xs 12, xs 13, sm 14, base 15, lg 18, xl 24, 2xl 25, 3xl 32).",
        },
        // Same rule, numeric form (`fontSize: 13`). It needs its own selector
        // because esquery's regex attribute matcher only tests string values,
        // so the entry above silently skipped every numeric literal.
        {
          selector:
            "Property[key.name='fontSize'][value.type='Literal'][value.value=type(number)]",
          message:
            "G13: font size comes from the class, or from a --cam-font-size-* token. Don't put a literal fontSize in a style object (tokens.css has the ladder: 4xs 9, 3xs 11, 2xs 12, xs 13, sm 14, base 15, lg 18, xl 24, 2xl 25, 3xl 32).",
        },
        // G12 — numbers and dates come from lib/admin-data-state.ts, so one
        // locale decision applies everywhere. Clears at Step 4.
        {
          selector:
            "MemberExpression[property.name=/^toLocale(String|DateString|TimeString)$/]",
          message:
            "G12: use count / percent / stamp / shortStamp / elapsedSince from lib/admin-data-state.ts instead of toLocale*, so dates and numbers format the same on every admin screen.",
        },
        // G7 — dialogs are AdminDialog, which is a native <dialog>: focus
        // trap, Escape, inert background and focus return come for free.
        // Clears at Step 1 (dossiers, dossiers/[id]).
        {
          selector: "Property[key.name='position'][value.value='fixed']",
          message:
            "G7: use AdminDialog instead of a position:fixed overlay — it is a native <dialog>, so focus trap, Escape, inert background and focus return are handled.",
        },
        // G1/G13/G14 — the Tailwind palette and scale are a second design
        // system. Same shape as the DataTable typography guard above.
        // Clears at Step 3 (diffusion, journal-audit, equipe, parametres).
        {
          selector:
            "JSXAttribute[name.name='className'] :matches(Literal[value=/(^|\\s)(bg|text|border|ring|divide|from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}(\\s|$)/], TemplateElement[value.raw=/(^|\\s)(bg|text|border|ring|divide|from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}(\\s|$)/])",
          message:
            "G1: colour comes from a cam-* class or a --cam-* token, never a Tailwind palette class. See docs/standards/admin-ui-grammar.md.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
