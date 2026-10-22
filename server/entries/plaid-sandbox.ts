// POST /api/plaid-sandbox — demo balances from Plaid's sandbox. 404 unless
// ENABLE_PLAID_SANDBOX=true.
import { createPlaidSandboxHandler } from '../plaid/handler';

export default createPlaidSandboxHandler({
  enabled: process.env.ENABLE_PLAID_SANDBOX === 'true',
  clientId: process.env.PLAID_CLIENT_ID ?? '',
  secret: process.env.PLAID_SECRET ?? '',
});
