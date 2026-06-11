# Resume Fields Reference (engineering theme)

Resume documents follow the JSON Resume shape, validated by
`schema/resume.schema.json`. This repo's theme (`jsonresume-theme-engineering`)
accepts both legacy and modern field names — prefer the names already used in
`resumes/sample/resume.json` for consistency.

## Sections the theme renders

- `basics`: `name` (required), `label`, `email`, `phone`, `website`, `summary`,
  `location { address, postalCode, city, countryCode, region }`, `profiles[]`.
- `work[]`: `company` (legacy) or `name` (modern), `position`, `website`/`url`,
  `startDate`, `endDate`, `summary`, `highlights[]`.
- `volunteer[]`: `organization`, `position`, `startDate`, `endDate`, `summary`,
  `highlights[]`.
- `education[]`: `institution`, `area`, `studyType`, `location`,
  `specialization`, `startDate`, `endDate`, `gpa`, `courses[]`.
- `skills[]`: `name`, `level`, `keywords[]`.
- `awards[]`: `title`, `date`, `awarder`, `summary`.
- `projects[]`, `languages[]`, `interests[]` — supported, optional.

## Dates

Strings in `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. Omit `endDate` for current roles.

## HTML in text fields

`summary` and `highlights` strings may contain inline HTML — the theme renders
it. The sample uses `<strong>`, `<em>`, and `<a href="...">`. Use sparingly for
emphasis and links; never to fabricate structure.

## Validate before finishing

Always run `npm run validate` after writing a resume document.
