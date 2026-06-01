import assert from 'node:assert/strict'
import test from 'node:test'

import { extractDirectives, validateDirectives, validateDocument } from '../lib/validator.js'

test('extractDirectives accepts both inline and block page-break syntax', () => {
  const inlineDirectives = extractDirectives('::page-break ::\n')
  const blockDirectives = extractDirectives('::page-break\n::\n')

  assert.deepEqual(
    inlineDirectives.map((directive) => directive.type),
    ['page-break'],
  )
  assert.deepEqual(
    blockDirectives.map((directive) => directive.type),
    ['page-break'],
  )
  assert.equal(blockDirectives[0].hasEndMarker, true)
})

test('extractDirectives accepts both inline and block section-break syntax', () => {
  const inlineDirectives = extractDirectives('::: section-break :::\n')
  const blockDirectives = extractDirectives('::: section-break\n:::\n')

  assert.deepEqual(
    inlineDirectives.map((directive) => directive.type),
    ['section-break'],
  )
  assert.deepEqual(
    blockDirectives.map((directive) => directive.type),
    ['section-break'],
  )
  assert.equal(blockDirectives[0].hasEndMarker, true)
})

test('validateDirectives reports orphaned end markers', () => {
  const result = validateDocument(`---
title: "Broken"
document-type: "report"
date: "2026-03-28"
---

::
`)

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.code === 'ORPHANED_END_MARKER'))
})

test('self-closing directives do not emit empty-directive warnings', () => {
  const validation = validateDirectives(
    extractDirectives('::page-break ::\n::: section-break :::\n'),
  )

  assert.equal(validation.warnings.length, 0)
})

test('business-proposal uses the same requirement set as proposal', () => {
  const result = validateDocument(`---
title: "Proposal"
document-type: "business-proposal"
date: "2026-03-28"
author: "Consultant"
---

# Proposal
`)

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.code === 'MISSING_REQUIRED_DIRECTIVE'))
  assert.ok(
    result.errors.some((error) => error.message.includes('requires ::letterhead directive')),
  )
})

test('legal-contract enforces required directives and metadata', () => {
  const result = validateDocument(`---
title: "Legal Contract"
document-type: "legal-contract"
date: "2026-03-28"
---

# Legal Contract
`)

  assert.equal(result.valid, false)
  assert.ok(
    result.errors.some((error) => error.message.includes('requires ::letterhead directive')),
  )
  assert.ok(result.errors.some((error) => error.location?.field === 'parties'))
  assert.ok(result.errors.some((error) => error.location?.field === 'effective-date'))
})

test('validator accepts CRLF frontmatter delimiters', () => {
  const lfDocument = `---
title: "Letter"
document-type: "business-letter"
date: "2026-03-28"
---

::letterhead
Acme Corp
::

::signature-block
Signed
::
`
  const crlfDocument = lfDocument.replace(/\n/g, '\r\n')

  const result = validateDocument(crlfDocument)
  assert.equal(result.valid, true)
})
