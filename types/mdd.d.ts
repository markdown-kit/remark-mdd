/**
 * TypeScript type definitions for MDD (Markdown Document) format
 * @version 0.1.0
 * @see https://github.com/mdd-spec/mdd
 */

import type { Root, Heading, Paragraph, Text } from 'mdast'
import type { Parent } from 'unist'

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
  | 'section-break'

/**
 * Valid MDD document types
 */
export type DocumentType =
  | 'business-letter'
  | 'invoice'
  | 'business-proposal'
  | 'proposal'
  | 'contract'
  | 'legal-contract'
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
  | 'other'

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
  | 'emphasis'
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
  | 'reference-number'

/**
 * Document status
 */
export type DocumentStatus = 'draft' | 'final' | 'approved' | 'pending' | 'archived'

/**
 * MDD document frontmatter metadata
 */
export interface MDDFrontmatter {
  /** Document title (required) */
  title: string

  /** Type of business document (required) */
  'document-type': DocumentType

  /** Document author or organization */
  author?: string

  /** Document date in ISO 8601 format (YYYY-MM-DD) */
  date?: string

  /** Document version (e.g., 1.0, 2.1.5) */
  version?: string

  /** Document status */
  status?: DocumentStatus

  /** Whether document contains confidential information */
  confidential?: boolean

  /** Reference, case, or tracking number */
  'reference-number'?: string

  /** Legal jurisdiction (for legal documents) */
  jurisdiction?: string

  /** Effective date for contracts/agreements (YYYY-MM-DD) */
  'effective-date'?: string

  /** Expiration date for contracts/agreements (YYYY-MM-DD) */
  'expiration-date'?: string

  /** Parties to contract/agreement */
  parties?: string[]

  /** Subject line (for letters, memos) */
  subject?: string

  /** Primary recipient */
  recipient?: string

  /** Carbon copy recipients */
  cc?: string[]

  /** Invoice number (for invoices) */
  'invoice-number'?: string

  /** Purchase order number */
  'purchase-order'?: string

  /** Payment terms (e.g., Net 30, Due on Receipt) */
  'payment-terms'?: string

  /** Payment due date (YYYY-MM-DD) */
  'due-date'?: string

  /** Total amount with currency code (e.g., USD 1,234.56) */
  'total-amount'?: string

  /** Document language (ISO 639-1 code, e.g., en, en-US, el-GR) */
  language?: string

  /** Document keywords for search/categorization */
  keywords?: string[]

  /** Document tags */
  tags?: string[]

  /** Allow additional custom properties */
  [key: string]: string | string[] | boolean | undefined
}

/**
 * Text formatting pattern types
 */
export type TextFormattingType = 'superscript' | 'subscript' | 'internalRef'

/**
 * Validation error severity
 */
export type ValidationSeverity = 'error' | 'warning' | 'info'

/**
 * Location information for validation errors
 */
export interface ValidationLocation {
  /** Line number (1-indexed) */
  line?: number

  /** Column number (1-indexed) */
  column?: number

  /** Directive name if applicable */
  directive?: string

  /** Field name if applicable */
  field?: string
}

/**
 * Validation error/warning/info message
 */
export interface ValidationError {
  /** Severity level */
  type: ValidationSeverity

  /** Error code (e.g., MISSING_END_MARKER, LEGACY_DIRECTIVE_SYNTAX, INVALID_DATE_FORMAT) */
  code: string

  /** Human-readable error message */
  message: string

  /** Location in document */
  location?: ValidationLocation

  /** Suggested fix */
  suggestion?: string
}

/**
 * Validation result returned by `validateDocument()`
 */
export interface ValidationResult {
  /** Whether document is valid (no errors; in strict mode also no warnings) */
  valid: boolean

  /** Validation errors */
  errors: ValidationError[]

  /** Validation warnings */
  warnings: ValidationError[]

  /** Parsed frontmatter mapping, or null when absent/malformed */
  frontmatter: Record<string, unknown> | null

  /** Directives found in the document body */
  directives: DirectiveOccurrence[]

  /** Occurrence count per directive type */
  directiveCounts: Partial<Record<DirectiveType, number>>
}

/**
 * Directive occurrence in document
 */
export interface DirectiveOccurrence {
  /** Directive type */
  type: DirectiveType

  /** Content inside directive */
  content: string

