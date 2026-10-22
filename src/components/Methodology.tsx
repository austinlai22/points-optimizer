import type { ReactNode } from 'react';
import { BASE_CPP, CASH_BACK_RATE, TRANSFER_PREMIUM_FACTOR } from '../utils/valuation';
import { formatUSDPerPoint } from '../utils/format';
import {
  CARD_TERMS_VERIFIED_ON,
  MAX_VERIFICATION_AGE_MONTHS,
  formatVerifiedOn,
  oldestVerifiedOn,
} from '../utils/freshness';
import transferPartnersData from '../data/transferPartners.json';
import verdictConfig from '../data/verdict-config.json';
import { FOCUS_RING, TAP_TARGET } from '../styles/constants';
import type { TransferPartner } from '../types';

// The oldest partner date, not the newest: the app is only as current as its
// weakest datum, and quoting the best one would flatter the data.
const ratiosVerifiedOn = oldestVerifiedOn(
  (transferPartnersData as TransferPartner[])
    .map((partner) => partner.verifiedOn)
    .filter((date): date is string => Boolean(date)),
);

const rate = (dollarsPerPoint: number) => formatUSDPerPoint(dollarsPerPoint);
const strain = verdictConfig.strain;
const clearlyBeatsPercent = Math.round((verdictConfig.clearly_beats_benchmark_multiplier - 1) * 100);

function Topic({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-display text-base font-medium text-navy-950">{title}</h3>
      <div className="mt-1.5 space-y-2">{children}</div>
    </section>
  );
}

function Term({ children }: { children: ReactNode }) {
  return <span className="font-medium text-navy-950/80">{children}</span>;
}

