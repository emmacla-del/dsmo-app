import { BadRequestException, ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { REGISTRATION_REJECTED_LOGIN_MESSAGE } from '../registration-messages';
import { ESTABLISHMENT_ID_EXHAUSTED_MESSAGE } from '../utils/establishment-id.generator';
import { emptyValueRefusalMessage, verificationRefusalMessage } from '../../auth/registration-verification';
import { ERROR_MESSAGES, errorLocaleFrom, findErrorMessage, translateErrorMessage } from './error-messages';
import { LocalizedHttpExceptionFilter, localizeErrorBody } from './localized-http-exception.filter';

/**
 * The catalogue must cover every message the API can throw. This walks the
 * backend source with the TypeScript compiler, works out every string each
 * `new XxxException(...)` can carry -- literals, templates (with a sample
 * value in each ${...}), string concatenations, both branches of a ternary,
 * the fallback of `a || 'default'`, and same-file `const` messages -- and
 * checks each one has an entry. A new untranslated message fails here.
 */

const SAMPLE = 'VAL';

function forms(node: ts.Node, sf: ts.SourceFile, consts: Map<string, ts.Expression>): string[] | null {
  if (ts.isParenthesizedExpression(node)) return forms(node.expression, sf, consts);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) {
    let out = node.head.text;
    for (const span of node.templateSpans) out += SAMPLE + span.literal.text;
    return [out];
  }
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.PlusToken) {
      const l = forms(node.left, sf, consts);
      const r = forms(node.right, sf, consts);
      if (!l || !r) return null;
      return l.flatMap((a) => r.map((b) => a + b));
    }
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      return forms(node.right, sf, consts);
    }
  }
  if (ts.isConditionalExpression(node)) {
    const a = forms(node.whenTrue, sf, consts);
    const b = forms(node.whenFalse, sf, consts);
    return a && b ? [...a, ...b] : null;
  }
  if (ts.isIdentifier(node) && consts.has(node.text)) return forms(consts.get(node.text)!, sf, consts);
  if (ts.isObjectLiteralExpression(node)) {
    const prop = node.properties.find(
      (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'message',
    );
    // An object with no `message` (e.g. { code: 'COMPANY_NOT_ACTIVE' }) is
    // not translated and needs no entry.
    return prop ? forms(prop.initializer, sf, consts) : [];
  }
  return null;
}

// Arguments that are not statically resolvable, each checked by a test below
// with real values instead.
const RESOLVED_ELSEWHERE = new Set([
  'REGISTRATION_REJECTED_LOGIN_MESSAGE',
  'ESTABLISHMENT_ID_EXHAUSTED_MESSAGE',
  'emptyValueRefusalMessage(emptyRows)',
  'verificationRefusalMessage(missingFlags)',
  'message', // staff-invitation-link boundedInt: callers pass the two range messages
  'dataErrors', // class-validator ValidationError[]: messages are validator defaults
]);

