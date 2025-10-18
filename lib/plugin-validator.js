/**
 * Plugin Validation Utilities
 * Provides validation helpers for remark plugins with detailed error messages
 * @version 0.1.0
 */

/**
 * Validation error class
 */
export class PluginValidationError extends Error {
  constructor(code, message, location = {}) {
    super(message);
    this.name = 'PluginValidationError';
    this.code = code;
    this.location = location;
  }
}

/**
 * Validate directive has proper end marker
 */
export function validateDirectiveEndMarker(directiveType, startNode, endNode, file) {
  if (!endNode) {
    const message = `Directive ::${directiveType} is missing end marker ::`;
    if (file && file.message) {
      file.message(message, startNode, 'mdd:missing-end-marker');
    }
    return false;
  }
  return true;
}

/**
 * Validate directive content is not empty
 */
export function validateDirectiveContent(directiveType, content, node, file) {
  if (!content || content.trim().length === 0) {
    const message = `Directive ::${directiveType} is empty`;
    if (file && file.message) {
      file.message(message, node, 'mdd:empty-directive');
    }
    return false;
  }
  return true;
}

/**
 * Validate directive nesting
 */
export function validateDirectiveNesting(currentDirective, parentDirective, node, file) {
  // Define allowed nesting rules
  const nestingRules = {
    letterhead: [], // Letterhead cannot contain other directives
    header: [],
    footer: [],
    'contact-info': [],
    'signature-block': []
  };

  const allowed = nestingRules[parentDirective] || [];

  if (parentDirective && !allowed.includes(currentDirective)) {
    const message = `Directive ::${currentDirective} cannot be nested inside ::${parentDirective}`;
    if (file && file.message) {
      file.message(message, node, 'mdd:invalid-nesting');
    }
    return false;
  }

  return true;
}

/**
 * Validate directive occurrence count
 */
export function validateDirectiveOccurrence(directiveType, count, maxAllowed, file) {
  if (maxAllowed && count > maxAllowed) {
    const message = `Directive ::${directiveType} appears ${count} times (maximum ${maxAllowed} allowed)`;
    if (file && file.message) {
      file.message(message, null, 'mdd:duplicate-directive');
    }
    return false;
  }
  return true;
}

/**
 * Validate semantic class
 */
export function validateSemanticClass(className, node, file) {
  const validClasses = [
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

  if (!validClasses.includes(className)) {
    const message = `Unknown semantic class: {.${className}}`;
    if (file && file.message) {
      file.message(message, node, 'mdd:unknown-semantic-class');
    }
    return false;
  }

  return true;
}

/**
 * Validate text formatting pattern
 */
export function validateTextPattern(patternType, match, node, file) {
  // Check for nested patterns
  const content = match[1];

  if (patternType === 'superscript' && content.includes('~')) {
    const message = 'Superscript cannot contain subscript markers';
    if (file && file.message) {
      file.message(message, node, 'mdd:nested-formatting');
    }
    return false;
  }

  if (patternType === 'subscript' && content.includes('^')) {
    const message = 'Subscript cannot contain superscript markers';
    if (file && file.message) {
      file.message(message, node, 'mdd:nested-formatting');
    }
    return false;
  }

  // Check for whitespace in formatting
  if ((patternType === 'superscript' || patternType === 'subscript') && /\s/.test(content)) {
    const message = `${patternType} content should not contain whitespace`;
    if (file && file.message) {
      file.message(message, node, 'mdd:malformed-formatting');
    }
    return false;
  }

  return true;
}

/**
 * Validate internal reference
 */
export function validateInternalReference(refType, refNumber, node, file, sectionTracker = {}) {
  const targetId = `${refType}-${refNumber}`;

  if (sectionTracker && !sectionTracker[targetId]) {
    const message = `Reference @${targetId} points to non-existent section`;
    if (file && file.message) {
      file.message(message, node, 'mdd:broken-reference');
    }
    return false;
  }

  return true;
}

/**
 * Track directive occurrences for validation
 */
export class DirectiveTracker {
  constructor() {
    this.counts = {};
    this.locations = {};
  }

  add(directiveType, node) {
    this.counts[directiveType] = (this.counts[directiveType] || 0) + 1;

    if (!this.locations[directiveType]) {
      this.locations[directiveType] = [];
    }

    this.locations[directiveType].push(node);
  }

  getCount(directiveType) {
    return this.counts[directiveType] || 0;
  }

  getLocations(directiveType) {
    return this.locations[directiveType] || [];
  }

  validate(directiveType, maxAllowed, file) {
    const count = this.getCount(directiveType);
    return validateDirectiveOccurrence(directiveType, count, maxAllowed, file);
  }
}

/**
 * Track section IDs for reference validation
 */
export class SectionTracker {
  constructor() {
    this.sections = {};
  }

  add(sectionId, node) {
    this.sections[sectionId] = node;
  }

  exists(sectionId) {
    return !!this.sections[sectionId];
  }

  getSection(sectionId) {
    return this.sections[sectionId];
  }
}

/**
 * Collect validation messages from vfile
 */
export function collectValidationMessages(file) {
  const errors = [];
  const warnings = [];

  if (!file || !file.messages) {
    return { errors, warnings };
  }

  for (const message of file.messages) {
    const validationMessage = {
      type: message.fatal ? 'error' : 'warning',
      code: message.source || 'UNKNOWN',
      message: message.message || message.reason,
      location: {
        line: message.line,
        column: message.column
      }
    };

    if (message.fatal) {
      errors.push(validationMessage);
    } else {
      warnings.push(validationMessage);
    }
  }

  return { errors, warnings };
}

/**
 * Enhanced file message with location info
 */
export function addFileMessage(file, message, node, code, severity = 'warning') {
  if (!file || !file.message) {
    return;
  }

  const vfileMessage = file.message(message, node, code);

  if (severity === 'error') {
    vfileMessage.fatal = true;
  }

  return vfileMessage;
}
