# Local-profile beta releases

The owner has authorized validation and GitHub Releases publication. A push to `codex/local-files-backup` runs reusable web and iOS workflows against that exact commit. Manual dispatch remains available. Publication runs only on that branch and after both jobs pass. Test/build jobs have read-only repository access; only the publishing job has contents write access. Main and pull-request pushes do not publish releases.

The workflow tags `v<package-version>-beta.<run-number>` and attaches the actual unsigned IPA, production web ZIP, SHA256SUMS, exact-source manifest, verification notes, and native-crypto-check.txt. The publishing gate verifies JSON test reports, zero audit findings, native crypto evidence, ZIP integrity, app identity/version, arm64 executable, privacy manifest, backup file type registration, and bundled HTML before publishing.

The core suite covers schemas/migration, damaged/empty saves, atomic save queues, local password verification, authenticated encrypted backup contents, nonce uniqueness, invalid parameters, wrong-password rejection, restore confirmation, a fresh-container recovery, folder tokens/permissions, stale callbacks, retry/debounce, retention, reminders, timer/reward invariants, and existing domain flows.

Ten UI scenarios run on Chromium and WebKit against the production bundle at an iPhone viewport. They include local profile creation, password re-entry after reload, lock/wrong-password behavior, portable backup export/import, damaged imports, simultaneous windows, nested sheets/tabs, offline activities, expenses/deadlines/timers, and recovery in a fresh browser context. Page exceptions and console errors fail scenarios.

The macOS job compiles the same AnchorCrypto.swift helper used by the iPhone bridge and checks WebCrypto-generated ASCII/Unicode password vectors. This validates PBKDF2, AES-GCM output/decryption, SHA-256, and tamper rejection across the two runtimes before building the iOS host.

This is a beta for signed-device testing. The IPA is unsigned. Physical Files-provider permissions/revocation, folder bookmark persistence, native reminder delivery, background transitions, and uninstall/reinstall recovery require checks on the target iPhone. Only completed backups outside the app's container plus their original password can restore activities after deletion. The internal activity store retains OS/origin protections; the password is an app lock and encryption applies to external/portable backups. See SETUP.md.
