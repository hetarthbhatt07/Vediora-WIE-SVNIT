export type AccountType = 'patient' | 'doctor';
export type AccessRequestStatus = 'pending' | 'approved' | 'denied' | 'revoked';
export type AccessResponseAction = 'approve' | 'deny' | 'revoke';

function object(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request.');
  return value as Record<string, unknown>;
}

function limitedText(value: unknown, field: string, maximum: number, required = false) {
  if (value == null || value === '') {
    if (required) throw new Error(`Please enter ${field}.`);
    return null;
  }
  if (typeof value !== 'string') throw new Error(`Invalid ${field}.`);
  const result = value.trim();
  if ((required && !result) || result.length > maximum) throw new Error(`Invalid ${field}.`);
  return result || null;
}

export function parseAccessRequestInput(value: unknown) {
  const input = object(value);
  if (Object.keys(input).some(key => !['patient_email', 'message'].includes(key))) throw new Error('Unexpected request field.');
  const patient_email = limitedText(input.patient_email, 'patient email', 320, true)!;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient_email)) throw new Error('Enter a valid patient email.');
  return { patient_email: patient_email.toLowerCase(), message: limitedText(input.message, 'request message', 500) };
}

export function parseAccessResponseInput(value: unknown) {
  const input = object(value);
  if (Object.keys(input).some(key => key !== 'action')) throw new Error('Unexpected response field.');
  if (!['approve', 'deny', 'revoke'].includes(String(input.action))) throw new Error('Choose a valid response.');
  return input.action as AccessResponseAction;
}

export function parseDoctorProfileInput(value: unknown) {
  const input = object(value);
  const fields = ['full_name', 'phone', 'date_of_birth', 'gender', 'blood_group', 'height_cm', 'weight_kg', 'license_number', 'specialization', 'organization'];
  if (Object.keys(input).some(key => !fields.includes(key))) throw new Error('Unexpected doctor profile field.');

  const full_name = limitedText(input.full_name, 'full name', 120, true)!;
  const date_of_birth = limitedText(input.date_of_birth, 'date of birth', 10);
  if (date_of_birth) {
    const date = new Date(`${date_of_birth}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== date_of_birth || date > new Date() || date.getUTCFullYear() < 1900) throw new Error('Enter a valid date of birth.');
  }
  const measurement = (key: 'height_cm' | 'weight_kg', maximum: number) => {
    const measurementValue = input[key];
    if (measurementValue == null || measurementValue === '') return null;
    if (typeof measurementValue !== 'number' || !Number.isFinite(measurementValue) || measurementValue <= 0 || measurementValue > maximum) throw new Error(`Invalid ${key.replaceAll('_', ' ')}.`);
    return measurementValue;
  };
  const blood_group = limitedText(input.blood_group, 'blood group', 3);
  if (blood_group && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(blood_group)) throw new Error('Choose a valid blood group.');

  return {
    full_name,
    phone: limitedText(input.phone, 'phone', 30),
    date_of_birth,
    gender: limitedText(input.gender, 'gender', 40),
    blood_group,
    height_cm: measurement('height_cm', 300),
    weight_kg: measurement('weight_kg', 700),
    license_number: limitedText(input.license_number, 'license number', 80, true)!,
    specialization: limitedText(input.specialization, 'specialization', 120),
    organization: limitedText(input.organization, 'organization', 160),
  };
}
