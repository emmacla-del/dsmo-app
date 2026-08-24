// src/landing-config/dto/roadmap-item.dto.ts
import { Type } from 'class-transformer';
import { IsBoolean, IsDefined, ValidateNested } from 'class-validator';
import { LocalizedTextDto, ShortLocalizedTextDto } from './localized-text.dto';

export class RoadmapItemDto {
  @IsDefined() @ValidateNested() @Type(() => ShortLocalizedTextDto)
  label: ShortLocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => LocalizedTextDto)
  description: LocalizedTextDto;

  @IsBoolean()
  done: boolean;
}
