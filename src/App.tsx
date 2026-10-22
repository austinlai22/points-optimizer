import { useEffect } from 'react';
import { navigate, usePath } from './lib/router';
import { Landing } from './pages/Landing';
import { Privacy } from './pages/Privacy';
import { ToolPage } from './pages/ToolPage';

const TITLES: Record<string, string> = {
  '/': 'PointCompass — Points or cash? Know before you book.',
  '/app': 'Check a trip — PointCompass',
  '/privacy': 'Privacy — PointCompass',
};

function App() {
  const path = usePath();
  const known = path in TITLES;

  useEffect(() => {
    // An unknown path goes home rather than showing a blank page.
    if (!known) navigate('/', { replace: true });
    else document.title = TITLES[path];
  }, [path, known]);

  if (path === '/app') return <ToolPage />;
  if (path === '/privacy') return <Privacy />;
  return <Landing />;
}

export default App;
