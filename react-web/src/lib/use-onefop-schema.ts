"use client";

import { useQuery } from "@tanstack/react-query";
import type { OnefopSchema } from "./onefop-schema";

async function fetchSchema(): Promise<OnefopSchema> {
  const res = await fetch("/schemas/onefop.schema.json");
  if (!res.ok) throw new Error(`Failed to load ONEFOP schema: ${res.status}`);
  return res.json();
}

export function useOnefopSchema() {
  return useQuery({
    queryKey: ["onefop-schema"],
    queryFn: fetchSchema,
    staleTime: Infinity,
  });
}
