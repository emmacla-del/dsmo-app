"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OngQuestionnaireDto = exports.CtdQuestionnaireDto = exports.CooperativeQuestionnaireDto = exports.EnterpriseQuestionnaireDto = exports.BaseQuestionnaireDto = exports.SharedSectionsDto = exports.OngIdentificationDto = exports.CtdIdentificationDto = exports.CooperativeIdentificationDto = exports.EnterpriseIdentificationDto = exports.TrainingNeedDto = exports.SkillNeedDto = exports.InternshipsDto = exports.InternshipRowDto = exports.DismissalTechUnempTableDto = exports.DismissalTechUnempDto = exports.DismissalReasonDto = exports.DeparturesTableDto = exports.DeparturesByCspDto = exports.DepartureRowDto = exports.FirstTimeRecruitmentsDto = exports.FirstTimeStatusDto = exports.VulnerableRecruitmentsCspDto = exports.VulnerableRecruitmentsEnterpriseDto = exports.DisabledRecruitmentsDto = exports.DiplomaBreakdownDto = exports.DiplomaGenderAgeRowDto = exports.PermTempRowDto = exports.RespondentDto = exports.CspGenderAgeTableDto = exports.MFTCountDto = exports.GenderAgeBreakdownDto = exports.AgeBreakdownDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const to_string_decorator_1 = require("../common/decorators/to-string.decorator");
class AgeBreakdownDto {
}
exports.AgeBreakdownDto = AgeBreakdownDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AgeBreakdownDto.prototype, "age15_24", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AgeBreakdownDto.prototype, "age25_34", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AgeBreakdownDto.prototype, "age35plus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AgeBreakdownDto.prototype, "total", void 0);
class GenderAgeBreakdownDto {
}
exports.GenderAgeBreakdownDto = GenderAgeBreakdownDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AgeBreakdownDto),
    __metadata("design:type", AgeBreakdownDto)
], GenderAgeBreakdownDto.prototype, "male", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AgeBreakdownDto),
    __metadata("design:type", AgeBreakdownDto)
], GenderAgeBreakdownDto.prototype, "female", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AgeBreakdownDto),
    __metadata("design:type", AgeBreakdownDto)
], GenderAgeBreakdownDto.prototype, "total", void 0);
class MFTCountDto {
}
exports.MFTCountDto = MFTCountDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MFTCountDto.prototype, "male", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MFTCountDto.prototype, "female", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MFTCountDto.prototype, "total", void 0);
class CspGenderAgeTableDto {
}
exports.CspGenderAgeTableDto = CspGenderAgeTableDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GenderAgeBreakdownDto),
    __metadata("design:type", GenderAgeBreakdownDto)
], CspGenderAgeTableDto.prototype, "executives", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GenderAgeBreakdownDto),
    __metadata("design:type", GenderAgeBreakdownDto)
], CspGenderAgeTableDto.prototype, "foremen", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GenderAgeBreakdownDto),
    __metadata("design:type", GenderAgeBreakdownDto)
], CspGenderAgeTableDto.prototype, "fieldWorkers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GenderAgeBreakdownDto),
    __metadata("design:type", GenderAgeBreakdownDto)
], CspGenderAgeTableDto.prototype, "total", void 0);
class RespondentDto {
}
exports.RespondentDto = RespondentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], RespondentDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], RespondentDto.prototype, "function", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], RespondentDto.prototype, "phone1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], RespondentDto.prototype, "phone2", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], RespondentDto.prototype, "email", void 0);
class PermTempRowDto {
}
exports.PermTempRowDto = PermTempRowDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => MFTCountDto),
    __metadata("design:type", MFTCountDto)
], PermTempRowDto.prototype, "permanent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => MFTCountDto),
    __metadata("design:type", MFTCountDto)
], PermTempRowDto.prototype, "temporary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => MFTCountDto),
    __metadata("design:type", MFTCountDto)
], PermTempRowDto.prototype, "total", void 0);
class DiplomaGenderAgeRowDto {
}
exports.DiplomaGenderAgeRowDto = DiplomaGenderAgeRowDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AgeBreakdownDto),
    __metadata("design:type", AgeBreakdownDto)
], DiplomaGenderAgeRowDto.prototype, "male", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AgeBreakdownDto),
    __metadata("design:type", AgeBreakdownDto)
], DiplomaGenderAgeRowDto.prototype, "female", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AgeBreakdownDto),
    __metadata("design:type", AgeBreakdownDto)
], DiplomaGenderAgeRowDto.prototype, "total", void 0);
class DiplomaBreakdownDto {
}
exports.DiplomaBreakdownDto = DiplomaBreakdownDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "cepCepe", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "bepcCap", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "probatoire", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "bac", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "btsDut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "licence", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "maitrise", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "master", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "dqp", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "cqp", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "autres", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "sansDiplome", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaGenderAgeRowDto),
    __metadata("design:type", DiplomaGenderAgeRowDto)
], DiplomaBreakdownDto.prototype, "total", void 0);
class DisabledRecruitmentsDto {
}
exports.DisabledRecruitmentsDto = DisabledRecruitmentsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], DisabledRecruitmentsDto.prototype, "executives", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], DisabledRecruitmentsDto.prototype, "foremen", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], DisabledRecruitmentsDto.prototype, "fieldWorkers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], DisabledRecruitmentsDto.prototype, "total", void 0);
class VulnerableRecruitmentsEnterpriseDto {
}
exports.VulnerableRecruitmentsEnterpriseDto = VulnerableRecruitmentsEnterpriseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], VulnerableRecruitmentsEnterpriseDto.prototype, "internalDisplaced", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], VulnerableRecruitmentsEnterpriseDto.prototype, "refugees", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], VulnerableRecruitmentsEnterpriseDto.prototype, "orphans", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], VulnerableRecruitmentsEnterpriseDto.prototype, "total", void 0);
class VulnerableRecruitmentsCspDto {
}
exports.VulnerableRecruitmentsCspDto = VulnerableRecruitmentsCspDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], VulnerableRecruitmentsCspDto.prototype, "executives", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], VulnerableRecruitmentsCspDto.prototype, "foremen", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], VulnerableRecruitmentsCspDto.prototype, "fieldWorkers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PermTempRowDto),
    __metadata("design:type", PermTempRowDto)
], VulnerableRecruitmentsCspDto.prototype, "total", void 0);
class FirstTimeStatusDto {
}
exports.FirstTimeStatusDto = FirstTimeStatusDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GenderAgeBreakdownDto),
    __metadata("design:type", GenderAgeBreakdownDto)
], FirstTimeStatusDto.prototype, "executives", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GenderAgeBreakdownDto),
    __metadata("design:type", GenderAgeBreakdownDto)
], FirstTimeStatusDto.prototype, "foremen", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GenderAgeBreakdownDto),
    __metadata("design:type", GenderAgeBreakdownDto)
], FirstTimeStatusDto.prototype, "fieldWorkers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GenderAgeBreakdownDto),
    __metadata("design:type", GenderAgeBreakdownDto)
], FirstTimeStatusDto.prototype, "subtotal", void 0);
class FirstTimeRecruitmentsDto {
}
exports.FirstTimeRecruitmentsDto = FirstTimeRecruitmentsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => FirstTimeStatusDto),
    __metadata("design:type", FirstTimeStatusDto)
], FirstTimeRecruitmentsDto.prototype, "permanent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => FirstTimeStatusDto),
    __metadata("design:type", FirstTimeStatusDto)
], FirstTimeRecruitmentsDto.prototype, "temporary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GenderAgeBreakdownDto),
    __metadata("design:type", GenderAgeBreakdownDto)
], FirstTimeRecruitmentsDto.prototype, "total", void 0);
class DepartureRowDto {
}
exports.DepartureRowDto = DepartureRowDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DepartureRowDto.prototype, "male", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DepartureRowDto.prototype, "female", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DepartureRowDto.prototype, "total", void 0);
class DeparturesByCspDto {
}
exports.DeparturesByCspDto = DeparturesByCspDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DepartureRowDto),
    __metadata("design:type", DepartureRowDto)
], DeparturesByCspDto.prototype, "dismissals", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DepartureRowDto),
    __metadata("design:type", DepartureRowDto)
], DeparturesByCspDto.prototype, "resignations", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DepartureRowDto),
    __metadata("design:type", DepartureRowDto)
], DeparturesByCspDto.prototype, "retirements", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DepartureRowDto),
    __metadata("design:type", DepartureRowDto)
], DeparturesByCspDto.prototype, "others", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DepartureRowDto),
    __metadata("design:type", DepartureRowDto)
], DeparturesByCspDto.prototype, "ensemble", void 0);
class DeparturesTableDto {
}
exports.DeparturesTableDto = DeparturesTableDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DeparturesByCspDto),
    __metadata("design:type", DeparturesByCspDto)
], DeparturesTableDto.prototype, "executives", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DeparturesByCspDto),
    __metadata("design:type", DeparturesByCspDto)
], DeparturesTableDto.prototype, "foremen", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DeparturesByCspDto),
    __metadata("design:type", DeparturesByCspDto)
], DeparturesTableDto.prototype, "fieldWorkers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DeparturesByCspDto),
    __metadata("design:type", DeparturesByCspDto)
], DeparturesTableDto.prototype, "total", void 0);
class DismissalReasonDto {
}
exports.DismissalReasonDto = DismissalReasonDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], DismissalReasonDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DismissalReasonDto.prototype, "male", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DismissalReasonDto.prototype, "female", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DismissalReasonDto.prototype, "total", void 0);
class DismissalTechUnempDto {
}
exports.DismissalTechUnempDto = DismissalTechUnempDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => MFTCountDto),
    __metadata("design:type", MFTCountDto)
], DismissalTechUnempDto.prototype, "dismissal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => MFTCountDto),
    __metadata("design:type", MFTCountDto)
], DismissalTechUnempDto.prototype, "technicalUnemployment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => MFTCountDto),
    __metadata("design:type", MFTCountDto)
], DismissalTechUnempDto.prototype, "total", void 0);
class DismissalTechUnempTableDto {
}
exports.DismissalTechUnempTableDto = DismissalTechUnempTableDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DismissalTechUnempDto),
    __metadata("design:type", DismissalTechUnempDto)
], DismissalTechUnempTableDto.prototype, "executives", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DismissalTechUnempDto),
    __metadata("design:type", DismissalTechUnempDto)
], DismissalTechUnempTableDto.prototype, "foremen", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DismissalTechUnempDto),
    __metadata("design:type", DismissalTechUnempDto)
], DismissalTechUnempTableDto.prototype, "fieldWorkers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DismissalTechUnempDto),
    __metadata("design:type", DismissalTechUnempDto)
], DismissalTechUnempTableDto.prototype, "total", void 0);
class InternshipRowDto {
}
exports.InternshipRowDto = InternshipRowDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], InternshipRowDto.prototype, "male", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], InternshipRowDto.prototype, "female", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], InternshipRowDto.prototype, "total", void 0);
class InternshipsDto {
}
exports.InternshipsDto = InternshipsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => InternshipRowDto),
    __metadata("design:type", InternshipRowDto)
], InternshipsDto.prototype, "holiday", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => InternshipRowDto),
    __metadata("design:type", InternshipRowDto)
], InternshipsDto.prototype, "academic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => InternshipRowDto),
    __metadata("design:type", InternshipRowDto)
], InternshipsDto.prototype, "professional", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => InternshipRowDto),
    __metadata("design:type", InternshipRowDto)
], InternshipsDto.prototype, "preWork", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => InternshipRowDto),
    __metadata("design:type", InternshipRowDto)
], InternshipsDto.prototype, "total", void 0);
class SkillNeedDto {
}
exports.SkillNeedDto = SkillNeedDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], SkillNeedDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SkillNeedDto.prototype, "male", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SkillNeedDto.prototype, "female", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SkillNeedDto.prototype, "total", void 0);
class TrainingNeedDto {
}
exports.TrainingNeedDto = TrainingNeedDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], TrainingNeedDto.prototype, "domain", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], TrainingNeedDto.prototype, "male", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], TrainingNeedDto.prototype, "female", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], TrainingNeedDto.prototype, "total", void 0);
class EnterpriseIdentificationDto {
}
exports.EnterpriseIdentificationDto = EnterpriseIdentificationDto;
__decorate([
    (0, class_validator_1.IsIn)([1, 2, 3, 4]),
    __metadata("design:type", Number)
], EnterpriseIdentificationDto.prototype, "legalStatus", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], EnterpriseIdentificationDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsIn)([1, 2]),
    __metadata("design:type", Number)
], EnterpriseIdentificationDto.prototype, "area", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], EnterpriseIdentificationDto.prototype, "region", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], EnterpriseIdentificationDto.prototype, "department", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], EnterpriseIdentificationDto.prototype, "subdivision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], EnterpriseIdentificationDto.prototype, "locality", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], EnterpriseIdentificationDto.prototype, "phone1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], EnterpriseIdentificationDto.prototype, "phone2", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], EnterpriseIdentificationDto.prototype, "poBox", void 0);
__decorate([
    (0, class_validator_1.IsIn)([1, 2, 3]),
    __metadata("design:type", Number)
], EnterpriseIdentificationDto.prototype, "sector", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], EnterpriseIdentificationDto.prototype, "branch", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], EnterpriseIdentificationDto.prototype, "mainActivity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], EnterpriseIdentificationDto.prototype, "headOffice", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], EnterpriseIdentificationDto.prototype, "permanentWorkers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], EnterpriseIdentificationDto.prototype, "vacancies", void 0);
__decorate([
    (0, class_validator_1.IsIn)([1, 2, 3, 4]),
    __metadata("design:type", Number)
], EnterpriseIdentificationDto.prototype, "size", void 0);
class CooperativeIdentificationDto {
}
exports.CooperativeIdentificationDto = CooperativeIdentificationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "headOffice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1800),
    (0, class_validator_1.Max)(2100),
    __metadata("design:type", Number)
], CooperativeIdentificationDto.prototype, "yearCreated", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([1, 2]),
    __metadata("design:type", Number)
], CooperativeIdentificationDto.prototype, "area", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "region", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "department", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "subdivision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "locality", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "phone1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "phone2", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "poBox", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([1, 2, 3]),
    __metadata("design:type", Number)
], CooperativeIdentificationDto.prototype, "sector", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "branch", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "mainActivity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([1, 2, 3]),
    __metadata("design:type", Number)
], CooperativeIdentificationDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CooperativeIdentificationDto.prototype, "typeOther", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CooperativeIdentificationDto.prototype, "permanentWorkers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CooperativeIdentificationDto.prototype, "vacancies", void 0);
class CtdIdentificationDto {
}
exports.CtdIdentificationDto = CtdIdentificationDto;
__decorate([
    (0, class_validator_1.IsIn)([1, 2]),
    __metadata("design:type", Number)
], CtdIdentificationDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([1, 2]),
    __metadata("design:type", Number)
], CtdIdentificationDto.prototype, "councilType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1800),
    (0, class_validator_1.Max)(2100),
    __metadata("design:type", Number)
], CtdIdentificationDto.prototype, "yearCreated", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([1, 2]),
    __metadata("design:type", Number)
], CtdIdentificationDto.prototype, "area", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CtdIdentificationDto.prototype, "region", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CtdIdentificationDto.prototype, "department", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CtdIdentificationDto.prototype, "subdivision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CtdIdentificationDto.prototype, "locality", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CtdIdentificationDto.prototype, "phone1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CtdIdentificationDto.prototype, "phone2", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CtdIdentificationDto.prototype, "poBox", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([1, 2, 3]),
    __metadata("design:type", Number)
], CtdIdentificationDto.prototype, "sector", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], CtdIdentificationDto.prototype, "branch", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CtdIdentificationDto.prototype, "permanentWorkers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CtdIdentificationDto.prototype, "vacancies", void 0);
class OngIdentificationDto {
}
exports.OngIdentificationDto = OngIdentificationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], OngIdentificationDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], OngIdentificationDto.prototype, "headOffice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1800),
    (0, class_validator_1.Max)(2100),
    __metadata("design:type", Number)
], OngIdentificationDto.prototype, "yearCreated", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([1, 2]),
    __metadata("design:type", Number)
], OngIdentificationDto.prototype, "area", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], OngIdentificationDto.prototype, "region", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], OngIdentificationDto.prototype, "department", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], OngIdentificationDto.prototype, "subdivision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], OngIdentificationDto.prototype, "locality", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], OngIdentificationDto.prototype, "phone1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], OngIdentificationDto.prototype, "phone2", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], OngIdentificationDto.prototype, "poBox", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([1, 2, 3]),
    __metadata("design:type", Number)
], OngIdentificationDto.prototype, "sector", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], OngIdentificationDto.prototype, "branch", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, to_string_decorator_1.ToString)(),
    __metadata("design:type", String)
], OngIdentificationDto.prototype, "mainMission", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], OngIdentificationDto.prototype, "permanentWorkers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], OngIdentificationDto.prototype, "vacancies", void 0);
class SharedSectionsDto {
}
exports.SharedSectionsDto = SharedSectionsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CspGenderAgeTableDto),
    __metadata("design:type", CspGenderAgeTableDto)
], SharedSectionsDto.prototype, "jobApplications", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CspGenderAgeTableDto),
    __metadata("design:type", CspGenderAgeTableDto)
], SharedSectionsDto.prototype, "recruitmentsPermanent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CspGenderAgeTableDto),
    __metadata("design:type", CspGenderAgeTableDto)
], SharedSectionsDto.prototype, "recruitmentsTemporary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DiplomaBreakdownDto),
    __metadata("design:type", DiplomaBreakdownDto)
], SharedSectionsDto.prototype, "recruitmentsByDiploma", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DisabledRecruitmentsDto),
    __metadata("design:type", DisabledRecruitmentsDto)
], SharedSectionsDto.prototype, "disabledRecruitments", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => VulnerableRecruitmentsEnterpriseDto),
    __metadata("design:type", VulnerableRecruitmentsEnterpriseDto)
], SharedSectionsDto.prototype, "vulnerableRecruitmentsEnterprise", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => VulnerableRecruitmentsCspDto),
    __metadata("design:type", VulnerableRecruitmentsCspDto)
], SharedSectionsDto.prototype, "vulnerableRecruitmentsCsp", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CspGenderAgeTableDto),
    __metadata("design:type", CspGenderAgeTableDto)
], SharedSectionsDto.prototype, "firstTimeJobSeekers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => FirstTimeRecruitmentsDto),
    __metadata("design:type", FirstTimeRecruitmentsDto)
], SharedSectionsDto.prototype, "firstTimeRecruitments", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DeparturesTableDto),
    __metadata("design:type", DeparturesTableDto)
], SharedSectionsDto.prototype, "departures", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(3),
    (0, class_validator_1.ArrayMaxSize)(3),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DismissalReasonDto),
    __metadata("design:type", Array)
], SharedSectionsDto.prototype, "dismissalReasons", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => DismissalTechUnempTableDto),
    __metadata("design:type", DismissalTechUnempTableDto)
], SharedSectionsDto.prototype, "dismissalTechUnemployment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => InternshipsDto),
    __metadata("design:type", InternshipsDto)
], SharedSectionsDto.prototype, "internships", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(3),
    (0, class_validator_1.ArrayMaxSize)(3),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SkillNeedDto),
    __metadata("design:type", Array)
], SharedSectionsDto.prototype, "skillsNeeds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(3),
    (0, class_validator_1.ArrayMaxSize)(3),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TrainingNeedDto),
    __metadata("design:type", Array)
], SharedSectionsDto.prototype, "trainingNeeds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(2000),
    (0, class_validator_1.Max)(2100),
    __metadata("design:type", Number)
], SharedSectionsDto.prototype, "surveyYear", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(3),
    __metadata("design:type", Number)
], SharedSectionsDto.prototype, "copy", void 0);
class BaseQuestionnaireDto extends SharedSectionsDto {
}
exports.BaseQuestionnaireDto = BaseQuestionnaireDto;
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => RespondentDto),
    __metadata("design:type", RespondentDto)
], BaseQuestionnaireDto.prototype, "respondent", void 0);
class EnterpriseQuestionnaireDto extends BaseQuestionnaireDto {
    constructor() {
        super(...arguments);
        this.organizationType = 'enterprise';
    }
}
exports.EnterpriseQuestionnaireDto = EnterpriseQuestionnaireDto;
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => EnterpriseIdentificationDto),
    __metadata("design:type", EnterpriseIdentificationDto)
], EnterpriseQuestionnaireDto.prototype, "enterprise", void 0);
class CooperativeQuestionnaireDto extends BaseQuestionnaireDto {
    constructor() {
        super(...arguments);
        this.organizationType = 'cooperative';
    }
}
exports.CooperativeQuestionnaireDto = CooperativeQuestionnaireDto;
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CooperativeIdentificationDto),
    __metadata("design:type", CooperativeIdentificationDto)
], CooperativeQuestionnaireDto.prototype, "cooperative", void 0);
class CtdQuestionnaireDto extends BaseQuestionnaireDto {
    constructor() {
        super(...arguments);
        this.organizationType = 'ctd';
    }
}
exports.CtdQuestionnaireDto = CtdQuestionnaireDto;
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CtdIdentificationDto),
    __metadata("design:type", CtdIdentificationDto)
], CtdQuestionnaireDto.prototype, "ctd", void 0);
class OngQuestionnaireDto extends BaseQuestionnaireDto {
    constructor() {
        super(...arguments);
        this.organizationType = 'ong';
    }
}
exports.OngQuestionnaireDto = OngQuestionnaireDto;
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => OngIdentificationDto),
    __metadata("design:type", OngIdentificationDto)
], OngQuestionnaireDto.prototype, "ong", void 0);
//# sourceMappingURL=onefop-questionnaire.dto.js.map