export function Methodology() {
  return (
    <details className="group mt-16 rounded-3xl border border-navy/10 bg-white">
      <summary
        className={`flex cursor-pointer select-none items-center justify-between gap-3 rounded-3xl px-6 py-4 text-sm font-medium text-navy-950/70 ${TAP_TARGET} ${FOCUS_RING}`}
      >
        How the figures are calculated
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </summary>
      <div className="max-w-3xl space-y-6 px-6 pb-8 text-sm leading-relaxed text-navy-950/65">
        <Topic title="The recommendation">
          <p>
            For each way of paying with points, PointCompass calculates the value per point: the
            cash price, less any taxes on the award, divided by the points used. It compares that
            with what those points are usually worth, according to the setting chosen under "Value
            points at".
          </p>
          <p>
            It also checks whether paying cash would leave you stretched. That is the case if less
            than {strain.min_months_of_buffer} month of your usual spending would remain, or if the
            trip would cost more than {strain.negative_leftover_max_share_of_cash * 100}% of your
            cash while your spending exceeds your income. Both thresholds are this app's own rules
            of thumb.
          </p>
          <p>
            Four rules then decide the recommendation. If no points option reaches its usual value,
            pay cash, or wait if paying would leave you stretched. If paying would leave you
            stretched and a points option holds its value, use points. Otherwise, points must beat
            their usual value by at least {clearlyBeatsPercent}% to be worth spending, and if they
            do not, pay cash and keep them.
          </p>
          <p>
            The Chase Travel breakeven is the highest points price at which Chase Travel would
            become the recommendation: the cash price multiplied by 100, divided by the value per
            point Chase Travel needs to reach, rounded down. It uses the same test as the
            recommendation, so the two always agree.
          </p>
        </Topic>

        <Topic title="Three ways to value points">
          <p>
            <Term>Cash-back floor.</Term> What the points would pay out as cash. Chase and Bank of
            America pay {rate(CASH_BACK_RATE.chase)} per point, the same as their travel rate. The
            others pay less in cash than in travel: Capital One {rate(CASH_BACK_RATE.capitalOne)},
            Amex {rate(CASH_BACK_RATE.amex)}, Citi {rate(CASH_BACK_RATE.citi)} and Bilt{' '}
            {rate(CASH_BACK_RATE.bilt)}. Bank of America's Travel Rewards card pays{' '}
            {rate(0.006)}, less than the bank's other cards.
          </p>
          <p>
            <Term>Guaranteed travel.</Term> What the points buy through the bank's own travel
            portal, for any trip, with no award seat required. This is {rate(BASE_CPP)} per point
            for most cards. Bilt's travel portal pays {rate(0.0125)}, and Bank of America's Premium
            Rewards Elite takes 20% off airfare, which is worth {rate(0.0125)}.
          </p>
          <p>
            Chase is treated separately in the recommendation. Points Boost offers can raise the
            value to as much as 2× on the Sapphire Reserve and 1.5× on the Sapphire Preferred.
            Reserve cardmembers who applied before June 23, 2025 also receive 1.5× on points earned
            before October 26, 2025, until October 26, 2027. Because no Boost offer is guaranteed
            for a particular trip, Portfolio and the ranked options use the standard rate.
          </p>
          <p>
            <Term>Potential transfer value.</Term> This app's own estimate of what transfers to
            airline and hotel partners can achieve: {TRANSFER_PREMIUM_FACTOR}× the guaranteed rate.
            Award charts price seats in a fixed number of points while cash fares rise with demand,
            which is where the extra value comes from. No bank publishes this figure, so it is
            labelled as an estimate and is never the default. Transfer ratios above 1:1 are not
            counted as extra value, because partners that give more points per point usually have
            points worth less. Ratios below 1:1 are counted in full. Bank of America has no
            transfer partners, so its potential value equals its guaranteed value.
          </p>
        </Topic>

        <Topic title="Pricing each option">
          <p>
            Each option's cost is the points it uses, valued at the chosen rate, plus any taxes
            and fees on the award. A lower cost is better, and "Poor deal" means the cost exceeds
            the cash price. Each bank contributes one option per transfer partner and one for its
            travel portal. The card named is the one to use: the best rate available, and among
            equal rates, the lowest annual fee. Annual fees do not affect the ranking, since they
            are paid either way.
          </p>
          <p>
            Taxes and fees apply only to transfers. A portal booking is paid entirely in points at
            the cash price, which already includes taxes. This is often why a portal booking beats
            an award with large surcharges.
          </p>
          <p>
            Points you already hold with an airline or hotel reduce what needs transferring. They
            are treated as already spent, because this app does not assign a value to partner
            currencies, so such an option shows what the trip costs from this point onward.
          </p>
        </Topic>

        <Topic title="Combining points">
          <p>
            Banks let you combine points across cards in the same program, and PointCompass
            assumes you would move them to your best card before redeeming. Chase Freedom points,
            for example, gain transfer access when combined with a Sapphire card. Points never
            combine across banks: Chase, Capital One, Amex, Citi, Bank of America and Bilt are
            separate currencies, even when they share a transfer partner.
          </p>
          <p>
            Where a specific card transfers at a worse ratio, the cost reflects it. The Sapphire
            Preferred transfers to World of Hyatt at 4:3 rather than 1:1, and the no-fee Citi
            Strata card transfers to every partner at 10:7. Holding a better card in the same
            program removes the penalty.
          </p>
        </Topic>

        <Topic title="A note on Bilt">
          <p>
            Bilt is included because it is the only transferable currency that reaches Atmos
            Rewards, the combined Alaska and Hawaiian program. Its best guaranteed use is paying
            rent or a mortgage, at about 1.5¢ per point, which is above its travel rate. A Bilt
            redemption that appears to break even here is likely to be a small loss compared with
            putting the same points toward rent.
          </p>
        </Topic>

        <Topic title="Comparison with published valuations">
          <p>
            The Points Guy values Chase points at about 2¢, and NerdWallet at between 1¢ and 1.8¢.
            Those figures assume skilled use of transfer partners, often for premium cabins valued
            at their full cash price. PointCompass defaults to the guaranteed rate and treats the
            optimistic figure as a choice. For Chase, its potential transfer value is{' '}
            {rate(BASE_CPP * TRANSFER_PREMIUM_FACTOR)}, within the same range.
          </p>
        </Topic>

        <Topic title="How current the data is">
          <p>
            Transfer ratios were last checked in{' '}
            {ratiosVerifiedOn ? formatVerifiedOn(ratiosVerifiedOn) : 'an unrecorded month'}, against
            Capital One's published list and, for Chase, Amex, Citi and Bilt, which show their lists
            only to signed-in cardholders, against recent public guides. Card terms were last fully
            checked in {formatVerifiedOn(CARD_TERMS_VERIFIED_ON)}. Every ratio and card is linked to
            its source in the data, and the test suite fails if anything goes{' '}
            {MAX_VERIFICATION_AGE_MONTHS} months without a check.
          </p>
          <p>
            Banks change these terms without notice. In 2026 alone, Citi ended transfers to
            Aeromexico and added Japan Airlines, while Amex reduced its Cathay Pacific ratio and
            ended transfers to Etihad. Treat every figure as a snapshot, and confirm current terms
            with the bank before redeeming.
          </p>
        </Topic>
      </div>
    </details>
  );
}
