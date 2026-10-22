# Turning on the WhatsApp pilot

The code is deployed; these steps connect it to Meta and give it storage. All of it is free at pilot scale. Meta and Vercel rename their menus from time to time, so if a label below doesn't match, look for the nearest equivalent.

## 1. Storage (Upstash Redis, free tier)

1. Vercel dashboard → the **pointcompass** project → **Storage** → **Create** → **Upstash for Redis** (Marketplace).
2. Pick the free plan (256 MB, 500,000 commands a month) and connect it to the project.
3. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to the project's environment variables on its own.

This one database holds WhatsApp conversations and the anonymous pilot counts. Without it, event counting is off and the bot replies that the pilot isn't switched on.

## 2. Meta app and test number

1. [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create app**, choosing the WhatsApp / "Connect with customers" use case.
2. **WhatsApp → API Setup** gives you a free test number. Copy its **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
3. Same page, **To** → **Manage phone number list**: add up to 5 recipient numbers (the pilot testers). Each one confirms with a code.
4. **App settings → Basic → App secret** → `WHATSAPP_APP_SECRET`. This is what lets `/api/whatsapp` reject anything Meta didn't sign.

## 3. A token that doesn't expire

The token on the API Setup page lasts about 24 hours. For the pilot, use a **system user** token instead:

1. [business.facebook.com](https://business.facebook.com) → **Settings → Users → System users** → **Add**, role **Admin**.
2. **Assign assets** → your app → full control.
3. **Generate new token** → your app → expiry **Never** → permissions `whatsapp_business_messaging` and `whatsapp_business_management`.
4. Copy it straight away (Meta shows it once) → `WHATSAPP_TOKEN`.

## 4. Environment variables

In Vercel → **Settings → Environment Variables** (Production), set the values from steps 2–3 plus:

| Variable | Value |
|---|---|
| `WHATSAPP_VERIFY_TOKEN` | Any long random string, e.g. `openssl rand -hex 24` |
| `STATS_TOKEN` | Another long random string, for reading the counts |
| `VITE_WHATSAPP_NUMBER` | The test number in digits only, to turn on the landing page's "Text it on WhatsApp" button |

Then **redeploy** (Deployments → ⋯ → Redeploy) so the functions and the landing page pick them up. `.env.example` lists everything.

## 5. Webhook

1. Meta app → **WhatsApp → Configuration → Webhook → Edit**.
2. Callback URL: `https://pointcompass.vercel.app/api/whatsapp`
3. Verify token: the same `WHATSAPP_VERIFY_TOKEN`. **Verify and save** should succeed straight away.
4. **Webhook fields** → subscribe to **messages**.

## 6. Check it end to end

From one of the verified phones, message the test number:

1. `NYC to Lisbon in May, $900, worth using points?` → it asks which points you have.
2. Answer each question → a verdict of six lines or fewer, with a link to the web app.
3. Send another trip → "Using your saved numbers."
4. `RESET` → "deleted everything". In Upstash's data browser, the `wa:state:…` key for you is gone.

## Reading the pilot counts

```bash
curl -H "Authorization: Bearer $STATS_TOKEN" https://pointcompass.vercel.app/api/event
```

This returns verdicts shown (by type and channel), pasted prices used, WhatsApp conversations started, and estimated unique users per channel.

## Optional: Plaid sandbox

Set `ENABLE_PLAID_SANDBOX=true`, `PLAID_CLIENT_ID` and `PLAID_SECRET` (sandbox keys only, from the Plaid dashboard; the same ones Centsible uses will do), then redeploy. A "Use a demo bank (sandbox data)" button appears next to the cash inputs. The code only ever calls `sandbox.plaid.com`, so production keys wouldn't work there even if set.
