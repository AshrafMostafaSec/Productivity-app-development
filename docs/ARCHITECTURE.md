# AnchorOS — Architecture & Implementation Guide

This document is the contract for anyone (human or AI) implementing features in AnchorOS.
Follow it exactly. If the code and this doc disagree, fix one of them in the same change so they match again.

The standalone repository adds a Capacitor iOS host and GitHub Actions. Domain state and screens below are unchanged. `IOS_AND_BACKUP_PLAN.md` defines the proposed Google integration; it does not describe features already shipped. `PROJECT_REVIEW.md` records the prototype's platform limits.

---

## 1. Product principles (why the code looks like this)

AnchorOS is built for an ADHD brain. Every design decision serves these rules:

| Principle | What it means in the UI |
|---|---|
| **One thing at a time** | Short sections behind `SubTabs`. Details live in sheets. Adhkar show one dhikr per screen. Focus mode is full-screen. |
| **Start tiny** | Every task has a "tiny first step". "Just start · 2 min" launches a 2-minute Pomodoro. |
| **Fixed landmarks** | The day is organized around the five prayers, not clock hours. |
| **Immediate reward** | Every meaningful action earns screen-time minutes, shown as an animated toast. |
| **Friction where it helps** | App unlocks cost minutes and wait for prayer. Purchases can be paused 24–72 h. The alarm needs a math mission. |
| **Calm, never noisy** | One accent color, white cards on a light gray canvas, soft springs, no shame language. |

---

## 2. Layers and data flow

```
            ┌───────────────────────── App.tsx ──────────────────────────┐
            │ StoreProvider → PhoneFrame → OverlayProvider               │
            │   main(tab screen) · LiveActivity · TabBar · Sheets ·      │
            │   AlarmOverlay · Onboarding · Toast                        │
            │   useScheduler()  ← timers, reminders, alarms              │
            └────────────────────────────────────────────────────────────┘
 screens/*  ──read──▶  useStore().state  +  state/selectors.ts (derived)
     │
     └──dispatch(Action)──▶ store.tsx stamps meta {now, id}
                                 │
                                 ▼
                          reducer.ts (pure)  ──▶ new StoreState
                                 │
                 store.tsx effects: saveState() · toast auto-dismiss · rollover check
```

**Layer rules (imports may only point downward):**

| Layer | May import | Must not |
|---|---|---|
| `screens/`, `shell/` | `ui/`, `state/`, `lib/`, `data/`, `hooks/`, `types` | contain reducer logic |
| `hooks/` | `state/`, `lib/` | render UI |
| `ui/` | `ui/`, `lib/notify` (haptics), `state/store` (Toast only) | know about domain rules |
| `state/` | `types`, `lib/time`, `data/` | import React components or browser APIs (except `store.tsx` and `storage.ts`) |
| `lib/`, `data/` | `types` | import from `state/` or `ui/` |

---

## 3. State

### 3.1 Shape

`AppState` in `src/types.ts` is the single source of truth. `StoreState = AppState & { toast }`; the toast is never persisted.

| Area | Fields | Daily reset (rollover) |
|---|---|---|
| Rewards | `balance`, `transactions`, `earned` | `earned` cleared |
| Prayer | `prayerTimes`, `prayers`, `prayerStreak` | `prayers` cleared; streak +1 if all 5 were logged yesterday |
| Routine | `routines`, `brainDump` | routine and step `done` → false |
| Uni | `assignments` | kept |
| Pomodoro | `pomodoro`, `pomodoroSettings`, `studyLog`, `focusGoalMins` | cycle reset unless running; log keeps 90 days |
| Shield | `apps`, `strictPrayerLock` | unlocks and `blockedToday` cleared |
| Deen | `adhkar`, `qiyam`, `quran`, `tasbih`, `habits` | all daily counters cleared; Quran streak updated |
| Wallet | `budget`, `expenses`, `impulses`, `savedTotal` | expenses kept 31 days (UI filters by `dayKey`) |
| Alarms | `alarms`, `ringingAlarm` | `ringingAlarm` cleared |
| System | `history`, `notifications`, `notified`, `onboarded`, `dayKey`, `version` | yesterday's `recordFor()` pushed to `history` (90 days); `notified` cleared |

### 3.2 Actions

Actions are namespaced `area/verb` and declared in the `Action` union in `reducer.ts`:

`prayer/*` `routine/*` `brain/*` `uni/*` `pomo/*` `focus/goal` `shield/*` `adhkar/*` `qiyam/set` `quran/*` `tasbih/*` `habit/toggle` `wallet/*` `alarm/*` `notify/*` `toast/*` `system/*`

The store wraps `dispatch` and stamps every action with `meta: { now: number, id: string }`.
The reducer uses `meta.now` for timestamps and `meta.id` for new ids. That keeps it pure, which also makes it safe under React StrictMode's double invocation.

### 3.3 Reward economy

