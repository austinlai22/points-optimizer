# Your own Chase Travel price entries

Add prices you've seen in Chase Travel to the reports database in bulk. They're checked with the same rules as reports shared on the website, and marked `source = admin` so they can always be told apart from visitors' reports.

## Quickest way: `/add-prices`

In Claude Code, type `/add-prices` and attach screenshots of Chase Travel results (or paste the page text). Claude writes the rows to `new-prices.csv`, dry-runs them, shows you a table, and imports only when you confirm. It then adds them to `my-prices.csv`. Claude never opens Chase itself; you do the searching.

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

To correct entries you've already imported, delete your own entries and import the corrected file again. Visitors' reports are never touched:
```bash
npm run delete-admin-reports              # lists them, deletes nothing
npm run delete-admin-reports -- --confirm # deletes them
```

The database keys must be in `.env.local` in the project folder (see the comments in that file).

## Columns

| Column | What to enter | Example |
|---|---|---|
| `submitted_on` | The day you saw the price, YYYY-MM-DD. Blank means today. Reports are deleted 24 months after this date. | `2026-10-20` |
| `card_type` | `reserve`, `preferred`, `reserveForBusiness`, `jpmReserve`, `inkPreferred`, `inkPlus` or `other` | `reserve` |
| `booking_type` | `flight` or `hotel` | `flight` |
| `origin` | Flights only: 3-letter airport or city code. Blank for hotels. | `JFK` |
| `destination` | 3-letter airport or city code | `LIS` |
| `trip_type` | Flights only: `one_way` or `round_trip`. Blank means one way. Check prices one way where you can: points bookings usually go one way at a time, and a round-trip price mixes in a return fare you didn't pick. | `one_way` |
| `travel_month` | YYYY-MM, within 12 months before and 18 months after `submitted_on` | `2027-05` |
| `cabin` | Flights only, optional: `basic_economy` (or `basic`), `economy`, `premium_economy`, `business` or `first` | `economy` |
| `airline` | Flights only, optional: an airline PointCompass tracks, as its name or 2-letter code. Leave blank for any other airline. | `Southwest` or `WN` |
| `fare` | Flights on Delta, Southwest, American or United, optional: the fare name as Chase Travel shows it. Delta: `Main Basic`, `Main Classic`, `Main Extra`, `Comfort Basic`, `Comfort Classic`, `Comfort Extra`, `Premium Select Basic`, `Premium Select Classic`, `First Basic`, `First Classic`, `First Extra`, `Delta One Classic`, `Delta One Extra`. Southwest: `Basic`, `Choice`, `Choice Preferred`, `Choice Extra`. American: `Basic Economy`, `Main Cabin`, `Main Cabin Flexible`, `Main Plus`, `Main Select`, `First`, `First Flexible`. United: `Basic Economy`, `Economy`, `Economy Plus`, `Economy Fully Refundable`, `Economy Plus Fully Refundable`, `Premium Economy`, `Premium Economy Fully Refundable`, `Business`, `Business Fully Refundable`, `First`, `First Fully Refundable`. With a fare, leave `cabin` blank: it's filled in from the fare. For a fare not listed, leave `fare` blank and give the `cabin`. | `Main Classic` |
| `hotel_chain` | Hotels only, optional: `accor`, `choice`, `hilton`, `hyatt`, `ihg`, `leadinghotels`, `marriott`, `iprefer`, `wyndham` (names like `World of Hyatt` work too), `independent` or `other` | `hyatt` |
| `cash_price_usd` | The cash price you compared against | `900` |
| `chase_points_price` | The Chase Travel price in points | `60000` |
| `boost_shown` | Whether Chase Travel showed a Points Boost offer: `yes`, `no` or `unsure` | `yes` |

A row works out to between 0.3¢ and 5¢ per point or it's refused. Outside that range is almost always a typo.

The trip type, airline, fare and hotel chain columns can be left out entirely; files made before they existed still import.

Tracked airlines: Aer Lingus, Aeromexico, Air Canada, Air France, Alaska, American, ANA, Avianca, British Airways, Cathay Pacific, Delta, Emirates, Etihad, EVA Air, Finnair, Hawaiian, Iberia, Japan Airlines, JetBlue, KLM, Qantas, Qatar, Singapore, Southwest, TAP Air Portugal, Thai, Turkish, United and Virgin Atlantic.
