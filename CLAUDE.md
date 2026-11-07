# CLAUDE.md

Working rules for Claude Code in this repository. Read `STATE.md` first; it is the pickup point. Then read the brief in hand.

## Rules

- **`legacy/` never changes.** It is the historical record, bugs included. No edit, tool, setting or script may alter these files, including line-ending rules. Reading them is fine.
- **New rules need the maintainer's endorsement.** Propose a rule; do not land one.
- **Update `STATE.md` at session end**, and keep it under 8 KB.
- **Australian spelling in docs.**
- **Decisions go in `docs/DECISIONS.md`.** One register, one ID per decision, and old entries are replaced, never rewritten.
- **Every brief ends with the maintainer seeing the running game.** Passing tests alone do not close a brief.

## Public repository

- **Nothing is committed or pushed without the maintainer's explicit go-ahead for that change.**
- **Review every file in a commit before making it.** Stage files by name, never with `git add .` or `-A`.
- **No personal information** in files, commit messages or metadata.
- **History is never rewritten.** No force-push, rebase or amend on shared history.
- **Changes go straight to `master`** once local checks pass and the maintainer approves. No pull requests (D-014).

## Briefs

- New briefs follow `docs/briefs/TEMPLATE.md`, and are agreed with the maintainer before building.
- **A brief that changes the data model updates `docs/DATA-MODEL.md`.**
- **Stop and ask** when a decision is not in the brief, or a check changes in a way the brief did not plan.
- Note bugs in `STATE.md` and fix them through a brief, not in passing.
