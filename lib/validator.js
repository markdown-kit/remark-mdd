/**
 * MDD Document Validator
 * Comprehensive validation for MDD documents with detailed error reporting
 * @version 0.1.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load document type requirements from schema
 */
function loadDocumentTypeRequirements() {
  const schemaPath = path.join(__dirname, '../schema/document-type-requirements.json');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  return JSON.parse(schemaContent);
}

/**
 * Validation error codes
 */
export const ERROR_CODES = {
  // Frontmatter errors
  MISSING_FRONTMATTER: 'MISSING_FRONTMATTER',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
  INVALID_DOCUMENT_TYPE: 'INVALID_DOCUMENT_TYPE',
  INVALID_VERSION_FORMAT: 'INVALID_VERSION_FORMAT',
  INVALID_STATUS: 'INVALID_STATUS',
  INVALID_LANGUAGE_CODE: 'INVALID_LANGUAGE_CODE',
  INVALID_CURRENCY_FORMAT: 'INVALID_CURRENCY_FORMAT',

  // Directive errors
  MISSING_END_MARKER: 'MISSING_END_MARKER',
  EMPTY_DIRECTIVE: 'EMPTY_DIRECTIVE',
  INVALID_DIRECTIVE_NESTING: 'INVALID_DIRECTIVE_NESTING',
  DUPLICATE_DIRECTIVE: 'DUPLICATE_DIRECTIVE',
  MISSING_REQUIRED_DIRECTIVE: 'MISSING_REQUIRED_DIRECTIVE',
  ORPHANED_END_MARKER: 'ORPHANED_END_MARKER',

  // Text formatting errors
  INVALID_REFERENCE: 'INVALID_REFERENCE',
  OVERLAPPING_FORMATTING: 'OVERLAPPING_FORMATTING',
  MALFORMED_PATTERN: 'MALFORMED_PATTERN',

  // Semantic class errors
  INVALID_SEMANTIC_CLASS: 'INVALID_SEMANTIC_CLASS',
  UNKNOWN_SEMANTIC_CLASS: 'UNKNOWN_SEMANTIC_CLASS',

  // Document structure
  INVALID_DIRECTIVE_ORDER: 'INVALID_DIRECTIVE_ORDER',
};

/**
 * Valid document types (from schema)
 */
const VALID_DOCUMENT_TYPES = [
  'business-letter', 'business-proposal', 'invoice', 'proposal', 'contract', 'legal-contract', 'agreement',
  'memorandum', 'memo', 'report', 'legal-notice', 'legal-guide',
  'terms-of-service', 'privacy-policy', 'nda', 'employment-contract',
  'purchase-order', 'quote', 'estimate', 'receipt', 'statement',
  'notice', 'certificate', 'affidavit', 'power-of-attorney',
  'will', 'trust', 'deed', 'lease', 'rental-agreement',
  'service-agreement', 'consulting-agreement', 'partnership-agreement',
  'operating-agreement', 'shareholder-agreement', 'articles-of-incorporation',
  'bylaws', 'resolution', 'minutes', 'policy', 'procedure',
  'manual', 'guide', 'specification', 'requirements', 'whitepaper',
  'case-study', 'brief', 'motion', 'complaint', 'answer',
  'discovery', 'subpoena', 'summons', 'warrant', 'order',
  'judgment', 'decree', 'other'
];

/**
 * Valid document statuses
 */
const VALID_STATUSES = ['draft', 'final', 'approved', 'pending', 'archived'];

/**
 * Valid semantic classes (from schema)
 */
