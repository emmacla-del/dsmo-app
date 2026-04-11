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
import { ServiceCategory, UserRole, PositionType } from '@prisma/client';
import { CreateServiceDto, UpdateServiceDto, CreatePositionDto, UpdatePositionDto } from './dto';

@Controller('minefop-services')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MinefopServicesController {
    constructor(private readonly svc: MinefopServicesService) { }

    // ==================== QUERY ENDPOINTS (public — used during registration) ====================

    /** GET /minefop-services
     *  Returns the full flat list, optionally filtered by category.
     *  @query category - DECONCENTRE | CENTRALE | RATTACHE (optional)
     */
    @Get()
    async findAll(
        @Query('category', new ParseEnumPipe(ServiceCategory, { optional: true }))
        category?: ServiceCategory
    ) {
        return this.svc.findAll(category);
    }

    /** GET /minefop-services/tree
     *  Returns the full nested tree structure.
     *  @query category - DECONCENTRE | CENTRALE | RATTACHE (optional)
     */
    @Get('tree')
    async getTree(
        @Query('category', new ParseEnumPipe(ServiceCategory, { optional: true }))
        category?: ServiceCategory
    ) {
        return this.svc.getTree(category);
    }

    /** GET /minefop-services/roots
     *  Returns top-level services (level = 1).
     *  @query category - DECONCENTRE | CENTRALE | RATTACHE (optional)
     */
    @Get('roots')
    async getRoots(
        @Query('category', new ParseEnumPipe(ServiceCategory, { optional: true }))
        category?: ServiceCategory
    ) {
        return this.svc.getRoots(category);
    }

    /** GET /minefop-services/children
     *  Returns direct children of a given service code.
     *  @query parentCode - The service code to get children for
     */
    @Get('children')
    async getChildren(@Query('parentCode') parentCode: string) {
        if (!parentCode) {
            throw new BadRequestException('parentCode query parameter is required');
        }
        return this.svc.getChildren(parentCode);
    }

    /** GET /minefop-services/code/:code
     *  Get a single service by its unique code with its children and positions
     */
    @Get('code/:code')
    async getByCode(@Param('code') code: string) {
        return this.svc.getServiceByCode(code);
    }

    /** GET /minefop-services/:id
     *  Get a single service by its UUID
     */
    @Get(':id')
    async getById(@Param('id', ParseUUIDPipe) id: string) {
        return this.svc.getServiceById(id);
    }

    /** GET /minefop-services/:code/positions
     *  Get all positions for a specific service
     */
    @Get(':code/positions')
    async getPositions(@Param('code') code: string) {
        return this.svc.getPositionsByService(code);
    }

    /** GET /minefop-services/role/:role
     *  Get services by role mapping (CENTRAL, REGIONAL, DIVISIONAL, COMPANY)
     *  @param role - UserRole enum value
     */
    @Get('role/:role')
    async getByRole(
        @Param('role', new ParseEnumPipe(UserRole))
        role: UserRole
    ) {
        return this.svc.getServicesByRole(role);
    }

    /** GET /minefop-services/region-required
     *  Get services that require region selection (for regional delegations)
     */
    @Get('region-required/list')
    async getRegionRequiredServices() {
        return this.svc.getServicesByRegion();
    }

    /** GET /minefop-services/:code/hierarchy-path
     *  Get the full breadcrumb path from root to the specified service
     */
    @Get(':code/hierarchy-path')
    async getHierarchyPath(@Param('code') code: string) {
        return this.svc.getServiceHierarchyPath(code);
    }

    /** GET /minefop-services/stats/summary
     *  Get statistics about services (counts by category, level, etc.)
     */
    @Get('stats/summary')
    async getStats() {
        return this.svc.getServiceStats();
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

    /** DELETE /minefop-services/:code
     *  Soft delete a service (set isActive to false)
     */
    @Delete(':code')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteService(@Param('code') code: string) {
        await this.svc.deleteService(code);
    }

    /** DELETE /minefop-services/:code/hard
     *  Permanently delete a service (use with caution!)
     */
    @Delete(':code/hard')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async hardDeleteService(@Param('code') code: string) {
        await this.svc.hardDeleteService(code);
    }

    // ==================== POSITION ENDPOINTS (require JWT) ====================

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
}