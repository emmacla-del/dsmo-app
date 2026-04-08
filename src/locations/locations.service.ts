import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async getAllRegions() {
    return this.prisma.region.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getDepartmentsByRegion(regionId: string) {
    return this.prisma.department.findMany({
      where: { regionId },
      orderBy: { name: 'asc' },
    });
  }

  async getSubdivisionsByDepartment(departmentId: string) {
    return this.prisma.subdivision.findMany({
      where: { departmentId },
      orderBy: { name: 'asc' },
    });
  }

  async getRegionById(id: string) {
    return this.prisma.region.findUnique({
      where: { id },
      include: { departments: true },
    });
  }

  async getDepartmentById(id: string) {
    return this.prisma.department.findUnique({
      where: { id },
      include: { subdivisions: true },
    });
  }
}
