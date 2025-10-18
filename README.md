# remark-mdd

[![npm version](https://badge.fury.io/js/@entro314labs%2Fremark-mdd.svg)](https://www.npmjs.com/package/@entro314labs/remark-mdd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[remark](https://github.com/remarkjs/remark) plugins for MDD (Markdown Document) format** - Transform semantic markdown into professional business documents.

## What is MDD?

MDD (Markdown Document) is a semantic document layer that bridges AI-generated markdown with professional business document output. It extends standard markdown with minimal semantic directives to preserve document structure and intent across formats (HTML, PDF, DOCX).

**This package provides the core remark plugins and validation library.** For CLI tools, see [@entro314labs/mdd](https://www.npmjs.com/package/@entro314labs/mdd).

## Features

- 🔌 **Remark plugins** for MDD document structure and text formatting
- ✅ **Validation library** with JSON Schema and TypeScript types
- 📐 **Semantic directives** - letterheads, signatures, headers, footers
- 🎯 **Type-safe** - Complete TypeScript definitions
- 📦 **Lightweight** - Just the plugins, no CLI bloat
- 🔧 **Extensible** - Build custom MDD tools

## Installation

```bash
npm install @entro314labs/remark-mdd
# or
pnpm add @entro314labs/remark-mdd
# or
yarn add @entro314labs/remark-mdd
```

## Usage

### Basic Usage

```javascript
import { remark } from 'remark';
import remarkMddDocumentStructure from '@entro314labs/remark-mdd/plugins/document-structure';
import remarkMddTextFormatting from '@entro314labs/remark-mdd/plugins/text-formatting';
import remarkHtml from 'remark-html';

const processor = remark()
  .use(remarkMddDocumentStructure)
  .use(remarkMddTextFormatting)
  .use(remarkHtml, { sanitize: false });

const result = await processor.process(`
::letterhead
ACME Corporation
123 Business Ave
::

# Invoice

Total: $1,234^00^
`);

console.log(String(result));
```

### Using Named Exports

```javascript
import {
  remarkMddDocumentStructure,
  remarkMddTextFormatting,
  remarkMdxConditional
} from '@entro314labs/remark-mdd';
```

### With Validation

```javascript
import { validateDocument } from '@entro314labs/remark-mdd/validator';

const content = `---
title: My Invoice
document-type: invoice
date: 2024-12-15
---

# Invoice
`;

const validation = validateDocument(content);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

### TypeScript

```typescript
import type {
  MDDFrontmatter,
  DirectiveType,
  ValidationResult
} from '@entro314labs/remark-mdd/types';

const frontmatter: MDDFrontmatter = {
  title: 'My Document',
  'document-type': 'business-letter',
  date: '2024-12-15'
};
```

## Plugins

### `remark-mdd-document-structure`

Transforms MDD semantic directives into LaTeX-style markup that preserves document intent.

**Supported directives:**

- `::letterhead ... ::` - Company/organization header
- `::header ... ::` - Page header
- `::footer ... ::` - Page footer
- `::contact-info ... ::` - Contact details block
- `::signature-block ... ::` - Signature lines
- `::page-break ::` - Force page break
- `::: section-break :::` - Section divider

**Example:**

```markdown
::letterhead
ACME Corporation
123 Business Avenue
San Francisco, CA 94102
::

# Business Proposal
```

### `remark-mdd-text-formatting`

Handles professional typography and text formatting specific to business documents.

**Supported patterns:**

- `text^super^` → `<sup>super</sup>` (superscripts)
- `text~sub~` → `<sub>sub</sub>` (subscripts)
- `@section-1` → Auto-linked internal references
- Automatic section numbering (1, 1.1, 1.1.1)
- Legal clause detection (`WHEREAS`, `THEREFORE`)

**Example:**

```markdown
The total is $1,234^56^

See @section-2 for details.
```

### `remark-mdx-conditional`

Conditional processing for MDX content (experimental).

## Exports

The package provides multiple export paths for different use cases:

```javascript
// Main export (all plugins)
import * from '@entro314labs/remark-mdd';

// Individual plugins
import remarkMddDocumentStructure from '@entro314labs/remark-mdd/plugins/document-structure';
import remarkMddTextFormatting from '@entro314labs/remark-mdd/plugins/text-formatting';
import remarkMdxConditional from '@entro314labs/remark-mdd/plugins/mdx-conditional';

// Validation
import { validateDocument } from '@entro314labs/remark-mdd/validator';
import { validateDirectiveEndMarker } from '@entro314labs/remark-mdd/plugin-validator';

// Schema
import schema from '@entro314labs/remark-mdd/schema';
import requirements from '@entro314labs/remark-mdd/schema/requirements';

// TypeScript types
import type { MDDFrontmatter, ValidationResult } from '@entro314labs/remark-mdd/types';
```

## Validation

The package includes comprehensive document validation:

```javascript
import { validateDocument } from '@entro314labs/remark-mdd/validator';

const result = validateDocument(content, {
  validateFrontmatterFlag: true,
  validateDirectivesFlag: true,
  validateRequirementsFlag: true,
  validateClassesFlag: true,
  strict: false
});

console.log(result);
// {
//   valid: false,
//   errors: [...],
//   warnings: [...],
//   frontmatter: {...},
//   directives: [...],
//   directiveCounts: {...}
// }
```

**Validation features:**

- ✅ Frontmatter schema validation (required fields, date formats)
- ✅ Directive structure validation (end markers, nesting, duplicates)
- ✅ Document type requirements (per-type required/recommended elements)
- ✅ Semantic class validation (whitelist of valid CSS classes)
- ✅ Detailed error messages with line numbers and suggestions

## JSON Schema

JSON Schema definitions are included for IDE integration and validation:

```javascript
import schema from '@entro314labs/remark-mdd/schema';
import requirements from '@entro314labs/remark-mdd/schema/requirements';

// Use with AJV, JSON Schema validators, etc.
```

**VS Code integration:**

```json
{
  "yaml.schemas": {
    "node_modules/@entro314labs/remark-mdd/schema/mdd-document.schema.json#/definitions/frontmatter": "*.mdd"
  }
}
```

## TypeScript Types

Complete TypeScript definitions are provided:

```typescript
import type {
  // Document structure
  MDDFrontmatter,
  MDDDocument,
  DirectiveType,
  DocumentType,
  SemanticClass,

  // Validation
  ValidationResult,
  ValidationError,
  ValidationSeverity,

  // Plugin types
  DirectiveProcessor,
  DirectiveMatch,

  // Requirements
  DocumentTypeRequirements
} from '@entro314labs/remark-mdd/types';
```

## Use Cases

### markdownfix Integration

```javascript
// .remarkrc.js
export default {
  plugins: [
    // ... other plugins
    (await import('@entro314labs/remark-mdd/plugins/document-structure')).default,
    (await import('@entro314labs/remark-mdd/plugins/text-formatting')).default,
  ]
};
```

### Custom Build Tool

```javascript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMddDocumentStructure from '@entro314labs/remark-mdd/plugins/document-structure';
import remarkMddTextFormatting from '@entro314labs/remark-mdd/plugins/text-formatting';
import { validateDocument } from '@entro314labs/remark-mdd/validator';

async function processDocument(content) {
  // Validate first
  const validation = validateDocument(content);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
  }

  // Process with remark
  const result = await unified()
    .use(remarkParse)
    .use(remarkMddDocumentStructure)
    .use(remarkMddTextFormatting)
    .process(content);

  return String(result);
}
```

### Anasa Knowledge Base Integration

```javascript
import { remarkMddDocumentStructure, remarkMddTextFormatting } from '@entro314labs/remark-mdd';

// Add MDD support to your editor pipeline
editor.use(remarkMddDocumentStructure);
editor.use(remarkMddTextFormatting);
```

## Document Types

MDD supports 54+ professional document types with type-specific validation:

```
business-letter, business-proposal, invoice, proposal, contract,
legal-contract, agreement, memorandum, memo, report, legal-notice,
legal-guide, terms-of-service, privacy-policy, nda,
employment-contract, purchase-order, quote, estimate, receipt,
statement, notice, certificate, affidavit, power-of-attorney,
will, trust, deed, lease, rental-agreement, service-agreement,
consulting-agreement, partnership-agreement, operating-agreement,
shareholder-agreement, articles-of-incorporation, bylaws,
resolution, minutes, policy, procedure, manual, guide,
specification, requirements, whitepaper, case-study, brief,
motion, complaint, answer, discovery, subpoena, summons,
warrant, order, judgment, decree, other
```

Each document type has specific required and recommended frontmatter fields and directives.

## CLI Tools

For command-line usage with preview and validation tools, install the main package:

```bash
npm install -g @entro314labs/mdd

# Preview documents
mdd-preview document.mdd

# Validate documents
mdd-validate document.mdd
```

See [@entro314labs/mdd](https://www.npmjs.com/package/@entro314labs/mdd) for CLI documentation.

## Documentation

- **[MDD Specification](https://github.com/entro314-labs/mdd/blob/main/SPECIFICATION.md)** - Complete syntax reference
- **[Validation Guide](https://github.com/entro314-labs/mdd/blob/main/docs/VALIDATION.md)** - Comprehensive validation documentation
- **[Business Documents Catalog](https://github.com/entro314-labs/mdd/blob/main/docs/BUSINESS-DOCUMENTS.md)** - 200+ document types analyzed

## Related Packages

- **[@entro314labs/mdd](https://www.npmjs.com/package/@entro314labs/mdd)** - CLI tools for MDD (preview, validate)
- **[@entro314labs/markdownfix](https://www.npmjs.com/package/@entro314labs/markdownfix)** - Markdown linter/formatter with MDD support
- **[Anasa](https://github.com/entro314-labs/anasa)** - Knowledge base with MDD integration (planned)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](https://github.com/entro314-labs/remark-mdd/blob/main/CONTRIBUTING.md).

## License

MIT © Dominikos Pritis

## Changelog

See [CHANGELOG.md](https://github.com/entro314-labs/remark-mdd/blob/main/CHANGELOG.md) for version history.
