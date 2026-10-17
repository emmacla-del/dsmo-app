import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useTranslations } from "next-intl";

// 2026-10-16 re-test: the review read "1 / 1 tables".

function Progress() {
  const t = useTranslations("vtValidationScreen");
  return (
    <p>
      {t("tablesProgress", { complete: 1, total: 1 })} | {t("tablesProgress", { complete: 3, total: 8 })} |{" "}
      {t("questionsProgress", { filled: 0, total: 1 })}
    </p>
  );
}

test("one table and one question are singular, in both languages", () => {
  const { unmount } = renderWithProviders(<Progress />, { locale: "en" });
  assert.ok(screen.getByText("1 / 1 table | 3 / 8 tables | 0 / 1 question"));
  unmount();
  renderWithProviders(<Progress />);
  assert.ok(screen.getByText("1 / 1 tableau | 3 / 8 tableaux | 0 / 1 question"));
});

// The review's per-section count read "1 issue(s)" / "1 incomplet(s)".
function Issues() {
  const t = useTranslations("vtValidationScreen");
  return <p>{t("issuesCount", { count: 1 })} | {t("issuesCount", { count: 3 })}</p>;
}

test("the issue count on the review is singular for one, in both languages", () => {
  const { unmount } = renderWithProviders(<Issues />, { locale: "en" });
  assert.ok(screen.getByText("1 issue to fix | 3 issues to fix"));
  unmount();
  renderWithProviders(<Issues />);
  assert.ok(screen.getByText("1 point à corriger | 3 points à corriger"));
});

// "{count} {noun} renseigné(s)" could not agree with a noun whose gender
// varies (lignes, spécialités): the French no longer needs agreement.
function RowsNote() {
  const t = useTranslations("vtWizard");
  return <p>{t("rowsFilledNote", { count: 1, total: 4, noun: "lignes" })}</p>;
}

test("the rows-entered note carries no (s) in French", () => {
  renderWithProviders(<RowsNote />);
  assert.ok(screen.getByText(/^Avancement : 1 sur 4 lignes\./));
});
