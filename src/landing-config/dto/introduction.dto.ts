// src/landing-config/dto/introduction.dto.ts
//
// The programme-introduction band's nested shape — the third group moved
// from LandingConfigDto's flat fields (see that file's history:
// `aboutParagraphs` and `aboutPositioning`). Length caps unchanged from
// the flat fields they replace.
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDefined, ValidateNested } from 'class-validator';
import { LocalizedTextDto, MediumLocalizedTextDto } from './localized-text.dto';

export class IntroductionDto {
  @IsDefined() @ValidateNested({ each: true }) @Type(() => LocalizedTextDto)
  @ArrayMinSize(3) @ArrayMaxSize(3)
  paragraphs: LocalizedTextDto[];

  @IsDefined() @ValidateNested() @Type(() => MediumLocalizedTextDto)
  positioning: MediumLocalizedTextDto;
}
