/**
 * Question-code helpers: every question and table title shows its official
 * paper code (S1Q01, S22Q05, …) as a small badge in front of the text.
 *
 * Some schema labels already embed the code as text ("S22Q05 - Combien…");
 * splitQuestionCode() strips that prefix so the code is shown once, as the
 * badge, never twice.
 */
const SEPARATOR = /^[\s ]*[-–—:.]?[\s ]*/;
const EMBEDDED_CODE = /^(S\d+[A-Z0-9._]*)[\s ]*[-–—:][\s ]*/i;

export interface SplitQuestionCode {
  code: string | null;
  text: string;
}

export function splitQuestionCode(code: string | null | undefined, text: string): SplitQuestionCode {
  const clean = (text ?? "").trim();
  const c = code?.trim() || null;
  if (c && clean.toUpperCase().startsWith(c.toUpperCase())) {
    return { code: c, text: clean.slice(c.length).replace(SEPARATOR, "") };
  }
  if (c) return { code: c, text: clean };
  // No schema code, but the label carries one ("S22Q05 - …"): lift it out.
  const m = clean.match(EMBEDDED_CODE);
  if (m) return { code: m[1].toUpperCase(), text: clean.slice(m[0].length) };
  return { code: null, text: clean };
}

/** Plain-text form for aria-labels / tooltips: "S22Q05 Combien…". */
export function questionCodeText(code: string | null | undefined, text: string): string {
  const s = splitQuestionCode(code, text);
  return s.code ? `${s.code} ${s.text}` : s.text;
}
