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
