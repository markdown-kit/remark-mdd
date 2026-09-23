import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { remark } from 'remark'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'

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

/** Directive lines the scanner left in the output as literal text. */
function literalDirectiveLines(tree) {
  const lines = []
  visit(tree, 'text', (node) => {
    for (const line of node.value.split(/\r?\n/u)) {
      if (/^\s*:{2,3}\s*[a-z-]*\s*(?::{2,3})?\s*$/u.test(line)) lines.push(line.trim())
    }
  })
  return lines
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

test('messages spell a legacy block as written and name its own end marker', () => {
  const find = (body, code) =>
    [
      ...validateDocument(FRONTMATTER + body).errors,
      ...validateDocument(FRONTMATTER + body).warnings,
    ].find((e) => e.code === code)
  const legacy = find('::letterhead\nA\n\n::header\nB\n::\n', 'INVALID_DIRECTIVE_NESTING')
  assert.equal(
    legacy.message,
    'Directive ::header at line 9 starts before ::letterhead was closed; MDD directives cannot be nested',
  )
  assert.equal(legacy.suggestion, 'Close ::letterhead with :: before opening ::header')
  const missing = find('::letterhead\nA\n\n::header\nB\n::\n', 'MISSING_END_MARKER')
  assert.equal(missing.message, 'Directive ::letterhead at line 6 is missing end marker ::')
  const mixed = find(':::letterhead\nA\n\n::header\nB\n::\n', 'INVALID_DIRECTIVE_NESTING')
  assert.equal(mixed.suggestion, 'Close :::letterhead with ::: before opening ::header')
  const order = find(
    ':::signature-block\nJ\n:::\n\n:::letterhead\nA\n:::\n',
    'INVALID_DIRECTIVE_ORDER',
  )
  assert.equal(order.message, ':::signature-block at line 6 appears before :::letterhead')
  const empty = find('::letterhead\n::\n', 'EMPTY_DIRECTIVE')
  assert.equal(empty.message, 'Directive ::letterhead at line 6 is empty')
  const start = find('Text\n::header\nB\n::\n', 'DIRECTIVE_NOT_BLOCK_START')
  assert.match(start.message, /^Directive ::header at line 7 /u)
  const end = find('::letterhead\nA\n::\nText\n', 'DIRECTIVE_NOT_BLOCK_END')
  assert.match(end.message, /^End marker :: of ::letterhead at line 8 /u)
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

const FRONTMATTER = '---\ntitle: "Letter"\ndocument-type: "other"\n---\n\n'

// [case, body, whether the paragraph scanner renders every directive]
const BLOCK_END_CASES = [
  ['blank line after the closer', ':::letterhead\nACME\n:::\n\nDear Sir,\n', true],
  ['closer at the end of the file', ':::letterhead\nACME\n:::', true],
  ['heading after the closer', ':::letterhead\nACME\n:::\n# Title\n', true],
  ['fence after the closer', ':::letterhead\nACME\n:::\n```\ncode\n```\n', true],
  ['rule after the closer', ':::letterhead\nACME\n:::\n***\n', true],
  ['heading inside the block before the closer', ':::letterhead\n# ACME\n:::\n', true],
  [
    'blank line between a list and the closer',
    ':::signature-block\n- Jane Doe\n- CEO\n\n:::\n',
    true,
  ],
  [
    'blank line between a table and the closer',
    ':::contact-info\n| a |\n| - |\n| 1 |\n\n:::\n',
    true,
  ],
  ['heading after a page break', 'One.\n\n::page-break\n# Two\n', true],
  ['prose after the closer', ':::letterhead\nACME\n:::\nDear Sir,\n', false],
  ['prose after a legacy closer', '::letterhead\nACME\n::\nDear Sir,\n', false],
  ['prose after a page break', 'One.\n\n::page-break\nTwo.\n', false],
  ['prose after a section break', 'One.\n\n::section-break\nTwo.\n', false],
  ['prose after a legacy page break', 'One.\n\n::page-break ::\nTwo.\n', false],
  ['prose after a legacy page-break closer', 'One.\n\n::page-break\n::\nTwo.\n', false],
  ['setext underline after the closer', ':::letterhead\nACME\n:::\n---\n', false],
  ['indented line after the closer', ':::letterhead\nACME\n:::\n    more\n', false],
  ['closer directly after a list item', ':::signature-block\n- Jane Doe\n- CEO\n:::\n', false],
  ['closer after a lazy list continuation', ':::signature-block\n- Jane Doe\nCEO\n:::\n', false],
  ['closer directly after a table row', ':::contact-info\n| a |\n| - |\n| 1 |\n:::\n', false],
  ['closer directly after a blockquote', ':::letterhead\n> ACME\n:::\n', false],
]

test('a directive that does not end its block is an error exactly where the scanner cannot render it', async () => {
  for (const [name, body, renders] of BLOCK_END_CASES) {
    const errors = validateDocument(FRONTMATTER + body).errors.map((e) => e.code)
    if (renders) {
      assert.deepEqual(errors, [], `${name}: validator`)
    } else {
      assert.ok(errors.includes('DIRECTIVE_NOT_BLOCK_END'), `${name}: validator ${errors}`)
    }
    assert.deepEqual(
      literalDirectiveLines(await run(body)).length === 0,
      renders,
      `${name}: scanner`,
    )
  }
})

test('DIRECTIVE_NOT_BLOCK_END says where the blank line goes', () => {
  const after = validateDocument(`${FRONTMATTER}:::letterhead\nACME\n:::\nDear Sir,\n`).errors[0]
  assert.equal(after.code, 'DIRECTIVE_NOT_BLOCK_END')
  assert.equal(after.location.line, 8)
  assert.match(after.message, /:::letterhead/u)
  assert.match(after.suggestion, /blank line after/u)
  const before = validateDocument(`${FRONTMATTER}:::signature-block\n- Jane\n:::\n`).errors[0]
  assert.equal(before.code, 'DIRECTIVE_NOT_BLOCK_END')
  assert.equal(before.location.line, 8)
  assert.match(before.message, /list item/u)
  assert.match(before.suggestion, /blank line before/u)
})

// [case, body, directives the scanner renders]
const INDENTED_CASES = [
  [
    'indented code after a blank line',
    'Example:\n\n    :::letterhead\n    ACME\n    :::\n\nEnd.\n',
    [],
  ],
  ['tab-indented code', 'Example:\n\n\t::page-break\n', []],
  ['indented code after a heading', '# Title\n    ::page-break\n', []],
  ['indented code inside a block', ':::letterhead\nACME\n\n    :::\n\n:::\n', ['letterhead']],
  ['indented closer continuing a paragraph', ':::letterhead\nACME\n    :::\n', ['letterhead']],
]

test('directive lines in an indented code block are code, not directives', async () => {
  for (const [name, body, rendered] of INDENTED_CASES) {
    const result = validateDocument(FRONTMATTER + body)
    assert.deepEqual(result.errors, [], `${name}: errors`)
    assert.deepEqual(
      result.directives.map((d) => d.type),
      rendered,
      `${name}: validator`,
    )
    assert.deepEqual(containers(await run(body)), rendered, `${name}: scanner`)
  }
})
