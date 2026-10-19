# AnchorOS

A personal, prayer-anchored productivity app with Today, Deen, Focus, and Wallet screens, built from the supplied design with React and a Capacitor iPhone host.

## Local profile and recovery

- Choose a name and password on first launch. Cold launches require the password; Settings includes Lock app.
- Activities save on the device using validated atomic iOS files or browser IndexedDB.
- In the iPhone app, choose a Files folder outside AnchorOS for automatic encrypted backups. Copies run after edits and on app lifecycle events; their successful read-back time is shown.
- Export encrypted `.anchorbackup` files in either the app or browser. After reinstalling, select a saved file, enter its original password, review, and confirm the restore. Then select the external folder again to resume automatic copies.
- Native prayer, deadline, timer, and daily alarm reminders supplement the in-app scheduler.

Backups use password-derived AES-256-GCM with PBKDF2-SHA256 and authenticated metadata. The password is a local app lock; internal activities retain native file protection/browser origin storage. No remote sign-in or password reset service is used.

Deleting the app removes its internal files and saved folder permission. Recovery requires a completed copy saved outside that container and its original password. Files deleted manually, lost with the device, or deleted with their provider cannot be restored by AnchorOS. iOS does not guarantee scheduled work while the app is closed.

## Build and validate

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm ios:sync
pnpm ios:verify
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

Use Node 24 and pnpm 11.25.0. Web UI tests use the production bundle on Chromium and WebKit at an iPhone viewport. The native job also checks shared CryptoKit/CommonCrypto code against WebCrypto vectors before Xcode compilation.

The unsigned IPA needs Apple signing/provisioning. A successful build does not replace signed-iPhone checks for Files permissions, folder/provider behavior, notifications, and deletion/reinstallation recovery.

- [Setup and real-device checklist](docs/SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Local access and backup design](docs/IOS_AND_BACKUP_PLAN.md)
- [Release validation](docs/RELEASE.md)

OS-level Screen Time blocking, system ActivityKit Live Activities, and forced closed-app math alarms are not enabled. Focus passes and the floating focus timer remain in-app features.
