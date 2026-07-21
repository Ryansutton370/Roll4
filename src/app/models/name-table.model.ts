/**
 * One d100 column from the imported Random Generators spreadsheet (see
 * scripts/import-names.cjs) — e.g. the "German (M)" column on the
 * "European" tab becomes { setName: 'European', tableName: 'German',
 * gender: 'male', entries: [...100 names] }.
 *
 * Despite the name, not every table holds *person* names — the source
 * sheet also has tabs for place names, plant/alchemy-substance names, and
 * villain/profession bynames. NameTable is deliberately generic (a labeled
 * d100 list of strings) so it covers all of them without a separate model
 * per category; entries.length isn't guaranteed to be exactly 100 (a few
 * source columns are still partially filled in).
 */
export interface NameTable {
  id: string;
  setName: string;
  tableName: string;
  gender: 'male' | 'female' | null;
  entries: string[];
}
