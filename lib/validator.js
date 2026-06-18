/**
 * MDD Document Validator
 * Comprehensive validation for MDD documents with detailed error reporting
 * @version 0.1.0
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { JSON_SCHEMA, load as loadYaml } from 'js-yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SELF_CLOSING_DIRECTIVES = new Set(['page-break', 'section-break'])
const DOCUMENT_TYPE_ALIASES = {
  'business-proposal': 'proposal',
}
const SCHEMA_PATH = path.join(__dirname, '../schema/mdd-document.schema.json')
const REQUIREMENTS_PATH = path.join(__dirname, '../schema/document-type-requirements.json')

let schemaCache = null
let requirementsCache = null

function loadSchema() {
  if (schemaCache) {
    return schemaCache
  }

  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8')
  schemaCache = JSON.parse(schemaContent)
  return schemaCache
}

/**
 * Load document type requirements from schema
 */
function loadDocumentTypeRequirements() {
  if (requirementsCache) {
    return requirementsCache
  }

  const requirementsContent = fs.readFileSync(REQUIREMENTS_PATH, 'utf-8')
  requirementsCache = JSON.parse(requirementsContent)
  return requirementsCache
}

function loadEnumFromSchema(pathSegments, fallback = []) {
  const schema = loadSchema()
  const definition = pathSegments.reduce((value, segment) => value?.[segment], schema)
  if (!Array.isArray(definition?.enum) || definition.enum.length === 0) {
    return fallback
  }

  return definition.enum
}

let frontmatterValidatorCache = null

/**
 * Compile (once) an AJV validator for the frontmatter sub-schema so the JSON
 * Schema contract (maxLength, patterns, enums, types) is actually enforced —
 * not merely advertised.
 *
 * @returns {import('ajv').ValidateFunction | null}
 */
function getFrontmatterSchemaValidator() {
  if (frontmatterValidatorCache !== null) {
    return frontmatterValidatorCache
  }

  try {
    const schema = loadSchema()
    const frontmatterSchema = schema?.definitions?.frontmatter
    if (!frontmatterSchema) {
      frontmatterValidatorCache = false
      return false
    }

    const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true })
    addFormats(ajv)
    // Validate frontmatter on its own; `required` is reported with richer,
    // field-specific messages by validateFrontmatter, so we skip duplicate
    // required-keyword errors when mapping AJV output.
    frontmatterValidatorCache = ajv.compile(frontmatterSchema)
    return frontmatterValidatorCache
  } catch {
    frontmatterValidatorCache = false
    return false
  }
}

/**
 * Validation error codes
 */
export const ERROR_CODES = {
  // Frontmatter errors
  MISSING_FRONTMATTER: 'MISSING_FRONTMATTER',
  INVALID_FRONTMATTER_YAML: 'INVALID_FRONTMATTER_YAML',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE: 'INVALID_FIELD_TYPE',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
  INVALID_DOCUMENT_TYPE: 'INVALID_DOCUMENT_TYPE',
  INVALID_VERSION_FORMAT: 'INVALID_VERSION_FORMAT',
  INVALID_STATUS: 'INVALID_STATUS',
  INVALID_LANGUAGE_CODE: 'INVALID_LANGUAGE_CODE',
  INVALID_CURRENCY_FORMAT: 'INVALID_CURRENCY_FORMAT',
  SCHEMA_VIOLATION: 'SCHEMA_VIOLATION',

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
}

/**
 * Valid document types (from schema)
 */
const VALID_DOCUMENT_TYPES = loadEnumFromSchema(
  ['definitions', 'frontmatter', 'properties', 'document-type'],
  ['business-letter', 'invoice', 'proposal', 'contract', 'agreement', 'report', 'other'],
)

/**
 * Valid document statuses
 */
const VALID_STATUSES = loadEnumFromSchema(
  ['definitions', 'frontmatter', 'properties', 'status'],
  ['draft', 'final', 'approved', 'pending', 'archived'],
)

/**
 * Valid semantic classes (from schema)
 */
const VALID_SEMANTIC_CLASSES = loadEnumFromSchema(
  ['definitions', 'semanticClass'],
  ['document-section', 'numbered-section', 'legal-notice', 'invoice-title', 'contract-title'],
)

/**
 * Create a validation error
 */
function createError(type, code, message, location = {}, suggestion = '') {
  return {
    type,
    code,
    message,
    location,
    suggestion,
  }
}

/**
 * Validate ISO 8601 date format (YYYY-MM-DD)
 */
