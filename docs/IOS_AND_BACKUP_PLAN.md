# iPhone delivery and Google backup plan

Status: proposed implementation contract. Google authentication and cloud backup are not implemented in this foundation.

## Goal and boundaries

Keep the existing interface, package it as an iPhone app, and restore the person's data after reinstalling or re-signing with the same Google account. Local use must continue offline. An update installed over the same app identity may retain its container; deletion or a changed identity must be treated as potential local data loss. Only acknowledged cloud backups can be recovered from the cloud.

Recommended first version: React + TypeScript + Capacitor, native Google Sign-In, durable local storage, and snapshots in Google Drive `appDataFolder`. A separate server or Firebase database is not required for this single-user backup flow. This is a snapshot backup design, not concurrent multi-device synchronization.

## Responsibilities

| Layer | Responsibility | Planned location |
|---|---|---|
| UI | Account, last successful backup, pending work, errors, backup/restore controls | `src/screens/more/` |
| Domain | Pure actions, validation, migrations, persisted data types | `src/state/`, `src/types.ts` |
| Local repository | Atomic saves, account namespaces, durable queue, rollback copy | `src/storage/` |
| Backup engine | Debounce, retry, snapshot revisions, recovery gate, retention | `src/backup/` |
| Google adapter | List/upload/download app-specific snapshots using authorized access tokens | `src/services/googleDrive.ts` |
| Native bridge | Google Sign-In SDK, native credential handling, SQLite, lifecycle, local notifications | `ios/`, `src/platform/` |
| CI | Validate source and build artifacts; signing isolated to a future protected release job | `.github/workflows/` |

Persisted product data continues through actions and the reducer. Network and native calls remain outside the reducer. Credentials are never included in `AppState`, JSON exports, or backup snapshots.

## Google account integration

1. Create a Google Cloud project, enable Drive API, configure consent, and register the iOS OAuth client for the final bundle identifier. The foundation currently uses `com.ashrafmostafa.anchoros` as the proposed stable identifier; confirm it before registering OAuth or provisioning.
2. Use the supported Google Sign-In iOS SDK via a small Capacitor bridge. The system authentication flow and URL callback must work on a signed device. Do not run Google login inside the app's embedded WebView.
3. Request account identity and, when the person enables backup, the narrow `https://www.googleapis.com/auth/drive.appdata` scope. Signing in and granting Drive authorization are separate steps; an ID token is not a Drive access token.
4. Let the native SDK restore sessions and refresh authorization. Keep credential storage in native SDK/Keychain facilities, not localStorage. Reauthenticate explicitly if authorization is revoked. Never embed a client secret in the app.
5. Partition local metadata by the stable Google account subject identifier, not by email. Cancel in-flight work and invalidate callbacks when switching accounts. Do not upload account A's data to account B.

`appDataFolder` is hidden from the normal Drive file list and scoped to this application's authorized data. It is not end-to-end encryption. A separate visible JSON export can be offered later through the iOS share sheet; app-data files themselves cannot be shared as ordinary Drive files. Keep the Google Cloud project and OAuth application identity stable across app builds.

## Local persistence and queue

Before cloud writes, replace the single unvalidated localStorage payload with a versioned repository. Use a maintained Capacitor SQLite adapter on iOS after checking its current iOS support and privacy requirements; use IndexedDB for the browser. Choose the adapter during milestone 1, not by adding unused packages now.

Each committed domain revision and its pending-backup marker must be written atomically. Keep a durable monotonic revision, an installation identifier, and per-account metadata. A failed local save must remain visible and retryable; never label an in-memory change as safely saved.

Migrate `anchoros:v1` only after full shape validation. Retain the old payload until a new local read-back succeeds. Never reset silently when data is malformed or a migration is unsupported. Daily rollover, reward balances, assignments, and expense history need migration tests.

## Backup policy

Proposed defaults are implementation choices, not guaranteed delivery times:

- Save every committed change locally immediately. Debounce cloud attempts by about 15 seconds after the last meaningful edit; force an attempt after 60 seconds of continuous edits while active.
- Flush pending work on app activation, connectivity recovery, successful authorization, and an explicit **Back up now** action.
- While the app is active, an hourly check retries dirty work. Do not upload another copy when the content hash is unchanged.
- A transition to background may start a short best-effort flush. Native background tasks are opportunistic; iOS decides when they run. Force-quit apps and offline devices cannot guarantee an hourly or daily upload.
- Retry transient network/429/5xx failures with bounded exponential backoff, jitter, and `Retry-After` support. Authorization failures require the SDK refresh path or visible reauthentication. Never clear pending work after a failed attempt.
- Keep immutable snapshots. Retain the latest 20 valid revisions plus a daily snapshot for 30 days; deduplicate overlap. Prune only after a new snapshot is uploaded and verified.

The UI distinguishes **Saved on device**, **Backup pending**, **Backed up at [time]**, **Offline**, and **Sign in again**. The cloud acknowledgment, not the start of an upload, determines the last-success time.

