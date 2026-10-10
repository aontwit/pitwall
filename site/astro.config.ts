import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';

type MdNode = { type: string; url?: string; children?: MdNode[] };

// Docs are the repo's own markdown. A sibling link `./prove-it-works.md` becomes the sibling page `../prove-it-works/`.
function siblingLinks() {
  const walk = (node: MdNode): void => {
    if (node.type === 'link' && node.url) node.url = node.url.replace(/^\.\/([\w-]+)\.md$/, '../$1/');
    node.children?.forEach(walk);
  };
  return walk;
}

export default defineConfig({
  site: 'https://aontwit.github.io',
  base: '/pitwall',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
    routing: { prefixDefaultLocale: false },
  },
  markdown: {
    processor: unified({ remarkPlugins: [siblingLinks] }),
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
