# Brief S1 — Preserve 2019

**Status:** draft.
**Read first:** `STATE.md`, D-002, D-003 and D-012.
**Goal:** a visitor sees The New Frontier and can reach the untouched 2019 game in one click.

## Why now

The repository holds one commit from 2019 and no licence. Everything else builds on it, so the original must be safe first.

## Scope

**In:** a verified offline backup; tag `v0-2019` on commit `5c863cf`; `legacy/` holding all 15 files unchanged; `legacy/README.md`; root `README.md`; `LICENSE`, `NOTICE`; governance files.
**Out:** fixing `ge.c` (never); prototypes and project structure (S2); the finished public page (S6).

## Plan

1. Make a mirror backup, restore it elsewhere, and compare every hash.
2. Set the local commit identity, and confirm it before committing.
3. Build on a local branch. Show the exact file list and full diff for approval.
4. Push only after explicit approval of that diff.

## Done means

1. `git tag` shows `v0-2019`, pointing at `5c863cf`.
2. Every moved file matches its 2019 hash byte for byte.
3. The 2019 commit is an ancestor of the default branch, and `git push` was never forced.
4. The maintainer has reviewed the live page and followed the link to the tag.

## Stop and ask if

- Any step would rewrite history or needs a force-push.
- A file in the commit was not in the approved list.

## Outcome (builder fills in)
