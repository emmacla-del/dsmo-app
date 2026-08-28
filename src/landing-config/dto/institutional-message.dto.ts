// src/landing-config/dto/institutional-message.dto.ts
//
// Wraps the 5 institutional ecosystem/stakeholder blocks, in order:
// government & policy makers, employment services, skills & training
// institutions, employers & social partners, researchers & analysts.
// `stakeholders` was the top-level `ecosystemStakeholders` array before
// this restructure.
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDefined, ValidateNested } from 'class-validator';
import { StakeholderDto } from './stakeholder.dto';

export class InstitutionalMessageDto {
  @IsDefined() @ValidateNested({ each: true }) @Type(() => StakeholderDto)
  @ArrayMinSize(5) @ArrayMaxSize(5)
  stakeholders: StakeholderDto[];
}
