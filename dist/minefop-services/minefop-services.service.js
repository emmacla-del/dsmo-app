"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinefopServicesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let MinefopServicesService = class MinefopServicesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(category) {
        return this.prisma.minefopService.findMany({
            where: {
                isActive: true,
                ...(category && { category }),
            },
            orderBy: [{ level: 'asc' }, { orderIndex: 'asc' }],
        });
    }
    async findAllWithInactive(category) {
        return this.prisma.minefopService.findMany({
            where: {
                ...(category && { category }),
            },
            orderBy: [{ level: 'asc' }, { orderIndex: 'asc' }],
        });
    }
    async getRoots(category) {
        return this.prisma.minefopService.findMany({
            where: {
                isActive: true,
                level: 1,
                ...(category && { category }),
            },
            orderBy: { orderIndex: 'asc' },
        });
    }
    async getChildren(parentCode) {
        return this.prisma.minefopService.findMany({
            where: { isActive: true, parentCode },
            orderBy: { orderIndex: 'asc' },
        });
    }
    async getTree(category) {
        const all = await this.prisma.minefopService.findMany({
            where: {
                isActive: true,
                ...(category && { category }),
            },
            orderBy: [{ level: 'asc' }, { orderIndex: 'asc' }],
        });
        const map = new Map();
        const roots = [];
        for (const s of all) {
            const node = {
                id: s.code,
                code: s.code,
                name: s.name,
                nameEn: s.nameEn,
                acronym: s.acronym,
                category: s.category,
                level: s.level,
                parentCode: s.parentCode,
                roleMapping: s.roleMapping,
                requiresRegion: s.requiresRegion,
                requiresDepartment: s.requiresDepartment,
                orderIndex: s.orderIndex,
                children: [],
            };
            map.set(s.code, node);
        }
        for (const s of all) {
            const node = map.get(s.code);
            if (s.parentCode && map.has(s.parentCode)) {
                const parent = map.get(s.parentCode);
                if (!parent.children)
                    parent.children = [];
                parent.children.push(node);
            }
            else {
                roots.push(node);
            }
        }
        return roots;
    }
    async getServiceByCode(code) {
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
            throw new common_1.NotFoundException(`Service with code ${code} not found`);
        }
        return service;
    }
    async getServiceById(id) {
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
            throw new common_1.NotFoundException(`Service with id ${id} not found`);
        }
        return service;
    }
    async getPositionsByService(serviceCode) {
        return this.prisma.servicePosition.findMany({
            where: {
                serviceCode,
                isActive: true,
            },
            orderBy: { orderIndex: 'asc' },
        });
    }
    async getServicesByRole(role) {
        const services = await this.prisma.minefopService.findMany({
            where: {
                isActive: true,
                roleMapping: role,
            },
            orderBy: { orderIndex: 'asc' },
        });
        if (services.length === 0) {
            throw new common_1.NotFoundException(`No services found for role: ${role}`);
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
    async createService(data) {
        if (data.parentCode) {
            const parent = await this.prisma.minefopService.findUnique({
                where: { code: data.parentCode },
            });
            if (!parent) {
                throw new common_1.NotFoundException(`Parent service with code ${data.parentCode} not found`);
            }
        }
        const existing = await this.prisma.minefopService.findUnique({
            where: { code: data.code },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Service with code ${data.code} already exists`);
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
    async updateService(code, data) {
        const existing = await this.prisma.minefopService.findUnique({
            where: { code },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Service with code ${code} not found`);
        }
        if (data.parentCode && data.parentCode !== existing.parentCode) {
            const parent = await this.prisma.minefopService.findUnique({
                where: { code: data.parentCode },
            });
            if (!parent) {
                throw new common_1.NotFoundException(`Parent service with code ${data.parentCode} not found`);
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
    async deleteService(code) {
        const existing = await this.prisma.minefopService.findUnique({
            where: { code },
            include: {
                children: true,
                users: true,
            },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Service with code ${code} not found`);
        }
        if (existing.children.length > 0) {
            throw new common_1.BadRequestException(`Cannot delete service with ${existing.children.length} child(ren). Delete or reassign children first.`);
        }
        if (existing.users.length > 0) {
            throw new common_1.BadRequestException(`Cannot delete service with ${existing.users.length} assigned user(s). Reassign users first.`);
        }
        await this.prisma.minefopService.update({
            where: { code },
            data: { isActive: false },
        });
    }
    async hardDeleteService(code) {
        const existing = await this.prisma.minefopService.findUnique({
            where: { code },
            include: {
                children: true,
                users: true,
                positions: true,
            },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Service with code ${code} not found`);
        }
        if (existing.children.length > 0) {
            throw new common_1.BadRequestException(`Cannot delete service with ${existing.children.length} child(ren). Delete children first.`);
        }
        if (existing.users.length > 0) {
            throw new common_1.BadRequestException(`Cannot delete service with assigned users.`);
        }
        await this.prisma.minefopService.delete({
            where: { code },
        });
    }
    async createPosition(data) {
        const service = await this.prisma.minefopService.findUnique({
            where: { code: data.serviceCode },
        });
        if (!service) {
            throw new common_1.NotFoundException(`Service with code ${data.serviceCode} not found`);
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
            throw new common_1.BadRequestException(`Position with type ${data.positionType} already exists for this service`);
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
    async updatePosition(id, data) {
        const existing = await this.prisma.servicePosition.findUnique({
            where: { id },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Position with id ${id} not found`);
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
    async deletePosition(id) {
        const existing = await this.prisma.servicePosition.findUnique({
            where: { id },
        });
        if (!existing) {
            throw new common_1.NotFoundException(`Position with id ${id} not found`);
        }
        await this.prisma.servicePosition.update({
            where: { id },
            data: { isActive: false },
        });
    }
    async getServiceHierarchyPath(code) {
        const path = [];
        const breadcrumb = [];
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
            }
            else {
                break;
            }
        }
        if (path.length === 0) {
            throw new common_1.NotFoundException(`Service with code ${code} not found`);
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
};
exports.MinefopServicesService = MinefopServicesService;
exports.MinefopServicesService = MinefopServicesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MinefopServicesService);
//# sourceMappingURL=minefop-services.service.js.map