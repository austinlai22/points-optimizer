# Changelog

The pilot's success measure includes "at least one product change made because of observed behavior." Those go under **Changes from the pilot**, each with what was observed and why the change follows from it. Everything else goes under its release.

## Changes from the pilot

_None yet. Format:_

```
### YYYY-MM-DD: <the change>
- Observed: <what users did, with the count or event behind it>
- Change: <what changed>
- Why: <how the change follows from the observation>
```

## 2.1.0 (October 2026)

- Removed: the WhatsApp version, which never launched. The landing page said a pilot was running, which wasn't true. The code is kept on the `parked/whatsapp` branch.

## 2.0.0 (October 2026): "Should I spend points on this trip?"

- **Verdict engine** (`src/lib/verdict/`): pay cash / transfer points / book in Chase Travel / book through a portal / wait to book, weighing points against what they're usually worth and the user's cash cushion. Shared by the web app and WhatsApp.
- **Chase Points Boost awareness**: Boost ranges per Chase card, the Sapphire Reserve legacy 1.5× rate (with its Oct 26, 2027 end date enforced automatically), and a Chase Travel breakeven price. Rules come only from chase.com, with sources, quotes and dates.
- **Cash runway**, adapted from Centsible's idea (cash ÷ burn), not its code: months of spending left after paying, and a strain rule kept in config.
- **Landing page** at `/`; the tool moved to `/app`, and old `/?price=…` links redirect there. New `/privacy` page.
- **WhatsApp pilot**: Meta Cloud API webhook with signature checks, a one-question-at-a-time conversation, saved answers, and `UPDATE` / `RESET` / `HELP`.
- **Pilot measurement**: anonymous counts of verdicts shown, pasted prices used and WhatsApp conversations started.
- **Plaid sandbox** (off by default): demo balances, stateless, sandbox host only.
- **Sources for every fact**: each card links to its issuer's page and each transfer ratio to where it was checked (Capital One's own list; recent public guides for Chase, Amex, Citi and Bilt, whose lists need a login). All 18 annual fees re-confirmed on Oct 22, 2026.
- Fixed: Citi → Aeromexico removed (Citi ended it on Jan 25, 2026, and the app was still offering it). Citi → Japan Airlines added at 1:1 (launched Sep 20, 2026).
- Changed: a thin cash cushion with weak points value now says "wait to book" instead of "pay cash", since paying would strain the cushion that the strain rule exists to protect.
