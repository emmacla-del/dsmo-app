// src/landing-config/dto/landing-config.dto.ts
//
// Validates the admin PUT body against the exact contract
// lib/models/landing_config.dart expects. Array sizes are fixed to match
// that contract — the public page and admin editor both assume these
// exact lengths (see LandingConfig.fromJson's fixedList).

import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDefined, ValidateNested } from 'class-validator';
import { HeroDto } from './hero.dto';
import { InstitutionalMessageDto } from './institutional-message.dto';
import { IntroductionDto } from './introduction.dto';
import { LmisArchitectureDto } from './lmis-architecture.dto';
import { MediumLocalizedTextDto, ShortLocalizedTextDto } from './localized-text.dto';
import { ObservatoryDto } from './observatory.dto';
import { PlatformCapabilitiesDto } from './platform-capabilities.dto';
import { RoadmapDto } from './roadmap.dto';
import { ValuePropositionDto } from './value-proposition.dto';

export class LandingConfigDto {
  @IsDefined() @ValidateNested() @Type(() => ShortLocalizedTextDto)
  statusLine: ShortLocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => HeroDto)
  hero: HeroDto;

  @IsDefined() @ValidateNested() @Type(() => RoadmapDto)
  roadmap: RoadmapDto;

  @IsDefined() @ValidateNested() @Type(() => ValuePropositionDto)
  valueProposition: ValuePropositionDto;

  // Short kicker word shown above each pillar in valueProposition.cards
  // (index-aligned).
  @IsDefined() @ValidateNested({ each: true }) @Type(() => ShortLocalizedTextDto)
  @ArrayMinSize(4) @ArrayMaxSize(4)
  whyPillarKickers: ShortLocalizedTextDto[];

  @IsDefined() @ValidateNested() @Type(() => LmisArchitectureDto)
  lmisArchitecture: LmisArchitectureDto;

  @IsDefined() @ValidateNested() @Type(() => PlatformCapabilitiesDto)
  platformCapabilities: PlatformCapabilitiesDto;

  @IsDefined() @ValidateNested() @Type(() => InstitutionalMessageDto)
  institutionalMessage: InstitutionalMessageDto;

  @IsDefined() @ValidateNested() @Type(() => IntroductionDto)
  introduction: IntroductionDto;

  @IsDefined() @ValidateNested() @Type(() => ObservatoryDto)
  observatory: ObservatoryDto;

  @IsDefined() @ValidateNested() @Type(() => ShortLocalizedTextDto)
  ctaTitle: ShortLocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => MediumLocalizedTextDto)
  ctaNote: MediumLocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => MediumLocalizedTextDto)
  accessNote: MediumLocalizedTextDto;
}