const VALID_SEMANTIC_CLASSES = [
  'invoice-title', 'contract-title', 'legal-notice', 'numbered-section',
  'long-paragraph', 'legal-clause', 'numbered-item', 'document-section',
  'subsection', 'section-title', 'important', 'warning', 'note',
  'example', 'quote-block', 'signature-line', 'witness-line',
  'notary-line', 'party-name', 'effective-date', 'expiration-date',
  'payment-terms', 'total-amount', 'item-description', 'item-quantity',
  'item-price', 'subtotal', 'tax', 'total', 'footer-note',
  'page-number', 'confidential-notice', 'copyright-notice',
  'recipient-address', 'sender-address', 'date-line', 'subject-line',
  'salutation', 'closing', 'enclosure', 'cc-line', 'reference-number'
];

/**
 * Create a validation error
 */
function createError(type, code, message, location = {}, suggestion = '') {
  return {
    type,
    code,
    message,
    location,
    suggestion
  };
}

/**
 * Validate ISO 8601 date format (YYYY-MM-DD)
 */
function validateDateFormat(dateString) {
  const iso8601Pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso8601Pattern.test(dateString)) {
    return false;
  }

  // Validate actual date
  const date = new Date(dateString);
  const [year, month, day] = dateString.split('-').map(Number);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Validate version format (semver-like)
 */
function validateVersionFormat(version) {
  return /^\d+\.\d+(\.\d+)?$/.test(version);
}

/**
 * Validate language code (ISO 639-1)
 */
function validateLanguageCode(lang) {
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(lang);
}

/**
 * Validate currency format (e.g., USD 1,234.56)
 */
function validateCurrencyFormat(amount) {
  return /^[A-Z]{3}\s*[0-9,]+\.\d{2}$/.test(amount);
}

/**
 * Extract frontmatter from document content
 */
