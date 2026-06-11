# Worked Example

This folder shows the AI authoring flow end to end with sample data.

- `../profile/master.example.json` — a candidate's full career history (the
  source of truth the `intake-profile` skill produces).
- `jd-google-swe.txt` — a sample job description.
- `expected-resume.json` — the tailored resume the `tailor-resume` skill is
  expected to produce from the master for that JD. The tailoring:
  - keeps and ranks the backend/distributed-systems work first, and **drops**
    the junior third role (2012–2013 Hooli Software Engineer) that adds little
    for a senior backend JD;
  - keeps the **Backend** and **Distributed Systems** skill buckets and **drops**
    the unrelated **Web Development** and **Compression** buckets;
  - drops the **CoderDojo volunteer** and **awards** entries;
  - trims less-relevant education detail (GPA, specialization, courses);
  - sharpens `basics.label` from "Software Engineer" to "Backend Software
    Engineer" — a headline change supported by the master's own
    "backend-leaning" summary (note: this is the freeform headline, **not** an
    employer-granted job title; `position` fields are copied verbatim and never
    altered);
  - rephrases one latency bullet's verb ("Cut" → "Reduced") without changing the
    numbers;
  - applies light inline `<strong>` emphasis to JD keywords (e.g. `Go`) in the
    summary and a highlight — styling only, no fact change.

  Every fact traces back to the master — nothing is invented — so there are no
  `[VERIFY]` markers.

`expected-resume.json` lives here, not under `resumes/`, so the deploy workflow
(which triggers on `resumes/**/resume.json`) never publishes the example. It is
validated by `npm run validate`.

## Try it

In Claude Code: run the `tailor-resume` skill, point it at
`profile/master.example.json` and `examples/jd-google-swe.txt`, and compare its
output to `expected-resume.json`.
