# soHelper

Desktop tracker for daily quests in Stay Out. Each character keeps its own take
history, so the same quest can be on cooldown for one and available for another.

Cooldowns run from the moment you take a quest, not from finishing it. Record a
take with one click, or backfill the exact time if you forgot.

## Stack

Electron + React + TypeScript, built with electron-vite. Data lives in SQLite
via Node's built-in `node:sqlite` — no native modules, nothing to rebuild.

## Development

```sh
make install    # dependencies
make dev        # dev server with HMR
make check      # typecheck + data-layer tests
make            # list every target
```

Type checking is a separate step: Vite strips types, it does not verify them.
`make check` runs as a prerequisite of every packaging target.

## Packaging

```sh
make win        # single .exe (x64) — the only shipped platform
make mac        # .dmg + .zip, local testing only, never published
make dist       # both
```

The Windows build is a one-click installer: running it installs to
`%LOCALAPPDATA%` without a wizard or an admin prompt, then launches the app. It
is not a portable executable — `electron-updater` needs an installer to replace
files with, so a portable build could never update itself.

Builds are unsigned, so Windows shows a SmartScreen warning the first time.

## Releases

```sh
make bump                    # 0.0.1 -> 0.0.2 in package.json
git commit -am "Release 0.0.2"
make release                 # build Windows, upload all assets as a draft
gh release edit v0.0.2 --draft=false -R DamianGierlowski/SoHelper
```

The upload lands as a **draft**. Until it is published, `electron-updater`
cannot see it. Bumping the version is not optional either — the updater
compares against `package.json`, so re-releasing the same version reaches
nobody.

Releases are Windows-only, and so is auto-update. macOS builds stay local: they
are useful for checking the packaged app, but shipping them would mean buying an
Apple Developer certificate, since Squirrel.Mac verifies the code signature that
an unsigned build lacks.
