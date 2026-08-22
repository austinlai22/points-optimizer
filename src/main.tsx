import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Latin-only subsets — this app only ever renders English/Latin text, and
// the default imports otherwise bundle every Unicode subset (Cyrillic,
// Greek, Vietnamese, ...), tripling the font payload for no visual benefit.
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
