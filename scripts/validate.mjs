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
