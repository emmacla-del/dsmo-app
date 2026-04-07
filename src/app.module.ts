import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DsmoModule } from './dsmo/dsmo.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [AuthModule, DsmoModule, PrismaModule],
})
export class AppModule {}
