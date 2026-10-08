// onefop-questionnaire.dto.ts
// FULLY UPDATED - Aligned with AST FIX-7
// Only phone2 and conditional fields are optional
// Supports draft/final workflow (validation at service layer)

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
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
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) civilServants?: PermTempRowDto;
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) decisionStaff?: PermTempRowDto;
  @IsOptional() @ValidateNested() @Type(() => PermTempRowDto) contractStaff?: PermTempRowDto;
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
// VOCATIONAL TRAINING (VT-3) — DTO representation only.
//
// Sibling pattern cloned: ProjectProgramQuestionnaireDto (this file) —
// the only existing entity whose top-level DTO combines one
// XxxIdentificationDto (Detail) with separate child-row array fields
// (ProjectProgramActivityDto[]) rather than folding everything into one
// flat identification block. Field names and nullability throughout
// this section come directly from prisma/schema.prisma
// (OnefopVocationalTrainingDetail + the 12 OnefopVt* models) — not from
// VOCATIONAL_TRAINING_DESIGN_NOTE.md prose or onefop_ast.dart paperCode/
// path values. Every VT* child DTO below is an array of row-DTOs whose
// fields match their Prisma model's own columns 1:1 (mirroring
// ProjectProgramActivityDto's relationship to ProjectProgramActivity),
// not a nested per-enum-member convenience shape — that would mean
// inventing property names (e.g. "doctorat") that don't exist as Prisma
// columns, which VT-3 is scoped not to do.
//
// No @ArrayMaxSize on any VT array field, unlike ProjectProgramActivityDto
// (capped at 13): Prisma itself imposes no array-size constraint (child
// rows are unbounded), and a DTO-level cap here would be business
// validation this phase is scoped not to add.
// ─────────────────────────────────────────────

const VT_PERSON_TYPES = ['TRAINEE', 'TRAINER'];
const VT_DIPLOMA_KINDS = ['ACADEMIC', 'PROFESSIONAL'];
const VT_DIPLOMA_CODES = [
  'DOCTORAT', 'MASTER2', 'MAITRISE', 'LICENCE', 'DEUG_DUT', 'BACC_GENERAL',
  'BACC_TECHNIQUE', 'PROBATOIRE', 'BEPC', 'CEP', 'SANS_DIPLOME_ACADEMIQUE',
  'DIPLEG_DIPES2', 'INGENIEUR_MASTER_PRO', 'DIPCEG_DIPES1', 'LICENCE_PRO',
  'BTS_HND', 'BEP_BP_BACPRO', 'CAPIEG', 'CAPIAEG', 'CAP', 'DQP', 'CQP',
  'AUTRES_PRO', 'SANS_DIPLOME_PROFESSIONNEL', 'TOTAL',
];
// TOTAL excluded — "TOTAL is not a valid value for a person's diploma"
// (roster academicDiploma/professionalDiploma only).
const VT_DIPLOMA_CODES_NO_TOTAL = VT_DIPLOMA_CODES.filter((c) => c !== 'TOTAL');
const VT_GENDERS = ['MALE', 'FEMALE', 'TOTAL'];
const VT_AGE_BANDS = [
  'UNDER_14', 'AGE_14', 'AGE_15', 'AGE_16', 'AGE_17', 'AGE_18', 'AGE_19',
  'AGE_20', 'AGE_21', 'AGE_22', 'AGE_23', 'AGE_24', 'AGE_25', 'AGE_26',
  'AGE_27', 'AGE_28', 'AGE_29', 'AGE_30', 'AGE_31', 'AGE_32', 'AGE_33',
  'AGE_34', 'AGE_35', 'ABOVE_35', 'TOTAL',
];
const VT_TRAINER_AGE_BANDS = ['AGE_18_24', 'AGE_25_39', 'AGE_40_59', 'AGE_60_PLUS', 'TOTAL'];
const VT_FLOW_STATUSES = ['ENTRANT', 'SORTANT', 'ABANDON'];
const VT_EDUCATION_LEVELS = [
  'NON_ALPHABETISE', 'PRIMAIRE', 'PREMIER_CYCLE_GENERAL',
  'PREMIER_CYCLE_TECHNIQUE', 'SECOND_CYCLE_GENERAL',
  'SECOND_CYCLE_TECHNIQUE', 'ENSEIGNEMENT_NORMAL',
  'ENSEIGNEMENT_SUPERIEUR', 'TOTAL',
];
const VT_VULNERABLE_CATEGORIES = [
  'MOTEUR', 'VISUEL', 'AUDITIF', 'POLYHANDICAPES', 'REFUGIES',
  'ORPHELINS_VULNERABLES', 'DEPLACES_INTERNES', 'RETOURNES', 'BORORO',
  'BAKA', 'BAGUIELI', 'TOTAL',
];
const VT_TRAINER_DISABILITY_TYPES = ['MOTEUR', 'VISUEL', 'AUDITIF', 'POLYHANDICAPES', 'TOTAL'];
const VT_SCHOLARSHIP_CATEGORIES = ['OTHER_ADMIN', 'INTERNATIONAL', 'TOTAL'];
const VT_SCHOLARSHIP_STATUSES = ['GRANTED', 'RECEIVED'];
const VT_INFRASTRUCTURE_TYPES = [
  'SALLE_CLASSE', 'ATELIERS_PRATIQUES', 'LABORATOIRES',
  'BLOCS_ADMINISTRATIFS', 'SALLE_REUNION', 'SALLE_FORMATEURS', 'BUREAUX',
  'MAGASIN', 'ESPACES_TEMPORAIRES',
];
const VT_FURNITURE_TYPES = [
  'BANC_1_PLACE', 'BANC_2_PLACES', 'BANC_3_PLACES', 'BANC_4_PLACES_PLUS',
  'CHAISES_FORMATEURS', 'TABLES_FORMATEURS', 'ARMOIRES', 'TABLEAUX',
];
// Roster trainerStatus is plain string '1'/'2'/'3' (printed codes), not
// VtTrainerStatus — that enum's TOTAL member is structurally invalid on
// a named-person row (see OnefopVtTrainerRoster's schema.prisma comment).
const VT_ROSTER_TRAINER_STATUSES = ['1', '2', '3'];

