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
 * - Internal references: @section-1 → auto-linked section references
 * - Automatic section numbering: 1, 1.1, 1.1.1 for H1-H3 headings
 * - Legal clause detection: WHEREAS, THEREFORE, etc. with semantic classes
 * - Long paragraph detection: Identifies lengthy text blocks for styling
 *
 * Philosophy: Professional documents require precise typography. These patterns enable
 * business-quality output while maintaining human-readable source files.
 *
 * Architecture: Stage 1 of two-stage conversion (text patterns → HTML nodes → final format)
 */

import { visit } from 'unist-util-visit';

/**
 * Text formatting patterns
 */
const TEXT_PATTERNS = {
  // Superscript: text^super^
  superscript: /\^([^^\s]+)\^/g,
  
  // Subscript: text~sub~
  subscript: /~([^~\s]+)~/g,
  
  // Internal references: @section-1, @table-2, @figure-3
  internalRef: /@([a-z]+)-(\d+)/g,
  
  // Quote typography: "text" -> proper quotes
  quotes: /\"([^"]+)\"/g
};

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
      return;
    }

    // Process text formatting in all text nodes
    visit(tree, 'text', (node, index, parent) => {
      if (!node.value) return;
      
      const originalText = node.value;
      let hasFormatting = false;
      
      // Check if text contains any formatting
      for (const pattern of Object.values(TEXT_PATTERNS)) {
        if (pattern.test(originalText)) {
          hasFormatting = true;
          break;
        }
      }
      
      if (!hasFormatting) return;
      
      // Process formatting and create new nodes
      const newNodes = processTextFormatting(originalText);
      
      if (newNodes.length > 1) {
        // Replace single text node with multiple formatted nodes
        parent.children.splice(index, 1, ...newNodes);
      }
    });
    
    // Process heading structure and numbering
    processHeadingStructure(tree);
    
    // Process paragraph structure
    processParagraphStructure(tree);
  };
}

/**
 * Process text formatting and return array of nodes
 */
function processTextFormatting(text) {
  const nodes = [];
  let currentIndex = 0;
  let workingText = text;
  
  // Process all formatting types
  const allMatches = [];
  
  // Find superscripts
  for (const match of workingText.matchAll(TEXT_PATTERNS.superscript)) {
    allMatches.push({
      type: 'superscript',
      match,
      start: match.index,
      end: match.index + match[0].length,
      content: match[1]
    });
  }
  
  // Find subscripts  
  for (const match of workingText.matchAll(TEXT_PATTERNS.subscript)) {
    allMatches.push({
      type: 'subscript',
      match,
      start: match.index,
      end: match.index + match[0].length,
      content: match[1]
    });
  }
  
  // Find internal references
  for (const match of workingText.matchAll(TEXT_PATTERNS.internalRef)) {
    allMatches.push({
      type: 'internalRef',
      match,
      start: match.index,
      end: match.index + match[0].length,
      refType: match[1],
      refNumber: match[2]
    });
  }
  
  // Find quotes
  for (const match of workingText.matchAll(TEXT_PATTERNS.quotes)) {
    allMatches.push({
      type: 'quote',
      match,
      start: match.index,
      end: match.index + match[0].length,
      content: match[1]
    });
  }
  
  // Sort matches by position
  allMatches.sort((a, b) => a.start - b.start);
  
  // Process matches and build nodes
  for (const formatMatch of allMatches) {
    // Add text before the match
    if (formatMatch.start > currentIndex) {
      const beforeText = workingText.slice(currentIndex, formatMatch.start);
      if (beforeText) {
        nodes.push({
          type: 'text',
          value: beforeText
        });
      }
    }
    
    // Add formatted node
    nodes.push(createFormattedNode(formatMatch));
    
    currentIndex = formatMatch.end;
  }
  
  // Add remaining text
  if (currentIndex < workingText.length) {
    const remainingText = workingText.slice(currentIndex);
    if (remainingText) {
      nodes.push({
        type: 'text',
        value: remainingText
      });
    }
  }
  
  // If no formatting found, return original text
  if (nodes.length === 0) {
    return [{
      type: 'text',
      value: text
    }];
  }
  
  return nodes;
}

/**
 * Create formatted node based on match type
 */
