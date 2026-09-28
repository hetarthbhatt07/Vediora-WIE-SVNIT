import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/patient-profile.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { parseProfileInput } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('optional details stay absent and values are normalized', () => {
  const data = parseProfileInput({ full_name: '  Synthetic Patient ', weight_kg: 65.5 });
  assert.equal(data.full_name, 'Synthetic Patient'); assert.equal(data.weight_kg, 65.5); assert.equal(data.date_of_birth, null);
});
test('caller cannot submit another identity or assign a role', () => {
  for (const key of ['id', 'patient_id', 'role', 'password_hash']) assert.throws(() => parseProfileInput({ full_name: 'Test', [key]: 'forged' }));
});
test('invalid dates, measurements and blood groups are rejected', () => {
  for (const patch of [{ date_of_birth: '2026-02-30' }, { date_of_birth: '2099-01-01' }, { weight_kg: -1 }, { height_cm: 400 }, { weight_kg: true }, { blood_group: 'XX' }]) assert.throws(() => parseProfileInput({ full_name: 'Test', ...patch }));
});
