export type DiscrepancyCategory =
  | 'type'
  | 'required'
  | 'visibility'
  | 'formula'
  // Classic (non-VT) table cells have no schema-declared type (see the
  // migration plan §2.2's "one real limitation") — these are logged
  // separately and less confidently than the categories above.
  | 'table-cell-type-assumed';

export interface ShadowDiscrepancy {
  category: DiscrepancyCategory;
  fieldId: string;
  message: string;
}

export interface ShadowValidationResult {
  entityType: string;
  fieldsChecked: number;
  discrepancies: ShadowDiscrepancy[];
}
