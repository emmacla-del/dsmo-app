"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError, apiErrorCode, registerCompany } from "@/lib/api-client";
import { getQueuedSignups, sendQueuedSignup } from "@/lib/registration-outbox";

export function RegistrationOutboxSync() {
  const t = useTranslations();
  const syncing = useRef(false);
  const retryTimer = useRef<number | null>(null);
  const retryAttempt = useRef(0);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "warning" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    let active = true;

    function clearRetry() {
      if (retryTimer.current === null) return;
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }

    function scheduleRetry() {
      if (!active || !navigator.onLine || retryTimer.current !== null) return;
      const delays = [5_000, 15_000, 30_000, 60_000];
      const delay = delays[Math.min(retryAttempt.current, delays.length - 1)];
      retryAttempt.current += 1;
      retryTimer.current = window.setTimeout(() => {
        retryTimer.current = null;
        void syncQueuedSignups();
      }, delay);
    }

    async function syncQueuedSignups() {
      if (!navigator.onLine || syncing.current) return;
      clearRetry();
      syncing.current = true;
      try {
        const queued = await getQueuedSignups();
        if (queued.length === 0) {
          retryAttempt.current = 0;
          if (active) setNotice(null);
          return;
        }
        for (const signup of queued) {
          const { payload, response: syncResult } = await sendQueuedSignup(
            signup.id,
            async (payload) => {
              try {
                return { kind: "created" as const, result: await registerCompany(payload) };
              } catch (error) {
                if (error instanceof ApiError && error.status === 409) {
                  const code = apiErrorCode(error);
                  if (code === "IDEMPOTENT_SUCCESS") return { kind: "already-created" as const };
                  if (code === "EMAIL_EXISTS") return { kind: "email-exists" as const };
                  if (code === "IDEMPOTENCY_PENDING") throw error;
                  if (code === "IDEMPOTENCY_KEY_REUSED" || code === "REGISTRATION_CONFLICT") {
                    return { kind: "review-conflict" as const };
                  }
                  // Older API deployments did not send a conflict code. Treat
                  // any other replay conflict as an already-accepted request;
                  // the explicit email and key-reuse codes above stay reviewable.
                  return { kind: "already-created" as const };
                }
                throw error;
              }
            },
          );

          if (syncResult.kind === "email-exists") {
            window.dispatchEvent(new Event("camleap:registration-email-exists"));
            if (active) setNotice({ message: t("registerPage.queuedEmailExists"), tone: "error" });
          } else if (syncResult.kind === "already-created") {
            window.dispatchEvent(new Event("camleap:registration-already-created"));
            if (active) setNotice({ message: t("registerPage.queuedAlreadyCreated"), tone: "success" });
          } else if (syncResult.kind === "review-conflict") {
            window.dispatchEvent(new Event("camleap:registration-review-conflict"));
            if (active) setNotice({ message: t("registerPage.queuedConflictReview"), tone: "error" });
          } else {
            window.dispatchEvent(
              new CustomEvent("camleap:registration-synced", {
                detail: {
                  companyName: syncResult.result.company.name ?? payload.companyName,
                  establishmentId: syncResult.result.company.establishmentId,
                  status: syncResult.result.user.status,
                },
              }),
            );
            if (active) setNotice({ message: t("registerPage.queuedSyncSuccess"), tone: "success" });
          }
        }
        retryAttempt.current = 0;
      } catch {
        if (active) setNotice({ message: t("registerPage.queuedRetryError"), tone: "warning" });
        scheduleRetry();
      } finally {
        syncing.current = false;
      }
    }

    const onOnline = () => void syncQueuedSignups();
    window.addEventListener("online", onOnline);
    window.addEventListener("camleap:registration-outbox-updated", onOnline);
    if (navigator.onLine) {
      void syncQueuedSignups();
    } else {
      void getQueuedSignups()
        .then((queued) => {
          if (active && queued.length > 0) {
            setNotice({ message: t("registerPage.queuedBody"), tone: "info" });
          }
        })
        .catch(() => {
          if (active) setNotice({ message: t("registerPage.queuedRetryError"), tone: "warning" });
        });
    }

    return () => {
      active = false;
      clearRetry();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("camleap:registration-outbox-updated", onOnline);
    };
  }, [t]);

  if (!notice) return null;
  const toneClass = {
    success: "border-emerald-200 text-emerald-950",
    warning: "border-amber-300 text-amber-950",
    error: "border-red-300 text-red-950",
    info: "border-slate-300 text-slate-950",
  }[notice.tone];
  return (
    <div
      className={`fixed bottom-4 left-4 z-[100] max-w-sm rounded-md border bg-white p-4 text-sm shadow-lg ${toneClass}`}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {notice.message}
      <button
        type="button"
        className="ml-3 underline"
        onClick={() => setNotice(null)}
        aria-label={t("registerPage.dismissNotice")}
      >
        {t("registerPage.dismissNotice")}
      </button>
    </div>
  );
}
