# Build and use AnchorOS 0.3.0

## Development

Use Node 24 and pnpm 11.25.0. Install with `pnpm install --frozen-lockfile`. Run `pnpm check`, `pnpm ios:sync`, and `pnpm ios:verify`. Install browsers with `pnpm exec playwright install chromium webkit`, then run `pnpm test:e2e` against the built production bundle. `ANCHOROS_CHROMIUM_PATH` may identify an existing local Chromium; use `--project=chromium` if WebKit is not installed in that environment.

On macOS, `swiftc ios/App/App/AnchorCrypto.swift scripts/crypto-check/main.swift -o build/crypto-check` followed by `build/crypto-check scripts/crypto-check/vectors.json` verifies native/browser backup interoperability. The iOS Actions job runs this check and Xcode Release compilation automatically.

## Local name and password

On first launch, choose your name, a password of at least eight characters, and its confirmation. Existing device activities are retained. Later cold launches require this password. Settings → Profile & Backups → Lock app closes the local profile without deleting activities.

The password is an app lock and encrypts exported/automatic backups. Internal activity files retain iOS file protection/browser origin storage. No remote account, client ID, API key, password transmission, or online reset service is involved. Keep the original password: an encrypted backup cannot be recovered without it.

## Automatic file copies on iPhone

1. Open Settings → Profile & Backups → Choose folder.
2. In Files, select/create a folder outside AnchorOS, for example a durable Downloads or other Files location available on your device. A folder belonging to AnchorOS is rejected because deleting the app deletes its container. Pick a provider/location whose files you intend to keep independently of this app.
3. An empty folder starts automatic backup and verifies the first copy. When the folder already contains copies for this profile, review one or confirm Keep current device activities. A folder containing another profile is not used to replace it.
4. Check the selected folder name and a successful File backup verified timestamp. Pending/paused/error states mean newer activities may still be only on the device.
5. File copies run after edits, on activation/reconnection, and best effort on backgrounding. iOS does not guarantee hourly backups while the app is closed.

The app writes encrypted `.anchorbackup` files, verifies them by read-back/decryption/hash, and preserves a bounded history. Copy files to another safe location yourself if protection against device loss is needed.

## Reinstall and restore

Before deleting the app, verify a completed external copy or export an encrypted file and save it outside AnchorOS.

After reinstalling, on the welcome screen choose Restore from a backup, select the saved file, enter its original password, choose Review backup, then Confirm restore. This restores its name, activities, and password access. No data changes before confirmation. Running timers restore paused. A rollback of valid previous activities and original damaged bytes are preserved where available.

Select the external folder again to enable automatic copies. Reinstalling deletes the saved folder bookmark; AnchorOS cannot silently reacquire access or discover arbitrary device files. Deleting the backup itself or its owning provider's data removes that recovery copy.

## iPhone installation and device checks

The unsigned IPA requires Apple signing/provisioning before installation. Keep the bundle identifier `com.ashrafmostafa.anchoros` stable where your signing route permits. Native folder access uses standard document picker APIs and needs no special signing entitlement for a selected folder.

Test the signed build on your iPhone before trusting automatic recovery:

- Create a password, task, study session, expense, prayer log, and native reminder. Confirm they survive lock/unlock and a restart.
- Choose an external Files folder; inspect the encrypted file and verified timestamp. Edit offline, background/reopen, and verify a newer copy.
- Revoke folder access, move the folder, or disconnect its provider. Confirm an error stays visible and device activities remain intact. Choose the folder again and verify recovery.
- Export a file, enter a wrong restore password, cancel a restore, and verify no replacement occurs.
- Only after keeping a verified separate copy: delete the app, reinstall, select that file, enter the original password, confirm restore, verify activities/history, then choose the folder again.
- Test native notifications on the locked phone. Provider access, background timing, and deletion/reinstall behavior need physical-device evidence.

## CI and releases

Individual web/iOS workflows support manual dispatch and reusable calls. The release workflow is scoped to `codex/local-files-backup`, requires both jobs to pass, verifies package/test evidence, and publishes a beta. See RELEASE.md. Screen Time enforcement and real ActivityKit Live Activities remain outside this release.
