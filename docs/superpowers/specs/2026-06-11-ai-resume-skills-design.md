# AI Resume Authoring Skills — Design

**Date:** 2026-06-11
**Status:** Approved (design); pending implementation plan
**Repo:** resume-as-code

## Problem

`resume-as-code` is a git-driven multi-resume publisher. A user keeps
`resumes/<name>/resume.json` (JSON Resume schema) plus `config.json`; on push,
GitHub Actions renders HTML via `resumed` + `jsonresume-theme-engineering`,
exports a PDF with Playwright, and deploys each resume to its own
`<name>-resume` repo on GitHub Pages.

There is no authoring help. A user must hand-write `resume.json`, and there is
no support for tailoring a resume to a specific job description (JD) or for
newcomers who have nothing written down yet.

## Goal

Add an **authoring layer** that generates a tailored, structured `resume.json`
from a job description, plus a starter scaffold for people beginning from
scratch. The existing build/deploy pipeline is **not changed**.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Delivery mechanism | **Claude Code Skills only** (CLI explicitly dropped as YAGNI — no automation use case, and tailoring is human-in-the-loop) |
| Source of truth | **`profile/master.json`** = canonical full career history, bootstrapped by interview **or** import of an old PDF/CV/LinkedIn export |
| Tailored output | Each `resumes/<company>/resume.json` is a pruned, JD-ranked **view** of the master |
| Honesty policy | **Suggest-but-mark**: AI may select/reorder/rephrase real content freely; inferred additions must be tagged `[VERIFY]`; dates/employers/titles/education/metrics are never fabricated |
| Logic sharing | One canonical `tailoring-rules.md` referenced by both skills (CLI-ready later, no lock-in) |
| Scaffold | Intake skill, JSON Resume schema + validation, worked example, docs + repo `CLAUDE.md` |

## Architecture

Three planes. The publish plane is the existing CI, untouched.

```
AUTHOR (new)                      VALIDATE (new)             PUBLISH (existing)
─────────────                     ──────────────             ──────────────────
intake-profile ─┐                                            push resumes/**/resume.json
 (interview OR  ├─► profile/master.json ──┐                   → detect-changes
  PDF/CV import)│      (canonical truth)   │                  → build (resumed → HTML → PDF)
                │                          ├─► validate.mjs    → deploy to <co>-resume + Pages
tailor-resume ──┘   + a Job Description ───┘    (schema +
   (Skill)             ──► resumes/<co>/resume.json + config.json   [VERIFY] gate)
```

`master.json` holds the full history (the truth). Each
`resumes/<company>/resume.json` is a tailored selection from it. The build and
deploy scripts and workflow are unchanged.

## File layout (new additions)

```
.claude/skills/
  intake-profile/
    SKILL.md                        # bootstrap profile/master.json
    references/interview-guide.md      # Q&A flow for beginners
    references/import-guide.md         # parse old PDF/CV/LinkedIn → master.json
  tailor-resume/
    SKILL.md                        # JD + master → tailored resume.json
    references/tailoring-rules.md      # ★ canonical behavior (shared by both skills)
    references/jsonresume-fields.md    # field reference + theme-allowed HTML

profile/
  master.json                       # the user's truth (committed in their fork)
  master.example.json               # worked-example input

schema/
  resume.schema.json                # vendored JSON Resume schema
  master.schema.json                # superset of resume schema (e.g. extra-bullets pool)

scripts/
  validate.mjs                      # validate master + every resumes/*/resume.json

examples/
  jd-google-swe.txt                 # sample job description
  expected-resume.json              # tailored output (kept OUT of resumes/ so CI won't deploy it)
  README.md                         # explains the worked example end to end

CLAUDE.md                           # repo conventions for Claude Code
```

`package.json` adds a `"validate"` script and dev dependencies `ajv` +
`ajv-formats`. No AI SDK and no API key are required — the skills run inside
Claude Code.

## Components

### `tailor-resume` skill (primary surface)
- **Input:** a job description (pasted or a file path) and which master profile to use.
- **Output:** `resumes/<company>/resume.json` and `resumes/<company>/config.json`
  (visibility defaults to `public`).
- **Behavior:**
  - Select and rank bullets/skills from `master.json` against the JD.
  - Rephrase selected content toward the JD's language and keywords.
  - Tag any inferred addition with a trailing `[VERIFY]`.
  - Report JD-vs-profile **gaps to the user in chat** — never written into the JSON.
