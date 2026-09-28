import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/patient-medicines.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const medicines = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('normalizes a new patient medicine without accepting ownership fields', () => {
  assert.deepEqual(medicines.parseNewMedicine({ medicine_name: ' Warfarin ', dosage: ' 5 mg ', frequency: '', notes: '' }), { medicine_name: 'Warfarin', dosage: '5 mg', frequency: null, notes: null, started_at: null });
  assert.throws(() => medicines.parseNewMedicine({ medicine_name: 'Warfarin', patient_id: 'forged' }));
});

test('medicine updates preserve omitted fields and reject deletion states', () => {
  assert.deepEqual(medicines.parseMedicineUpdate({ status: 'discontinued' }), { status: 'discontinued' });
  assert.deepEqual(medicines.parseMedicineUpdate({ dosage: '' }), { dosage: null });
  assert.throws(() => medicines.parseMedicineUpdate({ status: 'deleted' }));
  assert.throws(() => medicines.parseMedicineUpdate({}));
});

test('rejects invalid or future medicine start dates', () => {
  assert.throws(() => medicines.parseNewMedicine({ medicine_name: 'Warfarin', started_at: '2026-02-30' }));
  assert.throws(() => medicines.parseNewMedicine({ medicine_name: 'Warfarin', started_at: '2099-01-01' }));
});
