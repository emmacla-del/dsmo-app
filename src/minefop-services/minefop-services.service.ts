// src/minefop-services/minefop-services.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceCategory, PositionType, UserRole } from '@prisma/client';
import { CreateServiceDto, UpdateServiceDto, CreatePositionDto, UpdatePositionDto } from './dto';

export interface ServiceNode {
  id: string;
  code: string;
  category: ServiceCategory;
  level: number;
  parentCode: string | null;
  name: string;
  nameEn: string | null;
  acronym: string | null;
  roleMapping: UserRole;
  requiresRegion: boolean;
  requiresDepartment: boolean;
  orderIndex: number;
  children?: ServiceNode[];
}

@Injectable()
export class MinefopServicesService {
  constructor(private prisma: PrismaService) { }

  // ==================== QUERY METHODS ====================

  async findAll(category?: ServiceCategory) {
    return this.prisma.minefopService.findMany({
      where: {
        isActive: true,
        ...(category && { category }),
      },
      orderBy: [{ level: 'asc' }, { orderIndex: 'asc' }],
    });
  }

  async findAllWithInactive(category?: ServiceCategory) {
    return this.prisma.minefopService.findMany({
      where: {
        ...(category && { category }),
      },
      orderBy: [{ level: 'asc' }, { orderIndex: 'asc' }],
    });
  }

