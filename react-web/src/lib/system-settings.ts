// src/lib/system-settings.ts
//
// GET / PATCH /system-settings — src/system-settings/system-settings.controller.ts.
// Roles: SUPER_ADMIN only. The singleton row also holds security settings
// (password length, maintenance mode); /admin/parametres reads the row but
// only ever sends the observatory identity fields below.
import { apiFetch } from "./api-client";

export interface SystemSettings {
  id: string;
  observatoryName: string | null;
  countryCode: string | null;
  defaultLanguage: string | null;
  timezone: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export interface ObservatoryIdentityUpdate {
  observatoryName: string | null;
  countryCode: string | null;
  defaultLanguage: string | null;
  timezone: string | null;
}

// Must match SUPPORTED_COUNTRIES / SUPPORTED_LANGUAGES in
// src/system-settings/system-settings.service.ts.
export const COUNTRY_OPTIONS = [{ value: "CM", label: "Cameroun" }];
export const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Français (FR)" },
  { value: "en", label: "English (EN)" },
];
// Cameroon has a single time zone; the server accepts any IANA zone.
export const TIMEZONE_OPTIONS = [{ value: "Africa/Douala", label: "Africa/Douala (GMT+1)" }];

export function getSystemSettings(): Promise<SystemSettings> {
  return apiFetch<SystemSettings>("/system-settings");
}

export function updateObservatoryIdentity(body: ObservatoryIdentityUpdate): Promise<SystemSettings> {
  return apiFetch<SystemSettings>("/system-settings", { method: "PATCH", body: JSON.stringify(body) });
}
