import { describe, expect, test } from 'bun:test';
import { highestSeverity, parsePrescription, parseReportRequest } from '../lib/prescriptions.ts';

describe('prescription validation', () => {
  test('requires explicit patient confirmation', () => {
    expect(() => parsePrescription({ confirmed: false, items: [{ medicine_name: 'warfarin' }] })).toThrow('Confirm');
  });

  test('accepts multiple reviewed medicines and normalizes empty fields', () => {
    const result = parsePrescription({
      confirmed: true,
      prescriber_name: '',
      prescribed_on: '2026-09-27',
      items: [
        { medicine_name: ' aspirin ', dosage: '75 mg', add_to_profile: true },
        { medicine_name: 'warfarin', frequency: 'daily', add_to_profile: false },
      ],
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].medicine_name).toBe('aspirin');
    expect(result.items[1].dosage).toBeNull();
  });

  test('rejects unsupported report fields and ranks recorded severity', () => {
    expect(() => parseReportRequest({ patient_id: 'other' })).toThrow('Unexpected');
    expect(highestSeverity(['Minor', 'Major', 'Moderate'])).toBe('Major');
    expect(highestSeverity([])).toBe('No documented interaction');
  });
});
