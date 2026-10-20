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
import type { FormData } from "./onefop-schema";
import { ppIdentificationTitle, ppInformationTitle, ppNatureKindOf } from "./pp-nature-wording";

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

/**
 * The name a section carries where it is navigated rather than answered:
 * the rail, the review list, the list of sections already transmitted.
 *
 * Five of the six Modern Jobs forms name their sections in two or three
 * words — « Emploi et travail », « Départs », « Stage et formation ». The
 * project/programme form does not: its AST titles run to 127 characters
 * because each one repeats « de la structure sous-tutelle / projet /
 * programme », so the rail read as three paragraphs and the respondent had
 * to parse a sentence to find where they were.
 *
 * So the rail quotes the head of each of those three titles, in the form's
 * own vocabulary, and nothing else changes: the section screen still heads
 * itself with the official title in full (SectionRenderer), and the PDF,
 * the exports and the AST are untouched. Section 2 says « le projet »
 * where the paper says « la structure sous-tutelle / projet et programme »,
 * because « la structure » alone is Section 1's name.
 */
const SECTION_NAV_TITLES: Record<string, { fr: string; en: string }> = {
  section3_projectProgram: {
    fr: "Emploi et travail",
    en: "Employment and labour",
  },
  section4_projectProgram: {
    // « Recensements », which the paper form misspells « RESENCEMENTS » —
    // its English says "appointments", where its own questions ask what the
    // respondent counted ("did you count").
    fr: "Recensements et recrutements",
    en: "Headcount and recruitment",
  },
};

/** The rail's name for a section: the short one where there is one, the
 *  title without its "Section N." prefix everywhere else.
 *
 *  `data` is the form's answers. With it, the project form's Sections 1
 *  and 2 name the body PP_S1Q01 says it is — « Identification du
 *  programme », « Renseignements sur la structure » (pp-nature-wording.ts). */
export function sectionNavTitle(
  sectionId: string,
  rawTitle: string,
  index: number,
  locale: "fr" | "en",
  data?: FormData,
): string {
  if (sectionId === "section1_projectProgram") {
    return ppIdentificationTitle(ppNatureKindOf(data), locale);
  }
  if (sectionId === "section2_projectProgram") {
    return ppInformationTitle(ppNatureKindOf(data), locale);
  }
  const short = SECTION_NAV_TITLES[sectionId];
  return short ? short[locale] : sectionTitleWithoutNumber(rawTitle, index);
}

/** The section's own number, read off its id ("section4_projectProgram"). */
export function sectionNumberFromId(sectionId: string, fallback: number): number {
  const match = /section(\d+)/i.exec(sectionId);
  return match ? Number(match[1]) : fallback;
}
