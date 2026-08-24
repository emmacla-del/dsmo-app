// src/landing-config/dto/landing-config.dto.ts
//
// Validates the admin PUT body against the exact contract
// lib/models/landing_config.dart expects. Array sizes are fixed at
// 4/4/3 to match that contract — the public page and admin editor both
// assume these exact lengths (see LandingConfig.fromJson's fixedList).

import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDefined, ValidateNested } from 'class-validator';
import { LocalizedTextDto, MediumLocalizedTextDto, ShortLocalizedTextDto } from './localized-text.dto';
import { RoadmapItemDto } from './roadmap-item.dto';
import { ValueCardDto } from './value-card.dto';

export class LandingConfigDto {
  @IsDefined() @ValidateNested() @Type(() => ShortLocalizedTextDto)
  statusLine: ShortLocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => MediumLocalizedTextDto)
  heroSupport: MediumLocalizedTextDto;

  @IsDefined() @ValidateNested({ each: true }) @Type(() => RoadmapItemDto)
  @ArrayMinSize(4) @ArrayMaxSize(4)
  roadmap: RoadmapItemDto[];

  @IsDefined() @ValidateNested() @Type(() => LocalizedTextDto)
  roadmapCaption: LocalizedTextDto;

  @IsDefined() @ValidateNested({ each: true }) @Type(() => ValueCardDto)
  @ArrayMinSize(4) @ArrayMaxSize(4)
  valueCards: ValueCardDto[];

  @IsDefined() @ValidateNested({ each: true }) @Type(() => LocalizedTextDto)
  @ArrayMinSize(3) @ArrayMaxSize(3)
  aboutParagraphs: LocalizedTextDto[];

  @IsDefined() @ValidateNested() @Type(() => MediumLocalizedTextDto)
  aboutPositioning: MediumLocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => ShortLocalizedTextDto)
  ctaTitle: ShortLocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => MediumLocalizedTextDto)
  ctaNote: MediumLocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => MediumLocalizedTextDto)
  accessNote: MediumLocalizedTextDto;
}
