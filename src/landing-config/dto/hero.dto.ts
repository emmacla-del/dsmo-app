// src/landing-config/dto/hero.dto.ts
//
// The hero band's nested shape — the first group moved from
// LandingConfigDto's flat fields (see that file's history: `heroHeadline`
// and `heroSupport`). `title` keeps the old heroHeadline length cap,
// `description` keeps the old heroSupport one.
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { MediumLocalizedTextDto, ShortLocalizedTextDto } from './localized-text.dto';

export class HeroDto {
  @IsDefined() @ValidateNested() @Type(() => ShortLocalizedTextDto)
  title: ShortLocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => MediumLocalizedTextDto)
  description: MediumLocalizedTextDto;
}
