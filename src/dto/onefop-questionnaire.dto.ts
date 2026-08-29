// onefop-questionnaire.dto.ts
// FULLY UPDATED - Aligned with AST FIX-7
// Only phone2 and conditional fields are optional
// Supports draft/final workflow (validation at service layer)

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsEmail,
  IsDefined,
  ValidateIf,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ToString } from '../common/decorators/to-string.decorator';

// ─────────────────────────────────────────────
// CORE LEAF TYPES
// ─────────────────────────────────────────────

export class AgeBreakdownDto {
  @IsOptional() @IsInt() @Min(0) age15_24?: number;
  @IsOptional() @IsInt() @Min(0) age25_34?: number;
  @IsOptional() @IsInt() @Min(0) age35plus?: number;
  @IsOptional() @IsInt() @Min(0) total?: number;
}

export class GenderAgeBreakdownDto {
  @IsOptional() @ValidateNested() @Type(() => AgeBreakdownDto) male?: AgeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => AgeBreakdownDto) female?: AgeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => AgeBreakdownDto) total?: AgeBreakdownDto;
}

export class MFTCountDto {
  @IsOptional() @IsInt() @Min(0) male?: number;
  @IsOptional() @IsInt() @Min(0) female?: number;
  @IsOptional() @IsInt() @Min(0) total?: number;
}

// ─────────────────────────────────────────────
// CSP TABLE
// ─────────────────────────────────────────────

export class CspGenderAgeTableDto {
  @IsOptional() @ValidateNested() @Type(() => GenderAgeBreakdownDto) executives?: GenderAgeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => GenderAgeBreakdownDto) foremen?: GenderAgeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => GenderAgeBreakdownDto) fieldWorkers?: GenderAgeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => GenderAgeBreakdownDto) total?: GenderAgeBreakdownDto;
}

// ─────────────────────────────────────────────
// RESPONDENT
// ─────────────────────────────────────────────

export class RespondentDto {
  @IsString() @IsNotEmpty()
  @ToString()
  name!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  function!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  phone1!: string;

  @IsOptional() @IsString()
  @ToString()
  phone2?: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

// ─────────────────────────────────────────────
// PERMANENT/TEMPORARY ROW
// ─────────────────────────────────────────────

export class PermTempRowDto {
  @IsOptional() @ValidateNested() @Type(() => MFTCountDto) permanent?: MFTCountDto;
  @IsOptional() @ValidateNested() @Type(() => MFTCountDto) temporary?: MFTCountDto;
  @IsOptional() @ValidateNested() @Type(() => MFTCountDto) total?: MFTCountDto;
}

// ─────────────────────────────────────────────
// DIPLOMA BREAKDOWN (AST aligned - no bepcCap)
// ─────────────────────────────────────────────

export class DiplomaGenderAgeRowDto {
  @IsOptional() @ValidateNested() @Type(() => AgeBreakdownDto) male?: AgeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => AgeBreakdownDto) female?: AgeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => AgeBreakdownDto) total?: AgeBreakdownDto;
}

export class DiplomaBreakdownDto {
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) cepCepe?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) bepcCap?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) probatoire?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) bac?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) btsDut?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) licence?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) maitrise?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) master?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) dqp?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) cqp?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) autres?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) sansDiplome?: DiplomaGenderAgeRowDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaGenderAgeRowDto) total?: DiplomaGenderAgeRowDto;
}

// ─────────────────────────────────────────────
// DISABLED RECRUITMENTS
// ─────────────────────────────────────────────

export class DisabledRecruitmentsDto {
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) executives?: PermTempRowDto;
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) foremen?: PermTempRowDto;
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) fieldWorkers?: PermTempRowDto;
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) total?: PermTempRowDto;
}

// ─────────────────────────────────────────────
// VULNERABLE RECRUITMENTS
// ─────────────────────────────────────────────

export class VulnerableRecruitmentsEnterpriseDto {
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) internalDisplaced?: PermTempRowDto;
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) refugees?: PermTempRowDto;
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) orphans?: PermTempRowDto;
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) total?: PermTempRowDto;
}

export class VulnerableRecruitmentsCspDto {
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) executives?: PermTempRowDto;
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) foremen?: PermTempRowDto;
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) fieldWorkers?: PermTempRowDto;
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) total?: PermTempRowDto;
}

