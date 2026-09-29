import type { ReactNode } from "react";
import { splitQuestionCode } from "@/lib/question-code";

/** Small grey code badge, e.g. [S22Q05]. Styled by `.cam-qcode` (globals.css). */
export function QuestionCode({ code }: { code: string | null | undefined }) {
  if (!code) return null;
  return <span className="cam-qcode">{code}</span>;
}

/**
 * Badge + question text. Use this for every question / table title so the
 * code always looks the same and is never duplicated in the text.
 */
export function CodedLabel({ code, text }: { code: string | null | undefined; text: string }): ReactNode {
  const s = splitQuestionCode(code, text);
  return (
    <>
      <QuestionCode code={s.code} />
      {s.text}
    </>
  );
}
