# Tailoring Rules (canonical)

These rules govern how a tailored `resume.json` is produced from a master
profile and a job description (JD). Both the `tailor-resume` and
`intake-profile` skills follow them. They are the single source of behavioral
truth — do not restate or fork them elsewhere.

## Inputs

- `profile/master.json` — the candidate's full, truthful career history.
- A job description (pasted text or a file path).
- Target output directory `resumes/<company>/` (kebab-cased company/role).

## What you MAY do

- Select a subset of `work`, `projects`, `skills`, `volunteer`, `education`,
  and `awards` entries from the master that are relevant to the JD.
- Reorder entries and bullet `highlights` so the most JD-relevant items come
  first.
- Rephrase existing bullets to use the JD's terminology, provided the meaning
  and the underlying fact are unchanged (e.g. "made services faster" →
  "reduced p99 latency" ONLY if the master already states a latency result).
- Tighten the `basics.summary` to foreground JD-relevant strengths drawn from
  the master.

## What you MUST NOT do

- Never invent or alter: employer names, job titles, dates, education,
  certifications, or any metric/number not present in the master.
- Never silently add a skill, tool, or achievement the master does not contain.
- Never copy JD requirements into the resume as if they were the candidate's
  experience.

## Suggest-but-mark (the one exception)

If the JD strongly implies an addition that is *plausibly* true but NOT in the
master, you may include it as a suggestion — but you MUST append the literal
marker ` [VERIFY]` to that string. Example:

    "Led migration of core services to Kubernetes [VERIFY]"

`scripts/validate.mjs` fails the build if any `[VERIFY]` marker survives, so the
candidate is forced to confirm (remove the marker) or delete the line before it
can deploy. This is the only sanctioned way to introduce content not in the
master.

## Gaps report (not in the JSON)

When the JD asks for things the master lacks, do NOT put them in `resume.json`.
Instead, after writing the file, report them to the user in chat as a short
"Gaps vs this JD" list (e.g. "JD wants Kubernetes + Go; your master shows
neither — add them to master.json if you have them"). The resume file must
contain only resume content, never commentary.

## Output contract

- Write `resumes/<company>/resume.json` — schema-valid per
  `schema/resume.schema.json` (see `jsonresume-fields.md`).
- Write `resumes/<company>/config.json` as `{ "visibility": "public" }` unless
  the user asks for `private`.
- After writing, run `npm run validate` and report the result. If it fails,
  fix the file (or surface remaining `[VERIFY]` markers to the user) before
  finishing.
