# Validation and beta releases

The release workflow is authorized by the owner. A push to `codex/release-validation` runs the reusable web and iOS workflows against that exact commit. Manual dispatch is also available. A release job with `contents: write` runs only on that branch and only after both builds pass. Test/build jobs have read-only repository permissions. Main and pull-request pushes do not publish releases.

The workflow publishes `v0.2.0-beta.<workflow-run-number>` as a prerelease, attaching:

- `AnchorOS-unsigned.ipa`: the actual Xcode Release build for arm64 iPhones.
- `AnchorOS-web.zip`: the tested production web bundle; serve it over HTTP.
- `SHA256SUMS.txt`: SHA-256 hashes of both packages.
- `build-manifest.json`: source commit, workflow URL, test totals, audit result, and OAuth configuration state.
- `VERIFICATION.md`: evidence and remaining device checks, also used as the release notes.

The publishing gate reads the JSON test reports, requires all tests to pass without skips or flaky results, and rejects known dependency audit findings. It checks ZIP integrity, app identity/version, the arm64 executable, bundled HTML, and privacy manifest before publishing. Dependency actions are pinned to reviewed release commits using Node 24.

## Regression coverage

The 55 core tests cover schemas, migration, corrupt/empty saves, atomic repository queues, storage failures, account isolation, restore/rollback, read-back verification, interrupted uploads, retry/debounce/maximum backup delay, reminder scheduling, deadline status, and timer/reward invariants.

Eight UI scenarios run on both Chromium and WebKit with an iPhone viewport against the production build: export/import and reload; damaged imports; simultaneous windows; nested sheets and tabs; offline thoughts converted to routines; expense add/delete and reload; deadline steps; and paused timer persistence. Page exceptions and console errors fail every scenario. WebKit coverage exercises a Safari engine; it does not replace signed-device validation.

## Remaining physical-device checks

This beta is unsigned. Signing and provisioning are required before installation. Configure the public `GOOGLE_IOS_CLIENT_ID` repository variable to enable Google sign-in in a later build. The current OAuth state is recorded in each release manifest.

Complete `SETUP.md`'s signed-device checklist before relying on cloud backup: real Google consent/token refresh, account switching, offline edits/reconnection, notification delivery, background transitions, and reinstall/restore. Automated Drive tests use doubles. iOS does not guarantee hourly work while the app is closed. Screen Time enforcement and ActivityKit are not included.
