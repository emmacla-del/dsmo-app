/**
 * Question-code helpers.
 *
 * A question's `paperCode` is one of two quite different things, depending on
 * the questionnaire:
 *
 *  - the training-centre (VT) form numbers its questions « 1.1 », « 2.1.7 »,
 *    « 4.10 ». That numbering is printed on the paper form the respondent is
 *    copying from, so showing it helps them keep their place;
 *  - every employer form (enterprise, cooperative, CTD, NGO, administration,
 *    project/programme) carries an internal identifier instead: S0Q01,
 *    S21Q01, PP_S4Q02. It appears nowhere the respondent can see, several
 *    questions share one (S0Q03 is Tel 1, Tel 2 *and* the e-mail address),
 *    and §8 of the engineering constitution rules out showing technical codes
 *    to respondents.
 *
 * So the badge is shown only for a form number — digits and dots —
 * (isDisplayableQuestionCode). The code is still split off the label text in
 * every case, because some schema labels embed it ("S22Q05 - Combien…") and
 * it must not be left sitting inside the question.
 */
const SEPARATOR = /^[\s ]*[-–—:.]?[\s ]*/;
const EMBEDDED_CODE = /^(S\d+[A-Z0-9._]*)[\s ]*[-–—:][\s ]*/i;
/** « 1 », « 4.10 », « 2.1.7 » — a number printed on the paper form. */
const FORM_NUMBER = /^\d+(\.\d+)*$/;

export interface SplitQuestionCode {
  code: string | null;
  text: string;
}

/**
 * Whether this code is a number the respondent can find on their paper form,
 * rather than an internal identifier. Only a displayable code is shown.
 */
export function isDisplayableQuestionCode(code: string | null | undefined): boolean {
  const c = code?.trim();
  return !!c && FORM_NUMBER.test(c);
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

/**
 * Plain-text form for aria-labels / tooltips: « 4.10 Combien… » on the
 * training-centre form, the question alone on an employer form — a screen
 * reader should not read out an internal code either.
 */
export function questionCodeText(code: string | null | undefined, text: string): string {
  const s = splitQuestionCode(code, text);
  return isDisplayableQuestionCode(s.code) ? `${s.code} ${s.text}` : s.text;
}
