// src/landing-config/dto/roadmap.dto.ts
//
// Wraps the existing 4-milestone RoadmapItemDto array plus the caption
// shown alongside it. `milestones` was the top-level `roadmap` array and
// `caption` was `roadmapCaption` before this restructure.
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDefined, ValidateNested } from 'class-validator';
import { LocalizedTextDto } from './localized-text.dto';
import { RoadmapItemDto } from './roadmap-item.dto';

export class RoadmapDto {
  @IsDefined() @ValidateNested({ each: true }) @Type(() => RoadmapItemDto)
  @ArrayMinSize(4) @ArrayMaxSize(4)
  milestones: RoadmapItemDto[];

  @IsDefined() @ValidateNested() @Type(() => LocalizedTextDto)
  caption: LocalizedTextDto;
}
