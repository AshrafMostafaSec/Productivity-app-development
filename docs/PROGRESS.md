# Progress and handoff

## 2026-10-19 — release validation

- PR #3 was merged. Web CI and an unsigned Xcode 26.6 Release build succeeded on the merged application source; the IPA was uploaded as an Actions artifact.
- Reviewed persistence, backup/recovery boundaries, reminders, reducers, and UI flows. Added regression protection for empty saved files, premature/duplicate timer completion, stale backup status after disk recovery, and deadlines with no steps.
- Expanded core tests to 55 and browser scenarios to eight, configured for Chromium and WebKit against the production bundle.
- Updated Vite and the Xcode tool’s UUID dependency; the full dependency audit reported zero known findings locally. Verified Xcode parser/UUID compatibility and Capacitor sync.
- Added a gated beta release workflow that records the exact source/run, verifies both packages, and publishes checksums and evidence. See `RELEASE.md`; its release manifest records final remote test results.
- Live Google and signed-device checks are still required. The following implementation notes describe the earlier development milestone.

## 2026-10-19 — application implementation

- Continued from the merged foundation PR #1 on a new implementation branch.
- Replaced unvalidated localStorage saves with a validated versioned repository: native atomic protected files and browser IndexedDB with a single-window writer lock.
- Added a scoped durable backup queue, migration/recovery, portable exports/imports, confirmation previews, and per-account rollback.
- Implemented the Google Sign-In native bridge, account-checked Drive adapter, immutable snapshots, overwrite prevention, read-back verification, retries, retention, and account switch cancellation.
- Added Account & Backup settings and explicit saved/pending/paused/error states.
- Added native notification scheduling, daily wake-up notifications, callback handling, public OAuth configuration, a privacy manifest, and a shared Xcode scheme.
- Bundled licensed fonts, removed the sample assignment/medication-specific defaults, clarified voluntary focus passes, split screen bundles, fixed animation keys, and kept nested-sheet keyboard focus inside the top sheet.
- Changed both GitHub Actions workflows to manual-only. No workflow dispatch or remote build was requested during this implementation.

## Validation

Application/test TypeScript checks passed; 39 core tests and 4 Playwright mobile-viewport browser tests passed. The production build, Capacitor sync, native project/config checks, full Xcode project parsing, and valid/invalid OAuth configuration checks passed locally. The browser checks include export/import and reload, invalid imports, concurrent tabs, sheet navigation, and the four tabs.

The iOS project was generated/synced on Linux; Xcode is not available here. The Google SDK bridge has not been exercised against a real account or signed iPhone. No IPA was produced in this turn. Actual OAuth, signing, device notifications, and reinstall recovery need the later signed-device checks in `SETUP.md`.

## Owner configuration before device testing

1. Configure the permanent Google Cloud iOS OAuth client for `com.ashrafmostafa.anchoros`, enable Drive API, and set the public `GOOGLE_IOS_CLIENT_ID` variable/input.
2. Choose the Apple signing/re-signing route and keep the bundle identity stable.
3. When ready, merge the implementation PR and manually run the workflows. Inspect the macOS compile result before claiming native build success.
4. Complete the real-device offline/reinstall recovery checklist before relying on cloud backup for important data.

## Platform boundaries

The app does not enforce Screen Time blocking, create a system ActivityKit Live Activity, or force a closed-app math alarm. It supports voluntary focus passes, the in-app focus pill/math mission, and native scheduled reminders. No guaranteed hourly background backup is claimed.

## Earlier foundation

PR #1 imported the supplied source, added the Capacitor host and workflows, and documented the original local-only prototype. Its first GitHub-hosted jobs could not start because of an account-level restriction. That initial account restriction was later resolved; the completed build evidence is described above.
