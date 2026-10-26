// src/dsmo/dsmo.service.ts
import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateCompanyDto } from './dto/create-company.dto';
import { SubmitDeclarationDto } from './dto/submit-declaration.dto';
import { UserRole, DeclarationStatus, MovementType, UserStatus } from '../types/prisma.types';
import { ValidationService } from './validation.service';
import { AuditService } from './audit.service';
import { PdfService, PdfData } from './pdf.service';
import { resolveAndValidateTerritory } from '../territory/territory-resolver';
import { IgnoredIdentityChange, lockCompanyIdentity } from './company-territory-lock';
import { Territory, territoryWhere } from '../auth/territory';
import { formatDoualaDateFr } from '../common/utils/douala-date';

const REGISTRATION_PERIOD_MIN_YEAR = 2000;
const DOUALA_YEAR_FORMATTER = new Intl.DateTimeFormat('en', {
  timeZone: 'Africa/Douala',
  year: 'numeric',
});

function doualaRegistrationPeriodBounds(
  year: number,
  semester?: 1 | 2,
  quarter?: 1 | 2 | 3 | 4,
): { gte: Date; lt: Date } {
  const firstQuarter = quarter ?? (semester === 1 ? 1 : semester === 2 ? 3 : 1);
  const lastQuarter = quarter ?? (semester === 1 ? 2 : semester === 2 ? 4 : 4);
  const startMonth = (firstQuarter - 1) * 3 + 1;
  const endMonth = lastQuarter * 3 + 1;
  const endYear = endMonth > 12 ? year + 1 : year;
  const normalizedEndMonth = endMonth > 12 ? endMonth - 12 : endMonth;
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01T00:00:00+01:00`;
  const end = `${endYear}-${String(normalizedEndMonth).padStart(2, '0')}-01T00:00:00+01:00`;
  return { gte: new Date(start), lt: new Date(end) };
}

@Injectable()
export class DsmoService {
  constructor(
    private prisma: PrismaService,
    private validationService: ValidationService,
    private auditService: AuditService,
    private pdfService: PdfService,
  ) { }

  /**
   * Looks up the MINEFOP processing service for a company declaration.
   * Companies are handled at the DDEFOP (departmental) level.
   * Returns the service info for the PDF header, with its parent (DREFOP) if available.
   */
  private async resolveProcessingService(): Promise<PdfData['processingService']> {
    try {
      const svc = await this.prisma.minefopService.findUnique({
        where: { code: 'DDEFOP' },
      });
      if (!svc) return undefined;

      let parent: typeof svc | null = null;
      if (svc.parentCode) {
        parent = await this.prisma.minefopService.findUnique({ where: { code: svc.parentCode } });
      }

      return {
        name: svc.name,
        nameEn: svc.nameEn,
        acronym: svc.acronym,
        parentName: parent?.name ?? null,
        parentNameEn: parent?.nameEn ?? null,
        parentAcronym: parent?.acronym ?? null,
      };
    } catch {
      return undefined; // non-fatal — PDF falls back to static labels
    }
  }

  private async generateTrackingNumber(year: number): Promise<string> {
    const count = await this.prisma.declaration.count({
      where: { year, status: { not: DeclarationStatus.DRAFT } },
    });
    const seq = String(count + 1).padStart(7, '0');
    return `DSMO-${year}-${seq}`;
  }

  // ✅ UPDATED: getMyCompany with establishmentId fields
  async getMyCompany(userId: string) {
    const company = await this.prisma.company.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        taxNumber: true,
        cnpsNumber: true,
        registrationNumber: true,
        establishmentId: true,
        establishmentIdGeneratedAt: true,
        entityType: true,
        region: true,
        department: true,
        subdivision: true,
        address: true,
        phone: true,
        phone2: true,
        poBox: true,
        mainActivity: true,
        secondaryActivity: true,
        parentCompany: true,
        legalStatus: true,
        enterpriseSize: true,
        area: true,
        branch: true,
        respondentFirstName: true,
        respondentLastName: true,
        respondentFunction: true,
        respondentPhone: true,
        respondentPhone2: true,
        totalEmployees: true,
        menCount: true,
        womenCount: true,
        // Vocational Training (VT) registration-time identification —
        // needed so the Flutter ONEFOP questionnaire prefill
        // (_companyToInitialData's vocationalTraining case) actually
        // receives these values instead of silently rendering blank.
        yearOfCreation: true,
        sigle: true,
        cfpType: true,
        educationSystem: true,
        functionalStatus: true,
        authorizationStatus: true,
        authorizationYear: true,
        authorizationOrderNumber: true,
        authorizationOrderDate: true,
        nonFunctionalReason: true,
        nonFunctionalReasonOther: true,
        promoterName: true,
        promoterSex: true,
        promoterPhone1: true,
        promoterPhone2: true,
        // Entity-specific registration fields
        cooperativeType: true,
        ctdType: true,
        projectNature: true,
        mainMission: true,
        socialCapital: true,
        fax: true,
        sectorId: true,
        // The registered branch's sector (Primary/Secondary/Tertiary/Public),
        // which pre-fills the form's « Secteur d'activité ».
        sector: { select: { category: true } },
        trainingDomains: true,
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            positionTitle: true,
          },
        },
      }
    });
    return company;
  }

  /**
   * Total establishment counts by registration account status, scoped to
   * territory.
   *
   * The buckets partition the repertory. Company.userId is required and
   * unique, so every establishment has exactly one account, lands in exactly
   * one bucket, and `active + pendingValidation + rejected + suspended`
   * equals `total`. Mapping of UserStatus (x user.isActive):
   *
   *   active             ACTIVE, isActive true
   *   suspended          ACTIVE, isActive false  (account deactivated)
   *   rejected           REJECTED
   *   pendingValidation  PENDING_APPROVAL, UNDER_REVIEW, COMPLEMENTS_REQUESTED,
   *                      DOCUMENTS_INCOMPLETE, DRAFT
   *
   * `isActive` is only read for ACTIVE accounts: a rejected or still-pending
   * registration is reported by the stage it has reached, not as a suspension.
   * DRAFT is a registration that was never submitted; it is grouped with the
   * pending stages because the response shape has no bucket of its own, and it
   * is the one label that is an imperfect fit.
   *
   * The previous bucketing counted a deactivated REJECTED account twice (once
   * as `rejected`, once as `suspended`) and gave an active UNDER_REVIEW, DRAFT
   * or DOCUMENTS_INCOMPLETE account no bucket at all, so the tiles never added
   * up to the total.
   */
  async getCompanyStats(territory?: Territory) {
    const where: any = territoryWhere(territory);
    const pendingStatuses = [
      UserStatus.PENDING_APPROVAL,
      UserStatus.UNDER_REVIEW,
      UserStatus.COMPLEMENTS_REQUESTED,
      UserStatus.DOCUMENTS_INCOMPLETE,
      UserStatus.DRAFT,
    ];
    const [total, active, suspended, pendingValidation, rejected] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.count({
        where: {
          ...where,
          user: { status: UserStatus.ACTIVE, isActive: true },
        },
      }),
      this.prisma.company.count({
        where: {
          ...where,
          user: { status: UserStatus.ACTIVE, isActive: false },
        },
      }),
      this.prisma.company.count({
        where: {
          ...where,
          user: { status: { in: pendingStatuses } },
        },
      }),
      this.prisma.company.count({
        where: {
          ...where,
          user: { status: UserStatus.REJECTED },
        },
      }),
    ]);
    return {
      total,
      active,
      pendingValidation,
      rejected,
      suspended,
    };
  }

  /** Registration activity by day for the past year, scoped to the acting admin. */
  async getCompanyRegistrationTrend(territory?: Territory) {
    const now = new Date();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    const firstDay = new Date(`${today}T12:00:00Z`);
    firstDay.setUTCDate(firstDay.getUTCDate() - 364);
    const firstDayKey = firstDay.toISOString().slice(0, 10);
    const role = territory?.role;
    const nationalRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN_ONEFOP,
      UserRole.ADMIN_ONEFOP_REGISTRATIONS,
      UserRole.ADMIN_ONEFOP_SUBMISSIONS,
      UserRole.CENTRAL_AGENT,
    ];
    let scope = Prisma.empty;

    if (role === UserRole.REGIONAL_ADMIN) {
      if (territory?.regionId) scope = Prisma.sql`AND c."regionId" = ${territory.regionId}`;
      else if (territory?.region?.trim()) scope = Prisma.sql`AND LOWER(c."region") = LOWER(${territory.region.trim()})`;
      else scope = Prisma.sql`AND 1 = 0`;
    } else if (role === UserRole.DIVISIONAL_ADMIN) {
      if (territory?.departmentId) scope = Prisma.sql`AND c."departmentId" = ${territory.departmentId}`;
      else if (territory?.region?.trim() && territory?.department?.trim()) {
        scope = Prisma.sql`AND LOWER(c."region") = LOWER(${territory.region.trim()}) AND LOWER(c."department") = LOWER(${territory.department.trim()})`;
      } else scope = Prisma.sql`AND 1 = 0`;
    } else if (!nationalRoles.includes(role as UserRole)) {
      scope = Prisma.sql`AND 1 = 0`;
    }

    const rows = await this.prisma.$queryRaw<Array<{
      date: string;
      submitted: bigint;
      approved: bigint;
      correctionRequested: bigint;
    }>>(Prisma.sql`
      WITH calendar AS (
        SELECT generate_series(${firstDayKey}::date, ${today}::date, interval '1 day')::date AS day
      ), submitted AS (
        SELECT ((c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Douala')::date AS day, COUNT(*) AS count
        FROM "companies" c
        WHERE ((c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Douala')::date >= ${firstDayKey}::date
          AND ((c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Douala')::date <= ${today}::date
          ${scope}
        GROUP BY 1
      ), approved AS (
        SELECT ((u."approvedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Douala')::date AS day, COUNT(*) AS count
        FROM "users" u
        JOIN "companies" c ON c."userId" = u.id
        WHERE u.role = 'COMPANY'
          AND u."approvedAt" IS NOT NULL
          AND ((u."approvedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Douala')::date >= ${firstDayKey}::date
          AND ((u."approvedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Douala')::date <= ${today}::date
          ${scope}
        GROUP BY 1
      ), correction_requested AS (
        SELECT ((a."timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Douala')::date AS day, COUNT(*) AS count
        FROM "audit_logs" a
        JOIN "companies" c ON c."userId" = a."resourceId"
        WHERE a."resourceType" = 'User'
          AND a.action = 'COMPANY_REGISTRATION_COMPLEMENTS_REQUESTED'
          AND ((a."timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Douala')::date >= ${firstDayKey}::date
          AND ((a."timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Douala')::date <= ${today}::date
          ${scope}
        GROUP BY 1
      )
      SELECT to_char(calendar.day, 'YYYY-MM-DD') AS date,
        COALESCE(submitted.count, 0) AS submitted,
        COALESCE(approved.count, 0) AS approved,
        COALESCE(correction_requested.count, 0) AS "correctionRequested"
      FROM calendar
      LEFT JOIN submitted ON submitted.day = calendar.day
      LEFT JOIN approved ON approved.day = calendar.day
      LEFT JOIN correction_requested ON correction_requested.day = calendar.day
      ORDER BY calendar.day ASC
    `);

    const days = rows.map((row) => ({
      date: row.date,
      submitted: Number(row.submitted),
      approved: Number(row.approved),
      correctionRequested: Number(row.correctionRequested),
    }));
    const monthly = new Map<string, number>();
    for (const day of days) {
      const month = day.date.slice(0, 7);
      monthly.set(month, (monthly.get(month) ?? 0) + day.submitted);
    }

    // Keep the established monthly field for any existing dashboard client.
    const todayDate = new Date(`${today}T12:00:00Z`);
    const firstMonth = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() - 11, 1));
    const months: Array<{ month: string; count: number }> = [];
    for (let offset = 0; offset < 12; offset += 1) {
      const date = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + offset, 1));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      months.push({ month: key, count: monthly.get(key) ?? 0 });
    }
    return { months, days };
  }

  /** Admin-facing company directory — scoped by territory if provided. */
  async listCompanies(
    params: {
      search?: string;
      status?: string;
      region?: string;
      sortOrder?: 'oldest' | 'newest';
      year?: number;
      semester?: 1 | 2;
      quarter?: 1 | 2 | 3 | 4;
      page?: number;
      pageSize?: number;
    },
    territory?: Territory,
  ) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize =
      params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20;

    const baseWhere: any = territoryWhere(territory);
    const where: any = { ...baseWhere };

    if (params.status && params.status !== 'ALL') {
      where.user = { status: params.status as any };
    }
    if (params.region && params.region !== 'Toutes') {
      where.region = { equals: params.region.trim(), mode: 'insensitive' };
    }

    if (params.year != null || params.semester != null || params.quarter != null) {
      const years = params.year != null
        ? [params.year]
        : Array.from(
            { length: Number(DOUALA_YEAR_FORMATTER.format(new Date())) - REGISTRATION_PERIOD_MIN_YEAR + 1 },
            (_, index) => REGISTRATION_PERIOD_MIN_YEAR + index,
          );
      const ranges = years.map((year) =>
        doualaRegistrationPeriodBounds(year, params.semester, params.quarter),
      );
      if (ranges.length === 1) {
        where.createdAt = ranges[0];
      } else if (ranges.length > 1) {
        where.AND = [
          ...(where.AND ?? []),
          { OR: ranges.map((range) => ({ createdAt: range })) },
        ];
      }
    }

    const term = params.search?.trim();
    if (term) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { taxNumber: { contains: term, mode: 'insensitive' } },
            { establishmentId: { contains: term, mode: 'insensitive' } },
            { region: { contains: term, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, companies] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        select: {
          id: true,
          name: true,
          taxNumber: true,
          establishmentId: true,
          region: true,
          department: true,
          subdivision: true,
          address: true,
          phone: true,
          mainActivity: true,
          totalEmployees: true,
          entityType: true,
          createdAt: true,
          sector: { select: { name: true } },
          respondentFirstName: true,
          respondentLastName: true,
          respondentFunction: true,
          respondentPhone: true,
          legalStatus: true,
          registrationNumber: true,
          cnpsNumber: true,
          yearOfCreation: true,
          enterpriseSize: true,
          menCount: true,
          womenCount: true,
          lastYearTotal: true,
          lastYearMenCount: true,
          lastYearWomenCount: true,
          user: { select: { id: true, email: true, isActive: true, status: true } },
        },
        orderBy: { createdAt: params.sortOrder === 'oldest' ? 'asc' : 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { companies, total, page, pageSize };
  }

  /** The stored territory and entityType of the user's company, if any. */
  private findStoredIdentity(userId: string) {
    return this.prisma.company.findUnique({
      where: { userId },
      select: {
        region: true,
        department: true,
        subdivision: true,
        regionId: true,
        departmentId: true,
        subdivisionId: true,
        entityType: true,
      },
    });
  }

  /** Records every territory / entityType change a company tried to make on
   *  itself and that was ignored (see company-territory-lock.ts). */
  private async auditIgnoredIdentityChanges(
    userId: string,
    companyId: string,
    ignored: IgnoredIdentityChange[],
  ) {
    for (const change of ignored) {
      await this.auditService.log(
        userId,
        change.field === 'territory'
          ? 'COMPANY_TERRITORY_CHANGE_IGNORED'
          : 'COMPANY_ENTITY_TYPE_CHANGE_IGNORED',
        'Company',
        companyId,
        change.field === 'territory'
          ? 'Changement de territoire ignoré : il passe par une demande examinée.'
          : "Changement de type d'entité ignoré : il relève des services du MINEFOP.",
        change.kept,
        change.sent,
      );
    }
  }

  // Territory is resolved and validated here. Establishment IDs are NOT
  // issued on this path: they are allocated once, at staff approval of the
  // registration (AuthService.approveUser). On an existing company, the
  // territory (once complete) and the entityType (once set) are kept: a
  // company cannot move itself between reviewer scopes or instruments
  // (company-territory-lock.ts).
  async saveCompanyProfile(userId: string, dto: any) {
    const resolvedTerritory = await resolveAndValidateTerritory(
      this.prisma,
      {
        regionId: dto.regionId,
        departmentId: dto.departmentId,
        subdivisionId: dto.subdivisionId,
        region: dto.region,
        department: dto.department,
        subdivision: dto.subdivision,
      },
      { requireSubdivision: true },
    );

    const data = {
      name: dto.name,
      taxNumber: dto.taxNumber,
      mainActivity: dto.mainActivity,
      region: resolvedTerritory.region,
      department: resolvedTerritory.department,
      subdivision: resolvedTerritory.subdivision!,
      regionId: resolvedTerritory.regionId,
      departmentId: resolvedTerritory.departmentId,
      subdivisionId: resolvedTerritory.subdivisionId,
      address: dto.address,
      phone: dto.phone,
      parentCompany: dto.parentCompany,
      secondaryActivity: dto.secondaryActivity,
      cnpsNumber: dto.cnpsNumber,
      fax: dto.fax,
      socialCapital: dto.socialCapital,
      ...(dto.entityType ? { entityType: dto.entityType as any } : {}),
    };

    try {
      // totalEmployees is intentionally NOT in the shared `data` object
      // above: it used to be hardcoded to 0 there and applied to every
      // upsert including `update`, so any profile save (e.g. the Settings
      // screen, or picking an entity type before a first ONEFOP
      // submission — see home_screen.dart) silently wiped out the real
      // headcount the dashboard displays. It should only ever default to 0
      // when the Company row is first created.
      const existing = await this.findStoredIdentity(userId);
      const { data: updateData, ignored } = lockCompanyIdentity(existing, data);
      const company = await this.prisma.company.upsert({
        where: { userId },
        update: {
          ...updateData,
        },
        create: { userId, totalEmployees: 0, ...data },
      });
      await this.auditService.log(userId, 'CREATE_COMPANY_PROFILE', 'Company', company.id, dto.name);
      await this.auditIgnoredIdentityChanges(userId, company.id, ignored);
      return company;
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException('Le numéro contribuable (NIU) est déjà utilisé.');
      }
      throw err;
    }
  }

  // Territory is resolved and validated here. Establishment IDs are NOT
  // issued on this path — see saveCompanyProfile above.
  async createOrUpdateCompany(userId: string, dto: CreateCompanyDto) {
    const resolvedTerritory = await resolveAndValidateTerritory(
      this.prisma,
      {
        regionId: dto.regionId,
        departmentId: dto.departmentId,
        subdivisionId: dto.subdivisionId,
        region: dto.region,
        department: dto.department,
        subdivision: dto.subdivision,
      },
      { requireSubdivision: true },
    );

    const companyData = {
      name: dto.name,
      parentCompany: dto.parentCompany,
      mainActivity: dto.mainActivity,
      secondaryActivity: dto.secondaryActivity,
      region: resolvedTerritory.region,
      department: resolvedTerritory.department,
      subdivision: resolvedTerritory.subdivision!,
      regionId: resolvedTerritory.regionId,
      departmentId: resolvedTerritory.departmentId,
      subdivisionId: resolvedTerritory.subdivisionId,
      address: dto.address,
      taxNumber: dto.taxNumber,
      cnpsNumber: dto.cnpsNumber,
      socialCapital: dto.socialCapital,
      totalEmployees: dto.totalEmployees,
      menCount: dto.menCount,
      womenCount: dto.womenCount,
      lastYearTotal: dto.lastYearTotal,
      lastYearMenCount: dto.lastYearMenCount,
      lastYearWomenCount: dto.lastYearWomenCount,
    };

    try {
      const existing = await this.findStoredIdentity(userId);
      const { data: updateData, ignored } = lockCompanyIdentity(existing, companyData);
      const company = await this.prisma.company.upsert({
        where: { userId },
        update: {
          ...updateData,
        },
        create: { userId, ...companyData },
      });
      await this.auditService.log(userId, 'UPDATE_COMPANY', 'Company', company.id, 'Mise à jour du profil entreprise');
      await this.auditIgnoredIdentityChanges(userId, company.id, ignored);
      return company;
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException('Le numéro contribuable (NIU) est déjà utilisé.');
      }
      throw err;
    }
  }

  /**
   * Mirrors OnefopService.getActiveQuarter() but scoped to the DSMO module —
   * the SubmissionRound a DataCampaign opens when its collectionType is
   * DSMO. No round open means no DSMO declaration period is currently
   * collecting data.
   *
   * The `deadline` check matters on its own, not just `status`: a round only
   * gets flipped to CLOSED by a daily cron (CampaignSchedulerService, 6am),
   * which can miss its firing entirely if the service was asleep (Render
   * free-tier idle spin-down). Without this, a campaign whose deadline has
   * passed — and which has already disappeared from every "active
   * campaign" UI — could still silently accept declarations until the cron
   * next happens to run.
   */
  async getActivePeriod() {
    const openRound = await this.prisma.submissionRound.findFirst({
      where: {
        module: 'DSMO',
        status: { in: ['OPEN', 'EXTENDED'] },
        deadline: { gte: new Date() },
      },
      orderBy: { openedAt: 'desc' },
    });
    // No genuinely open round: fall back to the most recent one so the
    // respondent can be told *which* period is closed and `code` stays
    // populated. Before 2026-10-10 this fallback round was reported open
    // regardless of its status or deadline.
    let round = openRound;
    if (!round) {
      round = await this.prisma.submissionRound.findFirst({
        where: { module: 'DSMO' },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!round) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
      const quarterCode = `${currentYear}-T${currentQuarter}`;
      // No DSMO round exists at all (no DSMO campaign has ever been
      // launched). Reported closed, mirroring OnefopService.getActiveQuarter
      // (F7, 2026-10-10): "open" here was a test affordance that told
      // respondents a period was collecting when none was. `code` stays
      // populated so anything keyed on it keeps working.
      return {
        isOpen: false,
        message:
          "Aucune campagne de collecte DSMO n'est encore ouverte. Vous pouvez remplir et sauvegarder " +
          "la déclaration ; elle pourra être soumise dès l'ouverture de la campagne.",
        code: quarterCode,
        label: `Trimestre ${currentQuarter} ${currentYear}`,
        deadline: new Date(currentYear, 11, 31, 23, 59, 59),
      };
    }
    // Same notion of "open" and same catalogued messages as
    // OnefopService.getActiveQuarter (error-messages.ts translates them).
    const isOpen = round.id === openRound?.id;
    const closedMessage =
      round.deadline < new Date()
        ? `La période de collecte « ${round.labelFr} » est close depuis le ${formatDoualaDateFr(round.deadline)}.`
        : `La période de collecte « ${round.labelFr} » n'est pas ouverte aux soumissions.`;
    return {
      isOpen,
      ...(isOpen ? {} : { message: closedMessage }),
      code: round.quarterCode,
      label: round.labelFr,
      deadline: round.deadline,
    };
  }

  /**
   * Renders the declaration PDF from the in-progress form payload without
   * touching the database — used by the "preview before submit" step so the
   * company can see the real document before the data is persisted.
   */
  async previewDeclarationPdf(dto: SubmitDeclarationDto): Promise<Buffer> {
    const getMovement = (type: MovementType) => {
      const m = (dto.movements || []).find((mv) => mv.movementType === type);
      if (!m) return undefined;
      return {
        cat1_3: m.cat1_3 ?? 0,
        cat4_6: m.cat4_6 ?? 0,
        cat7_9: m.cat7_9 ?? 0,
        cat10_12: m.cat10_12 ?? 0,
        catNonDeclared: m.catNonDeclared ?? 0,
      };
    };

    const processingService = await this.resolveProcessingService();

    const pdfData: PdfData = {
      trackingNumber: 'APERÇU',
      year: dto.year,
      fillingDate: dto.fillingDate || new Date().toISOString(),
      language: dto.language ?? 'fr',
      processingService,
      company: {
        ...dto.company,
        recruitments: getMovement(MovementType.RECRUITMENT),
        promotions: getMovement(MovementType.PROMOTION),
        dismissals: getMovement(MovementType.DISMISSAL),
        retirements: getMovement(MovementType.RETIREMENT),
        deaths: getMovement(MovementType.DEATH),
      },
      qualitative: dto.qualitative,
      employees: dto.employees,
    };

    return this.pdfService.buildPreviewPdf(pdfData);
  }

  async submitDeclaration(userId: string, dto: SubmitDeclarationDto) {
    const activePeriod = await this.getActivePeriod();
    if (!activePeriod.isOpen) {
      console.warn('⚠️ [TESTING MODE] DSMO Declaration submitted while active period is not open.');
    }

    const company = await this.createOrUpdateCompany(userId, dto.company);

    const existingDecl = await this.prisma.declaration.findFirst({
      where: {
        companyId: company.id,
        year: dto.year,
        status: { notIn: [DeclarationStatus.REJECTED, DeclarationStatus.DRAFT] },
      },
    });
    if (existingDecl) {
      throw new ForbiddenException(`Une déclaration pour l'année ${dto.year} est déjà active.`);
    }

    let declaration = await this.prisma.declaration.findFirst({
      where: { companyId: company.id, year: dto.year, status: DeclarationStatus.DRAFT },
    });

    if (!declaration) {
      declaration = await this.prisma.declaration.create({
        data: {
          year: dto.year,
          companyId: company.id,
          region: company.region,
          division: company.department,
          status: DeclarationStatus.DRAFT,
        },
      });
    }

    await this.prisma.$transaction([
      this.prisma.employee.deleteMany({ where: { declarationId: declaration.id } }),
      this.prisma.employee.createMany({
        data: dto.employees.map((emp) => ({
          ...emp,
          declarationId: declaration.id,
          diploma: emp.diploma ?? null,
          salaryCategory: emp.salaryCategory ?? null,
        })),
      }),
      this.prisma.declarationMovement.deleteMany({ where: { declarationId: declaration.id } }),
      this.prisma.declarationMovement.createMany({
        data: (dto.movements || []).map((m) => ({
          ...m,
          declarationId: declaration.id,
        })),
      }),
      this.prisma.qualitativeQuestion.deleteMany({ where: { declarationId: declaration.id } }),
      this.prisma.qualitativeQuestion.create({
        data: {
          declarationId: declaration.id,
          questionType: 'QUALITATIVE',
          section: 'GENERAL',
          questionText: 'Informations qualitatives DSMO',
          ...dto.qualitative,
        },
      }),
    ]);

    const validation = await this.validationService.validateDeclaration(declaration.id);
    if (!validation.isValid) {
      throw new BadRequestException(`Validation échouée: ${validation.errors.join('; ')}`);
    }

    const trackingNumber = await this.generateTrackingNumber(dto.year);
    const fullDecl = await this.prisma.declaration.findUniqueOrThrow({
      where: { id: declaration.id },
      include: { employees: true, movements: true, qualitativeQuestions: true },
    });

    const getMovement = (type: MovementType) => {
      const m = fullDecl.movements.find((mv: any) => mv.movementType === type);
      return m ? {
        cat1_3: m.cat1_3, cat4_6: m.cat4_6, cat7_9: m.cat7_9,
        cat10_12: m.cat10_12, catNonDeclared: m.catNonDeclared,
      } : undefined;
    };

    const processingService = await this.resolveProcessingService();
    const { urls, hashes } = await this.pdfService.generateDeclarationPdfs({
      trackingNumber,
      year: dto.year,
      fillingDate: dto.fillingDate || new Date().toISOString(),
      language: dto.language ?? 'fr',
      processingService,
      company: {
        ...company,
        parentCompany: company.parentCompany ?? undefined,
        secondaryActivity: company.secondaryActivity ?? undefined,
        fax: company.fax ?? undefined,
        cnpsNumber: company.cnpsNumber ?? undefined,
        socialCapital: company.socialCapital ?? undefined,
        menCount: company.menCount ?? undefined,
        womenCount: company.womenCount ?? undefined,
        lastYearMenCount: company.lastYearMenCount ?? undefined,
        lastYearWomenCount: company.lastYearWomenCount ?? undefined,
        lastYearTotal: company.lastYearTotal ?? undefined,
        recruitments: getMovement(MovementType.RECRUITMENT),
        promotions: getMovement(MovementType.PROMOTION),
        dismissals: getMovement(MovementType.DISMISSAL),
        retirements: getMovement(MovementType.RETIREMENT),
        deaths: getMovement(MovementType.DEATH),
      },
      qualitative: fullDecl.qualitativeQuestions[0] ? {
        hasTrainingCenter: fullDecl.qualitativeQuestions[0].hasTrainingCenter ?? undefined,
        recruitmentPlansNext: fullDecl.qualitativeQuestions[0].recruitmentPlansNext ?? undefined,
        camerounisationPlan: fullDecl.qualitativeQuestions[0].camerounisationPlan ?? undefined,
        usesTempAgencies: fullDecl.qualitativeQuestions[0].usesTempAgencies ?? undefined,
        tempAgencyDetails: fullDecl.qualitativeQuestions[0].tempAgencyDetails ?? undefined,
      } : undefined,
      employees: fullDecl.employees.map(e => ({
        fullName: e.fullName,
        gender: e.gender,
        age: e.age,
        nationality: e.nationality,
        diploma: e.diploma ?? undefined,
        function: e.function,
        seniority: e.seniority,
        salaryCategory: e.salaryCategory ?? undefined,
        salary: e.salary ?? undefined,
      })),
    });

    const submitted = await this.prisma.declaration.update({
      where: { id: declaration.id },
      data: {
        status: DeclarationStatus.SUBMITTED,
        submittedAt: new Date(),
        pdfUrl: urls[0],
        receiptUrl: urls[1],
        qrCode: trackingNumber,
        fillingDate: dto.fillingDate ? new Date(dto.fillingDate) : new Date(),
      },
    });

    await this.auditService.log(userId, 'SUBMIT_DECLARATION', 'Declaration', submitted.id, trackingNumber);
    // Best-effort — a leftover draft after a successful submit is a stale-UI
    // annoyance, not a reason to fail a legally-binding declaration.
    try {
      await this.deleteDraft(userId);
    } catch {
      // ignored
    }
    return {
      success: true,
      declaration: { id: submitted.id },
      trackingNumber,
      pdfUrls: urls,
      fileHashes: hashes,
    };
  }

  /**
   * Autosave / resume support for the DeclarationWizardScreen + EmployeeListScreen
   * flow. Deliberately independent of the Declaration/DeclarationStatus
   * pipeline (see DsmoDeclarationDraft doc comment in schema.prisma) — a
   * draft is just an opaque JSON blob the client can round-trip, one per
   * company, overwritten on every autosave.
   */
  async saveDraft(userId: string, year: number, draftData: any) {
    const company = await this.prisma.company.findUnique({ where: { userId } });
    if (!company) throw new NotFoundException('Aucun profil entreprise trouvé.');

    return this.prisma.dsmoDeclarationDraft.upsert({
      where: { companyId: company.id },
      update: { year, draftData },
      create: { companyId: company.id, year, draftData },
    });
  }

  async getDraft(userId: string) {
    const company = await this.prisma.company.findUnique({ where: { userId } });
    if (!company) return null;
    return this.prisma.dsmoDeclarationDraft.findUnique({ where: { companyId: company.id } });
  }

  async deleteDraft(userId: string) {
    const company = await this.prisma.company.findUnique({ where: { userId } });
    if (!company) return;
    await this.prisma.dsmoDeclarationDraft.deleteMany({ where: { companyId: company.id } });
  }

  async getPendingDeclarations(user: any) {
    const where: any = {
      status: {
        in: [
          DeclarationStatus.SUBMITTED,
          DeclarationStatus.DIVISION_APPROVED,
          DeclarationStatus.REGION_APPROVED,
        ],
      },
    };
    if (user.role === UserRole.DIVISIONAL_ADMIN) where.division = user.department;
    else if (user.role === UserRole.REGIONAL_ADMIN) where.region = user.region;
    else if (user.role === UserRole.COMPANY) throw new ForbiddenException('Accès refusé.');

    return this.prisma.declaration.findMany({
      where,
      include: { company: true, employees: true },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async validateDeclaration(declarationId: string, userId: string, accept: boolean, reason?: string) {
    return accept
      ? this.approveDeclaration(declarationId, userId)
      : this.rejectDeclaration(declarationId, userId, reason || 'Non précisé');
  }

  async approveDeclaration(declarationId: string, userId: string, notes?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.getDeclarationWithAccess(userId, declarationId);

    let nextStatus: DeclarationStatus;
    if (user.role === UserRole.DIVISIONAL_ADMIN) nextStatus = DeclarationStatus.DIVISION_APPROVED;
    else if (user.role === UserRole.REGIONAL_ADMIN) nextStatus = DeclarationStatus.REGION_APPROVED;
    else if (
      user.role === UserRole.ADMIN_ONEFOP ||
      user.role === UserRole.ADMIN_ONEFOP_SUBMISSIONS ||
      user.role === UserRole.SUPER_ADMIN
    )
      nextStatus = DeclarationStatus.FINAL_APPROVED;
    else throw new ForbiddenException('Privilèges insuffisants.');

    return this.prisma.declaration.update({
      where: { id: declarationId },
      data: { status: nextStatus, validatedBy: userId, validatedAt: new Date() },
    });
  }

  async rejectDeclaration(declarationId: string, userId: string, reason: string) {
    return this.prisma.declaration.update({
      where: { id: declarationId },
      data: {
        status: DeclarationStatus.REJECTED,
        rejectionReason: reason,
        validatedBy: userId,
        validatedAt: new Date(),
      },
    });
  }

  /**
   * Returns declarations for the authenticated user.
   */
  async getDeclarationsForUser(userId: string, filters: any) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const where: any = {};

    if (user.role === UserRole.COMPANY) {
      const comp = await this.prisma.company.findUnique({ where: { userId } });
      if (!comp) return [];
      where.companyId = comp.id;
    } else if (user.role === UserRole.DIVISIONAL_ADMIN) {
      where.division = user.department;
    } else if (user.role === UserRole.REGIONAL_ADMIN) {
      where.region = user.region;
    }

    if (filters.year) where.year = filters.year;
    if (filters.status) where.status = filters.status;

    return this.prisma.declaration.findMany({
      where,
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPdfPath(declarationId: string, userId: string, copy: number): Promise<string> {
    const decl = await this.getDeclarationWithAccess(userId, declarationId);

    if (!decl.qrCode) {
      throw new NotFoundException('PDF non disponible — numéro de suivi introuvable.');
    }

    const exists = await this.pdfService.pdfExists(decl.qrCode, decl.year, copy);

    if (!exists) {
      console.log(`[PDF] Missing: ${decl.qrCode} copy ${copy} — regenerating...`);
      await this._regeneratePdfs(decl);
      console.log(`[PDF] Regenerated: ${decl.qrCode}`);
    }

    return this.pdfService.getSignedUrl(decl.qrCode, decl.year, copy);
  }

  private async _regeneratePdfs(decl: any): Promise<void> {
    const q = decl.qualitativeQuestions?.[0];

    const getMovement = (type: string) => {
      const m = decl.movements?.find((mv: any) => mv.movementType === type);
      if (!m) return undefined;
      return {
        cat1_3: m.cat1_3,
        cat4_6: m.cat4_6,
        cat7_9: m.cat7_9,
        cat10_12: m.cat10_12,
        catNonDeclared: m.catNonDeclared,
      };
    };

    const processingService = await this.resolveProcessingService();
    const pdfData: PdfData = {
      trackingNumber: decl.qrCode,
      year: decl.year,
      language: 'fr',
      processingService,
      company: {
        name: decl.company.name,
        mainActivity: decl.company.mainActivity,
        region: decl.company.region,
        department: decl.company.department,
        subdivision: decl.company.subdivision,
        address: decl.company.address,
        taxNumber: decl.company.taxNumber,
        totalEmployees: decl.company.totalEmployees,
        cnpsNumber: decl.company.cnpsNumber ?? undefined,
        socialCapital: decl.company.socialCapital ?? undefined,
        menCount: decl.company.menCount ?? undefined,
        womenCount: decl.company.womenCount ?? undefined,
        lastYearTotal: decl.company.lastYearTotal ?? undefined,
        recruitments: getMovement('RECRUITMENT'),
        promotions: getMovement('PROMOTION'),
        dismissals: getMovement('DISMISSAL'),
        retirements: getMovement('RETIREMENT'),
        deaths: getMovement('DEATH'),
      },
      qualitative: q
        ? {
          hasTrainingCenter: q.hasTrainingCenter ?? undefined,
          recruitmentPlansNext: q.recruitmentPlansNext ?? undefined,
          camerounisationPlan: q.camerounisationPlan ?? undefined,
          usesTempAgencies: q.usesTempAgencies ?? undefined,
          tempAgencyDetails: q.tempAgencyDetails ?? undefined,
        }
        : undefined,
      employees: decl.employees.map((e: any) => ({
        fullName: e.fullName,
        gender: e.gender,
        age: e.age,
        nationality: e.nationality,
        diploma: e.diploma ?? undefined,
        function: e.function,
        seniority: e.seniority,
        salaryCategory: e.salaryCategory ?? undefined,
      })),
    };

    await this.pdfService.generateDeclarationPdfs(pdfData);
  }

  async getDeclarationWithAccess(userId: string, declarationId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const decl = await this.prisma.declaration.findUniqueOrThrow({
      where: { id: declarationId },
      include: {
        company: true,
        employees: true,
        movements: true,
        qualitativeQuestions: true,
      },
    });

    if (user.role === UserRole.COMPANY && decl.company.userId !== userId) {
      throw new ForbiddenException('Accès interdit.');
    }
    return decl;
  }

  async getDeclarationStats(year: number, region?: string, department?: string) {
    const where: any = { year };
    if (region) where.region = region;
    if (department) where.division = department;

    const [total, submitted, approved, rejected] = await Promise.all([
      this.prisma.declaration.count({ where }),
      this.prisma.declaration.count({ where: { ...where, status: DeclarationStatus.SUBMITTED } }),
      this.prisma.declaration.count({ where: { ...where, status: DeclarationStatus.FINAL_APPROVED } }),
      this.prisma.declaration.count({ where: { ...where, status: DeclarationStatus.REJECTED } }),
    ]);

    return { total, submitted, approved, rejected };
  }
}
