// src/landing-config/dto/stakeholder.dto.ts
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { LocalizedTextDto } from './localized-text.dto';

export class StakeholderDto {
  @IsDefined() @ValidateNested() @Type(() => LocalizedTextDto)
  title: LocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => LocalizedTextDto)
  body: LocalizedTextDto;
}
