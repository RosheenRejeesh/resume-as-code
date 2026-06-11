# AI Resume Authoring Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Claude Code skill–based authoring layer that turns a job description into a tailored, schema-valid `resume.json`, plus a machine-enforced honesty gate and a starter scaffold — without touching the existing build/deploy pipeline.

**Architecture:** A canonical `profile/master.json` (full career history) is the source of truth. The `intake-profile` skill bootstraps it (interview or PDF/CV/LinkedIn import). The `tailor-resume` skill reads it plus a JD and writes `resumes/<company>/resume.json` as a pruned, ranked view, marking any inferred addition `[VERIFY]`. A dependency-free-ish `validate.mjs` (uses `ajv`) schema-checks every resume document and fails if any `[VERIFY]` marker survives, so unverified claims cannot deploy. CI gains a validate gate; build/deploy/delete are unchanged.

**Tech Stack:** Node 22 (ESM `.mjs`), `ajv` + `ajv-formats` (validation), `node:test` (tests), JSON Resume schema, Claude Code Skills (`.claude/skills/`), existing `resumed` + `jsonresume-theme-engineering` + Playwright pipeline.

**Plan-level refinements from the spec (intentional):**
- No separate `master.schema.json`; `master.json` validates against `resume.schema.json` (it is simply a fuller JSON Resume document).
- `schema/resume.schema.json` is hand-authored and lenient (accepts both legacy `company`/`website` and modern `name`/`url`) so the existing `resumes/sample/resume.json` and the engineering theme keep working.
- The `[VERIFY]` gate applies to every validated document (stricter than "resumes only" — a marker should never survive anywhere).

---

## File Structure

