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
          travel rate (Freedom's 1:1 statement credit has no strings attached), and Bank of
          America's default is the same {formatUSDPerPoint(CASH_BACK_RATE.bankOfAmerica)}/point too
          (true for Premium Rewards and Premium Rewards Elite). The other issuers each publish a
          real, lower floor than their travel rate: Capital One's unrestricted cash back is{' '}
          {formatUSDPerPoint(CASH_BACK_RATE.capitalOne)}/mile, Amex's "Cover Your Card Charges"
          credit is {formatUSDPerPoint(CASH_BACK_RATE.amex)}/point, and Citi's cash back on its
          ThankYou-earning cards is {formatUSDPerPoint(CASH_BACK_RATE.citi)}/point. Bank of
          America's no-fee Travel Rewards card is a further, per-card exception on top of its own
          issuer's default: unlike every other gap here (which applies uniformly across an
          issuer's whole lineup), Travel Rewards' true cash-out rate is only{' '}
          {formatUSDPerPoint(0.006)}/point — genuinely worse than its own Premium
          Rewards/Elite siblings — so this app tracks it as a per-card override rather than
          treating every Bank of America card as identical.
        </p>
        <p>
          <span className="font-medium text-navy-950/70">Realistic value:</span>{' '}
          {formatUSDPerPoint(BASE_CPP)}/point — the guaranteed travel-purchase redemption rate
          each issuer's own portal offers (Chase Travel, Capital One's "Cover Travel Purchases",
          Amex Pay with Points on flights, Citi Travel, Bank of America's Travel Center) — times
          the best portal multiplier available anywhere in your held cards from the same issuer
          (see "Point pooling" below), no transferring required. Chase, Capital One, Amex, and Citi
          have each converged on that same flat 1¢/point guaranteed rate across their whole card
          lineup, with no card-tier boost above it. As of October 2025 Chase specifically replaced
          its old flat 1.25×/1.5× Sapphire portal rates with a selective, non-guaranteed "Points
          Boost" promotion (up to 1.75¢–2¢, but only for specific hotels/airlines Chase picks) —
          and Amex/Citi similarly offer selective premium redemptions above 1¢ for specific
          bookings. None of that selective, promotional upside is modeled here; only each card's
          flat guaranteed rate is. Bank of America Premium Rewards Elite is the one real exception
          to "every card is flat 1¢": redeeming points for airfare through Bank of America's Travel
          Center gets a genuine, guaranteed 20% discount, worth 1.25¢/point — modeled here as that
          card's own higher portal multiplier, since it's the one guaranteed (not selective or
          promotional) card-tier rate boost across all five issuers.
        </p>
        <p>
          <span className="font-medium text-navy-950/70">Transfer ceiling:</span> the realistic
          rate times {TRANSFER_PREMIUM_FACTOR}×, this app's own reasoned estimate of the upside
          from redeeming at fixed award-chart prices against premium-cabin or peak-date cash
          prices, further scaled by the best transfer ratio among that issuer's own partners —
          only if the pooled-into card is itself transfer-eligible. Bank of America is a genuine
          structural exception here, not a simplification: none of its cards have any airline or
          hotel transfer partners at all, so a Bank of America card's ceiling always equals its
          realistic value — there's no further upside to model because none exists.
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
          <span className="font-medium text-navy-950/70">Cash fees on awards:</span> an award
          booking usually isn't free once you've spent the points — you still owe taxes, and on
          some airlines substantial carrier-imposed surcharges. Whatever you enter there is added
          straight onto the cost of every <em>transfer</em> path, because that's real money
          leaving your pocket alongside the points. It is deliberately <em>not</em> added to
          portal paths: booking through a portal pays the trip's full cash price in points, and
          that price already includes taxes, so there's nothing further to hand over. That
          asymmetry is exactly why the field is worth filling in — a transfer that looks cheaper
          on points alone can easily lose to a portal booking once a few hundred dollars of
          surcharges are counted. Fees never affect whether your balance is sufficient, since
          they're paid in cash rather than points.
        </p>
        <p>
          <span className="font-medium text-navy-950/70">Valuation basis:</span> "what a point is
          worth" isn't a fact — it depends on what you'd otherwise have done with it. The{' '}
          <em>Value points at</em> selector lets you choose, and the three options are exactly the
          three figures above: the cash-back floor, the guaranteed travel rate (the default), and
          the transfer ceiling. Whichever you pick drives every dollar figure in both views, so
          Portfolio and Trip Optimizer can't contradict each other. Worth knowing what it does and
          doesn't change: because cost is points × rate, raising the basis scales every path's
          cost together, so <em>the ranking barely moves — the cheapest path stays the cheapest</em>.
          What changes is the verdict: at the transfer basis a portal redemption costs{' '}
          {TRANSFER_PREMIUM_FACTOR}× the trip's cash price and so always reads as a poor deal,
          which is the correct message if you can genuinely transfer instead, and the wrong one if
          the portal is realistically your only option. The single exception to "ranking doesn't
          move" is award cash fees, which are paid in dollars and so don't scale with the basis —
          a heavily surcharged award looks relatively better the higher you value your points.
        </p>
        <p>
          <span className="font-medium text-navy-950/70">
            How this compares to The Points Guy and NerdWallet:
          </span>{' '}
          published valuations like TPG's (~2¢ for Chase) are <em>optimized-use</em> numbers —
          roughly "what could you get if you played this well," weighted toward high-value
          transfer-partner redemptions. The main critique of that approach is that it values
          premium-cabin awards at their full cash price, and almost nobody would actually pay
          $8,000 for that seat, so "saving $8,000" overstates what landed in your pocket. This
          app's comparable figure isn't its {formatUSDPerPoint(BASE_CPP)}/point default — it's the
          transfer basis above, which for Chase works out to{' '}
          {formatUSDPerPoint(BASE_CPP * TRANSFER_PREMIUM_FACTOR)}/point, close to TPG's headline.
          NerdWallet, which is more conservative, publishes a 1–1.8¢ range for Chase against this
          app's {formatUSDPerPoint(BASE_CPP)}–
          {formatUSDPerPoint(BASE_CPP * TRANSFER_PREMIUM_FACTOR)} — nearly the same territory. So
          this app isn't out of step with published valuations; it defaults to the guaranteed end
          of the same range and makes the optimistic end an explicit choice rather than the
          headline. (TPG also subtracts taxes and fees before computing cents per point — the same
          reasoning behind the award-fee input above.)
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
          held card's rate instead. Bank of America pools in yet a different way: since none of its
          cards are transfer-eligible, pooling never unlocks a ceiling for it — but it still moves
          two other numbers. If you hold Travel Rewards alongside Premium Rewards or Premium
          Rewards Elite, Travel Rewards' floor is computed as if pooled into whichever sibling has
          the better cash-back rate, escaping its own worse {formatUSDPerPoint(0.006)}/point
          floor. And if you hold Premium Rewards Elite alongside either of the other two, its 1.25×
          realistic-value boost carries over to them too — the one case among all five issuers
          where pooling genuinely changes realistic value, not just ceiling.{' '}
          <strong>Points never pool across issuers</strong> — Chase Ultimate Rewards, Capital One
          miles, Amex Membership Rewards, Citi ThankYou Points, and Bank of America points are five
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
