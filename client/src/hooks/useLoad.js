import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fail } from '../components/toast.jsx';

/** Run an async loader on mount / when deps change. Returns {data, error, loading, reload, setData}. */
export function useLoad(loader, deps = [], opts = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(0);
  const run = useCallback(async () => {
    const id = ++alive.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try { const data = await loader(); if (id === alive.current) setState({ data, error: null, loading: false }); }
    catch (err) { if (id === alive.current) { setState({ data: null, error: err, loading: false }); if (!opts.silent) fail(err); } }
  }, deps);
  useEffect(() => { run(); return () => { alive.current++; }; }, [run]);
  return { ...state, reload: run, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

/** Wrap an async action so a button can show a busy state and double clicks are ignored. */
export function useAction() {
  const [busy, setBusy] = useState(false), lock = useRef(false);
  const run = useCallback(async (task) => {
    if (lock.current) return undefined; lock.current = true; setBusy(true);
    try { return await task(); } finally { lock.current = false; setBusy(false); }
  }, []);
  return [busy, run];
}

export function useQuery() {
  const { search } = useLocation();
  return useMemo(() => Object.fromEntries(new URLSearchParams(search)), [search]);
}
