import { Module } from '@nestjs/common';
import { OnefopSchemaLoaderService } from './onefop-schema-loader.service';
import { OnefopShadowValidatorService } from './onefop-shadow-validator.service';

@Module({
  providers: [OnefopSchemaLoaderService, OnefopShadowValidatorService],
  exports: [OnefopSchemaLoaderService, OnefopShadowValidatorService],
})
export class OnefopSchemaValidationModule {}
