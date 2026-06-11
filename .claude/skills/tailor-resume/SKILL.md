---
name: tailor-resume
description: Use when tailoring a resume to a specific job description — reads profile/master.json plus a JD and writes a pruned, JD-ranked resumes/<company>/resume.json with a suggest-but-mark [VERIFY] honesty policy. Triggers on "tailor my resume", "resume for this job", "apply to <company>".
---

# Tailor Resume

Turn a job description into a tailored resume that is a faithful, JD-ranked view
of the candidate's master profile.

## Required reading

Before producing anything, read these and follow them exactly:
- `.claude/skills/tailor-resume/references/tailoring-rules.md` (canonical behavior)
- `.claude/skills/tailor-resume/references/jsonresume-fields.md` (field shapes)

## Steps

1. **Locate the master.** Read `profile/master.json`. If it does not exist, stop
   and tell the user to run the `intake-profile` skill first.
2. **Get the JD.** Accept pasted text or a file path. Identify the target
   company/role and the key requirements (skills, seniority, domain, keywords).
3. **Pick a target folder.** `resumes/<company>/` using a kebab-cased
   company-or-role name (e.g. `resumes/google/`). Confirm the name with the user
   if ambiguous.
4. **Select & rank.** Choose the master entries (`work`, `projects`, `skills`,
   etc.) most relevant to the JD; reorder so the strongest JD-relevant items lead.
5. **Rephrase truthfully.** Rewrite selected bullets toward the JD's language
   without changing facts. Apply the suggest-but-mark `[VERIFY]` rule for any
   plausible-but-unconfirmed addition.
6. **Write the files.** Create `resumes/<company>/resume.json` and
   `resumes/<company>/config.json` (`{ "visibility": "public" }` by default).
7. **Validate.** Run `npm run validate`. Fix schema errors. If `[VERIFY]`
   markers remain, list each to the user and explain they must confirm or delete
   before pushing.
8. **Report gaps.** In chat, give a short "Gaps vs this JD" list of JD
   requirements absent from the master — never write these into the resume.

## Done when

`resumes/<company>/resume.json` exists, `npm run validate` passes (or the only
blockers are `[VERIFY]` markers explicitly surfaced to the user), and the gaps
report has been delivered.
