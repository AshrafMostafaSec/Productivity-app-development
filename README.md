# AnchorOS

A personal productivity app for routines, university work, prayer, focus, and daily spending. The interface is based on the supplied Figma Make export.

## Current status

- Working React/TypeScript prototype with local device storage.
- Standalone Vite build, Capacitor iOS host, and GitHub Actions build workflows.
- Google sign-in, cloud backup, and restore are **planned, not connected yet**.
- App Shield and the floating focus pill are currently in-app simulations. They do not block other iPhone apps or create an iOS Live Activity.

## Run locally

Use Node 24 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Check TypeScript and build production assets:

```sh
pnpm check
```

On a Mac with Xcode 26 or newer:

```sh
pnpm ios:sync
pnpm ios:open
```

## Builds

- **Web CI** checks TypeScript and uploads the web build on pull requests and main pushes.
- **iOS build** uses a macOS runner to build an unsigned device app and uploads `AnchorOS-unsigned.ipa`. It runs on pull requests/main pushes and can be started manually.
- The unsigned IPA requires compatible signing and provisioning before installation on a real iPhone. This repository does not yet provide a signed release workflow.

## Development guide

- [Project review](docs/PROJECT_REVIEW.md): what exists and what needs work.
- [iOS and Google backup plan](docs/IOS_AND_BACKUP_PLAN.md): target architecture, restore, milestones, and acceptance criteria.
- [Setup](docs/SETUP.md): Google configuration and Apple signing requirements.
- [Architecture](docs/ARCHITECTURE.md): current state flow and design rules.
- [Progress](docs/PROGRESS.md): completed work and next steps for future sessions.

Personal backups, OAuth tokens, Apple certificates, and provisioning profiles must stay out of source control and Actions artifacts.
