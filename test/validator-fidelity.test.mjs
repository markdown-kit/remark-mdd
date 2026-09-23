import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractFrontmatter,
  parseFrontmatter,
  validateDocument,
  validateReferences,
  validateSemanticClasses,
  validateTextFormatting,
} from '../lib/validator.js'

const BASE = `---
title: "Doc"
document-type: "report"
date: "2026-03-28"
---

# Heading
`

test('F1: non-string scalar fields report INVALID_FIELD_TYPE instead of throwing', () => {
  for (const value of ['true', '42', '[a, b]']) {
    const doc = `---\ntitle: ${value}\ndocument-type: "report"\n---\n\n# X\n`
    let result
    assert.doesNotThrow(() => {
      result = validateDocument(doc)
    }, `validateDocument must not throw for title: ${value}`)
    assert.equal(result.valid, false)
    assert.ok(
      result.errors.some(
        (e) => e.code === 'INVALID_FIELD_TYPE' || e.code === 'MISSING_REQUIRED_FIELD',
      ),
      `expected a type/required error for title: ${value}`,
    )
  }
})

test('F4: JSON Schema constraints (maxLength) are enforced via SCHEMA_VIOLATION', () => {
  const longTitle = 'x'.repeat(250) // schema maxLength is 200
  const doc = `---\ntitle: "${longTitle}"\ndocument-type: "report"\n---\n\n# X\n`
  const result = validateDocument(doc)
  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some((e) => e.code === 'SCHEMA_VIOLATION' && e.location?.field === 'title'),
    'expected SCHEMA_VIOLATION for over-length title',
  )
})

test('F5: YAML block-list arrays parse (parties) and satisfy required-metadata', () => {
  const doc = `---
title: "Mutual NDA"
document-type: "nda"
date: "2026-03-28"
effective-date: "2026-03-28"
parties:
  - Acme Corp
  - Beta LLC
---

::signature-block
Signed
::
`
  const fm = extractFrontmatter(doc)
  assert.deepEqual(fm.parties, ['Acme Corp', 'Beta LLC'])
  const result = validateDocument(doc)
  assert.ok(
    !result.errors.some((e) => e.location?.field === 'parties'),
    'parties provided as a YAML block list must not be reported missing',
  )
})

test('F5b: inline-flow arrays still parse', () => {
  const fm = extractFrontmatter(
    `---\ntitle: "X"\ndocument-type: "report"\ncc: [a@x.com, b@x.com]\n---\n\n# X\n`,
  )
  assert.deepEqual(fm.cc, ['a@x.com', 'b@x.com'])
})

test('INVALID_FRONTMATTER_YAML reported on malformed YAML', () => {
  const doc = `---\ntitle: "Unterminated\ndocument-type: report\n---\n\n# X\n`
  const { yamlError } = parseFrontmatter(doc)
  assert.ok(yamlError, 'malformed YAML should surface a parse error')
  const result = validateDocument(doc)
  assert.ok(result.errors.some((e) => e.code === 'INVALID_FRONTMATTER_YAML'))
})

test('F6: INVALID_DIRECTIVE_NESTING when a directive opens before the previous closes', () => {
  const doc = `${BASE}
::letterhead
Acme
::header
Page
::
`
  const result = validateDocument(doc)
  assert.ok(result.errors.some((e) => e.code === 'INVALID_DIRECTIVE_NESTING'))
})

test('unknown block and self-closing directives are errors', () => {
  for (const directive of ['::page-brek ::', '::letterhed']) {
    const result = validateDocument(`${BASE}\n${directive}\n`)
    assert.ok(
      result.errors.some((error) => error.code === 'UNKNOWN_DIRECTIVE'),
      `${directive} must not bypass directive validation`,
    )
  }
})

test('directive-looking text inside a code fence is not an unknown directive', () => {
  const result = validateDocument(`${BASE}\n\`\`\`mdd\n::page-brek ::\n\`\`\`\n`)
  assert.ok(!result.errors.some((error) => error.code === 'UNKNOWN_DIRECTIVE'))
})

test('F6: INVALID_SEMANTIC_CLASS for malformed class vs UNKNOWN for well-formed', () => {
  const malformed = validateSemanticClasses('Heading {.Not Valid}')
  assert.ok(malformed.errors.some((e) => e.code === 'INVALID_SEMANTIC_CLASS'))

  const unknown = validateSemanticClasses('Para {.totally-made-up}')
  assert.ok(unknown.warnings.some((e) => e.code === 'UNKNOWN_SEMANTIC_CLASS'))
})

test('F6: MALFORMED_PATTERN for whitespace inside superscript', () => {
  const result = validateTextFormatting('See note^a b^ here')
  assert.ok(result.warnings.some((e) => e.code === 'MALFORMED_PATTERN'))
})

test('F6: OVERLAPPING_FORMATTING when sup and sub overlap', () => {
  const result = validateTextFormatting('x^a~b^c~')
  assert.ok(result.warnings.some((e) => e.code === 'OVERLAPPING_FORMATTING'))
})

