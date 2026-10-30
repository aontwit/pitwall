// sitemap.xml: the home page and every docs page in every language, from the same nav the docs are built from.
// ponytail: hand-rolled instead of @astrojs/sitemap; the page list is already in NAV
import type { APIRoute } from 'astro';
import { FLAT, docPath } from '../docs/nav';
import { href, languages } from '../i18n/ui';

export const GET: APIRoute = ({ site }) => {
  const urls = ['', ...languages.flatMap((l) => FLAT.map((i) => docPath(i, l)))].map((p) => `  <url><loc>${new URL(href(p), site).toString()}</loc></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
