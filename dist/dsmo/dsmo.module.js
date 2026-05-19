"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DsmoModule = void 0;
const common_1 = require("@nestjs/common");
const dsmo_controller_1 = require("./dsmo.controller");
const dsmo_service_1 = require("./dsmo.service");
const pdf_service_1 = require("./pdf.service");
const validation_service_1 = require("./validation.service");
const audit_service_1 = require("./audit.service");
const notification_service_1 = require("./notification.service");
let DsmoModule = class DsmoModule {
};
exports.DsmoModule = DsmoModule;
exports.DsmoModule = DsmoModule = __decorate([
    (0, common_1.Module)({
        controllers: [dsmo_controller_1.DsmoController],
        providers: [dsmo_service_1.DsmoService, pdf_service_1.PdfService, validation_service_1.ValidationService, audit_service_1.AuditService, notification_service_1.NotificationService],
        exports: [dsmo_service_1.DsmoService, validation_service_1.ValidationService, audit_service_1.AuditService, notification_service_1.NotificationService],
    })
], DsmoModule);
//# sourceMappingURL=dsmo.module.js.map