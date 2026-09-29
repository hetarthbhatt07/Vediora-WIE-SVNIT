export interface PatientProfile {
  id: string;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  created_at: string;
  updated_at: string;
  account_type: 'patient' | 'doctor';
}

export const PROFILE_COLUMNS = 'id,full_name,phone,date_of_birth,gender,blood_group,height_cm,weight_kg,created_at,updated_at,account_type';
const fields = ['full_name', 'phone', 'date_of_birth', 'gender', 'blood_group', 'height_cm', 'weight_kg'];

export function parseProfileInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid profile.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !fields.includes(key))) throw new Error('Unexpected profile field.');
  const text = (key: string, limit: number) => {
    const value = input[key];
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || value.trim().length > limit) throw new Error(`Invalid ${key.replaceAll('_', ' ')}.`);
    return value.trim() || null;
  };
  const full_name = text('full_name', 120);
  if (!full_name) throw new Error('Please enter your full name.');
  const date_of_birth = text('date_of_birth', 10);
  if (date_of_birth) {
    const date = new Date(`${date_of_birth}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== date_of_birth || date > new Date() || date.getUTCFullYear() < 1900) throw new Error('Enter a valid date of birth.');
  }
  const number = (key: string, max: number) => {
    const value = input[key];
    if (value == null || value === '') return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) throw new Error(`Invalid ${key.replaceAll('_', ' ')}.`);
    return value;
  };
  const blood_group = text('blood_group', 3);
  if (blood_group && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(blood_group)) throw new Error('Choose a valid blood group.');
  return { full_name, phone: text('phone', 30), date_of_birth, gender: text('gender', 40), blood_group, height_cm: number('height_cm', 300), weight_kg: number('weight_kg', 700) };
}
