import { Injectable, CanActivate, ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private systemSettings: SystemSettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();

    // Maintenance mode blocks every RolesGuard-protected route except for
    // SUPER_ADMIN, so the one true system administrator can always get back
    // in to flip it off — see SystemSettingsController.
    if (user?.role !== 'SUPER_ADMIN') {
      const settings = await this.systemSettings.getSettings();
      if (settings.maintenanceMode) {
        throw new ServiceUnavailableException(
          settings.maintenanceMessage ||
            'La plateforme est actuellement en maintenance. Merci de réessayer plus tard.',
        );
      }
    }

    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;
    return requiredRoles.some((role) => user.role === role);
  }
}
