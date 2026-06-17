// src/onefop/submission-rounds.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoundDto } from '../dto/submission-round.dto';

@Injectable()
export class SubmissionRoundsService {
    constructor(private prisma: PrismaService) { }

    async list() {
        return this.prisma.submissionRound.findMany({
            orderBy: { periodStart: 'desc' },
        });
    }

    async create(dto: CreateRoundDto) {
        return this.prisma.submissionRound.create({
            data: {
                quarterCode: dto.quarterCode,
                labelFr: dto.labelFr,
                labelEn: dto.labelEn,
                periodStart: new Date(dto.periodStart),
                periodEnd: new Date(dto.periodEnd),
                deadline: new Date(dto.deadline),
                status: 'DRAFT',
            },
        });
    }

    // Opens the given round and atomically closes any other round that was
    // still OPEN/EXTENDED, so "the active round" always resolves unambiguously.
    async open(id: string, userId: string) {
        const round = await this.prisma.submissionRound.findUnique({ where: { id } });
        if (!round) throw new NotFoundException('Submission round not found');

        return this.prisma.$transaction(async (tx) => {
            await tx.submissionRound.updateMany({
                where: { id: { not: id }, status: { in: ['OPEN', 'EXTENDED'] } },
                data: { status: 'CLOSED', closedAt: new Date(), closedBy: userId },
            });
            return tx.submissionRound.update({
                where: { id },
                data: { status: 'OPEN', openedAt: new Date(), openedBy: userId },
            });
        });
    }

    async close(id: string, userId: string) {
        const round = await this.prisma.submissionRound.findUnique({ where: { id } });
        if (!round) throw new NotFoundException('Submission round not found');

        return this.prisma.submissionRound.update({
            where: { id },
            data: { status: 'CLOSED', closedAt: new Date(), closedBy: userId },
        });
    }

    async getActive() {
        return this.prisma.submissionRound.findFirst({
            where: { status: { in: ['OPEN', 'EXTENDED'] } },
            orderBy: { openedAt: 'desc' },
        });
    }
}
