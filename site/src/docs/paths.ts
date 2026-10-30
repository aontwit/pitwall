// The docs pages of one language: each nav item with the agent's markdown and, where there is one,
// the guide written for people. Shared by the English and the Thai routes.
import { getCollection } from 'astro:content';
import type { Lang } from '../i18n/ui';
import { FLAT, docPath } from './nav';

export async function docsPaths(lang: Lang) {
  const all = [...(await getCollection('overview')), ...(await getCollection('playbooks')), ...(await getCollection('principles'))];
  const guides = await getCollection(lang === 'th' ? 'guidesTh' : 'guides');

  // every page the plugin ships must have a place in the navigation, or the build stops
  const missing = all.filter((e) => e.collection !== 'overview' && !FLAT.some((i) => i.kind === e.collection && i.id === e.id));
  if (missing.length) throw new Error(`docs: add to src/docs/nav.ts: ${missing.map((e) => `${e.collection}/${e.id}`).join(', ')}`);

  return FLAT.flatMap((item) => {
    const entry = all.find((e) => e.collection === item.kind && (item.kind === 'overview' || e.id === item.id));
    const guide = guides.find((g) => g.data.playbook === item.id);
    // a guide-only page needs its guide in every language; every other page needs the agent's file
    if (item.kind === 'guides' ? !guide : !entry) throw new Error(`docs: no ${item.kind === 'guides' ? `${lang} guide` : 'repo file'} for ${item.kind}/${item.id}`);
    const slug = docPath(item).replace(/^docs\/?/, '').replace(/\/$/, '');
    return [{ params: { slug: slug || undefined }, props: { entry, item, guide, lang } }];
  });
}