function validateDateFormat(dateString) {
  const iso8601Pattern = /^\d{4}-\d{2}-\d{2}$/
  if (!iso8601Pattern.test(dateString)) {
    return false
  }

  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/**
 * Validate version format (semver-like)
 */
function validateVersionFormat(version) {
  return /^\d+\.\d+(\.\d+)?$/.test(version)
}

/**
 * Validate language code (ISO 639-1)
 */
function validateLanguageCode(lang) {
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(lang)
}

/**
 * Validate currency format (e.g., USD 1,234.56)
 */
function validateCurrencyFormat(amount) {
  return /^[A-Z]{3}\s*[0-9,]+\.\d{2}$/.test(amount)
}

/**
 * Match the YAML frontmatter block at the very start of a document.
 * Tolerant of CRLF line endings and an end-of-file closing fence (no trailing
 * newline). The capture group is the raw YAML body between the `---` fences.
 */
const FRONTMATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

/**
 * Parse the document frontmatter using a real YAML parser.
 *
 * Returns a structured result so callers can distinguish:
 * - no frontmatter block present (`present: false`)
 * - malformed YAML (`yamlError` set)
 * - a valid mapping (`frontmatter` populated)
 *
 * The JSON_SCHEMA is used so values are restricted to JSON-compatible types:
 * dates such as `2024-12-15` stay strings (we validate the ISO format
 * ourselves) rather than being coerced to `Date` objects, while genuine
 * booleans and YAML block/flow sequences (`parties`, `cc`, `keywords`, `tags`)
 * parse correctly.
 *
 * @param {string} content
 * @returns {{ present: boolean, frontmatter: Record<string, unknown> | null, yamlError: string | null }}
 */
export function parseFrontmatter(content) {
  const match = content.match(FRONTMATTER_BLOCK)
  if (!match) {
    return { present: false, frontmatter: null, yamlError: null }
  }

  try {
    const parsed = loadYaml(match[1], { schema: JSON_SCHEMA })

    if (parsed === null || parsed === undefined) {
      return { present: true, frontmatter: {}, yamlError: null }
    }

    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        present: true,
        frontmatter: {},
        yamlError: 'Frontmatter must be a YAML mapping of key/value pairs',
      }
    }

    return { present: true, frontmatter: parsed, yamlError: null }
  } catch (err) {
    return {
      present: true,
      frontmatter: null,
      yamlError: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Extract frontmatter metadata from document content.
 *
 * Backwards-compatible wrapper around {@link parseFrontmatter}: returns the
 * parsed mapping, or `null` when no frontmatter block is present or the YAML
 * is malformed.
 *
 * @param {string} content
 * @returns {Record<string, unknown> | null}
 */
export function extractFrontmatter(content) {
  return parseFrontmatter(content).frontmatter
}

/**
 * Coerce a frontmatter value to a trimmed string for presence checks without
 * throwing on non-string scalars (numbers, booleans, dates produced by YAML).
 *
 * @param {unknown} value
 * @returns {string}
 */
function asTrimmedString(value) {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value.trim()
  }
  if (Array.isArray(value)) {
    return value.join(', ').trim()
  }
  return String(value).trim()
}

/**
 * Describe the runtime type of a value for diagnostic messages.
 *
 * @param {unknown} value
 * @returns {string}
 */
function describeType(value) {
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return 'array'
  }
  return typeof value
}

/**
 * Extract directives from document content
 */
export function extractDirectives(content) {
  return parseDirectiveStructure(content).directives
}

const INLINE_DIRECTIVE_PATTERNS = {
  'page-break': /^::page-break\s*::\s*$/,
  'section-break': /^:::\s*section-break\s*:::\s*$/,
}

const BLOCK_DIRECTIVE_PATTERNS = {
  letterhead: /^::letterhead\s*$/,
  header: /^::header\s*$/,
  footer: /^::footer\s*$/,
  'contact-info': /^::contact-info\s*$/,
  'signature-block': /^::signature-block\s*$/,
  'page-break': /^::page-break\s*$/,
  'section-break': /^:::\s*section-break\s*$/,
}

function getInlineDirectiveType(line) {
  for (const [type, pattern] of Object.entries(INLINE_DIRECTIVE_PATTERNS)) {
    if (pattern.test(line)) {
      return type
    }
  }

  return null
}

