/**
 * Conditional MDX plugin that only processes .mdx files, not .mdd files.
 *
 * This prevents MDX JavaScript parsing from interfering with MDD semantic
 * directives (`::letterhead`) and class annotations (`{.semantic-class}`),
 * which are not valid MDX expressions.
 *
 * `remark-mdx` is an OPTIONAL peer dependency. It is loaded lazily, and only
 * when an `.mdx` file is actually encountered, so importing this module (and
 * therefore the package root `index.js`) never fails when `remark-mdx` is not
 * installed (the common case for HTML/PDF/DOCX-only MDD consumers).
 */

let cachedMdxPlugin = null
let mdxLoadError = null

/**
 * Lazily resolve the `remark-mdx` plugin factory.
 *
 * @returns {Promise<Function>} the configured remark-mdx transformer factory
 * @throws {Error} when `remark-mdx` is not installed
 */
async function loadRemarkMdx() {
  if (cachedMdxPlugin) {
    return cachedMdxPlugin
  }
  if (mdxLoadError) {
    throw mdxLoadError
  }
  try {
    const mod = await import('remark-mdx')
    cachedMdxPlugin = mod.default ?? mod
    return cachedMdxPlugin
  } catch (err) {
    mdxLoadError = new Error(
      'remark-mdx is required to process .mdx files but is not installed. ' +
        'Install it with `pnpm add remark-mdx` (it is an optional peer dependency of @markdownkit/remark-mdd).',
    )
    mdxLoadError.cause = err
    throw mdxLoadError
  }
}

/**
 * Conditional MDX processor.
 *
 * @returns {import('unified').Plugin} Remark plugin
 */
export default function remarkMdxConditional() {
  return async function transformer(tree, file) {
    // Only apply MDX processing to .mdx files; skip .mdd (and everything else).
    if (!file.path?.endsWith('.mdx')) {
      return
    }

    const remarkMdx = await loadRemarkMdx()
    const mdxPlugin = remarkMdx()
    return mdxPlugin.call(this, tree, file)
  }
}
