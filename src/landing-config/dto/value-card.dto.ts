// src/landing-config/dto/value-card.dto.ts
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { LocalizedTextDto } from './localized-text.dto';

export class ValueCardDto {
  @IsDefined() @ValidateNested() @Type(() => LocalizedTextDto)
  title: LocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => LocalizedTextDto)
  body: LocalizedTextDto;
}