function getBlockDirectiveType(line) {
  for (const [type, pattern] of Object.entries(BLOCK_DIRECTIVE_PATTERNS)) {
    if (pattern.test(line)) {
      return type
    }
  }

  return null
}

function getEndMarkerType(line) {
  if (/^:::\s*$/.test(line)) {
    return 'section'
  }

  if (/^::\s*$/.test(line)) {
    return 'directive'
  }

  return null
}

function finalizeDirective(currentDirective, directiveContent, hasEndMarker) {
  return {
    type: currentDirective.type,
    content: directiveContent.join('\n').trim(),
    line: currentDirective.line,
    hasEndMarker,
  }
}

/** Match an opening/closing fenced-code delimiter (``` or ~~~, length >= 3). */
const CODE_FENCE = /^(`{3,}|~{3,})/

function parseDirectiveStructure(content) {
  const directives = []
  const orphanedEndMarkers = []
  const nestingViolations = []
  const lines = content.split(/\r?\n/u)

  let currentDirective = null
  let directiveContent = []
  let fenceMarker = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    const lineNumber = i + 1

    // Track fenced code blocks so directive-looking lines inside ``` fences
    // (e.g. examples in documentation) are treated as literal content, never
    // as real directives. This mirrors the remark AST renderer, which never
    // interprets code-block content as directives.
    const fenceMatch = trimmedLine.match(CODE_FENCE)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fenceMarker === null) {
        fenceMarker = marker
      } else if (fenceMarker === marker) {
        fenceMarker = null
      }
      if (currentDirective) {
        directiveContent.push(line)
      }
      continue
    }
    if (fenceMarker !== null) {
      if (currentDirective) {
        directiveContent.push(line)
      }
      continue
    }

    const inlineDirectiveType = getInlineDirectiveType(trimmedLine)
    if (inlineDirectiveType) {
      if (currentDirective) {
        directives.push(finalizeDirective(currentDirective, directiveContent, false))
      }

      directives.push({
        type: inlineDirectiveType,
        content: '',
        line: lineNumber,
        hasEndMarker: true,
      })
      currentDirective = null
      directiveContent = []
      continue
    }

    const endMarkerType = getEndMarkerType(trimmedLine)
    if (endMarkerType) {
      if (currentDirective && currentDirective.endMarkerType === endMarkerType) {
        directives.push(finalizeDirective(currentDirective, directiveContent, true))
        currentDirective = null
        directiveContent = []
      } else {
        orphanedEndMarkers.push({ line: lineNumber, marker: trimmedLine })
      }
      continue
    }

    const blockDirectiveType = getBlockDirectiveType(trimmedLine)
    if (blockDirectiveType) {
      if (currentDirective) {
        // A new directive opened before the previous one was closed: the outer
        // directive is missing its end marker AND a directive cannot be nested
        // inside another. Record the nesting violation for richer diagnostics.
        nestingViolations.push({
          inner: blockDirectiveType,
          outer: currentDirective.type,
          line: lineNumber,
        })
        directives.push(finalizeDirective(currentDirective, directiveContent, false))
      }

      currentDirective = {
        type: blockDirectiveType,
        line: lineNumber,
        endMarkerType: blockDirectiveType === 'section-break' ? 'section' : 'directive',
      }
      directiveContent = []
      continue
    }

    if (currentDirective) {
      directiveContent.push(line)
    }
  }

  if (currentDirective) {
    directives.push(finalizeDirective(currentDirective, directiveContent, false))
  }

  return { directives, orphanedEndMarkers, nestingViolations }
}

/**
 * Validate frontmatter metadata
 */
