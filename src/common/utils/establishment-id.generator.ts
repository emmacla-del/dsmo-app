// src/common/utils/establishment-id.generator.ts
import { PrismaService } from '../../prisma/prisma.service';

export class EstablishmentIdGenerator {
    private static readonly ENTITY_PREFIX: Record<string, string> = {
        'ENTREPRISE': 'EN',
        'COOPERATIVE': 'CO',
        'CTD': 'CT',
        'ONG': 'ON',
    };

    /**
     * Generate compact establishment ID
     * Format: {prefix}{yearLast2}{serial}{subdivCode}
     * Example: EN26000112 (Enterprise, 2026, serial 1, subdiv 12)
     */
    static async generate(
        prisma: PrismaService,
        entityType: string,
        subdivisionCode: string,
    ): Promise<string> {
        const prefix = this.ENTITY_PREFIX[entityType.toUpperCase()];
        if (!prefix) {
            throw new Error(`Unknown entity type: ${entityType}`);
        }

        const yearLast2 = new Date().getFullYear().toString().slice(-2);

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
        const pattern = /^(EN|CO|CT|ON)[0-9]{2}[0-9]{4}[0-9]{2}$/;
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