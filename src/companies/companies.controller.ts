// src/companies/companies.controller.ts
//
// The establishment register (the admin "Annuaire"). Moved out of
// DsmoController: these register reads cover every registered
// entity — ONEFOP and DSMO alike — so hanging them off the `/dsmo` prefix
// mis-stated their scope to every caller. DsmoController keeps what is
// genuinely DSMO: declaration submit/draft/validate/PDF.
//
// All reads share the same role guard and territory scope. The monthly
// trend is aggregated in SQL so the dashboard can render a full year without
// requesting the register page by page.
import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DsmoService } from '../dsmo/dsmo.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ActiveCompanyGuard } from '../auth/active-company.guard';
import { Roles } from '../auth/roles.decorator';
import { DIRECTORY_ROLES } from '../auth/staff-scope';
import { territoryFromUser } from '../auth/territory';

function parseOptionalPeriodNumber(value: string | undefined, name: string, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(`${name} must be a number between ${min} and ${max}.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(`${name} must be a number between ${min} and ${max}.`);
  }
  return parsed;
}

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
export class CompaniesController {
  constructor(private readonly dsmoService: DsmoService) { }

  @Get('registration-trend')
  @Roles(...DIRECTORY_ROLES)
  async getCompanyRegistrationTrend(@Req() req: any) {
    return this.dsmoService.getCompanyRegistrationTrend(territoryFromUser(req?.user));
  }

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
    @Query('sortOrder') sortOrder?: string,
    @Query('year') year?: string,
    @Query('semester') semester?: string,
    @Query('quarter') quarter?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const territory = territoryFromUser(req?.user);
    const periodYear = parseOptionalPeriodNumber(year, 'year', 2000, 2100);
    const periodSemester = parseOptionalPeriodNumber(semester, 'semester', 1, 2) as 1 | 2 | undefined;
    const periodQuarter = parseOptionalPeriodNumber(quarter, 'quarter', 1, 4) as 1 | 2 | 3 | 4 | undefined;
    if (
      periodSemester != null &&
      periodQuarter != null &&
      (periodQuarter <= 2 ? 1 : 2) !== periodSemester
    ) {
      throw new BadRequestException('The quarter does not belong to the selected semester.');
    }
    return this.dsmoService.listCompanies({
      search,
      status,
      region,
      sortOrder: sortOrder === 'oldest' ? 'oldest' : 'newest',
      year: periodYear,
      semester: periodSemester,
      quarter: periodQuarter,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    }, territory);
  }
}
