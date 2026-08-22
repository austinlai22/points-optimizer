import { useEffect, useMemo, useState } from 'react';
import cardsData from '../data/cards.json';
import transferPartnersData from '../data/transferPartners.json';
import { useCardBalances } from '../context/CardBalancesContext';
import { computeRedemptionPaths } from '../utils/valuation';
import { computeDenseRanks } from '../utils/ranking';
import {
  CARD_SURFACE,
  FIELD,
  FOCUS_RING,
  ISSUER_LABELS,
  ISSUER_ORDER,
  LABEL,
  TAP_TARGET,
} from '../styles/constants';
import { RedemptionPathCard } from './RedemptionPathCard';
import { Methodology } from './Methodology';
import { formatUSD, parseNonNegativeNumber } from '../utils/format';
import type { CardConfig, Issuer, PartnerType, RedemptionPath, TransferPartner } from '../types';

const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];

const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  hotel: 'Hotels',
  airline: 'Airlines',
};
const PARTNER_TYPE_ORDER: PartnerType[] = ['hotel', 'airline'];

const TRIP_STORAGE_KEY = 'cco:tripOptimizer';

interface TripInputs {
  tripCashPrice: number;
  selectedPartnerId: string;
  pointsRequired: number;
}

const DEFAULT_TRIP_INPUTS: TripInputs = { tripCashPrice: 0, selectedPartnerId: '', pointsRequired: 0 };

function sanitizeStoredNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

// A shared link's query params take priority over anything saved locally
// from a previous session — opening someone else's link should show THEIR
// scenario, not silently keep your own leftover inputs. Only trip
// scenario fields go in the URL/localStorage here; portfolio balances are
// deliberately never included, so sharing a link never leaks your points.
function loadInitialTripInputs(): TripInputs {
  const params = new URLSearchParams(window.location.search);
  if (params.has('price') || params.has('partner') || params.has('points')) {
    return {
      tripCashPrice: parseNonNegativeNumber(params.get('price') ?? ''),
      selectedPartnerId: params.get('partner') ?? '',
      pointsRequired: parseNonNegativeNumber(params.get('points') ?? ''),
    };
  }
  try {
    const stored = localStorage.getItem(TRIP_STORAGE_KEY);
    if (!stored) return DEFAULT_TRIP_INPUTS;
    const parsed = JSON.parse(stored);
    return {
      tripCashPrice: sanitizeStoredNumber(parsed.tripCashPrice),
      selectedPartnerId: typeof parsed.selectedPartnerId === 'string' ? parsed.selectedPartnerId : '',
      pointsRequired: sanitizeStoredNumber(parsed.pointsRequired),
    };
  } catch {
    return DEFAULT_TRIP_INPUTS;
  }
}

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22 11 13 2 9Z" />
    </svg>
  );
}

interface TakeawayLineProps {
  topPath: RedemptionPath;
  tiedCount: number;
  tripCashPrice: number;
}

