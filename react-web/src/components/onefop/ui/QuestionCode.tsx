import type { ReactNode } from "react";
import { isDisplayableQuestionCode, splitQuestionCode } from "@/lib/question-code";

/**
 * Small grey number badge, e.g. [4.10]. Styled by `.cam-qcode` (globals.css).
 * Renders nothing for an internal identifier such as S0Q01 or PP_S4Q02 — see
 * isDisplayableQuestionCode.
 */
export function QuestionCode({ code }: { code: string | null | undefined }) {
  if (!isDisplayableQuestionCode(code)) return null;
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