export function validateFrontmatter(frontmatter, documentType) {
  const errors = []
  const warnings = []

  if (!frontmatter) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.MISSING_FRONTMATTER,
        'Document is missing YAML frontmatter',
        {},
        'Add frontmatter block at the start of the document:\n---\ntitle: Your Title\ndocument-type: business-letter\n---',
      ),
    )
    return { errors, warnings }
  }

  // Required fields. Use type-safe presence checks so a non-string scalar
  // (e.g. `title: true` parsed as a YAML boolean) reports an error instead of
  // throwing a TypeError on `.trim()`.
  if (asTrimmedString(frontmatter.title).length === 0) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        'Missing required field: title',
        { field: 'title' },
        'Add "title: Your Document Title" to frontmatter',
      ),
    )
  } else if (typeof frontmatter.title !== 'string') {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_FIELD_TYPE,
        `Field "title" must be a string (got ${describeType(frontmatter.title)})`,
        { field: 'title' },
        'Quote the value, e.g. title: "1984"',
      ),
    )
  }

  if (frontmatter['document-type'] === undefined || frontmatter['document-type'] === null) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        'Missing required field: document-type',
        { field: 'document-type' },
        `Add "document-type: ${documentType ?? 'business-letter'}" to frontmatter`,
      ),
    )
  } else if (typeof frontmatter['document-type'] !== 'string') {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_FIELD_TYPE,
        `Field "document-type" must be a string (got ${describeType(frontmatter['document-type'])})`,
        { field: 'document-type' },
        'Use a string value such as document-type: business-letter',
      ),
    )
  } else if (!VALID_DOCUMENT_TYPES.includes(frontmatter['document-type'])) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_DOCUMENT_TYPE,
        `Invalid document-type: "${frontmatter['document-type']}"`,
        { field: 'document-type' },
        `Use one of: ${VALID_DOCUMENT_TYPES.slice(0, 5).join(', ')}, ...`,
      ),
    )
  }

  // Date format validation
  if (frontmatter.date && !validateDateFormat(frontmatter.date)) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_DATE_FORMAT,
        `Invalid date format: "${frontmatter.date}" (expected YYYY-MM-DD)`,
        { field: 'date' },
        `Use ISO 8601 format: ${new Date().toISOString().split('T')[0]}`,
      ),
    )
  }

  // Effective date validation
  if (frontmatter['effective-date'] && !validateDateFormat(frontmatter['effective-date'])) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_DATE_FORMAT,
        `Invalid effective-date format: "${frontmatter['effective-date']}" (expected YYYY-MM-DD)`,
        { field: 'effective-date' },
        'Use ISO 8601 format: YYYY-MM-DD',
      ),
    )
  }

  // Expiration date validation
  if (frontmatter['expiration-date'] && !validateDateFormat(frontmatter['expiration-date'])) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_DATE_FORMAT,
        `Invalid expiration-date format: "${frontmatter['expiration-date']}" (expected YYYY-MM-DD)`,
        { field: 'expiration-date' },
        'Use ISO 8601 format: YYYY-MM-DD',
      ),
    )
  }

  // Due date validation
  if (frontmatter['due-date'] && !validateDateFormat(frontmatter['due-date'])) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_DATE_FORMAT,
        `Invalid due-date format: "${frontmatter['due-date']}" (expected YYYY-MM-DD)`,
        { field: 'due-date' },
        'Use ISO 8601 format: YYYY-MM-DD',
      ),
    )
  }

  // Version format validation
  if (frontmatter.version && !validateVersionFormat(frontmatter.version)) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_VERSION_FORMAT,
        `Invalid version format: "${frontmatter.version}" (expected X.Y or X.Y.Z)`,
        { field: 'version' },
        'Use semantic versioning: 1.0 or 1.0.0',
      ),
    )
  }

  // Status validation
  if (frontmatter.status && !VALID_STATUSES.includes(frontmatter.status)) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_STATUS,
        `Invalid status: "${frontmatter.status}"`,
        { field: 'status' },
        `Use one of: ${VALID_STATUSES.join(', ')}`,
      ),
    )
  }

  // Language code validation
  if (frontmatter.language && !validateLanguageCode(frontmatter.language)) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_LANGUAGE_CODE,
        `Invalid language code: "${frontmatter.language}" (expected ISO 639-1 format)`,
        { field: 'language' },
        'Use ISO 639-1 format: en, en-US, el-GR, etc.',
      ),
    )
  }

  // Currency format validation
  if (frontmatter['total-amount'] && !validateCurrencyFormat(frontmatter['total-amount'])) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_CURRENCY_FORMAT,
        `Invalid total-amount format: "${frontmatter['total-amount']}" (expected "CCC #,###.##")`,
        { field: 'total-amount' },
        'Use format: USD 1,234.56',
      ),
    )
  }

  return { errors, warnings }
}

/**
 * Validate directives
 */
