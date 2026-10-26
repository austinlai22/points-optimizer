---
name: add-prices
description: Turn screenshots or copied text of Chase Travel search results into rows for Austin's price-report CSV, dry-run them, and import them once he confirms. Use when Austin attaches Chase Travel results or says /add-prices.
---

# Add Chase Travel prices from screenshots

Austin searches Chase Travel himself and attaches screenshots or pastes the
page text. You turn what's shown into CSV rows, check them, and import them
only when he says so.

## Hard rules

- **Never open, browse or log in to Chase or any bank or travel site.** Work
  only from what Austin attached or pasted. If something isn't shown, ask.
- **Copy only the columns below.** Screenshots may show his name, points
  balance, card number ending or other personal details. Never write those
  anywhere: not in the CSV, not in your replies, not in files.
- **Never guess a number.** If a price or points figure is cut off, blurry or
  ambiguous, leave that row out and say which one and why.
- **Nothing is stored until Austin confirms** the dry-run result.
- **Leave out any airline PointCompass doesn't track** (its list is in
  `src/lib/reports/brands.ts`), without asking. Mention in the summary which
  airlines and how many fares were left out.
- Never read or print `.env.local`.

## Steps

1. **Work out the trip details once per batch.** Read them from the
   screenshots where they're visible (route, date, one way or round trip).
   For anything not visible, ask in one question, offering the values from
   the last rows of `price-reports/my-prices.csv` as the default ("Same as
   last time: Sapphire Reserve, SFO→LGA, one way, January 2027?"):
   - `card_type`: one of `reserve`, `preferred`, `reserveForBusiness`,
     `jpmReserve`, `inkPreferred`, `inkPlus`, `other`
   - `origin`, `destination`: 3-letter codes
   - `travel_date`: the exact travel date, YYYY-MM-DD. Ask for it each batch
     (the search page shows it, the result cards don't). Leave `travel_month`
     blank when you give a date: it is worked out from it.
   - `travel_month`: YYYY-MM, only if no date is known
   - `trip_type`: `one_way` or `round_trip`. If the results are a round
     trip, remind him once that one-way searches give cleaner data.

2. **One row per fare shown.** For each flight and fare in the screenshots:
   - `airline`: the airline's 2-letter code (`DL`, `WN`, `AA`, `UA`, …).
   - `fare`: the fare name exactly as Chase Travel shows it, matched to the
     names in `src/data/fares.json` for that airline. Leave `cabin` blank
     when a fare is given; it's filled in from the fare.
   - If the airline has no list in `fares.json`, leave `fare` blank and set
     `cabin`: `basic_economy`, `economy`, `premium_economy`, `business` or
     `first`.
   - If the airline has a list but this fare isn't on it, stop and ask
     Austin whether to add it (name, and which shared cabin it counts as).
     Adding one means editing `fares.json` and `price-reports/README.md`,
     running the tests, and shipping, as previous fares were added.
   - `cash_price_usd`: Chase Travel's cash price for that fare, digits only.
   - `chase_points_price`: Chase Travel's points price, digits only.
   - `boost_shown`: `yes` if that fare shows a Points Boost offer, `no` if
     it clearly doesn't, `unsure` if you can't tell from the screenshot.
   - `submitted_on`: today's date, unless Austin says the screenshots are
     from another day.
   - `booking_type`: `flight`. For hotels, use `hotel`, leave `origin`,
     `trip_type`, `airline` and `fare` blank, and set `hotel_chain` (see
     the README).
   - If the same flight and fare appears twice (for example, overlapping
     screenshots), include it once.

3. **Write the batch to `price-reports/new-prices.csv`**, a fresh file with
   the header from `price-reports/template.csv`. Never add new rows straight
   into `my-prices.csv`: that file has already been imported, and importing
   a row twice stores it twice. If `new-prices.csv` already exists, ask
   whether it's an unfinished batch before overwriting it.

4. **Dry-run it:**
   ```bash
   npm run import-reports -- price-reports/new-prices.csv --dry-run
   ```
   Fix anything that's your own transcription mistake. For anything else,
   say what the problem is and ask.

5. **Show Austin the batch** as a short table (airline, fare, cash, points,
   Boost, value per point = cash × 100 ÷ points, to 3 decimals) plus the
   dry-run result, and ask him to confirm. Point out anything unusual, such
   as a value per point far from 1¢ with no Boost, or Boost at a rate not
   seen before.

6. **When he confirms:**
   ```bash
   npm run import-reports -- price-reports/new-prices.csv
   ```
   Then append the batch's rows (not its header) to
   `price-reports/my-prices.csv` so that file stays the full record, and
   delete `new-prices.csv`. Say how many rows were stored.

Column details: `price-reports/README.md`.
