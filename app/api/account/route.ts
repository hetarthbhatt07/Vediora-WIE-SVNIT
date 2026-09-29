import { currentAccount } from '@/lib/server/account';
import { privateJson } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    return privateJson({
      account: {
        id: current.account.id,
        fullName: current.account.full_name,
        accountType: current.account.account_type,
        email: current.user.email || null,
      },
    });
  } catch {
    return privateJson({ error: 'Account storage is not ready.', code: 'ACCOUNT_SETUP_REQUIRED' }, 503);
  }
}
