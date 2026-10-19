import type {
  AdhkarSessionId,
  Alarm,
  AppState,
  ExpenseCategory,
  NotificationSettings,
  PomoPhase,
  PomodoroSettings,
  PrayerId,
  PrayerLog,
  RewardSource,
} from '../types';
import { collectionFor } from '../data/adhkar';
import { PRAYER_NAMES, PRAYER_ORDER, daysUntil, dayKeyOf } from '../lib/time';
import { blankPrayers, createInitialState, idlePomodoro } from './initialState';
import { recordFor } from './selectors';
import { REWARDS } from './rewards';

export interface Toast {
  id: string;
  text: string;
  delta?: number;
}

export type StoreState = AppState & { toast: Toast | null };

export type Action =
  | { type: 'prayer/log'; id: PrayerId; status: PrayerLog }
  | { type: 'prayer/toggleSunnah'; id: PrayerId }
  | { type: 'prayer/setTimes'; times: Record<PrayerId, string> }
  | { type: 'routine/add'; title: string; anchor: PrayerId; starter: string }
  | { type: 'routine/toggle'; taskId: string }
  | { type: 'routine/toggleStep'; taskId: string; stepId: string }
  | { type: 'routine/delete'; taskId: string }
  | { type: 'brain/add'; text: string }
  | { type: 'brain/remove'; id: string }
  | { type: 'brain/toTask'; id: string; anchor: PrayerId }
  | { type: 'uni/add'; course: string; title: string; dueDate: string; firstStep: string }
  | { type: 'uni/toggleStep'; id: string; stepId: string }
  | { type: 'uni/addStep'; id: string; title: string }
  | { type: 'uni/delete'; id: string }
  | { type: 'shield/unlock'; appId: string }
  | { type: 'shield/lock'; appId: string }
  | { type: 'shield/resist'; appId: string }
  | { type: 'shield/toggleStrict' }
  | { type: 'pomo/start'; minutes?: number; phase?: PomoPhase; subject?: string; task?: string }
  | { type: 'pomo/pause' }
  | { type: 'pomo/resume' }
  | { type: 'pomo/complete' }
  | { type: 'pomo/skip' }
  | { type: 'pomo/stop' }
  | { type: 'pomo/set'; subject?: string; task?: string }
  | { type: 'pomo/settings'; patch: Partial<PomodoroSettings> }
  | { type: 'focus/goal'; minutes: number }
  | { type: 'alarm/add'; time: string; label: string; mission: Alarm['mission'] }
  | { type: 'alarm/update'; id: string; patch: Partial<Omit<Alarm, 'id'>> }
  | { type: 'alarm/delete'; id: string }
  | { type: 'alarm/ring'; id: string; test?: boolean }
  | { type: 'alarm/dismiss'; solved: boolean }
  | { type: 'notify/settings'; patch: Partial<NotificationSettings> }
  | { type: 'notify/mark'; key: string }
  | { type: 'toast/show'; text: string }
  | { type: 'system/onboarded' }
  | { type: 'system/reset' }
  | { type: 'system/restore'; state: AppState }
  | { type: 'adhkar/tap'; session: AdhkarSessionId; itemId: string }
  | { type: 'adhkar/reset'; session: AdhkarSessionId }
  | { type: 'qiyam/set'; rakaat?: number; witr?: boolean }
  | { type: 'quran/addPages'; pages: number }
  | { type: 'quran/setGoal'; pages: number }
  | { type: 'tasbih/tap' }
  | { type: 'tasbih/set'; phraseId?: string; target?: number }
  | { type: 'tasbih/reset' }
  | { type: 'habit/toggle'; id: string; title: string }
  | { type: 'wallet/addExpense'; title: string; amount: number; category: ExpenseCategory }
  | { type: 'wallet/deleteExpense'; id: string }
  | { type: 'wallet/setBudget'; daily: number; currency: string }
  | { type: 'wallet/addImpulse'; title: string; price: number; trigger: string; waitHours: number }
  | { type: 'wallet/skipImpulse'; id: string }
  | { type: 'wallet/buyImpulse'; id: string }
  | { type: 'wallet/deleteImpulse'; id: string }
  | { type: 'system/rollover'; dayKey: string }
  | { type: 'toast/dismiss'; toastId: string };

/** Every dispatched action is stamped so the reducer stays pure under StrictMode. */
export type StampedAction = Action & { meta: { now: number; id: string } };

type Meta = StampedAction['meta'];