function createFormattedNode(formatMatch) {
  switch (formatMatch.type) {
    case 'superscript':
      return {
        type: 'html',
        value: `<sup>${formatMatch.content}</sup>`
      };
      
    case 'subscript':
      return {
        type: 'html',
        value: `<sub>${formatMatch.content}</sub>`
      };
      
    case 'internalRef':
      const refLabel = formatMatch.refType.charAt(0).toUpperCase() + formatMatch.refType.slice(1);
      return {
        type: 'link',
        url: `#${formatMatch.refType}-${formatMatch.refNumber}`,
        title: `Reference to ${refLabel} ${formatMatch.refNumber}`,
        children: [{
          type: 'text',
          value: `${refLabel} ${formatMatch.refNumber}`
        }]
      };
      
    case 'quote':
      return {
        type: 'text',
        value: `"${formatMatch.content}"`  // Use proper typography quotes
      };
      
    default:
      return {
        type: 'text',
        value: formatMatch.match[0]
      };
  }
}

/**
 * Process heading structure and add proper hierarchy
 */
function processHeadingStructure(tree) {
  let sectionCounters = [0, 0, 0, 0, 0, 0]; // For H1-H6
  
  visit(tree, 'heading', (node) => {
    const level = node.depth;
    
    // Reset counters for deeper levels
    for (let i = level; i < sectionCounters.length; i++) {
      if (i === level - 1) {
        sectionCounters[i]++;
      } else {
        sectionCounters[i] = 0;
      }
    }
    
    // Add section numbering to headings (optional)
    if (node.children?.[0]?.value) {
      const text = node.children[0].value;
      
      // Check if heading already has numbering
      if (!/^\d+\./.test(text)) {
        // Add automatic numbering for formal documents
        const numberPrefix = generateSectionNumber(sectionCounters, level);
        if (numberPrefix && level <= 3) { // Only number H1-H3
          node.children[0].value = `${numberPrefix} ${text}`;
        }
      }
      
      // Add ID for internal references
      const headingId = generateHeadingId(text, level, sectionCounters);
      if (!node.data) node.data = {};
      if (!node.data.hProperties) node.data.hProperties = {};
      node.data.hProperties.id = headingId;
    }
  });
}

/**
 * Generate section number (1, 1.1, 1.1.1)
 */
function generateSectionNumber(counters, level) {
  const relevantCounters = counters.slice(0, level).filter(c => c > 0);
  return relevantCounters.length > 0 ? relevantCounters.join('.') : '';
}

/**
 * Generate heading ID for internal references
 */
function generateHeadingId(text, level, counters) {
  // Create ID from text (lowercase, replace spaces with hyphens)
  const baseId = text.toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens
  
  // Add section prefix for formal references
  const sectionNumber = generateSectionNumber(counters, level);
  return sectionNumber ? `section-${sectionNumber.replace(/\./g, '-')}` : baseId;
}

/**
 * Process paragraph structure for better document flow
 */
function processParagraphStructure(tree) {
  visit(tree, 'paragraph', (node) => {
    if (!node.children?.length) return;
    
    // Add proper paragraph spacing classes based on context
    if (!node.data) node.data = {};
    if (!node.data.hProperties) node.data.hProperties = {};
    
    // Check if paragraph follows a heading
    const text = node.children.map(child => 
      child.value || (child.children?.map(grandchild => grandchild.value || '').join('')) || ''
    ).join('');
    
    // Add semantic classes for different paragraph types
    if (text.length > 200) {
      node.data.hProperties.className = ['long-paragraph'];
    }
    
    // Identify legal/formal text patterns
    if (/^(WHEREAS|THEREFORE|PROVIDED|SUBJECT TO)/i.test(text)) {
      node.data.hProperties.className = ['legal-clause'];
    }
    
    if (/^\d+\.\s/.test(text)) {
      node.data.hProperties.className = ['numbered-item'];
    }
  });
}

/**
 * Check if text contains formatting elements
 */
export function hasTextFormatting(text) {
  for (const pattern of Object.values(TEXT_PATTERNS)) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Extract all references from document
 */
export function extractReferences(tree) {
  const references = [];
  
  visit(tree, 'text', (node) => {
    if (!node.value) return;
    
    for (const match of node.value.matchAll(TEXT_PATTERNS.internalRef)) {
      references.push({
        type: match[1],
        number: match[2],
        id: `${match[1]}-${match[2]}`
      });
    }
  });
  
  return references;
}