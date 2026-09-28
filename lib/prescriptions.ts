export interface PrescriptionItemInput {
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  add_to_profile: boolean;
}

function record(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid prescription.');
  return value as Record<string, unknown>;
}

function cleanText(value: unknown, label: string, maximum: number, required = false) {
  if (value == null || value === '') {
    if (required) throw new Error(`Please enter ${label}.`);
    return null;
  }
  if (typeof value !== 'string') throw new Error(`Invalid ${label}.`);
  const result = value.trim();
  if ((required && !result) || result.length > maximum) throw new Error(`Invalid ${label}.`);
  return result || null;
}

function validDate(value: unknown) {
  const result = cleanText(value, 'prescription date', 10);
  if (!result) return null;
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result || parsed > new Date()) {
    throw new Error('Invalid prescription date.');
  }
  return result;
}

export function parsePrescription(value: unknown) {
  const input = record(value);
  const fields = ['prescriber_name', 'prescribed_on', 'notes', 'confirmed', 'items'];
  if (Object.keys(input).some(key => !fields.includes(key))) throw new Error('Unexpected prescription field.');
  if (input.confirmed !== true) throw new Error('Confirm that you reviewed the prescription details.');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20) throw new Error('Add between 1 and 20 medicines.');
  const items = input.items.map((value, index): PrescriptionItemInput => {
    const item = record(value);
    const itemFields = ['medicine_name', 'dosage', 'frequency', 'duration', 'instructions', 'add_to_profile'];
    if (Object.keys(item).some(key => !itemFields.includes(key))) throw new Error(`Unexpected field in medicine ${index + 1}.`);
    return {
      medicine_name: cleanText(item.medicine_name, `medicine ${index + 1} name`, 200, true)!,
      dosage: cleanText(item.dosage, 'dosage', 120),
      frequency: cleanText(item.frequency, 'frequency', 120),
      duration: cleanText(item.duration, 'duration', 120),
      instructions: cleanText(item.instructions, 'instructions', 500),
      add_to_profile: item.add_to_profile === true,
    };
  });
  return {
    prescriber_name: cleanText(input.prescriber_name, 'prescriber name', 200),
    prescribed_on: validDate(input.prescribed_on),
    notes: cleanText(input.notes, 'notes', 1000),
    items,
  };
}

export function parseReportRequest(value: unknown) {
  const input = record(value);
  if (Object.keys(input).some(key => key !== 'prescription_id')) throw new Error('Unexpected report field.');
  if (input.prescription_id == null || input.prescription_id === '') return { prescription_id: null };
  if (typeof input.prescription_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.prescription_id)) {
    throw new Error('Invalid prescription selection.');
  }
  return { prescription_id: input.prescription_id };
}

export function highestSeverity(values: Array<string | null>) {
  const ranks: Record<string, number> = { major: 3, moderate: 2, minor: 1 };
  let best = 'No documented interaction';
  for (const value of values) {
    if (value && (ranks[value.toLowerCase()] || 0) > (ranks[best.toLowerCase()] || 0)) best = value;
  }
  return best;
}
