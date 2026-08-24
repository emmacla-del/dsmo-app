// src/landing-config/landing-config.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SINGLETON_ID = 'singleton';

// Mirrors LandingConfig.defaults() in lib/models/landing_config.dart exactly
// — keep both in sync if this pre-CMS fallback copy ever changes. Seeded
// into the row on its first-ever fetch (see fetchOrCreate); after that, the
// Super Admin's saved value takes over.
const DEFAULT_LANDING_CONFIG = {
  statusLine: {
    fr: "Initiative MINEFOP / ONEFOP — pilote en attente d'autorisation institutionnelle",
    en: 'MINEFOP / ONEFOP initiative — pilot pending institutional authorization',
  },
  roadmap: [
    { label: { fr: 'Collecte de données', en: 'Data collection' }, done: true },
    { label: { fr: 'Formation professionnelle', en: 'Training data' }, done: false },
    { label: { fr: 'Intelligence', en: 'Intelligence' }, done: false },
    { label: { fr: 'Observatoire public', en: 'Public observatory' }, done: false },
  ],
  roadmapCaption: {
    fr: 'Composante I opérationnelle · Composantes II–IV planifiées',
    en: 'Component I operational · Components II–IV planned',
  },
};

@Injectable()
export class LandingConfigService {
  // Read on every landing-page load (public, unauthenticated, potentially
  // high-traffic), so a process-local cache avoids a DB round trip per
  // visitor. Invalidated on update — see SystemSettingsService for the same
  // pattern and its multi-instance caveat.
  private cached: Awaited<ReturnType<LandingConfigService['fetchOrCreate']>> | null = null;

  constructor(private prisma: PrismaService) { }

  /** Returns the flat contract the Flutter client expects — LandingConfig's
   * three fields plus `updatedAt` for the admin form's "last saved" display
   * (harmless extra key for the public consumer, which ignores it). */
  async getConfig() {
    const row = this.cached ?? (this.cached = await this.fetchOrCreate());
    const data = row.data as Record<string, any>;
    return { ...data, updatedAt: row.updatedAt };
  }

  async updateConfig(data: Record<string, any>, updatedBy: string) {
    const row = await this.prisma.landingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, data, updatedBy },
      update: { data, updatedBy },
    });
    this.cached = row;
    return { ...(row.data as Record<string, any>), updatedAt: row.updatedAt };
  }

  private async fetchOrCreate() {
    const existing = await this.prisma.landingConfig.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (existing) return existing;
    return this.prisma.landingConfig.create({
      data: { id: SINGLETON_ID, data: DEFAULT_LANDING_CONFIG },
    });
  }
}
