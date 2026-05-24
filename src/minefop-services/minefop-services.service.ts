import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { $Enums } from '@prisma/client';
import { CreateServiceDto, UpdateServiceDto, CreatePositionDto, UpdatePositionDto } from './dto';

export interface ServiceNode {
  id: string;
  code: string;
  category: $Enums.ServiceCategory;
  level: number;
  parentCode: string | null;
  name: string;
  nameEn: string | null;
  acronym: string | null;
  roleMapping: $Enums.UserRole;
  requiresRegion: boolean;
  requiresDepartment: boolean;
  orderIndex: number;
  children?: ServiceNode[];
}

@Injectable()
export class MinefopServicesService {
  constructor(private prisma: PrismaService) { }

  async findAll(category?: $Enums.ServiceCategory) {
    return this.prisma.minefopService.findMany({
      where: {
        isActive: true,
        ...(category && { category }),
      },
      orderBy: [{ level: 'asc' }, { orderIndex: 'asc' }],
    });
  }

  async findAllWithInactive(category?: $Enums.ServiceCategory) {
    return this.prisma.minefopService.findMany({
      where: {
        ...(category && { category }),
      },
      orderBy: [{ level: 'asc' }, { orderIndex: 'asc' }],
    });
  }

  async getRoots(category?: $Enums.ServiceCategory) {
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

  async getTree(category?: $Enums.ServiceCategory): Promise<ServiceNode[]> {
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
      const node: ServiceNode = {
        id: s.code,
        code: s.code,
        name: s.name,
        nameEn: s.nameEn,
        acronym: s.acronym,
        category: s.category as $Enums.ServiceCategory,
        level: s.level,
        parentCode: s.parentCode,
        roleMapping: s.roleMapping as $Enums.UserRole,
        requiresRegion: s.requiresRegion,
        requiresDepartment: s.requiresDepartment,
        orderIndex: s.orderIndex,
        children: [],
      };
      map.set(s.code, node);
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
    // FIX: Use 'code' as the unique identifier since MinefopService only has 'code' as @id
    // Since id is a UUID, we need to find by id - but the model doesn't have an 'id' field
    // Let's find by code instead or use a different approach
    const service = await this.prisma.minefopService.findFirst({
      where: { code: id },
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
    return this.prisma.servicePosition.findMany({
      where: {
        serviceCode,
        isActive: true,
      },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async getServicesByRole(role: $Enums.UserRole) {
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
        category: data.category as $Enums.ServiceCategory,
        level: data.level,
        parentCode: data.parentCode,
        roleMapping: data.roleMapping as $Enums.UserRole,
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
        category: data.category as $Enums.ServiceCategory,
        level: data.level,
        parentCode: data.parentCode,
        roleMapping: data.roleMapping as $Enums.UserRole,
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
        titleEn: data.titleEn ?? '',
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
        titleEn: data.titleEn ?? '',
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

  // ==================== NEW CASCADE METHODS FOR REGISTRATION ====================

  /**
   * Get all distinct position types (job titles) available for a given MINEFOP role.
   * Returns a list of { positionType, label }.
   */
  async getAvailablePositionTypesByRole(role: $Enums.UserRole) {
    const positions = await this.prisma.servicePosition.findMany({
      where: {
        isActive: true,
        service: {
          roleMapping: role,
          isActive: true,
        },
      },
      distinct: ['positionType'],
      select: {
        positionType: true,
        title: true,
      },
      orderBy: {
        positionType: 'asc',
      },
    });

    const labelMap: Record<string, string> = {
      MINISTRE: 'Ministre',
      SECRETAIRE_GENERAL: 'Secrétaire Général',
      DIRECTEUR: 'Directeur',
      CHEF_DIVISION: 'Chef de Division',
      SOUS_DIRECTEUR: 'Sous-Directeur',
      CHEF_SERVICE: 'Chef de Service',
      CHEF_CELLULE: 'Chef de Cellule',
      CHEF_BUREAU: 'Chef de Bureau',
      INSPECTEUR_GENERAL_SERVICES: 'Inspecteur Général des Services',
      INSPECTEUR_SERVICES: 'Inspecteur des Services',
      INSPECTEUR_GENERAL_FORMATIONS: 'Inspecteur Général des Formations',
      INSPECTEUR_FORMATIONS: 'Inspecteur des Formations',
      DELEGUE_REGIONAL: 'Délégué Régional',
      DELEGUE_DEPARTEMENTAL: 'Délégué Départemental',
      INSPECTEUR_REGIONAL_FORMATIONS: 'Inspecteur Régional des Formations',
      CONSEILLER_TECHNIQUE: 'Conseiller Technique',
      CHEF_SECRETARIAT_PARTICULIER: 'Chef de Secrétariat Particulier',
      STAFF: 'Cadre',
      CHARGE_ETUDES_ASSISTANT: "Chargé d'Études",
      ATTACHE_PEDAGOGIQUE: 'Attaché Pédagogique',
      CONSEILLER_REGIONAL_FORMATIONS: 'Conseiller Régional des Formations',
    };

    return positions.map(pos => ({
      positionType: pos.positionType,
      label: labelMap[pos.positionType] || pos.title || pos.positionType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    }));
  }

  /**
   * Returns a tree of parent services that have at least one descendant service (any depth)
   * with the given positionType, and whose roleMapping matches the user's role.
   * The result is a filtered tree (like getTree but only including branches that lead to a service with the target position).
   */
  async getParentServicesForPosition(positionType: string, role: $Enums.UserRole): Promise<ServiceNode[]> {
    // Load all active services of the given role, with children and positions (recursively up to depth 3)
    const allServices = await this.prisma.minefopService.findMany({
      where: {
        isActive: true,
        roleMapping: role,
      },
      include: {
        positions: {
          where: { isActive: true },
        },
        children: {
          where: { isActive: true },
          include: {
            positions: { where: { isActive: true } },
            children: {
              where: { isActive: true },
              include: {
                positions: { where: { isActive: true } },
                children: {
                  where: { isActive: true },
                  include: {
                    positions: { where: { isActive: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    // Build map and tree
    const map = new Map<string, any>();
    for (const s of allServices) {
      map.set(s.code, {
        ...s,
        children: [],
      });
    }

    const roots: any[] = [];
    for (const s of allServices) {
      const node = map.get(s.code);
      if (s.parentCode && map.has(s.parentCode)) {
        map.get(s.parentCode).children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Helper: does this node or any descendant have the target positionType?
    const hasPositionInSubtree = (node: any): boolean => {
      if (node.positions?.some(p => p.positionType === positionType)) return true;
      for (const child of node.children) {
        if (hasPositionInSubtree(child)) return true;
      }
      return false;
    };

    // Filter tree: keep only nodes that have the target position somewhere below them
    const filterTree = (node: any): any | null => {
      const filteredChildren = node.children.map(filterTree).filter(Boolean);
      if (filteredChildren.length > 0 || node.positions?.some(p => p.positionType === positionType)) {
        return {
          id: node.code,
          code: node.code,
          name: node.name,
          nameEn: node.nameEn,
          acronym: node.acronym,
          category: node.category,
          level: node.level,
          parentCode: node.parentCode,
          roleMapping: node.roleMapping,
          requiresRegion: node.requiresRegion,
          requiresDepartment: node.requiresDepartment,
          orderIndex: node.orderIndex,
          children: filteredChildren,
        };
      }
      return null;
    };

    const filteredRoots = roots.map(filterTree).filter(Boolean) as ServiceNode[];
    return filteredRoots;
  }

  /**
   * Returns child services (flat list) under a given parent code that actually have the specified positionType.
   * This is used in the second cascade step: after selecting a parent, the user picks a child service that holds the job.
   */
  async getChildServicesForPosition(parentCode: string, positionType: string) {
    const parent = await this.prisma.minefopService.findUnique({
      where: { code: parentCode, isActive: true },
      include: {
        children: {
          where: { isActive: true },
          include: {
            positions: { where: { isActive: true, positionType } },
            children: {
              where: { isActive: true },
              include: {
                positions: { where: { isActive: true, positionType } },
                children: {
                  where: { isActive: true },
                  include: {
                    positions: { where: { isActive: true, positionType } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent service with code ${parentCode} not found`);
    }

    const results: any[] = [];

    const collect = (service: any) => {
      if (service.positions && service.positions.length > 0) {
        results.push({
          code: service.code,
          name: service.name,
          nameEn: service.nameEn,
          acronym: service.acronym,
          level: service.level,
          category: service.category,
          displayName: service.acronym ? `${service.acronym} - ${service.name}` : service.name,
        });
      }
      if (service.children) {
        for (const child of service.children) {
          collect(child);
        }
      }
    };

    for (const child of parent.children) {
      collect(child);
    }

    return results;
  }
}