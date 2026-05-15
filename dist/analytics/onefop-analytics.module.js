"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnefopAnalyticsModule = void 0;
const common_1 = require("@nestjs/common");
const onefop_analytics_controller_1 = require("./onefop-analytics.controller");
const onefop_analytics_service_1 = require("./onefop-analytics.service");
let OnefopAnalyticsModule = class OnefopAnalyticsModule {
};
exports.OnefopAnalyticsModule = OnefopAnalyticsModule;
exports.OnefopAnalyticsModule = OnefopAnalyticsModule = __decorate([
    (0, common_1.Module)({
        controllers: [onefop_analytics_controller_1.OnefopAnalyticsController],
        providers: [onefop_analytics_service_1.OnefopAnalyticsService],
    })
], OnefopAnalyticsModule);
//# sourceMappingURL=onefop-analytics.module.js.map