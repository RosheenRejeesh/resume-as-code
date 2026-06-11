---
name: intake-profile
description: Use when a user has no profile/master.json yet and needs to create one — bootstraps the canonical master profile either by interviewing the user (no existing resume) or by importing an old PDF/CV/LinkedIn export. Triggers on "set up my resume", "I'm starting from scratch", "import my old CV".
---

# Intake Profile

Produce `profile/master.json`: the candidate's full, truthful career history in
JSON Resume shape. This is the source of truth the `tailor-resume` skill draws
from.

## Choose a path

Ask the user which they have:
- **Nothing written down** → follow
  `.claude/skills/intake-profile/references/interview-guide.md`.
- **An old resume/CV (PDF or DOCX) or a LinkedIn export** → follow
  `.claude/skills/intake-profile/references/import-guide.md`.

## Rules

- Capture the FULL history (every role, project, skill) — `master.json` is the
  superset; tailoring prunes later. Bias toward including more.
- Record only what the user actually did. Do not embellish. If a detail is
  unclear (a date, a title), ask rather than guess.
- Match the field shapes in
  `.claude/skills/tailor-resume/references/jsonresume-fields.md`.
- The honesty policy in
  `.claude/skills/tailor-resume/references/tailoring-rules.md` also applies:
  record only real facts, and never use `[VERIFY]` in the master — that marker
  is only for tailored resumes.

## Finish

1. Write `profile/master.json`.
2. Run `npm run validate`. Fix any schema errors.
3. Tell the user the master is ready and they can now run `tailor-resume` with a
   job description.
