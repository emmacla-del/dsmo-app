"use client";

import Link from "next/link";
import { usePortalEntry } from "./use-portal-entry";
import styles from "../portal.module.css";

// The dark band that ends every public page: a heading and one sentence on
// the left, one primary button on the right (ui-grammar §Public portal).

export function SiteCta({ title, body, action }: { title: string; body: string; action: string }) {
  const entry = usePortalEntry();

  return (
    <section className={styles.closing}>
      <div className={styles.container}>
        <h2>{title}</h2>
        <p>{body}</p>
        <Link href={entry.actionHref} className={`${styles.btn} ${styles.btnInvert}`}>
          {entry.actionLabel(action)}
        </Link>
      </div>
    </section>
  );
}