// Matches OnefopVtDiplomaData columns exactly (id/submissionId/createdAt
// excluded — assigned at persistence, out of scope here). Covers 4.1,
// 4.2, 8.1, 8.2 in one array, differentiated per-row by personType/
// diplomaKind, matching the single Prisma model they share.
export class VtDiplomaDataDto {
  @IsIn(VT_PERSON_TYPES) personType!: string;
  @IsIn(VT_DIPLOMA_KINDS) diplomaKind!: string;
  @IsIn(VT_DIPLOMA_CODES) diploma!: string;
  @IsIn(VT_GENDERS) gender!: string;
  @IsOptional() @IsInt() value?: number;
}

// Matches OnefopVtTraineeAgeFlow columns exactly (4.7).
export class VtTraineeAgeFlowDto {
  @IsIn(VT_AGE_BANDS) ageBand!: string;
  @IsIn(VT_FLOW_STATUSES) flowStatus!: string;
  @IsIn(VT_GENDERS) gender!: string;
  @IsOptional() @IsInt() value?: number;
}

// Matches OnefopVtTrainerAge columns exactly (8.3).
export class VtTrainerAgeDto {
  @IsIn(VT_TRAINER_AGE_BANDS) ageBand!: string;
  @IsIn(VT_GENDERS) gender!: string;
  @IsOptional() @IsInt() value?: number;
}

// Matches OnefopVtEducationLevelFlow columns exactly (4.8).
export class VtEducationLevelFlowDto {
  @IsIn(VT_EDUCATION_LEVELS) educationLevel!: string;
  @IsIn(VT_FLOW_STATUSES) flowStatus!: string;
  @IsIn(VT_GENDERS) gender!: string;
  @IsOptional() @IsInt() value?: number;
}

// Matches OnefopVtTraineeVulnerable columns exactly (4.9).
export class VtTraineeVulnerableDto {
  @IsIn(VT_VULNERABLE_CATEGORIES) category!: string;
  @IsIn(VT_FLOW_STATUSES) flowStatus!: string;
  @IsIn(VT_GENDERS) gender!: string;
  @IsOptional() @IsInt() value?: number;
}

// Matches OnefopVtTrainerDisability columns exactly (8.6).
export class VtTrainerDisabilityDto {
  @IsIn(VT_TRAINER_DISABILITY_TYPES) category!: string;
  @IsIn(VT_GENDERS) gender!: string;
  @IsOptional() @IsInt() value?: number;
}

