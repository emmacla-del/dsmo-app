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
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
function normalizeEntityTypeForPreview(raw) {
    const map = {
        entreprise: 'enterprise',
        enterprise: 'enterprise',
        cooperative: 'cooperative',
        coopérative: 'cooperative',
        ctd: 'ctd',
        ong: 'ong',
    };
    return map[raw?.toLowerCase()?.trim()] ?? raw?.toLowerCase()?.trim() ?? '';
}
let QuestionnairesController = class QuestionnairesController {
    constructor(service, pdfService) {
        this.service = service;
        this.pdfService = pdfService;
    }
    async preview(body, res) {
        try {
            const rawData = body?.data ?? {};
            const entityType = normalizeEntityTypeForPreview(body?.entityType);
            console.log('📥 Preview request received');
            console.log('   entityType (raw):', body?.entityType);
            console.log('   entityType (normalized):', entityType);
            console.log('   data keys:', Object.keys(rawData).length);
            console.log('🔄 Step 1: Normalizing keys...');
            let normalized;
            try {
                normalized = (0, flat_key_normalizer_1.normalizeFlatKeys)(rawData, entityType);
                console.log('✅ Step 1 done — normalized keys:', Object.keys(normalized).length);
            }
            catch (e) {
                console.error('❌ Step 1 FAILED — normalizeFlatKeys threw:', e.message);
                console.error(e.stack);
                return res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                    error: 'Normalization failed', step: 1, message: e.message,
                });
            }
            const relevantKeys = Object.keys(normalized)
                .filter(k => k.startsWith('s3q02') || k.startsWith('s4q02') || k.startsWith('s4q03'));
            console.log('🔑 Reasons/Skills/Training keys:', JSON.stringify(relevantKeys));
            if (process.env.NODE_ENV !== 'production') {
                (0, pdf_data_mapper_service_1.diagnoseMappingKeys)(normalized);
            }
            console.log('🔄 Step 2: Mapping data for entityType:', entityType);
            let mappedData;
            try {
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
                        console.error(`❌ Unknown entityType after normalization: "${entityType}"`);
                        return res.status(common_1.HttpStatus.BAD_REQUEST).json({
                            error: `Invalid entity type: "${body?.entityType}" (normalized: "${entityType}")`,
                        });
                }
                console.log('✅ Step 2 done — mapped keys:', Object.keys(mappedData).length);
            }
            catch (e) {
                console.error('❌ Step 2 FAILED — data mapping threw:', e.message);
                console.error(e.stack);
                return res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                    error: 'Data mapping failed', step: 2, message: e.message,
                });
            }
            console.log('🔄 Step 3: Generating PDF...');
            let pdfBuffer;
            try {
                pdfBuffer = await this.pdfService.generate({
                    ...mappedData,
                    formType: entityType,
                });
                console.log(`✅ Step 3 done — PDF size: ${pdfBuffer.length} bytes`);
            }
            catch (e) {
                console.error('❌ Step 3 FAILED — PDF generation threw:', e.message);
                console.error('   Full stack:', e.stack);
                if (e.message?.includes('Could not find Chrome')) {
                    console.error('💡 Hint: Chrome/Chromium not found — set PUPPETEER_EXECUTABLE_PATH');
                }
                if (e.message?.includes('Failed to launch')) {
                    console.error('💡 Hint: Browser failed to launch — check sandbox args');
                }
                return res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                    error: 'PDF generation failed', step: 3, message: e.message,
                });
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
            res.setHeader('Content-Length', pdfBuffer.length);
            res.send(pdfBuffer);
        }
        catch (err) {
            const error = err;
            console.error('❌ Unhandled preview error:', error.message);
            console.error('   Stack:', error.stack);
            res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to generate preview',
                message: error.message,
            });
        }
    }
    async submit(dto, req) {
        console.log('📥 Submit request received');
        console.log('   userId:', req.user?.id);
        console.log('   entityType:', dto?.entityType);
        console.log('   isDraft:', dto?.isDraft);
        console.log('   data keys:', dto?.data ? Object.keys(dto.data).length : 0);
        try {
            const result = await this.service.submitQuestionnaire({
                ...dto,
                userId: req.user.id,
            });
            console.log('✅ Submit successful:', result);
            return result;
        }
        catch (e) {
            console.error('❌ Submit FAILED:', e.message);
            console.error('   Stack:', e.stack);
            throw e;
        }
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
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        transform: false,
        skipMissingProperties: true,
        skipUndefinedProperties: true,
        skipNullProperties: true,
        whitelist: false,
        forbidNonWhitelisted: false,
    })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], QuestionnairesController.prototype, "submit", null);
exports.QuestionnairesController = QuestionnairesController = __decorate([
    (0, common_1.Controller)('onefop'),
    __metadata("design:paramtypes", [questionnaires_service_1.QuestionnairesService,
        onefop_puppeteer_service_1.OnefopPuppeteerService])
], QuestionnairesController);
//# sourceMappingURL=questionnaires.controller.js.map