// ─────────────────────────────────────────────
// FIRST-TIME EMPLOYMENT
// ─────────────────────────────────────────────

export class FirstTimeStatusDto {
  @IsOptional() @ValidateNested() @Type(() => GenderAgeBreakdownDto) executives?: GenderAgeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => GenderAgeBreakdownDto) foremen?: GenderAgeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => GenderAgeBreakdownDto) fieldWorkers?: GenderAgeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => GenderAgeBreakdownDto) subtotal?: GenderAgeBreakdownDto;
}

export class FirstTimeRecruitmentsDto {
  @IsOptional() @ValidateNested() @Type(() => FirstTimeStatusDto) permanent?: FirstTimeStatusDto;
  @IsOptional() @ValidateNested() @Type(() => FirstTimeStatusDto) temporary?: FirstTimeStatusDto;
  @IsOptional() @ValidateNested() @Type(() => GenderAgeBreakdownDto) total?: GenderAgeBreakdownDto;
}

// ─────────────────────────────────────────────
// DEPARTURES
// ─────────────────────────────────────────────

export class DepartureRowDto {
  @IsOptional() @IsInt() @Min(0) male?: number;
  @IsOptional() @IsInt() @Min(0) female?: number;
  @IsOptional() @IsInt() @Min(0) total?: number;
}

export class DeparturesByCspDto {
  @IsOptional() @ValidateNested() @Type(() => DepartureRowDto) dismissals?: DepartureRowDto;
  @IsOptional() @ValidateNested() @Type(() => DepartureRowDto) resignations?: DepartureRowDto;
  @IsOptional() @ValidateNested() @Type(() => DepartureRowDto) retirements?: DepartureRowDto;
  @IsOptional() @ValidateNested() @Type(() => DepartureRowDto) others?: DepartureRowDto;
  @IsOptional() @ValidateNested() @Type(() => DepartureRowDto) ensemble?: DepartureRowDto;
}

export class DeparturesTableDto {
  @IsOptional() @ValidateNested() @Type(() => DeparturesByCspDto) executives?: DeparturesByCspDto;
  @IsOptional() @ValidateNested() @Type(() => DeparturesByCspDto) foremen?: DeparturesByCspDto;
  @IsOptional() @ValidateNested() @Type(() => DeparturesByCspDto) fieldWorkers?: DeparturesByCspDto;
  @IsOptional() @ValidateNested() @Type(() => DeparturesByCspDto) total?: DeparturesByCspDto;
}

// ─────────────────────────────────────────────
// DISMISSAL REASONS
// ─────────────────────────────────────────────

export class DismissalReasonDto {
  @IsOptional() @IsString()
  @ToString()
  text?: string;

  @IsOptional() @IsInt() @Min(0) male?: number;
  @IsOptional() @IsInt() @Min(0) female?: number;
  @IsOptional() @IsInt() @Min(0) total?: number;
}

// ─────────────────────────────────────────────
// DISMISSAL + TECHNICAL UNEMPLOYMENT
// ─────────────────────────────────────────────

export class DismissalTechUnempDto {
  @IsOptional() @ValidateNested() @Type(() => MFTCountDto) dismissal?: MFTCountDto;
  @IsOptional() @ValidateNested() @Type(() => MFTCountDto) technicalUnemployment?: MFTCountDto;
  @IsOptional() @ValidateNested() @Type(() => MFTCountDto) total?: MFTCountDto;
}

export class DismissalTechUnempTableDto {
  @IsOptional() @ValidateNested() @Type(() => DismissalTechUnempDto) executives?: DismissalTechUnempDto;
  @IsOptional() @ValidateNested() @Type(() => DismissalTechUnempDto) foremen?: DismissalTechUnempDto;
  @IsOptional() @ValidateNested() @Type(() => DismissalTechUnempDto) fieldWorkers?: DismissalTechUnempDto;
  @IsOptional() @ValidateNested() @Type(() => DismissalTechUnempDto) total?: DismissalTechUnempDto;
}

// ─────────────────────────────────────────────
// INTERNSHIPS
// ─────────────────────────────────────────────

