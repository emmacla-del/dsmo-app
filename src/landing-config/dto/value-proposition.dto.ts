// src/landing-config/dto/value-proposition.dto.ts
//
// Wraps the existing 4-card ValueCardDto array under one group — a
// grouping change only, not a change to what's inside each card (see
// value-card.dto.ts, unchanged).
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDefined, ValidateNested } from 'class-validator';
import { ValueCardDto } from './value-card.dto';

export class ValuePropositionDto {
  @IsDefined() @ValidateNested({ each: true }) @Type(() => ValueCardDto)
  @ArrayMinSize(4) @ArrayMaxSize(4)
  cards: ValueCardDto[];
}
