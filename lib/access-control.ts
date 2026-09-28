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
  const fields = ['license_number', 'specialization', 'organization'];
  if (Object.keys(input).some(key => !fields.includes(key))) throw new Error('Unexpected doctor profile field.');
  return {
    license_number: limitedText(input.license_number, 'license number', 80, true)!,
    specialization: limitedText(input.specialization, 'specialization', 120),
    organization: limitedText(input.organization, 'organization', 160),
  };
}
