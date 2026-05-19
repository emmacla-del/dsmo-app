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
exports.OnefopPdfController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const onefop_puppeteer_service_1 = require("../pdf/onefop-puppeteer.service");
let OnefopPdfController = class OnefopPdfController {
    constructor(pdfService) {
        this.pdfService = pdfService;
    }
    async generatePdf(dto, res) {
        try {
            console.log('📨 Generating PDF for:', {
                formType: dto.formType,
                surveyYear: dto.surveyYear,
            });
            const pdfBuffer = await this.pdfService.generate(dto);
            const filename = `onefop_${dto.formType}_${dto.surveyYear || new Date().getFullYear()}_${Date.now()}.pdf`;
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBuffer.length,
            });
            res.end(pdfBuffer);
        }
        catch (error) {
            console.error('❌ PDF generation failed:', error);
            res.status(500).json({
                message: 'Failed to generate PDF',
                error: error?.message || 'Unknown error'
            });
        }
    }
};
exports.OnefopPdfController = OnefopPdfController;
__decorate([
    (0, common_1.Post)('generate-pdf'),
    (0, roles_decorator_1.Roles)('COMPANY', 'CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OnefopPdfController.prototype, "generatePdf", null);
exports.OnefopPdfController = OnefopPdfController = __decorate([
    (0, common_1.Controller)('onefop'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [onefop_puppeteer_service_1.OnefopPuppeteerService])
], OnefopPdfController);
//# sourceMappingURL=pdf.controller.js.map