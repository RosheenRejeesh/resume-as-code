# Worked Example

This folder shows the AI authoring flow end to end with sample data.

- `../profile/master.example.json` — a candidate's full career history (the
  source of truth the `intake-profile` skill produces).
- `jd-google-swe.txt` — a sample job description.
- `expected-resume.json` — the tailored resume the `tailor-resume` skill is
  expected to produce from the master for that JD: backend/distributed-systems
  work and skills are selected and ranked first, an unrelated volunteer entry
  and the "Web Development" skill bucket are dropped, and a latency bullet is
  rephrased to match the JD ("reduced p99 latency") — all still backed by the
  master. No facts are invented, so there are no `[VERIFY]` markers.

`expected-resume.json` lives here, not under `resumes/`, so the deploy workflow
(which triggers on `resumes/**/resume.json`) never publishes the example. It is
validated by `npm run validate`.

## Try it

In Claude Code: run the `tailor-resume` skill, point it at
`profile/master.example.json` and `examples/jd-google-swe.txt`, and compare its
output to `expected-resume.json`.