export class InternshipRowDto {
  @IsOptional() @IsInt() @Min(0) male?: number;
  @IsOptional() @IsInt() @Min(0) female?: number;
  @IsOptional() @IsInt() @Min(0) total?: number;
}

export class InternshipsDto {
  @IsOptional() @ValidateNested() @Type(() => InternshipRowDto) holiday?: InternshipRowDto;
  @IsOptional() @ValidateNested() @Type(() => InternshipRowDto) academic?: InternshipRowDto;
  @IsOptional() @ValidateNested() @Type(() => InternshipRowDto) professional?: InternshipRowDto;
  @IsOptional() @ValidateNested() @Type(() => InternshipRowDto) preWork?: InternshipRowDto;
  @IsOptional() @ValidateNested() @Type(() => InternshipRowDto) total?: InternshipRowDto;
}

// ─────────────────────────────────────────────
// SKILLS / TRAINING
// ─────────────────────────────────────────────

export class SkillNeedDto {
  @IsOptional() @IsString()
  @ToString()
  description?: string;

  @IsOptional() @IsInt() @Min(0) male?: number;
  @IsOptional() @IsInt() @Min(0) female?: number;
  @IsOptional() @IsInt() @Min(0) total?: number;
}

export class TrainingNeedDto {
  @IsOptional() @IsString()
  @ToString()
  domain?: string;

  @IsOptional() @IsInt() @Min(0) male?: number;
  @IsOptional() @IsInt() @Min(0) female?: number;
  @IsOptional() @IsInt() @Min(0) total?: number;
}

// ─────────────────────────────────────────────
// ENTITY IDENTIFICATION DTOS
// ─────────────────────────────────────────────

export class EnterpriseIdentificationDto {
  @IsIn([1, 2, 3, 4]) legalStatus!: number;

  @IsString() @IsNotEmpty()
  @ToString()
  name!: string;

  @IsIn([1, 2]) area!: number;

  @IsString() @IsNotEmpty()
  @ToString()
  region!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  department!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  subdivision!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  locality!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  phone1!: string;

  @IsOptional() @IsString()
  @ToString()
  phone2?: string;

  @IsString() @IsNotEmpty()
  @ToString()
  poBox!: string;

  @IsIn([1, 2, 3]) sector!: number;

  @IsString() @IsNotEmpty()
  @ToString()
  branch!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  mainActivity!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  headOffice!: string;

  @IsInt() @Min(0) permanentWorkers!: number;
  @IsInt() @Min(0) vacancies!: number;
  @IsIn([1, 2, 3, 4]) size!: number;
}

export class CooperativeIdentificationDto {
  @IsString() @IsNotEmpty()
  @ToString()
  name!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  headOffice!: string;

  @IsInt() @Min(1800) @Max(2100) yearCreated!: number;
  @IsIn([1, 2]) area!: 1 | 2;

  @IsString() @IsNotEmpty()
  @ToString()
  region!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  department!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  subdivision!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  locality!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  phone1!: string;

  @IsOptional() @IsString()
  @ToString()
  phone2?: string;

  @IsString() @IsNotEmpty()
  @ToString()
  poBox!: string;

  @IsIn([1, 2, 3]) sector!: 1 | 2 | 3;

  @IsString() @IsNotEmpty()
  @ToString()
  branch!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  mainActivity!: string;

  @IsIn([1, 2, 3]) type!: 1 | 2 | 3;

  @ValidateIf((o: CooperativeIdentificationDto) => o.type === 3)
  @IsString() @IsNotEmpty()
  @ToString()
  typeOther?: string;

  @IsInt() @Min(0) permanentWorkers!: number;
  @IsInt() @Min(0) vacancies!: number;
}

export class CtdIdentificationDto {
  @IsIn([1, 2]) type!: 1 | 2;

  @ValidateIf((o: CtdIdentificationDto) => o.type === 2)
  @IsIn([1, 2]) councilType?: 1 | 2;

  @IsInt() @Min(1800) @Max(2100) yearCreated!: number;
  @IsIn([1, 2]) area!: 1 | 2;

  @IsString() @IsNotEmpty()
  @ToString()
  region!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  department!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  subdivision!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  locality!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  phone1!: string;

  @IsOptional() @IsString()
  @ToString()
  phone2?: string;

  @IsString() @IsNotEmpty()
  @ToString()
  poBox!: string;

