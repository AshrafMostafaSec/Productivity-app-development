export type TabId = 'today' | 'deen' | 'focus' | 'wallet';

export type PrayerId = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export type PrayerLog = 'none' | 'on_time' | 'late';

export interface PrayerDay {
  status: PrayerLog;
  sunnah: boolean;
}

export interface Step {
  id: string;
  title: string;
  done: boolean;
}

export interface RoutineTask {
  id: string;
  title: string;
  anchor: PrayerId;
  minutes: number;
  starter: string;
  steps: Step[];
  done: boolean;
}

export interface Assignment {
  id: string;
  course: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  steps: Step[];
}

export interface ShieldApp {
  id: string;
  name: string;
  cost: number; // minutes of reward balance per 15-minute pass
  unlockedUntil: number | null; // epoch ms
  blockedToday: number;
}

export type ExpenseCategory = 'Food' | 'Study' | 'Transport' | 'Personal';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  at: number; // epoch ms
  dayKey: string;
}

export interface Impulse {
  id: string;
  title: string;
  price: number;
  trigger: string;
  addedAt: number; // epoch ms
  waitHours: number;
  status: 'cooling' | 'skipped' | 'bought';
}

export interface BrainDumpItem {
  id: string;
  text: string;
  at: number;
}

export type RewardSource = 'prayer' | 'routine' | 'uni' | 'shield' | 'wallet' | 'deen' | 'focus';

export interface RewardTx {
  id: string;
  label: string;
  delta: number;
  source: RewardSource;
  at: number;
}

export type AdhkarSessionId = 'morning' | 'evening' | 'sleep' | `after:${PrayerId}`;

export interface QuranState {
  goalPages: number;
  pagesToday: number;
  position: number; // last page read, 0..604
  streak: number;
}

export interface TasbihState {
  phraseId: string;
  target: number;
  count: number;
  totalToday: number;
}

export type PomoPhase = 'focus' | 'short' | 'long';

export interface PomodoroState {
  phase: PomoPhase;
  /** idle: nothing started · running · paused · ready: phase finished, waiting for the next start */
  status: 'idle' | 'running' | 'paused' | 'ready';
  endsAt: number | null;
  remainingMs: number;
  phaseMs: number;
  cycle: number; // focus blocks completed in the current set
  subject: string; // course / assignment label
  task: string; // what you're working on right now
}

export interface PomodoroSettings {
  focus: number;
  short: number;
  long: number;
  cyclesBeforeLong: number;
  autoStart: boolean;
}

export interface StudySession {
  id: string;
  at: number;
  dayKey: string;
  minutes: number;
  subject: string;
  task: string;
}

export interface DayRecord {
  dayKey: string;
  prayers: number; // 0..5
  onTime: number;
  focusMins: number;
  tasksDone: number;
  tasksTotal: number;
  spent: number;
  quranPages: number;
  adhkar: number; // sessions completed
  earned: number;
}

export interface Alarm {
  id: string;
  time: string; // HH:MM
  label: string;
  enabled: boolean;
  mission: 'math' | 'tap';
}

export interface NotificationSettings {
  prayers: boolean;
  pomodoro: boolean;
  deadlines: boolean;
  wallet: boolean;
  sound: boolean;
}

export interface AppState {
  version: 2;
  dayKey: string;
  balance: number;
  transactions: RewardTx[];
  /** Reward keys already paid out today, so toggling can't farm minutes. */
  earned: Record<string, boolean>;

  prayerTimes: Record<PrayerId, string>; // HH:MM 24h
  prayers: Record<PrayerId, PrayerDay>;
  prayerStreak: number;

  routines: RoutineTask[];
  brainDump: BrainDumpItem[];

  assignments: Assignment[];
  apps: ShieldApp[];
  strictPrayerLock: boolean;
  pomodoro: PomodoroState;
  pomodoroSettings: PomodoroSettings;
  studyLog: StudySession[];
  focusGoalMins: number;
  alarms: Alarm[];
  ringingAlarm: string | null;

  adhkar: Partial<Record<AdhkarSessionId, Record<string, number>>>;
  qiyam: { rakaat: number; witr: boolean };
  quran: QuranState;
  tasbih: TasbihState;
  habits: Record<string, boolean>;

  budget: { daily: number; currency: string };
  expenses: Expense[];
  impulses: Impulse[];
  savedTotal: number;

  history: DayRecord[];
  notifications: NotificationSettings;
  /** Reminder keys already fired today. */
  notified: Record<string, boolean>;
  onboarded: boolean;
}
