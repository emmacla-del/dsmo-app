"use client";

import React from "react";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { isFieldVisible } from "@/lib/onefop-schema";

export interface ConditionalFieldProps {
  field: OnefopField;
  data: FormData;
  children: React.ReactNode;
}

/**
 * Conditionally renders a field based on schema visibility rules.
 * When hidden, the field is unmounted from the DOM, ensuring it does not
 * become an active target for required field validation or screen readers.
 */
export function ConditionalField({ field, data, children }: ConditionalFieldProps) {
  const visible = isFieldVisible(field, data);

  if (!visible) {
    return null;
  }

  return <>{children}</>;
}
