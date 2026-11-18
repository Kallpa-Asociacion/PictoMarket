import { useCallback, useState } from 'react';

export const INTRO_SEEN_KEY = 'pictomarket.intro.seen';

// localStorage can throw (private mode, blocked site data): never let that
// break the app.
function read(): boolean {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function useIntroSeen() {
  const [seen, setSeen] = useState(read);
  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      /* in-memory state below still covers the current session */
    }
    setSeen(true);
  }, []);
  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(INTRO_SEEN_KEY);
    } catch {
      /* ignore */
    }
    setSeen(false);
  }, []);
  return { seen, markSeen, clear };
}
