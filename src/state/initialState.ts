import type { AppState, PomodoroState, PrayerDay, PrayerId, RoutineTask } from '../types';
import { dayKeyOf } from '../lib/time';

export const blankPrayers = (): Record<PrayerId, PrayerDay> => ({
  fajr: { status: 'none', sunnah: false },
  dhuhr: { status: 'none', sunnah: false },
  asr: { status: 'none', sunnah: false },
  maghrib: { status: 'none', sunnah: false },
  isha: { status: 'none', sunnah: false },
});

const routine = (
  id: string,
  title: string,
  anchor: PrayerId,
  minutes: number,
  starter: string,
  steps: string[],
): RoutineTask => ({
  id,
  title,
  anchor,
  minutes,
  starter,
  done: false,
  steps: steps.map((s, i) => ({ id: `${id}-${i}`, title: s, done: false })),
});

export const idlePomodoro = (subject = '', task = ''): PomodoroState => ({
  phase: 'focus',
  status: 'idle',
  endsAt: null,
  remainingMs: 0,
  phaseMs: 0,
  cycle: 0,
  subject,
  task,
});

export function createInitialState(now: Date = new Date()): AppState {
  return {
    version: 2,
    dayKey: dayKeyOf(now),
    balance: 30,
    transactions: [],
    earned: {},

    prayerTimes: { fajr: '05:04', dhuhr: '12:22', asr: '15:48', maghrib: '18:34', isha: '19:54' },
    prayers: blankPrayers(),
    prayerStreak: 0,

    routines: [
      routine('r-launch', 'Morning launchpad', 'fajr', 10, 'Drink a full glass of water', [
        'Drink a glass of water',
        'Open the curtains',
        'Pack charger and student ID',
      ]),
      routine('r-desk', 'Desk reset', 'asr', 10, 'Clear just three things off the desk', [
        'Clear the desk surface',
        'Phone on the stand, face down',
        'Open tomorrow’s first task — just open it',
      ]),
      routine('r-fuel', 'Protein & water', 'asr', 5, 'Walk to the kitchen', [
        'High-protein snack',
        'Refill water bottle',
      ]),
      routine('r-review', 'Plan tomorrow', 'maghrib', 8, 'Open your calendar', [
        'Check tomorrow’s first lecture',
        'Pick one must-do task',
      ]),
      routine('r-wind', 'Wind down', 'isha', 15, 'Plug the phone in across the room', [
        'Lay out tomorrow’s clothes',
        'Phone on the far charger',
        'Lights off by 11',
      ]),
    ],
    brainDump: [],

    assignments: [],
    apps: [
      { id: 'tiktok', name: 'TikTok', cost: 15, unlockedUntil: null, blockedToday: 0 },
      { id: 'instagram', name: 'Instagram', cost: 15, unlockedUntil: null, blockedToday: 0 },
      { id: 'youtube', name: 'YouTube', cost: 15, unlockedUntil: null, blockedToday: 0 },
      { id: 'x', name: 'X', cost: 10, unlockedUntil: null, blockedToday: 0 },
      { id: 'reddit', name: 'Reddit', cost: 10, unlockedUntil: null, blockedToday: 0 },
      { id: 'games', name: 'Games', cost: 20, unlockedUntil: null, blockedToday: 0 },
    ],
    strictPrayerLock: true,
    pomodoro: idlePomodoro(),
    pomodoroSettings: { focus: 25, short: 5, long: 15, cyclesBeforeLong: 4, autoStart: false },
    studyLog: [],
    focusGoalMins: 120,
    alarms: [
      { id: 'al-fajr', time: '04:50', label: 'Wake for Fajr', enabled: true, mission: 'math' },
      { id: 'al-uni', time: '07:30', label: 'Get ready', enabled: false, mission: 'tap' },
    ],
    ringingAlarm: null,

    adhkar: {},
    qiyam: { rakaat: 0, witr: false },
    quran: { goalPages: 2, pagesToday: 0, position: 0, streak: 0 },
    tasbih: { phraseId: 'subhanallah', target: 33, count: 0, totalToday: 0 },
    habits: {},

    budget: { daily: 100, currency: 'EGP' },
    expenses: [],
    impulses: [],
    savedTotal: 0,

    history: [],
    notifications: { prayers: true, pomodoro: true, deadlines: true, wallet: true, sound: true },
    notified: {},
    onboarded: false,
  };
}
