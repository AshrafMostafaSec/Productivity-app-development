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
    oauth_configured = bool(info.get('GIDClientID'))
with zipfile.ZipFile(root / 'AnchorOS-web.zip') as web:
    assert web.testzip() is None and web.read('index.html'), 'Web bundle is incomplete'

checksums = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in ['AnchorOS-unsigned.ipa', 'AnchorOS-web.zip']}
run_url = f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
manifest = {'version': version, 'commit': os.environ['GITHUB_SHA'], 'workflowRun': run_url,
            'unsigned': True, 'googleOAuthConfigured': oauth_configured,
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

Google iOS OAuth client configured in this build: **{'yes' if oauth_configured else 'no'}**. Google sign-in and Drive backup require OAuth setup and validation on a signed physical device. Automated cloud tests use test doubles; no live Google account was used.

Native notification delivery, permissions, background transitions, and reinstallation recovery still require signed-device checks. iOS does not guarantee hourly backup while the app is closed. Screen Time enforcement and real ActivityKit Live Activities are not enabled.

This is a beta for device testing, with these remaining checks stated explicitly.
'''
(root / 'VERIFICATION.md').write_text(notes)
print(json.dumps(manifest, indent=2))