export function validateDirectives(directives) {
  const parsedDirectiveState = Array.isArray(directives)
    ? { directives, orphanedEndMarkers: [] }
    : directives
  const errors = []
  const warnings = []
  const directiveCounts = {}

  for (const orphanedEndMarker of parsedDirectiveState.orphanedEndMarkers ?? []) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.ORPHANED_END_MARKER,
        `End marker ${orphanedEndMarker.marker} at line ${orphanedEndMarker.line} does not match an open directive`,
        { line: orphanedEndMarker.line },
        'Remove the stray end marker or add the matching opening directive',
      ),
    )
  }

  for (const violation of parsedDirectiveState.nestingViolations ?? []) {
    errors.push(
      createError(
        'error',
        ERROR_CODES.INVALID_DIRECTIVE_NESTING,
        `Directive ::${violation.inner} at line ${violation.line} starts before ::${violation.outer} was closed; MDD directives cannot be nested`,
        { line: violation.line, directive: violation.inner },
        `Close ::${violation.outer} with :: before opening ::${violation.inner}`,
      ),
    )
  }

  for (const directive of parsedDirectiveState.directives ?? []) {
    // Track directive occurrences
    directiveCounts[directive.type] = (directiveCounts[directive.type] ?? 0) + 1

    // Check for missing end markers
    if (!directive.hasEndMarker && !SELF_CLOSING_DIRECTIVES.has(directive.type)) {
      errors.push(
        createError(
          'error',
          ERROR_CODES.MISSING_END_MARKER,
          `Directive ::${directive.type} at line ${directive.line} is missing end marker ::`,
          { line: directive.line, directive: directive.type },
          `Add :: on its own line after the ${directive.type} content`,
        ),
      )
    }

    // Check for empty directives
    if (
      directive.hasEndMarker &&
      !SELF_CLOSING_DIRECTIVES.has(directive.type) &&
      directive.content.trim().length === 0
    ) {
      warnings.push(
        createError(
          'warning',
          ERROR_CODES.EMPTY_DIRECTIVE,
          `Directive ::${directive.type} at line ${directive.line} is empty`,
          { line: directive.line, directive: directive.type },
          `Add content inside the ::${directive.type} block or remove it`,
        ),
      )
    }
  }

  return { errors, warnings, directiveCounts }
}

/**
 * Validate document type requirements
 */
export function validateDocumentTypeRequirements(frontmatter, directives, directiveCounts) {
  const errors = []
  const warnings = []

  const documentType = frontmatter?.['document-type']
  if (!documentType || documentType === 'other') {
    return { errors, warnings }
  }

  const requirements = loadDocumentTypeRequirements()
  const requirementKey = [documentType, DOCUMENT_TYPE_ALIASES[documentType]].find(
    (candidate) => candidate && requirements.documentTypes[candidate],
  )
  const typeRequirements = requirementKey ? requirements.documentTypes[requirementKey] : null

  if (!typeRequirements) {
    return { errors, warnings }
  }

  // Check required directives
  for (const requiredDirective of typeRequirements.requiredDirectives ?? []) {
    if (!directiveCounts[requiredDirective] || directiveCounts[requiredDirective] === 0) {
      errors.push(
        createError(
          'error',
          ERROR_CODES.MISSING_REQUIRED_DIRECTIVE,
          `Document type "${documentType}" requires ::${requiredDirective} directive`,
          { directive: requiredDirective },
          `Add ::${requiredDirective} block to your document`,
        ),
      )
    }
  }

  // Check recommended directives
  for (const recommendedDirective of typeRequirements.recommendedDirectives ?? []) {
    if (!directiveCounts[recommendedDirective] || directiveCounts[recommendedDirective] === 0) {
      warnings.push(
        createError(
          'warning',
          ERROR_CODES.MISSING_REQUIRED_DIRECTIVE,
          `Document type "${documentType}" recommends ::${recommendedDirective} directive`,
          { directive: recommendedDirective },
          `Consider adding ::${recommendedDirective} block to your document`,
        ),
      )
    }
  }

  // Check required metadata
  for (const requiredField of typeRequirements.requiredMetadata ?? []) {
    if (!frontmatter[requiredField] || String(frontmatter[requiredField]).trim().length === 0) {
      errors.push(
        createError(
          'error',
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          `Document type "${documentType}" requires frontmatter field: ${requiredField}`,
          { field: requiredField },
          `Add "${requiredField}: value" to your frontmatter`,
        ),
      )
    }
  }

  // Check recommended metadata
  for (const recommendedField of typeRequirements.recommendedMetadata ?? []) {
    if (
      !frontmatter[recommendedField] ||
      String(frontmatter[recommendedField]).trim().length === 0
    ) {
      warnings.push(
        createError(
          'warning',
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          `Document type "${documentType}" recommends frontmatter field: ${recommendedField}`,
          { field: recommendedField },
          `Consider adding "${recommendedField}: value" to your frontmatter`,
        ),
      )
    }
  }

  // Check max directive occurrences
  for (const [directive, maxCount] of Object.entries(
    typeRequirements.maxDirectiveOccurrences ?? {},
  )) {
    if (directiveCounts[directive] && directiveCounts[directive] > maxCount) {
      warnings.push(
        createError(
          'warning',
          ERROR_CODES.DUPLICATE_DIRECTIVE,
          `Directive ::${directive} appears ${directiveCounts[directive]} times (maximum ${maxCount} recommended)`,
          { directive },
          maxCount === 1
            ? `Keep only one ::${directive} directive`
            : `Reduce to ${maxCount} ::${directive} directives`,
        ),
      )
    }
  }

  return { errors, warnings }
}

