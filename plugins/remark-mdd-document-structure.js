/**
 * Preserve MDD document directives as semantic HTML containers without
 * flattening the Markdown AST contained by each directive.
 *
 * Two inputs are understood. When the processor runs remark-directive, the
 * canonical `:::letterhead … :::` blocks and `::page-break` / `::section-break`
 * leaves arrive as directive nodes and are mapped straight to containers.
 * Without it, this plugin scans paragraphs for the same canonical lines, and
 * still reads the MDD 2 spelling (`::letterhead … ::`, `::page-break ::`,
 * `::: section-break :::`), which is accepted for one more major version.
 */

import { visit } from 'unist-util-visit'

const BLOCK_DIRECTIVES = new Map([
  ['letterhead', 'letterhead'],
  ['signature-block', 'signature'],
  ['header', 'header'],
  ['footer', 'footer'],
  ['contact-info', 'contactinfo'],
])

export default function remarkMddDocumentStructure() {
  return function transformer(tree, file) {
    if (!file.path?.endsWith('.mdd')) {
      return
    }

    processDocumentStructure(tree)
    processSemanticClasses(tree)
  }
}

function textLeaves(node, leaves = []) {
  if (node?.type === 'text') {
    leaves.push(node)
  }
  for (const child of node?.children ?? []) {
    textLeaves(child, leaves)
  }
  return leaves
}

function nodeText(node) {
  return textLeaves(node)
    .map((leaf) => leaf.value)
    .join('')
}

function paragraphIsEmpty(node) {
  return node.type === 'paragraph' && nodeText(node).trim() === ''
}

function removeEmptyTextLeaves(node) {
  if (!Array.isArray(node.children)) {
    return
  }
  for (const child of node.children) {
    removeEmptyTextLeaves(child)
  }
  node.children = node.children.filter((child) => child.type !== 'text' || child.value !== '')
}

function cloneWithoutOpeningMarker(node, directive) {
  const clone = structuredClone(node)
  const first = textLeaves(clone)[0]
  if (first) {
    first.value = first.value.replace(new RegExp(`^:{2,3}${directive}(?:\\r?\\n|$)`, 'u'), '')
  }
  removeEmptyTextLeaves(clone)
  return clone
}

/**
 * A paragraph closes a directive only when its final line is exactly `::`.
 * This mirrors the validator, which recognises an end marker solely on its own
 * line; text that merely ends in `::` (e.g. `Time: 10::`) is directive content.
 */
function closesDirective(node, marker) {
  return new RegExp(`(?:^|\\r?\\n)${marker}\\s*$`, 'u').test(nodeText(node).trimEnd())
}

function cloneWithoutEndMarker(node, marker) {
  const clone = structuredClone(node)
  const leaves = textLeaves(clone)
  const last = leaves.at(-1)
  if (last) {
    last.value = last.value.replace(new RegExp(`(?:\\r?\\n)?${marker}\\s*$`, 'u'), '')
  }
  removeEmptyTextLeaves(clone)
  return clone
}

function pushUnlessEmpty(nodes, node) {
  if (!paragraphIsEmpty(node)) {
    nodes.push(node)
  }
}

const PAGE_NUMBER_TOKEN = '{{page}}'
const PAGE_NUMBER_NODE = { type: 'html', value: '<span class="page-number">1</span>' }

/**
 * HTML has no pages, so `{{page}}` in ::header/::footer renders as the first
 * page's number inside a `.page-number` span. Paged output replaces the token
 * with a live field instead (PDF furniture templates, DOCX PAGE fields).
 */
function expandPageNumberTokens(node) {
  if (!Array.isArray(node.children)) {
    return
  }
  node.children = node.children.flatMap((child) => {
    if (child.type !== 'text' || !child.value.includes(PAGE_NUMBER_TOKEN)) {
      expandPageNumberTokens(child)
      return [child]
    }
    const parts = child.value.split(PAGE_NUMBER_TOKEN)
    const nodes = []
    parts.forEach((part, index) => {
      if (part) {
        nodes.push({ type: 'text', value: part })
      }
      if (index < parts.length - 1) {
        nodes.push(structuredClone(PAGE_NUMBER_NODE))
      }
    })
    return nodes
  })
}

function semanticContainer(className, children) {
  if (className === 'header' || className === 'footer') {
    for (const child of children) {
      expandPageNumberTokens(child)
    }
  }
  return {
    type: 'blockquote',
    children,
    data: {
      hName: 'div',
      hProperties: { className: [className], 'data-mdd-directive': className },
    },
  }
}

function pageBreakNode() {
  return {
    type: 'paragraph',
    children: [],
    data: {
      hName: 'div',
      hProperties: { className: ['page-break'], 'data-mdd-directive': 'page-break' },
    },
  }
}

