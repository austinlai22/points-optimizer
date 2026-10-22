// Plaid, sandbox only (spec §7). Hard-coded to Plaid's sandbox host, so no
// configuration can point it at real banks.
//
// Stateless on purpose: each request makes a throwaway sandbox Item, reads its
// balances once, and deletes it. No access token is stored anywhere, which is
// why this is a single function rather than Centsible's encrypted-token flow.
const PLAID_SANDBOX = 'https://sandbox.plaid.com';
// "First Platypus Bank", Plaid's standard sandbox institution.
const SANDBOX_INSTITUTION = 'ins_109508';

export interface PlaidDeps {
  enabled: boolean;
  clientId: string;
  secret: string;
}

interface PlaidAccount {
  name: string;
  type: string;
  subtype: string | null;
  balances: { available: number | null; current: number | null };
}

export function createPlaidSandboxHandler(deps: PlaidDeps) {
  async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${PLAID_SANDBOX}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: deps.clientId, secret: deps.secret, ...body }),
    });
    if (!response.ok) throw new Error(`Plaid ${path} failed with HTTP ${response.status}`);
    return (await response.json()) as T;
  }

  return {
    async fetch(request: Request): Promise<Response> {
      if (!deps.enabled || !deps.clientId || !deps.secret) {
        return new Response('Not found', { status: 404 });
      }
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

      try {
        const { public_token } = await call<{ public_token: string }>('/sandbox/public_token/create', {
          institution_id: SANDBOX_INSTITUTION,
          initial_products: ['auth'],
        });
        const { access_token } = await call<{ access_token: string }>('/item/public_token/exchange', {
          public_token,
        });
        try {
          const { accounts } = await call<{ accounts: PlaidAccount[] }>('/accounts/get', { access_token });
          const depository = accounts.filter((a) => a.type === 'depository');
          const balanceOf = (a: PlaidAccount) => a.balances.available ?? a.balances.current ?? 0;
          return Response.json({
            demo: true,
            institution: 'First Platypus Bank (Plaid sandbox)',
            cashAvailable: depository.reduce((sum, a) => sum + balanceOf(a), 0),
            accounts: depository.map((a) => ({ name: a.name, subtype: a.subtype, balance: balanceOf(a) })),
          });
        } finally {
          await call('/item/remove', { access_token }).catch(() => undefined);
        }
      } catch (error) {
        console.error('Plaid sandbox failed:', error instanceof Error ? error.message : error);
        return new Response('Demo bank unavailable', { status: 502 });
      }
    },
  };
}
