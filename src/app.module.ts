import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DsmoModule } from './dsmo/dsmo.module';
import { PrismaModule } from './prisma/prisma.module';
import { LocationsModule } from './locations/locations.module';
import { SectorsModule } from './sectors/sectors.module';
import { MinefopServicesModule } from './minefop-services/minefop-services.module';

@Module({
  imports: [
    AuthModule,
    DsmoModule,
    PrismaModule,
    LocationsModule,
    SectorsModule,
    MinefopServicesModule,
  ],
})
export class AppModule { }