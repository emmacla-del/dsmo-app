import { CanonicalSchemaAdapterService, AnalyticalVariableDefinition } from './src/data-management/canonical-schema-adapter.service';
import { OnefopSchemaLoaderService } from './src/onefop-schema-validation/onefop-schema-loader.service';

const loader = new OnefopSchemaLoaderService();
const adapter = new CanonicalSchemaAdapterService(loader);

console.log('=== STARTING EXHAUSTIVE DATA SURVIVAL AUDIT ===');

const allVars = adapter.getAllVariables();
const demandVars = adapter.getVariablesForPartition('DEMAND');
const tvetVars = adapter.getVariablesForPartition('TVET');

// 1. Variable Name Audit
console.log('\n--- 1. SPSS Variable Name & Type Audit ---');
let longNames = 0;
let invalidRegexNames = 0;
let dupNames = 0;
const seen = new Set<string>();

for (const v of allVars) {
  if (v.variableName.length > 64) longNames++;
  if (!/^[A-Za-z_@][A-Za-z0-9_@#$]*$/.test(v.variableName)) invalidRegexNames++;
  const lower = v.variableName.toLowerCase();
  if (seen.has(lower)) dupNames++;
  seen.add(lower);
}
console.log(`Total Variables: ${allVars.length}`);
console.log(`Long Names (>64 chars): ${longNames}`);
console.log(`Invalid Regex Names: ${invalidRegexNames}`);
console.log(`Duplicate Names (case-insensitive): ${dupNames}`);

// 2. Syntax vs CSV Column Alignment Audit
console.log('\n--- 2. SPSS Syntax vs CSV Column Alignment Audit ---');
for (const partition of ['DEMAND', 'TVET', 'ALL'] as const) {
  const vars = adapter.getVariablesForPartition(partition);
  const syntax = adapter.buildSpssSyntax(vars, 'test.csv');

  // Parse variables from GET DATA block (ends at /MAP.)
  const varBlockMatch = syntax.match(/\/VARIABLES=\r?\n([\s\S]*?)(?=\r?\n\s*\/MAP\.)/);
  if (!varBlockMatch) {
    console.error(`FAILED to find /VARIABLES= block for partition ${partition}`);
    continue;
  }
  const syntaxVars = varBlockMatch[1]
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((v) => v.length > 0);

  const csvCols = vars.map((v) => v.variableName);

  const missingInSyntax = csvCols.filter((c, i) => syntaxVars[i] !== c);
  const lenDiff = csvCols.length !== syntaxVars.length;

  console.log(`Partition ${partition}: CSV columns = ${csvCols.length}, Syntax variables = ${syntaxVars.length}, Exact positional match = ${!lenDiff && missingInSyntax.length === 0}`);
  if (missingInSyntax.length > 0) {
    console.error(`Discrepancies in ${partition}:`, missingInSyntax.slice(0, 5));
  }
}

// 3. Matrix Position & Transpose Guard Test
console.log('\n--- 3. Matrix Position & Dimension Disambiguation Test ---');
// Populate every cell of a multi-dimensional table (e.g. S21Q01: 4 rows x 12 cols = 48 cells) with a unique sentinel value
const s21q01Vars = allVars.filter((v) => v.sourcePath.startsWith('matrix.S21Q01.'));
const sentinelsByCell: Record<string, number> = {};
let val = 1001;
for (const v of s21q01Vars) {
  sentinelsByCell[v.variableName] = val++;
}

// Test with flat rawData
const rawSub = { rawData: sentinelsByCell };
let rawMismatches = 0;
for (const v of s21q01Vars) {
  const extracted = adapter.extractValue(v, rawSub);
  if (extracted !== sentinelsByCell[v.variableName]) {
    rawMismatches++;
    console.error(`Matrix position mismatch for ${v.variableName}: expected ${sentinelsByCell[v.variableName]}, got ${extracted}`);
  }
}
console.log(`S21Q01 (48 cells) Matrix Position Integrity: ${rawMismatches === 0 ? 'PASSED (Zero Transpose/Shift)' : 'FAILED'}`);

// 4. End-to-End CSV Formatting & Serialization Test
console.log('\n--- 4. End-to-End CSV Formatting & Round-Trip Test ---');
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Construct a test record with explicit 0, blank, strings with commas/quotes, negative numbers
const testRecord = {
  submissionId: 'SUB-CSV-TEST',
  status: 'APPROVED',
  surveyYear: 2026,
  quarterCode: '2026-T1',
  formType: 'ENTREPRISE',
  submissionDate: new Date('2026-03-25T12:00:00Z'),
  company: {
    name: 'Company, with "Quotes" and commas',
    taxNumber: 'M001',
    region: 'CENTRE',
  },
  respondent: {
    respondentName: 'Doe, John "Senior"',
    phone1: '699112233',
  },
  enterpriseDetail: {
    legalStatus: 'SARL',
  },
  rawData: {
    S21Q01_RESPONSE_STATUS: 'REPORTED',
    s21q01_cadres_male_15_24: 0,        // Explicit zero
    s21q01_cadres_male_25_34: 42,       // Positive number
    // s21q01_cadres_female_15_24: MISSING / BLANK
  },
};

const dVars = adapter.getVariablesForPartition('DEMAND');
const csvRowValues = dVars.map((v) => csvEscape(adapter.extractValue(v, testRecord)));
const csvLine = csvRowValues.join(',');

// Independently parse CSV row
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
  }
  result.push(cur);
  return result;
}

const parsedCols = parseCsvLine(csvLine);
console.log(`Generated CSV columns: ${csvRowValues.length}, Parsed CSV columns: ${parsedCols.length}`);
console.log(`Column count match: ${csvRowValues.length === parsedCols.length}`);

// Verify explicit zero in CSV
const zeroIdx = dVars.findIndex((v) => v.variableName === 's21q01_cadres_male_15_24');
console.log(`Explicit Zero Variable: index = ${zeroIdx}, header = ${dVars[zeroIdx].variableName}, parsed value = "${parsedCols[zeroIdx]}" (strictly "0": ${parsedCols[zeroIdx] === '0'})`);

// Verify positive number in CSV
const numIdx = dVars.findIndex((v) => v.variableName === 's21q01_cadres_male_25_34');
console.log(`Positive Number Variable: index = ${numIdx}, header = ${dVars[numIdx].variableName}, parsed value = "${parsedCols[numIdx]}" (strictly "42": ${parsedCols[numIdx] === '42'})`);

// Verify blank in CSV
const blankIdx = dVars.findIndex((v) => v.variableName === 's21q01_cadres_female_15_24');
console.log(`Blank Variable: index = ${blankIdx}, header = ${dVars[blankIdx].variableName}, parsed value = "${parsedCols[blankIdx]}" (strictly "": ${parsedCols[blankIdx] === ''})`);

// Verify escaped string in CSV
const nameIdx = dVars.findIndex((v) => v.variableName === 'companyName');
console.log(`Escaped Company Name: parsed value = '${parsedCols[nameIdx]}' (matched exact: ${parsedCols[nameIdx] === 'Company, with "Quotes" and commas'})`);

// 5. Repeating Tables Preservation Audit
console.log('\n--- 5. Repeating / Variable-Length Tables Audit ---');
const schema = loader.getRoot();
for (const [entityName, entity] of Object.entries(schema.entities)) {
  for (const sec of entity.sections) {
    for (const f of sec.fields) {
      if (f.type === 'repeating_table') {
        console.log(`Repeating Table in ${entityName}: ${sec.id} -> ${f.id} (${(f as any).template ?? f.table?.template})`);
      }
    }
  }
}
