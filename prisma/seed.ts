import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Starting database seed...\n');

    try {
        // ==================== SECTORS ====================
        console.log('🏭 Creating socioprofessional sectors...');

        const sectors = [
            { name: 'Agriculture, élevage, sylviculture et pêche', category: 'Primary' },
            { name: 'Industries extractives', category: 'Primary' },
            { name: 'Industrie manufacturière', category: 'Secondary' },
            { name: "Production et distribution d'eau, électricité et gaz", category: 'Secondary' },
            { name: 'Construction et BTP', category: 'Secondary' },
            { name: 'Commerce de gros et de détail', category: 'Tertiary' },
            { name: 'Transport et entreposage', category: 'Tertiary' },
            { name: 'Hôtellerie et restauration', category: 'Tertiary' },
            { name: 'Information et communication', category: 'Tertiary' },
            { name: "Activités financières et d'assurance", category: 'Tertiary' },
            { name: 'Activités immobilières', category: 'Tertiary' },
            { name: 'Activités juridiques, comptables et de conseil', category: 'Tertiary' },
            { name: 'Recherche et développement', category: 'Tertiary' },
            { name: 'Enseignement', category: 'Tertiary' },
            { name: 'Santé humaine et action sociale', category: 'Tertiary' },
            { name: 'Arts, spectacles et loisirs', category: 'Tertiary' },
            { name: 'Autres activités de services', category: 'Tertiary' },
            { name: 'Administration publique et défense', category: 'Public' },
            { name: 'Organismes extraterritoriaux', category: 'Public' },
        ];

        for (const sector of sectors) {
            await prisma.sector.upsert({
                where: { name: sector.name },
                update: {},
                create: sector,
            });
        }
        console.log(`   ✅ ${sectors.length} sectors created`);

        // ==================== REGIONS, DEPARTMENTS, SUBDIVISIONS ====================
        console.log('🗺️ Creating regions, departments, and subdivisions...');

        // Region data with departments and subdivisions
        const regionsData = [
            {
                name: 'Adamaoua',
                departments: [
                    { name: 'Djérem', subdivisions: ['Mbakaou', 'Ngaoundal', 'Tibati'] },
                    { name: 'Faro-et-Déo', subdivisions: ['Galim-Tignère', 'Kontcha', 'Mayo-Baléo', 'Tignère'] },
                    { name: 'Mayo-Banyo', subdivisions: ['Bankim', 'Banyo', 'Mayo-Darle', 'Ngan-Ha'] },
                    { name: 'Mbéré', subdivisions: ['Djohong', 'Gonmé', 'Meiganga', 'Ngaoui'] },
                    { name: 'Vina', subdivisions: ['Belel', 'Martap', 'Meidougou', 'Ngaoundéré I', 'Ngaoundéré II', 'Ngaoundéré III', 'Nyambaka'] },
                ]
            },
            {
                name: 'Centre',
                departments: [
                    { name: 'Haute-Sanaga', subdivisions: ['Lembe-Yezoum', 'Minta', 'Nanga-Eboko', 'Nkoteng'] },
                    { name: 'Lékié', subdivisions: ['Batchenga', 'Ebebda', 'Elig-Mfomo', 'Evodoula', 'Monatélé', 'Obala', "Sa'a"] },
                    { name: 'Mbam-et-Inoubou', subdivisions: ['Bafia', 'Bokito', 'Deuk', 'Kiiki', 'Koro', 'Makénéné', 'Ndikiniméki', 'Nitoukou', 'Ombessa'] },
                    { name: 'Mbam-et-Kim', subdivisions: ['Mbangassina', 'Ngambe-Tikar', 'Ngoro', 'Ntui', 'Yoko'] },
                    { name: 'Méfou-et-Afamba', subdivisions: ['Awaé', 'Esse', 'Mfou', 'Nkolafamba', 'Soa', 'Yaoundé VII'] },
                    { name: 'Méfou-et-Akono', subdivisions: ['Akono', 'Bikok', 'Dzeng', 'Mengueme', 'Ngog-Mapubi', 'Ngoumou'] },
                    { name: 'Mfoundi', subdivisions: ['Yaoundé I', 'Yaoundé II', 'Yaoundé III', 'Yaoundé IV', 'Yaoundé V', 'Yaoundé VI'] },
                    { name: 'Nyong-et-Kellé', subdivisions: ['Éséka', 'Makak', 'Matomb', 'Messondo', 'Ngog-Mapubi', 'Nyanon', 'Pouma'] },
                    { name: 'Nyong-et-Mfoumou', subdivisions: ['Akonolinga', 'Ayos', 'Endom', 'Kobdombo', 'Menomale', 'Ngomedzap'] },
                    { name: "Nyong-et-So'o", subdivisions: ['Dzeng', 'Mbalmayo', 'Mbankomo', 'Mengueme', 'Mfou', 'Ngomedzap', 'Ngoumou'] },
                ]
            },
            {
                name: 'Est',
                departments: [
                    { name: 'Boumba-et-Ngoko', subdivisions: ['Gari-Gombo', 'Moloundou', 'Salapoumbé', 'Yokadouma'] },
                    { name: 'Haut-Nyong', subdivisions: ['Abong-Mbang', 'Angossas', 'Atok', 'Dimako', 'Doumaintang', 'Doume', 'Lomié', 'Mboma', 'Messamena', 'Mindourou', 'Ngoyla', 'Nguelemendouka', 'Somalomo'] },
                    { name: 'Kadey', subdivisions: ['Batouri', 'Kette', 'Mbang', 'Ndelele', 'Nguelebok', 'Ouli'] },
                    { name: 'Lom-et-Djérem', subdivisions: ['Bélabo', 'Bertoua I', 'Bertoua II', 'Betaré-Oya', 'Diang', 'Ngoura'] },
                ]
            },
            {
                name: 'Extrême-Nord',
                departments: [
                    { name: 'Diamaré', subdivisions: ['Gazawa', 'Maroua I', 'Maroua II', 'Maroua III', 'Meri', 'Ndoukoula', 'Pette'] },
                    { name: 'Logone-et-Chari', subdivisions: ['Fotokol', 'Goulfey', 'Hilé-Alifa', 'Kousseri', 'Logone-Birni', 'Makary', 'Waza', 'Zina'] },
                    { name: 'Mayo-Danay', subdivisions: ['Datcheka', 'Gazawa', 'Kaélé', 'Kar-Hay', 'Maga', 'Mindif', 'Moulouvaye', 'Tchatibali', 'Yagoua'] },
                    { name: 'Mayo-Kani', subdivisions: ['Blangoua', 'Guidiguis', 'Kaïkaï', 'Moulvoudaye', 'Tchanaga', 'Toulourou'] },
                    { name: 'Mayo-Sava', subdivisions: ['Kolofata', 'Limani', 'Méri', 'Mora', 'Tokombéré'] },
                    { name: 'Mayo-Tsanaga', subdivisions: ['Bourha', 'Hina', 'Koza', 'Mogodé', 'Mokolo', 'Mozogo', 'Roua', 'Soulédé-Roua'] },
                ]
            },
            {
                name: 'Littoral',
                departments: [
                    { name: 'Moungo', subdivisions: ['Bare-Bakem', 'Bonalea', 'Dibombari', 'Ekom', 'Loum', 'Manjo', 'Mbanga', 'Melong', 'Mombo', 'Njombe-Penja', 'Nkongsamba I', 'Nkongsamba II', 'Nkongsamba III'] },
                    { name: 'Nkam', subdivisions: ['Ndom', 'Ngambe', 'Yabassi', 'Yingui'] },
                    { name: 'Sanaga-Maritime', subdivisions: ['Dibamba', 'Dizangue', 'Édéa I', 'Édéa II', 'Mouanko', 'Ndom', 'Ngambe', 'Nyanon', 'Pouma'] },
                    { name: 'Wouri', subdivisions: ['Douala I', 'Douala II', 'Douala III', 'Douala IV', 'Douala V', 'Manoka'] },
                ]
            },
            {
                name: 'Nord',
                departments: [
                    { name: 'Bénoué', subdivisions: ['Bibemi', 'Dembo', 'Garoua I', 'Garoua II', 'Garoua III', 'Lagdo', 'Ngong', 'Pitoa', 'Tchéboa'] },
                    { name: 'Faro', subdivisions: ['Beka', 'Poli'] },
                    { name: 'Mayo-Louti', subdivisions: ['Figuil', 'Guider', 'Mayo-Oulo'] },
                    { name: 'Mayo-Rey', subdivisions: ['Pignde', 'Rey-Bouba', 'Tcholliré', 'Touboro'] },
                ]
            },
            {
                name: 'Nord-Ouest',
                departments: [
                    { name: 'Boyo', subdivisions: ['Belo', 'Fonfuka', 'Fundong'] },
                    { name: 'Bui', subdivisions: ['Jakiri', 'Kumbo', 'Mbven', 'Nkum', 'Noni', 'Oku'] },
                    { name: 'Donga-Mantung', subdivisions: ['Ako', 'Ndu', 'Nkambe', 'Nwa'] },
                    { name: 'Menchum', subdivisions: ['Benakuma', 'Fungom', 'Wum', 'Zhoa'] },
                    { name: 'Mezam', subdivisions: ['Bafut', 'Bali', 'Bamenda I', 'Bamenda II', 'Bamenda III', 'Santa', 'Tubah'] },
                    { name: 'Momo', subdivisions: ['Batibo', 'Mbengwi', 'Njikwa', 'Widikum-Menka'] },
                    { name: 'Ngo-Ketunjia', subdivisions: ['Babessi', 'Balikumbat', 'Ndop'] },
                ]
            },
            {
                name: 'Ouest',
                departments: [
                    { name: 'Bamboutos', subdivisions: ['Babadjou', 'Batcham', 'Galim', 'Mbouda'] },
                    { name: 'Haut-Nkam', subdivisions: ['Bafang', 'Banka', 'Bandja', 'Batcham', 'Kekem'] },
                    { name: 'Hauts-Plateaux', subdivisions: ['Baham', 'Bamendjou', 'Bangou', 'Bansoa'] },
                    { name: 'Koung-Khi', subdivisions: ['Bamendjou', 'Kouoptamo', 'Poumougne'] },
                    { name: 'Menoua', subdivisions: ['Dschang', 'Fongo-Tongo', 'Fokoué', 'Kekem', 'Nkong-Ni', 'Penka-Michel', 'Santchou'] },
                    { name: 'Mifi', subdivisions: ['Bafoussam I', 'Bafoussam II', 'Bafoussam III'] },
                    { name: 'Ndé', subdivisions: ['Bangangté', 'Bassamba', 'Bazou', 'Tonga'] },
                    { name: 'Noun', subdivisions: ['Foumban', 'Foumbot', 'Kouoptamo', 'Koutaba', 'Magba', 'Malantouen', 'Massangam', 'Njimom'] },
                ]
            },
            {
                name: 'Sud',
                departments: [
                    { name: 'Dja-et-Lobo', subdivisions: ['Bengbis', 'Djoum', 'Meyomessala', 'Meyomessi', 'Mintom', 'Mvangan', 'Oveng', 'Sangmélima'] },
                    { name: 'Mvila', subdivisions: ['Ambam', 'Bengbis', 'Ebolowa I', 'Ebolowa II', 'Efoulan', "Ma'an", 'Mengong', 'Mvangan', 'Ngoulemakong'] },
                    { name: 'Océan', subdivisions: ['Akom II', 'Campo', 'Grand Batanga', 'Kribi I', 'Kribi II', 'Lolodorf', 'Mvengue'] },
                    { name: 'Vallée-du-Ntem', subdivisions: ['Biwong-Bané', 'Biwong-Bulu', 'Djoum', 'Meyomessala', 'Nkpwa'] },
                ]
            },
            {
                name: 'Sud-Ouest',
                departments: [
                    { name: 'Fako', subdivisions: ['Buea', 'Limbe I', 'Limbe II', 'Limbe III', 'Muyuka', 'Tiko'] },
                    { name: 'Koupé-Muanenguba', subdivisions: ['Bangem', 'Nguti', 'Tombel'] },
                    { name: 'Lebialem', subdivisions: ['Alou', 'Fontem', 'Wabane'] },
                    { name: 'Manyu', subdivisions: ['Akwaya', 'Eyumojock', 'Mamfe', 'Tinto'] },
                    { name: 'Meme', subdivisions: ['Konye', 'Kumba I', 'Kumba II', 'Kumba III', 'Mbonge'] },
                    { name: 'Ndian', subdivisions: ['Ekondo-Titi', 'Isangele', 'Kombo-Abedimo', 'Kombo-Itindi', 'Mundemba'] },
                ]
            },
        ];

        // Step 1: upsert all regions (10 queries)
        const regionMap = new Map<string, string>(); // name → id
        for (const regionData of regionsData) {
            const region = await prisma.region.upsert({
                where: { name: regionData.name },
                update: {},
                create: { name: regionData.name },
            });
            regionMap.set(regionData.name, region.id);
        }

        // Step 2: upsert all departments (~50 queries)
        type DeptMeta = { id: string; subdivisions: string[] };
        const deptMap = new Map<string, DeptMeta>(); // "regionId|deptName" → meta
        for (const regionData of regionsData) {
            const regionId = regionMap.get(regionData.name)!;
            for (const deptData of regionData.departments) {
                const department = await prisma.department.upsert({
                    where: { regionId_name: { regionId, name: deptData.name } },
                    update: {},
                    create: { name: deptData.name, regionId },
                });
                deptMap.set(`${regionId}|${deptData.name}`, {
                    id: department.id,
                    subdivisions: deptData.subdivisions,
                });
            }
        }

        // Step 3: batch-create subdivisions per department (one query each, skipDuplicates)
        for (const meta of deptMap.values()) {
            await prisma.subdivision.createMany({
                data: meta.subdivisions.map(name => ({
                    name,
                    departmentId: meta.id,
                })),
                skipDuplicates: true,
            });
        }
        console.log('   ✅ All regions, departments, and subdivisions created');

        // ==================== EXISTING SEED DATA (Users, Companies, etc.) ====================

        // Create users for testing
        console.log('👥 Creating test users...');

        const centralUser = await prisma.user.upsert({
            where: { email: 'central@ministry.cm' },
            update: {},
            create: {
                email: 'central@ministry.cm',
                firstName: 'Paul',
                lastName: 'Biya',
                passwordHash: await bcrypt.hash('password123', 10),
                role: 'CENTRAL',
                region: null,
                department: null,
            },
        });

        const regionalUser = await prisma.user.upsert({
            where: { email: 'regional.centre@ministry.cm' },
            update: {},
            create: {
                email: 'regional.centre@ministry.cm',
                firstName: 'Jean',
                lastName: 'Nkuéta',
                passwordHash: await bcrypt.hash('password123', 10),
                role: 'REGIONAL',
                region: 'Centre',
                department: null,
            },
        });

        const divisionalUser = await prisma.user.upsert({
            where: { email: 'divisional.mfoundi@ministry.cm' },
            update: {},
            create: {
                email: 'divisional.mfoundi@ministry.cm',
                firstName: 'Marie',
                lastName: 'Ebanda',
                passwordHash: await bcrypt.hash('password123', 10),
                role: 'DIVISIONAL',
                region: 'Centre',
                department: 'Mfoundi',
            },
        });

        // Create sample companies
        console.log('🏢 Creating sample companies...');

        const companies = [];
        const sectorList = await prisma.sector.findMany();
        const regionList = await prisma.region.findMany();
        const departmentList = await prisma.department.findMany();

        for (let i = 1; i <= 20; i++) {
            const region = regionList[Math.floor(Math.random() * regionList.length)];
            const department = departmentList[Math.floor(Math.random() * departmentList.length)];
            const sector = sectorList[Math.floor(Math.random() * sectorList.length)];

            const companyUser = await prisma.user.create({
                data: {
                    email: `company${i}@example.cm`,
                    firstName: `Company`,
                    lastName: `${i}`,
                    passwordHash: await bcrypt.hash('password123', 10),
                    role: 'COMPANY',
                    region: region.name,
                    department: department.name,
                },
            });

            const company = await prisma.company.create({
                data: {
                    userId: companyUser.id,
                    name: `${sector.name} Company ${i}`,
                    mainActivity: sector.name,
                    secondaryActivity: 'General Services',
                    region: region.name,
                    department: department.name,
                    district: 'Yaoundé',
                    address: `P.O. Box ${1000 + i}, Yaoundé`,
                    taxNumber: `CT${String(i).padStart(6, '0')}`,
                    cnpsNumber: `CN${String(i).padStart(6, '0')}`,
                    socialCapital: 50000000 + i * 1000000,
                    totalEmployees: 50 + i * 10,
                    menCount: Math.floor((50 + i * 10) * 0.65),
                    womenCount: Math.floor((50 + i * 10) * 0.35),
                    lastYearTotal: 40 + i * 8,
                },
            });

            companies.push(company);
        }

        // Create declarations for 2024
        console.log('📋 Creating sample declarations...');

        for (const company of companies) {
            const totalEmployees = 50 + Math.floor(Math.random() * 200);
            const males = Math.floor(totalEmployees * 0.65);
            const females = totalEmployees - males;

            const declaration = await prisma.declaration.create({
                data: {
                    year: 2024,
                    fillingDate: new Date(),
                    companyId: company.id,
                    region: company.region,
                    division: company.department,
                    status: (['DRAFT', 'SUBMITTED', 'DIVISION_APPROVED', 'REGION_APPROVED', 'FINAL_APPROVED'] as const)[Math.floor(Math.random() * 5)],
                    submittedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                },
            });

            // Add employees
            const employees = [];
            for (let j = 0; j < totalEmployees; j++) {
                employees.push({
                    declarationId: declaration.id,
                    fullName: `Employee ${j + 1}`,
                    gender: Math.random() > 0.35 ? 'M' : 'F',
                    age: 25 + Math.floor(Math.random() * 35),
                    nationality: 'Cameroonian',
                    diploma: ['CEP', 'BEPC', 'Baccalauréat', 'Licence', 'Master'][Math.floor(Math.random() * 5)],
                    function: ['Ouvrier', 'Employé', 'Superviseur', 'Cadre', 'Direction'][Math.floor(Math.random() * 5)],
                    seniority: Math.floor(Math.random() * 20),
                    salaryCategory: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'][Math.floor(Math.random() * 12)],
                });
            }
            await prisma.employee.createMany({ data: employees });

            // Add movements
            await prisma.declarationMovement.createMany({
                data: [
                    {
                        declarationId: declaration.id,
                        movementType: 'RECRUITMENT',
                        cat1_3: Math.floor(Math.random() * 10),
                        cat4_6: Math.floor(Math.random() * 15),
                        cat7_9: Math.floor(Math.random() * 8),
                        cat10_12: Math.floor(Math.random() * 5),
                        catNonDeclared: 0,
                    },
                    {
                        declarationId: declaration.id,
                        movementType: 'DISMISSAL',
                        cat1_3: Math.floor(Math.random() * 3),
                        cat4_6: Math.floor(Math.random() * 5),
                        cat7_9: Math.floor(Math.random() * 3),
                        cat10_12: Math.floor(Math.random() * 2),
                        catNonDeclared: 0,
                    },
                    {
                        declarationId: declaration.id,
                        movementType: 'RETIREMENT',
                        cat1_3: 0,
                        cat4_6: Math.floor(Math.random() * 2),
                        cat7_9: Math.floor(Math.random() * 3),
                        cat10_12: Math.floor(Math.random() * 2),
                        catNonDeclared: 0,
                    },
                ],
            });

            // Add qualitative answers
            await prisma.qualitativeQuestion.create({
                data: {
                    declarationId: declaration.id,
                    questionType: 'QUALITATIVE',
                    section: 'GENERAL',
                    questionText: 'Informations qualitatives',
                    hasTrainingCenter: Math.random() > 0.5,
                    trainingCenterDetails: 'In-house training program',
                    recruitmentPlansNext: Math.random() > 0.4,
                    recruitmentPlanCount: Math.floor(Math.random() * 50),
                    camerounisationPlan: Math.random() > 0.3,
                    usesTempAgencies: Math.random() > 0.6,
                    temporaryWorkerCount: Math.floor(Math.random() * 20),
                },
            });

            // Add validation steps
            await prisma.validationStep.createMany({
                data: [
                    { declarationId: declaration.id, stepType: 'GENDER_SUM', isValid: true },
                    { declarationId: declaration.id, stepType: 'CATEGORY_SUM', isValid: true },
                    { declarationId: declaration.id, stepType: 'MOVEMENT_CONSISTENCY', isValid: true },
                    { declarationId: declaration.id, stepType: 'WORKFORCE_GROWTH', isValid: true },
                    { declarationId: declaration.id, stepType: 'EMPLOYEE_VALIDATION', isValid: true },
                ],
            });

            // Log audit
            await prisma.auditLog.create({
                data: {
                    userId: company.userId,
                    declarationId: declaration.id,
                    action: 'CREATE',
                    resourceType: 'Declaration',
                    resourceId: declaration.id,
                    details: 'Declaration created for year 2024',
                },
            });
        }

        // Create sample notifications
        console.log('📧 Creating sample notifications...');

        const notification = await prisma.notification.create({
            data: {
                sentBy: centralUser.id,
                regionFilter: 'Centre',
                departmentFilter: null,
                subject: 'Rappel: Échéance de soumission DSM-O 2024',
                message: 'Veuillez soumettre votre Déclaration sur la Situation de la Main d\'Œuvre avant le 31 décembre 2024.',
                recipientCount: 8,
            },
        });

        // Create notification recipients
        for (let i = 0; i < 8; i++) {
            await prisma.notificationRecipient.create({
                data: {
                    notificationId: notification.id,
                    companyId: companies[i].id,
                    email: `company${i + 1}@example.cm`,
                    status: 'SENT',
                    sentAt: new Date(),
                    openedAt: Math.random() > 0.3 ? new Date() : null,
                },
            });
        }

        // Create analytics snapshots for multiple years
        console.log('📊 Creating analytics snapshots...');

        const years = [2022, 2023, 2024];
        for (const year of years) {
            await prisma.analyticsSnapshot.create({
                data: {
                    year,
                    region: 'Centre',
                    totalEmployment: 150000 + year * 5000,
                    maleEmployment: 95000 + year * 3000,
                    femaleEmployment: 55000 + year * 2000,
                    totalRecruitment: 10000 + year * 500,
                    totalDismissals: 2000 + year * 100,
                    companiesSubmitted: 340 + year * 10,
                    companiesApproved: 320 + year * 8,
                    companiesPending: 20,
                },
            });
        }

        console.log('\n✅ Database seed completed successfully!\n');
        console.log('📝 Test Credentials:');
        console.log('   CENTRAL User:     central@ministry.cm / password123');
        console.log('   REGIONAL User:    regional.centre@ministry.cm / password123');
        console.log('   DIVISIONAL User:  divisional.mfoundi@ministry.cm / password123');
        console.log('   COMPANY Users:    company1@example.cm ... company20@example.cm / password123\n');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seed();