# Configure and build AnchorOS

## Local development

Install Node 24 and pnpm 11.25.0, then run `pnpm install --frozen-lockfile`. `pnpm check` validates application/test types, runs the core tests, and builds the app. Install the Playwright Chromium browser with `pnpm exec playwright install chromium`, then run `pnpm test:e2e`.

`ANCHOROS_CHROMIUM_PATH` can point at a compatible existing Chromium executable for a constrained development environment. The test suite does not depend on that option in normal installations.

No Google account or Apple signing material is needed for local-only use. Browser sessions support export/import and durable device storage; Google authorization is implemented in the iPhone host.

## Google Cloud

1. Use the permanent Google Cloud project for this app and enable **Google Drive API**.
2. Configure the OAuth consent application. Add the intended Google account as a test user if the consent app is in testing. Check Google's current testing/token rules before relying on unattended backups.
3. Register an **iOS OAuth client** for `com.ashrafmostafa.anchoros`. If you change the bundle identifier, update both the Capacitor configuration and Xcode project before registering the matching client.
4. Save the public client ID as the GitHub repository variable **GOOGLE_IOS_CLIENT_ID**, or enter it in the iOS workflow's manual input. No client secret or service account is needed.
5. For a local Mac build, set `GOOGLE_IOS_CLIENT_ID` when running `pnpm ios:sync`. `scripts/configure-ios.py` writes `GIDClientID` and the reversed callback URL scheme to Info.plist. It refuses malformed IDs. A build without an ID keeps Google sign-in disabled and local backups available.
6. Build and sign the app. In **Settings → Account & Backup**, choose **Sign in with Google**, then allow application-specific Drive storage. On a new account connection, choose a cloud copy to restore or explicitly choose which device data to keep.
7. Wait for a completed backup time before uninstalling. Perform the reinstall test below.

OAuth client IDs are public app configuration. Google passwords, access/refresh tokens, client secrets, and service-account keys must not be put in source control. The Google SDK handles refresh credentials natively; the JavaScript bridge only requests a short-lived access token when calling Drive.

## Apple installation

The Xcode project targets iOS 16+, uses GoogleSignIn 9.0.0 through Swift Package Manager, and includes the required local native plugin, callback handlers, shared build scheme, and file-access privacy reason. Capacitor sync updates its own generated plugin package references.

Choose your supported installation route: local Xcode signing/re-signing for personal use, or an Apple Developer Program route such as TestFlight. An unsigned IPA cannot be installed directly. Keep the bundle ID and the Google project/client identity stable. A re-signing tool that changes the bundle ID may break Google authorization; reconfiguration is required if the app identity changes.

No Apple ID password is required by the unsigned workflow. If signed CI distribution is added later, keep the certificate/profile and their passwords in protected GitHub Actions secrets, outside pull-request jobs. Screen Time/ActivityKit extensions and a forced closed-app alarm are outside this release's capabilities.

## Run GitHub Actions when ready

The workflows are manual only, as requested. After merging the implementation PR:

1. Open **Actions → Web CI → Run workflow** for types, core tests, browser tests, and web assets.
2. Open **Actions → iOS unsigned build → Run workflow** to sync the configured app, validate native references, compile on macOS, and package the unsigned IPA.
3. Download **AnchorOS-unsigned-iphone** after the job succeeds, then sign/provision using your chosen installation route.

No Actions run was requested for this implementation. If GitHub still blocks execution, use the account-level reason shown in its job annotations; this cannot be resolved by changing app code.

## Required signed-device checks

Test on the target iPhone before trusting cloud recovery:

- Sign in, grant Drive access, create a task/assignment/expense/prayer log, and wait for **Backed up**.
- Turn off the network, edit, restart the app, reconnect, and verify the pending changes upload.
- Sign out and into another account. Confirm their data and rollback copies stay separate.
- Export/import a copy and confirm restore only happens after review.
- Delete the app, reinstall a signed build with the same bundle/client identity, sign in, and restore the verified cloud copy before enabling uploads.
- Lock the screen and test prayer, timer, and daily alarm notifications. System notification settings can silence delivery. Reopen at least every few days to refresh rolling prayer/deadline reminders.

Only acknowledged cloud snapshots survive loss of the device container. Background flushes are best effort; there is no guaranteed hourly upload while the app is closed.