test('F6: INVALID_REFERENCE for a @section ref with no matching heading', () => {
  const result = validateReferences('# Intro\n\nSee @section-9 for details.\n')
  assert.ok(result.warnings.some((e) => e.code === 'INVALID_REFERENCE'))

  const valid = validateReferences('# Intro\n\nSee @section-1 for details.\n')
  assert.ok(!valid.warnings.some((e) => e.code === 'INVALID_REFERENCE'))
})

test('code-fence-aware: directives and classes inside ``` fences are ignored', () => {
  const doc = `---
title: "Spec"
document-type: "specification"
date: "2026-03-28"
version: "1.0"
---

# Examples

\`\`\`markdown
::letterhead
Acme
::

Heading {.NotAClass}
\`\`\`
`
  const result = validateDocument(doc)
  assert.ok(
    !result.errors.some((e) => e.code === 'MISSING_END_MARKER'),
    'a ::letterhead shown inside a code fence must not be treated as a real directive',
  )
  assert.ok(
    !result.errors.some((e) => e.code === 'INVALID_SEMANTIC_CLASS'),
    'a class annotation shown inside a code fence must not be validated',
  )
})

test('valid document still validates clean', () => {
  const doc = `---
title: "Quarterly Report"
document-type: "report"
date: "2026-03-28"
author: "Finance"
---

# Summary

Body text.
`
  const result = validateDocument(doc)
  assert.equal(result.valid, true, JSON.stringify(result.errors))
})

test('references resolve against the same numbering the renderer applies to title headings', () => {
  const doc =
    '# INVOICE {.invoice-title}\n\n## Services\n\nSee @section-1, @section-1-1 and @section-2.\n'
  const result = validateReferences(doc)
  const broken = result.warnings.map((warning) => warning.message)
  assert.equal(broken.length, 1, broken.join('; '))
  assert.match(broken[0], /@section-2/u)
})

test('a directive opener that does not start a new block is an error', () => {
  const codes = (doc) => validateDocument(doc).errors.map((error) => error.code)
  const header = 'title: "Test"\ndocument-type: "report"\n'
  const frontmatter = `---\n${header}---\n`
  assert.ok(
    codes(`${frontmatter}Intro text\n::header\nAcme\n::\n`).includes('DIRECTIVE_NOT_BLOCK_START'),
  )
  assert.ok(
    codes(`${frontmatter}\n::header\nAcme\n::\n::footer\nAcme\n::\n`).includes(
      'DIRECTIVE_NOT_BLOCK_START',
    ),
  )
  assert.ok(
    codes(`${frontmatter}\n- item\n::page-break ::\n`).includes('DIRECTIVE_NOT_BLOCK_START'),
  )
  for (const valid of [
    `${frontmatter}::header\nAcme\n::\n`,
    `${frontmatter}\n# Title\n::header\nAcme\n::\n`,
    `${frontmatter}\nText\n\n::header\nAcme\n::\n\n---\n::footer\nAcme\n::\n`,
  ]) {
    assert.ok(!codes(valid).includes('DIRECTIVE_NOT_BLOCK_START'), valid)
  }
})

test('@table-N and @figure-N references are checked against tables and images in order', () => {
  const doc =
    '# Data\n\n| A |\n| - |\n| 1 |\n\n![Chart](c.png)\n\nSee @table-1, @figure-1, @table-2 and @figure-3.\n'
  const broken = validateReferences(doc).warnings.map((warning) => warning.message)
  assert.equal(broken.length, 2, broken.join('; '))
  assert.match(broken[0], /@table-2/u)
  assert.match(broken[1], /@figure-3/u)
})

test('frontmatter values of the wrong type or empty are reported once per field', () => {
  const errorsFor = (yaml) =>
    validateDocument(`---\ntitle: "T"\ndocument-type: "other"\n${yaml}\n---\n`).errors.map(
      (e) => `${e.location?.field} ${e.code}`,
    )
  // [frontmatter line, the one error expected]
  const cases = [
    ['version: 1.5', 'version INVALID_FIELD_TYPE'],
    ['version: 1.0', 'version INVALID_FIELD_TYPE'],
    ['status: 3', 'status INVALID_FIELD_TYPE'],
    ['language: true', 'language INVALID_FIELD_TYPE'],
    ['status: ""', 'status INVALID_STATUS'],
    ['version: ""', 'version INVALID_VERSION_FORMAT'],
    ['date: ""', 'date INVALID_DATE_FORMAT'],
    ['total-amount: ""', 'total-amount INVALID_CURRENCY_FORMAT'],
  ]
  for (const [yaml, expected] of cases) {
    assert.deepEqual(errorsFor(yaml), [expected], yaml)
  }
  const title = validateDocument(`---\ntitle: 1984\ndocument-type: "other"\n---\n`).errors
  assert.deepEqual(
    title.map((e) => e.code),
    ['INVALID_FIELD_TYPE'],
  )
})

test('an unquoted version is reported as a number with a hint to quote it', () => {
  const error = validateDocument(`---\ntitle: "T"\ndocument-type: "other"\nversion: 1.0\n---\n`)
    .errors[0]
  assert.match(error.message, /"version" must be a string \(got number\)/u)
  assert.match(error.suggestion, /version: "1\.0"/u)
})