export function extractFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    return null;
  }

  const frontmatterText = frontmatterMatch[1];
  const metadata = {};

  const lines = frontmatterText.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Handle arrays (YAML format)
    if (value.startsWith('[') && value.endsWith(']')) {
      const arrayContent = value.slice(1, -1);
      metadata[key] = arrayContent
        .split(',')
        .map(item => item.trim().replace(/^["']|["']$/g, ''))
        .filter(item => item.length > 0);
    }
    // Handle booleans
    else if (value === 'true' || value === 'false') {
      metadata[key] = value === 'true';
    }
    // Handle strings
    else {
      // Remove surrounding quotes (both single and double)
      value = value.replace(/^["']|["']$/g, '');
      metadata[key] = value;
    }
  }

  return metadata;
}

/**
 * Extract directives from document content
 */
export function extractDirectives(content) {
  const directives = [];
  const lines = content.split('\n');

  const directivePatterns = {
    letterhead: /^::letterhead\s*$/,
    header: /^::header\s*$/,
    footer: /^::footer\s*$/,
    'contact-info': /^::contact-info\s*$/,
    'signature-block': /^::signature-block\s*$/,
    'page-break': /^::page-break\s*::$/,
    'section-break': /^:::\s*section-break\s*:::$/
  };

  const endMarker = /^::\s*$/;
  let currentDirective = null;
  let directiveContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for directive start
    for (const [type, pattern] of Object.entries(directivePatterns)) {
      if (pattern.test(line)) {
        // Self-closing directives
        if (type === 'page-break' || type === 'section-break') {
          directives.push({
            type,
            content: '',
            line: lineNumber,
            hasEndMarker: true
          });
        } else {
          // Start of block directive
          if (currentDirective) {
            // Previous directive wasn't closed
            directives.push({
              type: currentDirective.type,
              content: directiveContent.join('\n'),
              line: currentDirective.line,
              hasEndMarker: false
            });
          }
          currentDirective = { type, line: lineNumber };
          directiveContent = [];
        }
        break;
      }
    }

    // Check for directive end
    if (currentDirective && endMarker.test(line)) {
      directives.push({
        type: currentDirective.type,
        content: directiveContent.join('\n').trim(),
        line: currentDirective.line,
        hasEndMarker: true
      });
      currentDirective = null;
      directiveContent = [];
      continue;
    }

    // Accumulate directive content
    if (currentDirective && !Object.values(directivePatterns).some(p => p.test(line))) {
      directiveContent.push(line);
    }
  }

  // Handle unclosed directive at end of file
  if (currentDirective) {
    directives.push({
      type: currentDirective.type,
      content: directiveContent.join('\n').trim(),
      line: currentDirective.line,
      hasEndMarker: false
    });
  }

  return directives;
}

/**
 * Validate frontmatter metadata
 */
export function validateFrontmatter(frontmatter, documentType) {
  const errors = [];
  const warnings = [];

  if (!frontmatter) {
    errors.push(createError(
      'error',
      ERROR_CODES.MISSING_FRONTMATTER,
      'Document is missing YAML frontmatter',
      {},
      'Add frontmatter block at the start of the document:\n---\ntitle: Your Title\ndocument-type: business-letter\n---'
    ));
    return { errors, warnings };
  }

  // Required fields
  if (!frontmatter.title || frontmatter.title.trim().length === 0) {
    errors.push(createError(
      'error',
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      'Missing required field: title',
      { field: 'title' },
      'Add "title: Your Document Title" to frontmatter'
    ));
  }

  if (!frontmatter['document-type']) {
    errors.push(createError(
      'error',
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      'Missing required field: document-type',
      { field: 'document-type' },
      `Add "document-type: ${documentType || 'business-letter'}" to frontmatter`
    ));
  } else if (!VALID_DOCUMENT_TYPES.includes(frontmatter['document-type'])) {
    errors.push(createError(
      'error',
      ERROR_CODES.INVALID_DOCUMENT_TYPE,
      `Invalid document-type: "${frontmatter['document-type']}"`,
      { field: 'document-type' },
      `Use one of: ${VALID_DOCUMENT_TYPES.slice(0, 5).join(', ')}, ...`
    ));
  }

  // Date format validation
  if (frontmatter.date && !validateDateFormat(frontmatter.date)) {
    errors.push(createError(
      'error',
      ERROR_CODES.INVALID_DATE_FORMAT,
      `Invalid date format: "${frontmatter.date}" (expected YYYY-MM-DD)`,
      { field: 'date' },
      `Use ISO 8601 format: ${new Date().toISOString().split('T')[0]}`
    ));
  }

  // Effective date validation
  if (frontmatter['effective-date'] && !validateDateFormat(frontmatter['effective-date'])) {
    errors.push(createError(
      'error',
      ERROR_CODES.INVALID_DATE_FORMAT,
      `Invalid effective-date format: "${frontmatter['effective-date']}" (expected YYYY-MM-DD)`,
      { field: 'effective-date' },
      'Use ISO 8601 format: YYYY-MM-DD'
    ));
  }

  // Expiration date validation
  if (frontmatter['expiration-date'] && !validateDateFormat(frontmatter['expiration-date'])) {
    errors.push(createError(
      'error',
      ERROR_CODES.INVALID_DATE_FORMAT,
      `Invalid expiration-date format: "${frontmatter['expiration-date']}" (expected YYYY-MM-DD)`,
      { field: 'expiration-date' },
      'Use ISO 8601 format: YYYY-MM-DD'
    ));
  }

  // Due date validation
  if (frontmatter['due-date'] && !validateDateFormat(frontmatter['due-date'])) {
    errors.push(createError(
      'error',
      ERROR_CODES.INVALID_DATE_FORMAT,
      `Invalid due-date format: "${frontmatter['due-date']}" (expected YYYY-MM-DD)`,
      { field: 'due-date' },
      'Use ISO 8601 format: YYYY-MM-DD'
    ));
  }

  // Version format validation
  if (frontmatter.version && !validateVersionFormat(frontmatter.version)) {
    errors.push(createError(
      'error',
      ERROR_CODES.INVALID_VERSION_FORMAT,
      `Invalid version format: "${frontmatter.version}" (expected X.Y or X.Y.Z)`,
      { field: 'version' },
      'Use semantic versioning: 1.0 or 1.0.0'
    ));
  }

  // Status validation
  if (frontmatter.status && !VALID_STATUSES.includes(frontmatter.status)) {
    errors.push(createError(
      'error',
      ERROR_CODES.INVALID_STATUS,
      `Invalid status: "${frontmatter.status}"`,
      { field: 'status' },
      `Use one of: ${VALID_STATUSES.join(', ')}`
    ));
  }

  // Language code validation
  if (frontmatter.language && !validateLanguageCode(frontmatter.language)) {
    errors.push(createError(
      'error',
      ERROR_CODES.INVALID_LANGUAGE_CODE,
      `Invalid language code: "${frontmatter.language}" (expected ISO 639-1 format)`,
      { field: 'language' },
      'Use ISO 639-1 format: en, en-US, el-GR, etc.'
    ));
  }

  // Currency format validation
  if (frontmatter['total-amount'] && !validateCurrencyFormat(frontmatter['total-amount'])) {
    errors.push(createError(
      'error',
      ERROR_CODES.INVALID_CURRENCY_FORMAT,
      `Invalid total-amount format: "${frontmatter['total-amount']}" (expected "CCC #,###.##")`,
      { field: 'total-amount' },
      'Use format: USD 1,234.56 or EUR 1.234,56'
    ));
  }

  return { errors, warnings };
}

/**
 * Validate directives
 */
export function validateDirectives(directives) {
  const errors = [];
  const warnings = [];
  const directiveCounts = {};

  for (const directive of directives) {
    // Track directive occurrences
    directiveCounts[directive.type] = (directiveCounts[directive.type] || 0) + 1;

    // Check for missing end markers
    if (!directive.hasEndMarker && directive.type !== 'page-break' && directive.type !== 'section-break') {
      errors.push(createError(
        'error',
        ERROR_CODES.MISSING_END_MARKER,
        `Directive ::${directive.type} at line ${directive.line} is missing end marker ::`,
        { line: directive.line, directive: directive.type },
        `Add :: on its own line after the ${directive.type} content`
      ));
    }

    // Check for empty directives
    if (directive.hasEndMarker && directive.content.trim().length === 0) {
      warnings.push(createError(
        'warning',
        ERROR_CODES.EMPTY_DIRECTIVE,
        `Directive ::${directive.type} at line ${directive.line} is empty`,
        { line: directive.line, directive: directive.type },
        `Add content inside the ::${directive.type} block or remove it`
      ));
    }
  }

  return { errors, warnings, directiveCounts };
}

/**
 * Validate document type requirements
 */
export function validateDocumentTypeRequirements(frontmatter, directives, directiveCounts) {
  const errors = [];
  const warnings = [];

  const documentType = frontmatter?.['document-type'];
  if (!documentType || documentType === 'other') {
    return { errors, warnings };
  }

  const requirements = loadDocumentTypeRequirements();
  const typeRequirements = requirements.documentTypes[documentType];

  if (!typeRequirements) {
    return { errors, warnings };
  }

  // Check required directives
  for (const requiredDirective of typeRequirements.requiredDirectives || []) {
    if (!directiveCounts[requiredDirective] || directiveCounts[requiredDirective] === 0) {
      errors.push(createError(
        'error',
        ERROR_CODES.MISSING_REQUIRED_DIRECTIVE,
        `Document type "${documentType}" requires ::${requiredDirective} directive`,
        { directive: requiredDirective },
        `Add ::${requiredDirective} block to your document`
      ));
    }
  }

  // Check recommended directives
  for (const recommendedDirective of typeRequirements.recommendedDirectives || []) {
    if (!directiveCounts[recommendedDirective] || directiveCounts[recommendedDirective] === 0) {
      warnings.push(createError(
        'warning',
        ERROR_CODES.MISSING_REQUIRED_DIRECTIVE,
        `Document type "${documentType}" recommends ::${recommendedDirective} directive`,
        { directive: recommendedDirective },
        `Consider adding ::${recommendedDirective} block to your document`
      ));
    }
  }

  // Check required metadata
  for (const requiredField of typeRequirements.requiredMetadata || []) {
    if (!frontmatter[requiredField] || String(frontmatter[requiredField]).trim().length === 0) {
      errors.push(createError(
        'error',
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        `Document type "${documentType}" requires frontmatter field: ${requiredField}`,
        { field: requiredField },
        `Add "${requiredField}: value" to your frontmatter`
      ));
    }
  }

  // Check recommended metadata
  for (const recommendedField of typeRequirements.recommendedMetadata || []) {
    if (!frontmatter[recommendedField] || String(frontmatter[recommendedField]).trim().length === 0) {
      warnings.push(createError(
        'warning',
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        `Document type "${documentType}" recommends frontmatter field: ${recommendedField}`,
        { field: recommendedField },
        `Consider adding "${recommendedField}: value" to your frontmatter`
      ));
    }
  }

  // Check max directive occurrences
  for (const [directive, maxCount] of Object.entries(typeRequirements.maxDirectiveOccurrences || {})) {
    if (directiveCounts[directive] && directiveCounts[directive] > maxCount) {
      warnings.push(createError(
        'warning',
        ERROR_CODES.DUPLICATE_DIRECTIVE,
        `Directive ::${directive} appears ${directiveCounts[directive]} times (maximum ${maxCount} recommended)`,
        { directive },
        maxCount === 1 ? `Keep only one ::${directive} directive` : `Reduce to ${maxCount} ::${directive} directives`
      ));
    }
  }

  return { errors, warnings };
}

/**
 * Validate semantic classes in content
 */
export function validateSemanticClasses(content) {
  const errors = [];
  const warnings = [];

  // Match {.class-name} patterns
  const classPattern = /\{\.([a-z0-9-]+)\}/g;
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;

    while ((match = classPattern.exec(line)) !== null) {
      const className = match[1];

      if (!VALID_SEMANTIC_CLASSES.includes(className)) {
        warnings.push(createError(
          'warning',
          ERROR_CODES.UNKNOWN_SEMANTIC_CLASS,
          `Unknown semantic class: {.${className}} at line ${i + 1}`,
          { line: i + 1 },
          `Valid classes: ${VALID_SEMANTIC_CLASSES.slice(0, 5).join(', ')}, ...`
        ));
      }
    }
  }

  return { errors, warnings };
}

/**
 * Main validation function
 */
export function validateDocument(content, options = {}) {
  const {
    validateFrontmatterFlag = true,
    validateDirectivesFlag = true,
    validateRequirementsFlag = true,
    validateClassesFlag = true,
    strict = false
  } = options;

  const allErrors = [];
  const allWarnings = [];

  // Extract frontmatter
  const frontmatter = extractFrontmatter(content);

  // Validate frontmatter
  if (validateFrontmatterFlag) {
    const { errors, warnings } = validateFrontmatter(frontmatter, frontmatter?.['document-type']);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  // Extract and validate directives
  let directives = [];
  let directiveCounts = {};

  if (validateDirectivesFlag) {
    directives = extractDirectives(content);
    const { errors, warnings, directiveCounts: counts } = validateDirectives(directives);
    directiveCounts = counts;
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  // Validate document type requirements
  if (validateRequirementsFlag && frontmatter) {
    const { errors, warnings } = validateDocumentTypeRequirements(
      frontmatter,
      directives,
      directiveCounts
    );
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  // Validate semantic classes
  if (validateClassesFlag) {
    const { errors, warnings } = validateSemanticClasses(content);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  const valid = allErrors.length === 0 && (strict ? allWarnings.length === 0 : true);

  return {
    valid,
    errors: allErrors,
    warnings: allWarnings,
    frontmatter,
    directives,
    directiveCounts
  };
}
