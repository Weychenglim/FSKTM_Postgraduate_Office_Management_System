import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const registry = readFileSync(resolve('src/components/StudentRegistry.tsx'), 'utf8');

assert.match(registry, /accept="\.csv,\.xlsx"/, 'bulk import must accept CSV and XLSX');
assert.match(registry, /previewStudentImport\(/, 'preview must be checked by the server');
assert.match(registry, /commitStudentImport\(/, 'commit must go through the import endpoint');
assert.doesNotMatch(registry, /parseStudentCsv|revalidateRows/, 'rows are validated on the server');

for (const fabricated of [
  'Intake_Sem1_2023.csv',
  'Late_Registrations_Oct.csv',
  'student_registry_intake_sem1_2025.csv',
  'Security Clean',
  'Cryptographic validation',
  'programme_mapped',
  'Historical log archive',
]) {
  assert.ok(!registry.includes(fabricated), `fabricated import content returned: ${fabricated}`);
}

console.log('Registry import integration checks passed.');
