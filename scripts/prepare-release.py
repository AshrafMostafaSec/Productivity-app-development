#!/usr/bin/env python3
"""Reject incomplete CI evidence or malformed packages before publishing a beta."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import struct
import sys
import zipfile

root = Path(sys.argv[1])
evidence = root / 'evidence'
unit = json.loads((evidence / 'unit-tests.json').read_text())
browser = json.loads((evidence / 'e2e.json').read_text())['stats']
audit = json.loads((evidence / 'audit.json').read_text())
assert unit['numTotalTests'] > 0 and unit['numPassedTests'] == unit['numTotalTests'], 'Unit tests are incomplete'
assert not unit['numFailedTests'] and not unit['numPendingTests'], 'Unit tests did not all pass'
assert browser['expected'] > 0 and all(browser[key] == 0 for key in ['unexpected', 'flaky', 'skipped']), 'Browser tests did not all pass'
assert all(count == 0 for count in audit['metadata']['vulnerabilities'].values()), 'Dependency audit has findings'
version = json.loads(Path('package.json').read_text())['version']
with zipfile.ZipFile(root / 'AnchorOS-unsigned.ipa') as ipa:
    assert ipa.testzip() is None, 'IPA has a broken ZIP entry'
    base = 'Payload/App.app/'
    info = plistlib.loads(ipa.read(base + 'Info.plist'))
    assert info['CFBundleIdentifier'] == 'com.ashrafmostafa.anchoros', 'Wrong app'
    assert info['CFBundleShortVersionString'] == version, 'Native/web versions disagree'
    executable = ipa.read(base + info['CFBundleExecutable'])
    assert struct.unpack('<II', executable[:8]) == (0xfeedfacf, 0x0100000c), 'Expected a 64-bit arm64 iPhone executable'
    assert ipa.read(base + 'public/index.html'), 'Bundled web app is missing'
    plistlib.loads(ipa.read(base + 'PrivacyInfo.xcprivacy'))
    assert not any(name.endswith(('.p12', '.p8', '.mobileprovision')) for name in ipa.namelist()), 'Unexpected signing material'
    assert not info.get('GIDClientID'), 'Removed sign-in configuration remains'
    assert any('anchorbackup' in item.get('UTTypeTagSpecification', {}).get('public.filename-extension', []) for item in info.get('UTExportedTypeDeclarations', [])), 'Backup file type is missing'
with zipfile.ZipFile(root / 'AnchorOS-web.zip') as web:
    assert web.testzip() is None and web.read('index.html'), 'Web bundle is incomplete'

native_check = (root / 'ios' / 'native-crypto-check.txt').read_text()
assert 'match WebCrypto (2 vectors)' in native_check, 'Native crypto interoperability evidence is missing'
(root / 'native-crypto-check.txt').write_text(native_check)
checksums = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in ['AnchorOS-unsigned.ipa', 'AnchorOS-web.zip']}
run_url = f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
manifest = {'version': version, 'commit': os.environ['GITHUB_SHA'], 'workflowRun': run_url,
            'unsigned': True, 'access': 'local-name-and-password', 'backup': 'encrypted-user-selected-Files-folder',
            'unitTestsPassed': unit['numPassedTests'], 'browserTestsPassed': browser['expected'],
            'knownDependencyVulnerabilities': audit['metadata']['vulnerabilities'], 'sha256': checksums}
(root / 'build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(root / 'SHA256SUMS.txt').write_text(''.join(f'{checksum}  {name}\n' for name, checksum in checksums.items()))
notes = f'''# AnchorOS {version} beta

Built from `{manifest['commit']}`. [Build and test evidence]({run_url}).

- TypeScript checks and {manifest['unitTestsPassed']} unit/integration tests passed.
- {manifest['browserTestsPassed']} browser tests passed on Chromium and WebKit using the production bundle at an iPhone viewport.
- The full JavaScript dependency audit reported no known vulnerabilities at build time.
- Xcode compiled the Release iphoneos app; packaging verified its bundle identifier, version, arm64 executable, privacy manifest, bundled web files, and ZIP integrity.
- SHA256SUMS.txt contains hashes for the attached IPA and web ZIP. build-manifest.json identifies the exact source commit.

## Installation and current limits

The IPA is unsigned. It must be signed and provisioned before installation on an iPhone. The web ZIP needs a local/static HTTP server.

Create a local name and password on first launch. Backups use AES-256-GCM with PBKDF2-SHA256 (600,000 iterations). Native CryptoKit/CommonCrypto interoperability with WebCrypto passed, including Unicode passwords and authenticated-header tamper rejection; see native-crypto-check.txt. There is no online sign-in or password reset.

In Profile & Backups, choose a Files folder outside AnchorOS and verify a completed copy before uninstalling. Deleting the app deletes its internal activities and folder permission bookmark. After reinstalling, choose a saved .anchorbackup file, enter the original password, review, and confirm the restore. Then select the folder again to resume automatic copies. Only completed backups restore later activities. Files held in a deleted provider/app folder or deleted manually cannot be recovered by AnchorOS.

The local password is an app lock. Internal activities retain iOS file protection/browser origin storage; exported and external backup contents are password encrypted.

Native notification delivery, permissions, background transitions, Files folder permissions/revocation, and full reinstall recovery still require signed-device checks. Automatic copies run after edits and on app lifecycle events; iOS does not guarantee hourly work while the app is closed. Screen Time enforcement and real ActivityKit Live Activities are not enabled.

This is a beta for device testing, with these remaining checks stated explicitly.
'''
(root / 'VERIFICATION.md').write_text(notes)
print(json.dumps(manifest, indent=2))