- `earn(state, key, label, delta, source, meta)` pays out **once per key per day** (`state.earned[key]`), logs a transaction, and shows the toast.
- `spend(state, label, cost, meta)` deducts minutes (shield unlocks).
- Key format: `area:id`, e.g. `prayer:fajr`, `step:<stepId>`, `adhkar:morning`, `pomo:<meta.id>`.
- Every amount lives in `state/rewards.ts`. Toasts with `delta ≥ 10` trigger the celebration burst.

### 3.4 Pomodoro state machine

```
 idle ──start──▶ running ──pause──▶ paused ──resume──▶ running
                   │                                     │
                   └──(endsAt reached: useScheduler dispatches pomo/complete)
                              │
            focus done: log StudySession + earn(minutes × focusPerMinute)
                        cycle += 1 → next phase = long if cycle % cyclesBeforeLong === 0, else short
            break done: next phase = focus
                              │
              autoStart ? running(next phase) : ready(next phase) ──start──▶ running
 skip  → ready(next phase), nothing logged
 stop  → idle; a focus phase with ≥1 elapsed minute is logged as partial study
```

The timer is driven by the absolute `endsAt`, never by counting ticks, so it survives re-renders, background tabs, and reloads.

### 3.5 Persistence and migration

- Storage key `anchoros:v1`. The payload carries `version` (currently **2**).
- `loadState()` merges the saved payload over `createInitialState()`, so new fields appear automatically.
- When you rename or reshape a field: bump `version` in `types.ts` and `initialState.ts`, then add a migration branch in `storage.ts`.
- Rollover runs on load, every 60 s, and on `visibilitychange`.

---

## 4. Scheduler and notifications

`hooks/useScheduler.ts` runs once (from `App`) on a 1-second interval and reads the latest state through a ref.

| Trigger | Condition | Dedupe key |
|---|---|---|
| Pomodoro phase end | `pomodoro.status === 'running' && endsAt <= now` | state transition itself |
| Prayer at adhan | unlogged, within 5 min of the time | `prayer:<id>` |
| Prayer nudge | unlogged, 20–25 min after | `prayer-late:<id>` |
| Deadlines | after 09:00, `dueSoon()` not empty | `deadlines` |
| Impulse cooled | cooling item with 0 h remaining | `impulse:<id>` |
| Alarm | enabled, within its minute | `alarm:<id>` |

Delivery (`lib/notify.ts`):

- App visible → in-app toast. App hidden → system `Notification` (if permission was granted).
- Sound comes from `chime()` (WebAudio, no assets) when `notifications.sound` is on. Haptics use `navigator.vibrate`.
- **Limit:** web reminders only fire while the app is open, foreground or background. Reminders while it is closed would need a Service Worker plus Push. That is a planned extension (see §9).

To add a reminder: add a toggle to `NotificationSettings` (if needed), add a block in `tick()` with a unique daily key, then add a row in `SettingsSheet`.

---

## 5. Navigation and screen layout

```
Tab (TabBar)        SubTabs sections                    Sheets / overlays
──────────────────  ──────────────────────────────────  ───────────────────────────────
Today   (Sun)       Now · Routine · Inbox               AddTask, Task, Insights, Settings
Deen    (Moon)      Salah · Adhkar · Quran · Night      Prayer, Adhkar reader, Tasbih, PrayerTimes
Focus   (Target)    Pomodoro · Uni · Shield             PomodoroSettings, Immersive mode,
                                                         Assignment, AddAssignment, Intercept
Wallet  (Wallet)    Today · Pause · Trends              AddExpense, AddImpulse, Budget
Global              —                                   AlarmOverlay, Onboarding, LiveActivity, Toast
```

Each screen follows the same template:

```tsx
const SECTIONS = ['a', 'b', 'c'] as const;
type Section = (typeof SECTIONS)[number];

export default function XScreen() {
  const { section, direction, setSection } = useSection<Section>(SECTIONS);
  return (
    <Screen
      eyebrow="Context line"
      title="X"
      action={<CircleAction …/>}
      tabs={<SubTabs value={section} onChange={setSection} options={[…]} />}
      sectionKey={section}
      direction={direction}
    >
      {section === 'a' && <ASection />}
      …
    </Screen>
  );
}
```

Budget per section: about 1–1.5 phone screens of content. If a section grows beyond that, split it or move details into a sheet.

---

## 6. Design system

### 6.1 Tokens (`src/index.css` `@theme`)

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F2F2F7` | screen background, sheet background |
| `card` | `#FFFFFF` | cards, grouped lists |
| `label` | `#000` | primary text |
| `secondary` | `rgba(60,60,67,.6)` | secondary text |
| `tertiary` | `rgba(60,60,67,.3)` | placeholders, chevrons, empty checks |
| `separator` | `rgba(60,60,67,.18)` | hairlines |
| `fill` / `fill-strong` | gray at 12% / 20% | chips, tracks, pressed state |
| `accent` | `#007AFF` | the only action color |
| `danger` | `#FF3B30` | destructive, overdue, over budget |
| `font-sans` | SF Pro → Inter | everything |
| `font-arabic` | Amiri | all Arabic |

Feature palettes, used only in their own components:

