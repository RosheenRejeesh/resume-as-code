# Import Guide (build master.json from an old CV / LinkedIn)

You can read PDFs and documents directly. Use that to extract a structured
master profile, then confirm with the user.

## Steps

1. **Read the source.** Open the user-provided PDF/DOCX resume or LinkedIn
   "Export" (PDF or the `Profile.pdf`/CSV). Extract every role, project, skill,
   and education entry you can find.
2. **Map to JSON Resume.** Populate `basics`, `work`, `projects`, `skills`,
   `education`, `awards`, `volunteer` per
   `.claude/skills/tailor-resume/references/jsonresume-fields.md`. Use `company`
   and `website` field names to match the repo sample.
3. **Preserve facts exactly.** Copy dates, titles, employers, and metrics
   verbatim from the source. Do NOT round, infer, or upgrade titles.
4. **Flag uncertainty.** If the source is ambiguous (e.g. a missing end date, an
   unclear month), ask the user instead of guessing. Do not use `[VERIFY]` in
   the master — that marker is only for tailored resumes.
5. **Fill gaps by asking.** If sections are thin (few bullets, no summary),
   prompt the user to expand, the same way the interview guide does.

## Finish

Write `profile/master.json`, run `npm run validate`, and show the user a concise
summary of what you imported so they can correct anything.
