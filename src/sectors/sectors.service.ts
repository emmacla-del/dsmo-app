import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SectorsService {
  constructor(private prisma: PrismaService) {}

  async getAllSectors() {
    return this.prisma.sector.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getSectorById(id: string) {
    return this.prisma.sector.findUnique({
      where: { id },
    });
  }

  async getSectorsByCategory(category: string) {
    return this.prisma.sector.findMany({
      where: { category },
      orderBy: { name: 'asc' },
    });
  }
}
