import { registrationDuplicateIds, type RegistrationDuplicateRow } from './registration-duplicates';

function row(partial: Partial<RegistrationDuplicateRow> & Pick<RegistrationDuplicateRow, 'id'>): RegistrationDuplicateRow {
  return {
    taxNumber: partial.taxNumber ?? `NIU-${partial.id}`,
    cnpsNumber: partial.cnpsNumber ?? null,
    name: partial.name ?? partial.id,
    subdivisionId: partial.subdivisionId ?? null,
    ...partial,
  };
}

describe('registrationDuplicateIds', () => {
  it('includes both files that share an NIU and leaves a unique NIU out', () => {
    const rows = [
      row({ id: 'a', taxNumber: 'M123', name: 'Alpha' }),
      row({ id: 'b', taxNumber: 'M123', name: 'Beta' }),
      row({ id: 'c', taxNumber: 'M999', name: 'Seule' }),
    ];
    const ids = registrationDuplicateIds(rows);
    expect(ids).toEqual(['a', 'b']);
  });

  it('does not treat an NA- placeholder as an NIU, even when two files carry the same one', () => {
    const rows = [
      row({ id: 'a', taxNumber: 'NA-111', name: 'Alpha' }),
      row({ id: 'b', taxNumber: 'NA-111', name: 'Beta' }),
      row({ id: 'c', taxNumber: 'NA-', name: 'Gamma' }),
    ];
    expect(registrationDuplicateIds(rows)).toEqual([]);
  });

  it('includes files that share a CNPS number', () => {
    const rows = [
      row({ id: 'a', cnpsNumber: 'CNPS-9' }),
      row({ id: 'b', cnpsNumber: 'CNPS-9' }),
      row({ id: 'c', cnpsNumber: 'CNPS-1' }),
    ];
    expect(registrationDuplicateIds(rows)).toEqual(['a', 'b']);
  });

  it('folds the name within one subdivision and keeps the same name in another subdivision', () => {
    const rows = [
      row({ id: 'a', name: 'Menuiserie', subdivisionId: 'wouri' }),
      row({ id: 'b', name: 'menuiserie', subdivisionId: 'wouri' }),
      row({ id: 'c', name: 'Menuiserie', subdivisionId: 'dla' }),
      row({ id: 'd', name: 'École', subdivisionId: 'wouri' }),
      row({ id: 'e', name: 'école', subdivisionId: 'wouri' }),
      row({ id: 'f', name: 'Ecole', subdivisionId: 'wouri' }),
    ];
    expect(registrationDuplicateIds(rows)).toEqual(['a', 'b', 'd', 'e']);
  });
});
