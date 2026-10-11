import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import type { Nodes, Root } from 'mdast';
import { fileURLToPath } from 'node:url';
import { dirname, posix, relative, sep } from 'node:path';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const blob = 'https://github.com/aontwit/pitwall/blob/main/';

// Docs are the repo's own markdown:
// - a sibling link `./prove-it-works.md` becomes the sibling page `../prove-it-works/`
// - any other relative link in a repo file (`LICENSE`, `plugin/...`) points at the file on GitHub;
//   the site's own guides (under site/) link to site pages and are left alone
// - inline `/pitwall:lap` and friends get a class, so they read as commands
function docsMarkdown() {
  return (tree: Root, file: { path?: string }): void => {
    const rel = file.path ? relative(repoRoot, dirname(file.path)).split(sep).join('/') : '';
    const repoFile = file.path !== undefined && !rel.startsWith('site');
    const walk = (node: Nodes): void => {
      if (node.type === 'link') {
        const sibling = node.url.replace(/^\.\/([\w-]+)\.md$/, '../$1/');
        if (sibling !== node.url) node.url = sibling;
        else if (repoFile && !/^([a-z]+:|#|\/)/i.test(node.url)) node.url = blob + posix.normalize(posix.join(rel, node.url));
      }
      if (node.type === 'inlineCode' && node.value.startsWith('/pitwall:')) {
        const data = (node.data ??= {}) as { hProperties?: Record<string, unknown> };
        data.hProperties = { className: ['cmd'] };
      }
      if ('children' in node) node.children.forEach(walk);
    };
    walk(tree);
  };
}

export default defineConfig({
  // served from a custom domain (the CNAME is set in the repo's Pages settings), so no /pitwall base
  site: 'https://pitwall.apiwit.xyz',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
    routing: { prefixDefaultLocale: false },
  },
  markdown: {
    processor: unified({ remarkPlugins: [docsMarkdown] }),
    // dual themes: dark is inline, light comes from --shiki-light vars when the docs are in light mode
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark-dimmed' }, defaultColor: 'dark' },
  },
});