/**
 * Split content into lines, marking which lines fall inside fenced code blocks
 * so validators can ignore directive/class/typography syntax shown as examples.
 *
 * @param {string} content
 * @returns {Array<{ text: string, inFence: boolean, number: number }>}
 */
function annotateLines(content) {
  const lines = content.split(/\r?\n/u)
  const annotated = []
  let fenceMarker = null

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    const fenceMatch = trimmed.match(CODE_FENCE)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      const wasInFence = fenceMarker !== null
      if (fenceMarker === null) {
        fenceMarker = marker
      } else if (fenceMarker === marker) {
        fenceMarker = null
      }
      // The fence delimiter line itself is part of the code block.
      annotated.push({ text: lines[i], inFence: true, number: i + 1, isFence: true, wasInFence })
      continue
    }
    annotated.push({ text: lines[i], inFence: fenceMarker !== null, number: i + 1, isFence: false })
  }

  return annotated
}

/**
 * Validate semantic classes in content.
 *
 * Distinguishes syntactically malformed class annotations (INVALID_SEMANTIC_CLASS,
 * e.g. uppercase or spaces) from well-formed-but-unrecognized ones
 * (UNKNOWN_SEMANTIC_CLASS). Class annotations inside fenced code blocks are
 * ignored.
 */
export function validateSemanticClasses(content) {
  const errors = []
  const warnings = []

  // Broad match so malformed class bodies are still caught.
  const classPattern = /\{\.([^}]+)\}/g
  const wellFormed = /^[a-z][a-z0-9-]*$/

  for (const { text, inFence, number } of annotateLines(content)) {
    if (inFence) {
      continue
    }

    let match
    while ((match = classPattern.exec(text)) !== null) {
      const className = match[1].trim()

      if (!wellFormed.test(className)) {
        errors.push(
          createError(
            'error',
            ERROR_CODES.INVALID_SEMANTIC_CLASS,
            `Malformed semantic class: {.${className}} at line ${number}`,
            { line: number },
            'Class names must be lowercase kebab-case, e.g. {.legal-notice}',
          ),
        )
        continue
      }

      if (!VALID_SEMANTIC_CLASSES.includes(className)) {
        warnings.push(
          createError(
            'warning',
            ERROR_CODES.UNKNOWN_SEMANTIC_CLASS,
            `Unknown semantic class: {.${className}} at line ${number}`,
            { line: number },
            `Valid classes: ${VALID_SEMANTIC_CLASSES.slice(0, 5).join(', ')}, ...`,
          ),
        )
      }
    }
  }

  return { errors, warnings }
}

/**
 * Validate professional typography patterns (superscript `^x^`, subscript `~x~`).
 *
 * Emits MALFORMED_PATTERN when a superscript/subscript body contains whitespace
 * (the renderer would not match it), and OVERLAPPING_FORMATTING when a
 * superscript and subscript region overlap on the same line. Patterns inside
 * fenced code blocks are ignored.
 *
 * @param {string} content
 * @returns {{ errors: Array, warnings: Array }}
 */
