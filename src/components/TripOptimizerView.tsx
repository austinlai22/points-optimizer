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
import { ValuationBasisSelect } from './ValuationBasisSelect';
import { Methodology } from './Methodology';
import { PageIntro } from './PageShell';
import { linkHandler, scrollToSection } from '../lib/router';
import { useOnScreen } from '../utils/useInView';
import { VerdictCard } from './VerdictCard';
import { PriceCheck } from './PriceCheck';
import type { BoostAnswer } from '../lib/reports/validate';
import { CashCushionInputs } from './CashCushionInputs';
import { ChaseTravelInputs } from './ChaseTravelInputs';
import {
  EMPTY_CASH_INPUTS,
  EMPTY_CHASE_INPUTS,
  sanitizeCashInputs,
  sanitizeChaseInputs,
} from '../utils/verdictInputs';
import { evaluateVerdict, inferChaseCardType, verdictHeadline } from '../lib/verdict';
import type { VerdictResult } from '../lib/verdict/types';
import { track } from '../utils/analytics';
import { usePersistentState } from '../utils/usePersistentState';
import { formatUSD, parseFiniteNumber, parseNonNegativeNumber } from '../utils/format';
import { DEFAULT_VALUATION_BASIS } from '../types';
import type { CardConfig, Issuer, PartnerType, RedemptionPath, TransferPartner } from '../types';

const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];

const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  hotel: 'Hotels',
  airline: 'Airlines',
};
const PARTNER_TYPE_ORDER: PartnerType[] = ['hotel', 'airline'];

const TRIP_STORAGE_KEY = 'cco:tripOptimizer';
// Cash and Chase card details belong to this browser, never the URL, so a
// shared trip link can't carry someone's finances along with it.
const CASH_STORAGE_KEY = 'cco:cash';
const CHASE_STORAGE_KEY = 'cco:chase';

interface TripInputs {
  tripCashPrice: number;
  selectedPartnerId: string;
  pointsRequired: number;
  partnerPointsHeld: number;
  awardCashFees: number;
  // A points price the user saw in Chase Travel for this trip.
  chaseTravelPoints: number;
}

