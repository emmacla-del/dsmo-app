import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Starting database seed...\n');

    try {
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
                region: 'Région Centre',
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
                region: 'Région Centre',
                department: 'Division Mfoundi',
            },
        });

        // Create sample companies
        console.log('🏢 Creating sample companies...');

        const companies = [];
        const regions = ['Région Centre', 'Région Littoral', 'Région Ouest'];
        const departments = ['Division Mfoundi', 'Division Nyong et Kéllé', 'Division Boumyebel'];
        const sectors = ['Manufacturing', 'Agriculture', 'Healthcare', 'Retail', 'Technology', 'Construction'];

        for (let i = 1; i <= 20; i++) {
            const region = regions[Math.floor(Math.random() * regions.length)];
            const department = departments[Math.floor(Math.random() * departments.length)];
            const sector = sectors[Math.floor(Math.random() * sectors.length)];

            const companyUser = await prisma.user.create({
                data: {
                    email: `company${i}@example.cm`,
                    firstName: `Company`,
                    lastName: `${i}`,
                    passwordHash: await bcrypt.hash('password123', 10),
                    role: 'COMPANY',
                    region: region,
                    department: department,
                },
            });

            const company = await prisma.company.create({
                data: {
                    userId: companyUser.id,
                    name: `${sector} Company ${i}`,
                    mainActivity: sector,
                    secondaryActivity: 'General Services',
                    region: region,
                    department: department,
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
                    companyId: company.id,
                    region: company.region,
                    division: company.department,
                    status: ['DRAFT', 'SUBMITTED', 'DIVISION_APPROVED', 'REGION_APPROVED', 'FINAL_APPROVED'][Math.floor(Math.random() * 5)],
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
                    nationality: 'Camerounian',
                    diploma: ['CEP', 'BEPC', 'Baccalauréat', 'Licence', 'Master'][Math.floor(Math.random() * 5)],
                    function: ['Ouvrier', 'Employé', 'Superviseur', 'Cadre', 'Direction'][Math.floor(Math.random() * 5)],
                    seniority: Math.floor(Math.random() * 20),
                    salaryCategory: ['1-3', '4-6', '7-9', '10-12', 'non-declared'][Math.floor(Math.random() * 5)],
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
                    {
                        declarationId: declaration.id,
                        stepType: 'GENDER_SUM',
                        isValid: true,
                    },
                    {
                        declarationId: declaration.id,
                        stepType: 'CATEGORY_SUM',
                        isValid: true,
                    },
                    {
                        declarationId: declaration.id,
                        stepType: 'MOVEMENT_CONSISTENCY',
                        isValid: true,
                    },
                    {
                        declarationId: declaration.id,
                        stepType: 'WORKFORCE_GROWTH',
                        isValid: true,
                    },
                    {
                        declarationId: declaration.id,
                        stepType: 'EMPLOYEE_VALIDATION',
                        isValid: true,
                    },
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
                regionFilter: 'Région Centre',
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
                    region: 'Région Centre',
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
