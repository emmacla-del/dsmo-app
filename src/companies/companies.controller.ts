// src/companies/companies.controller.ts
//
// The establishment register (the admin "Annuaire"). Moved out of
// DsmoController: these two reads are the register of every registered
// entity — ONEFOP and DSMO alike — so hanging them off the `/dsmo` prefix
// mis-stated their scope to every caller. DsmoController keeps what is
// genuinely DSMO: declaration submit/draft/validate/PDF.
//
// Behaviour is unchanged — same DsmoService methods, same territory
// scoping, same roles. Only the route prefix moves (/dsmo/companies →
// /companies).
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DsmoService } from '../dsmo/dsmo.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveCompanyGuard } from '../auth/active-company.guard';
import { Roles } from '../auth/roles.decorator';
import { DIRECTORY_ROLES } from '../auth/staff-scope';
import { territoryFromUser } from '../auth/territory';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
export class CompaniesController {
  constructor(private readonly dsmoService: DsmoService) { }

  // Declared before the collection route: Nest matches in declaration
  // order, and a bare `companies/:something` route added later must not
  // swallow `companies/stats`.
  @Get('stats')
  @Roles(...DIRECTORY_ROLES)
  async getCompanyStats(@Req() req: any) {
    const territory = territoryFromUser(req?.user);
    return this.dsmoService.getCompanyStats(territory);
  }

  @Get()
  @Roles(...DIRECTORY_ROLES)
  async listCompanies(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('region') region?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const territory = territoryFromUser(req?.user);
    return this.dsmoService.listCompanies({
      search,
      status,
      region,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    }, territory);
  }
}
