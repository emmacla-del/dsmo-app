import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { SectorsService } from './sectors.service';

/**
 * Public reference data — intentionally unguarded.
 *
 * /sectors: national economic sector nomenclature.
 * /locations/*: administrative hierarchy (regions, departments,
 * subdivisions) published by the state.
 *
 * No PII, no per-user data. Guarding these adds friction without
 * protecting anything sensitive. If this assumption changes, add
 * @UseGuards(JwtAuthGuard).
 */
@Controller('sectors')
export class SectorsController {
  constructor(private readonly sectorsService: SectorsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllSectors() {
    return this.sectorsService.getAllSectors();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getSectorById(@Param('id') id: string) {
    return this.sectorsService.getSectorById(id);
  }

  @Get('category/:category')
  @HttpCode(HttpStatus.OK)
  async getSectorsByCategory(@Param('category') category: string) {
    return this.sectorsService.getSectorsByCategory(category);
  }
}
