/**
 * TypeScript type definitions for MDD (Markdown Document) format
 * @version 0.1.0
 * @see https://github.com/mdd-spec/mdd
 */

import type { Node, Parent, Literal } from 'unist';
import type { Root, Content, Heading, Paragraph, Text } from 'mdast';

/**
 * Valid MDD directive types
 */
export type DirectiveType =
  | 'letterhead'
  | 'header'
  | 'footer'
  | 'contact-info'
  | 'signature-block'
  | 'page-break'
  | 'section-break';

/**
 * Valid MDD document types
 */
export type DocumentType =
  | 'business-letter'
  | 'invoice'
  | 'proposal'
  | 'contract'
  | 'agreement'
  | 'memorandum'
  | 'memo'
  | 'report'
  | 'legal-notice'
  | 'legal-guide'
  | 'terms-of-service'
  | 'privacy-policy'
  | 'nda'
  | 'employment-contract'
  | 'purchase-order'
  | 'quote'
  | 'estimate'
  | 'receipt'
  | 'statement'
  | 'notice'
  | 'certificate'
  | 'affidavit'
  | 'power-of-attorney'
  | 'will'
  | 'trust'
  | 'deed'
  | 'lease'
  | 'rental-agreement'
  | 'service-agreement'
  | 'consulting-agreement'
  | 'partnership-agreement'
  | 'operating-agreement'
  | 'shareholder-agreement'
  | 'articles-of-incorporation'
  | 'bylaws'
  | 'resolution'
  | 'minutes'
  | 'policy'
  | 'procedure'
  | 'manual'
  | 'guide'
  | 'specification'
  | 'requirements'
  | 'whitepaper'
  | 'case-study'
  | 'brief'
  | 'motion'
  | 'complaint'
  | 'answer'
  | 'discovery'
  | 'subpoena'
  | 'summons'
  | 'warrant'
  | 'order'
  | 'judgment'
  | 'decree'
  | 'other';

/**
 * Valid semantic CSS classes for MDD elements
 */
export type SemanticClass =
  | 'invoice-title'
  | 'contract-title'
  | 'legal-notice'
  | 'numbered-section'
  | 'long-paragraph'
  | 'legal-clause'
  | 'numbered-item'
  | 'document-section'
  | 'subsection'
  | 'section-title'
  | 'important'
  | 'warning'
  | 'note'
  | 'example'
  | 'quote-block'
  | 'signature-line'
  | 'witness-line'
  | 'notary-line'
  | 'party-name'
  | 'effective-date'
  | 'expiration-date'
  | 'payment-terms'
  | 'total-amount'
  | 'item-description'
  | 'item-quantity'
  | 'item-price'
  | 'subtotal'
  | 'tax'
  | 'total'
  | 'footer-note'
  | 'page-number'
  | 'confidential-notice'
  | 'copyright-notice'
  | 'recipient-address'
  | 'sender-address'
  | 'date-line'
  | 'subject-line'
  | 'salutation'
  | 'closing'
  | 'enclosure'
  | 'cc-line'
  | 'reference-number';

/**
 * Document status
 */
export type DocumentStatus = 'draft' | 'final' | 'approved' | 'pending' | 'archived';

/**
 * MDD document frontmatter metadata
 */
export interface MDDFrontmatter {
  /** Document title (required) */
  title: string;

  /** Type of business document (required) */
  'document-type': DocumentType;

  /** Document author or organization */
  author?: string;

  /** Document date in ISO 8601 format (YYYY-MM-DD) */
  date?: string;

  /** Document version (e.g., 1.0, 2.1.5) */
  version?: string;

  /** Document status */
  status?: DocumentStatus;

  /** Whether document contains confidential information */
  confidential?: boolean;

  /** Reference, case, or tracking number */
  'reference-number'?: string;

  /** Legal jurisdiction (for legal documents) */
  jurisdiction?: string;

  /** Effective date for contracts/agreements (YYYY-MM-DD) */
  'effective-date'?: string;

  /** Expiration date for contracts/agreements (YYYY-MM-DD) */
  'expiration-date'?: string;

  /** Parties to contract/agreement */
  parties?: string[];

  /** Subject line (for letters, memos) */
  subject?: string;

  /** Primary recipient */
  recipient?: string;

  /** Carbon copy recipients */
  cc?: string[];

  /** Invoice number (for invoices) */
  'invoice-number'?: string;

  /** Purchase order number */
  'purchase-order'?: string;

  /** Payment terms (e.g., Net 30, Due on Receipt) */
  'payment-terms'?: string;

  /** Payment due date (YYYY-MM-DD) */
  'due-date'?: string;

  /** Total amount with currency code (e.g., USD 1,234.56) */
  'total-amount'?: string;

  /** Document language (ISO 639-1 code, e.g., en, en-US, el-GR) */
  language?: string;

  /** Document keywords for search/categorization */
  keywords?: string[];

  /** Document tags */
  tags?: string[];

  /** Allow additional custom properties */
  [key: string]: string | string[] | boolean | undefined;
}

/**
 * Text formatting pattern types
 */
export type TextFormattingType = 'superscript' | 'subscript' | 'internalRef';

/**
 * Validation error severity
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Location information for validation errors
 */
export interface ValidationLocation {
  /** Line number (1-indexed) */
  line?: number;

  /** Column number (1-indexed) */
  column?: number;

  /** Directive name if applicable */
  directive?: string;

  /** Field name if applicable */
  field?: string;
}

/**
 * Validation error/warning/info message
 */
export interface ValidationError {
  /** Severity level */
  type: ValidationSeverity;

  /** Error code (e.g., MISSING_END_MARKER, INVALID_DATE_FORMAT) */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Location in document */
  location?: ValidationLocation;

