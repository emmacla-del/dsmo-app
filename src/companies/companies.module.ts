// src/companies/companies.module.ts
//
// Controller-only module: the register is served by DsmoService
// (listCompanies / getCompanyStats), which DsmoModule already exports. The
// service deliberately stays where it is — only the HTTP surface moves.
import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { DsmoModule } from '../dsmo/dsmo.module';

@Module({
  imports: [DsmoModule],
  controllers: [CompaniesController],
})
export class CompaniesModule { }
