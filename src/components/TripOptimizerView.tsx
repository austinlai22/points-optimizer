import { useEffect, useMemo, useRef, useState } from 'react';
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
  CASH_STORAGE_KEY,
  CHASE_STORAGE_KEY,
  EMPTY_CASH_INPUTS,
  EMPTY_CHASE_INPUTS,
  TRIP_STORAGE_KEY,
  sanitizeCashInputs,
  sanitizeChaseInputs,
} from '../utils/verdictInputs';
import { inferChaseCardType, verdictHeadline } from '../lib/verdict';
import { DEFAULT_TRIP_INPUTS, evaluateTrip, sameTripInputs, sanitizeTripInputs, setEditingTrip, type TripInputs } from '../lib/trips';
import { SaveTripControl } from './SaveTripControl';
import { DescribeTrip } from './DescribeTrip';
import { tripFromLocation, tripParams } from '../lib/tripLink';
import { AskPanel } from './AskPanel';
import { useAiEnabled } from '../lib/ai/useAiEnabled';
import { tripFromParsed, type Proposal, type ToolContext } from '../lib/ai/tools';
import type { ParsedTrip } from '../lib/ai/protocol';
import { addToCompare, MAX_COMPARE, MAX_SAVED_TRIPS, saveTrip, useCompareIds, useEditingTrip, useSavedTrips } from '../lib/trips';
import { track, trackOncePerVisit } from '../utils/analytics';
import { usePersistentState } from '../utils/usePersistentState';
import { formatUSD, parseNonNegativeNumber } from '../utils/format';
import { DEFAULT_VALUATION_BASIS } from '../types';
import type { CardConfig, Issuer, PartnerType, RedemptionPath, TransferPartner } from '../types';

const cards = cardsData as CardConfig[];
const transferPartners = transferPartnersData as TransferPartner[];

const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  hotel: 'Hotels',
  airline: 'Airlines',
};
const PARTNER_TYPE_ORDER: PartnerType[] = ['hotel', 'airline'];


// A shared link's query params take priority over anything saved locally
// from a previous session — opening someone else's link should show THEIR
// scenario, not silently keep your own leftover inputs. Only trip
// scenario fields go in the URL/localStorage here; portfolio balances are
// deliberately never included, so sharing a link never leaks your points.
function storedTripInputs(): TripInputs {
  try {
    const stored = localStorage.getItem(TRIP_STORAGE_KEY);
    return stored ? sanitizeTripInputs(JSON.parse(stored)) : DEFAULT_TRIP_INPUTS;
  } catch {
    return DEFAULT_TRIP_INPUTS;
  }
}

// Whether the trip came from a link that differs from this browser's own trip:
// someone else's scenario, so it isn't an edit of a trip saved here. Reloading
// your own page carries your own trip in the address bar, so that's not one.
function isOtherTripLink(inputs: TripInputs): boolean {
  return tripFromLocation(window.location) !== null && !sameTripInputs(inputs, storedTripInputs());
}

