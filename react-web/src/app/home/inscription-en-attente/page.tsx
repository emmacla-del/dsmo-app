"use client";

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { resubmitRegistration } from "@/lib/user-directory";

export default function InscriptionEnAttentePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const logout = useAuthStore((s) => s.logout);

  const mutation = useMutation({
    mutationFn: () => resubmitRegistration(),
    onSuccess: async () => {
      await refreshUser();
    },
  });

  // Once a reviewer approves the account, refreshUser() below brings back
  // status ACTIVE and this page has nothing left to say. Redirect from an
  // effect, not from the render body.
  useEffect(() => {
    if (user?.role === "COMPANY" && user.status === "ACTIVE") {
      router.replace("/home");
    }
  }, [user?.role, user?.status, router]);

  const pending = user?.status === "PENDING_APPROVAL";
  const complements = user?.status === "COMPLEMENTS_REQUESTED";

  return (
    <div className="cam-admin-page">
      <h1 style={{ fontFamily: "var(--cam-font-display)", fontSize: "var(--cam-font-size-xl)" }}>
        Dossier d&apos;inscription
      </h1>
      {pending && (
        <p className="cam-admin-lede">
          Votre compte est en attente de validation par un agent. Vous pourrez déclarer dès qu&apos;il sera activé.
        </p>
      )}
      {complements && (
        <>
          <p className="cam-admin-lede">Des compléments ont été demandés :</p>
          <div className="cam-admin-notice cam-admin-notice--warn" role="status">
            {user?.approvalComment || "Merci de compléter votre dossier."}
          </div>
          <button
            type="button"
            className="cam-button cam-button-primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "…" : "Renvoyer le dossier"}
          </button>
        </>
      )}
      {user?.status === "REJECTED" && (
        <div className="cam-admin-notice cam-admin-notice--error" role="alert">
          Inscription rejetée{user.rejectionReason ? ` : ${user.rejectionReason}` : "."}
        </div>
      )}
      <p>
        <button type="button" className="cam-button cam-button-secondary" onClick={() => logout()}>
          Se déconnecter
        </button>
      </p>
    </div>
  );
}
