// Set at build time from ENABLE_PLAID_SANDBOX (see vite.config.ts), so the
// demo-bank button only exists in builds where the server side is switched on.
declare const __PLAID_SANDBOX__: boolean;
