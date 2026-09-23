import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { remark } from 'remark'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'

import { extractDirectives, validateDirectives, validateDocument } from '../lib/validator.js'
import remarkMddDocumentStructure, {
  hasDocumentStructure,
} from '../plugins/remark-mdd-document-structure.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

function containers(tree) {
  return tree.children
    .filter((node) => node.data?.hProperties?.['data-mdd-directive'])
    .map((node) => node.data.hProperties['data-mdd-directive'])
}

async function run(markdown, { directive = false } = {}) {
  let processor = remark().use(remarkGfm, { singleTilde: false })
  if (directive) processor = processor.use(remarkDirective)
  processor = processor.use(remarkMddDocumentStructure)
  const tree = processor.parse(markdown)
  return processor.run(tree, { path: 'document.mdd' })
}

const CANONICAL = `:::letterhead
Acme Corporation
123 Business Ave
:::

:::header
Acme | Proposal | Page {{page}}
:::

# Title

::page-break

Body text.

::section-break

:::signature-block
Jane Doe
:::
`

const LEGACY = `::letterhead
Acme Corporation
123 Business Ave
::

::header
Acme | Proposal | Page {{page}}
::

# Title

::page-break ::

Body text.

::: section-break :::

::signature-block
Jane Doe
::
`

test('the four examples in canonical syntax validate without errors or legacy warnings', () => {
  for (const name of readdirSync(fixtures).filter((n) => n.endsWith('.mdd'))) {
    const result = validateDocument(readFileSync(join(fixtures, name), 'utf8'))
    assert.deepEqual(
      result.errors.map((e) => `${e.code}@${e.location?.line}`),
      [],
      `${name} errors`,
    )
    assert.equal(
      result.warnings.some((w) => w.code === 'LEGACY_DIRECTIVE_SYNTAX'),
      false,
      `${name} legacy`,
    )
  }
})

test('canonical and legacy spellings extract the same directives', () => {
  const canonical = extractDirectives(CANONICAL).map((d) => d.type)
  const legacy = extractDirectives(LEGACY).map((d) => d.type)
  assert.deepEqual(canonical, [
    'letterhead',
    'header',
    'page-break',
    'section-break',
    'signature-block',
  ])
  assert.deepEqual(legacy, canonical)
})

test('legacy spelling is accepted with one LEGACY_DIRECTIVE_SYNTAX warning per directive', () => {
  const canonical = validateDirectives(extractDirectives(CANONICAL))
  const legacy = validateDirectives(extractDirectives(LEGACY))
  assert.equal(canonical.errors.length, 0)
  assert.equal(canonical.warnings.filter((w) => w.code === 'LEGACY_DIRECTIVE_SYNTAX').length, 0)
  assert.equal(legacy.errors.length, 0)
  assert.equal(legacy.warnings.filter((w) => w.code === 'LEGACY_DIRECTIVE_SYNTAX').length, 5)
})

test('legacy block forms of the self-closing directives swallow their closer', () => {
  const result = validateDirectives(
    extractDirectives('::page-break\n::\n\n::: section-break\n:::\n'),
  )
  assert.equal(result.errors.length, 0)
  assert.deepEqual(
    extractDirectives('::page-break\n::\n\n::: section-break\n:::\n').map((d) => d.type),
    ['page-break', 'section-break'],
  )
})

test('a canonical opener closed with the legacy marker is a missing end marker, not a match', () => {
  const result = validateDocument(`---
title: "Letter"
document-type: "report"
date: "2026-09-16"
---

:::letterhead
Acme
::
`)
  assert.ok(result.errors.some((e) => e.code === 'MISSING_END_MARKER'))
  assert.ok(result.errors.some((e) => e.code === 'ORPHANED_END_MARKER'))
})

test('messages spell directives the MDD 3 way', () => {
  const result = validateDocument(`---
title: "Letter"
document-type: "business-letter"
date: "2026-09-16"
---

Hello.
`)
  const required = result.errors.find((e) => e.code === 'MISSING_REQUIRED_DIRECTIVE')
  assert.ok(required)
  assert.match(required.message, /:::letterhead/)
})

test('the structure plugin reads canonical blocks from paragraphs', async () => {
  const tree = await run(CANONICAL)
  assert.deepEqual(containers(tree), [
    'letterhead',
    'header',
    'page-break',
    'section-break',
    'signature',
  ])
  const letterhead = tree.children[0]
  assert.equal(letterhead.children[0].type, 'paragraph')
  assert.match(letterhead.children[0].children[0].value, /^Acme Corporation/)
  // Structure is detected on the parsed tree, before the plugin has replaced it.
  assert.equal(hasDocumentStructure(remark().parse(CANONICAL)), true)
  assert.equal(hasDocumentStructure(remark().parse(LEGACY)), true)
})

test('the structure plugin still reads the legacy spelling', async () => {
  assert.deepEqual(containers(await run(LEGACY)), containers(await run(CANONICAL)))
})

test('the structure plugin maps remark-directive nodes without scanning', async () => {
  const tree = await run(CANONICAL, { directive: true })
  assert.deepEqual(containers(tree), [
    'letterhead',
    'header',
    'page-break',
    'section-break',
    'signature',
  ])
  const header = tree.children[1]
  const html = header.children[0].children.find((c) => c.type === 'html')
  assert.equal(html.value, '<span class="page-number">1</span>')
})

test('a container the plugin does not know is left to the pipeline', async () => {
  const tree = await run(':::note\nHi\n:::\n', { directive: true })
  assert.equal(tree.children[0].type, 'containerDirective')
  assert.equal(hasDocumentStructure(tree), false)
})
