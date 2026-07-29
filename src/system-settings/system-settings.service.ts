// src/system-settings/system-settings.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SINGLETON_ID = 'singleton';

export interface SystemSettingsUpdate {
  passwordMinLength?: number;
  require2FAForStaff?: boolean;
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;
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

  async updateSettings(data: SystemSettingsUpdate, updatedBy: string) {
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
