import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DsmoModule } from './dsmo/dsmo.module';
import { PrismaModule } from './prisma/prisma.module';
import { LocationsModule } from './locations/locations.module';
import { SectorsModule } from './sectors/sectors.module';

@Module({
  imports: [
    AuthModule,
    DsmoModule,
    PrismaModule,
    LocationsModule,  // ✅ ADD THIS
    SectorsModule,    // ✅ ADD THIS
  ],
})
export class AppModule { }