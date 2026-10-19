# Setup requirements

## Working foundation

Use Node 24, pnpm 11.25.0, `pnpm install --frozen-lockfile`, and `pnpm check`. For native development, use a Mac with Xcode 26 or newer. The existing `ios/` folder is source-controlled: use `pnpm ios:sync`, then `pnpm ios:open`. Do not regenerate it after adding native code or extensions.

The iOS workflow needs no signing secret because it builds an unsigned device app. Its artifact cannot be installed directly. The workflow only claims success after Xcode returns successfully and the application bundle is found.

## Google setup for milestone 2

No Google credentials are needed to run the current prototype. For real sign-in and backup:

1. Confirm the bundle identifier. Current proposal: `com.ashrafmostafa.anchoros`.
2. Create or select the permanent Google Cloud project and enable Google Drive API.
3. Configure the OAuth consent application and test users where applicable. Review the current consent/testing and token-lifetime rules before enabling unattended backup.
4. Create an **iOS** OAuth client matching the final bundle identifier.
5. Supply the iOS client ID and its reversed URL scheme. These are public application configuration, not account passwords.
6. Integrate the native SDK/bridge and Info.plist callback entries, then authorize the `drive.appdata` scope through the app.
7. Test a full sign-in/upload/delete/reinstall/restore cycle on a signed device.

Do not put a Google password, access token, refresh token, client secret, or service-account key in the repository. A personal Drive backup uses the person's Google authorization, not a shared service account. This plan does not require server OAuth credentials unless a backend is added later.

## Apple signing decision

Choose the supported installation route before implementing the signed release job: local Xcode signing/re-signing for personal use, or an Apple Developer Program distribution route such as TestFlight. Keep the app identifier stable and verify the capabilities supported by that route.

If using certificate/profile signing in CI, add the certificate, certificate password, provisioning profile, and temporary Keychain password through GitHub Actions secrets. Use the official GitHub signing guide; keep signing outside pull-request jobs and clean the temporary Keychain/profile after the job. No signing secrets have been requested or installed by this foundation.

## Before real data

Finish validated persistence and backup/restore first. Current sample prayer times, currency, assignments, routines, and alarms are examples from the supplied design. Current localStorage data can be lost when the app is removed; no Google recovery exists yet.
