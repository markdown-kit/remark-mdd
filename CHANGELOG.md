# Changelog

All notable changes to @markdownkit/remark-mdd.

## [Unreleased]

### Changed

- **`DIRECTIVE_NOT_BLOCK_END` validation error; documents that validated before can now fail.** The paragraph scanner that renders MDD without remark-directive (`mdd` preview and convert, the language server) only ends a directive where its closer, or a `::page-break` / `::section-break`, is the last line of a paragraph. The validator now rejects the two cases it accepted but the renderer could not render: a non-blank line directly after a closer or self-closing directive (other than an ATX heading, a `***` / `___` rule or a fence delimiter), which folded the directive into paragraph text; and a closer directly after a list item, table row or blockquote line (including their lazy continuation lines), which became list, table or quote text and left the directive open. Both are fixed by a blank line, as the message says.

### Fixed

- **Directive lines in an indented code block are code.** A line indented four spaces or a tab that starts a block (after a blank line, a heading, a rule or a fence) is an indented code block to Markdown, but the validator counted `:::letterhead` or `::page-break` in it as a directive, and an indented `:::` inside a block as its closer.
- **A `{.class}` annotation applies to a paragraph that wraps onto several lines.** It was only recognised when the whole paragraph was one line, so the SPECIFICATION example (two annotated lines, which Markdown joins into one paragraph) rendered the annotations as text. The trailing annotation now sets the paragraph's class.
- **Messages about an MDD 2 block name its own end marker.** The nesting error told a `::letterhead` block to close with `:::`, which does not close it; it now says `::`. Messages that point at a line (nesting, missing end marker, empty directive, block start/end) spell an MDD 2 opener as written (`::letterhead`), and the directive-order warning uses the MDD 3 spelling (`:::signature-block … :::letterhead`).

## [4.1.0] - 2026-09-16

### Added

- **Four more document statuses.** `status` also accepts `review` (a draft under review), and `sent`, `accepted` and `declined` for a document that went to its recipient, such as a proposal or a quote. A notdocs proposal marked `sent` validated as an `INVALID_STATUS` error before. The schema, the validator's fallback list and the `DocumentStatus` type carry the same nine values.

## [4.0.0] - 2026-09-16

### Changed

- **MDD 3 directive syntax.** A block directive is written `:::letterhead` … `:::` and a self-closing one `::page-break` / `::section-break`: the remark-directive grammar, so any remark-directive pipeline (notdocs, docs sites) parses MDD without this package's paragraph scanner, and a document round-trips through such a pipeline byte for byte. The structure plugin maps `containerDirective` and `leafDirective` nodes straight to semantic containers when remark-directive runs before it, and still scans paragraphs when it does not.
- **The MDD 2 spelling is read for one more major version.** `::name` … `::`, `::page-break ::`, `::: section-break :::` and their block forms parse as before; the validator reports each with a `LEGACY_DIRECTIVE_SYNTAX` warning that points at `mdd-migrate`. A canonical `:::name` block is not closed by a legacy `::` and vice versa.
- Validation messages spell directives the MDD 3 way (`:::letterhead`, `::page-break`).

### Added

- `LEGACY_DIRECTIVE_SYNTAX` error code (a warning).
- The four example documents from `@markdownkit/mdd` in canonical syntax as test fixtures, checked to validate clean.

## [3.0.0] - 2026-09-08

### Added

- **`@table-N` / `@figure-N` references resolve.** Tables and images receive `table-N` / `figure-N` ids in document order, and the validator checks those references against the same numbering.
- **`DIRECTIVE_NOT_BLOCK_START` validation error.** A directive opener (`::header`, `::page-break ::`, …) must start a new Markdown block: the line above it has to be blank, a heading, a rule, or a fence delimiter. Otherwise the renderer sees the opener as paragraph text, so the validator now rejects what the renderer cannot render.
- **`{{page}}` in HTML.** In `::header`/`::footer`, `{{page}}` renders as `<span class="page-number">1</span>` instead of the literal token; paged outputs (PDF, DOCX) keep replacing it with a live field.

### Fixed

- **Derived paragraph classes no longer overwrite explicit ones.** `long-paragraph`, `legal-clause` and `numbered-item` are appended to an author's `{.class}` annotation instead of replacing it.
- **Directive end marker must be on its own line.** The renderer closed a directive on any paragraph ending in `::` while the validator only accepts a lone `::` line; both now agree.
- Type declarations (`types/mdd.d.ts`) match the runtime: `validateDocument` option names (`validateFrontmatterFlag`, …), `ValidationResult` fields, and directive container nodes; stale LaTeX-marker and unimplemented plugin-option types removed.

### Removed

- `./plugin-validator`: an unused second copy of the semantic-class list and nesting rules that had drifted from the JSON Schema; `./validator` is the single rule implementation.
- `remark-mdx-conditional` (and the optional `remark-mdx` peer dependency). It invoked `remark-mdx` as a transformer, which cannot work (remark-mdx is a parser extension and must be attached before parsing); per-file MDX selection lives in markdownkit's processor factory.

## [2.2.3] - 2026-06-18

### Fixed

- **`./validator` is now browser/bundler-safe.** It loaded its JSON Schema via
  `fs.readFileSync(fileURLToPath(import.meta.url) + …)`, which threw on import/use in a browser or a
  Vite/esbuild renderer (no `node:fs`/`node:path`/`node:url`). The two schemas are now `import`ed
  statically (`with { type: 'json' }`, Node ≥24), so the validator has no `node:*` runtime dependency
  and runs identically in Node and the browser. Validation behaviour and the schema files shipped in
  the package are unchanged.

## [0.1.0] - 2025-10-18

### Added

- **Initial release** - Extracted from @markdownkit/mdd v0.0.7
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

If you were using `@markdownkit/mdd` for plugins only:

**Before:**

```javascript
import { remarkMddDocumentStructure } from "@markdownkit/mdd";
// or
import remarkMddDocumentStructure from "@markdownkit/mdd/plugins/remark-mdd-document-structure.js";
```

**After:**

```javascript
import { remarkMddDocumentStructure } from "@markdownkit/remark-mdd";
// or
import remarkMddDocumentStructure from "@markdownkit/remark-mdd/plugins/document-structure";
```

### Breaking Changes

None - this is a new package extracted from the main MDD package.

[Unreleased]: https://github.com/entro314-labs/remark-mdd/compare/v4.1.0...HEAD
[4.1.0]: https://github.com/entro314-labs/remark-mdd/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/entro314-labs/remark-mdd/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/entro314-labs/remark-mdd/compare/v2.2.3...v3.0.0
[2.2.3]: https://github.com/entro314-labs/remark-mdd/compare/v0.1.0...v2.2.3
[0.1.0]: https://github.com/entro314-labs/remark-mdd/releases/tag/v0.1.0
