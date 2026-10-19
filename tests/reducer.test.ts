import { it, expect, describe } from 'vitest';
import { reducer, rollover, type StoreState, type Action } from '../src/state/reducer';
import { createInitialState } from '../src/state/initialState';
import { dayKeyOf } from '../src/lib/time';
const now = new Date(2026, 9, 19, 10).getTime();
const initial = (): StoreState => ({ ...createInitialState(new Date(now)), toast: null });
const dispatch = (state: StoreState, action: Action, at = now) => reducer(state, { ...action, meta: { now: at, id: crypto.randomUUID() } });
describe('domain invariants', () => {
  it('does not farm prayer rewards by toggling a prayer', () => {
    let state = initial(); state = dispatch(state, { type: 'prayer/log', id: 'fajr', status: 'on_time' }); const balance = state.balance;
    state = dispatch(state, { type: 'prayer/log', id: 'fajr', status: 'none' }); state = dispatch(state, { type: 'prayer/log', id: 'fajr', status: 'on_time' }); expect(state.balance).toBe(balance);
  });
  it('finishes a Pomodoro once and retains its study log', () => {
    let state = dispatch(initial(), { type: 'pomo/start', minutes: 2, subject: 'Networks' });
    state = dispatch(state, { type: 'pomo/complete' }, now + 120000); const balance = state.balance;
    state = dispatch(state, { type: 'pomo/complete' }, now + 120000); expect(state.studyLog).toHaveLength(1); expect(state.balance).toBe(balance);
  });
  it('daily rollover clears daily counters and preserves durable work', () => {
    let state = initial(); state = dispatch(state, { type: 'brain/add', text: 'Remember tomorrow' });
    state = dispatch(state, { type: 'prayer/log', id: 'fajr', status: 'on_time' }); const tomorrow = new Date(2026, 9, 20, 0, 1);
    const next = rollover(state, dayKeyOf(tomorrow)); expect(next.prayers.fajr.status).toBe('none'); expect(next.brainDump[0].text).toBe('Remember tomorrow'); expect(next.history).toHaveLength(1);
    expect(rollover(next, dayKeyOf(tomorrow))).toBe(next);
  });
});
