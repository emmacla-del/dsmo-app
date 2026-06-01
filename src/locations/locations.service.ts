// src/locations/locations.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) { }

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

  // ── Full nested tree ─────────────────────────────────────────────────────
  // Returns the complete region → department → subdivision hierarchy in a
  // single query. Used by the report wizard to load all three dropdown levels
  // at once so cascading works locally without further network calls.
  //
  // Shape:
  // [
  //   {
  //     id, name,
  //     departments: [
  //       { id, name, subdivisions: [{ id, name }, ...] },
  //       ...
  //     ]
  //   },
  //   ...
  // ]
  async getFullStructure() {
    const regions = await this.prisma.region.findMany({
      orderBy: { name: 'asc' },
      include: {
        departments: {
          orderBy: { name: 'asc' },
          include: {
            subdivisions: {
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    return regions.map(r => ({
      id: r.id,
      name: r.name,
      departments: r.departments.map(d => ({
        id: d.id,
        name: d.name,
        subdivisions: d.subdivisions.map(s => ({
          id: s.id,
          name: s.name,
        })),
      })),
    }));
  }
}