- **What does it do / how used / depends on:** Produces a tailored resume view;
  invoked in Claude Code; depends on `master.json`, `tailoring-rules.md`,
  `jsonresume-fields.md`, and the schema.

### `intake-profile` skill (newcomer scaffold)
- Builds `profile/master.json` two ways:
  - **Interview:** guided Q&A for someone starting from nothing (`interview-guide.md`).
  - **Import:** read an old PDF/CV or LinkedIn export and extract a structured
    master (`import-guide.md`). Claude Code reads PDFs natively, so no PDF
    parsing library is needed.
- **Depends on:** `master.schema.json`, the reference guides.

### `tailoring-rules.md` (canonical behavior)
The single source of behavioral truth, referenced by both skills:
- Use only facts present in `master.json`; select / reorder / rephrase freely.
- May **suggest** inferred additions, but must append `[VERIFY]`; never silent invention.
- Never fabricate or alter dates, employers, titles, education, or metrics.
- Missing JD requirements → gaps report to the user, not bullets in the JSON.
- Preserve JSON Resume schema validity; HTML is allowed in `summary`/`highlights`
  per the engineering theme (documented in `jsonresume-fields.md`).
- Emit `resumes/<co>/config.json` with default `{"visibility":"public"}`.

### `validate.mjs` (machine guardrail, no AI)
- Schema-validates `profile/master.json` against `master.schema.json` and every
  `resumes/*/resume.json` against `resume.schema.json` using `ajv`.
- **Fails if any `[VERIFY]` marker remains** in a `resumes/**/resume.json`.
  Unverified claims therefore cannot deploy — the user must confirm (remove the
  marker) or delete the line first.
- Run via `npm run validate` and in CI before build.

## Data flow

- **Beginner:** `intake-profile` (interview *or* PDF/CV import) → `master.json`
  → `npm run validate` → `tailor-resume <JD>` → `resumes/<co>/resume.json` →
  resolve any `[VERIFY]` → push → existing CI builds and deploys.
- **Returning:** edit `master.json` once → run `tailor-resume` per new JD.

## Error handling

- `validate.mjs` exits non-zero with a readable message on schema violations or
  leftover `[VERIFY]` markers; CI fails the build before any deploy.
- `tailor-resume` writes JSON that is schema-valid by construction and reports
  gaps separately so the resume file never contains commentary.
- `intake-profile` import: if a source field is ambiguous or missing, the skill
  asks the user rather than guessing protected fields (dates/titles).

## Testing

- **`validate.mjs`:** unit tests with fixtures — valid, schema-invalid, and
  contains-`[VERIFY]` — asserting exit codes and messages.
- **Worked example as golden path:** `master.example.json` +
  `examples/jd-google-swe.txt` produce `examples/expected-resume.json`, which
  must pass `validate.mjs` (schema-valid, no `[VERIFY]` left).
- **Skills:** verified through the committed worked example and a manual
  Codespaces run; `SKILL.md` files kept minimal and declarative.
- **CI:** add a `validate` job that runs on pull requests and before `build`.

## CI changes

Add a `validate` job to `.github/workflows/ci.yml` that runs `npm ci` then
`npm run validate`, gating the existing `build` job. The `build`, `deploy`, and
`delete` jobs and all scripts under `scripts/` (except the new `validate.mjs`)
are unchanged.

## Build order (each step shippable)

1. `schema/` + `validate.mjs` + `npm run validate` + CI validate step *(no AI)*.
2. `tailoring-rules.md` + `jsonresume-fields.md` (canonical logic).
3. `tailor-resume` skill (primary).
4. `intake-profile` skill (interview + PDF/CV/LinkedIn import).
5. Worked example (`profile/master.example.json`, `examples/*`) + README "AI
   Authoring" section + `CLAUDE.md`.
6. `[VERIFY]` deploy-gate in `validate.mjs` + tests.

## Out of scope (YAGNI)

- A Node/CLI tailoring tool and any Anthropic SDK / API-key handling — dropped;
  `tailoring-rules.md` stays standalone so a thin CLI can be added later if a
  real automation need appears.
- AI generation inside CI.
- Changing the theme, build, deploy, or delete pipeline.