const DEFAULT_TRIP_INPUTS: TripInputs = {
  tripCashPrice: 0,
  selectedPartnerId: '',
  pointsRequired: 0,
  partnerPointsHeld: 0,
  awardCashFees: 0,
  chaseTravelPoints: 0,
};

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
  if (params.has('price') || params.has('partner') || params.has('points') || params.has('held') || params.has('fees')) {
    return {
      tripCashPrice: parseNonNegativeNumber(params.get('price') ?? ''),
      selectedPartnerId: params.get('partner') ?? '',
      pointsRequired: parseNonNegativeNumber(params.get('points') ?? ''),
      partnerPointsHeld: parseNonNegativeNumber(params.get('held') ?? ''),
      awardCashFees: parseNonNegativeNumber(params.get('fees') ?? ''),
      chaseTravelPoints: parseNonNegativeNumber(params.get('ct') ?? ''),
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
      partnerPointsHeld: sanitizeStoredNumber(parsed.partnerPointsHeld),
      awardCashFees: sanitizeStoredNumber(parsed.awardCashFees),
      chaseTravelPoints: sanitizeStoredNumber(parsed.chaseTravelPoints),
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
  const tied = tiedCount > 1;

  if (savings < 0) {
    return (
      <p className="mb-5 text-navy-950/70">
        {tied ? <>Your best options ({tiedCount} tied) cost</> : <>Your best option, {topPath.card.name}, costs</>}{' '}
        {amount} more than paying cash, so none of these redemptions is worthwhile for this trip.
      </p>
    );
  }
  return (
    <p className="mb-5 text-navy-950/70">
      {tied ? <>Best options ({tiedCount} tied).</> : <>Best option: {topPath.card.name}.</>}{' '}
      {savings === 0 ? (
        <>{tied ? 'They cost' : 'It costs'} the same as paying cash.</>
      ) : (
        <>
          {tied ? 'Each saves' : 'It saves'} {amount} compared with paying cash.
        </>
      )}
    </p>
  );
}

// The picture beside the page title: a trip ticket and the answer it gets.
// Decorative only.
function TripIntroVisual() {
  return (
    <div className="relative h-44 w-80">
      <div className="absolute left-0 top-2 w-64 -rotate-3 rounded-3xl bg-white p-5 shadow-card ring-1 ring-navy/10">
        <div className="flex items-center justify-between text-navy-950">
          <span className="font-display text-2xl font-semibold">JFK</span>
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-navy/60" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 13.5l7-2 4.5-7.5h2l-2.5 7 5-1.5 1.5-2h1.5l-1 4 1 4h-1.5l-1.5-2-5-1.5 2.5 7h-2l-4.5-7.5-7-2z" />
          </svg>
          <span className="font-display text-2xl font-semibold">LIS</span>
        </div>
        <div className="mt-3 border-t border-dashed border-navy/15 pt-3 text-xs text-navy-950/50">Cash price</div>
        <div className="font-mono text-lg text-navy-950">$900</div>
      </div>
      <div className="absolute bottom-0 right-0 rotate-2 rounded-2xl bg-gradient-to-br from-navy-950 to-navy px-5 py-3.5 shadow-card">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-50/50">Recommendation</p>
        <p className="font-display text-lg font-semibold text-slate-50">Transfer points</p>
      </div>
    </div>
  );
}

function StepHeading({ step, title, children }: { step: number | string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy font-mono text-xs text-slate-50">
        {step}
      </span>
      <div>
        <h2 className="font-display text-lg font-medium leading-tight text-navy-950">{title}</h2>
        {children && <p className="mt-1 text-sm text-navy-950/55">{children}</p>}
      </div>
    </div>
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
  const { balances, ownership, basis } = useCardBalances();
  const initialTripInputs = useMemo(loadInitialTripInputs, []);
  const [tripCashPrice, setTripCashPrice] = useState(initialTripInputs.tripCashPrice);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialTripInputs.selectedPartnerId);
  // A single value, not keyed by card — only one brand is ever priced at a
  // time, and its award cost doesn't depend on which of your cards you'd
  // transfer from.
  const [pointsRequired, setPointsRequired] = useState(initialTripInputs.pointsRequired);
  const [partnerPointsHeld, setPartnerPointsHeld] = useState(initialTripInputs.partnerPointsHeld);
  const [awardCashFees, setAwardCashFees] = useState(initialTripInputs.awardCashFees);
  const [chaseTravelPoints, setChaseTravelPoints] = useState(initialTripInputs.chaseTravelPoints);
  // Whether Chase Travel showed a Points Boost offer: only used for a shared
  // price report, so it lives here and nowhere persistent.
  const [boostShown, setBoostShown] = useState<BoostAnswer | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [verdictRef, verdictOnScreen] = useOnScreen<HTMLDivElement>();
  const [cashInputs, setCashInputs] = usePersistentState(CASH_STORAGE_KEY, EMPTY_CASH_INPUTS, sanitizeCashInputs);
  const [chaseInputs, setChaseInputs] = usePersistentState(CHASE_STORAGE_KEY, EMPTY_CHASE_INPUTS, sanitizeChaseInputs);

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
        awardCashFees,
        partnerPointsHeld,
        basis,
      }),
    [
      ownedCards,
      balances,
      tripCashPrice,
      pointsRequiredByPartner,
      awardCashFees,
      partnerPointsHeld,
      basis,
    ],
  );

  const ownsChase = ownedCards.some((card) => card.issuer === 'chase');
  const inferredChaseCardType = useMemo(() => inferChaseCardType(ownedCards), [ownedCards]);

  const cash = {
    available: parseFiniteNumber(cashInputs.available),
    monthlyLeftover: parseFiniteNumber(cashInputs.leftover),
    monthlySpend: parseFiniteNumber(cashInputs.spend),
  };
  const cashComplete = cash.available !== null && cash.monthlyLeftover !== null && cash.monthlySpend !== null;

  // The shared verdict engine, fed the same inputs as the ranked
  // paths below, so the verdict and the list can't disagree.
  const verdict: VerdictResult | null = useMemo(() => {
    if (!(tripCashPrice > 0) || !cashComplete) return null;
    const legacyPoints = parseFiniteNumber(chaseInputs.legacyPoints);
    try {
      return evaluateVerdict({
        tripCashPrice,
        awardTaxes: awardCashFees,
        ownedCards,
        balances,
        transferPartners,
        award:
          selectedPartnerId && pointsRequired > 0
            ? { partnerId: selectedPartnerId, pointsRequired, partnerPointsHeld }
            : undefined,
        basis,
        chase: {
          cardType: chaseInputs.cardType || inferredChaseCardType,
          reserveAppliedBeforeCutoff: chaseInputs.appliedBeforeCutoff ?? undefined,
          legacyPoints: legacyPoints !== null && legacyPoints >= 0 ? legacyPoints : undefined,
          travelPricePoints: ownsChase && chaseTravelPoints > 0 ? chaseTravelPoints : undefined,
        },
        cash: {
          available: cash.available!,
          monthlyLeftover: cash.monthlyLeftover!,
          monthlySpend: Math.max(cash.monthlySpend!, 0),
        },
      });
    } catch {
      return null;
    }
  }, [
    tripCashPrice, cashComplete, cash.available, cash.monthlyLeftover, cash.monthlySpend,
    awardCashFees, ownedCards, balances, selectedPartnerId, pointsRequired, partnerPointsHeld,
    basis, chaseInputs, inferredChaseCardType, ownsChase, chaseTravelPoints,
  ]);

  // Pilot counts: a verdict counts once it has stayed put for a moment, so
  // typing "1", "12", "120" into a field isn't three verdicts.
  const verdictKey = verdict ? verdict.verdict : null;
  const pastedUsed = verdict?.chaseTravel?.pastedPricePoints != null;
  useEffect(() => {
    if (!verdictKey) return;
    const timer = setTimeout(() => {
      track({ event: 'trip_check', verdict: verdictKey });
      if (pastedUsed) track({ event: 'price_check' });
    }, 2000);
    return () => clearTimeout(timer);
  }, [verdictKey, pastedUsed]);

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
    // and its taxes/surcharges no longer apply, so don't silently carry
    // either over.
    setPointsRequired(0);
    setPartnerPointsHeld(0);
    setAwardCashFees(0);
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
        JSON.stringify({
          tripCashPrice,
          selectedPartnerId,
          pointsRequired,
          partnerPointsHeld,
          awardCashFees,
          chaseTravelPoints,
        }),
      );
    } catch {
      // localStorage unavailable (private mode / quota) — inputs still work in-memory.
    }

    const params = new URLSearchParams();
    if (tripCashPrice > 0) params.set('price', String(tripCashPrice));
    if (selectedPartnerId) params.set('partner', selectedPartnerId);
    if (pointsRequired > 0) params.set('points', String(pointsRequired));
    if (partnerPointsHeld > 0) params.set('held', String(partnerPointsHeld));
    if (awardCashFees > 0) params.set('fees', String(awardCashFees));
    if (chaseTravelPoints > 0) params.set('ct', String(chaseTravelPoints));
    // Basis lives in shared context (Portfolio uses it too) but is
    // serialized here alongside the other trip inputs, so one copied link
    // reproduces the whole scenario. Omitted at the default, matching how
    // zero-valued params are left out.
    if (basis !== DEFAULT_VALUATION_BASIS) params.set('basis', basis);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, [tripCashPrice, selectedPartnerId, pointsRequired, partnerPointsHeld, awardCashFees, chaseTravelPoints, basis]);

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

  const money = (id: string, value: number, onChange: (v: number) => void) => (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-navy-950/35">
        $
      </span>
      <input
        id={id}
        type="number"
        min={0}
        inputMode="numeric"
        value={value || ''}
        onChange={(event) => onChange(parseNonNegativeNumber(event.target.value))}
        placeholder="0"
        className={`${FIELD} pl-7 ${TAP_TARGET} ${FOCUS_RING}`}
      />
    </div>
  );

  const missing = [
    !(tripCashPrice > 0) && 'the trip price',
    !cashComplete && 'your cash position',
  ].filter(Boolean) as string[];

  return (
    <>
      <PageIntro
        title="Check a trip"
        visual={<TripIntroVisual />}
        actions={
          (tripCashPrice > 0 || selectedPartnerId) && (
            <button
              type="button"
              onClick={handleCopyLink}
              className={`rounded-full border border-navy/20 px-4 text-sm font-medium text-navy-950/70 transition-colors hover:border-navy/40 hover:text-navy-950 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`}
            >
              {copyStatus === 'copied' ? 'Link copied' : 'Copy link to this trip'}
            </button>
          )
        }
      >
        <p>
          Find the best way to pay for your trip. Enter the price and your cash position for a
          recommendation, and add an airline or hotel award price to compare transferring too.
        </p>
      </PageIntro>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {ownedCards.length === 0 && (
          <div className="mb-8 rounded-2xl border border-amber/30 bg-amber/5 px-5 py-4">
            <p className="text-sm text-navy-950/75">
              Add the cards you hold and their balances in Portfolio first. The recommendation can
              only include points it knows about.
            </p>
            <a
              href="/portfolio"
              onClick={linkHandler('/portfolio')}
              className={`mt-2 inline-block rounded text-sm font-medium text-navy underline underline-offset-2 ${FOCUS_RING}`}
            >
              Go to Portfolio
            </a>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-start">
          {/* Inputs on the left, results on the right on wide screens, so a
              change is visible without scrolling. Stacked on phones. */}
          <div className="space-y-6">
            <section className={`${CARD_SURFACE} p-6`}>
              <StepHeading step={1} title="The trip" />
              <div className="space-y-5">
                <div>
                  <label htmlFor="trip-price" className={`mb-1.5 block ${LABEL}`}>
                    Trip cash price
                  </label>
                  {money('trip-price', tripCashPrice, setTripCashPrice)}
                  <p className="mt-1.5 text-xs text-navy-950/50">
                    The price if you pay with cash. Every option is compared with it.
                  </p>
                </div>

                <div>
                  <label htmlFor="brand-select" className={`mb-1.5 block ${LABEL}`}>
                    Airline or hotel program <span className="normal-case text-navy-950/40">(optional)</span>
                  </label>
                  {availablePartners.length === 0 ? (
                    <p className="text-sm text-navy-950/55">
                      None of your cards transfer points to airline or hotel programs. Travel portal
                      options still appear once you enter a price.
                    </p>
                  ) : (
                    <div className="relative">
                      <select
                        id="brand-select"
                        value={selectedPartnerId}
                        onChange={(event) => handleBrandChange(event.target.value)}
                        className={`${FIELD} appearance-none pr-9 ${TAP_TARGET} ${FOCUS_RING}`}
                      >
                        <option value="" disabled>
                          Choose a program
                        </option>
                        {PARTNER_TYPE_ORDER.map((type) => {
                          // Alphabetical within each group: the roster is large
                          // enough that data-file order would look arbitrary.
                          const partnersOfType = availablePartners
                            .filter((p) => p.type === type)
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name));
                          if (partnersOfType.length === 0) return null;
                          return (
                            <optgroup key={type} label={PARTNER_TYPE_LABELS[type]}>
                              {partnersOfType.map((partner) => (
                                <option key={partner.id} value={partner.id}>
                                  {partner.name} (
                                  {relevantIssuersFor(partner)
                                    .map((issuer) => ISSUER_LABELS[issuer])
                                    .join(', ')}
                                  )
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
                </div>

                {selectedPartner && (
                  <div className="space-y-5 rounded-2xl border border-navy/10 bg-slate-50 p-4">
                    <div>
                      <label htmlFor="points-required" className={`mb-1.5 block ${LABEL}`}>
                        Award price in points
                      </label>
                      <input
                        id="points-required"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={pointsRequired || ''}
                        onChange={(event) => setPointsRequired(parseNonNegativeNumber(event.target.value))}
                        placeholder="0"
                        className={`${FIELD} bg-white ${TAP_TARGET} ${FOCUS_RING}`}
                      />
                      <p className="mt-1.5 text-xs text-navy-950/50">
                        As shown by {selectedPartner.name}. Transfers from{' '}
                        {selectedPartnerIssuers.map((issuer) => ISSUER_LABELS[issuer]).join(' or ')}.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="partner-points-held" className={`mb-1.5 block ${LABEL}`}>
                        Points already in your account
                      </label>
                      <input
                        id="partner-points-held"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={partnerPointsHeld || ''}
                        onChange={(event) => setPartnerPointsHeld(parseNonNegativeNumber(event.target.value))}
                        placeholder="0"
                        className={`${FIELD} bg-white ${TAP_TARGET} ${FOCUS_RING}`}
                      />
                      <p className="mt-1.5 text-xs text-navy-950/50">
                        Only the difference is transferred. These points are treated as already
                        spent, since this app does not assign a value to partner currencies.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="award-fees" className={`mb-1.5 block ${LABEL}`}>
                        Taxes and fees on the award
                      </label>
                      {money('award-fees', awardCashFees, setAwardCashFees)}
                      <p className="mt-1.5 text-xs text-navy-950/50">
                        Cash still payable when booking with points. Usually small, though some
                        airlines add large surcharges. Portal prices already include taxes.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className={`${CARD_SURFACE} p-6`}>
              <StepHeading step={2} title="Your cash position">
                These figures decide whether paying cash would leave you stretched.
              </StepHeading>
              <CashCushionInputs values={cashInputs} onChange={setCashInputs} />
            </section>

            {ownsChase && (
              <section className={`${CARD_SURFACE} p-6`}>
                <StepHeading step={3} title="Chase Travel">
                  Optional details that refine the Chase recommendation.
                </StepHeading>
                <ChaseTravelInputs
                  values={chaseInputs}
                  inferredCardType={inferredChaseCardType}
                  onChange={setChaseInputs}
                />
              </section>
            )}

            <section className={`${CARD_SURFACE} p-6`}>
              <ValuationBasisSelect />
            </section>
          </div>

          <div className="min-w-0">
            {verdict ? (
              <div id="recommendation" ref={verdictRef} className="scroll-mt-20">
                <VerdictCard result={verdict} />
                {verdict.chaseTravel && (
                  <PriceCheck
                    verdict={verdict}
                    tripCashPrice={tripCashPrice}
                    points={chaseTravelPoints}
                    onPointsChange={setChaseTravelPoints}
                    boost={boostShown}
                    onBoostChange={setBoostShown}
                  />
                )}
              </div>
            ) : (
              <div className="mb-8 rounded-3xl border border-dashed border-navy/20 bg-white px-6 py-12 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-navy/10 text-navy">
                  <CompassIcon />
                </div>
                <p className="font-display text-lg text-navy-950">Your recommendation will appear here</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-navy-950/55">
                  Add {missing.join(' and ')} to see it.
                </p>
              </div>
            )}

            {paths.length > 0 && (
              <section aria-labelledby="all-options">
                <h2 id="all-options" className="mb-2 font-display text-xl font-medium text-navy-950">
                  All ways to pay with points
                </h2>
                <TakeawayLine
                  topPath={paths[0]}
                  tiedCount={countByRank[1] ?? 1}
                  tripCashPrice={tripCashPrice}
                />
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
              </section>
            )}
          </div>
        </div>

        <Methodology />
      </div>

      {/* On phones the answer sits below the inputs, so offer a way to it
          whenever it's off screen. */}
      {verdict && !verdictOnScreen && (
        <button
          type="button"
          onClick={() => scrollToSection('recommendation')}
          className={`fixed bottom-5 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-slate-50 shadow-control lg:hidden ${TAP_TARGET} ${FOCUS_RING}`}
        >
          <span className="truncate">
            <span className="text-slate-50/60">Recommendation:</span> {verdictHeadline(verdict)}
          </span>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        </button>
      )}
    </>
  );
}
