# Demo script: Phocuswright, Nov 17, 2026

About 4 minutes. Before you start: one phone on the WhatsApp verified-recipient list, sent `RESET` beforehand so the bot asks its questions fresh. A browser on https://pointcompass.vercel.app, with site data cleared.

## 1. The problem (30s), landing page

> "Points tools answer 'which seat can my points get?' Nobody answers 'should I spend points on this trip at all, given the money I actually have?' That's the question for anyone watching their cash."

Scroll to **One trip, three ways to pay**: the same $900 trip as cash, Chase Travel and a transfer, with the verdict and the Chase Travel breakeven. Point out the "Illustrative" label: the example runs through the real engine.

## 2. The web app (90s)

1. **Check a trip** → **Portfolio**: tick Sapphire Reserve, 150,000 points.
2. **Check a trip** tab: trip price **$900**; brand **United MileagePlus**, points **60,000**, fees **$90**.
3. Cash cushion: **$6,000** / **300** / **2,500** → verdict **Transfer points**, 1.35¢ vs 1¢.
4. Change cash available to **$1,000** → paying cash now leaves under a month, and the reason says so. Points still hold their value, so it's still points, now to protect your cash.
5. Set the United points to 0, set cash back to **$6,000**, paste a Chase Travel price of **60,000** → **Book in Chase Travel**. Then **95,000** → falls back to **Pay cash**: "Chase Travel shows a Boost offer? Here's the number it has to beat."
6. Open **Estimates and assumptions**: every estimate is listed.

## 3. WhatsApp (60s)

Text: `NYC to Lisbon in May, $900, worth using points?`

Answer: `Chase 150k` → Sapphire Reserve → No, after → `6000` → `300` → `2500`. The verdict arrives with the breakeven and a link. Then text `Chase Travel 60k` → it re-checks with the pasted price.

## 4. Trust (30s)

- Chase rules come only from chase.com, each with its quote and date; tests fail if any goes six months unchecked.
- No bank logins. The web keeps everything in the browser; WhatsApp stores the minimum, keyed to a scrambled number, and `RESET` deletes it. Show it: text `RESET`.

## If something breaks

- **WhatsApp silent:** the token may have expired (only if the temporary one was used; see docs/whatsapp-setup.md step 3). Carry on with the web demo.
- **No Wi-Fi:** `npm run dev` locally; everything except WhatsApp works offline.
