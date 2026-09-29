import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/medicine-chat.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const chat = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const catalog = [
  { drug_id: 1, generic_name: 'warfarin', brand_name: 'Coumadin', ingredient_name: 'warfarin' },
  { drug_id: 2, generic_name: 'argatroban', brand_name: null, ingredient_name: 'argatroban' },
  { drug_id: 3, generic_name: 'metformin', brand_name: 'Glucophage', ingredient_name: 'metformin' },
  { drug_id: 4, generic_name: 'acetylsalicylic acid', brand_name: 'Acetylsalicylic Acid', ingredient_name: 'acetylsalicylic acid' },
];

test('finds generic and brand medicine names without substring false positives', () => {
  assert.deepEqual(chat.findMentionedMedicines('Can I take Coumadin with argatroban?', catalog).map(item => item.id), [2, 1]);
  assert.equal(chat.findMentionedMedicines('This is an argument about medicine.', catalog).length, 0);
});

test('maps the patient term aspirin to the imported acetylsalicylic acid record', () => {
  const medicines = chat.findMentionedMedicines('Does aspirin and warfarin help me?', catalog);
  assert.deepEqual(medicines.map(item => item.id), [4, 1]);
  assert.equal(medicines[0].matchedAlias, 'aspirin');
  assert.match(chat.medicineLabel(medicines[0]), /Aspirin \(acetylsalicylic acid\)/);
});

test('rejects unsupported fields and excessive questions', () => {
  assert.throws(() => chat.parseMedicineQuestion({ message: 'warfarin', patient_id: 10 }));
  assert.throws(() => chat.parseMedicineQuestion({ message: 'x'.repeat(2001) }));
});

test('recognizes short detail requests as conversation follow-ups', () => {
  for (const message of ['Explain in detail', 'in detail', 'tell me more', 'what are the side effects?', '?']) {
    assert.equal(chat.referencesMedicineConversation(message), true, message);
  }
  assert.equal(chat.referencesMedicineConversation('What is diabetes?'), false);
});

test('never describes a missing interaction row as proof of safety', () => {
  const medicines = chat.findMentionedMedicines('warfarin and metformin', catalog);
  const answer = chat.makePatientAnswer(medicines, [], ['metformin + warfarin']);
  assert.match(answer, /does not confirm that they are safe together/i);
  assert.match(answer, /doctor or pharmacist/i);
});

test('explains interaction severity without claiming the medicines cure a condition', () => {
  const medicines = chat.findMentionedMedicines('aspirin and warfarin', catalog);
  const answer = chat.makePatientAnswer(medicines, [{ severity: 'Major' }], []);
  assert.match(answer, /highest recorded severity is Major/i);
  assert.match(answer, /cannot tell whether these medicines will treat or cure/i);
});
