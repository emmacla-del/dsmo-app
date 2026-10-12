import { Controller, Get } from '@nestjs/common';
import { CampaignService } from './campaign.service';

/**
 * The one campaign fact an anonymous visitor may read: which collections are
 * open, and when they close.
 *
 * The front door at react-web "/" has to tell an employer when their
 * declaration is due — the single most actionable thing on that page — and it
 * is reached before anyone signs in. Every route on CampaignController sits
 * behind JwtAuthGuard, so there was no way to say it without inventing a date
 * in the copy.
 *
 * This is a separate controller rather than an exemption on that one, because
 * there is no @Public() mechanism in this codebase: guards are applied per
 * controller with @UseGuards. Carving a hole in the guarded controller would
 * mean every future route there is public until someone remembers otherwise.
 * Here the absence of guards is the whole point of the file, and the path
 * says so out loud.
 *
 * ThrottlerGuard still applies — it is registered globally as APP_GUARD.
 *
 * What is exposed is deliberately the minimum: the module, the reference year
 * and the closing date. No id, no code, no name or description (admin-authored
 * free text), and above all no targeting — targetRegions, targetDepartments
 * and targetEntityTypes describe who the administration has decided to survey,
 * which is not public information.
 */
@Controller('public/campaigns')
export class PublicCampaignController {
    constructor(private campaignService: CampaignService) {}

    @Get('open')
    async listOpenCampaigns() {
        return this.campaignService.listOpenCampaignsForPublic();
    }
}
