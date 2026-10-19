// src/lib/onefop-section-title.ts
//
// How a section is named on a respondent's screen. The AST stores its
// titles in capitals ("SECTION 4. DETAILS SUR LES RESENCEMENTS ET
// RECRUTEMENTS CONCERNANT L'ACTIVITE DE LA STRUCTURE SOUS-TUTELLE /
// PROJET / PROGRAMME"), which is how the paper form prints them. The
// wizard rail has always quietened them; the section heading and the
// review list printed them as stored, so one declaration shouted in two
// places and spoke normally in a third. One helper now, read by all three.
//
// Capitals that carry meaning — CTD, ONG, MINEFOP — are kept.

/** "Section 4. Details sur les resencements…" from the AST's own title. */
export function formatSectionTitle(rawTitle: string, index: number): string {
  if (!rawTitle) {
    return `Section ${index}`;
  }

  // Strip an existing "SECTION X." / "Section X :" / "Section X -" prefix:
  // the number is supplied here, so the form's own one is not repeated.
  let cleaned = rawTitle.replace(/^section\s+\d+\s*[.:-]?\s*/i, "").trim();
  if (!cleaned) {
    cleaned = rawTitle;
  }

  cleaned = cleaned.toLowerCase();
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  cleaned = cleaned
    .replace(/\bctd\b/gi, "CTD")
    .replace(/\bong\b/gi, "ONG")
    .replace(/\bngos?\b/gi, (m) => m.toUpperCase().replace(/S$/, "s"))
    .replace(/\bminefop\b/gi, "MINEFOP")
    .replace(/\bonefop\b/gi, "ONEFOP")
    .replace(/\bdsmo\b/gi, "DSMO");

  return `Section ${index}. ${cleaned}`;
}

/** The same title without its "Section N." prefix, where a number is
 *  already shown beside it (the rail's step markers, the review list). */
export function sectionTitleWithoutNumber(rawTitle: string, index: number): string {
  return formatSectionTitle(rawTitle, index).replace(/^Section\s+\d+\.\s*/, "");
}

/** The section's own number, read off its id ("section4_projectProgram"). */
export function sectionNumberFromId(sectionId: string, fallback: number): number {
  const match = /section(\d+)/i.exec(sectionId);
  return match ? Number(match[1]) : fallback;
}