// Matches OnefopVtScholarship columns exactly (4.11).
export class VtScholarshipDto {
  @IsIn(VT_SCHOLARSHIP_CATEGORIES) category!: string;
  @IsIn(VT_SCHOLARSHIP_STATUSES) status!: string;
  @IsIn(VT_GENDERS) gender!: string;
  @IsOptional() @IsInt() value?: number;
}

// Matches OnefopVtSpecialtyRow columns exactly. Covers 4.3, 4.4, 4.5,
// 4.6, 4.10, 6.3, 8.4, 8.7 in one array, differentiated per-row by
// tableCode — 4.3/4.4/4.5 remain three distinct tableCode values here,
// not merged. Named cell columns only, no cell1..cell4 (design note
// §13.1, closed).
export class VtSpecialtyRowDto {
  @IsString() @IsNotEmpty() @ToString() tableCode!: string;
  @IsInt() rowIndex!: number;
  @IsOptional() @IsString() @ToString() specialtyText?: string;

  @IsOptional() @IsInt() fiMale?: number;
  @IsOptional() @IsInt() fiFemale?: number;
  @IsOptional() @IsInt() fcMale?: number;
  @IsOptional() @IsInt() fcFemale?: number;

  @IsOptional() @IsInt() year1Male?: number;
  @IsOptional() @IsInt() year1Female?: number;
  @IsOptional() @IsInt() year2Male?: number;
  @IsOptional() @IsInt() year2Female?: number;

  @IsOptional() @IsInt() male?: number;
  @IsOptional() @IsInt() female?: number;
  @IsOptional() @IsInt() total?: number;

  @IsOptional() @IsInt() fiCount?: number;
  @IsOptional() @IsInt() fcCount?: number;
}

// Matches OnefopVtCurriculum columns exactly (5.2).
export class VtCurriculumDto {
  @IsInt() rowIndex!: number;
  @IsOptional() @IsString() @ToString() specialtyText?: string;
  @IsOptional() @IsBoolean() hasCurriculum?: boolean;
  @IsOptional() @IsBoolean() isApproved?: boolean;
}

// Matches OnefopVtInfrastructure columns exactly (5.3).
export class VtInfrastructureDto {
  @IsIn(VT_INFRASTRUCTURE_TYPES) infrastructureType!: string;
  @IsOptional() @IsInt() totalCount?: number;
  @IsOptional() @IsInt() permanentGoodCount?: number;
  @IsOptional() @IsInt() permanentBadCount?: number;
  @IsOptional() @IsInt() temporaryCount?: number;
}

// Matches OnefopVtFurniture columns exactly (5.4).
export class VtFurnitureDto {
  @IsIn(VT_FURNITURE_TYPES) furnitureType!: string;
  @IsOptional() @IsInt() goodCount?: number;
  @IsOptional() @IsInt() badCount?: number;
}

// Matches OnefopVtTrainerRoster columns exactly (8.8). trainerStatus is
// string '1'/'2'/'3', not VtTrainerStatus. academicDiploma/
// professionalDiploma accept any VtDiplomaCode except TOTAL — the
// academic-only/professional-only split invariant (design note §13.3)
// is an application-level rule, not a Prisma constraint, and is
// deliberately not enforced here (DTO-level business validation is out
// of scope for VT-3).
export class VtTrainerRosterDto {
  @IsInt() rowIndex!: number;
  @IsString() @IsNotEmpty() @ToString() lastName!: string;
  @IsString() @IsNotEmpty() @ToString() firstName!: string;
  @IsOptional() @IsString() @ToString() sex?: string;
  @IsOptional() @IsIn(VT_ROSTER_TRAINER_STATUSES) trainerStatus?: string;
  @IsOptional() @IsBoolean() isAdminPersonnel?: boolean;
  @IsOptional() @IsIn(VT_DIPLOMA_CODES_NO_TOTAL) academicDiploma?: string;
  @IsOptional() @IsIn(VT_DIPLOMA_CODES_NO_TOTAL) professionalDiploma?: string;
}