  @IsIn([1, 2, 3]) sector!: 1 | 2 | 3;

  @IsString() @IsNotEmpty()
  @ToString()
  branch!: string;

  @IsInt() @Min(0) permanentWorkers!: number;
  @IsInt() @Min(0) vacancies!: number;
}

export class OngIdentificationDto {
  @IsString() @IsNotEmpty()
  @ToString()
  name!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  headOffice!: string;

  @IsInt() @Min(1800) @Max(2100) yearCreated!: number;
  @IsIn([1, 2]) area!: 1 | 2;

  @IsString() @IsNotEmpty()
  @ToString()
  region!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  department!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  subdivision!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  locality!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  phone1!: string;

  @IsOptional() @IsString()
  @ToString()
  phone2?: string;

  @IsString() @IsNotEmpty()
  @ToString()
  poBox!: string;

  @IsIn([1, 2, 3]) sector!: 1 | 2 | 3;

  @IsString() @IsNotEmpty()
  @ToString()
  branch!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  mainMission!: string;

  @IsInt() @Min(0) permanentWorkers!: number;
  @IsInt() @Min(0) vacancies!: number;
}

// ─────────────────────────────────────────────
// SHARED SECTIONS (COMPLETE)
// ─────────────────────────────────────────────

export class SharedSectionsDto {
  @IsOptional() @ValidateNested() @Type(() => CspGenderAgeTableDto) jobApplications?: CspGenderAgeTableDto;
  @IsOptional() @ValidateNested() @Type(() => CspGenderAgeTableDto) recruitmentsPermanent?: CspGenderAgeTableDto;
  @IsOptional() @ValidateNested() @Type(() => CspGenderAgeTableDto) recruitmentsTemporary?: CspGenderAgeTableDto;
  @IsOptional() @ValidateNested() @Type(() => DiplomaBreakdownDto) recruitmentsByDiploma?: DiplomaBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => DisabledRecruitmentsDto) disabledRecruitments?: DisabledRecruitmentsDto;
  @IsOptional() @ValidateNested() @Type(() => VulnerableRecruitmentsEnterpriseDto) vulnerableRecruitmentsEnterprise?: VulnerableRecruitmentsEnterpriseDto;
  @IsOptional() @ValidateNested() @Type(() => VulnerableRecruitmentsCspDto) vulnerableRecruitmentsCsp?: VulnerableRecruitmentsCspDto;
  @IsOptional() @ValidateNested() @Type(() => CspGenderAgeTableDto) firstTimeJobSeekers?: CspGenderAgeTableDto;
  @IsOptional() @ValidateNested() @Type(() => FirstTimeRecruitmentsDto) firstTimeRecruitments?: FirstTimeRecruitmentsDto;
  @IsOptional() @ValidateNested() @Type(() => DeparturesTableDto) departures?: DeparturesTableDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => DismissalReasonDto)
  dismissalReasons?: DismissalReasonDto[];

  @IsOptional() @ValidateNested() @Type(() => DismissalTechUnempTableDto) dismissalTechUnemployment?: DismissalTechUnempTableDto;
  @IsOptional() @ValidateNested() @Type(() => InternshipsDto) internships?: InternshipsDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => SkillNeedDto)
  skillsNeeds?: SkillNeedDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TrainingNeedDto)
  trainingNeeds?: TrainingNeedDto[];

  @IsOptional() @IsInt() @Min(2000) @Max(2100) surveyYear?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3) copy?: 1 | 2 | 3;
}

// Phase 1 — Administration. Field set matches ADMIN_S1Q01-S1Q12 in
// onefop_ast.dart. hasProject/hasSupervisedStructures use the same
// numeric-code convention as area/sector (1/2), not a raw boolean —
// converted to Boolean at persistence time in questionnaires.service.ts,
// consistent with how other radio fields are mapped to their stored form.
export class AdministrationIdentificationDto {
  @IsString() @IsNotEmpty()
  @ToString()
  name!: string;

  @IsOptional() @IsString()
  @ToString()
  sigle?: string;

  @IsIn([1, 2]) area!: number;

  @IsString() @IsNotEmpty()
  @ToString()
  region!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  department!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  subdivision!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  locality!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  phone1!: string;