function collect() {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.d.ts')) files.push(full);
    }
  };
  walk(path.join(__dirname, '..', '..'));

  const messages: { where: string; text: string }[] = [];
  const unresolved: string[] = [];
  for (const file of files) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const consts = new Map<string, ts.Expression>();
    const gather = (n: ts.Node) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) consts.set(n.name.text, n.initializer);
      ts.forEachChild(n, gather);
    };
    gather(sf);
    const visit = (n: ts.Node) => {
      if (ts.isNewExpression(n) && /Exception$/.test(n.expression.getText(sf)) && n.arguments?.length) {
        const arg = n.arguments[0];
        const where = `${path.relative(path.join(__dirname, '..', '..'), file)}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
        const found = forms(arg, sf, consts);
        if (found) found.forEach((text) => messages.push({ where, text }));
        else if (!RESOLVED_ELSEWHERE.has(arg.getText(sf))) unresolved.push(`${where}  ${arg.getText(sf).slice(0, 80)}`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return { files: files.length, messages, unresolved };
}

describe('error message catalogue covers the backend', () => {
  const { files, messages, unresolved } = collect();

  it('found the source', () => {
    expect(files).toBeGreaterThan(100);
    expect(messages.length).toBeGreaterThan(250);
  });

  it('every thrown message has a French and an English form', () => {
    const missing = messages.filter((m) => !findErrorMessage(m.text)).map((m) => `${m.where}  ${m.text}`);
    expect(missing).toEqual([]);
  });

  it('every exception argument is understood (or checked by its own test)', () => {
    expect(unresolved).toEqual([]);
  });

  it('messages built by helpers and constants elsewhere are covered too', () => {
    for (const text of [
      REGISTRATION_REJECTED_LOGIN_MESSAGE,
      ESTABLISHMENT_ID_EXHAUSTED_MESSAGE,
      emptyValueRefusalMessage(['cnpsVerified']),
      emptyValueRefusalMessage(['nameVerified', 'cnpsVerified']),
      verificationRefusalMessage(['nameVerified', 'phoneVerified']),
      'La durée doit être comprise entre 1 et 30 jours.',
      "Le nombre d'utilisations doit être compris entre 1 et 200.",
      'name must be a string',
      'year must not be less than 2000',
    ]) {
      expect([text, findErrorMessage(text)]).toEqual([text, expect.anything()]);
    }
  });

  it('no entry is translated into itself by mistake', () => {
    const same = ERROR_MESSAGES.filter((e) => e.fr === e.en).map((e) => e.fr);
    expect(same).toEqual([]);
  });
});

describe('translateErrorMessage', () => {
  it('translates French to English and English to French', () => {
    expect(translateErrorMessage('Le motif de rejet est obligatoire.', 'en')).toBe('A reason for rejection is required.');
    expect(translateErrorMessage('Campaign not found', 'fr')).toBe('Campagne introuvable');
    expect(translateErrorMessage('Le motif de rejet est obligatoire.', 'fr')).toBe('Le motif de rejet est obligatoire.');
  });

  it('carries the variable parts across, in the right places', () => {
    expect(translateErrorMessage("Le département 'Wouri' n'appartient pas à la région 'Centre' (il appartient à la région 'Littoral').", 'en'))
      .toBe("Division 'Wouri' does not belong to region 'Centre' (it belongs to region 'Littoral').");
    expect(translateErrorMessage("Le département 'Wouri' n'appartient pas à la région 'Centre'.", 'en'))
      .toBe("Division 'Wouri' does not belong to region 'Centre'.");
    expect(translateErrorMessage('Trop de tentatives échouées. Réessayez dans 12 minute(s).', 'en'))
      .toBe('Too many failed attempts. Try again in 12 minute(s).');
    expect(translateErrorMessage('email must be an email', 'fr')).toBe('email doit être une adresse e-mail');
  });

  it('splits the messages that were already sent in both languages', () => {
    const both = 'Une déclaration est déjà en cours pour ce trimestre. / A declaration already exists for this quarter.';
    expect(translateErrorMessage(both, 'fr')).toBe('Une déclaration est déjà en cours pour ce trimestre.');
    expect(translateErrorMessage(both, 'en')).toBe('A declaration already exists for this quarter.');
    const missing = 'Informations obligatoires manquantes : Région, NIU. Veuillez compléter le formulaire avant de soumettre. / Missing required information: Région, NIU. Please complete the form before submitting.';
    expect(translateErrorMessage(missing, 'en')).toBe('Missing required information: Région, NIU. Please complete the form before submitting.');
  });

  it('leaves an unknown message untouched', () => {
    expect(translateErrorMessage('Something nobody catalogued', 'fr')).toBe('Something nobody catalogued');
  });
});

describe('errorLocaleFrom', () => {
  it('is English only when asked, French otherwise', () => {
    expect(errorLocaleFrom('en')).toBe('en');
    expect(errorLocaleFrom('EN-gb')).toBe('en');
    expect(errorLocaleFrom('fr')).toBe('fr');
    expect(errorLocaleFrom(undefined)).toBe('fr');
    expect(errorLocaleFrom(['en'])).toBe('en');
    expect(errorLocaleFrom('de')).toBe('fr');
  });
});

describe('LocalizedHttpExceptionFilter', () => {
  function run(exception: HttpException, locale?: string) {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host: any = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: locale ? { 'x-locale': locale } : {} }),
        getResponse: () => ({ status }),
      }),
    };
    new LocalizedHttpExceptionFilter().catch(exception, host);
    return { code: (status.mock.calls[0] as unknown[])[0], body: json.mock.calls[0][0] };
  }

  it('answers in English when the client asks, keeping status and shape', () => {
    const r = run(new BadRequestException('Le motif de rejet est obligatoire.'), 'en');
    expect(r.code).toBe(400);
    expect(r.body).toEqual({ statusCode: 400, message: 'A reason for rejection is required.', error: 'Bad Request' });
  });

  it('answers in French without the header -- including messages that used to be English', () => {
    expect(run(new BadRequestException('Le motif de rejet est obligatoire.')).body.message).toBe('Le motif de rejet est obligatoire.');
    expect(run(new ConflictException('A submission already exists for this quarter')).body.message)
      .toBe('Une soumission existe déjà pour ce trimestre');
  });

  it('keeps the other fields of an object body', () => {
    const r = run(new BadRequestException({ statusCode: 400, message: 'Statut de dossier inconnu.', missingFields: ['a.b'] }), 'en');
    expect(r.body).toEqual({ statusCode: 400, message: 'Unknown file status.', missingFields: ['a.b'] });
  });

  it('translates every string of an array message (validation errors)', () => {
    const r = run(new BadRequestException(['email must be an email', 'name should not be empty']), 'fr');
    expect(r.body.message).toEqual(['email doit être une adresse e-mail', 'name ne doit pas être vide']);
  });

  it('leaves a body without a message alone', () => {
    const r = run(new ForbiddenException({ code: 'COMPANY_NOT_ACTIVE', status: 'PENDING_APPROVAL' }), 'en');
    expect(r.body).toEqual({ code: 'COMPANY_NOT_ACTIVE', status: 'PENDING_APPROVAL' });
  });

  it('localizeErrorBody passes non-object bodies through', () => {
    expect(localizeErrorBody(null, 'en')).toBeNull();
    expect(localizeErrorBody(['raw'], 'en')).toEqual(['raw']);
  });
});
