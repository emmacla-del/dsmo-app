// src/landing-config/dto/localized-text.dto.ts
//
// Three variants of the same {fr, en} shape, differing only in the length
// ceiling appropriate to where they're used on the landing page — see
// LandingConfigDto for which field uses which.

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LocalizedTextDto {
  @IsString() @IsNotEmpty() @MaxLength(5000)
  fr: string;

  @IsString() @IsNotEmpty() @MaxLength(5000)
  en: string;
}

// statusLine, ctaTitle, roadmap labels — short, single-line copy.
export class ShortLocalizedTextDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  fr: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  en: string;
}

// heroSupport, ctaNote, accessNote, aboutPositioning — a sentence or two.
export class MediumLocalizedTextDto {
  @IsString() @IsNotEmpty() @MaxLength(800)
  fr: string;

  @IsString() @IsNotEmpty() @MaxLength(800)
  en: string;
}
