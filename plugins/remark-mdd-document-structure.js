/**
 * MDD Document Structure Plugin
 *
 * Transforms semantic directives into LaTeX-style markup that preserves document intent
 * across output formats (HTML, PDF, DOCX).
 *
 * Semantic directives handled:
 * - ::letterhead ... :: - Company/organization header (semantic, not just styled text)
 * - ::signature-block ... :: - Signature lines (maintains structure across formats)
 * - ::header ... :: / ::footer ... :: - Page headers/footers
 * - ::contact-info ... :: - Contact details block
 * - ::page-break :: - Force page break
 * - ::: section-break ::: - Section divider
 * - {.semantic-class} - CSS class annotations for styling hints
 *
 * Philosophy: Preserve document *intent* (letterhead), not just *appearance* (bold text).
 * This enables high-fidelity conversion to PDF/DOCX while maintaining semantic structure.
 *
 * Architecture: Stage 1 of two-stage conversion (Markdown → LaTeX → Output format)
 */

import { visit } from 'unist-util-visit';

/**
 * Document structure patterns
 */
const STRUCTURE_PATTERNS = {
  letterhead: /^::letterhead$/,
  signatureBlock: /^::signature-block$/,
  pageBreak: /^::page-break$/,
  header: /^::header$/,
  footer: /^::footer$/,
  contactInfo: /^::contact-info$/,
  sectionBreak: /^::: section-break$/,
  directiveEnd: /^::$/,
  sectionEnd: /^:::$/
};

/**
 * MDD document structure plugin
 *
 * Core transformation: ::directive blocks → \begin{directive}...\end{directive} LaTeX markers
 *
 * Why LaTeX intermediate format?
 * - Preserves semantic meaning (letterhead remains letterhead in HTML, PDF, DOCX)
 * - Enables pandoc conversion to high-quality PDF/DOCX
 * - Separates structure (directives) from presentation (styling)
 */
export default function remarkMddDocumentStructure() {
  return function transformer(tree, file) {
    // Only process .mdd files (MDD-specific semantic directives)
    if (!file.path?.endsWith('.mdd')) {
      return;
    }

    processDocumentStructure(tree);
    processSemanticClasses(tree);
  };
}

/**
 * Process document structure elements
 */
function processDocumentStructure(tree) {
  const structureElements = [];
  
  // Find all structure markers
  visit(tree, 'paragraph', (node, index, parent) => {
    if (!node.children || node.children.length === 0) return;

    // Get text from all children (handles bold/italic/etc)
    const allText = node.children
      .map(child => {
        if (child.type === 'text') return child.value;
        if (child.children) {
          return child.children.map(c => c.value || '').join('');
        }
        return '';
      })
      .join('');

    const text = allText.trim();
    const firstLine = text.split('\n')[0].trim();
    const lastLine = text.split('\n').pop().trim();

    // Check for start markers (::letterhead, ::header, etc)
    for (const [type, pattern] of Object.entries(STRUCTURE_PATTERNS)) {
      if (pattern.test(firstLine)) {
        structureElements.push({
          type,
          node,
          index,
          parent,
          text: allText
        });
        break;
      }
    }

    // Also check if this paragraph contains an end marker on last line
    if (STRUCTURE_PATTERNS.directiveEnd.test(lastLine) ||
        STRUCTURE_PATTERNS.sectionEnd.test(lastLine)) {
      const endType = lastLine === '::' ? 'directiveEnd' : 'sectionEnd';
      structureElements.push({
        type: endType,
        node,
        index,
        parent,
        text: allText
      });
    }
  });

  // Process structure elements in pairs (start/end)
  processStructureElements(structureElements);
}

/**
 * Process structure elements into document blocks
 */
function processStructureElements(elements) {
  for (let i = 0; i < elements.length; i++) {
    const startElement = elements[i];
    
    // Skip end markers - they're processed with their start markers
    if (startElement.type === 'directiveEnd' || startElement.type === 'sectionEnd') {
      continue;
    }
    
    // Find corresponding end marker
    const endElement = findEndMarker(startElement, elements, i);
    
    // Create document structure element
    createDocumentElement(startElement, endElement);
  }
}

/**
 * Find corresponding end marker for a start element
 */
