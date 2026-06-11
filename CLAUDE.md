# CLAUDE.md — resume-as-code conventions

This repo is a git-driven multi-resume publisher. AI authoring sits on top of it
and must not change the build/deploy pipeline.

## Source of truth

- `profile/master.json` is the candidate's full, truthful history. It is the
  ONLY place facts originate.
- Each `resumes/<company>/resume.json` is a tailored, JD-ranked VIEW of the
  master. Tailored resumes are derived, never the source.

## Skills

- `intake-profile` — build `profile/master.json` (interview or import a PDF/CV/
  LinkedIn export).
- `tailor-resume` — turn a JD + the master into `resumes/<company>/resume.json`.
- Canonical behavior lives in
  `.claude/skills/tailor-resume/references/tailoring-rules.md`. Read it before
  editing resume content.

## Honesty policy (enforced)

- Never fabricate employers, titles, dates, education, or metrics.
- Plausible-but-unconfirmed additions must be tagged ` [VERIFY]`.
- `npm run validate` fails on schema errors and on any surviving `[VERIFY]`
  marker, so unverified claims cannot deploy.

## Layout

- `schema/resume.schema.json` — validation schema (lenient; accepts legacy
  `company`/`website` and modern `name`/`url`).
- `scripts/validate.mjs` + `scripts/lib/` — validator (run `npm run validate`).
- `scripts/build-resume.sh`, `scripts/deploy-resume.sh`,
  `scripts/delete-repo.sh`, `.github/workflows/ci.yml` — the publish pipeline.
  Do not modify when working on authoring features.

## Before finishing any resume change

Run `npm run validate` and `npm test`.