// Matches OnefopVocationalTrainingDetail columns exactly. `name` is the
// only required field (Prisma: `name String`, every other column is
// nullable) — no blanket required validators added beyond that one
// schema-derived fact. respondentSex lives here only, per design note
// Decision 5 — not duplicated onto RespondentDto (untouched). The five
// §7.1.3 comms-channel fields are plain string arrays, empty allowed, no
// channel enum, no non-empty validator.
export class VocationalTrainingIdentificationDto {
  // §1 — identification
  @IsOptional() @IsString() @ToString() structureCode?: string;
  @IsString() @IsNotEmpty() @ToString() name!: string;
  @IsOptional() @IsString() @ToString() sigle?: string;
  @IsOptional() @IsString() @ToString() region?: string;
  @IsOptional() @IsString() @ToString() department?: string;
  @IsOptional() @IsString() @ToString() subdivision?: string;
  @IsOptional() @IsString() @ToString() commune?: string;
  @IsOptional() @IsString() @ToString() locality?: string;
  @IsOptional() @IsString() @ToString() area?: string;
  @IsOptional() @IsString() @ToString() educationSystem?: string;
  @IsOptional() @IsString() @ToString() cfpType?: string;
  @IsOptional() @IsString() @ToString() functionalStatus?: string;
  @IsOptional() @IsString() @ToString() nonFunctionalReason?: string;
  @IsOptional() @IsString() @ToString() nonFunctionalReasonOther?: string;
  @IsOptional() @IsInt() yearOfEstablishment?: number;
  @IsOptional() @IsString() @ToString() respondentSex?: string;
  @IsOptional() @IsString() @ToString() promoterName?: string;
  @IsOptional() @IsString() @ToString() promoterSex?: string;
  @IsOptional() @IsString() @ToString() promoterPhone1?: string;
  @IsOptional() @IsString() @ToString() promoterPhone2?: string;
  @IsOptional() @IsString() @ToString() promoterEmail?: string;

