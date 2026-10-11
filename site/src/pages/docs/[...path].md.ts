// Each docs page as plain markdown (docs/playbooks/lap.md …), for "Copy as Markdown" and for agents.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { FLAT, mdPath } from '../../docs/nav';

type Props = { title: string; summary: string; body: string };

export const getStaticPaths = (async () => {
  const all = [...(await getCollection('overview')), ...(await getCollection('playbooks')), ...(await getCollection('principles'))];
  return FLAT.flatMap((item) => {
    const entry = all.find((e) => e.collection === item.kind && (item.kind === 'overview' || e.id === item.id));
    if (!entry) return [];
    const path = mdPath(item).replace(/^docs\//, '').replace(/\.md$/, '');
    const props: Props = { title: item.label, summary: item.summary ?? '', body: entry.body ?? '' };
    return [{ params: { path }, props }];
  });
}) satisfies GetStaticPaths;

export const GET: APIRoute<Props> = ({ props }) =>
  new Response(`# ${props.title}\n\n${props.summary ? `> ${props.summary}\n\n` : ''}${props.body}`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
