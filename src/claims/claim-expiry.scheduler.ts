import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuthService } from '../auth/auth.service';
import { QuestionnairesService } from '../questionnaires/questionnaires.service';

/**
 * Claim deadlines (owner, CLAUDE.md §21, 2026-11-09): a claimed registration
 * must be decided within 2 hours of the claim, a claimed submission within 12
 * hours, round the clock. Lists already treat a lapsed claim as free; this
 * sweep releases it in the database and records the miss against the officer
 * who held it, every 5 minutes, so the record exists even when nobody opens
 * the file. The two sweeps run one after the other, never in parallel (the
 * session-mode pool is small), and a failure in one never stops the other.
 */
@Injectable()
export class ClaimExpiryScheduler {
  private readonly logger = new Logger(ClaimExpiryScheduler.name);
  private running = false;

  constructor(
    private readonly auth: AuthService,
    private readonly questionnaires: QuestionnairesService,
  ) {}

  @Cron('*/5 * * * *')
  async sweep(now = new Date()): Promise<{ registrations: number; submissions: number }> {
    // A slow run (cold pool) must not overlap the next one.
    if (this.running) return { registrations: 0, submissions: 0 };
    this.running = true;
    let registrations = 0;
    let submissions = 0;
    try {
      try {
        registrations = await this.auth.expireRegistrationClaims(now);
      } catch (error) {
        this.logger.error(`Registration claim sweep failed: ${(error as Error)?.message ?? error}`);
      }
      try {
        submissions = await this.questionnaires.expireReviewClaims(now);
      } catch (error) {
        this.logger.error(`Submission claim sweep failed: ${(error as Error)?.message ?? error}`);
      }
      if (registrations || submissions) {
        this.logger.log(`Released lapsed claims: ${registrations} registration(s), ${submissions} submission(s).`);
      }
    } finally {
      this.running = false;
    }
    return { registrations, submissions };
  }
}
