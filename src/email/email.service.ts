import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import type { ErrorResponse } from 'resend';

const RESEND_FROM = 'DSMO Digital <noreply@dsmo-digital.com>';

// Error codes Resend returns for a bad/missing key or an unverified sending
// domain — distinct from transient failures, since the fix is "check the
// Resend dashboard," not "retry."
const RESEND_AUTH_OR_DOMAIN_ERROR_CODES = new Set([
  'missing_api_key',
  'restricted_api_key',
  'invalid_api_key',
  'invalid_from_address',
  'validation_error',
]);

export class EmailSendError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'EmailSendError';
  }
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY is not set — outgoing emails (e.g. admin-issued ' +
          'password reset links) will fail until it is configured.',
      );
    }
    // The Resend constructor throws synchronously on a missing/empty key,
    // which would otherwise crash app bootstrap via Nest's DI container.
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendPasswordResetLink(toEmail: string, resetLink: string): Promise<void> {
    if (!this.resend) {
      throw new EmailSendError(
        'RESEND_API_KEY is not configured; cannot send password reset email.',
      );
    }

    const { error } = await this.resend.emails.send({
      from: RESEND_FROM,
      to: toEmail,
      subject: 'Réinitialisation de votre mot de passe DSMO Digital',
      html: this.buildPasswordResetHtml(resetLink),
    });

    if (error) {
      this.logSendError(toEmail, error);
      throw new EmailSendError(
        `Échec de l'envoi de l'e-mail de réinitialisation à ${toEmail}: ${error.message}`,
        error,
      );
    }
  }

  private logSendError(toEmail: string, error: ErrorResponse): void {
    if (RESEND_AUTH_OR_DOMAIN_ERROR_CODES.has(error.name)) {
      this.logger.error(
        `Resend rejected the send to ${toEmail} (code: ${error.name}) — likely an ` +
          'invalid RESEND_API_KEY or an unverified sending domain. Check the API ' +
          'key and confirm dsmo-digital.com is verified under Domains on the ' +
          `Resend dashboard. Details: ${error.message}`,
      );
      return;
    }
    this.logger.error(
      `Resend failed to send to ${toEmail} (code: ${error.name}): ${error.message}`,
    );
  }

  private buildPasswordResetHtml(resetLink: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
        <h2 style="color: #005F54;">Réinitialisation de mot de passe</h2>
        <p>Bonjour,</p>
        <p>
          Un administrateur de la plateforme <strong>DSMO Digital</strong> a initié
          une réinitialisation de votre mot de passe. Cliquez sur le bouton
          ci-dessous pour choisir un nouveau mot de passe :
        </p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}"
             style="background-color: #005F54; color: #ffffff; padding: 12px 28px;
                    border-radius: 6px; text-decoration: none; font-weight: bold;
                    display: inline-block;">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p style="font-size: 13px; color: #6B7280;">
          Ce lien expire dans <strong>45 minutes</strong> et ne peut être utilisé
          qu'une seule fois. Si vous n'êtes pas à l'origine de cette demande,
          ignorez simplement cet e-mail.
        </p>
        <p style="font-size: 12px; color: #9CA3AF; margin-top: 24px;">
          DSMO Digital · MINEFOP · République du Cameroun
        </p>
      </div>
    `;
  }
}
