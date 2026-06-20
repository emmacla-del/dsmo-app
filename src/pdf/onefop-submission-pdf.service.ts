// src/pdf/onefop-submission-pdf.service.ts
//
// Generates (and caches in Supabase Storage) the PDF for an already-submitted
// ONEFOP questionnaire, so admins can download the exact document a
// respondent filed — reusing the same Handlebars/Puppeteer pipeline that
// powers the live "preview" endpoint (questionnaires.controller.ts).

import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OnefopPuppeteerService } from './onefop-puppeteer.service';
import { normalizeFlatKeys } from '../common/normalizers/flat-key-normalizer';
import {
    mapCooperativeData,
    mapEnterpriseData,
    mapCtdData,
    mapOngData,
} from '../services/pdf-data-mapper.service';

// normalizeFlatKeys() branches on the French spelling ('entreprise'), matching
// the convention questionnaires.service.ts uses when persisting formType.
const NORMALIZER_ENTITY_TYPE: Record<string, string> = {
    ENTREPRISE: 'entreprise',
    COOPERATIVE: 'cooperative',
    CTD: 'ctd',
    ONG: 'ong',
};

// The data mappers / .hbs templates use the English spelling ('enterprise').
const MAPPER_ENTITY_TYPE: Record<string, string> = {
    ENTREPRISE: 'enterprise',
    COOPERATIVE: 'cooperative',
    CTD: 'ctd',
    ONG: 'ong',
};

const MAPPERS: Record<string, (f: Record<string, unknown>) => Record<string, unknown>> = {
    enterprise: mapEnterpriseData,
    cooperative: mapCooperativeData,
    ctd: mapCtdData,
    ong: mapOngData,
};

interface SubmissionForPdf {
    id: string;
    formType: string;
    rawData: unknown;
}

@Injectable()
export class OnefopSubmissionPdfService {
    private readonly supabase: SupabaseClient;
    private readonly bucketName = 'dsmo-pdfs';
    private readonly folder = 'onefop';
    private readonly signedUrlExpirySeconds = 7 * 24 * 60 * 60; // 7 days

    constructor(private readonly puppeteerService: OnefopPuppeteerService) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error(
                'Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
            );
        }

        this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    private storagePath(submissionId: string): string {
        return `${this.folder}/${submissionId}.pdf`;
    }

    private async exists(submissionId: string): Promise<boolean> {
        const filename = `${submissionId}.pdf`;
        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .list(this.folder, { search: filename, limit: 1 });

        if (error || !data) return false;
        return data.some((f) => f.name === filename);
    }

    private async generateAndUpload(submission: SubmissionForPdf): Promise<void> {
        const formType = submission.formType?.toUpperCase() ?? 'ENTREPRISE';
        const normalizerKey = NORMALIZER_ENTITY_TYPE[formType] ?? 'entreprise';
        const mapperKey = MAPPER_ENTITY_TYPE[formType] ?? 'enterprise';

        const normalized = normalizeFlatKeys(
            (submission.rawData as Record<string, unknown>) ?? {},
            normalizerKey,
        );
        const mappedData = MAPPERS[mapperKey](normalized);

        const buffer = await this.puppeteerService.generate({
            ...mappedData,
            formType: mapperKey,
        });

        const { error: uploadError } = await this.supabase.storage
            .from(this.bucketName)
            .upload(this.storagePath(submission.id), buffer, {
                contentType: 'application/pdf',
                upsert: true,
            });

        if (uploadError) {
            throw new Error(`Failed to upload ONEFOP submission PDF: ${uploadError.message}`);
        }
    }

    /** Returns a signed URL for the submission's PDF, generating it on first request. */
    async getSignedUrl(submission: SubmissionForPdf): Promise<string> {
        if (!(await this.exists(submission.id))) {
            await this.generateAndUpload(submission);
        }

        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .createSignedUrl(this.storagePath(submission.id), this.signedUrlExpirySeconds);

        if (error || !data) {
            throw new Error(`Failed to generate signed URL: ${error?.message}`);
        }

        return data.signedUrl;
    }
}
