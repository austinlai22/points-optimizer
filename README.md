# PointCompass

**[pointcompass.vercel.app](https://pointcompass.vercel.app)**

Points or cash? Know before you book. PointCompass tells you whether to pay cash, use points, or wait on a trip, based on your points *and* your cash cushion. It covers Chase, Capital One, American Express, Citi, Bank of America and Bilt.

Other points tools answer "which seat can my points get?" PointCompass answers "should I spend points on this trip at all, given my money right now?" It's a decision layer, not an award search engine: it never fetches fares or award space, it works from the prices you enter.

## What it does

**The recommendation** (`/app`, "Check a trip"): enter a trip's cash price, your cash position (cash for travel now, what's left each month, monthly spending) and optionally an award price. You get one of:

- **Pay cash**: points are worth more elsewhere, or only match their usual value
- **Transfer points**: a transfer partner clearly beats what the points are usually worth
- **Book in Chase Travel**: Chase Travel wins, at or below a breakeven price you can check
- **Book through a travel portal**: another issuer's portal wins (e.g. when cash is tight)
- **Wait to book**: paying cash would strain you and no points option holds its value

Each verdict comes with a one-line reason, cents per point against the benchmark, what paying cash leaves in your cushion, and every assumption behind it. For Chase, it shows your Points Boost range and the **breakeven**: the most points a Chase Travel price can be and still be your best move. Paste the price Chase shows you and it checks it exactly.

**Ranked paths**: below the verdict, every way to pay with points (each transfer partner and each portal) ranked by cost.

**Portfolio** (`/portfolio`): what each card's balance is worth, from cash-back floor to guaranteed travel value, with an optional "potential transfer value" estimate.

## Privacy

On the web, everything you type stays in your browser (`localStorage`); share links carry the trip, never balances or cash figures. The site counts a few anonymous events (which verdict was shown, a random per-browser id, nothing you typed) to measure the pilot, and skips that under Do Not Track. No bank logins, ever. Full details: [/privacy](https://pointcompass.vercel.app/privacy).

## Valuation model

The app's own transparent assumptions, not a claim to match The Points Guy, NerdWallet or any other published guide. The full breakdown, with live numbers, is in "Methodology & assumptions" at the bottom of the app.

- Chase Points Boost and the Sapphire Reserve legacy rate live in [`src/data/chase-points-boost.json`](src/data/chase-points-boost.json), only as Chase states them: each rule carries its chase.com link, Chase's exact wording and the date it was checked.
- Verdict thresholds (the 1.2× "clearly beats" bar, what counts as strained cash) are heuristics in [`src/data/verdict-config.json`](src/data/verdict-config.json), not code.
- Transfer ratios and card terms carry verification dates. A test fails once any of them, or any Chase rule, ages past six months.

## Code layout

| Path | What |
|---|---|
| `src/lib/verdict/` | The verdict engine: pure functions, no UI, shared by the web app and the server |
| `src/utils/valuation.ts` | Point valuation and ranked redemption paths |
| `src/data/` | Cards, transfer partners, Chase Boost rules, verdict thresholds |
| `src/pages/`, `src/components/` | Landing page, `/app`, `/portfolio`, `/privacy`, and the shared banner and footer |
| `server/` | Event counts and the Plaid sandbox (TypeScript source) |
| `api/` | The same, bundled for Vercel by `npm run build:api` (generated; committed) |

## Tech stack

Vite + React 19 + TypeScript + Tailwind CSS v4, routed with a small pushState router. Vercel functions in `api/`, and Upstash Redis (free tier) for anonymous event counts. Plaid is sandbox-only, behind `ENABLE_PLAID_SANDBOX`.

## Running locally

```bash
npm install
npm run dev        # start the dev server (the web app needs no env vars)
npm test           # run the vitest suite
npm run build      # type-check and produce a production build
npm run build:api  # rebundle server/ into api/ after changing server code
```

Environment variables for the functions are listed in [`.env.example`](.env.example); put real values in Vercel, never in the repo.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

PointCompass is an independent estimation tool and is not affiliated with, endorsed by, or sponsored by Chase, Capital One, American Express, Citi, Bank of America, Bilt, or any airline or hotel program referenced in the app. Figures are estimates based on this app's own assumptions, not financial advice. Verify prices and current terms before booking.
