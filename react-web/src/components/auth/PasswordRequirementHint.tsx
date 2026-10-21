"use client";

import { useTranslations } from "next-intl";
import { validatePassword } from "@/lib/password-strength";

// What the password still lacks, in one sentence, and only while it lacks
// something. It replaced a standing four-item list ("One capital letter",
// "One digit", ...) that read as four requirements when the rule is two:
// at least 8 characters (the only check the server makes), and enough
// strength, which any one of a capital, a digit or a symbol supplies
// (validatePassword). Empty field or acceptable password: nothing shown.
//
// The container is always rendered, so the input's aria-describedby always
// points at something, and it is a polite live region: the sentence changes
// only when the missing requirement does, not on every keystroke.
export function PasswordRequirementHint({ id, password }: { id: string; password: string }) {
  const t = useTranslations("registerPage");
  const code = password ? validatePassword(password) : null;
  const message =
    code === "tooShort" ? t("passwordHintTooShort") : code === "tooWeak" ? t("passwordHintTooWeak") : null;
  return (
    <div id={id} aria-live="polite">
      {message && <p className="field-hint">{message}</p>}
    </div>
  );
}
