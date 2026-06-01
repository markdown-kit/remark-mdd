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
