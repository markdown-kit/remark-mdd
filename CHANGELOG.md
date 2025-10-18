# Changelog

All notable changes to @entro314labs/remark-mdd.

## [0.1.0] - 2025-10-18

### Added

- **Initial release** - Extracted from @entro314labs/mdd v0.0.7
- Core remark plugins:
  - `remark-mdd-document-structure` - Process semantic directives
  - `remark-mdd-text-formatting` - Handle professional typography
  - `remark-mdx-conditional` - Conditional MDX processing (experimental)
- Validation library:
  - `validator.js` - Document validation with JSON Schema
  - `plugin-validator.js` - Validation utilities for plugin development
- JSON Schemas:
  - `mdd-document.schema.json` - Complete document schema
  - `document-type-requirements.json` - Per-type requirements (54 types)
- TypeScript definitions:
  - Complete type definitions for all MDD structures
  - Plugin development types
  - Validation types
- Package exports:
  - Main export with all plugins
  - Individual plugin exports
  - Validator exports
  - Schema exports
  - TypeScript type exports

### Features

- Lightweight package (no CLI dependencies)
- Proper package exports for modern Node.js
- Peer dependency on remark (not bundled)
- Full TypeScript support
- JSON Schema for IDE integration
- Comprehensive documentation

### Migration

If you were using `@entro314labs/mdd` for plugins only:

**Before:**
```javascript
import { remarkMddDocumentStructure } from '@entro314labs/mdd';
// or
import remarkMddDocumentStructure from '@entro314labs/mdd/plugins/remark-mdd-document-structure.js';
```

**After:**
```javascript
import { remarkMddDocumentStructure } from '@entro314labs/remark-mdd';
// or
import remarkMddDocumentStructure from '@entro314labs/remark-mdd/plugins/document-structure';
```

### Breaking Changes

None - this is a new package extracted from the main MDD package.