function findEndMarker(startElement, elements, startIndex) {
  const endType = getEndMarkerType(startElement.type);
  if (!endType) return null;

  // Check if the end marker is in the same paragraph (last line)
  const lines = startElement.text.split('\n');
  const lastLine = lines[lines.length - 1].trim();

  if (STRUCTURE_PATTERNS[endType].test(lastLine)) {
    // End marker is in the same paragraph
    return startElement;
  }

  // Otherwise look for end marker in next paragraphs
  for (let i = startIndex + 1; i < elements.length; i++) {
    if (elements[i].type === endType) {
      return elements[i];
    }
  }

  return null;
}

/**
 * Get the end marker type for a start element
 */
function getEndMarkerType(startType) {
  switch (startType) {
    case 'letterhead':
    case 'signatureBlock':
    case 'header':
    case 'footer':
    case 'contactInfo':
      return 'directiveEnd';
    case 'sectionBreak':
      return 'sectionEnd';
    case 'pageBreak':
      return null; // No end marker needed
    default:
      return null;
  }
}

/**
 * Create document structure element
 */
function createDocumentElement(startElement, endElement) {
  const { type, parent, index } = startElement;

  switch (type) {
    case 'pageBreak':
      createPageBreak(startElement);
      break;

    case 'letterhead':
      createLetterhead(startElement, endElement);
      break;

    case 'signatureBlock':
      createSignatureBlock(startElement, endElement);
      break;

    case 'header':
      createHeader(startElement, endElement);
      break;

    case 'footer':
      createFooter(startElement, endElement);
      break;

    case 'contactInfo':
      createContactInfo(startElement, endElement);
      break;

    case 'sectionBreak':
      createSectionBreak(startElement, endElement);
      break;
  }
}

/**
 * Create page break element
 */
function createPageBreak(element) {
  // Replace with pandoc-compatible page break
  element.parent.children[element.index] = {
    type: 'html',
    value: '\\newpage'
  };
}

/**
 * Create letterhead block
 */
function createLetterhead(startElement, endElement) {
  if (!endElement) return;
  
  const content = extractContent(startElement, endElement);
  
  // Create letterhead block for pandoc/LaTeX processing
  startElement.parent.children[startElement.index] = {
    type: 'html',
    value: `\\begin{letterhead}\n${content}\n\\end{letterhead}`
  };
  
  // Remove processed content and end marker
  removeContentRange(startElement, endElement);
}

/**
 * Create signature block
 */
function createSignatureBlock(startElement, endElement) {
  if (!endElement) return;
  
  const content = extractContent(startElement, endElement);
  
  // Create signature block for document processing
  startElement.parent.children[startElement.index] = {
    type: 'html', 
    value: `\\begin{signature}\n${content}\n\\end{signature}`
  };
  
  removeContentRange(startElement, endElement);
}

/**
 * Create header block
 */
function createHeader(startElement, endElement) {
  if (!endElement) return;

  const content = extractContent(startElement, endElement);

  // Create header for document processing
  startElement.parent.children[startElement.index] = {
    type: 'html',
    value: `\\begin{header}\n${content}\n\\end{header}`
  };

  removeContentRange(startElement, endElement);
}

/**
 * Create footer block
 */
function createFooter(startElement, endElement) {
  if (!endElement) return;

  const content = extractContent(startElement, endElement);

  // Create footer for document processing
  startElement.parent.children[startElement.index] = {
    type: 'html',
    value: `\\begin{footer}\n${content}\n\\end{footer}`
  };

  removeContentRange(startElement, endElement);
}

/**
 * Create contact info block
 */
function createContactInfo(startElement, endElement) {
  if (!endElement) return;

  const content = extractContent(startElement, endElement);

  // Create contact info block for business documents
  startElement.parent.children[startElement.index] = {
    type: 'html',
    value: `\\begin{contactinfo}\n${content}\n\\end{contactinfo}`
  };

  removeContentRange(startElement, endElement);
}

/**
 * Create section break
 */
function createSectionBreak(startElement, endElement) {
  if (!endElement) return;

  // Simple section break marker
  startElement.parent.children[startElement.index] = {
    type: 'html',
    value: '\\sectionbreak'
  };

  // Remove end marker
  endElement.parent.children.splice(endElement.index, 1);
}

/**
 * Extract content between start and end elements
 */