function toast(state: StoreState, text: string, meta: Meta, delta?: number): StoreState {
  return { ...state, toast: { id: meta.id, text, delta } };
}

/** Pay out a reward once per key per day. */
function earn(
  state: StoreState,
  key: string,
  label: string,
  delta: number,
  source: RewardSource,
  meta: Meta,
): StoreState {
  if (state.earned[key]) return state;
  return toast(
    {
      ...state,
      balance: state.balance + delta,
      earned: { ...state.earned, [key]: true },
      transactions: [
        { id: meta.id, label, delta, source, at: meta.now },
        ...state.transactions,
      ].slice(0, 60),
    },
    label,
    meta,
    delta,
  );
}

function spend(state: StoreState, label: string, cost: number, meta: Meta): StoreState {
  return toast(
    {
      ...state,
      balance: Math.max(0, state.balance - cost),
      transactions: [
        { id: meta.id, label, delta: -cost, source: 'shield' as const, at: meta.now },
        ...state.transactions,
      ].slice(0, 60),
    },
    label,
    meta,
    -cost,
  );
}

/** Unlocking is blocked while the current prayer window is unlogged and strict mode is on. */
export function prayerLockReason(state: AppState, current: PrayerId | null): string | null {
  if (!state.strictPrayerLock || !current) return null;
  if (state.prayers[current].status !== 'none') return null;
  return `Pray ${PRAYER_NAMES[current].en} first`;
}

function mapItem<T extends { id: string }>(list: T[], id: string, fn: (item: T) => T): T[] {
  return list.map((item) => (item.id === id ? fn(item) : item));
}

export function rollover(state: StoreState, dayKey: string): StoreState {
  if (state.dayKey === dayKey) return state;
  const consecutive = daysUntil(dayKey, parseKey(state.dayKey)) === 1;
  const allPrayed = PRAYER_ORDER.every((p) => state.prayers[p].status !== 'none');
  const quranMet = state.quran.pagesToday >= state.quran.goalPages;
  const cutoff = parseKey(dayKey);
  return {
    ...state,
    dayKey,
    earned: {},
    notified: {},
    ringingAlarm: null,
    history: [recordFor(state), ...state.history.filter((h) => h.dayKey !== state.dayKey)].slice(0, 90),
    studyLog: state.studyLog.filter((s) => daysUntil(s.dayKey, cutoff) > -91),
    pomodoro: state.pomodoro.status === 'running' ? state.pomodoro : { ...state.pomodoro, cycle: 0 },
    prayers: blankPrayers(),
    prayerStreak: consecutive && allPrayed ? state.prayerStreak + 1 : 0,
    routines: state.routines.map((r) => ({
      ...r,
      done: false,
      steps: r.steps.map((s) => ({ ...s, done: false })),
    })),
    apps: state.apps.map((a) => ({ ...a, unlockedUntil: null, blockedToday: 0 })),
    adhkar: {},
    qiyam: { rakaat: 0, witr: false },
    quran: {
      ...state.quran,
      pagesToday: 0,
      streak: consecutive && quranMet ? state.quran.streak + 1 : 0,
    },
    tasbih: { ...state.tasbih, count: 0, totalToday: 0 },
    habits: {},
    // Keep a rolling month of expenses for history; the UI shows today's only.
    expenses: state.expenses.filter((e) => daysUntil(e.dayKey, parseKey(dayKey)) > -31),
    toast: null,
  };
}

function phaseMinutes(s: PomodoroSettings, phase: PomoPhase): number {
  return phase === 'focus' ? s.focus : phase === 'short' ? s.short : s.long;
}

function nextPhase(state: StoreState, p: StoreState['pomodoro'], phase: PomoPhase, meta: Meta): StoreState['pomodoro'] {
  const ms = phaseMinutes(state.pomodoroSettings, phase) * 60_000;
  const auto = state.pomodoroSettings.autoStart;
  return {
    ...p,
    phase,
    status: auto ? 'running' : 'ready',
    phaseMs: ms,
    remainingMs: ms,
    endsAt: auto ? meta.now + ms : null,
  };
}

