import { useState } from 'react';
import { CardBalancesProvider } from './context/CardBalancesContext';
import { SegmentedControl } from './components/SegmentedControl';
import { PortfolioView } from './components/PortfolioView';
import { TripOptimizerView } from './components/TripOptimizerView';
import type { ViewName } from './types';

function App() {
  const [activeView, setActiveView] = useState<ViewName>('portfolio');

  return (
    <CardBalancesProvider>
      <div className="min-h-screen bg-slate-50 pb-28 sm:pb-16">
        <header className="px-4 pt-10 text-center sm:pt-12">
          <p className="font-display text-2xl font-semibold tracking-tight text-navy-950">
            Points Optimizer
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-navy-950/50">
            Know what your points are really worth — and exactly how to use them.
          </p>
        </header>
        <SegmentedControl value={activeView} onChange={setActiveView} />
        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-0">
          {activeView === 'portfolio' ? <PortfolioView /> : <TripOptimizerView />}
        </main>
        <footer className="mx-auto max-w-5xl px-4 pb-6 pt-4 sm:pb-2">
          <p className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-navy-950/40">
            Points Optimizer is an independent estimation tool and is not affiliated with,
            endorsed by, or sponsored by Chase, Capital One, American Express, Citi, or any
            airline or hotel program named here. Figures are illustrative estimates based on this
            app's own assumptions (see
            Methodology below) — not financial advice. Verify current terms directly with each
            issuer before making redemption decisions. All data stays in your browser; nothing is
            sent to a server.
          </p>
        </footer>
      </div>
    </CardBalancesProvider>
  );
}

export default App;
