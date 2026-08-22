import { BASE_CPP, CASH_BACK_RATE, TRANSFER_PREMIUM_FACTOR } from '../utils/valuation';
import { formatUSDPerPoint } from '../utils/format';
import { FOCUS_RING, TAP_TARGET } from '../styles/constants';

export function Methodology() {
  return (
    <details className="group mt-12 border-t border-navy/10">
      <summary
        className={`-ml-1 flex w-fit cursor-pointer select-none items-center gap-1.5 rounded px-1 text-sm text-navy-950/50 ${TAP_TARGET} ${FOCUS_RING}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        Methodology &amp; assumptions
      </summary>
      <div className="mt-3 max-w-2xl space-y-2 text-sm leading-relaxed text-navy-950/60">
        <p>
          <span className="font-medium text-navy-950/70">Cash-back floor:</span> the true
          unconditional rate — a plain statement credit or mailed check, no travel-purchase
          restriction. Chase's is {formatUSDPerPoint(CASH_BACK_RATE.chase)}/point, the same as its
          travel rate (Freedom's 1:1 statement credit has no strings attached). The other three
          issuers each publish a real, lower floor than their travel rate: Capital One's
          unrestricted cash back is {formatUSDPerPoint(CASH_BACK_RATE.capitalOne)}/mile, Amex's
          "Cover Your Card Charges" credit is {formatUSDPerPoint(CASH_BACK_RATE.amex)}/point, and
          Citi's cash back on its ThankYou-earning cards is{' '}
          {formatUSDPerPoint(CASH_BACK_RATE.citi)}/point — this app reflects each of those
          published gaps rather than treating every issuer's floor as identical.
        </p>
        <p>
          <span className="font-medium text-navy-950/70">Realistic value:</span>{' '}
          {formatUSDPerPoint(BASE_CPP)}/point — the guaranteed travel-purchase redemption rate
          each issuer's own portal offers (Chase Travel, Capital One's "Cover Travel Purchases",
          Amex Pay with Points on flights, Citi Travel) — times the best portal multiplier
          available anywhere in your held cards from the same issuer (see "Point pooling" below),
          no transferring required. Every issuer here has converged on the same flat 1¢/point
          guaranteed rate across its whole card lineup; none currently offers a card-tier boost
          above that. As of October 2025 Chase specifically replaced its old flat 1.25×/1.5×
          Sapphire portal rates with a selective, non-guaranteed "Points Boost" promotion (up to
          1.75¢–2¢, but only for specific hotels/airlines Chase picks) — and Amex/Citi similarly
          offer selective premium redemptions above 1¢ for specific bookings. None of that
          selective, promotional upside is modeled here; only the flat guaranteed rate is.
        </p>
        <p>
          <span className="font-medium text-navy-950/70">Transfer ceiling:</span> the realistic
          rate times {TRANSFER_PREMIUM_FACTOR}×, this app's own reasoned estimate of the upside
          from redeeming at fixed award-chart prices against premium-cabin or peak-date cash
          prices, further scaled by the best transfer ratio among that issuer's own partners —
          only if the pooled-into card is itself transfer-eligible.
        </p>
        <p>
          <span className="font-medium text-navy-950/70">Trip Optimizer cost:</span> each
          redemption path prices the points it uses at your issuer's best guaranteed rate — the
          same realistic-value rate above — not the trip's cash price and not any one card's own
          weaker rate. That's why every card within an issuer shows the identical cost for the
          same partner: it's genuinely the same points, valued the same way. Lower cost is a
          better deal; "Poor deal" means the cost exceeds the trip's cash price, i.e. you'd be
          burning more point value than the trip is worth.
        </p>
        <p>
          <span className="font-medium text-navy-950/70">Annual fee:</span> shown on each
          redemption card as reference only — it's a sunk cost once you already hold the card, so
          it does not affect cost or the ranking. Use it to judge whether a pricier card is worth
          keeping overall, not which one to redeem through today.
        </p>
        <p>
          <span className="font-medium text-navy-950/70">Point pooling:</span> issuers let you
          combine balances across cards you hold in the <em>same</em> rewards program — "hold"
          meaning checked as "I have this card" in Portfolio. A rational cardholder always
          consolidates into whichever held card in that program has the best rate before
          redeeming, so every card's realistic value and ceiling is computed as if pooled into the
          single best card you've marked as held within its own family. Every card from every
          issuer here now shares the same flat 1¢/point guaranteed portal rate, so pooling no
          longer changes anyone's <em>realistic</em> value — but a non-transfer-eligible card
          (like Chase Freedom) still benefits from pooling into a transfer-eligible card in its
          own family for its <em>ceiling</em>, since it gains transfer-partner access only by
          consolidating. Every Capital One and Amex card here is directly transfer-eligible with no
          known ratio caveat, so none of them need pooling at all. Citi's cards are all
          transfer-eligible too, but the no-fee Strata card specifically still benefits from
          pooling into Strata Premier or Elite — not to gain access it already has, but to escape
          its own reduced transfer ratio (see "Known simplifications" below) by riding a better
          held card's rate instead. <strong>Points never pool across issuers</strong> — Chase Ultimate
          Rewards, Capital One miles, Amex Membership Rewards, and Citi ThankYou Points are four
          separate, non-interchangeable currencies, so a balance in one never moves into another,
          even though some individual hotel/airline partners (like Air France-KLM Flying Blue,
          Emirates, or Wyndham Rewards) happen to accept transfers from more than one of them —
          each issuer still transfers there at its own ratio, from its own separate pool of
          points. If you only hold one card in a program, its own rate applies since there's no
          better card in that family to pool into. That's why some cards' figures, and some Trip
          Optimizer paths, are marked "via pooling" or "requires transfer-in."
        </p>
        <p>
          <span className="font-medium text-navy-950/70">Known simplifications:</span> this app
          otherwise uses one transfer ratio per issuer, not per specific card — with two documented
          real exceptions. Chase Sapphire Preferred's Hyatt transfer ratio is changing to 4:3 (a
          real devaluation) while Sapphire Reserve keeps the standard 1:1: Preferred is never
          recommended for a Hyatt transfer specifically (Reserve is, despite its higher fee), but
          this app doesn't compute a separate cost for Preferred's other partners, where no
          devaluation has been announced. Citi's no-annual-fee Strata card transfers to every
          partner at a reduced 10:7 ratio versus Strata Premier/Elite's full rate — this one IS
          reflected in the numbers: if you hold Premier or Elite too, Strata is never recommended
          and its figures assume pooling into the better card; if Strata is the only Citi card you
          hold, both its Portfolio ceiling and any Trip Optimizer cost through it are computed at
          its real, worse 10:7 rate rather than the generic issuer-wide one.
        </p>
        <p className="italic">
          These are this app's own transparent assumptions for estimation purposes — not a claim
          to match The Points Guy, NerdWallet, or any other published point-valuation guide. Card
          terms shown here were last verified August 2026 and can change; confirm current terms
          directly with each issuer before making redemption decisions.
        </p>
      </div>
    </details>
  );
}
