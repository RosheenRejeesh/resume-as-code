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
