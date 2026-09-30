// src/system-settings/system-settings.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SINGLETON_ID = 'singleton';

export interface SystemSettingsUpdate {
  passwordMinLength?: number;
  require2FAForStaff?: boolean;
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;
  // Observatory identity (/admin/parametres). null clears a value.
  observatoryName?: string | null;
  countryCode?: string | null;
  defaultLanguage?: string | null;
  timezone?: string | null;
}

// Values the /admin/parametres form offers. The platform ships FR and EN
// only (react-web messages/, lib/l10n).
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export const SUPPORTED_COUNTRIES = ['CM'] as const;
const OBSERVATORY_NAME_MAX = 120;

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Validates only the identity fields; the four original fields pass through
// unchanged so existing callers (Flutter system_settings_screen) behave as before.
export function validateIdentityFields(data: SystemSettingsUpdate): SystemSettingsUpdate {
  const out: SystemSettingsUpdate = { ...data };
  const text = (key: 'observatoryName' | 'countryCode' | 'defaultLanguage' | 'timezone') => {
    const v = data[key];
    if (v === undefined || v === null) return v;
    if (typeof v !== 'string') throw new BadRequestException(`${key} doit être une chaîne de caractères.`);
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  };

  const name = text('observatoryName');
  if (name && name.length > OBSERVATORY_NAME_MAX) {
    throw new BadRequestException(`Le nom de l'observatoire ne peut dépasser ${OBSERVATORY_NAME_MAX} caractères.`);
  }
  const country = text('countryCode');
  if (country && !(SUPPORTED_COUNTRIES as readonly string[]).includes(country)) {
    throw new BadRequestException('Pays non pris en charge.');
  }
  const language = text('defaultLanguage');
  if (language && !(SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
    throw new BadRequestException('Langue non prise en charge.');
  }
  const timezone = text('timezone');
  if (timezone && !isValidTimezone(timezone)) {
    throw new BadRequestException('Fuseau horaire inconnu.');
  }

  if (name !== undefined) out.observatoryName = name;
  if (country !== undefined) out.countryCode = country;
  if (language !== undefined) out.defaultLanguage = language;
  if (timezone !== undefined) out.timezone = timezone;
  return out;
}

@Injectable()
export class SystemSettingsService {
  // Read on every guarded request (MaintenanceGuard), so a process-local
  // cache avoids a DB round trip per request. Invalidated on update; a
  // multi-instance deployment may lag by a request or two after another
  // instance changes settings, which is acceptable for this use case.
  private cached: Awaited<ReturnType<SystemSettingsService['fetchOrCreate']>> | null = null;

  constructor(private prisma: PrismaService) { }

  async getSettings() {
    if (this.cached) return this.cached;
    this.cached = await this.fetchOrCreate();
    return this.cached;
  }

  async updateSettings(input: SystemSettingsUpdate, updatedBy: string) {
    const data = validateIdentityFields(input);
    const row = await this.prisma.systemSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data, updatedBy },
      update: { ...data, updatedBy },
    });
    this.cached = row;
    return row;
  }

  private async fetchOrCreate() {
    const existing = await this.prisma.systemSettings.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (existing) return existing;
    return this.prisma.systemSettings.create({ data: { id: SINGLETON_ID } });
  }
}
