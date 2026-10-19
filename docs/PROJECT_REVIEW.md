# Current implementation review — 0.3.0

The earlier remote-account plan is superseded by the owner's requested local name/password profile and Files backups. Original code/review history remains in git.

## Implemented boundaries

- The access gate runs before domain activities are loaded or rendered. A password-derived authenticated proof verifies the password. Manual lock cancels controller work before clearing the in-memory key.
- Activities save atomically with revision/backup metadata. Existing active activities and rollback survive migration to the local profile. Invalid saves are preserved for recovery.
- Exported and automatic file backups are AES-GCM encrypted with authenticated profile/revision metadata, a random nonce per copy, and bounded PBKDF2 parameters. A fresh installation can restore a file and password only after preview/confirmation.
- The native picker rejects the app's container, uses security-scoped bookmarks and coordinated I/O, checks selection tokens, and restricts generated backup filenames. Permission failures remain visible. Read-back verification and a durable acknowledgment precede retention.
- Remote account code, native SDK, callbacks, build inputs, and network API integration were removed.

## Verification and practical limits

The local suite includes real browser cryptography tests and controller/provider boundary tests. Production UI tests cover creation, unlock, wrong password, lock, activities, and fresh-context restore. The release workflow records actual totals and adds native CryptoKit/CommonCrypto interoperability checks plus Xcode compilation.

A local password is an app lock, not an online identity or added encryption of internal activity files. Internal storage uses iOS file protection or browser origin controls. The exported backup's original password cannot be reset by a service.

Deleting the app deletes its activities and folder bookmark. A completed separate file outside the container must exist first; the user selects it after reinstalling and then selects the folder again for future copies. Removing the provider or losing/deleting its files removes those copies. iOS cannot promise hourly work while closed.

Physical-device permission persistence, provider behavior, actual uninstall/reinstall, native notifications, and background delivery need the signed-device checklist. Screen Time enforcement and real ActivityKit remain optional future work.
