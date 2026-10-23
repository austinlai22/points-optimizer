# Your own Chase Travel price entries

Add prices you've seen in Chase Travel to the reports database in bulk. They're checked with the same rules as reports shared on the website, and marked `source = admin` so they can always be told apart from visitors' reports.

## Steps

1. Copy `template.csv` to `my-prices.csv` in this folder. Any `.csv` here except the template stays on your computer and out of git.
2. Fill in one row per price (columns below). A spreadsheet app works: save as CSV.
3. Check it without storing anything:
   ```bash
   npm run import-reports -- price-reports/my-prices.csv --dry-run
   ```
4. Import it:
   ```bash
   npm run import-reports -- price-reports/my-prices.csv
   ```
   If any row has a problem, the import lists it and stores nothing. Fix it and rerun, or add `--skip-invalid` to store only the good rows. Importing the same file twice stores the rows twice, so start a fresh file for each batch.

The database keys must be in `.env.local` in the project folder (see the comments in that file).

## Columns

| Column | What to enter | Example |
|---|---|---|
| `submitted_on` | The day you saw the price, YYYY-MM-DD. Blank means today. Reports are deleted 24 months after this date. | `2026-10-20` |
| `card_type` | `reserve`, `preferred`, `reserveForBusiness`, `jpmReserve`, `inkPreferred`, `inkPlus` or `other` | `reserve` |
| `booking_type` | `flight` or `hotel` | `flight` |
| `origin` | Flights only: 3-letter airport or city code. Blank for hotels. | `JFK` |
| `destination` | 3-letter airport or city code | `LIS` |
| `travel_month` | YYYY-MM, within 12 months before and 18 months after `submitted_on` | `2027-05` |
| `cabin` | Flights only, optional: `basic_economy` (or `basic`), `economy`, `premium_economy`, `business` or `first` | `economy` |
| `cash_price_usd` | The cash price you compared against | `900` |
| `chase_points_price` | The Chase Travel price in points | `60000` |
| `boost_shown` | Whether Chase Travel showed a Points Boost offer: `yes`, `no` or `unsure` | `yes` |

A row works out to between 0.3¢ and 5¢ per point or it's refused. Outside that range is almost always a typo.
