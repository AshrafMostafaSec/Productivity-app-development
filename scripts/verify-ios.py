#!/usr/bin/env python3
"""Check native source/config wiring before Xcode is available. This does not compile Swift."""
from pathlib import Path
import plistlib
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
app = root / 'ios/App/App'
project = (root / 'ios/App/App.xcodeproj/project.pbxproj').read_text()
for name in ['AnchorNativePlugin.swift', 'AnchorCrypto.swift', 'AnchorViewController.swift', 'SceneDelegate.swift', 'AppDelegate.swift']:
    assert (app / name).is_file(), f'Missing native source: {name}'
    assert f'{name} in Sources' in project, f'Native source is not compiled: {name}'
assert 'GoogleSignIn' not in project, 'Removed sign-in SDK is still linked'
assert 'PrivacyInfo.xcprivacy in Resources' in project, 'Privacy manifest is not bundled'
assert 'com.ashrafmostafa.anchoros' in project, 'Unexpected bundle identifier'
info = plistlib.loads((app / 'Info.plist').read_bytes())
assert 'GIDClientID' not in info, 'Removed OAuth configuration remains'
assert any('anchorbackup' in item.get('UTTypeTagSpecification', {}).get('public.filename-extension', []) for item in info.get('UTExportedTypeDeclarations', [])), 'Backup file type is not registered'
privacy = plistlib.loads((app / 'PrivacyInfo.xcprivacy').read_bytes())
assert any(item['NSPrivacyAccessedAPIType'] == 'NSPrivacyAccessedAPICategoryFileTimestamp' for item in privacy['NSPrivacyAccessedAPITypes'])
ET.parse(root / 'ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme')
for path in app.rglob('*.storyboard'): ET.parse(path)
print('Native source references, local cryptography, backup file type, privacy manifest, scheme, and storyboards checked. Swift compilation still requires Xcode.')
