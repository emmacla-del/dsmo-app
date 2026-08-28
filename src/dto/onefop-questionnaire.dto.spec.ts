import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';
import {
  CooperativeQuestionnaireDto,
  CtdQuestionnaireDto,
  OngQuestionnaireDto,
} from './onefop-questionnaire.dto';

const respondent = {
  name: 'Jean Dupont',
  function: 'DRH',
  phone1: '677123456',
  email: 'jean@coop.cm',
};

const location = {
  area: 1 as const,
  region: 'Littoral',
  department: 'Wouri',
  subdivision: 'Douala I',
  locality: 'Akwa',
  phone1: '233421000',
  poBox: 'BP 12',
  sector: 3 as const,
  branch: 'Services',
};

function paths(errors: ValidationError[], prefix = ''): string[] {
  const out: string[] = [];
  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.constraints) out.push(path);
    if (error.children?.length) out.push(...paths(error.children, path));
  }
  return out;
}

describe('ONEFOP identification DTOs on final submit', () => {
  it('rejects a cooperative that only has a name', async () => {
    const dto = plainToInstance(CooperativeQuestionnaireDto, {
      respondent,
      cooperative: { name: 'COOP TEST' },
    });
    const errors = await validate(dto, { skipMissingProperties: false });
    const missing = paths(errors);
    expect(missing).toEqual(expect.arrayContaining([
      'cooperative.headOffice',
      'cooperative.yearCreated',
      'cooperative.region',
      'cooperative.phone1',
      'cooperative.sector',
      'cooperative.permanentWorkers',
      'cooperative.vacancies',
    ]));
  });

  it('accepts a complete cooperative, including 0 workers and 0 vacancies', async () => {
    const dto = plainToInstance(CooperativeQuestionnaireDto, {
      respondent,
      cooperative: {
        ...location,
        name: 'COOP TEST',
        headOffice: 'Douala',
        yearCreated: 2010,
        mainActivity: 'Collecte',
        type: 1,
        permanentWorkers: 0,
        vacancies: 0,
      },
    });
    expect(await validate(dto, { skipMissingProperties: false })).toEqual([]);
  });

  it('requires typeOther when cooperative type is Other', async () => {
    const dto = plainToInstance(CooperativeQuestionnaireDto, {
      respondent,
      cooperative: {
        ...location,
        name: 'COOP TEST',
        headOffice: 'Douala',
        yearCreated: 2010,
        mainActivity: 'Collecte',
        type: 3,
        permanentWorkers: 1,
        vacancies: 0,
      },
    });
    expect(paths(await validate(dto, { skipMissingProperties: false })))
      .toContain('cooperative.typeOther');
  });

  it('rejects a CTD that only has a type', async () => {
    const dto = plainToInstance(CtdQuestionnaireDto, {
      respondent,
      ctd: { type: 1 },
    });
    const missing = paths(await validate(dto, { skipMissingProperties: false }));
    expect(missing).toEqual(expect.arrayContaining([
      'ctd.yearCreated',
      'ctd.region',
      'ctd.phone1',
      'ctd.sector',
      'ctd.permanentWorkers',
      'ctd.vacancies',
    ]));
    expect(missing).not.toContain('ctd.councilType');
  });

  it('requires councilType when CTD type is Commune/Council', async () => {
    const dto = plainToInstance(CtdQuestionnaireDto, {
      respondent,
      ctd: {
        ...location,
        type: 2,
        yearCreated: 2008,
        permanentWorkers: 4,
        vacancies: 1,
      },
    });
    expect(paths(await validate(dto, { skipMissingProperties: false })))
      .toContain('ctd.councilType');
  });

  it('does not require councilType when CTD type is Region', async () => {
    const dto = plainToInstance(CtdQuestionnaireDto, {
      respondent,
      ctd: {
        ...location,
        type: 1,
        yearCreated: 2008,
        permanentWorkers: 4,
        vacancies: 0,
      },
    });
    expect(paths(await validate(dto, { skipMissingProperties: false })))
      .not.toContain('ctd.councilType');
  });

  it('rejects an NGO that only has a name', async () => {
    const dto = plainToInstance(OngQuestionnaireDto, {
      respondent,
      ong: { name: 'ONG TEST' },
    });
    expect(paths(await validate(dto, { skipMissingProperties: false }))).toEqual(
      expect.arrayContaining([
        'ong.headOffice',
        'ong.yearCreated',
        'ong.region',
        'ong.phone1',
        'ong.mainMission',
        'ong.permanentWorkers',
        'ong.vacancies',
      ]),
    );
  });

  it('still allows a name-only cooperative as a draft', async () => {
    const dto = plainToInstance(CooperativeQuestionnaireDto, {
      respondent,
      cooperative: { name: 'COOP DRAFT' },
    });
    expect(await validate(dto, { skipMissingProperties: true })).toEqual([]);
  });
});
