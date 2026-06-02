// src/scripts/backfill-normalized-tables.ts
import { PrismaClient } from '@prisma/client';
import { normalizeFlatKeys } from '../common/normalizers/flat-key-normalizer';

const prisma = new PrismaClient();

// Copy these private methods from questionnaires.service.ts
// since we can't inject the service in a script

type FlatFormData = Record<string, string | number>;

function flatInt(flat: FlatFormData, key: string): number {
    const v = flat[key];
    if (v === undefined || v === null || v === '') return 0;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return isNaN(n) ? 0 : n;
}

function up(v: string): string {
    return v.toUpperCase();
}

async function saveCspGenderAge(submissionId: string, flat: FlatFormData, prefix: string) {
    const cspRows = ['cadres', 'foremen', 'workers'];
    const genders = ['male', 'female', 'total'];
    const ageBands = ['15_24', '25_34', '35_plus', 'total'];
    const rows: any[] = [];

    for (const csp of cspRows) {
        for (const gender of genders) {
            for (const age of ageBands) {
                const value = flatInt(flat, `${prefix}_${csp}_${gender}_${age}`);
                if (value !== 0) rows.push({
                    submissionId, tableName: prefix,
                    cspCategory: up(csp), gender: up(gender), ageBand: age, value,
                });
            }
        }
    }
    for (const gender of genders) {
        for (const age of ageBands) {
            const value = flatInt(flat, `${prefix}_total_${gender}_${age}`);
            if (value !== 0) rows.push({
                submissionId, tableName: prefix,
                cspCategory: 'TOTAL', gender: up(gender), ageBand: age, value,
            });
        }
    }
    if (rows.length > 0) {
        await prisma.onefopCspGenderAge.createMany({ data: rows, skipDuplicates: true });
        console.log(`  ✓ csp_gender_age[${prefix}]: ${rows.length} rows`);
    }
}

async function saveSkills(submissionId: string, flat: FlatFormData) {
    const records: any[] = [];
    for (let i = 1; i <= 3; i++) {
        const description = String(flat[`s4q02_skill_${i}_text`] ?? '').trim();
        const male = flatInt(flat, `s4q02_skill_${i}_male`);
        const female = flatInt(flat, `s4q02_skill_${i}_female`);
        const total = flatInt(flat, `s4q02_skill_${i}_total`);
        if (description || male !== 0 || female !== 0) {
            records.push({
                submissionId, skillIndex: i, skillDescription: description,
                maleCount: male, femaleCount: female,
                totalCount: total > 0 ? total : male + female,
            });
        }
    }
    if (records.length > 0) {
        await prisma.onefopSkillNeed.createMany({ data: records, skipDuplicates: true });
        console.log(`  ✓ skill_needs: ${records.length} rows`);
    }
}

async function saveTraining(submissionId: string, flat: FlatFormData) {
    const records: any[] = [];
    for (let i = 1; i <= 3; i++) {
        const domain = String(flat[`s4q03_domain_${i}_text`] ?? '').trim();
        const male = flatInt(flat, `s4q03_domain_${i}_male`);
        const female = flatInt(flat, `s4q03_domain_${i}_female`);
        const total = flatInt(flat, `s4q03_domain_${i}_total`);
        if (domain || male !== 0 || female !== 0) {
            records.push({
                submissionId, domainIndex: i, trainingDomain: domain,
                maleCount: male, femaleCount: female,
                totalCount: total > 0 ? total : male + female,
            });
        }
    }
    if (records.length > 0) {
        await prisma.onefopTrainingNeed.createMany({ data: records, skipDuplicates: true });
        console.log(`  ✓ training_needs: ${records.length} rows`);
    }
}

async function saveDepartures(submissionId: string, flat: FlatFormData) {
    const prefix = 's3q01';
    const cspRows = ['cadres', 'foremen', 'workers', 'total'];
    const departureTypes = ['dismissal', 'resignation', 'retirement', 'other', 'ensemble'];
    const genders = ['male', 'female', 'total'];
    const records: any[] = [];

    for (const csp of cspRows) {
        for (const type of departureTypes) {
            for (const gender of genders) {
                const value = flatInt(flat, `${prefix}_${csp}_${type}_${gender}`);
                if (value !== 0) records.push({
                    submissionId,
                    cspCategory: up(csp),
                    departureType: up(type),
                    gender: up(gender),
                    value,
                });
            }
        }
    }
    if (records.length > 0) {
        await prisma.onefopDepartureData.createMany({ data: records, skipDuplicates: true });
        console.log(`  ✓ departure_data: ${records.length} rows`);
    }
}

async function backfill() {
    const submissions = await prisma.onefopSubmission.findMany({
        where: { status: 'APPROVED' },
        select: { id: true, formType: true, rawData: true, surveyYear: true },
    });

    console.log(`\nBackfilling ${submissions.length} approved submissions...\n`);

    for (const s of submissions) {
        console.log(`\n── ${s.id} (${s.formType}) ──`);
        const raw = s.rawData as Record<string, unknown>;

        // Convert whatever nested camelCase exists to flat keys
        const normalized = normalizeFlatKeys(raw, s.formType.toLowerCase());
        const flat = normalized as unknown as FlatFormData;

        console.log(`  Normalized keys: ${Object.keys(flat).length}`);

        // Clear any existing partial data first
        await prisma.onefopCspGenderAge.deleteMany({ where: { submissionId: s.id } });
        await prisma.onefopSkillNeed.deleteMany({ where: { submissionId: s.id } });
        await prisma.onefopTrainingNeed.deleteMany({ where: { submissionId: s.id } });
        await prisma.onefopDepartureData.deleteMany({ where: { submissionId: s.id } });

        // Save whatever data exists (incomplete forms will just produce fewer rows)
        for (const prefix of ['s21q01', 's22q01', 's22q02', 's23q01']) {
            await saveCspGenderAge(s.id, flat, prefix);
        }
        await saveSkills(s.id, flat);
        await saveTraining(s.id, flat);
        await saveDepartures(s.id, flat);
    }

    console.log('\n── Verification ──');
    const counts = await prisma.$queryRaw<any[]>`
    SELECT 'csp_gender_age' as t, COUNT(*)::int as n FROM onefop_csp_gender_age
    UNION ALL
    SELECT 'skill_needs', COUNT(*)::int FROM onefop_skill_needs
    UNION ALL  
    SELECT 'training_needs', COUNT(*)::int FROM onefop_training_needs
    UNION ALL
    SELECT 'departure_data', COUNT(*)::int FROM onefop_departure_data
  `;
    console.table(counts);
}

backfill()
    .catch(console.error)
    .finally(() => prisma.$disconnect());