"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { registerCompany } from "@/lib/api-client";
import { getQueuedSignups, sendQueuedSignup } from "@/lib/registration-outbox";

export function RegistrationOutboxSync() {
  const t = useTranslations();
  const syncing = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function syncQueuedSignups() {
      if (!navigator.onLine || syncing.current) return;
      syncing.current = true;
      try {
        const queued = await getQueuedSignups();
        for (const signup of queued) {
          const { payload, response } = await sendQueuedSignup(signup.id, registerCompany);
          window.dispatchEvent(
            new CustomEvent("camleap:registration-synced", {
              detail: {
                companyName: response.company.name ?? payload.companyName,
                establishmentId: response.company.establishmentId,
                status: response.user.status,
              },
            }),
          );
          if (active) setNotice(t("registerPage.queuedSyncSuccess"));
        }
      } catch {
        if (active) setNotice(t("registerPage.queuedRetryError"));
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
          if (active && queued.length > 0) setNotice(t("registerPage.queuedBody"));
        })
        .catch(() => {
          if (active) setNotice(t("registerPage.queuedRetryError"));
        });
    }

    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("camleap:registration-outbox-updated", onOnline);
    };
  }, [t]);

  if (!notice) return null;
  return (
    <div
      className="fixed bottom-4 left-4 z-[100] max-w-sm rounded-md border border-emerald-200 bg-white p-4 text-sm text-emerald-950 shadow-lg"
      role="status"
      aria-live="polite"
    >
      {notice}
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