export function validateTextFormatting(content) {
  const errors = []
  const warnings = []

  // Superscript bodies exclude `^`; subscript bodies exclude `~` and avoid
  // GFM strikethrough (`~~...~~`) via negative look-arounds. A body containing
  // the OTHER marker indicates interleaved/overlapping formatting.
  const patterns = [
    { kind: 'superscript', marker: '^', re: /\^([^^]+)\^/g, other: '~' },
    { kind: 'subscript', marker: '~', re: /(?<!~)~([^~]+)~(?!~)/g, other: '^' },
  ]

  for (const { text, inFence, number } of annotateLines(content)) {
    if (inFence) {
      continue
    }

    for (const { kind, marker, re, other } of patterns) {
      re.lastIndex = 0
      let match
      while ((match = re.exec(text)) !== null) {
        const body = match[1]

        if (body.includes(other)) {
          warnings.push(
            createError(
              'warning',
              ERROR_CODES.OVERLAPPING_FORMATTING,
              `Overlapping superscript/subscript formatting at line ${number}`,
              { line: number },
              'Separate superscript and subscript spans so they do not overlap',
            ),
          )
          continue
        }

        if (/\s/.test(body)) {
          warnings.push(
            createError(
              'warning',
              ERROR_CODES.MALFORMED_PATTERN,
              `${kind} "${marker}${body}${marker}" at line ${number} contains whitespace and will not render`,
              { line: number },
              `Remove the spaces inside the ${kind}, e.g. text${marker}note${marker}`,
            ),
          )
        }
      }
    }
  }

  return { errors, warnings }
}

/**
 * Compute the set of heading anchor ids the text-formatting plugin would
 * generate, so internal references (`@section-1`) can be validated. Mirrors
 * generateSectionNumber/generateHeadingId in remark-mdd-text-formatting.js.
 *
 * @param {string} content
 * @returns {Set<string>}
 */