function logStudy(state: StoreState, minutes: number, meta: Meta): StoreState {
  const { subject, task } = state.pomodoro;
  const next: StoreState = {
    ...state,
    studyLog: [
      { id: meta.id, at: meta.now, dayKey: state.dayKey, minutes, subject, task },
      ...state.studyLog,
    ],
  };
  return earn(next, `pomo:${meta.id}`, `Focused ${minutes} min${subject ? ` · ${subject}` : ''}`, minutes * REWARDS.focusPerMinute, 'focus', meta);
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function reducer(state: StoreState, action: StampedAction): StoreState {
  const { meta } = action;
  switch (action.type) {
    // ---------- Prayer ----------
    case 'prayer/log': {
      const next = {
        ...state,
        prayers: { ...state.prayers, [action.id]: { ...state.prayers[action.id], status: action.status } },
      };
      if (action.status === 'none') return next;
      const name = PRAYER_NAMES[action.id].en;
      const onTime = action.status === 'on_time';
      return earn(
        next,
        `prayer:${action.id}`,
        `${name} prayed${onTime ? ' on time' : ''}`,
        onTime ? REWARDS.prayerOnTime : REWARDS.prayerLate,
        'prayer',
        meta,
      );
    }
    case 'prayer/toggleSunnah': {
      const sunnah = !state.prayers[action.id].sunnah;
      const next = {
        ...state,
        prayers: { ...state.prayers, [action.id]: { ...state.prayers[action.id], sunnah } },
      };
      if (!sunnah) return next;
      return earn(next, `sunnah:${action.id}`, `${PRAYER_NAMES[action.id].en} sunnah`, REWARDS.sunnah, 'prayer', meta);
    }
    case 'prayer/setTimes':
      return toast({ ...state, prayerTimes: action.times }, 'Prayer times saved', meta);

    // ---------- Routines ----------
    case 'routine/add': {
      const id = `r-${meta.id}`;
      const stepTitles = action.starter ? [action.starter, `Finish: ${action.title}`] : [action.title];
      const steps = stepTitles.map((title, i) => ({ id: `${id}-${i}`, title, done: false }));
      return toast(
        {
          ...state,
          routines: [
            ...state.routines,
            { id, title: action.title, anchor: action.anchor, minutes: 10, starter: action.starter, steps, done: false },
          ],
        },
        `Added after ${PRAYER_NAMES[action.anchor].en}`,
        meta,
      );
    }
    case 'routine/toggle': {
      const task = state.routines.find((r) => r.id === action.taskId);
      if (!task) return state;
      const done = !task.done;
      const next = {
        ...state,
        routines: mapItem(state.routines, task.id, (r) => ({
          ...r,
          done,
          steps: r.steps.map((s) => ({ ...s, done })),
        })),
      };
      return done ? earn(next, `routine:${task.id}`, task.title, REWARDS.routineDone, 'routine', meta) : next;
    }
    case 'routine/toggleStep': {
      const task = state.routines.find((r) => r.id === action.taskId);
      const step = task?.steps.find((s) => s.id === action.stepId);
      if (!task || !step) return state;
      const steps = task.steps.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s));
      const done = steps.every((s) => s.done);
      let next: StoreState = {
        ...state,
        routines: mapItem(state.routines, task.id, (r) => ({ ...r, steps, done })),
      };
      if (!step.done) next = earn(next, `step:${step.id}`, step.title, REWARDS.routineStep, 'routine', meta);
      if (done && !task.done) next = earn(next, `routine:${task.id}`, task.title, REWARDS.routineDone, 'routine', meta);
      return next;
    }
    case 'routine/delete':
      return { ...state, routines: state.routines.filter((r) => r.id !== action.taskId) };

    // ---------- Brain dump ----------
    case 'brain/add':
      return toast(
        { ...state, brainDump: [{ id: meta.id, text: action.text, at: meta.now }, ...state.brainDump] },
        'Parked. Your head is clearer now.',
        meta,
      );
    case 'brain/remove':
      return { ...state, brainDump: state.brainDump.filter((b) => b.id !== action.id) };
    case 'brain/toTask': {
      const item = state.brainDump.find((b) => b.id === action.id);
      if (!item) return state;
      const removed = { ...state, brainDump: state.brainDump.filter((b) => b.id !== action.id) };
      return reducer(removed, { type: 'routine/add', title: item.text, anchor: action.anchor, starter: '', meta });
    }

    // ---------- University ----------
    case 'uni/add': {
      const id = `a-${meta.id}`;
      return toast(
        {
          ...state,
          assignments: [
            ...state.assignments,
            {
              id,
              course: action.course,
              title: action.title,
              dueDate: action.dueDate,
              steps: action.firstStep ? [{ id: `${id}-0`, title: action.firstStep, done: false }] : [],
            },
          ],
        },
        'Deadline added',
        meta,
      );
    }
    case 'uni/toggleStep': {
      const a = state.assignments.find((x) => x.id === action.id);
      const step = a?.steps.find((s) => s.id === action.stepId);
      if (!a || !step) return state;
      const next = {
        ...state,
        assignments: mapItem(state.assignments, a.id, (x) => ({
          ...x,
          steps: x.steps.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s)),
        })),
      };
      return step.done ? next : earn(next, `uni:${step.id}`, `${a.course}: ${step.title}`, REWARDS.uniStep, 'uni', meta);
    }
    case 'uni/addStep':
      return {
        ...state,
        assignments: mapItem(state.assignments, action.id, (a) => ({
          ...a,
          steps: [...a.steps, { id: `${a.id}-${meta.id}`, title: action.title, done: false }],
        })),
      };
    case 'uni/delete':
      return { ...state, assignments: state.assignments.filter((a) => a.id !== action.id) };

    // ---------- Shield ----------
    case 'shield/unlock': {
      const app = state.apps.find((a) => a.id === action.appId);
      if (!app || state.balance < app.cost) return state;
      return spend(
        { ...state, apps: mapItem(state.apps, app.id, (a) => ({ ...a, unlockedUntil: meta.now + 15 * 60_000 })) },
        `${app.name} unlocked for 15 min`,
        app.cost,
        meta,
      );
    }
    case 'shield/lock': {
      const app = state.apps.find((a) => a.id === action.appId);
      if (!app) return state;
      const next = { ...state, apps: mapItem(state.apps, app.id, (a) => ({ ...a, unlockedUntil: null })) };
      return earn(next, `relock:${app.id}`, `Locked ${app.name} early`, REWARDS.relockEarly, 'shield', meta);
    }
    case 'shield/resist': {
      const app = state.apps.find((a) => a.id === action.appId);
      if (!app) return state;
      const next = {
        ...state,
        apps: mapItem(state.apps, app.id, (a) => ({ ...a, blockedToday: a.blockedToday + 1 })),
      };
      // Rewards cap at five resists per app per day; after that it's just praise.
      return app.blockedToday < 5
        ? earn(next, `resist:${app.id}:${app.blockedToday}`, `Resisted ${app.name}`, REWARDS.resistApp, 'shield', meta)
        : toast(next, `Resisted ${app.name}. Nice.`, meta);
    }
    case 'shield/toggleStrict':
      return { ...state, strictPrayerLock: !state.strictPrayerLock };

    // ---------- Pomodoro ----------
    case 'pomo/start': {
      const p = state.pomodoro;
      const phase = action.phase ?? (p.status === 'ready' ? p.phase : 'focus');
      const ms = (action.minutes ?? phaseMinutes(state.pomodoroSettings, phase)) * 60_000;
      return {
        ...state,
        pomodoro: {
          ...p,
          phase,
          status: 'running',
          phaseMs: ms,
          remainingMs: ms,
          endsAt: meta.now + ms,
          subject: action.subject ?? p.subject,
          task: action.task ?? p.task,
        },
      };
    }
    case 'pomo/pause': {
      const p = state.pomodoro;
      if (p.status !== 'running' || !p.endsAt) return state;
      return { ...state, pomodoro: { ...p, status: 'paused', remainingMs: Math.max(0, p.endsAt - meta.now), endsAt: null } };
    }
    case 'pomo/resume': {
      const p = state.pomodoro;
      if (p.status !== 'paused') return state;
      return { ...state, pomodoro: { ...p, status: 'running', endsAt: meta.now + p.remainingMs } };
    }
    case 'pomo/complete': {
      const p = state.pomodoro;
      if (p.status !== 'running' || p.endsAt === null || meta.now < p.endsAt) return state;
      let next: StoreState = state;
      let cycle = p.cycle;
      let phase: PomoPhase = 'focus';
      if (p.phase === 'focus') {
        const minutes = Math.max(1, Math.round(p.phaseMs / 60_000));
        cycle += 1;
        phase = cycle % state.pomodoroSettings.cyclesBeforeLong === 0 ? 'long' : 'short';
        next = logStudy(state, minutes, meta);
      }
      return { ...next, pomodoro: nextPhase(next, { ...p, cycle }, phase, meta) };
    }
    case 'pomo/skip': {
      const p = state.pomodoro;
      const phase: PomoPhase = p.phase === 'focus' ? 'short' : 'focus';
      const ms = phaseMinutes(state.pomodoroSettings, phase) * 60_000;
      return { ...state, pomodoro: { ...p, phase, status: 'ready', endsAt: null, phaseMs: ms, remainingMs: ms } };
    }
    case 'pomo/stop': {
      const p = state.pomodoro;
      const remaining = p.status === 'running' && p.endsAt ? Math.max(0, p.endsAt - meta.now) : p.remainingMs;
      const elapsedMin = Math.floor((p.phaseMs - remaining) / 60_000);
      // Partial focus still counts — stopping early shouldn't erase real work.
      const next = p.phase === 'focus' && p.status !== 'idle' && p.status !== 'ready' && elapsedMin >= 1
        ? logStudy(state, elapsedMin, meta)
        : state;
      return { ...next, pomodoro: idlePomodoro(p.subject, p.task) };
    }
    case 'pomo/set':
      return {
        ...state,
        pomodoro: { ...state.pomodoro, subject: action.subject ?? state.pomodoro.subject, task: action.task ?? state.pomodoro.task },
      };
    case 'pomo/settings':
      return { ...state, pomodoroSettings: { ...state.pomodoroSettings, ...action.patch } };
    case 'focus/goal':
      return { ...state, focusGoalMins: action.minutes };

    // ---------- Alarms ----------
    case 'alarm/add':
      return toast(
        {
          ...state,
          alarms: [...state.alarms, { id: `al-${meta.id}`, time: action.time, label: action.label, mission: action.mission, enabled: true }].sort(
            (a, b) => a.time.localeCompare(b.time),
          ),
        },
        'Alarm set',
        meta,
      );
    case 'alarm/update':
      return {
        ...state,
        alarms: mapItem(state.alarms, action.id, (a) => ({ ...a, ...action.patch })).sort((a, b) => a.time.localeCompare(b.time)),
      };
    case 'alarm/delete':
      return { ...state, alarms: state.alarms.filter((a) => a.id !== action.id) };
    case 'alarm/ring':
      return action.test
        ? { ...state, ringingAlarm: action.id }
        : { ...state, ringingAlarm: action.id, notified: { ...state.notified, [`alarm:${action.id}`]: true } };
    case 'alarm/dismiss': {
      const alarm = state.alarms.find((a) => a.id === state.ringingAlarm);
      const next = { ...state, ringingAlarm: null };
      if (!alarm || !action.solved) return next;
      return earn(next, `alarm:${alarm.id}`, `Up and awake · ${alarm.label}`, REWARDS.alarm, 'focus', meta);
    }

    // ---------- Notifications & system ----------
    case 'notify/settings':
      return { ...state, notifications: { ...state.notifications, ...action.patch } };
    case 'notify/mark':
      return { ...state, notified: { ...state.notified, [action.key]: true } };
    case 'toast/show':
      return toast(state, action.text, meta);
    case 'system/onboarded':
      return { ...state, onboarded: true };
    case 'system/restore':
      return rollover({ ...action.state, toast: null }, dayKeyOf(new Date(meta.now)));
    case 'system/reset':
      return { ...createInitialState(new Date(meta.now)), onboarded: true, toast: { id: meta.id, text: 'Fresh start' } };

    // ---------- Deen ----------
    case 'adhkar/tap': {
      const collection = collectionFor(action.session);
      const item = collection.items.find((i) => i.id === action.itemId);
      if (!item) return state;
      const progress = { ...(state.adhkar[action.session] ?? {}) };
      if ((progress[item.id] ?? 0) >= item.count) return state;
      progress[item.id] = (progress[item.id] ?? 0) + 1;
      const next = { ...state, adhkar: { ...state.adhkar, [action.session]: progress } };
      const complete = collection.items.every((i) => (progress[i.id] ?? 0) >= i.count);
      if (!complete) return next;
      const isAfter = action.session.startsWith('after:');
      const label = isAfter
        ? `Adhkar after ${PRAYER_NAMES[action.session.slice(6) as PrayerId].en}`
        : collection.title;
      return earn(
        next,
        `adhkar:${action.session}`,
        `${label} complete`,
        isAfter ? REWARDS.afterPrayerAdhkar : REWARDS.adhkarSession,
        'deen',
        meta,
      );
    }
    case 'adhkar/reset':
      return { ...state, adhkar: { ...state.adhkar, [action.session]: {} } };
    case 'qiyam/set': {
      const qiyam = {
        rakaat: Math.max(0, Math.min(20, action.rakaat ?? state.qiyam.rakaat)),
        witr: action.witr ?? state.qiyam.witr,
      };
      const next = { ...state, qiyam };
      return qiyam.rakaat > 0 ? earn(next, 'qiyam', 'Qiyam al-Layl', REWARDS.qiyam, 'deen', meta) : next;
    }
    case 'quran/addPages': {
      const pagesToday = Math.max(0, state.quran.pagesToday + action.pages);
      const position = (((state.quran.position + action.pages) % 604) + 604) % 604;
      const next = { ...state, quran: { ...state.quran, pagesToday, position } };
      return pagesToday >= state.quran.goalPages
        ? earn(next, 'quran', 'Daily Quran wird', REWARDS.quranGoal, 'deen', meta)
        : next;
    }
    case 'quran/setGoal':
      return { ...state, quran: { ...state.quran, goalPages: action.pages } };
    case 'tasbih/tap': {
      const count = state.tasbih.count + 1;
      const next = { ...state, tasbih: { ...state.tasbih, count, totalToday: state.tasbih.totalToday + 1 } };
      if (count % state.tasbih.target !== 0) return next;
      const round = Math.floor(state.tasbih.totalToday / state.tasbih.target);
      return round < 5
        ? earn(next, `tasbih:${round}`, `Tasbih round of ${state.tasbih.target}`, REWARDS.tasbihRound, 'deen', meta)
        : toast(next, `Round of ${state.tasbih.target} complete`, meta);
    }
    case 'tasbih/set':
      return {
        ...state,
        tasbih: {
          ...state.tasbih,
          phraseId: action.phraseId ?? state.tasbih.phraseId,
          target: action.target ?? state.tasbih.target,
          count: 0,
        },
      };
    case 'tasbih/reset':
      return { ...state, tasbih: { ...state.tasbih, count: 0 } };
    case 'habit/toggle': {
      const on = !state.habits[action.id];
      const next = { ...state, habits: { ...state.habits, [action.id]: on } };
      return on ? earn(next, `habit:${action.id}`, action.title, REWARDS.habit, 'deen', meta) : next;
    }

    // ---------- Wallet ----------
    case 'wallet/addExpense':
      return toast(
        {
          ...state,
          expenses: [
            {
              id: meta.id,
              title: action.title,
              amount: action.amount,
              category: action.category,
              at: meta.now,
              dayKey: state.dayKey,
            },
            ...state.expenses,
          ],
        },
        `Logged ${state.budget.currency}${action.amount.toFixed(2)}`,
        meta,
      );
    case 'wallet/deleteExpense':
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) };
    case 'wallet/setBudget':
      return toast({ ...state, budget: { daily: action.daily, currency: action.currency } }, 'Budget updated', meta);
    case 'wallet/addImpulse': {
      const next = {
        ...state,
        impulses: [
          {
            id: meta.id,
            title: action.title,
            price: action.price,
            trigger: action.trigger,
            addedAt: meta.now,
            waitHours: action.waitHours,
            status: 'cooling' as const,
          },
          ...state.impulses,
        ],
      };
      return earn(next, `park:${meta.id}`, `Paused “${action.title}”`, REWARDS.parkImpulse, 'wallet', meta);
    }
    case 'wallet/skipImpulse': {
      const item = state.impulses.find((i) => i.id === action.id);
      if (!item || item.status !== 'cooling') return state;
      const next = {
        ...state,
        savedTotal: state.savedTotal + item.price,
        impulses: mapItem(state.impulses, item.id, (i) => ({ ...i, status: 'skipped' as const })),
      };
      return earn(next, `skip:${item.id}`, `Skipped ${item.title}`, REWARDS.skipImpulse, 'wallet', meta);
    }
    case 'wallet/buyImpulse': {
      const item = state.impulses.find((i) => i.id === action.id);
      if (!item || item.status !== 'cooling') return state;
      const next = {
        ...state,
        impulses: mapItem(state.impulses, item.id, (i) => ({ ...i, status: 'bought' as const })),
      };
      return reducer(next, { type: 'wallet/addExpense', title: item.title, amount: item.price, category: 'Personal', meta });
    }
    case 'wallet/deleteImpulse':
      return { ...state, impulses: state.impulses.filter((i) => i.id !== action.id) };

    // ---------- System ----------
    case 'system/rollover':
      return rollover(state, action.dayKey);
    case 'toast/dismiss':
      return state.toast?.id === action.toastId ? { ...state, toast: null } : state;
  }
}