  async getRoots(category?: ServiceCategory) {
    return this.prisma.minefopService.findMany({
      where: {
        isActive: true,
        level: 1,
        ...(category && { category }),
      },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async getChildren(parentCode: string) {
    return this.prisma.minefopService.findMany({
      where: { isActive: true, parentCode },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async getTree(category?: ServiceCategory): Promise<ServiceNode[]> {
    const all = await this.prisma.minefopService.findMany({
      where: {
        isActive: true,
        ...(category && { category }),
      },
      orderBy: [{ level: 'asc' }, { orderIndex: 'asc' }],
    });

    const map = new Map<string, ServiceNode>();
    const roots: ServiceNode[] = [];

    for (const s of all) {
      map.set(s.code, { ...s, children: [] });
    }

    for (const s of all) {
      const node = map.get(s.code)!;
      if (s.parentCode && map.has(s.parentCode)) {
        const parent = map.get(s.parentCode)!;
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async getServiceByCode(code: string) {
    const service = await this.prisma.minefopService.findUnique({
      where: { code },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' },
        },
        positions: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!service) {
      throw new NotFoundException(`Service with code ${code} not found`);
    }

    return service;
  }

  async getServiceById(id: string) {
    const service = await this.prisma.minefopService.findUnique({
      where: { id },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' },
        },
        positions: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!service) {
      throw new NotFoundException(`Service with id ${id} not found`);
    }

    return service;
  }

  async getPositionsByService(serviceCode: string) {
    const positions = await this.prisma.servicePosition.findMany({
      where: {
        serviceCode,
        isActive: true,
      },
      orderBy: { orderIndex: 'asc' },
    });

    return positions;
  }

  async getServicesByRole(role: UserRole) {
    const services = await this.prisma.minefopService.findMany({
      where: {
        isActive: true,
        roleMapping: role,
      },
      orderBy: { orderIndex: 'asc' },
    });

    if (services.length === 0) {
      throw new NotFoundException(`No services found for role: ${role}`);
    }

    return services;
  }

  async getServicesByRegion() {
    return this.prisma.minefopService.findMany({
      where: {
        isActive: true,
        requiresRegion: true,
      },
      orderBy: { orderIndex: 'asc' },
    });
  }

  // ==================== MUTATION METHODS ====================

  async createService(data: CreateServiceDto) {
    if (data.parentCode) {
      const parent = await this.prisma.minefopService.findUnique({
        where: { code: data.parentCode },
      });
      if (!parent) {
        throw new NotFoundException(`Parent service with code ${data.parentCode} not found`);
      }
    }

    const existing = await this.prisma.minefopService.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw new BadRequestException(`Service with code ${data.code} already exists`);
    }

    return this.prisma.minefopService.create({
      data: {
        code: data.code,
        name: data.name,
        nameEn: data.nameEn,
        acronym: data.acronym,
        category: data.category,
        level: data.level,
        parentCode: data.parentCode,
        roleMapping: data.roleMapping,
        requiresRegion: data.requiresRegion ?? false,
        requiresDepartment: data.requiresDepartment ?? false,
        orderIndex: data.orderIndex,
        isActive: true,
      },
    });
  }

  async updateService(code: string, data: UpdateServiceDto) {
    const existing = await this.prisma.minefopService.findUnique({
      where: { code },
    });
    if (!existing) {
      throw new NotFoundException(`Service with code ${code} not found`);
    }

    if (data.parentCode && data.parentCode !== existing.parentCode) {
      const parent = await this.prisma.minefopService.findUnique({
        where: { code: data.parentCode },
      });
      if (!parent) {
        throw new NotFoundException(`Parent service with code ${data.parentCode} not found`);
      }
    }

    return this.prisma.minefopService.update({
      where: { code },
      data: {
        name: data.name,
        nameEn: data.nameEn,
        acronym: data.acronym,
        category: data.category,
        level: data.level,
        parentCode: data.parentCode,
        roleMapping: data.roleMapping,
        requiresRegion: data.requiresRegion,
        requiresDepartment: data.requiresDepartment,
        orderIndex: data.orderIndex,
        isActive: data.isActive,
      },
    });
  }

  async deleteService(code: string) {
    const existing = await this.prisma.minefopService.findUnique({
      where: { code },
      include: {
        children: true,
        users: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Service with code ${code} not found`);
    }

    if (existing.children.length > 0) {
      throw new BadRequestException(`Cannot delete service with ${existing.children.length} child(ren). Delete or reassign children first.`);
    }

    if (existing.users.length > 0) {
      throw new BadRequestException(`Cannot delete service with ${existing.users.length} assigned user(s). Reassign users first.`);
    }

    await this.prisma.minefopService.update({
      where: { code },
      data: { isActive: false },
    });
  }

  async hardDeleteService(code: string) {
    const existing = await this.prisma.minefopService.findUnique({
      where: { code },
      include: {
        children: true,
        users: true,
        positions: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Service with code ${code} not found`);
    }

    if (existing.children.length > 0) {
      throw new BadRequestException(`Cannot delete service with ${existing.children.length} child(ren). Delete children first.`);
    }

    if (existing.users.length > 0) {
      throw new BadRequestException(`Cannot delete service with assigned users.`);
    }

    await this.prisma.minefopService.delete({
      where: { code },
    });
  }

  // ==================== POSITION METHODS ====================

  async createPosition(data: CreatePositionDto) {
    const service = await this.prisma.minefopService.findUnique({
      where: { code: data.serviceCode },
    });
    if (!service) {
      throw new NotFoundException(`Service with code ${data.serviceCode} not found`);
    }

    const existing = await this.prisma.servicePosition.findUnique({
      where: {
        serviceCode_positionType: {
          serviceCode: data.serviceCode,
          positionType: data.positionType,
        },
      },
    });

    if (existing && existing.isActive) {
      throw new BadRequestException(`Position with type ${data.positionType} already exists for this service`);
    }

    return this.prisma.servicePosition.create({
      data: {
        serviceCode: data.serviceCode,
        positionType: data.positionType,
        title: data.title,
        titleEn: data.titleEn,
        level: data.level,
        orderIndex: data.orderIndex,
        isActive: true,
      },
    });
  }

  async updatePosition(id: string, data: UpdatePositionDto) {
    const existing = await this.prisma.servicePosition.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Position with id ${id} not found`);
    }

    return this.prisma.servicePosition.update({
      where: { id },
      data: {
        positionType: data.positionType,
        title: data.title,
        titleEn: data.titleEn,
        level: data.level,
        orderIndex: data.orderIndex,
        isActive: data.isActive,
      },
    });
  }

  async deletePosition(id: string) {
    const existing = await this.prisma.servicePosition.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Position with id ${id} not found`);
    }

    await this.prisma.servicePosition.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ==================== UTILITY METHODS ====================

  async getServiceHierarchyPath(code: string): Promise<{ path: string[]; breadcrumb: string[] }> {
    const path: string[] = [];
    const breadcrumb: string[] = [];
    let current = await this.prisma.minefopService.findUnique({
      where: { code },
    });

    while (current) {
      path.unshift(current.code);
      breadcrumb.unshift(current.name);
      if (current.parentCode) {
        current = await this.prisma.minefopService.findUnique({
          where: { code: current.parentCode },
        });
      } else {
        break;
      }
    }

    if (path.length === 0) {
      throw new NotFoundException(`Service with code ${code} not found`);
    }

    return { path, breadcrumb };
  }

  async getServiceStats() {
    const total = await this.prisma.minefopService.count();
    const active = await this.prisma.minefopService.count({ where: { isActive: true } });
    const byCategory = await this.prisma.minefopService.groupBy({
      by: ['category'],
      _count: true,
      where: { isActive: true },
    });
    const byLevel = await this.prisma.minefopService.groupBy({
      by: ['level'],
      _count: true,
      where: { isActive: true },
    });
    const totalPositions = await this.prisma.servicePosition.count({ where: { isActive: true } });

    return {
      total,
      active,
      inactive: total - active,
      totalPositions,
      byCategory: byCategory.map((c) => ({ category: c.category, count: c._count })),
      byLevel: byLevel.map((l) => ({ level: l.level, count: l._count })),
    };
  }
}