function sectionBreakNode() {
  return {
    type: 'thematicBreak',
    data: {
      hProperties: { className: ['section-break'], 'data-mdd-directive': 'section-break' },
    },
  }
}

/** remark-directive nodes: the canonical MDD 3 form, already parsed. */
function fromDirectiveNode(node) {
  if (node.type === 'leafDirective') {
    if (node.name === 'page-break') return pageBreakNode()
    if (node.name === 'section-break') return sectionBreakNode()
    return null
  }
  if (node.type === 'containerDirective') {
    const className = BLOCK_DIRECTIVES.get(node.name)
    if (!className) return null
    return semanticContainer(className, structuredClone(node.children))
  }
  return null
}

function processDocumentStructure(tree) {
  if (!Array.isArray(tree.children)) {
    return
  }

  const input = tree.children
  const output = []

  for (let index = 0; index < input.length; index++) {
    const node = input[index]
    const fromNode = fromDirectiveNode(node)
    if (fromNode) {
      output.push(fromNode)
      continue
    }
    if (node.type !== 'paragraph') {
      output.push(node)
      continue
    }

    const text = nodeText(node).trim()
    // Self-closing directives: `::page-break` and `::section-break` are the
    // canonical lines; `::page-break ::`, `::: section-break :::` and their
    // block forms with a closer on the next line are the MDD 2 spelling.
    if (/^::page-break(?:\s*::)?$/u.test(text)) {
      output.push(pageBreakNode())
      if (text === '::page-break' && nodeText(input[index + 1] ?? {}).trim() === '::') {
        index++
      }
      continue
    }
    if (/^::section-break$/u.test(text) || /^:::\s*section-break(?:\s*:::)?$/u.test(text)) {
      output.push(sectionBreakNode())
      if (
        /^:::\s*section-break$/u.test(text) &&
        nodeText(input[index + 1] ?? {}).trim() === ':::'
      ) {
        index++
      }
      continue
    }

    const firstLine = nodeText(node).split(/\r?\n/u)[0].trim()
    const opener = firstLine.match(/^(:{2,3})([a-z][a-z0-9-]*)$/u)
    const className = opener ? BLOCK_DIRECTIVES.get(opener[2]) : null
    if (!opener || !className) {
      output.push(node)
      continue
    }

    const directive = opener[2]
    // A `:::name` block closes with `:::`; the MDD 2 `::name` block with `::`.
    const marker = opener[1]
    const children = []
    const openingContent = cloneWithoutOpeningMarker(node, directive)
    if (closesDirective(openingContent, marker)) {
      pushUnlessEmpty(children, cloneWithoutEndMarker(openingContent, marker))
      output.push(semanticContainer(className, children))
      continue
    }
    pushUnlessEmpty(children, openingContent)

    let closed = false
    for (let cursor = index + 1; cursor < input.length; cursor++) {
      const contentNode = input[cursor]
      if (contentNode.type === 'paragraph' && closesDirective(contentNode, marker)) {
        pushUnlessEmpty(children, cloneWithoutEndMarker(contentNode, marker))
        index = cursor
        closed = true
        break
      }
      children.push(contentNode)
    }

    if (closed) {
      output.push(semanticContainer(className, children))
    } else {
      // Validation reports the missing terminator. Keep the original source AST
      // visible rather than consuming the remainder of the document.
      output.push(node)
    }
  }

  tree.children = output
}

function processSemanticClasses(tree) {
  visit(tree, ['heading', 'paragraph'], (node) => {
    const leaves = textLeaves(node)
    const last = leaves.at(-1)
    if (!last?.value) {
      return
    }

    const classMatch = last.value.match(/^(.*?)\s*\{\.([^}]+)\}\s*$/u)
    if (!classMatch) {
      return
    }

    const [, text, className] = classMatch
    last.value = text.trimEnd()
    node.data ??= {}
    node.data.hProperties ??= {}
    node.data.hProperties.className = [className]
  })
}

export function hasDocumentStructure(tree) {
  let hasStructure = false
  visit(tree, ['paragraph', 'containerDirective', 'leafDirective'], (node) => {
    if (node.type !== 'paragraph') {
      if (
        BLOCK_DIRECTIVES.has(node.name) ||
        node.name === 'page-break' ||
        node.name === 'section-break'
      )
        hasStructure = true
      return
    }
    const text = nodeText(node).trim()
    if (
      /^:{2,3}(?:letterhead|signature-block|header|footer|contact-info|page-break|section-break)\b/u.test(
        text,
      )
    ) {
      hasStructure = true
    }
    if (/^:::\s*section-break\b/u.test(text)) {
      hasStructure = true
    }
  })
  return hasStructure
}