  @IsOptional() @IsString()
  @ToString()
  phone2?: string;

  @IsOptional() @IsString()
  @ToString()
  poBox?: string;

  @IsIn([1, 2, 3]) sector!: number;

  @IsOptional() @IsString()
  @ToString()
  branch?: string;

  @IsString() @IsNotEmpty()
  @ToString()
  mainMission!: string;

  @IsIn([1, 2]) hasProject!: number;

  @ValidateIf((o) => o.hasProject === 1)
  @IsInt() @Min(0)
  projectCount?: number;

  @IsIn([1, 2]) hasSupervisedStructures!: number;

  @ValidateIf((o) => o.hasSupervisedStructures === 1)
  @IsInt() @Min(0)
  supervisedStructureCount?: number;
}

// Phase 1 — Projects & Programs. Field set matches PP_S1Q01-S1Q16 in
// onefop_ast.dart (composite region/dept/subdivision/locality and
// tel1/tel2/BP fields flattened, matching every other entity's DTO
// convention). nature/area/sector/status/stopReason use the same
// numeric-code convention as Administration's area/sector — not raw
// strings — converted at persistence time in questionnaires.service.ts.
export class ProjectProgramIdentificationDto {
  @IsIn([1, 2, 3, 4]) nature!: number;

  @IsString() @IsNotEmpty()
  @ToString()
  name!: string;

  @IsOptional() @IsString()
  @ToString()
  sigle?: string;

  @IsString() @IsNotEmpty()
  @ToString()
  personInCharge!: string;

  @IsIn([1, 2]) area!: number;

  @IsString() @IsNotEmpty()
  @ToString()
  region!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  department!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  subdivision!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  locality!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  phone1!: string;

  @IsOptional() @IsString()
  @ToString()
  phone2?: string;

  @IsString() @IsNotEmpty()
  @ToString()
  poBox!: string;

  @IsIn([1, 2, 3]) sector!: number;

  @IsString() @IsNotEmpty()
  @ToString()
  branch!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  mainMission!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  headOffice!: string;

  @IsString() @IsNotEmpty()
  @ToString()
  supervisingMinistry!: string;

  @IsIn([1, 2, 3]) status!: number;

  @ValidateIf((o) => o.status === 1)
  @IsIn([1, 2, 3, 4])
  stopReason?: number;

  @IsInt() @Min(0) permanentWorkers!: number;

  @IsInt() @Min(0) vacancies!: number;
}

// One row of Section 2's activities table — a variable-count repeating
// collection (up to 13 rows on the paper form; only rows the respondent
// actually filled in are sent/persisted, see the flat-key normalizer).
// targetPopulation/supportType/scope are the paper form's coded
// categoricals (1-6/1-5/1-4 respectively), stored as their raw code
// string, matching how the frontend's ActivitiesTable dropdowns store
// values — not re-validated against the code range here since the row
// is optional/free-form and a stray value should not fail the whole
// submission.
export class ProjectProgramActivityDto {
  @IsOptional() @IsString() @ToString() description?: string;
  @IsOptional() @IsString() @ToString() targetPopulation?: string;
  @IsOptional() @IsString() @ToString() supportType?: string;
  @IsOptional() @IsString() @ToString() scope?: string;
  @IsOptional() @IsString() @ToString() startDate?: string;
  @IsOptional() @IsString() @ToString() duration?: string;
}

// Section 3's outcomes/perspectives KPI grid — 4 fixed rows x 3 period
// columns, all plain optional integers (no gender/age breakdown).
export class ProjectProgramOutcomesRowDto {
  @IsOptional() @IsInt() @Min(0) current?: number;
  @IsOptional() @IsInt() @Min(0) outlookDec?: number;
  @IsOptional() @IsInt() @Min(0) outlookJune?: number;
}

export class ProjectProgramOutcomesDto {
  @IsOptional() @ValidateNested() @Type(() => ProjectProgramOutcomesRowDto) employed?: ProjectProgramOutcomesRowDto;
  @IsOptional() @ValidateNested() @Type(() => ProjectProgramOutcomesRowDto) selfEmployed?: ProjectProgramOutcomesRowDto;
  @IsOptional() @ValidateNested() @Type(() => ProjectProgramOutcomesRowDto) jobsCreated?: ProjectProgramOutcomesRowDto;
  @IsOptional() @ValidateNested() @Type(() => ProjectProgramOutcomesRowDto) trained?: ProjectProgramOutcomesRowDto;
}

