# Backup and recovery implementation

The core implementation is now in source. Real Google authorization, iPhone notification delivery, and native compilation still require a configured signed device and the later macOS build.

## Storage and account model

`AppState` remains version 2 and is validated with Zod in `src/storage/schema.ts`. A separate version-1 device vault contains the installation ID, active account scope, accounts, and scoped datasets. Each dataset includes state, a monotonic revision, dirty flag, verified cloud head/hash/time, backup preference, recovery flag, and its own rollback state.

The iOS backend uses a serial native queue and one atomically replaced JSON file under Application Support, protected until first unlock. The browser backend uses one IndexedDB transaction for the current/previous vault. IndexedDB plus Web Locks prevents another active browser window from writing over this window. This replaces the initial SQLite proposal: a small single-user snapshot app does not need an additional SQL dependency.

All product state changes still use stamped pure reducer actions. The controller stores a snapshot of state and backup metadata together. Write errors remain visible, block cloud uploads, and can be retried. A new action cannot be labeled saved merely because it exists in memory.

Legacy `anchoros:v1` data is validated and v1 state is migrated into v2. The old localStorage value is retained. Corrupt data blocks normal startup, preserves original bytes, and offers export and confirmed recovery; it is never silently replaced with example data.

Google datasets are keyed by stable account subject, not email. Signing out opens the separate guest dataset and keeps the account's local state. A rollback copy cannot cross accounts. Importing a file from another Google account requires signing out first. Explicitly copying guest data into an account requires confirmation.

## Authentication and Drive authorization

The iOS `AnchorNativePlugin` wraps Google's supported native Sign-In SDK. Info.plist and both application/scene callback routes handle the OAuth redirect. There is no embedded-WebView login and no shared server credential. Drive access uses the narrow `drive.appdata` scope, authorized after sign-in. The Google SDK restores its native session and refreshes credentials; refresh tokens never enter AppState, exports, or JavaScript storage.

The Drive adapter obtains an account-checked access token per request. It only lists app-specific files in `appDataFolder`, paginates results, bounds response/file sizes to 8 MB, uses cancellation/timeouts, and exposes authorization/rate-limit failures. It does not read unrelated Drive documents.

## Recovery gate

A first connection checks Drive before any upload. If cloud history exists or the installation has not yet made a starting-data choice, the UI asks which copy to use. Seed/default data cannot automatically replace cloud data.

The user can review a selected cloud or portable copy, including time and record counts, then explicitly restore. Download validation, account checks, supported versions, and SHA-256 verification all precede replacement. Restore commits a rollback copy with the new device state. Notification dedupe state, ringing overlays, and active app passes are excluded; a running focus timer restores paused. Daily rollover is applied once through the reducer. Uploads stay paused after restore until re-enabled and checked against the newest cloud head.

A different remote head blocks uploading and returns to the choice screen. This is deliberately a single-active-writer snapshot system, not automatic multi-device merging. Immutable files preserve both devices' histories if a race occurs; Drive file listing is not an atomic compare-and-swap service. Use a backend/operation-level conflict model before claiming simultaneous-device synchronization.

## Scheduling and queue

- A meaningful action updates local state/revision/dirty metadata immediately and queues a serialized durable write.
- Automatic cloud backup waits 15 seconds after edits, with a 60-second maximum wait during continuous edits.
- Activation, connectivity recovery, and an hourly active-app check revisit pending work.
- **Back up now** works explicitly even when automatic backup is paused, once the recovery gate has been resolved.
- A transition to background makes a best-effort attempt. The iOS scene requests a short background execution window; it does not guarantee upload completion or wake the app every hour.
- Transient failures retry with bounded exponential backoff/jitter and respect Retry-After. Authorization failures require reconnecting. Pending work survives restart.

The UI distinguishes device saving/error, pending backup, paused automatic backup, upload in progress, and the last verified cloud time. Local reset pauses backup, keeps cloud history, and creates an account-scoped rollback copy.

## Snapshot and acknowledgment

A portable/cloud snapshot includes format/version, state version, account subject, installation ID, revision, parent file ID, creation time, app version, canonical-payload SHA-256, and validated domain payload. The hash detects accidental corruption, not malicious changes.

Every cloud upload creates a new immutable file. The adapter downloads and verifies the saved copy before the controller acknowledges it locally. Edits arriving in flight remain dirty after that older revision succeeds. A matching installation/revision/hash can recover a timed-out upload without duplicating it. Sign-out, account switch, restore, or pausing auto-backup cancels pending requests and invalidates stale callbacks.

After successful read-back and durable acknowledgment, retention keeps 20 latest revisions plus one UTC-daily copy for the last 30 days. A candidate is downloaded/validated before deletion. Unknown-format/unreadable files are retained. App-specific storage is hidden from normal Drive browsing and is not end-to-end encryption; portable exports use the share sheet/download flow and contain personal data.

## Native notifications

The pure notification planner schedules future prayer/nudge/deadline/cooling-off notifications for a rolling three-day window and a running Pomodoro completion. Daily alarm notifications use repeating calendar triggers. The plan keeps at most 60 pending requests and is reconciled when relevant state changes, on activation, or periodically while active. Tapping an alarm opens the in-app mission.

A web timer does not block other apps, become an iOS Live Activity, or force an alarm to keep ringing when the app is closed. Those optional system features require their own native extensions/capabilities and are explicitly labeled unavailable in this release.

## Verification boundaries

The automated tests cover storage validation/migration, atomic metadata persistence, failures, hashes, account isolation, reinstall recovery, interrupted acknowledgments, new in-flight edits, stale callbacks, conflicts, reset/rollback, retention, native reminder planning, and the HTTP boundary. Browser tests cover actual UI export/import, reload, damaged input, simultaneous tabs, navigation, and nested sheets.

Swift project references, OAuth configuration, schemes, storyboards, and privacy configuration are checked locally. Xcode compilation and real Google/iPhone behavior are not certified by these tests. See `SETUP.md` for the required signed-device checks.

## Primary references

- [Google Sign-In setup](https://developers.google.com/identity/sign-in/ios/start-integrating) and [API authorization](https://developers.google.com/identity/sign-in/ios/api-access)
- [Google Drive app data](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Capacitor custom iOS code](https://capacitorjs.com/docs/ios/custom-code)
- [Capacitor notifications](https://capacitorjs.com/docs/apis/local-notifications)
- [Apple background task scheduling](https://developer.apple.com/documentation/backgroundtasks/bgtaskrequest/earliestbegindate)
