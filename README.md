# PointCompass

**[pointcompass.vercel.app](https://pointcompass.vercel.app)**

A free, client-only tool that values your Chase, Capital One, American Express, Citi, and Bank of America points/miles, and helps you figure out which card to redeem through for a specific trip.

Nothing is sent to a server — all balances and inputs stay in your browser (`localStorage`).

## What it does

**Portfolio** — Enter the balance on each card you hold and see three figures per card:
- **Cash-back floor** — the guaranteed, unconditional value if you cashed out today
- **Realistic value** — the guaranteed travel-portal redemption rate
- **Potential transfer value** — this app's own estimate of award upside, available via the "Value points at" selector rather than shown by default, since no issuer publishes it

Balances pool automatically across cards in the same issuer's family (e.g. a no-transfer Chase Freedom balance inherits a held Sapphire Reserve's transfer access), the same way a rational cardholder would actually consolidate points before redeeming.

**Trip Optimizer** — Enter a trip's cash price and the hotel/airline brand you'd redeem through, and see every redemption path (each card's own portal, plus any transfer partner) ranked by cost — the opportunity cost of spending those points instead of your best guaranteed alternative. Lower cost is a better deal. The current scenario is reflected in the URL, so you can copy the link to share or bookmark it.

## Valuation model

This app's own transparent, reasoned assumptions — not a claim to match The Points Guy, NerdWallet, or any other published valuation guide. Full breakdown (with live numbers) is in the "Methodology & assumptions" disclosure at the bottom of each page in the app. Card terms were last verified August 2026 and can change — confirm current terms directly with each issuer before making redemption decisions.

## Tech stack

Vite + React 19 + TypeScript + Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`). No backend, no database, no auth.

## Running locally

```bash
npm install
npm run dev      # start the dev server
npm test         # run the vitest suite
npm run build    # type-check and produce a production build
```

## Disclaimer

PointCompass is an independent estimation tool and is not affiliated with, endorsed by, or sponsored by Chase, Capital One, American Express, Citi, Bank of America, or any airline or hotel program referenced in the app. Figures are illustrative estimates based on this app's own assumptions — not financial advice.
