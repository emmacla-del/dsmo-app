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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionnairesController = void 0;
const common_1 = require("@nestjs/common");
const questionnaires_service_1 = require("./questionnaires.service");
const onefop_puppeteer_service_1 = require("../pdf/onefop-puppeteer.service");
const pdf_data_mapper_service_1 = require("../services/pdf-data-mapper.service");
const flat_key_normalizer_1 = require("../common/normalizers/flat-key-normalizer");
let QuestionnairesController = class QuestionnairesController {
    constructor(service, pdfService) {
        this.service = service;
        this.pdfService = pdfService;
    }
    async preview(body, res) {
        try {
            const rawData = body?.data ?? {};
            const entityType = body?.entityType ?? '';
            console.log('📥 Preview request received');
            console.log('   entityType:', entityType);
            console.log('   data keys:', Object.keys(rawData).length);
            const normalized = (0, flat_key_normalizer_1.normalizeFlatKeys)(rawData, entityType);
            const relevantKeys = Object.keys(normalized)
                .filter(k => k.startsWith('s3q02') || k.startsWith('s4q02') || k.startsWith('s4q03'));
            console.log('🔑 Reasons/Skills/Training keys:', JSON.stringify(relevantKeys));
            console.log('📦 Full normalized payload keys count:', Object.keys(normalized).length);
            if (process.env.NODE_ENV !== 'production') {
                (0, pdf_data_mapper_service_1.diagnoseMappingKeys)(normalized);
            }
            let mappedData;
            switch (entityType) {
                case 'enterprise':
                    mappedData = (0, pdf_data_mapper_service_1.mapEnterpriseData)(normalized);
                    break;
                case 'cooperative':
                    mappedData = (0, pdf_data_mapper_service_1.mapCooperativeData)(normalized);
                    break;
                case 'ctd':
                    mappedData = (0, pdf_data_mapper_service_1.mapCtdData)(normalized);
                    break;
                case 'ong':
                    mappedData = (0, pdf_data_mapper_service_1.mapOngData)(normalized);
                    break;
                default:
                    return res
                        .status(common_1.HttpStatus.BAD_REQUEST)
                        .json({ error: `Invalid entity type: "${entityType}"` });
            }
            if (process.env.NODE_ENV !== 'production') {
                console.log('🔍 Mapped data sample:', JSON.stringify(mappedData, null, 2).substring(0, 500));
            }
            console.log('📄 Generating PDF...');
            const pdfBuffer = await this.pdfService.generate({
                ...mappedData,
                formType: entityType,
            });
            console.log(`✅ PDF generated (${pdfBuffer.length} bytes)`);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
            res.setHeader('Content-Length', pdfBuffer.length);
            res.send(pdfBuffer);
        }
        catch (err) {
            const error = err;
            console.error('❌ Preview error:', error.message);
            console.error('   Stack:', error.stack);
            res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to generate preview',
                message: error.message,
            });
        }
    }
    async submit(dto) {
        return this.service.submitQuestionnaire(dto);
    }
};
exports.QuestionnairesController = QuestionnairesController;
__decorate([
    (0, common_1.Post)('preview'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        transform: false,
        skipMissingProperties: true,
        skipUndefinedProperties: true,
        skipNullProperties: true,
        whitelist: false,
        forbidNonWhitelisted: false,
    })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], QuestionnairesController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)('submit'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        transform: false,
        skipMissingProperties: true,
        skipUndefinedProperties: true,
        skipNullProperties: true,
        whitelist: false,
        forbidNonWhitelisted: false,
    })),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QuestionnairesController.prototype, "submit", null);
exports.QuestionnairesController = QuestionnairesController = __decorate([
    (0, common_1.Controller)('onefop'),
    __metadata("design:paramtypes", [questionnaires_service_1.QuestionnairesService,
        onefop_puppeteer_service_1.OnefopPuppeteerService])
], QuestionnairesController);
//# sourceMappingURL=questionnaires.controller.js.map