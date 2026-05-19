"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionnairesModule = void 0;
const common_1 = require("@nestjs/common");
const questionnaires_controller_1 = require("./questionnaires.controller");
const admin_questionnaires_controller_1 = require("./admin-questionnaires.controller");
const questionnaires_service_1 = require("./questionnaires.service");
const onefop_puppeteer_service_1 = require("../pdf/onefop-puppeteer.service");
let QuestionnairesModule = class QuestionnairesModule {
};
exports.QuestionnairesModule = QuestionnairesModule;
exports.QuestionnairesModule = QuestionnairesModule = __decorate([
    (0, common_1.Module)({
        controllers: [questionnaires_controller_1.QuestionnairesController, admin_questionnaires_controller_1.AdminQuestionnairesController],
        providers: [
            questionnaires_service_1.QuestionnairesService,
            onefop_puppeteer_service_1.OnefopPuppeteerService,
        ],
        exports: [questionnaires_service_1.QuestionnairesService],
    })
], QuestionnairesModule);
//# sourceMappingURL=questionnaires.module.js.map