function TakeawayLine({ topPath, tiedCount, tripCashPrice }: TakeawayLineProps) {
  const savings = tripCashPrice - topPath.cost;
  const colorClass = savings > 0 ? 'text-teal' : savings === 0 ? 'text-orange' : 'text-red';
  const amount = <span className={`font-mono font-medium ${colorClass}`}>{formatUSD(Math.abs(savings))}</span>;

  if (savings < 0) {
    return (
      <p className="mb-5 text-navy-950/70">
        {tiedCount > 1 ? (
          <>Even your best options ({tiedCount} tied) cost {amount} more than paying cash</>
        ) : (
          <>
            Even your best option, {topPath.card.name}, costs {amount} more than paying cash
          </>
        )}{' '}
        — none of these redemptions are worth it for this trip.
      </p>
    );
  }

  const verb = savings === 0 ? 'break' : 'save';
  return (
    <p className="mb-5 text-navy-950/70">
      {tiedCount > 1 ? (
        <>Best options ({tiedCount} tied)</>
      ) : (
        <>Best option: {topPath.card.name}</>
      )}{' '}
      —{' '}
      {savings === 0 ? (
        <>{tiedCount > 1 ? verb : 'breaks'} even with paying cash for this trip.</>
      ) : (
        <>
          {tiedCount > 1 ? verb : 'saves'} {amount} vs. paying cash for this trip.
        </>
      )}
    </p>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function TripOptimizerView() {
  const { balances, ownership } = useCardBalances();
  const initialTripInputs = useMemo(loadInitialTripInputs, []);
  const [tripCashPrice, setTripCashPrice] = useState(initialTripInputs.tripCashPrice);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialTripInputs.selectedPartnerId);
  // A single value, not keyed by card — only one brand is ever priced at a
  // time, and its award cost doesn't depend on which of your cards you'd
  // transfer from.
  const [pointsRequired, setPointsRequired] = useState(initialTripInputs.pointsRequired);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const ownedCards = useMemo(() => cards.filter((card) => ownership[card.id]), [ownership]);
  const ownedTransferEligibleIssuers = useMemo(
    () => new Set(ownedCards.filter((card) => card.transferEligible).map((card) => card.issuer)),
    [ownedCards],
  );

  // A partner may be reachable from more than one issuer (e.g. Flying Blue
  // from both Chase and Capital One) — resolve which of ITS issuers you can
  // actually use, given which transfer-eligible cards you hold.
  const relevantIssuersFor = (partner: TransferPartner): Issuer[] =>
    ISSUER_ORDER.filter(
      (issuer) => partner.ratiosByIssuer[issuer] !== undefined && ownedTransferEligibleIssuers.has(issuer),
    );

  // Only offer brands you could actually redeem through — no point listing
  // a hotel/airline partner none of your held transfer-eligible cards reach.
  const availablePartners = useMemo(
    () => transferPartners.filter((p) => relevantIssuersFor(p).length > 0),
    [ownedTransferEligibleIssuers],
  );
  const selectedPartner = availablePartners.find((p) => p.id === selectedPartnerId) ?? null;
  const selectedPartnerIssuers = selectedPartner ? relevantIssuersFor(selectedPartner) : [];

  const pointsRequiredByPartner = useMemo(
    () => (selectedPartner && pointsRequired > 0 ? { [selectedPartner.id]: pointsRequired } : {}),
    [selectedPartner, pointsRequired],
  );

  const paths = useMemo(
    () =>
      computeRedemptionPaths({
        cards: ownedCards,
        transferPartners,
        balances,
        tripCashPrice,
        pointsRequiredByPartner,
      }),
    [ownedCards, balances, tripCashPrice, pointsRequiredByPartner],
  );

  const ranks = useMemo(() => computeDenseRanks(paths.map((p) => p.cost)), [paths]);
  const countByRank = useMemo(
    () =>
      ranks.reduce<Record<number, number>>((acc, r) => {
        acc[r] = (acc[r] ?? 0) + 1;
        return acc;
      }, {}),
    [ranks],
  );

  const handleBrandChange = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    // A new brand means a new award chart — last brand's points requirement
    // no longer applies, so don't silently carry it over.
    setPointsRequired(0);
  };

  // A persisted or shared partner might not be reachable anymore (e.g. you
  // no longer own a transfer-eligible card for that issuer) — fall back to
  // "no brand selected" rather than leaving the dropdown pointed at
  // something that isn't one of its own options.
  useEffect(() => {
    if (selectedPartnerId && !availablePartners.some((p) => p.id === selectedPartnerId)) {
      setSelectedPartnerId('');
    }
  }, [availablePartners, selectedPartnerId]);

  // Keep the current scenario in both localStorage (so it survives a
  // reload) and the URL (so the address bar itself is always a valid share
  // link, even without clicking "Copy link"). Deliberately excludes
  // portfolio balances — only the trip scenario itself is ever persisted or
  // shareable.
  useEffect(() => {
    try {
      localStorage.setItem(
        TRIP_STORAGE_KEY,
        JSON.stringify({ tripCashPrice, selectedPartnerId, pointsRequired }),
      );
    } catch {
      // localStorage unavailable (private mode / quota) — inputs still work in-memory.
    }

    const params = new URLSearchParams();
    if (tripCashPrice > 0) params.set('price', String(tripCashPrice));
    if (selectedPartnerId) params.set('partner', selectedPartnerId);
    if (pointsRequired > 0) params.set('points', String(pointsRequired));
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, [tripCashPrice, selectedPartnerId, pointsRequired]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      // Clipboard API unavailable/blocked — the address bar already
      // reflects the current scenario as a fallback, so this just no-ops.
    }
  };

  return (
    <div>
      <h2 className="mb-1.5 font-display text-2xl font-medium tracking-tight text-navy-950">
        Trip Optimizer
      </h2>
      <p className="mb-8 max-w-2xl text-navy-950/60">
        Enter a trip's cash price, then choose the hotel or flight brand you'd redeem it through
        to see redemption paths ranked by cost — the lowest cost is the best deal.
      </p>

      <div className={`${CARD_SURFACE} mb-8 p-6`}>
        <div className="mb-1.5 flex flex-wrap items-start justify-between gap-3">
          <label htmlFor="trip-price" className={LABEL}>
            Trip cash price
          </label>
          {(tripCashPrice > 0 || selectedPartnerId) && (
            <button
              type="button"
              onClick={handleCopyLink}
              className={`rounded-lg border border-navy/20 px-3 text-sm font-medium text-navy-950/70 transition-colors hover:border-navy/40 hover:text-navy-950 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`}
            >
              {copyStatus === 'copied' ? 'Copied!' : 'Copy link'}
            </button>
          )}
        </div>
        <div className="relative mb-7 max-w-xs">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-navy-950/35">
            $
          </span>
          <input
            id="trip-price"
            type="number"
            min={0}
            inputMode="numeric"
            value={tripCashPrice || ''}
            onChange={(event) => setTripCashPrice(parseNonNegativeNumber(event.target.value))}
            placeholder="0"
            className={`${FIELD} pl-7 ${TAP_TARGET} ${FOCUS_RING}`}
          />
        </div>

        <label htmlFor="brand-select" className={`mb-1.5 block ${LABEL}`}>
          Hotel or flight brand
        </label>
        {availablePartners.length === 0 ? (
          <p className="max-w-md text-sm text-navy-950/55">
            No transfer partners available — you don't currently hold a transfer-eligible card.
            Redeeming via each card's own portal is still shown below once you enter a trip price.
          </p>
        ) : (
          <div className="relative max-w-xs">
            <select
              id="brand-select"
              value={selectedPartnerId}
              onChange={(event) => handleBrandChange(event.target.value)}
              className={`${FIELD} appearance-none pr-9 ${TAP_TARGET} ${FOCUS_RING}`}
            >
              <option value="" disabled>
                Choose a brand…
              </option>
              {PARTNER_TYPE_ORDER.map((type) => {
                const partnersOfType = availablePartners.filter((p) => p.type === type);
                if (partnersOfType.length === 0) return null;
                return (
                  <optgroup key={type} label={PARTNER_TYPE_LABELS[type]}>
                    {partnersOfType.map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name} —{' '}
                        {relevantIssuersFor(partner)
                          .map((issuer) => ISSUER_LABELS[issuer])
                          .join(' & ')}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-navy-950/35">
              <ChevronDownIcon />
            </span>
          </div>
        )}

        {selectedPartner && (
          <div className="mt-6">
            <p className={`mb-1.5 ${LABEL}`}>
              Points required for {selectedPartner.name}{' '}
              <span className="normal-case text-navy-950/40">
                ({selectedPartnerIssuers.map((issuer) => ISSUER_LABELS[issuer]).join(' & ')}{' '}
                cards only)
              </span>
            </p>
            <input
              id="points-required"
              type="number"
              min={0}
              inputMode="numeric"
              value={pointsRequired || ''}
              onChange={(event) => setPointsRequired(parseNonNegativeNumber(event.target.value))}
              placeholder="0"
              className={`${FIELD} max-w-xs ${TAP_TARGET} ${FOCUS_RING}`}
            />
          </div>
        )}
      </div>

      {paths.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy/20 px-6 py-14 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-navy/10 text-navy">
            <CompassIcon />
          </div>
          <p className="text-navy-950/55">
            Enter a trip price to compare each card's own portal, or also choose a brand and
            points required to compare transferring.
          </p>
        </div>
      ) : (
        <>
          <TakeawayLine
            topPath={paths[0]}
            tiedCount={countByRank[1] ?? 1}
            tripCashPrice={tripCashPrice}
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {paths.map((path, index) => (
              <RedemptionPathCard
                key={`${path.issuer}-${path.kind}-${path.partner?.id ?? 'portal'}-${path.card.id}`}
                path={path}
                rank={ranks[index]}
                isTied={countByRank[ranks[index]] > 1}
                tripCashPrice={tripCashPrice}
              />
            ))}
          </div>
        </>
      )}
      <Methodology />
    </div>
  );
}
