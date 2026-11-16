import { useEffect, useState } from 'react';
import { serverAiEnabled } from './client';

// Whether the server's assistant is set up, so features needing it can hide.
export function useAiEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    serverAiEnabled().then((on) => live && setEnabled(on));
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}
