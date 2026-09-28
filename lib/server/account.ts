import 'server-only';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/server/database';
import type { AccountType } from '@/lib/access-control';

interface AccountRow {
  id: string;
  full_name: string;
  account_type: AccountType;
}

export async function currentAccount(): Promise<{ user: User; account: AccountRow } | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  // The isolated Playwright harness intentionally has no PostgreSQL connection;
  // it provides a local Supabase-compatible REST mock instead. Keep this branch
  // test-only so production role checks always use the server database.
  if (process.env.VEDIORA_TEST_BUILD === '1' && !process.env.DATABASE_URL) {
    const { data } = await supabase.from('vediora_profiles').select('id,full_name,account_type').eq('id', user.id).maybeSingle();
    const metadata = user.user_metadata || {};
    return {
      user,
      account: data || {
        id: user.id,
        full_name: typeof metadata.full_name === 'string' ? metadata.full_name : '',
        account_type: metadata.account_type === 'doctor' ? 'doctor' : 'patient',
      },
    };
  }
  const result = await query<AccountRow>(
    `select id, full_name, account_type
       from public.vediora_profiles
      where id = $1`,
    [user.id],
  );
  if (!result.rows[0]) return null;
  return { user, account: result.rows[0] };
}