  /** Suggested fix */
  suggestion?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether document is valid */
  valid: boolean;

  /** Validation errors */
  errors: ValidationError[];

  /** Validation warnings */
  warnings: ValidationError[];

  /** Informational messages */
  info?: ValidationError[];
}

/**
 * Directive occurrence in document
 */
export interface DirectiveOccurrence {
  /** Directive type */
  type: DirectiveType;

  /** Content inside directive */
  content: string;

  /** Line number where directive starts (1-indexed) */
  line: number;

  /** Whether directive has proper end marker */
  hasEndMarker: boolean;

  /** Column number where directive starts (1-indexed) */
  column?: number;
}

/**
 * Text formatting match
 */
export interface TextFormattingMatch {
  /** Formatting type */
  type: TextFormattingType;

  /** Regex match result */
  match: RegExpMatchArray;

  /** Start position in text */
  start: number;

  /** End position in text */
  end: number;

  /** Formatted content */
  content?: string;

  /** Reference type (for internal refs) */
  refType?: string;

  /** Reference number (for internal refs) */
  refNumber?: string;
}

/**
 * Document type requirements
 */
export interface DocumentTypeRequirements {
  /** Directives that MUST be present */
  requiredDirectives: DirectiveType[];

  /** Directives that SHOULD be present */
  recommendedDirectives: DirectiveType[];

  /** Frontmatter fields that MUST be present */
  requiredMetadata: (keyof MDDFrontmatter)[];

  /** Frontmatter fields that SHOULD be present */
  recommendedMetadata: (keyof MDDFrontmatter)[];

  /** Maximum allowed occurrences per directive type */
  maxDirectiveOccurrences: Partial<Record<DirectiveType, number>>;
}

/**
 * Complete parsed MDD document
 */
export interface MDDDocument {
  /** Frontmatter metadata */
  frontmatter: MDDFrontmatter;

  /** Document body content */
  content: string;

  /** Extracted directives */
  directives?: DirectiveOccurrence[];

  /** Validation result */
  validation?: ValidationResult;

  /** AST root node */
  ast?: Root;
}

/**
 * Plugin options for remark-mdd-document-structure
 */
export interface MDDDocumentStructureOptions {
  /** Whether to validate directive nesting */
  validateNesting?: boolean;

  /** Whether to allow multiple occurrences of directives */
  allowMultiple?: boolean;

  /** Custom directive patterns */
  customDirectives?: Record<string, RegExp>;

  /** Strict mode - fail on warnings */
  strict?: boolean;
}

/**
 * Plugin options for remark-mdd-text-formatting
 */
export interface MDDTextFormattingOptions {
  /** Whether to auto-number sections */
  autoNumberSections?: boolean;

  /** Whether to detect legal clauses */
  detectLegalClauses?: boolean;

  /** Whether to validate cross-references */
  validateReferences?: boolean;

  /** Custom formatting patterns */
  customPatterns?: Record<string, RegExp>;
}

/**
 * Section counter state (used by text formatting plugin)
 */
export interface SectionCounter {
  /** H1 counter */
  h1: number;

  /** H2 counter */
  h2: number;

  /** H3 counter */
  h3: number;

  /** Current section ID */
  currentId?: string;
}

/**
 * Extended mdast HTML node for LaTeX markers
 */
export interface LaTeXMarker extends Literal {
  type: 'html';
  value: string;
  data?: {
    directive?: DirectiveType;
    content?: string;
  };
}

/**
 * Extended mdast nodes with MDD-specific data
 */
export interface MDDHeading extends Heading {
  data?: {
    hProperties?: {
      className?: string[];
      id?: string;
    };
    sectionNumber?: string;
  };
}

export interface MDDParagraph extends Paragraph {
  data?: {
    hProperties?: {
      className?: string[];
    };
    directive?: DirectiveType;
  };
}

export interface MDDText extends Text {
  data?: {
    formatted?: boolean;
    formattingType?: TextFormattingType;
  };
}

/**
 * Validator function signature
 */
export type ValidatorFunction = (
  document: MDDDocument,
  requirements?: DocumentTypeRequirements
) => ValidationResult;

/**
 * Directive processor function signature
 */
export type DirectiveProcessor = (
  node: Paragraph,
  index: number,
  parent: Parent
) => LaTeXMarker | null;

/**
 * Pattern match result from document structure plugin
 */
export interface DirectiveMatch {
  /** Directive type */
  type: DirectiveType;

  /** AST node reference */
  node: Paragraph;

  /** Index in parent.children */
  index: number;

  /** Parent node */
  parent: Parent;

  /** Matched text content */
  text: string;
}

/**
 * MDD validation options
 */
export interface MDDValidationOptions {
  /** Validate frontmatter schema */
  validateFrontmatter?: boolean;

  /** Validate directive structure */
  validateDirectives?: boolean;

  /** Validate cross-references */
  validateReferences?: boolean;

  /** Validate document type requirements */
  validateRequirements?: boolean;

  /** Fail on warnings */
  strict?: boolean;

  /** Include informational messages */
  includeInfo?: boolean;
}

/**
 * Preview renderer options
 */
export interface PreviewOptions {
  /** Output file path (default: input.html) */
  output?: string;

  /** Include validation report in HTML */
  includeValidation?: boolean;

  /** Custom CSS path */
  customCSS?: string;

  /** Validate before rendering */
  validate?: boolean;

  /** Fail on validation errors */
  failOnError?: boolean;
}

/**
 * CLI validation result
 */
export interface CLIValidationResult extends ValidationResult {
  /** Input file path */
  filePath: string;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Number of directives found */
  directiveCount: number;

  /** Exit code (0 = success, 1 = errors, 2 = warnings in strict mode) */
  exitCode: number;
}
