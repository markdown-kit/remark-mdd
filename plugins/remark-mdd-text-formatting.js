/**
 * MDD Text Formatting Plugin
 *
 * Handles professional typography and cross-referencing for business documents.
 * Converts markdown-style text patterns into HTML elements for semantic preservation.
 *
 * Professional typography:
 * - Superscripts: text^super^ → <sup>super</sup> (for footnotes, version numbers, references)
 * - Subscripts: text~sub~ → <sub>sub</sub> (for chemical formulas, mathematical notation)
 *
 * Document structure:
 * - Internal references: @section-1 / @table-1 / @figure-1 → auto-linked references
 *   (tables and images receive `table-N` / `figure-N` ids in document order)
 * - Automatic section numbering: 1, 1.1, 1.1.1 for H1-H3 headings
 * - Legal clause detection: WHEREAS, THEREFORE, etc. with semantic classes
 * - Long paragraph detection: Identifies lengthy text blocks for styling
 *
 * Philosophy: Professional documents require precise typography. These patterns enable
 * business-quality output while maintaining human-readable source files.
 *
 * Architecture: Stage 1 of two-stage conversion (text patterns → HTML nodes → final format)
 */

import { visit } from 'unist-util-visit'

/**
 * Text formatting patterns
 */
const TEXT_PATTERNS = {
  // Superscript: text^super^
  superscript: /\^([^^\s]+)\^/g,

  // Subscript: text~sub~
  subscript: /~([^~\s]+)~/g,

  // Internal references: @section-1, @table-2, @figure-3
  internalRef: /@(section|table|figure)-(\d+)/g,

  // Quote typography: "text" -> proper quotes
  quotes: /"([^"]+)"/g,
}

/**
 * MDD text formatting plugin
 *
 * Transforms text patterns into semantic HTML nodes for professional typography.
 * Preserves formatting across output formats (HTML, PDF via pandoc, DOCX via pandoc).
 */
export default function remarkMddTextFormatting() {
  return function transformer(tree, file) {
    // Only process .mdd files (MDD-specific typography patterns)
    if (!file.path?.endsWith('.mdd')) {
      return
    }

    transformTextNodes(tree)

    // Process heading structure and numbering
    processHeadingStructure(tree)

    // Process paragraph structure
    processParagraphStructure(tree)

    // Anchor tables and figures so @table-N / @figure-N references resolve
    processReferenceTargets(tree)
  }
}

/**
 * Give every table and image an id in document order (`table-1`, `figure-1`,
 * …) so `@table-N`/`@figure-N` links have a target. The validator mirrors this
 * numbering when it checks references.
 */
function processReferenceTargets(tree) {
  let tableCount = 0
  visit(tree, 'table', (node) => {
    tableCount++
    node.data ??= {}
    node.data.hProperties ??= {}
    node.data.hProperties.id = `table-${tableCount}`
  })

  let figureCount = 0
  visit(tree, 'image', (node) => {
    figureCount++
    node.data ??= {}
    node.data.hProperties ??= {}
    node.data.hProperties.id = `figure-${figureCount}`
  })
}

/**
 * Text inside a link is its label (or an autolinked address such as
 * sales@section-2.com), so references there stay text: a reference link
 * inside a link would nest anchors. Typography still applies.
 */
function transformTextNodes(node, inLink = false) {
  if (!Array.isArray(node.children)) {
    return
  }

  node.children = node.children.flatMap((child) => {
    if (child.type !== 'text' || !child.value) {
      transformTextNodes(child, inLink || child.type === 'link' || child.type === 'linkReference')
      return [child]
    }

    for (const [name, pattern] of Object.entries(TEXT_PATTERNS)) {
      pattern.lastIndex = 0
      if (!(inLink && name === 'internalRef') && pattern.test(child.value)) {
        return processTextFormatting(child.value, inLink)
      }
    }
    return [child]
  })
}

/**
 * Process text formatting and return array of nodes
 */
function processTextFormatting(text, inLink) {
  for (const pattern of Object.values(TEXT_PATTERNS)) {
    pattern.lastIndex = 0
  }
  const nodes = []
  let currentIndex = 0
  const workingText = text

  // Process all formatting types
  const allMatches = []

  // Find superscripts
  for (const match of workingText.matchAll(TEXT_PATTERNS.superscript)) {
    allMatches.push({
      type: 'superscript',
      match,
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
    })
  }

  // Find subscripts
  for (const match of workingText.matchAll(TEXT_PATTERNS.subscript)) {
    allMatches.push({
      type: 'subscript',
      match,
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
    })
  }

  // Find internal references
  for (const match of inLink ? [] : workingText.matchAll(TEXT_PATTERNS.internalRef)) {
    allMatches.push({
      type: 'internalRef',
      match,
      start: match.index,
      end: match.index + match[0].length,
      refType: match[1],
      refNumber: match[2],
    })
  }

  // Find quotes
  for (const match of workingText.matchAll(TEXT_PATTERNS.quotes)) {
    allMatches.push({
      type: 'quote',
      match,
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
    })
  }

  // Sort matches by position
  allMatches.sort((a, b) => a.start - b.start)

  // Process matches and build nodes
  for (const formatMatch of allMatches) {
    // Patterns can overlap (for example quote content containing another MDD
    // token). The earliest match owns its source range; nested text remains
    // literal inside that transformation instead of being emitted twice.
    if (formatMatch.start < currentIndex) {
      continue
    }
    // Add text before the match
    if (formatMatch.start > currentIndex) {
      const beforeText = workingText.slice(currentIndex, formatMatch.start)
      if (beforeText) {
        nodes.push({
          type: 'text',
          value: beforeText,
        })
      }
    }

    // Add formatted node
    nodes.push(createFormattedNode(formatMatch))

    currentIndex = formatMatch.end
  }

  // Add remaining text
  if (currentIndex < workingText.length) {
    const remainingText = workingText.slice(currentIndex)
    if (remainingText) {
      nodes.push({
        type: 'text',
        value: remainingText,
      })
    }
  }

  // If no formatting found, return original text
  if (nodes.length === 0) {
    return [
      {
        type: 'text',
        value: text,
      },
    ]
  }

  return nodes
}