function computeHeadingIds(content) {
  const ids = new Set()
  const counters = [0, 0, 0, 0, 0, 0]

  for (const { text, inFence } of annotateLines(content)) {
    if (inFence) {
      continue
    }
    const heading = text.match(/^(#{1,6})\s+(.*)$/)
    if (!heading) {
      continue
    }

    const level = heading[1].length
    const title = heading[2].replace(/\s*\{\.[^}]+\}\s*$/, '').trim()

    // Increment this level's counter and reset all deeper levels.
    for (let i = level - 1; i < counters.length; i++) {
      if (i === level - 1) {
        counters[i]++
      } else {
        counters[i] = 0
      }
    }

    const sectionNumber = counters
      .slice(0, level)
      .filter((value) => value > 0)
      .join('.')

    if (sectionNumber) {
      ids.add(`section-${sectionNumber.replace(/\./g, '-')}`)
    }

    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (slug) {
      ids.add(slug)
    }
  }

  return ids
}

/**
 * Validate internal `@section-N` references against the document's headings.
 * Only `section` references are checked because tables/figures do not produce
 * generated anchors in MDD. References inside fenced code blocks are ignored.
 *
 * @param {string} content
 * @returns {{ errors: Array, warnings: Array }}
 */
export function validateReferences(content) {
  const errors = []
  const warnings = []
  const headingIds = computeHeadingIds(content)
  const referencePattern = /@([a-z]+)-(\d+)/g

  for (const { text, inFence, number } of annotateLines(content)) {
    if (inFence) {
      continue
    }
    let match
    while ((match = referencePattern.exec(text)) !== null) {
      const [, refType, refNumber] = match
      if (refType !== 'section') {
        continue
      }
      const targetId = `section-${refNumber}`
      if (!headingIds.has(targetId)) {
        warnings.push(
          createError(
            'warning',
            ERROR_CODES.INVALID_REFERENCE,
            `Internal reference @${refType}-${refNumber} at line ${number} points to a non-existent section`,
            { line: number },
            'Add a heading that resolves to this section number, or fix the reference',
          ),
        )
      }
    }
  }

  return { errors, warnings }
}

/**
 * Conservative directive-order check. MDD does not mandate a strict order
 * (e.g. invoices place ::header before ::letterhead), so this only warns about
 * a clearly out-of-sequence case: a ::signature-block appearing before the
 * ::letterhead that introduces the document.
 *
 * @param {Array<{ type: string, line: number }>} directives
 * @returns {{ errors: Array, warnings: Array }}
 */
export function validateDirectiveOrder(directives) {
  const errors = []
  const warnings = []

  const letterheadIndex = directives.findIndex((d) => d.type === 'letterhead')
  const signatureIndex = directives.findIndex((d) => d.type === 'signature-block')

  if (letterheadIndex !== -1 && signatureIndex !== -1 && signatureIndex < letterheadIndex) {
    warnings.push(
      createError(
        'warning',
        ERROR_CODES.INVALID_DIRECTIVE_ORDER,
        `::signature-block at line ${directives[signatureIndex].line} appears before ::letterhead`,
        { line: directives[signatureIndex].line, directive: 'signature-block' },
        'Place the signature block after the letterhead/body of the document',
      ),
    )
  }

  return { errors, warnings }
}

/**
 * Validate frontmatter against the JSON Schema (AJV).
 *
 * Enforces the schema constraints the hand-written checks do not cover —
 * principally maxLength/minLength and array item rules — so the advertised
 * JSON-Schema contract is actually applied. Keywords already reported with
 * richer messages elsewhere (required fields, enums, formats handled by the
 * dedicated validators) are filtered out to avoid duplicate diagnostics.
 *
 * @param {Record<string, unknown> | null} frontmatter
 * @returns {{ errors: Array, warnings: Array }}
 */
export function validateAgainstSchema(frontmatter) {
  const errors = []
  const warnings = []

  if (!frontmatter || typeof frontmatter !== 'object') {
    return { errors, warnings }
  }

  const validate = getFrontmatterSchemaValidator()
  if (!validate) {
    return { errors, warnings }
  }

  const ok = validate(frontmatter)
  if (ok) {
    return { errors, warnings }
  }

  // Fields whose format/enum is already validated with bespoke messages.
  const handledFields = new Set([
    'document-type',
    'date',
    'effective-date',
    'expiration-date',
    'due-date',
    'version',
    'status',
    'language',
    'total-amount',
  ])
  const handledKeywords = new Set(['required', 'enum', 'pattern', 'format'])

  for (const err of validate.errors ?? []) {
    if (handledKeywords.has(err.keyword)) {
      continue
    }
    const field = ((err.instancePath || '').replace(/^\//, '') || err.params?.missingProperty) ?? ''
    if (field && handledFields.has(field)) {
      continue
    }

    errors.push(
      createError(
        'error',
        ERROR_CODES.SCHEMA_VIOLATION,
        `Frontmatter${field ? ` field "${field}"` : ''} ${err.message}`,
        field ? { field } : {},
        'Adjust the value to satisfy the MDD document schema',
      ),
    )
  }

  return { errors, warnings }
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
    strict = false,
  } = options

  const allErrors = []
  const allWarnings = []

  // Extract frontmatter (with YAML parse diagnostics)
  const { frontmatter, yamlError } = parseFrontmatter(content)

  // Validate frontmatter
  if (validateFrontmatterFlag) {
    if (yamlError) {
      allErrors.push(
        createError(
          'error',
          ERROR_CODES.INVALID_FRONTMATTER_YAML,
          `Frontmatter is not valid YAML: ${yamlError}`,
          {},
          'Fix the YAML syntax in the frontmatter block',
        ),
      )
    }

    const { errors, warnings } = validateFrontmatter(frontmatter, frontmatter?.['document-type'])
    allErrors.push(...errors)
    allWarnings.push(...warnings)

    // Enforce the JSON Schema contract (maxLength, item rules, types).
    const schemaResult = validateAgainstSchema(frontmatter)
    allErrors.push(...schemaResult.errors)
    allWarnings.push(...schemaResult.warnings)
  }

  // Extract and validate directives
  let directives = []
  let directiveCounts = {}

  if (validateDirectivesFlag) {
    const parsedDirectives = parseDirectiveStructure(content)
    const { directives: extractedDirectives } = parsedDirectives
    directives = extractedDirectives
    const { errors, warnings, directiveCounts: counts } = validateDirectives(parsedDirectives)
    directiveCounts = counts
    allErrors.push(...errors)
    allWarnings.push(...warnings)

    const order = validateDirectiveOrder(directives)
    allErrors.push(...order.errors)
    allWarnings.push(...order.warnings)
  }

  // Validate document type requirements
  if (validateRequirementsFlag && frontmatter) {
    const { errors, warnings } = validateDocumentTypeRequirements(
      frontmatter,
      directives,
      directiveCounts,
    )
    allErrors.push(...errors)
    allWarnings.push(...warnings)
  }

  // Validate semantic classes
  if (validateClassesFlag) {
    const { errors, warnings } = validateSemanticClasses(content)
    allErrors.push(...errors)
    allWarnings.push(...warnings)

    // Validate professional typography patterns (superscript/subscript).
    const formatting = validateTextFormatting(content)
    allErrors.push(...formatting.errors)
    allWarnings.push(...formatting.warnings)

    // Validate internal section references.
    const references = validateReferences(content)
    allErrors.push(...references.errors)
    allWarnings.push(...references.warnings)
  }

  const valid = allErrors.length === 0 && (strict ? allWarnings.length === 0 : true)

  return {
    valid,
    errors: allErrors,
    warnings: allWarnings,
    frontmatter,
    directives,
    directiveCounts,
  }
}
