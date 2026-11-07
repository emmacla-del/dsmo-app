import { loadRegistrationPeople } from './registration-people';

describe('loadRegistrationPeople', () => {
  it('asks nothing when the page names nobody', async () => {
    const $queryRaw = jest.fn();
    const people = await loadRegistrationPeople({ $queryRaw } as any, [null, undefined, '']);
    expect(people.size).toBe(0);
    expect($queryRaw).not.toHaveBeenCalled();
  });

  it('reads each person once, for the whole page', async () => {
    const person = { id: 'a', firstName: 'Awa', lastName: null, email: 'a@x.cm' };
    const $queryRaw = jest.fn(async (_query: any) => [person]);
    const people = await loadRegistrationPeople({ $queryRaw } as any, ['a', null, 'a', 'b']);
    expect($queryRaw).toHaveBeenCalledTimes(1);
    expect($queryRaw.mock.calls[0][0].values).toEqual(['a', 'b']);
    expect(people.get('a')).toEqual(person);
    expect(people.has('b')).toBe(false);
  });

  it('does not filter on archive state: a file keeps naming who handled it', async () => {
    const $queryRaw = jest.fn(async (_query: any) => []);
    await loadRegistrationPeople({ $queryRaw } as any, ['a']);
    expect($queryRaw.mock.calls[0][0].sql).not.toContain('archivedAt');
  });
});
