# Project review

Reviewed on 2026-10-19 from `Productivity app development.zip` and the initially empty GitHub repository.

## Product and implementation

AnchorOS organizes a person's day around five prayers. It uses four main tabs and short sections rather than long pages.

| Area | Existing behavior | Main files |
|---|---|---|
| Today | Routine steps, quick tasks, inbox, daily rings | `src/screens/today/` |
| Deen | Prayer logs, adhkar, Quran progress, tasbih, night habits | `src/screens/deen/`, `src/data/adhkar.ts` |
| Focus | Absolute-time Pomodoro, assignments broken into steps, simulated app passes | `src/screens/focus/`, `src/hooks/useScheduler.ts` |
| Wallet | Expenses, daily budget, cooling-off purchases, trends | `src/screens/wallet/` |
| Settings and insights | Manual prayer times, notification toggles, alarms, progress, destructive reset | `src/screens/more/` |
| State | Central pure reducer, reward ledger, daily rollover, versioned local persistence | `src/state/`, `src/types.ts` |
| Presentation | Shared controls, sheets, design tokens, animation presets | `src/ui/`, `src/shell/`, `src/index.css` |

Data flows from screens through `dispatch`, then the reducer, then the persistence effect. Toasts are excluded from storage. Version 1 saves are migrated into the version 2 shape. Reward keys reduce duplicate rewards. These boundaries are worth retaining.

## Findings that affect delivery

| Priority | Finding | Required response |
|---|---|---|
| P0 | `storage.ts` stores the only copy in localStorage; write failures are swallowed | Introduce durable persistence, explicit errors, a durable backup queue, and tested restore before real use |
| P0 | Parsed saves are type-cast and shallowly merged; nested corrupt/missing fields are not validated | Validate full data shapes and versions; preserve invalid originals; migrate in a staging transaction |
| P0 | A new install starts with sample data immediately | Put account recovery before cloud writes so sample data cannot replace a real backup |
| P1 | No account system, Drive API integration, backup history, or import/export | Implement the backup milestone and recovery tests in the target plan |
| P1 | Shield only changes state and shows a sheet | Implement native Screen Time integrations separately, with entitlement and signing checks |
| P1 | Scheduler depends on JavaScript intervals and Web Notifications | Schedule native local notifications; do not promise execution after suspension/termination |
| P1 | `LiveActivity.tsx` is a floating React component | Add an ActivityKit extension only if a real lock-screen/Dynamic Island feature is required |
| P1 | Alarm audio/math overlay depends on an active web runtime | Evaluate native notification/AlarmKit capabilities separately; do not promise forced math dismissal while closed |
| P2 | Seed currency is `$`, prayer times are fixed examples, and an assignment is demonstration content | Ask for locale/currency, manual or calculated prayer times, and explicit demo-data import during onboarding |
| P2 | Fonts are fetched from Google Fonts | Bundle reviewed font assets for a fully offline experience |
| P2 | Some notification copy implies stronger background support than implemented | Correct copy when adding the native notification adapter; expose actual delivery status |

## Foundation changes

The source remains a React app. Figma runtime configuration is removed from Vite and the HTML shell now declares its own language, title, viewport safe-area support, and robots metadata. Capacitor provides an iOS host without rewriting the product UI. CI checks the web build and separately compiles an unsigned device app on macOS.

This change does not migrate existing storage, connect Google, modify domain behavior, or represent a production release. Native compilation and device behavior must be assessed separately from a successful web build.

## Platform references

- [Capacitor iOS requirements](https://capacitorjs.com/docs/ios)
- [Apple background task scheduling](https://developer.apple.com/documentation/backgroundtasks/bgtaskrequest/earliestbegindate)
- [Apple Family Controls entitlement](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement)
- [Google Drive app-specific storage](https://developers.google.com/workspace/drive/api/guides/appdata)
