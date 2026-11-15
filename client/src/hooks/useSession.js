import { useEffect, useState } from 'react';
import { api, counts, refreshCounts } from '../lib/api.js';

/** Current signed-in user (from the stored session) and the unread/pending counters; updates when either changes. */
export function useSession() {
  const [user, setUser] = useState(api.meSync());
  useEffect(() => { const f = () => setUser(api.meSync()); window.addEventListener('rcmp:session', f); window.addEventListener('storage', f); return () => { window.removeEventListener('rcmp:session', f); window.removeEventListener('storage', f); }; }, []);
  return user;
}
export function useCounts() {
  const [c, setC] = useState(counts());
  useEffect(() => { const f = (e) => setC(e.detail || counts()); window.addEventListener('rcmp:counts', f); refreshCounts(); return () => window.removeEventListener('rcmp:counts', f); }, []);
  return c;
}
