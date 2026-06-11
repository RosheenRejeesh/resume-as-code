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