## Snapshot format and failure safety

A versioned envelope includes `format`, `formatVersion`, `stateSchemaVersion`, `accountSubject`, `installationId`, `revision`, `parentSnapshotId`, `createdAt`, `appVersion`, `payloadSha256`, and a domain `payload`. Serialize the payload canonically before computing SHA-256. The digest detects accidental corruption, not malicious tampering.

Do not back up tokens, notification dedupe keys, ringing overlays, toast state, or temporary app unlocks. On restore, sanitize transient fields and reconcile overdue timers and daily rollover once using the current local day. Future reminders are regenerated from durable settings.

Upload each snapshot as a new file in `appDataFolder`, then read it back to verify its schema, account, and digest before marking its local revision acknowledged. A timeout after upload may leave a duplicate; deduplicate by account, installation, revision, and digest. Keep the previous verified snapshot until a newer verified snapshot exists. A revision created during an upload remains pending after the older upload succeeds.

## Recovery and overwrite prevention

Use a startup recovery state machine: `local-loading → account-check → cloud-check → restore-choice → ready`. Cloud writes are disabled until recovery resolves. If offline, allow local work but keep uploads gated until the cloud check finishes.

On a fresh install, signing in must first discover valid cloud snapshots. Offer **Restore my backup** or **Start fresh**. Starting fresh requires a clear choice; sample seed data cannot silently overwrite existing cloud data. If both local edits and a cloud backup exist, show timestamps and summary counts, create a rollback copy, and ask which data to keep. Never merge whole `AppState` objects with a blind object spread.

Download, size-limit, validate, verify, and migrate a candidate in staging. Reject unknown future versions or account mismatches without touching current data. Commit the restored state atomically only after confirmation and successful validation. If the latest snapshot is invalid, offer the previous valid one and keep the damaged copy for diagnosis.

Version 1 supports one active writer. A different installation or divergent parent snapshot blocks automatic uploads and asks the person to choose a dataset. Immutable snapshots prevent destructive replacement, but are not a multi-device merge algorithm. Real simultaneous editing needs a later backend or an explicit operation-level merge design.

Reset, sign-out, disconnect, and cloud deletion are separate operations. Local reset does not erase cloud history. Signing out does not delete local data silently. Cloud deletion must be explicit and must pause pending uploads so a deleted backup is not immediately recreated.

## Build and signing

The foundation checks in the generated Capacitor iOS project and pinned npm dependencies. `pnpm ios:sync` copies the production web build into it. CI compiles an unsigned iPhone device target, packages `Payload/App.app`, and uploads an unsigned IPA. Inspect GitHub Actions for the actual native result; Linux cannot validate Xcode compilation.

Installing on an iPhone needs signing/provisioning. A future protected release job can import a certificate/profile using Actions secrets and export a signed archive. An Apple ID password must not be embedded in workflow files. Re-signing options and supported capabilities depend on the chosen signing route; do not assume unsigned build success proves Google Keychain use, Screen Time entitlements, or notification delivery.

## Delivery milestones

| Milestone | Deliverable | Exit check |
|---|---|---|
| 0 — foundation | Import source, standalone build, iOS host, web/native workflows, review and plan | TypeScript/web pass; native workflow result inspected |
| 1 — data safety | Validated repository, migration, local export/import, durable queue | Reload/restart, corrupt data, migration failure, full storage and interrupted-write tests |
| 2 — Google backup | Native sign-in, incremental Drive authorization, snapshots, recovery UI | Signed-device login, upload/read-back, revoked access, offline retries, account isolation |
| 3 — reinstall recovery | Restore gate, retention, conflicts, progress UI | Create tasks/prayers/expenses → verified upload → delete app → reinstall → sign in → exact restore |
| 4 — iPhone behavior | Signed build, native local notifications, timer reconciliation, safe areas | Locked-device and background tests on the target iPhone |
| 5 — optional system features | Screen Time shield, ActivityKit, advanced alarms | Entitlement-approved signed device tests; honest unavailable states |

## Required recovery tests

Test fresh installation with an existing cloud backup before any seed upload; reinstall with the same account; no-network edits followed by recovery; token expiry/revocation; account switching during an upload; new edits while upload is in flight; corrupted latest snapshot; unsupported future schema; process death after upload before acknowledgment; restore spanning midnight/DST; a second device with divergent history; explicit cloud deletion while an upload is pending. Record any data not included in the snapshot contract.

## Primary references

- [Capacitor setup](https://capacitorjs.com/docs/getting-started) and [iOS support](https://capacitorjs.com/docs/ios)
- [Google Sign-In iOS setup](https://developers.google.com/identity/sign-in/ios/start-integrating)
- [Google Drive application data](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Apple background scheduling guarantee](https://developer.apple.com/documentation/backgroundtasks/bgtaskrequest/earliestbegindate)
- [Apple Family Controls entitlement](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement)
- [GitHub certificate provisioning on macOS runners](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)