/**
 * Create formatted node based on match type
 */
function createFormattedNode(formatMatch) {
  switch (formatMatch.type) {
    case 'superscript':
      return {
        type: 'html',
        value: `<sup>${formatMatch.content}</sup>`,
      }

    case 'subscript':
      return {
        type: 'html',
        value: `<sub>${formatMatch.content}</sub>`,
      }

    case 'internalRef':
      const refLabel = formatMatch.refType.charAt(0).toUpperCase() + formatMatch.refType.slice(1)
      return {
        type: 'link',
        url: `#${formatMatch.refType}-${formatMatch.refNumber}`,
        title: `Reference to ${refLabel} ${formatMatch.refNumber}`,
        children: [
          {
            type: 'text',
            value: `${refLabel} ${formatMatch.refNumber}`,
          },
        ],
      }

    case 'quote':
      // Convert straight quotes to professional typographic (curly) quotes.
      return {
        type: 'text',
        value: `“${formatMatch.content}”`,
      }

    default:
      return {
        type: 'text',
        value: formatMatch.match[0],
      }
  }
}

/**
 * Process heading structure and add proper hierarchy
 */
function processHeadingStructure(tree) {
  const sectionCounters = [0, 0, 0, 0, 0, 0] // For H1-H6

  visit(tree, 'heading', (node) => {
    const level = node.depth

    // Increment this level's counter and reset all deeper levels.
    for (let i = level - 1; i < sectionCounters.length; i++) {
      if (i === level - 1) {
        sectionCounters[i]++
      } else {
        sectionCounters[i] = 0
      }
    }

    // Add section numbering to headings (optional)
    if (node.children?.[0]?.value) {
      const text = node.children[0].value

      // Check if heading already has numbering
      if (!/^\d+\./.test(text)) {
        // Add automatic numbering for formal documents
        const numberPrefix = generateSectionNumber(sectionCounters, level)
        if (numberPrefix && level <= 3) {
          // Only number H1-H3
          node.children[0].value = `${numberPrefix} ${text}`
        }
      }

      // Add ID for internal references
      const headingId = generateHeadingId(text, level, sectionCounters)
      node.data ??= {}
      node.data.hProperties ??= {}
      node.data.hProperties.id = headingId
    }
  })
}

/**
 * Generate section number (1, 1.1, 1.1.1)
 */
function generateSectionNumber(counters, level) {
  const relevantCounters = counters.slice(0, level).filter((c) => c > 0)
  return relevantCounters.length > 0 ? relevantCounters.join('.') : ''
}

/**
 * Generate heading ID for internal references
 */
function generateHeadingId(text, level, counters) {
  // Create ID from text (lowercase, replace spaces with hyphens)
  const baseId = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/^-+|-+$/g, '') // Trim hyphens

  // Add section prefix for formal references
  const sectionNumber = generateSectionNumber(counters, level)
  return sectionNumber ? `section-${sectionNumber.replace(/\./g, '-')}` : baseId
}

/**
 * Add a class to a node's hProperties without discarding classes that were
 * already assigned (for example an author-supplied `{.legal-notice}` annotation
 * applied by the document-structure plugin).
 */
function addClassName(node, className) {
  node.data ??= {}
  node.data.hProperties ??= {}
  const existing = node.data.hProperties.className ?? []
  if (!existing.includes(className)) {
    node.data.hProperties.className = [...existing, className]
  }
}

/**
 * Process paragraph structure for better document flow
 */
function processParagraphStructure(tree) {
  visit(tree, 'paragraph', (node) => {
    if (!node.children?.length) return

    const text = node.children
      .map(
        (child) =>
          child.value ?? child.children?.map((grandchild) => grandchild.value ?? '').join('') ?? '',
      )
      .join('')

    // Derived classes are additive: a paragraph can be both long and a legal
    // clause, and neither must clobber an explicit semantic class annotation.
    if (text.length > 200) {
      addClassName(node, 'long-paragraph')
    }

    // Identify legal/formal text patterns
    if (/^(WHEREAS|THEREFORE|PROVIDED|SUBJECT TO)/i.test(text)) {
      addClassName(node, 'legal-clause')
    }

    if (/^\d+\.\s/.test(text)) {
      addClassName(node, 'numbered-item')
    }
  })
}

/**
 * Check if text contains formatting elements
 */
export function hasTextFormatting(text) {
  for (const pattern of Object.values(TEXT_PATTERNS)) {
    if (pattern.test(text)) {
      return true
    }
  }
  return false
}

/**
 * Extract all references from document
 */
export function extractReferences(tree) {
  const references = []

  visit(tree, 'text', (node) => {
    if (!node.value) return

    for (const match of node.value.matchAll(TEXT_PATTERNS.internalRef)) {
      references.push({
        type: match[1],
        number: match[2],
        id: `${match[1]}-${match[2]}`,
      })
    }
  })

  return references
}