  // §2 — general information
  @IsOptional() @IsBoolean() hasStateAgreement?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) agreementTypes?: string[];
  @IsOptional() @IsInt() siteCount?: number;
  @IsOptional() @IsBoolean() sharesInfrastructure?: boolean;
  @IsOptional() @IsString() @ToString() sharedWithSchoolName?: string;
  @IsOptional() @IsBoolean() hasSpecialNeedsTrainers?: boolean;
  @IsOptional() @IsInt() specialNeedsTrainerTotal?: number;
  @IsOptional() @IsInt() specialNeedsTrainerFemale?: number;
  @IsOptional() @IsBoolean() hasAccessRamps?: boolean;
  @IsOptional() @IsBoolean() hasDirectorOffice?: boolean;
  @IsOptional() @IsString() @ToString() poBox?: string;
  @IsOptional() @IsString() @ToString() email?: string;
  @IsOptional() @IsString() @ToString() website?: string;
  @IsOptional() @IsBoolean() isAccredited?: boolean;
  @IsOptional() @IsInt() lastAccreditationYear?: number;
  @IsOptional() @IsString() @ToString() accreditationOrderNumber?: string;
  @IsOptional() @IsString() @ToString() accreditationOrderDate?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) trainingTypesOffered?: string[];
  @IsOptional() @IsInt() totalTraineesDeclared?: number;
  @IsOptional() @IsInt() totalTrainersDeclared?: number;
  @IsOptional() @IsInt() traineesFromLowerSecondary?: number;
  @IsOptional() @IsInt() traineesFromUpperSecondary?: number;
  @IsOptional() @IsBoolean() hasEnergySource?: boolean;
  @IsOptional() @IsBoolean() isEnergySourceFunctional?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) energySourceTypes?: string[];
  @IsOptional() @IsBoolean() hasWaterSource?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) waterSourceTypes?: string[];
  @IsOptional() @IsBoolean() hasHandwashingDevice?: boolean;
  @IsOptional() @IsBoolean() hasReceivedHealthCampaign?: boolean;
  @IsOptional() @IsBoolean() hasFirstAidBox?: boolean;
  @IsOptional() @IsBoolean() hasDispensary?: boolean;
  @IsOptional() @IsBoolean() hasFunctionalLibrary?: boolean;
  @IsOptional() @IsString() @ToString() fenceStatus?: string;
  @IsOptional() @IsBoolean() hasSchoolCouncil?: boolean;
  @IsOptional() @IsBoolean() hasLevelCouncil?: boolean;
  @IsOptional() @IsBoolean() hasDisciplinaryCouncil?: boolean;
  @IsOptional() @IsBoolean() hasFunctionalLatrines?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) latrineTypes?: string[];
  @IsOptional() @IsBoolean() latrinesSeparateByGender?: boolean;
  @IsOptional() @IsBoolean() latrinesSeparateFromStaff?: boolean;
  @IsOptional() @IsBoolean() hasPlayground?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) playgroundTypes?: string[];
  @IsOptional() @IsBoolean() hasIctTools?: boolean;
  @IsOptional() @IsInt() ictToolsForTrainersCount?: number;
  @IsOptional() @IsInt() ictToolsInternetCount?: number;
  @IsOptional() @IsBoolean() trainersIctTrained?: boolean;
  @IsOptional() @IsInt() trainersIctTrainedTotal?: number;
  @IsOptional() @IsInt() trainersIctTrainedFemale?: number;
  @IsOptional() @IsBoolean() trainersViolenceTraining?: boolean;
  @IsOptional() @IsBoolean() trainersPssTraining?: boolean;
  @IsOptional() @IsBoolean() hasBoarding?: boolean;
  @IsOptional() @IsBoolean() hasGbvMechanism?: boolean;
  @IsOptional() @IsBoolean() hasCanteen?: boolean;

  // §3 — education in emergencies
  @IsOptional() @IsBoolean() facedCrisis?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) crisisTypes?: string[];
  @IsOptional() @IsBoolean() crisisClosedCenter?: boolean;
  @IsOptional() @IsInt() closureDurationWeeks?: number;
  @IsOptional() @IsBoolean() siteRelocated?: boolean;
  @IsOptional() @IsString() @ToString() relocationLocality?: string;
  @IsOptional() @IsBoolean() traineesReassigned?: boolean;
  @IsOptional() @IsString() @ToString() reassignedTo?: string;
  @IsOptional() @IsBoolean() hasEarlyWarningSystem?: boolean;
  @IsOptional() @IsString() @ToString() earlyWarningDescription?: string;
  @IsOptional() @IsBoolean() earlyWarningFunctional?: boolean;
  @IsOptional() @IsBoolean() trainersInnovativePedagogyTrained?: boolean;
  @IsOptional() @IsInt() trainersInnovativePedagogyMale?: number;
  @IsOptional() @IsInt() trainersInnovativePedagogyFemale?: number;
  @IsOptional() @IsBoolean() trainersCrisisPedagogyTrained?: boolean;
  @IsOptional() @IsInt() trainersCrisisPedagogyMale?: number;
  @IsOptional() @IsInt() trainersCrisisPedagogyFemale?: number;
  @IsOptional() @IsBoolean() trainersDrrmTrained?: boolean;
  @IsOptional() @IsInt() trainersDrrmMale?: number;
  @IsOptional() @IsInt() trainersDrrmFemale?: number;
  @IsOptional() @IsBoolean() trainersEvacuationDrillTrained?: boolean;
  @IsOptional() @IsInt() trainersEvacuationDrillMale?: number;
  @IsOptional() @IsInt() trainersEvacuationDrillFemale?: number;
  @IsOptional() @IsBoolean() trainersOtherEmergencyTrained?: boolean;
  @IsOptional() @IsInt() trainersOtherEmergencyMale?: number;
  @IsOptional() @IsInt() trainersOtherEmergencyFemale?: number;
  @IsOptional() @IsBoolean() hasStudentRecordsSecurity?: boolean;
  @IsOptional() @IsBoolean() hasTextbookSecurity?: boolean;
  @IsOptional() @IsBoolean() hasContingencyPlan?: boolean;
  @IsOptional() @IsBoolean() traineesTrainedOnProtection?: boolean;

  // §5.1 — study guides
  @IsOptional() @IsBoolean() hasTraineeStudyGuides?: boolean;
  @IsOptional() @IsInt() traineeStudyGuideCount?: number;
  @IsOptional() @IsBoolean() hasTrainerStudyGuides?: boolean;
  @IsOptional() @IsInt() trainerStudyGuideCount?: number;

  // §6 — orientation / post-training follow-up
  @IsOptional() @IsBoolean() hasCareerGuidanceService?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) careerGuidanceTimings?: string[];
  @IsOptional() @IsBoolean() traineesChooseWithSupport?: boolean;
  @IsOptional() @IsBoolean() collaboratesWithCiopCosup?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) guidanceSupportTypes?: string[];
  @IsOptional() @IsString() @ToString() guidanceSupportOther?: string;
  @IsOptional() @IsBoolean() hasPostTrainingFollowUp?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) followUpMechanisms?: string[];
  @IsOptional() @IsString() @ToString() followUpMechanismOther?: string;
  @IsOptional() @IsBoolean() hasInsertionSupportUnit?: boolean;
  @IsOptional() @IsBoolean() hasTraineeDatabaseTool?: boolean;
  @IsOptional() @IsBoolean() hasJobSearchSupportTool?: boolean;

  // §7 — cross-cutting themes
  @IsOptional() @IsBoolean() hasHivAidsRules?: boolean;
  @IsOptional() @IsBoolean() hivRulesCoverSafety?: boolean;
  @IsOptional() @IsBoolean() hivRulesCoverStigmaHiv?: boolean;
  @IsOptional() @IsBoolean() hivRulesCoverStigmaOther?: boolean;
  @IsOptional() @IsBoolean() hivRulesCoverHarassment?: boolean;
  @IsOptional() @IsBoolean() hasDisciplinaryProcedures?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) pupilsCommsChannels?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) teachingStaffCommsChannels?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) nonTeachingStaffCommsChannels?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) parentsCommsChannels?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) schoolCouncilCommsChannels?: string[];
  @IsOptional() @IsBoolean() addressesIstIssues?: boolean;
  @IsOptional() @IsBoolean() traineesReceivedFullSexEd?: boolean;
  @IsOptional() @IsBoolean() genericLifeSkillsInSyllabus?: boolean;
  @IsOptional() @IsBoolean() genericLifeSkillsExtracurricular?: boolean;
  @IsOptional() @IsBoolean() reproHealthEdInSyllabus?: boolean;
  @IsOptional() @IsBoolean() reproHealthEdExtracurricular?: boolean;
  @IsOptional() @IsBoolean() hivTransmissionEdInSyllabus?: boolean;
  @IsOptional() @IsBoolean() hivTransmissionEdExtracurricular?: boolean;
  @IsOptional() @IsBoolean() trainersDeliveredSexEd?: boolean;
  @IsOptional() @IsBoolean() trainersPassedOnToStudents?: boolean;
  @IsOptional() @IsBoolean() heldParentOrientationSessions?: boolean;

  // §8.5 — trainer occupational status (embedded, not normalized)
  @IsOptional() @IsInt() vacataireProfMale?: number;
  @IsOptional() @IsInt() vacataireProfFemale?: number;
  @IsOptional() @IsInt() vacataireNonProfMale?: number;
  @IsOptional() @IsInt() vacataireNonProfFemale?: number;
  @IsOptional() @IsInt() permanentMale?: number;
  @IsOptional() @IsInt() permanentFemale?: number;

  // §9 — difficulties and perspectives
  @IsOptional() @IsBoolean() facesDifficulties?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) difficultyTypes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) difficultyOtherTexts?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) perspectives?: string[];
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

