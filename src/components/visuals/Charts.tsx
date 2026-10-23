import { formatCents, formatMonths } from '../../lib/verdict';
import type { RunwayResult } from '../../lib/verdict/types';
import { formatPoints, formatUSD } from '../../utils/format';
import { useInView } from '../../utils/useInView';

type Tone = 'light' | 'dark';

const FILL = 'transition-[width] duration-1000 ease-out motion-reduce:transition-none';

const ink = (tone: Tone) => ({
  text: tone === 'dark' ? 'text-slate-50' : 'text-navy-950',
  muted: tone === 'dark' ? 'text-slate-50/55' : 'text-navy-950/55',
  track: tone === 'dark' ? 'bg-slate-50/10' : 'bg-navy/[0.07]',
  plain: tone === 'dark' ? 'bg-slate-50/45' : 'bg-navy/35',
  line: tone === 'dark' ? 'border-slate-50/60' : 'border-navy/50',
});

export interface ValueBarRow {
  label: string;
  // Cents per point; null when no points are spent at all.
  cents: number | null;
  highlight?: boolean;
  // This option's own usual value, when options come from different banks.
  benchmarkCents?: number;
}

// Horizontal bars of value per point, with the usual value marked as a line,
// so "beats its usual value" reads at a glance.
export function ValueBars({
  rows,
  benchmarkCents,
  tone = 'light',
}: {
  rows: ValueBarRow[];
  benchmarkCents: number;
  tone?: Tone;
}) {
  const c = ink(tone);
  // Bars start empty and fill over one second once scrolled to.
  const [ref, inView] = useInView<HTMLDivElement>();
  const benchmarks = rows.map((r) => r.benchmarkCents ?? benchmarkCents);
  const max = Math.max(...benchmarks.map((b) => b * 1.5), ...rows.map((r) => r.cents ?? 0)) * 1.08;
  const sameBenchmark = benchmarks.every((b) => Math.abs(b - benchmarks[0]) < 1e-9);
  const pct = (value: number) => `${Math.min((value / max) * 100, 100)}%`;
  return (
    <div ref={ref} className="space-y-3" role="img" aria-label={`Value per point for each option, compared with a usual value of ${formatCents(benchmarkCents)}`}>
      {rows.map((row, i) => (
        <div key={row.label}>
          <div className={`mb-1 flex justify-between text-xs ${c.muted}`}>
            <span className={row.highlight ? `font-medium ${c.text}` : ''}>{row.label}</span>
            <span className={`font-mono ${row.highlight ? c.text : ''}`}>
              {row.cents === null ? 'covered' : `${formatCents(row.cents)}`}
            </span>
          </div>
          <div className={`relative h-2.5 rounded-full ${c.track}`}>
            <div
              className={`h-full rounded-full ${FILL} ${row.highlight ? 'bg-teal' : c.plain}`}
              style={{ width: !inView ? '0%' : row.cents === null ? '100%' : pct(row.cents) }}
            />
            <div
              className={`absolute -top-1 -bottom-1 border-l-2 border-dashed ${c.line}`}
              style={{ left: pct(benchmarks[i]) }}
            />
          </div>
        </div>
      ))}
      <p className={`text-[11px] ${c.muted}`}>
        <span className={`mr-1.5 inline-block h-2.5 border-l-2 border-dashed align-middle ${c.line}`} />
        {sameBenchmark
          ? `Usual value, ${formatCents(benchmarks[0] ?? benchmarkCents)} per point`
          : "Usual value of each bank's points"}
      </p>
    </div>
  );
}

// Months of spending left after paying, as a segmented meter. The first
// month is marked: below it, cash counts as stretched.
export function RunwayMeter({
  payCash,
  usePoints,
  tone = 'light',
  maxMonths = 6,
}: {
  payCash: RunwayResult;
  usePoints?: RunwayResult | null;
  tone?: Tone;
  maxMonths?: number;
}) {
  const c = ink(tone);
  const [ref, inView] = useInView<HTMLDivElement>();
  const row = (label: string, runway: RunwayResult, highlight: boolean) => {
    const months = Math.max(runway.monthsOfBuffer, 0);
    const short = runway.bufferAfter < 0;
    return (
      <div>
        <div className={`mb-1 flex justify-between text-xs ${c.muted}`}>
          <span className={highlight ? `font-medium ${c.text}` : ''}>{label}</span>
          <span className={`font-mono ${short ? 'text-amber' : ''}`}>
            {short
              ? `${formatUSD(-runway.bufferAfter)} short`
              : months >= maxMonths
                ? `${maxMonths}+ months`
                : formatMonths(months)}
          </span>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${maxMonths}, minmax(0, 1fr))` }}>
          {Array.from({ length: maxMonths }, (_, i) => {
            const fill = Math.min(Math.max(months - i, 0), 1);
            return (
              <div key={i} className={`h-2.5 overflow-hidden rounded-full ${c.track}`}>
                <div
                  className={`h-full ${FILL} ${runway.strained ? 'bg-amber' : highlight ? 'bg-teal' : c.plain}`}
                  style={{ width: `${inView ? fill * 100 : 0}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div ref={ref} className="space-y-3" role="img" aria-label="Months of usual spending left after paying, with cash compared to points">
      {row('Pay cash', payCash, false)}
      {usePoints && row('Use points', usePoints, true)}
      <p className={`text-[11px] ${c.muted}`}>Each segment is one month of your usual spending.</p>
    </div>
  );
}

// A points axis showing where the Chase Travel breakeven falls against the
// standard price, and against a price the user entered.
export function BreakevenScale({
  breakevenPoints,
  standardPoints,
  pastedPoints,
  tone = 'light',
}: {
  breakevenPoints: number;
  standardPoints: number;
  pastedPoints?: number | null;
  tone?: Tone;
}) {
  const c = ink(tone);
  const [ref, inView] = useInView<HTMLDivElement>();
  const max = Math.max(breakevenPoints, standardPoints, pastedPoints ?? 0) * 1.15 || 1;
  const pct = (value: number) => `${(value / max) * 100}%`;
  // A tick on the track with its label above or below. Labels near either
  // end are anchored to that end so they never spill out of the chart.
  const marker = (value: number, label: string, tickClass: string, side: 'above' | 'below') => {
    const position = (value / max) * 100;
    const anchor = position > 70 ? 'right-0' : position < 30 ? 'left-0' : 'left-1/2 -translate-x-1/2';
    return (
      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pct(value) }}>
        <div className={`h-5 w-1 rounded-full ${tickClass}`} />
        <div
          className={`absolute whitespace-nowrap text-[11px] ${anchor} ${c.muted} ${
            side === 'above' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          <span className={`font-mono ${c.text}`}>{formatPoints(value)}</span> {label}
        </div>
      </div>
    );
  };
  return (
    <div ref={ref} role="img" aria-label={`Chase Travel breakeven of ${formatPoints(breakevenPoints)} points, against a standard price of ${formatPoints(standardPoints)} points`} className="relative mx-2 h-24">
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2">
        <div className={`h-2 rounded-full ${c.track}`}>
          <div className={`h-full rounded-full bg-teal/70 ${FILL}`} style={{ width: inView ? pct(breakevenPoints) : '0%' }} />
        </div>
      </div>
      {marker(breakevenPoints, 'breakeven', 'bg-teal', 'above')}
      {marker(standardPoints, 'standard price', tone === 'dark' ? 'bg-slate-50' : 'bg-navy', 'below')}
      {pastedPoints ? marker(pastedPoints, 'your price', 'bg-amber', 'above') : null}
    </div>
  );
}
