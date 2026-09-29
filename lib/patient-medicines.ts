function object(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid medicine.');
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string, maximum: number, required = false) {
  if (value == null || value === '') {
    if (required) throw new Error(`Please enter ${name}.`);
    return null;
  }
  if (typeof value !== 'string') throw new Error(`Invalid ${name}.`);
  const result = value.trim();
  if ((required && !result) || result.length > maximum) throw new Error(`Invalid ${name}.`);
  return result || null;
}

export function parseNewMedicine(value: unknown) {
  const input = object(value);
  const fields = ['medicine_name', 'dosage', 'frequency', 'notes', 'started_at'];
  if (Object.keys(input).some(key => !fields.includes(key))) throw new Error('Unexpected medicine field.');
  const started_at = text(input.started_at, 'start date', 10);
  if (started_at) {
    const date = new Date(`${started_at}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(started_at) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== started_at || date > new Date()) throw new Error('Invalid start date.');
  }
  return {
    medicine_name: text(input.medicine_name, 'medicine name', 200, true)!,
    dosage: text(input.dosage, 'dosage', 120),
    frequency: text(input.frequency, 'frequency', 120),
    notes: text(input.notes, 'notes', 500),
    started_at,
  };
}

export function parseMedicineUpdate(value: unknown) {
  const input = object(value);
  const fields = ['dosage', 'frequency', 'notes', 'status'];
  if (Object.keys(input).length === 0 || Object.keys(input).some(key => !fields.includes(key))) throw new Error('Unexpected medicine field.');
  if (input.status != null && !['active', 'discontinued'].includes(String(input.status))) throw new Error('Invalid medicine status.');
  const result: { dosage?: string | null; frequency?: string | null; notes?: string | null; status?: 'active' | 'discontinued' } = {};
  if ('dosage' in input) result.dosage = text(input.dosage, 'dosage', 120);
  if ('frequency' in input) result.frequency = text(input.frequency, 'frequency', 120);
  if ('notes' in input) result.notes = text(input.notes, 'notes', 500);
  if ('status' in input) result.status = input.status as 'active' | 'discontinued';
  return result;
}