// VT-3: DTO representation only. respondent!: RespondentDto is inherited
// unchanged from BaseQuestionnaireDto — §1.15's name/function/phone1/
// phone2/email target the same shared RespondentDto every other entity
// uses (RespondentDto itself is untouched); respondentSex is VT-local
// (VocationalTrainingIdentificationDto.respondentSex), not added here.
export class VocationalTrainingQuestionnaireDto extends BaseQuestionnaireDto {
  organizationType: 'vocationalTraining' = 'vocationalTraining';

  @IsDefined()
  @ValidateNested() @Type(() => VocationalTrainingIdentificationDto)
  vocationalTraining!: VocationalTrainingIdentificationDto;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtDiplomaDataDto)
  diplomaData?: VtDiplomaDataDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtTraineeAgeFlowDto)
  traineeAgeFlow?: VtTraineeAgeFlowDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtTrainerAgeDto)
  trainerAge?: VtTrainerAgeDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtEducationLevelFlowDto)
  educationLevelFlow?: VtEducationLevelFlowDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtTraineeVulnerableDto)
  traineeVulnerable?: VtTraineeVulnerableDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtTrainerDisabilityDto)
  trainerDisability?: VtTrainerDisabilityDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtScholarshipDto)
  scholarship?: VtScholarshipDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtSpecialtyRowDto)
  specialtyRows?: VtSpecialtyRowDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtCurriculumDto)
  curriculum?: VtCurriculumDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtInfrastructureDto)
  infrastructure?: VtInfrastructureDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtFurnitureDto)
  furniture?: VtFurnitureDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VtTrainerRosterDto)
  trainerRoster?: VtTrainerRosterDto[];
}

export type AnyQuestionnaireDto =
  | EnterpriseQuestionnaireDto
  | CooperativeQuestionnaireDto
  | CtdQuestionnaireDto
  | OngQuestionnaireDto
  | ProjectProgramQuestionnaireDto
  | AdministrationQuestionnaireDto
  | VocationalTrainingQuestionnaireDto;