**Create:**
- `schema/resume.schema.json` — lenient JSON Schema (draft-07) for resume documents.
- `scripts/lib/validate-core.mjs` — pure validation functions (schema compile, document validate, `[VERIFY]` scan).
- `scripts/lib/validate-core.test.mjs` — unit tests for the core.
- `scripts/validate.mjs` — CLI: collects resume documents, validates, prints, sets exit code.
- `.github/workflows/validate.yml` — PR/dispatch validation gate.
- `.claude/skills/tailor-resume/SKILL.md` — JD + master → tailored resume.
- `.claude/skills/tailor-resume/references/tailoring-rules.md` — canonical behavior (shared by both skills).
- `.claude/skills/tailor-resume/references/jsonresume-fields.md` — field reference + theme-allowed HTML.
- `.claude/skills/intake-profile/SKILL.md` — bootstrap `master.json`.
- `.claude/skills/intake-profile/references/interview-guide.md` — Q&A flow.
- `.claude/skills/intake-profile/references/import-guide.md` — PDF/CV/LinkedIn extraction.
- `profile/master.example.json` — worked-example master.
- `examples/jd-google-swe.txt` — sample JD.
- `examples/expected-resume.json` — tailored output (kept out of `resumes/` so CI won't deploy it).
- `examples/README.md` — walks the example end to end.
- `CLAUDE.md` — repo conventions for Claude Code.

**Modify:**
- `package.json` — add `validate` + `test` scripts and `ajv`/`ajv-formats` devDependencies.
- `.github/workflows/ci.yml` — add a `validate` job; make `build` depend on it.
- `README.md` — add an "AI Authoring" section.

---

## Task 1: Project deps + resume JSON Schema

**Files:**
- Create: `schema/resume.schema.json`
- Modify: `package.json`

- [ ] **Step 1: Add scripts and dev dependencies to `package.json`**

Replace the file contents with (keeps existing scripts; adds `validate`, `test`, and dev deps; does NOT add `"type": "module"` because `export-pdf.js` is CommonJS — our new files use the `.mjs` extension instead):

```json
{
  "dependencies": {
    "jsonresume-theme-engineering": "^0.3.1",
    "playwright": "^1.54.1",
    "resumed": "^6.0.0"
  },
  "devDependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1"
  },
  "scripts": {
    "export-html": "npx resumed render $FILE_PATH/resume.json --output $FILE_PATH/index.html --theme jsonresume-theme-engineering",
    "export-pdf": "node export-pdf.js $FILE_PATH",
    "validate": "node scripts/validate.mjs",
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `package-lock.json` updates; `node_modules/ajv` and `node_modules/ajv-formats` present. No errors.

- [ ] **Step 3: Create `schema/resume.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://resume-as-code/schema/resume.schema.json",
  "title": "Resume (engineering-theme compatible)",
  "type": "object",
  "required": ["basics"],
  "additionalProperties": true,
  "definitions": {
    "isoDate": {
      "type": "string",
      "pattern": "^[0-9]{4}(-[0-9]{2})?(-[0-9]{2})?$"
    },
    "stringArray": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "properties": {
    "basics": {
      "type": "object",
      "required": ["name"],
      "additionalProperties": true,
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "label": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "phone": { "type": "string" },
        "website": { "type": "string" },
        "url": { "type": "string" },
        "summary": { "type": "string" },
        "location": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "address": { "type": "string" },
            "postalCode": { "type": "string" },
            "city": { "type": "string" },
            "countryCode": { "type": "string" },
            "region": { "type": "string" }
          }
        },
        "profiles": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true,
            "properties": {
              "network": { "type": "string" },
              "username": { "type": "string" },
              "url": { "type": "string" }
            }
          }
        }
      }
    },
    "work": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "company": { "type": "string" },
          "name": { "type": "string" },
          "position": { "type": "string" },
          "website": { "type": "string" },
          "url": { "type": "string" },
          "startDate": { "$ref": "#/definitions/isoDate" },
          "endDate": { "$ref": "#/definitions/isoDate" },
          "summary": { "type": "string" },
          "highlights": { "$ref": "#/definitions/stringArray" }
        }
      }
    },
    "volunteer": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "organization": { "type": "string" },
          "position": { "type": "string" },
          "url": { "type": "string" },
          "startDate": { "$ref": "#/definitions/isoDate" },
          "endDate": { "$ref": "#/definitions/isoDate" },
          "summary": { "type": "string" },
          "highlights": { "$ref": "#/definitions/stringArray" }
        }
      }
    },
    "education": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "institution": { "type": "string" },
          "area": { "type": "string" },
          "studyType": { "type": "string" },
          "location": { "type": "string" },
          "specialization": { "type": "string" },
          "startDate": { "$ref": "#/definitions/isoDate" },
          "endDate": { "$ref": "#/definitions/isoDate" },
          "gpa": { "type": "string" },
          "score": { "type": "string" },
          "courses": { "$ref": "#/definitions/stringArray" }
        }
      }
    },
    "skills": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "name": { "type": "string" },
          "level": { "type": "string" },
          "keywords": { "$ref": "#/definitions/stringArray" }
        }
      }
    },
    "awards": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "title": { "type": "string" },
          "date": { "$ref": "#/definitions/isoDate" },
          "awarder": { "type": "string" },
          "summary": { "type": "string" }
        }
      }
    },
    "projects": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "url": { "type": "string" },
          "keywords": { "$ref": "#/definitions/stringArray" },
          "highlights": { "$ref": "#/definitions/stringArray" },
          "startDate": { "$ref": "#/definitions/isoDate" },
          "endDate": { "$ref": "#/definitions/isoDate" }
        }
      }
    },
    "languages": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "language": { "type": "string" },
          "fluency": { "type": "string" }
        }
      }
    },
    "interests": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": true,
        "properties": {
          "name": { "type": "string" },
          "keywords": { "$ref": "#/definitions/stringArray" }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json schema/resume.schema.json
git commit -m "feat: add resume JSON schema and validation deps"
```

---

## Task 2: Validation core (TDD)

**Files:**
- Create: `scripts/lib/validate-core.mjs`
- Test: `scripts/lib/validate-core.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/lib/validate-core.test.mjs`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  createValidator,
  validateDocument,
  findVerifyMarkers,
} from "./validate-core.mjs"

const schema = {
  type: "object",
  required: ["basics"],
  additionalProperties: true,
  properties: {
    basics: {
      type: "object",
      required: ["name"],
      additionalProperties: true,
      properties: { name: { type: "string", minLength: 1 } },
    },
  },
}

test("validateDocument passes a valid doc", () => {
  const validate = createValidator(schema)
  const res = validateDocument(validate, { basics: { name: "Ada" } })
  assert.equal(res.valid, true)
  assert.deepEqual(res.errors, [])
})

test("validateDocument fails when a required field is missing", () => {
  const validate = createValidator(schema)
  const res = validateDocument(validate, { basics: {} })
  assert.equal(res.valid, false)
  assert.ok(res.errors.length > 0)
})

test("findVerifyMarkers finds a nested marker with its path", () => {
  const doc = {
    basics: { name: "Ada" },
    work: [{ highlights: ["Shipped X", "Led K8s migration [VERIFY]"] }],
  }
  assert.deepEqual(findVerifyMarkers(doc), ["work[0].highlights[1]"])
})

test("findVerifyMarkers returns empty for a clean doc", () => {
  assert.deepEqual(findVerifyMarkers({ basics: { name: "Ada" }, work: [] }), [])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/lib/validate-core.test.mjs`
Expected: FAIL — `Cannot find module './validate-core.mjs'` (file does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/validate-core.mjs`:

```js
import Ajv from "ajv"
import addFormats from "ajv-formats"

// Compile a JSON schema into a reusable validator function.
export function createValidator(schema) {
  const ajv = new Ajv({ allErrors: true, strict: false })
  addFormats(ajv)
  return ajv.compile(schema)
}

// Validate a document; return { valid, errors } with human-readable messages.
export function validateDocument(validate, doc) {
  const valid = validate(doc)
  if (valid) return { valid: true, errors: [] }
  const errors = (validate.errors || []).map((e) => {
    const where = e.instancePath || "(root)"
    return `${where} ${e.message}`
  })
  return { valid: false, errors }
}

// Recursively collect dotted paths of any string containing the [VERIFY] marker.
export function findVerifyMarkers(value, path = "") {
  const hits = []
  if (typeof value === "string") {
    if (value.includes("[VERIFY]")) hits.push(path || "(root)")
  } else if (Array.isArray(value)) {
    value.forEach((item, i) =>
      hits.push(...findVerifyMarkers(item, `${path}[${i}]`))
    )
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      hits.push(...findVerifyMarkers(v, path ? `${path}.${k}` : k))
    }
  }
  return hits
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/lib/validate-core.test.mjs`
Expected: PASS — 4 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/validate-core.mjs scripts/lib/validate-core.test.mjs
git commit -m "feat: add resume validation core with [VERIFY] scan"
```

---

## Task 3: Validation CLI

**Files:**
- Create: `scripts/validate.mjs`

- [ ] **Step 1: Write the CLI**

Create `scripts/validate.mjs`:

```js
#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import {
  createValidator,
  validateDocument,
  findVerifyMarkers,
} from "./lib/validate-core.mjs"

const ROOT = process.cwd()
const SCHEMA_PATH = path.join(ROOT, "schema", "resume.schema.json")

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

// Every resume-shaped document we want to keep valid.
function collectFiles() {
  const files = []
  const resumesDir = path.join(ROOT, "resumes")
  if (fs.existsSync(resumesDir)) {
    for (const entry of fs.readdirSync(resumesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const f = path.join(resumesDir, entry.name, "resume.json")
      if (fs.existsSync(f)) files.push(f)
    }
  }
  for (const extra of [
    path.join(ROOT, "profile", "master.json"),
    path.join(ROOT, "profile", "master.example.json"),
    path.join(ROOT, "examples", "expected-resume.json"),
  ]) {
    if (fs.existsSync(extra)) files.push(extra)
  }
  return files
}

function main() {
  const validate = createValidator(readJson(SCHEMA_PATH))
  const files = collectFiles()

  if (files.length === 0) {
    console.log("No resume documents found to validate.")
    return 0
  }

  let failed = 0
  for (const file of files) {
    const rel = path.relative(ROOT, file)
    let doc
    try {
      doc = readJson(file)
    } catch (err) {
      console.error(`✗ ${rel}: invalid JSON — ${err.message}`)
      failed++
      continue
    }

    const { valid, errors } = validateDocument(validate, doc)
    const markers = findVerifyMarkers(doc)

    if (valid && markers.length === 0) {
      console.log(`✓ ${rel}`)
      continue
    }

    failed++
    for (const e of errors) console.error(`✗ ${rel}: ${e}`)
    for (const m of markers) {
      console.error(
        `✗ ${rel}: unresolved [VERIFY] at ${m} — confirm the claim and remove the marker, or delete the line`
      )
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} document(s) failed validation.`)
    return 1
  }
  console.log(`\nAll ${files.length} document(s) valid.`)
  return 0
}

