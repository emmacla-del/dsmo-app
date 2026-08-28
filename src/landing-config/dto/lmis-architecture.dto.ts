// src/landing-config/dto/lmis-architecture.dto.ts
//
// Wraps the 6 LMIS architecture pipeline steps, in order: data sources,
// collection, integration, analysis, intelligence, decision-making.
// `steps` was the top-level `architecturePipeline` array before this
// restructure.
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDefined, ValidateNested } from 'class-validator';
import { ShortLocalizedTextDto } from './localized-text.dto';

export class LmisArchitectureDto {
  @IsDefined() @ValidateNested({ each: true }) @Type(() => ShortLocalizedTextDto)
  @ArrayMinSize(6) @ArrayMaxSize(6)
  steps: ShortLocalizedTextDto[];
}
