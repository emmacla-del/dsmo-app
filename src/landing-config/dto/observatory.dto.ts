// src/landing-config/dto/observatory.dto.ts
//
// The public "/observatory" page's editable content — a brand-new group
// (no prior flat-key existence, unlike hero/roadmap/etc.), so no
// migrateLegacy*Shape counterpart is needed in landing-config.service.ts:
// a snapshot taken before this field existed simply won't have an
// `observatory` key at all, and mergeWithDefaults' generic loop already
// replaces a missing/non-object top-level key with DEFAULT_LANDING_CONFIG's
// value for it.
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDefined, ValidateNested } from 'class-validator';
import { LocalizedTextDto, MediumLocalizedTextDto, ShortLocalizedTextDto } from './localized-text.dto';

export class ObservatoryDto {
  @IsDefined() @ValidateNested() @Type(() => ShortLocalizedTextDto)
  title: ShortLocalizedTextDto;

  @IsDefined() @ValidateNested() @Type(() => MediumLocalizedTextDto)
  description: MediumLocalizedTextDto;

  // Placeholder coverage/indicator teasers — content pending the Super
  // Admin's real copy, flagged as such in the admin editor and on the
  // public page itself (see ObservatoryScreen).
  @IsDefined() @ValidateNested({ each: true }) @Type(() => LocalizedTextDto)
  @ArrayMinSize(3) @ArrayMaxSize(3)
  indicators: LocalizedTextDto[];
}
