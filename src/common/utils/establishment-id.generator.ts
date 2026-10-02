// src/common/utils/establishment-id.generator.ts
import { Prisma } from '@prisma/client';

/** PrismaService and a $transaction client both expose these. */
type IdClient = {
  company: { findFirst: (args: unknown) => Promise<{ establishmentId: string | null } | null> };
  $executeRaw: (query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => Promise<unknown>;
};

export class EstablishmentIdGenerator {
    private static readonly ENTITY_PREFIX: Record<string, string> = {
        'ENTREPRISE': 'EN',
        'COOPERATIVE': 'CO',
        'CTD': 'CT',
        'ONG': 'ON',
        'ADMINISTRATION': 'AD',
        'PROJECT_PROGRAM': 'PP',
        'VOCATIONAL_TRAINING': 'VT',
    };

    /**
     * Generate compact establishment ID
     * Format: {prefix}{yearLast2}{serial}{subdivCode}
     * Example: EN26000112 (Enterprise, 2026, serial 1, subdiv 12)
     *
     * Must only be called inside prisma.$transaction(...).
     * pg_advisory_xact_lock is held until COMMIT/ROLLBACK; outside a
     * transaction PostgreSQL releases it at the end of the statement and
     * concurrent serial allocation is not serialised.
     */
    static async generate(
        prisma: IdClient,
        entityType: string,
        subdivisionCode: string,
    ): Promise<string> {
        const prefix = this.ENTITY_PREFIX[entityType.toUpperCase()];
        if (!prefix) {
            throw new Error(`Unknown entity type: ${entityType}`);
        }

        const yearLast2 = new Date().getFullYear().toString().slice(-2);
        const lockKey = this.advisoryLockKey(prefix, yearLast2);
        await prisma.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

        // Get next serial number for this entity type and year
        const lastEstablishment = await prisma.company.findFirst({
            where: {
                establishmentId: { startsWith: `${prefix}${yearLast2}` }
            },
            orderBy: { establishmentId: 'desc' }
        });

        let nextSerial = 1;
        if (lastEstablishment?.establishmentId) {
            const lastSerial = parseInt(lastEstablishment.establishmentId.slice(4, 8));
            nextSerial = lastSerial + 1;
        }

        const serial = nextSerial.toString().padStart(4, '0');
        const subdivCode = subdivisionCode.padStart(2, '0').slice(0, 2);

        return `${prefix}${yearLast2}${serial}${subdivCode}`;
    }

    /**
     * Validate establishment ID format
     */
    static isValid(establishmentId: string): boolean {
        const pattern = /^(EN|CO|CT|ON|AD|PP|VT)[0-9]{2}[0-9]{4}[0-9]{2}$/;
        return pattern.test(establishmentId);
    }

    /**
     * Parse establishment ID components
     */
    static parse(establishmentId: string): {
        prefix: string;
        entityType: string;
        year: string;
        serial: number;
        subdivisionCode: string;
    } | null {
        if (!this.isValid(establishmentId)) return null;

        const prefix = establishmentId.slice(0, 2);
        const year = establishmentId.slice(2, 4);
        const serial = parseInt(establishmentId.slice(4, 8));
        const subdivisionCode = establishmentId.slice(8, 10);

        const entityTypeMap: Record<string, string> = {
            'EN': 'ENTREPRISE',
            'CO': 'COOPERATIVE',
            'CT': 'CTD',
            'ON': 'ONG',
            'AD': 'ADMINISTRATION',
            'PP': 'PROJECT_PROGRAM',
            'VT': 'VOCATIONAL_TRAINING',
        };

        return {
            prefix,
            entityType: entityTypeMap[prefix],
            year: `20${year}`,
            serial,
            subdivisionCode,
        };
    }

    /** Stable signed 32-bit key for pg_advisory_xact_lock (prefix + year). */
    static advisoryLockKey(prefix: string, yearLast2: string): number {
        const text = `${prefix}${yearLast2}`;
        let hash = 0;
        for (let i = 0; i < text.length; i += 1) {
            hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
        }
        return hash;
    }
}