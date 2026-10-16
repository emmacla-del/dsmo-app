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
