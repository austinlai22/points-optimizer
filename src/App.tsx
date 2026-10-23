import { useEffect } from 'react';
import { CardBalancesProvider } from './context/CardBalancesContext';
import { PageShell } from './components/PageShell';
import type { PageName } from './components/SiteHeader';
import { PortfolioView } from './components/PortfolioView';
import { TripOptimizerView } from './components/TripOptimizerView';
import { navigate, scrollToSection, usePath } from './lib/router';
import { Landing } from './pages/Landing';
import { Privacy } from './pages/Privacy';
import { Agents } from './pages/Agents';

const PAGES: Record<string, { name: PageName; title: string }> = {
  '/': { name: 'home', title: 'PointCompass: points or cash? Know before you book.' },
  '/app': { name: 'check', title: 'Check a trip · PointCompass' },
  '/portfolio': { name: 'portfolio', title: 'Portfolio · PointCompass' },
  '/privacy': { name: 'privacy', title: 'Privacy · PointCompass' },
  '/agents': { name: 'agents', title: 'For AI assistants · PointCompass' },
};

function App() {
  const path = usePath();
  const page = PAGES[path];

  useEffect(() => {
    // An unknown path goes home rather than showing a blank page.
    if (!page) navigate('/', { replace: true });
    else document.title = page.title;
  }, [page]);

  // A link straight to a section (e.g. /#faq) arrives before the section has
  // rendered, so the browser can't jump to it on its own.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) scrollToSection(id, { smooth: false });
  }, []);

  return (
    // One provider for every page, so cards and balances follow you between
    // Portfolio and Check a trip.
    <CardBalancesProvider>
      <PageShell current={page?.name ?? 'home'}>
        {path === '/app' ? (
          <TripOptimizerView />
        ) : path === '/portfolio' ? (
          <PortfolioView />
        ) : path === '/privacy' ? (
          <Privacy />
        ) : path === '/agents' ? (
          <Agents />
        ) : (
          <Landing />
        )}
      </PageShell>
    </CardBalancesProvider>
  );
}

export default App;
