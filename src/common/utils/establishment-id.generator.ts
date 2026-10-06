// src/common/utils/establishment-id.generator.ts
import { ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** PrismaService and a $transaction client both expose this. */
type IdClient = {
  $queryRaw: <T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => Promise<T>;
};

/** Highest serial a (prefix, year) sequence can issue: MAXVALUE in the migration. */
const SERIAL_MAX = 9999;
/** A warning is logged from 90% usage on, so the ceiling is noticed in advance. */
const SERIAL_WARN_AT = Math.ceil(SERIAL_MAX * 0.9);

export const ESTABLISHMENT_ID_EXHAUSTED_MESSAGE =
    "Le quota d'identification pour ce type d'entité cette année est épuisé. Contactez l'ONEFOP.";

export class EstablishmentIdGenerator {
    private static readonly logger = new Logger('EstablishmentIdGenerator');

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
     * The serial comes from the Postgres sequence of its (prefix, UTC year),
     * created on first use by establishment_serial_ensure() (migration
     * 20261011120000). nextval() is atomic and never rolls back: concurrent
     * callers always get different numbers, and a failure after this call
     * leaves a gap rather than a reissued number. Safe inside or outside a
     * transaction; no lock is taken.
     *
     * Two statements on purpose: when another session has just created the
     * sequence, a single statement could still see a stale catalog entry.
     *
     * The 10000th ID of a (prefix, year) is a 409 with a fixed message.
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

        // UTC: the YY records when the identifier was minted.
        const yearLast2 = new Date().getUTCFullYear().toString().slice(-2);

        const [{ seq }] = await prisma.$queryRaw<{ seq: string }[]>`
            SELECT public.establishment_serial_ensure(${prefix}, ${yearLast2}) AS seq`;

        let nextSerial: number;
        try {
            const [{ serial }] = await prisma.$queryRaw<{ serial: bigint | number }[]>`
                SELECT nextval(${seq}::regclass) AS serial`;
            nextSerial = Number(serial);
        } catch (error) {
            if (this.isSequenceExhausted(error)) {
                this.logger.error(`Establishment ID sequence ${seq} is exhausted (${SERIAL_MAX} issued)`);
                throw new ConflictException(ESTABLISHMENT_ID_EXHAUSTED_MESSAGE);
            }
            throw error;
        }

        if (nextSerial >= SERIAL_WARN_AT) {
            this.logger.warn(
                `Establishment ID sequence ${seq} at ${nextSerial}/${SERIAL_MAX}: ` +
                    `${SERIAL_MAX - nextSerial} IDs left for ${prefix}${yearLast2}`,
            );
        }

        const serial = nextSerial.toString().padStart(4, '0');
        const subdivCode = subdivisionCode.padStart(2, '0').slice(0, 2);

        return `${prefix}${yearLast2}${serial}${subdivCode}`;
    }

    /** nextval() past MAXVALUE: SQLSTATE 2200H, surfaced by $queryRaw as P2010. */
    private static isSequenceExhausted(error: unknown): boolean {
        const e = error as { meta?: { code?: string; message?: string }; message?: string } | null;
        if (e?.meta?.code === '2200H') return true;
        const text = `${e?.meta?.message ?? ''} ${e?.message ?? ''}`;
        return /reached maximum value of sequence/i.test(text);
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
}