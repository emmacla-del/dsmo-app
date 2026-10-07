// src/common/i18n/localized-http-exception.filter.ts
//
// Translates the message of every HttpException the API sends to the
// language the client asked for with the X-Locale header (French when the
// header is absent, so a client that never sends it -- the Flutter app until
// it does -- sees exactly what it saw before). The status code and every
// other field of the body (missingFields, code, ...) are left as they are;
// only `message` changes, whether it is a string or an array of strings.
//
// Not Accept-Language: browsers send that one by themselves, so the Flutter
// web app would start switching language with the browser while its own UI
// stays in French. X-Locale is sent only by a client that means it.
//
// Exceptions that are not HttpException (a crash) are not caught here and
// keep Nest's default handling.
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { errorLocaleFrom, translateErrorMessage, type ErrorLocale } from './error-messages';

export const LOCALE_HEADER = 'x-locale';

export function localizeErrorBody(body: unknown, locale: ErrorLocale): unknown {
  if (typeof body === 'string') return translateErrorMessage(body, locale);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const record = body as Record<string, unknown>;
  if (!('message' in record)) return body;
  const message = record.message;
  return {
    ...record,
    message: Array.isArray(message)
      ? message.map((m) => (typeof m === 'string' ? translateErrorMessage(m, locale) : m))
      : typeof message === 'string'
        ? translateErrorMessage(message, locale)
        : message,
  };
}

@Catch(HttpException)
export class LocalizedHttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const status = exception.getStatus();
    const locale = errorLocaleFrom(request?.headers?.[LOCALE_HEADER]);
    const raw = exception.getResponse();
    // Nest's own shape for a string message is { statusCode, message };
    // keep it so clients reading `message` see no difference.
    const body = typeof raw === 'string' ? { statusCode: status, message: raw } : raw;
    response.status(status).json(localizeErrorBody(body, locale));
  }
}