// ─────────────────────────────────────────────
// TOP LEVEL DISCRIMINATED UNION
// ─────────────────────────────────────────────

export abstract class BaseQuestionnaireDto extends SharedSectionsDto {
  abstract organizationType: string;

  @IsDefined()
  @ValidateNested() @Type(() => RespondentDto)
  respondent!: RespondentDto;
}

export class EnterpriseQuestionnaireDto extends BaseQuestionnaireDto {
  organizationType: 'enterprise' = 'enterprise';

  @IsDefined()
  @ValidateNested() @Type(() => EnterpriseIdentificationDto)
  enterprise!: EnterpriseIdentificationDto;
}

export class CooperativeQuestionnaireDto extends BaseQuestionnaireDto {
  organizationType: 'cooperative' = 'cooperative';

  @IsDefined()
  @ValidateNested() @Type(() => CooperativeIdentificationDto)
  cooperative!: CooperativeIdentificationDto;
}

export class CtdQuestionnaireDto extends BaseQuestionnaireDto {
  organizationType: 'ctd' = 'ctd';

  @IsDefined()
  @ValidateNested() @Type(() => CtdIdentificationDto)
  ctd!: CtdIdentificationDto;
}

export class OngQuestionnaireDto extends BaseQuestionnaireDto {
  organizationType: 'ong' = 'ong';

  @IsDefined()
  @ValidateNested() @Type(() => OngIdentificationDto)
  ong!: OngIdentificationDto;
}

export class AdministrationQuestionnaireDto extends BaseQuestionnaireDto {
  organizationType: 'administration' = 'administration';

  @IsDefined()
  @ValidateNested() @Type(() => AdministrationIdentificationDto)
  administration!: AdministrationIdentificationDto;
}

// Phase 1 — Projects & Programs. Sections 2-4 are dedicated fields on
// this DTO (not SharedSectionsDto, whose S21Q01/S22Q01/S3Q01/S4Q02
// shape belongs to the enterprise-family questionnaire and doesn't
// apply here) — activities/outcomes/section4 CSP tables reuse the
// existing entity-agnostic Csp*Dto shapes, matching S4Q01-S4Q06's own
// csp_gender_age_table/csp_status_gender_table templates in
// onefop_ast.dart.
export class ProjectProgramQuestionnaireDto extends BaseQuestionnaireDto {
  organizationType: 'projectProgram' = 'projectProgram';

  @IsDefined()
  @ValidateNested() @Type(() => ProjectProgramIdentificationDto)
  projectProgram!: ProjectProgramIdentificationDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(13)
  @ValidateNested({ each: true })
  @Type(() => ProjectProgramActivityDto)
  activities?: ProjectProgramActivityDto[];

  @IsOptional() @ValidateNested() @Type(() => ProjectProgramOutcomesDto) outcomes?: ProjectProgramOutcomesDto;

  @IsOptional() @ValidateNested() @Type(() => CspGenderAgeTableDto) countedPermanent?: CspGenderAgeTableDto;
  @IsOptional() @ValidateNested() @Type(() => CspGenderAgeTableDto) countedTemporary?: CspGenderAgeTableDto;
  @IsOptional() @ValidateNested() @Type(() => CspGenderAgeTableDto) recruitedPermanent?: CspGenderAgeTableDto;
  @IsOptional() @ValidateNested() @Type(() => CspGenderAgeTableDto) recruitedTemporary?: CspGenderAgeTableDto;
  @IsOptional() @ValidateNested() @Type(() => DisabledRecruitmentsDto) disabledRecruitments?: DisabledRecruitmentsDto;
  @IsOptional() @ValidateNested() @Type(() => DisabledRecruitmentsDto) vulnerableRecruitments?: DisabledRecruitmentsDto;
}

export type AnyQuestionnaireDto =
  | EnterpriseQuestionnaireDto
  | CooperativeQuestionnaireDto
  | CtdQuestionnaireDto
  | OngQuestionnaireDto
  | ProjectProgramQuestionnaireDto
  | AdministrationQuestionnaireDto;
