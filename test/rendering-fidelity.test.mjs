import assert from 'node:assert/strict'
import test from 'node:test'

import { remark } from 'remark'
import remarkGfm from 'remark-gfm'

import remarkMddDocumentStructure from '../plugins/remark-mdd-document-structure.js'
import remarkMddTextFormatting from '../plugins/remark-mdd-text-formatting.js'

async function transform(markdown, plugin) {
  let processor = remark()
  for (const item of plugin.plugins ?? [plugin]) {
    processor = processor.use(item)
  }
  const tree = processor.parse(markdown)
  return processor.run(tree, { path: 'document.mdd' })
}

test('document directives preserve rich Markdown block and inline nodes', async () => {
  const tree = await transform(
    `::letterhead
**Acme** [site](https://example.com)

- First
- Second

::
`,
    remarkMddDocumentStructure,
  )

  const directive = tree.children[0]
  assert.equal(directive.data.hName, 'div')
  assert.deepEqual(directive.data.hProperties.className, ['letterhead'])
  assert.equal(directive.children[0].children[0].type, 'strong')
  assert.equal(directive.children[0].children[2].type, 'link')
  assert.equal(directive.children[1].type, 'list')
})

test('semantic classes retain the original heading element', async () => {
  const tree = await transform('# Invoice {.invoice-title}\n', remarkMddDocumentStructure)
  const heading = tree.children[0]
  assert.equal(heading.type, 'heading')
  assert.equal(heading.depth, 1)
  assert.equal(heading.data.hName, undefined)
  assert.deepEqual(heading.data.hProperties.className, ['invoice-title'])
  assert.equal(heading.children[0].value, 'Invoice')
})

test('a semantic class applies to a paragraph that wraps onto several lines', async () => {
  const wrapped = await transform(
    'Line one of a wrapped paragraph\nline two. {.legal-notice}\n',
    remarkMddDocumentStructure,
  )
  assert.deepEqual(wrapped.children[0].data?.hProperties?.className, ['legal-notice'])
  assert.equal(wrapped.children[0].children[0].value, 'Line one of a wrapped paragraph\nline two.')

  // The SPECIFICATION example: two annotated lines form one Markdown paragraph.
  const spec = await transform(
    'Important legal text. {.legal-notice}\nHighlighted information. {.emphasis}\n',
    remarkMddDocumentStructure,
  )
  assert.deepEqual(spec.children[0].data?.hProperties?.className, ['emphasis'])
  assert.doesNotMatch(spec.children[0].children[0].value, /\{\.emphasis\}/u)
})

test('standalone typography tokens are transformed', async () => {
  const superscript = await transform('^2^\n', remarkMddTextFormatting)
  assert.equal(superscript.children[0].children[0].type, 'html')
  assert.equal(superscript.children[0].children[0].value, '<sup>2</sup>')

  const quote = await transform('"hello"\n', remarkMddTextFormatting)
  assert.equal(quote.children[0].children[0].value, '“hello”')
})

test('derived paragraph classes are added to, not substituted for, an explicit semantic class', async () => {
  const longText = 'Important legal text. '.repeat(12).trim()
  const tree = await transform(`${longText} {.legal-notice}\n`, {
    plugins: [remarkMddDocumentStructure, remarkMddTextFormatting],
  })
  const paragraph = tree.children[0]
  assert.deepEqual(paragraph.data.hProperties.className, ['legal-notice', 'long-paragraph'])
})

test('a directive closes only on a `::` line of its own, as the validator requires', async () => {
  const tree = await transform(
    `::letterhead
Office hours: 9::30

Second paragraph
::

After
`,
    remarkMddDocumentStructure,
  )

  assert.equal(tree.children.length, 2)
  const [container, after] = tree.children
  assert.equal(container.data.hProperties['data-mdd-directive'], 'letterhead')
  assert.equal(container.children.length, 2)
  assert.equal(container.children[0].children[0].value, 'Office hours: 9::30')
  assert.equal(container.children[1].children[0].value, 'Second paragraph')
  assert.equal(after.children[0].value, 'After')
})

test('every heading is numbered in document order, title classes included', async () => {
  const tree = await transform('# INVOICE {.invoice-title}\n\n## Services\n\n## Payment\n', {
    plugins: [remarkMddDocumentStructure, remarkMddTextFormatting],
  })
  const [title, services, payment] = tree.children
  assert.equal(title.children[0].value, '1 INVOICE')
  assert.deepEqual(title.data.hProperties.className, ['invoice-title'])
  assert.equal(title.data.hProperties.id, 'section-1')
  assert.equal(services.children[0].value, '1.1 Services')
  assert.equal(services.data.hProperties.id, 'section-1-1')
  assert.equal(payment.children[0].value, '1.2 Payment')
})

test('{{page}} in ::header/::footer renders as a page-number span', async () => {
  const tree = await transform(
    '::header\nAcme | Page {{page}} of {{page}}\n::\n\n::letterhead\nSee {{page}}\n::\n',
    remarkMddDocumentStructure,
  )
  const [header, letterhead] = tree.children
  const nodes = header.children[0].children
  assert.deepEqual(
    nodes.map((node) => [node.type, node.value]),
    [
      ['text', 'Acme | Page '],
      ['html', '<span class="page-number">1</span>'],
      ['text', ' of '],
      ['html', '<span class="page-number">1</span>'],
    ],
  )
  assert.equal(letterhead.children[0].children[0].value, 'See {{page}}')
})

test('tables and images receive table-N / figure-N anchors that @refs link to', async () => {
  const tree = await transform(
    '| A | B |\n| - | - |\n| 1 | 2 |\n\n![Chart](chart.png)\n\nSee @table-1 and @figure-1.\n',
    { plugins: [remarkGfm, remarkMddDocumentStructure, remarkMddTextFormatting] },
  )
  const [table, figure, paragraph] = tree.children
  assert.equal(table.data.hProperties.id, 'table-1')
  assert.equal(figure.children[0].data.hProperties.id, 'figure-1')
  const links = paragraph.children.filter((child) => child.type === 'link').map((link) => link.url)
  assert.deepEqual(links, ['#table-1', '#figure-1'])
})
