#!/usr/bin/env python3
"""Configure public Google iOS OAuth values at build time; no credentials are required for local-only builds."""
import os
from pathlib import Path
import plistlib
import re

path = Path(__file__).resolve().parents[1] / 'ios/App/App/Info.plist'
client = os.environ.get('GOOGLE_IOS_CLIENT_ID', '').strip()
if client and not re.fullmatch(r'[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com', client):
    raise SystemExit('GOOGLE_IOS_CLIENT_ID must be an iOS OAuth client ID ending in .apps.googleusercontent.com')
with path.open('rb') as stream:
    data = plistlib.load(stream)
if client:
    data['GIDClientID'] = client
    data['CFBundleURLTypes'] = [{'CFBundleTypeRole': 'Editor', 'CFBundleURLSchemes': ['.'.join(reversed(client.split('.')))]}]
with path.open('wb') as stream:
    plistlib.dump(data, stream, sort_keys=False)
print('Google iOS client configured.' if data.get('GIDClientID') else 'Local-only build: Google sign-in is disabled until an iOS OAuth client ID is configured.')
