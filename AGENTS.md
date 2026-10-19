# AnchorOS — ADHD Life OS

AnchorOS is a mobile-first, iOS-style web app that helps one person with ADHD run their day.
Everything is anchored to the five daily prayers. It covers five areas:

1. **Routine** — small habits attached to each prayer ("after Asr: desk reset").
2. **University** — deadlines split into tiny steps, plus a study **Pomodoro**.
3. **Money** — a daily safe-to-spend budget and a cooling-off timer for impulse buys.
4. **Focus passes** — voluntary breaks cost earned minutes and pause until the current prayer is logged. OS-level Screen Time blocking is not enabled in this release.
5. **Deen** — salah tracking, adhkar (morning, evening, after prayer, sleep), tasbih, Quran wird, qiyam al-layl, sunnah habits.

Domain data lives in a validated device vault (atomic protected JSON on iOS; IndexedDB in a browser). Native Google sign-in and app-specific Drive backup are implemented in source, but require OAuth configuration and signed-device validation. Read `docs/IOS_AND_BACKUP_PLAN.md` for the target design and `docs/PROJECT_REVIEW.md` for current limitations.

> **Before changing anything, read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).**
> It is the source of truth for structure, state, design tokens, motion, and the rules for adding features.

---

## Runtime

React + Vite + Tailwind CSS, with a Capacitor iOS host. The original Figma Make preview integration has been removed from the standalone build.

- Install with `pnpm install --frozen-lockfile`; use the Node and pnpm versions in `package.json`.
- Run `pnpm dev` only when a local preview is needed. Verify broad changes with `pnpm check`.
- Run `pnpm ios:sync` after web or plugin changes. Commit native project changes, but not copied web assets, generated Capacitor config, credentials, or build outputs.
- The user has authorized Actions build validation. Both workflows support manual dispatch and pushes to the dedicated `codex/actions-validation` branch. Keep automatic main/PR triggers disabled unless requested.
- Run `pnpm check`, `pnpm ios:verify`, and the meaningful browser checks after broad changes. Never claim real Google/device/Xcode success from mocks or web tests.
- Keep side effects outside the reducer. Preserve account isolation, recovery gates, atomic state/metadata saves, and stale-callback cancellation. Never silently replace invalid saved data.

## Stack

- React 19, TypeScript 5.7 (strict), Vite 8
- Capacitor 8 for the iOS host; Xcode is required for native compilation
- Tailwind CSS v4 via `@tailwindcss/vite` (no tailwind config, no PostCSS config)
- `motion` (`motion/react`) for all animation
- `lucide-react` for every icon. No emoji in the UI.
- Formatting: oxfmt (`pnpm format`)

## Project map

```
src/
  main.tsx              React entry; imports index.css, mounts App
  App.tsx               Providers, tab switching, global overlays and sheets
  index.css             Fonts, Tailwind import, @theme design tokens, keyframes
  types.ts              ALL domain types and AppState (single file)

  state/                The only place data changes
    store.tsx           StoreProvider + useStore(); async startup, lifecycle, toast timer
    controller.ts       Action orchestration, durable saves, account/recovery/backup state machine
    reducer.ts          Every Action + the pure reducer; earn()/spend() reward ledger
    initialState.ts     Seed data for a first launch
    selectors.ts        Derived values (money, safe-to-spend, progress, history)
    rewards.ts          Every reward amount, in one table

  storage/              Zod state/vault schemas, migration, serial repository, IndexedDB/native backends
  backup/               Canonical snapshot validation/hashing and retention
  services/             Google auth and bounded/cancellable Drive HTTP adapter
  platform/             Native bridge, file sharing, pure notification planner

  hooks/useScheduler.ts Reminders, Pomodoro phase changes, alarms (runs once in App)
  lib/                  Pure helpers: time.ts (prayers, dates), notify.ts (Notifications, sound, haptics), useNow.ts
  data/adhkar.ts        Arabic adhkar content, tasbih phrases, sunnah habits

  ui/                   Design-system primitives (no business logic)
  shell/                PhoneFrame, TabBar, LiveActivity (floating Pomodoro pill)
  screens/<tab>/        One folder per tab: today, deen, focus, wallet
  screens/more/         Insights (progress) and Settings sheets
  screens/*.tsx         Global overlays: AlarmOverlay, Onboarding
docs/ARCHITECTURE.md    Architecture, rules, and how to add features
```

## Non-negotiable rules

1. **State changes go through `dispatch`.** The controller wraps the pure reducer and publishes snapshots through `useSyncExternalStore`. Never use `useState` for persisted domain data. Local `useState` is only for UI (open sheets, form drafts, the current section).
2. **The reducer stays pure.** Use `action.meta.now` and `action.meta.id` (stamped by the store). Never call `Date.now()`, `Math.random()`, or browser APIs inside `reducer.ts`.
3. **Rewards go through `earn(state, key, …)`** with a unique key per day, so toggling something off and on can't farm minutes. Put amounts in `rewards.ts`.
4. **Any new persisted field** must be added to `types.ts`, to `createInitialState()`, and (if it's daily) reset in `rollover()`. Update the Zod schema too. Version-2 saves must validate fully. Bump the state version and add an explicit migration in `storage/schema.ts` when persisted shapes change.
5. **Build UI from `src/ui/`.** Use `Screen`, `SubTabs`, `Group`, `Row`, `Sheet`, `Card`, `Button`, `Check`, `Toggle`, `Segmented`, `Stepper`, `Field`, `ProgressRing`/`ProgressBar`, `BarChart`, `AnimatedNumber`, `EmptyState`. Add a new primitive only when no existing one fits.
6. **Keep pages short.** Each tab is split into 3–4 `SubTabs` sections. A new feature becomes a section, a card in an existing section, or a `Sheet`. It is never another long scroll.
7. **Use the design tokens** (`bg-canvas`, `bg-card`, `text-secondary`, `text-accent`, `bg-fill` …), never raw grays. Accent is `#007AFF`. Red (`danger`) is only for destructive actions, overdue items, and over-budget amounts.
8. **Take motion from `ui/motion.ts`** (`spring`, `softSpring`, `sheetSpring`, `ease`). Don't invent ad-hoc durations.
9. **Sheets render through the overlay portal** (`Sheet` does this). For sheets driven by a nullable id, use `useSticky()` so content stays while the sheet animates out.
10. **Hooks before early returns**, always. Export components as default exports.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here"`), or typographic apostrophes (`’`) inside single-quoted strings. An unescaped `'` in a single-quoted string breaks the build.
- Keep JSX tags closed and braces balanced.
- Arabic text must carry `dir="rtl" lang="ar"` and the `font-arabic` class.
- Copy is short, warm, and concrete: tell the user the next tiny action. Never shame.