process.exit(main())
```

- [ ] **Step 2: Run validation against the existing sample**

Run: `npm run validate`
Expected: PASS — prints `✓ resumes/sample/resume.json` then `All 1 document(s) valid.` and exits 0. (Only the sample exists at this point; example files arrive in Task 8.)

- [ ] **Step 3: Manually confirm the `[VERIFY]` gate fails a bad document**

Run:
```bash
mkdir -p /tmp/verify-check && printf '%s' '{"basics":{"name":"T"},"work":[{"company":"X","highlights":["did thing [VERIFY]"]}]}' > resumes/_verifytmp/resume.json 2>/dev/null || (mkdir -p resumes/_verifytmp && printf '%s' '{"basics":{"name":"T"},"work":[{"company":"X","highlights":["did thing [VERIFY]"]}]}' > resumes/_verifytmp/resume.json); npm run validate; echo "exit=$?"
```
Expected: prints `✗ resumes/_verifytmp/resume.json: unresolved [VERIFY] at work[0].highlights[0] ...`, then `exit=1`.

- [ ] **Step 4: Remove the temporary fixture and reconfirm green**

Run: `rm -rf resumes/_verifytmp && npm run validate; echo "exit=$?"`
Expected: `✓ resumes/sample/resume.json`, `All 1 document(s) valid.`, `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate.mjs
git commit -m "feat: add validate CLI gating schema and [VERIFY] markers"
```

---

## Task 4: CI validation gate

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/validate.yml`

