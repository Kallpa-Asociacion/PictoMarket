import { useEffect, useState } from 'react';

// True once `delay` ms pass without `resetKey` changing. Purely visual: it
// never touches game state, the event log or the voice.
export function useIdleNudge(
  enabled: boolean,
  resetKey: string,
  delay = 15000,
) {
  const [idleKey, setIdleKey] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setIdleKey(resetKey), delay);
    return () => clearTimeout(timer);
  }, [enabled, resetKey, delay]);
  return enabled && idleKey === resetKey;
}