function extractContent(startElement, endElement) {
  // If start and end are in the same text node (common case)
  if (startElement.index === endElement.index) {
    const text = startElement.text;
    const lines = text.split('\n');
    // Remove first line (::directive) and last line (::)
    const contentLines = lines.slice(1, -1);
    return contentLines.join('\n');
  }

  // Otherwise extract from separate paragraphs
  const parent = startElement.parent;
  const startIndex = startElement.index + 1;
  const endIndex = endElement.index;

  const contentNodes = parent.children.slice(startIndex, endIndex);

  // Convert content nodes to text, preserving structure
  const parts = [];
  for (const node of contentNodes) {
    const text = nodeToText(node);
    if (text) {
      parts.push(text);
    }
  }

  // If end element has content before the :: marker, include it
  if (endElement.text) {
    const lines = endElement.text.split('\n');
    const lastLineIndex = lines.length - 1;
    if (lines[lastLineIndex].trim() === '::') {
      // Remove the :: line and add remaining content
      const endContent = lines.slice(0, lastLineIndex).join('\n').trim();
      if (endContent) {
        parts.push(endContent);
      }
    }
  }

  // Join with double newlines to preserve paragraph breaks
  return parts.join('\n\n');
}

/**
 * Convert AST node to text
 */
function nodeToText(node) {
  switch (node.type) {
    case 'paragraph':
      return node.children.map(child => child.value || '').join('');
    case 'heading':
      return node.children.map(child => child.value || '').join('');
    case 'text':
      return node.value;
    default:
      return '';
  }
}

/**
 * Remove content range between start and end elements
 */
function removeContentRange(startElement, endElement) {
  const parent = startElement.parent;

  // If end marker is in a paragraph with content, just strip the :: from it
  if (endElement.text && endElement.text.trim().endsWith('::')) {
    const lines = endElement.text.split('\n');
    const lastLine = lines[lines.length - 1].trim();

    if (lastLine === '::') {
      // Remove just the :: line from the end element's text
      const newText = lines.slice(0, -1).join('\n');

      // Update the node's text children
      const textChild = endElement.node.children.find(c => c.type === 'text' && c.value.includes('::'));
      if (textChild) {
        textChild.value = textChild.value.replace(/\n?::$/m, '');
      }
    }
  }

  const startIndex = startElement.index + 1;
  const endIndex = endElement.index + 1;

  // Remove content nodes and end marker
  parent.children.splice(startIndex, endIndex - startIndex);
}

/**
 * Process semantic class annotations
 */
function processSemanticClasses(tree) {
  visit(tree, 'heading', (node) => {
    if (!node.children?.[0]?.value) return;
    
    const text = node.children[0].value;
    const classMatch = text.match(/^(.*?)\s*\{\.([^}]+)\}$/);
    
    if (classMatch) {
      const [, title, className] = classMatch;
      
      // Update heading text
      node.children[0].value = title.trim();
      
      // Add semantic class for document processing
      if (!node.data) node.data = {};
      if (!node.data.hProperties) node.data.hProperties = {};
      
      // Store semantic class for pandoc processing
      node.data.hProperties.className = [className];
      
      // Add LaTeX class for professional output
      if (!node.data.hName) node.data.hName = 'section';
    }
  });
  
  // Process semantic classes in paragraphs
  visit(tree, 'paragraph', (node) => {
    if (!node.children?.length) return;
    
    const lastChild = node.children[node.children.length - 1];
    if (!lastChild.value) return;
    
    const classMatch = lastChild.value.match(/^(.*?)\s*\{\.([^}]+)\}$/);
    
    if (classMatch) {
      const [, text, className] = classMatch;
      
      // Update text content
      lastChild.value = text.trim();
      
      // Add semantic class
      if (!node.data) node.data = {};
      if (!node.data.hProperties) node.data.hProperties = {};
      
      node.data.hProperties.className = [className];
    }
  });
}

/**
 * Check if node has document structure element
 */
export function hasDocumentStructure(tree) {
  let hasStructure = false;
  
  visit(tree, 'paragraph', (node) => {
    if (!node.children?.[0]?.value) return;
    
    const text = node.children[0].value.trim();
    
    for (const pattern of Object.values(STRUCTURE_PATTERNS)) {
      if (pattern.test(text)) {
        hasStructure = true;
        return false; // Stop visiting
      }
    }
  });
  
  return hasStructure;
}