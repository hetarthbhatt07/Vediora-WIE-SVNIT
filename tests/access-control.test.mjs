import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/access-control.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const controls = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('normalizes a doctor access request without accepting identity fields', () => {
  assert.deepEqual(controls.parseAccessRequestInput({ patient_email: ' Patient@Example.COM ', message: ' Follow-up review ' }), { patient_email: 'patient@example.com', message: 'Follow-up review' });
  assert.throws(() => controls.parseAccessRequestInput({ patient_email: 'patient@example.com', doctor_id: 'forged' }));
});

test('accepts only patient-controlled consent transitions', () => {
  for (const action of ['approve', 'deny', 'revoke']) assert.equal(controls.parseAccessResponseInput({ action }), action);
  for (const action of ['delete', 'grant-forever', '']) assert.throws(() => controls.parseAccessResponseInput({ action }));
});

test('validates editable doctor profile fields', () => {
  assert.deepEqual(controls.parseDoctorProfileInput({ full_name: ' Dr Demo ', phone: ' 0000000000 ', date_of_birth: '1986-08-14', gender: 'Male', blood_group: 'O+', height_cm: 178, weight_kg: 74.5, license_number: ' DEMO-GMC-123 ', specialization: '', organization: ' Clinic ' }), {
    full_name: 'Dr Demo', phone: '0000000000', date_of_birth: '1986-08-14', gender: 'Male', blood_group: 'O+', height_cm: 178, weight_kg: 74.5,
    license_number: 'DEMO-GMC-123', specialization: null, organization: 'Clinic',
  });
  assert.throws(() => controls.parseDoctorProfileInput({ full_name: 'Dr Demo', license_number: '', verification_status: 'verified' }));
  assert.throws(() => controls.parseDoctorProfileInput({ full_name: 'Dr Demo', license_number: 'DEMO-1', date_of_birth: '2026-02-30' }));
  assert.throws(() => controls.parseDoctorProfileInput({ full_name: 'Dr Demo', license_number: 'DEMO-1', weight_kg: -1 }));
});
