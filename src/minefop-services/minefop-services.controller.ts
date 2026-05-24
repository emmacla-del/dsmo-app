// src/minefop-services/minefop-services.controller.ts
import {
    Controller,
    Get,
    Query,
    UseGuards,
    Param,
    ParseUUIDPipe,
    ParseEnumPipe,
    Post,
    Put,
    Delete,
    Body,
    ValidationPipe,
    UsePipes,
    HttpCode,
    HttpStatus,
    Patch,
    BadRequestException
} from '@nestjs/common';
import { MinefopServicesService } from './minefop-services.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { $Enums, UserRole } from '@prisma/client';
import { CreateServiceDto, UpdateServiceDto, CreatePositionDto, UpdatePositionDto } from './dto';

@Controller('minefop-services')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MinefopServicesController {
    constructor(private readonly svc: MinefopServicesService) { }

    // ==================== STATIC / FIXED-PATH ENDPOINTS (must come first) ====================

    /** GET /minefop-services
     *  Returns the full flat list, optionally filtered by category.
     */
    @Get()
    async findAll(
        @Query('category', new ParseEnumPipe($Enums.ServiceCategory, { optional: true }))
        category?: $Enums.ServiceCategory
    ) {
        return this.svc.findAll(category);
    }

    /** GET /minefop-services/tree
     *  Returns the full nested tree structure.
     */
    @Get('tree')
    async getTree(
        @Query('category', new ParseEnumPipe($Enums.ServiceCategory, { optional: true }))
        category?: $Enums.ServiceCategory
    ) {
        return this.svc.getTree(category);
    }

    /** GET /minefop-services/roots
     *  Returns top-level services (level = 1).
     */
    @Get('roots')
    async getRoots(
        @Query('category', new ParseEnumPipe($Enums.ServiceCategory, { optional: true }))
        category?: $Enums.ServiceCategory
    ) {
        return this.svc.getRoots(category);
    }

    /** GET /minefop-services/children
     *  Returns direct children of a given service code (without position filter).
     */
    @Get('children')
    async getChildren(@Query('parentCode') parentCode: string) {
        if (!parentCode) {
            throw new BadRequestException('parentCode query parameter is required');
        }
        return this.svc.getChildren(parentCode);
    }

    /** GET /minefop-services/stats/summary
     *  Get statistics about services (counts by category, level, etc.)
     */
    @Get('stats/summary')
    async getStats() {
        return this.svc.getServiceStats();
    }

    /** GET /minefop-services/region-required/list
     *  Get services that require region selection
     */
    @Get('region-required/list')
    async getRegionRequiredServices() {
        return this.svc.getServicesByRegion();
    }

    // ==================== CASCADE ENDPOINTS (for MINEFOP registration) ====================

    /** GET /minefop-services/positions/by-role
     *  Returns all position types (job titles) available for a given MINEFOP role
     *  (CENTRAL, REGIONAL, DIVISIONAL). This drives the first dropdown.
     */
    @Get('positions/by-role')
    async getPositionTypesByRole(
        @Query('role', new ParseEnumPipe(UserRole)) role: UserRole
    ) {
        return this.svc.getAvailablePositionTypesByRole(role);
    }

    /** GET /minefop-services/parents-for-position
     *  Returns a tree (or flat list) of parent services that have at least one child
     *  with the given positionType, and whose roleMapping matches the user's role.
     */
    @Get('parents-for-position')
    async getParentServicesForPosition(
        @Query('positionType') positionType: string,
        @Query('role', new ParseEnumPipe(UserRole)) role: UserRole
    ) {
        if (!positionType) {
            throw new BadRequestException('positionType query parameter is required');
        }
        return this.svc.getParentServicesForPosition(positionType, role);
    }

    /** GET /minefop-services/children-for-position
     *  Returns child services under a given parent code that actually have the
     *  specified positionType (e.g. for CHEF_CELLULE under a Division).
     */
    @Get('children-for-position')
    async getChildServicesForPosition(
        @Query('parentCode') parentCode: string,
        @Query('positionType') positionType: string
    ) {
        if (!parentCode || !positionType) {
            throw new BadRequestException('parentCode and positionType are required');
        }
        return this.svc.getChildServicesForPosition(parentCode, positionType);
    }

    /**
     * GET /minefop-services/resolve-position?serviceCode=X
     *
     * Single-call draft restoration endpoint.
     * Given a serviceCode (the exact unit where the user serves), returns:
     *   - parentCode   → the direct parent's code (for fast-path A in the Flutter widget)
     *   - serviceUnit  → full service unit details including positionTitle
     *
     * The Flutter widget uses this on back-navigation to restore a previously
     * saved selection in ONE network call instead of scanning all parent units.
     *
     * Response shape:
     * {
     *   parentCode: string,
     *   serviceUnit: {
     *     code, name, nameEn, acronym, level, category,
     *     displayName, positionTitle
     *   }
     * }
     */
    @Get('resolve-position')
    async resolvePosition(@Query('serviceCode') serviceCode: string) {
        if (!serviceCode) {
            throw new BadRequestException('serviceCode query parameter is required');
        }
        return this.svc.resolvePosition(serviceCode);
    }

    // ==================== MUTATION ENDPOINTS (require JWT) ====================

    /** POST /minefop-services
     *  Create a new service
     */
    @Post()
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.CREATED)
    async createService(@Body() createServiceDto: CreateServiceDto) {
        return this.svc.createService(createServiceDto);
    }

    /** POST /minefop-services/positions
     *  Create a new position for a service
     */
    @Post('positions')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.CREATED)
    async createPosition(@Body() createPositionDto: CreatePositionDto) {
        return this.svc.createPosition(createPositionDto);
    }

    /** PATCH /minefop-services/positions/:id
     *  Update an existing position
     */
    @Patch('positions/:id')
    @UseGuards(JwtAuthGuard)
    async updatePosition(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updatePositionDto: UpdatePositionDto
    ) {
        return this.svc.updatePosition(id, updatePositionDto);
    }

    /** DELETE /minefop-services/positions/:id
     *  Soft delete a position (set isActive to false)
     */
    @Delete('positions/:id')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async deletePosition(@Param('id', ParseUUIDPipe) id: string) {
        await this.svc.deletePosition(id);
    }

    // ==================== PARAMETERISED ENDPOINTS (order matters!) ====================

    /** GET /minefop-services/code/:code
     *  Get a single service by its unique code with its children and positions
     */
    @Get('code/:code')
    async getByCode(@Param('code') code: string) {
        return this.svc.getServiceByCode(code);
    }

    /** GET /minefop-services/role/:role
     *  Get services by role mapping
     */
    @Get('role/:role')
    async getByRole(
        @Param('role', new ParseEnumPipe($Enums.UserRole))
        role: $Enums.UserRole
    ) {
        return this.svc.getServicesByRole(role);
    }

    /** GET /minefop-services/:code/positions
     *  Get all positions for a specific service
     */
    @Get(':code/positions')
    async getPositions(@Param('code') code: string) {
        return this.svc.getPositionsByService(code);
    }

    /** GET /minefop-services/:code/hierarchy-path
     *  Get the full breadcrumb path from root to the specified service
     */
    @Get(':code/hierarchy-path')
    async getHierarchyPath(@Param('code') code: string) {
        return this.svc.getServiceHierarchyPath(code);
    }

    /** PATCH /minefop-services/:code
     *  Update an existing service
     */
    @Patch(':code')
    @UseGuards(JwtAuthGuard)
    async updateService(
        @Param('code') code: string,
        @Body() updateServiceDto: UpdateServiceDto
    ) {
        return this.svc.updateService(code, updateServiceDto);
    }

    /** DELETE /minefop-services/:code/hard
     *  Permanently delete a service
     */
    @Delete(':code/hard')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async hardDeleteService(@Param('code') code: string) {
        await this.svc.hardDeleteService(code);
    }

    /** DELETE /minefop-services/:code
     *  Soft delete a service (set isActive to false)
     */
    @Delete(':code')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteService(@Param('code') code: string) {
        await this.svc.deleteService(code);
    }

    /** GET /minefop-services/:id
     *  Get a single service by its UUID
     */
    @Get(':id')
    async getById(@Param('id', ParseUUIDPipe) id: string) {
        return this.svc.getServiceById(id);
    }
}