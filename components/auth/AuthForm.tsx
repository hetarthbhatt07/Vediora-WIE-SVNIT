'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, ArrowRight, User, Stethoscope } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { RecessedInput } from '@/components/ui/RecessedInput';
import { TactileButton } from '@/components/ui/TactileButton';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';
const titles: Record<Mode, string> = { login: 'Sign in to Vediora', signup: 'Create your Vediora account', forgot: 'Reset your password', reset: 'Choose a new password' };

export function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [accountType, setAccountType] = useState<'patient' | 'doctor'>('patient');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [organization, setOrganization] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'confirmation') setError('This email link is invalid or expired. Request a new link, or sign in if your email is already confirmed.');
  }, []);

  function accountDestination(user: { user_metadata?: Record<string, unknown> }) {
    // This hint controls navigation only. Server layouts enforce the database role.
    return user.user_metadata?.account_type === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard';
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if ((mode === 'signup' || mode === 'reset') && password !== confirmation) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) throw new Error('The session could not be created. Please try again.');
        // A full navigation ensures the freshly written SSR cookie is present when
        // middleware validates the protected dashboard request.
        window.location.assign(accountDestination(data.user));
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password,
          options: { data: {
            full_name: name.trim(), account_type: accountType,
            license_number: accountType === 'doctor' ? licenseNumber.trim() : undefined,
            specialization: accountType === 'doctor' ? specialization.trim() : undefined,
            organization: accountType === 'doctor' ? organization.trim() : undefined,
          }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (error) throw error;
        setPassword(''); setConfirmation('');
        if (data.session && data.user) { window.location.assign(accountDestination(data.user)); }
        else setMessage('Check your email for a confirmation link. If you already have an account, sign in or reset your password.');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
        if (error) throw error;
        setMessage('If this email has an account, a password reset link will arrive shortly. Check your inbox and spam folder.');
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Open a fresh password reset link from your email before choosing a new password.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword(''); setConfirmation('');
        setMessage('Your password has been updated. You can now open your dashboard.');
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to connect. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-4 py-12">
      <BrandLogo size="lg" />
      <h1 className="mt-6 text-2xl font-bold text-slate-900 text-center">{titles[mode]}</h1>
      <p className="mt-2 text-sm text-slate-500 text-center">Connected medication safety for patients and their approved doctors.</p>
      <div className="mt-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
        {error && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mb-5 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
        <form onSubmit={submit} className="space-y-5">
          {mode === 'signup' && <fieldset><legend className="mb-2 text-xs font-semibold text-slate-700">Account type</legend><div className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={accountType === 'patient'} onClick={() => setAccountType('patient')} className={`rounded-lg border p-3 text-sm font-semibold ${accountType === 'patient' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}><User className="mx-auto mb-1 h-4 w-4" />Patient</button>
            <button type="button" aria-pressed={accountType === 'doctor'} onClick={() => setAccountType('doctor')} className={`rounded-lg border p-3 text-sm font-semibold ${accountType === 'doctor' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600'}`}><Stethoscope className="mx-auto mb-1 h-4 w-4" />Doctor</button>
          </div></fieldset>}
          {mode === 'signup' && <RecessedInput label="Full name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={120} required leftIcon={<User className="h-4 w-4" />} />}
          {mode === 'signup' && accountType === 'doctor' && <>
            <RecessedInput label="Medical license number" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} maxLength={80} required leftIcon={<Stethoscope className="h-4 w-4" />} />
            <RecessedInput label="Specialization" value={specialization} onChange={e => setSpecialization(e.target.value)} maxLength={120} />
            <RecessedInput label="Hospital or organization" value={organization} onChange={e => setOrganization(e.target.value)} maxLength={160} />
          </>}
          {mode !== 'reset' && <RecessedInput label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required leftIcon={<Mail className="h-4 w-4" />} />}
          {mode !== 'forgot' && <RecessedInput label="Password" type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 8} required leftIcon={<Lock className="h-4 w-4" />} rightIcon={<button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />}
          {(mode === 'signup' || mode === 'reset') && <RecessedInput label="Confirm password" type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" minLength={8} required helperText="Use at least 8 characters." />}
          {mode === 'login' && <Link href="/forgot-password" className="block text-right text-sm text-blue-600 hover:underline">Forgot password?</Link>}
          <TactileButton type="submit" className="w-full" isLoading={busy} rightIcon={<ArrowRight className="h-4 w-4" />}>{mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Save new password'}</TactileButton>
        </form>
        <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
          {mode === 'login' ? <Link href="/signup" className="text-blue-600 hover:underline">Create an account</Link> : <Link href="/login" className="text-blue-600 hover:underline">Back to sign in</Link>}
          {mode === 'reset' && message && <Link href="/patient/dashboard" className="mt-3 block text-blue-600 hover:underline">Open dashboard</Link>}
        </div>
      </div>
    </main>
  );
}
