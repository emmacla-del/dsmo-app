"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const auth_module_1 = require("./auth/auth.module");
const dsmo_module_1 = require("./dsmo/dsmo.module");
const prisma_module_1 = require("./prisma/prisma.module");
const locations_module_1 = require("./locations/locations.module");
const sectors_module_1 = require("./sectors/sectors.module");
const minefop_services_module_1 = require("./minefop-services/minefop-services.module");
const questionnaires_module_1 = require("./questionnaires/questionnaires.module");
const onefop_analytics_module_1 = require("./analytics/onefop-analytics.module");
const pdf_module_1 = require("./pdf/pdf.module");
const analytics_module_1 = require("./analytics/analytics.module");
const onefop_module_1 = require("./onefop/onefop.module");
const campaign_module_1 = require("./campaign/campaign.module");
const report_module_1 = require("./report/report.module");
const data_management_module_1 = require("./data-management/data-management.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            auth_module_1.AuthModule,
            dsmo_module_1.DsmoModule,
            prisma_module_1.PrismaModule,
            locations_module_1.LocationsModule,
            sectors_module_1.SectorsModule,
            minefop_services_module_1.MinefopServicesModule,
            questionnaires_module_1.QuestionnairesModule,
            onefop_analytics_module_1.OnefopAnalyticsModule,
            pdf_module_1.PdfModule,
            analytics_module_1.AnalyticsModule,
            onefop_module_1.OnefopModule,
            campaign_module_1.CampaignModule,
            report_module_1.ReportModule,
            data_management_module_1.DataManagementModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map