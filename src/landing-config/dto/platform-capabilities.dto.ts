// src/landing-config/dto/platform-capabilities.dto.ts
//
// Wraps the existing 7-step "from data to intelligence" pipeline: collect,
// validate, centralise, integrate, analyse, generate indicators, inform
// decisions. `items` was the top-level `dataToIntelligencePipeline` array
// before this restructure.
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDefined, ValidateNested } from 'class-validator';
import { ShortLocalizedTextDto } from './localized-text.dto';

export class PlatformCapabilitiesDto {
  @IsDefined() @ValidateNested({ each: true }) @Type(() => ShortLocalizedTextDto)
  @ArrayMinSize(7) @ArrayMaxSize(7)
  items: ShortLocalizedTextDto[];
}
