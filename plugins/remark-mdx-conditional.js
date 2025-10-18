/**
 * Conditional MDX plugin that only processes .mdx files, not .mdd files
 * This prevents MDX JavaScript parsing from interfering with MDD template variables
 */

import remarkMdx from 'remark-mdx';

/**
 * Conditional MDX processor
 * @returns {Function} Remark plugin function
 */
export default function remarkMdxConditional() {
  return function transformer(tree, file) {
    // Only apply MDX processing to .mdx files, skip .mdd files
    if (!file.path?.endsWith('.mdx')) {
      return;
    }
    
    // Apply standard remark-mdx processing for .mdx files
    const mdxPlugin = remarkMdx();
    return mdxPlugin.call(this, tree, file);
  };
}