- Day rings: Salah `#007AFF`, Focus `#32ADE6`, Tasks `#5856D6` (`RING_COLORS`).
- `SkyCard`: five time-of-day gradients.
- Night, Immersive, and Alarm: deep navy `#0f1b3d → #2b3f78`.

### 6.2 Typography (iOS scale)

Large title 34/41 bold · hero numbers 40–58 bold, `tabular` · section titles 20 bold · body 17 · subhead 15 · footnote 13 · caption 11–12.
Section headers are 13 px uppercase `text-secondary`.

### 6.3 Primitives (`src/ui/`)

| Component | Purpose |
|---|---|
| `Screen`, `CircleAction` | Large title that collapses on scroll, sticky tabs, section slide transition |
| `SubTabs`, `useSection` | Pill section switcher with sliding indicator plus direction tracking |
| `Group`, `Row` | Inset-grouped list; rows animate in, out, and between positions; strike-through when `muted` |
| `Sheet`, `useSticky`, `overlay` | Spring bottom sheet with drag-to-dismiss, portaled into the phone viewport |
| `Card` | White rounded container (16 px radius, 16 px padding) |
| `Button` | `filled` · `tinted` · `gray` · `plain` × `sm` · `md` · `lg`, plus `destructive` |
| `Check`, `Toggle`, `Segmented`, `Stepper`, `Field` | iOS controls (animated) |
| `ProgressRing`, `ProgressBar`, `BarChart`, `AnimatedNumber` | Progress and stats visuals |
| `Toast` | Reward / info banner with celebration burst |
| `EmptyState`, `IconTile`, `IconButton` | Small helpers |

### 6.4 Motion (`src/ui/motion.ts`)

| Preset | Use |
|---|---|
| `spring` (520/38) | taps, toggles, indicators, icons |
| `softSpring` (260/30) | rings, bars, charts, number-driven visuals |
| `sheetSpring` (380/40) | sheets |
| `ease` `[0.32,0.72,0,1]` | section slides, fades |

Patterns:

- Every tappable element gets `whileTap` scale 0.86–0.97.
- Lists animate through `Group`'s `AnimatePresence`, with `initial={false}` so nothing animates on first paint.
- Repeated "alive" motion (sun pulse, stars, breathing glow, "Now" badge) stays slow (2–8 s) and low-contrast.
- Never animate layout-heavy properties in long lists beyond what `Row` already does.

---

## 7. How to add a feature (checklist)

1. **Types.** Add the domain types and `AppState` fields to `src/types.ts`.
2. **Seed.** Add defaults to `createInitialState()`. If the field is daily, reset it in `rollover()`.
3. **Actions.** Add them to the `Action` union, then add reducer cases. Use `meta`; reward through `earn()` with a daily-unique key; put amounts in `rewards.ts`.
4. **Selectors.** Put derived values in `selectors.ts`. If the feature should appear in progress tracking, add it to `DayRecord` and `recordFor()`.
5. **Reminders (optional).** Add a block to `useScheduler`, plus a toggle in `NotificationSettings` and in `SettingsSheet`.
6. **UI.** Pick the tab, then a new or existing `SubTabs` section, then compose from `ui/` primitives. Put details or forms in a `Sheet` file named `XSheet.tsx` next to the screen.
7. **Migration.** If you changed existing persisted shapes, bump `version` and migrate in `storage.ts`.
8. **Verify.** Run `node_modules/.bin/tsc --noEmit -p .`, then `pnpm build`.
9. **Docs.** Update this file and `AGENTS.md` if structure or rules changed.

### Done means

- No TypeScript errors and the build passes.
- Data survives reload, and daily data resets on a new day.
- The UI uses only tokens and primitives, every new section fits about one screen, and empty states are written.
- Rewards can't be farmed by toggling.

---

## 8. Content rules

- Adhkar live in `data/adhkar.ts` as `{ id, arabic, title, count, note? }`. Ids must be unique within a collection, and shared adhkar (Ayat al-Kursi, the three Quls) are reused through constants.
- Have a reliable source review any new Arabic text before shipping.
- Prayer times are user-entered (`PrayerTimesSheet`). Don't auto-calculate without adding a location consent flow.

---

## 9. Planned extensions (in priority order)

The immediate priority is reliable storage, Google account recovery, and a signed iPhone build as detailed in `IOS_AND_BACKUP_PLAN.md`. The original web extension ideas below remain a backlog, not the current delivery order. A Service Worker alone cannot guarantee scheduled reminders on a closed iOS app.

1. **PWA + push.** Manifest, Service Worker, and scheduled push so prayer, Pomodoro, and alarm reminders fire while the app is closed.
2. **Prayer time calculation** from location (with consent), keeping manual override.
3. **Export / import backup** (JSON) from Settings → Data.
4. **Recurring weekly lecture schedule** in Uni, so it can suggest Pomodoro blocks between lectures.
5. **Code-split** heavy sheets (Insights, Settings) with `React.lazy` to keep the main chunk small.

Each extension must follow §7 and keep the principles in §1.
