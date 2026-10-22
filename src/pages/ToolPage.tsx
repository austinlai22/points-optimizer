import { useState } from 'react';
import { CardBalancesProvider, useCardBalances } from '../context/CardBalancesContext';
import { SegmentedControl } from '../components/SegmentedControl';
import { PortfolioView } from '../components/PortfolioView';
import { TripOptimizerView } from '../components/TripOptimizerView';
import { SiteFooter } from '../components/SiteFooter';
import { linkHandler } from '../lib/router';
import { FOCUS_RING } from '../styles/constants';
import type { ViewName } from '../types';

function ToolShell() {
  const { ownership } = useCardBalances();
  // Open on the trip check when there's a trip to show (a shared link) or
  // cards to check it against; a first-time visitor starts in Portfolio,
  // since the verdict needs their cards first.
  const [activeView, setActiveView] = useState<ViewName>(() => {
    const hasTrip = new URLSearchParams(window.location.search).has('price');
    return hasTrip || Object.values(ownership).some(Boolean) ? 'tripOptimizer' : 'portfolio';
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-28 sm:pb-16">
      <header className="px-4 pt-10 text-center sm:pt-12">
        <a
          href="/"
          onClick={linkHandler('/')}
          className={`rounded font-display text-2xl font-semibold tracking-tight text-navy-950 ${FOCUS_RING}`}
        >
          PointCompass
        </a>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-navy-950/50">
          Points or cash? Know before you book.
        </p>
      </header>
      <SegmentedControl value={activeView} onChange={setActiveView} />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-0">
        {activeView === 'portfolio' ? (
          <PortfolioView />
        ) : (
          <TripOptimizerView onOpenPortfolio={() => setActiveView('portfolio')} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export function ToolPage() {
  return (
    <CardBalancesProvider>
      <ToolShell />
    </CardBalancesProvider>
  );
}