- [ ] **Step 1: Add a `validate` job to `ci.yml` and make `build` depend on it**

In `.github/workflows/ci.yml`, insert this job immediately after the `detect-changes` job (before `build:`):

```yaml
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: npm ci
      - name: Validate resume documents
        run: npm run validate
      - name: Run unit tests
        run: npm test
```

Then change the `build` job's dependency line from:

```yaml
  build:
    runs-on: ubuntu-latest
    needs: detect-changes
```

to:

```yaml
  build:
    runs-on: ubuntu-latest
    needs: [detect-changes, validate]
```

Leave the `build` job's `if:` condition, and the `deploy` and `delete` jobs, unchanged.

- [ ] **Step 2: Create the PR/dispatch gate `validate.yml`**

`ci.yml` only triggers on pushes that change `resume.json`/`config.json`, so add a standalone workflow that validates on pull requests (and manual dispatch), catching bad `master.json`/schema even when no resume changed. Create `.github/workflows/validate.yml`:

```yaml
name: Validate Resumes

on:
  pull_request:
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        run: npm ci
      - name: Validate resume documents
        run: npm run validate
      - name: Run unit tests
        run: npm test
```

- [ ] **Step 3: Lint the workflow YAML locally**

Run: `node -e "const f=require('fs');for(const p of ['.github/workflows/ci.yml','.github/workflows/validate.yml']){f.readFileSync(p,'utf8')}; console.log('files readable')"`
Expected: prints `files readable`. (Confirms the files exist and are readable; full YAML parsing is validated by GitHub on push.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/validate.yml
git commit -m "ci: gate build on resume validation and add PR validate workflow"
```

---

## Task 5: Canonical tailoring logic

**Files:**
- Create: `.claude/skills/tailor-resume/references/tailoring-rules.md`
- Create: `.claude/skills/tailor-resume/references/jsonresume-fields.md`

- [ ] **Step 1: Create `tailoring-rules.md`**

```markdown
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
```

- [ ] **Step 2: Create `jsonresume-fields.md`**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/tailor-resume/references/tailoring-rules.md .claude/skills/tailor-resume/references/jsonresume-fields.md
git commit -m "docs: add canonical tailoring rules and field reference"
```

---

## Task 6: `tailor-resume` skill

**Files:**
- Create: `.claude/skills/tailor-resume/SKILL.md`

- [ ] **Step 1: Create `SKILL.md`**

```markdown
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
```

- [ ] **Step 2: Verify the skill file parses (frontmatter present)**

Run: `node -e "const s=require('fs').readFileSync('.claude/skills/tailor-resume/SKILL.md','utf8'); if(!s.startsWith('---')) throw new Error('missing frontmatter'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/tailor-resume/SKILL.md
git commit -m "feat: add tailor-resume skill"
```

---

## Task 7: `intake-profile` skill

**Files:**
- Create: `.claude/skills/intake-profile/SKILL.md`
- Create: `.claude/skills/intake-profile/references/interview-guide.md`
- Create: `.claude/skills/intake-profile/references/import-guide.md`

- [ ] **Step 1: Create `SKILL.md`**

```markdown
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

## Finish

1. Write `profile/master.json`.
2. Run `npm run validate`. Fix any schema errors.
3. Tell the user the master is ready and they can now run `tailor-resume` with a
   job description.
```

- [ ] **Step 2: Create `interview-guide.md`**

```markdown
# Interview Guide (build master.json from scratch)

Ask one topic at a time. Keep it conversational; don't dump every question at
once. Fill `profile/master.json` as you go.

## Order

1. **Basics** — full name, professional label/title, email, phone, website,
   city + country, any profile links (GitHub, LinkedIn).
2. **Summary** — 2–3 sentences: who they are professionally and their focus.
3. **Work** — for each role (most recent first): company, position, start/end
   dates (YYYY-MM), and 2–5 concrete accomplishments. Push for specifics:
   numbers, scale, impact, technologies. One role at a time.
4. **Projects** (optional) — name, what it does, their role, tech, links.
5. **Skills** — group into named buckets (e.g. "Backend", "Cloud") with
   keywords and an honest level.
6. **Education** — institution, area, study type, dates, notable courses/GPA.
7. **Awards / Volunteer** (optional) — title/org, date, one-line summary.

## Quality bar

- Prefer outcome-driven bullets ("cut build time 40%") over duties ("responsible
  for builds").
- Never invent metrics. If they don't know a number, leave it qualitative.
- Capture everything now; relevance is decided later during tailoring.
```

- [ ] **Step 3: Create `import-guide.md`**

```markdown
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
```

- [ ] **Step 4: Verify the skill file parses**

Run: `node -e "const s=require('fs').readFileSync('.claude/skills/intake-profile/SKILL.md','utf8'); if(!s.startsWith('---')) throw new Error('missing frontmatter'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/intake-profile/
git commit -m "feat: add intake-profile skill with interview and import guides"
```

---

## Task 8: Worked example

**Files:**
- Create: `profile/master.example.json`
- Create: `examples/jd-google-swe.txt`
- Create: `examples/expected-resume.json`
- Create: `examples/README.md`

- [ ] **Step 1: Create `profile/master.example.json` (a fuller history than the sample)**

```json
{
  "basics": {
    "name": "Richard Hendricks",
    "label": "Software Engineer",
    "email": "richard.hendricks@example.com",
    "phone": "(+1) 555-0100",
    "website": "https://richardhendricks.example.com",
    "summary": "Backend-leaning software engineer with experience in distributed systems, data compression, and high-throughput services.",
    "location": {
      "city": "Palo Alto",
      "countryCode": "US",
      "region": "CA"
    },
    "profiles": [
      { "network": "GitHub", "username": "rhendricks", "url": "https://github.com/rhendricks" }
    ]
  },
  "work": [
    {
      "company": "Pied Piper",
      "position": "Founding Engineer",
      "website": "https://piedpiper.example.com",
      "startDate": "2014-04",
      "summary": "Built a distributed lossless compression platform from zero to production.",
      "highlights": [
        "Designed a sharded storage layer in Go handling 50k requests/sec",
        "Cut p99 API latency from 800ms to 120ms by redesigning the hot path",
        "Built a copyright-detection algorithm used by independent artists"
      ]
    },
    {
      "company": "Hooli",
      "position": "Senior Software Engineer",
      "website": "https://hooli.example.com",
      "startDate": "2013-06",
      "endDate": "2014-04",
      "highlights": [
        "Optimized backend search indexing, reducing reindex time by 35%",
        "Mentored three junior engineers through onboarding"
      ]
    },
    {
      "company": "Hooli",
      "position": "Software Engineer",
      "startDate": "2012-01",
      "endDate": "2013-06",
      "highlights": [
        "Shipped bugfixes and features across the Java services platform",
        "Wrote the team's first integration test suite"
      ]
    }
  ],
  "projects": [
    {
      "name": "Middle-Out",
      "description": "Open-source compression library",
      "url": "https://github.com/rhendricks/middle-out",
      "keywords": ["Go", "Compression", "CLI"],
      "highlights": ["1.2k GitHub stars", "Used in three production pipelines"]
    }
  ],
  "skills": [
    { "name": "Backend", "level": "Advanced", "keywords": ["Go", "Java", "gRPC", "PostgreSQL"] },
    { "name": "Distributed Systems", "level": "Advanced", "keywords": ["Sharding", "Caching", "Load balancing"] },
    { "name": "Web Development", "level": "Intermediate", "keywords": ["HTML", "CSS", "JavaScript"] },
    { "name": "Compression", "level": "Expert", "keywords": ["Lossless", "MP4", "Adaptive coding"] }
  ],
  "education": [
    {
      "institution": "Stanford University",
      "area": "Computer Science",
      "studyType": "B.S.",
      "location": "Palo Alto, CA",
      "specialization": "Machine Learning",
      "startDate": "2008-09",
      "endDate": "2012-01",
      "gpa": "3.9",
      "courses": ["CS2011 - Java Introduction", "DB1101 - Basic SQL"]
    }
  ],
  "awards": [
    {
      "title": "Digital Compression Pioneer Award",
      "date": "2014-11",
      "awarder": "TechCrunch",
      "summary": "Recognized for advances in lossless compression."
    }
  ],
  "volunteer": [
    {
      "organization": "CoderDojo",
      "position": "Teacher",
      "startDate": "2012-01",
      "endDate": "2013-01",
      "summary": "Free coding clubs for young people.",
      "highlights": ["Awarded 'Teacher of the Month'"]
    }
  ]
}
```

- [ ] **Step 2: Create `examples/jd-google-swe.txt`**

```text
Software Engineer, Backend — Google

Minimum qualifications:
- Bachelor's degree in Computer Science or equivalent experience.
- Experience with backend development in Go, Java, or C++.
- Experience building and scaling distributed systems.

Preferred qualifications:
- Experience optimizing service latency and throughput at scale.
- Familiarity with gRPC, sharded storage, and caching strategies.
- Open-source contributions.

About the role:
You will design, build, and operate large-scale backend services, focusing on
reliability, latency, and throughput. You will collaborate across teams and
mentor other engineers.
```

- [ ] **Step 3: Create `examples/expected-resume.json` (tailored from the master for the JD — schema-valid, no `[VERIFY]`)**

```json
{
  "basics": {
    "name": "Richard Hendricks",
    "label": "Backend Software Engineer",
    "email": "richard.hendricks@example.com",
    "phone": "(+1) 555-0100",
    "website": "https://richardhendricks.example.com",
    "summary": "Backend software engineer specializing in <strong>distributed systems</strong> and high-throughput services in Go and Java, with a track record of cutting latency and scaling storage layers.",
    "location": {
      "city": "Palo Alto",
      "countryCode": "US",
      "region": "CA"
    },
    "profiles": [
      { "network": "GitHub", "username": "rhendricks", "url": "https://github.com/rhendricks" }
    ]
  },
  "work": [
    {
      "company": "Pied Piper",
      "position": "Founding Engineer",
      "website": "https://piedpiper.example.com",
      "startDate": "2014-04",
      "summary": "Built a distributed lossless compression platform from zero to production.",
      "highlights": [
        "Designed a sharded storage layer in <strong>Go</strong> handling 50k requests/sec",
        "Reduced p99 API latency from 800ms to 120ms by redesigning the hot path",
        "Built a copyright-detection algorithm used by independent artists"
      ]
    },
    {
      "company": "Hooli",
      "position": "Senior Software Engineer",
      "website": "https://hooli.example.com",
      "startDate": "2013-06",
      "endDate": "2014-04",
      "highlights": [
        "Optimized backend search indexing throughput, reducing reindex time by 35%",
        "Mentored three junior engineers through onboarding"
      ]
    }
  ],
  "projects": [
    {
      "name": "Middle-Out",
      "description": "Open-source compression library",
      "url": "https://github.com/rhendricks/middle-out",
      "keywords": ["Go", "Compression", "CLI"],
      "highlights": ["1.2k GitHub stars", "Used in three production pipelines"]
    }
  ],
  "skills": [
    { "name": "Backend", "level": "Advanced", "keywords": ["Go", "Java", "gRPC", "PostgreSQL"] },
    { "name": "Distributed Systems", "level": "Advanced", "keywords": ["Sharding", "Caching", "Load balancing"] }
  ],
  "education": [
    {
      "institution": "Stanford University",
      "area": "Computer Science",
      "studyType": "B.S.",
      "location": "Palo Alto, CA",
      "startDate": "2008-09",
      "endDate": "2012-01"
    }
  ]
}
```

- [ ] **Step 4: Create `examples/README.md`**

```markdown
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
```

- [ ] **Step 5: Validate the whole example set**

Run: `npm run validate`
Expected: PASS — prints `✓` for `resumes/sample/resume.json`,
`profile/master.example.json`, and `examples/expected-resume.json`, then
`All 3 document(s) valid.` and exits 0.

- [ ] **Step 6: Commit**

```bash
git add profile/master.example.json examples/
git commit -m "docs: add worked example (master, JD, tailored output)"
```

---

## Task 9: Repo docs

**Files:**
- Create: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Create `CLAUDE.md`**

```markdown
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
```

- [ ] **Step 2: Add an "AI Authoring" section to `README.md`**

Insert the following block immediately before the `## Advanced (Optional)`
heading in `README.md`:

```markdown
## AI Authoring (Optional)

Generate a tailored resume from a job description using Claude Code (works great
in Codespaces — no API key needed).

1. **Build your master profile once.** Run the `intake-profile` skill. It either
   interviews you or imports an old PDF/CV/LinkedIn export into
   `profile/master.json` — your full, truthful career history. (See
   `profile/master.example.json` for the shape.)

2. **Tailor to a job.** Run the `tailor-resume` skill with the job description.
   It writes `resumes/<company>/resume.json` as a ranked, JD-focused view of your
   master, and reports any gaps between the JD and your experience.

3. **Honesty gate.** The skills never invent facts. Anything plausible but
   unconfirmed is tagged `[VERIFY]`; `npm run validate` (run automatically in CI)
   fails until you confirm or remove it — so nothing unverified is ever
   published.

4. **Push as usual.** Pushing `resumes/<company>/resume.json` triggers the normal
   build and deploy.

See `examples/` for a full worked example (master profile → JD → tailored
resume). Validate any resume locally with `npm run validate`.
```

- [ ] **Step 3: Confirm docs are consistent and validation still passes**

Run: `npm run validate && npm test`
Expected: validation prints `All 3 document(s) valid.`; tests pass (4 tests, 0 fail).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: document AI authoring flow and repo conventions"
```

---

## Self-Review

**Spec coverage:**
- Skills-only delivery → Tasks 6, 7 (no CLI/SDK — consistent with the dropped-CLI decision).
- Master-profile source of truth + import/interview bootstrap → Task 7 (`intake-profile` + both guides), Task 8 (`master.example.json`).
- Tailored per-company view → Task 6 (`tailor-resume`), Task 5 (`tailoring-rules.md`).
- Suggest-but-mark `[VERIFY]` policy → Task 5 (rules), Task 2/3 (machine gate), Task 9 (documented).
- JSON Resume schema + validation → Task 1 (schema), Tasks 2–3 (validator), Task 4 (CI gate).
- Worked example (profile + JD + output) → Task 8.
- Docs + repo CLAUDE.md → Task 9.
- Build/deploy/delete untouched → only `ci.yml` gains a gate job + dependency edit (Task 4); scripts unchanged.

**Placeholder scan:** No TBD/TODO; every code/JSON/markdown step contains full content; every command has expected output.

**Type/name consistency:** `createValidator`, `validateDocument`, `findVerifyMarkers` are defined in Task 2 and imported with the same names in Tasks 2 (tests) and 3 (CLI). The `[VERIFY]` marker string, `profile/master.json`, `schema/resume.schema.json`, and `resumes/<company>/resume.json` paths are used consistently across tasks. `npm run validate` and `npm test` scripts are defined in Task 1 before first use.
```
