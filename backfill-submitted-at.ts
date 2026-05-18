import { PrismaClient, DeclarationStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function backfill() {
  const declarations = await prisma.declaration.findMany({
    where: {
      status: DeclarationStatus.FINAL_APPROVED,
      submittedAt: null,
    },
  });
  for (const decl of declarations) {
    const year = decl.year;
    const randomDay = new Date(year, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    await prisma.declaration.update({
      where: { id: decl.id },
      data: { submittedAt: randomDay },
    });
  }
  console.log(`✅ Updated ${declarations.length} declarations.`);
}
backfill();
