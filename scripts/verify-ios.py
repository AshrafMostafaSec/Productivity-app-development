#!/usr/bin/env python3
"""Check native source/config wiring before Xcode is available. This does not compile Swift."""
from pathlib import Path
import plistlib
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
app = root / 'ios/App/App'
project = (root / 'ios/App/App.xcodeproj/project.pbxproj').read_text()
for name in ['AnchorNativePlugin.swift', 'AnchorViewController.swift', 'SceneDelegate.swift', 'AppDelegate.swift']:
    assert (app / name).is_file(), f'Missing native source: {name}'
    assert f'{name} in Sources' in project, f'Native source is not compiled: {name}'
assert 'GoogleSignIn in Frameworks' in project and 'GoogleSignIn-iOS.git' in project, 'Google SDK is not linked'
assert 'PrivacyInfo.xcprivacy in Resources' in project, 'Privacy manifest is not bundled'
assert 'com.ashrafmostafa.anchoros' in project, 'Unexpected bundle identifier'
info = plistlib.loads((app / 'Info.plist').read_bytes())
client = info.get('GIDClientID')
if client:
    schemes = [value for item in info.get('CFBundleURLTypes', []) for value in item.get('CFBundleURLSchemes', [])]
    assert '.'.join(reversed(client.split('.'))) in schemes, 'Google callback scheme does not match the iOS client'
privacy = plistlib.loads((app / 'PrivacyInfo.xcprivacy').read_bytes())
assert any(item['NSPrivacyAccessedAPIType'] == 'NSPrivacyAccessedAPICategoryFileTimestamp' for item in privacy['NSPrivacyAccessedAPITypes'])
ET.parse(root / 'ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme')
for path in app.rglob('*.storyboard'): ET.parse(path)
print('Native source references, Google SDK, OAuth callback, privacy manifest, scheme, and storyboards checked. Swift compilation still requires Xcode.')
