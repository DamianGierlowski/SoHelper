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
make mac        # .dmg + .zip (arm64, x64)
make win        # NSIS installer + .zip (x64)
make dist       # both
```

Builds are unsigned. macOS will refuse a downloaded build until the quarantine
flag is cleared (`xattr -dr com.apple.quarantine soHelper.app`); Windows shows a
SmartScreen warning.

## Releases

```sh
make bump                    # 0.0.1 -> 0.0.2 in package.json
git commit -am "Release 0.0.2"
make release                 # build both platforms, upload as a draft
gh release edit v0.0.2 --draft=false -R DamianGierlowski/SoHelper
```

The upload lands as a **draft**. Until it is published, `electron-updater`
cannot see it. Bumping the version is not optional either — the updater
compares against `package.json`, so re-releasing the same version reaches
nobody.

Auto-update is full on Windows. On macOS it only notifies and links to the
downloads page — Squirrel.Mac verifies the code signature, which an unsigned
build does not have.
