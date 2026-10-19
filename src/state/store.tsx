import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { dayKeyOf, uid } from '../lib/time';
import { reducer, rollover, type Action, type StoreState } from './reducer';
import { loadState, saveState } from './storage';

interface StoreValue {
  state: StoreState;
  dispatch: (action: Action) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function init(): StoreState {
  return rollover({ ...loadState(), toast: null }, dayKeyOf());
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, init);

  const dispatch = useCallback(
    (action: Action) => rawDispatch({ ...action, meta: { now: Date.now(), id: uid() } }),
    [],
  );

  // Persist everything except the ephemeral toast.
  useEffect(() => {
    const { toast: _toast, ...persisted } = state;
    saveState(persisted);
  }, [state]);

  // Daily rollover: check every minute and whenever the app comes back to the foreground.
  useEffect(() => {
    const check = () => dispatch({ type: 'system/rollover', dayKey: dayKeyOf() });
    const id = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!state.toast) return;
    const toastId = state.toast.id;
    const id = setTimeout(() => dispatch({ type: 'toast/dismiss', toastId }), 2600);
    return () => clearTimeout(id);
  }, [state.toast, dispatch]);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