function loadInitialTripInputs(): TripInputs {
  return tripFromLocation(window.location) ?? storedTripInputs();
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
  // Worked out before the inputs are stored, on first render only.
  const [openedOtherLink] = useState(() => isOtherTripLink(initialTripInputs));
  useEffect(() => {
    if (openedOtherLink) setEditingTrip(null);
  }, [openedOtherLink]);
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
  // For a program Chase doesn't transfer to, the Chase Travel details fold
  // down to one line: Chase Travel can still book the trip, so it still
  // counts, but the details matter less. A tap opens them.
  const [chaseExpanded, setChaseExpanded] = useState(false);
  const chaseCollapsed = !chaseExpanded && selectedPartner !== null && selectedPartner.ratiosByIssuer.chase === undefined;
  const inferredChaseCardType = useMemo(() => inferChaseCardType(ownedCards), [ownedCards]);

  const tripInputs: TripInputs = useMemo(
    () => ({ tripCashPrice, selectedPartnerId, pointsRequired, partnerPointsHeld, awardCashFees, chaseTravelPoints }),
    [tripCashPrice, selectedPartnerId, pointsRequired, partnerPointsHeld, awardCashFees, chaseTravelPoints],
  );

  // The shared evaluation, fed the same inputs as the ranked paths below, so
  // the verdict and the list can't disagree, nor this page and a comparison.
  const verdict = useMemo(
    () => evaluateTrip(tripInputs, { ownedCards, balances, basis, cash: cashInputs, chase: chaseInputs }),
    [tripInputs, ownedCards, balances, basis, cashInputs, chaseInputs],
  );

  // Counted once a visit, the first time the trip changes after the page
  // opens: someone started entering a trip (a link that arrives with one
  // already filled in isn't a start).
  const firstInputs = useRef(tripInputs);
  useEffect(() => {
    if (tripInputs !== firstInputs.current) trackOncePerVisit('cco:tripStarted', { event: 'trip_started' });
  }, [tripInputs]);

  // Pilot counts: a verdict counts once it has stayed put for a moment, so
  // typing "1", "12", "120" into a field isn't three verdicts.
  const verdictKey = verdict ? verdict.verdict : null;
  const cashGiven = verdict?.cashConsidered ?? false;
  const pastedUsed = verdict?.chaseTravel?.pastedPricePoints != null;
  useEffect(() => {
    if (!verdictKey) return;
    const timer = setTimeout(() => {
      // Whether a cash position was given, so weeks before it became optional
      // (when every check had one) can still be compared like for like.
      track({ event: 'trip_check', verdict: verdictKey, cash: cashGiven });
      if (pastedUsed) track({ event: 'price_check' });
    }, 2000);
    return () => clearTimeout(timer);
  }, [verdictKey, cashGiven, pastedUsed]);

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
    setChaseExpanded(false);
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

    const params = tripParams({ tripCashPrice, selectedPartnerId, pointsRequired, partnerPointsHeld, awardCashFees, chaseTravelPoints });
    // Basis lives in shared context (Portfolio uses it too) but is
    // serialized here alongside the other trip inputs, so one copied link
    // reproduces the whole scenario. Omitted at the default, matching how
    // zero-valued params are left out.
    if (basis !== DEFAULT_VALUATION_BASIS) params.set('basis', basis);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, [tripCashPrice, selectedPartnerId, pointsRequired, partnerPointsHeld, awardCashFees, chaseTravelPoints, basis]);

  // Sets every trip field at once, from the plain-words reader or the
  // assistant, without handleBrandChange clearing the award just entered.
  const applyTrip = (trip: TripInputs) => {
    setTripCashPrice(trip.tripCashPrice);
    setSelectedPartnerId(trip.selectedPartnerId);
    setPointsRequired(trip.pointsRequired);
    setPartnerPointsHeld(trip.partnerPointsHeld);
    setAwardCashFees(trip.awardCashFees);
    setChaseTravelPoints(trip.chaseTravelPoints);
  };
  // Only programs one of the held cards reaches can be chosen in the form;
  // an award with any other is left out.
  const reachableOnly = (trip: TripInputs): TripInputs =>
    !trip.selectedPartnerId || availablePartners.some((x) => x.id === trip.selectedPartnerId)
      ? trip
      : { ...trip, selectedPartnerId: '', pointsRequired: 0, partnerPointsHeld: 0, awardCashFees: 0 };
  const fillFromWords = (parsed: ParsedTrip): TripInputs => {
    const trip = reachableOnly(tripFromParsed(parsed, tripInputs));
    applyTrip(trip);
    return trip;
  };

  const aiEnabled = useAiEnabled();
  const savedTrips = useSavedTrips();
  const compareIds = useCompareIds();
  const editingTrip = useEditingTrip();
  const [ask, setAsk] = useState<{ open: boolean; question: { text: string; id: number } | null }>({ open: false, question: null });
  const openAsk = (text?: string) => setAsk({ open: true, question: text ? { text, id: Date.now() } : null });
  const toolContext = (): ToolContext => ({
    trip: { ownedCards, balances, basis, cash: cashInputs, chase: chaseInputs },
    savedTrips,
    currentTrip: tripInputs,
    reachablePrograms: new Set(availablePartners.map((p) => p.id)),
  });
  // A change the assistant suggested, once the person taps Apply.
  const applyProposal = (p: Proposal): string | null => {
    if (p.kind === 'trip') {
      applyTrip(reachableOnly(p.trip));
      return null;
    }
    if (p.kind === 'save') {
      const editingBefore = editingTrip?.id ?? null;
      if (!saveTrip(p.name, p.trip, evaluateTrip(p.trip, toolContext().trip))) return `You have ${MAX_SAVED_TRIPS} saved trips, the most there can be. Delete one in My trips first.`;
      // Saving makes it the trip being edited only if it's the one in the form.
      if (!sameTripInputs(p.trip, tripInputs)) setEditingTrip(editingBefore);
      track({ event: 'trip_saved' });
      return null;
    }
    const known = new Set(savedTrips.map((t) => t.id));
    const ids = p.tripIds.filter((id) => known.has(id));
    if (ids.length === 0) return 'Those trips are no longer saved.';
    const room = MAX_COMPARE - compareIds.filter((id) => !ids.includes(id)).length;
    if (ids.length > room) return `The comparison holds ${MAX_COMPARE} trips. Remove some in My trips first.`;
    ids.forEach(addToCompare);
    if (compareIds.length < 2 && new Set([...compareIds, ...ids]).size >= 2) track({ event: 'trips_compared' });
    return null;
  };

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


  return (
    <>
      <PageIntro
        title="Check a trip"
        visual={<TripIntroVisual />}
        actions={
          (aiEnabled || tripCashPrice > 0 || selectedPartnerId) && (
            <>
              {aiEnabled && (
                <button
                  type="button"
                  onClick={() => openAsk()}
                  className={`inline-flex items-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-slate-50 transition-colors hover:bg-navy-950 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
                    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
                  </svg>
                  Ask PointCompass
                </button>
              )}
              {(tripCashPrice > 0 || selectedPartnerId) && (
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`rounded-full border border-navy/20 px-4 text-sm font-medium text-navy-950/70 transition-colors hover:border-navy/40 hover:text-navy-950 motion-reduce:transition-none ${TAP_TARGET} ${FOCUS_RING}`}
                >
                  {copyStatus === 'copied' ? 'Link copied' : 'Copy link to this trip'}
                </button>
              )}
            </>
          )
        }
      >
        <p>
          Find the best way to pay for your trip. Enter the price for a recommendation, and add an
          airline or hotel award price to compare transferring too. Your cash position is optional.
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
              <DescribeTrip reachablePrograms={new Set(availablePartners.map((p) => p.id))} onFill={fillFromWords} />
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
                        Only the difference is transferred. These points still count at what it
                        would cost to transfer them from your card.
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
                      {tripCashPrice > 0 && awardCashFees >= tripCashPrice && (
                        <p className="mt-1.5 text-xs font-medium text-amber" role="status">
                          These fees are at least the trip's cash price, so this award saves nothing over paying cash.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {ownsChase && (
              <section className={`${CARD_SURFACE} p-6`}>
                <StepHeading step={2} title="Chase Travel">
                  {chaseCollapsed && selectedPartner
                    ? `Chase doesn't transfer to ${selectedPartner.name}, but Chase Travel can still book this trip with your points.`
                    : 'Optional details that refine the Chase recommendation.'}
                </StepHeading>
                {chaseCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setChaseExpanded(true)}
                    aria-expanded={false}
                    className={`-ml-1 inline-flex items-center gap-1.5 rounded-full px-1 text-sm font-medium text-navy hover:underline ${TAP_TARGET} ${FOCUS_RING}`}
                  >
                    Add Chase Travel details <span className="font-normal text-navy-950/45">(optional)</span>
                    <ChevronDownIcon />
                  </button>
                ) : (
                  <ChaseTravelInputs
                    values={chaseInputs}
                    inferredCardType={inferredChaseCardType}
                    onChange={setChaseInputs}
                  />
                )}
              </section>
            )}

            <section className={`${CARD_SURFACE} p-6`}>
              <StepHeading step={ownsChase ? 3 : 2} title="Your cash position (optional)">
                Add it to check whether paying cash would leave you stretched. Without it, the
                recommendation is on value alone.
              </StepHeading>
              <CashCushionInputs values={cashInputs} onChange={setCashInputs} />
            </section>

            <section className={`${CARD_SURFACE} p-6`}>
              <ValuationBasisSelect />
            </section>
          </div>

          <div className="min-w-0">
            {tripCashPrice > 0 && (
              <SaveTripControl inputs={tripInputs} verdict={verdict} defaultName={selectedPartner ? `${selectedPartner.name}, ${formatUSD(tripCashPrice)}` : `Trip, ${formatUSD(tripCashPrice)}`} />
            )}
            {verdict ? (
              <div id="recommendation" ref={verdictRef} className="scroll-mt-20">
                <VerdictCard
                  result={verdict}
                  cashConsidered={verdict.cashConsidered}
                  onExplain={aiEnabled ? () => openAsk(`Explain why PointCompass recommends “${verdictHeadline(verdict)}” for this trip.`) : undefined}
                />
                {verdict.chaseTravel && (
                  <PriceCheck
                    key={selectedPartner?.id ?? 'none'}
                    program={selectedPartner}
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
                  Add the trip price to see it.
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

      {/* The assistant, always a tap away in the corner. On phones it sits
          above the "Recommendation" shortcut when that's showing. */}
      {aiEnabled && !ask.open && (
        <button
          type="button"
          onClick={() => openAsk()}
          aria-label="Open Ask PointCompass"
          title="Ask PointCompass"
          className={`fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-navy text-slate-50 shadow-control transition-colors hover:bg-navy-950 motion-reduce:transition-none ${verdict && !verdictOnScreen ? 'bottom-20 lg:bottom-5' : 'bottom-5'} ${FOCUS_RING}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
            <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
            <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
          </svg>
        </button>
      )}

      <AskPanel
        open={ask.open}
        onClose={() => setAsk((a) => ({ ...a, open: false }))}
        question={ask.question}
        toolContext={toolContext}
        onApply={applyProposal}
      />

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