  /** Line number where directive starts (1-indexed) */
  line: number

  /** Whether directive has proper end marker */
  hasEndMarker: boolean
  /** True when the directive was written in the MDD 2 spelling (`::name` … `::`). */
  legacy: boolean

  /** Column number where directive starts (1-indexed) */
  column?: number
}

/**
 * Text formatting match
 */
export interface TextFormattingMatch {
  /** Formatting type */
  type: TextFormattingType

  /** Regex match result */
  match: RegExpMatchArray

  /** Start position in text */
  start: number

  /** End position in text */
  end: number

  /** Formatted content */
  content?: string

  /** Reference type (for internal refs) */
  refType?: string

  /** Reference number (for internal refs) */
  refNumber?: string
}

/**
 * Document type requirements
 */
export interface DocumentTypeRequirements {
  /** Directives that MUST be present */
  requiredDirectives: DirectiveType[]

  /** Directives that SHOULD be present */
  recommendedDirectives: DirectiveType[]

  /** Frontmatter fields that MUST be present */
  requiredMetadata: Array<keyof MDDFrontmatter>

  /** Frontmatter fields that SHOULD be present */
  recommendedMetadata: Array<keyof MDDFrontmatter>

  /** Maximum allowed occurrences per directive type */
  maxDirectiveOccurrences: Partial<Record<DirectiveType, number>>
}

/**
 * Complete parsed MDD document
 */
export interface MDDDocument {
  /** Frontmatter metadata */
  frontmatter: MDDFrontmatter

  /** Document body content */
  content: string

  /** Extracted directives */
  directives?: DirectiveOccurrence[]

  /** Validation result */
  validation?: ValidationResult

  /** AST root node */
  ast?: Root
}

/**
 * Semantic container emitted by remark-mdd-document-structure for a block
 * directive. The mdast node type is `blockquote` (so nested Markdown is
 * preserved); `data.hName`/`hProperties` render it as a classed `<div>`.
 */
export interface MDDDirectiveContainer extends Parent {
  type: 'blockquote'
  data: {
    hName: 'div'
    hProperties: {
      className: [DirectiveContainerClass]
      'data-mdd-directive': DirectiveContainerClass
    }
  }
}

/**
 * CSS class (and `data-mdd-directive` value) of a rendered directive container
 */
export type DirectiveContainerClass =
  | 'letterhead'
  | 'signature'
  | 'header'
  | 'footer'
  | 'contactinfo'
  | 'page-break'
  | 'section-break'

/**
 * Extended mdast nodes with MDD-specific data
 */
export interface MDDHeading extends Heading {
  data?: {
    hProperties?: {
      className?: string[]
      id?: string
    }
    sectionNumber?: string
  }
}

export interface MDDParagraph extends Paragraph {
  data?: {
    hProperties?: {
      className?: string[]
    }
    directive?: DirectiveType
  }
}

export interface MDDText extends Text {
  data?: {
    formatted?: boolean
    formattingType?: TextFormattingType
  }
}

/**
 * Options accepted by `validateDocument(content, options)`.
 * Every flag defaults to `true` except `strict`.
 */
export interface MDDValidationOptions {
  /** Validate frontmatter presence, required fields, formats and JSON Schema */
  validateFrontmatterFlag?: boolean

  /** Validate directive structure (end markers, nesting, unknown directives) */
  validateDirectivesFlag?: boolean

  /** Validate document-type requirements (required/recommended directives and metadata) */
  validateRequirementsFlag?: boolean

  /** Validate semantic classes, typography patterns and `@section-N` references */
  validateClassesFlag?: boolean

  /** Treat warnings as errors when computing `valid` */
  strict?: boolean
}

/**
 * Options accepted by `@markdownkit/mdd/preview` `generateMddHtml(content, options)`
 */
export interface PreviewOptions {
  /** Path used to select `.mdd` processing (defaults to `preview.mdd`) */
  filePath?: string

  /** Compute and embed the validation report (default true) */
  validate?: boolean
}

/**
 * CLI validation result
 */
export interface CLIValidationResult extends ValidationResult {
  /** Input file path */
  filePath: string

  /** Processing time in milliseconds */
  processingTime: number

  /** Number of directives found */
  directiveCount: number

  /** Exit code (0 = success, 1 = errors, 2 = warnings in strict mode) */
  exitCode: number
}
