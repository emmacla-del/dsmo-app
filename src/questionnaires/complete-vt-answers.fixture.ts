// Test fixture shared by the questionnaires specs.
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * A complete final training-centre submission, read from the generated
 * schema so it follows the questionnaire: every required question answered
 * (parents take their first option, "Oui", so follow-ups are answered too)
 * and every table carrying its status and, when reported, its cells.
 */
export function completeVtAnswers(): Record<string, unknown> {
  const schema = JSON.parse(readFileSync(join(process.cwd(), 'assets', 'schemas', 'onefop.schema.json'), 'utf8'));
  const out: Record<string, unknown> = {};
  for (const section of schema.entities.vocationalTraining.sections) {
    for (const f of section.fields) {
      if (!f.required || f.table) continue;
      const first: string | undefined = f.options?.[0]?.value;
      if (f.id === 'VT1_14') out[f.id] = '2010';
      else if (f.type === 'number') out[f.id] = '0';
      else if (f.type === 'checkbox') out[f.id] = first ? [first] : ['Réponse'];
      else if (f.type === 'tel') out[f.id] = '677000000';
      else if (f.type === 'email') out[f.id] = 'centre@test.cm';
      else out[f.id] = first ?? 'Réponse';
    }
  }
  // Tables, as the web form submits them after a preliminary quiz answered
  // "Non" throughout: quiz-governed tables NONE (fixed rows zeros, row-by-row
  // tables no rows), 4.6 NONE (2.1.14's first option is FI only when ticked —
  // here it is, so REPORTED), every other table REPORTED and filled.
  const quizTables = new Set(['VT4_3', 'VT4_4', 'VT4_9', 'VT4_11', 'VT4_10', 'VT6_13', 'VT8_6']);
  for (const section of schema.entities.vocationalTraining.sections) {
    for (const f of section.fields) {
      const vt = f.table?.vt;
      if (!vt || !f.table.matrix) continue;
      const rowByRow = vt.progressiveRows || vt.isRoster;
      if (quizTables.has(f.id)) {
        out[`${f.id}_RESPONSE_STATUS`] = 'NONE';
        if (!rowByRow) for (const rowIds of f.table.matrix) for (const id of rowIds) out[id] = 0;
        continue;
      }
      out[`${f.id}_RESPONSE_STATUS`] = 'REPORTED';
      for (const rowIds of rowByRow ? f.table.matrix.slice(0, 1) : f.table.matrix) {
        rowIds.forEach((id: string, c: number) => {
          const kind = vt.cells[c].kind;
          if (kind === 'number') out[id] = '0';
          else if (kind === 'text') out[id] = 'Texte';
          else if (kind === 'boolean') out[id] = false;
          else if (kind === 'radioCode') out[id] = vt.cells[c].options?.[0]?.value ?? '1';
        });
      }
    }
  }
  return out;
}
