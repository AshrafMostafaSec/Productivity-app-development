# AnchorOS

A personal iPhone productivity app for routines, study, prayer, focus, and daily spending. Built from the supplied design with React, TypeScript, and Capacitor.

## Implemented

- The four original areas: Today, Deen, Focus, and Wallet.
- Validated, versioned device storage: atomic protected files on iOS and transactional IndexedDB in a browser.
- Native Google Sign-In integration and Google Drive app-specific snapshot backups.
- Automatic backup after changes, retries, account isolation, overwrite prevention, backup history, and confirmed restore.
- Portable JSON export/import, recovery from damaged saves, and a previous-data rollback copy for each account.
- Native iPhone reminders, daily wake-up notifications, and reconciliation after returning to the app.
- Bundled fonts and split screens; no network is needed for local use after installation.
- GitHub Actions for web checks, an unsigned iPhone IPA, and gated beta releases.

Google sign-in needs the iOS OAuth client configuration and a signed device. The native Swift source compiled successfully with Xcode 26.6 on GitHub Actions. Signed-device and live Google validation remain outstanding.

App blocking through Screen Time, a system Live Activity, and a forced math alarm while the app is closed are not enabled. Focus passes are voluntary; the floating focus pill is inside the app. The iPhone app sends a daily wake-up notification and opens the math mission when tapped.

## Run and verify

Use Node 24 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

`pnpm check` checks application and test types, runs unit/integration tests, and builds the production app. Browser tests cover export/import, damaged imports, reload, concurrent windows, nested sheets, and all four tabs.

## iPhone project

On a Mac with Xcode 26 or newer:

```sh
pnpm ios:sync
pnpm ios:verify
pnpm ios:open
```

The app targets iOS 16 or newer. To configure Google before syncing:

```sh
GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com pnpm ios:sync
```

Use the exact client ID from Google Cloud; the configuration script validates it and generates the callback scheme. The ID above is illustrative, not a working credential. See [setup](docs/SETUP.md) for the complete steps.

## Build later

The workflows support manual dispatch and isolated validation branches. The gated beta workflow builds and tests the exact source commit before publishing the IPA, web ZIP, checksums, manifest, and validation notes. See [release validation](docs/RELEASE.md). The iOS workflow accepts the public iOS client ID as an input or reads the `GOOGLE_IOS_CLIENT_ID` repository variable. It does not require a Google password or token.

The iOS artifact is `AnchorOS-unsigned.ipa`. Signing and provisioning are still needed to install it on an iPhone. Keep the bundle identifier `com.ashrafmostafa.anchoros` stable across re-signing to match Google configuration.

## Project guide

- [Architecture](docs/ARCHITECTURE.md)
- [Backup and recovery behavior](docs/IOS_AND_BACKUP_PLAN.md)
- [Google and Apple setup](docs/SETUP.md)
- [Project review and platform limits](docs/PROJECT_REVIEW.md)
- [Progress and validation](docs/PROGRESS.md)

Backups contain personal data. Credentials, personal backups, Apple certificates, and provisioning profiles must stay out of Git and build artifacts. Bundled font licenses are in `public/licenses/`.
