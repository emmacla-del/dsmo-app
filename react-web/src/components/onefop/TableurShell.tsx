"use client";

import { Fragment } from "react";
import { CodedLabel } from "@/components/onefop/ui/QuestionCode";
import type { FormData, OnefopEntity } from "@/lib/onefop-schema";
import { bilingual, computeSubsectionLayout, isFieldVisible } from "@/lib/onefop-schema";
import type { ValidationIssue } from "@/lib/onefop-validation";
import { AnyTableRenderer } from "./AnyTableRenderer";
import { FieldControl } from "./FieldControl";

interface TableurShellProps {
  entity: OnefopEntity;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  /** Same contract as SectionRenderer's issues prop — inline errors shown
   * only for whatever this list contains; the caller decides when. */
  issues?: ValidationIssue[];
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--cam-space-2)",
  fontSize: "var(--cam-font-size-sm)",
  fontWeight: 600,
  width: "40%",
  verticalAlign: "top",
  borderBottom: "var(--cam-border-width) solid var(--cam-border)",
};

const tdStyle: React.CSSProperties = {
  padding: "var(--cam-space-2)",
  borderBottom: "var(--cam-border-width) solid var(--cam-border)",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: "var(--cam-font-size-sm)",
  color: "var(--cam-error)",
  fontWeight: 600,
  margin: "var(--cam-space-1) 0 0",
};

/**
 * Tableur presentation strategy (§5.2): the same schema, the same
 * FieldControl/TableRenderer, the same shared `data`/`onChange` as Simple
 * and Wizard — laid out as one dense row-per-field table instead of
 * spacious labeled blocks, matching the plan's "spreadsheet-style
 * presentation appropriate to dense official matrices". Table-type fields
 * still render their own full grid (already dense) spanning the row.
 */
export function TableurShell({ entity, data, onChange, issues = [] }: TableurShellProps) {
  const issueByFieldId = new Map(issues.map((issue) => [issue.fieldId, issue.message]));

  return (
    <div>
      {entity.sections.map((section) => {
        const { headingByFieldId, startsHeadingFieldIds } = computeSubsectionLayout(section);
        return (
          <div key={section.id} style={{ marginBottom: "var(--cam-space-6)" }}>
            <h2
              style={{
                fontSize: "var(--cam-font-size-lg)",
                fontWeight: 700,
                borderBottom: "3px solid var(--cam-green)",
                paddingBottom: "var(--cam-space-2)",
                marginBottom: "var(--cam-space-3)",
              }}
            >
              {bilingual(section.title)}
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {section.fields.map((field) => {
                  if (!isFieldVisible(field, data)) return null;
                  const isTable = field.type === "table" || field.type === "repeating_table";
                  const errorMessage = issueByFieldId.get(field.id);

                  return (
                    <Fragment key={field.id}>
                      {startsHeadingFieldIds.has(field.id) && (
                        <tr>
                          <th
                            colSpan={2}
                            style={{
                              textAlign: "left",
                              padding: "var(--cam-space-2)",
                              paddingTop: "var(--cam-space-4)",
                              fontSize: "var(--cam-font-size-sm)",
                              fontWeight: 700,
                              color: "var(--cam-green)",
                            }}
                          >
                            {headingByFieldId.get(field.id)}
                          </th>
                        </tr>
                      )}
                      <tr>
                        <th scope="row" style={thStyle}>
                          <CodedLabel code={field.paperCode} text={bilingual(field.label)} />
                          {field.required && <span aria-hidden="true"> *</span>}
                        </th>
                        <td style={tdStyle}>
                          {isTable ? (
                            <AnyTableRenderer field={field} data={data} onChange={onChange} />
                          ) : (
                            <>
                              <FieldControl
                                field={field}
                                value={data[field.id]}
                                onChange={onChange}
                                compact
                                hasError={!!errorMessage}
                              />
                              {errorMessage && (
                                <p role="alert" style={errorTextStyle}>
                                  {errorMessage}
                                </p>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
